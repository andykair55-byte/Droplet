/**
 * task-orchestrator.js — BSA 任务编排器
 *
 * 核心职责（BSA 三层架构的中间层）：
 *   1. 接收对话层传入的 userInput
 *   2. 调用 classifyTask 做 3 层决策
 *   3. 维护 task 对象（认知单位）— 多轮对话持续累积 entities / plan
 *   4. 路由到对应动作（_routeCreate / _routeQuery / _routeDiagnose / _routeRollback ...）
 *   5. 计划呈现后等待用户确认，确认后通过 capability registry 调用业务模块
 *   6. 失败回滚 + 审计日志 + 用户可撤销
 *
 * 与 v1 状态机区别：
 *   - 没有"通用 chatbot"回复路径
 *   - OUT_OF_SCOPE 直接走专属模板
 *   - 上下文确认/取消必须查询 active task
 *   - 计划由 capability registry 拼装，编排器不直接 import 业务模块
 */

import { AGENT_ACTION, AGENT_DOMAIN, AGENT_MODE, RISK_LEVEL } from './types.js';
import { classifyTask, DELEGATE_RE } from './intent.js';
import { CapabilityRegistry, createDefaultRegistry } from './capability-registry.js';
import { requiresConfirmation, aggregateRisk } from './risk.js';
import { createAbuseGuard } from './abuse-guard.js';
import { AGENT_EVENTS, THINKING_PHASE, TOOL_PHASE, AGENT_STATUS } from './agent-events.js';
import { buildAgentSystemPrompt, buildLLMPrompt, buildQuestions, listCapabilities } from './prompt-builder.js';

// ── 平台区域标识白名单（统一 scope 语义为「在哪里过滤」）──
const PLATFORM_SCOPES = new Set([
  'comment', 'reply', 'dynamic', 'video', 'danmaku',
  'live', 'dm', 'title', 'nickname', 'avatar', 'feed', 'timeline',
]);

// ── addCustomKeyword 结果文案汇总（纯函数）──
function buildAddKwSummary(requested, added, skipped) {
  const parts = [];
  if (added && added.length) {
    parts.push(added.length > 1
      ? `✓ 屏蔽词 ${added.length} 个已添加：${added.join('、')}`
      : `✓ 屏蔽词「${added[0]}」已添加`);
  }
  if (skipped && skipped.length) {
    parts.push(`${skipped.length} 个已存在被跳过：${skipped.join('、')}`);
  }
  if (!parts.length) return '屏蔽词未添加';
  return parts.join('；');
}

// ── 置信度门控阈值 ──
const CONFIDENCE_THRESHOLDS = {
  CONFIRM: 0.6,   // 低于此值 → 必须走澄清
  CLARIFY: 0.75,  // 低于此值且有 LLM → 先尝试 LLM 重判断
};

// ── P2-4: 复合请求连接词（按优先级从长到短排列）──
const COMPOUND_CONJUNCTIONS = [
  /\s*(?:，|,)\s*(?:另外|还有|同时|此外|然后)\s*/g,
  /\s*(?:以及|还有|同时|并且|而且)\s*/g,
  /\s*(?:和|跟|与|及)\s*/g,
];

// 默认回复模板
const REPLY_TEMPLATES = {
  zh: {
    outOfScope: '抱歉，{reason}',
    outOfScopeHelp: '我只能帮你处理 CyberShield 内的内容过滤、规则配置、诊断与回滚等业务。其它请求（如写代码、翻译、聊天、百科）我无法代劳。',
    capabilityListTitle: '我能帮你完成以下 CyberShield 业务：',
    capabilityItem: '【{label}】{description}',
    noRollback: '当前没有可撤销的操作。你可以先创建或修改过滤规则，然后使用撤销功能。',
    confirmEmpty: '当前没有待确认的任务。',
    cancelEmpty: '当前没有任务可取消。',
    contextNeedGoal: '你说「{ack}」时我需要知道你指的是什么。请告诉我你想做什么：',
    planUnderstanding: '你「{userInput}」，AI 理解为你希望：{understanding}',
    planSummary: '准备执行：{summary}',
    riskL1: '低风险',
    riskL2: '中等风险',
    riskL3: '高风险',
    riskL4: '极高风险',
    done: '已完成 {success}/{total} 步。',
    doneWithRefresh: '已完成 {success}/{total} 步，已刷新页面过滤。',
    failed: '执行失败：{msg}',
    classifyClarify: '我还不太确定你想做什么。请补充：',
    diagnoseRequest: '请贴上你想诊断的文本（评论 / 回复 / 帖子内容），我会分析为什么没被过滤。',
    diagnoseUnavailable: '检测器暂不可用，无法自动分析。你可以手动检查：1) 是否有对应话题规则；2) 关键词是否匹配；3) 话题是否已启用。',
    diagnoseSafeFix: '该文本未被过滤，建议添加关键词「{keywords}」到相关话题。',
    learnNeedSample: '请粘贴你想让我学习的样本内容，我会从中提取过滤规则。',
    learnUnavailable: '规则学习器暂不可用，无法自动学习。',
    modifyTopicUnclear: '你想修改哪个话题？请告诉我话题名称。',
    modifyUnknownAction: '你想对「{topic}」做什么修改？',
    querySummary: '当前已配置 {total} 个话题（{enabled} 个启用，{disabled} 个禁用），共 {keywords} 个关键词。',
    llmBudgetExceeded: '本次会话 LLM 增强调用已达上限，使用启发式结果。',
  },
  en: {
    outOfScope: "Sorry, that's beyond my scope.",
    outOfScopeHelp: 'I can only help with CyberShield tasks (filtering, rules, diagnosis, rollback). I can\'t handle code, translation, or general chat.',
    capabilityListTitle: 'I can help with these CyberShield tasks:',
    capabilityItem: '【{label}】{description}',
    noRollback: 'No rollbackable operation available. Create or modify filter rules first, then use undo.',
    confirmEmpty: 'No task is waiting for confirmation.',
    cancelEmpty: 'No task to cancel.',
    contextNeedGoal: 'I need more context. What do you want to do?',
    planUnderstanding: 'I understand you want: {understanding}',
    planSummary: 'Plan: {summary}',
    riskL1: 'low risk',
    riskL2: 'medium risk',
    riskL3: 'high risk',
    riskL4: 'critical risk',
    done: 'Done {success}/{total} steps.',
    doneWithRefresh: 'Done {success}/{total} steps, page filter refreshed.',
    failed: 'Failed: {msg}',
    classifyClarify: 'I need more info. Please clarify:',
    diagnoseRequest: 'Paste the text you want me to diagnose (comment/reply/post), and I\'ll analyze why it wasn\'t filtered.',
    diagnoseUnavailable: 'Detector is unavailable. You can manually check: 1) if a matching topic rule exists; 2) if keywords match; 3) if the topic is enabled.',
    diagnoseSafeFix: 'This text was not filtered. Suggest adding keywords "{keywords}" to the related topic.',
    learnNeedSample: 'Paste a sample you want me to learn from, and I\'ll extract filtering rules.',
    learnUnavailable: 'Rule learner is unavailable for auto-learning.',
    modifyTopicUnclear: 'Which topic do you want to modify? Please tell me the topic name.',
    modifyUnknownAction: 'What modification do you want for "{topic}"?',
    querySummary: '{total} topics configured ({enabled} enabled, {disabled} disabled), {keywords} keywords total.',
    llmBudgetExceeded: 'LLM enhancement call limit reached for this session, using heuristic results.',
  },
};

function t(lang, key, vars = {}) {
  const dict = REPLY_TEMPLATES[lang] || REPLY_TEMPLATES.zh;
  let s = dict[key] || REPLY_TEMPLATES.zh[key] || '';
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll('{' + k + '}', v);
  return s;
}

// ── MODIFY 动作识别正则 ──────────────────────────────
const MODIFY_ACTION_PATTERNS = {
  ADD_KEYWORDS: /(?:加|添加|新增|增加|补充).{0,4}(?:关键词|词|关键字)/,
  REMOVE_KEYWORDS: /(?:删|删除|移除|去掉|去掉).{0,4}(?:关键词|词|关键字)/,
  DISABLE: /(?:关掉|禁用|关闭|停用|不启用)/,
  ENABLE: /(?:开启|启用|打开|激活)/,
};

export class TaskOrchestrator {
  constructor(opts = {}) {
    this.services = opts.services || {};
    this.auditLog = opts.auditLog || null;
    this.rollbackMgr = opts.rollbackMgr || null;
    this.registry = opts.registry || createDefaultRegistry(this.services);
    this.mode = opts.mode || AGENT_MODE.MANUAL;
    this.lang = opts.lang || 'zh';
    this.recorder = opts.recorder || null;  // 录制探针（可选，不传则不录制）
    this.userProfile = opts.userProfile || null;  // 用户画像 Profile

    this._activeTask = null;     // 当前任务（认知单位，跨多轮对话）
    this._lastCompletedTask = null; // P3-1: 最近完成的任务（用于 MODIFY 上下文继承）
    this._listeners = new Set();

    // Agent 聊天不设限制（用户主观可控），AI 语义检测走 analyze() 受每日限额
    this._llmCallCount = 0;
    this.thinkingMode = false;
    this._abuseGuard = createAbuseGuard();  // 辱骂熔断守卫
  }

  /** 动态设置/清除录制探针 */
  setRecorder(recorder) {
    this.recorder = recorder || null;
  }

  /**
   * 入口 — 处理用户输入
   * @param {string} userInput
   * @param {object} [extras]
   * @returns {Promise<object>} AIAction
   */
  async process(userInput, extras = {}) {
    const text = String(userInput || '').trim();
    if (!text) return this._reply('INFO', { summary: '请告诉我你想做什么。' });

    // 记录用户输入到对话历史
    this._conversationHistory = this._conversationHistory || [];
    this._conversationHistory.push({ user: text, assistant: '', timestamp: Date.now() });
    if (this._conversationHistory.length > 20) this._conversationHistory.shift();

    const result = await this._processCore(text, extras);

    // ★ 最终结果事件
    this._emit({ type: AGENT_EVENTS.DONE, action: result });

    // 记录助手回复
    const lastTurn = this._conversationHistory[this._conversationHistory.length - 1];
    if (lastTurn && lastTurn.user === text) {
      lastTurn.assistant = result.summary || result.type || '';
    }

    // 录制：整个 process() 完成
    try { this.recorder?.onComplete?.(text, result); } catch {}

    return result;
  }

  /**
   * 核心处理逻辑（LLM-First Unified Pipeline）
   */
  async _processCore(text, extras = {}) {
    // ★ 辱骂熔断检测
    const abuseCheck = this._abuseGuard.check(text);
    if (abuseCheck.shouldMute) {
      this.auditLog?.log?.({ type: 'abuse_detected', payload: { input: text.slice(0, 50) } });
      return this._reply('CONVERSATION', {
        summary: '抱歉没能帮到你，我先不打扰了。需要时随时叫我。',
        source: 'abuse_mute',
      });
    }

    // ★ P2-b: active task 退出机制
    // 1) TTL 超时：5 分钟未更新的任务自动释放
    // 2) 新意图接管：如果用户发了明确的新意图（非确认/取消），且与当前任务不同，释放旧任务
    if (this._activeTask && this._activeTask.status !== 'done' && this._activeTask.status !== 'failed' && this._activeTask.status !== 'cancelled') {
      const TASK_TTL = 5 * 60 * 1000; // 5 分钟
      const isExpired = Date.now() - (this._activeTask.updatedAt || this._activeTask.createdAt) > TASK_TTL;
      if (isExpired) {
        this._activeTask.status = 'expired';
        this._activeTask = null;
      }
    }

    // ★ P2-a: 前端选项点击携带结构化 intent（resolvedAction），优先于 NLP 重新分类
    // "configure_filter" 不该被 classifyTask 当成乱码，它就是 CREATE
    // 必须在 classifyTask 之前消费，否则 NLP 可能先误判
    if (extras.resolvedAction && AGENT_ACTION[extras.resolvedAction]) {
      const resolvedAct = AGENT_ACTION[extras.resolvedAction];
      // 构造一个高置信的决策，跳过 NLP 分类
      const resolvedDecision = {
        domain: AGENT_DOMAIN.IN_SCOPE,
        action: resolvedAct,
        confidence: 0.95,
        entities: { topic: extras.clarificationAnswer || undefined },
        matchedTopic: null,
        matchedCategory: null,
        extractedTopic: extras.clarificationAnswer || null,
        dynamicDraft: null,
        domainReason: 'resolved_action',
      };

      // 确认/取消走快速路径
      if (resolvedAct === AGENT_ACTION.CONFIRM) {
        if (this._activeTask && this._activeTask.status === 'waiting_confirmation') {
          return this._executePlan(this._activeTask);
        }
        return this._reply('CLARIFY', {
          summary: t(this.lang, 'contextNeedGoal', { ack: text }),
          clarificationQuestions: [{
            id: 'goal', text: '你想：', options: [
              { label: '配置内容过滤', value: 'configure_filter' },
              { label: '诊断某条内容', value: 'diagnose' },
              { label: '查看当前状态', value: 'status' },
            ],
          }],
        });
      }
      if (resolvedAct === AGENT_ACTION.CANCEL) {
        if (!this._activeTask) return this._reply('INFO', { summary: t(this.lang, 'cancelEmpty') });
        this._activeTask.status = 'cancelled';
        this._activeTask = null;
        return this._reply('CANCELLED', { summary: '已取消当前任务。' });
      }
      if (resolvedAct === AGENT_ACTION.CAPABILITY_LIST) {
        return this._listCapabilities();
      }

      // 其他 resolvedAction（CREATE/DIAGNOSE/QUERY 等）走正常路由
      const signals = this._extractSignals(text);
      // 覆盖 signals 的 action
      signals.action = resolvedAct;
      signals.confidence = 0.95;
      if (extras.clarificationAnswer && !signals.entities?.topic) {
        signals.entities = signals.entities || {};
        signals.entities.topic = extras.clarificationAnswer;
      }

      // 如果有 LLM，走 LLM agent loop（LLM 能看到 resolvedAction 信号）
      const aiCfg = this.services.aiAnalyzer?.config || this.services.aiAnalyzer;
      if (this.services.aiAnalyzer && aiCfg?.apiKey && aiCfg?.aiEnabled !== false) {
        return this._llmAgentLoop(text, extras);
      }
      // 无 LLM → 返回错误
      return this._reply('ERROR', {
        summary: 'AI 不可用，无法处理操作。',
        detail: '请配置 API 密钥后重试。',
        log: JSON.stringify({ timestamp: new Date().toISOString(), reason: 'no_ai', resolvedAction: extras.resolvedAction }, null, 2),
      });
    }

    // 快速路径：确认/取消/CAPABILITY_LIST 不需要走 LLM
    const quickDecision = classifyTask(text, (q) => this._knowledgeMatch(q));

    // ★ DELEGATE_RE 守卫：口语化确认（"你来帮我"、"帮我搞定"）只在有待确认任务时才升级为 CONFIRM
    // 否则降级为 NONE，让 LLM 重新理解真实意图，避免误操作
    if (quickDecision.action === AGENT_ACTION.CONFIRM
        && DELEGATE_RE.test(text)
        && !(this._activeTask && this._activeTask.status === 'waiting_confirmation')) {
      // 没有待确认任务 → 降级为 NONE，交给 LLM 判断
      quickDecision.action = AGENT_ACTION.NONE;
      quickDecision.confidence = 0.4;
    }

    if (quickDecision.action === AGENT_ACTION.CONFIRM) {
      if (this._activeTask && this._activeTask.status === 'waiting_confirmation') {
        return this._executePlan(this._activeTask);
      }
      // ACK_RE 短确认但无待确认任务 → 澄清
      return this._reply('CLARIFY', {
        summary: t(this.lang, 'contextNeedGoal', { ack: text }),
        clarificationQuestions: [{
          id: 'goal', text: '你想：', options: [
            { label: '配置内容过滤', value: 'configure_filter' },
            { label: '诊断某条内容', value: 'diagnose' },
            { label: '查看当前状态', value: 'status' },
          ],
        }],
      });
    }
    if (quickDecision.action === AGENT_ACTION.CANCEL) {
      if (!this._activeTask) {
        return this._reply('INFO', { summary: t(this.lang, 'cancelEmpty') });
      }
      this._activeTask.status = 'cancelled';
      this._activeTask = null;
      return this._reply('CANCELLED', { summary: '已取消当前任务。' });
    }
    if (quickDecision.action === AGENT_ACTION.CAPABILITY_LIST) {
      return this._listCapabilities();
    }

    // Phase A: 信号预提取（正则，<1ms）
    const signals = this._extractSignals(text);

    // T2-4: 每次对话开始时注入用户偏好到上下文
    this._injectUserPreferences(extras);

    // ★ P2-b: active task 退出/插队机制
    if (this._activeTask
        && this._activeTask.status !== 'done'
        && this._activeTask.status !== 'failed'
        && this._activeTask.status !== 'cancelled') {

      // 1) waiting_confirmation 任务：只读操作（QUERY/CAPABILITY_LIST）插队执行，不释放
      //    ROLLBACK/CANCEL → 取消当前提议（用户在确认阶段说"反悔"=取消提议，不是撤销已执行的操作）
      if (this._activeTask.status === 'waiting_confirmation') {
        if (signals.action === AGENT_ACTION.QUERY || signals.action === AGENT_ACTION.CAPABILITY_LIST) {
          // 插队执行只读操作，保留 waiting_confirmation 任务
          const readOnlyResult = signals.action === AGENT_ACTION.QUERY
            ? await this._routeQuery(this._ensureActiveTask(text, signals, extras), signals)
            : this._listCapabilities();
          // 在结果中提醒用户有待确认的任务
          const pendingLabel = this._activeTask.entities?.topic || this._activeTask.userInput?.slice(0, 20) || '';
          if (readOnlyResult.summary) {
            readOnlyResult.summary += `\n\n💡 提醒：你刚才的「${pendingLabel}」配置还在等你确认。`;
          }
          return readOnlyResult;
        }
        if (signals.action === AGENT_ACTION.ROLLBACK || signals.action === AGENT_ACTION.CANCEL) {
          // 用户在确认阶段说"反悔/取消"→ 取消当前提议
          const topicLabel = this._activeTask.entities?.topic || '';
          this._activeTask.status = 'cancelled';
          this._activeTask = null;
          this._lastCompletedTask = null;
          return this._reply('CANCELLED', { summary: topicLabel ? `已取消「${topicLabel}」的配置提议。` : '已取消当前提议。' });
        }
      }

      // 2) waiting_input 任务（DIAGNOSE 等贴评论）：用户输入优先作为待填槽位
      //    除非是明确的命令词（取消/查看状态/新话题创建）
      if (this._activeTask.status === 'waiting_input') {
        const isExplicitCommand = signals.action === AGENT_ACTION.CANCEL
          || signals.action === AGENT_ACTION.CAPABILITY_LIST
          || (signals.action === AGENT_ACTION.CREATE && signals.confidence >= 0.8);
        if (!isExplicitCommand) {
          // 不释放，把用户输入当作待填槽位，直接走当前任务的路由
          if (this._activeTask.action === AGENT_ACTION.DIAGNOSE) {
            extras.diagnoseText = text;
            return this._routeDiagnose(this._activeTask, signals, extras);
          } else if (this._activeTask.action === AGENT_ACTION.LEARN) {
            extras.sampleText = text;
            return this._routeLearn(this._activeTask, signals, extras);
          }
          // 其他 waiting_input 任务，继续走正常流程
        } else {
          // 明确命令 → 释放旧任务
          this._activeTask.status = 'superseded';
          this._activeTask = null;
        }
      }

      // 3) 其他非终态任务：新意图接管
      if (this._activeTask
          && this._activeTask.status !== 'waiting_confirmation'
          && this._activeTask.status !== 'waiting_input'
          && signals.action !== AGENT_ACTION.NONE
          && signals.action !== AGENT_ACTION.CONFIRM
          && signals.action !== AGENT_ACTION.CANCEL
          && signals.action !== this._activeTask.action) {
        this._activeTask.status = 'superseded';
        this._activeTask = null;
      }
    }

    // HARD_OUT_OF_SCOPE 检查（写代码/翻译等极端越界，正则高置信直接拒绝）
    // 注意：这里只拦截正则非常确定的越界，模糊的交给 LLM 判断
    if (signals.hardOutOfScope && signals.confidence >= 0.9) {
      // 即使是硬越界，如果 LLM 可用，也交给 LLM 处理（开源项目可以帮用户）
      if (!this.services.aiAnalyzer) {
        this.auditLog?.log?.({ type: 'out_of_scope', payload: { input: text, reason: signals.domainReason } });
        return this._reply('OUT_OF_SCOPE', {
          summary: t(this.lang, 'outOfScopeHelp'),
          reason: signals.domainReason,
        });
      }
      // LLM 可用时 fall through，让 LLM 决定
    }

    // Phase B: LLM 推理（如果可用）
    // ★ Agent 开关只取决于 AI 是否可调用，无降级策略
    const aiCfg = this.services.aiAnalyzer?.config || this.services.aiAnalyzer;
    const hasApiKey = !!(aiCfg?.apiKey);
    const aiEnabled = aiCfg?.aiEnabled !== false;
    const llmAvailable = this.services.aiAnalyzer && hasApiKey && aiEnabled;

    if (llmAvailable) {
      return this._llmAgentLoop(text, extras);
    }

    // AI 不可用 → 直接返回错误 + 可复制日志，不走正则降级
    const reason = !this.services.aiAnalyzer ? 'no_analyzer'
      : !hasApiKey ? 'no_api_key'
      : !aiEnabled ? 'ai_disabled'
      : 'unknown';
    const logData = {
      timestamp: new Date().toISOString(),
      input: text.slice(0, 100),
      reason,
      signals: { action: signals.action, domain: signals.domain, confidence: signals.confidence },
    };
    return this._reply('ERROR', {
      summary: 'AI 不可用，无法处理你的请求。',
      detail: reason === 'no_api_key'
        ? '未配置 API 密钥。请在设置中配置 AI API Key 后重试。'
        : reason === 'ai_disabled'
        ? 'AI 功能已禁用。请在设置中启用后重试。'
        : 'AI 服务未初始化，请检查配置。',
      log: JSON.stringify(logData, null, 2),
    });
  }

  // ── LLM-Agent-with-Tools 核心方法 ──────────────────────────

  /**
   * 信号预提取：正则快速提取参考信号，不做决策
   * 返回值仅供 LLM 参考，不直接路由
   */
  _extractSignals(text) {
    const decision = classifyTask(text, (q) => this._knowledgeMatch(q));
    return {
      domain: decision.domain,
      action: decision.action,
      confidence: decision.confidence,
      matchedTopic: decision.matchedTopic || null,
      entities: decision.entities || {},
      hardOutOfScope: decision.domain === 'out_of_scope' && decision.domainReason === 'out_of_scope_match',
      domainReason: decision.domainReason || '',
    };
  }

  /**
   * LLM Agent 主循环：LLM 推理 → 工具执行 → 再推理 → 回复
   * 最多 3 轮循环
   */
  async _llmAgentLoop(userInput, extras) {
    const maxRounds = 3;
    this._emit({ type: AGENT_EVENTS.THINKING, phase: THINKING_PHASE.LLM_CALL, round: 0 });
    let currentInput = userInput;
    let toolResults = [];
    let finalReply = null;

    for (let round = 0; round < maxRounds; round++) {
        this._emit({ type: AGENT_EVENTS.THINKING, phase: THINKING_PHASE.LLM_CALL, round: round + 1 });
        const systemPrompt = this._buildAgentSystemPrompt(toolResults);

      let llmResponse;
      try {
        const ai = this.services.aiAnalyzer;
        const chatHistory = (this._conversationHistory || [])
          .filter(t => t.user && t.assistant)
          .slice(-4)
          .flatMap(t => [
            { role: 'user', content: t.user },
            { role: 'assistant', content: (t.assistant || '').slice(0, 200) },
          ]);
        // ★ 思考模式：流式解析 <thinking>...</thinking> 标签
        let thinkBuffer = '';
        let thinkPhase = 'idle'; // idle → thinking → done
        const chatOpts = {
          system: systemPrompt,
          maxTokens: 800,
          history: chatHistory,
          signal: extras._abortSignal,
          onChunk: (chunk) => {
            if (this.thinkingMode) {
              thinkBuffer += chunk;
              // 状态机：检测 <thinking> 标签
              if (thinkPhase === 'idle') {
                const thinkIdx = thinkBuffer.indexOf('<thinking>');
                if (thinkIdx !== -1) {
                  // 进入思考阶段
                  thinkPhase = 'thinking';
                  const after = thinkBuffer.slice(thinkIdx + 11);
                  thinkBuffer = after;
                  this._emit({ type: AGENT_EVENTS.THINKING_STREAM, chunk: after, done: false });
                } else {
                  // 还没进入思考标签，作为普通文本流式输出
                  this._emit({ type: AGENT_EVENTS.STREAM, chunk, done: false });
                }
              } else if (thinkPhase === 'thinking') {
                const endIdx = thinkBuffer.indexOf('</thinking>');
                if (endIdx !== -1) {
                  // 思考结束
                  const beforeEnd = thinkBuffer.slice(0, endIdx);
                  const afterEnd = thinkBuffer.slice(endIdx + 12);
                  if (beforeEnd) {
                    this._emit({ type: AGENT_EVENTS.THINKING_STREAM, chunk: beforeEnd, done: true });
                  } else {
                    this._emit({ type: AGENT_EVENTS.THINKING_STREAM, chunk: '', done: true });
                  }
                  thinkPhase = 'done';
                  thinkBuffer = '';
                  // 余下的内容作为普通流式输出
                  if (afterEnd) {
                    this._emit({ type: AGENT_EVENTS.STREAM, chunk: afterEnd, done: false });
                  }
                } else {
                  // 仍在思考中，只输出增量
                  this._emit({ type: AGENT_EVENTS.THINKING_STREAM, chunk: chunk, done: false });
                }
              } else {
                // thinkPhase === 'done'，正常流式输出
                this._emit({ type: AGENT_EVENTS.STREAM, chunk, done: false });
              }
            } else {
              // 非思考模式：直接流式输出
              this._emit({ type: AGENT_EVENTS.STREAM, chunk, done: false });
            }
          },
          // ★ 不再传 tools — 改用 JSON-mode：工具描述已注入 system prompt，LLM 输出 JSON tool_calls
        };
        if (typeof ai.chat === 'function') {
          llmResponse = await ai.chat(currentInput, chatOpts);
          // 如果思考模式且仍在 thinking 阶段（没遇到 </thinking>），强制结束思考
          if (this.thinkingMode && thinkPhase === 'thinking') {
            this._emit({ type: AGENT_EVENTS.THINKING_STREAM, chunk: '', done: true });
            thinkPhase = 'done';
            thinkBuffer = '';
          }
          // ★ 流式输出结束信号
          this._emit({ type: AGENT_EVENTS.STREAM, chunk: '', done: true });
        } else if (typeof ai.analyze === 'function') {
          llmResponse = await ai.analyze(currentInput, { type: 'agent_loop', system: systemPrompt });
        }
        this._llmCallCount++;
        try { this.recorder?.onLLMCall?.(round, { input: currentInput, systemHash: systemPrompt.length }, llmResponse); } catch {}
      } catch (e) {
        // ★ LLM 调用失败 → 直接返回错误 + 可复制日志，不降级到正则
        this._emit({ type: AGENT_EVENTS.ERROR, error: e });
        const logData = {
          timestamp: new Date().toISOString(),
          phase: 'llm_call',
          round,
          error: e?.message || 'unknown',
          stack: e?.stack?.slice(0, 500),
        };
        return this._reply('ERROR', {
          summary: 'AI 调用失败，请稍后重试。',
          detail: `错误：${e?.message || '未知错误'}`,
          log: JSON.stringify(logData, null, 2),
        });
      }

      if (!llmResponse) {
        const logData = {
          timestamp: new Date().toISOString(),
          phase: 'llm_empty_response',
          round,
        };
        return this._reply('ERROR', {
          summary: 'AI 返回了空响应，请重试。',
          log: JSON.stringify(logData, null, 2),
        });
      }

      // 审计日志
      this.auditLog?.log?.({
        type: 'llm_agent_round',
        payload: { round, input: currentInput.slice(0, 200), response: String(llmResponse).slice(0, 200) },
      });

      // 解析 LLM 响应
      const parsed = this._parseAgentResponse(llmResponse);

      if (parsed.toolCalls && parsed.toolCalls.length > 0) {
        // ★ 检查是否有 guideUser 调用 — LLM 主动引导用户
        const guideCall = parsed.toolCalls.find(tc => tc.name === 'capability.task.guideUser');
        if (guideCall) {
          try { this.recorder?.onToolCall?.(guideCall.name, guideCall.arguments || {}, {}); } catch {}
          return this._handleGuideUser(guideCall.arguments, finalReply, userInput, extras);
        }

        // ★ 检查是否有 proposeCreate 调用 — LLM 主动提议建话题
        const proposeCall = parsed.toolCalls.find(tc => tc.name === 'capability.topicFilter.proposeCreate');
        if (proposeCall) {
          try { this.recorder?.onToolCall?.(proposeCall.name, proposeCall.arguments || {}, {}); } catch {}
          return this._handleProposeCreate(proposeCall.arguments, finalReply, userInput, extras);
        }

        // ★ 检查是否有 cancelProposal 调用 — LLM 理解用户想放弃
        const cancelCall = parsed.toolCalls.find(tc => tc.name === 'capability.task.cancelProposal');
        if (cancelCall) {
          try { this.recorder?.onToolCall?.(cancelCall.name, cancelCall.arguments || {}, {}); } catch {}
          return this._handleCancelProposal(cancelCall.arguments, finalReply);
        }

        // ★ 检查是否有 proposeAction 调用 — LLM 提议删除/禁用/启用话题
        const proposeActionCall = parsed.toolCalls.find(tc => tc.name === 'capability.task.proposeAction');
        if (proposeActionCall) {
          try { this.recorder?.onToolCall?.(proposeActionCall.name, proposeActionCall.arguments || {}, {}); } catch {}
          return this._handleProposeAction(proposeActionCall.arguments, finalReply, userInput, extras);
        }

        // ★ 检查是否有 proposeHotTopic 调用 — LLM 提议创建热点规则（带 TTL）
        const proposeHotTopicCall = parsed.toolCalls.find(tc => tc.name === 'capability.hotTopic.proposeCreate');
        if (proposeHotTopicCall) {
          try { this.recorder?.onToolCall?.(proposeHotTopicCall.name, proposeHotTopicCall.arguments || {}, {}); } catch {}
          return this._handleProposeHotTopic(proposeHotTopicCall.arguments, finalReply, userInput, extras);
        }

        // ★ 检查是否有 addCustomKeyword 调用 — LLM 添加自定义屏蔽词
        const addKwCall = parsed.toolCalls.find(tc => tc.name === 'capability.customKeyword.add');
        if (addKwCall) {
          try { this.recorder?.onToolCall?.(addKwCall.name, addKwCall.arguments || {}, {}); } catch {}
          return this._handleAddCustomKeyword(addKwCall.arguments, finalReply, userInput, extras);
        }

        // LLM 请求调用其他工具
        const executionResults = await this._executeToolCalls(parsed.toolCalls, extras);
        toolResults = executionResults;

        // 录制：普通工具执行结果
        try { for (const r of executionResults) { this.recorder?.onToolCall?.(r.tool, {}, r.result); } } catch {}

        // 审计日志
        this.auditLog?.log?.({
          type: 'tool_execution',
          payload: { tools: parsed.toolCalls.map(tc => tc.name), results: executionResults.map(r => ({ tool: r.tool, success: r.success })) },
        });

        // 检查是否需要用户确认（高风险操作）
        const needsConfirm = parsed.toolCalls.some(tc => {
          const cap = this.registry.get(tc.name);
          return cap && requiresConfirmation(cap.riskLevel, this.mode);
        });

        if (needsConfirm) {
          // 返回计划让用户确认（LLM 路径下不注入正则信号，由 LLM 自主决策）
          const task = this._ensureActiveTask(userInput, {
            domain: AGENT_DOMAIN.IN_SCOPE,
            action: AGENT_ACTION.CREATE,
            confidence: 0.9,
            entities: {},
          }, extras);
          return this._presentPlan(task, parsed.toolCalls.map(tc => ({
            id: `step_agent_${tc.name.split('.').pop()}`,
            label: tc.name.split('.').pop(),
            module: tc.name.split('.')[1] || 'unknown',
            action: tc.name.split('.').pop(),
            capability: tc.name,
            args: tc.arguments,
            riskLevel: this.registry.get(tc.name)?.riskLevel || RISK_LEVEL.L2,
            rollbackable: this.registry.get(tc.name)?.rollbackable || false,
          })));
        }

        // 低风险 → 继续循环，让 LLM 看到执行结果
        currentInput = `工具执行结果：\n${executionResults.map(r => `- ${r.tool}: ${r.success ? '成功' : '失败'} ${r.result ? JSON.stringify(r.result).slice(0, 200) : ''}`).join('\n')}`;
        continue;
      }

      // LLM 返回纯文本回复
      finalReply = parsed.text || (typeof llmResponse === 'string' ? llmResponse : String(llmResponse));

      // 守卫：如果 LLM 返回的文本太短（<5 字符）且看起来不像有意义的回复，忽略
      if (finalReply.trim().length < 5 && /^\d+$/.test(finalReply.trim())) {
        finalReply = null;
        continue;
      }

      // LLM 返回纯文本 = LLM 决定不调用工具，只对话
      // 决策权 100% 归 LLM，后端状态只由工具调用驱动（proposeCreate/cancelProposal）
      break;
    }

    if (finalReply) {
      // 记录到 memory
      this._recordToMemory(this._activeTask || { entities: {} });
      // 如果有工具执行结果，刷新 scanner
      if (toolResults.length > 0) {
        try { this.services.scanner?.refresh?.(); } catch {}
      }
      return this._reply('CONVERSATION', { summary: finalReply, source: 'llm', toolResults });
    }

    // 兜底：LLM 未产生回复 → 返回错误，不降级到正则
    const logData = {
      timestamp: new Date().toISOString(),
      phase: 'llm_no_reply',
      rounds: maxRounds,
      input: userInput.slice(0, 100),
    };
    return this._reply('ERROR', {
      summary: 'AI 未能生成有效回复，请重试。',
      log: JSON.stringify(logData, null, 2),
    });
  }

  /**
   * 构建 Agent System Prompt — 对话式，简洁，让 LLM 发挥语义推理能力
   * 委托至 prompt-builder.js 的纯函数实现。
   */
  _buildAgentSystemPrompt(toolResults) {
    return buildAgentSystemPrompt({
      status: this.getStatus(),
      registry: this.registry,
      thinkingMode: this.thinkingMode,
      userProfile: this.userProfile,
      activeTask: this._activeTask,
      toolResults,
    });
  }

  /**
   * 解析 LLM Agent 响应
   * 支持多种格式：
   *   1. 原生 tool_calls JSON: {"tool_calls":[...]}
   *   2. Markdown 代码块包裹: ```json\n{"tool_calls":[...]}\n```
   *   3. OpenAI function_call 格式: {"function_call":{"name":"...","arguments":"..."}}
   *   4. 混合文本+JSON: 一些文字\n{"tool_calls":[...]}\n更多文字
   */
  _parseAgentResponse(raw) {
    if (!raw) return { text: '', toolCalls: null };

    // ★ 去除思考标签
    let thinkingContent = '';
    const rawText = typeof raw === 'string' ? raw : (raw.text || raw.content || String(raw));
    const thinkMatch = rawText.match(/<thinking>([\s\S]*?)<\/thinking>/);
    if (thinkMatch) {
      thinkingContent = thinkMatch[1].trim();
    }

    const text = typeof raw === 'string' ? rawText.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim() : rawText;

    // 1) 检查原生 tool_calls（OpenAI/Claude API 返回结构化格式）
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      // OpenAI format: { tool_calls: [{ function: { name, arguments } }] }
      if (raw.tool_calls && Array.isArray(raw.tool_calls)) {
        return {
          toolCalls: this._resolveToolNames(raw.tool_calls.map(tc => ({
            name: tc.function?.name || tc.name,
            arguments: typeof tc.function?.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : (tc.function?.arguments || tc.arguments || {}),
          }))),
          text: null,
        };
      }
      // Claude format: { content: [{ type: 'tool_use', name, input }] }
      if (raw.content && Array.isArray(raw.content)) {
        const toolUses = raw.content.filter(c => c.type === 'tool_use');
        if (toolUses.length > 0) {
          return {
            toolCalls: this._resolveToolNames(toolUses.map(tc => ({
              name: tc.name,
              arguments: tc.input || {},
            }))),
            text: null,
          };
        }
      }
      // 单个 function_call
      if (raw.function_call || raw.functionCall) {
        const fc = raw.function_call || raw.functionCall;
        return {
          toolCalls: this._resolveToolNames([{
            name: fc.name,
            arguments: typeof fc.arguments === 'string' ? JSON.parse(fc.arguments) : (fc.arguments || {}),
          }]),
          text: null,
        };
      }
    }

    // 2) 从文本中提取 JSON（支持 markdown 代码块）
    const jsonCandidates = [];

    // 提取 markdown 代码块中的 JSON
    const codeBlockRe = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/g;
    let m;
    while ((m = codeBlockRe.exec(text)) !== null) {
      jsonCandidates.push(m[1].trim());
    }

    // 提取裸 JSON（找最外层大括号对）
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonCandidates.push(text.slice(firstBrace, lastBrace + 1));
    }

    for (const jsonStr of jsonCandidates) {
      try {
        const parsed = JSON.parse(jsonStr);
        // tool_calls 数组格式
        if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
          return {
            toolCalls: this._resolveToolNames(parsed.tool_calls.map(tc => ({
              name: tc.name || tc.function?.name,
              arguments: tc.arguments || tc.params || tc.function?.arguments ||
                (typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : {}) || {},
            }))),
            text: null,
          };
        }
        // 单个 function_call
        if (parsed.function_call || parsed.functionCall) {
          const fc = parsed.function_call || parsed.functionCall;
          return {
            toolCalls: this._resolveToolNames([{
              name: fc.name,
              arguments: typeof fc.arguments === 'string' ? JSON.parse(fc.arguments) : (fc.arguments || {}),
            }]),
            text: null,
          };
        }
        // 单个工具调用（无外层包装）
        if (parsed.name && (parsed.arguments || parsed.params || parsed.input)) {
          return {
            toolCalls: this._resolveToolNames([{
              name: parsed.name,
              arguments: parsed.arguments || parsed.params || parsed.input || {},
            }]),
            text: null,
          };
        }
      } catch {}
    }

    // 纯文本回复
    return { text, toolCalls: null };
  }

  /**
   * ★ 将 LLM 返回的短名 tool call 映射为全限定名
   * LLM 可能返回 "guideUser" 而非 "capability.task.guideUser"
   * 也可能返回 "capability.topicFilter.proposeCreate={...}" 把参数拼进 name
   * 规则：先精确匹配，再按后缀模糊匹配
   */
  _resolveToolName(name) {
    if (!name) return name;

    // ★ 别名映射：LLM 可能使用 prompt 中的短名
    const ALIASES = {
      'proposeHotTopic': 'capability.hotTopic.proposeCreate',
      'addCustomKeyword': 'capability.customKeyword.add',
      'guideUser': 'capability.task.guideUser',
      'cancelProposal': 'capability.task.cancelProposal',
    };
    if (ALIASES[name]) return ALIASES[name];

    // ★ 处理 Llama 格式：name=JSON 或 name={JSON}，参数被拼进 tool name
    // 例: capability.topicFilter.proposeCreate={"topicLabel": "话题"}
    const eqIdx = name.indexOf('=');
    if (eqIdx > 0) {
      const realName = name.slice(0, eqIdx);
      const embeddedArgs = name.slice(eqIdx + 1);
      // 尝试解析嵌入的参数
      try {
        const parsed = JSON.parse(embeddedArgs);
        this._pendingEmbeddedArgs = this._pendingEmbeddedArgs || {};
        this._pendingEmbeddedArgs[realName] = parsed;
      } catch {}
      name = realName;
    }

    // 精确匹配
    if (this.registry.get(name)) return name;
    // 后缀模糊匹配：guideUser → capability.task.guideUser
    const allCaps = this.registry.list();
    const match = allCaps.find(c => c.name.endsWith('.' + name));
    if (match) return match.name;
    // 部分匹配：task.guideUser → capability.task.guideUser
    const partial = allCaps.find(c => c.name.endsWith(name));
    if (partial) return partial.name;
    return name; // 无法解析，返回原名
  }

  /**
   * 对 toolCalls 数组中的 name 做短名解析
   * 同时合并嵌入参数（Llama 格式 name=JSON）
   */
  _resolveToolNames(toolCalls) {
    if (!toolCalls) return toolCalls;
    this._pendingEmbeddedArgs = {};
    const resolved = toolCalls.map(tc => {
      const resolvedName = this._resolveToolName(tc.name);
      // 合并嵌入参数到 arguments
      const embedded = this._pendingEmbeddedArgs?.[resolvedName] || this._pendingEmbeddedArgs?.[tc.name];
      if (embedded && typeof embedded === 'object') {
        tc = { ...tc, arguments: { ...embedded, ...tc.arguments } };
      }
      return { ...tc, name: resolvedName };
    });
    this._pendingEmbeddedArgs = {};
    return resolved;
  }

  /**
   * 执行工具调用
   */
  async _executeToolCalls(toolCalls, extras) {
    const results = [];
    for (const tc of toolCalls) {
      const startTime = Date.now();
      // ★ 工具调用开始
      this._emit({ type: AGENT_EVENTS.TOOL_CALL, name: tc.name, phase: TOOL_PHASE.START });
      try {
        const result = await this.registry.execute(tc.name, tc.arguments, extras);
        const duration = Date.now() - startTime;
        // ★ 工具调用完成
        this._emit({ type: AGENT_EVENTS.TOOL_CALL, name: tc.name, phase: TOOL_PHASE.END, result: result.success !== false, duration });
        results.push({ tool: tc.name, success: result.success !== false, result });
      } catch (e) {
        const duration = Date.now() - startTime;
        // ★ 工具调用失败
        this._emit({ type: AGENT_EVENTS.TOOL_CALL, name: tc.name, phase: TOOL_PHASE.END, result: false, duration, error: e.message });
        results.push({ tool: tc.name, success: false, error: e.message });
      }
    }
    return results;
  }

  // ── 暴露的 API（兼容旧 v2 入口）────────────────────
  getActiveTask() { return this._activeTask; }
  clearActiveTask() { this._activeTask = null; }
  setMode(mode) { this.mode = mode === AGENT_MODE.AUTO ? AGENT_MODE.AUTO : AGENT_MODE.MANUAL; }
  getMode() { return this.mode; }
  setThinkingMode(enabled) { this.thinkingMode = !!enabled; }
  getThinkingMode() { return this.thinkingMode; }
  undoLast() {
    const op = this.rollbackMgr?.latestRollbackable?.();
    if (!op) {
      return this._reply('INFO', { summary: t(this.lang, 'noRollback') });
    }
    // 先尝试直接执行回滚
    return this._executeUndo(op);
  }

  async _executeUndo(op) {
    try {
      const rollbackable = this.rollbackMgr?.latestRollbackable?.();
      const target = op || rollbackable;
      if (!target) return this._reply('INFO', { summary: t(this.lang, 'noRollback') });
      const title = target.title || target.type || '最近操作';
      const result = await this.rollbackMgr?.restore?.(target.opId);
      if (result?.success) {
        const newOp = this.rollbackMgr?.latestRollbackable?.();
        const next = newOp
          ? `\n\n下一项可撤销：${newOp.title || newOp.type || ''}`
          : '';
        return this._reply('CONVERSATION', {
          summary: `✓ 已撤销「${title}」。${next}`,
        });
      }
      return this._reply('INFO', { summary: `撤销「${title}」失败：${result?.error || '未知错误'}` });
    } catch (err) {
      return this._reply('INFO', { summary: `撤销失败：${err.message}` });
    }
  }

  async confirmCurrent() {
    if (!this._activeTask) return this._reply('INFO', { summary: t(this.lang, 'confirmEmpty') });
    if (this._activeTask.status !== 'waiting_confirmation') return this._reply('INFO', { summary: t(this.lang, 'confirmEmpty') });
    return this._executePlan(this._activeTask);
  }
  cancelCurrent() {
    if (!this._activeTask) return this._reply('INFO', { summary: t(this.lang, 'cancelEmpty') });
    this._activeTask.status = 'cancelled';
    this._activeTask = null;
    this._lastCompletedTask = null; // ★ 清干净，防止后续任务继承旧 topic
    return this._reply('CANCELLED', { summary: '已取消当前任务。' });
  }
  onEvent(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit(evt) { for (const fn of this._listeners) try { fn(evt); } catch {} }
  getStatus() {
    // ★ 最近创建的话题（用户话题，非内置）
    let recentTopics = [];
    try {
      const tf = this.services.topicFilter;
      if (tf) {
        const allTopics = tf.getAllTopics ? tf.getAllTopics() : (tf.topics ? Object.values(tf.topics) : []);
        const userTopics = allTopics.filter(t => t && t.source === 'user' || t && t.createdBy === 'user');
        recentTopics = userTopics.slice(-3).map(t => ({
          id: t.id, label: t.label || t.name?.zh || '', keywords: (t.keywords || []).slice(0, 5),
        }));
      }
    } catch {}
    // ★ 最近创建的热点话题（活跃状态）
    let recentHotTopics = [];
    try {
      const htm = this.services.hotTopicManager;
      if (htm && typeof htm.getAll === 'function') {
        const active = htm.getAll().filter(t => t && t.status === 'active');
        recentHotTopics = active.slice(-3).map(t => ({
          id: t.id, label: t.label || '', keywords: (t.keywords || []).slice(0, 5),
          triggerMode: t.triggerMode, ttlDays: t.ttlDays,
        }));
      }
    } catch {}
    return {
      mode: this.mode,
      llmCallCount: this._llmCallCount,
      activeTask: this._activeTask ? {
        id: this._activeTask.id, action: this._activeTask.action, status: this._activeTask.status,
        entities: this._activeTask.entities,
      } : null,
      registryCount: this.registry.size ? this.registry.size() : this.registry.list().length,
      recentTopics,
      recentHotTopics,
    };
  }

  // ── 私有：上下文管理 ──────────────────────────────
  _knowledgeMatch(q) {
    try {
      const km = this.services.knowledge;
      if (!km?.findTopic) return null;
      const t = km.findTopic(q);
      if (!t) return null;
      return { topic: t, category: km.findTopicsByCategory?.(t.category)?.[0] || null };
    } catch { return null; }
  }

  _ensureActiveTask(userInput, decision, extras = {}) {
    // 续接条件：当前有未完成的任务 + 业务域内 + 动作兼容
    if (this._activeTask && this._activeTask.status !== 'done' && this._activeTask.status !== 'failed' && this._activeTask.status !== 'cancelled') {
      this._activeTask.entities = mergeEntities(this._activeTask.entities, decision.entities);
      // 合并 extras 中的实体（如 diagnoseText / sampleText）
      if (extras.diagnoseText) {
        this._activeTask.entities.diagnoseText = extras.diagnoseText;
      }
      if (extras.sampleText) {
        this._activeTask.entities.sampleText = extras.sampleText;
      }
      this._activeTask.currentTurn = (this._activeTask.currentTurn || 0) + 1;
      // 累积后若 entities 完整，编排器路由会自动升级
      return this._activeTask;
    }
    // 新建
    const entities = { ...decision.entities };
    if (extras.diagnoseText) entities.diagnoseText = extras.diagnoseText;
    if (extras.sampleText) entities.sampleText = extras.sampleText;

    // P3-1: MODIFY 动作若无明确 topic，从最近完成的任务继承（5 分钟内有效）
    const CONTEXT_TTL = 5 * 60 * 1000; // 5 分钟
    if (decision.action === AGENT_ACTION.MODIFY && !entities.topic
        && this._lastCompletedTask
        && (Date.now() - this._lastCompletedTask.updatedAt < CONTEXT_TTL)) {
      const prevTopic = this._lastCompletedTask.entities?.topic
        || this._lastCompletedTask.meta?.matchedTopic?.id
        || this._lastCompletedTask.plan?.[0]?.args?.topicLabel;
      if (prevTopic) {
        entities.topic = prevTopic;
      }
    }

    this._activeTask = {
      id: 'task_' + Date.now().toString(36),
      userInput,
      domain: decision.domain,
      action: decision.action,
      entities,
      slots: [],
      plan: [],
      riskLevel: RISK_LEVEL.L2,
      status: 'planning',
      currentTurn: 1,
      slotFillingRounds: 0,
      operations: [],
      rollbackToken: null,
      confirmationRequired: true,
      result: null,
      error: null,
      meta: {
        dynamicDraft: decision.dynamicDraft,
        matchedTopic: decision.matchedTopic,
        matchedCategory: decision.matchedCategory,
        userPreferences: null,  // T2-4: 用户偏好注入
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this._emit({ type: 'task_created', task: this._activeTask });
    return this._activeTask;
  }

  // ── T2-4: 注入用户偏好 ────────────────────────────
  _injectUserPreferences(extras = {}) {
    try {
      const prefs = this.services.memory?.getUserPreferenceSummary?.();
      if (prefs) {
        // 合并 Profile 的 defaultScopes（优先级高于 mostUsedScopes）
        if (this.userProfile?.preferredScopes?.length) {
          prefs.defaultScopes = this.userProfile.preferredScopes;
        }
        if (this._activeTask) {
          this._activeTask.meta = this._activeTask.meta || {};
          this._activeTask.meta.userPreferences = prefs;
        }
      }
      // 也存到 extras 供后续使用
      extras._userPreferences = prefs || null;
    } catch {
      // memory 不可用时静默降级
    }
  }

  // ── T2-4: 任务完成后写入记忆 ──────────────────────
  _recordToMemory(task) {
    try {
      const mem = this.services.memory;
      if (!mem?.recordPreference) return;
      // 从 task 的 plan 执行结果中提取偏好信息
      const topicStep = task.plan?.find(s => s.module === 'topicFilter');
      if (topicStep) {
        mem.recordPreference({
          topicId: topicStep.args?.topicId,
          topicLabel: topicStep.args?.topicLabel,
          scopes: topicStep.args?.scopes,
          action: task.action,
          timestamp: Date.now(),
        });
      }
    } catch {
      // memory 不可用时静默降级
    }
  }

  // ── 动作路由 ────────────────────────────────────
  async _routeQuery(task, decision) {
    const cap = this.registry.get('capability.topicFilter.getAllTopics');
    if (!cap) return this._reply('INFO', { summary: '话题模块不可用。' });
    const r = await cap.execute({}, { task });
    const topics = r.topics || [];

    // T1-4: 统计已启用/已禁用/关键词总数
    let enabledCount = 0;
    let disabledCount = 0;
    let totalKeywords = 0;
    for (const tp of topics) {
      if (tp.enabled !== false) {
        enabledCount++;
      } else {
        disabledCount++;
      }
      // 关键词可能在 keywords.zh / keywords.en 或 keywords（数组）中
      const kw = tp.keywords;
      if (Array.isArray(kw)) {
        totalKeywords += kw.length;
      } else if (kw && typeof kw === 'object') {
        // { zh: [...], en: [...] } 格式
        for (const langKw of Object.values(kw)) {
          if (Array.isArray(langKw)) totalKeywords += langKw.length;
        }
      }
    }

    const summary = t(this.lang, 'querySummary', {
      total: topics.length,
      enabled: enabledCount,
      disabled: disabledCount,
      keywords: totalKeywords,
    });

    return this._reply('INFORMATION', {
      summary,
      data: {
        topics,
        enabledCount,
        disabledCount,
        totalKeywords,
      },
    });
  }

  // ── T1-2: 诊断排查闭环 ──────────────────────────
  async _routeDiagnose(task, decision, extras = {}) {
    // 尝试获取用户粘贴的文本
    const diagnoseText = extras.diagnoseText
      || task.entities?.diagnoseText
      || this._extractDiagnoseText(task.userInput);

    // 没有文本时，提示用户粘贴
    if (!diagnoseText) {
      task.status = 'waiting_input'; // ★ P2-b: 标记等待输入，后续输入优先作为槽位
      return this._reply('DIAGNOSE_REQUEST', {
        summary: t(this.lang, 'diagnoseRequest'),
        needInput: 'text',
      });
    }

    // 有文本，调用 detector 做逐层分析
    const detector = this.services.detector;
    if (!detector?.analyze) {
      return this._reply('DIAGNOSIS_RESULT', {
        summary: t(this.lang, 'diagnoseUnavailable'),
        verdict: null,
        layer: null,
        confidence: 0,
        matched: null,
        reason: '检测器不可用',
        suggestion: t(this.lang, 'diagnoseUnavailable'),
      });
    }

    try {
      const result = detector.analyze(diagnoseText, { platform: 'diagnose' });
      const verdict = result.verdict || 'safe';
      const layer = result.layer || 1;
      const confidence = result.confidence || 0;
      const matched = result.matched || null;
      const reason = result.reason || '';

      let suggestion = result.suggestion || '';
      if (!suggestion) {
        if (verdict === 'safe') {
          suggestion = '该文本未被过滤，因为未匹配到任何规则。建议添加相关关键词。';
        } else if (verdict === 'suspicious') {
          suggestion = '该文本部分命中规则，但置信度不足。可考虑增加关键词或降低阈值。';
        } else {
          suggestion = '该文本已被规则命中过滤。';
        }
      }

      const diagnosisResult = {
        summary: verdict === 'safe'
          ? `诊断结果：未命中过滤（安全）。${reason}`
          : verdict === 'suspicious'
            ? `诊断结果：部分命中（可疑），层级 ${layer}。${reason}`
            : `诊断结果：已命中过滤（有害），层级 ${layer}。${reason}`,
        verdict,
        layer,
        confidence,
        matched,
        reason,
        suggestion,
      };

      // 一键修复：如果诊断结果是 safe（应该被过滤但没被过滤），自动生成"添加关键词"的修复计划
      if (verdict === 'safe' && matched) {
        const fixKeywords = Array.isArray(matched) ? matched : [String(matched)];
        const topicId = task.entities?.topic || 'general';
        const fixPlan = [{
          id: 'step_add_keywords_fix',
          label: `添加关键词到话题「${topicId}」`,
          module: 'topicFilter',
          action: 'addKeywords',
          capability: 'capability.topicFilter.addKeywordsToTopic',
          args: {
            topicId,
            keywords: fixKeywords,
          },
          riskLevel: RISK_LEVEL.L1,
          rollbackable: true,
        }, {
          id: 'step_refresh_fix',
          label: '刷新过滤器',
          module: 'scanner',
          action: 'refresh',
          capability: 'capability.scanner.refresh',
          args: {},
          riskLevel: RISK_LEVEL.L0,
          rollbackable: false,
        }];

        task.entities._diagnosisFix = true;
        return this._presentPlan(task, fixPlan, {
          understanding: t(this.lang, 'diagnoseSafeFix', { keywords: fixKeywords.join('、') }),
          planSummary: `将匹配内容「${fixKeywords.join('、')}」添加为关键词并刷新过滤器。`,
        });
      }

      return this._reply('DIAGNOSIS_RESULT', diagnosisResult);
    } catch (e) {
      return this._reply('DIAGNOSIS_RESULT', {
        summary: `诊断出错：${e.message}`,
        verdict: null,
        layer: null,
        confidence: 0,
        matched: null,
        reason: e.message,
        suggestion: t(this.lang, 'diagnoseUnavailable'),
      });
    }
  }

  /**
   * 从用户输入中提取诊断文本（当用户直接粘贴内容而非通过 extras 传入时）
   */
  _extractDiagnoseText(userInput) {
    if (!userInput) return null;
    // P2-3: 降低阈值 — 一条评论/回复可能只有 10+ 字符
    if (this._activeTask?.action === AGENT_ACTION.DIAGNOSE && userInput.length > 10) {
      return userInput;
    }
    return null;
  }

  // ── T1-6: LEARN 路径补齐 ──────────────────────────
  async _routeLearn(task, decision, extras = {}) {
    const sampleText = extras.sampleText
      || task.entities?.sampleText
      || this._extractSampleText(task.userInput);

    // 没有样本时，提示用户粘贴
    if (!sampleText) {
      task.status = 'waiting_input'; // ★ P2-b: 标记等待输入，后续输入优先作为槽位
      return this._reply('LEARN_REQUEST', {
        summary: t(this.lang, 'learnNeedSample'),
        needInput: 'sampleText',
      });
    }

    const ruleLearner = this.services.ruleLearner;
    if (!ruleLearner?.learnFromSample) {
      return this._reply('LEARN_RESULT', {
        summary: t(this.lang, 'learnUnavailable'),
        rules: [],
      });
    }

    try {
      const learnedResult = ruleLearner.learnFromSample(sampleText, {
        verdict: task.entities?.verdict || 'toxic',
        topicId: task.entities?.topic,
      });

      const rules = learnedResult?.rules || learnedResult?.keywords || [];
      const topicLabel = task.entities?.topic || '自动学习';

      // 生成确认计划：用户确认后写入规则
      if (rules.length > 0) {
        const topicId = task.entities?.topic || `learned_${Date.now()}`;
        const plan = [{
          id: 'step_learn_add_keywords',
          label: `将学到的关键词添加到话题「${topicLabel}」`,
          module: 'topicFilter',
          action: 'addKeywords',
          capability: 'capability.topicFilter.addKeywordsToTopic',
          args: {
            topicId,
            keywords: Array.isArray(rules) ? rules : [rules],
          },
          riskLevel: RISK_LEVEL.L1,
          rollbackable: true,
        }, {
          id: 'step_learn_refresh',
          label: '刷新过滤器',
          module: 'scanner',
          action: 'refresh',
          capability: 'capability.scanner.refresh',
          args: {},
          riskLevel: RISK_LEVEL.L0,
          rollbackable: false,
        }];

        return this._presentPlan(task, plan, {
          understanding: `从样本中学习到 ${Array.isArray(rules) ? rules.length : 1} 条规则`,
          planSummary: `将学到的关键词「${Array.isArray(rules) ? rules.join('、') : rules}」写入话题并刷新过滤器。`,
        });
      }

      return this._reply('LEARN_RESULT', {
        summary: '未能从样本中提取到有效规则，请提供更具代表性的内容。',
        rules: [],
      });
    } catch (e) {
      return this._reply('LEARN_RESULT', {
        summary: `学习出错：${e.message}`,
        rules: [],
      });
    }
  }

  /**
   * 从用户输入中提取学习样本文本
   */
  _extractSampleText(userInput) {
    if (!userInput) return null;
    // P2-3: 降低阈值 — 样本可以是一句短句/评论
    if (this._activeTask?.action === AGENT_ACTION.LEARN && userInput.length > 8) {
      return userInput;
    }
    return null;
  }

  /**
   * 解析话题名称到话题 ID
   */
  _resolveTopicId(topicName) {
    if (!topicName) return null;
    try {
      const tf = this.services.topicFilter;
      if (!tf?.getAllTopics) return null;
      const topics = tf.getAllTopics();
      // 精确匹配 label 或 id
      const exact = topics.find(tp =>
        tp.id === topicName ||
        tp.label === topicName ||
        tp.name?.zh === topicName ||
        tp.name?.en === topicName
      );
      if (exact) return exact.id;
      // 模糊匹配
      const fuzzy = topics.find(tp => {
        const label = tp.label || tp.name?.zh || '';
        return label.includes(topicName) || topicName.includes(label);
      });
      return fuzzy?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * 从用户输入中检测修改动作类型
   */
  _detectModifyAction(userInput) {
    if (!userInput) return null;
    for (const [action, pattern] of Object.entries(MODIFY_ACTION_PATTERNS)) {
      if (pattern.test(userInput)) return action;
    }
    return null;
  }

  _routeRollback(task, decision) {
    const op = this.rollbackMgr?.latestRollbackable?.();
    if (!op) {
      return this._reply('INFO', { summary: t(this.lang, 'noRollback') });
    }
    const plan = [{
      id: 'step_undo',
      label: `撤销「${op.type || '最近操作'}」`,
      module: 'rollback',
      action: 'restore',
      capability: null,
      args: { opId: op.opId },
      riskLevel: RISK_LEVEL.L3,
      rollbackable: false,
    }];
    return this._presentPlan(task, plan, {
      understanding: `回滚到上次操作之前的状态`,
      planSummary: `恢复「${op.type || '操作'}」的修改前状态。`,
    });
  }

  _buildQuestions(task, decision) {
    return buildQuestions(task, decision);
  }

  _listCapabilities() {
    return listCapabilities({ lang: this.lang, reply: this._reply.bind(this), t });
  }

  _presentPlan(task, plan, opts = {}) {
    task.plan = plan;
    const maxRisk = aggregateRisk(plan);
    const needConfirm = requiresConfirmation(maxRisk, this.mode);

    // auto 模式 + 低风险 → 跳过确认直接执行
    if (!needConfirm) {
      return this._executePlan(task);
    }

    task.status = 'waiting_confirmation';
    this._emit({ type: 'plan_ready', task, plan });
    return this._reply('PLAN', {
      understanding: t(this.lang, 'planUnderstanding', { userInput: task.userInput, understanding: opts.understanding || '' }),
      planSummary: t(this.lang, 'planSummary', { summary: opts.planSummary || '' }),
      plan,
      requiresConfirmation: needConfirm,
      riskLevel: maxRisk,
      canUndo: plan.some(s => s.rollbackable),
    });
  }

  /**
   * ★ 处理 LLM 的 proposeCreate 工具调用
   * LLM 主动提议创建话题 → 构建 confirm_create 卡片 + waiting_confirmation 任务
   * 这是"确认链路"的正确入口：触发判断由 LLM 语义决定，不是后端正则猜
   */
  _handleProposeCreate(args, llmText, userInput, extras) {
    const topicLabel = args.topicLabel;
    const keywords = args.keywords || [topicLabel];
    const scopes = args.scopes || ['comment', 'reply', 'dynamic'];
    const sensitivity = args.sensitivity || 'high';
    const mode = sensitivity === 'high' ? 'semantic' : 'keyword';

    // ★ 无条件新建任务，不复用旧任务
    // 丢弃任何旧的 waiting_confirmation 任务，用当前提议建全新 task + 全新 plan
    // "确认"永远执行最近一次提议的快照，不会出现"卡片是火影、plan 是王者荣耀"
    if (this._activeTask && this._activeTask.status === 'waiting_confirmation') {
      this._activeTask.status = 'superseded';
    }
    this._activeTask = null;
    this._lastCompletedTask = null;

    // ★ LLM 路径：使用空 decision，不注入正则信号，确保 LLM 的独立决策不被干扰
    const task = this._ensureActiveTask(userInput, {
      domain: AGENT_DOMAIN.IN_SCOPE,
      action: AGENT_ACTION.CREATE,
      confidence: 0.9,
      entities: {},
    }, extras);
    task.entities = { ...task.entities, topic: topicLabel, keywords, scope: scopes };
    task.status = 'waiting_confirmation';
    task.plan = [{
      id: 'step_create_topic',
      label: `创建话题「${topicLabel}」`,
      module: 'topicFilter',
      action: mode === 'semantic' ? 'createSemanticTopic' : 'createUserTopic',
      capability: mode === 'semantic' ? 'capability.topicFilter.createSemanticTopic' : 'capability.topicFilter.createUserTopic',
      args: mode === 'semantic'
        ? { topicLabel, scopes, seedKeywords: keywords }
        : { topicId: `user_${Date.now()}`, topicLabel, keywords, scopes, sensitivity },
      riskLevel: RISK_LEVEL.L2,
      rollbackable: true,
    }, {
      id: 'step_refresh',
      label: '刷新过滤器',
      module: 'scanner',
      action: 'refresh',
      capability: 'capability.scanner.refresh',
      args: {},
      riskLevel: RISK_LEVEL.L0,
      rollbackable: false,
    }];

    // 用 LLM 的文本回复作为卡片的 message
    // 如果 LLM 没有给出详细描述，生成一个包含关键配置的摘要
    const scopeLabels = { comment: '评论', reply: '回复', dynamic: '动态', video: '视频', danmaku: '弹幕' };
    const scopeText = scopes.map(s => scopeLabels[s] || s).join('、');
    const sensitivityLabels = { high: '高', medium: '中', low: '低' };
    const sensitivityText = sensitivityLabels[sensitivity] || sensitivity;
    const modeText = mode === 'semantic' ? '语义模式' : '关键词模式';
    const defaultMsg = `我为您准备了「${topicLabel}」的过滤配置：\n关键词：${keywords.join('、')}\n范围：${scopeText}\n敏感度：${sensitivityText}（${modeText}）\n确认后将立即创建并启用。`;
    const message = llmText || defaultMsg;

    return this._reply('CONVERSATION', {
      summary: message,
      source: 'llm',
      interaction: {
        kind: 'confirm_create',
        message,
        config: { topicLabel, keywords, scopes, sensitivity, mode },
        requiresConfirmation: true,
      },
    });
  }

  /**
   * ★ 处理 LLM 的 cancelProposal 工具调用
   * LLM 理解用户想放弃当前提议 → 真正清空后端状态
   * 和 proposeCreate 对称：提议是工具、取消也是工具，后端状态只由工具调用驱动
   */
  _handleCancelProposal(args, llmText) {
    const topicLabel = this._activeTask?.entities?.topic || this._activeTask?.plan?.[0]?.args?.topicLabel || '';
    // 真正清空后端状态
    if (this._activeTask) {
      this._activeTask.status = 'cancelled';
    }
    this._activeTask = null;
    this._lastCompletedTask = null;

    const message = llmText || (topicLabel ? `已取消「${topicLabel}」的配置提议。` : '已取消当前任务。');
    return this._reply('CANCELLED', { summary: message });
  }

  /**
   * ★ 处理 LLM 的 proposeAction 工具调用
   * LLM 提议删除/禁用/启用话题 → 构建 confirm_action 卡片 + waiting_confirmation 任务
   * 和 proposeCreate 对称：所有需要确认的操作共用一套 waiting_confirmation 机制
   */
  _handleProposeAction(args, llmText, userInput, extras) {
    const actionType = args.actionType; // delete | disable | enable
    const topicId = args.topicId;
    const topicLabel = args.topicLabel || topicId || '';

    if (!actionType || !['delete', 'disable', 'enable'].includes(actionType)) {
      return this._reply('CONVERSATION', { summary: llmText || '未识别的操作类型。', source: 'llm' });
    }

    // ★ 无条件新建任务，不复用旧任务（和 proposeCreate 一致）
    if (this._activeTask && this._activeTask.status === 'waiting_confirmation') {
      this._activeTask.status = 'superseded';
    }
    this._activeTask = null;
    this._lastCompletedTask = null;

    // ★ LLM 路径：使用空 decision，不注入正则信号
    const task = this._ensureActiveTask(userInput, {
      domain: AGENT_DOMAIN.IN_SCOPE,
      action: AGENT_ACTION.MODIFY,
      confidence: 0.9,
      entities: {},
    }, extras);
    task.entities = { ...task.entities, topic: topicLabel, topicId };

    // 根据 actionType 构建不同的 plan
    let plan;
    let config;
    const actionLabels = { delete: '删除', disable: '禁用', enable: '启用' };
    const riskLevels = { delete: RISK_LEVEL.L3, disable: RISK_LEVEL.L1, enable: RISK_LEVEL.L1 };

    if (actionType === 'delete') {
      plan = [{
        id: 'step_delete_topic',
        label: `删除话题「${topicLabel}」`,
        module: 'topicFilter',
        action: 'removeTopic',
        capability: 'capability.topicFilter.removeTopic',
        args: { topicId },
        riskLevel: RISK_LEVEL.L3,
        rollbackable: true,
      }, {
        id: 'step_refresh',
        label: '刷新过滤器',
        module: 'scanner',
        action: 'refresh',
        capability: 'capability.scanner.refresh',
        args: {},
        riskLevel: RISK_LEVEL.L0,
        rollbackable: false,
      }];
      config = { actionType, topicId, topicLabel, riskLevel: 'L3' };
    } else if (actionType === 'disable') {
      plan = [{
        id: 'step_disable_topic',
        label: `禁用话题「${topicLabel}」`,
        module: 'topicFilter',
        action: 'toggle',
        capability: 'capability.topicFilter.toggleTopic',
        args: { topicId, enabled: false },
        riskLevel: RISK_LEVEL.L1,
        rollbackable: true,
      }, {
        id: 'step_refresh',
        label: '刷新过滤器',
        module: 'scanner',
        action: 'refresh',
        capability: 'capability.scanner.refresh',
        args: {},
        riskLevel: RISK_LEVEL.L0,
        rollbackable: false,
      }];
      config = { actionType, topicId, topicLabel, enabled: false, riskLevel: 'L1' };
    } else { // enable
      plan = [{
        id: 'step_enable_topic',
        label: `启用话题「${topicLabel}」`,
        module: 'topicFilter',
        action: 'toggle',
        capability: 'capability.topicFilter.toggleTopic',
        args: { topicId, enabled: true },
        riskLevel: RISK_LEVEL.L1,
        rollbackable: true,
      }, {
        id: 'step_refresh',
        label: '刷新过滤器',
        module: 'scanner',
        action: 'refresh',
        capability: 'capability.scanner.refresh',
        args: {},
        riskLevel: RISK_LEVEL.L0,
        rollbackable: false,
      }];
      config = { actionType, topicId, topicLabel, enabled: true, riskLevel: 'L1' };
    }

    task.plan = plan;
    task.status = 'waiting_confirmation';

    const actionLabel = actionLabels[actionType];
    const message = llmText || `确认${actionLabel}话题「${topicLabel}」？`;

    return this._reply('CONVERSATION', {
      summary: message,
      source: 'llm',
      interaction: {
        kind: 'confirm_action',
        message,
        config,
        requiresConfirmation: true,
      },
    });
  }

  /**
   * ★ 处理 LLM 的 proposeHotTopic 工具调用
   * LLM 主动提议创建热点规则（带 TTL）→ 构建 confirm_hot_topic 卡片 + waiting_confirmation 任务
   * 与 proposeCreate 对称，但创建的是时效性规则，到期自动失效
   */
  _handleProposeHotTopic(args, llmText, userInput, extras) {
    const label = args.label;
    const keywords = args.keywords || [];
    const triggerMode = args.triggerMode || 'combination';
    // ★ combination 模式必须有 combinationRule，默认 all（所有关键词同时命中）
    const combinationRule = args.combinationRule || (triggerMode === 'combination' ? { all: keywords } : null);
    const scopes = args.scopes || ['comment', 'reply'];
    const ttlDays = args.ttlDays || 7;

    if (!label || keywords.length === 0) {
      return this._reply('CONVERSATION', {
        summary: llmText || '热点规则创建失败：缺少名称或关键词。',
        source: 'llm',
      });
    }

    // ★ 无条件新建任务，不复用旧任务（和 proposeCreate 一致）
    if (this._activeTask && this._activeTask.status === 'waiting_confirmation') {
      this._activeTask.status = 'superseded';
    }
    this._activeTask = null;
    this._lastCompletedTask = null;

    // ★ LLM 路径：使用空 decision，不注入正则信号
    const task = this._ensureActiveTask(userInput, {
      domain: AGENT_DOMAIN.IN_SCOPE,
      action: AGENT_ACTION.CREATE,
      confidence: 0.9,
      entities: {},
    }, extras);
    task.entities = { ...task.entities, topic: label, keywords, scope: scopes, isHotTopic: true };
    task.status = 'waiting_confirmation';
    task.plan = [{
      id: 'step_create_hot_topic',
      label: `创建热点规则「${label}」`,
      module: 'hotTopic',
      action: 'create',
      capability: 'capability.hotTopic.create',
      args: {
        label,
        keywords,
        triggerMode,
        combinationRule,
        scopes,
        ttlDays,
        source: 'ai',
      },
      riskLevel: RISK_LEVEL.L2,
      rollbackable: true,
    }, {
      id: 'step_refresh',
      label: '刷新过滤器',
      module: 'scanner',
      action: 'refresh',
      capability: 'capability.scanner.refresh',
      args: {},
      riskLevel: RISK_LEVEL.L0,
      rollbackable: false,
    }];

    // 构建用户友好的确认消息
    const scopeLabels = { comment: '评论', reply: '回复', dynamic: '动态', video: '视频', danmaku: '弹幕' };
    const scopeText = scopes.map(s => scopeLabels[s] || s).join('、');
    const triggerModeLabels = {
      any: '任一关键词命中',
      all: '所有关键词同时命中',
      combination: '组合触发',
    };
    const triggerModeText = triggerModeLabels[triggerMode] || triggerMode;
    let combinationText = '';
    if (triggerMode === 'combination' && combinationRule) {
      const allPart = combinationRule.all?.length ? `必须同时出现：${combinationRule.all.join('、')}` : '';
      const anyPart = combinationRule.any?.length ? `至少出现一个：${combinationRule.any.join('、')}` : '';
      combinationText = [allPart, anyPart].filter(Boolean).join('；');
    }
    const defaultMsg = `🔥 热点规则「${label}」配置：\n关键词：${keywords.join('、')}\n触发模式：${triggerModeText}${combinationText ? `\n组合规则：${combinationText}` : ''}\n范围：${scopeText}\n有效期：${ttlDays} 天（到期自动失效）\n确认后将立即创建并启用。`;
    const message = llmText || defaultMsg;

    return this._reply('CONVERSATION', {
      summary: message,
      source: 'llm',
      interaction: {
        kind: 'confirm_hot_topic',
        message,
        config: { label, keywords, triggerMode, combinationRule, scopes, ttlDays, mode: 'hot_topic' },
        requiresConfirmation: true,
      },
    });
  }

  // ── 自定义屏蔽词处理 ──────────────────────────────

  /**
   * ★ 处理 LLM 的 addCustomKeyword 工具调用
   * 添加自定义屏蔽词（精确匹配单个词），L1 低风险，直接执行无需确认
   */
  async _handleAddCustomKeyword(args, llmText, userInput, extras) {
    const raw = Array.isArray(args.keywords) ? args.keywords : (args.keyword ? [args.keyword] : []);
    const words = raw.map(s => (s || '').trim()).filter(Boolean);
    if (!words.length) {
      return this._reply('CONVERSATION', {
        summary: llmText || '屏蔽词不能为空，请告诉我要屏蔽哪个词。',
        source: 'llm',
      });
    }

    const cap = this.registry.get('capability.customKeyword.add');
    if (!cap) {
      return this._reply('ERROR', {
        summary: '屏蔽词功能暂不可用。',
        detail: 'capability.customKeyword.add 未注册',
      });
    }

    const result = await cap.execute({ ...args, keywords: words });
    if (result.success) {
      if (this.rollbackMgr && Array.isArray(result.added) && result.added.length) {
        const addedWords = [...result.added];
        const opId = this.rollbackMgr.begin({
          taskId: this._activeTask?.id || 'direct',
          type: 'customKeyword.add',
          title: addedWords.length > 1
            ? `屏蔽词批量 ×${addedWords.length}`
            : `屏蔽词「${addedWords[0]}」`,
          beforeState: null,
          restoreFn: async () => {
            const list = this.services.config?.customKeywords || [];
            const removed = [];
            for (const w of addedWords) {
              const idx = list.findIndex(k => (k.keyword || '').toLowerCase() === w.toLowerCase());
              if (idx >= 0) { list.splice(idx, 1); removed.push(w); }
            }
            if (removed.length) {
              try { await this.services.config?.save?.(); } catch {}
              try { this.services.detector?.reloadCustomKeywords?.(); } catch {}
            }
          },
        });
        this.rollbackMgr.commit(opId, { keywords: addedWords });
      }

      const skipped = result.skipped || [];
      const msg = buildAddKwSummary(words, result.added || [], skipped);
      try { this._emit({ type: AGENT_EVENTS.STATUS, payload: { status: 'executed', detail: msg } }); } catch {}

      return this._reply('CONVERSATION', {
        summary: llmText && !llmText.startsWith('{') ? llmText : msg,
        source: 'llm',
        interaction: {
          kind: 'keyword_added',
          keywords: words,
          added: result.added || [],
          skipped,
        },
      });
    } else {
      return this._reply('CONVERSATION', {
        summary: llmText || `添加屏蔽词失败：${result.reason}`,
        source: 'llm',
      });
    }
  }

  // ── Adaptive-Card Agent: 引导卡片处理 ──────────────────────────────

  /**
   * ★ 处理 LLM 的 guideUser 工具调用
   * LLM 主动引导用户 → 根据卡片类型构建对应交互卡片
   */
  _handleGuideUser(args, llmText, userInput, extras) {
    const cardKind = args.cardKind;

    // ★ 无条件新建任务，不复用旧任务
    if (this._activeTask && this._activeTask.status === 'waiting_confirmation') {
      this._activeTask.status = 'superseded';
    }
    this._activeTask = null;
    this._lastCompletedTask = null;

    if (cardKind === 'understand_confirm') {
      return this._handleUnderstandConfirm(args, llmText, userInput, extras);
    }
    if (cardKind === 'config_guide') {
      return this._handleConfigGuide(args, llmText, userInput, extras);
    }
    if (cardKind === 'compound_plan') {
      return this._handleCompoundPlan(args, llmText, userInput, extras);
    }

    return this._reply('CONVERSATION', { summary: llmText || '未识别的卡片类型。', source: 'llm' });
  }

  /**
   * 处理理解确认卡片
   */
  _handleUnderstandConfirm(args, llmText, userInput, extras) {
    // ★ LLM 路径：使用空 decision，不注入正则信号
    const task = this._ensureActiveTask(userInput, {
      domain: AGENT_DOMAIN.IN_SCOPE,
      action: AGENT_ACTION.CREATE,
      confidence: 0.9,
      entities: {},
    }, extras);
    task.status = 'confirming_understanding';
    task.entities = { ...task.entities, topic: args.topicLabel };

    const message = llmText || args.understanding || '我理解你想配置内容过滤，对吗？';
    return this._reply('CONVERSATION', {
      summary: message,
      source: 'llm',
      interaction: {
        kind: 'guide_understand',
        message,
        understanding: args.understanding || '',
        topicLabel: args.topicLabel || '',
        requiresConfirmation: true,
      },
    });
  }

  /**
   * 处理配置引导卡片
   */
  _handleConfigGuide(args, llmText, userInput, extras) {
    const topicLabel = args.topicLabel || '';
    const keywords = args.suggestedKeywords || [topicLabel];
    const scopes = args.suggestedScopes || ['comment', 'reply', 'dynamic'];
    const sensitivity = args.suggestedSensitivity || 'medium';
    const mode = args.suggestedMode || 'keyword';
    const category = args.suggestedCategory || 'toxic_community';

    // ★ LLM 路径：使用空 decision，不注入正则信号
    const task = this._ensureActiveTask(userInput, {
      domain: AGENT_DOMAIN.IN_SCOPE,
      action: AGENT_ACTION.CREATE,
      confidence: 0.9,
      entities: {},
    }, extras);
    task.entities = { ...task.entities, topic: topicLabel, keywords, scope: scopes };
    task.status = 'guiding';
    task.plan = [{
      id: 'step_create_topic',
      label: `创建话题「${topicLabel}」`,
      module: 'topicFilter',
      action: mode === 'semantic' ? 'createSemanticTopic' : 'createUserTopic',
      capability: mode === 'semantic' ? 'capability.topicFilter.createSemanticTopic' : 'capability.topicFilter.createUserTopic',
      args: mode === 'semantic'
        ? { topicLabel, scopes, seedKeywords: keywords }
        : { topicId: `user_${Date.now()}`, topicLabel, keywords, scopes, sensitivity },
      riskLevel: RISK_LEVEL.L2,
      rollbackable: true,
    }, {
      id: 'step_refresh',
      label: '刷新过滤器',
      module: 'scanner',
      action: 'refresh',
      capability: 'capability.scanner.refresh',
      args: {},
      riskLevel: RISK_LEVEL.L0,
      rollbackable: false,
    }];

    const scopeLabels = { comment: '评论', reply: '回复', dynamic: '动态', feed: '首页推荐', timeline: '时间线' };
    const scopeText = scopes.map(s => scopeLabels[s] || s).join('、');
    const sensitivityLabels = { high: '高', medium: '中', low: '低' };
    const sensitivityText = sensitivityLabels[sensitivity] || sensitivity;
    const modeText = mode === 'semantic' ? '语义模式' : '关键词模式';
    const categoryLabels = {
      harassment: '骚扰', personal_attack: '人身攻击', game_toxic: '游戏毒性',
      spoiler: '剧透', discrimination: '歧视', political_extreme: '政治极端',
      toxic_community: '有毒社区', custom: '自定义',
    };
    const categoryText = categoryLabels[category] || category;

    const defaultMsg = `📋 配置「${topicLabel}」过滤：\n分类：${categoryText}\n关键词：${keywords.join('、')}\n范围：${scopeText}\n敏感度：${sensitivityText}（${modeText}）\n\n确认后将立即创建并启用。`;
    const message = llmText || defaultMsg;

    return this._reply('CONVERSATION', {
      summary: message,
      source: 'llm',
      interaction: {
        kind: 'guide_config',
        message,
        config: { topicLabel, keywords, scopes, sensitivity, mode, category },
        fields: args.fields || [],
        requiresConfirmation: true,
      },
    });
  }

  /**
   * 处理复合计划卡片
   */
  _handleCompoundPlan(args, llmText, userInput, extras) {
    const steps = args.steps || [];

    // ★ LLM 路径：使用空 decision，不注入正则信号
    const task = this._ensureActiveTask(userInput, {
      domain: AGENT_DOMAIN.IN_SCOPE,
      action: AGENT_ACTION.MODIFY,
      confidence: 0.9,
      entities: {},
    }, extras);
    task.status = 'guiding';

    const plan = [];
    for (const step of steps) {
      if (step.action === 'rollback') {
        plan.push({
          id: `step_rollback_${step.topicLabel || plan.length}`,
          label: `撤销「${step.topicLabel || '最近操作'}」`,
          module: 'rollback',
          action: 'restore',
          capability: null,
          args: { opId: step.topicLabel },
          riskLevel: RISK_LEVEL.L3,
          rollbackable: false,
        });
      } else if (step.action === 'create') {
        const cfg = step.config || {};
        plan.push({
          id: `step_create_${step.topicLabel || plan.length}`,
          label: `创建话题「${step.topicLabel}」`,
          module: 'topicFilter',
          action: cfg.mode === 'semantic' ? 'createSemanticTopic' : 'createUserTopic',
          capability: cfg.mode === 'semantic' ? 'capability.topicFilter.createSemanticTopic' : 'capability.topicFilter.createUserTopic',
          args: cfg.mode === 'semantic'
            ? { topicLabel: step.topicLabel, scopes: cfg.scopes || ['comment', 'reply', 'dynamic'], seedKeywords: cfg.keywords || [step.topicLabel] }
            : { topicId: `user_${Date.now()}_${plan.length}`, topicLabel: step.topicLabel, keywords: cfg.keywords || [step.topicLabel], scopes: cfg.scopes || ['comment', 'reply', 'dynamic'], sensitivity: cfg.sensitivity || 'medium' },
          riskLevel: RISK_LEVEL.L2,
          rollbackable: true,
        });
      } else if (step.action === 'delete') {
        plan.push({
          id: `step_delete_${step.topicLabel || plan.length}`,
          label: `删除话题「${step.topicLabel}」`,
          module: 'topicFilter',
          action: 'removeTopic',
          capability: 'capability.topicFilter.removeTopic',
          args: { topicId: step.config?.topicId || step.topicLabel },
          riskLevel: RISK_LEVEL.L3,
          rollbackable: true,
        });
      } else if (step.action === 'disable' || step.action === 'enable') {
        plan.push({
          id: `step_${step.action}_${step.topicLabel || plan.length}`,
          label: `${step.action === 'disable' ? '禁用' : '启用'}话题「${step.topicLabel}」`,
          module: 'topicFilter',
          action: 'toggle',
          capability: 'capability.topicFilter.toggleTopic',
          args: { topicId: step.config?.topicId || step.topicLabel, enabled: step.action === 'enable' },
          riskLevel: RISK_LEVEL.L1,
          rollbackable: true,
        });
      }
    }
    plan.push({
      id: 'step_refresh_compound',
      label: '刷新过滤器',
      module: 'scanner',
      action: 'refresh',
      capability: 'capability.scanner.refresh',
      args: {},
      riskLevel: RISK_LEVEL.L0,
      rollbackable: false,
    });

    task.plan = plan;

    const message = llmText || args.guidanceMessage || `📋 操作计划（${steps.length} 步）`;
    return this._reply('CONVERSATION', {
      summary: message,
      source: 'llm',
      interaction: {
        kind: 'guide_compound',
        message,
        steps: steps.map((s, i) => ({
          index: i + 1,
          action: s.action,
          topicLabel: s.topicLabel,
          config: s.config,
        })),
        requiresConfirmation: true,
      },
    });
  }

  // ── T1-3: 增强的 _executePlan（规则写入后即时反馈）──────
  async _executePlan(task) {
    task.status = 'executing';
    const results = [];
    for (const step of task.plan) {
      try {
        if (!step.capability) {
          // 内部步骤（如 rollback）不通过 registry
          if (step.action === 'restore' && this.rollbackMgr?.restore) {
            await this.rollbackMgr.restore(step.args.opId);
          }
          results.push({ stepId: step.id, success: true, skipped: true });
          continue;
        }
        const cap = this.registry.get(step.capability);
        if (!cap) throw new Error(`能力不存在：${step.capability}`);
        const r = await cap.execute(step.args, { task });
        const success = r.success !== false;
        results.push({ stepId: step.id, success, data: r });
        if (!success) throw new Error(r.reason || `${step.label} 失败`);

        // ★ 注册 rollback 回滚点——让"我反悔了"能撤销
        if (step.rollbackable && this.rollbackMgr) {
          const stepAction = step.action;
          const stepArgs = step.args;
          let restoreFn = null;

          if (stepAction === 'createUserTopic' && r.topicId) {
            // 创建 → 回滚=删除
            const createdId = r.topicId;
            restoreFn = async () => {
              this.services.topicFilter?.removeUserTopic?.(createdId);
            };
          } else if (stepAction === 'create' && step.module === 'hotTopic' && r.topicId) {
            // 热点规则创建 → 回滚=删除热点规则
            const createdId = r.topicId;
            restoreFn = async () => {
              this.services.hotTopicManager?.delete?.(createdId);
            };
          } else if (stepAction === 'removeTopic' && r.removed) {
            // 删除 → 回滚=用快照重建
            const snapshot = r.removed;
            restoreFn = async () => {
              this.services.topicFilter?.addUserTopic?.(snapshot);
            };
          } else if (stepAction === 'addCustomKeyword' && (r.keyword || r.keywords)) {
            const kwList = r.keywords || (r.keyword ? [r.keyword] : []);
            restoreFn = async () => {
              const list = this.services.config?.customKeywords || [];
              const removed = [];
              for (const w of kwList) {
                const idx = list.findIndex(k => (k.keyword || '').toLowerCase() === String(w).toLowerCase());
                if (idx >= 0) { list.splice(idx, 1); removed.push(w); }
              }
              if (removed.length) {
                try { await this.services.config?.save?.(); } catch {}
                try { this.services.detector?.reloadCustomKeywords?.(); } catch {}
              }
            };
          } else if (stepAction === 'toggle') {
            // 禁用/启用 → 回滚=反向 toggle
            const toggledId = stepArgs.topicId;
            const wasEnabled = stepArgs.enabled;
            restoreFn = async () => {
              this.services.topicFilter?.toggleTopic?.(toggledId, !wasEnabled);
            };
          }

          if (restoreFn) {
            const kwList = r.keywords || (r.keyword ? [r.keyword] : []);
            const topicLabel = task.entities?.topic || stepArgs?.topicLabel || stepArgs?.label || stepArgs?.keyword || '';
            const type = step.module + '.' + stepAction;
            const typeTitleMap = {
              'topicFilter.createUserTopic': `话题「${topicLabel}」`,
              'hotTopic.create': `热点「${topicLabel}」`,
              'topicFilter.removeTopic': `删除话题「${topicLabel}」`,
              'topicFilter.toggle': (stepArgs?.enabled ? '启用' : '禁用') + `「${topicLabel}」`,
              'customKeyword.addCustomKeyword': kwList.length > 1
                ? `屏蔽词批量 ×${kwList.length}`
                : `屏蔽词「${kwList[0] || topicLabel}」`,
              'topicFilter.addKeywordsToTopic': `话题追加关键词「${topicLabel}」`,
              'topicFilter.removeKeywordFromTopic': `话题移除关键词「${topicLabel}」`,
              'hotTopic.update': `热点更新「${topicLabel}」`,
              'hotTopic.delete': `删除热点「${topicLabel}」`,
              'hotTopic.renew': `热点续期「${topicLabel}」`,
            };
            const opId = this.rollbackMgr.begin({
              taskId: task.id,
              type,
              title: typeTitleMap[type] || type + (topicLabel ? `「${topicLabel}」` : ''),
              beforeState: null,
              restoreFn,
            });
            this.rollbackMgr.commit(opId, { topicLabel });
          }
        }
      } catch (e) {
        results.push({ stepId: step.id, success: false, error: e.message });
        task.status = 'failed';
        task.error = e.message;
        this._emit({ type: 'task_failed', task, error: e, results });
        this.auditLog?.log?.({ type: 'execution_failed', payload: { taskId: task.id, msg: e.message, results } });
        return this._reply('FAILED', {
          summary: t(this.lang, 'failed', { msg: e.message }),
          results,
        });
      }
    }
    task.status = 'done';
    task.result = { results };
    this._lastCompletedTask = task; // P3-1: 记录最近完成的任务
    this._emit({ type: 'task_done', task, results });
    this.auditLog?.log?.({ type: 'execution_done', payload: { taskId: task.id, results } });

    // T1-3: 规则写入后即时反馈
    let refreshResult = { refreshed: false, newBlocked: null };
    try {
      // 触发页面重扫
      if (typeof this.services.scanner?.refresh === 'function') {
        this.services.scanner.refresh();
        refreshResult.refreshed = true;
      }
      // 尝试获取新增屏蔽数量
      if (typeof this.services.scanner?.getNewBlockedCount === 'function') {
        refreshResult.newBlocked = this.services.scanner.getNewBlockedCount();
      } else if (typeof this.services.scanner?.getLastScanResult === 'function') {
        const scanResult = this.services.scanner.getLastScanResult();
        refreshResult.newBlocked = scanResult?.newBlocked ?? null;
      }
    } catch {
      // scanner 不可用时静默降级
    }

    // T2-4: 任务完成后写入记忆
    this._recordToMemory(task);

    const successCount = results.filter(r => r.success).length;
    const summaryKey = refreshResult.refreshed ? 'doneWithRefresh' : 'done';
    // ★ 在结果中显示话题名+操作类型+范围，让执行结果自证
    const topicLabel = task.entities?.topic || task.plan?.[0]?.args?.topicLabel || task.plan?.[0]?.args?.label || '';
    const topicSuffix = topicLabel ? `「${topicLabel}」` : '';
    const firstAction = task.plan?.[0]?.action;
    const firstModule = task.plan?.[0]?.module;
    const actionVerbs = {
      createUserTopic: '已创建话题',
      removeTopic: '已删除话题',
      toggle: task.plan?.[0]?.args?.enabled ? '已启用话题' : '已禁用话题',
      create: firstModule === 'hotTopic' ? '已创建热点规则' : '已创建',
    };
    const actionVerb = actionVerbs[firstAction] || '';
    const scopes = task.plan?.[0]?.args?.scopes || task.entities?.scope || [];
    const scopeLabels = { comment: '评论', reply: '回复', dynamic: '动态', video: '视频', danmaku: '弹幕' };
    const scopeText = scopes.map(s => scopeLabels[s] || s).join('、');
    const scopeSuffix = scopeText ? `（范围：${scopeText}）` : '';
    // 热点规则额外显示 TTL 信息
    const ttlDays = task.plan?.[0]?.args?.ttlDays;
    const ttlSuffix = (firstModule === 'hotTopic' && ttlDays) ? `（有效期 ${ttlDays} 天）` : '';
    return this._reply('DONE', {
      summary: topicSuffix && actionVerb
        ? `${actionVerb}${topicSuffix}${scopeSuffix}${ttlSuffix}（${t(this.lang, summaryKey, { success: successCount, total: task.plan.length })}）`
        : topicSuffix
          ? `已操作话题${topicSuffix}（${t(this.lang, summaryKey, { success: successCount, total: task.plan.length })}）`
          : t(this.lang, summaryKey, { success: successCount, total: task.plan.length }),
      results,
      canUndo: task.plan.some(s => s.rollbackable),
      refreshResult,
    });
  }

  _reply(type, data) {
    // ★ 保留已有的 data.interaction（如 confirm_create），不被 _toInteraction 覆盖
    // _toInteraction 只在 data 没有显式 interaction 时才生成
    const interaction = data.interaction || this._toInteraction(type, data);
    return { type, ...data, interaction };
  }

  /**
   * 归一化为统一交互结构，前端只认 interaction.kind
   */
  _toInteraction(type, data) {
    if (data.clarificationQuestions?.length) {
      return {
        kind: 'clarify',
        message: data.summary,
        fields: data.clarificationQuestions.map(q => ({
          id: q.id, label: q.text,
          input: q.options?.length ? 'choice' : 'text',
          options: q.options || [],
          hint: q.hint,
        })),
      };
    }
    if (data.plan?.length) {
      return {
        kind: 'confirm',
        message: data.planSummary || data.summary,
        steps: data.plan.map(s => ({ id: s.id, label: s.label, risk: s.riskLevel })),
        requiresConfirmation: !!data.requiresConfirmation,
      };
    }
    if (data.recommendations?.length) {
      return {
        kind: 'recommend',
        message: data.summary,
        options: data.recommendations,
      };
    }
    if (data.toolResults?.length) {
      return {
        kind: 'result',
        message: data.summary,
        steps: data.toolResults.map(r => ({ tool: r.tool, success: r.success, detail: r.result || r.error })),
      };
    }
    return { kind: 'message', message: data.summary || '' };
  }

  // ── P2-4: 复合请求拆分 ──────────────────────────
  /**
   * 按连接词拆分用户输入
   * @param {string} text
   * @returns {string[]} 拆分后的分段（至少 2 个才算复合）
   */
  _splitByConjunctions(text) {
    for (const conjRe of COMPOUND_CONJUNCTIONS) {
      // 每次用新的 RegExp 实例（因为 /g flag 会记忆 lastIndex）
      const re = new RegExp(conjRe.source, conjRe.flags);
      const parts = text.split(re).map(s => s.trim()).filter(s => s.length >= 2);
      if (parts.length >= 2) return parts;
    }
    return [text];
  }

  // ── T2-1: LLM 增强策略 ──────────────────────────
  /**
   * 当知识库未命中且动态生成器不够精准时，用 LLM 增强关键词生成
   * @param {object} task
   * @param {object} draft - 动态话题草稿
   * @returns {object|null} 增强后的草稿，或 null（LLM 不可用时）
   */
  _enhanceWithLLM(task, draft) {
    const aiAnalyzer = this.services.aiAnalyzer;
    if (!aiAnalyzer) return null;

    // Token 预算控制（Agent 聊天不设上限，此处仅做安全阀）
    if (this._llmCallCount >= 100) {
      this.auditLog?.log?.({ type: 'llm_budget_exceeded', payload: { taskId: task.id } });
      return null;
    }

    try {
      const topicLabel = draft.label || task.entities?.topic || '';
      const existingKeywords = draft.keywords || [];

      // 构造 prompt 让 LLM 生成关键词组
      const prompt = this._buildLLMPrompt(topicLabel, existingKeywords);

      // 调用 LLM（同步或异步，取决于 aiAnalyzer 接口）
      let llmResult = null;
      if (typeof aiAnalyzer.generateKeywords === 'function') {
        llmResult = aiAnalyzer.generateKeywords(prompt, { topic: topicLabel });
      } else if (typeof aiAnalyzer.analyze === 'function') {
        llmResult = aiAnalyzer.analyze(prompt, { type: 'keyword_generation', topic: topicLabel });
      } else if (typeof aiAnalyzer.complete === 'function') {
        llmResult = aiAnalyzer.complete(prompt);
      }

      this._llmCallCount++;

      if (!llmResult) return null;

      // 解析 LLM 返回的关键词
      const llmKeywords = this._parseLLMKeywords(llmResult);
      if (!llmKeywords.length) return null;

      // 合并 LLM 生成的关键词到草稿中
      const mergedKeywords = Array.from(new Set([...existingKeywords, ...llmKeywords]));
      this.auditLog?.log?.({
        type: 'llm_enhanced',
        payload: { taskId: task.id, topic: topicLabel, addedKeywords: llmKeywords },
      });

      return {
        ...draft,
        keywords: mergedKeywords,
        source: 'llm_enhanced',
      };
    } catch {
      // LLM 调用失败时保持现有启发式兜底
      return null;
    }
  }

  /**
   * 构造 LLM 关键词生成 prompt
   * 委托至 prompt-builder.js 的纯函数实现。
   */
  _buildLLMPrompt(topicLabel, existingKeywords) {
    return buildLLMPrompt(topicLabel, existingKeywords, this.lang);
  }

  /**
   * 解析 LLM 返回的关键词列表
   */
  _parseLLMKeywords(llmResult) {
    if (!llmResult) return [];
    // 如果直接返回数组
    if (Array.isArray(llmResult)) {
      return llmResult.map(k => String(k).trim().toLowerCase()).filter(k => k.length >= 2);
    }
    // 如果返回对象带 keywords 字段
    if (llmResult.keywords && Array.isArray(llmResult.keywords)) {
      return llmResult.keywords.map(k => String(k).trim().toLowerCase()).filter(k => k.length >= 2);
    }
    // 如果返回字符串，尝试解析
    const text = String(llmResult.text || llmResult.content || llmResult);
    return text
      .split(/[,，、\n\s]+/)
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length >= 2 && k.length <= 20);
  }

  // ── P1-2: LLM 意图重判断（正则置信度不够时的兜底）─────────
  /**
   * 用 LLM 重新判断意图和实体
   * @param {string} userInput
   * @param {object} regexDecision - classifyTask 的正则结果
   * @returns {Promise<object|null>} 修正后的 { action, confidence, entities } 或 null
   */
  async _llmReclassify(userInput, regexDecision) {
    const aiAnalyzer = this.services.aiAnalyzer;
    if (!aiAnalyzer || this._llmCallCount >= 100) return null;

    try {
      const prompt = [
        '你是一个内容过滤助手的意图识别模块。请分析用户的输入并返回 JSON：',
        `用户输入：「${userInput}」`,
        '正则初步判断：',
        `  动作：${regexDecision.action}（置信度 ${regexDecision.confidence}）`,
        `  话题：${regexDecision.entities?.topic || '未提取'}`,
        '',
        '请返回 JSON（不要 markdown 代码块）：',
        '{"action":"CREATE|MODIFY|QUERY|DIAGNOSE|NONE",',
        ' "topic":"提取的话题名或null",',
        ' "confidence":0.0-1.0,',
        ' "reasoning":"简短说明"}',
      ].join('\n');

      let result;
      if (typeof aiAnalyzer.analyze === 'function') {
        result = await aiAnalyzer.analyze(prompt, { type: 'intent_classification' });
      } else if (typeof aiAnalyzer.complete === 'function') {
        result = await aiAnalyzer.complete(prompt);
      }
      this._llmCallCount++;

      if (!result) return null;
      const parsed = typeof result === 'string' ? JSON.parse(result) : (result.parsed || result);

      return {
        action: parsed.action || regexDecision.action,
        confidence: parsed.confidence || 0.8,
        entities: {
          ...regexDecision.entities,
          topic: parsed.topic || regexDecision.entities?.topic,
        },
      };
    } catch {
      return null; // LLM 失败时静默降级到正则结果
    }
  }

  // ── P2-2（预埋）: 动态话题 label 质量校验 ─────────────
  /**
   * 判断动态提取的 label 是否可靠
   * @param {string} label
   * @param {string} userInput
   * @returns {boolean}
   */
  _isLabelQuality(label, userInput) {
    if (!label || label.length < 2) return false;
    const residueWords = ['不想', '不要', '屏蔽', '过滤', '帮我', '请', '想', '能', '可以', '的', '了', '吗', '呢'];
    for (const w of residueWords) {
      if (label.includes(w)) return false;
    }
    if (userInput && label.length / userInput.length < 0.15) return false;
    return true;
  }

  // ── T2-2: 规则学习闭环 ──────────────────────────
  /**
   * 合并已学到的规则到关键词列表
   * @param {object} task
   * @param {object} draft - 话题草稿（需有 id 或 label）
   * @param {string[]} keywords - 当前关键词列表
   * @returns {string[]} 合并后的关键词列表
   */
  _mergeLearnedKeywords(task, draft, keywords) {
    try {
      const ruleLearner = this.services.ruleLearner;
      if (!ruleLearner?.getLearnedRules) return keywords;

      const learnedRules = ruleLearner.getLearnedRules();
      if (!learnedRules || !learnedRules.length) return keywords;

      const topicLabel = draft?.label || task.entities?.topic || '';
      const topicId = draft?.id || '';

      // 筛选与当前话题相关的已学规则
      const relatedRules = learnedRules.filter(rule => {
        if (rule.topicId && topicId && rule.topicId === topicId) return true;
        if (rule.topic && topicLabel && (
          rule.topic === topicLabel ||
          rule.topic.includes(topicLabel) ||
          topicLabel.includes(rule.topic)
        )) return true;
        return false;
      });

      if (!relatedRules.length) return keywords;

      // 提取已学到的关键词
      const learnedKeywords = [];
      for (const rule of relatedRules) {
        if (Array.isArray(rule.keywords)) {
          learnedKeywords.push(...rule.keywords);
        } else if (rule.keyword) {
          learnedKeywords.push(rule.keyword);
        } else if (rule.trigger) {
          // trigger 是规则的关键词字段（rule-learner.js 的标准格式）
          learnedKeywords.push(rule.trigger);
        }
      }

      // 合并去重
      const merged = [...keywords, ...learnedKeywords.map(k => k.toLowerCase())];
      return Array.from(new Set(merged));
    } catch {
      return keywords;
    }
  }

  // ── _llmConverse / _buildConverseSystemPrompt / _parseLLMResponse 已被 _llmAgentLoop / _buildAgentSystemPrompt / _parseAgentResponse 替代
}

// ── 工具函数 ──────────────────────────────────────

function pickDraft(decision) {
  if (decision.matchedTopic) {
    const topic = decision.matchedTopic;
    // scopes：仅保留平台区域标识（过滤掉旧版 scope_all 等强度 ID）
    const platformScopes = (topic.scopes || [])
      .map(s => s.id)
      .filter(id => PLATFORM_SCOPES.has(id));
    return {
      id: topic.id,
      label: topic.name?.zh || topic.label,
      description: typeof topic.description === 'string'
        ? topic.description
        : (topic.description?.zh || ''),
      keywords: topic.keywords || [],
      scopes: platformScopes.length ? platformScopes : ['comment', 'reply', 'dynamic'],
      // v2: sensitivityLevels 独立传递，供 UI 推荐卡片使用
      sensitivityLevels: (topic.sensitivityLevels || []).map(s => ({
        id: s.id, label: s.label, reason: s.reason, sensitivity: s.sensitivity,
      })),
      defaultSensitivity: topic.sensitivityLevels?.[0]?.sensitivity || 'medium',
      source: 'knowledge',
    };
  }
  if (decision.dynamicDraft) {
    return decision.dynamicDraft;
  }
  return null;
}

function mergeEntities(a, b) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      out[k] = Array.from(new Set([...(out[k] || []), ...v]));
    } else if (typeof v === 'string') {
      out[k] = out[k] || v;
    } else {
      out[k] = v;
    }
  }
  return out;
}
