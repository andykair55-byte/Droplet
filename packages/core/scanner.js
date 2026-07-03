import { Detector, Verdict, RiskLevel, shouldAct } from './detector.js';
import { AIAnalyzer } from './ai.js';
import { RuleLearner } from './rule-learner.js';
// import { RuleManager } from './rule-manager.js'; // 远程规则暂未启用
import { Blocker } from './blocker.js';
import { Evidence } from './evidence.js';
import { TopicFilter } from './topic-filter.js';
import { HotTopicManager } from './hot-topic-manager.js';
import { ContextWindow } from './context-window.js';
import { MemoryManager } from './memory.js';
import { t } from './i18n.js';
import { emit, Events } from './events.js';
import { deepQuerySelectorInEl, deepQueryAll, deepQueryAllRecursive, deepQuerySelectorAllInRoot } from './dom-utils.js';
import { extractText, extractTextFromShadow, extractUsername, extractUserUID, extractWhisperPartnerName, detectContentType, isSelfMessage, findTextElement, extractNegativeSignals, buildContext, checkMentionsUser } from './text-extractor.js';
import { SpamDetector } from './spam-detector.js';
import { ContentBlurrer } from './content-blurrer.js';

export class Scanner {
  constructor(platform, config) {
    this.platform = platform;
    this.config   = config;
    this.detector = new Detector(config);
    this.aiAnalyzer = new AIAnalyzer(config);
    this.ruleLearner = new RuleLearner(config);
    // this.ruleManager = new RuleManager(); // 远程规则暂未启用
    this.blocker  = new Blocker(platform, config);
    this.evidence = new Evidence(config);
    this.topicFilter = new TopicFilter(this.aiAnalyzer);
    this.hotTopicManager = new HotTopicManager();
    this.contextWindow = new ContextWindow({ windowMs: 60000 });
    this.memory = new MemoryManager();
    this._revealedTexts = new Set(); // 存储已手动解除屏蔽的文本 hash
    this._contentBlurrer = new ContentBlurrer({
      revealedTexts: this._revealedTexts,
      textHash: ContentBlurrer.textHash,
    });
    this._spamDetector = new SpamDetector();
    this.observer = null;
    this._seen = new WeakSet();
    this._pendingNodes = [];
    this._flushTimer = null;
    this._spamCheckTimer = null;
    this._statsEmitTimer = null;
    this._lastStatsEmit = 0;
    // Shadow DOM 观察器集合
    this._shadowObservers = [];
    // Web Component 文本提取重试计数（shadow DOM 内容可能异步渲染）
    this._retryMap = new WeakMap();
    // 消息中心当前使用的选择器（由 _scanMessages 设置，供 _extractText/_extractUsername 使用）
    this._currentMessageSelectors = null;
    // 私信页面聊天对方用户名（气泡内不含用户名，需从头部获取）
    this._whisperChatPartner = null;

    // ── 实时统计数据 ──────────────────────────────────────────────────────────
    this.stats = {
      scanned: 0,
      filtered: 0,
      suspicious: 0,
      spamBlocked: 0,
      aiAnalyzed: 0,
      lastScanTime: null,
      activeRules: 0,
      hardRules: 0,
      softRules: 0,
      regexRules: 0,
      customRules: 0,
      learnedRules: 0,
      contextRules: 0,
      platform: platform.name,
      observerActive: false,
      waitingForInit: false,
    };
    // 从 GM 存储恢复历史统计数据 + 设置自动持久化
    this._initStats();
  }

  /** 初始化规则 + 记忆清理（远程规则暂未启用） */
  async initRules() {
    // await this.ruleManager.init();
    // this.ruleManager.mergeToDetector(this.detector);
    // 同步已学习规则到 detector
    this.ruleLearner.syncToDetector(this.detector);
    // 启动时清理过期记忆
    this.memory.prune();
  }

  async start() {
    if (!this.config.enabled) return;

    // 初始化远程词库（先加载缓存，远程拉取失败不影响继续扫描）
    await this.initRules();

    // ── 根据页面类型选择不同的等待逻辑 ─────────────────────────────────
    const pageType = this.platform.isMessagePage?.();

    if (pageType && this.platform.waitForMessages) {
      // 消息中心页面（回复我的/私信等）
      this.stats.waitingForInit = true;
      emit('stats:update', this._getStatsPayload());
      const ready = await this.platform.waitForMessages();
      this.stats.waitingForInit = false;
      if (!ready) {
        console.warn(`[CyberShield] Message page init timeout for ${this.platform.name}, attempting fallback scan`);
      }
    } else if (this.platform.waitForComments) {
      // 评论页面
      this.stats.waitingForInit = true;
      emit('stats:update', this._getStatsPayload());
      const ready = await this.platform.waitForComments();
      this.stats.waitingForInit = false;
      if (!ready) {
        console.warn(`[CyberShield] Platform init timeout for ${this.platform.name}, attempting fallback scan`);
      }
    }

    // 更新规则计数
    this._updateRuleCounts();

    // 首次扫描（包含 Shadow DOM 穿透）
    this._scanAll();

    // 设置 MutationObserver（主文档 + Shadow DOM）
    this._setupObservers();

    this.stats.observerActive = true;
    this.stats.lastScanTime = Date.now();

    console.log(`[CyberShield] Scanner started on ${this.platform.name}`);
    emit('stats:update', this._getStatsPayload());
  }

  stop() {
    this.observer?.disconnect();
    for (const so of this._shadowObservers) so.disconnect();
    this._shadowObservers = [];
    if (this._flushTimer) {
      cancelAnimationFrame(this._flushTimer);
      this._flushTimer = null;
    }
    if (this._spamCheckTimer) {
      clearTimeout(this._spamCheckTimer);
      this._spamCheckTimer = null;
    }
    if (this._statsEmitTimer) {
      clearTimeout(this._statsEmitTimer);
      this._statsEmitTimer = null;
    }
    this._pendingNodes = [];
    this.stats.observerActive = false;
    emit('stats:update', this._getStatsPayload());
  }

  /**
   * 手动扫描 — 用户点击"手动扫描"按钮时触发。
   * 重新执行完整扫描流程，但不重置统计。
   */
  manualScan() {
    console.log('[CyberShield] Manual scan triggered');
    // ★ 重置已处理记录，确保所有评论都能被重新扫描
    // 这对于新添加的自定义关键词生效至关重要
    this._seen = new WeakSet();
    // ★ 重置刷屏/骚扰指纹记录，避免多次手动扫描叠加计数导致误判
    this._spamDetector.reset();

    const pageType = this.platform.isMessagePage?.();
    if (pageType) {
      this._scanMessages(pageType);
      // _scanMessages 仅处理回复页骚扰检测，需补充刷屏检测
      this._detectSpam();
    } else {
      this._scanComments();
      this._detectSpam();
      this._detectHarassment();
    }

    this.stats.lastScanTime = Date.now();
    emit('stats:update', this._getStatsPayload());
  }

  /** 从 GM 存储恢复统计数据 + Proxy 自动持久化 */
  _initStats() {
    // 持久化统计的 GM 存储键
    const STATS_KEY = 'cs_stats';
    // 从存储加载历史数据
    try {
      const saved = JSON.parse(GM_getValue(STATS_KEY, null));
      if (saved) {
        // 跳过 platform（始终使用当前平台的名称）
        const { platform, ...restorable } = saved;
        Object.assign(this.stats, restorable);
      }
    } catch (e) { /* 首次运行无数据，使用默认值 */ }

    // 用 Proxy 包装 stats：属性变更时自动持久化（防抖 500ms）
    const self = this;
    this._statsSaveTimer = null;
    const handler = {
      set(target, prop, value) {
        target[prop] = value;
        if (self._statsSaveTimer) clearTimeout(self._statsSaveTimer);
        self._statsSaveTimer = setTimeout(() => self._saveStats(STATS_KEY), 500);
        return true;
      }
    };
    this.stats = new Proxy(this.stats, handler);

    // 页面关闭前也保存一次
    window.addEventListener('beforeunload', () => this._saveStats(STATS_KEY));
  }

  /** 持久化统计数据到 GM 存储 */
  _saveStats(key) {
    try {
      GM_setValue(key, JSON.stringify(this.stats));
    } catch (e) { /* 静默 */ }
  }

  _updateRuleCounts() {
    this.stats.hardRules    = this.detector.hardKeywords.size;
    this.stats.softRules    = this.detector.softKeywords.size;
    this.stats.regexRules   = this.detector.regexPatterns.length;
    this.stats.customRules  = (this.config.customKeywords || []).length;
    this.stats.learnedRules = this.ruleLearner.getHardKeywords().length + this.ruleLearner.getSoftKeywords().length + this.ruleLearner.getRegexPatterns().length;
    const cand = this.ruleLearner.getCandidates();
    this.stats.candidateTotal = cand.total;
    this.stats.candidatePending = cand.pending;
    this.stats.suggestionsCount = this.ruleLearner.getPendingSuggestions().length;
    this.stats.contextRules = this.detector.contextRuleEngine.getAllRules().length;
    this.stats.activeRules  = this.stats.hardRules + this.stats.softRules + this.stats.regexRules + this.stats.customRules;
  }

  _getStatsPayload() {
    return {
      scanned:         this.stats.scanned,
      filtered:        this.stats.filtered,
      suspicious:      this.stats.suspicious,
      spamBlocked:     this.stats.spamBlocked,
      aiAnalyzed:      this.stats.aiAnalyzed,
      lastScanTime:    this.stats.lastScanTime,
      activeRules:     this.stats.activeRules,
      hardRules:       this.stats.hardRules,
      softRules:       this.stats.softRules,
      regexRules:      this.stats.regexRules,
      customRules:     this.stats.customRules,
      learnedRules:    this.stats.learnedRules,
      candidateTotal:  this.stats.candidateTotal,
      candidatePending:this.stats.candidatePending,
      suggestionsCount:this.stats.suggestionsCount,
      contextRules:    this.stats.contextRules,
      platform:        this.stats.platform,
      observerActive:  this.stats.observerActive,
      waitingForInit:  this.stats.waitingForInit,
      enabled:         this.config.enabled,
      aiStatus:        this.aiAnalyzer.getStatus(),
      memoryStats:     this.memory.getStats(),
      contextWindowStats: this.contextWindow.getStats(),
    };
  }

  // ── Observer 设置（主文档 + Shadow DOM 穿透） ───────────────────────────────

  _setupObservers() {
    const skipTags = new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','CANVAS','SVG','CODE','PRE','LINK','META','TITLE','HEAD']);

    const observerCallback = (mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (skipTags.has(node.tagName)) continue;
          if (node.id === 'cs-panel' || node.id === 'cs-chat-panel' || node.id === 'cs-overlay') continue;
          this._pendingNodes.push(node);
        }
      }
      if (this._pendingNodes.length > 0) this._scheduleFlush();
    };

    // 主文档 MutationObserver
    this.observer = new MutationObserver(observerCallback);
    this.observer.observe(document.body, { childList: true, subtree: true });

    // Shadow DOM MutationObserver — 递归进入所有 shadowRoot
    this._observeShadowDOMs(document.body, observerCallback);
  }

  /**
   * 递归查找所有 shadowRoot 并附加 MutationObserver。
   * 当新 shadowRoot 出现时（新 Web Component 渲染），也自动附加观察器。
   */
  _observeShadowDOMs(root, callback) {
    const elements = [];

    function collectShadowHosts(node) {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.shadowRoot) {
        elements.push(node);
        for (const child of node.shadowRoot.children || []) {
          collectShadowHosts(child);
        }
        const walker = document.createTreeWalker(node.shadowRoot, NodeFilter.SHOW_ELEMENT);
        let cur;
        while ((cur = walker.nextNode()) !== null) {
          if (cur.shadowRoot) collectShadowHosts(cur);
        }
      }
      if (node.children) {
        for (const child of node.children) collectShadowHosts(child);
      }
    }
    collectShadowHosts(root);

    for (const el of elements) {
      try {
        const alreadyObserved = this._shadowObservers.some(so => {
          try { return so._observedRoot === el.shadowRoot; } catch { return false; }
        });
        if (alreadyObserved) continue;
        const so = new MutationObserver(callback);
        so.observe(el.shadowRoot, { childList: true, subtree: true });
        so._observedRoot = el.shadowRoot;
        this._shadowObservers.push(so);
      } catch (_e) {
        // closed shadow root 无法观察，跳过
      }
    }
  }

  /**
   * 当发现新的 shadowRoot 时，动态附加观察器。
   */
  _attachShadowObserver(el) {
    if (!el.shadowRoot) return;
    // 防止重复观察
    const alreadyObserved = this._shadowObservers.some(so => {
      try { return so._observedRoot === el.shadowRoot; } catch { return false; }
    });
    if (alreadyObserved) return;

    try {
      const skipTags = new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','CANVAS','SVG','CODE','PRE','LINK','META']);
      const callback = (mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            if (skipTags.has(node.tagName)) continue;
            this._pendingNodes.push(node);
          }
        }
        if (this._pendingNodes.length > 0) this._scheduleFlush();
      };
      const so = new MutationObserver(callback);
      so.observe(el.shadowRoot, { childList: true, subtree: true });
      so._observedRoot = el.shadowRoot;
      this._shadowObservers.push(so);

      // 新 shadowRoot 内可能还有嵌套 shadowRoot
      this._observeShadowDOMs(el.shadowRoot, callback);
    } catch (e) {}
  }

  _scheduleFlush() {
    if (this._flushTimer) return;
    this._flushTimer = requestAnimationFrame(() => {
      this._flushTimer = null;
      let batch = this._pendingNodes;
      this._pendingNodes = [];

      const MAX_BATCH = 80;
      if (batch.length > MAX_BATCH) {
        batch = batch.slice(-MAX_BATCH);
      }

      const seenInBatch = new Set();
      for (const node of batch) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (seenInBatch.has(node)) continue;
        seenInBatch.add(node);
        if (this._seen.has(node) && !node.shadowRoot) continue;
        if (node.shadowRoot) {
          this._attachShadowObserver(node);
        }
        this._scanSubtree(node);
      }

      if (batch.length > 0) {
        this.stats.lastScanTime = Date.now();
        this._scheduleSpamCheck();
        this._throttledEmitStats();
      }
    });
  }

  _scheduleSpamCheck() {
    if (this._spamCheckTimer) return;
    this._spamCheckTimer = setTimeout(() => {
      this._spamCheckTimer = null;
      const pageType = this.platform.isMessagePage?.();
      if (!pageType) {
        this._detectSpam();
        this._detectHarassment();
      }
    }, 1200);
  }

  _throttledEmitStats() {
    const now = Date.now();
    if (now - this._lastStatsEmit < 500) {
      if (this._statsEmitTimer) return;
      this._statsEmitTimer = setTimeout(() => {
        this._statsEmitTimer = null;
        this._lastStatsEmit = Date.now();
        emit('stats:update', this._getStatsPayload());
      }, 500 - (now - this._lastStatsEmit));
      return;
    }
    this._lastStatsEmit = now;
    emit('stats:update', this._getStatsPayload());
  }

  // ── 扫描 ────────────────────────────────────────────────────────────────────

  /**
   * 首次扫描：根据页面类型搜索评论/消息元素。
   */
  _scanAll() {
    const pageType = this.platform.isMessagePage?.();

    if (pageType) {
      this._scanMessages(pageType);
      // _scanMessages 内已包含骚扰检测（仅回复页面）
    } else {
      this._scanComments();
      this._detectSpam();
      this._detectHarassment();
    }

    this.stats.lastScanTime = Date.now();
    emit('stats:update', this._getStatsPayload());
  }

  _scanComments() {
    const containers = document.querySelectorAll(this.platform.selectors.commentContainer);
    console.log(`[CyberShield] Found ${containers.length} comment containers in DOM`);
    for (const el of containers) {
      this._processComment(el);
    }

    const shadowComments = this._deepQueryAll(this.platform.selectors.commentContainer);
    if (shadowComments.length > 0) {
      console.log(`[CyberShield] Found ${shadowComments.length} comment containers in Shadow DOM`);
      for (const el of shadowComments) {
        if (!this._seen.has(el)) {
          this._processComment(el);
        }
      }
    }

    const totalFound = containers.length + shadowComments.length;
    emit('scan:status', { count: totalFound, selector: this.platform.selectors.commentContainer });

    if (totalFound === 0) {
      this._tryProbeSelectors();
    }
  }

  /**
   * 扫描消息中心内容（回复我的/私信等）。
   * 根据 pageType 使用不同的选择器：
   * - 'whisper' → whisperContainer/whisperText/whisperUsername
   * - 'reply' / 'at' / 'message' → replyPageContainer/replyPageText/replyPageUsername
   */
  _scanMessages(pageType) {
    let containerSel, textSel, usernameSel;
    if (pageType === 'whisper') {
      containerSel = this.platform.selectors.whisperContainer;
      textSel = this.platform.selectors.whisperText;
      usernameSel = this.platform.selectors.whisperUsername;
    } else {
      containerSel = this.platform.selectors.replyPageContainer;
      textSel = this.platform.selectors.replyPageText;
      usernameSel = this.platform.selectors.replyPageUsername;
    }
    if (!containerSel) {
      containerSel = this.platform.selectors.messageContainer;
      textSel = this.platform.selectors.messageText;
      usernameSel = this.platform.selectors.messageUsername;
    }

    // ★ 设置当前使用的选择器（供 _extractText/_extractUsername/_findTextElement 在消息页面使用）
    this._currentMessageSelectors = { textSel, usernameSel };

    // ★ 私信页面：预先缓存聊天对方的用户名（私信气泡内不含用户名，需从聊天头部获取）
    if (pageType === 'whisper') {
      this._whisperChatPartner = this._extractWhisperPartnerName();
    }

    // 1. 传统 DOM 搜索
    const messages = document.querySelectorAll(containerSel);
    console.log(`[CyberShield] Found ${messages.length} message items (${pageType}) in DOM`);

    for (const el of messages) {
      // ★ 私信页面：跳过自己发的消息（带 MsgTextIsMe 标记）
      if (pageType === 'whisper' && this._isSelfMessage(el)) continue;
      this._processComment(el);
    }

    // 2. Shadow DOM 穿透搜索
    const shadowMessages = this._deepQueryAll(containerSel);
    if (shadowMessages.length > 0) {
      console.log(`[CyberShield] Found ${shadowMessages.length} message items (${pageType}) in Shadow DOM`);
      for (const el of shadowMessages) {
        if (!this._seen.has(el)) {
          if (pageType === 'whisper' && this._isSelfMessage(el)) continue;
          this._processComment(el);
        }
      }
    }

    const totalFound = messages.length + shadowMessages.length;
    emit('scan:status', { count: totalFound, selector: containerSel });

    if (totalFound === 0) {
      this._tryProbeMessageSelectors(pageType);
    }

    // ★ 骚扰检测（仅回复页面）：同一用户 >= 5 条回复触发
    if (pageType === 'reply' || pageType === 'at') {
      this._detectHarassment();
    }
  }

  /**
   * 判断私信气泡是否是自己发的消息。
   * B站私信 DOM 中自己发的消息带 [class*="MsgTextIsMe"] 标记。
   */
  _isSelfMessage(el) {
    return isSelfMessage(el, this.platform);
  }

  /**
   * 从私信聊天界面头部提取对方用户名。
   * B站私信页面的聊天头部通常包含对方的昵称和头像链接。
   */
  _extractWhisperPartnerName() {
    // 尝试从聊天头部获取对方昵称
    // B站实际 DOM: ._ChatHeader_1lacc_14 > ._ContactName_1lacc_26
    const headerSelectors = [
      '[class*="ContactName"]',
      '[class*="ChatHeader"] [class*="name"]',
      '[class*="ChatHeader"] [class*="Name"]',
      '[class*="ChatHeader"] [class*="title"]',
      '[class*="ChatHeader"] a[href*="space"]',
      '[class*="chat-header"] [class*="name"]',
      '[class*="chat-header"] a[href*="space"]',
      '[class*="MsgPanel"] [class*="name"]',
      '[class*="whisper"] [class*="header"] [class*="name"]',
      '[class*="Conversation"] [class*="name"]',
    ];
    for (const sel of headerSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const name = el.innerText?.trim() || el.getAttribute('title')?.trim();
        if (name && name.length < 50 && name.length >= 1) {
          console.log(`[CyberShield] Whisper partner name: "${name}"`);
          return name;
        }
      }
    }

    // 从聊天头部链接提取 UID（用于查找昵称）
    const headerLink = document.querySelector('[class*="ChatHeader"] a[href*="space.bilibili.com"], [class*="chat-header"] a[href*="space"]');
    if (headerLink) {
      const href = headerLink.getAttribute('href') || '';
      const uidMatch = href.match(/space\.bilibili\.com\/(\d+)/);
      if (uidMatch) return `UID:${uidMatch[1]}`;
    }

    console.warn('[CyberShield] Could not extract whisper partner name');
    return null;
  }

  /**
   * 探测性扫描：当消息中心选择器未命中时，用启发式方法找到消息条目。
   */
  _tryProbeMessageSelectors(pageType) {
    console.log('[CyberShield] Probing message center DOM...');
    const probeSelectors = [
      'li', '.list-item', '[class*="item"]', '[class*="Item"]',
      '[class*="card"]', '[class*="Card"]',
      '[class*="msg"]', '[class*="Msg"]',
      '[class*="notify"]', '[class*="Notify"]',
      '[class*="reply"]', '[class*="Reply"]',
      '[class*="whisper"]', '[class*="Whisper"]',
      '[class*="chat"]', '[class*="Chat"]',
      '[class*="message"]', '[class*="Message"]',
      'div[data-type]', 'div[role="listitem"]',
    ].join(', ');

    const probeItems = [...document.querySelectorAll(probeSelectors)]
      .filter(el => !el.closest('#cs-panel') && !el.closest('#cs-modal'))
      .filter(el => {
        const text = el.innerText?.trim() || '';
        return text.length >= 10 && text.length < 1000;
      });

    const shadowProbeItems = this._deepQueryAll(probeSelectors)
      .filter(el => !this._seen.has(el))
      .filter(el => {
        const text = el.innerText?.trim() || '';
        return text.length >= 10 && text.length < 1000;
      });

    const allProbe = [...probeItems, ...shadowProbeItems];
    if (allProbe.length >= 3) {
      console.log(`[CyberShield] Probe found ${allProbe.length} possible message items`);
      for (const el of allProbe) {
        if (!this._seen.has(el)) {
          this._processComment(el);
        }
      }
      emit('scan:status', { count: allProbe.length, selector: 'probe-message' });
    } else {
      console.log('[CyberShield] No message elements found even with probing');
      this._debugPrintMessageDom();
    }
  }

  /**
   * 调试输出消息中心页面的 DOM 结构。
   */
  _debugPrintMessageDom() {
    const probes = [
      'li', '.list-item', '[class*="item"]', '[class*="card"]',
      '[class*="msg"]', '[class*="reply"]', '[class*="whisper"]',
      '[class*="chat"]', '[class*="notify"]', '[class*="message"]',
      'div[data-type]', 'div[role]',
      'a[href*="space"]', '[class*="user"]', '[class*="content"]',
    ];
    console.log('%c[Droplet Message Diagnosis]', 'font-size:14px;font-weight:bold;color:#f59e0b');
    console.log('URL:', location.href, 'Hash:', location.hash);
    for (const probe of probes) {
      const n = document.querySelectorAll(probe).length;
      if (n > 0) {
        const sample = document.querySelector(probe);
        console.log(`  "${probe}" → ${n} matches, classes: "${sample.className?.slice(0, 80)}"`);
      }
    }
    console.log('Body children:');
    for (const child of document.body.children) {
      console.log(`  <${child.tagName?.toLowerCase()}> id="${child.id}" class="${child.className?.toString().slice(0, 60)}"`);
    }
  }

  _tryProbeSelectors() {
    const fallbackSelectors = [
      '[data-testid*="comment"]',
      '[aria-label*="comment"]',
      '[class*="comment"]',
      '[class*="reply"]',
      '[id*="comment"]',
      '[data-type="comment"]',
      'article',
    ].join(', ');

    const fallback = [...document.querySelectorAll(fallbackSelectors)]
      .filter(el => !el.closest('#cs-panel'))
      .filter(el => !el.closest('#cs-modal'))
      .filter(el => {
        const text = el.innerText?.trim() || '';
        return text.length >= 20 && !/^(\s|\n)*$/.test(text);
      });

    if (fallback.length > 0) {
      console.log(`[CyberShield] Fallback scanner found ${fallback.length} possible comment elements`);
      for (const el of fallback) {
        this._processComment(el);
      }
      emit('scan:status', { count: fallback.length, selector: 'fallback' });
      return;
    }

    // Shadow DOM 内的 fallback 探查
    const shadowFallback = this._deepQueryAll(fallbackSelectors)
      .filter(el => {
        const text = this._extractTextFromShadow(el)?.trim() || '';
        return text.length >= 10;
      });

    if (shadowFallback.length > 0) {
      console.log(`[CyberShield] Shadow fallback found ${shadowFallback.length} elements`);
      for (const el of shadowFallback) {
        this._processComment(el);
      }
      emit('scan:status', { count: shadowFallback.length, selector: 'shadow-fallback' });
      return;
    }

    console.log('[CyberShield] No comment elements found, running DOM probes...');
    const probes = ['bili-comment-thread-renderer', 'bili-comment-renderer', 'bili-rich-text',
      '[class*="reply"]', '[class*="comment"]', '[class*="Reply"]', '[class*="Comment"]'];
    for (const probe of probes) {
      const domHits = document.querySelectorAll(probe).length;
      const shadowHits = this._deepQueryAll(probe).length;
      if (domHits > 0 || shadowHits > 0) {
        console.log(`[CyberShield] Probe "${probe}" → DOM:${domHits} Shadow:${shadowHits}`);
      }
    }
  }

  _scanSubtree(root) {
    if (root.id === 'cs-panel' || root.id === 'cs-modal' || root.closest?.('#cs-panel') || root.closest?.('#cs-modal')) return;
    if (this._seen.has(root) && !root.shadowRoot) return;

    const commentSel = this.platform.selectors.commentContainer;

    if (root.matches?.(commentSel)) {
      this._processComment(root);
      return;
    }

    const tag = root.tagName;
    if (!tag) return;
    if (/^(SCRIPT|STYLE|NOSCRIPT|IFRAME|CANVAS|SVG|CODE|PRE|INPUT|TEXTAREA|SELECT|BUTTON|IMG|VIDEO|AUDIO|LINK|META)$/i.test(tag)) return;

    const isCommentRelated = /bili-comment|bili-rich-text|reply|comment|Comment|Reply|tweet|Tweet|weibo|wb-text|RichContent|Post-content/i.test(
      (typeof root.className === 'string' ? root.className : '') + ' ' + (root.id || '') + ' ' + (tag || '')
    );

    if (!isCommentRelated && root.children && root.children.length <= 3 && root.children.length > 0) {
      for (const child of root.children) {
        if (child.nodeType === Node.ELEMENT_NODE) this._scanSubtree(child);
      }
      return;
    }

    const found = [];
    this._deepQueryAllRecursive(root, commentSel, found);
    for (const el of found) {
      this._processComment(el);
    }
  }

  _processComment(el) {
    if (this._seen.has(el)) return;
    this._seen.add(el);

    // ★ 跳过已被模糊处理的元素（避免重复扫描导致按钮重复）
    if (el.dataset.csVerdict) return;

    // ★ 检测内容类型：评论/回复/私信
    const contentType = this._detectContentType(el);

    const text = this._extractText(el, contentType);
    if (!text || text.length < 3) {
      // ★ 对于 Web Component，shadow DOM 内容可能异步渲染尚未完成
      // 延迟重试（最多3次，间隔递增500ms/1000ms/1500ms）
      if (el.shadowRoot) {
        const retries = this._retryMap.get(el) || 0;
        if (retries < 3) {
          this._seen.delete(el);
          this._retryMap.set(el, retries + 1);
          const delay = 500 * (retries + 1);
          console.debug(`[CyberShield] Retry <${el.tagName?.toLowerCase() || '?'}> in ${delay}ms (attempt ${retries + 1})`);
          setTimeout(() => this._processComment(el), delay);
          return;
        }
      }
      console.debug(`[CyberShield] Skip <${el.tagName?.toLowerCase() || '?'}>: text length=${text?.length || 0}, text="${text?.slice(0, 60) || '(empty)'}"`);
      return;
    }

    const username = this._extractUsername(el, contentType);
    if (this.config.whitelist.includes(username)) return;

    // 更新扫描计数
    this.stats.scanned++;

    // ── 刷屏指纹记录 ──────────────────────────────────────────────────────
    this._recordSpamFingerprint(text, el);

    // ── 骚扰指纹记录（同一用户大量@回复） ──────────────────────────────
    if (contentType === 'reply') {
      this._recordHarassFingerprint(username, el);
    }

    const context = this._buildContext(el, username);
    context._element = el; // 传给 context-window
    context.contentType = contentType; // 供 HotTopicManager 做 scope 过滤

    // ★ 检测账号级别（白名单已在 _processComment 入口放行）
    const accountLevel = this.platform?.getAccountLevel
      ? this.platform.getAccountLevel(el) || 'normal'
      : 'normal';
    context.accountLevel = accountLevel;

    const result = this.detector.analyze(text, context, this.aiAnalyzer, (aiResult) => {
      if (!aiResult) return;

      // 规则学习：AI 判定为 toxic 时提取模式
      if (aiResult.verdict === Verdict.TOXIC) {
        const learnContext = {
          negativeSignals: this._extractNegativeSignals(text),
        };
        this.ruleLearner.learn(aiResult, text, learnContext);
        this.ruleLearner.syncToDetector(this.detector);

        // 写入记忆（中期 pattern）
        if (aiResult.patterns && aiResult.patterns.length > 0) {
          this.memory.write({
            type: 'pattern',
            key: aiResult.patterns[0],
            value: { intent: aiResult.intent, verdict: aiResult.verdict },
            confidence: aiResult.confidence,
            source: 'ai_learned',
          });
          // ★ 记忆写入后立即刷新面板统计
          emit('stats:update', this._getStatsPayload());
        }

        // ★ AI 自动升级拦截系统：将高置信度模式提升为硬关键词
        if (aiResult.confidence >= 0.85 && aiResult.patterns && aiResult.patterns.length > 0) {
          if (!this.config.autoLearnedKeywords) this.config.autoLearnedKeywords = [];
          let newCount = 0;
          for (const p of aiResult.patterns) {
            const lower = p.toLowerCase().trim();
            if (lower.length >= 2 && !this.config.autoLearnedKeywords.includes(lower) && !this.detector.hardKeywords.has(lower)) {
              this.config.autoLearnedKeywords.push(lower);
              // ★ 修复：立即同步到 detector.hardKeywords，无需刷新页面即可生效
              this.detector.hardKeywords.add(lower);
              this.detector._autoLearnedKeywordKeys?.add(lower);
              newCount++;
            }
          }
          // 限制数量，避免膨胀
          if (this.config.autoLearnedKeywords.length > 100) {
            this.config.autoLearnedKeywords = this.config.autoLearnedKeywords.slice(-100);
          }
          if (newCount > 0) {
            // 持久化配置
            try { GM_setValue('cs_config', JSON.stringify(this.config)); } catch (e) {}
            emit('config:updated', { type: 'autoLearnedKeywords' });
            // ★ 刷新面板统计（autoLearnedKeywords 数量变化）
            emit('stats:update', this._getStatsPayload());
          }
        }

        // ★ AI 自动更新话题过滤器关键词和匹配示例
        if (aiResult.intent && this.topicFilter) {
          try {
            this.topicFilter.learnFromAI(aiResult.intent, aiResult.patterns || [], text, username, aiResult.confidence);
          } catch (e) { /* silent */ }
        }
      }

      // AI 判定结果的风险等级处理
      if (aiResult.verdict === Verdict.TOXIC && shouldAct(aiResult.riskLevel || 'high', this.config.sensitivity)) {
        this._handleToxic(el, text, username, aiResult, contentType);
      }

      // ★ AI 结果更新扫描日志：重新 emit scan:result 标记 AI 层
      emit('scan:result', {
        text: text.slice(0, 200),
        username,
        verdict: aiResult.verdict,
        reason: aiResult.reason || 'AI analysis',
        confidence: aiResult.confidence,
        contentType,
        uid: this._extractUserUID(el),
        timestamp: Date.now(),
        layer: 3,
        aiDetected: true,
        aiSummary: aiResult.reason || '',
      });
    }, {
      topicFilter: this.topicFilter,
      hotTopicManager: this.hotTopicManager,
      contextWindow: this.contextWindow,
      accountLevel,
    });

    if (result.verdict === Verdict.TOXIC && shouldAct(result.riskLevel || 'high', this.config.sensitivity)) {
      console.log(`[CyberShield] TOXIC @${username || '?'} [${contentType}] risk=${result.riskLevel} matched=[${result.matched?.join(',') || ''}] reason=${result.reason}: "${text.slice(0, 60)}"`);
      this._handleToxic(el, text, username, result, contentType);

      // 规则命中计数
      if (result.matched && result.matched.length > 0) {
        for (const m of result.matched) {
          this.ruleLearner.recordHit(m);
        }
      }
    } else if (result.verdict === Verdict.SUSPICIOUS && shouldAct(result.riskLevel || 'medium', this.config.sensitivity)) {
      this._handleSuspicious(el, result);
    }

    // 更新扫描时间
    this.stats.lastScanTime = Date.now();

    emit('scan:result', {
      text: text.slice(0, 200),
      username,
      verdict: result.verdict,
      reason: result.reason,
      confidence: result.confidence,
      contentType,
      uid: this._extractUserUID(el),
      timestamp: Date.now(),
      layer: result.layer || 1,
      aiDetected: false,
    });

    this._throttledEmitStats();
  }

  // ── 内容类型检测 ────────────────────────────────────────────────────────────

  /**
   * 检测元素的内容类型：评论(comment)、回复(reply)、私信(message)。
   * 
   * 判断逻辑：
   * 1. URL 匹配私信页面 → message
   * 2. Shadow DOM 层级：在 bili-comment-replies-renderer 的 shadowRoot 中 → reply
   * 3. 传统 DOM：匹配回复选择器 → reply
   * 4. 其他 → comment
   */
  _detectContentType(el) {
    return detectContentType(el, this.platform);
  }

  // ── 刷屏检测 ────────────────────────────────────────────────────────────────

  /**
   * 记录评论文本指纹用于刷屏检测。
   * 使用标准化文本（去除空格、标点差异）作为指纹 key。
   */
  _recordSpamFingerprint(text, el) {
    this._spamDetector.recordSpamFingerprint(text, el);
  }

  _detectSpam() {
    const results = this._spamDetector.detectSpam();
    for (const { text, elements, count } of results) {
      console.log(`[CyberShield] SPAM detected: "${text.slice(0, 40)}" appears ${count} times`);
      this.stats.spamBlocked += count;
      this.stats.filtered += count;
      for (const el of elements) {
        this._handleSpam(el, text, count);
      }
      this.evidence.log({
        text,
        username: '(spam)',
        result: { verdict: 'spam', reason: `Same content repeated ${count} times`, confidence: 0.95, layer: 2, matched: ['spam_repetition'] },
        url: location.href,
        timestamp: Date.now(),
      });
    }
    if (results.length > 0) emit('stats:update', this._getStatsPayload());
  }

  // ── 骚扰检测 ──────────────────────────────────────────────────────────────

  _recordHarassFingerprint(username, el) {
    this._spamDetector.recordHarassFingerprint(username, el);
  }

  _detectHarassment() {
    const results = this._spamDetector.detectHarassment();
    for (const { username, elements, count } of results) {
      console.log(`[CyberShield] HARASS detected: @${username} sent ${count} replies`);
      this.stats.harassmentBlocked += count;
      this.stats.filtered += count;
      for (const el of elements) {
        const contentType = this._detectContentType(el);
        let targetEl = this._findTextElement(el, contentType);
        if (!targetEl) {
          const children = el.querySelectorAll('p, span, div');
          for (const child of children) {
            const childText = child.innerText?.trim() || '';
            if (childText.length >= 3 && childText.length < 2000 && child.children.length === 0) {
              targetEl = child;
              break;
            }
          }
        }
        if (!targetEl) targetEl = el;
        this._blurContent(targetEl, { reason: t('harassReason', { user: username, count }) }, 'harass');
      }
      this.evidence.log({
        text: t('harassEvidence', { user: username, count }),
        username,
        result: { verdict: 'harass', reason: t('harassResult', { count }), confidence: 0.9, layer: 2 },
        url: location.href,
        timestamp: Date.now(),
        contentType: 'reply',
      });
    }
    if (results.length > 0) emit('stats:update', this._getStatsPayload());
  }

  _handleSpam(el, text, count) {
    // ★ 只屏蔽文本内容，而非整个条目
    const contentType = this._detectContentType(el);
    let targetEl = this._findTextElement(el, contentType);
    if (!targetEl) {
      const children = el.querySelectorAll('p, span, div');
      for (const child of children) {
        const childText = child.innerText?.trim() || '';
        if (childText.length >= 3 && childText.length < 2000 && child.children.length === 0) {
          targetEl = child;
          break;
        }
      }
    }
    if (!targetEl) targetEl = el;
    this._blurContent(targetEl, { reason: t('spamReason', { count }) }, 'spam');

    // 扫描日志记录
    emit('scan:result', {
      text: text.slice(0, 200),
      username: '(spam)',
      verdict: 'toxic',
      reason: t('spamResult', { count }),
      confidence: 0.95,
      contentType: 'comment', // 刷屏总是评论类
      timestamp: Date.now(),
    });
  }

  // ── 有害内容处理 ────────────────────────────────────────────────────────────

  _handleToxic(el, text, username, result, contentType = 'comment') {
    // ★ 已手动解除屏蔽的内容不再重新屏蔽
    const textHash = this._textHash(text);
    if (this._revealedTexts.has(textHash)) return;

    this.stats.filtered++;
    const matchedTopics = this.topicFilter?.detectAllTopics(text) || [];
    this.evidence.log({ text, username, result, url: location.href, timestamp: Date.now(), contentType, matchedTopics });

    this.evidence.captureScreenshot(el).then(dataUrl => {
      if (dataUrl) {
        const log = this.evidence.getAll();
        if (log[0]) {
          log[0].screenshot = dataUrl;
          this.evidence._save(log);
        }
      }
    }).catch(() => {});

    // ★ 优先屏蔽文本元素；若找不到，尝试在容器内直接查找含文本的子元素
    let targetEl = this._findTextElement(el, contentType);
    if (!targetEl) {
      // Fallback: 在容器内查找包含长文本的子元素（避免模糊整个容器导致按钮不可见）
      const children = el.querySelectorAll('p, span, div');
      for (const child of children) {
        const childText = child.innerText?.trim() || '';
        if (childText.length >= 3 && childText.length < 2000 && child.children.length === 0) {
          targetEl = child;
          break;
        }
      }
    }
    if (!targetEl) targetEl = el;
    this._blurContent(targetEl, result, 'toxic');

    if (this.config.autoBlock && username) {
      // ★ 已拉黑的用户不再重复触发拉黑，只处理文本屏蔽
      if (!this.blocker.isBlocked(username)) {
        this.blocker.block(username, el);
      }
    }
  }

  _handleSuspicious(el, result) {
    this.stats.suspicious++;
    // ★ 只标记文本内容而非整个评论
    const contentType = this._detectContentType(el);
    const targetEl = this._findTextElement(el, contentType) || el;
    targetEl.style.border = '1px dashed rgba(255, 165, 0, 0.4)';
    targetEl.dataset.csVerdict = 'suspicious';
    targetEl.dataset.csRiskLevel = result.riskLevel || 'medium';
    targetEl.dataset.csReason = result.reason;
    targetEl.title = `[Droplet] ${result.riskLevel || 'medium'}: ${result.reason}`;
    console.log(`[CyberShield] SUSPICIOUS (${result.riskLevel || 'medium'}): "${result.reason}"`);
  }

  /**
   * 定位包含评论文本的具体元素（而非整个评论容器）。
   * 返回文本元素用于精确屏蔽，避免把头像、用户名、时间戳也一起模糊。
   * ★ 增强版：优先寻找 shadow DOM 中最底层的纯文本容器（如 <p>），
   *   确保 filter: blur() 能正确作用于实际显示文本的节点。
   */
  _findTextElement(el, contentType) {
    return findTextElement(el, contentType, this.platform, this._currentMessageSelectors);
  }

  /**
   * 屏蔽具体内容元素（只模糊违规文本，不模糊整个评论条目）。
   * 解除显示后提供"再次屏蔽"按钮防止误操作。
   * 
   * 定位策略：
   * - 在模糊区域正中央显示一个醒目的解除按钮（固定定位覆盖在元素上方）
   * - 使用 position: fixed 直接覆盖在目标元素上，不受 overflow 裁剪
   * - IntersectionObserver 控制显示/隐藏，滚动回视口后自动恢复
   * - ★ 每个按钮绑定目标元素的唯一 CS ID，避免批量扫描时互相删除
   */
  _blurContent(targetEl, result, type = 'toxic') {
    this._contentBlurrer.blurContent(targetEl, result, type);
  }

  /** 计算文本的简单哈希，用于去重 */
  _textHash(text) {
    return ContentBlurrer.textHash(text);
  }

  /**
   * 解除屏蔽后，在文本元素旁添加"再次屏蔽"按钮。
   * 用户可以点击重新隐藏违规内容，避免误操作后无法恢复屏蔽。
   * ★ 防止重复添加：先移除已有的按钮再添加新的。
   */
  _addReBlockOption(targetEl, result, type) {
    this._contentBlurrer.addReBlockOption(targetEl, result, type);
  }

  // ── 文本提取（支持 Shadow DOM 穿透） ──────────────────────────────────────

  /**
   * 从评论元素中提取文本。
   * 根据 contentType 选择不同的文本选择器。
   */
  _extractText(el, contentType = 'comment') {
    return extractText(el, contentType, this.platform, this._currentMessageSelectors);
  }

  /**
   * 从 Web Component 的 Shadow DOM 中智能提取评论文本。
   * 针对 B站等使用嵌套 Web Component 的平台，穿透多层 shadow DOM 找到纯评论文本。
   * B站 Shadow DOM 结构：
   *   bili-comment-thread-renderer → shadow → bili-comment-renderer → shadow → bili-rich-text → shadow → <p>
   */
  _extractTextFromShadow(el) {
    return extractTextFromShadow(el);
  }

  _extractUsername(el, contentType = 'comment') {
    return extractUsername(el, contentType, this.platform, this._currentMessageSelectors, this._whisperChatPartner);
  }

  /**
   * 从评论元素中提取用户 UID（B站专用）。
   * 用于扫描日志记录和批量拉黑功能。
   */
  _extractUserUID(el) {
    return extractUserUID(el);
  }

  /**
   * 在元素及其嵌套 Shadow DOM 中查找匹配选择器的第一个元素。
   * 关键修复：优先检查 root 自身的 shadowRoot。
   * 对于 Web Component（如 bili-comment-thread-renderer），所有子元素都在
   * shadowRoot 内，root.children 为空，必须先进入 shadowRoot 才能找到内容。
   */
  _deepQuerySelectorInEl(root, selector) {
    return deepQuerySelectorInEl(root, selector);
  }

  _extractNegativeSignals(text) {
    return extractNegativeSignals(text);
  }

  _buildContext(el, username) {
    const isReply = !!el.closest(this.platform.selectors.replyContainer || '[data-reply]');
    const text = this._extractText(el);
    const me = this.platform.getCurrentUser?.();
    return buildContext(this.platform, username, isReply, text, me);
  }

  _checkMentionsUser(el) {
    const me = this.platform.getCurrentUser?.();
    if (!me) return false;
    const text = this._extractText(el);
    return checkMentionsUser(text, me);
  }

  // ── Shadow DOM 深度查询工具 ────────────────────────────────────────────────

  /**
   * 在整个页面（包括所有 Shadow DOM）中查找匹配选择器的所有元素。
   */
  _deepQueryAll(selector) {
    return deepQueryAll(selector);
  }

  _deepQueryAllRecursive(root, selector, results) {
    deepQueryAllRecursive(root, selector, results);
  }

  /**
   * 在指定的 shadow root 中查找匹配选择器的所有元素。
   */
  _deepQuerySelectorAllInRoot(shadowRoot, selector) {
    return deepQuerySelectorAllInRoot(shadowRoot, selector);
  }

  // ── AI 语义模块交互接口 ──────────────────────────────────────────────────

  /**
   * 用户标记误判（记忆污染恢复 A5 / A9）
   * @param {number} evidenceIndex  取证记录索引
   * @returns {{ success: boolean, message: string }}
   */
  markFalsePositive(evidenceIndex) {
    const logs = this.evidence.getAll();
    const entry = logs[evidenceIndex];
    if (!entry) return { success: false, message: 'Record not found' };

    // 1. 从取证记录中获取匹配的触发词
    const matched = entry.result?.matched || [];
    let deleted = false;

    for (const trigger of matched) {
      // 2. 通知 rule-learner 降低置信度
      const lrResult = this.ruleLearner.recordCorrection(trigger);
      if (lrResult.deleted) deleted = true;

      // 3. 通知 context-rule-engine
      const crResult = this.detector.contextRuleEngine.recordCorrection(trigger);
      if (crResult.deleted) deleted = true;
    }

    // 4. 更新取证记录标记
    entry.falsePositive = true;
    this.evidence._save(logs);

    // 5. 重新同步规则到 detector
    this.ruleLearner.syncToDetector(this.detector);
    this._updateRuleCounts();
    emit('stats:update', this._getStatsPayload());

    return {
      success: true,
      message: deleted ? 'Rule deleted (confidence too low)' : 'Confidence reduced',
      deletedRules: deleted,
    };
  }

  /**
   * 获取话题过滤器状态（供面板使用）
   */
  getTopicFilter() {
    return this.topicFilter;
  }

  /**
   * 获取热点话题管理器（供面板和 Agent 使用）
   */
  getHotTopicManager() {
    return this.hotTopicManager;
  }

  /**
   * 获取 AI 分析器状态（供面板使用）
   */
  getAIStatus() {
    return this.aiAnalyzer.getStatus();
  }

  /**
   * 更新 AI 配置（面板实时修改时调用）
   */
  updateAIConfig(newConfig) {
    this.aiAnalyzer.updateConfig(newConfig);
    // 同步更新 TopicFilter 的 AI 分析器
    if (this.topicFilter) {
      this.topicFilter.setAIAnalyzer(this.aiAnalyzer);
    }
  }

  /**
   * 手动触发话题语义检测（供面板测试使用）
   * @param {string} text  要检测的文本
   * @returns {Promise<{topics: string[], keywords: string[]}>}
   */
  async detectTopicsWithAI(text) {
    if (!this.topicFilter) return { topics: [], keywords: [] };
    const keywords = this.topicFilter.detectTopics(text);
    const topics = await this.topicFilter.detectTopicsWithAI(text, { skipCache: true });
    return { topics, keywords };
  }

  /**
   * 清空话题语义检测缓存
   */
  clearTopicSemanticCache() {
    if (this.topicFilter) {
      this.topicFilter.clearSemanticCache();
    }
  }

  /**
   * 获取记忆管理器统计
   */
  getMemoryStats() {
    return this.memory.getStats();
  }

  /**
   * 获取已学习规则详情（供面板展示）
   */
  getLearnedRules() {
    return this.ruleLearner.getAllRulesDetailed();
  }

  /**
   * 手动触发远程词库更新（远程规则暂未启用）
   */
  async refreshRemoteRules() {
    // await this.ruleManager.fetchRemote();
    // this.ruleManager.mergeToDetector(this.detector);
    this.ruleLearner.syncToDetector(this.detector);
    this._updateRuleCounts();
    emit('stats:update', this._getStatsPayload());
  }
}

GM_addStyle(`
  .cs-blurred {
    filter: blur(12px) !important;
    pointer-events: none !important;
    user-select: none !important;
    transition: filter 0.2s ease;
    opacity: 0.5;
  }

  /* ★ 小浮动按钮：放在气泡右侧，不遮挡对话内容 */
  .cs-reveal-float {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    border: 1px solid var(--cs-border, #ccc);
    border-radius: 12px;
    background: var(--cs-bg, #fff);
    color: var(--cs-text, #555);
    cursor: pointer;
    font-size: 13px;
    line-height: 1.5;
    white-space: nowrap;
    vertical-align: middle;
    margin-left: 6px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: background 0.15s, box-shadow 0.15s;
    z-index: 9999;
    position: relative;
  }

  .cs-reveal-float:hover {
    background: var(--cs-accent, #2563eb);
    color: #fff;
    border-color: var(--cs-accent, #2563eb);
    box-shadow: 0 2px 6px rgba(37,99,235,0.25);
  }

  .cs-reveal-float.cs-spam-overlay {
    border-color: #fbbf24;
    color: #92400e;
  }
  .cs-reveal-float.cs-spam-overlay:hover {
    background: #fef3c7;
    border-color: #f59e0b;
  }

  .cs-reveal-float.cs-harass-overlay {
    border-color: #f472b6;
    color: #9d174d;
  }
  .cs-reveal-float.cs-harass-overlay:hover {
    background: #fce7f3;
    border-color: #ec4899;
  }

  .cs-reveal-btn {
    padding: 6px 16px;
    border: 1px solid var(--cs-border, #ccc);
    border-radius: 6px;
    background: var(--cs-bg, #fff);
    color: var(--cs-text, #333);
    cursor: pointer;
    font-size: 13px;
    transition: background 0.15s;
  }

  .cs-reveal-btn:hover {
    background: var(--cs-accent, #2563eb);
    color: #fff;
    border-color: var(--cs-accent, #2563eb);
  }

  .cs-reblock-btn {
    display: inline-block;
    padding: 4px 12px;
    border: 1px solid var(--cs-danger, #ef4444);
    border-radius: 6px;
    background: #fff;
    color: var(--cs-danger, #ef4444);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    margin-left: 6px;
    transition: background 0.15s;
    /* ★ 修复：z-index 从 2147483647（max int）改为 2147483640。
       原因：旧值与 #cs-overlay (2147483647) / #cs-dashboard (2147483646) 同级，
       推特页面的"再次屏蔽"按钮会盖在控制面板之上。
       改用 2147483640 后，仍高于普通页面内容，但低于控制面板。 */
    z-index: 2147483640;
  }

  .cs-reblock-btn:hover {
    background: var(--cs-danger, #ef4444);
    color: #fff;
  }

  /* ★ 当 Droplet 控制面板打开时，自动隐藏所有再屏蔽按钮与解模糊按钮，
     避免遮挡控制面板内的可点击元素（确认/取消按钮等）。
     面板关闭后按钮自动恢复。 */
  body.cs-dashboard-open .cs-reblock-btn,
  body.cs-dashboard-open .cs-reveal-btn { display: none !important; }
`);