/**
 * panel-overlay.js — 浮动盾牌按钮 + 实时统计
 */
import { t } from '../../../core/i18n.js';
import { on, emit, Events } from '../../../core/events.js';
import { safeHTML, $el, getProviderLabel } from '../utils.js';

export const Overlay = {
  _el: null,
  _stats: {},
  _unsub: [],

  mount(config, scanner) {
    this._config = config;
    this._scanner = scanner;
    this._inject();
    this._listen();
  },

  _inject() {
    const el = document.createElement('div');
    el.id = 'cs-overlay';
    const dropSvg = '<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="dr-ov-drop" x1="14" y1="2" x2="14" y2="26" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="var(--cs-accent-hover,#7dd3fc)"/><stop offset="50%" stop-color="var(--cs-accent,#38bdf8)"/><stop offset="100%" stop-color="var(--cs-accent,#0284c7)"/></linearGradient></defs><path d="M14 2C14 2 4 11 4 17C4 22.5 8.5 26 14 26C19.5 26 24 22.5 24 17C24 11 14 2 14 2Z" fill="url(#dr-ov-drop)"/><ellipse cx="10" cy="13" rx="3" ry="4.5" fill="white" fill-opacity="0.25" transform="rotate(-20 10 13)"/></svg>';
    el.innerHTML = safeHTML(`
      <button id="cs-shield-btn" class="cs-shield-btn" title="Droplet">
        <span class="cs-shield-ripple"></span>
        <span class="cs-shield-ripple"></span>
        <span class="cs-shield-drop">${dropSvg}</span>
      </button>
      <div id="cs-overlay-card" class="cs-overlay-card cs-hidden">
        <div class="cs-overlay-header">
          <span class="cs-overlay-title">Droplet</span>
          <span class="cs-overlay-dot" id="cs-overlay-dot"></span>
        </div>
        <div class="cs-overlay-stats">
          <div class="cs-overlay-stat"><span class="cs-stat-num" id="cs-ov-scanned">0</span><span class="cs-stat-lbl">${t('statScanned')}</span></div>
          <div class="cs-overlay-stat"><span class="cs-stat-num cs-stat-num-toxic" id="cs-ov-filtered">0</span><span class="cs-stat-lbl">${t('statFiltered')}</span></div>
          <div class="cs-overlay-stat"><span class="cs-stat-num" id="cs-ov-rules">0</span><span class="cs-stat-lbl">${t('activeRules')}</span></div>
        </div>
        <div class="cs-overlay-ai" id="cs-overlay-ai">
          <span class="cs-overlay-ai-label">${t('aiMode')}</span>
          <span class="cs-overlay-ai-val" id="cs-ov-ai-info">${t('aiModeOff')}</span>
        </div>
        <div class="cs-overlay-learn" id="cs-overlay-learn">
          <span class="cs-overlay-learn-dot" id="cs-overlay-learn-dot"></span>
          <span class="cs-overlay-learn-label">${t('learnedKeywords')}</span>
          <span class="cs-overlay-learn-val" id="cs-ov-learned">0</span>
          <span class="cs-overlay-learn-cand" id="cs-ov-cand"></span>
        </div>
        <div class="cs-overlay-actions">
          <button class="cs-ov-btn" id="cs-ov-dashboard">${t('tabControl')}</button>
          <button class="cs-ov-btn" id="cs-ov-toggle">${this._config.enabled ? t('btnStop') : t('btnStart')}</button>
        </div>
      </div>
    `);
    document.body.appendChild(el);
    this._el = el;
    this._bind();
  },

  _bind() {
    const el = this._el;
    const shield = $el('cs-shield-btn', el);
    let dragMoved = false;
    const onStart = (e) => {
      const t = e.target.closest('#cs-shield-btn');
      if (!t) return;
      dragMoved = false;
      const rect = el.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      el._dragOffX = p.clientX - rect.left;
      el._dragOffY = p.clientY - rect.top;
      el.style.left = rect.left + 'px';
      el.style.top = rect.top + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el._dragging = true;
    };
    const onMove = (e) => {
      if (!el._dragging) return;
      const p = e.touches ? e.touches[0] : e;
      el.style.left = Math.max(0, p.clientX - el._dragOffX) + 'px';
      el.style.top = Math.max(0, p.clientY - el._dragOffY) + 'px';
      dragMoved = true;
    };
    const onEnd = () => {
      if (!el._dragging) return;
      el._dragging = false;
    };
    shield.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    shield.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    shield.addEventListener('click', () => {
      if (dragMoved) { dragMoved = false; return; }
      this._toggleCard();
    });
    $el('cs-ov-dashboard', el).addEventListener('click', () => {
      this._hideCard();
      emit(Events.DASHBOARD_OPEN);
    });
    $el('cs-ov-toggle', el).addEventListener('click', () => {
      if (this._config.enabled) {
        this._config.enabled = false;
        emit(Events.SCANNER_STOP);
      } else {
        this._config.enabled = true;
        emit(Events.SCANNER_START);
      }
      this._updateToggleBtn();
    });
  },

  _toggleCard() {
    const card = $el('cs-overlay-card', this._el);
    const hidden = card.classList.contains('cs-hidden');
    card.classList.toggle('cs-hidden', !hidden);
    if (!hidden) {
      card.style.top = '';
      card.style.bottom = '';
      card.style.left = '';
      card.style.right = '';
      emit(Events.OVERLAY_TOGGLE, { open: true });
      return;
    }
    this._positionCard(card);
  },

  _positionCard(card) {
    if (!card) return;
    const shield = $el('cs-shield-btn', this._el);
    if (!shield) {
      card.style.top = ''; card.style.bottom = '';
      card.style.left = ''; card.style.right = '';
      return;
    }
    const rect = shield.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const inRightHalf = centerX > vw / 2;
    const inBottomHalf = centerY > vh / 2;

    card.style.top = ''; card.style.bottom = '';
    card.style.left = ''; card.style.right = '';

    if (!inRightHalf) {
      card.style.right = 'auto';
      card.style.left = '0';
    }
    if (!inBottomHalf) {
      card.style.bottom = 'auto';
      card.style.top = '62px';
    }

    requestAnimationFrame(() => {
      if (!card.isConnected || card.classList.contains('cs-hidden')) return;
      const cardRect = card.getBoundingClientRect();
      let shiftX = 0, shiftY = 0;
      if (cardRect.left < 8) shiftX = 8 - cardRect.left;
      if (cardRect.right > vw - 8) shiftX = (vw - 8) - cardRect.right;
      if (cardRect.top < 8) shiftY = 8 - cardRect.top;
      if (cardRect.bottom > vh - 8) shiftY = (vh - 8) - cardRect.bottom;

      if (shiftX || shiftY) {
        card.style.transform = `translate(${shiftX}px, ${shiftY}px)`;
        card.style.transition = 'transform 0.15s ease';
        const cleanup = () => {
          card.style.transform = '';
          card.style.transition = '';
        };
        setTimeout(cleanup, 300);
        card.addEventListener('transitionend', cleanup, { once: true });
      }
    });
  },

  _hideCard() {
    $el('cs-overlay-card', this._el).classList.add('cs-hidden');
  },

  _listen() {
    this._unsub = [
      on(Events.STATS_UPDATE, (data) => this._updateStats(data)),
      on(Events.OVERLAY_TOGGLE, (d) => { if (!d.open) this._hideCard(); }),
      on(Events.CONFIG_UPDATED, () => this._updateStats(this._stats)),
    ];
  },

  _updateStats(data) {
    Object.assign(this._stats, data);
    const s = this._stats;
    const set = (id, val) => { const e = $el(id, this._el); if (e) e.textContent = String(val); };
    set('cs-ov-scanned', s.scanned ?? 0);
    set('cs-ov-filtered', s.filtered ?? 0);
    set('cs-ov-rules', s.activeRules ?? 0);
    const dot = $el('cs-overlay-dot', this._el);
    if (dot) {
      const on = s.observerActive && s.enabled;
      dot.className = 'cs-overlay-dot' + (on ? ' cs-dot-on' : ' cs-dot-off');
    }
    const ai = s.aiStatus || {};
    const aiOn = (ai.mode || this._config.aiMode || 'off') !== 'off';
    const shield = $el('cs-shield-btn', this._el);
    if (shield) {
      shield.classList.toggle('cs-shield-ai-active', aiOn);
    }
    const aiInfo = $el('cs-ov-ai-info', this._el);
    if (aiInfo) {
      const aiRow = $el('cs-overlay-ai', this._el);
      if (aiRow) aiRow.style.display = aiOn ? '' : 'none';
      if (aiOn) {
        const p = this._config.aiProvider || ai.provider || '';
        const m = this._config.aiModel || ai.model || '';
        aiInfo.textContent = getProviderLabel(p, t) + (m ? ' / ' + m : '');
      }
    }
    // 自学习状态
    const learnedEl = $el('cs-overlay-learn', this._el);
    if (learnedEl) learnedEl.style.display = (s.learnedRules > 0 || s.candidatePending > 0) ? '' : 'none';
    set('cs-ov-learned', s.learnedRules ?? 0);
    const candEl = $el('cs-ov-cand', this._el);
    if (candEl) candEl.textContent = s.candidatePending > 0 ? '+ ' + s.candidatePending : '';
    const dotEl = $el('cs-overlay-learn-dot', this._el);
    if (dotEl) dotEl.classList.toggle('cs-learn-active', s.candidatePending > 0);
  },

  _updateToggleBtn() {
    const btn = $el('cs-ov-toggle', this._el);
    if (!btn) return;
    btn.textContent = this._config.enabled ? '\u25A0 ' + t('btnStop') : '\u25B6 ' + t('btnStart');
  },

  destroy() {
    this._unsub.forEach(fn => fn());
    this._el?.remove();
  },
};
