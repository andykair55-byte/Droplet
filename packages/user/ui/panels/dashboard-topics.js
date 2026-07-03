/**
 * dashboard-topics.js — 话题管理面板（Dashboard mixin）
 * 从 panel-dashboard.js 提取，负责话题列表 / 详情 / 添加 / 分类
 */
import { t, getLang } from '../../../core/i18n.js';
import { safeHTML, escapeHtml, $el, delegate, showModal } from '../utils.js';

export const TopicsMixin = {
  _renderTopics() {
    return `
      <div class="cs-dash-section">
        <div class="cs-dash-section-header">
          <h2 class="cs-dash-section-title">${t('sectionTopic')}</h2>
          <div class="cs-dash-section-header-actions">
            <button class="cs-btn cs-btn-sm cs-btn-accent" id="cs-dash-topic-add">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M10 5v10M5 10h10"/></svg>
              ${t('topicAddBtn')}
            </button>
            <button class="cs-btn cs-btn-sm" id="cs-dash-topic-undo" ${this._undoStack.length > 0 ? '' : 'disabled'}>${t('topicUndo')}</button>
          </div>
        </div>
        <div class="cs-hint" style="margin-bottom:10px">${t('topicDesc')}</div>
        <div id="cs-dash-topic-list" class="cs-topic-list"></div>
      </div>`;
  },

  _bindTopics() {
    this._renderTopicList();
    const el = this._el;

    // 添加话题按钮
    $el('cs-dash-topic-add', el)?.addEventListener('click', () => this._showAddTopicDialog());

    // 撤销按钮
    $el('cs-dash-topic-undo', el)?.addEventListener('click', () => this._performUndo());

    // 回收站按钮
    $el('cs-dash-topic-recycle', el)?.addEventListener('click', () => this._renderSection('recycle'));
  },

  _renderTopicList() {
    const container = $el('cs-dash-topic-list', this._el);
    if (!container) return;
    // 优先从 scanner 获取，其次从 agentEngine 获取
    const tf = this._scanner?.topicFilter
      || this._agentEngine?.getTopicFilter?.();
    const topics = tf ? tf.getAllTopics() : [];
    // 获取热点话题管理器，合并活跃热点话题（防御性：getAll 可能抛异常）
    let hotTopics = [];
    try {
      const htm = this._scanner?.hotTopicManager;
      if (htm && typeof htm.getAll === 'function') {
        hotTopics = htm.getAll().filter(t => t && t.status === 'active');
      }
    } catch (e) {
      console.warn('[dashboard-topics] hotTopicManager getAll failed:', e);
    }
    if (topics.length === 0 && hotTopics.length === 0) {
      container.innerHTML = safeHTML(`
        <div class="cs-empty-state">
          <div class="cs-empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px;opacity:.4"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1" fill="currentColor"/></svg></div>
          <div class="cs-empty-state-text">${t('topicEmptyHint') || '暂无话题配置'}</div>
          <button class="cs-empty-state-action" id="cs-dash-topic-add-empty">添加话题</button>
        </div>
      `);
      $el('cs-dash-topic-add-empty', container)?.addEventListener('click', () => {
        this._showAddTopicDialog();
      });
      return;
    }
    const curLang = getLang();
    const labels = {
      gender_attack: t('topicGenderAttack'), race_attack: t('topicRaceAttack'),
      personal_attack: t('topicPersonalAttack'), political_extreme: t('topicPoliticalExtreme'),
      spoiler: t('topicSpoiler'), fan_war: t('topicFanWar'),
      spam_harass: t('topicSpamHarass'), game_toxic: t('topicGameToxic'),
    };
    const categoryIcons = {
      attack: '⚡', discrimination: '⚠️', politics: '🏛️',
      spoiler: '🔖', fanwar: '💥', gaming: '🎮',
      spam: '📢', custom: '🔧',
    };
    const categoryLabels = {
      attack: '攻击辱骂', discrimination: '歧视偏见', politics: '政治敏感',
      spoiler: '剧透泄露', fanwar: '饭圈冲突', gaming: '游戏 toxic',
      spam: '骚扰刷屏', custom: '自定义',
    };

    // 按分类分组
    const grouped = {};
    const uncategorized = [];
    for (const topic of topics) {
      const cat = topic.category || 'custom';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(topic);
    }

    let html = '';
    const enabledCount = topics.filter(t => t.enabled).length;
    html += `<div class="cs-topic-stats"><span class="cs-topic-stat-item"><span class="cs-topic-stat-num">${enabledCount}</span><span class="cs-topic-stat-label">已启用</span></span><span class="cs-topic-stat-sep">/</span><span class="cs-topic-stat-item"><span class="cs-topic-stat-num">${topics.length}</span><span class="cs-topic-stat-label">话题</span></span></div>`;

    // 渲染分类话题
    for (const [cat, catTopics] of Object.entries(grouped)) {
      html += `<div class="cs-topic-group"><div class="cs-topic-group-header"><span class="cs-topic-group-icon">${categoryIcons[cat] || '🔧'}</span><span class="cs-topic-group-label">${categoryLabels[cat] || cat}</span><span class="cs-topic-group-count">${catTopics.filter(t => t.enabled).length}/${catTopics.length}</span></div><div class="cs-topic-grid">`;
      for (const topic of catTopics) {
        const label = labels[topic.id] || topic.label?.[curLang] || topic.label?.zh || topic.id;
        html += `
          <div class="cs-topic-chip ${topic.enabled ? 'cs-topic-on' : ''} cs-stagger-item">
            <label class="cs-topic-chip-inner">
              <input type="checkbox" class="cs-topic-check" data-topic="${topic.id}" ${topic.enabled ? 'checked' : ''}>
              <span class="cs-topic-chip-label">${label}</span>
            </label>
            <button class="cs-topic-info-btn" data-topic="${topic.id}" title="${t('topicDetailClick')}">${t('topicDetailBtn')}</button>
            ${topic.source !== 'builtin' ? `<button class="cs-topic-del-btn" data-topic="${topic.id}" data-name="${label}" title="${t('topicCustomDelete')}">\u00D7</button>` : ''}
          </div>`;
      }
      html += '</div></div>';
    }

    // 渲染活跃热点话题
    if (hotTopics.length > 0) {
      html += `<div class="cs-topic-group cs-topic-group-hot"><div class="cs-topic-group-header"><span class="cs-topic-group-icon">\uD83D\uDD25</span><span class="cs-topic-group-label">热点话题</span><span class="cs-topic-group-count">${hotTopics.filter(t => t.enabled !== false).length}/${hotTopics.length}</span></div><div class="cs-topic-grid">`;
      for (const hot of hotTopics) {
        const hotId = hot.id || hot.topicId;
        const hotLabel = hot.label?.[curLang] || hot.label?.zh || hot.name || hot.title || hotId;
        const hotEnabled = hot.enabled !== false;
        html += `
          <div class="cs-topic-chip cs-topic-hot ${hotEnabled ? 'cs-topic-on' : ''} cs-stagger-item">
            <label class="cs-topic-chip-inner">
              <span class="cs-topic-chip-label">\uD83D\uDD25 ${escapeHtml(hotLabel)}</span>
            </label>
            <button class="cs-topic-info-btn" data-topic="${hotId}" data-source="hot" title="${t('topicDetailClick')}">${t('topicDetailBtn')}</button>
          </div>`;
      }
      html += '</div></div>';
    }

    container.innerHTML = safeHTML(html);
    this._bindTopicEvents(container);
  },

  _bindTopicEvents(container) {
    const getTF = () => this._scanner?.topicFilter || this._agentEngine?.getTopicFilter?.();
    // 事件委托：只绑定一次，后续重渲染无需重绑
    if (!container._topicEventsBound) {
      container._topicEventsBound = true;
      delegate(container, '.cs-topic-check', 'change', (e, cb) => {
        const id = cb.dataset.topic;
        const chip = cb.closest('.cs-topic-chip');
        if (chip) chip.classList.toggle('cs-topic-on', cb.checked);
        getTF()?.toggleTopic(id, cb.checked);
      });
      delegate(container, '.cs-topic-del-btn', 'click', (e, btn) => {
        const id = btn.dataset.topic;
        const name = btn.dataset.name || id;
        const tf = getTF();
        if (confirm(t('topicDelConfirm', { name })) && tf) {
          this._pushUndo({ type: 'delete_topic', topicId: id, data: tf.topics[id] });
          tf.removeTopic(id, this._recycleBin);
          this._renderTopicList();
        }
      });
      delegate(container, '.cs-topic-info-btn', 'click', (e, btn) => {
        e.preventDefault();
        this._showTopicDetail(btn.dataset.topic);
      });
    }
  },

  _showTopicDetail(topicId) {
    const tf = this._scanner?.topicFilter || this._agentEngine?.getTopicFilter?.();
    if (!tf) return;
    let topic = tf.topics[topicId];
    let isHotTopic = false;
    // 若普通话题中找不到，回退到热点话题管理器
    if (!topic) {
      const htm = this._scanner?.hotTopicManager;
      if (htm) {
        const hot = htm.getAll().find(t => (t.id || t.topicId) === topicId);
        if (hot) { topic = hot; isHotTopic = true; }
      }
    }
    if (!topic) return;
    const curLang = getLang();
    const label = topic.label?.[curLang] || topic.label?.zh || topic.name || topic.title || topic.id;
    const zhKeywords = topic.keywords?.zh || [];
    const enKeywords = topic.keywords?.en || [];
    const learned = !isHotTopic ? (tf.getAIRules(topicId) || []) : [];
    const examples = !isHotTopic ? (tf.getTopicExamples(topicId) || []) : [];
    const sourceText = isHotTopic
      ? (curLang === 'zh' ? '热点话题' : 'Hot Topic')
      : (topic.source === 'user' ? t('topicDetailSourceUser')
        : (topic.source === 'ai' ? (curLang === 'zh' ? 'AI创建' : 'AI created') : t('topicDetailSourceBuiltin')));
    const statusText = topic.enabled !== false ? t('topicDetailEnabled') : t('topicDetailDisabled');
    // 触发模式 / 组合规则（任一匹配 OR / 全部匹配 AND）
    const triggerMode = topic.triggerMode || (topic.combinationRule === 'AND' ? 'all' : 'any');
    const combinationRule = topic.combinationRule || (triggerMode === 'all' ? 'AND' : 'OR');
    const triggerModeText = triggerMode === 'all'
      ? (curLang === 'zh' ? '全部匹配 (AND)' : 'All match (AND)')
      : (curLang === 'zh' ? '任一匹配 (OR)' : 'Any match (OR)');

    const existing = document.getElementById('cs-dash-modal');
    if (existing) existing.remove();

    const modal = showModal(`
      <div class="cs-modal-inner" style="max-width:640px;max-height:85vh">
        <div class="cs-modal-header">
          <span>${isHotTopic ? '\uD83D\uDD25 ' : ''}${escapeHtml(label)}</span>
          <span style="font-size:12px;color:var(--cs-text-secondary)">${sourceText} | ${statusText}</span>
          <span style="font-size:12px;color:var(--cs-text-secondary)">${t('topicDetailKeywordCount', { n: zhKeywords.length + enKeywords.length })}</span>
          <span style="font-size:12px;color:var(--cs-accent)">${curLang === 'zh' ? '触发模式' : 'Trigger'}: ${triggerModeText}</span>
          <button class="cs-dash-modal-close">&times;</button>
        </div>
        <div class="cs-modal-body" style="display:flex;flex-direction:column;gap:14px">
          <div class="cs-dash-block" style="margin:0">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <div class="cs-dash-block-label" style="margin:0">${t('topicDetailKeywords')}</div>
              <button class="cs-btn cs-btn-xs cs-topic-undo-btn" data-type="topic-keywords" data-topic="${topicId}" style="font-size:11px" ${this._undoStack.length > 0 ? '' : 'disabled'}>${t('topicUndo')}</button>
            </div>
            <div class="cs-keyword-list">
              ${zhKeywords.length ? zhKeywords.map(k => `<span class="cs-keyword-tag cs-kw-del-mode cs-tag-zh">${escapeHtml(k)}<button class="cs-kw-del-btn" data-topic="${topicId}" data-keyword="${escapeHtml(k)}" data-lang="zh" title="${t('topicKwDel')}">\u00D7</button></span>`).join('') : ''}
              ${enKeywords.length ? enKeywords.map(k => `<span class="cs-keyword-tag cs-kw-del-mode cs-tag-en">${escapeHtml(k)}<button class="cs-kw-del-btn" data-topic="${topicId}" data-keyword="${escapeHtml(k)}" data-lang="en" title="${t('topicKwDel')}">\u00D7</button></span>`).join('') : ''}
              ${zhKeywords.length === 0 && enKeywords.length === 0 ? '<span class="cs-empty" style="padding:8px 0">\u2014</span>' : ''}
            </div>
          </div>
          <div class="cs-dash-block" style="margin:0">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <div class="cs-dash-block-label" style="margin:0">${t('topicDetailAiRules')}</div>
              <button class="cs-btn cs-btn-xs" id="cs-ai-rule-add-btn" data-topic="${topicId}" style="font-size:11px">${t('topicAddAiRule')}</button>
            </div>
            ${learned.length ? '<div style="display:flex;flex-wrap:wrap;gap:6px">' + learned.slice(0, 20).map(r => {
    const conf = Math.round((r.confidence || 0.85) * 100);
    const hits = r.hits || 0;
    const sourceLabel = r.source === 'ai_learned' ? 'AI' : r.source === 'user_added' ? t('topicDetailSourceUser') : r.source;
    return `<span class="cs-keyword-tag cs-kw-del-mode" style="background:color-mix(in srgb,var(--cs-accent)6%,transparent);border-color:color-mix(in srgb,var(--cs-accent)20%,transparent)">${escapeHtml(r.trigger)}<span style="font-size:10px;color:var(--cs-text-secondary);margin-left:4px">${conf}% (${hits}) [${sourceLabel}]</span><button class="cs-kw-del-btn cs-ai-rule-del-btn" data-topic="${topicId}" data-trigger="${escapeHtml(r.trigger)}" title="${t('topicKwDel')}">\u00D7</button></span>`;
  }).join('') + '</div>' : `<div class="cs-hint" style="padding:4px 0">${t('topicDetailNoAiRules')}</div>`}
          </div>
          <div class="cs-dash-block" style="margin:0">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <div class="cs-dash-block-label" style="margin:0">${t('topicDetailExamples')}</div>
              <div style="display:flex;gap:6px;align-items:center">
                <button class="cs-btn cs-btn-xs" id="cs-examples-add-btn" data-topic="${topicId}" style="font-size:11px">${t('topicAddExample')}</button>
                ${examples.length ? `<button class="cs-btn cs-btn-xs" id="cs-examples-clear-btn" style="font-size:11px">${t('topicDetailClear')}</button>` : ''}
              </div>
            </div>
            ${examples.length ? '<div style="display:flex;flex-direction:column;gap:4px">' + examples.slice(0, 10).map(m => {
    const time = new Date(m.timestamp).toLocaleTimeString(curLang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    const excerpt = (m.text || '').slice(0, 80);
    return `<div class="cs-regex-custom-item" style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--cs-bg-body);border-radius:6px;font-size:12px"><span style="font-weight:600;flex-shrink:0">${escapeHtml(m.username || '?')}</span><span style="color:var(--cs-text-secondary);flex-shrink:0">${time}</span><span style="color:var(--cs-text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(excerpt)}</span></div>`;
  }).join('') + '</div>' : `<div class="cs-hint" style="padding:4px 0">${t('topicDetailNoExamples')}</div>`}
          </div>
        </div>
      </div>`, { id: 'cs-dash-modal' });
    const clearBtn = document.getElementById('cs-examples-clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', (e) => { e.stopPropagation(); if (confirm(t('topicDetailClearConfirm'))) { tf.clearTopicExamples(topicId); modal.remove(); } });
    // 添加匹配示例按钮（在匹配示例标题右侧）
    const addExampleBtn = document.getElementById('cs-examples-add-btn');
    if (addExampleBtn) addExampleBtn.addEventListener('click', (e) => { e.stopPropagation(); this._showAddExampleDialog(topicId); });
    modal.querySelectorAll('.cs-kw-del-btn[data-topic]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const kw = btn.dataset.keyword;
        const lang = btn.dataset.lang;
        if (!kw || !confirm(t('topicDelKwConfirm', { keyword: kw }))) return;
        // 记录到撤销栈
        this._pushUndo({ type: 'delete_keyword', topicId, keyword: kw, lang });
        if (tf.removeKeywordFromTopic(topicId, kw, lang, this._recycleBin)) {
          modal.remove();
          this._renderTopicList();
        }
      });
    });
    // AI规则删除
    modal.querySelectorAll('.cs-ai-rule-del-btn[data-topic]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const trigger = btn.dataset.trigger;
        if (!trigger || !confirm(t('topicDelKwConfirm', { keyword: trigger }))) return;
        this._pushUndo({ type: 'delete_ai_rule', topicId, trigger });
        if (tf.removeAIRule(topicId, trigger, this._recycleBin)) {
          modal.remove();
          this._renderTopicList();
        }
      });
    });
    // AI规则添加
    const aiRuleAddBtn = document.getElementById('cs-ai-rule-add-btn');
    if (aiRuleAddBtn) {
      aiRuleAddBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showAddAIRuleToTopicDialog(topicId, tf, modal);
      });
    }
    // 撤销按钮（替代原来的"恢复默认"）
    modal.querySelectorAll('.cs-topic-undo-btn[data-type="topic-keywords"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._performUndo();
        modal.remove();
        this._renderTopicList();
      });
    });
  },

  _showAddTopicDialog() {
    const getTF = () => this._scanner?.topicFilter || this._agentEngine?.getTopicFilter?.();
    const tf = getTF();
    if (!tf) return;

    const existing = document.getElementById('cs-dash-modal');
    if (existing) existing.remove();

    const curLang = getLang();
    const categories = this._getCategoryOptions();

    const modal = showModal(`
      <div class="cs-modal-inner" style="max-width:480px">
        <div class="cs-modal-header">
          <span>${t('topicAddBtn')}</span>
          <button class="cs-dash-modal-close">&times;</button>
        </div>
        <div class="cs-modal-body" style="display:flex;flex-direction:column;gap:10px">
          <div class="cs-form-row">
            <label class="cs-form-label">${curLang === 'zh' ? '话题名称' : 'Topic Name'}</label>
            <input type="text" class="cs-input" id="cs-add-topic-label" placeholder="${curLang === 'zh' ? '如：职场歧视' : 'e.g. Workplace discrimination'}">
          </div>
          <div class="cs-form-row">
            <label class="cs-form-label">${curLang === 'zh' ? '关键词（空格/逗号分隔）' : 'Keywords (space/comma separated)'}</label>
            <input type="text" class="cs-input" id="cs-add-topic-keywords" placeholder="${curLang === 'zh' ? '如：职场霸凌，PUA，压榨' : 'e.g. bullying, toxic boss'}">
          </div>
          <div class="cs-form-row">
            <label class="cs-form-label">${curLang === 'zh' ? '分类' : 'Category'}</label>
            <select class="cs-input" id="cs-add-topic-category">
              ${categories.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
            </select>
          </div>
          <div class="cs-form-row">
            <label class="cs-form-label">${curLang === 'zh' ? '来源' : 'Source'}</label>
            <select class="cs-input" id="cs-add-topic-source">
              <option value="user">${curLang === 'zh' ? '用户创建' : 'User created'}</option>
              <option value="ai">${curLang === 'zh' ? 'AI创建' : 'AI created'}</option>
            </select>
          </div>
          <div class="cs-form-row">
            <label class="cs-form-label">${curLang === 'zh' ? '触发模式' : 'Trigger Mode'}</label>
            <select class="cs-input" id="cs-add-topic-trigger-mode">
              <option value="any">${curLang === 'zh' ? '任一匹配 (any) — 关键词命中任意一个即触发' : 'Any match — trigger if any keyword hits'}</option>
              <option value="all">${curLang === 'zh' ? '全部匹配 (all) — 所有关键词都命中才触发' : 'All match — trigger only if all keywords hit'}</option>
            </select>
          </div>
          <div class="cs-form-actions">
            <button class="cs-btn cs-btn-sm cs-btn-accent" id="cs-add-topic-save">${curLang === 'zh' ? '保存' : 'Save'}</button>
            <button class="cs-btn cs-btn-sm cs-btn-ghost cs-dash-modal-close-btn">${curLang === 'zh' ? '取消' : 'Cancel'}</button>
          </div>
        </div>
      </div>`, { id: 'cs-dash-modal' });

    document.getElementById('cs-add-topic-save')?.addEventListener('click', () => {
      const label = document.getElementById('cs-add-topic-label')?.value?.trim();
      const kwStr = document.getElementById('cs-add-topic-keywords')?.value?.trim();
      const category = document.getElementById('cs-add-topic-category')?.value || 'custom';
      const source = document.getElementById('cs-add-topic-source')?.value || 'user';
      const triggerMode = document.getElementById('cs-add-topic-trigger-mode')?.value || 'any';
      const combinationRule = triggerMode === 'all' ? 'AND' : 'OR';

      if (!label) { alert(curLang === 'zh' ? '请输入话题名称' : 'Please enter topic name'); return; }
      const keywords = kwStr ? kwStr.split(/[\s,，、]+/).map(s => s.trim()).filter(Boolean) : [];
      if (keywords.length === 0) { alert(curLang === 'zh' ? '请输入至少一个关键词' : 'Please enter at least one keyword'); return; }

      const id = tf.addUserTopic({ label, keywords, category, createdBy: source, triggerMode, combinationRule });
      if (id) {
        this._pushUndo({ type: 'add_topic', topicId: id });
        modal.remove();
        this._renderTopicList();
        this.showToast(curLang === 'zh' ? `话题"${label}"已添加` : `Topic "${label}" added`, 'success');
      }
    });
  },

  _showAddExampleDialog(preselectedTopicId) {
    const getTF = () => this._scanner?.topicFilter || this._agentEngine?.getTopicFilter?.();
    const tf = getTF();
    if (!tf) return;

    const existing = document.getElementById('cs-dash-modal');
    if (existing) existing.remove();

    const curLang = getLang();
    const topics = tf.getAllTopics();

    const modal = showModal(`
      <div class="cs-modal-inner" style="max-width:480px">
        <div class="cs-modal-header">
          <span>${t('topicAddExample')}</span>
          <button class="cs-dash-modal-close">&times;</button>
        </div>
        <div class="cs-modal-body" style="display:flex;flex-direction:column;gap:10px">
          <div class="cs-form-row">
            <label class="cs-form-label">${curLang === 'zh' ? '选择话题' : 'Select Topic'}</label>
            <select class="cs-input" id="cs-add-example-topic">
              ${topics.map(t => `<option value="${t.id}" ${t.id === preselectedTopicId ? 'selected' : ''}>${t.label?.[curLang] || t.label?.zh || t.id}</option>`).join('')}
            </select>
          </div>
          <div class="cs-form-row">
            <label class="cs-form-label">${curLang === 'zh' ? '示例文本' : 'Example Text'}</label>
            <textarea class="cs-input" id="cs-add-example-text" rows="3" placeholder="${curLang === 'zh' ? '输入匹配示例文本...' : 'Enter example text...'}" style="resize:vertical"></textarea>
          </div>
          <div class="cs-form-row">
            <label class="cs-form-label">${curLang === 'zh' ? '用户名（可选）' : 'Username (optional)'}</label>
            <input type="text" class="cs-input" id="cs-add-example-username" placeholder="user">
          </div>
          <div class="cs-form-actions">
            <button class="cs-btn cs-btn-sm cs-btn-accent" id="cs-add-example-save">${curLang === 'zh' ? '保存' : 'Save'}</button>
            <button class="cs-btn cs-btn-sm cs-btn-ghost cs-dash-modal-close-btn">${curLang === 'zh' ? '取消' : 'Cancel'}</button>
          </div>
        </div>
      </div>`, { id: 'cs-dash-modal' });

    document.getElementById('cs-add-example-save')?.addEventListener('click', () => {
      const topicId = document.getElementById('cs-add-example-topic')?.value;
      const text = document.getElementById('cs-add-example-text')?.value?.trim();
      const username = document.getElementById('cs-add-example-username')?.value?.trim() || 'user';

      if (!topicId || !text) { alert(curLang === 'zh' ? '请填写完整' : 'Please fill all fields'); return; }

      tf.addTopicExampleManual(topicId, text, username);
      modal.remove();
      this.showToast(curLang === 'zh' ? '匹配示例已添加' : 'Example added', 'success');
    });
  },

  _getCategoryOptions() {
    const curLang = getLang();
    return [
      { value: 'attack', label: curLang === 'zh' ? '攻击/辱骂' : 'Attack/Abuse' },
      { value: 'discrimination', label: curLang === 'zh' ? '歧视/偏见' : 'Discrimination' },
      { value: 'politics', label: curLang === 'zh' ? '政治/意识形态' : 'Politics' },
      { value: 'spoiler', label: curLang === 'zh' ? '剧透/泄露' : 'Spoiler/Leak' },
      { value: 'fanwar', label: curLang === 'zh' ? '饭圈/粉丝' : 'Fan war' },
      { value: 'gaming', label: curLang === 'zh' ? '游戏/竞技' : 'Gaming' },
      { value: 'spam', label: curLang === 'zh' ? '骚扰/刷屏' : 'Spam/Harassment' },
      { value: 'custom', label: curLang === 'zh' ? '自定义' : 'Custom' },
    ];
  },
};
