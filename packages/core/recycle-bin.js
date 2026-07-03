/**
 * recycle-bin.js — 回收站模块
 *
 * 统一管理所有被删除的内容（话题、热点规则、AI学习规则、自定义关键词等）。
 * 核心特性：
 *   1. 时间限制：用户可选择保留时长（1天/3天/7天/30天），超期自动永久删除
 *   2. 恢复功能：在保留期内可随时恢复
 *   3. 分类管理：按类型分类存储（topic/hot_topic/ai_rule/custom_keyword/custom_regex）
 *   4. 来源标记：记录删除来源和原始数据，恢复时完整还原
 *   5. 批量操作：支持批量恢复、批量永久删除
 */

const RECYCLE_BIN_KEY = 'cs_recycle_bin';
const RECYCLE_BIN_SETTINGS_KEY = 'cs_recycle_bin_settings';

/** 回收站条目类型 */
export const RECYCLE_TYPE = {
  TOPIC: 'topic',               // 话题偏好
  HOT_TOPIC: 'hot_topic',       // 热点规则
  AI_RULE: 'ai_rule',           // AI学习规则
  CUSTOM_KEYWORD: 'custom_keyword', // 自定义关键词
  CUSTOM_REGEX: 'custom_regex',     // 自定义正则
  TOPIC_KEYWORD: 'topic_keyword',   // 话题中的单个关键词
};

/** 保留时长选项（毫秒） */
export const RETENTION_OPTIONS = [
  { label: '1天', labelEn: '1 day', value: 1 * 24 * 60 * 60 * 1000 },
  { label: '3天', labelEn: '3 days', value: 3 * 24 * 60 * 60 * 1000 },
  { label: '7天', labelEn: '7 days', value: 7 * 24 * 60 * 60 * 1000 },
  { label: '30天', labelEn: '30 days', value: 30 * 24 * 60 * 60 * 1000 },
];

/** 默认保留时长：7天 */
const DEFAULT_RETENTION = 7 * 24 * 60 * 60 * 1000;

export class RecycleBin {
  constructor() {
    this.items = [];
    this.settings = {
      retentionMs: DEFAULT_RETENTION,  // 默认保留时长
    };
    this._load();
    this._purgeExpired();
  }

  // ── 持久化 ────────────────────────────────────────────────────────────

  _load() {
    try {
      const saved = JSON.parse(GM_getValue(RECYCLE_BIN_KEY, '[]'));
      this.items = Array.isArray(saved) ? saved : [];
    } catch {
      this.items = [];
    }
    try {
      const settings = JSON.parse(GM_getValue(RECYCLE_BIN_SETTINGS_KEY, '{}'));
      this.settings = { ...this.settings, ...settings };
    } catch {
      // 使用默认设置
    }
  }

  _save() {
    try {
      GM_setValue(RECYCLE_BIN_KEY, JSON.stringify(this.items));
    } catch { /* silent */ }
  }

  _saveSettings() {
    try {
      GM_setValue(RECYCLE_BIN_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch { /* silent */ }
  }

  // ── 核心操作 ──────────────────────────────────────────────────────────

  /**
   * 将删除项放入回收站
   * @param {string} type - RECYCLE_TYPE 中的类型
   * @param {object} data - 被删除的原始数据（完整快照）
   * @param {string} [label] - 可读名称
   * @param {string} [category] - 分类标签（如"人身攻击"、"游戏"等）
   * @returns {{ success: boolean, itemId?: string }}
   */
  put(type, data, label = '', category = '') {
    if (!type || !data) return { success: false };

    const now = Date.now();
    const itemId = `rb_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const item = {
      id: itemId,
      type,
      label: label || data.label || data.keyword || data.pattern || data.id || '--',
      category: category || data.category || '',
      data: JSON.parse(JSON.stringify(data)), // 深拷贝，确保独立快照
      deletedAt: now,
      expiresAt: now + this.settings.retentionMs,
      restored: false,
    };

    this.items.push(item);
    this._save();
    return { success: true, itemId };
  }

  /**
   * 从回收站恢复
   * @param {string} itemId
   * @returns {{ success: boolean, data?: object, type?: string }}
   */
  restore(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return { success: false, reason: '条目不存在' };
    if (item.restored) return { success: false, reason: '已恢复过' };
    if (item.expiresAt < Date.now()) return { success: false, reason: '已过期，无法恢复' };

    item.restored = true;
    item.restoredAt = Date.now();
    this._save();

    return { success: true, data: item.data, type: item.type };
  }

  /**
   * 永久删除（不可恢复）
   * @param {string} itemId
   * @returns {{ success: boolean }}
   */
  permanentDelete(itemId) {
    const idx = this.items.findIndex(i => i.id === itemId);
    if (idx === -1) return { success: false };
    this.items.splice(idx, 1);
    this._save();
    return { success: true };
  }

  /**
   * 批量永久删除
   * @param {string[]} itemIds
   * @returns {{ success: boolean, deletedCount: number }}
   */
  permanentDeleteBatch(itemIds) {
    const idSet = new Set(itemIds);
    const before = this.items.length;
    this.items = this.items.filter(i => !idSet.has(i.id));
    const deletedCount = before - this.items.length;
    if (deletedCount > 0) this._save();
    return { success: true, deletedCount };
  }

  /**
   * 批量恢复
   * @param {string[]} itemIds
   * @returns {{ success: boolean, restored: Array<{type: string, data: object}> }}
   */
  restoreBatch(itemIds) {
    const idSet = new Set(itemIds);
    const restored = [];
    for (const item of this.items) {
      if (idSet.has(item.id) && !item.restored && item.expiresAt >= Date.now()) {
        item.restored = true;
        item.restoredAt = Date.now();
        restored.push({ type: item.type, data: item.data });
      }
    }
    if (restored.length > 0) this._save();
    return { success: true, restored };
  }

  // ── 查询 ──────────────────────────────────────────────────────────────

  /**
   * 获取回收站中可恢复的条目
   * @param {string} [type] - 按类型筛选
   * @returns {object[]}
   */
  getAvailable(type = null) {
    this._purgeExpired();
    return this.items.filter(i => {
      if (i.restored) return false;
      if (type && i.type !== type) return false;
      return true;
    });
  }

  /**
   * 获取所有条目（含已恢复和已过期的，供统计用）
   */
  getAll() {
    return [...this.items];
  }

  /**
   * 按类型分组统计
   */
  getStats() {
    this._purgeExpired();
    const stats = {};
    for (const type of Object.values(RECYCLE_TYPE)) {
      stats[type] = this.items.filter(i => i.type === type && !i.restored).length;
    }
    stats.total = this.items.filter(i => !i.restored).length;
    return stats;
  }

  /**
   * 获取保留时长设置
   */
  getRetentionMs() {
    return this.settings.retentionMs;
  }

  /**
   * 设置保留时长
   * @param {number} ms
   */
  setRetentionMs(ms) {
    this.settings.retentionMs = ms;
    this._saveSettings();
  }

  /**
   * 清空回收站（永久删除所有条目）
   */
  clearAll() {
    this.items = [];
    this._save();
  }

  // ── 过期清理 ──────────────────────────────────────────────────────────

  /**
   * 清理过期条目（惰性执行，每次查询前调用）
   */
  _purgeExpired() {
    const now = Date.now();
    const before = this.items.length;
    this.items = this.items.filter(i => {
      // 已恢复的保留7天后清理（用于撤销记录）
      if (i.restored) {
        return !i.restoredAt || (now - i.restoredAt < 7 * 24 * 60 * 60 * 1000);
      }
      // 未恢复的按过期时间清理
      return i.expiresAt >= now;
    });
    if (this.items.length < before) this._save();
  }

  /**
   * 获取条目的剩余时间（毫秒）
   */
  getRemainingTime(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (!item || item.restored) return 0;
    return Math.max(0, item.expiresAt - Date.now());
  }

  /**
   * 获取条目的剩余时间描述
   */
  getRemainingTimeLabel(itemId) {
    const ms = this.getRemainingTime(itemId);
    if (ms <= 0) return '已过期';
    const hours = Math.floor(ms / (60 * 60 * 1000));
    if (hours < 24) return `${hours}小时后过期`;
    const days = Math.floor(hours / 24);
    return `${days}天后过期`;
  }
}
