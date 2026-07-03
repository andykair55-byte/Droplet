/**
 * index.js — AgentEngine 引擎入口（BSA 重构版）
 *
 * BSA 三层架构的入口：
 *   Conversation（panel.js chat 区域）
 *      ↓
 *   engine.process(input)  ← 本文件
 *      ↓
 *   TaskOrchestrator  ← 业务编排层（task-orchestrator.js）
 *      ↓
 *   CapabilityRegistry → 业务模块（topicFilter / scanner / memory / ...）
 *
 * 本文件职责：
 *   1. 初始化子模块（knowledge、orchestrator、capability registry）
 *   2. 把 v1 chatbot 路径彻底移除 — 所有输入都走 orchestrator
 *   3. 暴露简洁的 AgentEngine API 给 panel.js
 *
 * 重要变更（vs 重构前）：
 *   - 不再有 stateMachine / ruleGenerator / memorySync 的回复路径
 *   - 保留这些模块的「能力」形式（被 orchestrator 通过 registry 调用）
 *   - process() 直接 await orchestrator.process(input)
 */

import { createKnowledgeManager } from './core/knowledge.js';
import { TaskOrchestrator } from './core/task-orchestrator.js';
import { CapabilityRegistry, createDefaultRegistry } from './core/capability-registry.js';
import { AGENT_MODE, RISK_LEVEL } from './core/types.js';
import { createMemorySync } from './core/memory-sync.js';
import { initUserProfile, getCurrentProfile, switchProfile, listProfiles } from './core/profiles.js';
import { AuditLog } from './core/audit-log.js';
import { RollbackManager } from './core/rollback.js';

// ─── 引擎配置默认值 ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  confidenceThreshold: 0.5,
  clarificationLimit: 2,
  maxContextTurns: 10,
  lang: 'zh',
};

// ─── 引擎工厂 ──────────────────────────────────────────────────────────────────

/**
 * 从用户提供的文本样本中提取候选模式（供 learnFromSample 适配层使用）
 * 简单分词：按标点和空格分割，取长度>=2 的片段
 */
function _extractPatternsFromSample(sampleText) {
  if (!sampleText) return [];
  return sampleText
    .split(/[，。！？\s,!?;；、""''()（）\[\]【】]+/)
    .map(s => s.trim())
    .filter(s => s.length >= 2 && s.length <= 20);
}

/**
 * 将 getAllRulesDetailed() 的返回值拍平为统一数组
 * 兼容两种格式：对象 { hardKeywords, softKeywords, regex, contextSensitive } 或数组
 */
function _flattenLearnedRules(all, topicId) {
  if (Array.isArray(all)) {
    // mock 或旧格式：直接返回数组
    return all.map(r => ({ ...r, topicId: r.topicId || topicId }));
  }
  // 真实格式：对象
  return [
    ...(all.hardKeywords || []),
    ...(all.softKeywords || []),
    ...(all.regex || []).map(r => ({ ...r, trigger: r.trigger || r.pattern })),
    ...(all.contextSensitive || []),
  ].map(r => ({ ...r, topicId: r.topicId || topicId }));
}

/**
 * 创建 AgentEngine 实例
 *
 * @param {object} options
 * @param {object} options.topicFilter  - TopicFilter 实例
 * @param {object} options.ruleLearner  - RuleLearner 实例
 * @param {object} options.detector     - Detector 实例
 * @param {object} options.memory       - MemoryManager 实例
 * @param {object} [options.aiAnalyzer] - AIAnalyzer 实例（可选，用于 LLM 增强）
 * @param {object} [options.scanner]    - Scanner 实例（可选，用于诊断场景）
 * @param {object} [options.config]     - 引擎配置覆盖
 * @returns {AgentEngine}
 */
export function createEngine(options) {
  const {
    topicFilter,
    ruleLearner,
    detector,
    memory,
    aiAnalyzer = null,
    scanner = null,
    config: userConfig = {},
    recorder = null,
  } = options;

  const config = { ...DEFAULT_CONFIG, ...userConfig };

  // ── 初始化子模块 ──────────────────────────────────────────
  const knowledge = createKnowledgeManager();
  const topicFilterBridge = _createTopicFilterBridge(topicFilter);

  // ── knowledge 桥接：补充 matchTopic 方法供 capability-registry 使用 ──
  const knowledgeBridge = {
    ...knowledge,
    matchTopic(query) {
      const topic = knowledge.findTopic(query);
      if (topic) return topic;
      const searchResults = knowledge.searchTopics(query);
      return searchResults.length > 0 ? searchResults[0] : null;
    },
  };

  // ── memory-sync 桥接：将 MemoryManager 包装为 Agent 期望的接口 ──
  const memorySync = createMemorySync(memory, topicFilter);
  // recordPreference 包装：兼容两种调用签名
  //   1) orchestrator: recordPreference({ topicId, topicLabel, scopes, sensitivity, keywords })
  //   2) profiles.js:  recordPreference({ profileId, topicLabel, scopes, sensitivity, action, timestamp })
  memorySync.recordPreference = function (data = {}) {
    // profiles.js 调用（无 topicId，有 action）→ 归一化为 recordConfiguration 格式
    if (!data.topicId && data.action) {
      return memorySync.recordConfiguration({
        topicId: `profile_${data.profileId || 'unknown'}`,
        topicLabel: data.topicLabel,
        scopes: data.scopes,
        sensitivity: data.sensitivity,
        keywords: [],
      });
    }
    return memorySync.recordConfiguration(data);
  };
  // 保留原始 MemoryManager 的底层方法（write/queryByType/queryByKey 等），供其他模块使用
  const memoryBridge = Object.create(memory);
  Object.assign(memoryBridge, memorySync);

  // ── 用户画像 Profile 初始化 ──
  // 首次启动自动初始化默认 Profile，后续操作会覆盖 Profile 默认值
  const userProfile = initUserProfile(memoryBridge);

  // ── ruleLearner 桥接：对齐 Agent Engine 期望的 API ──
  // learnFromSample(text, opts) → learn(aiResult, originalText, context)
  // getLearnedRules() → getAllRulesDetailed() 拍平 + 补 topicId/topic
  // getUnhandledPatterns() → 从 evidence 中分析未覆盖的高频模式（新建）
  const ruleLearnerBridge = Object.create(ruleLearner);
  Object.assign(ruleLearnerBridge, {
    /** 从用户提供的文本样本学习 — 适配层 */
    learnFromSample(sampleText, opts = {}) {
      const verdict = opts.verdict || 'toxic';
      const topicId = opts.topicId || '';
      // 将文本样本预处理为 aiResult 格式，再调用原始 learn()
      const aiResult = {
        verdict,
        confidence: 0.8,
        patterns: _extractPatternsFromSample(sampleText),
      };
      ruleLearner.learn(aiResult, sampleText, { topicId });
      // 返回 orchestrator 期望的格式
      const allRules = ruleLearner.getAllRulesDetailed();
      const flatRules = _flattenLearnedRules(allRules, topicId);
      return { rules: flatRules };
    },

    /** 获取已学规则 — 适配层：拍平 + 补 topicId/topic 字段 */
    getLearnedRules() {
      const all = ruleLearner.getAllRulesDetailed();
      return _flattenLearnedRules(all);
    },

    /** 获取未被规则覆盖的高频模式 — 新建方法 */
    getUnhandledPatterns() {
      // 从 memory 中查询最近被 AI 判定为 toxic 但未命中规则的记录
      try {
        const records = memory.queryByType?.('evidence') || [];
        const now = Date.now();
        const recent = records.filter(r => now - (r.timestamp || 0) < 7 * 24 * 60 * 60 * 1000);
        // 统计高频出现的文本片段
        const freqMap = new Map();
        for (const rec of recent) {
          const text = rec.value?.text || rec.value?.originalText || '';
          if (!text) continue;
          // 简单分词：按标点和空格分割，取长度>=2 的片段
          const segments = text.split(/[，。！？\s,!?;；]+/).filter(s => s.length >= 2);
          for (const seg of segments) {
            freqMap.set(seg, (freqMap.get(seg) || 0) + 1);
          }
        }
        // 过滤已被规则覆盖的 + 按频率排序
        const existingRules = _flattenLearnedRules(ruleLearner.getAllRulesDetailed());
        const existingTriggers = new Set(existingRules.map(r => r.trigger).filter(Boolean));
        return Array.from(freqMap.entries())
          .filter(([seg]) => !existingTriggers.has(seg))
          .filter(([, count]) => count >= 2)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([seg, count]) => ({ pattern: seg, count }));
      } catch (e) {
        return [];
      }
    },
  });

  // ── 单入口编排器 + 能力注册表 ──────────────────────────────
  // hotTopicManager 通过 DI 从 scanner 获取（避免跨包硬 import）
  // scanner 不可用时为 null（仅诊断/测试场景，无热点规则功能）
  const hotTopicManager = scanner?.hotTopicManager || null;

  const services = {
    topicFilter: topicFilterBridge,
    ruleLearner: ruleLearnerBridge,
    detector,
    memory: memoryBridge,
    scanner,
    knowledge: knowledgeBridge,
    aiAnalyzer,
    hotTopicManager,
    config: userConfig,  // 供 customKeyword.add 写入 customKeywords
  };

  const registry = new CapabilityRegistry();
  // 注册默认能力
  const defaultReg = createDefaultRegistry(services);
  for (const cap of defaultReg.list()) {
    registry.register(cap);
  }

  // ── 审计日志 + 回滚管理器（核心功能，必须注入）─────────
  const auditLog = new AuditLog();
  const rollbackMgr = new RollbackManager();

  const orchestrator = new TaskOrchestrator({
    services,
    registry,
    mode: _loadAgentMode(),
    lang: config.lang,
    recorder,
    userProfile,
    auditLog,
    rollbackMgr,
  });

  // ── 知识库匹配函数（保持原 API 兼容）────────────────────────
  function knowledgeMatcher(query) {
    const topic = knowledge.findTopic(query);
    if (topic) return { topic, category: null };
    const searchResults = knowledge.searchTopics(query);
    if (searchResults.length >= 1) {
      return { topic: searchResults[0], category: null };
    }
    const category = knowledge.matchCategory(query);
    if (category) {
      return { topic: null, category, topics: knowledge.findTopicsByCategory(category.id) };
    }
    return { topic: null, category: null };
  }

  // ── AgentEngine API ──────────────────────────────────────

  let _currentAbortController = null;

  return {
    /**
     * 处理用户输入 — 唯一入口（不再分流到 v1 状态机）
     * @param {string} input
     * @param {object} [extras]
     * @returns {Promise<object>}
     */
    async process(input, extras = {}) {
      // 若调用方未提供 _abortSignal，则创建内部 controller 以支持 abort()
      if (!extras._abortSignal) {
        _currentAbortController = new AbortController();
        extras = { ...extras, _abortSignal: _currentAbortController.signal };
      }
      try {
        return await orchestrator.process(input, extras);
      } finally {
        if (_currentAbortController?.signal === extras._abortSignal) {
          _currentAbortController = null;
        }
      }
    },

    /** 中断当前正在进行的 process() 调用 */
    abort() {
      if (_currentAbortController) {
        _currentAbortController.abort();
        _currentAbortController = null;
      }
    },

    /** 重置对话（清空 active task） */
    reset() {
      orchestrator.clearActiveTask();
    },

    /** 获取引擎状态 */
    getStatus() {
      const status = orchestrator.getStatus();
      return {
        ...status,
        config,
      };
    },

    /** 测试专用：获取内部 services（含桥接层） */
    _getServicesForTest() {
      return services;
    },

    /** 主动推荐（基于记忆和统计）— LLM 增强版 */
    async suggestProactively() {
      // 1. 查询 memory 获取用户偏好摘要（通过桥接层）
      const prefs = memoryBridge.getUserPreferenceSummary?.() || { enabledTopics: [] };

      // 2. 查询 ruleLearner 获取高频未处理模式
      let unhandledPatterns = [];
      try {
        unhandledPatterns = ruleLearner?.getUnhandledPatterns?.() || [];
      } catch {
        unhandledPatterns = [];
      }

      // 3. 获取过滤统计
      const statsResult = await registry.execute('capability.stats.getFilterStats', {});
      const stats = statsResult.success ? statsResult.data : null;

      // 无启用话题时，推荐默认话题
      if (prefs.enabledTopics.length === 0) {
        // LLM 增强版：让 LLM 生成更贴切的推荐语
        if (aiAnalyzer) {
          try {
            const prompt = `用户还没有启用任何过滤规则。当前统计：${JSON.stringify(stats)}。请用一句简短友好的话推荐用户启用过滤，并建议一个最实用的过滤话题。只输出推荐语，不要 JSON。`;
            let llmResult;
            if (typeof aiAnalyzer.chat === 'function') {
              llmResult = await aiAnalyzer.chat(prompt, { maxTokens: 200 });
            } else if (typeof aiAnalyzer.analyze === 'function') {
              llmResult = await aiAnalyzer.analyze(prompt, { type: 'proactive_suggest' });
            }
            if (llmResult) {
              return {
                type: 'PROACTIVE_SUGGEST',
                state: 'SUGGEST',
                message: typeof llmResult === 'string' ? llmResult : (llmResult.text || llmResult.content || '要试试启用「人身攻击」过滤吗？'),
                recommendations: knowledge.topicToRecommendations?.('personal_attack') || [],
                source: 'llm_enhanced',
              };
            }
          } catch {
            // LLM 失败时静默降级
          }
        }
        return {
          type: 'PROACTIVE_SUGGEST',
          state: 'SUGGEST',
          message: '你还没有启用任何过滤规则。要试试启用「人身攻击」过滤吗？',
          recommendations: knowledge.topicToRecommendations?.('personal_attack') || [],
          source: 'memory_empty',
        };
      }

      // 有高频未处理模式时，推荐学习
      if (unhandledPatterns.length > 0) {
        const topPattern = unhandledPatterns[0];
        return {
          type: 'PROACTIVE_SUGGEST',
          state: 'SUGGEST',
          message: `检测到多次出现「${topPattern.label || topPattern.topic || '类似内容'}」但未被过滤，是否添加规则？`,
          recommendations: [{
            id: topPattern.topicId || 'learned_suggestion',
            label: topPattern.label || topPattern.topic || '自动学习规则',
            reason: `已出现 ${topPattern.count || '多次'}，建议添加过滤`,
            keywords: topPattern.keywords || [],
          }],
          source: 'rule_learner',
        };
      }

      // 基于用户偏好推荐新话题
      try {
        const categories = knowledge.getCategories?.() || [];
        const enabledSet = new Set(prefs.enabledTopics.map(t => t.id || t));
        const unenabledTopics = [];
        for (const cat of categories) {
          const catTopics = knowledge.findTopicsByCategory?.(cat.id) || [];
          for (const tp of catTopics) {
            if (!enabledSet.has(tp.id)) {
              unenabledTopics.push(tp);
            }
          }
        }
        if (unenabledTopics.length > 0) {
          const suggested = unenabledTopics[0];
          return {
            type: 'PROACTIVE_SUGGEST',
            state: 'SUGGEST',
            message: `你可能还想启用「${suggested.name?.zh || suggested.label}」过滤？`,
            recommendations: [{
              id: suggested.id,
              label: suggested.name?.zh || suggested.label,
              reason: '基于你已启用的规则推荐',
              keywords: suggested.keywords || [],
            }],
            source: 'preference_expansion',
          };
        }
      } catch {
        // knowledge 不可用时静默降级
      }

      return null;
    },

    /** 诊断文本 */
    diagnoseText(text) {
      if (!detector) return { success: false, reason: '检测器不可用' };
      try {
        const result = detector.analyze(text, { platform: 'diagnose' });
        return {
          success: true,
          verdict: result.verdict,
          confidence: result.confidence,
          layer: result.layer,
          reason: result.reason,
          matched: result.matched,
          riskLevel: result.riskLevel,
          suggestion: result.verdict === 'safe'
            ? '该文本未被过滤，因为未匹配到任何规则。建议添加相关关键词。'
            : '该文本已被规则命中。',
        };
      } catch (e) {
        return { success: false, reason: e.message };
      }
    },

    // ── 便捷方法 ──────────────────────────────────────
    getCategories() { return knowledge.getCategories(); },
    searchTopics(query) { return knowledge.searchTopics(query); },
    getUserPreferences() { return memoryBridge.getUserPreferenceSummary?.() || { enabledTopics: [] }; },

    // ── 用户画像 Profile API ──────────────────────────
    getUserProfile() { return getCurrentProfile(memoryBridge); },
    switchUserProfile(profileId) {
      const profile = switchProfile(memoryBridge, profileId);
      if (profile) { orchestrator.userProfile = profile; }
      return profile;
    },
    listUserProfiles() { return listProfiles(); },

    // ── 热点规则 API（供 panel-hot-topics.js 使用）─────
    getHotTopicManager() { return hotTopicManager; },

    // ── 话题过滤器 API（供 panel-dashboard.js 同步使用）─────
    getTopicFilter() { return topicFilter; },

    // ── v2 API 兼容（给 chat-panel.js 旧调用）────────────
    getTaskOrchestrator() { return orchestrator; },
    undoLast() { return orchestrator.undoLast(); },
    confirmCurrentTask() { return orchestrator.confirmCurrent(); },
    confirmCurrent() { return orchestrator.confirmCurrent(); },  // ★ 别名：UI 交互卡片使用此名
    cancelCurrentTask() { return orchestrator.cancelCurrent(); },
    setAgentMode(mode) { orchestrator.setMode(mode); },
    getAgentMode() { return orchestrator.getMode(); },
    setThinkingMode(enabled) { orchestrator.setThinkingMode(enabled); },
    getOrchestratorStatus() { return orchestrator.getStatus(); },
    onOrchestratorEvent(fn) { return orchestrator.onEvent(fn); },

    // ── 录制 API（DEV_MODE 使用）──────────────────────────
    setRecorder(rec) { orchestrator.setRecorder(rec); },
    getRecorder() { return orchestrator.recorder; },
  };
}

// ─── TopicFilter 桥接适配（保留能力接口）─────────────────────────────────────

function _createTopicFilterBridge(topicFilter) {
  if (!topicFilter) return null;
  return {
    getAllTopics: () => topicFilter.getAllTopics(),
    getTopicDetail: (id) => topicFilter.topics?.[id] || null,
    toggleTopic: (id, enabled) => topicFilter.toggleTopic(id, enabled),
    addUserTopic: (topic) => topicFilter.addUserTopic(topic),
    getTopicExamples: (id) => topicFilter.getTopicExamples(id),
    topics: topicFilter.topics,   // 让 capability 能直接读取
    _addKeywords(topicId, keywords, lang = 'zh') {
      const topic = topicFilter.topics?.[topicId];
      if (!topic) return;
      if (!topic.keywords) topic.keywords = { zh: [], en: [] };
      const target = topic.keywords[lang] || topic.keywords.zh;
      for (const kw of keywords) {
        const lower = kw.toLowerCase().trim();
        if (lower.length >= 2 && !target.includes(lower)) target.push(lower);
      }
      topicFilter._save?.();
    },
    addKeywordsToTopic(topicId, keywords, lang = 'zh') {
      return this._addKeywords(topicId, keywords, lang);
    },
    removeKeywordFromTopic: (topicId, keyword, lang) =>
      topicFilter.removeKeywordFromTopic?.(topicId, keyword, lang),
  };
}

// ─── 持久化模式 ─────────────────────────────────────────────────────────────
function _loadAgentMode() {
  try {
    const m = GM_getValue('cs_ai_mode_v2', AGENT_MODE.MANUAL);
    return m === AGENT_MODE.AUTO ? AGENT_MODE.AUTO : AGENT_MODE.MANUAL;
  } catch {
    return AGENT_MODE.MANUAL;
  }
}
