/**
 * panel-dashboard.js — Droplet 主面板：侧边栏 Tab 导航 + 内容区
 * 基于 panel(1).js 原版 Dashboard 结构，新增 AI Chat Tab
 */
import { t, getLang, setLang, LANGUAGES } from '../../../core/i18n.js';
import { on, emit, Events } from '../../../core/events.js';
import { renderAgentChat, bindAgentEvents } from './panel-agent.js';
import { renderHotTopics, renderHotTopicList, bindHotTopicEvents } from './panel-hot-topics.js';
import { RecycleBin } from '../../../core/recycle-bin.js';
import { safeHTML, escapeHtml, $el, delegate, getProviderLabel, showModal } from '../utils.js';

// Droplet 水滴 SVG 图标
const DROP_SVG = '<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="dr-drop" x1="14" y1="2" x2="14" y2="26" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="var(--cs-accent-hover,#7dd3fc)"/><stop offset="50%" stop-color="var(--cs-accent,#38bdf8)"/><stop offset="100%" stop-color="var(--cs-accent,#0284c7)"/></linearGradient></defs><path d="M14 2C14 2 4 11 4 17C4 22.5 8.5 26 14 26C19.5 26 24 22.5 24 17C24 11 14 2 14 2Z" fill="url(#dr-drop)"/><ellipse cx="10" cy="13" rx="3" ry="4.5" fill="white" fill-opacity="0.25" transform="rotate(-20 10 13)"/></svg>';

// 导航 SVG 图标
const ICONS = {
  overview: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5"/><rect x="11" y="11" width="6" height="6" rx="1.5"/></svg>',
  protection: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 2L3 5v5c0 4 3 7 7 8 4-1 7-4 7-8V5l-7-3z"/></svg>',
  ai: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="12" height="12" rx="3"/><circle cx="8" cy="9" r="1" fill="currentColor"/><circle cx="12" cy="9" r="1" fill="currentColor"/><path d="M7 13h6"/></svg>',
  topics: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10l5-5M3 10l5 5M3 10h14M17 10l-5-5M17 10l-5 5"/></svg>',
  'hot-topics': '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 3c0 3-4 4-4 8a4 4 0 008 0c0-2-1-3-2-4 0 1-1 2-2 2 1-2 0-4 0-6z"/></svg>',
  rules: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="12" height="14" rx="2"/><path d="M7 7h6M7 10h6M7 13h4"/></svg>',
  recycle: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h12M6 6l1 11a1 1 0 001 1h4a1 1 0 001-1l1-11M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2"/></svg>',
  log: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M6 7h8M6 10h8M6 13h5"/></svg>',
  system: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="3"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M4.5 15.5l1.4-1.4M14.1 5.9l1.4-1.4"/></svg>',
  about: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="8"/><path d="M10 9v5M10 6v.5"/></svg>',
  aichat: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5h14v8H8l-5 4V5z"/></svg>',
};
import { RulesMixin } from './dashboard-rules.js';
import { TopicsMixin } from './dashboard-topics.js';
import { SystemMixin } from './dashboard-system.js';

const VERSION = '0.8.0';

// ────────────────────────────────────────────────────────────
//  Dashboard — Sidebar + main content
// ────────────────────────────────────────────────────────────

export const Dashboard = {
  ...RulesMixin,
  ...TopicsMixin,
  ...SystemMixin,
  _el: null,
  _config: null,
  _scanner: null,
  _evidence: null,
  _scanLog: [],
  _stats: {},
  _currentSection: 'overview',
  _blocks: {},
  _unsub: [],
  _liveEvents: [],
  _recycleBin: null,  // 回收站实例
  _undoStack: [],     // 撤销栈（记录最近操作，支持撤销）

  mount(config, scanner) {
    this._config = config;
    this._scanner = scanner;
    this._evidence = scanner?.evidence || null;
    this._recycleBin = new RecycleBin();  // 初始化回收站
    this._undoStack = [];
    this._inject();
    this._loadMisjudgmentRegistry?.();
    this._listen();
  },

  setAgentEngine(engine) {
    this._agentEngine = engine;
  },

  // ★ 刷新所有 Agent 可修改的数据（话题/热点/自定义屏蔽词）
  // 无论当前在哪个 section，都确保数据在内存中更新，
  // 用户切换到对应 section 时 _renderSection 会重新读取
  _refreshTopics() {
    // 话题列表
    const topicContainer = this._el?.querySelector('#cs-dash-topic-list');
    if (topicContainer) {
      this._renderTopicList();
    }
    // 热点列表（ID 是 cs-hot-topic-list，不是 cs-dash-hot-topic-list）
    const hotTopicContainer = this._el?.querySelector('#cs-hot-topic-list');
    if (hotTopicContainer) {
      renderHotTopicList(this);
    }
    // 自定义屏蔽词列表
    this._renderCustomList();
  },

  _inject() {
    const el = document.createElement('div');
    el.id = 'cs-dashboard';
    el.innerHTML = safeHTML(`
      <div class="cs-dash-overlay"></div>
      <div class="cs-dash-panel">
        <div class="cs-dash-topbar">
          <button class="cs-dash-lock-toggle" id="cs-dash-lock-toggle" title="锁定/解锁面板位置" aria-label="锁定/解锁面板位置">
            <svg class="cs-lock-icon-locked" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="9" width="12" height="8" rx="1.5"/><path d="M7 9V6a3 3 0 0 1 6 0v3"/><circle cx="10" cy="13" r="1" fill="currentColor"/></svg>
            <svg class="cs-lock-icon-unlocked" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="9" width="12" height="8" rx="1.5"/><path d="M7 9V6a3 3 0 0 1 5.5-1.5"/><circle cx="10" cy="13" r="1" fill="currentColor"/></svg>
          </button>
          <button class="cs-dash-theme-toggle" id="cs-dash-theme-top" title="切换主题" aria-label="切换主题">
            <svg class="cs-theme-icon-sun" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="4"/><path d="M10 1v2M10 17v2M3.5 3.5l1.4 1.4M15.1 15.1l1.4 1.4M1 10h2M17 10h2M3.5 16.5l1.4-1.4M15.1 4.9l1.4-1.4"/></svg>
            <svg class="cs-theme-icon-moon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 12.5A7 7 0 0 1 7.5 3a7 7 0 1 0 9.5 9.5z"/></svg>
          </button>
          <button class="cs-dash-close-btn" id="cs-dash-close">&times;</button>
        </div>
        <div class="cs-dash-sidebar">
          <div class="cs-dash-brand">
            <span class="cs-dash-guardian">
              <span class="cs-guardian-ring"></span>
              <span class="cs-guardian-ring"></span>
              <span class="cs-dash-logo">${DROP_SVG}</span>
            </span>
            <span class="cs-dash-title">Droplet</span>
            <span class="cs-dash-ver">${VERSION}</span>
          </div>
          <nav class="cs-dash-nav" id="cs-dash-nav">
            <button class="cs-nav-item cs-nav-active" data-section="overview"><span class="cs-nav-icon">${ICONS.overview}</span> ${t('navOverview')}</button>
            <button class="cs-nav-item" data-section="protection"><span class="cs-nav-icon">${ICONS.protection}</span> ${t('navProtection')}</button>
            <button class="cs-nav-item" data-section="ai"><span class="cs-nav-icon">${ICONS.ai}</span> ${t('navAI')}</button>
            <button class="cs-nav-item" data-section="topics"><span class="cs-nav-icon">${ICONS.topics}</span> ${t('navTopics')}</button>
            <button class="cs-nav-item" data-section="hot-topics"><span class="cs-nav-icon">${ICONS['hot-topics']}</span> ${t('navHotTopics')}</button>
            <button class="cs-nav-item" data-section="rules"><span class="cs-nav-icon">${ICONS.rules}</span> ${t('navRules')}</button>
            <button class="cs-nav-item" data-section="recycle"><span class="cs-nav-icon">${ICONS.recycle}</span> ${t('navRecycle')}</button>
            <button class="cs-nav-item" data-section="log"><span class="cs-nav-icon">${ICONS.log}</span> ${t('navLog')}</button>
            <button class="cs-nav-item" data-section="system"><span class="cs-nav-icon">${ICONS.system}</span> ${t('navSystem')}</button>
            <button class="cs-nav-item" data-section="about"><span class="cs-nav-icon">${ICONS.about}</span> ${t('navAbout')}</button>
            <button class="cs-nav-item" data-section="aichat" style="margin-top:8px;border-top:1px solid var(--cs-border);padding-top:8px"><span class="cs-nav-icon">${ICONS.aichat}</span> ${t('navAIChat')}</button>
          </nav>
          <div class="cs-dash-sidebar-footer">
            <div class="cs-lang-switcher" id="cs-lang-switcher">
              <button class="cs-lang-btn" id="cs-dash-lang">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="8"/><path d="M2 10h16M10 2c2.5 2.5 4 5 4 8s-1.5 5.5-4 8c-2.5-2.5-4-5-4-8s1.5-5.5 4-8z"/></svg>
                <span class="cs-lang-current">${(LANGUAGES.find(l => l.code === getLang()) || LANGUAGES[0]).label}</span>
                <span class="cs-lang-arrow">▾</span>
              </button>
              <div class="cs-lang-dropdown" id="cs-lang-dropdown">
                ${LANGUAGES.map(l => `<button class="cs-lang-option ${l.code === getLang() ? 'cs-lang-active' : ''}" data-lang="${l.code}">${l.label}<span class="cs-lang-code">${l.code}</span></button>`).join('')}
              </div>
            </div>
          </div>
        </div>
        <div class="cs-dash-main" id="cs-dash-main">
          <!-- sections rendered dynamically -->
        </div>
        <div class="cs-dash-mobile-nav" id="cs-dash-mobile-nav" style="display:none">
          <button class="cs-dash-mobile-nav-item cs-nav-active" data-section="overview"><span class="cs-dash-mobile-nav-icon">${ICONS.overview}</span>${t('navOverview')}</button>
          <button class="cs-dash-mobile-nav-item" data-section="protection"><span class="cs-dash-mobile-nav-icon">${ICONS.protection}</span>${t('navProtection')}</button>
          <button class="cs-dash-mobile-nav-item" data-section="ai"><span class="cs-dash-mobile-nav-icon">${ICONS.ai}</span>${t('navAI')}</button>
          <button class="cs-dash-mobile-nav-item" data-section="topics"><span class="cs-dash-mobile-nav-icon">${ICONS.topics}</span>${t('navTopics')}</button>
          <button class="cs-dash-mobile-nav-item" data-section="hot-topics"><span class="cs-dash-mobile-nav-icon">${ICONS['hot-topics']}</span>${t('navHotTopics')}</button>
          <button class="cs-dash-mobile-nav-item" data-section="rules"><span class="cs-dash-mobile-nav-icon">${ICONS.rules}</span>${t('navRules')}</button>
          <button class="cs-dash-mobile-nav-item" data-section="log"><span class="cs-dash-mobile-nav-icon">${ICONS.log}</span>${t('navLog')}</button>
          <button class="cs-dash-mobile-nav-item" data-section="system"><span class="cs-dash-mobile-nav-icon">${ICONS.system}</span>${t('navSystem')}</button>
          <button class="cs-dash-mobile-nav-item" data-section="aichat"><span class="cs-dash-mobile-nav-icon">${ICONS.aichat}</span>${t('navAIChat')}</button>
        </div>
      </div>
    `);
    document.body.appendChild(el);
    this._el = el;
    this._renderSection('overview');
    this._bind();
    this._restoreBlocks();
  },

  _bind() {
    const el = this._el;

    delegate(el, '.cs-nav-item[data-section]', 'click', (e, btn) => {
      const section = btn.dataset.section;
      el.querySelectorAll('.cs-nav-item').forEach(n => n.classList.remove('cs-nav-active'));
      btn.classList.add('cs-nav-active');
      this._renderSection(section);
      this._currentSection = section;
      // 进入 AI-Chat 时隐藏顶栏（AI-Chat 头部自有控件）
      const topbar = el.querySelector('.cs-dash-topbar');
      if (topbar) topbar.style.display = (section === 'aichat') ? 'none' : '';
      const mainEl = el.querySelector('#cs-dash-main');
      if (mainEl) mainEl.style.paddingTop = (section === 'aichat') ? '0' : '';
      // Sync mobile nav
      el.querySelectorAll('.cs-dash-mobile-nav-item').forEach(n => n.classList.remove('cs-nav-active'));
      const mobileBtn = el.querySelector(`.cs-dash-mobile-nav-item[data-section="${section}"]`);
      if (mobileBtn) mobileBtn.classList.add('cs-nav-active');
    });

    // Mobile nav
    delegate(el, '.cs-dash-mobile-nav-item[data-section]', 'click', (e, btn) => {
      const section = btn.dataset.section;
      el.querySelectorAll('.cs-dash-mobile-nav-item').forEach(n => n.classList.remove('cs-nav-active'));
      btn.classList.add('cs-nav-active');
      this._renderSection(section);
      this._currentSection = section;
    });

    $el('cs-dash-close', el).addEventListener('click', () => this._close());

    // 语言切换器
    const langBtn = $el('cs-dash-lang', el);
    const langDropdown = $el('cs-lang-dropdown', el);
    if (langBtn && langDropdown) {
      langBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        langDropdown.classList.toggle('cs-lang-open');
      });
      delegate(langDropdown, '.cs-lang-option', 'click', (e, opt) => {
        const newLang = opt.dataset.lang;
        setLang(newLang);
        emit(Events.CONFIG_UPDATED, { type: 'lang' });
        this._renderSection(this._currentSection || 'overview');
        // 更新侧边栏导航文字
        this._updateNavLabels();
        // 更新当前显示
        const cur = langBtn.querySelector('.cs-lang-current');
        if (cur) cur.textContent = (LANGUAGES.find(l => l.code === newLang) || LANGUAGES[0]).label;
        // 更新选项高亮
        langDropdown.querySelectorAll('.cs-lang-option').forEach(o => o.classList.remove('cs-lang-active'));
        opt.classList.add('cs-lang-active');
        langDropdown.classList.remove('cs-lang-open');
      });
      // 点击外部关闭下拉
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#cs-lang-switcher')) {
          langDropdown.classList.remove('cs-lang-open');
        }
      });
    }

    // 主题切换（右上角）
    const themeBtn = $el('cs-dash-theme-top', el);
    if (themeBtn) {
      // 恢复已保存的主题
      try {
        const savedTheme = GM_getValue('cs_theme', '');
        if (savedTheme === 'dark') {
          el.classList.add('cs-theme-dark');
          document.documentElement.classList.add('cs-dash-theme-dark');
        } else if (savedTheme === 'light') {
          el.classList.add('cs-theme-light');
          document.documentElement.classList.add('cs-dash-theme-light');
        }
      } catch (e) { /* ignore */ }
      themeBtn.addEventListener('click', () => {
        const isDark = el.classList.contains('cs-theme-dark') ||
          (!el.classList.contains('cs-theme-light') && window.matchMedia('(prefers-color-scheme:dark)').matches);
        if (isDark) {
          el.classList.remove('cs-theme-dark');
          el.classList.add('cs-theme-light');
          document.documentElement.classList.remove('cs-dash-theme-dark');
          document.documentElement.classList.add('cs-dash-theme-light');
          try { GM_setValue('cs_theme', 'light'); } catch (e) { /* ignore */ }
        } else {
          el.classList.remove('cs-theme-light');
          el.classList.add('cs-theme-dark');
          document.documentElement.classList.remove('cs-dash-theme-light');
          document.documentElement.classList.add('cs-dash-theme-dark');
          try { GM_setValue('cs_theme', 'dark'); } catch (e) { /* ignore */ }
        }
      });
    }

    el.addEventListener('click', (e) => {
      if (e.target.closest('.cs-dash-overlay') && !e.target.closest('.cs-dash-panel')) {
        this._close();
      }
    });

    // 拖拽面板：右上角锁按钮开关控制
    const panel = el.querySelector('.cs-dash-panel');
    const lockBtn = el.querySelector('#cs-dash-lock-toggle');
    let _dragState = null;
    let _dragEnabled = false;
    try { _dragEnabled = !!GM_getValue('cs_drag_unlocked', false); } catch (e) {}
    const _setDragMode = (enabled) => {
      _dragEnabled = enabled;
      el.classList.toggle('cs-drag-enabled', enabled);
      try { GM_setValue('cs_drag_unlocked', enabled); } catch (e) {}
    };
    const _onDragStart = (e) => {
      if (!_dragEnabled) return;
      if (e.button !== 0) return;
      if (e.target.closest('button, a, input, select, textarea, label, [contenteditable], [role="button"], .cs-dash-mobile-nav, .cs-lang-switcher')) return;
      if (getComputedStyle(e.target).overflowY === 'auto' || getComputedStyle(e.target).overflowY === 'scroll') return;
      _dragState = { startX: e.clientX, startY: e.clientY };
      const rect = panel.getBoundingClientRect();
      panel.style.width = rect.width + 'px';
      panel.style.height = rect.height + 'px';
      _dragState.left = rect.left;
      _dragState.top = rect.top;
      panel.style.left = rect.left + 'px';
      panel.style.top = rect.top + 'px';
      panel.style.bottom = 'auto';
      panel.style.right = 'auto';
      panel.style.transform = 'none';
      panel.style.transition = 'none';
      panel.classList.add('cs-dash-dragging');
      e.preventDefault();
    };
    const _onDragMove = (e) => {
      if (!_dragState) return;
      panel.style.left = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, _dragState.left + e.clientX - _dragState.startX)) + 'px';
      panel.style.top = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, _dragState.top + e.clientY - _dragState.startY)) + 'px';
    };
    const _onDragEnd = () => {
      if (!_dragState) return;
      _dragState = null;
      panel.style.transition = '';
      panel.classList.remove('cs-dash-dragging');
    };
    lockBtn.addEventListener('click', () => _setDragMode(!_dragEnabled));
    panel.addEventListener('mousedown', _onDragStart);
    document.addEventListener('mousemove', _onDragMove);
    document.addEventListener('mouseup', _onDragEnd);
    panel.addEventListener('touchstart', (e) => {
      if (!_dragEnabled) return;
      const t = e.touches[0];
      _onDragStart({ button: 0, clientX: t.clientX, clientY: t.clientY, target: e.target, preventDefault: () => e.preventDefault() });
    }, { passive: false });
    document.addEventListener('touchmove', (e) => {
      if (!_dragEnabled) return;
      const t = e.touches[0];
      _onDragMove({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: false });
    document.addEventListener('touchend', _onDragEnd);
    _setDragMode(_dragEnabled);
  },

  // 语言切换后更新侧边栏导航文字
  _updateNavLabels() {
    const el = this._el;
    if (!el) return;
    const labels = {
      overview: t('navOverview'),
      protection: t('navProtection'),
      ai: t('navAI'),
      topics: t('navTopics'),
      'hot-topics': t('navHotTopics'),
      rules: t('navRules'),
      recycle: t('navRecycle'),
      log: t('navLog'),
      system: t('navSystem'),
      about: t('navAbout'),
      aichat: t('navAIChat'),
    };
    el.querySelectorAll('.cs-nav-item[data-section]').forEach(btn => {
      const section = btn.dataset.section;
      const label = labels[section];
      if (label) {
        // 保留图标，只更新文字
        const icon = btn.querySelector('.cs-nav-icon');
        btn.innerHTML = '';
        if (icon) btn.appendChild(icon);
        btn.appendChild(document.createTextNode(' ' + label));
      }
    });
    el.querySelectorAll('.cs-dash-mobile-nav-item[data-section]').forEach(btn => {
      const section = btn.dataset.section;
      const label = labels[section];
      if (label) {
        const icon = btn.querySelector('.cs-dash-mobile-nav-icon');
        btn.innerHTML = '';
        if (icon) btn.appendChild(icon);
        btn.appendChild(document.createTextNode(label));
      }
    });
  },

  _renderSection(section) {
    const main = $el('cs-dash-main', this._el);
    if (!main) return;
    // 保存滚动位置
    const oldSec = main.querySelector('.cs-dash-section');
    const savedScrollTop = oldSec ? oldSec.scrollTop : 0;
    // 切换 section 时清除侧面板残留的动态宽度
    const dashPanel = main.closest('.cs-dash-panel');
    if (dashPanel) {
      dashPanel.style.width = '';
      // 移除历史/调试侧面板，防止切换后面板变形
      dashPanel.querySelector('.cs-chat-history-panel')?.remove();
      dashPanel.querySelector('.cs-chat-debug-panel')?.remove();
    }
    // 清理可能遗留的调试定时器，防止内存泄漏和性能损耗
    if (this._debugInterval) { clearInterval(this._debugInterval); this._debugInterval = null; }
    const renderers = {
      overview: () => this._renderOverview(),
      protection: () => this._renderProtection(),
      ai: () => this._renderAI(),
      topics: () => this._renderTopics(),
      'hot-topics': () => renderHotTopics(this),
      rules: () => this._renderRules(),
      recycle: () => this._renderRecycleBin(),
      log: () => this._renderLog(),
      system: () => this._renderSystem(),
      about: () => this._renderAbout(),
      aichat: () => renderAgentChat(this, this._pendingAgentPrompt || ''),
    };
    const html = (renderers[section] || renderers.overview)();
    const curSection = this._currentSection;
    main.innerHTML = safeHTML(html);
    // 同 section 刷新时恢复滚动位置（异步等待 DOM 渲染）
    if (section === curSection && savedScrollTop > 0) {
      requestAnimationFrame(() => {
        const newSec = main.querySelector('.cs-dash-section');
        if (newSec) newSec.scrollTop = savedScrollTop;
      });
    }
    // Re-append scroll-to-top button (destroyed by innerHTML)
    if (!this._scrollTopBtn) {
      this._scrollTopBtn = document.createElement('button');
      this._scrollTopBtn.className = 'cs-dash-scroll-top';
      this._scrollTopBtn.id = 'cs-dash-scroll-top';
      this._scrollTopBtn.title = t('backToTop') || '回到顶部';
      this._scrollTopBtn.setAttribute('aria-label', t('backToTop') || '回到顶部');
      // 液态水滴图标 + 涟漪光环
      this._scrollTopBtn.innerHTML = `
        <span class="cs-scroll-top-ripple"></span>
        <span class="cs-scroll-top-ripple"></span>
        <svg class="cs-scroll-top-drop" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19V5M5 12l7-7 7 7"/>
        </svg>`;
      this._scrollTopBtn.addEventListener('click', () => {
        const sec = main.querySelector('.cs-dash-section');
        if (sec) sec.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
    main.appendChild(this._scrollTopBtn);
    this._scrollTopBtn.classList.remove('cs-show');
    // Show button when scrolled down
    const scrollSection = main.querySelector('.cs-dash-section');
    if (scrollSection) {
      scrollSection.addEventListener('scroll', () => {
        this._scrollTopBtn.classList.toggle('cs-show', scrollSection.scrollTop > 120);
      }, { passive: true });
    }
    this._bindSection(section);
  },

  _bindSection(section) {
    const binders = {
      overview: () => this._bindOverview(),
      protection: () => this._bindProtection(),
      ai: () => this._bindAI(),
      topics: () => this._bindTopics(),
      'hot-topics': () => {
        const main = $el('cs-dash-main', this._el);
        if (main) {
          renderHotTopicList(this);
          bindHotTopicEvents(main, this);
        }
      },
      rules: () => this._bindRules(),
      recycle: () => this._bindRecycleBin(),
      log: () => this._bindLog(),
      system: () => this._bindSystem(),
      about: () => this._bindAbout(),
      aichat: () => {
        const main = $el('cs-dash-main', this._el);
        if (main) bindAgentEvents(main, this);
      },
    };
    (binders[section] || (() => null))();
  },

  // ─── Overview ──────────────────────────────────────────────

  _renderOverview() {
    const s = this._stats;
    const ai = s.aiStatus || {};
    const aiOn = (ai.mode || this._config.aiMode || 'off') !== 'off';
    const isActive = s.observerActive && s.enabled;
    const statusKey = isActive ? 'statActive' : (s.enabled ? 'statIdle' : 'statStopped');
    const isZh = getLang() === 'zh';
    return `
      <div class="cs-dash-section cs-overview">
        <!-- 守护者状态可视化 -->
        <div class="cs-guardian-hero ${isActive ? 'cs-guardian-active' : ''}">
          <div class="cs-guardian-visual">
            <span class="cs-guardian-aura"></span>
            <span class="cs-guardian-ripple"></span>
            <span class="cs-guardian-ripple"></span>
            <span class="cs-guardian-ripple"></span>
            <span class="cs-guardian-drop">${DROP_SVG}</span>
          </div>
          <div class="cs-guardian-info">
            <div class="cs-guardian-name">Droplet</div>
            <div class="cs-guardian-tagline">${t('guardianTagline')}</div>
            <div class="cs-guardian-status">
              <span class="cs-guardian-dot ${isActive ? 'on' : 'off'}"></span>
              <span class="cs-guardian-status-text">${t(statusKey)}</span>
              <span class="cs-guardian-platform">${s.platform || t('statUnknown')}</span>
            </div>
          </div>
        </div>

        <!-- 液态仪表盘 -->
        <div class="cs-ov-grid">
          <div class="cs-ov-card cs-stagger-item"><div class="cs-ov-num">${s.scanned ?? 0}</div><div class="cs-ov-lbl">${t('statScanned')}</div></div>
          <div class="cs-ov-card cs-ov-card-toxic cs-stagger-item"><div class="cs-ov-num">${s.filtered ?? 0}</div><div class="cs-ov-lbl">${t('statFiltered')}</div></div>
          <div class="cs-ov-card cs-stagger-item"><div class="cs-ov-num">${s.activeRules ?? 0}</div><div class="cs-ov-lbl">${t('activeRules')}</div></div>
          <div class="cs-ov-card cs-stagger-item"><div class="cs-ov-num">${s.spamBlocked ?? 0}</div><div class="cs-ov-lbl">${t('spamBlocked')}</div></div>
        </div>

        <!-- 状态信息 -->
        <div class="cs-dash-block cs-status-block">
          <div class="cs-status-row">
            <span class="cs-block-label">${t('statStatus')}</span>
            <span class="cs-block-val"><span class="cs-dot ${isActive ? 'cs-dot-on' : 'cs-dot-off'}"></span>${t(statusKey)}</span>
          </div>
          <div class="cs-status-row">
            <span class="cs-block-label">${t('statLastScan')}</span>
            <span class="cs-block-val cs-status-time">${s.lastScanTime ? new Date(s.lastScanTime).toLocaleTimeString() : '--:--:--'}</span>
          </div>
          <div class="cs-status-row">
            <span class="cs-block-label">${t('aiMode')}</span>
            <span class="cs-block-val">${aiOn ? getProviderLabel(this._config.aiProvider || ai.provider, t) + ((this._config.aiModel || ai.model) ? ' / ' + (this._config.aiModel || ai.model) : '') + ' (' + (ai.dailyUsed || 0) + '/∞' + ')' : t('aiModeOff')}</span>
          </div>
        </div>

        <!-- AI 自学习状态 -->
        <div class="cs-dash-block cs-learn-block" id="cs-learn-block">
          <div class="cs-learn-block-header">
            <span class="cs-block-label">${t('learnedKeywords')}</span>
            <span class="cs-learn-block-dot ${s.candidatePending > 0 ? 'cs-learn-active' : ''}" id="cs-learn-dot"></span>
          </div>
          <div class="cs-learn-grid">
            <div class="cs-learn-stat"><span class="cs-learn-num" id="cs-learn-activated">${s.learnedRules ?? 0}</span><span class="cs-learn-lbl">${isZh ? '已激活' : 'Activated'}</span></div>
            <div class="cs-learn-stat"><span class="cs-learn-num" id="cs-learn-cand">${s.candidatePending ?? 0}</span><span class="cs-learn-lbl">${isZh ? '待评估' : 'Pending'}</span></div>
            <div class="cs-learn-stat"><span class="cs-learn-num" id="cs-learn-total">${s.candidateTotal ?? 0}</span><span class="cs-learn-lbl">${isZh ? '候选池' : 'Candidates'}</span></div>
          </div>
          <div class="cs-learn-bar">
            <div class="cs-learn-bar-track">
              <div class="cs-learn-bar-fill" style="width:${(s.learnedRules > 0 ? Math.min(100, (s.learnedRules / Math.max(1, s.learnedRules + (s.candidatePending || 0))) * 100) : 0)}%"></div>
            </div>
            <span class="cs-learn-bar-label">${isZh ? '激活率' : 'Activation rate'}</span>
          </div>
          ${s.suggestionsCount > 0 ? `<div class="cs-learn-suggest">${isZh ? '有 ' + s.suggestionsCount + ' 条升级建议待处理' : s.suggestionsCount + ' upgrade suggestions pending'}</div>` : ''}
        </div>

        <!-- 涟漪事件流 -->
        <div class="cs-ripple-feed" id="cs-live-feed">
          <div class="cs-ripple-feed-header">
            <span class="cs-ripple-feed-title">${t('feedTitle')}</span>
            <span class="cs-ripple-feed-pulse"></span>
          </div>
          <div class="cs-ripple-feed-list" id="cs-live-feed-list">${this._renderLiveEvents()}</div>
        </div>

        <div class="cs-dash-actions">
          <button class="cs-btn cs-btn-accent cs-scan-btn" id="cs-dash-scan">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M10 2v4M10 14v4M2 10h4M14 10h4M4.5 4.5l2.8 2.8M12.7 12.7l2.8 2.8M4.5 15.5l2.8-2.8M12.7 7.3l2.8-2.8"/></svg>
            ${t('btnScan')}
          </button>
        </div>
      </div>`;
  },

  _renderLiveEvents() {
    if (!this._liveEvents || !this._liveEvents.length) return '<div class="cs-ripple-empty">' + t('feedEmpty') + '</div>';
    return this._liveEvents.slice(0, 8).map((ev) => {
      const verdictKey = ev.verdict === 'toxic' ? 'feedToxic' : ev.verdict === 'suspicious' ? 'feedSuspicious' : 'feedSafe';
      return '<div class="cs-ripple-item cs-ripple-' + ev.verdict + '">'
        + '<span class="cs-ripple-dot"></span>'
        + '<span class="cs-ripple-verdict">' + t(verdictKey) + '</span>'
        + '<span class="cs-ripple-user">@' + escapeHtml(ev.username || '?') + '</span>'
        + '<span class="cs-ripple-time">' + new Date(ev.timestamp).toLocaleTimeString() + '</span>'
        + '</div>';
    }).join('');
  },

  _bindOverview() {
    const scanBtn = $el('cs-dash-scan', this._el);
    if (scanBtn) {
      scanBtn.addEventListener('click', (e) => {
        scanBtn.classList.add('cs-btn-loading');
        emit(Events.SCANNER_MANUAL_SCAN);
        setTimeout(() => scanBtn.classList.remove('cs-btn-loading'), 1500);
      });
    }
  },

  _renderOverviewBlocks() {
    let html = '';
    for (const [key, block] of Object.entries(this._blocks)) {
      html += `<div class="cs-dash-block" id="cs-block-${key}">${block.html || ''}</div>`;
    }
    return html;
  },

  _restoreBlocks() {
    try { this._blocks = JSON.parse(GM_getValue('cs_dash_blocks', '{}')) || {}; } catch { this._blocks = {}; }
  },

  // ─── Protection ────────────────────────────────────────────

  _renderProtection() {
    const c = this._config;
    const sens = c.sensitivity || 'medium';
    return `
      <div class="cs-dash-section">
        <div class="cs-dash-section-header">
          <h2 class="cs-dash-section-title">${t('sectionBasic')}</h2>
        </div>
        <div class="cs-dash-block">
          <div class="cs-toggle-row">
            <span class="cs-label">${t('protection')}</span>
            <label class="cs-switch"><input type="checkbox" id="cs-dash-enabled" ${c.enabled ? 'checked' : ''}><span class="cs-slider"></span></label>
          </div>
          <div class="cs-toggle-row">
            <span class="cs-label">${t('autoBlock')}</span>
            <label class="cs-switch"><input type="checkbox" id="cs-dash-autoblock" ${c.autoBlock ? 'checked' : ''}><span class="cs-slider"></span></label>
          </div>
        </div>
        <div class="cs-dash-block-label">${t('sensitivity')}</div>
        <div class="cs-sens-options">
          <label class="cs-sens-option ${sens === 'low' ? 'active' : ''}" data-value="low">
            <input type="radio" name="cs-dash-sens" value="low" ${sens === 'low' ? 'checked' : ''}>
            <span class="cs-sens-label">${t('sensLow')}</span><span class="cs-sens-desc">${t('sensLowDesc')}</span>
          </label>
          <label class="cs-sens-option ${sens === 'medium' ? 'active' : ''}" data-value="medium">
            <input type="radio" name="cs-dash-sens" value="medium" ${sens === 'medium' ? 'checked' : ''}>
            <span class="cs-sens-label">${t('sensMedium')}</span><span class="cs-sens-desc">${t('sensMediumDesc')}</span>
          </label>
          <label class="cs-sens-option ${sens === 'high' ? 'active' : ''}" data-value="high">
            <input type="radio" name="cs-dash-sens" value="high" ${sens === 'high' ? 'checked' : ''}>
            <span class="cs-sens-label">${t('sensHigh')}</span><span class="cs-sens-desc">${t('sensHighDesc')}</span>
          </label>
        </div>
        <div id="cs-dash-high-warn" style="display:${sens === 'high' ? '' : 'none'};margin-top:6px;font-size:12px;color:var(--cs-danger);padding:6px 8px;background:var(--cs-toxic-bg);border-radius:6px">${t('sensHighWarning')}</div>
      </div>`;
  },

  _bindProtection() {
    const el = this._el;
    $el('cs-dash-enabled', el)?.addEventListener('change', (e) => {
      this._config.enabled = e.target.checked;
      if (e.target.checked) emit(Events.SCANNER_START);
      else emit(Events.SCANNER_STOP);
    });
    $el('cs-dash-autoblock', el)?.addEventListener('change', (e) => {
      this._config.autoBlock = e.target.checked;
    });
    el.querySelectorAll('input[name="cs-dash-sens"]').forEach(r => {
      r.addEventListener('change', (e) => {
        if (!e.target.checked) return;
        this._config.sensitivity = e.target.value;
        el.querySelectorAll('.cs-sens-option').forEach(o => o.classList.remove('active'));
        e.target.closest('.cs-sens-option').classList.add('active');
        const w = $el('cs-dash-high-warn', el);
        if (w) w.style.display = e.target.value === 'high' ? '' : 'none';
      });
    });
  },

  // ─── AI Settings ───────────────────────────────────────────

  _renderAI() {
    const c = this._config;
    const aiMode = c.aiMode || 'eco';
    const provider = c.aiProvider || 'claude';
    return `
      <div class="cs-dash-section">
        <div class="cs-dash-section-header">
          <h2 class="cs-dash-section-title">${t('sectionAI')}</h2>
        </div>
        <div class="cs-dash-block">
          <div class="cs-toggle-row">
            <span class="cs-label">${t('aiMode')}</span>
            <select class="cs-select cs-select-sm" id="cs-dash-ai-mode">
              <option value="off" ${aiMode === 'off' ? 'selected' : ''}>${t('aiModeOff')}</option>
              <option value="eco" ${aiMode === 'eco' ? 'selected' : ''}>${t('aiModeEco')}</option>
              <option value="full" ${aiMode === 'full' ? 'selected' : ''}>${t('aiModeFull')}</option>
            </select>
          </div>
          <div class="cs-hint" id="cs-dash-ai-hint">${aiMode === 'off' ? t('aiModeOffDesc') : aiMode === 'full' ? t('aiModeFullDesc') : t('aiModeEcoDesc')}</div>
          <div class="cs-toggle-row" style="margin-top:4px">
            <span class="cs-label">${t('aiUpgradeMode')}</span>
            <select class="cs-select cs-select-sm" id="cs-dash-ai-upgrade">
              <option value="agent" ${(!c.aiUpgradeMode || c.aiUpgradeMode === 'agent') ? 'selected' : ''}>${t('aiUpgradeAgent')}</option>
              <option value="suggest" ${c.aiUpgradeMode === 'suggest' ? 'selected' : ''}>${t('aiUpgradeSuggest')}</option>
            </select>
          </div>
        </div>
        <div class="cs-dash-block">
          <div class="cs-dash-block-label">${t('aiProvider')}</div>
          <select class="cs-select" id="cs-dash-ai-provider">
            <option value="claude" ${provider === 'claude' ? 'selected' : ''}>${t('aiProviderClaude')}</option>
            <option value="openai" ${provider === 'openai' ? 'selected' : ''}>${t('aiProviderOpenAI')}</option>
            <option value="deepseek" ${provider === 'deepseek' ? 'selected' : ''}>${t('aiProviderDeepSeek')}</option>
            <option value="glm" ${provider === 'glm' ? 'selected' : ''}>${t('aiProviderGLM')}</option>
            <option value="kimi" ${provider === 'kimi' ? 'selected' : ''}>${t('aiProviderKimi')}</option>
            <option value="gemini" ${provider === 'gemini' ? 'selected' : ''}>${t('aiProviderGemini')}</option>
            <option value="openrouter" ${provider === 'openrouter' ? 'selected' : ''}>${t('aiProviderOpenRouter')}</option>
            <option value="groq" ${provider === 'groq' ? 'selected' : ''}>Groq</option>
            <option value="custom" ${provider === 'custom' ? 'selected' : ''}>${t('aiProviderCustom')}</option>
          </select>
          <div class="cs-dash-block-label" style="margin-top:6px">${t('apiKey')}</div>
          <input type="password" class="cs-input" id="cs-dash-api-key" placeholder="${t('apiKeyPlaceholder')}" value="${c.apiKey || ''}">
          <div class="cs-dash-block-label" style="margin-top:6px">${t('aiEndpoint')}</div>
          <input type="text" class="cs-input" id="cs-dash-ai-endpoint" placeholder="${t('aiEndpointPlaceholder')}" value="${c.aiEndpoint || ''}">
          <div class="cs-dash-block-label" style="margin-top:6px">${t('aiModel')}</div>
          <input type="text" class="cs-input" id="cs-dash-ai-model" placeholder="${t('aiModelPlaceholder')}" value="${c.aiModel || ''}">
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <button class="cs-btn cs-btn-sm" id="cs-dash-ai-test">${t('aiTestBtn')}</button>
            <span id="cs-dash-ai-result" class="cs-hint" style="margin:0"></span>
          </div>
          <div id="cs-dash-ai-status" class="cs-hint" style="margin-top:4px">${!c.apiKey ? t('aiNoKey') : ''}</div>
        </div>
        <div class="cs-dash-block" id="cs-dash-ai-suggestions">
          <div class="cs-dash-block-label" style="display:flex;align-items:center;justify-content:space-between">
            <span>${t('suggestReviewTitle')}</span>
            <span id="cs-dash-suggest-badge" style="font-size:11px;background:var(--cs-accent);color:#fff;border-radius:9px;padding:0 7px;line-height:18px;display:none">0</span>
          </div>
          <div id="cs-dash-suggest-list"></div>
        </div>
      </div>`;
  },

  _bindAI() {
    const el = this._el;
    $el('cs-dash-ai-mode', el)?.addEventListener('change', (e) => {
      this._config.aiMode = e.target.value;
      this._config.aiEnabled = e.target.value !== 'off';
      const hint = $el('cs-dash-ai-hint', el);
      if (hint) hint.textContent = e.target.value === 'off' ? t('aiModeOffDesc') : e.target.value === 'full' ? t('aiModeFullDesc') : t('aiModeEcoDesc');
      if (this._scanner) this._scanner.updateAIConfig({ aiMode: this._config.aiMode, aiEnabled: this._config.aiEnabled });
      emit(Events.CONFIG_UPDATED, { type: 'ai' });
    });
    $el('cs-dash-ai-upgrade', el)?.addEventListener('change', (e) => {
      this._config.aiUpgradeMode = e.target.value;
      if (this._scanner?.ruleLearner) this._scanner.ruleLearner.config = this._config;
    });
    $el('cs-dash-ai-provider', el)?.addEventListener('change', (e) => {
      this._config.aiProvider = e.target.value;
      const endpoints = { openai: 'https://api.openai.com/v1/chat/completions', deepseek: 'https://api.deepseek.com/chat/completions', glm: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', kimi: 'https://api.moonshot.cn/v1/chat/completions', gemini: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', openrouter: 'https://openrouter.ai/api/v1/chat/completions', groq: 'https://api.groq.com/openai/v1/chat/completions' };
      // ★ 切换 provider 时同步重置默认 model，避免旧 provider 的模型名污染新 provider
      const defaultModels = { openai: 'gpt-4o-mini', deepseek: 'deepseek-chat', glm: 'glm-4-flash', kimi: 'moonshot-v1-8k', gemini: 'gemini-2.0-flash', openrouter: 'openai/gpt-4o-mini', groq: 'llama-3.3-70b-versatile', claude: 'claude-sonnet-4-20250514', mimo: 'mimo-v2-flash', custom: '' };
      const newModel = defaultModels[e.target.value] ?? '';
      if (endpoints[e.target.value]) {
        $el('cs-dash-ai-endpoint', el).value = endpoints[e.target.value];
        this._config.aiEndpoint = endpoints[e.target.value];
      }
      $el('cs-dash-ai-model', el).value = newModel;
      this._config.aiModel = newModel;
      if (this._scanner) this._scanner.updateAIConfig({ aiProvider: this._config.aiProvider, aiEndpoint: this._config.aiEndpoint, aiModel: this._config.aiModel });
    });
    $el('cs-dash-api-key', el)?.addEventListener('change', (e) => {
      this._config.apiKey = e.target.value.trim();
      if (this._scanner) this._scanner.updateAIConfig({ apiKey: this._config.apiKey });
    });
    $el('cs-dash-ai-endpoint', el)?.addEventListener('change', (e) => {
      this._config.aiEndpoint = e.target.value.trim();
      if (this._scanner) this._scanner.updateAIConfig({ aiEndpoint: this._config.aiEndpoint });
    });
    $el('cs-dash-ai-model', el)?.addEventListener('change', (e) => {
      this._config.aiModel = e.target.value.trim();
      if (this._scanner) this._scanner.updateAIConfig({ aiModel: this._config.aiModel });
    });
    $el('cs-dash-ai-test', el)?.addEventListener('click', async () => {
      const btn = $el('cs-dash-ai-test', el);
      const result = $el('cs-dash-ai-result', el);
      if (btn.dataset.testing === '1') return;
      btn.dataset.testing = '1';
      if (result) result.textContent = '...';
      if (this._scanner?.aiAnalyzer) {
        const res = await Promise.race([
          this._scanner.aiAnalyzer.validateKey(),
          new Promise(r => setTimeout(() => r({ ok: false, error: 'Timeout (20s)' }), 20000)),
        ]);
        if (result) {
          result.textContent = res.ok ? t('aiKeyValid') : t('aiKeyInvalid') + (res.error ? ': ' + res.error : '');
          result.style.color = res.ok ? 'var(--cs-success)' : 'var(--cs-danger)';
        }
      }
      btn.dataset.testing = '0';
    });
    this._renderSuggestions();
  },

  _renderSuggestions() {
    const container = $el('cs-dash-suggest-list', this._el);
    const badge = $el('cs-dash-suggest-badge', this._el);
    if (!container) return;
    const suggestions = this._scanner?.ruleLearner?.getPendingSuggestions?.() || [];
    if (badge) {
      badge.textContent = String(suggestions.length);
      badge.style.display = suggestions.length > 0 ? '' : 'none';
    }
    if (!suggestions.length) {
      container.innerHTML = `<div class="cs-hint" style="margin:4px 0">${t('suggestReviewEmpty')}</div>`;
      return;
    }
    let html = '';
    for (const s of suggestions) {
      const conf = Math.round((s.avgConfidence || 0) * 100);
      const evCount = s.evidence?.length || 0;
      html += `
        <div class="cs-suggest-item" data-trigger="${escapeHtml(s.trigger)}">
          <div class="cs-suggest-word">${escapeHtml(s.trigger)}</div>
          <div class="cs-suggest-meta">
            <span class="cs-suggest-conf">${conf}%</span>
            <span class="cs-suggest-evidence">${t('suggestHitCount', { n: evCount })}</span>
          </div>
          <div class="cs-suggest-actions">
            <button class="cs-btn cs-btn-xs cs-btn-accent cs-suggest-confirm" data-trigger="${escapeHtml(s.trigger)}">${t('suggestConfirm')}</button>
            <button class="cs-btn cs-btn-xs cs-btn-danger cs-suggest-reject" data-trigger="${escapeHtml(s.trigger)}">${t('suggestReject')}</button>
          </div>
        </div>`;
    }
    container.innerHTML = safeHTML(html);
    // 用事件委托替代 querySelectorAll，避免每次重渲染重复绑定
    if (!container._suggestDelegated) {
      container._suggestDelegated = true;
      delegate(container, '.cs-suggest-confirm', 'click', (e, btn) => {
        const trigger = btn.dataset.trigger;
        if (this._scanner?.ruleLearner?.confirmUpgrade(trigger)) {
          this._renderSuggestions();
          this._scanner.detector.hardKeywords.add(trigger);
          emit(Events.CONFIG_UPDATED, { type: 'keyword_upgrade' });
        }
      });
      delegate(container, '.cs-suggest-reject', 'click', (e, btn) => {
        const trigger = btn.dataset.trigger;
        if (this._scanner?.ruleLearner?.rejectUpgrade(trigger)) {
          this._renderSuggestions();
        }
      });
    }
  },

  // ─── 添加AI规则对话框（选择话题）──────────────────────────────

  _showAddAIRuleDialog() {
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
          <span>${t('topicAddAiRule')}</span>
          <button class="cs-dash-modal-close">&times;</button>
        </div>
        <div class="cs-modal-body" style="display:flex;flex-direction:column;gap:10px">
          <div class="cs-form-row">
            <label class="cs-form-label">${curLang === 'zh' ? '选择话题' : 'Select Topic'}</label>
            <select class="cs-input" id="cs-add-ai-rule-topic">
              ${topics.map(t => `<option value="${t.id}">${t.label?.[curLang] || t.label?.zh || t.id}</option>`).join('')}
            </select>
          </div>
          <div class="cs-form-row">
            <label class="cs-form-label">${curLang === 'zh' ? '触发词' : 'Trigger Word'}</label>
            <input type="text" class="cs-input" id="cs-add-ai-rule-trigger" placeholder="${curLang === 'zh' ? '如：职场PUA' : 'e.g. gaslighting'}">
          </div>
          <div class="cs-form-row">
            <label class="cs-form-label">${curLang === 'zh' ? '置信度' : 'Confidence'}</label>
            <input type="number" class="cs-input" id="cs-add-ai-rule-confidence" value="0.85" min="0" max="1" step="0.05" style="width:100px">
          </div>
          <div class="cs-form-actions">
            <button class="cs-btn cs-btn-sm cs-btn-accent" id="cs-add-ai-rule-save">${curLang === 'zh' ? '保存' : 'Save'}</button>
            <button class="cs-btn cs-btn-sm cs-btn-ghost cs-dash-modal-close-btn">${curLang === 'zh' ? '取消' : 'Cancel'}</button>
          </div>
        </div>
      </div>`, { id: 'cs-dash-modal' });

    document.getElementById('cs-add-ai-rule-save')?.addEventListener('click', () => {
      const topicId = document.getElementById('cs-add-ai-rule-topic')?.value;
      const trigger = document.getElementById('cs-add-ai-rule-trigger')?.value?.trim();
      const confidence = parseFloat(document.getElementById('cs-add-ai-rule-confidence')?.value || '0.85');

      if (!topicId || !trigger) { alert(curLang === 'zh' ? '请填写完整' : 'Please fill all fields'); return; }

      if (tf.addAIRule(topicId, trigger, confidence)) {
        this._pushUndo({ type: 'add_ai_rule', topicId, trigger });
        modal.remove();
        this._renderTopicList();
        this.showToast(curLang === 'zh' ? `AI规则"${trigger}"已添加` : `AI rule "${trigger}" added`, 'success');
      } else {
        alert(curLang === 'zh' ? '添加失败，规则可能已存在' : 'Failed, rule may already exist');
      }
    });
  },

  // ─── 在话题详情中添加AI规则 ──────────────────────────────────

  _showAddAIRuleToTopicDialog(topicId, tf, parentModal) {
    const curLang = getLang();
    const trigger = prompt(curLang === 'zh' ? '输入AI规则触发词：' : 'Enter AI rule trigger:');
    if (!trigger || !trigger.trim()) return;
    if (tf.addAIRule(topicId, trigger.trim())) {
      this._pushUndo({ type: 'add_ai_rule', topicId, trigger: trigger.trim() });
      parentModal.remove();
      this._renderTopicList();
      this.showToast(curLang === 'zh' ? `AI规则"${trigger.trim()}"已添加` : `AI rule "${trigger.trim()}" added`, 'success');
    } else {
      alert(curLang === 'zh' ? '添加失败，规则可能已存在' : 'Failed, rule may already exist');
    }
  },

  // ─── Event subscriptions ──────────────────────────────────

  _listen() {
    this._unsub = [
      on(Events.STATS_UPDATE, (data) => {
        Object.assign(this._stats, data);
        if (this._currentSection === 'overview') this._renderSection('overview');
      }),
      on(Events.SCAN_RESULT, (data) => {
        const entry = {
          text: data.text || '',
          username: data.username || '?',
          verdict: data.verdict || 'safe',
          reason: data.reason || '',
          confidence: data.confidence || 0,
          contentType: data.contentType || 'comment',
          uid: data.uid || null,
          timestamp: data.timestamp || Date.now(),
          layer: data.layer || 1,
          aiDetected: !!data.aiDetected,
          aiSummary: data.aiSummary || '',
          hitKeywords: data.hitKeywords || data.matched || [],
          _id: (data.timestamp || Date.now()) + '_' + Math.random().toString(36).slice(2, 7),
        };
        this._scanLog.unshift(entry);
        if (this._scanLog.length > 200) this._scanLog.length = 200;
        this._liveEvents.unshift({
          verdict: data.verdict || 'safe', username: data.username || '?',
          timestamp: data.timestamp || Date.now(),
        });
        if (this._liveEvents.length > 20) this._liveEvents.length = 20;
        if (this._currentSection === 'overview') this._renderSection('overview');
        if (this._currentSection === 'log') this._renderSection('log');
      }),
    ];
  },

  // ─── 公共方法 ──────────────────────────────────────────────

  open() {
    this._el?.classList.add('cs-dash-open');
    emit(Events.DASHBOARD_OPEN);
  },

  close() {
    this._el?.classList.remove('cs-dash-open');
    emit(Events.DASHBOARD_CLOSE);
  },

  showToast(message, type = 'info') {
    let container = document.getElementById('cs-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'cs-toast-container';
      container.className = 'cs-toast-container';
      document.body.appendChild(container);
    }
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M20 6 9 17l-5-5"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" style="width:16px;height:16px"><path d="M18 6 6 18M6 6l12 12"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
    };
    const toast = document.createElement('div');
    toast.className = `cs-toast cs-toast-${type}`;
    toast.innerHTML = safeHTML(`<span class="cs-toast-icon">${icons[type] || icons.info}</span><span>${escapeHtml(message)}</span>`);
    container.appendChild(toast);
    // 自动移除 + fallback 防止 animation 不触发
    const remove = () => { toast.remove(); };
    setTimeout(() => {
      toast.classList.add('cs-toast-out');
      toast.addEventListener('animationend', remove, { once: true });
      // fallback: 如果 animation 没触发，1s 后强制移除
      setTimeout(remove, 1000);
    }, 2000);
  },

  _close() {
    this.close();
  },

  updateStats(stats) {
    this._stats = { ...this._stats, ...stats };
  },

  addScanLog(entry) {
    this._scanLog.unshift(entry);
    if (this._scanLog.length > 200) this._scanLog.length = 200;
  },

  destroy() {
    this._unsub.forEach(fn => fn());
    this._el?.remove();
  },
};
