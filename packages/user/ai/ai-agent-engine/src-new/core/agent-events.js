/**
 * agent-events.js — Agent 事件协议定义
 *
 * 编排器通过 _emit() 发出这些事件，UI 层通过 onEvent() 订阅。
 * 新事件用 'agent:' 前缀，旧事件（task_created 等）保留向后兼容。
 */

// ── 事件类型常量 ──
export const AGENT_EVENTS = {
  // 流式输出
  STREAM: 'agent:stream',
  THINKING: 'agent:thinking',
  THINKING_STREAM: 'agent:thinking_stream',

  // 状态指示
  TOOL_CALL: 'agent:tool_call',
  STATUS: 'agent:status',

  // 最终结果
  DONE: 'agent:done',
  ERROR: 'agent:error',
};

// ── thinking phase 枚举 ──
export const THINKING_PHASE = {
  LLM_CALL: 'llm_call',
  TOOL_EXEC: 'tool_exec',
  REGEX_ROUTE: 'regex_route',
};

// ── tool_call phase 枚举 ──
export const TOOL_PHASE = {
  START: 'start',
  END: 'end',
};

// ── status 枚举 ──
export const AGENT_STATUS = {
  DEGRADED: 'degraded',
  RECOVERED: 'recovered',
  CONFIRMING: 'confirming',
  EXECUTING: 'executing',
};

/**
 * 校验事件 payload 的基本结构
 * @param {object} evt
 * @returns {boolean} 是否合法
 */
export function validateEvent(evt) {
  if (!evt || typeof evt.type !== 'string') return false;

  switch (evt.type) {
    case AGENT_EVENTS.STREAM:
      return typeof evt.chunk === 'string' && typeof evt.done === 'boolean';
    case AGENT_EVENTS.THINKING_STREAM:
      return typeof evt.chunk === 'string' && typeof evt.done === 'boolean';
    case AGENT_EVENTS.THINKING:
      return typeof evt.phase === 'string' && typeof evt.round === 'number';
    case AGENT_EVENTS.TOOL_CALL:
      return typeof evt.name === 'string' && typeof evt.phase === 'string';
    case AGENT_EVENTS.STATUS:
      return typeof evt.status === 'string';
    case AGENT_EVENTS.DONE:
      return !!evt.action;
    case AGENT_EVENTS.ERROR:
      return !!evt.error;
    default:
      // 旧事件类型不做校验
      return true;
  }
}
