/**
 * rule-learner.js — AI 规则学习器（候选池机制）
 *
 * 设计原则：积极学习，谨慎生效
 *   1. 学到的词先进入"候选池"，不立即生效
 *   2. 同一个词被 AI 判定 toxic 3 次以上才激活
 *   3. 新词默认是软词（需多个才触发），避免误杀
 *   4. 用户标记误判后，证据清零，置信度减半
 *
 * 规则类型：
 *   - hard_keyword:    高置信度攻击性词汇 → 直接加入硬关键词
 *   - soft_keyword:    中置信度/歧义词汇 → 加入软关键词（需多个才触发）
 *   - regex:           含变体/谐音的模式 → 生成正则表达式
 *   - context_sensitive: 触发词 + 上下文中负面信号组合
 */

const LEARNED_RULES_KEY = 'cs_learned_rules';
const UPGRADE_SUGGESTIONS_KEY = 'cs_upgrade_suggestions';
const CANDIDATES_KEY = 'cs_rule_candidates';

// ── 升级建议自动生效阈值 ──────────────────────────────────────────────────
// 同一个词被 AI 建议升级达到此次数后，自动生效
const AUTO_UPGRADE_THRESHOLD = 3;

// ── 候选池激活阈值 ──────────────────────────────────────────────────────
// 同一个词被 AI 判定 toxic 达到此次数后，从候选池激活为正式规则
const CANDIDATE_ACTIVATE_THRESHOLD = 3;

// ── 攻击性词根特征（用于判断是否为硬屏蔽词） ──────────────────────────────
const HARD_SIGNAL_CHARS = ['傻', '蠢', '贱', '滚', '死', '杀', '废', '狗', '猪', '畜',
  'fuck', 'shit', 'damn', 'ass', 'bitch', 'cunt', 'dick', 'retard', 'moron', 'idiot'];

export class RuleLearner {
  constructor(config) {
    this.config = config;
    this.rules = { hardKeywords: [], softKeywords: [], regex: [], contextSensitive: [] };
    this.upgradeSuggestions = []; // 升级建议列表
    this.candidates = []; // 候选池：学到的词先进入这里，积累证据后才激活
    this._load();
  }

  /**
   * 从 AI 结果学习（积极学习，宽松条件）
   *
   * 优先级：keywords > patterns > variants
   * 只要 AI 返回了这些字段，且 confidence >= 0.6，就学习
   */
  learn(aiResult, originalText, context) {
    if (aiResult.verdict !== 'toxic') return;
    if (aiResult.confidence < 0.6) return; // 置信度太低不学

    // 提取要学习的词
    const keywords = this._extractKeywords(aiResult);
    if (!keywords || keywords.length === 0) return;

    // 每个词进入候选池
    for (const kw of keywords) {
      this._addToCandidate(kw, originalText, aiResult.confidence, context);
    }

    // 检查候选池，看是否有词可以激活
    this._checkAndActivate();

    this._prune();
    this._save();
  }

  /**
   * 从 AI 结果中提取关键词（宽松条件）
   * 优先级：keywords > patterns > variants
   */
  _extractKeywords(aiResult) {
    const keywords = [];

    // 1. 优先使用 keywords 字段（AI 明确提取的关键词）
    if (aiResult.keywords && aiResult.keywords.length > 0) {
      for (const kw of aiResult.keywords) {
        const trigger = kw.toLowerCase().trim();
        if (trigger.length >= 2 && !this._ruleExists(trigger) && !this._isRejected(trigger)) {
          keywords.push(trigger);
        }
      }
    }

    // 2. 使用 patterns 字段（短语模式）
    if (aiResult.patterns && aiResult.patterns.length > 0) {
      for (const pattern of aiResult.patterns) {
        const trigger = pattern.toLowerCase().trim();
        if (trigger.length >= 2 && !this._ruleExists(trigger) && !keywords.includes(trigger) && !this._isRejected(trigger)) {
          keywords.push(trigger);
        }
      }
    }

    // 3. 使用 variants 字段（谐音/变体）
    if (aiResult.variants && aiResult.variants.length > 0) {
      for (const variant of aiResult.variants) {
        const trigger = variant.toLowerCase().trim();
        if (trigger.length >= 2 && !this._ruleExists(trigger) && !keywords.includes(trigger) && !this._isRejected(trigger)) {
          keywords.push(trigger);
        }
      }
    }

    return keywords.length > 0 ? keywords : null;
  }

  /** 检查词是否已被用户标记为误判（永久拒绝） */
  _isRejected(trigger) {
    return this.candidates.some(c => c.trigger === trigger && c.status === 'rejected');
  }

  /**
   * 将词加入候选池
   */
  _addToCandidate(trigger, contextText, confidence, context) {
    // 检查是否已在候选池中
    const existing = this.candidates.find(c => c.trigger === trigger);

    if (existing) {
      // 累积证据
      existing.evidence.push({
        context: contextText.slice(0, 80),
        confidence,
        timestamp: Date.now(),
      });
      // 只保留最近 5 条证据
      if (existing.evidence.length > 5) {
        existing.evidence = existing.evidence.slice(-5);
      }
      existing.evidenceCount++;
      existing.avgConfidence = (existing.avgConfidence * (existing.evidenceCount - 1) + confidence) / existing.evidenceCount;
    } else {
      // 新词进入候选池
      this.candidates.push({
        trigger,
        evidenceCount: 1,
        avgConfidence: confidence,
        evidence: [{
          context: contextText.slice(0, 80),
          confidence,
          timestamp: Date.now(),
        }],
        status: 'pending', // pending → active → rejected
        createdAt: Date.now(),
        context: context || {},
      });
    }
  }

  /**
   * 检查候选池，激活达到阈值的词
   */
  _checkAndActivate() {
    for (const candidate of this.candidates) {
      if (candidate.status !== 'pending') continue;

      // 达到激活阈值
      if (candidate.evidenceCount >= CANDIDATE_ACTIVATE_THRESHOLD) {
        this._activateCandidate(candidate);
      }
    }
  }

  /**
   * 激活候选词为正式规则
   */
  _activateCandidate(candidate) {
    const trigger = candidate.trigger;
    const confidence = candidate.avgConfidence;

    // 判断规则类型
    const hasHardSignal = HARD_SIGNAL_CHARS.some(c => trigger.includes(c));

    if (hasHardSignal && confidence >= 0.75) {
      // 高置信度 + 攻击性词根 → 硬关键词
      this.rules.hardKeywords.push({
        type: 'hard_keyword',
        trigger,
        confidence,
        source: 'ai_learned',
        createdAt: candidate.createdAt,
        activatedAt: Date.now(),
        hitCount: 0,
        evidenceCount: candidate.evidenceCount,
      });

      // 同时尝试生成正则变体
      const regexPattern = this._generateVariantRegex(trigger);
      if (regexPattern && !this._ruleExists(regexPattern, 'regex')) {
        this.rules.regex.push({
          type: 'regex',
          pattern: regexPattern,
          flags: 'i',
          description: `AI learned variant: ${trigger}`,
          confidence: confidence * 0.85,
          source: 'ai_learned',
          createdAt: Date.now(),
          hitCount: 0,
        });
      }
    } else {
      // 其他情况 → 软关键词（需多个才触发，避免误杀）
      this.rules.softKeywords.push({
        type: 'soft_keyword',
        trigger,
        confidence: confidence * 0.7, // 软词置信度打折
        source: 'ai_learned',
        createdAt: candidate.createdAt,
        activatedAt: Date.now(),
        hitCount: 0,
        evidenceCount: candidate.evidenceCount,
      });

      // 生成升级建议
      this._suggestUpgrade(trigger, candidate.evidence[0]?.context || '', confidence);
    }

    candidate.status = 'active';
    candidate.activatedAt = Date.now();
  }

  /** 获取学习到的硬关键词 */
  getHardKeywords() {
    return this.rules.hardKeywords.filter(r => r.confidence > 0.6).map(r => r.trigger);
  }

  /** 获取学习到的软关键词 */
  getSoftKeywords() {
    return this.rules.softKeywords.filter(r => r.confidence > 0.5).map(r => r.trigger);
  }

  /** 获取学习到的正则模式 */
  getRegexPatterns() {
    return this.rules.regex.filter(r => r.confidence > 0.5);
  }

  /** 获取所有上下文敏感规则 */
  getContextSensitiveRules() {
    return this.rules.contextSensitive;
  }

  /** 获取候选池状态 */
  getCandidates() {
    return this.candidates.map(c => ({
      trigger: c.trigger,
      evidenceCount: c.evidenceCount,
      avgConfidence: c.avgConfidence,
      status: c.status,
      createdAt: c.createdAt,
      activatedAt: c.activatedAt,
    }));
  }

  /** 获取候选池统计 */
  getCandidateStats() {
    return {
      total: this.candidates.length,
      pending: this.candidates.filter(c => c.status === 'pending').length,
      active: this.candidates.filter(c => c.status === 'active').length,
      rejected: this.candidates.filter(c => c.status === 'rejected').length,
    };
  }

  /** 将学习到的规则同步到 detector */
  syncToDetector(detector) {
    // 硬关键词 → detector.hardKeywords
    const hardKws = this.getHardKeywords();
    for (const kw of hardKws) {
      detector.hardKeywords.add(kw);
    }

    // 软关键词 → detector.softKeywords (Map)
    const softKws = this.getSoftKeywords();
    for (const kw of softKws) {
      // AI 学习的软词默认为 context_sensitive 类型
      detector.softKeywords.set(kw, {
        word: kw,
        type: 'context_sensitive',
        initialWeight: 2,
        currentWeight: 2,
        hitCount: 0,
        upgradeCount: 0,
        lastAdjustedAt: Date.now(),
        contextSamples: [],
      });
    }

    // 正则模式 → detector.regexPatterns
    const regexRules = this.getRegexPatterns();
    for (const rule of regexRules) {
      try {
        const rx = new RegExp(rule.pattern, rule.flags || 'i');
        detector.regexPatterns.push(rx);
      } catch (e) {
        // 无效正则跳过
      }
    }

    // 上下文敏感规则 → detector.contextRuleEngine
    const ctxRules = this.getContextSensitiveRules();
    if (ctxRules.length > 0 && detector.contextRuleEngine) {
      detector.contextRuleEngine.addRules(ctxRules);
    }
  }

  /** 清理低置信度/过期规则 */
  _prune() {
    const now = Date.now();
    const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 天

    const pruneList = (list) => list.filter(r => {
      if (r.confidence < 0.3) return false;
      if (now - r.createdAt > MAX_AGE) return false;
      return true;
    });

    this.rules.hardKeywords = pruneList(this.rules.hardKeywords);
    this.rules.softKeywords = pruneList(this.rules.softKeywords);
    this.rules.regex = pruneList(this.rules.regex);
    this.rules.contextSensitive = pruneList(this.rules.contextSensitive);

    // 清理候选池：超过 30 天未激活的 pending 词
    this.candidates = this.candidates.filter(c => {
      if (c.status === 'pending' && now - c.createdAt > MAX_AGE) return false;
      return true;
    });
  }

  /** 检查规则是否已存在（只检查已激活的规则，不检查候选池） */
  _ruleExists(trigger, type) {
    if (type === 'regex') {
      return this.rules.regex.some(r => r.pattern === trigger);
    }
    return this.rules.hardKeywords.some(r => r.trigger === trigger) ||
      this.rules.softKeywords.some(r => r.trigger === trigger) ||
      this.rules.contextSensitive.some(r => r.trigger === trigger);
  }

  /**
   * 为关键词生成变体正则表达式
   * 覆盖常见绕过手法：谐音、同音字、拆字、拼音缩写
   */
  _generateVariantRegex(trigger) {
    if (trigger.length < 2) return null;

    // 常见同音字/谐音替换映射
    const variantMap = {
      '傻': '[傻煞沙纱杉莎]',
      '逼': '[逼比哔叉巴]',
      '操': '[操草艹肏]',
      '死': '[死4肆]',
      '滚': '[滚衮]',
      '废': '[废费]',
      '蠢': '[蠢春]',
      '贱': '[贱剑件]',
      '狗': '[狗苟]',
      '猪': '[猪珠蛛]',
      '杀': '[杀纱沙]',
      '妈': '[妈马码]',
      '脑': '[脑恼]',
      '残': '[残惨]',
      '智': '[智治]',
      '障': '[障帐]',
      '畜': '[畜触]',
      '垃': '[垃拉]',
      '圾': '[圾极]',
    };

    // 检查 trigger 是否包含可替换字符
    let hasVariant = false;
    let regexStr = '';
    for (const char of trigger) {
      if (variantMap[char]) {
        regexStr += variantMap[char];
        hasVariant = true;
      } else {
        regexStr += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
    }

    if (!hasVariant) return null;
    return `(${regexStr})`;
  }

  _load() {
    try {
      const data = GM_getValue(LEARNED_RULES_KEY, '[]');
      const parsed = JSON.parse(data);

      // 兼容旧格式（keywords → 按置信度拆分为 hard/soft）
      if (parsed.keywords && !parsed.hardKeywords) {
        const hardKws = [];
        const softKws = [];
        for (const r of parsed.keywords) {
          if (r.confidence >= 0.75) {
            hardKws.push({ ...r, type: 'hard_keyword' });
          } else {
            softKws.push({ ...r, type: 'soft_keyword' });
          }
        }
        this.rules = {
          hardKeywords: hardKws,
          softKeywords: softKws,
          regex: parsed.regex || [],
          contextSensitive: parsed.contextSensitive || [],
        };
        this._save(); // 迁移后保存新格式
        return;
      }

      this.rules = {
        hardKeywords: parsed.hardKeywords || [],
        softKeywords: parsed.softKeywords || [],
        regex: parsed.regex || [],
        contextSensitive: parsed.contextSensitive || [],
      };
    } catch (e) {
      this.rules = { hardKeywords: [], softKeywords: [], regex: [], contextSensitive: [] };
    }

    // 加载升级建议
    try {
      const sugData = GM_getValue(UPGRADE_SUGGESTIONS_KEY, '[]');
      this.upgradeSuggestions = JSON.parse(sugData);
    } catch (e) {
      this.upgradeSuggestions = [];
    }

    // 加载候选池
    try {
      const candData = GM_getValue(CANDIDATES_KEY, '[]');
      this.candidates = JSON.parse(candData);
    } catch (e) {
      this.candidates = [];
    }
  }

  _save() {
    try {
      GM_setValue(LEARNED_RULES_KEY, JSON.stringify(this.rules));
      GM_setValue(UPGRADE_SUGGESTIONS_KEY, JSON.stringify(this.upgradeSuggestions));
      GM_setValue(CANDIDATES_KEY, JSON.stringify(this.candidates));
    } catch (e) { /* silent */ }
  }

  // ── 升级建议系统 ──────────────────────────────────────────────────────
  //
  // 两种模式：
  //   'agent'  — AI 代理模式：达到阈值自动升级，无需人工审核
  //   'suggest' — AI 建议模式：只生成建议，用户手动确认/驳回
  //

  /**
   * 生成升级建议
   * AI 发现某词总在攻击场景出现时，记录证据和置信度
   * agent 模式：达到阈值自动生效
   * suggest 模式：等待用户确认
   */
  _suggestUpgrade(trigger, contextText, confidence) {
    const mode = this.config?.aiUpgradeMode || 'agent';
    const existing = this.upgradeSuggestions.find(s => s.trigger === trigger);
    if (existing) {
      // 累积证据
      existing.evidence.push({
        context: contextText.slice(0, 80),
        confidence,
        timestamp: Date.now(),
      });
      // 只保留最近 5 条证据
      if (existing.evidence.length > 5) {
        existing.evidence = existing.evidence.slice(-5);
      }
      existing.suggestCount++;
      existing.avgConfidence = (existing.avgConfidence * (existing.suggestCount - 1) + confidence) / existing.suggestCount;

      // agent 模式：达到阈值 → 自动生效
      if (mode === 'agent' && existing.suggestCount >= AUTO_UPGRADE_THRESHOLD && !existing.applied) {
        this._applyUpgrade(trigger);
        existing.applied = true;
        existing.appliedAt = Date.now();
      }
      // suggest 模式：不自动生效，等用户确认
    } else {
      this.upgradeSuggestions.push({
        trigger,
        suggestCount: 1,
        avgConfidence: confidence,
        evidence: [{
          context: contextText.slice(0, 80),
          confidence,
          timestamp: Date.now(),
        }],
        applied: false,
        createdAt: Date.now(),
      });
    }
    // 清理超过 30 天的旧建议
    this.upgradeSuggestions = this.upgradeSuggestions.filter(s =>
      s.applied || (Date.now() - s.createdAt < 30 * 24 * 60 * 60 * 1000)
    );
  }

  /** 执行升级：将软词从 soft_keyword 提升为 hard_keyword */
  _applyUpgrade(trigger) {
    const idx = this.rules.softKeywords.findIndex(r => r.trigger === trigger);
    if (idx !== -1) {
      const rule = this.rules.softKeywords.splice(idx, 1)[0];
      rule.type = 'hard_keyword';
      rule.upgradeCount = (rule.upgradeCount || 0) + 1;
      rule.confidence = Math.min(rule.confidence + 0.15, 1.0);
      this.rules.hardKeywords.push(rule);
    }
  }

  /** 用户手动确认升级建议 */
  confirmUpgrade(trigger) {
    const suggestion = this.upgradeSuggestions.find(s => s.trigger === trigger);
    if (suggestion && !suggestion.applied) {
      this._applyUpgrade(trigger);
      suggestion.applied = true;
      suggestion.appliedAt = Date.now();
      this._save();
      return true;
    }
    return false;
  }

  /** 用户驳回升级建议 */
  rejectUpgrade(trigger) {
    const idx = this.upgradeSuggestions.findIndex(s => s.trigger === trigger);
    if (idx !== -1) {
      this.upgradeSuggestions.splice(idx, 1);
      this._save();
      return true;
    }
    return false;
  }

  /** 获取待审核的升级建议 */
  getPendingSuggestions() {
    return this.upgradeSuggestions.filter(s => !s.applied);
  }

  /** 获取所有升级建议（含已生效） */
  getAllSuggestions() {
    return this.upgradeSuggestions;
  }

  /** 增加规则命中计数 */
  recordHit(matched) {
    if (!matched) return;
    const trigger = matched.toLowerCase().trim();
    const allLists = [this.rules.hardKeywords, this.rules.softKeywords,
      this.rules.regex, this.rules.contextSensitive];
    for (const list of allLists) {
      for (const r of list) {
        if (r.trigger === trigger || r.pattern === trigger) {
          r.hitCount = (r.hitCount || 0) + 1;
          r.confidence = Math.min(r.confidence + 0.02, 1.0);
          this._save();
          return;
        }
      }
    }
  }

  /**
   * 用户标记误判时降低置信度
   * 证据清零，置信度减半，重新积累
   */
  recordCorrection(trigger) {
    if (!trigger) return { deleted: false };
    const t = trigger.toLowerCase().trim();

    // 检查候选池
    const candidate = this.candidates.find(c => c.trigger === t);
    if (candidate) {
      candidate.evidence = []; // 证据清零
      candidate.evidenceCount = 0;
      candidate.avgConfidence /= 2;
      if (candidate.avgConfidence < 0.3) {
        candidate.status = 'rejected'; // 永久拒绝
        this._save();
        return { deleted: true };
      }
      this._save();
      return { deleted: false };
    }

    // 检查正式规则
    const allLists = [this.rules.hardKeywords, this.rules.softKeywords,
      this.rules.regex, this.rules.contextSensitive];

    for (let li = 0; li < allLists.length; li++) {
      const list = allLists[li];
      for (let i = 0; i < list.length; i++) {
        if (list[i].trigger === t || list[i].pattern === t) {
          list[i].confidence /= 2;
          list[i].hitCount = 0; // 命中计数清零
          if (list[i].confidence < 0.3) {
            list.splice(i, 1);
            this._save();
            return { deleted: true };
          }
          this._save();
          return { deleted: false };
        }
      }
    }
    return { deleted: false };
  }

  /** 获取所有规则详情（供面板展示） */
  getAllRulesDetailed() {
    const mapRule = (r, defaultType) => ({
      trigger: r.trigger || r.pattern,
      type: r.type || defaultType,
      confidence: r.confidence,
      hitCount: r.hitCount || 0,
      source: r.source || 'ai_learned',
      ...(r.negativeSignals ? { negativeSignals: r.negativeSignals } : {}),
      ...(r.pattern ? { pattern: r.pattern, flags: r.flags } : {}),
      ...(r.evidenceCount ? { evidenceCount: r.evidenceCount } : {}),
    });

    return {
      hardKeywords: this.rules.hardKeywords.map(r => mapRule(r, 'hard_keyword')),
      softKeywords: this.rules.softKeywords.map(r => mapRule(r, 'soft_keyword')),
      regex: this.rules.regex.map(r => mapRule(r, 'regex')),
      contextSensitive: this.rules.contextSensitive.map(r => mapRule(r, 'context_sensitive')),
      candidates: this.getCandidates(), // 也返回候选池状态
    };
  }
}
