/**
 * guard-engine.js — 警卫引擎
 *
 * 核心职责：
 *   1. 监听用户主动查看行为（点开评论/@列表）
 *   2. 检测高频@骚扰（正则，免费）
 *   3. 复用 Scanner 的 AI 分析结果（Evidence 库）
 *   4. 提供警卫提醒，让用户决策（拉黑/反击/忽略）
 *
 * 设计原则：
 *   - 用户主动触发，不后台静默扫描
 *   - 只读取当天公开数据，不碰私信
 *   - 优先复用已有 AI 结果，节省 Token
 *   - 高频@检测用正则，免费
 *   - 用户确认后才消耗 Token 分析
 *
 * 数据边界：
 *   ✅ 可以读：当前用户当天的评论、公开@提及、平台已收档的攻击评论
 *   ❌ 不能读：私信、历史评论(>24h)、其他用户的评论
 */

import { getQuotaManager, QUOTA_FEATURE } from './quota-manager.js';

// ── 警卫模式 ──
export const GUARD_MODE = {
  MONITOR: 'monitor',       // 监控模式（默认）
  SEMI_AUTO: 'semi_auto',   // 半自动（用户确认后分析）
};

// ── 威胁等级 ──
export const THREAT_LEVEL = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// ── 高频@阈值 ──
const HIGH_FREQUENCY_THRESHOLD = {
  sameUserHour: 5,      // 同一用户 1 小时内 @ 你 5 次
  sameUserDay: 10,      // 同一用户 1 天内 @ 你 10 次
};

// ── 存储键名 ──
const HARASSER_STORAGE_KEY = 'cs_guard_harasser_profiles_v1';
const ENGINE_CONFIG_KEY = 'cs_guard_engine_config_v1';
const FREQUENCY_CACHE_KEY = 'cs_guard_frequency_cache_v1';

// ── 默认配置 ──
const DEFAULT_CONFIG = {
  mode: GUARD_MODE.MONITOR,
  enabled: false,
  maxAnalysisPerDay: 20,
};

export class GuardEngine {
  constructor(services = {}) {
    this.services = services;
    this.quotaManager = getQuotaManager();
    this.config = this._loadConfig();
    this.harasserProfiles = this._loadHarasserProfiles();
    this.frequencyCache = this._loadFrequencyCache();
    this._listeners = new Set();
    this._abortController = null;
  }

  /**
   * 检查引擎是否可用
   */
  isEnabled() {
    return this.config.enabled;
  }

  /**
   * 设置警卫模式
   */
  setMode(mode) {
    if (!Object.values(GUARD_MODE).includes(mode)) {
      console.warn(`[GuardEngine] 无效模式：${mode}`);
      return;
    }
    this.config.mode = mode;
    this._saveConfig();
  }

  /**
   * 启用/禁用引擎
   */
  setEnabled(enabled) {
    this.config.enabled = !!enabled;
    this._saveConfig();
  }

  /**
   * 用户主动触发警卫检查（入口方法）
   * @param {object} context - { targetUserId, targetUserName, platform, comments }
   * @returns {Promise<object>} { action: 'alert'|'ignore', alert?, profile? }
   */
  async checkUser(context) {
    if (!this.isEnabled()) {
      return { action: 'ignore', reason: 'engine_disabled' };
    }

    const { targetUserId, targetUserName, platform, comments } = context;

    if (!targetUserId || !comments || comments.length === 0) {
      return { action: 'ignore', reason: 'invalid_context' };
    }

    // 1. 检查高频@（正则，免费）
    const frequencyResult = this._checkFrequency(targetUserId, comments);

    // 2. 查询 Evidence 库（复用已有 AI 结果）
    const evidenceResult = this._queryEvidence(targetUserId, comments);

    // 3. 更新骚扰者画像
    const profile = this._updateHarasserProfile({
      userId: targetUserId,
      userName: targetUserName,
      platform,
      comments,
      frequencyResult,
      evidenceResult,
    });

    // 4. 计算威胁等级
    const threatLevel = this._calculateThreatLevel(profile);
    profile.threatLevel = threatLevel;
    this._saveHarasserProfiles();

    // 5. 判断是否需要提醒
    if (this._shouldAlert(profile, frequencyResult, evidenceResult)) {
      return {
        action: 'alert',
        alert: {
          threatLevel,
          frequency: frequencyResult,
          evidence: evidenceResult,
          profile,
          suggestion: this._generateSuggestion(profile),
        },
        profile,
      };
    }

    return { action: 'ignore', reason: 'no_threat_detected', profile };
  }

  /**
   * 用户确认后执行 AI 分析（消耗 Token）
   * @param {object} context - 原始上下文
   * @returns {Promise<object>}
   */
  async analyzeWithAI(context) {
    if (!this.quotaManager.canUse(QUOTA_FEATURE.GUARD_ENGINE)) {
      return { action: 'ignore', reason: 'quota_exceeded' };
    }

    const { targetUserId, comments } = context;

    this._abortController = new AbortController();

    try {
      // 调用 AI 分析
      const analysis = await this._performAIAnalysis(comments);

      if (!analysis) {
        return { action: 'ignore', reason: 'analysis_failed' };
      }

      // 扣减限额
      this.quotaManager.use(QUOTA_FEATURE.GUARD_ENGINE);

      // 更新画像
      const profile = this.harasserProfiles[targetUserId];
      if (profile) {
        profile.lastAIAnalysis = Date.now();
        profile.aiAnalysisResult = analysis;
        this._saveHarasserProfiles();
      }

      this._emit({
        type: 'ai_analysis_completed',
        context,
        analysis,
        profile,
      });

      return {
        action: 'analyzed',
        analysis,
        profile,
      };
    } catch (e) {
      if (e.name === 'AbortError') {
        return { action: 'ignore', reason: 'aborted' };
      }
      console.error('[GuardEngine] AI 分析失败', e);
      return { action: 'ignore', reason: 'error', error: e.message };
    } finally {
      this._abortController = null;
    }
  }

  /**
   * 中断当前分析
   */
  abort() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  /**
   * 获取骚扰者画像
   */
  getHarasserProfile(userId) {
    return this.harasserProfiles[userId] || null;
  }

  /**
   * 获取所有骚扰者画像
   */
  getAllHarasserProfiles() {
    return { ...this.harasserProfiles };
  }

  /**
   * 清除某骚扰者的画像
   */
  clearHarasserProfile(userId) {
    delete this.harasserProfiles[userId];
    this._saveHarasserProfiles();
  }

  // ── 私有方法 ──

  /**
   * 检查高频@（正则，免费）
   * @private
   */
  _checkFrequency(userId, comments) {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let countHour = 0;
    let countDay = 0;

    for (const comment of comments) {
      const timestamp = comment.timestamp || now;
      if (timestamp >= oneHourAgo) countHour++;
      if (timestamp >= oneDayAgo) countDay++;
    }

    const isHighFrequencyHour = countHour >= HIGH_FREQUENCY_THRESHOLD.sameUserHour;
    const isHighFrequencyDay = countDay >= HIGH_FREQUENCY_THRESHOLD.sameUserDay;

    return {
      countHour,
      countDay,
      isHighFrequencyHour,
      isHighFrequencyDay,
      isHighFrequency: isHighFrequencyHour || isHighFrequencyDay,
    };
  }

  /**
   * 查询 Evidence 库（复用已有 AI 结果）
   * @private
   */
  _queryEvidence(userId, comments) {
    const evidence = this.services.evidence;
    if (!evidence) {
      return { hasEvidence: false, toxicCount: 0 };
    }

    let toxicCount = 0;
    const toxicComments = [];

    for (const comment of comments) {
      // 查询该评论是否已被 AI 分析为 toxic
      const entry = evidence.findByText?.(comment.text);
      if (entry && entry.verdict === 'toxic') {
        toxicCount++;
        toxicComments.push({
          text: comment.text,
          timestamp: comment.timestamp,
          riskLevel: entry.result?.riskLevel || 'medium',
        });
      }
    }

    return {
      hasEvidence: toxicCount > 0,
      toxicCount,
      toxicComments,
    };
  }

  /**
   * 更新骚扰者画像
   * @private
   */
  _updateHarasserProfile(data) {
    const { userId, userName, platform, comments, frequencyResult, evidenceResult } = data;

    if (!this.harasserProfiles[userId]) {
      this.harasserProfiles[userId] = {
        userId,
        userName: userName || userId,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        harassmentCount: 0,
        comments: [],
        platforms: [],
        threatLevel: THREAT_LEVEL.LOW,
        frequencyData: {},
        evidenceData: {},
        lastAIAnalysis: null,
        aiAnalysisResult: null,
      };
    }

    const profile = this.harasserProfiles[userId];
    profile.lastSeen = Date.now();
    profile.harassmentCount += comments.length;

    // 添加评论（只保留最近 50 条）
    profile.comments = [...profile.comments, ...comments].slice(-50);

    // 记录平台
    if (!profile.platforms.includes(platform)) {
      profile.platforms.push(platform);
    }

    // 更新频率数据
    profile.frequencyData = frequencyResult;

    // 更新证据数据
    profile.evidenceData = evidenceResult;

    return profile;
  }

  /**
   * 计算威胁等级
   * @private
   */
  _calculateThreatLevel(profile) {
    const { frequencyData, evidenceData } = profile;

    // 高频@ + 有毒证据 = 极重度
    if (frequencyData.isHighFrequency && evidenceData.toxicCount >= 3) {
      return THREAT_LEVEL.CRITICAL;
    }

    // 高频@ 或 有毒证据 >= 2 = 重度
    if (frequencyData.isHighFrequency || evidenceData.toxicCount >= 2) {
      return THREAT_LEVEL.HIGH;
    }

    // 有毒证据 = 1 或 频率较高 = 中度
    if (evidenceData.toxicCount === 1 || frequencyData.countDay >= 5) {
      return THREAT_LEVEL.MEDIUM;
    }

    // 其他 = 轻度
    return THREAT_LEVEL.LOW;
  }

  /**
   * 判断是否需要提醒
   * @private
   */
  _shouldAlert(profile, frequencyResult, evidenceResult) {
    // 高频@ 必须提醒
    if (frequencyResult.isHighFrequency) return true;

    // 有有毒证据 必须提醒
    if (evidenceResult.hasEvidence) return true;

    // 威胁等级 >= MEDIUM 提醒
    if (profile.threatLevel === THREAT_LEVEL.MEDIUM ||
        profile.threatLevel === THREAT_LEVEL.HIGH ||
        profile.threatLevel === THREAT_LEVEL.CRITICAL) {
      return true;
    }

    return false;
  }

  /**
   * 生成建议文本
   * @private
   */
  _generateSuggestion(profile) {
    const threatLabels = {
      [THREAT_LEVEL.LOW]: '轻度骚扰',
      [THREAT_LEVEL.MEDIUM]: '中度骚扰',
      [THREAT_LEVEL.HIGH]: '重度骚扰',
      [THREAT_LEVEL.CRITICAL]: '极重度骚扰',
    };

    const threatLabel = threatLabels[profile.threatLevel] || '未知';
    const daysSinceFirst = Math.floor((Date.now() - profile.firstSeen) / (1000 * 60 * 60 * 24));

    let suggestion = `该用户属于${threatLabel}，已持续 ${daysSinceFirst} 天，共骚扰 ${profile.harassmentCount} 次。`;

    if (profile.threatLevel === THREAT_LEVEL.LOW) {
      suggestion += '建议暂时忽略。';
    } else {
      suggestion += '建议采取拉黑措施。';
    }

    return suggestion;
  }

  /**
   * 执行 AI 分析
   * @private
   */
  async _performAIAnalysis(comments) {
    const ai = this.services.aiAnalyzer;
    if (!ai) {
      console.warn('[GuardEngine] AI 不可用');
      return null;
    }

    // 构建分析提示
    const commentTexts = comments.map(c => c.text).join('\n');
    const prompt = `请分析以下评论是否构成骚扰，评估攻击性强度（0-10），并给出建议：

${commentTexts}

请输出：
1. 攻击性强度（0-10）
2. 是否构成骚扰（是/否）
3. 建议措施（忽略/警告/拉黑）`;

    try {
      const response = await ai.chat(prompt, {
        maxTokens: 300,
        signal: this._abortController?.signal,
      });

      return typeof response === 'string' ? response : response?.text || response?.content || null;
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      console.error('[GuardEngine] AI 分析失败', e);
      return null;
    }
  }

  /**
   * 加载配置
   * @private
   */
  _loadConfig() {
    try {
      const saved = GM_getValue(ENGINE_CONFIG_KEY, null);
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('[GuardEngine] 加载配置失败', e);
    }
    return { ...DEFAULT_CONFIG };
  }

  /**
   * 保存配置
   * @private
   */
  _saveConfig() {
    try {
      GM_setValue(ENGINE_CONFIG_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.error('[GuardEngine] 保存配置失败', e);
    }
  }

  /**
   * 加载骚扰者画像
   * @private
   */
  _loadHarasserProfiles() {
    try {
      const saved = GM_getValue(HARASSER_STORAGE_KEY, null);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[GuardEngine] 加载骚扰者画像失败', e);
    }
    return {};
  }

  /**
   * 保存骚扰者画像
   * @private
   */
  _saveHarasserProfiles() {
    try {
      GM_setValue(HARASSER_STORAGE_KEY, JSON.stringify(this.harasserProfiles));
    } catch (e) {
      console.error('[GuardEngine] 保存骚扰者画像失败', e);
    }
  }

  /**
   * 加载频率缓存
   * @private
   */
  _loadFrequencyCache() {
    try {
      const saved = GM_getValue(FREQUENCY_CACHE_KEY, null);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[GuardEngine] 加载频率缓存失败', e);
    }
    return {};
  }

  /**
   * 发出事件
   * @private
   */
  _emit(evt) {
    for (const fn of this._listeners) {
      try {
        fn(evt);
      } catch {}
    }
  }

  /**
   * 订阅事件
   */
  onEvent(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }
}

// ── 单例模式 ──
let _instance = null;

export function getGuardEngine(services) {
  if (!_instance) {
    _instance = new GuardEngine(services);
  }
  return _instance;
}

export function createGuardEngine(services) {
  return new GuardEngine(services);
}
