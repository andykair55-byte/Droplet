/**
 * ui/utils.js — 面板公共工具函数
 *
 * 消除 safeHTML / escapeHtml / $el / delegate / getProviderLabel 在 4+ 面板中的重复定义。
 * 所有面板统一从此模块导入。
 */

// ── Trusted Types 策略（单例，全面板共享）──────────────────────
const _ttPolicy = (typeof trustedTypes !== 'undefined')
  ? trustedTypes.createPolicy('cybershield', { createHTML: s => s })
  : null;

/** 将字符串标记为可信 HTML（Trusted Types 兼容） */
export function safeHTML(html) {
  return _ttPolicy ? _ttPolicy.createHTML(html) : html;
}

/** HTML 转义，防止 XSS */
export function escapeHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

/** 按 ID 查询元素 */
export function $el(id, root) {
  return (root || document).querySelector(`#${id}`);
}

/** 事件委托：在 root 上监听，匹配 selector 的子元素触发 handler */
export function delegate(root, selector, event, handler) {
  root.addEventListener(event, (e) => {
    const t = e.target.closest(selector);
    if (t && root.contains(t)) handler(e, t);
  });
}

/**
 * 创建并显示模态框，统一处理关闭逻辑。
 * @param {string} innerHtml 模态框内部 HTML（cs-modal-inner 的内容）
 * @param {object} [opts]
 * @param {string} [opts.id] 模态框 overlay 的 id
 * @param {boolean} [opts.noCloseOnBackdrop=false] 禁用点击背景关闭
 * @returns {HTMLElement} 模态框 overlay 元素，供调用方追加事件
 */
export function showModal(innerHtml, opts = {}) {
  const modal = document.createElement('div');
  modal.className = 'cs-dash-modal-overlay';
  if (opts.id) modal.id = opts.id;
  modal.innerHTML = safeHTML(innerHtml);
  document.body.appendChild(modal);

  const close = () => modal.remove();
  // 关闭按钮（.cs-dash-modal-close 或 .cs-dash-modal-close-btn）
  modal.querySelectorAll('.cs-dash-modal-close, .cs-dash-modal-close-btn')
    .forEach(btn => btn.addEventListener('click', close));
  // 点击背景关闭
  if (!opts.noCloseOnBackdrop) {
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  }
  // Escape 关闭
  const onEsc = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } };
  document.addEventListener('keydown', onEsc);

  return modal;
}

/** AI Provider 标签翻译 */
export function getProviderLabel(provider, t) {
  const map = {
    claude: 'aiProviderClaude', openai: 'aiProviderOpenAI',
    deepseek: 'aiProviderDeepSeek', glm: 'aiProviderGLM',
    kimi: 'aiProviderKimi', gemini: 'aiProviderGemini',
    openrouter: 'aiProviderOpenRouter', mimo: 'aiProviderMimo',
    custom: 'aiProviderCustom',
  };
  const key = map[provider];
  return key ? t(key) : provider || '--';
}
