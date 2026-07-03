/**
 * dashboard-system.js — 系统/日志/回收站/屏蔽/关于面板（Dashboard mixin）
 * 从 panel-dashboard.js 提取，负责回收站 / 日志 / 用户屏蔽 / 系统诊断 / 关于页 / 撤销栈
 */
import { t, getLang } from '../../../core/i18n.js';
import { emit, Events } from '../../../core/events.js';
import { RETENTION_OPTIONS } from '../../../core/recycle-bin.js';
import { safeHTML, escapeHtml, $el, getProviderLabel, showModal } from '../utils.js';
import { getQuotaManager, QUOTA_FEATURE } from '../../ai/ai-agent-engine/src-new/core/quota-manager.js';

const VERSION = '0.8.0';

// Droplet 水滴 SVG
const DROP_SVG = '<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="dr-drop-sys" x1="14" y1="2" x2="14" y2="26" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="var(--cs-accent-hover,#7dd3fc)"/><stop offset="50%" stop-color="var(--cs-accent,#38bdf8)"/><stop offset="100%" stop-color="var(--cs-accent,#0284c7)"/></linearGradient></defs><path d="M14 2C14 2 4 11 4 17C4 22.5 8.5 26 14 26C19.5 26 24 22.5 24 17C24 11 14 2 14 2Z" fill="url(#dr-drop-sys)"/><ellipse cx="10" cy="13" rx="3" ry="4.5" fill="white" fill-opacity="0.25" transform="rotate(-20 10 13)"/></svg>';

export const SystemMixin = {

  // ─── 撤销栈 ──────────────────────────────────────────────

  _pushUndo(action) {
    this._undoStack.push({
      ...action,
      timestamp: Date.now(),
    });
    // 最多保留20条
    if (this._undoStack.length > 20) this._undoStack.shift();
  },

  _performUndo() {
    if (this._undoStack.length === 0) {
      this.showToast('没有可撤销的操作', 'info');
      return;
    }

    const action = this._undoStack.pop();
    const getTF = () => this._scanner?.topicFilter || this._agentEngine?.getTopicFilter?.();
    const tf = getTF();
    const curLang = getLang();

    switch (action.type) {
      case 'delete_topic':
        // 从回收站恢复话题
        if (tf && action.data) {
          tf.restoreTopic(action.data);
          this.showToast(curLang === 'zh' ? '话题已恢复' : 'Topic restored', 'success');
        }
        break;
      case 'delete_keyword':
        // 恢复关键词
        if (tf && action.topicId && action.keyword && action.lang) {
          tf.restoreKeywordToTopic(action.topicId, action.keyword, action.lang);
          this.showToast(curLang === 'zh' ? `关键词"${action.keyword}"已恢复` : `Keyword "${action.keyword}" restored`, 'success');
        }
        break;
      case 'delete_ai_rule':
        // 从回收站恢复AI规则
        if (tf && action.topicId && action.trigger) {
          // 尝试从回收站找到对应条目
          const recycleItems = this._recycleBin.getAvailable('ai_rule');
          const recycleItem = recycleItems.find(i => i.data?.topicId === action.topicId && i.data?.trigger === action.trigger);
          if (recycleItem) {
            const result = this._recycleBin.restore(recycleItem.id);
            if (result.success) {
              tf.restoreAIRule(result.data);
              this.showToast(curLang === 'zh' ? `AI规则"${action.trigger}"已恢复` : `AI rule "${action.trigger}" restored`, 'success');
            }
          } else {
            // 回收站中没找到，直接重新添加
            tf.addAIRule(action.topicId, action.trigger);
            this.showToast(curLang === 'zh' ? `AI规则"${action.trigger}"已恢复` : `AI rule "${action.trigger}" restored`, 'success');
          }
        }
        break;
      case 'add_topic':
        // 撤销添加 = 删除刚添加的话题
        if (tf && action.topicId) {
          tf.removeTopic(action.topicId, this._recycleBin);
          this.showToast(curLang === 'zh' ? '已撤销添加话题' : 'Topic addition undone', 'success');
        }
        break;
      case 'add_ai_rule':
        // 撤销添加AI规则 = 删除刚添加的规则
        if (tf && action.topicId && action.trigger) {
          tf.removeAIRule(action.topicId, action.trigger, this._recycleBin);
          this.showToast(curLang === 'zh' ? '已撤销添加AI规则' : 'AI rule addition undone', 'success');
        }
        break;
    }

    this._renderTopicList();
  },

  // ─── 回收站面板 ──────────────────────────────────────────

  _renderRecycleBin() {
    if (!this._recycleBin) return '<div class="cs-dash-section"><div class="cs-dash-section-header"><h2 class="cs-dash-section-title">回收站</h2></div><div class="cs-hint">回收站未初始化</div></div>';

    const stats = this._recycleBin.getStats();
    const items = this._recycleBin.getAvailable();
    const curLang = getLang();
    const retention = this._recycleBin.getRetentionMs();
    const retentionLabel = RETENTION_OPTIONS.find(o => o.value === retention)?.[curLang === 'zh' ? 'label' : 'labelEn'] || `${Math.round(retention / (24 * 60 * 60 * 1000))}天`;

    const typeLabels = {
      topic: curLang === 'zh' ? '话题' : 'Topic',
      hot_topic: curLang === 'zh' ? '热点规则' : 'Hot Topic',
      ai_rule: curLang === 'zh' ? 'AI规则' : 'AI Rule',
      custom_keyword: curLang === 'zh' ? '自定义关键词' : 'Custom Keyword',
      custom_regex: curLang === 'zh' ? '自定义正则' : 'Custom Regex',
      topic_keyword: curLang === 'zh' ? '话题关键词' : 'Topic Keyword',
    };

    const html = `
      <div class="cs-dash-section">
        <div class="cs-dash-section-header">
          <h2 class="cs-dash-section-title">${curLang === 'zh' ? '回收站' : 'Recycle Bin'}</h2>
        </div>
        <div class="cs-hint" style="margin-bottom:6px">${curLang === 'zh' ? '删除的内容将在此保留，超期后永久删除。' : 'Deleted items are kept here until they expire.'}</div>

        <div class="cs-dash-block" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
            <div class="cs-dash-block-label" style="margin:0">${curLang === 'zh' ? '保留时长' : 'Retention Period'}: ${retentionLabel}</div>
            <div class="cs-hot-topic-search" style="display:flex;align-items:center;gap:6px;background:var(--cs-bg-body);border:1px solid var(--cs-border);border-radius:var(--cs-radius);padding:4px 8px;flex:0 0 auto;min-width:220px">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--cs-text-secondary)"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input type="text" id="cs-recycle-search" placeholder="${curLang === 'zh' ? '搜索回收站内容…' : 'Search recycle bin...'}" style="border:none;background:transparent;outline:none;font-size:12px;color:var(--cs-text);flex:1;min-width:0">
            </div>
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:6px">
            ${Object.entries(stats).filter(([k]) => k !== 'total').map(([type, count]) =>
    `<span class="cs-stat-pill">${typeLabels[type] || type}: <strong>${count}</strong></span>`
  ).join('')}
            <span class="cs-stat-pill">${curLang === 'zh' ? '总计' : 'Total'}: <strong>${stats.total}</strong></span>
          </div>
        </div>

        <div style="display:flex;gap:6px;margin-bottom:12px">
          <button class="cs-btn cs-btn-sm" id="cs-recycle-restore-all">${curLang === 'zh' ? '全部恢复' : 'Restore All'}</button>
          <button class="cs-btn cs-btn-sm cs-btn-danger" id="cs-recycle-clear-all">${curLang === 'zh' ? '清空回收站' : 'Empty Bin'}</button>
        </div>

        <div id="cs-recycle-list">${this._renderRecycleGroups(items, typeLabels, curLang)}</div>
      </div>`;
    return html;
  },

  _renderRecycleGroups(items, typeLabels, curLang, query = '') {
    const q = query.trim().toLowerCase();
    const grouped = {};
    for (const item of items) {
      const type = item.type || 'unknown';
      if (!grouped[type]) grouped[type] = [];
      if (!q) { grouped[type].push(item); continue; }
      const label = (item.label || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();
      const dt = item.data ? JSON.stringify(item.data).toLowerCase() : '';
      if (label.includes(q) || cat.includes(q) || dt.includes(q)) grouped[type].push(item);
    }

    const total = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);
    if (total === 0) {
      return `<div class="cs-empty-state"><div class="cs-empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="width:40px;height:40px;opacity:.4"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></div><div class="cs-empty-state-text">${q ? (curLang === 'zh' ? '没有匹配的回收站内容' : 'No matching items') : (curLang === 'zh' ? '回收站为空' : 'Recycle bin is empty')}</div></div>`;
    }

    let html = '';
    for (const [type, typeItems] of Object.entries(grouped)) {
      if (typeItems.length === 0) continue;
      html += '<div class="cs-hot-topic-group">';
      html += `<div class="cs-hot-topic-group-title">${typeLabels[type] || type} (${typeItems.length})</div>`;
      for (const item of typeItems) {
        const remaining = this._recycleBin.getRemainingTimeLabel(item.id);
        const deletedAt = new Date(item.deletedAt).toLocaleString(curLang === 'zh' ? 'zh-CN' : 'en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        html += `
          <div class="cs-hot-topic-card" data-recycle-id="${item.id}">
            <div class="cs-hot-topic-card-header">
              <span class="cs-hot-topic-label">${escapeHtml(item.label)}</span>
              <span class="cs-hot-topic-status cs-hot-topic-status-expired">${remaining}</span>
            </div>
            <div class="cs-hot-topic-card-body">
              <div class="cs-hot-topic-row">
                <span class="cs-hot-topic-row-label">${curLang === 'zh' ? '类型' : 'Type'}</span>
                <span class="cs-hot-topic-row-value">${typeLabels[type] || type}</span>
              </div>
              <div class="cs-hot-topic-row">
                <span class="cs-hot-topic-row-label">${curLang === 'zh' ? '删除时间' : 'Deleted'}</span>
                <span class="cs-hot-topic-row-value">${deletedAt}</span>
              </div>
              ${item.category ? `<div class="cs-hot-topic-row"><span class="cs-hot-topic-row-label">${curLang === 'zh' ? '分类' : 'Category'}</span><span class="cs-hot-topic-row-value">${escapeHtml(item.category)}</span></div>` : ''}
            </div>
            <div class="cs-hot-topic-card-actions">
              <button class="cs-btn cs-btn-xs cs-btn-accent cs-recycle-restore-btn" data-recycle-id="${item.id}">${curLang === 'zh' ? '恢复' : 'Restore'}</button>
              <button class="cs-btn cs-btn-xs cs-btn-danger cs-recycle-delete-btn" data-recycle-id="${item.id}">${curLang === 'zh' ? '永久删除' : 'Delete Forever'}</button>
            </div>
          </div>`;
      }
      html += '</div>';
    }
    return html;
  },

  _bindRecycleBin() {
    const el = this._el;
    const curLang = getLang();
    let _query = '';

    // 搜索框模糊过滤
    const searchInput = el.querySelector('#cs-recycle-search');
    if (searchInput) {
      let _pending = null;
      searchInput.addEventListener('input', () => {
        _query = searchInput.value || '';
        if (_pending) clearTimeout(_pending);
        _pending = setTimeout(() => {
          const items = this._recycleBin.getAvailable();
          const typeLabels = {
            topic: curLang === 'zh' ? '话题' : 'Topic',
            hot_topic: curLang === 'zh' ? '热点规则' : 'Hot Topic',
            ai_rule: curLang === 'zh' ? 'AI规则' : 'AI Rule',
            custom_keyword: curLang === 'zh' ? '自定义关键词' : 'Custom Keyword',
            custom_regex: curLang === 'zh' ? '自定义正则' : 'Custom Regex',
            topic_keyword: curLang === 'zh' ? '话题关键词' : 'Topic Keyword',
          };
          const list = el.querySelector('#cs-recycle-list');
          if (list) list.innerHTML = this._renderRecycleGroups(items, typeLabels, curLang, _query);
        }, 120);
      });
    }

    // 全部恢复
    $el('cs-recycle-restore-all', el)?.addEventListener('click', () => {
      const items = this._recycleBin.getAvailable();
      if (items.length === 0) return;
      if (!confirm(curLang === 'zh' ? `确定恢复全部 ${items.length} 条内容？` : `Restore all ${items.length} items?`)) return;

      const result = this._recycleBin.restoreBatch(items.map(i => i.id));
      if (result.success) {
        // 逐条恢复到对应管理器
        const getTF = () => this._scanner?.topicFilter || this._agentEngine?.getTopicFilter?.();
        const tf = getTF();
        const htm = this._agentEngine?.getHotTopicManager?.() || this._scanner?.hotTopicManager;

        for (const { type, data } of result.restored) {
          if (type === 'topic' && tf) tf.restoreTopic(data);
          else if (type === 'hot_topic' && htm) htm.restore(data);
          else if (type === 'ai_rule' && tf) tf.restoreAIRule(data);
          else if (type === 'topic_keyword' && tf) tf.restoreKeywordToTopic(data.topicId, data.keyword, data.lang);
          else if (type === 'custom_keyword') {
            if (!this._config.customKeywords) this._config.customKeywords = [];
            const exists = this._config.customKeywords.some(e => e.keyword?.toLowerCase() === data.keyword?.toLowerCase());
            if (!exists) this._config.customKeywords.push(data);
            try { this._config.save?.(); } catch {}
            try { this._scanner?.detector?.reloadCustomKeywords?.(); } catch {}
          }
          else if (type === 'custom_regex') {
            if (!this._config.customRegex) this._config.customRegex = [];
            const exists = this._config.customRegex.some(e => e.pattern === data.pattern);
            if (!exists) this._config.customRegex.push(data);
            try { this._config.save?.(); } catch {}
            try { this._scanner?.detector?.reloadCustomRegex?.(); } catch {}
          }
        }
        this._renderSection('recycle');
        this.showToast(curLang === 'zh' ? `已恢复 ${result.restored.length} 条内容` : `${result.restored.length} items restored`, 'success');
      }
    });

    // 清空回收站
    $el('cs-recycle-clear-all', el)?.addEventListener('click', () => {
      if (!confirm(curLang === 'zh' ? '确定清空回收站？此操作不可恢复！' : 'Empty recycle bin? This cannot be undone!')) return;
      this._recycleBin.clearAll();
      this._renderSection('recycle');
      this.showToast(curLang === 'zh' ? '回收站已清空' : 'Recycle bin emptied', 'info');
    });

    // 单条恢复/永久删除（事件委托）
    const list = el.querySelector('.cs-dash-section');
    if (!list) return;

    list.addEventListener('click', (e) => {
      const restoreBtn = e.target.closest('.cs-recycle-restore-btn');
      const deleteBtn = e.target.closest('.cs-recycle-delete-btn');
      if (!restoreBtn && !deleteBtn) return;

      const itemId = (restoreBtn || deleteBtn)?.dataset.recycleId;
      if (!itemId) return;

      if (restoreBtn) {
        const result = this._recycleBin.restore(itemId);
        if (result.success) {
          // 恢复到对应管理器
          const getTF = () => this._scanner?.topicFilter || this._agentEngine?.getTopicFilter?.();
          const tf = getTF();
          const htm = this._agentEngine?.getHotTopicManager?.() || this._scanner?.hotTopicManager;

          if (result.type === 'topic' && tf) tf.restoreTopic(result.data);
          else if (result.type === 'hot_topic' && htm) htm.restore(result.data);
          else if (result.type === 'ai_rule' && tf) tf.restoreAIRule(result.data);
          else if (result.type === 'topic_keyword' && tf) tf.restoreKeywordToTopic(result.data.topicId, result.data.keyword, result.data.lang);
          else if (result.type === 'custom_keyword') {
            if (!this._config.customKeywords) this._config.customKeywords = [];
            const exists = this._config.customKeywords.some(e => e.keyword?.toLowerCase() === result.data.keyword?.toLowerCase());
            if (!exists) this._config.customKeywords.push(result.data);
            try { this._config.save?.(); } catch {}
            try { this._scanner?.detector?.reloadCustomKeywords?.(); } catch {}
            this._renderRules?.();
            this._renderCustomList?.();
          }
          else if (result.type === 'custom_regex') {
            if (!this._config.customRegex) this._config.customRegex = [];
            const exists = this._config.customRegex.some(e => e.pattern === result.data.pattern);
            if (!exists) this._config.customRegex.push(result.data);
            try { this._config.save?.(); } catch {}
            try { this._scanner?.detector?.reloadCustomRegex?.(); } catch {}
          }

          this._renderSection('recycle');
          this.showToast(curLang === 'zh' ? '已恢复' : 'Restored', 'success');
        } else {
          this.showToast(result.reason || '恢复失败', 'error');
        }
      }

      if (deleteBtn) {
        if (!confirm(curLang === 'zh' ? '确定永久删除？此操作不可恢复！' : 'Delete permanently? This cannot be undone!')) return;
        this._recycleBin.permanentDelete(itemId);
        this._renderSection('recycle');
        this.showToast(curLang === 'zh' ? '已永久删除' : 'Permanently deleted', 'info');
      }
    });
  },

  // ─── Log · Guardian Command Center ──────────────────────

  _renderLog() {
    const curLang = getLang();
    const isZh = curLang === 'zh';
    const total = this._scanLog.length;
    const misjudged = this._misjudgmentRegistry || {};
    const c = { toxic: 0, suspicious: 0, safe: 0, fp: 0 };
    for (const e of this._scanLog) {
      const isFP = !!(e._fp || misjudged[e._id]);
      if (isFP) { c.fp++; continue; }
      const v = e.verdict || 'safe';
      if (v === 'toxic') c.toxic++;
      else if (v === 'suspicious') c.suspicious++;
      else c.safe++;
    }
    const segs = [
      { key: 'all',        lbl: isZh ? '全部' : 'All',    n: total,          dot: 'var(--cs-text-secondary)' },
      { key: 'toxic',      lbl: isZh ? '拦截' : 'Toxic',  n: c.toxic,        dot: '#ef4444' },
      { key: 'suspicious', lbl: isZh ? '可疑' : 'Warn',   n: c.suspicious,   dot: '#f59e0b' },
      { key: 'safe',       lbl: isZh ? '通过' : 'Safe',   n: c.safe,         dot: '#22c55e' },
      { key: 'misjudged',  lbl: isZh ? '修正' : 'Corrected', n: c.fp,      dot: '#8b5cf6' },
    ];
    return `
      <div class="cs-dash-section">
      <div class="cs-log-guardian">
        <div class="cs-log-status-header">
          <div class="cs-log-scan-dot${total > 0 ? '' : ' cs-scan-idle'}"></div>
          <div class="cs-log-status-text">
            <div class="cs-log-status-title">${isZh ? '智能防护日志' : 'Guardian Log'}</div>
            <div class="cs-log-status-sub">${total > 0 ? (isZh ? '实时扫描守护中' : 'Real-time scanning active') : (isZh ? '等待扫描活动…' : 'Waiting for scan activity…')}</div>
          </div>
          <div class="cs-log-stats">
            <span class="cs-log-stat s-toxic"><span class="n">${c.toxic}</span> ${isZh ? '拦截' : 'Blocked'}</span>
            <span class="cs-log-stat s-suspicious"><span class="n">${c.suspicious}</span> ${isZh ? '可疑' : 'Warn'}</span>
            <span class="cs-log-stat s-safe"><span class="n">${c.safe}</span> ${isZh ? '通过' : 'Safe'}</span>
            ${c.fp ? `<span class="cs-log-stat s-fp"><span class="n">${c.fp}</span> ${isZh ? '修正' : 'Corrected'}</span>` : ''}
          </div>
        </div>
        <div class="cs-log-controls">
          <div class="cs-log-controls-row">
            <div class="cs-log-seg">
              ${segs.map(s => `<button class="cs-log-seg-btn${s.key === 'all' ? ' active' : ''}" data-tab="${s.key}"><span class="seg-dot" style="background:${s.dot}"></span>${s.lbl}<span class="seg-count${s.n > 0 ? ' has-items' : ''}">${s.n}</span></button>`).join('')}
            </div>
          </div>
          <div class="cs-log-controls-row">
            <div class="cs-log-search-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input type="text" class="cs-log-search-input" id="cs-log-search" placeholder="${isZh ? '搜索关键词、用户名…' : 'Search keywords, users…'}">
            </div>
            <div class="cs-log-actions-row">
              <button class="cs-log-act-btn act-scan" id="cs-dash-log-scan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>${isZh ? '扫描' : 'Scan'}</button>
              <button class="cs-log-act-btn" id="cs-dash-log-block"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>${isZh ? '拉黑' : 'Block'}</button>
              <button class="cs-log-act-btn" id="cs-dash-log-unblock">${isZh ? '解除' : 'Unblock'}</button>
              <button class="cs-log-act-btn act-danger" id="cs-dash-log-clear"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
            </div>
          </div>
        </div>
        <div class="cs-log-list" id="cs-dash-log-list">${this._renderLogList(this._scanLog, 'all', '')}</div>
      </div></div>`;
  },

  _renderLogList(log, tab, query) {
    if (!this._logTab) this._logTab = 'all';
    this._logTab = tab;
    if (!this._logQuery) this._logQuery = '';
    this._logQuery = query;

    const misjudged = this._misjudgmentRegistry || {};
    const count = { toxic: 0, suspicious: 0, safe: 0, misjudged: 0 };
    const filtered = [];
    for (const entry of log) {
      const isFP = !!(entry._fp || misjudged[entry._id]);
      const v = isFP ? 'misjudged' : (entry.verdict || 'safe');
      if (v === 'toxic') count.toxic++;
      else if (v === 'suspicious') count.suspicious++;
      else if (v === 'safe') count.safe++;
      else if (v === 'misjudged') count.misjudged++;
      if (tab !== 'all' && v !== tab) continue;
      if (query) {
        const q = query.toLowerCase();
        const hay = `${entry.text || ''} ${entry.username || ''} ${(entry.hitKeywords || []).join(' ')} ${entry.reason || ''} ${entry.aiSummary || ''}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      filtered.push({ ...entry, _isFP: isFP, _v: v });
    }

    requestAnimationFrame(() => {
      const segBtns = document.querySelectorAll('.cs-log-seg-btn');
      segBtns.forEach(btn => {
        const t = btn.dataset.tab;
        btn.classList.toggle('active', t === tab);
        const cntEl = btn.querySelector('.seg-count');
        if (cntEl) {
          const n = t === 'all' ? filtered.length : (count[t] || 0);
          cntEl.textContent = n;
          cntEl.classList.toggle('has-items', n > 0);
        }
      });
    });

    if (filtered.length === 0) {
      const curLang = getLang();
      const isZh = curLang === 'zh';
      const empty = tab === 'all'
        ? (isZh ? '暂无扫描记录，正在为你守护中…' : 'No scan records yet, standing guard…')
        : tab === 'misjudged'
          ? (isZh ? '暂无误判标记' : 'No false positives')
          : (isZh ? '该分类暂无记录' : 'No records here');
      return `<div class="cs-log-empty"><div class="cs-log-empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px;opacity:.4"><path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/></svg></div><div class="cs-log-empty-text">${empty}</div></div>`;
    }

    const curLang = getLang();
    const isZh = curLang === 'zh';
    const layerLbl = { 1: isZh ? '关键词检测' : 'Keyword', 2: isZh ? '行为分析' : 'Behavior', 3: isZh ? 'AI 深度分析' : 'AI Analysis' };
    const verdictLbl = { safe: isZh ? '安全通过' : 'Safe', suspicious: isZh ? '需要关注' : 'Caution', toxic: isZh ? '已拦截' : 'Blocked', misjudged: isZh ? '已修正' : 'Corrected' };
    const riskLbl = { low: 'LOW', medium: 'MEDIUM', high: 'HIGH', critical: 'CRITICAL' };
    // Particle spectrum: cyan(peace) → blue → purple → magenta → red(alert)
    const _spec = [[0,34,211,238],[20,56,189,248],[40,96,165,250],[60,167,139,250],[80,232,121,249],[100,239,68,68]];
    const _edgeClr = (p) => {
      const t = Math.min(Math.max(p, 0), 100);
      for (let i = 0; i < _spec.length - 1; i++) {
        if (t <= _spec[i+1][0]) {
          const r = (t - _spec[i][0]) / (_spec[i+1][0] - _spec[i][0]);
          return `rgb(${Math.round(_spec[i][1]+(_spec[i+1][1]-_spec[i][1])*r)},${Math.round(_spec[i][2]+(_spec[i+1][2]-_spec[i][2])*r)},${Math.round(_spec[i][3]+(_spec[i+1][3]-_spec[i][3])*r)})`;
        }
      }
      return `rgb(${_spec[_spec.length-1].slice(1).join(',')})`;
    };

    return filtered.map((entry, idx) => {
      const v = entry._v;
      const layer = entry.layer || 1;
      const isAI = entry.aiDetected || layer === 3;
      const hitKws = (entry.hitKeywords && entry.hitKeywords.length) ? entry.hitKeywords : [];
      const reason = entry.reason || '';
      const fp = entry._isFP;
      const timeStr = new Date(entry.timestamp).toLocaleTimeString();
      const canCheck = v === 'toxic' || v === 'suspicious';
      const confidence = entry.confidence ? Math.round(entry.confidence * 100) : (v === 'safe' ? 15 : (v === 'suspicious' ? 55 : 82));
      const riskKey = confidence >= 80 ? 'critical' : confidence >= 60 ? 'high' : confidence >= 35 ? 'medium' : 'low';

      const badges = [];
      if (fp) badges.push(`<span class="cs-log-badge b-fp">${isZh ? '误判修正' : 'Corrected'}</span>`);
      else badges.push(`<span class="cs-log-badge b-${v}">${verdictLbl[v]}</span>`);
      if (isAI) badges.push(`<span class="cs-log-badge b-ai">${isZh ? 'AI 分析' : 'AI Analysis'}</span>`);
      badges.push(`<span class="cs-log-badge b-detect">${layerLbl[layer] || ('L' + layer)}</span>`);

      // Detection basis
      const ctxParts = [];
      if (hitKws.length) ctxParts.push(`<span class="cs-log-kws">${hitKws.map(kw => `<b>${escapeHtml(kw)}</b>`).join(', ')}</span>`);
      if (reason && reason !== 'AI analysis') ctxParts.push(`<span class="cs-log-reason">${escapeHtml(reason)}</span>`);
      const ctxLine = ctxParts.join(' <span class="cs-log-sp">·</span> ');

      // Particle spectrum risk bar (all non-FP entries — shows L1/L2/L3 pipeline confidence)
      let riskBar = '';
      if (!fp) {
        const stops = [];
        for (const [pos, r, g, b] of _spec) { if (pos <= confidence) stops.push(`rgb(${r},${g},${b}) ${pos}%`); }
        stops.push(`${_edgeClr(confidence)} ${confidence}%`);
        const grad = `linear-gradient(90deg,${stops.join(',')})`;
        const eClr = _edgeClr(confidence);
        const pN = Math.min(Math.max(3, Math.floor(confidence / 9)), 10);
        const pats = [[-2,-5,8,-14,2.4],[0,6,12,10,3.1],[1,-2,5,-10,2.2],[-3,4,10,13,3.4],[2,-6,14,-17,1.9],[-2,8,7,11,2.7],[0,-4,11,-14,3.2],[-1,3,8,9,2.5],[2,-5,13,-16,2.6],[-3,7,6,11,3.3]];
        let pts = '';
        for (let i = 0; i < pN; i++) {
          const [ox, oy, dx, dy, dur] = pats[i % pats.length];
          const sz = 1.5 + Math.random() * 2;
          const dly = (i * 0.35).toFixed(1);
          const t = i < 3 ? 1 : (0.15 + Math.random() * 0.75);
          pts += `<i class="cs-risk-pt" style="width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;right:${ox}px;top:${oy}px;--dx:${dx}px;--dy:${dy}px;--dur:${dur}s;--delay:${dly}s;background:${_edgeClr(t * confidence)}"></i>`;
        }
        riskBar = `<div class="cs-risk${confidence >= 80 ? ' is-critical' : ''}" style="--pct:${confidence}%;--edge-clr:${eClr}"><div class="cs-risk-track"><div class="cs-risk-fill" style="background:${grad}"><div class="cs-risk-edge"></div>${pts}</div></div><div class="cs-risk-meta"><span class="cs-risk-pct">${confidence}%</span><span class="cs-risk-lvl">${riskLbl[riskKey]}</span></div></div>`;
      }

      // Actions with natural language
      const actions = [];
      if (v === 'toxic' || v === 'suspicious' || fp) {
        actions.push(`<button class="cs-log-ea-btn ea-fp${fp ? ' is-fp' : ''}" data-fp="${entry._id || ''}" title="${fp ? (isZh ? '取消误判标记' : 'Remove correction') : (isZh ? '标记为误判' : 'Flag as false positive')}">${fp ? (isZh ? '已修正' : 'Corrected') : (isZh ? '标记误判' : 'Flag FP')}</button>`);
      }
      if (hitKws.length && !fp) {
        actions.push(`<button class="cs-log-ea-btn ea-wl" data-wl="${escapeHtml(hitKws[0])}" title="${isZh ? '将关键词加入白名单，避免再次误判' : 'Add keyword to whitelist'}">${isZh ? '加入白名单' : 'Whitelist'}</button>`);
      }
      if (v === 'toxic' && !entry.aiSummary) {
        actions.push(`<button class="cs-log-ea-btn ea-ai" data-explain="${entry._id || ''}" title="${isZh ? '让 AI 深度分析此内容' : 'Let AI analyze this content'}">${isZh ? 'AI 深度分析' : 'AI Analyze'}</button>`);
      }

      return `
        <div class="cs-log-entry v-${v}" data-entry-id="${entry._id || ''}" style="animation-delay:${Math.min(idx * 0.025, 0.2)}s">
          <div class="cs-log-entry-head">
            ${canCheck ? `<input type="checkbox" class="cs-log-entry-check" data-username="${escapeHtml(entry.username)}" data-uid="${entry.uid || ''}">` : ''}
            <span class="cs-log-entry-user" title="@${escapeHtml(entry.username)}">@${escapeHtml(entry.username)}</span>
            <span class="cs-log-entry-badges">${badges.join('')}</span>
            <span class="cs-log-entry-time">${timeStr}</span>
          </div>
          <div class="cs-log-entry-body">
            <div class="cs-log-entry-text">${escapeHtml(entry.text)}</div>
            ${ctxLine ? `<div class="cs-log-entry-ctx">${ctxLine}</div>` : ''}
            ${riskBar}
          </div>
          ${entry.aiSummary ? `<div class="cs-log-entry-ai"><span class="cs-log-ai-icon">AI</span><span class="cs-log-ai-label">${isZh ? 'AI 分析结论' : 'AI Verdict'}</span>${escapeHtml(entry.aiSummary)}</div>` : ''}
          ${actions.length ? `<div class="cs-log-entry-actions">${actions.join('')}</div>` : ''}
        </div>`;
    }).join('');
  },

  _bindLog() {
    const el = this._el;

    // Segmented filter
    el.querySelectorAll('.cs-log-seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        el.querySelectorAll('.cs-log-seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const list = el.querySelector('#cs-dash-log-list');
        if (list) list.innerHTML = this._renderLogList(this._scanLog, tab, this._logQuery || '');
      });
    });

    // Search
    const searchInput = el.querySelector('#cs-log-search');
    if (searchInput) {
      let _p = null;
      searchInput.addEventListener('input', () => {
        const q = searchInput.value || '';
        this._logQuery = q;
        if (_p) clearTimeout(_p);
        _p = setTimeout(() => {
          const list = el.querySelector('#cs-dash-log-list');
          if (list) list.innerHTML = this._renderLogList(this._scanLog, this._logTab || 'all', q);
        }, 100);
      });
    }

    // Clear
    el.querySelector('#cs-dash-log-clear')?.addEventListener('click', () => {
      const isZh = getLang() === 'zh';
      if (!confirm(isZh ? '确定清空日志？' : 'Clear all logs?')) return;
      this._scanLog.length = 0;
      this._renderSection('log');
    });

    // Scan & Block
    el.querySelector('#cs-dash-log-scan')?.addEventListener('click', () => emit(Events.SCANNER_MANUAL_SCAN));
    el.querySelector('#cs-dash-log-block')?.addEventListener('click', () => this._blockSelected());
    el.querySelector('#cs-dash-log-unblock')?.addEventListener('click', () => this._unblockSelected());

    // Delegated list interactions
    const listEl = el.querySelector('#cs-dash-log-list');
    if (listEl) {
      listEl.addEventListener('click', (e) => {
        const fpBtn = e.target.closest('.cs-log-ea-btn.ea-fp');
        if (fpBtn) {
          this._toggleMisjudgment(fpBtn.dataset.fp);
          const list = el.querySelector('#cs-dash-log-list');
          if (list) list.innerHTML = this._renderLogList(this._scanLog, this._logTab || 'all', this._logQuery || '');
          return;
        }
        const wlBtn = e.target.closest('.cs-log-ea-btn.ea-wl');
        if (wlBtn) { this._whitelistKeyword(wlBtn.dataset.wl); return; }
        const aiBtn = e.target.closest('.cs-log-ea-btn.ea-ai');
        if (aiBtn) {
          const entryId = aiBtn.dataset.explain;
          const entry = this._scanLog.find(x => x._id === entryId);
          if (!entry) return;
          const engine = this._agentEngine;
          if (!engine || !engine.process) {
            this.showToast(getLang() === 'zh' ? 'AI 未启用，请先配置 API key' : 'AI not configured', 'error');
            return;
          }
          const isZh = getLang() === 'zh';
          const prompt = isZh
            ? `请分析以下评论为什么被判定为违规。评论："${entry.text}" 命中关键词：${(entry.hitKeywords || []).join('、')}。请评估攻击性强度（0-10），并判断是否存在误判可能。`
            : `Analyze why flagged. Text: "${entry.text}" hit: ${(entry.hitKeywords || []).join(', ')}. Assess toxicity (0-10) and likely false positive.`;
          this._pendingAgentPrompt = prompt;
          this._renderSection('aichat');
        }
      });
    }
  },

  _toggleMisjudgment(entryId) {
    if (!this._misjudgmentRegistry) this._misjudgmentRegistry = {};
    const entry = this._scanLog.find(x => x._id === entryId);
    if (!entry) return;

    if (this._misjudgmentRegistry[entryId]) {
      delete this._misjudgmentRegistry[entryId];
      delete entry._fp;
      this._saveMisjudgmentRegistry();
      return;
    }

    const hitKws = (entry.hitKeywords && entry.hitKeywords.length) ? entry.hitKeywords
      : ((entry.reason || '').match(/Hard keyword match:\s*\[([^\]]+)\]/) || [])[1]?.split(',').map(s => s.trim()) || [];

    this._misjudgmentRegistry[entryId] = {
      text: (entry.text || '').slice(0, 200),
      username: entry.username || '',
      hitKeywords: hitKws,
      originalVerdict: entry.verdict || 'toxic',
      originalLayer: entry.layer || 1,
      markedAt: Date.now(),
    };
    entry._fp = true;
    this._saveMisjudgmentRegistry();
    this._maybeAutoCalibrate();
  },

  _whitelistKeyword(kw) {
    if (!kw) return;
    const curLang = getLang();
    if (this._scanner?.detector?.autoDowngradeSoftKeyword) {
      this._scanner.detector.autoDowngradeSoftKeyword(kw);
    }
    const cfg = this._config;
    if (cfg.customKeywords) {
      const idx = cfg.customKeywords.findIndex(k => k.keyword.toLowerCase() === kw.toLowerCase());
      if (idx >= 0) {
        cfg.customKeywords.splice(idx, 1);
        try { cfg.save?.(); } catch {}
        try { this._scanner?.detector?.reloadCustomKeywords?.(); } catch {}
      }
    }
    this.showToast(curLang === 'zh' ? `「${kw}」已加入白名单` : `"${kw}" whitelisted`, 'success');
  },

  _maybeAutoCalibrate() {
    const registry = this._misjudgmentRegistry || {};
    const threshold = 3;
    const hits = {};
    for (const entry of Object.values(registry)) {
      for (const kw of (entry.hitKeywords || [])) {
        hits[kw] = (hits[kw] || 0) + 1;
      }
    }
    const over = Object.entries(hits).filter(([, n]) => n >= threshold);
    if (!over.length) return;
    if (!this._scanner?.detector?.autoDowngradeSoftKeyword) return;

    const curLang = getLang();
    for (const [kw] of over) this._scanner.detector.autoDowngradeSoftKeyword(kw);
    const wrd = over.map(([k]) => `「${k}」`).join('、');
    this.showToast(
      curLang === 'zh'
        ? `${wrd} 累计 ${threshold} 次误判，已自动降权`
        : `${wrd} flagged ${threshold}+ times, auto-calibrated`,
      'info'
    );
  },

  _saveMisjudgmentRegistry() {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue('cs_misjudgment_registry_v1', JSON.stringify(this._misjudgmentRegistry || {}));
      }
    } catch {}
  },

  _loadMisjudgmentRegistry() {
    try {
      if (typeof GM_getValue === 'function') {
        const raw = GM_getValue('cs_misjudgment_registry_v1', '{}');
        const obj = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
        this._misjudgmentRegistry = obj;
      }
    } catch {}
    if (!this._misjudgmentRegistry) this._misjudgmentRegistry = {};
    for (const entry of (this._scanLog || [])) {
      if (entry._id && this._misjudgmentRegistry[entry._id]) entry._fp = true;
    }
  },

  // ─── 用户屏蔽 ──────────────────────────────────────────

  _blockSelected() {
    const checks = this._el.querySelectorAll('.cs-log-entry-check:checked');
    if (!checks.length) { GM_notification({ title: 'Droplet', text: t('noUserSelected') }); return; }
    const toBlock = new Map();
    checks.forEach(cb => { const u = cb.dataset.username; const uid = cb.dataset.uid; if (u && !toBlock.has(u)) toBlock.set(u, uid); });
    let n = 0;
    toBlock.forEach((uid, username) => {
      if (this._scanner?.blocker) {
        let el = this._findUserElement(username);
        if (!el) {
          el = document.body;
          if (uid) { el = document.createElement('div'); const a = document.createElement('a'); a.href = `https://space.bilibili.com/${uid}`; el.appendChild(a); el.dataset.mid = uid; }
        }
        this._scanner.blocker.block(username, el);
        n++;
      }
    });
    GM_notification({ title: 'Droplet', text: t('blockSelectedDone', { n }) });
    this._renderSection('log');
  },

  _findUserElement(username) {
    if (!username) return null;
    const uname = username.replace(/^@/, '').toLowerCase();
    const scanLog = this._scanLog || [];
    for (const entry of scanLog) {
      if ((entry.username || '').toLowerCase() === uname) {
        const textEls = document.querySelectorAll('[data-cs-verdict]');
        for (const el of textEls) {
          const text = (el.innerText || el.textContent || '').toLowerCase();
          if (text.includes(uname) || text.includes(username)) return el;
        }
        const allEls = document.querySelectorAll('[class*="comment"] p, [class*="reply"] p, [class*="message"] p');
        for (const el of allEls) {
          const text = (el.innerText || el.textContent || '').toLowerCase();
          if (text.length >= 3) return el;
        }
      }
    }
    return null;
  },

  _unblockSelected() {
    const checks = this._el.querySelectorAll('.cs-log-entry-check:checked');
    if (!checks.length) { GM_notification({ title: 'Droplet', text: t('noUserSelected') }); return; }
    let n = 0;
    checks.forEach(cb => {
      const u = cb.dataset.username;
      const uid = cb.dataset.uid;
      if (u && this._scanner?.blocker) { this._scanner.blocker.unblock(u, uid); n++; }
    });
    GM_notification({ title: 'Droplet', text: t('unblockSelectedDone', { n }) });
    this._renderSection('log');
  },

  // ─── System ────────────────────────────────────────────────

  _renderSystem() {
    const c = this._config;
    const scanner = this._scanner;
    const aiStatus = scanner?.aiAnalyzer?.getStatus?.() || {};
    const memStats = scanner?.memory?.getStats?.() || {};
    const cwStats = scanner?.contextWindow?.getStats?.() || {};
    const ctxRules = scanner?.detector?.contextRuleEngine?.getAllRules?.() || [];
    const learned = (scanner?.ruleLearner?.getHardKeywords?.()?.length || 0) + (scanner?.ruleLearner?.getSoftKeywords?.()?.length || 0) + (scanner?.ruleLearner?.getRegexPatterns?.()?.length || 0);
    const aiMode = c.aiMode || 'off';
    const aiOn = aiMode !== 'off';
    const provider = getProviderLabel(c.aiProvider, t);
    const model = c.aiModel || '--';
    const curLang = getLang();
    const isZh = curLang === 'zh';

    // ★ 获取 QuotaManager 使用量
    const qm = getQuotaManager();
    const semanticUsage = qm.getUsage(QUOTA_FEATURE.SEMANTIC_ANALYSIS);
    const agentUsage = qm.getUsage(QUOTA_FEATURE.AGENT_CHAT);
    const guardUsage = qm.getUsage(QUOTA_FEATURE.GUARD_ENGINE);

    const _pct = (used, daily) => daily > 0 ? Math.round((used / daily) * 100) : 0;
    const _barColor = (pct) => pct >= 90 ? 'var(--cs-danger, #ef4444)' : pct >= 70 ? 'var(--cs-warning, #f59e0b)' : 'var(--cs-accent, #38bdf8)';

    const quotaItems = [
      { key: QUOTA_FEATURE.SEMANTIC_ANALYSIS, label: isZh ? '语义分析' : 'Semantic Analysis', desc: isZh ? 'AI 检测有害内容' : 'AI detects harmful content', usage: semanticUsage },
      { key: QUOTA_FEATURE.AGENT_CHAT, label: isZh ? 'Agent 聊天' : 'Agent Chat', desc: isZh ? 'AI 对话交互' : 'AI conversation', usage: agentUsage },
      { key: QUOTA_FEATURE.GUARD_ENGINE, label: isZh ? '警卫引擎' : 'Guard Engine', desc: isZh ? 'AI 分析骚扰者' : 'AI analyzes harassers', usage: guardUsage },
    ];

    return `
      <div class="cs-dash-section">
        <div class="cs-dash-section-header">
          <h2 class="cs-dash-section-title">${t('sectionSystem')}</h2>
        </div>

        <!-- 系统信息 -->
        <div class="cs-dash-block">
          <div class="cs-dash-block-header"><span class="cs-block-label">${t('aiProvider')}</span><span class="cs-block-val">${aiOn ? provider : '--'}</span></div>
          <div class="cs-dash-block-header"><span class="cs-block-label">${t('aiModel')}</span><span class="cs-block-val">${aiOn ? model : '--'}</span></div>
          <div class="cs-dash-block-header"><span class="cs-block-label">${t('contextRules')}</span><span class="cs-block-val">${t('contextRulesCount', { n: ctxRules.length })} | ${t('learnedKeywords')}: ${learned}</span></div>
          <div class="cs-dash-block-header"><span class="cs-block-label">${t('memoryTitle')}</span><span class="cs-block-val">${t('memoryStats', { n: memStats.total || 0 })}</span></div>
          <div class="cs-dash-block-header"><span class="cs-block-label">Context Window</span><span class="cs-block-val">Users: ${cwStats.users || 0}, Msgs: ${cwStats.totalMessages || 0}</span></div>
        </div>

        <!-- ★ 限额管理 -->
        <div class="cs-dash-block" style="margin-top:12px">
          <div class="cs-dash-block-header" style="margin-bottom:10px">
            <span class="cs-block-label" style="font-weight:600">${isZh ? '功能限额管理' : 'Quota Management'}</span>
            <span class="cs-block-val" style="font-size:11px;color:var(--cs-text-secondary)">${isZh ? '每日自动重置' : 'Auto-reset daily'}</span>
          </div>
          ${quotaItems.map(qi => {
            const pct = _pct(qi.usage.used, qi.usage.daily);
            return `
            <div class="cs-quota-item" data-quota-feature="${qi.key}">
              <div class="cs-quota-header">
                <div>
                  <span class="cs-quota-label">${qi.label}</span>
                  <span class="cs-quota-desc">${qi.desc}</span>
                </div>
                <span class="cs-quota-num">${qi.usage.used} / ${qi.usage.daily}</span>
              </div>
              <div class="cs-quota-bar">
                <div class="cs-quota-fill" style="width:${pct}%;background:${_barColor(pct)}"></div>
              </div>
              <div class="cs-quota-controls">
                <label class="cs-quota-limit-label">
                  ${isZh ? '每日限额：' : 'Daily limit: '}
                  <input type="number" class="cs-quota-limit-input" data-feature="${qi.key}" value="${qi.usage.daily}" min="0" max="9999" step="10">
                </label>
                <span class="cs-quota-remaining">${isZh ? '剩余' : 'Remaining'}: ${qi.usage.remaining}</span>
              </div>
            </div>`;
          }).join('')}
          <div style="display:flex;gap:6px;margin-top:10px">
            <button class="cs-btn cs-btn-xs cs-btn-ghost" id="cs-quota-reset-all">${isZh ? '重置所有用量' : 'Reset All Usage'}</button>
          </div>
        </div>

        <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
          <button class="cs-btn cs-btn-sm cs-btn-ghost" id="cs-dash-sys-refresh">${t('refresh')}</button>
          <button class="cs-btn cs-btn-sm cs-btn-ghost" id="cs-dash-evidence-btn">${t('evidence')}</button>
          <button class="cs-btn cs-btn-sm cs-btn-ghost" id="cs-dash-diagnose-btn">${t('diagnose')}</button>
        </div>
      </div>`;
  },

  _bindSystem() {
    $el('cs-dash-sys-refresh', this._el)?.addEventListener('click', () => this._renderSection('system'));
    $el('cs-dash-evidence-btn', this._el)?.addEventListener('click', () => this._showEvidenceModal());
    $el('cs-dash-diagnose-btn', this._el)?.addEventListener('click', () => this._runDiagnose());

    // ★ 限额管理事件绑定
    const qm = getQuotaManager();
    const curLang = getLang();
    const isZh = curLang === 'zh';

    // 限额输入框变化
    this._el?.querySelectorAll('.cs-quota-limit-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const feature = e.target.dataset.feature;
        const newLimit = parseInt(e.target.value, 10);
        if (isNaN(newLimit) || newLimit < 0) {
          this.showToast(isZh ? '无效的限额值' : 'Invalid quota limit', 'error');
          e.target.value = qm.getUsage(feature).daily;
          return;
        }
        qm.setLimit(feature, newLimit);
        this.showToast(isZh ? '限额已更新' : 'Quota limit updated', 'success');
        // 重新渲染以更新显示
        this._renderSection('system');
      });
    });

    // 重置所有用量按钮
    $el('cs-quota-reset-all', this._el)?.addEventListener('click', () => {
      if (!confirm(isZh ? '确定重置所有功能的使用量？' : 'Reset all quota usage?')) return;
      qm.resetAllUsage();
      this.showToast(isZh ? '所有用量已重置' : 'All usage reset', 'success');
      this._renderSection('system');
    });
  },

  _showEvidenceModal() {
    const existing = document.getElementById('cs-dash-modal');
    if (existing) { existing.remove(); return; }
    const entries = this._evidence?.getAll() || [];
    const riskColors = { safe: '#22c55e', low: '#f59e0b', medium: '#f59e0b', high: '#ef4444' };
    const typeLbl = { comment: t('typeComment'), reply: t('typeReply'), message: t('typeMessage') };
    const modal = showModal(`
      <div class="cs-modal-inner">
        <div class="cs-modal-header">
          <span>${t('modalTitle')}</span>
          <span style="font-size:12px;color:var(--cs-text-secondary)">${t('entryCount', { n: entries.length })}</span>
          <button class="cs-dash-modal-close">&times;</button>
        </div>
        <div class="cs-modal-body">
          ${entries.length === 0 ? `<p class="cs-empty">${t('emptyLog')}</p>` : entries.slice(0, 100).map((e, i) => {
    const risk = e.result?.riskLevel || (e.verdict === 'toxic' ? 'high' : 'medium');
    return `
              <div class="cs-entry ${e.falsePositive ? 'cs-false-positive' : ''}" data-index="${i}">
                <div class="cs-entry-meta">
                  <span class="cs-entry-user">${escapeHtml(e.username)}</span>
                  <span class="cs-entry-verdict cs-verdict-${e.verdict || 'unknown'}">${e.verdict || '--'}</span>
                  <span class="cs-entry-risk" style="color:${riskColors[risk] || '#888'}">${t('risk' + risk.charAt(0).toUpperCase() + risk.slice(1))}</span>
                  ${e.contentType ? `<span class="cs-entry-type">${typeLbl[e.contentType] || e.contentType}</span>` : ''}
                  <span class="cs-entry-time">${new Date(e.timestamp).toLocaleString()}</span>
                </div>
                <div class="cs-entry-text">${escapeHtml(e.text || '')}</div>
                ${!e.falsePositive ? `<div class="cs-entry-actions"><button class="cs-fp-btn" data-index="${i}">${t('falsePositive')}</button></div>` : '<span class="cs-fp-marked">\u2713 FP</span>'}
              </div>`;
  }).join('')}
        </div>
      </div>`, { id: 'cs-dash-modal' });
    modal.querySelectorAll('.cs-fp-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        if (this._scanner) {
          const res = this._scanner.markFalsePositive(idx);
          if (res.success) {
            e.target.outerHTML = `<span class="cs-fp-marked">\u2713 ${res.deletedRules ? t('falsePositiveDeleted') : t('falsePositiveDone')}</span>`;
            const entry = modal.querySelector(`.cs-entry[data-index="${idx}"]`);
            if (entry) entry.classList.add('cs-false-positive');
          }
        }
      });
    });
  },

  _runDiagnose() {
    alert('诊断结果已输出到控制台，请按F12查看。\nDiagnosis results are in the Console (F12).');
    const selectors = ['.reply-item', '.sub-reply-item', '.comment-item', '.comment-item-container', 'bili-comment-thread-renderer', 'bili-comment-renderer', 'bili-rich-text', '[class*="reply"]', '[class*="comment"]', '[class*="Reply"]', '[class*="Comment"]', '[data-testid*="comment"]', '[aria-label*="comment"]'];
    console.log('%c[Droplet Diagnosis]', 'font-size:16px;font-weight:bold;color:#60a5fa');
    console.log('URL:', location.href);
    for (const sel of selectors) {
      const n = document.querySelectorAll(sel).length;
      if (n > 0) console.log(`  "${sel}" -> ${n} matches, sample:`, document.querySelector(sel)?.className?.slice(0, 100));
    }
  },

  // ─── About ────────────────────────────────────────────────

  _renderAbout() {
    return `
      <div class="cs-dash-section cs-about">
        <!-- 守护者宣言 Hero -->
        <div class="cs-about-hero">
          <div class="cs-about-guardian">
            <span class="cs-about-aura"></span>
            <span class="cs-about-ring"></span>
            <span class="cs-about-ring"></span>
            <span class="cs-about-drop">${DROP_SVG}</span>
          </div>
          <div class="cs-about-manifesto">
            <div class="cs-about-brand">Droplet</div>
            <div class="cs-about-version">v${VERSION}</div>
            <div class="cs-about-quote">${t('aboutQuote')}</div>
            <div class="cs-about-desc">${t('aboutDesc')}</div>
          </div>
        </div>

        <!-- 特性矩阵 -->
        <div class="cs-about-features-grid">
          <div class="cs-about-feature"><span class="cs-about-feature-icon">◆</span><span class="cs-about-feature-text">${t('aboutFeatKeywords')}</span></div>
          <div class="cs-about-feature"><span class="cs-about-feature-icon">◇</span><span class="cs-about-feature-text">${t('aboutFeatBehavior')}</span></div>
          <div class="cs-about-feature"><span class="cs-about-feature-icon">◈</span><span class="cs-about-feature-text">${t('aboutFeatBlock')}</span></div>
          <div class="cs-about-feature"><span class="cs-about-feature-icon">◉</span><span class="cs-about-feature-text">${t('aboutFeatEvidence')}</span></div>
          <div class="cs-about-feature"><span class="cs-about-feature-icon">◐</span><span class="cs-about-feature-text">${t('aboutFeatCustom')}</span></div>
          <div class="cs-about-feature"><span class="cs-about-feature-icon">✦</span><span class="cs-about-feature-text">${t('aboutFeatAI')}</span></div>
          <div class="cs-about-feature"><span class="cs-about-feature-icon">↻</span><span class="cs-about-feature-text">${t('aboutFeatRecycle')}</span></div>
          <div class="cs-about-feature"><span class="cs-about-feature-icon">▣</span><span class="cs-about-feature-text">${t('aboutFeatCategory')}</span></div>
        </div>

        <!-- 使用指南 -->
        <div class="cs-about-section">
          <h4 class="cs-about-section-title">${t('guideTitle')}</h4>
          <div class="cs-guide-block">
            <div class="cs-guide-item"><span class="cs-guide-label">${t('guideSens')}</span><span class="cs-guide-desc">${t('guideSensDesc')}</span></div>
            <div class="cs-guide-item"><span class="cs-guide-label">${t('guideAI')}</span><span class="cs-guide-desc">${t('guideAIDesc')}</span></div>
            <div class="cs-guide-item"><span class="cs-guide-label">${t('guideLayers')}</span><span class="cs-guide-desc">${t('guideLayersDesc')}</span></div>
          </div>
        </div>

        <!-- 快捷键 -->
        <div class="cs-about-section">
          <h4 class="cs-about-section-title">${t('keysTitle')}</h4>
          <div class="cs-about-shortcuts">
            <div class="cs-about-shortcut"><kbd>Ctrl+K</kbd><span>${t('keysCmdPalette')}</span></div>
            <div class="cs-about-shortcut"><kbd>${t('keysToggle')}</kbd><span>${t('keysToggle')}</span></div>
          </div>
        </div>

        <!-- 更新日志 -->
        <div class="cs-about-section">
          <h4 class="cs-about-section-title">${t('changelogTitle')}</h4>
          <div class="cs-changelog-list">
            <div class="cs-changelog-item"><span class="cs-changelog-ver">${t('changelogVer1')}</span><span class="cs-changelog-desc">${t('changelogDesc1')}</span></div>
            <div class="cs-changelog-item"><span class="cs-changelog-ver">${t('changelogVer2')}</span><span class="cs-changelog-desc">${t('changelogDesc2')}</span></div>
            <div class="cs-changelog-item"><span class="cs-changelog-ver">${t('changelogVer3')}</span><span class="cs-changelog-desc">${t('changelogDesc3')}</span></div>
            <div class="cs-changelog-item"><span class="cs-changelog-ver">${t('changelogVer4')}</span><span class="cs-changelog-desc">${t('changelogDesc4')}</span></div>
          </div>
        </div>

        <!-- 隐私 & 许可 -->
        <div class="cs-about-section">
          <h4 class="cs-about-section-title">${t('privacyTitle')} &amp; ${t('licenseTitle')}</h4>
          <p class="cs-about-text">${t('privacyText')}</p>
          <p class="cs-about-text">${t('licenseText')}</p>
        </div>

        <!-- 平台 & 支持 -->
        <div class="cs-about-section cs-about-footer">
          <div class="cs-about-links">
            <a href="https://github.com/andykair55-byte/Droplet" target="_blank" class="cs-about-link">GitHub</a>
          </div>
          <button class="cs-btn cs-btn-sm cs-btn-accent" id="cs-dash-check-update">${t('checkUpdateBtn')}</button>
          <span id="cs-dash-update-status" class="cs-hint"></span>
        </div>
      </div>`;
  },

  _bindAbout() {
    const btn = $el('cs-dash-check-update', this._el);
    const status = $el('cs-dash-update-status', this._el);
    btn?.addEventListener('click', () => {
      const current = GM_getValue('cs_version_ignore', '');
      const latest = VERSION;
      if (current === latest) {
        status.textContent = t('checkUpToDate');
      } else {
        status.textContent = t('checkNewAvailable') + ': ' + latest;
      }
      setTimeout(() => { if (status) status.textContent = ''; }, 4000);
    });
  },

  _saveBlocks() {
    try { GM_setValue('cs_dash_blocks', JSON.stringify(this._blocks)); } catch {}
  },
};
