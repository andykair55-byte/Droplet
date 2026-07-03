/**
 * hot-topic-manager.js — 热点内容过滤管理器
 *
 * 与 topic-filter.js 互补：
 *   - topic-filter 管理永久性规则（人身攻击、骚扰等）
 *   - HotTopicManager 管理时效性规则（热点事件，如"鹅腿阿姨"）
 *
 * 核心特性：
 *   1. TTL 机制：规则带过期时间，到期自动失效
 *   2. 组合触发：支持 any / all / combination 三种触发模式，降低误杀
 *   3. 来源标记：manual（手动添加） / ai（AI 代理添加）
 *   4. 状态管理：active / expired / disabled
 *   5. AI 代理：扫描统计 + 自动添加/清理（可选）
 *
 * 数据结构：
 *   HotTopic {
 *     id, label, keywords, triggerMode, combinationRule?,
 *     scopes, ttl, ttlDays, source, status, createdAt, expiresAt
 *   }
 */

const HOT_TOPIC_KEY = 'cs_hot_topics';
const HOT_TOPIC_STATS_KEY = 'cs_hot_topics_stats';

/** 默认 TTL 天数选项 */
export const TTL_DAYS_OPTIONS = [7, 14, 30];

/** 触发模式 */
export const TRIGGER_MODE = {
  ANY: 'any',             // 任一关键词命中即屏蔽
  ALL: 'all',             // 所有关键词同时命中才屏蔽
  COMBINATION: 'combination', // 组合触发
};

/** 规则状态 */
export const HOT_TOPIC_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  DISABLED: 'disabled',
};

/**
 * 热点话题管理器
 *
 * 设计要点：
 *   - 不维护运行时索引，匹配时遍历 active 规则（规则数量有限，O(n) 可接受）
 *   - TTL 检查惰性执行：每次匹配前检查过期，避免定时器开销
 *   - 持久化采用整体 JSON 保存（规则数量 <100，无需分片）
 */
export class HotTopicManager {
  constructor() {
    this.topics = [];          // HotTopic[]
    this.stats = {             // 扫描统计（供 AI 代理决策）
      totalMatches: 0,         // 累计命中次数
      matchesByTopic: {},      // { topicId: count }
      lastScanAt: null,
    };
    this._load();
  }

  // ── 持久化 ────────────────────────────────────────────────────────────

  _load() {
    try {
      const saved = JSON.parse(GM_getValue(HOT_TOPIC_KEY, '[]'));
      this.topics = Array.isArray(saved) ? saved : [];
      // 启动时清理过期规则（标记为 expired，不删除数据）
      this._markExpired();
    } catch {
      this.topics = [];
    }
    try {
      const stats = JSON.parse(GM_getValue(HOT_TOPIC_STATS_KEY, '{}'));
      this.stats = { ...this.stats, ...stats };
    } catch {
      // 使用默认 stats
    }
  }

  _save() {
    try {
      GM_setValue(HOT_TOPIC_KEY, JSON.stringify(this.topics));
    } catch { /* silent */ }
  }

  _saveStats() {
    try {
      GM_setValue(HOT_TOPIC_STATS_KEY, JSON.stringify(this.stats));
    } catch { /* silent */ }
  }

  /**
   * 惰性标记过期规则
   * 不删除数据，只把 status 改为 expired，保留历史记录供 AI 分析
   */
  _markExpired() {
    const now = Date.now();
    let changed = false;
    for (const t of this.topics) {
      if (t.status === HOT_TOPIC_STATUS.ACTIVE && t.expiresAt && now >= t.expiresAt) {
        t.status = HOT_TOPIC_STATUS.EXPIRED;
        changed = true;
      }
    }
    if (changed) this._save();
  }

  // ── CRUD ──────────────────────────────────────────────────────────────

  /**
   * 创建热点规则
   * @param {object} opts
   * @param {string} opts.label - 规则名称（如"鹅腿阿姨嘲讽"）
   * @param {string[]} opts.keywords - 关键词列表
   * @param {string} [opts.triggerMode='any'] - 触发模式
   * @param {object} [opts.combinationRule] - 组合触发规则 { all: [], any: [] }
   * @param {string[]} [opts.scopes=['comment','reply']] - 作用范围
   * @param {number} [opts.ttlDays=7] - TTL 天数
   * @param {string} [opts.source='manual'] - 来源
   * @returns {{ success: boolean, topicId?: string, reason?: string }}
   */
  create(opts = {}) {
    const validation = this._validate(opts);
    if (!validation.ok) {
      return { success: false, reason: validation.reason };
    }

    const now = Date.now();
    const ttlDays = opts.ttlDays || 7;
    const topic = {
      id: `hot_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      label: opts.label,
      keywords: opts.keywords.map(k => k.toLowerCase().trim()).filter(Boolean),
      triggerMode: opts.triggerMode || TRIGGER_MODE.ANY,
      combinationRule: opts.triggerMode === TRIGGER_MODE.COMBINATION
        ? this._normalizeCombinationRule(opts.combinationRule, opts.keywords)
        : undefined,
      scopes: opts.scopes && opts.scopes.length ? opts.scopes : ['comment', 'reply'],
      ttlDays,
      source: opts.source === 'ai' ? 'ai' : 'manual',
      category: opts.category || '',  // 分类标签
      status: HOT_TOPIC_STATUS.ACTIVE,
      createdAt: now,
      expiresAt: now + ttlDays * 24 * 60 * 60 * 1000,
      hits: 0,             // 命中次数
      lastHitAt: null,     // 最近命中时间
    };

    this.topics.unshift(topic);
    this._save();
    return { success: true, topicId: topic.id };
  }

  /**
   * 更新热点规则（支持续期、修改关键词等）
   * @param {string} topicId
   * @param {object} updates
   * @returns {{ success: boolean, reason?: string }}
   */
  update(topicId, updates = {}) {
    const topic = this.topics.find(t => t.id === topicId);
    if (!topic) return { success: false, reason: '规则不存在' };

    if (updates.label !== undefined) topic.label = updates.label;
    if (Array.isArray(updates.keywords)) {
      topic.keywords = updates.keywords.map(k => k.toLowerCase().trim()).filter(Boolean);
    }
    if (updates.triggerMode && Object.values(TRIGGER_MODE).includes(updates.triggerMode)) {
      topic.triggerMode = updates.triggerMode;
      if (updates.triggerMode === TRIGGER_MODE.COMBINATION) {
        topic.combinationRule = this._normalizeCombinationRule(
          updates.combinationRule, topic.keywords
        );
      } else {
        topic.combinationRule = undefined;
      }
    }
    if (Array.isArray(updates.scopes)) topic.scopes = updates.scopes;
    if (updates.source === 'ai' || updates.source === 'manual') topic.source = updates.source;
    if (updates.category !== undefined) topic.category = updates.category;

    // 续期：重新计算 expiresAt
    if (updates.ttlDays) {
      topic.ttlDays = updates.ttlDays;
      topic.expiresAt = Date.now() + updates.ttlDays * 24 * 60 * 60 * 1000;
      topic.status = HOT_TOPIC_STATUS.ACTIVE; // 续期后重新激活
    }

    // 手动启用/禁用
    if (updates.status === HOT_TOPIC_STATUS.ACTIVE) {
      topic.status = HOT_TOPIC_STATUS.ACTIVE;
    } else if (updates.status === HOT_TOPIC_STATUS.DISABLED) {
      topic.status = HOT_TOPIC_STATUS.DISABLED;
    }

    this._save();
    return { success: true };
  }

  /**
   * 删除热点规则（放入回收站，可恢复）
   * @param {string} topicId
   * @param {object} [recycleBin] - 回收站实例
   * @returns {{ success: boolean, removed?: object }}
   */
  delete(topicId, recycleBin = null) {
    const idx = this.topics.findIndex(t => t.id === topicId);
    if (idx === -1) return { success: false };
    const removed = this.topics[idx];

    // 放入回收站
    if (recycleBin) {
      recycleBin.put('hot_topic', removed, removed.label, removed.category || '');
    }

    this.topics.splice(idx, 1);
    this._save();
    return { success: true, removed };
  }

  /**
   * 恢复热点规则（从回收站恢复）
   * @param {object} data - 回收站中保存的完整规则数据
   * @returns {{ success: boolean, topicId?: string }}
   */
  restore(data) {
    if (!data || !data.id) return { success: false, reason: '数据无效' };
    // 检查是否已存在
    if (this.topics.some(t => t.id === data.id)) {
      return { success: false, reason: '规则已存在' };
    }
    this.topics.unshift({
      ...data,
      status: HOT_TOPIC_STATUS.ACTIVE,
      // 重新计算过期时间（如果已过期则续期7天）
      expiresAt: data.expiresAt && data.expiresAt > Date.now()
        ? data.expiresAt
        : Date.now() + (data.ttlDays || 7) * 24 * 60 * 60 * 1000,
    });
    this._save();
    return { success: true, topicId: data.id };
  }

  /**
   * 设置热点规则分类
   * @param {string} topicId
   * @param {string} category
   * @returns {{ success: boolean }}
   */
  setCategory(topicId, category) {
    const topic = this.topics.find(t => t.id === topicId);
    if (!topic) return { success: false };
    topic.category = category;
    this._save();
    return { success: true };
  }

  /**
   * 续期规则（便捷方法）
   * @param {string} topicId
   * @param {number} [ttlDays=7]
   * @returns {{ success: boolean, reason?: string }}
   */
  renew(topicId, ttlDays = 7) {
    return this.update(topicId, { ttlDays, status: HOT_TOPIC_STATUS.ACTIVE });
  }

  /**
   * 批量清理过期规则
   * @returns {{ success: boolean, removedCount: number }}
   */
  purgeExpired() {
    const before = this.topics.length;
    this.topics = this.topics.filter(t => t.status !== HOT_TOPIC_STATUS.EXPIRED);
    const removedCount = before - this.topics.length;
    if (removedCount > 0) this._save();
    return { success: true, removedCount };
  }

  // ── 查询 ──────────────────────────────────────────────────────────────

  /**
   * 获取所有规则（按状态分组）
   * @returns {{ active: object[], expired: object[], disabled: object[] }}
   */
  getAll() {
    this._markExpired();
    const result = { active: [], expired: [], disabled: [] };
    for (const t of this.topics) {
      if (t.status === HOT_TOPIC_STATUS.ACTIVE) result.active.push(t);
      else if (t.status === HOT_TOPIC_STATUS.EXPIRED) result.expired.push(t);
      else result.disabled.push(t);
    }
    result.active.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    result.expired.sort((a, b) => (b.expiresAt || 0) - (a.expiresAt || 0));
    result.disabled.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    return result;
  }

  /**
   * 获取所有 active 规则（供 Detector 匹配用）
   * @returns {object[]}
   */
  getActive() {
    this._markExpired();
    return this.topics.filter(t => t.status === HOT_TOPIC_STATUS.ACTIVE);
  }

  /**
   * 按 ID 获取规则
   */
  getById(topicId) {
    return this.topics.find(t => t.id === topicId) || null;
  }

  // ── 匹配 ──────────────────────────────────────────────────────────────

  /**
   * 检测文本是否命中热点规则
   * @param {string} text - 归一化后的文本
   * @param {string} [scope] - 当前内容范围（如 'comment'），用于过滤规则
   * @returns {{ hit: boolean, matchedTopics: object[] }}
   */
  detect(text, scope = null) {
    if (!text) return { hit: false, matchedTopics: [], reviewed: [] };

    const lower = text.toLowerCase();
    const activeTopics = this.getActive();
    if (activeTopics.length === 0) {
      this.stats.lastScanAt = Date.now();
      return { hit: false, matchedTopics: [], reviewed: [] };
    }

    const matched = [];
    const reviewed = [];  // 每条命中规则的复核结果
    for (const topic of activeTopics) {
      // scope 过滤：规则声明了 scopes，且当前 scope 不在其中则跳过
      if (scope && topic.scopes && topic.scopes.length > 0 && !topic.scopes.includes(scope)) {
        continue;
      }

      if (this._matchTopic(topic, lower)) {
        // 启发式复核：any 模式才需要，combination/all 直接 pass
        const review = this._heuristicReview(topic, text, lower);
        matched.push(topic);
        reviewed.push({ topic, review });
        // 更新命中统计
        topic.hits = (topic.hits || 0) + 1;
        topic.lastHitAt = Date.now();
        this.stats.matchesByTopic[topic.id] = (this.stats.matchesByTopic[topic.id] || 0) + 1;
        this.stats.totalMatches++;
      }
    }

    if (matched.length > 0) {
      this._save();           // 持久化命中次数
      this._saveStats();
    }
    this.stats.lastScanAt = Date.now();

    return { hit: matched.length > 0, matchedTopics: matched, reviewed };
  }

  /**
   * 单条规则匹配核心逻辑
   */
  _matchTopic(topic, lowerText) {
    const mode = topic.triggerMode || TRIGGER_MODE.ANY;

    if (mode === TRIGGER_MODE.ANY) {
      // 任一关键词命中
      return topic.keywords.some(kw => lowerText.includes(kw));
    }

    if (mode === TRIGGER_MODE.ALL) {
      // 所有关键词同时命中
      return topic.keywords.every(kw => lowerText.includes(kw));
    }

    if (mode === TRIGGER_MODE.COMBINATION) {
      const rule = topic.combinationRule;
      if (!rule) return false;
      // all 中的词必须全部出现
      if (rule.all && rule.all.length > 0) {
        const allHit = rule.all.every(kw => lowerText.includes(kw));
        if (!allHit) return false;
      }
      // any 中的词至少出现一个
      if (rule.any && rule.any.length > 0) {
        return rule.any.some(kw => lowerText.includes(kw));
      }
      // 只有 all 没有 any：all 全部命中即触发
      return rule.all && rule.all.length > 0;
    }

    return false;
  }

  // ── 启发式复核（本地、无需 API key）──────────────────────────────
  //
  // 目的：降低 substring 匹配的误杀率。
  // 调用时机：any 模式命中后，在返回前做一次本地复核。
  // 不调用 LLM，纯本地规则判断。
  //
  // 复核维度：
  //   1. 否定语境：关键词前 5 字内有"不/没/讨厌/反感/不喜欢/别再"等
  //   2. 词边界：关键词前后字符是标点/空格/句首句尾 → 更可能是真实命中
  //   3. 数字边界：关键词后紧跟数字（如"原神2"在"原神20"中）→ 降权
  //   4. 长度比例：短文本中的长关键词更可疑（可能是误命中）
  //
  // 返回值：
  //   { pass: true }  → 复核通过，确认命中
  //   { pass: false, reason } → 复核未通过，建议降级处理

  /**
   * 否定词列表（关键词前出现这些词时降权）
   */
  static NEGATION_PREFIXES = ['不', '没', '讨厌', '反感', '不喜欢', '别再', '不想', '不要', '并非', '不是', '没有', '无'];

  /**
   * 词边界字符集合（关键词前后是这些字符时，更可能是真实命中）
   */
  static BOUNDARY_CHARS = new Set([
    ' ', '\t', '\n', '\r', '，', '。', '！', '？', '、', '；', '：',
    ',', '.', '!', '?', ';', ':', '"', "'", '(', ')', '（', '）',
    '[', ']', '【', '】', '{', '}', '《', '》', '-', '—', '~', '/',
  ]);

  /**
   * 对单条规则的命中结果做启发式复核
   * @param {object} topic - 命中的热点规则
   * @param {string} originalText - 原始文本（未 toLowerCase）
   * @param {string} lowerText - toLowerCase 后的文本
   * @returns {{ pass: boolean, reason?: string, confidence?: number }}
   */
  _heuristicReview(topic, originalText, lowerText) {
    const mode = topic.triggerMode || TRIGGER_MODE.ANY;

    // combination 模式：all+any 已精准，直接通过
    if (mode === TRIGGER_MODE.COMBINATION) {
      return { pass: true, confidence: 0.95 };
    }

    // all 模式：多词同时命中已降低误杀，直接通过
    if (mode === TRIGGER_MODE.ALL) {
      return { pass: true, confidence: 0.90 };
    }

    // any 模式：误杀风险最高，需要复核
    // 找到命中的具体关键词
    const hitKeywords = topic.keywords.filter(kw => lowerText.includes(kw));
    if (hitKeywords.length === 0) {
      return { pass: true, confidence: 0.85 };
    }

    let maxPenalty = 0;       // 最大扣分
    let penaltyReason = '';

    for (const kw of hitKeywords) {
      const kwLower = kw.toLowerCase();
      let idx = lowerText.indexOf(kwLower);
      while (idx !== -1) {
        const before = idx > 0 ? lowerText[idx - 1] : '';
        const after = (idx + kwLower.length) < lowerText.length ? lowerText[idx + kwLower.length] : '';

        // ── 1. 否定语境检测 ──
        // 检查关键词前 5 个字符内是否有否定词
        const prefix = lowerText.substring(Math.max(0, idx - 5), idx);
        const hasNegation = HotTopicManager.NEGATION_PREFIXES.some(neg => prefix.includes(neg));
        if (hasNegation) {
          if (maxPenalty < 0.4) {
            maxPenalty = 0.4;
            penaltyReason = `否定语境：关键词"${kw}"前有否定词`;
          }
        }

        // ── 2. 数字边界检测 ──
        // 关键词后紧跟数字（如"原神2"在"原神20周年"中）
        // 即使关键词本身以数字结尾，如果后面还有数字，仍可能是版本号误匹配
        if (after && /\d/.test(after)) {
          // 检查关键词的数字部分和后续数字是否构成更长的数字串
          // 例如：关键词"原神2"，文本"原神20" → "2"+"0"构成"20"，是误匹配
          const kwEndsWithDigit = /\d$/.test(kwLower);
          if (kwEndsWithDigit) {
            // 关键词以数字结尾：检查后续字符是否也是数字
            // 如果是，说明关键词的数字部分被扩展了（如"2"→"20"），是误匹配
            if (maxPenalty < 0.3) {
              maxPenalty = 0.3;
              penaltyReason = `数字边界：关键词"${kw}"后紧跟数字"${after}"，可能是版本号误匹配`;
            }
          } else {
            // 关键词不以数字结尾：后跟数字也可能是误匹配（如"苹果5"在"苹果50"中）
            if (maxPenalty < 0.3) {
              maxPenalty = 0.3;
              penaltyReason = `数字边界：关键词"${kw}"后紧跟数字"${after}"`;
            }
          }
        }

        // ── 3. 英文短词子串检测 ──
        // 英文关键词长度 ≤ 3 且作为子串出现在更长单词中
        if (/^[a-z]+$/.test(kwLower) && kwLower.length <= 3) {
          // 检查前后字符是否为字母（说明是更长单词的一部分）
          const beforeIsAlpha = before && /[a-z]/.test(before);
          const afterIsAlpha = after && /[a-z]/.test(after);
          if (beforeIsAlpha || afterIsAlpha) {
            if (maxPenalty < 0.5) {
              maxPenalty = 0.5;
              penaltyReason = `英文短词子串："${kw}"是更长单词的一部分`;
            }
          }
        }

        // ── 4. 长度比例检测 ──
        // 关键词长度 / 文本长度 > 0.5 时降权（短文本中的长关键词更可疑）
        // 但只在文本较短时（< 20 字）应用此规则
        if (lowerText.length < 20 && kwLower.length / lowerText.length > 0.5) {
          if (maxPenalty < 0.2) {
            maxPenalty = 0.2;
            penaltyReason = `长度比例：关键词"${kw}"占文本比例过高`;
          }
        }

        idx = lowerText.indexOf(kwLower, idx + 1);
      }
    }

    // 基础置信度 0.92，减去最大扣分
    const finalConfidence = Math.max(0.3, 0.92 - maxPenalty);

    // 扣分超过 0.3 时，复核未通过
    if (maxPenalty >= 0.3) {
      return { pass: false, reason: penaltyReason, confidence: finalConfidence };
    }

    return { pass: true, confidence: finalConfidence };
  }

  // ── 校验与归一化 ──────────────────────────────────────────────────────

  _validate(opts) {
    if (!opts.label || typeof opts.label !== 'string' || opts.label.trim().length < 2) {
      return { ok: false, reason: '规则名称至少 2 个字符' };
    }
    if (!Array.isArray(opts.keywords) || opts.keywords.length === 0) {
      return { ok: false, reason: '至少需要 1 个关键词' };
    }
    // 关键词长度校验
    for (const kw of opts.keywords) {
      if (typeof kw !== 'string' || kw.trim().length < 1) {
        return { ok: false, reason: '关键词不能为空' };
      }
    }
    // combination 模式：提前归一化 combinationRule
    if (opts.triggerMode === TRIGGER_MODE.COMBINATION) {
      const rule = this._normalizeCombinationRule(opts.combinationRule, opts.keywords);
      if ((!rule.all || rule.all.length === 0) && (!rule.any || rule.any.length === 0)) {
        return { ok: false, reason: '组合触发模式需要至少 1 个关键词（all 或 any）' };
      }
    }
    return { ok: true };
  }

  /**
   * 归一化组合规则：确保关键词小写、去重
   */
  _normalizeCombinationRule(rule, fallbackKeywords) {
    if (!rule) {
      // 没有显式提供 combinationRule，用 keywords 构造默认规则
      // 默认：所有关键词必须同时出现
      return {
        all: fallbackKeywords.map(k => k.toLowerCase().trim()).filter(Boolean),
        any: [],
      };
    }
    return {
      all: (rule.all || []).map(k => k.toLowerCase().trim()).filter(Boolean),
      any: (rule.any || []).map(k => k.toLowerCase().trim()).filter(Boolean),
    };
  }

  // ── AI 代理支持 ──────────────────────────────────────────────────────

  /**
   * 获取扫描统计报告（供 AI 代理决策）
   * @returns {object}
   */
  getStatsReport() {
    this._markExpired();
    const all = this.topics;
    return {
      total: all.length,
      active: all.filter(t => t.status === HOT_TOPIC_STATUS.ACTIVE).length,
      expired: all.filter(t => t.status === HOT_TOPIC_STATUS.EXPIRED).length,
      disabled: all.filter(t => t.status === HOT_TOPIC_STATUS.DISABLED).length,
      totalMatches: this.stats.totalMatches,
      topMatched: Object.entries(this.stats.matchesByTopic)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => {
          const t = this.getById(id);
          return t ? { id, label: t.label, count, status: t.status } : { id, count };
        }),
      lastScanAt: this.stats.lastScanAt,
    };
  }

  /**
   * 重置统计
   */
  resetStats() {
    this.stats = {
      totalMatches: 0,
      matchesByTopic: {},
      lastScanAt: null,
    };
    this._saveStats();
  }
}
