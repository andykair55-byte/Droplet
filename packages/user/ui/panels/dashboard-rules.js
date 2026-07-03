/**
 * dashboard-rules.js — 规则管理面板（Dashboard mixin）
 * 从 panel-dashboard.js 提取，负责规则 CRUD / 导入导出 / 弹窗管理
 */
import { t } from '../../../core/i18n.js';
import { emit } from '../../../core/events.js';
import { safeHTML, escapeHtml, $el, delegate, showModal } from '../utils.js';

export const RulesMixin = {
  _renderRules() {
    const kws = this._config.customKeywords || [];
    return `
      <div class="cs-dash-section">
        <div class="cs-dash-section-header">
          <h2 class="cs-dash-section-title">${t('sectionRulesCustom')}</h2>
          <div class="cs-dash-section-header-actions">
            <button class="cs-btn cs-btn-sm" id="cs-dash-rules-view">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 10s3-7 8-7 8 7 8 7-3 7-8 7-8-7-8-7z"/><circle cx="10" cy="10" r="3"/></svg>
              ${t('view')}
            </button>
            <button class="cs-btn cs-btn-sm" id="cs-dash-rules-import">${t('customImport')}</button>
            <button class="cs-btn cs-btn-sm" id="cs-dash-rules-export">${t('customExport')}</button>
          </div>
        </div>
        <div class="cs-rules-toolbar">
          <div class="cs-rules-input-wrap">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="9" cy="9" r="7"/><path d="M15 15l4 4"/></svg>
            <input type="text" class="cs-input" id="cs-dash-rules-input" placeholder="${t('customPlaceholder')}（支持多个词，空格/逗号分隔）">
          </div>
          <button class="cs-btn cs-btn-sm cs-btn-accent" id="cs-dash-rules-add">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M10 5v10M5 10h10"/></svg>
            ${t('customAdd')}
          </button>
          <button class="cs-btn cs-btn-sm" id="cs-dash-rules-batch" title="批量粘贴多行" aria-label="批量粘贴多行">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:14px;height:14px"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
          </button>
        </div>
        <div class="cs-rules-count">已添加 <strong>${kws.length}</strong> 个规则</div>
        <div id="cs-dash-rules-list" class="cs-custom-list"></div>
        ${kws.length > 0 ? `<div class="cs-rules-footer"><button class="cs-btn cs-btn-sm cs-btn-ghost" id="cs-dash-rules-clear"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M3 6h14M5 6v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6M8 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2"/></svg> ${t('customClearAll')}</button></div>` : ''}
      </div>`;
  },

  _openBatchKeywordsModal() {
    const existing = document.getElementById('cs-batch-kw-modal');
    if (existing) { existing.remove(); return; }
    const modal = showModal(`
      <div class="cs-modal-inner" style="max-width:480px">
        <div class="cs-modal-header">
          <span>批量添加屏蔽词</span>
          <button class="cs-dash-modal-close">&times;</button>
        </div>
        <div class="cs-modal-body">
          <p style="margin:0 0 8px;color:var(--cs-text-secondary);font-size:12px">每行一个词，或用逗号 / 空格分隔</p>
          <textarea id="cs-batch-kw-textarea" class="cs-input" style="width:100%;min-height:180px;font-family:inherit;font-size:13px;resize:vertical;padding:8px"></textarea>
          <div id="cs-batch-kw-preview" style="margin-top:8px;font-size:12px;color:var(--cs-text-secondary)"></div>
          <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:10px">
            <button class="cs-btn cs-btn-sm cs-btn-ghost cs-dash-modal-close-btn">取消</button>
            <button class="cs-btn cs-btn-sm" id="cs-batch-kw-ok">添加</button>
          </div>
        </div>
      </div>`, { id: 'cs-batch-kw-modal' });

    const ta = modal.querySelector('#cs-batch-kw-textarea');
    const preview = modal.querySelector('#cs-batch-kw-preview');
    const updatePreview = () => {
      const words = (ta.value || '').split(/[\s,，、\n\r]+/).map(s => s.trim()).filter(Boolean);
      if (!words.length) { preview.textContent = ''; return; }
      preview.textContent = `识别到 ${words.length} 个词：${words.slice(0, 10).join('、')}${words.length > 10 ? ` … 等 ${words.length} 个` : ''}`;
    };
    ta.addEventListener('input', updatePreview);
    try { ta.focus(); } catch (_) {} // ignore cross-origin autofocus restriction

    const doAdd = () => {
      const raw = ta.value || '';
      if (!raw.trim()) return modal.remove();
      const words = raw.split(/[\s,，、\n\r]+/).map(s => s.trim()).filter(Boolean);
      if (!words.length) return modal.remove();
      if (!this._config.customKeywords) this._config.customKeywords = [];
      let added = 0, skipped = 0;
      for (const w of words) {
        if (this._config.customKeywords.some(e => e.keyword.toLowerCase() === w.toLowerCase())) { skipped++; continue; }
        const aliases = [];
        const lower = w.toLowerCase().replace(/\s+/g, '');
        if (lower !== w) aliases.push(lower);
        this._config.customKeywords.push({ keyword: w, aliases, addedAt: Date.now() });
        added++;
      }
      emit('cs:config:updated', { type: 'customKeywords' });
      this._renderCustomList();
      if (this._scanner?.detector) { this._scanner.detector.reloadCustomKeywords(); this._scanner.manualScan(); }
      alert(`添加 ${added} 个${skipped ? `，${skipped} 个已存在被跳过` : ''}`);
      modal.remove();
    };
    modal.querySelector('#cs-batch-kw-ok').addEventListener('click', doAdd);
  },

  _bindRules() {
    const el = this._el;
    this._renderCustomList();
    $el('cs-dash-rules-add', el)?.addEventListener('click', () => this._addCustomRule());
    $el('cs-dash-rules-input', el)?.addEventListener('keydown', (e) => { if (e.key === 'Enter') this._addCustomRule(); });
    $el('cs-dash-rules-batch', el)?.addEventListener('click', () => this._openBatchKeywordsModal());
    $el('cs-dash-rules-view', el)?.addEventListener('click', () => this._showRulesModal());
    $el('cs-dash-rules-clear', el)?.addEventListener('click', () => {
      const n = this._config.customKeywords?.length || 0;
      if (n === 0) return;
      if (!confirm(t('customClearAllConfirm', { n }))) return;
      this._config.customKeywords = [];
      this._renderCustomList();
    });
    $el('cs-dash-rules-import', el)?.addEventListener('click', () => this._importRules());
    $el('cs-dash-rules-export', el)?.addEventListener('click', () => this._exportRules());
  },

  _addCustomRule() {
    const input = $el('cs-dash-rules-input', this._el);
    const val = input?.value?.trim();
    if (!val) return;
    const words = val.split(/[\s,，、]+/).map(s => s.trim()).filter(Boolean);
    if (!words.length) return;
    if (!this._config.customKeywords) this._config.customKeywords = [];
    let added = 0;
    for (const w of words) {
      if (this._config.customKeywords.some(e => e.keyword.toLowerCase() === w.toLowerCase())) continue;
      const aliases = [];
      const lower = w.toLowerCase().replace(/\s+/g, '');
      if (lower !== w) aliases.push(lower);
      this._config.customKeywords.push({ keyword: w, aliases, addedAt: Date.now() });
      added++;
    }
    input.value = '';
    this._renderCustomList();
    emit('cs:config:updated', { type: 'customKeywords' });
    if (this._scanner?.detector) { this._scanner.detector.reloadCustomKeywords(); this._scanner.manualScan(); }
    return added;
  },

  _renderCustomList() {
    const container = $el('cs-dash-rules-list', this._el);
    if (!container) return;
    const kws = this._config.customKeywords || [];
    if (!kws.length) { container.innerHTML = safeHTML(`<div class="cs-custom-empty">${t('customEmpty')}</div>`); return; }
    container.innerHTML = safeHTML(kws.map((e, i) => `
      <div class="cs-custom-item">
        <span class="cs-custom-kw">${escapeHtml(e.keyword)}</span>
        ${e.aliases?.length ? `<span class="cs-custom-aliases">${e.aliases.map(a => escapeHtml(a)).join(', ')}</span>` : ''}
        <button class="cs-custom-del" data-index="${i}" title="${t('customDelete')}">x</button>
      </div>`).join(''));
    // 事件委托：只绑定一次
    if (!container._customDelBound) {
      container._customDelBound = true;
      delegate(container, '.cs-custom-del', 'click', (e, btn) => {
        const i = parseInt(btn.dataset.index, 10);
        const entry = this._config.customKeywords[i];
        if (!entry) return;
        if (!confirm(t('customDelConfirm', { keyword: entry.keyword || '' }))) return;
        // 放入回收站
        if (this._recycleBin) {
          this._recycleBin.put('custom_keyword', { ...entry }, entry.keyword, '自定义屏蔽词');
        }
        this._config.customKeywords.splice(i, 1);
        this._renderCustomList();
        emit('cs:config:updated', { type: 'customKeywords' });
        if (this._scanner?.detector) { this._scanner.detector.reloadCustomKeywords(); this._scanner.manualScan(); }
      });
    }
  },

  _showRulesModal() {
    const existing = document.getElementById('cs-dash-modal');
    if (existing) { existing.remove(); return; }
    const rules = this._scanner?.detector?.getAllRules() || {};
    const excludedHard = new Set(this._config.excludedHardKeywords || []);
    const excludedSoft = new Set(this._config.excludedSoftKeywords || []);
    const excludedRegex = new Set(this._config.excludedRegexPatterns || []);
    const hardFiltered = (rules.hardKeywords || []).filter(k => !excludedHard.has(k));
    const softFiltered = (rules.softKeywords || []).filter(k => !excludedSoft.has(k));
    const regexFiltered = (rules.regexPatterns || []).filter(p => !excludedRegex.has(p));
    const modal = showModal(`
      <div class="cs-modal-inner" style="max-width:750px;height:80vh">
        <div class="cs-modal-header">
          <span>${t('rulesTitle')}</span>
          <button class="cs-dash-modal-close">&times;</button>
        </div>
        <div class="cs-modal-body" style="display:flex;flex-direction:column;height:100%">
          <div class="cs-rules-search-row">
            <input type="text" id="cs-rules-search-input" class="cs-input" placeholder="${t('rulesSearchPlaceholder')}" style="flex:1;font-size:13px">
          </div>
          <div class="cs-rules-tabs">
            <button class="cs-rules-tab cs-rules-tab-active" data-tab="hard">${t('rulesHard')} (${hardFiltered.length})</button>
            <button class="cs-rules-tab" data-tab="soft">${t('rulesSoft')} (${softFiltered.length})</button>
            <button class="cs-rules-tab" data-tab="regex">${t('rulesRegex')} (${regexFiltered.length + (rules.customRegex?.length || 0)})</button>
            <button class="cs-rules-tab" data-tab="custom">${t('rulesCustom')} (${rules.customKeywords?.length || 0})</button>
          </div>
          <div class="cs-rules-content" style="flex:1">
            <div class="cs-rules-panel cs-rules-panel-active" id="cs-dash-rules-hard">
              ${this._renderKeywordTags(hardFiltered, true)}
              <button class="cs-btn cs-btn-xs cs-rules-undo-btn" data-type="hard" style="margin-top:8px">${t('topicUndo')}</button>
            </div>
            <div class="cs-rules-panel" id="cs-dash-rules-soft">
              ${this._renderKeywordTags(softFiltered, true)}
              <button class="cs-btn cs-btn-xs cs-rules-undo-btn" data-type="soft" style="margin-top:8px">${t('topicUndo')}</button>
            </div>
            <div class="cs-rules-panel" id="cs-dash-rules-regex">
              <div class="cs-regex-list" id="cs-rules-regex-builtin">
                ${this._renderRegexTags(regexFiltered, true)}
              </div>
              <button class="cs-btn cs-btn-xs cs-rules-undo-btn" data-type="regex" style="margin-top:8px">${t('topicUndo')}</button>
              <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--cs-divider)">
                <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--cs-text)">${t('rulesCustomRegex')}</div>
                <div class="cs-rules-custom-toolbar">
                  <input type="text" id="cs-regex-add-pattern" class="cs-input" placeholder="${t('regexAddPlaceholder')}" style="flex:2;font-size:13px;font-family:monospace">
                  <input type="text" id="cs-regex-add-flags" class="cs-input" placeholder="${t('regexAddFlags')}" value="i" style="width:50px;font-size:13px;text-align:center">
                  <input type="text" id="cs-regex-add-desc" class="cs-input" placeholder="${t('regexAddDesc')}" style="flex:1;font-size:13px">
                  <button class="cs-btn cs-btn-sm" id="cs-regex-add-btn">${t('regexAddBtn')}</button>
                </div>
                <div id="cs-rules-regex-custom-list">
                  ${this._renderCustomRegexList(rules.customRegex)}
                </div>
              </div>
            </div>
            <div class="cs-rules-panel" id="cs-dash-rules-custom">
              <div class="cs-rules-custom-toolbar">
                <input type="text" id="cs-rules-custom-add-input" class="cs-input" placeholder="${t('customPlaceholder')}（支持多个词）" style="flex:1;font-size:13px">
                <button class="cs-btn cs-btn-sm" id="cs-rules-custom-add-btn">${t('customAdd')}</button>
                <button class="cs-btn cs-btn-sm" id="cs-rules-custom-batch" title="批量粘贴多行" aria-label="批量粘贴多行">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:14px;height:14px"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
                </button>
              </div>
              <div id="cs-rules-custom-list">
                ${this._renderCustomRulesList(rules.customKeywords)}
              </div>
            </div>
          </div>
        </div>
      </div>`, { id: 'cs-dash-modal' });

    // Tab switching
    modal.querySelectorAll('.cs-rules-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.cs-rules-tab').forEach(t => t.classList.remove('cs-rules-tab-active'));
        modal.querySelectorAll('.cs-rules-panel').forEach(p => p.classList.remove('cs-rules-panel-active'));
        tab.classList.add('cs-rules-tab-active');
        const p = modal.querySelector(`#cs-dash-rules-${tab.dataset.tab}`);
        if (p) p.classList.add('cs-rules-panel-active');
      });
    });

    // Search
    const searchInput = $el('cs-rules-search-input', modal);
    searchInput?.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      const activePanel = modal.querySelector('.cs-rules-panel-active');
      if (!activePanel) return;
      activePanel.querySelectorAll('.cs-keyword-tag, .cs-regex-item, .cs-custom-rules-item').forEach(el => {
        el.style.display = (!q || el.textContent.toLowerCase().includes(q)) ? '' : 'none';
      });
      const visible = [...activePanel.querySelectorAll('.cs-keyword-tag, .cs-regex-item, .cs-custom-rules-item')].some(el => el.style.display !== 'none');
      let noResult = activePanel.querySelector('.cs-rules-no-result');
      if (!visible && q) {
        if (!noResult) { noResult = document.createElement('p'); noResult.className = 'cs-rules-no-result cs-empty'; noResult.textContent = t('rulesSearchNoResult'); activePanel.appendChild(noResult); }
      } else if (noResult) { noResult.remove(); }
    });

    // Custom regex: add
    const doAddRegex = () => {
      const pattern = $el('cs-regex-add-pattern', modal)?.value?.trim();
      if (!pattern) return;
      const flags = $el('cs-regex-add-flags', modal)?.value?.trim() || 'i';
      const desc = $el('cs-regex-add-desc', modal)?.value?.trim() || '';
      try { new RegExp(pattern, flags); } catch (e) { alert(t('regexInvalid') + ': ' + e.message); return; }
      if (!this._config.customRegex) this._config.customRegex = [];
      if (this._config.customRegex.some(e => e.pattern === pattern)) { alert(t('regexExists')); return; }
      this._config.customRegex.push({ pattern, flags, description: desc, addedAt: Date.now() });
      emit('cs:config:updated', { type: 'customRegex' });
      $el('cs-regex-add-pattern', modal).value = '';
      $el('cs-regex-add-desc', modal).value = '';
      this._refreshRulesModal(modal);
    };
    $el('cs-regex-add-btn', modal)?.addEventListener('click', doAddRegex);
    $el('cs-regex-add-pattern', modal)?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAddRegex(); });

    // Custom regex: delete (delegated)
    $el('cs-rules-regex-custom-list', modal)?.addEventListener('click', (e) => {
      const btn = e.target.closest('.cs-regex-del-btn');
      if (!btn) return;
      const idx = parseInt(btn.dataset.index, 10);
      const entry = this._config.customRegex?.[idx];
      if (!entry) return;
      if (!confirm(t('regexDelConfirm', { pattern: entry.pattern }))) return;
      // 放入回收站
      if (this._recycleBin) {
        this._recycleBin.put('custom_regex', { ...entry }, entry.pattern, entry.description || '自定义正则');
      }
      this._config.customRegex.splice(idx, 1);
      emit('cs:config:updated', { type: 'customRegex' });
      this._refreshRulesModal(modal);
    });

    // Custom keyword: add in modal (支持多词)
    const doAddCustom = () => {
      const input = $el('cs-rules-custom-add-input', modal);
      const val = input?.value?.trim();
      if (!val) return;
      const words = val.split(/[\s,，、]+/).map(s => s.trim()).filter(Boolean);
      if (!words.length) return;
      if (!this._config.customKeywords) this._config.customKeywords = [];
      for (const w of words) {
        if (this._config.customKeywords.some(e => e.keyword.toLowerCase() === w.toLowerCase())) continue;
        const aliases = [];
        const lower = w.toLowerCase().replace(/\s+/g, '');
        if (lower !== w) aliases.push(lower);
        this._config.customKeywords.push({ keyword: w, aliases, addedAt: Date.now() });
      }
      input.value = '';
      emit('cs:config:updated', { type: 'customKeywords' });
      this._refreshRulesModal(modal);
      this._renderCustomList();
    };
    $el('cs-rules-custom-add-btn', modal)?.addEventListener('click', doAddCustom);
    $el('cs-rules-custom-add-input', modal)?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAddCustom(); });
    $el('cs-rules-custom-batch', modal)?.addEventListener('click', () => { modal.remove(); this._openBatchKeywordsModal(); });

    // Custom keyword: edit/delete (delegated)
    $el('cs-rules-custom-list', modal)?.addEventListener('click', (e) => {
      const btn = e.target.closest('.cs-custom-rules-del, .cs-custom-rules-edit');
      if (!btn) return;
      const idx = parseInt(btn.dataset.index, 10);
      if (isNaN(idx) || !this._config.customKeywords[idx]) return;
      if (btn.classList.contains('cs-custom-rules-del')) {
        const entry = this._config.customKeywords[idx];
        if (!confirm(t('customDelConfirm', { keyword: entry.keyword }))) return;
        // 放入回收站
        if (this._recycleBin) {
          this._recycleBin.put('custom_keyword', { ...entry }, entry.keyword, '自定义屏蔽词');
        }
        this._config.customKeywords.splice(idx, 1);
        emit('cs:config:updated', { type: 'customKeywords' });
        this._refreshRulesModal(modal);
        this._renderCustomList();
      } else if (btn.classList.contains('cs-custom-rules-edit')) {
        const entry = this._config.customKeywords[idx];
        const item = btn.closest('.cs-custom-rules-item');
        if (!item) return;
        const aliasesStr = (entry.aliases || []).join(', ');
        item.innerHTML = safeHTML(`
          <div class="cs-custom-edit-form" style="display:flex;flex-direction:column;gap:4px;width:100%">
            <input type="text" class="cs-input cs-edit-kw-input" value="${escapeHtml(entry.keyword)}" placeholder="${t('customEditKeyword')}" style="font-size:13px">
            <input type="text" class="cs-input cs-edit-alias-input" value="${escapeHtml(aliasesStr)}" placeholder="${t('customEditAliases')}" style="font-size:12px">
            <div style="display:flex;gap:4px;justify-content:flex-end">
              <button class="cs-btn cs-btn-xs cs-edit-save-btn">${t('customEditSave')}</button>
              <button class="cs-btn cs-btn-xs cs-btn-ghost cs-edit-cancel-btn">${t('customEditCancel')}</button>
            </div>
          </div>`);
        const save = item.querySelector('.cs-edit-save-btn');
        const cancel = item.querySelector('.cs-edit-cancel-btn');
        const kw = item.querySelector('.cs-edit-kw-input');
        const alias = item.querySelector('.cs-edit-alias-input');
        const doSave = () => {
          const newKw = kw.value.trim();
          if (!newKw) return;
          this._config.customKeywords[idx] = { keyword: newKw, aliases: alias.value.split(',').map(s => s.trim()).filter(Boolean), addedAt: entry.addedAt || Date.now() };
          emit('cs:config:updated', { type: 'customKeywords' });
          this._refreshRulesModal(modal);
          this._renderCustomList();
        };
        save.addEventListener('click', doSave);
        cancel.addEventListener('click', () => this._refreshRulesModal(modal));
        kw.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSave(); });
        try { kw.focus(); } catch (_) {} // ignore cross-origin autofocus restriction
      }
    });

    // Hard/Soft keyword delete (add to exclusion list)
    modal.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.cs-kw-del-btn');
      if (!delBtn) return;
      const kw = delBtn.dataset.keyword;
      if (!kw || !confirm(t('rulesDelConfirm', { keyword: kw }))) return;
      const tab = modal.querySelector('.cs-rules-tab-active');
      const type = tab?.dataset.tab;
      const key = type === 'soft' ? 'excludedSoftKeywords' : 'excludedHardKeywords';
      const arr = [...(this._config[key] || [])];
      if (!arr.includes(kw)) arr.push(kw);
      this._config[key] = arr;
      emit('cs:config:updated', { type: 'excludeKeyword' });
      this._refreshRulesModal(modal);
    });

    // Builtin regex delete
    modal.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.cs-regex-del-btn');
      if (!delBtn) return;
      if (delBtn.dataset.index !== undefined) return;
      const pattern = delBtn.dataset.pattern;
      if (!pattern || !confirm(t('rulesDelConfirm', { keyword: pattern }))) return;
      const arr = [...(this._config.excludedRegexPatterns || [])];
      if (!arr.includes(pattern)) arr.push(pattern);
      this._config.excludedRegexPatterns = arr;
      emit('cs:config:updated', { type: 'excludeRegex' });
      this._refreshRulesModal(modal);
    });

    // 撤销按钮（替代"恢复默认"）
    modal.querySelectorAll('.cs-rules-undo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const key = type === 'hard' ? 'excludedHardKeywords' : type === 'soft' ? 'excludedSoftKeywords' : 'excludedRegexPatterns';
        const excluded = this._config[key] || [];
        if (!excluded.length) return;
        if (!confirm(t('rulesResetConfirm', { type: t('rules' + type.charAt(0).toUpperCase() + type.slice(1)) }))) return;
        // 将排除的关键词放入回收站
        if (this._recycleBin) {
          for (const item of excluded) {
            this._recycleBin.put(type === 'regex' ? 'custom_regex' : 'custom_keyword', { keyword: item, type, restoredFrom: key }, String(item));
          }
        }
        this._config[key] = [];
        emit('cs:config:updated', { type: 'resetExclusions' });
        this._refreshRulesModal(modal);
      });
    });
  },

  _renderKeywordTags(kws, deletable) {
    if (!kws || !kws.length) return `<p class="cs-empty">${t('emptyLog')}</p>`;
    return `<div class="cs-keyword-list">${[...kws].sort().map(k => {
      const escK = escapeHtml(k);
      return deletable
        ? `<span class="cs-keyword-tag cs-kw-del-mode">${escK}<button class="cs-kw-del-btn" data-keyword="${escK}" title="${t('customDelete')}">\u00D7</button></span>`
        : `<span class="cs-keyword-tag">${escK}</span>`;
    }).join('')}</div>`;
  },

  _renderRegexTags(patterns, deletable) {
    if (!patterns || !patterns.length) return `<p class="cs-empty">${t('emptyLog')}</p>`;
    return `<div class="cs-regex-list">${[...patterns].map(p => {
      const escP = escapeHtml(p);
      return deletable
        ? `<div class="cs-regex-item cs-regex-del-mode"><code>${escP}</code><button class="cs-regex-del-btn" data-pattern="${escP}" title="${t('customDelete')}">\u00D7</button></div>`
        : `<code class="cs-regex-item">${escP}</code>`;
    }).join('')}</div>`;
  },

  _renderCustomRegexList(customs) {
    if (!customs || !customs.length) return `<p class="cs-empty" style="font-size:13px;padding:8px 0">${t('customEmpty')}</p>`;
    return customs.map((entry, i) => `
      <div class="cs-regex-custom-item" style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--cs-bg-body);border-radius:6px;margin-bottom:6px">
        <code style="flex:1;font-size:12px;color:var(--cs-text);word-break:break-all;font-family:monospace">/${escapeHtml(entry.pattern)}/${escapeHtml(entry.flags || 'i')}</code>
        ${entry.description ? `<span style="font-size:12px;color:var(--cs-text-secondary);flex-shrink:0">${escapeHtml(entry.description)}</span>` : ''}
        <button class="cs-regex-del-btn cs-rules-action-btn" data-index="${i}" title="${t('customDelete')}">x</button>
      </div>`).join('');
  },

  _renderCustomRulesList(customs) {
    if (!customs || !customs.length) return `<p class="cs-empty">${t('customEmpty')}</p>`;
    return customs.map((entry, i) => `
      <div class="cs-custom-rules-item" data-index="${i}">
        <span class="cs-custom-kw">${escapeHtml(entry.keyword)}</span>
        ${entry.aliases?.length ? `<span class="cs-custom-aliases">${entry.aliases.map(a => escapeHtml(a)).join(', ')}</span>` : ''}
        <button class="cs-custom-rules-edit cs-rules-action-btn" data-index="${i}" title="${t('customEdit')}">&#9998;</button>
        <button class="cs-custom-rules-del cs-rules-action-btn" data-index="${i}" title="${t('customDelete')}">x</button>
      </div>`).join('');
  },

  _refreshRulesModal(modal) {
    if (!modal || !modal.isConnected) return;
    const rules = this._scanner?.detector?.getAllRules() || {};
    const excludedHard = new Set(this._config.excludedHardKeywords || []);
    const excludedSoft = new Set(this._config.excludedSoftKeywords || []);
    const excludedRegex = new Set(this._config.excludedRegexPatterns || []);
    const hardFiltered = (rules.hardKeywords || []).filter(k => !excludedHard.has(k));
    const softFiltered = (rules.softKeywords || []).filter(k => !excludedSoft.has(k));
    const regexFiltered = (rules.regexPatterns || []).filter(p => !excludedRegex.has(p));
    modal.querySelectorAll('.cs-rules-tab').forEach(tab => {
      const key = tab.dataset.tab;
      const counts = { hard: hardFiltered.length, soft: softFiltered.length, regex: regexFiltered.length + (rules.customRegex?.length || 0), custom: rules.customKeywords?.length || 0 };
      const labels = { hard: t('rulesHard'), soft: t('rulesSoft'), regex: t('rulesRegex'), custom: t('rulesCustom') };
      tab.textContent = `${labels[key]} (${counts[key]})`;
    });
    const hardPanel = $el('cs-dash-rules-hard', modal);
    if (hardPanel) hardPanel.innerHTML = this._renderKeywordTags(hardFiltered, true) + `<button class="cs-btn cs-btn-xs cs-rules-undo-btn" data-type="hard" style="margin-top:8px">${t('topicUndo')}</button>`;
    const softPanel = $el('cs-dash-rules-soft', modal);
    if (softPanel) softPanel.innerHTML = this._renderKeywordTags(softFiltered, true) + `<button class="cs-btn cs-btn-xs cs-rules-undo-btn" data-type="soft" style="margin-top:8px">${t('topicUndo')}</button>`;
    const regexBuiltin = $el('cs-rules-regex-builtin', modal);
    if (regexBuiltin) regexBuiltin.innerHTML = this._renderRegexTags(regexFiltered, true);
    modal.querySelectorAll('.cs-rules-undo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const key = type === 'hard' ? 'excludedHardKeywords' : type === 'soft' ? 'excludedSoftKeywords' : 'excludedRegexPatterns';
        const excluded = this._config[key] || [];
        if (!excluded.length) return;
        if (!confirm(t('rulesResetConfirm', { type: t('rules' + type.charAt(0).toUpperCase() + type.slice(1)) }))) return;
        if (this._recycleBin) {
          for (const item of excluded) {
            this._recycleBin.put(type === 'regex' ? 'custom_regex' : 'custom_keyword', { keyword: item, type, restoredFrom: key }, String(item));
          }
        }
        this._config[key] = [];
        emit('cs:config:updated', { type: 'resetExclusions' });
        this._refreshRulesModal(modal);
      });
    });
    const regexCustom = $el('cs-rules-regex-custom-list', modal);
    if (regexCustom) regexCustom.innerHTML = this._renderCustomRegexList(rules.customRegex);
    const customList = $el('cs-rules-custom-list', modal);
    if (customList) customList.innerHTML = this._renderCustomRulesList(rules.customKeywords);
  },

  _exportRules() {
    const data = JSON.stringify({
      _meta: { version: '2.0', exportedAt: new Date().toISOString(), source: 'Droplet' },
      customKeywords: this._config.customKeywords || [],
      autoLearnedKeywords: this._config.autoLearnedKeywords || [],
      customRegex: this._config.customRegex || [],
      whitelist: this._config.whitelist || [],
      blocklist: this._config.blocklist || [],
    }, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = `cybershield-rules-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  _importRules() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result);
          if (Array.isArray(imported)) {
            const existing = this._config.customKeywords || [];
            const names = new Set(existing.map(e => e.keyword.toLowerCase()));
            for (const entry of imported) {
              if (entry.keyword && !names.has(entry.keyword.toLowerCase())) { existing.push(entry); names.add(entry.keyword.toLowerCase()); }
            }
            this._config.customKeywords = existing;
            this._renderCustomList();
            emit('cs:config:updated', { type: 'customKeywords' });
            if (this._scanner?.detector) this._scanner.detector.reloadCustomKeywords();
            return;
          }
          if (imported.customKeywords) {
            const existing = this._config.customKeywords || [];
            const names = new Set(existing.map(e => e.keyword.toLowerCase()));
            for (const entry of imported.customKeywords) {
              if (entry.keyword && !names.has(entry.keyword.toLowerCase())) { existing.push(entry); names.add(entry.keyword.toLowerCase()); }
            }
            this._config.customKeywords = existing;
          }
          this._renderCustomList();
          emit('cs:config:updated', { type: 'customKeywords' });
          if (this._scanner?.detector) this._scanner.detector.reloadCustomKeywords();
        } catch (err) { console.error('[CyberShield] Import failed:', err); }
      };
      reader.readAsText(file);
    });
    input.click();
  },
};
