/**
 * quota-manager.js — 独立限额管理器
 *
 * 核心职责：
 *   1. 为不同 AI 功能提供独立的每日限额控制
 *   2. 追踪各功能的使用量
 *   3. 支持动态调整限额
 *   4. 持久化存储（GM_setValue/GM_getValue）
 *
 * 设计原则：
 *   - 各功能限额独立，互不影响
 *   - 每日自动重置（基于日期变化）
 *   - 提供清晰的 API 供各模块调用
 *   - 支持前端实时查询使用量
 */

// ── 功能标识常量 ──
export const QUOTA_FEATURE = {
  SEMANTIC_ANALYSIS: 'semanticAnalysis',
  AGENT_CHAT: 'agentChat',
  GUARD_ENGINE: 'guardEngine',  // 警卫引擎（AI 分析骚扰者）
};

// ── 默认限额配置 ──
const DEFAULT_QUOTAS = {
  [QUOTA_FEATURE.SEMANTIC_ANALYSIS]: {
    daily: 100,
    used: 0,
    lastReset: null,
    description: '语义分析（AI 检测有害内容）',
  },
  [QUOTA_FEATURE.AGENT_CHAT]: {
    daily: 50,
    used: 0,
    lastReset: null,
    description: 'Agent 聊天（AI 对话交互）',
  },
  [QUOTA_FEATURE.GUARD_ENGINE]: {
    daily: 20,
    used: 0,
    lastReset: null,
    description: '警卫引擎（AI 分析骚扰者）',
  },
};

// ── 存储键名 ──
const STORAGE_KEY = 'cs_quota_config_v2';

export class QuotaManager {
  constructor() {
    this.quotas = this._load();
  }

  /**
   * 检查某功能是否可用
   * @param {string} feature - 功能标识（QUOTA_FEATURE.*）
   * @returns {boolean}
   */
  canUse(feature) {
    if (!this.quotas[feature]) {
      console.warn(`[QuotaManager] 未知功能：${feature}`);
      return false;
    }
    this._checkReset(feature);
    return this.quotas[feature].used < this.quotas[feature].daily;
  }

  /**
   * 使用一次某功能
   * @param {string} feature - 功能标识
   * @param {number} [count=1] - 使用次数（支持批量扣减）
   * @returns {boolean} 是否成功扣减
   */
  use(feature, count = 1) {
    if (!this.quotas[feature]) {
      console.warn(`[QuotaManager] 未知功能：${feature}`);
      return false;
    }
    this._checkReset(feature);
    if (this.quotas[feature].used + count > this.quotas[feature].daily) {
      return false; // 超额，拒绝扣减
    }
    this.quotas[feature].used += count;
    this._save();
    return true;
  }

  /**
   * 获取某功能的使用情况
   * @param {string} feature - 功能标识
   * @returns {object} { used, daily, remaining, description }
   */
  getUsage(feature) {
    if (!this.quotas[feature]) {
      console.warn(`[QuotaManager] 未知功能：${feature}`);
      return { used: 0, daily: 0, remaining: 0, description: '未知功能' };
    }
    this._checkReset(feature);
    return {
      used: this.quotas[feature].used,
      daily: this.quotas[feature].daily,
      remaining: this.quotas[feature].daily - this.quotas[feature].used,
      description: this.quotas[feature].description || feature,
    };
  }

  /**
   * 获取所有功能的使用情况
   * @returns {object} { [feature]: { used, daily, remaining, description } }
   */
  getAllUsage() {
    const result = {};
    for (const feature of Object.keys(this.quotas)) {
      result[feature] = this.getUsage(feature);
    }
    return result;
  }

  /**
   * 设置某功能的每日限额
   * @param {string} feature - 功能标识
   * @param {number} daily - 每日限额
   */
  setLimit(feature, daily) {
    if (!this.quotas[feature]) {
      console.warn(`[QuotaManager] 未知功能：${feature}`);
      return;
    }
    if (typeof daily !== 'number' || daily < 0) {
      console.warn(`[QuotaManager] 无效的限额值：${daily}`);
      return;
    }
    this.quotas[feature].daily = Math.floor(daily);
    // 如果当前使用量超过新限额，截断到新限额
    if (this.quotas[feature].used > this.quotas[feature].daily) {
      this.quotas[feature].used = this.quotas[feature].daily;
    }
    this._save();
  }

  /**
   * 重置某功能的使用量（手动触发）
   * @param {string} feature - 功能标识
   */
  resetUsage(feature) {
    if (!this.quotas[feature]) {
      console.warn(`[QuotaManager] 未知功能：${feature}`);
      return;
    }
    this.quotas[feature].used = 0;
    this.quotas[feature].lastReset = new Date().toDateString();
    this._save();
  }

  /**
   * 重置所有功能的使用量
   */
  resetAllUsage() {
    for (const feature of Object.keys(this.quotas)) {
      this.quotas[feature].used = 0;
      this.quotas[feature].lastReset = new Date().toDateString();
    }
    this._save();
  }

  /**
   * 检查并执行每日重置
   * @param {string} feature - 功能标识
   * @private
   */
  _checkReset(feature) {
    const today = new Date().toDateString();
    if (this.quotas[feature].lastReset !== today) {
      this.quotas[feature].used = 0;
      this.quotas[feature].lastReset = today;
      this._save();
    }
  }

  /**
   * 从持久化存储加载配置
   * @private
   * @returns {object} 限额配置
   */
  _load() {
    try {
      const saved = GM_getValue(STORAGE_KEY, null);
      if (saved) {
        const data = JSON.parse(saved);
        // 合并默认配置（防止新增功能时丢失默认值）
        const merged = {};
        for (const feature of Object.keys(DEFAULT_QUOTAS)) {
          merged[feature] = {
            ...DEFAULT_QUOTAS[feature],
            ...(data[feature] || {}),
          };
        }
        return merged;
      }
    } catch (e) {
      console.warn('[QuotaManager] 加载配置失败，使用默认值', e);
    }
    // 返回默认配置的深拷贝
    return JSON.parse(JSON.stringify(DEFAULT_QUOTAS));
  }

  /**
   * 保存配置到持久化存储
   * @private
   */
  _save() {
    try {
      GM_setValue(STORAGE_KEY, JSON.stringify(this.quotas));
    } catch (e) {
      console.error('[QuotaManager] 保存配置失败', e);
    }
  }
}

// ── 单例模式（可选） ──
let _instance = null;

/**
 * 获取 QuotaManager 单例
 * @returns {QuotaManager}
 */
export function getQuotaManager() {
  if (!_instance) {
    _instance = new QuotaManager();
  }
  return _instance;
}

/**
 * 创建新的 QuotaManager 实例（测试用）
 * @returns {QuotaManager}
 */
export function createQuotaManager() {
  return new QuotaManager();
}
