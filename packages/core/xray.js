/**
 * xray.js — 认知X射线（Cognitive X-Ray）扫描模块 v4
 *
 * v4修复：
 * 1. 重写文本收集：使用deepQueryAll穿透Shadow DOM，直接定位bili-rich-text等文本容器
 * 2. 修复Shadow Host文本提取：递归从shadowRoot.innerText获取内容
 * 3. 扫描动画改用纯CSS @keyframes，删除JS RAF循环（解决卡顿核心问题）
 * 4. 简化skip过滤，避免误杀评论元素
 * 5. 新内容观察始终启用，防抖1秒
 * 6. 刷屏场景下节流，避免队列堆积
 */

import { getLang } from './i18n.js';
import { deepQueryAll } from './dom-utils.js';

const BIAS_CATEGORIES = [
  'ad_hominem',
  'emotional_manipulation',
  'black_white',
  'bandwagon',
  'straw_man',
  'slippery_slope',
  'hasty_generalization',
  'appeal_to_authority',
];

const CATEGORY_META_ZH = {
  ad_hominem:            { label: '人身攻击', color: '#ef4444', emoji: '😡' },
  emotional_manipulation:{ label: '情绪煽动', color: '#f97316', emoji: '🔥' },
  black_white:           { label: '非黑即白', color: '#eab308', emoji: '⚫' },
  bandwagon:             { label: '跟风带节奏', color: '#a855f7', emoji: '🐑' },
  straw_man:             { label: '偷换概念', color: '#ec4899', emoji: '🎭' },
  slippery_slope:        { label: '极端推演', color: '#f59e0b', emoji: '📉' },
  hasty_generalization:  { label: '以偏概全', color: '#06b6d4', emoji: '🔍' },
  appeal_to_authority:   { label: '迷信专家', color: '#8b5cf6', emoji: '👑' },
};

const CATEGORY_VACCINE_ZH = {
  ad_hominem: '对方在攻击说话的人而不是他说的话。别被人身攻击带偏了讨论方向。',
  emotional_manipulation: '这段话在刻意激发你的情绪。当你感到情绪被挑动时，先暂停30秒再判断——情绪是本能，但决策需要理性。',
  black_white: '世界不是非黑即白的。对方是否只给了你极端选项？想想是否存在第三种可能。',
  bandwagon: '"大家都这么想"不代表就是对的。问自己：证据是什么？逻辑通顺吗？',
  straw_man: '对方是否歪曲了你的观点？把他的话和原话对比，看有没有被替换成更容易攻击的"稻草人"。',
  slippery_slope: '对方在说"如果A发生，Z就一定会发生"吗？检查A到Z之间的每一步——真的是必然因果吗？',
  hasty_generalization: '用一两个例子推出普遍性结论？个例不能代替统计。',
  appeal_to_authority: '"专家说""老祖宗说""一直以来都是这样"不等于对。要看有没有具体证据和道理，不是谁说了算。',
};

const CATEGORY_META_EN = {
  ad_hominem:            { label: 'Personal Attack', color: '#ef4444', emoji: '😡' },
  emotional_manipulation:{ label: 'Emotional Push', color: '#f97316', emoji: '🔥' },
  black_white:           { label: 'Black-or-White', color: '#eab308', emoji: '⚫' },
  bandwagon:             { label: 'Bandwagon', color: '#a855f7', emoji: '🐑' },
  straw_man:             { label: 'Straw Man', color: '#ec4899', emoji: '🎭' },
  slippery_slope:        { label: 'Slippery Slope', color: '#f59e0b', emoji: '📉' },
  hasty_generalization:  { label: 'Overgeneralize', color: '#06b6d4', emoji: '🔍' },
  appeal_to_authority:   { label: 'Appeal to Authority', color: '#8b5cf6', emoji: '👑' },
};

const CATEGORY_VACCINE_EN = {
  ad_hominem: 'They are attacking the person instead of the argument. Don\'t be distracted.',
  emotional_manipulation: 'This is deliberately provoking your emotions. Pause 30 seconds before judging.',
  black_white: 'The world isn\'t black and white. Are there other options besides the extremes?',
  bandwagon: '"Everyone thinks so" doesn\'t make it right. Ask: what\'s the evidence?',
  straw_man: 'Did they distort the argument to make it easier to attack?',
  slippery_slope: 'Is A→Z really inevitable? Check each step in between.',
  hasty_generalization: 'One or two examples don\'t make a universal rule.',
  appeal_to_authority: 'Authority says so ≠ it\'s correct. Look for actual evidence.',
};

function _t() {
  const lang = getLang();
  if (lang === 'zh') return { meta: CATEGORY_META_ZH, vaccines: CATEGORY_VACCINE_ZH };
  return { meta: CATEGORY_META_EN, vaccines: CATEGORY_VACCINE_EN };
}

function buildXraySystemPrompt() {
  const lang = getLang();
  const langName = lang === 'zh' ? '中文' : 'English';
  const catList = BIAS_CATEGORIES.map(c => `"${c}"`).join(', ');
  return `You are a cognitive bias detector. CRITICAL: write "reason" in ${langName}. JSON keys in English.

Classify into one of 8 categories:
- ad_hominem: name-calling, insults, labeling the person
- emotional_manipulation: provoking anger/fear/pity
- black_white: all-or-nothing terms, false dilemmas, "all/never/must"
- bandwagon: "everyone thinks so", peer pressure
- straw_man: misrepresenting argument, red herring
- slippery_slope: A inevitably leads to Z without evidence
- hasty_generalization: broad conclusion from few examples
- appeal_to_authority: authority/tradition as proof

Output STRICT JSON:
{"risk":"high|medium|low","category":${catList},"manipulation_score":0.0-1.0,"reason":"one short sentence in ${langName}"}`;
}

function buildXrayBatchPrompt(batch) {
  const lang = getLang();
  const langName = lang === 'zh' ? '中文' : 'English';
  const items = batch.map((item, i) => `[${i+1}] """${item.text}"""`).join('\n\n');
  return `Analyze these comments for cognitive biases. Write "reason" in ${langName}.
Return ONLY a valid JSON array (no markdown):
[
  {"risk":"high|medium|low","category":"one_of_8","manipulation_score":0.0,"reason":"..."},
  ...
]

Comments:
${items}`;
}

function extractTextFromEl(el) {
  // 跳过 style/script/svg 标签
  const tag = el.tagName?.toLowerCase();
  if (tag === 'style' || tag === 'script' || tag === 'svg' || tag === 'path') return '';

  // 如果有shadowRoot，递归进入（B站评论结构：bili-rich-text → shadowRoot → <p>）
  if (el.shadowRoot) {
    for (const child of el.shadowRoot.children || []) {
      const t = extractTextFromEl(child);
      if (t && t.length > 5) return t;
    }
  }

  // 优先使用innerText（排除隐藏元素）
  if (el.innerText) {
    const text = el.innerText.trim();
    if (text && text.length > 5) return text;
  }

  // 递归子元素
  for (const child of el.children || []) {
    const t = extractTextFromEl(child);
    if (t && t.length > 5) return t;
  }

  return '';
}

const XRAY_CSS_CLASS = 'cs-xray-scanning';
const SCAN_STYLE_ID = 'cs-xray-styles';

function ensureXrayStyles() {
  if (document.getElementById(SCAN_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SCAN_STYLE_ID;
  style.textContent = `
    @keyframes csXrayScan {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .${XRAY_CSS_CLASS} {
      background-image: linear-gradient(90deg, transparent, rgba(56,189,248,.18), transparent) !important;
      background-size: 200% 100% !important;
      background-repeat: no-repeat !important;
      animation: csXrayScan 1.2s linear infinite !important;
      border-radius: 3px !important;
    }
    [data-cs-xray].cs-xray-risk-high {
      background-color: rgba(239,68,68,.16) !important;
      box-shadow: inset 0 -2px 0 rgba(239,68,68,.5) !important;
      border-radius: 3px !important;
      transition: background-color .3s !important;
    }
    [data-cs-xray].cs-xray-risk-medium {
      background-color: rgba(245,158,11,.12) !important;
      box-shadow: inset 0 -2px 0 rgba(245,158,11,.35) !important;
      border-radius: 3px !important;
      transition: background-color .3s !important;
    }
    [data-cs-xray].cs-xray-risk-low {
      background-color: rgba(16,185,129,.07) !important;
      border-radius: 3px !important;
      transition: background-color .3s !important;
    }
  `;
  document.head.appendChild(style);
}

export class CognitiveXRay {
  constructor(aiAnalyzer, scanner) {
    this._ai = aiAnalyzer;
    this._scanner = scanner;
    this._active = false;
    this._scanning = false;
    this._scanId = 0;
    this._results = new Map();
    this._markedEls = new Set();
    this._queue = [];
    this._processed = 0;
    this._totalNodes = 0;
    this._stats = { high: 0, medium: 0, low: 0 };
    this._tooltipEl = null;
    this._panelEl = null;
    this._progressBarEl = null;
    this._statsEl = null;
    this._currentHoverEl = null;
    this._tooltipHideTimer = null;
    this._newContentObserver = null;
    this._newContentTimer = null;
    this._retryCount = 0;
    this._batchInFlight = false;
    ensureXrayStyles();
  }

  get active() { return this._active; }
  get stats() { return { ...this._stats }; }

  start() {
    if (this._active) return;
    this._active = true;
    this._scanning = true;
    this._scanId++;
    this._results.clear();
    this._markedEls.clear();
    this._stats = { high: 0, medium: 0, low: 0 };
    this._processed = 0;
    this._retryCount = 0;
    this._currentHoverEl = null;
    this._batchInFlight = false;
    this._clearAllMarks();
    this._createFloatingPanel();
    this._createTooltip();
    this._bindTooltipEvents();
    setTimeout(() => { if (this._active) this._collectAndScan(); }, 400);
  }

  stop() {
    if (!this._active) return;
    this._active = false;
    this._scanning = false;
    this._queue = [];
    this._batchInFlight = false;
    if (this._tooltipHideTimer) { clearTimeout(this._tooltipHideTimer); this._tooltipHideTimer = null; }
    if (this._newContentTimer) { clearTimeout(this._newContentTimer); this._newContentTimer = null; }
    if (this._newContentObserver) { this._newContentObserver.disconnect(); this._newContentObserver = null; }
    this._removeFloatingPanel();
    this._removeTooltip();
    this._unbindTooltipEvents();
    this._clearAllMarks();
  }

  toggle() {
    if (this._active) this.stop();
    else this.start();
  }

  _createFloatingPanel() {
    this._panelEl = document.createElement('div');
    const isZh = getLang() === 'zh';
    const L = isZh
      ? { title: '认知X射线', scanning: '扫描中...', high: '高风险', med: '带节奏', low: '客观', done: '扫描完成', close: '关闭', startTip: '点击开始扫描' }
      : { title: 'Cognitive X-Ray', scanning: 'Scanning...', high: 'High', med: 'Biased', low: 'Neutral', done: 'Done', close: 'Close', startTip: 'Click to scan' };

    const panel = this._panelEl;
    panel.id = 'cs-xray-panel';
    panel.style.cssText = `
      position:fixed;bottom:20px;right:20px;z-index:2147483645;
      background:linear-gradient(135deg,rgba(12,26,37,.95),rgba(26,53,71,.95));
      color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;
      font-size:12px;padding:10px 14px;border-radius:12px;
      box-shadow:0 8px 32px rgba(0,0,0,.4),0 0 0 1px rgba(56,189,248,.2);
      backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
      display:flex;align-items:center;gap:10px;cursor:pointer;
      transition:all .25s cubic-bezier(.2,.8,.2,1);
      transform:translateY(20px);opacity:0;user-select:none;
      min-width:200px;max-width:340px;
    `;
    panel.innerHTML = `
      <div id="cs-xray-icon" style="width:28px;height:28px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(56,189,248,.15);position:relative;">
        <span style="font-size:16px;">🔬</span>
      </div>
      <div style="flex:1;min-width:0;">
        <div id="cs-xray-ptitle" style="font-weight:700;font-size:12px;color:#38bdf8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${L.title}</div>
        <div id="cs-xray-pstatus" style="font-size:11px;color:rgba(255,255,255,.6);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${L.startTip}</div>
        <div id="cs-xray-pbarwrap" style="display:none;margin-top:5px;height:4px;background:rgba(255,255,255,.1);border-radius:100px;overflow:hidden;">
          <div id="cs-xray-pbar" style="height:100%;background:linear-gradient(90deg,#38bdf8,#06b6d4);border-radius:100px;width:0%;transition:width .3s;"></div>
        </div>
        <div id="cs-xray-pstats" style="display:none;margin-top:5px;gap:8px;font-size:11px;align-items:center;">
          <span style="display:flex;align-items:center;gap:3px;"><span style="width:6px;height:6px;border-radius:50%;background:#ef4444;"></span><b id="cs-xray-pc-h">0</b></span>
          <span style="display:flex;align-items:center;gap:3px;"><span style="width:6px;height:6px;border-radius:50%;background:#f59e0b;"></span><b id="cs-xray-pc-m">0</b></span>
          <span style="display:flex;align-items:center;gap:3px;"><span style="width:6px;height:6px;border-radius:50%;background:#10b981;"></span><b id="cs-xray-pc-l">0</b></span>
        </div>
      </div>
      <button id="cs-xray-pclose" style="background:none;border:none;color:rgba(255,255,255,.4);width:22px;height:22px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;transition:all .15s;padding:0;" title="${L.close}">✕</button>
    `;
    document.body.appendChild(panel);
    requestAnimationFrame(() => { panel.style.transform = 'translateY(0)'; panel.style.opacity = '1'; });

    this._progressBarEl = panel.querySelector('#cs-xray-pbar');
    this._titleEl = panel.querySelector('#cs-xray-ptitle');
    this._statusEl = panel.querySelector('#cs-xray-pstatus');
    this._barWrapEl = panel.querySelector('#cs-xray-pbarwrap');
    this._statsWrapEl = panel.querySelector('#cs-xray-pstats');
    this._statEls = { h: panel.querySelector('#cs-xray-pc-h'), m: panel.querySelector('#cs-xray-pc-m'), l: panel.querySelector('#cs-xray-pc-l') };

    panel.querySelector('#cs-xray-pclose').addEventListener('click', (e) => { e.stopPropagation(); this.stop(); });
    panel.addEventListener('click', () => { if (!this._scanning) this._collectAndScan(); });
  }

  _removeFloatingPanel() {
    if (!this._panelEl) return;
    const p = this._panelEl;
    p.style.transform = 'translateY(20px)';
    p.style.opacity = '0';
    setTimeout(() => { p.remove(); this._panelEl = null; }, 250);
  }

  _setPanelProgress(pct) {
    if (!this._progressBarEl) return;
    this._barWrapEl.style.display = 'block';
    this._statsWrapEl.style.display = 'none';
    this._progressBarEl.style.width = Math.min(100, pct) + '%';
    const isZh = getLang() === 'zh';
    this._statusEl.textContent = isZh ? `扫描中 ${Math.round(pct)}%` : `Scanning ${Math.round(pct)}%`;
  }

  _setPanelDone() {
    if (!this._progressBarEl) return;
    this._barWrapEl.style.display = 'none';
    this._statsWrapEl.style.display = 'flex';
    this._statEls.h.textContent = this._stats.high;
    this._statEls.m.textContent = this._stats.medium;
    this._statEls.l.textContent = this._stats.low;
    const isZh = getLang() === 'zh';
    this._statusEl.textContent = isZh
      ? `已完成 · 高风险${this._stats.high} 带节奏${this._stats.medium} 客观${this._stats.low}`
      : `Done · ${this._stats.high} high · ${this._stats.medium} biased · ${this._stats.low} neutral`;
  }

  _createTooltip() {
    this._tooltipEl = document.createElement('div');
    const tt = this._tooltipEl;
    tt.style.cssText = `position:fixed;z-index:2147483646;
      background:#0c1a25;color:#e2e8f0;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;
      font-size:12.5px;line-height:1.55;padding:12px 14px;border-radius:10px;
      box-shadow:0 8px 32px rgba(0,0,0,.5),0 0 0 1px rgba(56,189,248,.2);
      max-width:320px;min-width:200px;
      opacity:0;transform:translateY(4px) scale(.97);
      transition:opacity .12s,transform .12s;display:none;pointer-events:none;`;
    document.body.appendChild(tt);
  }

  _removeTooltip() {
    this._tooltipEl?.remove();
    this._tooltipEl = null;
  }

  _bindTooltipEvents() {
    this._enterHandler = (e) => {
      const mark = e.target.closest('[data-cs-xray]');
      if (!mark || !this._active) return;
      if (this._tooltipHideTimer) { clearTimeout(this._tooltipHideTimer); this._tooltipHideTimer = null; }
      if (this._currentHoverEl === mark) return;
      this._currentHoverEl = mark;
      const key = mark.dataset.csXray;
      const result = this._results.get(key);
      if (result) this._showTooltip(mark, result);
    };
    this._leaveHandler = () => {
      this._tooltipHideTimer = setTimeout(() => {
        this._hideTooltip();
        this._currentHoverEl = null;
      }, 120);
    };
    document.addEventListener('mouseenter', this._enterHandler, true);
    document.addEventListener('mouseleave', this._leaveHandler, true);
  }

  _unbindTooltipEvents() {
    if (this._enterHandler) document.removeEventListener('mouseenter', this._enterHandler, true);
    if (this._leaveHandler) document.removeEventListener('mouseleave', this._leaveHandler, true);
  }

  _showTooltip(el, result) {
    if (!this._tooltipEl) return;
    const tt = this._tooltipEl;
    const t = _t();
    const isZh = getLang() === 'zh';
    const cat = result.category || 'emotional_manipulation';
    const meta = t.meta[cat] || t.meta.emotional_manipulation;
    const vaccine = t.vaccines[cat] || '';
    const vaccineLabel = isZh ? '💡 认知疫苗' : '💡 How to resist';
    const scorePct = Math.round((result.manipulation_score || 0) * 100);

    const riskColors = {
      high: { bg: 'rgba(239,68,68,.2)', fg: '#fca5a5' },
      medium: { bg: 'rgba(245,158,11,.2)', fg: '#fcd34d' },
      low: { bg: 'rgba(16,185,129,.15)', fg: '#6ee7b7' },
    };
    const rc = riskColors[result.risk] || riskColors.low;

    tt.innerHTML = `
      <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;color:rgba(255,255,255,.3);position:absolute;top:8px;right:12px;">${scorePct}%</div>
      <div style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:100px;font-size:11px;font-weight:700;margin-bottom:7px;background:${rc.bg};color:${rc.fg};">
        ${meta.emoji} ${meta.label}
      </div>
      <div style="margin-bottom:8px;color:#cbd5e1;font-size:12px;line-height:1.5;">${result.reason || ''}</div>
      ${vaccine ? `<div style="background:rgba(16,185,129,.08);border-left:3px solid #10b981;padding:7px 9px;border-radius:0 5px 5px 0;">
        <div style="font-weight:700;color:#34d399;font-size:10.5px;margin-bottom:2px;">${vaccineLabel}</div>
        <div style="font-size:11px;color:#a7f3d0;line-height:1.5;">${vaccine}</div>
      </div>` : ''}
    `;
    tt.style.display = 'block';
    requestAnimationFrame(() => {
      tt.style.opacity = '1';
      tt.style.transform = 'translateY(0) scale(1)';
    });

    const rect = el.getBoundingClientRect();
    const ttRect = tt.getBoundingClientRect();
    let top = rect.bottom + 10;
    let left = rect.left;
    if (top + ttRect.height > window.innerHeight - 10) top = rect.top - ttRect.height - 10;
    if (left + ttRect.width + 10 > window.innerWidth) left = window.innerWidth - ttRect.width - 10;
    if (left < 10) left = 10;
    if (top < 10) top = 10;
    tt.style.top = top + 'px';
    tt.style.left = left + 'px';
  }

  _hideTooltip() {
    if (!this._tooltipEl) return;
    this._tooltipEl.style.opacity = '0';
    this._tooltipEl.style.transform = 'translateY(4px) scale(.97)';
    setTimeout(() => { if (this._tooltipEl) this._tooltipEl.style.display = 'none'; }, 120);
  }

  _markElement(el, risk, resultId) {
    el.classList.remove(XRAY_CSS_CLASS);
    el.classList.remove('cs-xray-risk-high', 'cs-xray-risk-medium', 'cs-xray-risk-low');
    el.classList.add(`cs-xray-risk-${risk}`);
    el.setAttribute('data-cs-xray', resultId);
    this._markedEls.add(el);
  }

  _setScanningStyle(el) {
    if (this._markedEls.has(el)) {
      el.classList.add(XRAY_CSS_CLASS);
      return;
    }
    el.classList.add(XRAY_CSS_CLASS);
    this._markedEls.add(el);
  }

  _removeScanningStyle(el) {
    el.classList.remove(XRAY_CSS_CLASS);
  }

  _getTextSelectors() {
    const platform = this._scanner?.platform;
    const parts = [];
    // 优先使用平台适配器的选择器
    if (platform?.selectors?.commentText) parts.push(platform.selectors.commentText);
    // B站 Web Component
    parts.push(
      'bili-rich-text',
      'bili-comment-renderer',
      'bili-comment-thread-renderer',
    );
    // 通用评论文本选择器
    parts.push(
      '[class*="rich-text"]',
      '[class*="reply-content"]',
      '[class*="ReplyContent"]',
      '[class*="comment-text"]',
      '[class*="CommentText"]',
      '.reply-content', '.text-con', '.comment-text',
      '.wb-text', '.weibo-text', '.RichContent-inner',
      '.CommentItem-content', '.Post-content',
      'ytd-comment-renderer #content-text',
      '[data-testid="tweetText"]', '.userContent',
    );
    // 移除太泛的选择器：p, span[class*="content"]
    return parts.join(', ');
  }

  _getCommentContainerSelectors() {
    return [
      '#comment', '.bb-comment', '.bili-comment',
      '[class*="comment-container"]', '[class*="CommentContainer"]',
      'bili-comments',
      '.reply-list', '.comment-list',
      '#commentapp',
    ];
  }

  _isOwnUI(el) {
    if (!el) return true;
    if (el.id === 'cs-xray-panel' || el.id === 'cs-dashboard' || el.id === 'cs-chat-panel' || el.id === 'cs-overlay') return true;
    if (el.closest && (el.closest('#cs-xray-panel') || el.closest('#cs-dashboard') || el.closest('#cs-chat-panel') || el.closest('#cs-overlay'))) return true;
    if (el.classList && (el.classList.contains('cs-xray') || el.classList.contains('cs-blurred') || el.classList.contains('cs-reveal-float'))) return true;
    return false;
  }

  _isNonContent(el) {
    const tag = el.tagName;
    if (!tag) return true;
    if (/^(SCRIPT|STYLE|NOSCRIPT|IFRAME|CANVAS|SVG|CODE|PRE|INPUT|TEXTAREA|SELECT|BUTTON|NAV|HEADER|FOOTER|IMG|VIDEO|AUDIO|LINK|META|STYLE)$/i.test(tag)) return true;
    const cls = typeof el.className === 'string' ? el.className.toLowerCase() : '';
    if (/(?:^|[-_ ])(?:avatar|btn|button|like|dislike|upvote|downvote|reply-btn|share-btn|report-btn|icon|thumb|thumbnail|emoji|emotion|toolbar|tool-bar|nav|header|footer|logo|search|top-bar|title-bar|operation|opera-list|tool-bar-item|bottom-btn|sub-reply-toggle|root-reply-bar|reply-tags|root-reply-decoration|comment-list|comment-jump|comment-send|vote|like-bar|reply-box|publish|time|date|timestamp|user-name|username|name|up-info|user-info|member|medal|level|badge|label|tag)(?:[-_ ]|$)/.test(cls)) return true;
    return false;
  }

  _collectTextNodes() {
    const candidates = [];
    const selector = this._getTextSelectors();
    const seen = new Set();

    // 1. 先定位评论区容器，限定搜索范围
    const containerSels = this._getCommentContainerSelectors();
    let commentScope = null;
    for (const sel of containerSels) {
      try {
        const el = document.querySelector(sel);
        if (el && el.getBoundingClientRect().height > 50) {
          commentScope = el;
          break;
        }
      } catch(_e) {}
    }

    // 2. 在限定范围内搜索（包括Shadow DOM穿透）
    let allMatches = [];
    if (commentScope) {
      try { allMatches = deepQueryAll(selector); } catch(_e) {}
      // 也在scope内直接查询
      try {
        const scopeMatches = commentScope.querySelectorAll(selector);
        for (const el of scopeMatches) allMatches.push(el);
      } catch(_e) {}
      // 穿透scope的shadowRoot
      if (commentScope.shadowRoot) {
        try {
          const shadowMatches = commentScope.shadowRoot.querySelectorAll(selector);
          for (const el of shadowMatches) allMatches.push(el);
        } catch(_e) {}
      }
    } else {
      // 没找到评论容器，降级到全页搜索（但排除视频信息区）
      try { allMatches = deepQueryAll(selector); } catch(_e) {}
      try {
        const docMatches = document.querySelectorAll(selector);
        for (const el of docMatches) allMatches.push(el);
      } catch(_e) {}
    }

    // 3. 过滤和提取
    for (const node of allMatches) {
      if (!node || seen.has(node)) continue;
      seen.add(node);
      if (this._isOwnUI(node)) continue;
      if (this._isNonContent(node)) continue;
      if (node.getAttribute && node.getAttribute('data-cs-xray')) continue;

      // 跳过视频标题/描述区域
      if (node.closest && (
        node.closest('.video-info') ||
        node.closest('.video-title') ||
        node.closest('.video-desc') ||
        node.closest('#video-app') ||
        node.closest('.video-data') ||
        node.closest('.basic-desc') ||
        node.closest('.video-info-container') ||
        node.closest('[class*="video-info"]') ||
        node.closest('[class*="video-desc"]') ||
        node.closest('[class*="video-title"]')
      )) continue;

      const text = extractTextFromEl(node);
      if (!text || text.length < 6 || text.length > 1000) continue;

      let rect;
      try { rect = node.getBoundingClientRect(); } catch(_e) { continue; }
      if (rect.width < 20 || rect.height < 12) continue;
      if (rect.bottom < -100 || rect.top > window.innerHeight + 6000) continue;

      let style;
      try { style = window.getComputedStyle(node); } catch(_e) { continue; }
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      // 去重：如果父元素文本和子元素几乎相同，跳过子元素
      const parent = node.parentElement;
      if (parent && seen.has(parent) && !node.shadowRoot) {
        const pText = extractTextFromEl(parent);
        if (pText && Math.abs(pText.length - text.length) < 3) continue;
      }

      candidates.push({ el: node, text });
      if (candidates.length >= 80) break;
    }

    // 4. 如果找到了评论容器但没收集到候选，尝试从容器内递归收集Shadow DOM文本
    if (candidates.length === 0 && commentScope) {
      this._collectFromShadowRecursively(commentScope, candidates, seen, 80);
    }

    return candidates;
  }

  /**
   * 递归从Shadow DOM中收集文本节点（当常规选择器找不到时）
   */
  _collectFromShadowRecursively(root, candidates, seen, maxCount) {
    if (candidates.length >= maxCount) return;

    // 如果有shadowRoot，递归进入
    if (root.shadowRoot) {
      for (const child of root.shadowRoot.children || []) {
        if (candidates.length >= maxCount) return;
        if (seen.has(child)) continue;
        seen.add(child);

        const tag = child.tagName?.toLowerCase();
        if (tag === 'style' || tag === 'script' || tag === 'svg') continue;

        // 如果是文本容器（p, span等），提取文本
        if (tag === 'p' || tag === 'span' || tag === 'div') {
          const text = extractTextFromEl(child);
          if (text && text.length >= 6 && text.length <= 1000) {
            let rect;
            try { rect = child.getBoundingClientRect(); } catch(_e) { continue; }
            if (rect.width >= 20 && rect.height >= 12) {
              candidates.push({ el: child, text });
              continue;
            }
          }
        }

        // 递归
        this._collectFromShadowRecursively(child, candidates, seen, maxCount);
      }
    }

    // 遍历light DOM子元素
    for (const child of root.children || []) {
      if (candidates.length >= maxCount) return;
      if (seen.has(child)) continue;
      seen.add(child);
      this._collectFromShadowRecursively(child, candidates, seen, maxCount);
    }
  }

  _collectAndScan() {
    const nodes = this._collectTextNodes();
    this._totalNodes = nodes.length;
    this._queue = nodes;
    this._processed = 0;

    if (nodes.length < 3 && this._retryCount < 6) {
      this._retryCount++;
      const isZh = getLang() === 'zh';
      if (this._statusEl) this._statusEl.textContent = isZh ? `等待评论加载...(${this._retryCount}/6)` : `Waiting for comments...(${this._retryCount}/6)`;
      setTimeout(() => { if (this._active) this._collectAndScan(); }, 1200);
      return;
    }
    this._retryCount = 0;

    if (nodes.length === 0) {
      this._scanning = false;
      this._setPanelDone();
      this._startWatchingNewContent();
      return;
    }

    this._setPanelProgress(0);
    this._processBatch();
    this._startWatchingNewContent();
  }

  _startWatchingNewContent() {
    if (this._newContentObserver) this._newContentObserver.disconnect();
    if (this._newContentTimer) { clearTimeout(this._newContentTimer); this._newContentTimer = null; }

    this._newContentObserver = new MutationObserver(() => {
      if (!this._active) return;
      if (this._newContentTimer) clearTimeout(this._newContentTimer);
      this._newContentTimer = setTimeout(() => {
        this._newContentTimer = null;
        if (!this._active || this._scanning) return;
        const newNodes = this._collectTextNodes().filter(n => !n.el.getAttribute('data-cs-xray') && !n.el.classList.contains(XRAY_CSS_CLASS));
        if (newNodes.length > 0) {
          this._queue = newNodes;
          this._totalNodes = newNodes.length;
          this._processed = 0;
          this._scanning = true;
          this._setPanelProgress(0);
          this._processBatch();
        }
      }, 1000);
    });
    this._newContentObserver.observe(document.body, { childList: true, subtree: true });
  }

  async _processBatch() {
    if (!this._active) return;
    if (this._batchInFlight) return;
    if (this._queue.length === 0) {
      this._scanning = false;
      this._setPanelDone();
      return;
    }
    this._batchInFlight = true;
    const BATCH = 5;
    const batch = this._queue.splice(0, BATCH);
    for (const item of batch) { this._setScanningStyle(item.el); this._processed++; }
    this._setPanelProgress(this._totalNodes > 0 ? (this._processed / this._totalNodes) * 100 : 0);

    try {
      const results = await this._callXRayAPI(batch);
      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        const r = results[i] || { risk:'low', category:'emotional_manipulation', manipulation_score:0.1, reason:'' };
        this._removeScanningStyle(item.el);
        const resultId = `${this._scanId}-${this._results.size}`;
        this._results.set(resultId, r);
        this._markElement(item.el, r.risk, resultId);
        this._stats[r.risk]++;
      }
    } catch(_err) {
      for (const item of batch) {
        this._removeScanningStyle(item.el);
        const h = this._heuristicSingle(item.text);
        const resultId = `${this._scanId}-${this._results.size}`;
        this._results.set(resultId, h);
        this._markElement(item.el, h.risk, resultId);
        this._stats[h.risk]++;
      }
    }

    this._batchInFlight = false;
    if (this._queue.length > 0) {
      setTimeout(() => this._processBatch(), 250);
    } else {
      this._scanning = false;
      this._setPanelDone();
    }
  }

  async _callXRayAPI(batch) {
    if (!this._ai || !this._ai.shouldAnalyze()) return batch.map(i => this._heuristicSingle(i.text));
    try {
      const cfg = this._ai.getAPIConfig();
      const sys = buildXraySystemPrompt();
      const usr = buildXrayBatchPrompt(batch);
      const result = await this._gmFetch(cfg.url, {
        method:'POST', headers:cfg.headers, timeout:15000,
        body: JSON.stringify(
          cfg.format==='gemini'
            ? { contents:[{parts:[{text:usr}]}], generationConfig:{maxOutputTokens:300*batch.length}, systemInstruction:{parts:[{text:sys}]} }
            : cfg.format==='openai'
              ? { model:cfg.model, max_tokens:300*batch.length, messages:[{role:'system',content:sys},{role:'user',content:usr}] }
              : { model:cfg.model, system:sys, max_tokens:300*batch.length, messages:[{role:'user',content:usr}] }
        )
      });
      let raw;
      if (cfg.format==='gemini') raw = result.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      else if (cfg.format==='openai') raw = result.choices?.[0]?.message?.content || '[]';
      else raw = result.content?.[0]?.text || '[]';
      let results = JSON.parse(raw.replace(/```json|```/g,'').trim());
      if (!Array.isArray(results)) results = [];
      return results.map(r => ({
        risk: r.risk==='high'?'high':r.risk==='medium'?'medium':'low',
        category: BIAS_CATEGORIES.includes(r.category)?r.category:'emotional_manipulation',
        manipulation_score: typeof r.manipulation_score==='number'?Math.max(0,Math.min(1,r.manipulation_score)):0.3,
        reason: r.reason||''
      }));
    } catch(_err) {
      return batch.map(i => this._heuristicSingle(i.text));
    }
  }

  _heuristicSingle(text) {
    let score = 0, cat = 'emotional_manipulation';
    if (/傻逼|操你妈|nmsl|废物|垃圾|脑残|白痴|弱智|狗东西|去死|滚|sb|cnm|fuck you|bitch|stupid|idiot|retard|dumbass/i.test(text)) {
      score = 0.85; cat = 'ad_hominem';
    } else {
      if (/[!！]{2,}|[?？]{2,}|卧槽|离谱|震惊|恐怖|恶心|气愤|愤怒|wtf|omg/i.test(text)) { score += 0.25; cat='emotional_manipulation'; }
      if (/都|全部|所有|永远|绝不|一定|必须|肯定|根本|完全|100%|all|never|must|always|every/i.test(text)) { score += 0.25; cat='black_white'; }
      if (/大家都|所有人|别人都|谁不|网友都|everyone knows|everybody/i.test(text)) { score += 0.25; cat='bandwagon'; }
      if (/如果.*就.*会|迟早|总有一天|再这样下去|leads to|inevitably/i.test(text)) { score += 0.2; cat='slippery_slope'; }
      if (/你就是|你这种|你们这些|libtard|trumptard|feminazi|incel|cuck/i.test(text)) { score += 0.3; cat='ad_hominem'; }
      if (/我朋友|我亲戚|我听说|anecdotally|my friend/i.test(text)) { score += 0.2; cat='hasty_generalization'; }
      if (/专家说|老祖宗|自古以来|一直都是|experts say|tradition/i.test(text)) { score += 0.15; cat='appeal_to_authority'; }
      if (/[A-Z]{5,}/.test(text)) score += 0.15;
    }
    let risk = 'low';
    if (score >= 0.5) risk = 'high';
    else if (score >= 0.2) risk = 'medium';
    const t = _t();
    const m = t.meta[cat];
    const reason = getLang()==='zh' ? `检测到「${m.label}」式表达` : `Detected: ${m.label}`;
    return { risk, category:cat, manipulation_score:Math.min(1,score), reason };
  }

  _gmFetch(url, opt={}) {
    const T = opt.timeout||15000;
    return new Promise((res,rej)=>{
      let done=false;
      const fin=(fn,v)=>{if(done)return;done=true;clearTimeout(t);fn(v);};
      const t=setTimeout(()=>fin(rej,new Error('timeout')),T+2000);
      try{GM_xmlhttpRequest({url,method:opt.method||'GET',headers:opt.headers||{},data:opt.body,timeout:T,
        onload:r=>{if(r.status>=200&&r.status<300){let d=r.response;if(typeof d==='string'){try{d=JSON.parse(d)}catch(_e){}}fin(res,d);}else fin(rej,new Error('HTTP '+r.status));},
        onerror:()=>fin(rej,new Error('net error')),ontimeout:()=>fin(rej,new Error('timeout'))
      });}catch(_e){fin(rej,_e);}
    });
  }

  _clearAllMarks() {
    this._markedEls.forEach(el => {
      try {
        el.classList.remove(XRAY_CSS_CLASS);
        el.classList.remove('cs-xray-risk-high', 'cs-xray-risk-medium', 'cs-xray-risk-low');
        el.removeAttribute('data-cs-xray');
      } catch(_e){}
    });
    this._markedEls.clear();
  }
}
