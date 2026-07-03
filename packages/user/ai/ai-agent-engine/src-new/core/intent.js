/**
 * intent.js — BSA 3 层决策链
 *
 * Layer 1: domain — 业务域判定（in_scope / out_of_scope）
 * Layer 2: action — 动作类型（CREATE / MODIFY / QUERY / DIAGNOSE / LEARN / ROLLBACK / CONFIRM / CANCEL / CAPABILITY_LIST）
 * Layer 3: entities — 实体槽位（topic / scope / keywords / signal）
 *
 * 输出包含兼容旧 API 的字段（intent / confidence / matchedTopic / matchedCategory / extractedTopic），
 * 供旧 v1 路径仍能消费（虽然 v1 路径会逐步废弃）。
 *
 * 关键设计：
 *   - 业务永远优先：如果有业务信号词（屏蔽/过滤/诊断/撤销），即使夹杂越界词也算业务
 *   - 短确认走上下文：默认值是 IN_SCOPE，让编排器结合 active task 判断
 *   - 知识库只决定模板质量，不决定是否能工作
 *   - 不命中时主动生成 dynamicDraft，给编排器兜底
 */

import { AGENT_INTENT, AGENT_DOMAIN, AGENT_ACTION } from './types.js';
import { classifyDomain } from './domain-classifier.js';
import { buildDynamicTopic } from './dynamic-topic-builder.js';

// 动作识别模式（命中即返回该 action）
const ACTION_PATTERNS = {
  [AGENT_ACTION.DIAGNOSE]: [
    /(?:为什么|咋|怎么).{0,8}(?:没|不)(?:被)?(?:过滤|拦截|屏蔽|屏蔽掉|命中|识别|拦)/,
    /(?:诊断|排查|分析下|分析一下|看下|看一下).{0,6}(?:这条|这个|该|那|这|帖子|评论|回复|内容|文本)/,
  ],
  [AGENT_ACTION.QUERY]: [
    /^(?:现在|当前|目前).{0,6}(?:话题|规则|配置|状态|几个|多少|什么|哪些|啥)/,
    /(?:有几个|有多少|看看).{0,4}(?:话题|规则|配置|过滤)/,
    /过滤了\s*(?:什么|哪些|啥|几个|多少)/,
    /(?:现在|当前|目前).{0,4}(?:过滤|话题|规则|配置|开了|启用).{0,4}(?:什么|哪些|啥|几个|多少)/,
  ],
  [AGENT_ACTION.ROLLBACK]: [
    /(?:撤销|回滚|undo|恢复上一|恢复之前|回到之前|撤销刚才|撤销最近|反悔)/,
  ],
  [AGENT_ACTION.MODIFY]: [
    /(?:开启|启用|打开|关闭|禁用|关掉|修改|调整|设置).{0,4}(?:过滤|话题|规则|关键词|语义|检测|识别|敏感度|阈值|scope)/,
  ],
  [AGENT_ACTION.LEARN]: [
    /(?:学习|记住|以后都|这种都|下次也|都给我(?:过滤|屏蔽|拦))/,
  ],
  [AGENT_ACTION.CAPABILITY_LIST]: [
    /^(?:你能做什么|你能干啥|你的功能|你会什么|有什么能力|help|commands?)[?？]?\s*$/i,
  ],
};

// 短确认/取消正则（优先级：单独成词才算，避免误杀「确认要屏蔽」之类）
const ACK_RE = /^(好|是|对|行|可以|继续|确认|ok|yes|y|sure|嗯|好的|没错|没问题|行吧|可以吧|好的吧|okk)[。.！!]?\s*$/i;
// 口语化授权正则（长句确认：当有 active task 时，这些表达等于"用你的默认值执行"）
export const DELEGATE_RE = /(?:你来帮我|你看着办|帮我搞定|代理吧|就用默认|可以了|就这样|直接创建|直接弄|帮我弄|帮我建|你来|交给你|按你说的|按默认|用默认值|那就创建吧|那就这样吧|创建吧|弄吧|搞吧)/;
const CANCEL_RE = /^(不|不要|算了|取消|no|n|nope|错|不对|别|不了)[。.！!]?\s*$/i;

// CREATE 信号（明示要创建/过滤/屏蔽）
const CREATE_SIGNALS = [
  /(?:屏蔽|过滤|拦截|隐藏|不想看|不要|拉黑|讨厌|屏蔽掉|看烦|不想见|不想浏览|不想读|不想听|不想再看到)/,
  /(?:添加|新增|创建|加个|弄个|搞个|建个|加(?:一个|个|条))/,
];

/**
 * 3 层决策主入口
 * @param {string} input
 * @param {(q: string) => {topic?:object, category?:object}|null} [knowledgeMatcher]
 * @returns {{
 *   domain: 'in_scope' | 'out_of_scope',
 *   action: string,
 *   entities: { topic?: string, scope?: string[], keywords?: string[], signal?: string },
 *   intent: string,                  // 兼容旧 API
 *   confidence: number,
 *   domainReason: string,
 *   matchedTopic: object|null,
 *   matchedCategory: object|null,
 *   extractedTopic: string|null,
 *   dynamicDraft: object|null,       // 知识库兜底草稿
 * }}
 */
export function classifyTask(input, knowledgeMatcher = null) {
  const text = String(input || '').trim();

  // ── Layer 1: domain ──────────────────────────
  const domainResult = classifyDomain(text);

  if (domainResult.domain === AGENT_DOMAIN.OUT_OF_SCOPE) {
    return {
      domain: AGENT_DOMAIN.OUT_OF_SCOPE,
      action: AGENT_ACTION.NONE,
      entities: {},
      intent: AGENT_INTENT.GENERAL_CHAT,
      confidence: domainResult.confidence,
      domainReason: domainResult.reason,
      matchedTopic: null,
      matchedCategory: null,
      extractedTopic: null,
      dynamicDraft: null,
    };
  }

  // ── Layer 2: action ──────────────────────────
  // 优先级：ACK > CANCEL > ACTION_PATTERNS（DIAGNOSE/QUERY 等明确动作）> DELEGATE_RE > CREATE 信号
  // 关键：明确动作正则必须优先于 DELEGATE_RE，否则"帮我搞定为什么没过滤"会被误判为 CONFIRM
  let action = AGENT_ACTION.NONE;   // 默认 NONE — 不再默认 CREATE
  let confidence = 0.3;

  if (ACK_RE.test(text)) {
    action = AGENT_ACTION.CONFIRM;
    confidence = 0.9;
  } else if (CANCEL_RE.test(text)) {
    action = AGENT_ACTION.CANCEL;
    confidence = 0.9;
  } else {
    // ★ ACTION_PATTERNS 优先于 DELEGATE_RE
    // "为什么没被过滤"必须赢过"帮我搞定"
    for (const [act, patterns] of Object.entries(ACTION_PATTERNS)) {
      for (const re of patterns) {
        if (re.test(text)) {
          action = act;
          confidence = 0.85;
          break;
        }
      }
      if (confidence > 0.6) break;
    }
    // DELEGATE_RE 只在 ACTION_PATTERNS 未命中时才匹配
    // 且需要调用方（task-orchestrator）结合 activeTask 状态决定是否真的当 CONFIRM
    if (action === AGENT_ACTION.NONE && DELEGATE_RE.test(text)) {
      action = AGENT_ACTION.CONFIRM;
      confidence = 0.85;
    }
  }

  // NONE → 只检查 CREATE 信号（明示的"屏蔽/过滤/不想看"等）
  // ★ 裸词规则已删除：短中文不再自动抬 CREATE，一律交给 LLM 判断
  if (action === AGENT_ACTION.NONE) {
    const hasCreateSignal = CREATE_SIGNALS.some(re => re.test(text));
    if (hasCreateSignal) {
      action = AGENT_ACTION.CREATE;
      confidence = 0.85;
    }
    // 否则保持 NONE — 所有非铁定输入都进 LLM
  }

  // ── Layer 3: entities ────────────────────────
  const knowledgeHit = safeKnowledgeMatch(knowledgeMatcher, text);
  const extractedTopic = knowledgeHit?.topic?.name?.zh
    || knowledgeHit?.topic?.label
    || extractTopicFromText(text);
  const matchedTopic = knowledgeHit?.topic || null;
  const matchedCategory = knowledgeHit?.category || null;

  const entities = {
    topic: extractedTopic || undefined,
    scope: extractScope(text),
    keywords: extractKeywordsFromText(text, extractedTopic),
    signal: extractSignal(text),
  };

  // 知识库不命中时，生成动态草稿（兜底）
  const dynamicDraft = !matchedTopic && (extractedTopic || text.length <= 16)
    ? buildDynamicTopic(text, extractedTopic)
    : null;

  return {
    domain: AGENT_DOMAIN.IN_SCOPE,
    action,
    entities,
    intent: actionToLegacyIntent(action),
    confidence,
    domainReason: domainResult.reason,
    matchedTopic,
    matchedCategory,
    extractedTopic,
    dynamicDraft,
  };
}

// ─── 兼容旧 API ─────────────────────────────────────────────────────────────────
export function classifyIntent(input, knowledgeMatcher) {
  const r = classifyTask(input, knowledgeMatcher);
  return {
    intent: r.intent,
    confidence: r.confidence,
    matchedTopic: r.matchedTopic,
    matchedCategory: r.matchedCategory,
    extractedTopic: r.extractedTopic,
  };
}

export const IntentType = AGENT_INTENT;

// ─── 内部工具 ──────────────────────────────────────────────────────────────────
function safeKnowledgeMatch(matcher, text) {
  if (typeof matcher !== 'function') return null;
  try {
    return matcher(text) || null;
  } catch {
    return null;
  }
}

function actionToLegacyIntent(action) {
  switch (action) {
    case AGENT_ACTION.CREATE:     return AGENT_INTENT.TOPIC_CREATE;
    case AGENT_ACTION.DIAGNOSE:   return AGENT_INTENT.DIAGNOSE;
    case AGENT_ACTION.QUERY:      return AGENT_INTENT.INFORMATION_QUERY;
    case AGENT_ACTION.MODIFY:     return AGENT_INTENT.INSTRUCTION_OPERATION;
    case AGENT_ACTION.LEARN:      return AGENT_INTENT.INSTRUCTION_OPERATION;
    case AGENT_ACTION.ROLLBACK:   return AGENT_INTENT.UNDO;
    case AGENT_ACTION.CONFIRM:    return AGENT_INTENT.CONFIRM;
    case AGENT_ACTION.CANCEL:     return AGENT_INTENT.CANCEL;
    case AGENT_ACTION.CAPABILITY_LIST: return AGENT_INTENT.INFORMATION_QUERY;
    default:                      return AGENT_INTENT.GENERAL_CHAT;
  }
}

function extractTopicFromText(text) {
  // 前缀替换：去掉常见动词前缀，剩的就是话题
  // 只做机械提取，不做语义判断——裸词不再提取，交给 LLM
  const stripped = text
    .replace(/^(我\s*)?(不想再看到|不想再浏览|不想看到|不想看|不想听|不想见|不要给我看|不要看到|不要出现|不要看|屏蔽掉|屏蔽|过滤|拦截|拉黑|讨厌|烦死|给我看|看到|出现|不要|帮我|请|删除|移除|删掉|禁用|关闭|停用|启用|打开|开启|撤销|取消|反悔|干掉|去掉|移走)/i, '')
    .replace(/(相关的内容|相关的信息|相关的东西|相关的帖子|相关的所有|所有相关|所有内容|相关|的内容|的帖子|的主题|的消息|之类的东西|之类的|等等|东东|东西|主题|消息|内容)$/i, '')
    .trim();
  if (stripped && stripped !== text && stripped.length >= 2) return stripped;
  // ★ 裸词规则已删除——短中文输入不再提取为话题名
  // "元神"/"什么模型"/"删除原神"等一律交给 LLM 判断
  return null;
}

function extractScope(text) {
  const map = {
    '评论': 'comment', '评论区': 'comment', '回复': 'reply', '回复区': 'reply',
    '动态': 'dynamic', '视频': 'video', '弹幕': 'danmaku', '直播': 'live',
    '私信': 'dm', '标题': 'title', '昵称': 'nickname', '头像': 'avatar',
    '首页': 'feed', '推荐': 'feed', '时间线': 'timeline',
  };
  const out = [];
  for (const [hint, scope] of Object.entries(map)) {
    if (text.includes(hint) && !out.includes(scope)) out.push(scope);
  }
  return out.length ? out : undefined;
}

function extractKeywordsFromText(text, topic) {
  const tokens = text
    .replace(/[，。！？、,.!?;:；：\s\u3000]+/g, ' ')
    .split(/\s+/)
    .map(t => t.trim().toLowerCase())
    .filter(t => t && t.length >= 2);
  if (topic) tokens.unshift(topic.toLowerCase());
  return Array.from(new Set(tokens));
}

function extractSignal(text) {
  const signals = ['不想看', '屏蔽', '过滤', '拦截', '拉黑', '讨厌', '烦', '不想见', '不要'];
  for (const s of signals) if (text.includes(s)) return s;
  return undefined;
}

// ── LLM 增强意图分类 ──────────────────────────────────

/**
 * LLM 增强的意图分类（两阶段决策）
 * Phase A: 正则快速通道（< 1ms）
 * Phase B: LLM 理解层（仅在 Phase A 不确定时触发）
 *
 * @param {string} input
 * @param {function} knowledgeMatcher
 * @param {object} options - { aiAnalyzer, llmBudgetRemaining }
 * @returns {Promise<object>}
 */
export async function classifyTaskAsync(input, knowledgeMatcher, options = {}) {
  const text = String(input || '').trim();

  // Phase A: 正则快速通道
  const fastResult = classifyTask(text, knowledgeMatcher);

  // 高置信 → 直接返回
  if (fastResult.confidence >= 0.8) return fastResult;

  // 硬越界 → 直接返回（不浪费 LLM 调用）
  if (fastResult.domain === 'out_of_scope'
      && fastResult.domainReason === 'out_of_scope_match'
      && fastResult.confidence >= 0.8) {
    return fastResult;
  }

  // Phase B: LLM 理解（需要 aiAnalyzer 且未超预算）
  const ai = options.aiAnalyzer;
  if (ai && (options.llmBudgetRemaining === undefined || options.llmBudgetRemaining > 0)) {
    try {
      const llmResult = await classifyTaskWithLLM(text, fastResult, knowledgeMatcher, ai);
      if (llmResult) {
        // LLM 结果优先，但保留 fastResult 的 domain 判断（如果 LLM 没覆盖）
        return { ...fastResult, ...llmResult, _source: 'llm_enhanced' };
      }
    } catch {
      // LLM 失败 → 使用正则结果
    }
  }

  return fastResult;
}

/**
 * 用 LLM 做意图/实体重判断
 */
async function classifyTaskWithLLM(text, fastResult, knowledgeMatcher, ai) {
  const prompt = [
    '分析以下用户输入的意图，返回 JSON。',
    '',
    `用户输入：「${text}」`,
    '',
    '正则初步判断：',
    `  域：${fastResult.domain}（置信度 ${fastResult.confidence}）`,
    `  动作：${fastResult.action}`,
    `  话题：${fastResult.entities?.topic || '未提取'}`,
    '',
    '可选动作：CREATE / MODIFY / QUERY / DIAGNOSE / LEARN / ROLLBACK / NONE',
    '可选域：in_scope / out_of_scope',
    '',
    '返回 JSON（不要 markdown 代码块）：',
    '{"domain":"in_scope或out_of_scope",',
    ' "action":"动作或NONE",',
    ' "topic":"话题名或null",',
    ' "keywords":["关键词1"],',
    ' "confidence":0.0-1.0,',
    ' "reasoning":"简短说明"}',
  ].join('\n');

  let result;
  if (typeof ai.chat === 'function') {
    result = await ai.chat(prompt, { system: '你是意图识别模块，只返回 JSON。', maxTokens: 300 });
  } else if (typeof ai.analyze === 'function') {
    result = await ai.analyze(prompt, { type: 'intent_classification' });
  }

  if (!result) return null;

  // 解析 JSON
  const responseText = typeof result === 'string' ? result : (result.text || result.content || String(result));
  try {
    const firstBrace = responseText.indexOf('{');
    const lastBrace = responseText.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const parsed = JSON.parse(responseText.slice(firstBrace, lastBrace + 1));
      return {
        domain: parsed.domain === 'out_of_scope' ? 'out_of_scope' : fastResult.domain,
        action: parsed.action || fastResult.action,
        confidence: parsed.confidence || 0.75,
        entities: {
          ...fastResult.entities,
          topic: parsed.topic || fastResult.entities?.topic,
          keywords: parsed.keywords || fastResult.entities?.keywords,
        },
        domainReason: parsed.domain === 'out_of_scope' ? 'llm_out_of_scope' : fastResult.domainReason,
      };
    }
  } catch {}

  return null;
}
