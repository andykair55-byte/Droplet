/**
 * agent-interactions.js — Agent 交互卡片渲染函数
 * 从 panel-agent.js 提取的 15 个交互/卡片渲染函数
 */
import { safeHTML, escapeHtml, $el } from '../utils.js';
import { t, getLang } from '../../../core/i18n.js';

/**
 * 获取本地化的 scope 标签映射
 */
function _scopeLabels(extra = {}) {
  const base = {
    comment: t('cardScopeComment'),
    reply: t('cardScopeReply'),
    dynamic: t('cardScopeDynamic'),
    post: t('cardScopePost'),
    social: t('cardScopeSocial'),
    all: t('cardScopeAll'),
  };
  return { ...base, ...extra };
}

/**
 * 简易 Markdown 格式化（加粗、引用、代码）
 */
export function formatMarkdown(html) {
  return html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--cs-bg);padding:1px 5px;border-radius:4px;font-size:11px">$1</code>')
    .replace(/^>\s?(.+)/gm, '<blockquote style="border-left:3px solid var(--cs-accent);padding-left:8px;margin:4px 0;color:var(--cs-text-secondary)">$1</blockquote>')
    .replace(/\n/g, '<br>');
}

/**
 * 渲染 confirm_create interaction（带默认值的确认卡片）
 * 用户可以直接点"确认创建"完成操作，不需要再打字授权
 */
export function renderConfirmCreateInteraction(interaction, agentMsgs, addAgentMsg, container, agentSendMsg, panel) {
  const config = interaction.config || {};
  const card = document.createElement('div');
  card.className = 'cs-confirm-card';

  const modeLabel = config.mode === 'semantic' ? t('cardModeSemantic') : t('cardModeKeyword');
  const scopeLabels = _scopeLabels();

  card.innerHTML = safeHTML(`
    <div class="cs-confirm-card-title">
      <span style="display:inline-block;font-size:9px;font-weight:600;padding:1px 6px;border-radius:4px;background:var(--cs-accent);color:#fff">L2</span>
      ${t('cardCreateTopic')}
    </div>
    <div class="cs-confirm-card-detail">
      <div style="margin-bottom:4px"><strong>${t('cardTopicLabel')}：</strong><code>${escapeHtml(config.topicLabel || t('cardUnnamed'))}</code></div>
      <div style="margin-bottom:4px"><strong>${t('cardKeywords')}：</strong>${(config.keywords || []).map(k => `<span class="cs-tag">${escapeHtml(k)}</span>`).join('')}</div>
      <div style="margin-bottom:4px"><strong>${t('cardScope')}：</strong>${(config.scopes || []).map(s => scopeLabels[s] || s).join('、')}</div>
      <div style="margin-bottom:4px"><strong>${t('cardSensitivity')}：</strong><span class="cs-sensitivity-bar"><span class="cs-sensitivity-fill" style="width:${config.sensitivity === 'high' ? '80%' : config.sensitivity === 'medium' ? '50%' : '25%'};background:${config.sensitivity === 'high' ? 'var(--cs-signal-amber)' : config.sensitivity === 'medium' ? 'var(--cs-signal-cyan)' : 'var(--cs-signal-green)'}"></span></span>${escapeHtml(config.sensitivity || 'medium')}</div>
      <div><strong>${t('cardMode')}：</strong>${escapeHtml(modeLabel)}</div>
    </div>
    <div class="cs-confirm-card-actions">
      <button class="cs-confirm-btn cs-confirm-btn-primary" data-action="create">${t('cardConfirmCreate')}</button>
      <button class="cs-confirm-btn cs-confirm-btn-secondary" data-action="adjust">${t('cardConfirmAdjust')}</button>
      <button class="cs-confirm-btn cs-confirm-btn-secondary" data-action="cancel">${t('cardConfirmCancel')}</button>
    </div>
  `);

  // 确认创建 — 走 engine.confirmCurrent()，因为 active task 已有 plan
  card.querySelector('[data-action="create"]')?.addEventListener('click', async () => {
    // ★ 执行中状态
    card.classList.add('cs-confirm-card-executing');

    const engine = panel._agentEngine;
    if (!engine) { addAgentMsg('ai', '引擎不可用'); card.classList.remove('cs-confirm-card-executing'); return; }

    try {
      const result = await engine.confirmCurrent?.();
      if (result) {
        renderAIAction(result, addAgentMsg, container, agentSendMsg, panel);
      }
      panel._refreshTopics?.();
      // ★ 收起卡片为摘要
      card.classList.remove('cs-confirm-card-executing');
      card.classList.add('cs-confirm-card-collapsed');
      const titleEl = card.querySelector('.cs-confirm-card-title');
      if (titleEl) titleEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M20 6 9 17l-5-5"/></svg>${t('cardCreated')}「${escapeHtml(config.topicLabel)}」</span>`;
    } catch (err) {
      card.classList.remove('cs-confirm-card-executing');
      addAgentMsg('ai', `创建失败：${err.message}`);
      panel.showToast?.('创建失败', 'error');
    }
  });

  // 调整配置 — 用户可以打字修改
  card.querySelector('[data-action="adjust"]')?.addEventListener('click', () => {
    card.style.opacity = '0.5';
    card.style.pointerEvents = 'none';
    addAgentMsg('ai', '请告诉我你想调整哪些配置（话题标签、关键词、范围、敏感度）');
  });

  // 取消 — 走 engine.cancelCurrent()
  card.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
    card.remove();
    const engine = panel._agentEngine;
    if (engine?.cancelCurrent) {
      const result = engine.cancelCurrent();
      if (result) renderAIAction(result, addAgentMsg, container, agentSendMsg, panel);
    }
    panel.showToast?.('已取消', 'info');
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'cs-chat-msg-ai';
  wrapper.appendChild(card);

  // 如果有 LLM 的文字回复，先显示文字再显示卡片
  if (interaction.message) {
    addAgentMsg('ai', formatMarkdown(escapeHtml(interaction.message)));
  }

  agentMsgs.appendChild(wrapper);
  agentMsgs.scrollTop = agentMsgs.scrollHeight;

  if (!panel._agentHistoryLoaded) {
    if (!panel._agentHistory) panel._agentHistory = [];
    panel._agentHistory.push({ role: 'ai', text: '', aiText: `确认创建: ${config.topicLabel}`, html: `确认创建: ${config.topicLabel}`, timestamp: Date.now() });
  }
}

/**
 * 渲染 confirm_hot_topic interaction（热点规则确认卡片）
 */
export function renderConfirmHotTopicInteraction(interaction, agentMsgs, addAgentMsg, container, agentSendMsg, panel) {
  const config = interaction.config || {};
  const card = document.createElement('div');
  card.className = 'cs-confirm-card';
  card.style.borderColor = 'var(--cs-signal-amber)';

  const scopeLabels = _scopeLabels({ video: t('cardScopeVideo'), danmaku: t('cardScopeDanmaku') });
  const triggerModeLabels = { any: t('cardTriggerAny'), all: t('cardTriggerAll'), combination: t('cardTriggerCombination') };
  const triggerModeText = triggerModeLabels[config.triggerMode] || config.triggerMode || 'combination';
  const scopeText = (config.scopes || []).map(s => scopeLabels[s] || s).join('、');
  const ttlText = `${config.ttlDays || 7} ${t('cardDays')}`;

  let combinationText = '';
  if (config.triggerMode === 'combination' && config.combinationRule) {
    const allPart = config.combinationRule.all?.length ? `必须同时出现：${config.combinationRule.all.join('、')}` : '';
    const anyPart = config.combinationRule.any?.length ? `至少出现一个：${config.combinationRule.any.join('、')}` : '';
    combinationText = [allPart, anyPart].filter(Boolean).join('；');
  }

  card.innerHTML = safeHTML(`
    <div class="cs-confirm-card-title">
      <span style="display:inline-block;font-size:9px;font-weight:600;padding:1px 6px;border-radius:4px;background:var(--cs-signal-amber);color:#fff">L2</span>
      <span style="display:inline-flex;align-items:center;gap:5px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/></svg>${t('cardCreateHotTopicRule')}</span>
    </div>
    <div class="cs-confirm-card-detail">
      <div style="margin-bottom:4px"><strong>${t('cardRuleName')}：</strong><code>${escapeHtml(config.label || t('cardUnnamed'))}</code></div>
      <div style="margin-bottom:4px"><strong>${t('cardKeywords')}：</strong>${(config.keywords || []).map(k => `<span class="cs-tag">${escapeHtml(k)}</span>`).join('')}</div>
      <div style="margin-bottom:4px"><strong>${t('cardTriggerMode')}：</strong>${escapeHtml(triggerModeText)}</div>
      ${combinationText ? `<div style="margin-bottom:4px"><strong>${t('cardCombinationRule')}：</strong>${escapeHtml(combinationText)}</div>` : ''}
      <div style="margin-bottom:4px"><strong>${t('cardRange')}：</strong>${escapeHtml(scopeText || t('cardDefault'))}</div>
      <div><strong>${t('cardValidPeriod')}：</strong><span style="color:var(--cs-signal-amber)">${escapeHtml(ttlText)}</span>（${t('cardExpiresHint')}）</div>
    </div>
    <div class="cs-confirm-card-actions">
      <button class="cs-confirm-btn cs-confirm-btn-primary" data-action="create">${t('cardConfirmCreate')}</button>
      <button class="cs-confirm-btn cs-confirm-btn-secondary" data-action="adjust">${t('cardConfirmAdjust')}</button>
      <button class="cs-confirm-btn cs-confirm-btn-secondary" data-action="cancel">${t('cardConfirmCancel')}</button>
    </div>
  `);

  card.querySelector('[data-action="create"]')?.addEventListener('click', async () => {
    card.classList.add('cs-confirm-card-executing');
    const engine = panel._agentEngine;
    if (!engine) { addAgentMsg('ai', '引擎不可用'); card.classList.remove('cs-confirm-card-executing'); return; }
    try {
      const result = await engine.confirmCurrent?.();
      if (result) renderAIAction(result, addAgentMsg, container, agentSendMsg, panel);
      panel._refreshTopics?.();
      card.classList.remove('cs-confirm-card-executing');
      card.classList.add('cs-confirm-card-collapsed');
      const titleEl = card.querySelector('.cs-confirm-card-title');
      if (titleEl) titleEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M20 6 9 17l-5-5"/></svg>${t('cardCreated')}「${escapeHtml(config.label)}」</span>`;
    } catch (err) {
      card.classList.remove('cs-confirm-card-executing');
      addAgentMsg('ai', `创建失败：${err.message}`);
      panel.showToast?.('创建失败', 'error');
    }
  });

  card.querySelector('[data-action="adjust"]')?.addEventListener('click', () => {
    card.style.opacity = '0.5';
    card.style.pointerEvents = 'none';
    addAgentMsg('ai', '请告诉我你想调整哪些配置（名称、关键词、触发模式、范围、有效期）');
  });

  card.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
    card.remove();
    const engine = panel._agentEngine;
    if (engine?.cancelCurrent) { engine.cancelCurrent(); }
    panel.showToast?.('已取消', 'info');
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'cs-chat-msg-ai';
  wrapper.appendChild(card);

  if (interaction.message) {
    addAgentMsg('ai', formatMarkdown(escapeHtml(interaction.message)));
  }

  agentMsgs.appendChild(wrapper);
  agentMsgs.scrollTop = agentMsgs.scrollHeight;

  if (!panel._agentHistoryLoaded) {
    if (!panel._agentHistory) panel._agentHistory = [];
    panel._agentHistory.push({ role: 'ai', text: '', aiText: `确认创建热点: ${config.label}`, html: `确认创建热点: ${config.label}`, timestamp: Date.now() });
  }
}

/**
 * 渲染 confirm_action interaction（删除/禁用/启用话题的确认卡片）
 */
export function renderConfirmActionInteraction(interaction, agentMsgs, addAgentMsg, container, agentSendMsg, panel, riskColors, riskLabels) {
  const config = interaction.config || {};
  const actionType = config.actionType || 'delete';
  const actionLabels = { delete: t('agentActionDelete'), disable: t('agentActionDisable'), enable: t('agentActionEnable') };
  const actionLabel = actionLabels[actionType] || actionType;
  const riskLevel = config.riskLevel || (actionType === 'delete' ? 'L3' : 'L1');
  const color = riskColors[riskLevel] || '#6b7280';
  const label = riskLabels[riskLevel] || riskLevel;
  const isHighRisk = riskLevel === 'L3' || riskLevel === 'L4';

  const card = document.createElement('div');
  card.className = 'cs-confirm-card';
  if (isHighRisk) card.style.borderColor = 'var(--cs-danger)';

  card.innerHTML = safeHTML(`
    <div class="cs-confirm-card-title">
      <span style="display:inline-block;font-size:9px;font-weight:600;padding:1px 6px;border-radius:4px;background:${color};color:#fff">${escapeHtml(label)}</span>
      ${actionLabel}${t('agentActionTopic')}
    </div>
    <div class="cs-confirm-card-detail">
      <div style="margin-bottom:4px"><strong>${t('agentActionTopic')}：</strong><code>${escapeHtml(config.topicLabel || config.topicId || t('agentActionUnknown'))}</code></div>
      <div style="margin-bottom:4px"><strong>${t('agentActionOperation')}：</strong>${actionLabel}</div>
      ${actionType === 'delete' ? '<div style="color:var(--cs-danger);font-size:11px;margin-top:4px"><span style="display:inline-flex;align-items:center;gap:5px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg>' + t('agentActionDeleteWarning') + '</span></div>' : ''}
    </div>
    <div class="cs-confirm-card-actions">
      <button class="cs-confirm-btn ${isHighRisk ? 'cs-confirm-btn-danger' : 'cs-confirm-btn-primary'}" data-action="confirm">
        ${isHighRisk ? '<span style="display:inline-flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg>' + t('agentActionConfirm') + actionLabel + '</span>' : t('agentActionConfirm') + actionLabel}
      </button>
      <button class="cs-confirm-btn cs-confirm-btn-secondary" data-action="cancel">${t('agentActionCancel')}</button>
    </div>
  `);

  card.querySelector('[data-action="confirm"]')?.addEventListener('click', async () => {
    card.style.opacity = '0.5';
    card.style.pointerEvents = 'none';

    const engine = panel._agentEngine;
    if (!engine) { addAgentMsg('ai', '引擎不可用'); return; }

    try {
      const result = await engine.confirmCurrent?.();
      if (result) {
        renderAIAction(result, addAgentMsg, container, agentSendMsg, panel);
      }
      panel._refreshTopics?.();
    } catch (err) {
      addAgentMsg('ai', `${actionLabel}失败：${err.message}`);
    }
  });

  card.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
    card.remove();
    const engine = panel._agentEngine;
    if (engine?.cancelCurrent) {
      const result = engine.cancelCurrent();
      if (result) renderAIAction(result, addAgentMsg, container, agentSendMsg, panel);
    }
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'cs-chat-msg-ai';
  wrapper.appendChild(card);

  if (interaction.message) {
    addAgentMsg('ai', formatMarkdown(escapeHtml(interaction.message)));
  }

  agentMsgs.appendChild(wrapper);
  agentMsgs.scrollTop = agentMsgs.scrollHeight;

  if (!panel._agentHistoryLoaded) {
    if (!panel._agentHistory) panel._agentHistory = [];
    panel._agentHistory.push({ role: 'ai', text: '', aiText: `${actionLabel}确认: ${config.topicLabel}`, html: `${actionLabel}确认: ${config.topicLabel}`, timestamp: Date.now() });
  }
}

/**
 * 渲染 clarify interaction（统一 schema）
 */
export function renderClarifyInteraction(interaction, agentMsgs, addAgentMsg, container, agentSendMsg, panel) {
  const card = document.createElement('div');
  card.className = 'cs-interactive-card';

  const fieldsHtml = (interaction.fields || []).map(f => {
    if (f.input === 'choice' && f.options?.length) {
      return `
        <div style="margin-bottom:8px">
          <div style="font-size:12px;color:var(--cs-text-secondary);margin-bottom:4px">${escapeHtml(f.label)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${f.options.map((opt, i) => `
              <button class="cs-option-chip" data-opt-idx="${i}" data-opt-value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</button>
            `).join('')}
          </div>
        </div>`;
    }
    return `<div style="font-size:12px;color:var(--cs-text-secondary);margin-bottom:4px">${escapeHtml(f.label)}</div>`;
  }).join('');

  card.innerHTML = safeHTML(`
    <div class="cs-interactive-card-header">
      <span class="cs-interactive-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:20px;height:20px"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg></span>
      <span>需要补充信息</span>
    </div>
    <div class="cs-interactive-card-body">
      ${interaction.message ? `<div style="font-size:13px;margin-bottom:8px">${formatMarkdown(escapeHtml(interaction.message))}</div>` : ''}
      ${fieldsHtml}
    </div>
  `);

  // 选项值 → 结构化 intent 映射
  const VALUE_TO_ACTION = {
    configure_filter: 'CREATE',
    diagnose: 'DIAGNOSE',
    status: 'QUERY',
    help: 'CAPABILITY_LIST',
  };

  card.querySelectorAll('.cs-option-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      card.querySelectorAll('.cs-option-chip').forEach(c => c.classList.remove('cs-option-selected'));
      chip.classList.add('cs-option-selected');
      chip.innerHTML = `<span class="cs-option-chip-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M20 6 9 17l-5-5"/></svg></span> ${chip.textContent}`;
      setTimeout(() => {
        card.style.opacity = '0.5';
        card.style.pointerEvents = 'none';
        const value = chip.dataset.optValue;
        // ★ 携带结构化 intent，不让后端重新 NLP 猜
        const resolvedAction = VALUE_TO_ACTION[value];
        agentSendMsg(value, { resolvedAction, clarificationAnswer: value });
      }, 300);
    });
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'cs-chat-msg-ai';
  wrapper.appendChild(card);
  agentMsgs.appendChild(wrapper);
  agentMsgs.scrollTop = agentMsgs.scrollHeight;

  if (!panel._agentHistoryLoaded) {
    if (!panel._agentHistory) panel._agentHistory = [];
    panel._agentHistory.push({ role: 'ai', html: interaction.message || '需要补充信息' });
  }
}

/**
 * 渲染 confirm interaction（统一 schema）
 */
export function renderConfirmInteraction(interaction, action, agentMsgs, addAgentMsg, container, agentSendMsg, panel, riskColors, riskLabels) {
  const riskLevel = action.riskLevel || 'L2';
  const color = riskColors[riskLevel] || '#6b7280';
  const label = riskLabels[riskLevel] || riskLevel;
  const isHighRisk = riskLevel === 'L3' || riskLevel === 'L4';

  const card = document.createElement('div');
  card.className = 'cs-confirm-card';
  if (isHighRisk) card.style.borderColor = 'var(--cs-danger)';

  card.innerHTML = safeHTML(`
    <div class="cs-confirm-card-title">
      <span style="display:inline-block;font-size:9px;font-weight:600;padding:1px 6px;border-radius:4px;background:${color};color:#fff">${escapeHtml(label)}</span>
      ${t('agentActionExecute')}
    </div>
    <div class="cs-confirm-card-detail">
      ${(interaction.steps || []).map((s, i) => `<div>步骤 ${i+1}: <code>${escapeHtml(s.label)}</code></div>`).join('')}
    </div>
    <div class="cs-confirm-card-actions">
      <button class="cs-confirm-btn ${isHighRisk ? 'cs-confirm-btn-danger' : 'cs-confirm-btn-primary'}" data-action="confirm">
        ${isHighRisk ? '<span style="display:inline-flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg>' + t('agentActionExecute') + '</span>' : t('agentActionExecute')}
      </button>
      <button class="cs-confirm-btn cs-confirm-btn-secondary" data-action="cancel">${t('agentActionCancel')}</button>
    </div>
  `);

  card.querySelector('[data-action="confirm"]')?.addEventListener('click', async () => {
    card.remove();
    const result = await panel._agentEngine?.confirmCurrent?.();
    if (result) renderAIAction(result, addAgentMsg, container, agentSendMsg, panel);
    panel._refreshTopics?.();
    panel.showToast?.(t('agentActionConfirmed'), 'success');
  });
  card.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
    card.remove();
    const result = panel._agentEngine?.cancelCurrent?.();
    if (result) renderAIAction(result, addAgentMsg, container, agentSendMsg, panel);
    panel.showToast?.(t('agentActionCancelled'), 'info');
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'cs-chat-msg-ai';
  wrapper.appendChild(card);
  agentMsgs.appendChild(wrapper);
  agentMsgs.scrollTop = agentMsgs.scrollHeight;
}

/**
 * 渲染 guide_understand interaction（理解确认卡片）
 * 用户语义模糊时，Agent 先确认理解是否正确
 */
export function renderGuideUnderstandInteraction(interaction, agentMsgs, addAgentMsg, container, agentSendMsg, panel) {
  const card = document.createElement('div');
  card.className = 'cs-guide-card cs-guide-card--understand';

  card.innerHTML = safeHTML(`
    <div class="cs-guide-card-header">
      <span class="cs-guide-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg></span>
      <span class="cs-guide-card-title">${t('agentActionGuideUnderstand')}</span>
    </div>
    <div class="cs-guide-understanding-text">${escapeHtml(interaction.understanding || interaction.message || '')}</div>
    <div class="cs-guide-card-actions">
      <button class="cs-guide-btn cs-guide-btn-primary" data-action="confirm"><span style="display:inline-flex;align-items:center;gap:5px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M20 6 9 17l-5-5"/></svg>${t('agentActionConfirm')}</span></button>
      <button class="cs-guide-btn cs-guide-btn-secondary" data-action="cancel"><span style="display:inline-flex;align-items:center;gap:5px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:14px;height:14px;flex-shrink:0"><path d="M18 6 6 18M6 6l12 12"/></svg>${t('agentActionCancel')}</span></button>
      <button class="cs-guide-btn cs-guide-btn-secondary" data-action="supplement">${t('agentActionSupplement')}</button>
    </div>
  `);

  // 对 → 进入配置引导
  card.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
    card.style.opacity = '0.5';
    card.style.pointerEvents = 'none';
    agentSendMsg('对，就是这个');
  });

  // 不对 → 重新提问
  card.querySelector('[data-action="deny"]')?.addEventListener('click', () => {
    card.remove();
    addAgentMsg('ai', '抱歉理解错了，请重新描述你想过滤的内容。');
  });

  // 补充说明 → 展开输入框
  card.querySelector('[data-action="supplement"]')?.addEventListener('click', () => {
    card.querySelector('.cs-guide-card-actions').style.display = 'none';
    const inputArea = document.createElement('div');
    inputArea.className = 'cs-guide-supplement-input';
    inputArea.innerHTML = safeHTML(`
      <textarea class="cs-guide-textarea" placeholder="补充说明你想过滤的内容..."></textarea>
      <button class="cs-guide-btn cs-guide-btn-primary">提交</button>
    `);
    card.appendChild(inputArea);
    const textarea = inputArea.querySelector('textarea');
    try { textarea.focus(); } catch (_) {} // ignore cross-origin autofocus restriction
    inputArea.querySelector('button').addEventListener('click', () => {
      const supplement = textarea.value.trim();
      if (supplement) {
        card.style.opacity = '0.5';
        card.style.pointerEvents = 'none';
        agentSendMsg(supplement);
      }
    });
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'cs-chat-msg-ai';
  wrapper.appendChild(card);

  if (interaction.message) {
    addAgentMsg('ai', formatMarkdown(escapeHtml(interaction.message)));
  }

  agentMsgs.appendChild(wrapper);
  agentMsgs.scrollTop = agentMsgs.scrollHeight;

  if (!panel._agentHistoryLoaded) {
    if (!panel._agentHistory) panel._agentHistory = [];
    panel._agentHistory.push({ role: 'ai', text: '', aiText: t('agentActionGuideUnderstand'), html: t('agentActionGuideUnderstand'), timestamp: Date.now() });
  }
}

/**
 * 渲染 guide_config interaction（配置引导卡片）
 * 展示完整配置卡片，用户可修改分类/关键词/范围/敏感度/模式
 */
export function renderGuideConfigInteraction(interaction, agentMsgs, addAgentMsg, container, agentSendMsg, panel) {
  const config = interaction.config || {};
  const card = document.createElement('div');
  card.className = 'cs-guide-card cs-guide-card--config';

  const categoryLabels = {
    harassment: '骚扰', personal_attack: '人身攻击', game_toxic: '游戏毒性',
    spoiler: '剧透', discrimination: '歧视', political_extreme: '政治极端',
    toxic_community: '有毒社区', custom: '自定义',
  };
  const scopeLabels = { comment: '评论', reply: '回复', dynamic: '动态', feed: '首页推荐', timeline: '时间线' };
  const sensitivityLabels = { low: '低敏', medium: '均衡', high: '严格' };

  // 当前选中的配置（用户可修改）
  const currentConfig = {
    topicLabel: config.topicLabel || '',
    category: config.category || 'toxic_community',
    keywords: [...(config.keywords || [])],
    scopes: [...(config.scopes || ['comment', 'reply', 'dynamic'])],
    sensitivity: config.sensitivity || 'medium',
    mode: config.mode || 'keyword',
  };

  card.innerHTML = safeHTML(`
    <div class="cs-guide-card-header">
      <span class="cs-guide-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:20px;height:20px;flex-shrink:0"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg></span>
      <span class="cs-guide-card-title">配置「${escapeHtml(currentConfig.topicLabel)}」过滤</span>
    </div>

    <div class="cs-guide-field" data-field="topicLabel">
      <label class="cs-guide-field-label">话题名</label>
      <input class="cs-guide-input" type="text" value="${escapeHtml(currentConfig.topicLabel)}" data-original="${escapeHtml(currentConfig.topicLabel)}">
    </div>

    <div class="cs-guide-field" data-field="category">
      <label class="cs-guide-field-label">分类 <span class="cs-guide-field-tag">单选</span></label>
      <div class="cs-guide-options cs-guide-options--single">
        ${Object.entries(categoryLabels).map(([id, label]) => `
          <button class="cs-guide-option ${id === currentConfig.category ? 'cs-guide-option--active' : ''}" data-value="${id}">${label}</button>
        `).join('')}
      </div>
    </div>

    <div class="cs-guide-field" data-field="keywords">
      <label class="cs-guide-field-label">关键词 <span class="cs-guide-field-tag">可编辑</span></label>
      <div class="cs-guide-keywords">
        ${currentConfig.keywords.map(kw => `
          <span class="cs-guide-keyword">
            ${escapeHtml(kw)}
            <button class="cs-guide-keyword-remove" data-keyword="${escapeHtml(kw)}">×</button>
          </span>
        `).join('')}
        <input class="cs-guide-keyword-input" type="text" placeholder="+ 添加关键词">
      </div>
    </div>

    <div class="cs-guide-field" data-field="scopes">
      <label class="cs-guide-field-label">过滤范围 <span class="cs-guide-field-tag">多选</span></label>
      <div class="cs-guide-options cs-guide-options--multi">
        ${Object.entries(scopeLabels).map(([id, label]) => `
          <button class="cs-guide-option cs-guide-option--checkbox ${currentConfig.scopes.includes(id) ? 'cs-guide-option--active' : ''}" data-value="${id}">
            <span class="cs-guide-checkbox">${currentConfig.scopes.includes(id) ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M20 6 9 17l-5-5"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:14px;height:14px"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>'}</span>
            ${label}
          </button>
        `).join('')}
      </div>
    </div>

    <div class="cs-guide-field" data-field="sensitivity">
      <label class="cs-guide-field-label">敏感度 <span class="cs-guide-field-tag">单选</span></label>
      <div class="cs-guide-options cs-guide-options--single">
        ${Object.entries(sensitivityLabels).map(([id, label]) => `
          <button class="cs-guide-option ${id === currentConfig.sensitivity ? 'cs-guide-option--active' : ''}" data-value="${id}">${label}</button>
        `).join('')}
      </div>
    </div>

    <div class="cs-guide-field" data-field="mode">
      <label class="cs-guide-field-label">检测模式 <span class="cs-guide-field-tag">单选</span></label>
      <div class="cs-guide-options cs-guide-options--single">
        <button class="cs-guide-option ${currentConfig.mode === 'keyword' ? 'cs-guide-option--active' : ''}" data-value="keyword">关键词模式</button>
        <button class="cs-guide-option ${currentConfig.mode === 'semantic' ? 'cs-guide-option--active' : ''}" data-value="semantic">语义模式(AI)</button>
      </div>
    </div>

    <div class="cs-guide-card-actions">
      <button class="cs-guide-btn cs-guide-btn-primary" data-action="confirm"><span style="display:inline-flex;align-items:center;gap:5px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M20 6 9 17l-5-5"/></svg>确认创建</span></button>
      <button class="cs-guide-btn cs-guide-btn-secondary" data-action="cancel"><span style="display:inline-flex;align-items:center;gap:5px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:14px;height:14px;flex-shrink:0"><path d="M18 6 6 18M6 6l12 12"/></svg>取消</span></button>
    </div>
  `);

  // 分类单选
  card.querySelector('[data-field="category"] .cs-guide-options').addEventListener('click', (e) => {
    const btn = e.target.closest('.cs-guide-option');
    if (!btn) return;
    card.querySelectorAll('[data-field="category"] .cs-guide-option').forEach(b => b.classList.remove('cs-guide-option--active'));
    btn.classList.add('cs-guide-option--active');
    currentConfig.category = btn.dataset.value;
  });

  // 关键词删除
  card.querySelector('[data-field="keywords"] .cs-guide-keywords').addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.cs-guide-keyword-remove');
    if (!removeBtn) return;
    const kw = removeBtn.dataset.keyword;
    currentConfig.keywords = currentConfig.keywords.filter(k => k !== kw);
    removeBtn.closest('.cs-guide-keyword').remove();
  });

  // 关键词添加
  const keywordInput = card.querySelector('.cs-guide-keyword-input');
  keywordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && keywordInput.value.trim()) {
      const newKw = keywordInput.value.trim();
      if (!currentConfig.keywords.includes(newKw)) {
        currentConfig.keywords.push(newKw);
        const kwEl = document.createElement('span');
        kwEl.className = 'cs-guide-keyword';
        kwEl.innerHTML = safeHTML(`${escapeHtml(newKw)} <button class="cs-guide-keyword-remove" data-keyword="${escapeHtml(newKw)}">×</button>`);
        keywordInput.before(kwEl);
      }
      keywordInput.value = '';
    }
  });

  // 范围多选
  card.querySelector('[data-field="scopes"] .cs-guide-options').addEventListener('click', (e) => {
    const btn = e.target.closest('.cs-guide-option');
    if (!btn) return;
    const value = btn.dataset.value;
    btn.classList.toggle('cs-guide-option--active');
    const checkbox = btn.querySelector('.cs-guide-checkbox');
    if (btn.classList.contains('cs-guide-option--active')) {
      if (!currentConfig.scopes.includes(value)) currentConfig.scopes.push(value);
      checkbox.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M20 6 9 17l-5-5"/></svg>';
    } else {
      currentConfig.scopes = currentConfig.scopes.filter(s => s !== value);
      checkbox.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:14px;height:14px"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>';
    }
  });

  // 敏感度单选
  card.querySelector('[data-field="sensitivity"] .cs-guide-options').addEventListener('click', (e) => {
    const btn = e.target.closest('.cs-guide-option');
    if (!btn) return;
    card.querySelectorAll('[data-field="sensitivity"] .cs-guide-option').forEach(b => b.classList.remove('cs-guide-option--active'));
    btn.classList.add('cs-guide-option--active');
    currentConfig.sensitivity = btn.dataset.value;
  });

  // 模式单选
  card.querySelector('[data-field="mode"] .cs-guide-options').addEventListener('click', (e) => {
    const btn = e.target.closest('.cs-guide-option');
    if (!btn) return;
    card.querySelectorAll('[data-field="mode"] .cs-guide-option').forEach(b => b.classList.remove('cs-guide-option--active'));
    btn.classList.add('cs-guide-option--active');
    currentConfig.mode = btn.dataset.value;
  });

  // 确认创建
  card.querySelector('[data-action="confirm"]')?.addEventListener('click', async () => {
    card.style.opacity = '0.5';
    card.style.pointerEvents = 'none';

    // 更新 topicLabel
    currentConfig.topicLabel = card.querySelector('[data-field="topicLabel"] input').value.trim() || currentConfig.topicLabel;

    const engine = panel._agentEngine;
    if (!engine) { addAgentMsg('ai', '引擎不可用'); return; }

    try {
      const result = await engine.confirmCurrent?.();
      if (result) {
        renderAIAction(result, addAgentMsg, container, agentSendMsg, panel);
      }
      panel._refreshTopics?.();
    } catch (err) {
      addAgentMsg('ai', `创建失败：${err.message}`);
      panel.showToast?.('创建失败', 'error');
    }
  });

  // 取消
  card.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
    card.remove();
    const engine = panel._agentEngine;
    if (engine?.cancelCurrent) {
      const result = engine.cancelCurrent();
      if (result) renderAIAction(result, addAgentMsg, container, agentSendMsg, panel);
    }
    panel.showToast?.('已取消', 'info');
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'cs-chat-msg-ai';
  wrapper.appendChild(card);

  if (interaction.message) {
    addAgentMsg('ai', formatMarkdown(escapeHtml(interaction.message)));
  }

  agentMsgs.appendChild(wrapper);
  agentMsgs.scrollTop = agentMsgs.scrollHeight;

  if (!panel._agentHistoryLoaded) {
    if (!panel._agentHistory) panel._agentHistory = [];
    panel._agentHistory.push({ role: 'ai', text: '', aiText: `配置引导: ${currentConfig.topicLabel}`, html: `配置引导: ${currentConfig.topicLabel}`, timestamp: Date.now() });
  }
}

/**
 * 渲染 guide_compound interaction（复合计划卡片）
 * 多意图时展示合并操作计划，用户一次确认全部执行
 */
export function renderGuideCompoundInteraction(interaction, agentMsgs, addAgentMsg, container, agentSendMsg, panel) {
  const steps = interaction.steps || [];
  const card = document.createElement('div');
  card.className = 'cs-guide-card cs-guide-card--compound';

  const actionIcons = { rollback: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:14px;height:14px;flex-shrink:0"><path d="M18 6 6 18M6 6l12 12"/></svg>', create: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M20 6 9 17l-5-5"/></svg>', delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:14px;height:14px;flex-shrink:0"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>', disable: '<svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;flex-shrink:0"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>', enable: '<svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;flex-shrink:0"><path d="M5 3l14 9-14 9V3Z"/></svg>' };
  const actionLabels = { rollback: '撤销', create: '创建', delete: '删除', disable: '禁用', enable: '启用' };

  card.innerHTML = safeHTML(`
    <div class="cs-guide-card-header">
      <span class="cs-guide-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:20px;height:20px;flex-shrink:0"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg></span>
      <span class="cs-guide-card-title">操作计划（${steps.length} 步）</span>
    </div>
    <div class="cs-guide-steps">
      ${steps.map((step, i) => {
    const icon = actionIcons[step.action] || '•';
    const actionLabel = actionLabels[step.action] || step.action;
    const cfg = step.config || {};
    const scopeLabels = { comment: '评论', reply: '回复', dynamic: '动态', feed: '首页推荐', timeline: '时间线' };
    const detail = step.action === 'create'
      ? `<div class="cs-guide-step-detail">
              ${cfg.category ? `<span>分类：${cfg.category}</span>` : ''}
              ${cfg.keywords?.length ? `<span>关键词：${cfg.keywords.join('、')}</span>` : ''}
              ${cfg.scopes?.length ? `<span>范围：${cfg.scopes.map(s => scopeLabels[s] || s).join('、')}</span>` : ''}
              ${cfg.sensitivity ? `<span>敏感度：${cfg.sensitivity}</span>` : ''}
            </div>` : '';
    return `
          <div class="cs-guide-step">
            <div class="cs-guide-step-header">
              <span class="cs-guide-step-index">Step ${i + 1}</span>
              <span class="cs-guide-step-icon">${icon}</span>
              <span class="cs-guide-step-action">${actionLabel}「${escapeHtml(step.topicLabel || '')}」</span>
            </div>
            ${detail}
          </div>
        `;
  }).join('')}
    </div>
    <div class="cs-guide-card-actions">
      <button class="cs-guide-btn cs-guide-btn-primary" data-action="execute"><span style="display:inline-flex;align-items:center;gap:5px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M20 6 9 17l-5-5"/></svg>全部执行</span></button>
      <button class="cs-guide-btn cs-guide-btn-secondary" data-action="cancel"><span style="display:inline-flex;align-items:center;gap:5px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:14px;height:14px;flex-shrink:0"><path d="M18 6 6 18M6 6l12 12"/></svg>取消</span></button>
    </div>
  `);

  // 全部执行
  card.querySelector('[data-action="execute"]')?.addEventListener('click', async () => {
    card.style.opacity = '0.5';
    card.style.pointerEvents = 'none';

    const engine = panel._agentEngine;
    if (!engine) { addAgentMsg('ai', '引擎不可用'); return; }

    try {
      const result = await engine.confirmCurrent?.();
      if (result) {
        renderAIAction(result, addAgentMsg, container, agentSendMsg, panel);
      }
      panel._refreshTopics?.();
    } catch (err) {
      addAgentMsg('ai', `执行失败：${err.message}`);
      panel.showToast?.('执行失败', 'error');
    }
  });

  // 取消
  card.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
    card.remove();
    const engine = panel._agentEngine;
    if (engine?.cancelCurrent) {
      const result = engine.cancelCurrent();
      if (result) renderAIAction(result, addAgentMsg, container, agentSendMsg, panel);
    }
    panel.showToast?.('已取消', 'info');
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'cs-chat-msg-ai';
  wrapper.appendChild(card);

  if (interaction.message) {
    addAgentMsg('ai', formatMarkdown(escapeHtml(interaction.message)));
  }

  agentMsgs.appendChild(wrapper);
  agentMsgs.scrollTop = agentMsgs.scrollHeight;

  if (!panel._agentHistoryLoaded) {
    if (!panel._agentHistory) panel._agentHistory = [];
    panel._agentHistory.push({ role: 'ai', text: '', aiText: `复合计划(${steps.length}步)`, html: `复合计划(${steps.length}步)`, timestamp: Date.now() });
  }
}

/**
 * 渲染 recommend interaction（统一 schema）
 */
export function renderRecommendInteraction(interaction, agentMsgs, addAgentMsg, container, agentSendMsg, panel) {
  const card = document.createElement('div');
  card.className = 'cs-interactive-card';

  const optionsHtml = (interaction.options || []).map((opt, i) => {
    const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.value || '');
    const optValue = typeof opt === 'string' ? opt : (opt.value || optLabel);
    return `<button class="cs-option-chip" data-opt-idx="${i}" data-opt-value="${escapeHtml(optValue)}">${escapeHtml(optLabel)}</button>`;
  }).join('');

  card.innerHTML = safeHTML(`
    <div class="cs-interactive-card-header">
      <span class="cs-interactive-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;flex-shrink:0"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.6 1 1.5 1 2.3v1h6v-1c0-.8.4-1.7 1-2.3A7 7 0 0 0 12 2Z"/></svg></span>
      <span>推荐</span>
    </div>
    <div class="cs-interactive-card-body">
      ${interaction.message ? `<div style="font-size:13px;margin-bottom:8px">${formatMarkdown(escapeHtml(interaction.message))}</div>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:6px">${optionsHtml}</div>
    </div>
  `);

  card.querySelectorAll('.cs-option-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      card.querySelectorAll('.cs-option-chip').forEach(c => c.classList.remove('cs-option-selected'));
      chip.classList.add('cs-option-selected');
      chip.innerHTML = `<span class="cs-option-chip-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M20 6 9 17l-5-5"/></svg></span> ${chip.textContent}`;
      setTimeout(() => {
        card.style.opacity = '0.5';
        card.style.pointerEvents = 'none';
        // 推荐选项点击 — 携带结构化 intent
        agentSendMsg(chip.dataset.optValue, { resolvedAction: 'CREATE', clarificationAnswer: chip.dataset.optValue });
      }, 300);
    });
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'cs-chat-msg-ai';
  wrapper.appendChild(card);
  agentMsgs.appendChild(wrapper);
  agentMsgs.scrollTop = agentMsgs.scrollHeight;
}

/**
 * 渲染 result interaction（统一 schema）
 */
export function renderResultInteraction(interaction, agentMsgs, addAgentMsg, panel) {
  const steps = interaction.steps || [];
  const successCount = steps.filter(s => s.success).length;
  const allSuccess = successCount === steps.length;

  const card = document.createElement('div');
  card.className = 'cs-interactive-card';
  card.innerHTML = safeHTML(`
    <div class="cs-interactive-card-header">
      <span class="cs-interactive-card-icon">${allSuccess ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;flex-shrink:0"><path d="M20 6 9 17l-5-5"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;flex-shrink:0"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg>'}</span>
      <span>${allSuccess ? '操作完成' : '部分操作失败'}</span>
    </div>
    <div class="cs-interactive-card-body">
      <div class="cs-progress-steps">
        ${steps.map(s => `
          <div class="cs-progress-step cs-step-done">
            <span class="cs-progress-step-icon">${s.success ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M20 6 9 17l-5-5"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:14px;height:14px;flex-shrink:0"><path d="M18 6 6 18M6 6l12 12"/></svg>'}</span>
            <span class="cs-progress-step-text">${escapeHtml(s.tool || '')}${s.detail ? ` → ${escapeHtml(typeof s.detail === 'string' ? s.detail : JSON.stringify(s.detail)).slice(0, 100)}` : ''}</span>
          </div>
        `).join('')}
      </div>
      ${interaction.message ? `<div style="margin-top:8px;font-size:12px;color:var(--cs-text-secondary)">${formatMarkdown(escapeHtml(interaction.message))}</div>` : ''}
    </div>
    <div class="cs-interactive-card-footer">
      <button class="cs-confirm-btn cs-confirm-btn-secondary" data-action="undo-last">↶ 撤回</button>
      <button class="cs-confirm-btn cs-confirm-btn-secondary" data-action="go-settings"><span style="display:inline-flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>设置</span></button>
    </div>
  `);

  card.querySelector('[data-action="undo-last"]')?.addEventListener('click', async () => {
    if (!panel._agentEngine?.undoLast) { addAgentMsg('ai', '没有可撤销的操作'); return; }
    try {
      const result = panel._agentEngine.undoLast();
      const resolved = (result && typeof result.then === 'function') ? await result : result;
      addAgentMsg('ai', resolved?.summary || '已撤销');
      panel.showToast?.('已撤销', 'info');
      panel._refreshTopics?.();
    } catch (err) { addAgentMsg('ai', '撤销失败：' + err.message); }
  });
  card.querySelector('[data-action="go-settings"]')?.addEventListener('click', () => {
    const navBtn = panel._el?.querySelector('.cs-nav-item[data-section="ai"]');
    if (navBtn) navBtn.click();
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'cs-chat-msg-ai';
  wrapper.appendChild(card);
  agentMsgs.appendChild(wrapper);
  agentMsgs.scrollTop = agentMsgs.scrollHeight;
}

/**
 * 渲染确认卡片（高风险操作）
 */
export function renderConfirmCard(action, agentMsgs, addAgentMsg, container, agentSendMsg, panel, riskColors, riskLabels) {
  const color = riskColors[action.riskLevel] || '#6b7280';
  const label = riskLabels[action.riskLevel] || action.riskLevel;
  const isHighRisk = action.riskLevel === 'L3' || action.riskLevel === 'L4';

  const card = document.createElement('div');
  card.className = 'cs-confirm-card';
  if (isHighRisk) card.style.borderColor = 'var(--cs-danger)';

  card.innerHTML = safeHTML(`
    <div class="cs-confirm-card-title">
      <span style="display:inline-block;font-size:9px;font-weight:600;padding:1px 6px;border-radius:4px;background:${color};color:#fff">${escapeHtml(label)}</span>
      ${t('agentActionExecute')}
    </div>
    <div class="cs-confirm-card-detail">
      ${action.plan.map((s, i) => `<div>步骤 ${i+1}: <code>${escapeHtml(s.label || s.action)}</code></div>`).join('')}
    </div>
    <div class="cs-confirm-card-actions">
      <button class="cs-confirm-btn ${isHighRisk ? 'cs-confirm-btn-danger' : 'cs-confirm-btn-primary'}" data-action="confirm">
        ${isHighRisk ? '<span style="display:inline-flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg>' + t('agentActionExecute') + '</span>' : t('agentActionExecute')}
      </button>
      <button class="cs-confirm-btn cs-confirm-btn-secondary" data-action="cancel">${t('agentActionCancel')}</button>
    </div>
  `);

  card.querySelector('[data-action="confirm"]')?.addEventListener('click', async () => {
    card.remove();
    const result = await panel._agentEngine?.confirmCurrent?.();
    if (result) renderAIAction(result, addAgentMsg, container, agentSendMsg, panel);
    panel._refreshTopics?.();
    panel.showToast?.(t('agentActionConfirmed'), 'success');
  });
  card.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
    card.remove();
    const result = panel._agentEngine?.cancelCurrent?.();
    if (result) renderAIAction(result, addAgentMsg, container, agentSendMsg, panel);
    panel.showToast?.(t('agentActionCancelled'), 'info');
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'cs-chat-msg-ai';
  wrapper.appendChild(card);
  agentMsgs.appendChild(wrapper);
  agentMsgs.scrollTop = agentMsgs.scrollHeight;
}

/**
 * 渲染澄清问题卡片（交互式选项）
 */
export function renderClarifyCards(action, agentMsgs, addAgentMsg, container, agentSendMsg, panel) {
  // 先显示 AI 的文字回复
  if (action.summary) {
    addAgentMsg('ai', escapeHtml(action.summary));
  }

  for (const q of action.clarificationQuestions) {
    const card = document.createElement('div');
    card.className = 'cs-interactive-card';
    card.innerHTML = safeHTML(`
      <div class="cs-interactive-card-header">
        <span class="cs-interactive-card-icon">❓</span>
        <span>${escapeHtml(q.text)}</span>
      </div>
      <div class="cs-interactive-card-body">
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${(q.options || []).map((opt, i) => `
            <button class="cs-option-chip" data-opt-idx="${i}" data-opt-value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</button>
          `).join('')}
        </div>
      </div>
    `);

    // 绑定选项点击
    card.querySelectorAll('.cs-option-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        // 选中效果
        card.querySelectorAll('.cs-option-chip').forEach(c => c.classList.remove('cs-option-selected'));
        chip.classList.add('cs-option-selected');
        chip.innerHTML = `<span class="cs-option-chip-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M20 6 9 17l-5-5"/></svg></span> ${chip.textContent}`;

        // 延迟执行
        setTimeout(async () => {
          card.style.opacity = '0.5';
          card.style.pointerEvents = 'none';
          const val = chip.dataset.optValue;
          const result = await panel._agentEngine?.getTaskOrchestrator?.().process(val, { clarificationAnswer: val });
          if (result) renderAIAction(result, addAgentMsg, container, agentSendMsg, panel);
        }, 300);
      });
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'cs-chat-msg-ai';
    wrapper.appendChild(card);
    agentMsgs.appendChild(wrapper);
  }
  agentMsgs.scrollTop = agentMsgs.scrollHeight;
}

/**
 * 渲染步骤进度卡片
 */
export function renderProgressCard(action, agentMsgs, addAgentMsg, panel) {
  const card = document.createElement('div');
  card.className = 'cs-interactive-card';
  card.innerHTML = safeHTML(`
    <div class="cs-interactive-card-header">
      <span class="cs-interactive-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:20px;height:20px;flex-shrink:0"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg></span>
      <span>执行进度</span>
    </div>
    <div class="cs-interactive-card-body">
      <div class="cs-progress-steps">
        ${action.plan.map((s, i) => `
          <div class="cs-progress-step cs-step-done">
            <span class="cs-progress-step-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M20 6 9 17l-5-5"/></svg></span>
            <span class="cs-progress-step-text">${escapeHtml(s.label || s.action)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `);

  const wrapper = document.createElement('div');
  wrapper.className = 'cs-chat-msg-ai';
  wrapper.appendChild(card);
  agentMsgs.appendChild(wrapper);
  agentMsgs.scrollTop = agentMsgs.scrollHeight;
}

/**
 * 渲染普通对话回复 — 只看 interaction.kind，前端绝不猜
 */
export function renderConversationReply(action, agentMsgs, addAgentMsg, container, agentSendMsg, panel, riskColors, riskLabels) {
  const text = action.summary || action.summaryForUser || '';
  if (!text) return;

  // 风险标签
  let badge = '';
  if (action.riskLevel && action.riskLevel !== 'L0') {
    const color = riskColors[action.riskLevel] || '#6b7280';
    const label = riskLabels[action.riskLevel] || action.riskLevel;
    badge = `<span style="display:inline-block;font-size:9px;font-weight:600;padding:1px 6px;border-radius:4px;background:${color};color:#fff;margin-right:4px;vertical-align:middle">${escapeHtml(label)}</span>`;
  }

  // 纯文本回复 — 不再解析交互意图，前端只渲染
  addAgentMsg('ai', badge + formatMarkdown(escapeHtml(text)));
}

/**
 * 追加操作按钮栏
 */
export function appendActionBar(agentMsgs, addAgentMsg, panel) {
  const actionBar = document.createElement('div');
  actionBar.className = 'cs-chat-action-bar';
  actionBar.style.cssText = 'display:flex;gap:6px;padding:2px 0 8px;margin-left:4px';

  const undoBtn = document.createElement('button');
  undoBtn.className = 'cs-btn-ghost';
  undoBtn.style.cssText = 'font-size:11px;padding:2px 8px;border-radius:6px;border:none;background:none;color:var(--cs-text-secondary);cursor:pointer;transition:color .15s ease';
  undoBtn.textContent = '↶ 撤回';
  undoBtn.addEventListener('mouseenter', () => { undoBtn.style.color = 'var(--cs-accent)'; });
  undoBtn.addEventListener('mouseleave', () => { undoBtn.style.color = 'var(--cs-text-secondary)'; });
  undoBtn.addEventListener('click', async () => {
    if (!panel._agentEngine?.undoLast) { addAgentMsg('ai', '没有可撤销的操作'); return; }
    try {
      const result = panel._agentEngine.undoLast();
      const resolved = (result && typeof result.then === 'function') ? await result : result;
      addAgentMsg('ai', resolved?.summary || '已撤销');
      panel.showToast?.('已撤销', 'info');
      panel._refreshTopics?.();
    } catch (err) { addAgentMsg('ai', '撤销失败：' + err.message); }
  });

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'cs-btn-ghost';
  settingsBtn.style.cssText = 'font-size:11px;padding:2px 8px;border-radius:6px;border:none;background:none;color:var(--cs-text-secondary);cursor:pointer;transition:color .15s ease';
  settingsBtn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>设置</span>';
  settingsBtn.addEventListener('mouseenter', () => { settingsBtn.style.color = 'var(--cs-accent)'; });
  settingsBtn.addEventListener('mouseleave', () => { settingsBtn.style.color = 'var(--cs-text-secondary)'; });
  settingsBtn.addEventListener('click', () => {
    const navBtn = panel._el?.querySelector('.cs-nav-item[data-section="ai"]');
    if (navBtn) navBtn.click();
  });

  actionBar.appendChild(undoBtn);
  actionBar.appendChild(settingsBtn);
  agentMsgs.appendChild(actionBar);
  agentMsgs.scrollTop = agentMsgs.scrollHeight;
}

/**
 * 更新 AI 状态指示器（AI 在线 / 正则模式 / 关键词模式）
 */
export function updateAIStatusIndicator(container, panel) {
  // container 是 DOM 元素，状态指示器在其内部的 .cs-chat-header 中
  const statusEl = container?.querySelector?.('.cs-chat-header-status')
    || document.querySelector('.cs-chat-header-status');
  if (!statusEl) return;

  const engine = panel?._agentEngine;
  if (!engine) {
    statusEl.textContent = t('agentKeywordMode');
    statusEl.style.background = 'var(--cs-bg-body)';
    statusEl.style.color = 'var(--cs-text-secondary)';
    return;
  }

  // AI 总开关关闭时显示"正则模式"
  const aiEnabled = panel._config?.aiEnabled !== false;
  if (!aiEnabled) {
    statusEl.textContent = '正则模式';
    statusEl.style.background = '#3b82f6';
    statusEl.style.color = '#fff';
    return;
  }

  const status = engine.getStatus?.();
  if (status?.llmDegraded) {
    statusEl.textContent = '正则模式';
    statusEl.style.background = '#3b82f6';
    statusEl.style.color = '#fff';
  } else if (status) {
    statusEl.textContent = 'AI 在线';
    statusEl.style.background = '';
    statusEl.style.color = '';
  }
}

/**
 * 渲染工具调用卡片 HTML
 */
export function renderToolCallCard(name, params, result, success) {
  const statusClass = success ? 'cs-tool-call-success' : 'cs-tool-call-fail';
  const statusIcon = success ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M20 6 9 17l-5-5"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:14px;height:14px;flex-shrink:0"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  const resultText = result || (success ? '成功' : '失败');
  return `<div class="cs-tool-call-card">
    <div class="cs-tool-call-header" onclick="this.parentElement.classList.toggle('cs-tool-call-collapsed')">
      <span class="cs-tool-call-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/></svg></span>
      <span class="cs-tool-call-name">${escapeHtml(name)}</span>
      <span class="cs-tool-call-status ${statusClass}">${statusIcon}</span>
      <span class="cs-tool-call-toggle"></span>
    </div>
    <div class="cs-tool-call-body">
      ${params ? `<div class="cs-tool-call-params"><span class="cs-tool-call-label">参数：</span><code>${escapeHtml(typeof params === 'string' ? params : JSON.stringify(params))}</code></div>` : ''}
      <div class="cs-tool-call-result"><span class="cs-tool-call-label">结果：</span><span>${escapeHtml(resultText)}</span></div>
    </div>
  </div>`;
}

/**
 * 渲染 v2 编排器返回的 AIAction 到聊天区域
 * 支持多种响应类型的交互式渲染
 */
export function renderAIAction(action, addAgentMsg, container, agentSendMsg, panel) {
  if (!action) return;

  // ★ 更新 AI 状态指示器（LLM 降级时变"正则模式"）
  updateAIStatusIndicator(container, panel);

  const agentMsgs = $el('cs-dash-agent-msgs', container);
  if (!agentMsgs) return;

  const riskColors = { L0: '#22c55e', L1: '#3b82f6', L2: '#f59e0b', L3: '#ef4444', L4: '#7c2d12' };
  const riskLabels = {
    L0: t('agentV2RiskL0'), L1: t('agentV2RiskL1'),
    L2: t('agentV2RiskL2'), L3: t('agentV2RiskL3'), L4: t('agentV2RiskL4'),
  };

  // ── 统一 interaction schema 分支 ──
  const interaction = action.interaction;

  if (interaction) {
    switch (interaction.kind) {
      case 'clarify':
        renderClarifyInteraction(interaction, agentMsgs, addAgentMsg, container, agentSendMsg, panel);
        return;
      case 'confirm':
        renderConfirmInteraction(interaction, action, agentMsgs, addAgentMsg, container, agentSendMsg, panel, riskColors, riskLabels);
        return;
      case 'confirm_create':
        renderConfirmCreateInteraction(interaction, agentMsgs, addAgentMsg, container, agentSendMsg, panel);
        return;
      case 'confirm_action':
        renderConfirmActionInteraction(interaction, agentMsgs, addAgentMsg, container, agentSendMsg, panel, riskColors, riskLabels);
        return;
      case 'confirm_hot_topic':
        renderConfirmHotTopicInteraction(interaction, agentMsgs, addAgentMsg, container, agentSendMsg, panel);
        return;
      case 'keyword_added': {
        const added = interaction.added || (interaction.keyword ? [interaction.keyword] : interaction.keywords || []);
        const skipped = interaction.skipped || [];
        const msgs = [];
        if (added.length) {
          msgs.push(added.length > 1
            ? `屏蔽词 ${added.length} 个已添加：${added.join('、')}`
            : `屏蔽词「${added[0]}」已添加`);
        }
        if (skipped.length) msgs.push(`${skipped.length} 个已存在被跳过：${skipped.join('、')}`);
        if (msgs.length) addAgentMsg('ai', msgs.join('\n'));
        panel._refreshTopics?.();
        return;
      }
      case 'guide_understand':
        renderGuideUnderstandInteraction(interaction, agentMsgs, addAgentMsg, container, agentSendMsg, panel);
        return;
      case 'guide_config':
        renderGuideConfigInteraction(interaction, agentMsgs, addAgentMsg, container, agentSendMsg, panel);
        return;
      case 'guide_compound':
        renderGuideCompoundInteraction(interaction, agentMsgs, addAgentMsg, container, agentSendMsg, panel);
        return;
      case 'recommend':
        renderRecommendInteraction(interaction, agentMsgs, addAgentMsg, container, agentSendMsg, panel);
        return;
      case 'result':
        renderResultInteraction(interaction, agentMsgs, addAgentMsg, panel);
        return;
      case 'message':
      default:
        renderConversationReply(action, agentMsgs, addAgentMsg, container, agentSendMsg, panel, riskColors, riskLabels);
        // ★ 执行完成后刷新面板（DONE 类型必有 refresh:true）
        if (action.refresh || action.type === 'DONE') panel._refreshTopics?.();
        return;
    }
  }

  // fallback: 无 interaction 字段时走旧逻辑
  if (action.toolResults?.length) {
    renderToolResultCard(action, agentMsgs, addAgentMsg, container, agentSendMsg, panel);
    return;
  }
  if (action.requiresConfirmation && action.plan?.length) {
    renderConfirmCard(action, agentMsgs, addAgentMsg, container, agentSendMsg, panel, riskColors, riskLabels);
    return;
  }
  if (action.needClarification && action.clarificationQuestions?.length) {
    renderClarifyCards(action, agentMsgs, addAgentMsg, container, agentSendMsg, panel);
    return;
  }
  renderConversationReply(action, agentMsgs, addAgentMsg, container, agentSendMsg, panel, riskColors, riskLabels);

  // ★ 关键：执行完成后刷新话题/热点/屏蔽词面板
  // _executePlan 返回 refresh:true，但 interaction.kind 是 'message'，需要这里处理
  if (action.refresh || action.type === 'DONE') {
    panel._refreshTopics?.();
  }
}

/**
 * 渲染工具执行结果卡片
 */
export function renderToolResultCard(action, agentMsgs, addAgentMsg, container, agentSendMsg, panel) {
  const results = action.toolResults;
  const successCount = results.filter(r => r.success).length;

  // 总结卡片
  const card = document.createElement('div');
  card.className = 'cs-interactive-card';
  const allSuccess = successCount === results.length;
  card.innerHTML = safeHTML(`
    <div class="cs-interactive-card-header">
      <span class="cs-interactive-card-icon">${allSuccess ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;flex-shrink:0"><path d="M20 6 9 17l-5-5"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;flex-shrink:0"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg>'}</span>
      <span>${allSuccess ? '操作完成' : '部分操作失败'}</span>
    </div>
    <div class="cs-interactive-card-body">
      <div class="cs-progress-steps">
        ${results.map(r => `
          <div class="cs-progress-step cs-step-done">
            <span class="cs-progress-step-icon">${r.success ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><path d="M20 6 9 17l-5-5"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:14px;height:14px;flex-shrink:0"><path d="M18 6 6 18M6 6l12 12"/></svg>'}</span>
            <span class="cs-progress-step-text">${escapeHtml(r.tool)}${r.result?.topicId ? ` → ${escapeHtml(r.result.topicId)}` : ''}${r.error ? `: ${escapeHtml(r.error)}` : ''}</span>
          </div>
        `).join('')}
      </div>
      ${action.summary ? `<div style="margin-top:8px;font-size:12px;color:var(--cs-text-secondary)">${escapeHtml(action.summary.replace(/已自动执行\s*\d+\s*个操作/g, '').trim())}</div>` : ''}
    </div>
    <div class="cs-interactive-card-footer">
      <button class="cs-confirm-btn cs-confirm-btn-secondary" data-action="undo-last">↶ 撤回</button>
      <button class="cs-confirm-btn cs-confirm-btn-secondary" data-action="go-settings"><span style="display:inline-flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>设置</span></button>
    </div>
  `);

  // 绑定按钮事件
  card.querySelector('[data-action="undo-last"]')?.addEventListener('click', async () => {
    if (!panel._agentEngine?.undoLast) { addAgentMsg('ai', '没有可撤销的操作'); return; }
    try {
      const result = panel._agentEngine.undoLast();
      const resolved = (result && typeof result.then === 'function') ? await result : result;
      addAgentMsg('ai', resolved?.summary || '已撤销');
      panel.showToast?.('已撤销', 'info');
      panel._refreshTopics?.();
    } catch (err) { addAgentMsg('ai', '撤销失败：' + err.message); }
  });
  card.querySelector('[data-action="go-settings"]')?.addEventListener('click', () => {
    const navBtn = panel._el?.querySelector('.cs-nav-item[data-section="ai"]');
    if (navBtn) navBtn.click();
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'cs-chat-msg-ai';
  wrapper.appendChild(card);
  agentMsgs.appendChild(wrapper);
  agentMsgs.scrollTop = agentMsgs.scrollHeight;

  // 记录到历史
  if (!panel._agentHistoryLoaded) {
    if (!panel._agentHistory) panel._agentHistory = [];
    panel._agentHistory.push({ role: 'ai', html: allSuccess ? '操作完成' : '部分操作失败' });
  }
}
