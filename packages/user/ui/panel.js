/**
 * panel.js — Panel orchestrator
 *
 * 主入口文件，导入各子模块并组装 Panel。
 * CSS 样式抽离至 panel-styles.js。
 */
import { t, toggleLang } from '../../core/i18n.js';
import { on, emit, Events } from '../../core/events.js';
import { Overlay } from './panels/panel-overlay.js';
import { Dashboard } from './panels/panel-dashboard.js';
import { PANEL_CSS, DEBUG_PANEL_CSS } from './panel-styles.js';
import { $el, delegate } from './utils.js';

// ─── Command Layer — Ctrl+K palette + right-click ──────────

const CommandLayer = {
  _el: null,
  _config: null,
  _scanner: null,
  _commands: [],

  mount(config, scanner) {
    this._config = config;
    this._scanner = scanner;
    this._scanLog = [];
    this._agentHistory = [];
    this._inject();
    this._bind();
  },

  _initCommands() {
    this._commands = [
      { id: 'toggle', label: () => this._config.enabled ? t('btnStop') : t('btnStart'), action: () => {
        this._config.enabled = !this._config.enabled;
        emit(this._config.enabled ? Events.SCANNER_START : Events.SCANNER_STOP);
        this._initCommands();
      }},
      { id: 'scan', label: () => t('btnScan'), action: () => emit(Events.SCANNER_MANUAL_SCAN) },
      { id: 'dashboard', label: () => t('tabControl'), action: () => emit(Events.DASHBOARD_OPEN) },
      { id: 'evidence', label: () => t('evidence'), action: () => emit(Events.STATS_UPDATE, {}) },
      { id: 'lang', label: () => t('langSwitchHint'), action: () => { toggleLang(); emit(Events.CONFIG_UPDATED, { type: 'lang' }); }},
    ];
  },

  _inject() {
    const el = document.createElement('div');
    el.id = 'cs-command-layer';
    el.innerHTML = `
      <div class="cs-cmd-overlay cs-hidden" id="cs-cmd-overlay">
        <div class="cs-cmd-palette">
          <input type="text" class="cs-cmd-input" id="cs-cmd-input" placeholder="Type a command..." autofocus>
          <div class="cs-cmd-list" id="cs-cmd-list"></div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    this._el = el;
  },

  _bind() {
    const overlay = $el('cs-cmd-overlay', this._el);
    const input = $el('cs-cmd-input', this._el);

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this._togglePalette();
      }
      if (e.key === 'Escape') this._hidePalette();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._hidePalette();
    });

    input.addEventListener('input', () => this._renderCommands());
    // 命令列表事件委托（只绑定一次，避免每次输入重绑）
    const list = $el('cs-cmd-list', this._el);
    delegate(list, '.cs-cmd-item', 'click', (e, item) => {
      const cmd = this._commands.find(c => c.id === item.dataset.cmd);
      if (cmd) { cmd.action(); this._hidePalette(); }
    });
    delegate(list, '.cs-cmd-item', 'mouseover', (e, item) => {
      list.querySelectorAll('.cs-cmd-highlight').forEach(el => el.classList.remove('cs-cmd-highlight'));
      item.classList.add('cs-cmd-highlight');
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const items = overlay.querySelectorAll('.cs-cmd-item');
        const hl = overlay.querySelector('.cs-cmd-highlight');
        if (hl) { hl.click(); return; }
        if (items.length) items[0].click();
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); this._moveHighlight(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); this._moveHighlight(-1); }
    });

    document.addEventListener('contextmenu', (e) => {
      const target = e.target.closest('[class*="comment"],[class*="reply"],[class*="message"],article');
      if (!target) return;
      const text = target.innerText?.trim();
      if (!text || text.length < 5) return;
      e.preventDefault();
      this._showContextMenu(e.clientX, e.clientY, target, text);
    });

    document.addEventListener('click', () => {
      const ctx = document.getElementById('cs-context-menu');
      if (ctx) ctx.remove();
    });
  },

  _togglePalette() {
    const overlay = $el('cs-cmd-overlay', this._el);
    const hidden = overlay.classList.contains('cs-hidden');
    overlay.classList.toggle('cs-hidden', !hidden);
    if (hidden) {
      this._renderCommands();
      setTimeout(() => $el('cs-cmd-input', this._el)?.focus(), 50);
    }
  },

  _hidePalette() {
    $el('cs-cmd-overlay', this._el)?.classList.add('cs-hidden');
  },

  _renderCommands() {
    const list = $el('cs-cmd-list', this._el);
    const input = $el('cs-cmd-input', this._el);
    if (!list) return;
    const q = (input?.value || '').toLowerCase();
    const filtered = q ? this._commands.filter(c => c.label().toLowerCase().includes(q)) : this._commands;
    list.innerHTML = filtered.map((c, i) =>
      `<div class="cs-cmd-item ${i === 0 ? 'cs-cmd-highlight' : ''}" data-cmd="${c.id}" data-index="${i}">${c.label()}<span class="cs-cmd-key">${c.id}</span></div>`
    ).join('');
  },

  _moveHighlight(dir) {
    const items = this._el.querySelectorAll('.cs-cmd-item');
    let idx = -1;
    items.forEach((item, i) => { if (item.classList.contains('cs-cmd-highlight')) idx = i; });
    const next = Math.max(0, Math.min(items.length - 1, idx + dir));
    items.forEach(e => e.classList.remove('cs-cmd-highlight'));
    if (items[next]) {
      items[next].classList.add('cs-cmd-highlight');
      items[next].scrollIntoView({ block: 'nearest' });
    }
  },

  _showContextMenu(x, y, target, text) {
    const existing = document.getElementById('cs-context-menu');
    if (existing) existing.remove();
    const menu = document.createElement('div');
    menu.id = 'cs-context-menu';
    menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:2147483647;background:var(--cs-bg,#fff);border:1px solid var(--cs-border,#e5e7eb);border-radius:10px;padding:4px;box-shadow:0 4px 20px rgba(0,0,0,0.15);min-width:180px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;`;
    menu.innerHTML = `
      <div class="cs-cmd-item" data-action="blockUser">${t('contextBlockUser')}</div>
      <div class="cs-cmd-item" data-action="settings">${t('contextSettings')}</div>
      <div class="cs-cmd-item" data-action="log">${t('tabLog')}</div>
      <div class="cs-cmd-item" data-action="evidence">${t('evidence')}</div>
    `;
    document.body.appendChild(menu);
    menu.querySelectorAll('.cs-cmd-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        if (action === 'blockUser' && this._scanner?.blocker) {
          const username = this._extractContextUsername(target, text);
          if (username) {
            this._scanner.blocker.block(username, target);
            GM_notification({ title: 'Droplet', text: t('contextBlockDone', { user: username }) });
          } else {
            GM_notification({ title: 'Droplet', text: t('contextBlockFail') });
          }
        }
        if (action === 'settings') {
          menu.remove();
          this.open();
          this._renderSection('protection');
        }
        if (action === 'log') {
          menu.remove();
          this.open();
          this._renderSection('log');
        }
        if (action === 'evidence') this._showEvidenceModal();
        menu.remove();
      });
    });
  },

  _extractContextUsername(target, text) {
    const dataUser = target.dataset?.user || target.dataset?.username || target.dataset?.author || target.dataset?.name || target.dataset?.mid;
    if (dataUser) return dataUser.replace(/^@/, '');
    const parentWithData = target.closest('[data-user],[data-username],[data-author],[data-name],[data-mid]');
    if (parentWithData) {
      const d = parentWithData.dataset?.user || parentWithData.dataset?.username || parentWithData.dataset?.author || parentWithData.dataset?.name || parentWithData.dataset?.mid;
      if (d) return d.replace(/^@/, '');
    }
    const links = target.querySelectorAll('a[href*="space.bilibili.com"], a[href*="user"], a[href*="profile"]');
    for (const a of links) {
      const m = a.href.match(/(?:space\.bilibili\.com|user|profile)\/(\d+)/i);
      if (m) return m[1];
    }
    const atMention = text.match(/@(\w+)/);
    if (atMention) return atMention[1];
    const firstLine = (text.split('\n')[0] || '').trim().split(/\s+/)[0];
    if (firstLine && firstLine.length >= 2 && firstLine.length <= 30) return firstLine;
    return null;
  },

  destroy() {
    this._el?.remove();
    document.querySelector('#cs-context-menu')?.remove();
  },
};

// ─── Panel orchestrator ────────────────────────────────────

export const Panel = {
  _overlay: null,
  _dashboard: null,
  _cmdLayer: null,
  _config: null,
  _scanner: null,
  _stats: {},
  _unsub: [],
  DEV_MODE: false,

  mount(config, scanner, devMode) {
    this.DEV_MODE = !!devMode;
    this._config = config;
    this._scanner = scanner;

    this._overlay = Overlay;
    this._dashboard = Dashboard;
    this._cmdLayer = CommandLayer;

    this._overlay.mount(config, scanner);
    this._dashboard.mount(config, scanner, this.DEV_MODE);
    this._cmdLayer.mount(config, scanner);

    this._listen();
    this._injectStyles();
  },

  setAgentEngine(engine) {
    this._dashboard.setAgentEngine(engine);
  },

  _listen() {
    this._unsub = [
      on(Events.DASHBOARD_OPEN, () => this._dashboard.open()),
      on(Events.STATS_UPDATE, (data) => {
        Object.assign(this._stats, data);
        this._overlay._updateStats(data);
      }),
    ];
  },

  _injectStyles() {
    if (document.getElementById('cs-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'cs-panel-styles';
    style.textContent = PANEL_CSS.replace('#__CS_DEBUG_PANEL_CSS_PLACEHOLDER__', DEBUG_PANEL_CSS);
    document.head.appendChild(style);
  },

  destroy() {
    this._unsub.forEach(fn => fn());
    if (this._overlay) this._overlay.destroy();
    if (this._dashboard) this._dashboard.destroy();
    if (this._cmdLayer) this._cmdLayer.destroy();
  },
};
