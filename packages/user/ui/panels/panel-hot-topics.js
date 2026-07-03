/**
 * panel-hot-topics.js — 热点规则管理面板
 *
 * 管理时效性热点规则（带 TTL，到期自动失效）。
 * 永久性话题规则由 dashboard-topics.js mixin 管理。
 *
 * 功能：
 *   1. 列表展示（按状态分组：生效中 / 已过期 / 已禁用）
 *   2. 每条规则显示：名称、关键词、触发模式、范围、TTL、到期时间、命中次数、来源
 *   3. 操作：续期、启用/禁用、删除
 *   4. 手动添加规则表单
 *   5. 扫描统计
 */
import { t, getLang } from '../../../core/i18n.js';
import { TTL_DAYS_OPTIONS, TRIGGER_MODE, HOT_TOPIC_STATUS } from '../../../core/hot-topic-manager.js';
import { RECYCLE_TYPE } from '../../../core/recycle-bin.js';
import { safeHTML, escapeHtml } from '../utils.js';

/** 范围 label 映射（仅包含 scanner 实际扫描的类型） */
const SCOPE_LABELS = {
  comment: '评论', reply: '回复',
};

/** 触发模式 label 映射 */
const TRIGGER_MODE_LABELS = {
  [TRIGGER_MODE.ANY]: () => t('hotTopicTriggerAny'),
  [TRIGGER_MODE.ALL]: () => t('hotTopicTriggerAll'),
  [TRIGGER_MODE.COMBINATION]: () => t('hotTopicTriggerCombination'),
};

/** 状态 label 映射 */
const STATUS_LABELS = {
  [HOT_TOPIC_STATUS.ACTIVE]: () => t('hotTopicStatusActive'),
  [HOT_TOPIC_STATUS.EXPIRED]: () => t('hotTopicStatusExpired'),
  [HOT_TOPIC_STATUS.DISABLED]: () => t('hotTopicStatusDisabled'),
};

/** 分类 label 映射 */
const CATEGORY_LABELS = {
  attack: '攻击/辱骂',
  discrimination: '歧视/偏见',
  politics: '政治/意识形态',
  spoiler: '剧透/泄露',
  fanwar: '饭圈/粉丝',
  gaming: '游戏/竞技',
  spam: '骚扰/刷屏',
  custom: '自定义',
};

/** 分类选项（用于表单） */
const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

/** 格式化时间 */
function formatTime(ts) {
  if (!ts) return '--';
  const curLang = getLang();
  return new Date(ts).toLocaleString(curLang === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/** 计算剩余天数 */
function getRemainingDays(topic) {
  if (topic.status !== HOT_TOPIC_STATUS.ACTIVE || !topic.expiresAt) return null;
  const ms = topic.expiresAt - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/**
 * 渲染热点规则 section HTML
 * @param {object} panel Dashboard 实例
 * @returns {string} HTML
 */
export function renderHotTopics(panel) {
  const htm = panel._agentEngine?.getHotTopicManager?.() || panel._scanner?.hotTopicManager;
  const stats = htm ? htm.getStatsReport() : null;

  return `
    <div class="cs-dash-section">
      <div class="cs-dash-section-header">
        <h2 class="cs-dash-section-title">${t('sectionHotTopic')}</h2>
      </div>
      <div class="cs-hint" style="margin-bottom:6px">${t('hotTopicDesc')}</div>

      ${stats ? `
      <div class="cs-dash-block" style="margin-bottom:12px">
        <div class="cs-dash-block-label">${t('hotTopicStatsTitle')}</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:6px">
          <span class="cs-stat-pill">${t('hotTopicStatsActive')}: <strong>${stats.active}</strong></span>
          <span class="cs-stat-pill">${t('hotTopicStatsExpired')}: <strong>${stats.expired}</strong></span>
          <span class="cs-stat-pill">${t('hotTopicStatsTotal')}: <strong>${stats.totalMatches}</strong></span>
        </div>
      </div>
      ` : ''}

      <div class="cs-hot-topic-view-toggle" role="group">
        <button class="cs-btn cs-btn-sm cs-hot-topic-view-btn cs-active" data-view="hot">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/></svg>
          <span>${getLang() === 'zh' ? '热点' : 'Hot'}</span>
        </button>
        <button class="cs-btn cs-btn-sm cs-hot-topic-view-btn" data-view="create">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18"/></svg>
          <span>${getLang() === 'zh' ? '创建' : 'Create'}</span>
        </button>
      </div>

      <div class="cs-hot-topic-search" id="cs-hot-topic-search-wrap" style="display:flex;align-items:center;gap:6px;background:var(--cs-bg-body);border:1px solid var(--cs-border);border-radius:var(--cs-radius);padding:4px 8px;margin-bottom:12px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--cs-text-secondary)"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="text" id="cs-hot-topic-search" placeholder="${getLang() === 'zh' ? '模糊搜索热点名称/关键词…' : 'Search hot topics...'}" style="border:none;background:transparent;outline:none;font-size:12px;color:var(--cs-text);flex:1;min-width:0">
      </div>

      <div id="cs-hot-topic-list" data-view="grid"></div>
      <div id="cs-hot-topic-form" style="display:none"></div>
    </div>`;
}

/**
 * 渲染热点规则列表
 * @param {object} panel Dashboard 实例
 */
export function renderHotTopicList(panel, opts = {}) {
  const { query = '', viewMode = 'grid' } = opts;
  const container = document.getElementById('cs-hot-topic-list');
  if (!container) return;
  container.dataset.view = viewMode;

  const htm = panel._agentEngine?.getHotTopicManager?.() || panel._scanner?.hotTopicManager;
  if (!htm) {
    container.innerHTML = safeHTML(`<div class="cs-hint">${t('hotTopicEmpty')}</div>`);
    return;
  }

  const grouped = htm.getAll();
  const q = query.trim().toLowerCase();
  const filterFn = (topic) => {
    if (!q) return true;
    if ((topic.label || '').toLowerCase().includes(q)) return true;
    if ((topic.keywords || []).some(k => (k || '').toLowerCase().includes(q))) return true;
    if ((topic.category || '').toLowerCase().includes(q)) return true;
    if (topic.combinationRule) {
      if ((topic.combinationRule.all || []).some(k => (k || '').toLowerCase().includes(q))) return true;
      if ((topic.combinationRule.any || []).some(k => (k || '').toLowerCase().includes(q))) return true;
    }
    return false;
  };

  const active = grouped.active.filter(filterFn).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const expired = grouped.expired.filter(filterFn).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const disabled = grouped.disabled.filter(filterFn).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (active.length === 0 && expired.length === 0 && disabled.length === 0) {
    container.innerHTML = safeHTML(`
      <div class="cs-empty-state">
        <div class="cs-empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px;opacity:.4"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/></svg>
        </div>
        <div class="cs-empty-state-text">${q ? (getLang() === 'zh' ? '没有匹配的热点规则' : 'No matching hot topics') : t('hotTopicEmpty')}</div>
        <div class="cs-hint" style="margin-top:4px">${q ? '' : t('hotTopicEmptyHint')}</div>
      </div>
    `);
    return;
  }

  const gridClass = viewMode === 'grid' ? 'cs-hot-topic-grid' : '';
  let html = '';

  if (active.length > 0) {
    html += '<div class="cs-hot-topic-group">';
    html += `<div class="cs-hot-topic-group-title">${t('hotTopicStatusActive')} (${active.length})</div>`;
    html += `<div class="cs-hot-topic-cards-wrap ${gridClass}">`;
    html += active.map(topic => renderTopicCard(topic)).join('');
    html += '</div></div>';
  }

  if (disabled.length > 0) {
    html += '<div class="cs-hot-topic-group">';
    html += `<div class="cs-hot-topic-group-title">${t('hotTopicStatusDisabled')} (${disabled.length})</div>`;
    html += '<div class="cs-hot-topic-cards-wrap">';
    html += disabled.map(topic => renderTopicCard(topic)).join('');
    html += '</div></div>';
  }

  if (expired.length > 0) {
    html += '<div class="cs-hot-topic-group">';
    html += `<div class="cs-hot-topic-group-title">${t('hotTopicStatusExpired')} (${expired.length})</div>`;
    html += '<div class="cs-hot-topic-cards-wrap">';
    html += expired.map(topic => renderTopicCard(topic)).join('');
    html += '</div></div>';
  }

  container.innerHTML = safeHTML(html);
}

/**
 * 渲染单条热点规则卡片
 */
function renderTopicCard(topic) {
  const statusLabel = STATUS_LABELS[topic.status]?.() || topic.status;
  const triggerLabel = TRIGGER_MODE_LABELS[topic.triggerMode]?.() || topic.triggerMode;
  const remaining = getRemainingDays(topic);
  const scopeText = (topic.scopes || []).map(s => SCOPE_LABELS[s] || s).join('、');
  const sourceLabel = topic.source === 'manual' ? t('hotTopicSourceManual') : t('hotTopicSourceAi');
  const hits = topic.hits || 0;
  const categoryLabel = CATEGORY_LABELS[topic.category] || topic.category || '';

  // 触发模式详情
  let triggerDetail = '';
  if (topic.triggerMode === TRIGGER_MODE.COMBINATION && topic.combinationRule) {
    const allPart = topic.combinationRule.all?.length ? `all: ${topic.combinationRule.all.join('、')}` : '';
    const anyPart = topic.combinationRule.any?.length ? `any: ${topic.combinationRule.any.join('、')}` : '';
    triggerDetail = [allPart, anyPart].filter(Boolean).join('；');
  } else {
    triggerDetail = (topic.keywords || []).join('、');
  }

  const isActive = topic.status === HOT_TOPIC_STATUS.ACTIVE;
  const isDisabled = topic.status === HOT_TOPIC_STATUS.DISABLED;
  const isExpired = topic.status === HOT_TOPIC_STATUS.EXPIRED;

  return `
    <div class="cs-hot-topic-card cs-hot-topic-${topic.status}" data-topic-id="${escapeHtml(topic.id)}">
      <div class="cs-hot-topic-card-header">
        <span class="cs-hot-topic-label">${escapeHtml(topic.label)}</span>
        <span class="cs-hot-topic-status cs-hot-topic-status-${topic.status}">${statusLabel}</span>
      </div>
      <div class="cs-hot-topic-card-body">
        ${categoryLabel ? `
        <div class="cs-hot-topic-row">
          <span class="cs-hot-topic-row-label">${getLang() === 'zh' ? '分类' : 'Category'}</span>
          <button type="button" class="cs-hot-topic-category-chip" data-category="${escapeHtml(topic.category)}">${escapeHtml(categoryLabel)}</button>
        </div>
        ` : ''}
        <div class="cs-hot-topic-row">
          <span class="cs-hot-topic-row-label">${t('hotTopicTriggerMode')}</span>
          <span class="cs-hot-topic-row-value">${triggerLabel}</span>
        </div>
        <div class="cs-hot-topic-row">
          <span class="cs-hot-topic-row-label">${t('hotTopicKeywords')}</span>
          <span class="cs-hot-topic-row-value">${escapeHtml(triggerDetail)}</span>
        </div>
        <div class="cs-hot-topic-row">
          <span class="cs-hot-topic-row-label">${t('hotTopicScopes')}</span>
          <span class="cs-hot-topic-row-value">${escapeHtml(scopeText)}</span>
        </div>
        <div class="cs-hot-topic-row">
          <span class="cs-hot-topic-row-label">${t('hotTopicTtl')}</span>
          <span class="cs-hot-topic-row-value">${topic.ttlDays} 天${isActive && remaining !== null ? `（${remaining > 0 ? t('hotTopicRemainingDays', { n: remaining }) : t('hotTopicExpired')}）` : ''}</span>
        </div>
        <div class="cs-hot-topic-row">
          <span class="cs-hot-topic-row-label">${t('hotTopicCreatedAt')}</span>
          <span class="cs-hot-topic-row-value">${formatTime(topic.createdAt)}</span>
        </div>
        ${topic.expiresAt ? `
        <div class="cs-hot-topic-row">
          <span class="cs-hot-topic-row-label">${t('hotTopicExpiresAt')}</span>
          <span class="cs-hot-topic-row-value">${formatTime(topic.expiresAt)}</span>
        </div>
        ` : ''}
        <div class="cs-hot-topic-row">
          <span class="cs-hot-topic-row-label">${t('hotTopicHits', { n: hits })}</span>
          <span class="cs-hot-topic-row-value">${topic.lastHitAt ? formatTime(topic.lastHitAt) : t('hotTopicNeverHit')}</span>
        </div>
        <div class="cs-hot-topic-row">
          <span class="cs-hot-topic-row-label">来源</span>
          <span class="cs-hot-topic-row-value">${sourceLabel}</span>
        </div>
      </div>
      <div class="cs-hot-topic-card-actions">
        <button class="cs-btn cs-btn-xs cs-hot-topic-edit" data-topic-id="${escapeHtml(topic.id)}">${t('hotTopicEdit')}</button>
        ${isActive ? `
          <button class="cs-btn cs-btn-xs cs-hot-topic-renew" data-topic-id="${escapeHtml(topic.id)}">${t('hotTopicRenew')}</button>
          <button class="cs-btn cs-btn-xs cs-hot-topic-disable" data-topic-id="${escapeHtml(topic.id)}">${t('hotTopicDisable')}</button>
        ` : ''}
        ${isDisabled ? `
          <button class="cs-btn cs-btn-xs cs-hot-topic-enable" data-topic-id="${escapeHtml(topic.id)}">${t('hotTopicEnable')}</button>
        ` : ''}
        ${isExpired ? `
          <button class="cs-btn cs-btn-xs cs-hot-topic-renew" data-topic-id="${escapeHtml(topic.id)}">${t('hotTopicRenew')}</button>
        ` : ''}
        <button class="cs-btn cs-btn-xs cs-btn-danger cs-hot-topic-delete" data-topic-id="${escapeHtml(topic.id)}" data-topic-name="${escapeHtml(topic.label)}">${t('hotTopicDelete')}</button>
      </div>
    </div>`;
}

/**
 * 渲染添加规则表单
 */
export function renderAddForm(panel) {
  const container = document.getElementById('cs-hot-topic-form');
  if (!container) return;

  const ttlOptions = TTL_DAYS_OPTIONS.map(d =>
    `<option value="${d}">${d} ${getLang() === 'zh' ? '天' : 'days'}</option>`
  ).join('');
  const scopeOptions = Object.entries(SCOPE_LABELS).map(([k, v]) =>
    `<label class="cs-scope-check"><input type="checkbox" class="cs-hot-topic-scope" value="${k}" ${['comment', 'reply'].includes(k) ? 'checked' : ''}> ${v}</label>`
  ).join('');

  container.innerHTML = safeHTML(`
    <div class="cs-dash-block cs-hot-topic-form-inner">
      <div class="cs-dash-block-label">${t('hotTopicAdd')}</div>
      <div class="cs-form-row">
        <label class="cs-form-label">${t('hotTopicLabel')}</label>
        <input type="text" class="cs-input cs-hot-topic-input-label" placeholder="${t('hotTopicLabelPlaceholder')}">
      </div>
      <div class="cs-form-row">
        <label class="cs-form-label">${getLang() === 'zh' ? '分类' : 'Category'}</label>
        <select class="cs-input cs-hot-topic-input-category">
          ${CATEGORY_OPTIONS.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
        </select>
      </div>
      <div class="cs-form-row">
        <label class="cs-form-label">${t('hotTopicTriggerMode')}</label>
        <select class="cs-input cs-hot-topic-input-trigger" id="cs-hot-topic-trigger-select">
          <option value="${TRIGGER_MODE.ANY}">${t('hotTopicTriggerAny')} — ${t('hotTopicTriggerAnyDesc')}</option>
          <option value="${TRIGGER_MODE.ALL}">${t('hotTopicTriggerAll')} — ${t('hotTopicTriggerAllDesc')}</option>
          <option value="${TRIGGER_MODE.COMBINATION}" selected>${t('hotTopicTriggerCombination')} — ${t('hotTopicTriggerCombinationDesc')}</option>
        </select>
      </div>
      <div class="cs-form-row cs-hot-topic-row-keywords" data-mode="${TRIGGER_MODE.ANY}" style="display:none">
        <label class="cs-form-label">${t('hotTopicKeywords')}</label>
        <input type="text" class="cs-input cs-hot-topic-input-keywords" placeholder="${t('hotTopicKeywordsPlaceholder')}">
      </div>
      <div class="cs-form-row cs-hot-topic-row-combination" data-mode="${TRIGGER_MODE.COMBINATION}">
        <label class="cs-form-label">${t('hotTopicCombinationAll')}</label>
        <input type="text" class="cs-input cs-hot-topic-input-all" placeholder="${t('hotTopicCombinationAllPlaceholder')}">
      </div>
      <div class="cs-form-row cs-hot-topic-row-combination" data-mode="${TRIGGER_MODE.COMBINATION}">
        <label class="cs-form-label">${t('hotTopicCombinationAny')}</label>
        <input type="text" class="cs-input cs-hot-topic-input-any" placeholder="${t('hotTopicCombinationAnyPlaceholder')}">
      </div>
      <div class="cs-form-row">
        <label class="cs-form-label">${t('hotTopicScopes')}</label>
        <div class="cs-scope-list">${scopeOptions}</div>
      </div>
      <div class="cs-form-row">
        <label class="cs-form-label">${t('hotTopicTtl')}</label>
        <select class="cs-input cs-hot-topic-input-ttl">${ttlOptions}</select>
      </div>
      <div class="cs-form-row">
        <label class="cs-form-label">敏感度</label>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <select class="cs-select cs-select-sm" id="cs-hot-sensitivity">
            <option value="low">低</option>
            <option value="medium" selected>中</option>
            <option value="high">高</option>
          </select>
          <span class="cs-sensitivity-bar"><span class="cs-sensitivity-fill" id="cs-hot-sensitivity-bar" style="width:50%;background:var(--cs-signal-cyan)"></span></span>
        </div>
      </div>
      <div id="cs-hot-kw-preview" style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px"></div>
      <div class="cs-form-actions">
        <button class="cs-btn cs-btn-sm cs-hot-topic-save">${t('hotTopicSave')}</button>
        <button class="cs-btn cs-btn-sm cs-btn-ghost cs-hot-topic-cancel">${t('hotTopicCancel')}</button>
      </div>
    </div>
  `);
  container.style.display = 'block';
  bindAddFormEvents(panel);
}

/**
 * 渲染编辑规则表单（复用添加表单结构，预填已有数据）
 */
function renderEditForm(panel, topicId) {
  const htm = panel._agentEngine?.getHotTopicManager?.() || panel._scanner?.hotTopicManager;
  if (!htm) return;
  const topic = htm.getById(topicId);
  if (!topic) return;

  const container = document.getElementById('cs-hot-topic-form');
  if (!container) return;

  const ttlOptions = TTL_DAYS_OPTIONS.map(d =>
    `<option value="${d}" ${d === topic.ttlDays ? 'selected' : ''}>${d} ${getLang() === 'zh' ? '天' : 'days'}</option>`
  ).join('');
  const scopeOptions = Object.entries(SCOPE_LABELS).map(([k, v]) =>
    `<label class="cs-scope-check"><input type="checkbox" class="cs-hot-topic-scope" value="${k}" ${(topic.scopes || []).includes(k) ? 'checked' : ''}> ${v}</label>`
  ).join('');

  // 预填关键词
  const isCombination = topic.triggerMode === TRIGGER_MODE.COMBINATION;
  const kwValue = isCombination ? '' : (topic.keywords || []).join('、');
  const allValue = isCombination ? (topic.combinationRule?.all || []).join('、') : '';
  const anyValue = isCombination ? (topic.combinationRule?.any || []).join('、') : '';

  container.innerHTML = safeHTML(`
    <div class="cs-dash-block cs-hot-topic-form-inner">
      <div class="cs-dash-block-label">${t('hotTopicEdit')}</div>
      <div class="cs-form-row">
        <label class="cs-form-label">${t('hotTopicLabel')}</label>
        <input type="text" class="cs-input cs-hot-topic-input-label" value="${escapeHtml(topic.label)}" placeholder="${t('hotTopicLabelPlaceholder')}">
      </div>
      <div class="cs-form-row">
        <label class="cs-form-label">${getLang() === 'zh' ? '分类' : 'Category'}</label>
        <select class="cs-input cs-hot-topic-input-category">
          ${CATEGORY_OPTIONS.map(c => `<option value="${c.value}" ${c.value === (topic.category || 'custom') ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select>
      </div>
      <div class="cs-form-row">
        <label class="cs-form-label">${t('hotTopicTriggerMode')}</label>
        <select class="cs-input cs-hot-topic-input-trigger" id="cs-hot-topic-trigger-select">
          <option value="${TRIGGER_MODE.ANY}" ${topic.triggerMode === TRIGGER_MODE.ANY ? 'selected' : ''}>${t('hotTopicTriggerAny')} — ${t('hotTopicTriggerAnyDesc')}</option>
          <option value="${TRIGGER_MODE.ALL}" ${topic.triggerMode === TRIGGER_MODE.ALL ? 'selected' : ''}>${t('hotTopicTriggerAll')} — ${t('hotTopicTriggerAllDesc')}</option>
          <option value="${TRIGGER_MODE.COMBINATION}" ${isCombination ? 'selected' : ''}>${t('hotTopicTriggerCombination')} — ${t('hotTopicTriggerCombinationDesc')}</option>
        </select>
      </div>
      <div class="cs-form-row cs-hot-topic-row-keywords" data-mode="${TRIGGER_MODE.ANY}" style="display:${isCombination ? 'none' : ''}">
        <label class="cs-form-label">${t('hotTopicKeywords')}</label>
        <input type="text" class="cs-input cs-hot-topic-input-keywords" value="${escapeHtml(kwValue)}" placeholder="${t('hotTopicKeywordsPlaceholder')}">
      </div>
      <div class="cs-form-row cs-hot-topic-row-combination" data-mode="${TRIGGER_MODE.COMBINATION}" style="display:${isCombination ? '' : 'none'}">
        <label class="cs-form-label">${t('hotTopicCombinationAll')}</label>
        <input type="text" class="cs-input cs-hot-topic-input-all" value="${escapeHtml(allValue)}" placeholder="${t('hotTopicCombinationAllPlaceholder')}">
      </div>
      <div class="cs-form-row cs-hot-topic-row-combination" data-mode="${TRIGGER_MODE.COMBINATION}" style="display:${isCombination ? '' : 'none'}">
        <label class="cs-form-label">${t('hotTopicCombinationAny')}</label>
        <input type="text" class="cs-input cs-hot-topic-input-any" value="${escapeHtml(anyValue)}" placeholder="${t('hotTopicCombinationAnyPlaceholder')}">
      </div>
      <div class="cs-form-row">
        <label class="cs-form-label">${t('hotTopicScopes')}</label>
        <div class="cs-scope-list">${scopeOptions}</div>
      </div>
      <div class="cs-form-row">
        <label class="cs-form-label">${t('hotTopicTtl')}</label>
        <select class="cs-input cs-hot-topic-input-ttl">${ttlOptions}</select>
      </div>
      <div class="cs-form-row">
        <label class="cs-form-label">敏感度</label>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <select class="cs-select cs-select-sm" id="cs-hot-sensitivity">
            <option value="low">低</option>
            <option value="medium" selected>中</option>
            <option value="high">高</option>
          </select>
          <span class="cs-sensitivity-bar"><span class="cs-sensitivity-fill" id="cs-hot-sensitivity-bar" style="width:50%;background:var(--cs-signal-cyan)"></span></span>
        </div>
      </div>
      <div id="cs-hot-kw-preview" style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px"></div>
      <div class="cs-form-actions">
        <button class="cs-btn cs-btn-sm cs-hot-topic-update" data-topic-id="${escapeHtml(topic.id)}">${t('hotTopicSave')}</button>
        <button class="cs-btn cs-btn-sm cs-btn-ghost cs-hot-topic-cancel">${t('hotTopicCancel')}</button>
      </div>
    </div>
  `);
  container.style.display = 'block';
  bindEditFormEvents(panel, container, topicId);
}

/**
 * 绑定编辑表单事件
 */
function bindEditFormEvents(panel, container, topicId) {
  // 触发模式切换：显示/隐藏对应的输入框
  const triggerSelect = container.querySelector('.cs-hot-topic-input-trigger');
  triggerSelect?.addEventListener('change', (e) => {
    const mode = e.target.value;
    container.querySelector('.cs-hot-topic-row-keywords').style.display =
      mode === TRIGGER_MODE.COMBINATION ? 'none' : '';
    container.querySelectorAll('.cs-hot-topic-row-combination').forEach(row => {
      row.style.display = mode === TRIGGER_MODE.COMBINATION ? '' : 'none';
    });
  });

  // 取消 → 返回"热点"标签
  container.querySelector('.cs-hot-topic-cancel')?.addEventListener('click', () => {
    container.style.display = 'none';
    container.innerHTML = '';
    const hotBtn = document.querySelector('.cs-hot-topic-view-btn[data-view="hot"]');
    if (hotBtn) hotBtn.click();
  });

  // 保存更新
  container.querySelector('.cs-hot-topic-update')?.addEventListener('click', () => {
    handleUpdate(panel, container, topicId);
  });

  // 敏感度选择器联动
  const sensitivitySelect = container.querySelector('#cs-hot-sensitivity');
  const sensitivityBar = container.querySelector('#cs-hot-sensitivity-bar');
  if (sensitivitySelect && sensitivityBar) {
    sensitivitySelect.addEventListener('change', () => {
      const val = sensitivitySelect.value;
      sensitivityBar.style.width = val === 'high' ? '80%' : val === 'medium' ? '50%' : '25%';
      sensitivityBar.style.background = val === 'high' ? 'var(--cs-signal-amber)' : val === 'medium' ? 'var(--cs-signal-cyan)' : 'var(--cs-signal-green)';
    });
  }

  // 关键词预览
  const kwInputs = container.querySelectorAll('.cs-hot-topic-input-keywords, .cs-hot-topic-input-all, .cs-hot-topic-input-any');
  const kwPreview = container.querySelector('#cs-hot-kw-preview');
  if (kwInputs.length && kwPreview) {
    const updateKwPreview = () => {
      const allKeywords = [];
      kwInputs.forEach(input => {
        const row = input.closest('.cs-form-row');
        if (row && row.style.display !== 'none') {
          const kws = input.value.split(/[\s,，、]+/).filter(Boolean);
          allKeywords.push(...kws);
        }
      });
      kwPreview.innerHTML = [...new Set(allKeywords)].map(k =>
        `<span class="cs-tag">${escapeHtml(k)}</span>`
      ).join('');
    };
    kwInputs.forEach(input => input.addEventListener('input', updateKwPreview));
    // 编辑模式下初始填充
    updateKwPreview();
  }
}

/**
 * 绑定添加表单事件
 */
function bindAddFormEvents(panel) {
  const container = document.getElementById('cs-hot-topic-form');
  if (!container) return;

  // 触发模式切换：显示/隐藏对应的输入框
  const triggerSelect = container.querySelector('.cs-hot-topic-input-trigger');
  triggerSelect?.addEventListener('change', (e) => {
    const mode = e.target.value;
    container.querySelector('.cs-hot-topic-row-keywords').style.display =
      mode === TRIGGER_MODE.COMBINATION ? 'none' : '';
    container.querySelectorAll('.cs-hot-topic-row-combination').forEach(row => {
      row.style.display = mode === TRIGGER_MODE.COMBINATION ? '' : 'none';
    });
  });

  // 取消 → 返回"热点"标签
  container.querySelector('.cs-hot-topic-cancel')?.addEventListener('click', () => {
    container.style.display = 'none';
    container.innerHTML = '';
    const hotBtn = document.querySelector('.cs-hot-topic-view-btn[data-view="hot"]');
    if (hotBtn) hotBtn.click();
  });

  // 保存
  container.querySelector('.cs-hot-topic-save')?.addEventListener('click', () => {
    handleSave(panel, container);
  });

  // 敏感度选择器联动
  const sensitivitySelect = container.querySelector('#cs-hot-sensitivity');
  const sensitivityBar = container.querySelector('#cs-hot-sensitivity-bar');
  if (sensitivitySelect && sensitivityBar) {
    sensitivitySelect.addEventListener('change', () => {
      const val = sensitivitySelect.value;
      sensitivityBar.style.width = val === 'high' ? '80%' : val === 'medium' ? '50%' : '25%';
      sensitivityBar.style.background = val === 'high' ? 'var(--cs-signal-amber)' : val === 'medium' ? 'var(--cs-signal-cyan)' : 'var(--cs-signal-green)';
    });
  }

  // 关键词预览
  const kwInputs = container.querySelectorAll('.cs-hot-topic-input-keywords, .cs-hot-topic-input-all, .cs-hot-topic-input-any');
  const kwPreview = container.querySelector('#cs-hot-kw-preview');
  if (kwInputs.length && kwPreview) {
    const updateKwPreview = () => {
      const allKeywords = [];
      kwInputs.forEach(input => {
        const row = input.closest('.cs-form-row');
        if (row && row.style.display !== 'none') {
          const kws = input.value.split(/[\s,，、]+/).filter(Boolean);
          allKeywords.push(...kws);
        }
      });
      kwPreview.innerHTML = [...new Set(allKeywords)].map(k =>
        `<span class="cs-tag">${escapeHtml(k)}</span>`
      ).join('');
    };
    kwInputs.forEach(input => input.addEventListener('input', updateKwPreview));
    // 编辑模式下初始填充
    updateKwPreview();
  }
}

/**
 * 处理保存
 */
function handleSave(panel, container) {
  const htm = panel._agentEngine?.getHotTopicManager?.() || panel._scanner?.hotTopicManager;
  if (!htm) {
    alert(t('hotTopicCreateFailed', { reason: 'manager unavailable' }));
    return;
  }

  const label = container.querySelector('.cs-hot-topic-input-label')?.value.trim();
  const category = container.querySelector('.cs-hot-topic-input-category')?.value || 'custom';
  const triggerMode = container.querySelector('.cs-hot-topic-input-trigger')?.value;
  const ttlDays = parseInt(container.querySelector('.cs-hot-topic-input-ttl')?.value, 10) || 7;
  const scopes = Array.from(container.querySelectorAll('.cs-hot-topic-scope:checked')).map(cb => cb.value);

  if (!label) {
    alert(t('hotTopicCreateFailed', { reason: 'label required' }));
    return;
  }
  if (scopes.length === 0) {
    alert(t('hotTopicCreateFailed', { reason: 'scope required' }));
    return;
  }

  let keywords = [];
  let combinationRule = null;

  if (triggerMode === TRIGGER_MODE.COMBINATION) {
    const allStr = container.querySelector('.cs-hot-topic-input-all')?.value.trim();
    const anyStr = container.querySelector('.cs-hot-topic-input-any')?.value.trim();
    // 分隔符：空格、英文逗号、中文逗号、中文顿号
    const splitKws = (s) => s ? s.split(/[\s,，、]+/).map(x => x.trim()).filter(Boolean) : [];
    const all = splitKws(allStr);
    const any = splitKws(anyStr);
    if (all.length === 0 && any.length === 0) {
      alert(t('hotTopicCreateFailed', { reason: 'keywords required' }));
      return;
    }
    keywords = [...new Set([...all, ...any])];
    combinationRule = { all, any };
  } else {
    const kwStr = container.querySelector('.cs-hot-topic-input-keywords')?.value.trim();
    // 分隔符：空格、英文逗号、中文逗号、中文顿号
    keywords = kwStr ? kwStr.split(/[\s,，、]+/).map(s => s.trim()).filter(Boolean) : [];
    if (keywords.length === 0) {
      alert(t('hotTopicCreateFailed', { reason: 'keywords required' }));
      return;
    }
  }

  // 执行中动画
  const submitBtn = container.querySelector('.cs-hot-topic-save');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '执行中...';
    submitBtn.style.background = 'var(--cs-signal-cyan)';
    submitBtn.style.position = 'relative';
    submitBtn.style.overflow = 'hidden';
    const progressBar = document.createElement('span');
    progressBar.style.cssText = 'position:absolute;top:0;left:0;height:100%;width:30%;background:rgba(255,255,255,.3);animation:csBtnProgress 1.5s ease-in-out infinite';
    submitBtn.appendChild(progressBar);
  }

  const result = htm.create({
    label, keywords, triggerMode, combinationRule, scopes, ttlDays, source: 'manual', category,
  });

  if (result.success) {
    const newTopicId = result.topicId;
    container.style.display = 'none';
    container.innerHTML = '';
    // 切回"热点"标签，高亮新卡片
    const root = container.closest('.cs-dash-section');
    if (root) {
      const viewBtns = root.querySelectorAll('.cs-hot-topic-view-btn');
      viewBtns.forEach(b => {
        b.classList.toggle('cs-active', b.dataset.view === 'hot');
      });
      const searchWrap = root.querySelector('#cs-hot-topic-search-wrap');
      const listEl = root.querySelector('#cs-hot-topic-list');
      if (searchWrap) searchWrap.style.display = '';
      if (listEl) listEl.style.display = '';
    }
    renderHotTopicList(panel, { viewMode: 'grid' });
    requestAnimationFrame(() => {
      const newEl = document.querySelector(`[data-topic-id="${CSS.escape(newTopicId)}"]`);
      if (!newEl) return;
      newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      newEl.classList.add('cs-hot-topic-flash');
      newEl.setAttribute('aria-live', 'polite');
      setTimeout(() => {
        newEl.classList.remove('cs-hot-topic-flash');
        newEl.removeAttribute('aria-live');
      }, 2200);
    });
  } else {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = t('hotTopicSave');
      submitBtn.style.background = '';
      submitBtn.style.position = '';
      submitBtn.style.overflow = '';
      const pb = submitBtn.querySelector('span');
      if (pb) pb.remove();
    }
    alert(t('hotTopicCreateFailed', { reason: result.reason || 'unknown' }));
  }
}

/**
 * 处理更新（编辑模式）
 */
function handleUpdate(panel, container, topicId) {
  const htm = panel._agentEngine?.getHotTopicManager?.() || panel._scanner?.hotTopicManager;
  if (!htm) return;

  const label = container.querySelector('.cs-hot-topic-input-label')?.value.trim();
  const category = container.querySelector('.cs-hot-topic-input-category')?.value || 'custom';
  const triggerMode = container.querySelector('.cs-hot-topic-input-trigger')?.value;
  const ttlDays = parseInt(container.querySelector('.cs-hot-topic-input-ttl')?.value, 10) || 7;
  const scopes = Array.from(container.querySelectorAll('.cs-hot-topic-scope:checked')).map(cb => cb.value);

  if (!label) {
    alert(t('hotTopicCreateFailed', { reason: 'label required' }));
    return;
  }
  if (scopes.length === 0) {
    alert(t('hotTopicCreateFailed', { reason: 'scope required' }));
    return;
  }

  let keywords = [];
  let combinationRule = null;

  if (triggerMode === TRIGGER_MODE.COMBINATION) {
    const allStr = container.querySelector('.cs-hot-topic-input-all')?.value.trim();
    const anyStr = container.querySelector('.cs-hot-topic-input-any')?.value.trim();
    const splitKws = (s) => s ? s.split(/[\s,，、]+/).map(x => x.trim()).filter(Boolean) : [];
    const all = splitKws(allStr);
    const any = splitKws(anyStr);
    if (all.length === 0 && any.length === 0) {
      alert(t('hotTopicCreateFailed', { reason: 'keywords required' }));
      return;
    }
    keywords = [...new Set([...all, ...any])];
    combinationRule = { all, any };
  } else {
    const kwStr = container.querySelector('.cs-hot-topic-input-keywords')?.value.trim();
    keywords = kwStr ? kwStr.split(/[\s,，、]+/).map(s => s.trim()).filter(Boolean) : [];
    if (keywords.length === 0) {
      alert(t('hotTopicCreateFailed', { reason: 'keywords required' }));
      return;
    }
  }

  // 执行中动画
  const submitBtn = container.querySelector('.cs-hot-topic-update');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '执行中...';
    submitBtn.style.background = 'var(--cs-signal-cyan)';
    submitBtn.style.position = 'relative';
    submitBtn.style.overflow = 'hidden';
    const progressBar = document.createElement('span');
    progressBar.style.cssText = 'position:absolute;top:0;left:0;height:100%;width:30%;background:rgba(255,255,255,.3);animation:csBtnProgress 1.5s ease-in-out infinite';
    submitBtn.appendChild(progressBar);
  }

  const result = htm.update(topicId, {
    label, keywords, triggerMode, combinationRule, scopes, ttlDays, category,
  });

  if (result.success) {
    container.style.display = 'none';
    container.innerHTML = '';
    // 切回"热点"标签，高亮编辑的卡片
    const root = container.closest('.cs-dash-section');
    if (root) {
      const viewBtns = root.querySelectorAll('.cs-hot-topic-view-btn');
      viewBtns.forEach(b => {
        b.classList.toggle('cs-active', b.dataset.view === 'hot');
      });
      const searchWrap = root.querySelector('#cs-hot-topic-search-wrap');
      const listEl = root.querySelector('#cs-hot-topic-list');
      if (searchWrap) searchWrap.style.display = '';
      if (listEl) listEl.style.display = '';
    }
    renderHotTopicList(panel, { viewMode: 'grid' });
    requestAnimationFrame(() => {
      const editEl = document.querySelector(`[data-topic-id="${CSS.escape(topicId)}"]`);
      if (!editEl) return;
      editEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      editEl.classList.add('cs-hot-topic-flash');
      editEl.setAttribute('aria-live', 'polite');
      setTimeout(() => {
        editEl.classList.remove('cs-hot-topic-flash');
        editEl.removeAttribute('aria-live');
      }, 2200);
    });
  } else {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = t('hotTopicSave');
      submitBtn.style.background = '';
      submitBtn.style.position = '';
      submitBtn.style.overflow = '';
      const pb = submitBtn.querySelector('span');
      if (pb) pb.remove();
    }
    alert(t('hotTopicCreateFailed', { reason: result.reason || 'unknown' }));
  }
}

/**
 * 绑定热点规则 section 事件
 * @param {HTMLElement} root Dashboard 根元素
 * @param {object} panel Dashboard 实例
 */
export function bindHotTopicEvents(root, panel) {
  let _viewMode = 'hot';
  let _query = '';

  /** 切换到指定标签页 */
  function switchView(mode) {
    _viewMode = mode;
    root.querySelectorAll('.cs-hot-topic-view-btn').forEach(b => {
      b.classList.toggle('cs-active', b.dataset.view === mode);
    });
    const searchWrap = root.querySelector('#cs-hot-topic-search-wrap');
    const listEl = root.querySelector('#cs-hot-topic-list');
    const formEl = root.querySelector('#cs-hot-topic-form');

    if (mode === 'hot') {
      if (searchWrap) searchWrap.style.display = '';
      if (listEl) listEl.style.display = '';
      if (formEl) { formEl.style.display = 'none'; formEl.innerHTML = ''; }
      renderHotTopicList(panel, { query: _query, viewMode: 'grid' });
    } else {
      if (searchWrap) searchWrap.style.display = 'none';
      if (listEl) listEl.style.display = 'none';
      renderAddForm(panel);
    }
  }

  // 视图切换
  root.querySelectorAll('.cs-hot-topic-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.view || 'hot';
      if (mode === _viewMode) return;
      switchView(mode);
    });
  });

  // 搜索框模糊过滤
  const searchInput = root.querySelector('#cs-hot-topic-search');
  if (searchInput) {
    let _pending = null;
    searchInput.addEventListener('input', () => {
      _query = searchInput.value || '';
      if (_pending) clearTimeout(_pending);
      _pending = setTimeout(() => {
        if (_viewMode === 'hot') {
          renderHotTopicList(panel, { query: _query, viewMode: 'grid' });
        }
      }, 120);
    });
  }

  // 列表事件委托
  const list = root.querySelector('#cs-hot-topic-list');
  if (!list) return;

  const _refresh = () => {
    if (_viewMode === 'hot') {
      renderHotTopicList(panel, { query: _query, viewMode: 'grid' });
    }
  };

  list.addEventListener('click', (e) => {
    // ★ 分类标签点击 → 用该分类 key 作为搜索词过滤
    const catChip = e.target.closest('.cs-hot-topic-category-chip');
    if (catChip) {
      const catKey = catChip.dataset.category || '';
      if (catKey) {
        const searchInput = root.querySelector('#cs-hot-topic-search');
        _query = catKey;
        if (searchInput) searchInput.value = catKey;
        _refresh();
      }
      return;
    }

    const btn = e.target.closest('button[data-topic-id]');
    if (!btn) return;
    const topicId = btn.dataset.topicId;
    const topicName = btn.dataset.topicName;
    const htm = panel._agentEngine?.getHotTopicManager?.() || panel._scanner?.hotTopicManager;
    if (!htm) return;

    if (btn.classList.contains('cs-hot-topic-delete')) {
      if (!confirm(t('hotTopicDeleteConfirm', { name: topicName }))) return;
      const recycleBin = panel._recycleBin || null;
      const r = htm.delete(topicId, recycleBin);
      if (r.success) _refresh();
    } else if (btn.classList.contains('cs-hot-topic-edit')) {
      switchView('create');
      renderEditForm(panel, topicId);
    } else if (btn.classList.contains('cs-hot-topic-renew')) {
      const topic = htm.getById(topicId);
      if (!topic) return;
      if (!confirm(t('hotTopicRenewConfirm', { name: topic.label, days: topic.ttlDays }))) return;
      const r = htm.renew(topicId, topic.ttlDays);
      if (r.success) _refresh();
    } else if (btn.classList.contains('cs-hot-topic-disable')) {
      htm.update(topicId, { status: HOT_TOPIC_STATUS.DISABLED });
      _refresh();
    } else if (btn.classList.contains('cs-hot-topic-enable')) {
      htm.update(topicId, { status: HOT_TOPIC_STATUS.ACTIVE });
      _refresh();
    }
  });
}
