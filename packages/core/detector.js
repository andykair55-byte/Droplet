/**
 * detector.js — Three-Layer Toxicity Detection Engine (升级版)
 *
 * Layer 1: Keyword Rules      (sync,  ~0ms)   — hard pattern match + variant/fuzzy matching
 * Layer 2: Behavioral Rules   (sync,  ~1ms)   — structural/contextual signals
 * Layer 3: AI Semantic        (async, ~500ms) — ambiguous gray-zone content
 *
 * 新增：
 *   - 集成 text-normalizer.js 归一化流水线
 *   - 四级风险等级：SAFE / LOW / MEDIUM / HIGH
 *   - 集成 context-window 短时上下文
 *   - 集成 topic-filter 话题过滤
 *   - 增强路由逻辑（分层路由 Wiki 11）
 */

import allPatterns from '../../rules/merged-patterns.json';
import { ContextRuleEngine } from './context-rule.js';
import { normalizeText, normalizeDeep } from './text-normalizer.js';

// ─── Result schema ────────────────────────────────────────────────────────────
//
//  {
//    verdict:    'toxic' | 'suspicious' | 'safe',
//    confidence: 0.0–1.0,
//    layer:      1 | 2 | 3,
//    riskLevel:  'safe' | 'low' | 'medium' | 'high',
//    reason:     string,          // human-readable explanation
//    matched:    string[],        // matched keywords or patterns
//    intent:     string | null,   // 话题类别 (from AI layer)
//    explainChain: object[],      // 命中链路（可解释性 A9）
//  }

export const Verdict = {
  TOXIC:      'toxic',
  SUSPICIOUS: 'suspicious',
  SAFE:       'safe',
};

// ─── 四级风险等级 (A6) ────────────────────────────────────────────────────────

export const RiskLevel = {
  SAFE:   'safe',
  LOW:    'low',
  MEDIUM: 'medium',
  HIGH:   'high',
};

/**
 * 将 verdict + confidence 映射为风险等级
 * 灵敏度设置会影响映射阈值
 */
function verdictToRiskLevel(verdict, confidence, sensitivity) {
  if (verdict === Verdict.TOXIC) {
    return confidence >= 0.8 ? RiskLevel.HIGH : RiskLevel.MEDIUM;
  }
  if (verdict === Verdict.SUSPICIOUS) {
    return confidence >= 0.5 ? RiskLevel.MEDIUM : RiskLevel.LOW;
  }
  return RiskLevel.SAFE;
}

/**
 * 灵敏度 → 最低处理风险等级
 *   低灵敏度：只处理 HIGH
 *   中灵敏度（默认）：处理 MEDIUM 以上
 *   高灵敏度：处理 LOW 以上
 */
export function getMinRiskLevel(sensitivity) {
  switch (sensitivity) {
    case 'low':    return RiskLevel.HIGH;
    case 'high':   return RiskLevel.LOW;
    default:       return RiskLevel.MEDIUM;
  }
}

/**
 * 判断风险等级是否达到处理阈值
 */
export function shouldAct(riskLevel, sensitivity) {
  const minLevel = getMinRiskLevel(sensitivity);
  const order = [RiskLevel.SAFE, RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH];
  return order.indexOf(riskLevel) >= order.indexOf(minLevel);
}

// ─── Soft Keyword Types & Weights ─────────────────────────────────────────────
//
// 软词不再一视同仁，按攻击性分为三级：
//   implicit_attack (3): 隐性攻击词，单次命中即可升级（如"绿茶婊""普信男"）
//   context_sensitive (2): 语境敏感词，需配合上下文（如"恶心""垃圾"）
//   topic_related (1): 话题关联词，科技/新闻常见，需多个才触发（如"突破""碾压"）

const SOFT_KEYWORD_TYPE = {
  IMPLICIT_ATTACK:  'implicit_attack',   // 权重 3
  CONTEXT_SENSITIVE: 'context_sensitive', // 权重 2
  TOPIC_RELATED:    'topic_related',      // 权重 1
};

const TYPE_TO_WEIGHT = {
  [SOFT_KEYWORD_TYPE.IMPLICIT_ATTACK]:  3,
  [SOFT_KEYWORD_TYPE.CONTEXT_SENSITIVE]: 2,
  [SOFT_KEYWORD_TYPE.TOPIC_RELATED]:    1,
};

// ── 隐性攻击词特征（用于自动分类） ──────────────────────────────────────────
// 含这些字/词根的软词自动归为 implicit_attack
const IMPLICIT_ATTACK_ROOTS = [
  '婊', '绿茶', '普信', '拳师', '小仙女', '直男癌', '舔狗', '渣男', '渣女',
  '凤凰男', '妈宝', '小三', '破鞋', '荡妇', '淫', '骚', '贱人', '骚货',
  'bitch', 'slut', 'whore', 'skank', 'thot', 'simp', 'incel', 'cuck',
  'gold digger', 'fuckboy', 'manlet', 'roastie',
];

// ── 语境敏感词特征 ──────────────────────────────────────────────────────────
const CONTEXT_SENSITIVE_ROOTS = [
  '恶心', '垃圾', '滚', '去死', '闭嘴', '蠢', '废物', '傻', '脑残', '智障',
  '狗屎', '放屁', '扯淡', '胡说', '白痴', '弱智', '变态',
  'trash', 'garbage', 'stupid', 'idiot', 'moron', 'loser', 'pathetic',
  'disgusting', 'gross', 'creep', 'weirdo', 'freak', 'dumb', 'lame',
];

// ── 上下文结构信号 ──────────────────────────────────────────────────────────
const ABUSIVE_VERBS = ['滚', '去死', '闭嘴', '滚开', '滚蛋', '去你的', '别bb',
  'fuck off', 'go die', 'shut up', 'go away', 'drop dead'];
const DEROGATORY_MODIFIERS = ['臭', '烂', '死', '贱', '狗', '猪', '蠢', '烂',
  'stupid', 'dumb', 'ugly', 'fat', 'lazy', 'dirty'];
const PERSON_TARGETS = ['你', '妳', '您', '他', '她', '你们', '咱们',
  'you', 'your', 'u', 'ur', 'he', 'she', 'they'];

// ─── Sensitivity thresholds ───────────────────────────────────────────────────

const SENSITIVITY = {
  low:    { l1: 0.9, l2: 0.85, l3: 0.80 },
  medium: { l1: 0.7, l2: 0.65, l3: 0.60 },
  high:   { l1: 0.5, l2: 0.45, l3: 0.40 },
};

// ─── Detector ─────────────────────────────────────────────────────────────────

export class Detector {
  constructor(config) {
    this.config = config;
    this.thresholds = SENSITIVITY[config.sensitivity] || SENSITIVITY.medium;
    this.contextRuleEngine = new ContextRuleEngine();
    this._buildRuleCache();
  }

  _buildRuleCache() {
    // 从合并的多语言规则文件加载（28 种语言）
    this.hardKeywords  = new Set(allPatterns.hard_keywords || []);

    // ★ 软词改为 Map<string, SoftKeywordEntry>，自动分类 + 加权
    this.softKeywords = new Map();
    const allSoftKws = allPatterns.soft_keywords || [];
    for (const kw of allSoftKws) {
      const entry = this._classifySoftKeyword(kw);
      this.softKeywords.set(kw, entry);
    }

    this.regexPatterns = (allPatterns.regex_patterns || []).map(p => new RegExp(p, 'i'));

    this.variantMap = allPatterns.variant_map || [];

    this.pinyinMap = allPatterns.pinyin_map || {};

    this._addCustomKeywords();
    this._addCustomRegex();
    this._addAutoLearnedKeywords();
  }

  /**
   * 自动分类软词并赋予初始权重
   * 分类逻辑：
   *   1. 含隐性攻击词根 → implicit_attack (权重 3)
   *   2. 含语境敏感词根 → context_sensitive (权重 2)
   *   3. 其余 → topic_related (权重 1)
   */
  _classifySoftKeyword(word) {
    const lower = word.toLowerCase();

    // 检查是否含隐性攻击词根
    if (IMPLICIT_ATTACK_ROOTS.some(root => lower.includes(root))) {
      return {
        word,
        type: SOFT_KEYWORD_TYPE.IMPLICIT_ATTACK,
        initialWeight: 3,
        currentWeight: 3,
        hitCount: 0,
        upgradeCount: 0,
        lastAdjustedAt: Date.now(),
        contextSamples: [],
      };
    }

    // 检查是否含语境敏感词根
    if (CONTEXT_SENSITIVE_ROOTS.some(root => lower.includes(root))) {
      return {
        word,
        type: SOFT_KEYWORD_TYPE.CONTEXT_SENSITIVE,
        initialWeight: 2,
        currentWeight: 2,
        hitCount: 0,
        upgradeCount: 0,
        lastAdjustedAt: Date.now(),
        contextSamples: [],
      };
    }

    // 默认：话题关联词
    return {
      word,
      type: SOFT_KEYWORD_TYPE.TOPIC_RELATED,
      initialWeight: 1,
      currentWeight: 1,
      hitCount: 0,
      upgradeCount: 0,
      lastAdjustedAt: Date.now(),
      contextSamples: [],
    };
  }

  _addCustomKeywords() {
    this._customKeywordKeys = new Set();
    const customs = this.config.customKeywords || [];
    const wl = this._userWhitelistKeywords || new Set();
    for (const entry of customs) {
      if (entry.keyword) {
        const kw = entry.keyword.toLowerCase();
        if (!wl.has(kw) && !this.hardKeywords.has(kw)) {
          this._customKeywordKeys.add(kw);
          this.hardKeywords.add(kw);
        }
      }
      if (entry.aliases && entry.aliases.length > 0) {
        for (const alias of entry.aliases) {
          const a = alias.toLowerCase();
          if (!wl.has(a) && !this.hardKeywords.has(a)) {
            this._customKeywordKeys.add(a);
            this.hardKeywords.add(a);
          }
        }
      }
    }
  }

  reloadCustomKeywords() {
    if (this._customKeywordKeys) {
      for (const kw of this._customKeywordKeys) {
        this.hardKeywords.delete(kw);
      }
    }
    this._rebuildUserWhitelist();
    this._addCustomKeywords();
  }

  _rebuildUserWhitelist() {
    if (!this._userWhitelistKeywords) this._userWhitelistKeywords = new Set();
    this._userWhitelistKeywords.clear();
    try {
      if (typeof GM_getValue === 'function') {
        const reg = JSON.parse(GM_getValue('cs_misjudgment_registry_v1', '{}') || '{}');
        const hits = {};
        for (const entry of Object.values(reg || {})) {
          for (const kw of (entry.hitKeywords || [])) {
            hits[kw] = (hits[kw] || 0) + 1;
          }
        }
        for (const [kw, n] of Object.entries(hits)) {
          if (n >= 3) this._userWhitelistKeywords.add(String(kw).toLowerCase().trim());
        }
        const manual = GM_getValue('cs_manual_whitelist_v1', '');
        if (manual) {
          const arr = JSON.parse(manual || '[]');
          for (const k of arr) this._userWhitelistKeywords.add(String(k).toLowerCase().trim());
        }
      }
    } catch {}
  }

  autoDowngradeSoftKeyword(word) {
    if (!this._userWhitelistKeywords) this._userWhitelistKeywords = new Set();
    this._userWhitelistKeywords.add(String(word).toLowerCase().trim());
    if (this.softKeywords && this.softKeywords.has(word)) {
      const e = this.softKeywords.get(word);
      e.currentWeight = 0;
      e.upgradeCount = (e.upgradeCount || 0) + 1;
      e.lastAdjustedAt = Date.now();
    }
    try {
      if (typeof GM_setValue === 'function') {
        const cur = JSON.parse(GM_getValue('cs_manual_whitelist_v1', '[]') || '[]');
        if (!cur.includes(word)) {
          cur.push(word);
          GM_setValue('cs_manual_whitelist_v1', JSON.stringify(cur));
        }
      }
    } catch {}
    try { this.reloadCustomKeywords(); } catch {}
  }

  _addCustomRegex() {
    this._customRegexSources = new Set();
    const customs = this.config.customRegex || [];
    for (const entry of customs) {
      if (entry.pattern) {
        try {
          const flags = entry.flags || 'i';
          const rx = new RegExp(entry.pattern, flags);
          this.regexPatterns.push(rx);
          // 存 rx.source 而非 entry.pattern，确保 reloadCustomRegex 能正确匹配
          this._customRegexSources.add(rx.source);
        } catch (e) {
          console.warn(`[CyberShield] Invalid custom regex: ${entry.pattern}`, e);
        }
      }
    }
  }

  reloadCustomRegex() {
    if (this._customRegexSources) {
      this.regexPatterns = this.regexPatterns.filter(p => !this._customRegexSources.has(p.source));
    }
    this._addCustomRegex();
  }

  /** 加载 AI 自动学习的关键词到硬关键词 */
  _addAutoLearnedKeywords() {
    this._autoLearnedKeywordKeys = new Set();
    const learned = this.config.autoLearnedKeywords || [];
    for (const kw of learned) {
      const lower = kw.toLowerCase().trim();
      if (lower.length >= 2 && !this.hardKeywords.has(lower)) {
        this._autoLearnedKeywordKeys.add(lower);
        this.hardKeywords.add(lower);
      }
    }
  }

  /** 重载 AI 自动学习的关键词（配置变更后调用） */
  reloadAutoLearnedKeywords() {
    if (this._autoLearnedKeywordKeys) {
      for (const kw of this._autoLearnedKeywordKeys) {
        this.hardKeywords.delete(kw);
      }
    }
    this._addAutoLearnedKeywords();
  }

  getAllRules() {
    // 区分内置正则和自定义正则
    const builtinRegex = [];
    const customRegex = this.config.customRegex || [];
    // 用 RegExp.source 匹配，避免 entry.pattern 与 rx.source 转义不一致
    const customSources = new Set();
    for (const entry of customRegex) {
      if (entry.pattern) {
        try { customSources.add(new RegExp(entry.pattern, entry.flags || 'i').source); }
        catch { customSources.add(entry.pattern); }
      }
    }
    for (const rx of this.regexPatterns) {
      if (!customSources.has(rx.source)) {
        builtinRegex.push(rx.source);
      }
    }

    return {
      hardKeywords: [...this.hardKeywords],
      softKeywords: [...this.softKeywords.keys()],
      softKeywordsDetailed: [...this.softKeywords.entries()].map(([kw, entry]) => ({
        word: kw,
        type: entry.type,
        currentWeight: entry.currentWeight,
        hitCount: entry.hitCount,
        upgradeCount: entry.upgradeCount,
      })),
      regexPatterns: builtinRegex,
      customRegex: customRegex,
      customKeywords: this.config.customKeywords || [],
      variantMap: this.variantMap,
      pinyinMap: this.pinyinMap,
    };
  }

  /**
   * 主入口 — 运行检测流水线。
   *
   * @param {string}   text          原始文本
   * @param {object}   context       { username, platform, isReply, mentionsUser }
   * @param {object}   aiAnalyzer    AIAnalyzer 实例
   * @param {Function} onAIResult    AI 结果回调
   * @param {object}   [extras]      额外模块
   * @param {object}   [extras.topicFilter]     TopicFilter 实例
   * @param {object}   [extras.contextWindow]  ContextWindow 实例
   * @returns {object}  同步结果（含 riskLevel）
   */
  analyze(text, context = {}, aiAnalyzer = null, onAIResult = null, extras = {}) {
    const explainChain = [];

    // ★ 灵敏度路由
    const sensitivity = this.config.sensitivity || 'medium';
    const accountLevel = extras.accountLevel || 'normal';
    const skipL2 = (sensitivity === 'low') ||
      (sensitivity === 'medium' && accountLevel === 'official');
    const skipAI = skipL2 ||
      (sensitivity === 'medium' && accountLevel === 'official');

    // ── Step 1: 归一化（使用 text-normalizer）──────────────────────────────
    const normalized = normalizeText(text, { preserveNumbers: true });
    const deepNormalized = normalizeDeep(text, { preserveNumbers: true });

    // ── Step 2: Layer 1 — 关键词 + 变体匹配 ──────────────────────────────
    const l1 = this._layerOneKeywords(normalized, deepNormalized, sensitivity === 'high');
    if (l1.verdict === Verdict.TOXIC) {
      explainChain.push({ layer: 1, verdict: l1.verdict, matched: l1.matched, reason: l1.reason });
      l1.riskLevel = verdictToRiskLevel(l1.verdict, l1.confidence, sensitivity);
      l1.explainChain = explainChain;
      l1.intent = null;
      return l1;
    }

    // ★ LOW / MEDIUM+official: L1 未命中则直接返回 SAFE，不走 L2 / AI
    if (skipL2) {
      const result = { ...l1, riskLevel: verdictToRiskLevel(l1.verdict, l1.confidence, sensitivity) };
      result.explainChain = explainChain;
      return result;
    }

    // ── Step 3: Layer 2 — 行为信号 ──────────────────────────────────────
    let l2 = this._layerTwoBehavior(normalized, context, text);
    if (l2.verdict === Verdict.TOXIC) {
      explainChain.push({ layer: 2, verdict: l2.verdict, matched: l2.matched, reason: l2.reason });
      l2.riskLevel = verdictToRiskLevel(l2.verdict, l2.confidence, sensitivity);
      l2.explainChain = explainChain;
      l2.intent = null;
      return l2;
    }

    // ── Step 4: 短时上下文窗口组合检测 ──────────────────────────────────
    if (extras.contextWindow && context.username) {
      const syncResult = l2.verdict !== Verdict.SAFE ? l2 : l1;
      extras.contextWindow.addMessage(context.username, text, syncResult, context._element);

      if (extras.contextWindow.shouldCombine(context.username)) {
        const combined = extras.contextWindow.getCombined(context.username);
        if (combined) {
          const combinedNormalized = normalizeText(combined.combinedText, { preserveNumbers: true });
          const combinedL1 = this._layerOneKeywords(combinedNormalized, normalizeDeep(combined.combinedText, { preserveNumbers: true }));
          if (combinedL1.verdict === Verdict.TOXIC) {
            explainChain.push({
              layer: 'context_window',
              verdict: combinedL1.verdict,
              matched: combinedL1.matched,
              reason: 'Combined message analysis detected toxicity',
              messageCount: combined.messages.length,
            });
            combinedL1.layer = 2;
            combinedL1.riskLevel = verdictToRiskLevel(combinedL1.verdict, combinedL1.confidence, sensitivity);
            combinedL1.explainChain = explainChain;
            combinedL1.intent = null;
            return combinedL1;
          }
        }
      }
    }

    // ── Step 4.5: 热点规则匹配（HotTopicManager）──────────────────────
    // 热点规则带 TTL + 组合触发模式，专门处理时效性热点事件
    // 在 Layer 2 之后、AI 之前匹配：确定性关键词命中，不走 AI 节省 token
    //
    // 启发式复核机制：
    //   - any 模式命中后，调用 _heuristicReview 做本地复核
    //   - 复核通过（pass=true）→ 直接 return TOXIC（节省 token）
    //   - 复核未通过（pass=false）→ 降级为 SUSPICIOUS，继续走 Layer 3 AI 复核
    //     - 有 API key 时：AI 复核后决定最终 verdict
    //     - 无 API key 时：SUSPICIOUS 不会直接屏蔽，降低误杀
    if (extras.hotTopicManager) {
      const scope = context.contentType || null;
      const hotResult = extras.hotTopicManager.detect(normalized, scope);
      if (hotResult.hit && hotResult.matchedTopics.length > 0) {
        // 分析复核结果：是否所有命中都通过复核
        const allPassed = hotResult.reviewed.every(r => r.review.pass);
        const anyPassed = hotResult.reviewed.some(r => r.review.pass);
        const matchedLabels = hotResult.matchedTopics.map(t => t.label);
        const matchedKws = [];
        for (const t of hotResult.matchedTopics) {
          for (const kw of t.keywords) {
            if (normalized.toLowerCase().includes(kw)) matchedKws.push(kw);
          }
        }

        if (allPassed) {
          // 所有命中都通过复核 → 直接 return TOXIC
          const maxConfidence = Math.max(...hotResult.reviewed.map(r => r.review.confidence || 0.92));
          explainChain.push({
            layer: 'hot_topic',
            verdict: Verdict.TOXIC,
            matched: matchedKws,
            reason: `热点规则命中：${matchedLabels.join('、')}`,
            hotTopicIds: hotResult.matchedTopics.map(t => t.id),
          });
          const hotFinal = {
            verdict: Verdict.TOXIC,
            confidence: maxConfidence,
            layer: 2,
            reason: `热点规则命中：${matchedLabels.join('、')}`,
            matched: matchedKws,
            intent: 'hot_topic',
            hotTopics: hotResult.matchedTopics.map(t => ({ id: t.id, label: t.label })),
          };
          hotFinal.riskLevel = verdictToRiskLevel(hotFinal.verdict, hotFinal.confidence, sensitivity);
          hotFinal.explainChain = explainChain;
          return hotFinal;
        } else if (anyPassed) {
          // 部分通过、部分未通过 → 取通过的规则 return TOXIC
          const passedTopics = hotResult.reviewed.filter(r => r.review.pass).map(r => r.topic);
          const passedLabels = passedTopics.map(t => t.label);
          const passedKws = [];
          for (const t of passedTopics) {
            for (const kw of t.keywords) {
              if (normalized.toLowerCase().includes(kw)) passedKws.push(kw);
            }
          }
          explainChain.push({
            layer: 'hot_topic',
            verdict: Verdict.TOXIC,
            matched: passedKws,
            reason: `热点规则命中（部分通过复核）：${passedLabels.join('、')}`,
            hotTopicIds: passedTopics.map(t => t.id),
          });
          const hotFinal = {
            verdict: Verdict.TOXIC,
            confidence: 0.88,
            layer: 2,
            reason: `热点规则命中：${passedLabels.join('、')}`,
            matched: passedKws,
            intent: 'hot_topic',
            hotTopics: passedTopics.map(t => ({ id: t.id, label: t.label })),
          };
          hotFinal.riskLevel = verdictToRiskLevel(hotFinal.verdict, hotFinal.confidence, sensitivity);
          hotFinal.explainChain = explainChain;
          return hotFinal;
        } else {
          // 所有命中都未通过复核 → 降级为 SUSPICIOUS，继续走 Layer 3
          const failedReasons = hotResult.reviewed.map(r => r.review.reason).filter(Boolean);
          explainChain.push({
            layer: 'hot_topic',
            verdict: Verdict.SUSPICIOUS,
            matched: matchedKws,
            reason: `热点规则命中但未通过启发式复核：${failedReasons.join('；')}`,
            hotTopicIds: hotResult.matchedTopics.map(t => t.id),
            reviewFailed: true,
          });
          // 不 return，让 l2 变为 SUSPICIOUS，继续走 Layer 3
          l2 = {
            verdict: Verdict.SUSPICIOUS,
            confidence: 0.55,
            layer: 2,
            reason: `热点规则命中但未通过启发式复核：${failedReasons.join('；')}`,
            matched: matchedKws,
            intent: 'hot_topic_review_failed',
            hotTopics: hotResult.matchedTopics.map(t => ({ id: t.id, label: t.label })),
          };
          l2.riskLevel = verdictToRiskLevel(l2.verdict, l2.confidence, sensitivity);
          // 注意：不 return，继续走 Layer 3 AI 复核
        }
      }
    }

    // ── Step 5: Layer 3 — AI 语义分析（异步） ─────────────────────────
    if (!skipAI && aiAnalyzer && onAIResult && this.config.aiEnabled) {
      const currentResult = l2.verdict === Verdict.SUSPICIOUS ? l2 : l1;

      // 异步话题检测：先尝试同步关键词，再用 AI 语义识别
      const syncTopics = extras.topicFilter ? extras.topicFilter.detectTopics(normalized) : [];
      const involvesTopic = syncTopics.length > 0;
      const semanticEnabled = this.config.topicSemanticEnabled && this.config.apiKey;

      if (aiAnalyzer.shouldAnalyze(currentResult, involvesTopic)) {
        explainChain.push({ layer: 3, action: 'queued_for_ai', reason: 'Ambiguous content sent to AI' });

        // 异步检测话题（AI 语义识别）
        const detectTopicsAsync = async () => {
          if (syncTopics.length > 0) return syncTopics;
          if (semanticEnabled && extras.topicFilter && extras.topicFilter.detectTopicsWithAI) {
            return extras.topicFilter.detectTopicsWithAI(text, { context });
          }
          return syncTopics;
        };

        detectTopicsAsync().then(detectedTopics => {
          // 附加话题信息到 context
          const aiContext = {
            ...context,
            topics: detectedTopics,
          };

          return aiAnalyzer.analyze(text, aiContext);
        }).then(aiResult => {
          if (aiResult) {
            aiResult.riskLevel = verdictToRiskLevel(
              aiResult.verdict, aiResult.confidence, sensitivity
            );
            aiResult.explainChain = [
              ...explainChain,
              { layer: 3, verdict: aiResult.verdict, reason: aiResult.reason, intent: aiResult.intent },
            ];
          }
          onAIResult(aiResult);
        });
      }
    }

    // 返回同步结果
    const finalResult = l2.verdict === Verdict.SUSPICIOUS ? l2 : {
      verdict: Verdict.SAFE, confidence: 0.1, layer: 2, reason: 'No signals', matched: [],
    };
    finalResult.riskLevel = verdictToRiskLevel(finalResult.verdict, finalResult.confidence, sensitivity);
    finalResult.explainChain = explainChain;
    finalResult.intent = null;
    return finalResult;
  }

  // ── Layer 1: Keyword Matching + Variant/Fuzzy Matching ─────────────────────

  /**
   * 关键词匹配（带英文词边界检测）
   * - 纯英文关键词（如 ass, cum, tit）：检查前后字符是否为字母，是则跳过（避免 glass→ass）
   * - 中文/混合关键词：直接 includes 匹配
   * @param {string} text - 归一化文本（保留空格）
   * @param {string} kw - 关键词
   * @returns {boolean}
   */
  _kwMatch(text, kw) {
    if (!text.includes(kw)) return false;
    // 纯英文关键词（含数字）需要词边界检测
    if (/^[a-z0-9]+$/i.test(kw)) {
      let idx = text.indexOf(kw);
      while (idx !== -1) {
        const before = idx > 0 ? text[idx - 1] : '';
        const after = (idx + kw.length) < text.length ? text[idx + kw.length] : '';
        // 前后都不是字母/数字 → 真正的词边界命中
        if (!/[a-z0-9]/i.test(before) && !/[a-z0-9]/i.test(after)) return true;
        idx = text.indexOf(kw, idx + 1);
      }
      return false;
    }
    return true;
  }

  _layerOneKeywords(text, deepText, lowThreshold) {
    const matched = [];

    // Hard keywords: instant toxic verdict
    // 英文短词需要词边界检测，避免 glass→ass、use→anus 类误杀
    for (const kw of this.hardKeywords) {
      if (this._kwMatch(text, kw)) matched.push(kw);
    }
    if (matched.length > 0) {
      return { verdict: Verdict.TOXIC, confidence: 0.95, layer: 1, reason: 'Hard keyword match', matched };
    }

    // ── 深度归一化后的匹配（变体/谐音） ──────────────────────────────
    // 纯英文关键词不在 deepText 上匹配：deepText 移除空格后英文失去词边界，
    // 会导致 glass→ass、you can use→anus 类误杀。
    // deepText 主要用于中文变体/谐音/拆字绕过检测。
    const variantMatched = [];
    for (const kw of this.hardKeywords) {
      if (/^[a-z0-9]+$/i.test(kw)) continue;  // 跳过纯英文关键词
      if (deepText.includes(kw)) variantMatched.push(kw);
    }
    if (variantMatched.length > 0) {
      return { verdict: Verdict.TOXIC, confidence: 0.90, layer: 1, reason: 'Variant keyword match (normalized)', matched: variantMatched };
    }

    // ── 拼音缩写还原（在 deepText 基础上额外检测） ──────────────────
    // 同样跳过纯英文关键词：拼音还原会移除空格，存在相同的词边界问题
    const pinyinNormalized = this._normalizePinyin(text);
    if (pinyinNormalized !== text) {
      const pinyinMatched = [];
      for (const kw of this.hardKeywords) {
        if (/^[a-z0-9]+$/i.test(kw)) continue;  // 跳过纯英文关键词
        if (pinyinNormalized.includes(kw)) pinyinMatched.push(kw);
      }
      if (pinyinMatched.length > 0) {
        return { verdict: Verdict.TOXIC, confidence: 0.85, layer: 1, reason: 'Pinyin variant match', matched: pinyinMatched };
      }
    }

    // Regex patterns
    const regexMatched = [];
    const regexSources = [];
    for (const rx of this.regexPatterns) {
      const m = text.match(rx) || deepText.match(rx);
      if (m) {
        regexMatched.push(m[0]);
        regexSources.push(rx.source);
      }
    }
    if (regexMatched.length > 0) {
      return { verdict: Verdict.TOXIC, confidence: 0.88, layer: 1, reason: `Regex pattern match [${regexSources.join('|')}]`, matched: regexMatched };
    }

    // ── 变体映射还原（保留旧逻辑兼容性）────────────────────────────
    // 同样跳过纯英文关键词：_normalizeForVariants 也移除空格，存在相同的词边界问题
    const legacyVariant = this._normalizeForVariants(text);
    const legacyMatched = [];
    for (const kw of this.hardKeywords) {
      if (/^[a-z0-9]+$/i.test(kw)) continue;  // 跳过纯英文关键词
      if (legacyVariant.includes(kw)) legacyMatched.push(kw);
    }
    if (legacyMatched.length > 0) {
      return { verdict: Verdict.TOXIC, confidence: 0.82, layer: 1, reason: 'Legacy variant match', matched: legacyMatched };
    }

    // ── 软词评分：四维分数分开计算 ──────────────────────────────────────
    // 1. 词项分数：按 currentWeight 累加（而非统一 +1）
    // 2. 结构分数：辱骂动词 + 贬损修饰 + 指向人物
    // 3. 语境分数：反讽/引战结构 + 同类词连续出现
    // 4. 历史命中分数：命中次数多的词权重微增
    const softMatched = [];
    let wordScore = 0;       // 词项分数
    let structureScore = 0;  // 结构分数
    let contextScore = 0;    // 语境分数
    let historyBonus = 0;    // 历史命中分数

    for (const [kw, entry] of this.softKeywords) {
      const matched = (/^[a-z0-9]+$/i.test(kw))
        ? (this._kwMatch(text, kw) || this._kwMatch(deepText, kw))
        : (text.includes(kw) || deepText.includes(kw));
      if (matched) {
        softMatched.push(kw);
        // 词项分数：按当前权重累加
        wordScore += entry.currentWeight;
        // 历史命中分数：命中次数越多，微增（上限 +1）
        historyBonus += Math.min(entry.hitCount * 0.05, 1.0);
        // 记录命中（用于后续复盘）
        entry.hitCount++;
        // 保留典型语境样本（最多 3 条）
        if (entry.contextSamples.length < 3) {
          entry.contextSamples.push(text.slice(0, 80));
        }
      }
    }

    // 结构分数：检查文本中的攻击性结构信号
    const hasAbusiveVerb = ABUSIVE_VERBS.some(v => text.includes(v));
    const hasDerogatoryMod = DEROGATORY_MODIFIERS.some(m => text.includes(m));
    const hasPersonTarget = PERSON_TARGETS.some(p => text.includes(p));
    if (hasAbusiveVerb) structureScore += 1.5;
    if (hasDerogatoryMod) structureScore += 1.0;
    if (hasPersonTarget) structureScore += 1.0;

    // 语境分数：反讽/引战结构 + 同类词连续出现
    const hasSarcasm = /[～~]{2,}|呵呵|嘿嘿|是吧|是吧？/.test(text);
    const hasTrollStructure = /就这|就这？|不会吧|不会吧？|笑死|笑死我/.test(text);
    const sameTypeCount = softMatched.filter(kw => {
      const entry = this.softKeywords.get(kw);
      return entry && entry.type === SOFT_KEYWORD_TYPE.IMPLICIT_ATTACK;
    }).length;
    if (hasSarcasm || hasTrollStructure) contextScore += 1.0;
    if (sameTypeCount >= 2) contextScore += 1.5; // 多个隐性攻击词同时出现

    // ── 决策层：四维分数组合判定 ──────────────────────────────────────
    const totalScore = wordScore + structureScore + contextScore + historyBonus;

    // 四档决策：
    //   totalScore >= 6 → TOXIC（直接拦截）
    //   totalScore >= 4 → SUSPICIOUS（可疑，需复核）
    //   totalScore >= 3 → SUSPICIOUS（弱可疑，低置信度）
    //   totalScore < 3  → SAFE
    if (totalScore >= 6) {
      return {
        verdict: Verdict.TOXIC,
        confidence: Math.min(0.6 + totalScore * 0.04, 0.9),
        layer: 1,
        reason: 'High toxicity score (word+structure+context)',
        matched: softMatched,
        scores: { wordScore, structureScore, contextScore, historyBonus, totalScore },
      };
    }
    if (totalScore >= 4) {
      return {
        verdict: Verdict.SUSPICIOUS,
        confidence: Math.min(0.5 + totalScore * 0.05, 0.8),
        layer: 1,
        reason: 'Suspicious score (needs review)',
        matched: softMatched,
        scores: { wordScore, structureScore, contextScore, historyBonus, totalScore },
      };
    }
    if (totalScore >= 3) {
      return {
        verdict: Verdict.SUSPICIOUS,
        confidence: 0.4 + totalScore * 0.03,
        layer: 1,
        reason: 'Weak signals (soft keywords)',
        matched: softMatched,
        scores: { wordScore, structureScore, contextScore, historyBonus, totalScore },
      };
    }

    return { verdict: Verdict.SAFE, confidence: 0.1, layer: 1, reason: 'No keywords', matched: [] };
  }

  // ── Layer 2: Behavioral / Structural Signals ─────────────────────────────────

  _layerTwoBehavior(text, context, originalText) {
    const signals = [];
    let score = 0;

    // Signal: ALL CAPS (shouting) — 用原文检测大写，text 已小写化
    const capsSource = originalText || text;
    const upperRatio = (capsSource.match(/[A-Z]/g) || []).length / Math.max(capsSource.length, 1);
    if (upperRatio > 0.6 && capsSource.length > 10) {
      signals.push('all_caps'); score += 0.2;
    }

    // Signal: Excessive punctuation
    if (/[!?]{3,}/.test(text)) {
      signals.push('excessive_punctuation'); score += 0.15;
    }

    // Signal: @-mentions the current user
    if (context.mentionsUser) {
      score += 0.2;
      signals.push('mentions_user');
    }

    // Signal: Short aggressive reply
    if (context.isReply && text.length < 80 && score > 0) {
      signals.push('short_aggressive_reply'); score += 0.1;
    }

    // Signal: Repeated characters
    if (/(.)\1{4,}/.test(text)) {
      signals.push('char_repetition'); score += 0.1;
    }

    // Signal: Emoji aggression
    const aggressiveEmoji = ['💀', '🖕', '🤡', '🗑️', '🤮', '😡', '🤬', '💩'];
    const emojiHits = aggressiveEmoji.filter(e => text.includes(e));
    if (emojiHits.length >= 2) {
      signals.push('aggressive_emoji'); score += 0.2;
    }

    // ── 上下文敏感规则评估（修复：收集所有匹配，而非短路第一个） ────
    const ctxResults = this.contextRuleEngine.evaluateAll(text);
    let ctxTriggerCount = 0;
    let ctxNegativeCount = 0;
    let ctxTotalScore = 0;
    for (const ctx of ctxResults) {
      if (ctx.verdict === 'suspicious') {
        ctxTriggerCount++;
        ctxNegativeCount++;
        ctxTotalScore += ctx.confidence || 0.4;
        signals.push('context_rule:' + ctx.trigger);
      } else if (ctx.verdict === 'safe') {
        ctxTriggerCount++;
        // 触发词出现但无负面信号，不贡献分数但计入信号计数
        signals.push('context_trigger:' + ctx.trigger);
      }
    }
    // 每条命中负面信号的规则贡献 0.3 分（上限 0.6）
    if (ctxNegativeCount > 0) score += Math.min(ctxNegativeCount * 0.3, 0.6);
    // 3+ 条触发词（含无负面信号的）扩大信号基数
    if (ctxTriggerCount >= 3) score += 0.15;

    // ── ★ 修复：联合触发逻辑 — 必须 ≥2 组信号才能升级 ────────────
    // 行为信号 + 上下文规则信号总数必须 ≥2
    if (signals.length >= 2) {
      if (score >= 0.45) {
        return { verdict: Verdict.TOXIC, confidence: Math.min(score, 0.9), layer: 2, reason: 'Multiple signals joint trigger (≥2 groups)', matched: signals };
      }
      if (score >= 0.25) {
        return { verdict: Verdict.SUSPICIOUS, confidence: Math.min(score, 0.7), layer: 2, reason: 'Joint signals (≥2 groups, weak)', matched: signals };
      }
      // ≥2 信号但总分不足，仍标为可疑但置信度低（送入 Layer 3 确认）
      return { verdict: Verdict.SUSPICIOUS, confidence: Math.max(score, 0.3), layer: 2, reason: 'Joint signals but low score (handoff to AI)', matched: signals };
    }
    // 仅有 1 个信号 → 不触发
    if (signals.length === 1) {
      return { verdict: Verdict.SAFE, confidence: 0.1, layer: 2, reason: 'Single signal, no joint trigger', matched: signals };
    }
    return { verdict: Verdict.SAFE, confidence: 0.05, layer: 2, reason: 'No signals', matched: [] };
  }

  // ── 拼音还原 ────────────────────────────────────────────────────────────────

  _normalizePinyin(text) {
    let result = text.toLowerCase();
    // 全角转半角
    result = result.replace(/[\uff01-\uff5e]/g, c =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    result = result.replace(/\u3000/g, ' ');

    // 拼音还原
    for (const [pinyin, chinese] of Object.entries(this.pinyinMap)) {
      result = result.replace(new RegExp(pinyin, 'gi'), chinese);
    }

    // 去空格
    result = result.replace(/\s+/g, '');

    // 变体映射
    const sortedMap = [...this.variantMap].sort((a, b) => b.from.length - a.from.length);
    for (const rule of sortedMap) {
      result = result.replace(new RegExp(rule.from, 'g'), rule.to);
    }

    // 去特殊符号
    result = result.replace(/[.*\-_~`|\\/^<>{}()\[\]#!$%&+=;:'",?]/g, '');

    return result;
  }

  // ── Utilities ────────────────────────────────────────────────────────────────

  /** 基础标准化（保持向后兼容） */
  _normalize(text) {
    return normalizeText(text, { preserveNumbers: true });
  }

  /**
   * 变体/谐音深度标准化（保留旧逻辑，作为 fallback）
   * 新版优先使用 text-normalizer.js 的 normalizeDeep
   */
  _normalizeForVariants(text) {
    let result = text.toLowerCase();
    result = result.replace(/[\uff01-\uff5e]/g, c =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    result = result.replace(/\u3000/g, ' ');
    result = result.replace(/\s+/g, '');
    result = result.replace(/[.*\-_~`|\\/^<>{}()\[\]#!$%&+=;:'",?]/g, '');

    const sortedMap = [...this.variantMap].sort((a, b) => b.from.length - a.from.length);
    for (const rule of sortedMap) {
      result = result.replace(new RegExp(rule.from, 'g'), rule.to);
    }

    return result;
  }
}
