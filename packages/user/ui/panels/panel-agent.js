const HISTORY_KEY = 'cs_agent_chat_history';
const MAX_HISTORY = 20;
const BASE_PANEL_WIDTH = 920;

function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

function formatTime(date) {
  return `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')}`;
}

/** 根据侧面板开关状态动态调整 .cs-dash-panel 宽度 */
function _updatePanelWidth(dashPanel) {
  const historyPanel = dashPanel.querySelector('.cs-chat-history-panel');
  const debugPanel = dashPanel.querySelector('.cs-chat-debug-panel');
  const extraWidth = (historyPanel ? 260 : 0) + (debugPanel ? 300 : 0);
  if (extraWidth > 0) {
    dashPanel.style.width = (BASE_PANEL_WIDTH + extraWidth) + 'px';
  } else {
    // 无侧面板时清除 inline style，回退到 CSS 默认值
    dashPanel.style.width = '';
  }
}

/** 加载历史对话列表 */
function loadChatHistories() {
  try {
    return JSON.parse(GM_getValue(HISTORY_KEY, '[]'));
  } catch { return []; }
}

/** 保存历史对话列表 */
function saveChatHistories(histories) {
  GM_setValue(HISTORY_KEY, JSON.stringify(histories.slice(0, MAX_HISTORY)));
}

/** 从当前对话历史生成摘要 */
function summarizeHistory(agentHistory) {
  if (!agentHistory?.length) return '新对话';
  const first = agentHistory.find(m => m.role === 'user');
  if (!first) return '新对话';
  // 优先用 text 字段（结构化），fallback 到 HTML 去标签
  const text = first.text || (first.html ? first.html.replace(/<[^>]*>/g, '').trim() : '') || '';
  return text.length > 24 ? text.slice(0, 24) + '…' : text;
}

/**
 * panel-agent.js — AI 聊天面板界面（复刻设计）
 */
import { t, getLang } from '../../../core/i18n.js';
import { emit, Events, on as onEvent } from '../../../core/events.js';
import { safeHTML, escapeHtml, $el, delegate } from '../utils.js';
import {
  renderConfirmCreateInteraction,
  renderConfirmHotTopicInteraction,
  renderConfirmActionInteraction,
  renderClarifyInteraction,
  renderConfirmInteraction,
  renderGuideUnderstandInteraction,
  renderGuideConfigInteraction,
  renderGuideCompoundInteraction,
  renderRecommendInteraction,
  renderResultInteraction,
  renderConfirmCard,
  renderClarifyCards,
  renderProgressCard,
  renderConversationReply,
  appendActionBar,
  renderAIAction,
  updateAIStatusIndicator,
  renderToolCallCard,
  formatMarkdown,
} from './agent-interactions.js';

/**
 * 渲染 Claude 风格聊天界面
 * @param {object} panel Dashboard 实例
 * @returns {string} HTML
 */
export function renderAgentChat(panel, pendingPrompt = '') {
  const history = panel._agentHistory || [];
  const aiEnabled = panel._config?.aiEnabled !== false;
  const aiAvailable = aiEnabled && !!(panel._config?.apiKey || panel._scanner?.aiAnalyzer?.shouldAnalyze?.());
  panel._agentPendingPrompt = pendingPrompt;

  // 消息气泡
  const historyHtml = history.map(m => {
    if (m.role === 'user') {
      return `<div class="cs-chat-msg-user">
        <div class="cs-chat-avatar cs-chat-avatar-user">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
        <div class="cs-chat-bubble cs-chat-bubble-user">${m.html}</div>
      </div>`;
    }
    return `<div class="cs-chat-msg-ai">
      <div class="cs-chat-avatar cs-chat-avatar-ai">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z" fill="currentColor" opacity="0.15"/>
          <path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="cs-chat-bubble cs-chat-bubble-ai">${m.html}</div>
    </div>`;
  }).join('');

  // 欢迎建议区 — 水凝冰融主题（无SVG，纯文字+渐变）
  const welcomeHtml = history.length === 0 ? `
    <div class="cs-chat-welcome">
      <div class="cs-welcome-glow"></div>
      <h2 class="cs-welcome-title">CyberShield AI</h2>
      <p class="cs-welcome-tagline">${t('agentWelcomeTagline') || '智能内容守护'}</p>
      <p class="cs-welcome-desc">${t('agentWelcomeDesc') || '三层检测引擎 · 28 语言覆盖 · AI 自学习进化'}</p>
      <div class="cs-chat-welcome-suggestions">
        <button class="cs-suggestion-btn" data-action="quick-create-topic">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 9h4M10 15h4M4 12h12"/></svg>
          ${t('agentQuickCreateTopic') || '创建话题'}
        </button>
        <button class="cs-suggestion-btn" data-action="quick-create-keyword">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M13.828 9c.484 0 .948.214 1.264.586l3.829 3.829a1.5 1.5 0 0 1 0 2.122l-2.121 2.121a1.5 1.5 0 0 1-2.122 0l-3.828-3.829A1.5 1.5 0 0 1 6 10.828V5.5a1.5 1.5 0 0 1 1.5-1.5h4.328c.484 0 .948.214 1.264.586l.016.016z"/></svg>
          ${t('agentQuickCreateKeyword') || '添加关键词'}
        </button>
        <button class="cs-suggestion-btn" data-action="quick-create-hot-topic">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.374 4.89a4 4 0 0 0-5.759 0L2.29 9.71a3.963 3.963 0 0 0 0 5.618l3.046 3.046a4 4 0 0 0 5.759 0l3.85-3.85a3.963 3.963 0 0 0 0-5.618l-3.046-4.82z"/></svg>
          ${t('navHotTopics') || '热点话题'}
        </button>
        <button class="cs-suggestion-btn" data-action="quick-capabilities">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          ${t('agentLearnMore') || '了解能力'}
        </button>
      </div>
    </div>` : '';

  // 不再需要单独的quick-area，快捷按钮已整合到welcome里
  const quickAreaHtml = '';

  const html = `
    <div class="cs-chat-container">
      <div class="cs-chat-header">
        <div class="cs-chat-header-left">
          <button class="cs-chat-history-toggle" data-action="history" title="${t('chatHistory')}" aria-label="${t('chatHistory')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          </button>
          <div class="cs-chat-header-brand">
            <div class="cs-chat-header-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z" fill="currentColor" opacity="0.15"/>
                <path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="cs-chat-header-info">
              <span class="cs-chat-header-title">CyberShield AI</span>
            </div>
          </div>
        </div>
        <div class="cs-chat-header-right">
          <div class="cs-chat-header-status">
            <span class="cs-chat-status-dot ${aiAvailable ? 'cs-online' : 'cs-offline'}"></span>
            <span class="cs-chat-status-text">${aiAvailable ? (t('agentOnline') || 'AI 在线') : (t('agentOffline') || 'AI 离线')}</span>
          </div>
          <button class="cs-chat-header-btn" data-action="newchat" title="${t('chatNewChat')}" aria-label="${t('chatNewChat')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
          <button class="cs-chat-header-btn" data-action="theme" title="${t('chatThemeToggle') || '主题切换'}" aria-label="${t('chatThemeToggle') || '主题切换'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          </button>
          <button class="cs-chat-header-btn cs-chat-close-btn" data-action="close" title="${t('chatClose')}" aria-label="${t('chatClose')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      <svg style="display:none" aria-hidden="true">
        <symbol id="glyph-thinking" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
          <path d="M10 2 A8 8 0 0 1 18 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <circle cx="10" cy="10" r="2" fill="currentColor"/>
        </symbol>
        <symbol id="glyph-tool" viewBox="0 0 16 16">
          <rect x="2" y="8" width="2.5" height="7" rx="1" fill="currentColor"/>
          <rect x="6.5" y="4" width="2.5" height="11" rx="1" fill="currentColor"/>
          <rect x="11" y="6" width="2.5" height="9" rx="1" fill="currentColor"/>
        </symbol>
        <symbol id="glyph-done" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="8" cy="8" r="2" fill="currentColor"/>
        </symbol>
        <symbol id="glyph-fail" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
          <line x1="5" y1="5" x2="11" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </symbol>
        <symbol id="glyph-warning" viewBox="0 0 16 16">
          <path d="M8 1 L9.5 6 L15 6 L10.5 9.5 L12 15 L8 11.5 L4 15 L5.5 9.5 L1 6 L6.5 6 Z" fill="none" stroke="currentColor" stroke-width="1.2"/>
        </symbol>
        <symbol id="glyph-regex" viewBox="0 0 16 16">
          <path d="M1 8 Q4 3 7 8 Q10 13 13 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </symbol>
      </svg>
      <div class="cs-chat-messages" id="cs-dash-agent-msgs">
        ${welcomeHtml}
        ${historyHtml}
      </div>
      ${quickAreaHtml}
      <div class="cs-chat-input-area">
        <div class="cs-chat-input-wrap">
          <div class="cs-chat-input-wrapper">
            <div class="cs-chat-input" id="cs-dash-agent-input" contenteditable="true" data-placeholder="${t('agentPlaceholder') || '输入消息...'}" lang="zh-CN" role="textbox" aria-multiline="true"></div>
          </div>
          <div class="cs-chat-input-actions">
            <button class="cs-chat-add-btn" id="cs-agent-add-btn" title="${t('agentQuickActions') || '快捷操作'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            <button class="cs-send-pause-btn cs-idle" id="cs-agent-send-pause" title="${t('agentSend') || '发送'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
            </button>
          </div>
        </div>
        <div class="cs-chat-input-hint">
          <span>${t('agentHint') || '按 Enter 发送，Shift + Enter 换行'}</span>
        </div>
      </div>
    </div>`;
  return html;
}

/**
 * 绑定 Claude 风格聊天界面事件
 * @param {HTMLElement} container 容器
 * @param {object} panel Dashboard 实例
 */
export function bindAgentEvents(container, panel) {
  const agentInput = $el('cs-dash-agent-input', container);
  const agentMsgs = $el('cs-dash-agent-msgs', container);
  const engine = panel._agentEngine;

  // 更新主题切换图标（需在调用前定义）
  function _updateThemeIcon(container, isDark) {
    const themeBtn = container.querySelector('[data-action="theme"]');
    if (!themeBtn) return;
    if (isDark) {
      themeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
      themeBtn.title = t('chatThemeLight') || '切换到浅色模式';
    } else {
      themeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
      themeBtn.title = t('chatThemeDark') || '切换到深色模式';
    }
  }

  // 加载保存的主题偏好，默认深色
  try {
    const savedTheme = GM_getValue('cs_agent_theme', 'dark');
    const dash = panel._el;
    if (dash) {
      dash.classList.remove('cs-theme-light', 'cs-theme-dark');
      dash.classList.add(savedTheme === 'dark' ? 'cs-theme-dark' : 'cs-theme-light');
      _updateThemeIcon(container, savedTheme === 'dark');
    }
  } catch (e) { /* ignore */ }

  // 待发送 prompt：从日志面板 "AI 分析" 跳转过来的
  if (panel._agentPendingPrompt && agentInput) {
    const pending = panel._agentPendingPrompt;
    panel._agentPendingPrompt = '';
    agentInput.textContent = pending; agentInput.innerHTML = ''; agentInput.textContent = pending;
    setTimeout(() => agentSendMsg(pending), 30);
  }

  // ★ 给已存在的历史消息（从 HTML 渲染的）补齐操作按钮 — 修复切页后按钮消失
  if (agentMsgs) {
    const existingWrappers = agentMsgs.querySelectorAll('.cs-chat-msg-user, .cs-chat-msg-ai');
    existingWrappers.forEach(wrapper => {
      if (wrapper.querySelector('.cs-msg-actions')) return;
      const bubble = wrapper.querySelector('.cs-chat-bubble');
      if (!bubble) return;
      const role = wrapper.classList.contains('cs-chat-msg-user') ? 'user' : 'ai';
      const html = bubble.innerHTML;
      const actions = document.createElement('div');
      actions.className = 'cs-msg-actions';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'cs-msg-action-btn';
      copyBtn.title = '复制';
      copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const text = bubble.textContent || '';
        try {
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
          else document.execCommand('copy');
          copyBtn.classList.add('cs-copied');
          setTimeout(() => { copyBtn.classList.remove('cs-copied'); }, 1500);
          panel.showToast?.('已复制到剪贴板', 'success');
        } catch (err) {
          panel.showToast?.('复制失败: ' + err.message, 'error');
        }
      });
      actions.appendChild(copyBtn);

      if (role === 'user') {
        const editBtn = document.createElement('button');
        editBtn.className = 'cs-msg-action-btn';
        editBtn.title = '编辑';
        editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>';
        editBtn.addEventListener('click', (e) => { e.stopPropagation(); _enterEditMode(wrapper, bubble, html); });
        actions.appendChild(editBtn);
        const resendBtn = document.createElement('button');
        resendBtn.className = 'cs-msg-action-btn';
        resendBtn.title = '重新生成';
        resendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>';
        resendBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          agentSendMsg(bubble.textContent || '');
        });
        actions.appendChild(resendBtn);
      } else {
        const undoBtn = document.createElement('button');
        undoBtn.className = 'cs-msg-action-btn';
        undoBtn.title = '撤回';
        undoBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.7 2.3L3 13"/></svg>';
        undoBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (undoBtn.disabled) return;
          if (!engine?.undoLast) { panel.showToast?.('没有可撤销的操作', 'warn'); return; }
          undoBtn.disabled = true;
          undoBtn.style.opacity = '0.5';
          try {
            const result = engine.undoLast();
            const resolved = (result && typeof result.then === 'function') ? await result : result;
            panel.showToast?.('已撤销', 'info');
            panel._refreshTopics?.();
          } catch (err) { 
            panel.showToast?.('撤销失败：' + err.message, 'error'); 
            undoBtn.disabled = false;
            undoBtn.style.opacity = '';
          }
        });
        actions.appendChild(undoBtn);
        const regenBtn = document.createElement('button');
        regenBtn.className = 'cs-msg-action-btn';
        regenBtn.title = '重新生成';
        regenBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>';
        regenBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const prevUser = wrapper.previousElementSibling?.classList?.contains('cs-chat-msg-user')
            ? wrapper.previousElementSibling.querySelector('.cs-chat-bubble')
            : null;
          if (prevUser) { wrapper.remove(); agentSendMsg(prevUser.textContent || ''); }
        });
        actions.appendChild(regenBtn);
      }
      wrapper.appendChild(actions);
    });
  }

  // 监听配置变更，实时更新 AI 状态指示器
  if (!panel._aiStatusListener) {
    panel._aiStatusListener = (data) => {
      if (data?.type === 'ai') {
        updateAIStatusIndicator(container, panel);
      }
    };
    onEvent(Events.CONFIG_UPDATED, panel._aiStatusListener);
  }

  // 标记：如果 _agentHistory 已有消息（从历史加载），后续 addAgentMsg 不再重复 push
  panel._agentHistoryLoaded = (panel._agentHistory?.length || 0) > 0;
  // 延迟清除标记，让已有消息的渲染完成后新消息正常记录
  setTimeout(() => { panel._agentHistoryLoaded = false; }, 100);

  // contenteditable 自动增高 + 纯文本粘贴
  if (agentInput) {
    agentInput.addEventListener('input', () => {
      agentInput.style.height = 'auto';
      agentInput.style.height = Math.min(agentInput.scrollHeight, 120) + 'px';
    });
    // 纯文本粘贴（防止富文本污染）
    agentInput.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });
    // 保持 placeholder 在空内容时显示
    agentInput.addEventListener('input', () => {
      if (agentInput.textContent.length === 0) {
        agentInput.innerHTML = '';
      }
    });
  }

  const addAgentMsg = (role, html, skipHistory) => {
    if (!agentMsgs) return;
    if (!skipHistory && !panel._agentHistoryLoaded) {
      if (!panel._agentHistory) panel._agentHistory = [];
      // 存结构化数据而非 HTML，历史回放时可重建交互
      panel._agentHistory.push({
        role,
        text: role === 'user' ? html : '',
        aiText: role === 'ai' ? (typeof html === 'string' ? html.replace(/<[^>]*>/g, '').trim() : '') : '',
        html,
        timestamp: Date.now(),
      });
    }

    // 移除欢迎页
    const welcome = agentMsgs.querySelector('.cs-chat-welcome');
    if (welcome) welcome.remove();

    const wrapper = document.createElement('div');
    wrapper.className = role === 'user' ? 'cs-chat-msg-user' : 'cs-chat-msg-ai';
    const bubble = document.createElement('div');
    bubble.className = role === 'user' ? 'cs-chat-bubble cs-chat-bubble-user' : 'cs-chat-bubble cs-chat-bubble-ai';
    bubble.innerHTML = safeHTML(html);
    wrapper.appendChild(bubble);

    // ChatGPT 风格轻量悬浮工具栏（hover 浮现，位于消息气泡下方）
    const actions = document.createElement('div');
    actions.className = 'cs-msg-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'cs-msg-action-btn';
    copyBtn.title = '复制';
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const text = bubble.textContent || '';
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
        else document.execCommand('copy');
        copyBtn.classList.add('cs-copied');
        setTimeout(() => { copyBtn.classList.remove('cs-copied'); }, 1500);
        panel.showToast?.('已复制到剪贴板', 'success');
      } catch (err) {
        panel.showToast?.('复制失败: ' + err.message, 'error');
      }
    });
    actions.appendChild(copyBtn);

    if (role === 'user') {
      const editBtn = document.createElement('button');
      editBtn.className = 'cs-msg-action-btn';
      editBtn.title = '编辑';
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>';
      editBtn.addEventListener('click', (e) => { e.stopPropagation(); _enterEditMode(wrapper, bubble, html); });
      actions.appendChild(editBtn);

      const resendBtn = document.createElement('button');
      resendBtn.className = 'cs-msg-action-btn';
      resendBtn.title = '重新生成';
      resendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>';
      resendBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const lastAI = agentMsgs.querySelector('.cs-chat-msg-ai:last-of-type');
        if (lastAI) lastAI.remove();
        agentSendMsg(bubble.textContent || '');
      });
      actions.appendChild(resendBtn);
    } else {
      const undoBtn = document.createElement('button');
      undoBtn.className = 'cs-msg-action-btn';
      undoBtn.title = '撤回';
      undoBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.7 2.3L3 13"/></svg>';
      undoBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (undoBtn.disabled) return;
        if (!engine?.undoLast) { panel.showToast?.('没有可撤销的操作', 'warn'); return; }
        undoBtn.disabled = true;
        undoBtn.style.opacity = '0.5';
        try {
          const result = engine.undoLast();
          const resolved = (result && typeof result.then === 'function') ? await result : result;
          addAgentMsg('ai', resolved?.summary || '已撤销');
          panel.showToast?.('已撤销', 'info');
          panel._refreshTopics?.();
        } catch (err) { 
          addAgentMsg('ai', '撤销失败：' + err.message); 
          undoBtn.disabled = false;
          undoBtn.style.opacity = '';
        }
      });
      actions.appendChild(undoBtn);

      const regenBtn = document.createElement('button');
      regenBtn.className = 'cs-msg-action-btn';
      regenBtn.title = '重新生成';
      regenBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>';
      regenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const prevUser = wrapper.previousElementSibling?.classList?.contains('cs-chat-msg-user')
          ? wrapper.previousElementSibling.querySelector('.cs-chat-bubble')
          : null;
        if (prevUser) { wrapper.remove(); agentSendMsg(prevUser.textContent || ''); }
      });
      actions.appendChild(regenBtn);
    }

    wrapper.appendChild(bubble);
    wrapper.appendChild(actions);
    agentMsgs.appendChild(wrapper);
    agentMsgs.scrollTop = agentMsgs.scrollHeight;
    // ★ 自动保存
    if (!skipHistory) _autoSave();
  };

  // ★ 进入消息编辑模式（用户消息重发）
  function _enterEditMode(wrapper, bubble, originalHtml) {
    const originalText = bubble.textContent || '';

    const editArea = document.createElement('textarea');
    editArea.className = 'cs-chat-edit-area';
    editArea.value = originalText;
    editArea.rows = Math.min(originalText.split('\n').length + 1, 8);

    const actions = document.createElement('div');
    actions.className = 'cs-chat-edit-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'cs-chat-edit-btn cs-chat-edit-confirm';
    confirmBtn.textContent = '重新发送';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cs-chat-edit-btn cs-chat-edit-cancel';
    cancelBtn.textContent = '取消';

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    const originalContent = bubble.innerHTML;
    bubble.innerHTML = '';
    bubble.appendChild(editArea);
    bubble.appendChild(actions);
    editArea.focus();
    editArea.setSelectionRange(editArea.value.length, editArea.value.length);

    confirmBtn.addEventListener('click', () => {
      const newText = editArea.value.trim();
      if (!newText || newText === originalText) {
        bubble.innerHTML = safeHTML(originalContent);
        return;
      }
      let next = wrapper.nextElementSibling;
      while (next) {
        const toRemove = next;
        next = next.nextElementSibling;
        toRemove.remove();
      }
      wrapper.remove();
      agentSendMsg(newText);
    });

    cancelBtn.addEventListener('click', () => {
      bubble.innerHTML = safeHTML(originalContent);
    });

    editArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        confirmBtn.click();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelBtn.click();
      }
    });
  }

  // ★ 会话自动保存：每条消息后 debounce 500ms 写入
  panel._activeChatId = panel._activeChatId || null;

  const _autoSave = debounce(() => {
    const history = panel._agentHistory;
    if (!history?.length) return;

    const histories = loadChatHistories();
    const activeId = panel._activeChatId;

    if (activeId) {
      const idx = histories.findIndex(h => h.id === activeId);
      if (idx >= 0) {
        histories[idx].messages = history.slice(0, 100);
        histories[idx].preview = summarizeHistory(history);
        histories[idx].time = formatTime(new Date());
      }
    } else {
      const newId = Date.now();
      histories.unshift({
        id: newId,
        preview: summarizeHistory(history),
        time: formatTime(new Date()),
        messages: history.slice(0, 100),
      });
      panel._activeChatId = newId;
    }
    saveChatHistories(histories);
  }, 500);

  // ★ 订阅 Agent 事件流（先取消旧订阅，防止 bindAgentEvents 重复调用时叠加监听器）
  let streamBubble = null;  // 当前流式渲染的气泡元素
  let _hasStreamedText = false;  // ★ 标记当前回合是否已流式输出文本
  let _streamedTextLen = 0;  // ★ 流式输出的总文本长度（streamBubble 被清掉后仍可访问）
  let _trackContainer = null;  // ★ 地铁追踪线容器
  let _thinkingTimer = null;  // ★ 思考计时器
  let _pendingAction = null;  // ★ 延迟处理：流式未完成时暂存 _handleDone 的 action

  if (panel._agentEventUnsub) { panel._agentEventUnsub(); panel._agentEventUnsub = null; }

  if (engine?.onOrchestratorEvent) {
    panel._agentEventUnsub = engine.onOrchestratorEvent((evt) => {
      switch (evt.type) {
        case 'agent:thinking':
          _handleThinking(evt);
          break;
        case 'agent:thinking_stream':
          _handleThinkingStream(evt.chunk, evt.done);
          break;
        case 'agent:stream':
          _handleStreamChunk(evt.chunk, evt.done);
          break;
        case 'agent:tool_call':
          _handleToolCall(evt);
          break;
        case 'agent:status':
          _handleStatusChange(evt);
          break;
        case 'agent:done':
          _handleDone(evt.action);
          break;
        case 'agent:error':
          _handleAgentError(evt);
          break;
      }
    });
  }

  // ── Agent 事件处理 ──

  function _handleThinking(evt) {
    // 移除旧的加载动画
    const oldLoading = $el('cs-agent-loading', container);
    if (oldLoading) oldLoading.remove();

    // 创建/更新状态指示器
    let indicator = container.querySelector('.cs-agent-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'cs-chat-msg-ai cs-agent-indicator';
      const bubble = document.createElement('div');
      bubble.className = 'cs-chat-bubble';
      indicator.appendChild(bubble);
      agentMsgs.appendChild(indicator);
    }
    const bubble = indicator.querySelector('.cs-chat-bubble');

    if (evt.phase === 'llm_call') {
      if (!bubble.querySelector('.cs-glyph-thinking')) {
        bubble.innerHTML = safeHTML(`
          <span class="cs-glyph-thinking"></span>
          <span class="cs-thinking-label" style="margin-left:6px;font-size:12px;color:var(--cs-signal-blue)">${t('thinkingReply') || '思考回复中'}</span>
        `);
      }
    } else if (evt.phase === 'regex_route') {
      bubble.innerHTML = safeHTML(`
        <svg class="cs-glyph cs-glyph-regex" style="width:16px;height:16px;color:var(--cs-signal-violet)"><use href="#glyph-regex"/></svg>
        <span style="margin-left:6px;font-size:12px;color:var(--cs-signal-violet)">正则模式处理</span>
      `);
    }
    agentMsgs.scrollTop = agentMsgs.scrollHeight;
  }

  let _thinkingBlock = null;
  let _thinkingBody = null;
  let _thinkingTimeEl = null;
  let _thinkingStartTime = 0;

  function _handleThinkingStream(chunk, done) {
    // 首次创建思考区域
    if (!_thinkingBlock) {
      _thinkingStartTime = Date.now();
      const wrapper = document.createElement('div');
      wrapper.className = 'cs-chat-msg-ai';
      wrapper.innerHTML = safeHTML(`
        <div class="cs-chat-avatar cs-chat-avatar-ai">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z" fill="currentColor" opacity="0.15"/>
            <path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          </svg>
        </div>
      `);
      const block = document.createElement('div');
      block.className = 'cs-thinking-block cs-thinking-block-thinking';
      block.innerHTML = safeHTML(`
        <div class="cs-thinking-header">
          <span class="cs-thinking-arrow">▼</span>
          <span class="cs-thinking-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>
            ${t('thinkingInProgress') || '深度思考中...'}
          </span>
          <span class="cs-thinking-time" id="cs-thinking-time">0s</span>
        </div>
        <div class="cs-thinking-body"></div>
      `);
      wrapper.appendChild(block);
      agentMsgs.appendChild(wrapper);
      _thinkingBlock = block;
      _thinkingBody = block.querySelector('.cs-thinking-body');
      _thinkingTimeEl = block.querySelector('.cs-thinking-time');
      
      // 折叠/展开
      block.querySelector('.cs-thinking-header').addEventListener('click', () => {
        block.classList.toggle('cs-thinking-collapsed');
      });
      
      // 计时器
      _thinkingTimer = setInterval(() => {
        if (_thinkingTimeEl) {
          const elapsed = Math.floor((Date.now() - _thinkingStartTime) / 1000);
          _thinkingTimeEl.textContent = elapsed + 's';
        }
      }, 1000);
    }
    
    // 追加思考内容
    if (chunk && _thinkingBody) {
      _thinkingBody.textContent += chunk;
      _thinkingBody.scrollTop = _thinkingBody.scrollHeight;
    }
    
    // 思考完成
    if (done) {
      if (_thinkingTimer) { clearInterval(_thinkingTimer); _thinkingTimer = null; }
      const label = _thinkingBlock?.querySelector('.cs-thinking-label');
      if (label) {
        const elapsed = Math.floor((Date.now() - _thinkingStartTime) / 1000);
        label.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>${t('thinkingComplete') || '已深度思考 (' + elapsed + 's)'}`;
      }
      if (_thinkingTimeEl) {
        _thinkingTimeEl.style.display = 'none';
      }
      // 思考完成后默认折叠
      if (_thinkingBlock) {
        _thinkingBlock.classList.remove('cs-thinking-block-thinking');
        _thinkingBlock.classList.add('cs-thinking-collapsed');
      }
      _thinkingBlock = null;
      _thinkingBody = null;
      _thinkingTimeEl = null;
      _thinkingStartTime = 0;
    }
    
    agentMsgs.scrollTop = agentMsgs.scrollHeight;
  }

  // ★ 流式队列：强制最小 20ms 间隔，确保打字机效果可见
  const _streamQueue = [];
  let _streamProcessing = false;
  let _streamFinalize = false;
  const _STREAM_BATCH_SIZE = 4;   // 每次批量处理字符数（水流式，非逐字）
  const _STREAM_INTERVAL = 25;    // 批次间隔 ms

  function _processStreamQueue() {
    if (_streamQueue.length === 0) {
      _streamProcessing = false;
      if (_streamFinalize) {
        _streamFinalize = false;
        const cursor = streamBubble?.querySelector('.cs-stream-cursor');
        if (cursor) cursor.remove();
        _streamedTextLen = streamBubble?._textNode?.textContent?.length || 0;
        streamBubble = null;
        _hasStreamedText = true;
        if (_pendingAction) {
          const action = _pendingAction;
          _pendingAction = null;
          _handleDoneDeferred(action);
        }
      }
      return;
    }

    _streamProcessing = true;
    // 批量取出多个字符，水流式一次性写入
    const batch = _streamQueue.splice(0, _STREAM_BATCH_SIZE).join('');
    if (streamBubble && streamBubble._textNode) {
      streamBubble._textNode.textContent += batch;
      agentMsgs.scrollTop = agentMsgs.scrollHeight;
    }

    setTimeout(_processStreamQueue, _STREAM_INTERVAL);
  }

  function _handleStreamChunk(chunk, done) {
    // ★ 更新状态指示器为"流式输出中"，而不是移除它
    const indicator = container.querySelector('.cs-agent-indicator');
    if (indicator) {
      const bubble = indicator.querySelector('.cs-chat-bubble');
      if (bubble && !bubble.querySelector('.cs-glyph-stream')) {
        bubble.innerHTML = safeHTML(`
          <svg class="cs-glyph cs-glyph-stream" style="width:16px;height:16px;color:var(--cs-signal-cyan)"><use href="#glyph-tool"/></svg>
          <span style="margin-left:6px;font-size:12px;color:var(--cs-signal-cyan)">生成回复中...</span>
        `);
      }
    }

    // 创建或追加流式气泡
    if (!streamBubble) {
      const wrapper = document.createElement('div');
      wrapper.className = 'cs-chat-msg-ai';
      const bubble = document.createElement('div');
      bubble.className = 'cs-chat-bubble cs-stream-bubble';
      wrapper.appendChild(bubble);
      agentMsgs.appendChild(wrapper);
      streamBubble = bubble;
      // ★ 创建 textNode 用于精确追加（避免 textContent 覆盖光标元素）
      streamBubble._textNode = document.createTextNode('');
      streamBubble.appendChild(streamBubble._textNode);
    }

    // ★ 入队而非直接追加，强制打字机效果
    if (chunk) _streamQueue.push(chunk);

    // 闪烁光标
    let cursor = streamBubble.querySelector('.cs-stream-cursor');
    if (!cursor) {
      cursor = document.createElement('span');
      cursor.className = 'cs-stream-cursor';
      streamBubble.appendChild(cursor);
    }

    if (done) {
      _streamFinalize = true;
    }

    // 启动队列处理
    if (!_streamProcessing) {
      _processStreamQueue();
    }

    // Edge case: done 且队列已空
    if (done && _streamQueue.length === 0 && !_streamProcessing) {
      _streamFinalize = false;
      cursor.remove();
      streamBubble = null;
      _hasStreamedText = true;
    }
  }

  function _handleToolCall(evt) {
    if (evt.phase === 'start') {
      // ★ 确保追踪线容器存在
      if (!_trackContainer) {
        _trackContainer = document.createElement('div');
        _trackContainer.className = 'cs-track-line';
        const wrapper = document.createElement('div');
        wrapper.className = 'cs-chat-msg-ai';
        wrapper.appendChild(_trackContainer);
        agentMsgs.appendChild(wrapper);
      }
      // 添加工具节点
      const node = document.createElement('div');
      node.className = 'cs-track-seg cs-track-seg-active';
      node.dataset.tool = evt.name || '';
      node.innerHTML = safeHTML(`
        <span class="cs-track-node" style="background:var(--cs-signal-cyan)"></span>
        <span class="cs-track-label" style="color:var(--cs-signal-cyan)">${escapeHtml(evt.name || 'tool')}</span>
      `);
      _trackContainer.appendChild(node);
      agentMsgs.scrollTop = agentMsgs.scrollHeight;

      // 更新 indicator
      const indicator = container.querySelector('.cs-agent-indicator .cs-chat-bubble');
      if (indicator) {
        indicator.innerHTML = safeHTML(`
          <svg class="cs-glyph cs-glyph-tool cs-glyph-tool-active" style="width:16px;height:16px"><use href="#glyph-tool"/></svg>
          <span style="margin-left:6px;font-size:12px;color:var(--cs-signal-cyan)">${escapeHtml(evt.name)} 执行中...</span>
        `);
      }
    } else if (evt.phase === 'end') {
      // ★ 更新追踪线节点状态
      const activeNode = _trackContainer?.querySelector('.cs-track-seg-active');
      if (activeNode) {
        activeNode.classList.remove('cs-track-seg-active');
        activeNode.classList.add('cs-track-seg-done');
        const nodeDot = activeNode.querySelector('.cs-track-node');
        const nodeLabel = activeNode.querySelector('.cs-track-label');
        const success = evt.result !== false;
        if (nodeDot) nodeDot.style.background = success ? 'var(--cs-signal-green)' : 'var(--cs-signal-rose)';
        if (nodeLabel) nodeLabel.style.color = success ? 'var(--cs-signal-green)' : 'var(--cs-signal-rose)';
      }
    }
  }

  function _handleStatusChange(evt) {
    if (evt.status === 'degraded') {
      const indicator = container.querySelector('.cs-agent-indicator .cs-chat-bubble');
      if (indicator) {
        indicator.innerHTML = safeHTML(`
          <svg class="cs-glyph cs-glyph-warning" style="width:16px;height:16px;color:var(--cs-signal-amber)"><use href="#glyph-warning"/></svg>
          <span style="margin-left:6px;font-size:12px;color:var(--cs-signal-amber)">降级为正则模式</span>
        `);
      }
    }
  }

  function _handleDone(action) {
    setButtonState('idle');

    // ★ 如果流式队列还在处理中，暂存 action，等队列空时由 _processStreamQueue 回调
    if (_streamProcessing || _streamQueue.length > 0) {
      _pendingAction = action;
      return;
    }

    _handleDoneDeferred(action);
  }

  function _handleDoneDeferred(action) {
    setButtonState('idle');
    // 移除状态指示器
    const indicator = container.querySelector('.cs-agent-indicator');
    if (indicator) indicator.remove();

    // 清理追踪线（延迟淡出）
    if (_trackContainer) {
      const tc = _trackContainer;
      setTimeout(() => {
        tc.style.opacity = '0.5';
        tc.style.transition = 'opacity .3s ease';
      }, 2000);
      _trackContainer = null;
    }

    // ★ 使用 _streamedTextLen（在 _processStreamQueue 中已记录）
    const streamedTextLen = _streamedTextLen;

    // 清理流式气泡引用
    streamBubble = null;
    _streamedTextLen = 0;

    // 清理思考区域
    if (_thinkingBlock) {
      if (_thinkingTimer) { clearInterval(_thinkingTimer); _thinkingTimer = null; }
      _thinkingBlock = null;
      _thinkingBody = null;
      _thinkingTimeEl = null;
    }

    // ★ 如果已流式输出文本且有实际内容，不再重复渲染文本部分
    // 只渲染交互卡片（confirm_create/confirm_action 等）
    if (_hasStreamedText && streamedTextLen > 0 && action) {
      _hasStreamedText = false;
      // 只渲染交互式卡片，不重复渲染纯文本
      const interaction = action.interaction;
      if (interaction && interaction.kind !== 'message') {
        renderAIAction(action, addAgentMsg, container, agentSendMsg, panel);
      }
      // ★ 流式文字已有内容，对 message 类型执行 Markdown 后处理
      if (interaction && interaction.kind === 'message') {
        // 找到最后一个 stream-bubble 并渲染 Markdown
        const lastBubble = agentMsgs.querySelector('.cs-stream-bubble:last-of-type');
        if (lastBubble) {
          const raw = lastBubble._textNode?.textContent || '';
          if (raw) {
            lastBubble.innerHTML = safeHTML(formatMarkdown(escapeHtml(raw)));
          }
        }
      }
      return;
    }
    _hasStreamedText = false;

    // ★ Fallback: 流式标记为 true 但实际无文字，走完整渲染
    // 非流式模式：用 renderAIAction 渲染完整结果
    if (action) {
      renderAIAction(action, addAgentMsg, container, agentSendMsg, panel);
    }
  }

  function _handleAgentError(evt) {
    setButtonState('idle');
    const indicator = container.querySelector('.cs-agent-indicator');
    if (indicator) indicator.remove();
    streamBubble = null;
    _hasStreamedText = false;
    // ★ 清理追踪线
    if (_trackContainer) {
      _trackContainer.remove();
      _trackContainer = null;
    }
    // ★ 清理思考区域
    if (_thinkingBlock) {
      if (_thinkingTimer) { clearInterval(_thinkingTimer); _thinkingTimer = null; }
      _thinkingBlock = null;
      _thinkingBody = null;
      _thinkingTimeEl = null;
    }
    addAgentMsg('ai', `处理失败：${evt.error?.message || '未知错误'}`);
  }

  const clearInteractive = () => {
    container.querySelectorAll('.cs-agent-scope-cards, .cs-agent-options, .cs-agent-action-btns, .cs-v2-action-btns, .cs-v2-clarify')
      .forEach(el => el.remove());
  };

  const _renderTopicListInline = () => {
    const tf = panel._scanner?.topicFilter;
    if (!tf) {
      addAgentMsg('ai', '话题过滤器尚未就绪。');
      return;
    }
    const topics = tf.getAllTopics();
    if (!topics.length) {
      addAgentMsg('ai', '暂无话题。');
      return;
    }
    const labels = {
      gender_attack: t('topicGenderAttack'), race_attack: t('topicRaceAttack'),
      personal_attack: t('topicPersonalAttack'), political_extreme: t('topicPoliticalExtreme'),
      spoiler: t('topicSpoiler'), fan_war: t('topicFanWar'),
      spam_harass: t('topicSpamHarass'), game_toxic: t('topicGameToxic'),
    };
    const curLang = getLang();
    const enabled = topics.filter(t => t.enabled);
    let html = '<div style="margin-top:4px;padding:8px 10px;border:1px solid var(--cs-border);border-radius:8px;font-size:11px;background:var(--cs-bg-body)">';
    html += `<div style="font-weight:600;margin-bottom:4px">当前话题列表（共 ${topics.length} 个，已启用 ${enabled.length} 个）</div>`;
    for (const topic of topics) {
      const label = labels[topic.id] || topic.label?.[curLang] || topic.label?.zh || topic.id;
      const kwCount = topic.keywordCount || 0;
      html += '<div style="display:flex;align-items:center;gap:4px;padding:2px 0">';
      html += `<span class="cs-topic-toggle-dot${topic.enabled ? ' on' : ''}"></span>`;
      html += `<span style="flex:1">${escapeHtml(label)}</span>`;
      html += `<span style="color:var(--cs-text-secondary);font-size:10px">${t('agentKeywordCount', {n: kwCount})}</span>`;
      html += '</div>';
    }
    html += '</div>';
    addAgentMsg('ai', html);
  };

  const aiAvailable = panel._config?.aiEnabled !== false && !!(panel._config?.apiKey || panel._scanner?.aiAnalyzer?.shouldAnalyze?.());
  const agentSendMsg = async (text, extras = {}) => {
    if (!text && !extras.selectedScopes && !extras.clarificationAnswer) return;

    const LIST_CMDS = ['查看话题', '查看', '列表', 'list', '/topics', '有哪些话题', '当前话题', '列出话题', '所有话题'];
    if (text && !extras.selectedScopes && !extras.clarificationAnswer && LIST_CMDS.some(c => text.toLowerCase().includes(c))) {
      addAgentMsg('user', escapeHtml(text));
      if (agentInput) { agentInput.innerHTML = ''; agentInput.textContent = ''; }
      if (agentInput) agentInput.style.height = 'auto';
      clearInteractive();
      const loadingId = 'cs-agent-loading';
      if ($el(loadingId, container)) $el(loadingId, container).remove();
      _renderTopicListInline();
      return;
    }

    if (text) addAgentMsg('user', escapeHtml(text));
    if (agentInput) { agentInput.innerHTML = ''; agentInput.textContent = ''; }
    if (agentInput) agentInput.style.height = 'auto';
    clearInteractive();
    // ★ 重置流式状态和追踪线
    _hasStreamedText = false;
    streamBubble = null;
    if (_trackContainer) {
      _trackContainer.remove();
      _trackContainer = null;
    }
    // ★ 重置思考状态
    if (_thinkingTimer) { clearInterval(_thinkingTimer); _thinkingTimer = null; }
    _thinkingBlock = null;
    _thinkingBody = null;
    _thinkingTimeEl = null;
    setButtonState('sending');

    const loadingId = 'cs-agent-loading';
    if ($el(loadingId, container)) $el(loadingId, container).remove();

    // ★ 新的加载占位（由事件驱动更新内容）
    const indicator = document.createElement('div');
    indicator.className = 'cs-chat-msg-ai cs-agent-indicator';
    indicator.id = loadingId;
    const indicatorBubble = document.createElement('div');
    indicatorBubble.className = 'cs-chat-bubble';
    indicatorBubble.innerHTML = safeHTML('<span class="cs-glyph-thinking"></span>');
    indicator.appendChild(indicatorBubble);
    agentMsgs.appendChild(indicator);
    agentMsgs.scrollTop = agentMsgs.scrollHeight;

    try {
      if (!engine) {
        indicator.remove();
        addAgentMsg('ai', t('agentError', { msg: 'AI 引擎未初始化' }));
        return;
      }

      const result = engine.process(text || '', extras);
      const response = (result && typeof result.then === 'function') ? await result : result;

      // ★ 恢复按钮（由 _handleDone / _handleAgentError 处理）

      // ★ agent:done 事件已经处理了 indicator 清理和结果渲染
      // 如果没有事件订阅（降级场景），仍用旧逻辑
      if (!engine.onOrchestratorEvent) {
        indicator.remove();
        renderAIAction(response, addAgentMsg, container, agentSendMsg, panel);
      }
    } catch (err) {
      setButtonState('idle');
      const indicatorEl = container.querySelector('.cs-agent-indicator');
      if (indicatorEl) indicatorEl.remove();
      streamBubble = null;
      if (err?.name === 'AbortError') {
        addAgentMsg('ai', '已停止生成。');
      } else {
        addAgentMsg('ai', t('agentError', { msg: err.message }));
      }
    }
  };

  // ★ 发送/暂停按钮
  const sendPauseBtn = $el('cs-agent-send-pause', container);

  const setButtonState = (state) => {
    if (!sendPauseBtn) return;
    sendPauseBtn.className = 'cs-send-pause-btn';
    if (state === 'sending') {
      sendPauseBtn.classList.add('cs-busy');
      sendPauseBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
      sendPauseBtn.title = '停止生成';
    } else {
      sendPauseBtn.classList.add('cs-idle');
      sendPauseBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>';
      sendPauseBtn.title = '发送';
    }
  };

  sendPauseBtn?.addEventListener('click', () => {
    if (sendPauseBtn.classList.contains('cs-busy')) {
      // 暂停：abort LLM 调用
      engine?.abort?.();
      setButtonState('idle');
    } else {
      // 发送
      const val = (agentInput?.textContent || '').trim();
      if (!val) return;
      agentSendMsg(val);
    }
  });

  // Enter 发送，Shift+Enter 换行
  agentInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (sendPauseBtn?.classList.contains('cs-busy')) return;
      const val = (agentInput.textContent || '').trim();
      if (!val) return;
      agentSendMsg(val);
    }
  });

  // 欢迎页建议按钮（事件委托）
  delegate(container, '.cs-suggestion-btn', 'click', (e, btn) => {
    const action = btn.dataset.action;
    if (action === 'quick-capabilities') {
      agentSendMsg('你能做什么？');
      return;
    }
    // 移除已有表单，防止重复
    const existing = container.querySelector('.cs-quick-form');
    if (existing) existing.remove();
    // 注入表单卡片
    _injectQuickForm(container, action, agentSendMsg, panel);
  });

  // 顶部栏按钮（直接绑定 + 事件委托双重保障）
  const headerButtons = container.querySelectorAll('.cs-chat-header-btn, .cs-chat-history-toggle');
  headerButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const action = btn.dataset.action;
      await _handleHeaderAction(action, btn, e);
    });
  });

  // 顶部栏按钮（事件委托兜底）
  delegate(container, '.cs-chat-header-btn, .cs-chat-history-toggle', 'click', async (e, btn) => {
    if (btn._handled) { btn._handled = false; return; }
    e.preventDefault();
    e.stopPropagation();
    const action = btn.dataset.action;
    await _handleHeaderAction(action, btn, e);
  });

  async function _handleHeaderAction(action, btn, e) {
    btn._handled = true;
    if (action === 'newchat') {
      _saveCurrentChat(panel);
      panel._agentHistory = [];
      panel._activeChatId = null;
      const main = panel._el?.querySelector('#cs-dash-main');
      if (main) {
        main.innerHTML = safeHTML(renderAgentChat(panel));
        bindAgentEvents(main, panel);
      }
      return;
    }
    if (action === 'close') {
      _saveCurrentChat(panel);
      panel._close();
      return;
    }
    if (action === 'history') {
      _toggleHistoryPanel(container, panel, addAgentMsg, agentSendMsg);
      return;
    }
    if (action === 'theme') {
      const dash = panel._el;
      if (dash) {
        const isDark = dash.classList.contains('cs-theme-dark');
        dash.classList.remove('cs-theme-light', 'cs-theme-dark');
        if (isDark) {
          dash.classList.add('cs-theme-light');
        } else {
          dash.classList.add('cs-theme-dark');
        }
        _updateThemeIcon(container, !isDark);
        try {
          GM_setValue('cs_agent_theme', isDark ? 'light' : 'dark');
        } catch (err) { /* ignore */ }
      }
      return;
    }
    if (action === 'copylog' && panel.DEV_MODE) {
      _toggleCopyLogMenu(container, panel, addAgentMsg);
      return;
    }
    if (action === 'record' && panel.DEV_MODE) {
      _handleRecordToggle(container, panel, addAgentMsg);
      return;
    }
  }

  // ★ Ctrl+划选文字 → 浮气泡一键加入屏蔽词
  (() => {
    let bubble = null;
    const removeBubble = () => { if (bubble) { bubble.remove(); bubble = null; } };
    document.addEventListener('mousedown', removeBubble);
    if (!agentMsgs) return;
    agentMsgs.addEventListener('mouseup', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const sel = window.getSelection();
      const text = (sel || '').toString().trim();
      if (!text || text.length < 1 || text.length > 60) return;
      if (!agentMsgs.contains(sel.anchorNode)) return;

      const range = sel.rangeCount > 0 ? sel.getRangeAt(sel.rangeCount - 1) : null;
      if (!range) return;
      const rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) return;
      const amRect = agentMsgs.getBoundingClientRect();
      const left = rect.right - amRect.left;
      const top = rect.top - amRect.top - 32;

      removeBubble();
      bubble = document.createElement('div');
      bubble.className = 'cs-selection-kw-bubble';
      bubble.title = '加入屏蔽词';
      const bubbleText = text.length > 12 ? text.slice(0, 12) + '…' : text;
      bubble.innerHTML = `<span class="cs-selection-kw-text" style="display:inline-flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:12px;height:12px"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>${escapeHtml(bubbleText)}</span>`;
      const bubW = Math.min(180, text.length * 9 + 40);
      const bubX = Math.max(4, Math.min(left - bubW / 2, amRect.width - bubW - 4));
      bubble.style.cssText = `position:absolute;z-index:9999;background:#ef4444;color:#fff;font-size:11px;padding:3px 8px;border-radius:12px;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.25);white-space:nowrap;user-select:none;left:${bubX}px;top:${Math.max(4, top)}px`;
      bubble.addEventListener('mousedown', (ev) => ev.stopPropagation());
      bubble.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const words = text.split(/[\s,，、\n\r]+/).map(s => s.trim()).filter(Boolean);
        let added = 0, skipped = 0;
        const cfg = panel._config;
        if (!cfg.customKeywords) cfg.customKeywords = [];
        for (const w of words) {
          if (cfg.customKeywords.some(e => e.keyword.toLowerCase() === w.toLowerCase())) { skipped++; continue; }
          const aliases = [];
          const lower = w.toLowerCase().replace(/\s+/g, '');
          if (lower !== w) aliases.push(lower);
          cfg.customKeywords.push({ keyword: w, aliases, addedAt: Date.now() });
          added++;
        }
        try { cfg.save?.(); } catch {}
        if (panel._scanner?.detector) { panel._scanner.detector.reloadCustomKeywords?.(); panel._scanner.manualScan?.(); }
        panel._refreshTopics?.();
        if (added) panel.showToast?.(`屏蔽词已添加：${words.slice(0, 3).join('、')}${words.length > 3 ? ` 等 ${added} 个` : ''}${skipped ? `，${skipped} 个已存在` : ''}`, 'success');
        else panel.showToast?.(`${skipped} 个词都已存在`, 'info');
        removeBubble();
      });
      agentMsgs.appendChild(bubble);
      setTimeout(removeBubble, 3000);
    });
  })();

}

/**
 * 快速创建表单：注入到聊天消息区，用户可自定义填写后发送
 */
function _injectQuickForm(container, action, agentSendMsg, panel) {
  const agentMsgs = container.querySelector('#cs-dash-agent-msgs');
  if (!agentMsgs) return;

  // ★ 仅列出扫描器实际产出的 contentTypes：comment / reply
  // 其他值（dynamic/video/danmaku/live/dm/timeline）扫描器不会产出，规则永不匹配
  const SCOPE_OPTIONS = [
    { val: 'comment', label: '评论' },
    { val: 'reply', label: '回复' },
  ];

  let title, fields;

  if (action === 'quick-create-topic') {
    title = t('agentQuickCreateTopic');
    fields = [
      { id: 'q-topic-name', label: '话题名称', type: 'text', placeholder: '例如：游戏喷子', required: true },
      { id: 'q-topic-keywords', label: '关键词（逗号分隔）', type: 'text', placeholder: '例如：喷子、垃圾话、人身攻击', required: true },
      { id: 'q-topic-scope', label: '范围', type: 'checkbox-group', options: SCOPE_OPTIONS, default: ['comment', 'reply'] },
      { id: 'q-topic-sensitivity', label: '敏感度', type: 'select', options: [
        { val: 'low', label: '低（关键词模式）' },
        { val: 'medium', label: '中（混合模式）' },
        { val: 'high', label: '高（语义模式）' },
      ]},
    ];
  } else if (action === 'quick-create-keyword') {
    title = t('agentQuickCreateKeyword');
    fields = [
      { id: 'q-kw-word', label: '要屏蔽的词（多个词用逗号/空格分隔）', type: 'text', placeholder: '例如：张三、喷子、杠精', required: true },
    ];
  } else if (action === 'quick-create-hot-topic') {
    title = t('navHotTopics');
    fields = [
      { id: 'q-ht-name', label: '热点名称', type: 'text', placeholder: '例如：XX事件', required: true },
      { id: 'q-ht-keywords', label: '关键词（逗号分隔）', type: 'text', placeholder: '例如：XX、XX事件', required: true },
      { id: 'q-ht-trigger', label: '触发模式', type: 'select', options: [
        { val: 'any', label: '任一匹配 (any) — 命中任意关键词即触发' },
        { val: 'all', label: '全部匹配 (all) — 所有关键词都命中才触发' },
        { val: 'combination', label: '组合触发 (combination) — 必须全部关键词同时命中' },
      ]},
      { id: 'q-ht-scope', label: '范围', type: 'checkbox-group', options: SCOPE_OPTIONS, default: ['comment', 'reply'] },
      { id: 'q-ht-ttl', label: '有效期', type: 'select', options: [
        { val: '7', label: '7 天' },
        { val: '14', label: '14 天' },
        { val: '30', label: '30 天' },
      ]},
    ];
  } else {
    return;
  }

  // 构建表单 HTML
  let fieldsHtml = '';
  for (const f of fields) {
    fieldsHtml += `<div class="cs-qf-field"><label class="cs-qf-label">${f.label}</label>`;
    if (f.type === 'text') {
      fieldsHtml += `<input class="cs-qf-input" type="text" id="${f.id}" placeholder="${f.placeholder || ''}"${f.required ? ' required' : ''}>`;
    } else if (f.type === 'select') {
      fieldsHtml += `<select class="cs-qf-select" id="${f.id}">`;
      for (const o of f.options) {
        fieldsHtml += `<option value="${o.val}">${o.label}</option>`;
      }
      fieldsHtml += '</select>';
    } else if (f.type === 'checkbox-group') {
      fieldsHtml += '<div class="cs-qf-checkbox-group">';
      for (const o of f.options) {
        const checked = (f.default || []).includes(o.val) ? ' checked' : '';
        fieldsHtml += `<label class="cs-qf-checkbox"><input type="checkbox" value="${o.val}"${checked}> ${o.label}</label>`;
      }
      fieldsHtml += '</div>';
    }
    fieldsHtml += '</div>';
  }

  const formHtml = `
    <div class="cs-quick-form">
      <div class="cs-qf-header">
        <span class="cs-qf-title">${title}</span>
        <button class="cs-qf-close" data-action="qf-close" aria-label="${t('chatClose')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="cs-qf-body">${fieldsHtml}</div>
      <div class="cs-qf-footer">
        <button class="cs-qf-btn cs-qf-cancel" data-action="qf-cancel">取消</button>
        <button class="cs-qf-btn cs-qf-submit" data-action="qf-submit">发送</button>
      </div>
    </div>`;

  // 注入到消息区底部
  agentMsgs.insertAdjacentHTML('beforeend', formHtml);
  const form = agentMsgs.querySelector('.cs-quick-form');
  agentMsgs.scrollTop = agentMsgs.scrollHeight;

  // 关闭/取消
  form.querySelector('[data-action="qf-close"]')?.addEventListener('click', () => form.remove());
  form.querySelector('[data-action="qf-cancel"]')?.addEventListener('click', () => form.remove());

  // 提交
  form.querySelector('[data-action="qf-submit"]')?.addEventListener('click', () => {
    const getVal = (id) => form.querySelector('#' + id)?.value?.trim() || '';
    const getCheckbox = (parent) => {
      const boxes = form.querySelectorAll(parent + ' input[type="checkbox"]:checked');
      return Array.from(boxes).map(b => b.value);
    };

    let msg;
    if (action === 'quick-create-topic') {
      const name = getVal('q-topic-name');
      const keywords = getVal('q-topic-keywords');
      const scope = getCheckbox('.cs-qf-body');
      const sensitivity = form.querySelector('#q-topic-sensitivity')?.value || 'medium';
      if (!name || !keywords) return;
      const sensLabel = { low: '低', medium: '中', high: '高' }[sensitivity] || '中';
      msg = `创建话题：${name}，关键词：${keywords}，范围：${scope.join('、')}，敏感度：${sensLabel}`;
    } else if (action === 'quick-create-keyword') {
      const raw = getVal('q-kw-word');
      if (!raw) return;
      const words = raw.split(/[\s,，、]+/).map(s => s.trim()).filter(Boolean);
      if (!words.length) return;
      msg = words.length > 1
        ? `屏蔽词：${words.join('、')}`
        : `屏蔽词：${words[0]}`;
    } else if (action === 'quick-create-hot-topic') {
      const name = getVal('q-ht-name');
      const keywords = getVal('q-ht-keywords');
      const trigger = form.querySelector('#q-ht-trigger')?.value || 'combination';
      const scope = getCheckbox('.cs-qf-body');
      const ttl = form.querySelector('#q-ht-ttl')?.value || '7';
      if (!name || !keywords) return;
      const triggerLabel = { any: '任一匹配', all: '全部匹配', combination: '组合触发' }[trigger] || '组合触发';
      msg = `创建热点：${name}，关键词：${keywords}，触发模式：${triggerLabel}（${trigger}），范围：${scope.join('、')}，有效期：${ttl}天`;
    }

    if (msg) {
      form.remove();
      agentSendMsg(msg);
    }
  });

  // 回车快捷提交
  form.querySelectorAll('.cs-qf-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        form.querySelector('[data-action="qf-submit"]')?.click();
      }
    });
  });
}

/**
 * 保存当前对话到历史记录
 */
function _saveCurrentChat(panel) {
  const history = panel._agentHistory;
  if (!history?.length) return;
  const histories = loadChatHistories();
  const preview = summarizeHistory(history);
  const now = new Date();
  const timeStr = `${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
  
  // 如果已有activeChatId，更新现有对话；否则新建
  if (panel._activeChatId) {
    const idx = histories.findIndex(h => h.id === panel._activeChatId);
    if (idx !== -1) {
      histories[idx].preview = preview;
      histories[idx].time = timeStr;
      histories[idx].messages = history.slice(0, 100);
      // 移到最前面
      const [item] = histories.splice(idx, 1);
      histories.unshift(item);
      saveChatHistories(histories);
      return;
    }
  }
  
  // 新建对话
  panel._activeChatId = Date.now();
  histories.unshift({
    id: panel._activeChatId,
    preview,
    time: timeStr,
    messages: history.slice(0, 100),
  });
  saveChatHistories(histories);
}

/**
 * 切换历史对话面板
 */
function _toggleHistoryPanel(container, panel, addAgentMsg, agentSendMsg) {
  // 三栏容器是 .cs-dash-panel，历史面板插入到侧边栏左侧
  const dashPanel = container.closest('.cs-dash-panel') || container;
  const sidebar = dashPanel.querySelector('.cs-dash-sidebar');

  // 如果已打开，关闭
  const existing = dashPanel.querySelector('.cs-chat-history-panel');
  if (existing) { existing.remove(); _updatePanelWidth(dashPanel); return; }

  const histories = loadChatHistories();
  const panel_ = document.createElement('div');
  panel_.className = 'cs-chat-history-panel';
  const activeChatId = panel._activeChatId;

  let listHtml = '';
  if (histories.length === 0) {
    listHtml = `<div class="cs-chat-history-empty">${t('chatNoHistory') || '暂无历史对话'}</div>`;
  } else {
    for (const h of histories) {
      const isActive = activeChatId && h.id === activeChatId;
      listHtml += `
        <div class="cs-chat-history-item${isActive ? ' cs-chat-history-item-active' : ''}" data-history-id="${h.id}">
          <span class="cs-chat-history-item-title">${escapeHtml(h.preview)}</span>
          <div style="display:flex;align-items:center;gap:4px;margin-top:2px">
            <span class="cs-chat-history-item-preview">${escapeHtml(h.time)}</span>
            <button class="cs-chat-history-item-del" data-del-id="${h.id}" title="${t('delete') || '删除'}" aria-label="${t('delete') || '删除'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>`;
    }
  }

  panel_.innerHTML = safeHTML(`
    <div class="cs-chat-history-header">
      <span class="cs-chat-history-title">${t('chatHistory')}</span>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="cs-chat-history-close" data-action="debug" title="${t('chatDebug')}" aria-label="${t('chatDebug')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><circle cx="9" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/></svg>
        </button>
        <button class="cs-chat-history-close" data-action="close-history" title="${t('chatClose')}" aria-label="${t('chatClose')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
    <button class="cs-chat-history-new" data-action="newchat-in-history">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      ${t('chatNewChat')}
    </button>
    <div class="cs-chat-history-list">${listHtml}</div>
  `);

  // 插入到 .cs-dash-panel 中，侧边栏的左侧
  if (sidebar) {
    dashPanel.insertBefore(panel_, sidebar);
  } else {
    dashPanel.insertBefore(panel_, dashPanel.firstChild);
  }
  _updatePanelWidth(dashPanel);

  // 关闭按钮 - 使用直接绑定确保稳定
  const closeBtn = panel_.querySelector('[data-action="close-history"]');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      panel_.remove();
      _updatePanelWidth(dashPanel);
    });
  }

  // 调试按钮
  const debugBtn = panel_.querySelector('[data-action="debug"]');
  if (debugBtn) {
    debugBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      _toggleDebugPanel(dashPanel, panel);
    });
  }

  // 新对话按钮
  const newChatBtn = panel_.querySelector('.cs-chat-history-new');
  if (newChatBtn) {
    newChatBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      _saveCurrentChat(panel);
      panel._agentHistory = [];
      panel._activeChatId = null;
      // 只更新主聊天区域，不移除历史面板
      const main = panel._el?.querySelector('#cs-dash-main');
      if (main) {
        main.innerHTML = safeHTML(renderAgentChat(panel));
        bindAgentEvents(main, panel);
      }
      // 更新历史项高亮
      panel_.querySelectorAll('.cs-chat-history-item').forEach(item => {
        item.classList.remove('cs-chat-history-item-active');
      });
    });
  }

  // 点击历史项（直接绑定确保稳定）
  const historyItems = panel_.querySelectorAll('.cs-chat-history-item');
  historyItems.forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.cs-chat-history-item-del')) return;
      e.preventDefault();
      e.stopPropagation();
      const id = Number(item.dataset.historyId);
      const h = histories.find(h => h.id === id);
      if (!h) return;
      _saveCurrentChat(panel);
      panel._agentHistory = h.messages ? JSON.parse(JSON.stringify(h.messages)) : [];
      panel._activeChatId = id;
      // 重新渲染
      const main = panel._el?.querySelector('#cs-dash-main');
      if (main) {
        main.innerHTML = safeHTML(renderAgentChat(panel));
        bindAgentEvents(main, panel);
        // 滚动到底部
        const msgs = main.querySelector('#cs-dash-agent-msgs');
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
      }
      // 更新高亮
      panel_.querySelectorAll('.cs-chat-history-item').forEach(i => {
        i.classList.remove('cs-chat-history-item-active');
      });
      item.classList.add('cs-chat-history-item-active');
    });
  });

  // 删除历史项（直接绑定确保稳定）
  const delBtns = panel_.querySelectorAll('.cs-chat-history-item-del');
  delBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = Number(btn.dataset.delId);
      let currentHistories = loadChatHistories();
      currentHistories = currentHistories.filter(h => h.id !== id);
      saveChatHistories(currentHistories);
      const item = btn.closest('.cs-chat-history-item');
      if (item) {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-20px)';
        item.style.transition = 'opacity .2s ease, transform .2s ease';
        setTimeout(() => item.remove(), 200);
      }
      if (panel._activeChatId === id) {
        panel._activeChatId = null;
      }
      if (currentHistories.length === 0) {
        const list = panel_.querySelector('.cs-chat-history-list');
        if (list) list.innerHTML = '<div class="cs-chat-history-empty">暂无历史对话</div>';
      }
    });
  });
}

/**
 * 调试面板：纯文本对话，方便复制
 */
function _toggleDebugPanel(dashPanel, panel) {
  // 如果已打开，关闭
  const existing = dashPanel.querySelector('.cs-chat-debug-panel');
  if (existing) { existing.remove(); _updatePanelWidth(dashPanel); return; }

  const history = panel._agentHistory || [];
  const tmp = document.createElement('div');
  const lines = history.map(m => {
    tmp.innerHTML = String(m.html || '');
    const text = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
    const role = m.role === 'user' ? '[User]' : '[AI]';
    return `${role} ${text}`;
  });
  const plainText = lines.length
    ? `=== Droplet Chat Debug ===\n${new Date().toISOString()}\nMessages: ${history.length}\n\n${lines.join('\n\n')}`
    : '(当前对话为空)';

  const debugPanel = document.createElement('div');
  debugPanel.className = 'cs-chat-debug-panel';
  debugPanel.innerHTML = safeHTML(`
    <div class="cs-chat-debug-header">
      <span class="cs-chat-debug-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><circle cx="9" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/></svg>
        ${t('chatDebug')}
      </span>
      <div style="display:flex;gap:4px">
        <button class="cs-chat-debug-btn" data-action="copy-all" title="复制全部">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
          复制
        </button>
        <button class="cs-chat-debug-btn" data-action="close-debug" title="${t('chatClose')}" aria-label="${t('chatClose')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
    <textarea class="cs-chat-debug-textarea" readonly>${escapeHtml(plainText)}</textarea>
  `);
  dashPanel.appendChild(debugPanel);
  _updatePanelWidth(dashPanel);

  // 复制
  debugPanel.querySelector('[data-action="copy-all"]')?.addEventListener('click', async () => {
    const ta = debugPanel.querySelector('.cs-chat-debug-textarea');
    if (!ta) return;
    try {
      ta.select();
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(ta.value);
      } else {
        document.execCommand('copy');
      }
      panel.showToast?.('已复制到剪贴板', 'success');
    } catch (err) {
      panel.showToast?.('复制失败: ' + err.message, 'error');
    }
  });

  // 关闭
  debugPanel.querySelector('[data-action="close-debug"]')?.addEventListener('click', () => {
    debugPanel.remove();
    _updatePanelWidth(dashPanel);
  });
}

/**
 * DEV_MODE: 复制日志菜单
 */
function _toggleCopyLogMenu(container, panel, addAgentMsg) {
  let menu = container.querySelector('.cs-copy-log-menu');
  if (menu) { menu.remove(); return; }

  menu = document.createElement('div');
  menu.className = 'cs-copy-log-menu';
  menu.style.cssText = 'position:absolute;top:40px;right:8px;background:var(--cs-bg,#fff);border:1px solid var(--cs-border);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.18);padding:4px;z-index:2147483640;min-width:140px;font-size:11px';

  const options = [
    { count: 1, label: t('agentCopyLast1') },
    { count: 2, label: t('agentCopyLast2') },
    { count: 3, label: t('agentCopyLast3') },
    { count: 0, label: t('agentCopyAll') },
  ];
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.style.cssText = 'display:block;width:100%;text-align:left;padding:6px 10px;border:0;background:transparent;cursor:pointer;border-radius:6px';
    btn.textContent = opt.label;
    btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--cs-bg-body)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      menu.remove();
      const count = opt.count;
      const history = panel._agentHistory || [];
      if (history.length === 0) {
        addAgentMsg('ai', t('agentCopyEmpty'));
        return;
      }
      const slice = count === 0 ? history : history.slice(-count);
      const tmp = document.createElement('div');
      const lines = slice.map(m => {
        tmp.innerHTML = String(m.html || '');
        const text = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
        const roleLabel = m.role === 'user' ? t('agentV2LogUser') : t('agentV2LogAI');
        return `[${roleLabel}] ${text}`;
      });
      const banner = `=== Droplet Agent Chat (${slice.length}/${history.length}) ===\n${new Date().toISOString()}\n`;
      const payload = banner + lines.join('\n');
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(payload);
        } else {
          const ta = document.createElement('textarea');
          ta.value = payload;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        addAgentMsg('ai', t('agentCopyDone', { n: slice.length }));
      } catch (err) {
        addAgentMsg('ai', t('agentCopyFailed', { msg: err.message || String(err) }));
      }
    });
    menu.appendChild(btn);
  }

  const chatContainer = container.querySelector('.cs-chat-container');
  if (chatContainer) {
    chatContainer.style.position = 'relative';
    chatContainer.appendChild(menu);
  }

  const closeOnOutside = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeOnOutside);
    }
  };
  setTimeout(() => document.addEventListener('click', closeOnOutside), 0);
}

/**
 * DEV_MODE: 录制 Agent 交互
 * 第一次点击开始录制，第二次点击停止并导出
 */
function _handleRecordToggle(container, panel, addAgentMsg) {
  const btn = container.querySelector('#cs-record-btn');
  const engine = panel._agentEngine;
  if (!engine) { addAgentMsg('ai', 'AI 引擎未初始化，无法录制'); return; }

  if (!panel._recorder) {
    // ── 开始录制 ──
    // 内联实现，避免在浏览器中 import node 模块
    const recorder = {
      _turns: [], _currentTurn: null, _firstInput: null,
      _lastOutput: null, _startTime: Date.now(), _recording: true,
      start() { this._turns = []; this._currentTurn = null; this._firstInput = null; this._lastOutput = null; this._startTime = Date.now(); this._recording = true; },
      stop() { if (this._currentTurn) { this._turns.push(this._currentTurn); this._currentTurn = null; } this._recording = false; },
      onLLMCall(round, req, resp) {
        if (!this._recording) return;
        if (round === 0 && this._currentTurn) { this._turns.push(this._currentTurn); this._currentTurn = null; }
        this._currentTurn = { round: this._turns.length + round, llm_request: { user: req?.input || '', tools_count: req?.toolsCount || 0 }, llm_response: typeof resp === 'string' ? { text: resp } : (resp || {}), tool_results: [] };
      },
      onToolCall(name, args, result) {
        if (!this._recording || !this._currentTurn) return;
        this._currentTurn.tool_results.push({ name, args: args || {}, result: result || {} });
      },
      onComplete(input, output) {
        if (!this._recording) return;
        if (!this._firstInput) this._firstInput = input;
        this._lastOutput = output;
      },
      toJSON() {
        const turns = [...this._turns]; if (this._currentTurn) turns.push(this._currentTurn);
        const out = this._lastOutput;
        const expected = out ? { type: out.type } : {};
        if (out?.interaction) {
          expected.interaction = {};
          if (out.interaction.kind) expected.interaction.kind = out.interaction.kind;
          if (out.interaction.config?.topicLabel) expected.interaction.config = { topicLabel: out.interaction.config.topicLabel };
        }
        return { id: `rec-${Date.now().toString(36)}`, description: '', tags: [], input: this._firstInput, extras: {}, worldState: {}, turns, expected_output: expected, meta: { timestamp: new Date().toISOString(), duration: Date.now() - this._startTime, totalLLMRounds: turns.length } };
      },
      get isRecording() { return this._recording; },
      get turnCount() { return this._turns.length + (this._currentTurn ? 1 : 0); },
      discard() { this._turns = []; this._currentTurn = null; this._firstInput = null; this._lastOutput = null; this._recording = false; },
    };
    recorder.start();
    panel._recorder = recorder;
    engine.setRecorder(recorder);
    if (btn) {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
      btn.title = '停止录制';
      btn.classList.add('cs-recording');
    }
    addAgentMsg('ai', '录制已开始。正常对话即可，完成后再次点击停止录制。');
  } else {
    // ── 停止录制 ──
    const recorder = panel._recorder;
    recorder.stop();
    engine.setRecorder(null);
    panel._recorder = null;
    if (btn) {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>';
      btn.title = '录制 Agent 交互';
      btn.classList.remove('cs-recording');
    }

    const data = recorder.toJSON();
    const jsonStr = JSON.stringify(data, null, 2);
    const roundCount = data.turns.length;

    // 提供保存选项
    addAgentMsg('ai', `录制完成！共 ${roundCount} 轮 LLM 交互，耗时 ${Math.round(data.meta.duration / 1000)}s。`);

    // 复制到剪贴板
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(jsonStr);
      } else {
        const ta = document.createElement('textarea');
        ta.value = jsonStr; ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      addAgentMsg('ai', '录制数据已复制到剪贴板。将其保存为 JSON 文件放入 <code>log/testframe/fixtures/recordings/</code> 目录即可用于回放测试。');
    } catch {
      addAgentMsg('ai', '复制到剪贴板失败，请手动从控制台复制。录制数据已输出到 console。');
      console.log('[Droplet Recording]', jsonStr);
    }
  }
}

/**
 * 渲染 Agent Engine 状态机响应（含交互式 UI）
 */
export function renderAgentResponse(response, addAgentMsg, container, agentSendMsg, panel) {
  if (!response) {
    addAgentMsg('ai', '抱歉，没有收到有效响应。');
    return;
  }

  const isAiEnhanced = response.metadata?.aiEnhanced || response.metadata?.llmEnhanced;
  const aiBadge = isAiEnhanced
    ? '<span style="display:inline-block;font-size:9px;font-weight:600;padding:1px 6px;border-radius:4px;background:var(--cs-accent);color:#fff;margin-right:4px;vertical-align:middle">AI</span>'
    : '';
  let html = aiBadge + escapeHtml(response.message || '处理中...');

  if (response.metadata?.isDiagnosis) {
    html = html.replace(/\n/g, '<br>');
  }

  const execResult = response.metadata?.executionResult;
  if (execResult?.appliedActions?.length) {
    html += `<div style="margin-top:8px;padding:8px 10px;background:color-mix(in srgb,var(--cs-success)10%,transparent);border-radius:8px;font-size:11px;color:var(--cs-success)">
      ${execResult.appliedActions.map(a => escapeHtml(a)).join('<br>')}
    </div>`;
  }

  addAgentMsg('ai', html);

  // 诊断结果卡片
  if (response.metadata?.diagnosis) {
    const d = response.metadata.diagnosis;
    const verdictColors = { safe: 'var(--cs-success)', suspicious: '#f59e0b', toxic: 'var(--cs-danger)' };
    const layerLabels = { 1: 'L1 关键词', 2: 'L2 行为', 3: 'L3 AI' };
    const agentMsgs = $el('cs-dash-agent-msgs', container);
    const wrapper = document.createElement('div');
    wrapper.className = 'cs-chat-msg-ai';
    const bubble = document.createElement('div');
    bubble.className = 'cs-chat-bubble';
    bubble.innerHTML = safeHTML(`
      <div style="padding:10px 12px;border:1px solid var(--cs-border);border-radius:10px;font-size:11px;background:var(--cs-bg-body)">
        <div style="font-weight:600;margin-bottom:6px;font-size:12px;display:flex;align-items:center;gap:5px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px;color:var(--cs-accent)"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          排查诊断结果
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px">
          <div>判定: <strong style="color:${verdictColors[d.verdict] || 'inherit'}">${escapeHtml(d.verdict)}</strong></div>
          <div>检测层: ${escapeHtml(layerLabels[d.layer] || 'L' + d.layer)}</div>
          <div>置信度: ${Math.round((d.confidence || 0) * 100)}%</div>
          ${d.matched ? `<div>匹配: ${escapeHtml(d.matched)}</div>` : ''}
        </div>
        ${d.reason ? `<div style="padding:6px 8px;background:var(--cs-bg);border-radius:6px;margin-bottom:4px"><span style="color:var(--cs-text-secondary)">原因: </span>${escapeHtml(d.reason)}</div>` : ''}
        <div style="padding:6px 8px;background:color-mix(in srgb,var(--cs-accent)8%,transparent);border-radius:6px">
          <span style="color:var(--cs-accent);font-weight:600">建议: </span>${escapeHtml(d.suggestion || '暂无建议')}
        </div>
      </div>
    `);
    wrapper.appendChild(bubble);
    agentMsgs.appendChild(wrapper);
    agentMsgs.scrollTop = agentMsgs.scrollHeight;
  }

  // 推荐范围选择
  if (response.recommendations?.length) {
    const agentMsgs = $el('cs-dash-agent-msgs', container);
    const recDiv = document.createElement('div');
    recDiv.className = 'cs-agent-scope-cards';
    recDiv.style.cssText = 'display:flex;flex-direction:column;gap:6px';

    for (const rec of response.recommendations) {
      const checked = rec.selected ? 'checked' : '';
      recDiv.innerHTML += `
        <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--cs-border);border-radius:8px;cursor:pointer;background:var(--cs-bg);font-size:12px">
          <input type="checkbox" class="cs-agent-scope-check" data-scope="${escapeHtml(rec.id)}" ${checked}>
          <div>
            <div style="font-weight:600">${escapeHtml(rec.label)}</div>
            ${rec.reason ? `<div style="font-size:11px;color:var(--cs-text-secondary)">${escapeHtml(rec.reason)}</div>` : ''}
          </div>
        </label>`;
    }

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'cs-chat-send-btn';
    confirmBtn.style.cssText = 'margin-top:4px;align-self:flex-end;font-size:11px;padding:6px 16px';
    confirmBtn.textContent = '确认选择';
    confirmBtn.addEventListener('click', () => {
      const checks = recDiv.querySelectorAll('.cs-agent-scope-check:checked');
      const selectedScopes = [...checks].map(c => c.dataset.scope);
      if (selectedScopes.length === 0) {
        const first = recDiv.querySelector('.cs-agent-scope-check');
        if (first) selectedScopes.push(first.dataset.scope);
      }
      recDiv.remove();
      agentSendMsg('确认', { selectedScopes });
    });
    recDiv.appendChild(confirmBtn);
    agentMsgs.appendChild(recDiv);
    agentMsgs.scrollTop = agentMsgs.scrollHeight;
  }

  // 选项按钮
  const options = response.questions?.[0]?.options || response.options || [];
  if (options.length) {
    const agentMsgs = $el('cs-dash-agent-msgs', container);
    const optDiv = document.createElement('div');
    optDiv.className = 'cs-agent-options';
    optDiv.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';

    for (const opt of options) {
      const btn = document.createElement('button');
      btn.className = 'cs-suggestion-btn';
      btn.style.cssText = 'padding:4px 12px;font-size:11px';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        optDiv.remove();
        agentSendMsg(opt.label, { clarificationAnswer: opt.value || opt.label });
      });
      optDiv.appendChild(btn);
    }

    agentMsgs.appendChild(optDiv);
    agentMsgs.scrollTop = agentMsgs.scrollHeight;
  }

  // 操作按钮
  if (response.actions?.length) {
    const agentMsgs = $el('cs-dash-agent-msgs', container);
    const actDiv = document.createElement('div');
    actDiv.className = 'cs-agent-action-btns';
    actDiv.style.cssText = 'display:flex;gap:8px';

    for (const act of response.actions) {
      const btn = document.createElement('button');
      const bgColor = act.type === 'danger' ? 'var(--cs-danger)' : (act.type === 'ghost' ? 'var(--cs-bg-body)' : 'var(--cs-accent)');
      const txtColor = act.type === 'ghost' ? 'var(--cs-text)' : '#fff';
      btn.style.cssText = `font-size:11px;padding:6px 14px;background:${bgColor};color:${txtColor};border:1px solid ${bgColor};border-radius:14px;cursor:pointer`;
      btn.textContent = act.label;
      btn.addEventListener('click', () => {
        actDiv.remove();
        if (act.action === 'confirm') agentSendMsg('确认');
        else if (act.action === 'edit') agentSendMsg('修改范围');
        else if (act.action === 'cancel') agentSendMsg('取消');
        else agentSendMsg(act.label);
      });
      actDiv.appendChild(btn);
    }

    agentMsgs.appendChild(actDiv);
    agentMsgs.scrollTop = agentMsgs.scrollHeight;
  }

  // 统计信息
  if (response.metadata?.showStats) {
    const tf = panel._scanner?.topicFilter;
    const scanner = panel._scanner;
    const topics = tf ? tf.getAllTopics() : [];
    const enabledTopics = topics.filter(t => t.enabled);
    const detector = scanner?.detector;
    const allRules = detector?.getAllRules ? detector.getAllRules() : {};
    const hardCount = allRules.hardKeywords?.length || 0;
    const softCount = allRules.softKeywords?.length || 0;
    const regexCount = (allRules.regexPatterns?.length || 0) + (allRules.customRegex?.length || 0);
    const customCount = allRules.customKeywords?.length || 0;
    const totalKeywords = hardCount + softCount;
    const labels = {
      gender_attack: t('topicGenderAttack'), race_attack: t('topicRaceAttack'),
      personal_attack: t('topicPersonalAttack'), political_extreme: t('topicPoliticalExtreme'),
      spoiler: t('topicSpoiler'), fan_war: t('topicFanWar'),
      spam_harass: t('topicSpamHarass'), game_toxic: t('topicGameToxic'),
    };
    const curLang = getLang();
    let statsHtml = '<div style="margin-top:4px;padding:10px 12px;border:1px solid var(--cs-border);border-radius:8px;font-size:11px;background:var(--cs-bg-body)">';
    statsHtml += '<div style="font-weight:600;margin-bottom:6px;font-size:12px;display:flex;align-items:center;gap:5px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px;color:var(--cs-accent)"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 2 5-7"/></svg>当前过滤配置概况</div>';
    statsHtml += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">';
    statsHtml += `<div style="padding:4px 0">已启用话题: <strong>${enabledTopics.length}</strong> / ${topics.length}</div>`;
    statsHtml += `<div style="padding:4px 0">关键词规则: <strong>${totalKeywords}</strong> 条</div>`;
    statsHtml += `<div style="padding:4px 0">正则规则: <strong>${regexCount}</strong> 条</div>`;
    statsHtml += `<div style="padding:4px 0">自定义规则: <strong>${customCount}</strong> 条</div>`;
    statsHtml += '</div>';
    if (enabledTopics.length) {
      statsHtml += '<div style="margin-top:4px;padding-top:4px;border-top:1px solid var(--cs-divider)">';
      statsHtml += '<div style="margin-bottom:2px;color:var(--cs-text-secondary)">已启用的话题:</div>';
      statsHtml += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
      for (const t of enabledTopics) {
        const label = labels[t.id] || t.label?.[curLang] || t.label?.zh || t.id;
        statsHtml += `<span style="background:color-mix(in srgb,var(--cs-accent)10%,transparent);border:1px solid color-mix(in srgb,var(--cs-accent)25%,transparent);padding:2px 8px;border-radius:8px">${escapeHtml(label)}</span>`;
      }
      statsHtml += '</div></div>';
    }
    statsHtml += '</div>';
    addAgentMsg('ai', statsHtml);
  }

  // 规则预览
  if (response.rulePreview) {
    const rp = response.rulePreview;
    let rpHtml = '<div style="margin-top:4px;padding:8px 10px;border:1px solid var(--cs-border);border-radius:8px;font-size:11px;background:var(--cs-bg-body)">';
    rpHtml += `<div style="font-weight:600;margin-bottom:4px">${escapeHtml(rp.topicLabel)}</div>`;
    rpHtml += `<div>类型: ${escapeHtml(rp.type)} · 覆盖: ${escapeHtml(rp.estimatedCoverage)} · 灵敏度: ${escapeHtml(rp.suggestedSensitivity)}</div>`;
    if (rp.addedKeywords?.length) {
      rpHtml += `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:6px">
        ${rp.addedKeywords.slice(0, 12).map(k =>
    `<span style="background:color-mix(in srgb,var(--cs-accent)10%,transparent);border:1px solid color-mix(in srgb,var(--cs-accent)25%,transparent);padding:1px 6px;border-radius:4px;font-size:10px">${escapeHtml(k)}</span>`
  ).join('')}
        ${rp.addedKeywords.length > 12 ? `<span style="font-size:10px;color:var(--cs-text-secondary)">+${rp.addedKeywords.length - 12}</span>` : ''}
      </div>`;
    }
    rpHtml += '</div>';
    addAgentMsg('ai', rpHtml);
  }
}
