/**
 * capability-registry.js — 业务能力注册表
 *
 * 把 topicFilter / ruleLearner / scanner / memory 等业务模块的「程序员接口」
 * 包装为「语义化能力单元」供任务层调用。
 *
 * 每个能力声明：name / module / action / riskLevel / rollbackable / argsSchema / execute
 *
 * 设计目的：
 *   1. 任务层与业务模块解耦 — 编排器只调 registry，不直接 import 业务模块
 *   2. 风险契约显式化 — 每个能力自带 riskLevel，编排器据此判断是否需要确认
 *   3. 可观测性 — registry.list() 即可输出全部能力清单（用于「你能做什么」）
 *   4. 可扩展性 — 新增能力只改注册表，编排器逻辑不变
 */

import { RISK_LEVEL } from './types.js';

export class CapabilityRegistry {
  constructor() {
    this._caps = new Map();
  }

  /** 注册一个能力（重复名会覆盖并打 warn） */
  register(cap) {
    if (!cap?.name) throw new Error('capability.name is required');
    if (!cap.execute || typeof cap.execute !== 'function') {
      throw new Error(`capability.execute must be a function: ${cap.name}`);
    }
    if (this._caps.has(cap.name)) {
      console.warn(`[capability-registry] 覆盖已有能力：${cap.name}`);
    }
    this._caps.set(cap.name, cap);
  }

  /** 列出所有能力（按 riskLevel 升序） */
  list() {
    const arr = Array.from(this._caps.values());
    const order = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };
    return arr.sort((a, b) => (order[a.riskLevel] ?? 9) - (order[b.riskLevel] ?? 9));
  }

  /** 按名字取能力 */
  get(name) {
    return this._caps.get(name) || null;
  }

  /** 按风险等级筛选 */
  filterByRisk(level) {
    return this.list().filter(c => c.riskLevel === level);
  }

  /** 执行一个能力（args 由调用方保证合法） */
  async execute(name, args, ctx) {
    const cap = this.get(name);
    if (!cap) throw new Error(`未知能力：${name}`);
    return cap.execute(args, ctx);
  }

  /** 数量 */
  size() {
    return this._caps.size;
  }

  /**
   * 将所有能力转换为 LLM tool definitions 格式
   * 用于注入 LLM system prompt，让 LLM 知道可以调用哪些工具
   */
  toToolDefinitions() {
    return this.list().map(cap => ({
      name: cap.name,
      description: cap.description || cap.name,
      parameters: this._capToParams(cap),
      risk_level: cap.riskLevel,
      rollbackable: cap.rollbackable || false,
    }));
  }

  /**
   * 生成紧凑的工具描述文本（含参数签名），用于 JSON-mode 工具调用
   * 格式: 工具名: 描述。参数: param1(必填,type), param2?(type)
   */
  toCompactDescriptions() {
    return this.list().map(cap => {
      const params = (cap.argsSchema || []).map(arg => {
        const optional = arg.endsWith('?');
        const name = optional ? arg.slice(0, -1) : arg;
        const typeStr = name.includes('keywords') || name.includes('scopes') ? 'string[]'
          : name === 'enabled' ? 'boolean'
          : 'string';
        return optional ? `${name}?(${typeStr})` : `${name}(${typeStr})`;
      }).join(', ');
      return `- ${cap.name}: ${cap.description || cap.name}${params ? `  参数: ${params}` : ''}`;
    });
  }

  /** 将 argsSchema 转为 JSON Schema 风格的参数描述 */
  _capToParams(cap) {
    if (!cap.argsSchema || !cap.argsSchema.length) return { type: 'object', properties: {} };
    const props = {};
    const required = [];
    for (const arg of cap.argsSchema) {
      const optional = arg.endsWith('?');
      const name = optional ? arg.slice(0, -1) : arg;
      if (!optional) required.push(name);
      // 简单类型推断
      if (name.includes('keywords') || name.includes('scopes')) {
        props[name] = { type: 'array', items: { type: 'string' }, description: name };
      } else if (name === 'enabled') {
        props[name] = { type: 'boolean', description: name };
      } else {
        props[name] = { type: 'string', description: name };
      }
    }
    return { type: 'object', properties: props, required: required.length ? required : undefined };
  }
}

/**
 * 创建默认能力注册表（已注册所有 CyberShield 业务能力）
 *
 * @param {object} services - 业务模块实例
 * @param {object} services.topicFilter
 * @param {object} services.ruleLearner
 * @param {object} services.scanner
 * @param {object} services.memory
 * @param {object} services.knowledge
 * @returns {CapabilityRegistry}
 */
export function createDefaultRegistry(services = {}) {
  const reg = new CapabilityRegistry();

  // ── 话题相关 ──────────────────────────────────

  reg.register({
    name: 'capability.customKeyword.add',
    module: 'customKeyword',
    action: 'addCustomKeyword',
    riskLevel: RISK_LEVEL.L1,
    rollbackable: true,
    description: '添加精确屏蔽词（单ID/名字/词/脏话/喷子语料）。用户说"屏蔽词XX"、"拉黑XX"、"屏蔽张三、李四、喷子、杠精"时用。vs proposeCreate：单个词或多个词都用此，一类内容/话题偏好用 proposeCreate。keywords 支持数组，可一次加多个词',
    argsSchema: ['keywords', 'aliases?'],
    execute: async (args) => {
      const raw = Array.isArray(args.keywords) ? args.keywords : [args.keywords];
      const words = raw.map(s => (s || '').trim()).filter(Boolean);
      if (!words.length) return { success: false, reason: '关键词不能为空' };
      if (!services.config) return { success: false, reason: 'config 不可用' };
      if (!services.config.customKeywords) services.config.customKeywords = [];

      const added = [];
      const skipped = [];
      for (const word of words) {
        if (services.config.customKeywords.some(e => e.keyword.toLowerCase() === word.toLowerCase())) {
          skipped.push(word);
          continue;
        }
        const aliases = [];
        const lower = word.toLowerCase().replace(/\s+/g, '');
        if (lower !== word) aliases.push(lower);
        services.config.customKeywords.push({ keyword: word, aliases, addedAt: Date.now() });
        added.push(word);
      }
      if (added.length) {
        try { services.config.save?.(); } catch {}
        try { services.detector?.reloadCustomKeywords?.(); } catch {}
      }
      return { success: added.length > 0, added, skipped, total: words.length };
    },
  });

  reg.register({
    name: 'capability.topicFilter.proposeCreate',
    module: 'topicFilter',
    action: 'proposeCreate',
    riskLevel: RISK_LEVEL.L0, // 只是提议，不执行，零风险
    rollbackable: false,
    description: '提议创建过滤话题配置。用户说"屏蔽XX"、"不想看XX"时调用，等待用户确认后才真正创建',
    argsSchema: ['topicLabel', 'keywords?', 'scopes?', 'sensitivity?'],
    execute: async (args) => {
      // 不真建话题，只返回提议数据
      // task-orchestrator 的 _handleProposeCreate 会接管后续流程
      return {
        success: true,
        proposal: {
          topicLabel: args.topicLabel,
          keywords: args.keywords || [args.topicLabel],
          scopes: args.scopes || ['comment', 'reply', 'dynamic'],
          sensitivity: args.sensitivity || 'high',
          mode: args.sensitivity === 'high' ? 'semantic' : 'keyword',
        },
      };
    },
  });

  reg.register({
    name: 'capability.task.cancelProposal',
    module: 'task',
    action: 'cancelProposal',
    riskLevel: RISK_LEVEL.L0, // 只是取消提议，零风险
    rollbackable: false,
    description: '取消当前待确认的提议。用户说"算了"、"不弄了"、"我再想想"时调用',
    argsSchema: ['reason?'],
    execute: async (args) => {
      // 后端在 _handleCancelProposal 中真正清空状态
      return { success: true, cancelled: true, reason: args.reason || 'user_cancelled' };
    },
  });

  reg.register({
    name: 'capability.task.proposeAction',
    module: 'task',
    action: 'proposeAction',
    riskLevel: RISK_LEVEL.L0, // 只是提议，不执行，零风险
    rollbackable: false,
    description: '提议删除/禁用/启用话题。actionType=delete|disable|enable。操作已有话题前先用 getAllTopics 确认 topicId',
    argsSchema: ['actionType', 'topicId?', 'topicLabel?'],
    execute: async (args) => {
      // 不真执行，只返回提议数据
      // task-orchestrator 的 _handleProposeAction 会接管后续流程
      return { success: true, proposal: args };
    },
  });

  reg.register({
    name: 'capability.topicFilter.createUserTopic',
    module: 'topicFilter',
    action: 'createUserTopic',
    riskLevel: RISK_LEVEL.L2,
    rollbackable: true,
    description: '创建用户自定义话题',
    argsSchema: ['topicId?', 'topicLabel', 'description?', 'keywords?', 'scopes?', 'sensitivity?'],
    execute: async (args) => {
      if (!services.topicFilter?.addUserTopic) {
        return { success: false, reason: 'topicFilter 不可用' };
      }
      const topicId = args.topicId || `user_${Date.now()}`;
      const result = services.topicFilter.addUserTopic({
        id: topicId,
        label: args.topicLabel,
        description: args.description || '',
        keywords: args.keywords || [],
        scopes: args.scopes || ['comment', 'reply', 'dynamic'],
        sensitivity: args.sensitivity || 'medium',
        createdBy: 'ai',
      });
      return { success: true, topicId, data: result };
    },
  });

  reg.register({
    name: 'capability.topicFilter.removeTopic',
    module: 'topicFilter',
    action: 'removeTopic',
    riskLevel: RISK_LEVEL.L3, // 删除=高风险，强制确认
    rollbackable: true,
    description: '删除一个用户创建的过滤话题。高风险且需用户确认。内置话题不可删除，只能禁用。',
    argsSchema: ['topicId'],
    execute: async (args) => {
      const tf = services.topicFilter;
      if (!tf?.removeUserTopic) return { success: false, reason: 'topicFilter 不支持删除' };

      // 查找话题，存快照供回滚
      const all = tf.getAllTopics?.() || [];
      const target = all.find(t => t.id === args.topicId);
      if (!target) return { success: false, reason: `话题不存在: ${args.topicId}` };

      // ★ 安全：内置话题不让删，引导去禁用
      const fullTopic = tf.topics?.[args.topicId];
      const source = fullTopic?.source || target.source || 'builtin';
      if (source === 'builtin') {
        return { success: false, reason: '内置话题不可删除，建议禁用', suggestDisable: true, topicId: args.topicId };
      }

      // 存完整快照供回滚恢复
      const snapshot = fullTopic ? JSON.parse(JSON.stringify(fullTopic)) : null;
      tf.removeUserTopic(args.topicId);
      return { success: true, removed: snapshot || target, topicId: args.topicId };
    },
  });

  reg.register({
    name: 'capability.topicFilter.addKeywordsToTopic',
    module: 'topicFilter',
    action: 'addKeywords',
    riskLevel: RISK_LEVEL.L1,
    rollbackable: true,
    description: '给话题追加关键词',
    argsSchema: ['topicId', 'keywords', 'lang?'],
    execute: async (args) => {
      if (!services.topicFilter) return { success: false, reason: 'topicFilter 不可用' };
      const topicId = args.topicId;
      const before = JSON.parse(JSON.stringify(services.topicFilter.topics?.[topicId]?.keywords || {}));
      // 优先用桥接方法 _addKeywords，否则用原 addKeywordsToTopic
      if (typeof services.topicFilter._addKeywords === 'function') {
        services.topicFilter._addKeywords(topicId, args.keywords, args.lang || 'zh');
      } else if (typeof services.topicFilter.addKeywordsToTopic === 'function') {
        services.topicFilter.addKeywordsToTopic(topicId, args.keywords, args.lang || 'zh');
      }
      const after = JSON.parse(JSON.stringify(services.topicFilter.topics?.[topicId]?.keywords || {}));
      return { success: true, before, after, topicId };
    },
  });

  reg.register({
    name: 'capability.topicFilter.toggleTopic',
    module: 'topicFilter',
    action: 'toggle',
    riskLevel: RISK_LEVEL.L1,
    rollbackable: true,
    description: '启用/禁用话题',
    argsSchema: ['topicId', 'enabled'],
    execute: async (args) => {
      if (!services.topicFilter?.toggleTopic) {
        return { success: false, reason: 'topicFilter 不可用' };
      }
      const before = !!services.topicFilter.topics?.[args.topicId]?.enabled;
      services.topicFilter.toggleTopic(args.topicId, !!args.enabled);
      return { success: true, before: { enabled: before }, after: { enabled: !!args.enabled } };
    },
  });

  reg.register({
    name: 'capability.topicFilter.createSemanticTopic',
    module: 'topicFilter',
    action: 'createSemanticTopic',
    riskLevel: RISK_LEVEL.L2,
    rollbackable: true,
    description: '创建高敏感度半自动话题，关键词可通过样本学习自动扩充。用户说"让AI自动识别"时用',
    argsSchema: ['topicLabel', 'scopes?', 'seedKeywords?'],
    execute: async (args) => {
      if (!services.topicFilter?.addUserTopic) {
        return { success: false, reason: 'topicFilter 不可用' };
      }
      const topicId = `semantic_${Date.now()}`;
      services.topicFilter.addUserTopic({
        id: topicId,
        label: args.topicLabel,
        keywords: args.seedKeywords || [],
        scopes: args.scopes || ['comment', 'reply', 'dynamic'],
        sensitivity: 'high',
        autoLearn: true,
        createdBy: 'ai',
      });
      // 自动启用
      if (services.topicFilter.toggleTopic) {
        services.topicFilter.toggleTopic(topicId, true);
      }
      return { success: true, topicId, mode: 'semantic', note: '半自动模式：高敏感度 + 学习闭环，会随标记内容持续学习' };
    },
  });

  reg.register({
    name: 'capability.topicFilter.removeKeywordFromTopic',
    module: 'topicFilter',
    action: 'removeKeyword',
    riskLevel: RISK_LEVEL.L2,
    rollbackable: true,
    description: '从话题中删除指定关键词',
    argsSchema: ['topicId', 'keyword', 'lang?'],
    execute: async (args) => {
      if (!services.topicFilter?.removeKeywordFromTopic) {
        return { success: false, reason: 'topicFilter 不可用或缺少 removeKeywordFromTopic 方法' };
      }
      const topicId = args.topicId;
      const before = JSON.parse(JSON.stringify(services.topicFilter.topics?.[topicId]?.keywords || {}));
      services.topicFilter.removeKeywordFromTopic(topicId, args.keyword, args.lang || 'zh');
      const after = JSON.parse(JSON.stringify(services.topicFilter.topics?.[topicId]?.keywords || {}));
      return { success: true, before, after, topicId };
    },
  });

  reg.register({
    name: 'capability.topicFilter.getAllTopics',
    module: 'topicFilter',
    action: 'query',
    riskLevel: RISK_LEVEL.L0,
    rollbackable: false,
    description: '获取所有话题',
    execute: async () => {
      if (!services.topicFilter?.getAllTopics) {
        return { success: false, reason: 'topicFilter 不可用' };
      }
      return { success: true, topics: services.topicFilter.getAllTopics() || [] };
    },
  });

  // ── 规则学习 ──────────────────────────────────
  reg.register({
    name: 'capability.ruleLearner.learnFromSample',
    module: 'ruleLearner',
    action: 'learn',
    riskLevel: RISK_LEVEL.L2,
    rollbackable: true,
    description: '从样本中学习新规则',
    argsSchema: ['text', 'verdict', 'topicId?'],
    execute: async (args) => {
      if (!services.ruleLearner?.learnFromSample) {
        return { success: false, reason: 'ruleLearner 不可用' };
      }
      const result = services.ruleLearner.learnFromSample(args.text, {
        verdict: args.verdict,
        topicId: args.topicId,
      });
      return { success: !!result, data: result };
    },
  });

  // ── 扫描器 ──────────────────────────────────
  reg.register({
    name: 'capability.scanner.refresh',
    module: 'scanner',
    action: 'refresh',
    riskLevel: RISK_LEVEL.L0,
    rollbackable: false,
    description: '刷新过滤器（应用新配置）',
    execute: async () => {
      if (typeof services.scanner?.refresh === 'function') {
        services.scanner.refresh();
      }
      return { success: true };
    },
  });

  // ── 记忆 ──────────────────────────────────
  reg.register({
    name: 'capability.memory.recordPreference',
    module: 'memory',
    action: 'record',
    riskLevel: RISK_LEVEL.L1,
    rollbackable: true,
    description: '记录用户偏好到记忆',
    argsSchema: ['topicId', 'topicLabel', 'scopes?', 'sensitivity?', 'keywords?'],
    execute: async (args) => {
      if (!services.memory?.recordPreference) {
        return { success: false, reason: 'memory 不可用' };
      }
      services.memory.recordPreference(args);
      return { success: true };
    },
  });

  // ── 诊断 ──────────────────────────────────
  reg.register({
    name: 'capability.detector.diagnoseText',
    module: 'detector',
    action: 'diagnose',
    riskLevel: RISK_LEVEL.L0,
    rollbackable: false,
    description: '分析一段文本为什么没被过滤，返回各层检测结果',
    argsSchema: ['text'],
    execute: async (args) => {
      if (!services.detector?.analyze) return { success: false, reason: 'detector 不可用' };
      const result = services.detector.analyze(args.text);
      return { success: true, analysis: result };
    },
  });

  // ── 统计 ──────────────────────────────────
  reg.register({
    name: 'capability.stats.getFilterStats',
    module: 'stats',
    action: 'queryStats',
    riskLevel: RISK_LEVEL.L0,
    rollbackable: false,
    description: '获取过滤统计数据（话题数、关键词数、近期屏蔽统计）',
    execute: async () => {
      const topics = services.topicFilter?.getAllTopics?.() || [];
      const enabled = topics.filter(t => t.enabled);
      let totalKw = 0;
      for (const tp of topics) {
        const kw = tp.keywords;
        if (Array.isArray(kw)) totalKw += kw.length;
        else if (kw && typeof kw === 'object') totalKw += (kw.zh?.length || 0) + (kw.en?.length || 0);
      }
      return { success: true, data: { totalTopics: topics.length, enabledTopics: enabled.length, totalKeywords: totalKw } };
    },
  });

  // ── 知识库搜索 ──────────────────────────────────
  reg.register({
    name: 'capability.knowledge.search',
    module: 'knowledge',
    action: 'search',
    riskLevel: RISK_LEVEL.L0,
    rollbackable: false,
    description: '搜索知识库中与查询相关的话题模板',
    argsSchema: ['query'],
    execute: async (args) => {
      if (!services.knowledge?.matchTopic) return { success: false, reason: 'knowledge 不可用' };
      const result = services.knowledge.matchTopic(args.query);
      return { success: true, match: result };
    },
  });

  // ── 热点规则管理（HotTopicManager）──────────────────────────
  // 热点规则带 TTL + 组合触发模式，专门处理时效性热点事件
  // 与 topic_filter 互补：topic_filter 管永久规则，HotTopicManager 管时效性规则

  reg.register({
    name: 'capability.hotTopic.proposeCreate',
    module: 'hotTopic',
    action: 'proposeCreate',
    riskLevel: RISK_LEVEL.L0, // 只是提议，不执行，零风险
    description: '提议创建时效性热点规则（带TTL到期自动失效）。用户说"XX事件刷屏"、"XX粉丝吵架"等近期热点时用。combination模式：all必须同时出现，any至少出现一个。关键词从用户输入中动态提取',
    argsSchema: ['label', 'keywords', 'triggerMode?', 'combinationRule?', 'scopes?', 'ttlDays?'],
    execute: async (args) => {
      // 不真建规则，只返回提议数据
      // task-orchestrator 的 _handleProposeHotTopic 会接管后续流程
      return {
        success: true,
        proposal: {
          label: args.label,
          keywords: args.keywords || [],
          triggerMode: args.triggerMode || 'combination',
          combinationRule: args.combinationRule || null,
          scopes: args.scopes || ['comment', 'reply'],
          ttlDays: args.ttlDays || 7,
        },
      };
    },
  });

  reg.register({
    name: 'capability.hotTopic.create',
    module: 'hotTopic',
    action: 'create',
    riskLevel: RISK_LEVEL.L2,
    rollbackable: true,
    description: '创建热点规则（带 TTL，到期自动失效）',
    argsSchema: ['label', 'keywords', 'triggerMode?', 'combinationRule?', 'scopes?', 'ttlDays?', 'source?'],
    execute: async (args) => {
      if (!services.hotTopicManager?.create) {
        return { success: false, reason: 'hotTopicManager 不可用' };
      }
      const result = services.hotTopicManager.create({
        label: args.label,
        keywords: args.keywords,
        triggerMode: args.triggerMode,
        combinationRule: args.combinationRule,
        scopes: args.scopes,
        ttlDays: args.ttlDays,
        source: args.source || 'ai',
      });
      if (!result.success) return { success: false, reason: result.reason };
      return { success: true, topicId: result.topicId };
    },
  });

  reg.register({
    name: 'capability.hotTopic.update',
    module: 'hotTopic',
    action: 'update',
    riskLevel: RISK_LEVEL.L1,
    rollbackable: true,
    description: '更新热点规则（支持续期、修改关键词、启用/禁用）',
    argsSchema: ['topicId', 'label?', 'keywords?', 'triggerMode?', 'combinationRule?', 'scopes?', 'ttlDays?', 'status?'],
    execute: async (args) => {
      if (!services.hotTopicManager?.update) {
        return { success: false, reason: 'hotTopicManager 不可用' };
      }
      const result = services.hotTopicManager.update(args.topicId, {
        label: args.label,
        keywords: args.keywords,
        triggerMode: args.triggerMode,
        combinationRule: args.combinationRule,
        scopes: args.scopes,
        ttlDays: args.ttlDays,
        status: args.status,
      });
      return result;
    },
  });

  reg.register({
    name: 'capability.hotTopic.delete',
    module: 'hotTopic',
    action: 'delete',
    riskLevel: RISK_LEVEL.L3, // 删除=高风险，强制确认
    rollbackable: true,
    description: '删除热点规则（彻底删除，不保留历史）',
    argsSchema: ['topicId'],
    execute: async (args) => {
      if (!services.hotTopicManager?.delete) {
        return { success: false, reason: 'hotTopicManager 不可用' };
      }
      const result = services.hotTopicManager.delete(args.topicId);
      if (!result.success) return { success: false, reason: '规则不存在' };
      return { success: true, removed: result.removed };
    },
  });

  reg.register({
    name: 'capability.hotTopic.list',
    module: 'hotTopic',
    action: 'query',
    riskLevel: RISK_LEVEL.L0,
    rollbackable: false,
    description: '获取所有热点规则（按状态分组：active/expired/disabled）',
    execute: async () => {
      if (!services.hotTopicManager?.getAll) {
        return { success: false, reason: 'hotTopicManager 不可用' };
      }
      return { success: true, topics: services.hotTopicManager.getAll() };
    },
  });

  reg.register({
    name: 'capability.hotTopic.renew',
    module: 'hotTopic',
    action: 'renew',
    riskLevel: RISK_LEVEL.L1,
    rollbackable: true,
    description: '续期热点规则（重新计算过期时间）',
    argsSchema: ['topicId', 'ttlDays?'],
    execute: async (args) => {
      if (!services.hotTopicManager?.renew) {
        return { success: false, reason: 'hotTopicManager 不可用' };
      }
      return services.hotTopicManager.renew(args.topicId, args.ttlDays || 7);
    },
  });

  reg.register({
    name: 'capability.hotTopic.getStats',
    module: 'hotTopic',
    action: 'queryStats',
    riskLevel: RISK_LEVEL.L0,
    rollbackable: false,
    description: '获取热点规则扫描统计报告（供 AI 代理决策是否续期/清理）',
    execute: async () => {
      if (!services.hotTopicManager?.getStatsReport) {
        return { success: false, reason: 'hotTopicManager 不可用' };
      }
      return { success: true, stats: services.hotTopicManager.getStatsReport() };
    },
  });

  // ── 引导卡片能力 ──────────────────────────────────

  reg.register({
    name: 'capability.task.guideUser',
    module: 'task',
    action: 'guideUser',
    riskLevel: RISK_LEVEL.L0, // 纯展示，零风险
    rollbackable: false,
    description: '展示引导卡片收集用户配置。cardKind=understand_confirm|config_guide|compound_plan。用于复杂需求、语义模糊、多意图时引导用户',
    argsSchema: ['cardKind', 'understanding?', 'topicLabel?', 'suggestedCategory?', 'suggestedKeywords?', 'suggestedScopes?', 'suggestedSensitivity?', 'suggestedMode?', 'fields?', 'steps?', 'guidanceMessage?'],
    execute: async (args) => {
      // 不执行业务，只返回卡片数据
      // task-orchestrator 的 _handleGuideUser 会接管后续流程
      return { success: true, card: args };
    },
  });

  // ── 启动期校验：确保编排器引用的所有 capability 均已注册 ──
  const REQUIRED_CAPABILITIES = [
    'capability.customKeyword.add',
    'capability.topicFilter.proposeCreate',
    'capability.task.cancelProposal',
    'capability.task.proposeAction',
    'capability.topicFilter.createUserTopic',
    'capability.topicFilter.removeTopic',
    'capability.topicFilter.addKeywordsToTopic',
    'capability.topicFilter.removeKeywordFromTopic',
    'capability.topicFilter.toggleTopic',
    'capability.topicFilter.getAllTopics',
    'capability.ruleLearner.learnFromSample',
    'capability.scanner.refresh',
    'capability.memory.recordPreference',
    'capability.detector.diagnoseText',
    'capability.stats.getFilterStats',
    'capability.knowledge.search',
    'capability.hotTopic.proposeCreate',
    'capability.hotTopic.create',
    'capability.hotTopic.update',
    'capability.hotTopic.delete',
    'capability.hotTopic.list',
    'capability.hotTopic.renew',
    'capability.hotTopic.getStats',
  ];
  for (const name of REQUIRED_CAPABILITIES) {
    if (!reg.get(name)) {
      console.error(`[capability-registry] 必需能力未注册：${name}`);
      throw new Error(`[capability-registry] 必需能力未注册：${name}`);
    }
  }

  return reg;
}
