/**
 * prompt-builder.js — Prompt / 提示词构建纯函数
 *
 * 从 task-orchestrator.js 提取的 4 个方法，改为纯函数：
 *   - buildAgentSystemPrompt  构建 Agent 系统提示词
 *   - buildLLMPrompt          构建 LLM 增强提示词
 *   - buildQuestions          构建澄清问题
 *   - listCapabilities        列出能力清单（返回 reply 结构）
 *
 * 这些函数不依赖 this，所有依赖通过参数传入。
 */

/**
 * 构建 Agent System Prompt — 对话式，简洁，让 LLM 发挥语义推理能力
 *
 * @param {object}  opts
 * @param {object}  opts.status        — getStatus() 的返回值，用于读取运行模式
 * @param {object}  opts.registry      — 能力注册表，提供 toCompactDescriptions()
 * @param {boolean} opts.thinkingMode  — 是否开启思考模式
 * @param {object}  opts.userProfile   — 用户画像（可选）
 * @param {object}  opts.activeTask    — 当前待确认任务（可选）
 * @param {Array}   opts.toolResults   — 上一步工具执行结果（可选）
 * @returns {string} 拼接好的 system prompt
 */
export function buildAgentSystemPrompt({ status, registry, thinkingMode, userProfile, activeTask, toolResults }) {
  // 用带参数签名的紧凑描述
  const toolLines = registry.toCompactDescriptions();

  const lines = [];

  // ★ 思考模式：在 prompt 最前面添加思考指令
  if (thinkingMode) {
    lines.push(
      '【重要】你需要先进行深度思考，然后再给出回复。',
      '请将你的推理过程包裹在 <thinking> 和 </thinking> 标签之间。',
      '思考内容应包括：1) 分析用户意图 2) 评估所需工具 3) 推理步骤。',
      '思考结束后，输出工具调用 JSON 或文本回复。',
      '示例格式：',
      '<thinking>用户想创建一个屏蔽话题，关键词是"张三"，需要评估敏感度和确定范围。分析：这是个人名屏蔽，敏感度中等，建议范围 all。</thinking>',
      '{"tool_calls":[{"name":"capability.topicFilter.proposeCreate","arguments":{"topicLabel":"张三","keywords":["张三"]}}]}',
      '',
    );
  }

  lines.push(
    '你是 CyberShield AI 助手，一个浏览器端内容过滤工具。你的任务是帮助用户管理过滤规则，屏蔽社交平台上的不良内容。',
    '',
    `运行模式：${status.mode === 'auto' ? '自动' : '手动确认'}`,
    `已注册工具：${toolLines.length} 个`,
  );

  if (userProfile) {
    lines.push(`用户偏好：${userProfile.defaultSensitivity || '默认'}敏感度，范围：${(userProfile.preferredScopes || []).join('、') || '默认'}`);
  }

  // ★ 最近创建的上下文：帮助 LLM 理解用户后续请求指代的是哪个话题/热点
  const recentTopics = status.recentTopics || [];
  const recentHotTopics = status.recentHotTopics || [];
  if (recentTopics.length || recentHotTopics.length) {
    lines.push('', '## 最近创建/修改的规则（用户后续请求可能指代这些）');
    for (const t of recentHotTopics) {
      lines.push(`- 🔥热点「${t.label}」（关键词：${(t.keywords||[]).join('、')}）（有效期 ${t.ttlDays||7} 天）`);
    }
    for (const t of recentTopics) {
      lines.push(`- 话题「${t.label}」（关键词：${(t.keywords||[]).join('、')}）`);
    }
    lines.push('注意：用户说"关键词太少"、"修改触发模式"、"热点"时，指代的是上述最近创建的热点/话题，不是新建。');
  }

  lines.push(
    '',
    '## 可用工具',
    ...toolLines,
    '',
    '## 核心规则',
    '1. 闲聊/问答/非业务请求 → 直接文本回复，不调用工具',
    '2. 理解用户意图后行动（务必使用全限定名）：单个词/名字/ID → capability.customKeyword.add；一类内容/话题偏好/过滤话题 → capability.topicFilter.proposeCreate；时效热点/热点话题/刷屏事件 → capability.hotTopic.proposeCreate；复杂/模糊 → capability.task.guideUser',
    '3. 不确定时先确认，用户授权后直接执行，不反复确认',
    '4. 用中文回复，简洁友好',
    '5. 绝不自动创建规则，除非用户明确请求',
    '6. 操作已有话题前，先用 getAllTopics 确认 topicId',
    '7. ★ 热点话题有 7/14/30 天生命周期，用于临时屏蔽刷屏内容；话题偏好是长期过滤规则，不是热点',
    '',
    '## 工具调用格式',
    '需要调用工具时，输出以下 JSON（不要加 markdown 代码块标记）：',
    '{"tool_calls":[{"name":"capability.xxx.xxx","arguments":{"param1":"value"}}]}',
    '一次可调用多个工具。',
    '',
    '## 示例',
    '用户："屏蔽张三" → {"tool_calls":[{"name":"capability.topicFilter.proposeCreate","arguments":{"topicLabel":"张三","keywords":["张三"]}}]}',
    '用户："屏蔽词 李四" → {"tool_calls":[{"name":"capability.customKeyword.add","arguments":{"keywords":["李四"]}}]}',
    '用户："屏蔽张三、李四、王五、喷子、杠精" → {"tool_calls":[{"name":"capability.customKeyword.add","arguments":{"keywords":["张三","李四","王五","喷子","杠精"]}}]}',
    '用户："不想看到拉踩引战" → {"tool_calls":[{"name":"capability.topicFilter.proposeCreate","arguments":{"topicLabel":"拉踩引战","keywords":["拉踩","引战","踩一捧一"]}}]}',
    '用户："创建话题偏好：职场歧视" → {"tool_calls":[{"name":"capability.topicFilter.proposeCreate","arguments":{"topicLabel":"职场歧视","keywords":["职场歧视","职场霸凌"]}}]}',
    '用户："最近XX事件刷屏了，帮我屏蔽" → {"tool_calls":[{"name":"capability.hotTopic.proposeCreate","arguments":{"label":"XX事件","keywords":["XX","XX事件"]}}]}',
    '用户："创建热点话题 鸭腿阿姨" → {"tool_calls":[{"name":"capability.hotTopic.proposeCreate","arguments":{"label":"鸭腿阿姨","keywords":["鸭腿阿姨","鸭腿"]}}]}',
    '用户："算了，不弄了" → {"tool_calls":[{"name":"capability.task.cancelProposal","arguments":{}}]}',
    '用户："你好" → 直接回复"你好！有什么可以帮你的？"',
    '',
    '不需要工具时直接输出文本回复。',
  );

  // 当前待确认任务
  if (activeTask && activeTask.status === 'waiting_confirmation') {
    const plan0 = activeTask.plan?.[0];
    const args0 = plan0?.args || {};
    lines.push(
      '',
      '## 当前待确认',
      `话题：${args0.topicLabel || '未知'}，关键词：${(args0.keywords || []).join('、') || '无'}，范围：${(args0.scopes || []).join('、') || '默认'}`,
      '用户修改配置时用新参数重调 proposeCreate，系统自动替换。只改用户提到的字段，其余保持不变。',
      '用户确认 → 直接回复确认文字。用户放弃 → 调 cancelProposal。',
    );
  }

  // 工具执行结果
  if (toolResults && toolResults.length > 0) {
    lines.push('', '## 上一步结果');
    for (const r of toolResults) {
      lines.push(`- ${r.tool}: ${r.success ? '成功' : '失败'} ${r.result ? JSON.stringify(r.result).slice(0, 200) : r.error || ''}`);
    }
  }

  return lines.join('\n');
}

/**
 * 构造 LLM 关键词生成 prompt
 *
 * @param {string} topicLabel        — 话题标签
 * @param {string[]} existingKeywords — 已有关键词
 * @param {string} lang              — 语言代码（'zh' / 其它）
 * @returns {string} LLM prompt
 */
export function buildLLMPrompt(topicLabel, existingKeywords, lang) {
  const langLabel = lang === 'zh' ? '中文' : 'English';
  return [
    `请为话题「${topicLabel}」生成内容过滤关键词。`,
    `要求：`,
    `1. 生成 5-15 个${langLabel}关键词，用于过滤与「${topicLabel}」相关的有害/不想看的内容`,
    `2. 关键词应覆盖不同表达方式（缩写、谐音、变体等）`,
    `3. 已有关键词：${existingKeywords.join('、') || '无'}，请补充不同的词`,
    `4. 只输出关键词，用逗号分隔`,
  ].join('\n');
}

/**
 * 构建澄清问题
 *
 * @param {object} task     — 当前任务对象
 * @param {object} decision — classifyTask 决策结果
 * @returns {Array<object>} 澄清问题列表
 */
export function buildQuestions(task, decision) {
  const qs = [];
  if (!task.entities.topic && !decision.extractedTopic) {
    qs.push({
      id: 'topic', text: '你想屏蔽什么？', options: [],
      hint: '直接告诉我具体内容（如：饭圈互撕、剧透、某个游戏）',
    });
  }
  if (!task.entities.scope?.length) {
    // P1-3: 根据用户偏好调整 scope 选项排序
    const defaultOptions = [
      { label: '评论区', value: 'comment' },
      { label: '回复区', value: 'reply' },
      { label: '动态', value: 'dynamic' },
      { label: '全部', value: 'all' },
    ];
    const prefScopes = task.meta?.userPreferences?.mostUsedScopes || [];
    if (prefScopes.length) {
      defaultOptions.sort((a, b) => {
        const ai = prefScopes.indexOf(a.value);
        const bi = prefScopes.indexOf(b.value);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
    }
    qs.push({ id: 'scope', text: '作用范围？', options: defaultOptions });
  }
  return qs;
}

/**
 * 列出能力清单 — 返回 reply 结构
 *
 * @param {object}   opts
 * @param {string}   opts.lang   — 语言代码
 * @param {function} opts.reply  — reply(type, data) 构造器（通常为 orchestrator._reply.bind(self)）
 * @param {function} opts.t      — 翻译函数 t(lang, key, vars)
 * @returns {object} reply 结构
 */
export function listCapabilities({ lang, reply, t }) {
  const items = [
    { id: 'configure', label: '配置话题偏好', description: '创建/启用/关闭话题偏好过滤规则' },
    { id: 'hotTopic',  label: '创建热点话题', description: '为时效性热点创建临时屏蔽规则' },
    { id: 'keyword',   label: '添加屏蔽词',   description: '添加自定义关键词屏蔽' },
    { id: 'diagnose',  label: '诊断内容',     description: '分析某条内容为什么被过滤 / 没被过滤' },
    { id: 'status',    label: '查看当前状态',  description: '查询已配置的规则、关键词、scope' },
    { id: 'undo',      label: '撤销操作',      description: '回滚最近一次配置变更' },
    { id: 'learn',     label: '学习样本',      description: '把「这种内容也过滤」记入规则' },
  ];
  // ★ 将能力列表格式化为 Markdown，确保 renderConversationReply 可渲染
  const list = items.map(i => `- **${i.label}**：${i.description}`).join('\n');
  return reply('CAPABILITY_LIST', {
    summary: '我目前支持以下功能：\n\n' + list,
    capabilities: items,
  });
}
