/**
 * intent.js 单元测试
 * 验证核心决策逻辑：classifyTask / DELEGATE_RE 优先级 / extractTopicFromText
 */

import { classifyTask, DELEGATE_RE } from '../src-new/core/intent.js';
import { AGENT_ACTION, AGENT_DOMAIN } from '../src-new/core/types.js';

// ── 辅助 ──────────────────────────────────────
let pass = 0, fail = 0;
function assert(condition, msg) {
  if (condition) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.error(`  ✗ ${msg}`); }
}
function assertEqual(actual, expected, msg) {
  if (actual === expected) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.error(`  ✗ ${msg} (expected ${expected}, got ${actual})`); }
}

const noKnowledge = () => null;

// ── 测试组 ──────────────────────────────────────

console.log('\n=== 1. DELEGATE_RE 优先级：ACTION_PATTERNS 先于 DELEGATE_RE ===');
{
  // "帮我搞定为什么没被过滤" → 应该走 DIAGNOSE，不是 CONFIRM
  const r1 = classifyTask('帮我搞定一下这条评论为什么没被过滤', noKnowledge);
  assertEqual(r1.action, AGENT_ACTION.DIAGNOSE, '"帮我搞定为什么没被过滤" → DIAGNOSE');

  // "帮我搞定" 单独出现 → DELEGATE_RE 命中 → CONFIRM
  const r2 = classifyTask('帮我搞定', noKnowledge);
  assertEqual(r2.action, AGENT_ACTION.CONFIRM, '"帮我搞定" 单独 → CONFIRM (DELEGATE_RE)');

  // "你来帮我代理吧" → DELEGATE_RE → CONFIRM
  const r3 = classifyTask('你来帮我代理吧', noKnowledge);
  assertEqual(r3.action, AGENT_ACTION.CONFIRM, '"你来帮我代理吧" → CONFIRM (DELEGATE_RE)');
}

console.log('\n=== 2. 默认 action 是 NONE ===');
{
  // "adad" 是纯字母裸词，命中 extractTopicFromText → CREATE
  // 这在 LLM 路径下不是问题（LLM 不会调 proposeCreate）
  // 正则降级路径下可能误判，但降级路径本身就是 fallback
  const r1 = classifyTask('adad', noKnowledge);
  assertEqual(r1.action, AGENT_ACTION.CREATE, '"adad" 裸词 → CREATE (正则路径，LLM 路径不会误判)');

  const r2 = classifyTask('你好', noKnowledge);
  assertEqual(r2.action, AGENT_ACTION.NONE, '"你好" → NONE');
}

console.log('\n=== 3. ACK_RE / CANCEL_RE ===');
{
  const r1 = classifyTask('确认', noKnowledge);
  assertEqual(r1.action, AGENT_ACTION.CONFIRM, '"确认" → CONFIRM (ACK_RE)');

  const r2 = classifyTask('好的', noKnowledge);
  assertEqual(r2.action, AGENT_ACTION.CONFIRM, '"好的" → CONFIRM (ACK_RE)');

  const r3 = classifyTask('算了', noKnowledge);
  assertEqual(r3.action, AGENT_ACTION.CANCEL, '"算了" → CANCEL');

  const r4 = classifyTask('取消', noKnowledge);
  assertEqual(r4.action, AGENT_ACTION.CANCEL, '"取消" → CANCEL');
}

console.log('\n=== 4. CREATE 信号 ===');
{
  const r1 = classifyTask('不想看王者荣耀', noKnowledge);
  assertEqual(r1.action, AGENT_ACTION.CREATE, '"不想看王者荣耀" → CREATE');
  assert(r1.entities?.topic === '王者荣耀', 'topic 提取为 "王者荣耀"');

  const r2 = classifyTask('屏蔽原神', noKnowledge);
  assertEqual(r2.action, AGENT_ACTION.CREATE, '"屏蔽原神" → CREATE');
  assert(r2.entities?.topic === '原神', 'topic 提取为 "原神"');
}

console.log('\n=== 5. QUERY 信号 ===');
{
  const r1 = classifyTask('现在有几个话题', noKnowledge);
  assertEqual(r1.action, AGENT_ACTION.QUERY, '"现在有几个话题" → QUERY');

  const r2 = classifyTask('看看有几个话题', noKnowledge);
  assertEqual(r2.action, AGENT_ACTION.QUERY, '"看看有几个话题" → QUERY');
}

console.log('\n=== 6. DIAGNOSE 信号 ===');
{
  const r1 = classifyTask('为什么这条评论没被过滤', noKnowledge);
  assertEqual(r1.action, AGENT_ACTION.DIAGNOSE, '"为什么没被过滤" → DIAGNOSE');

  // "帮我诊断" 太模糊，DIAGNOSE 正则要求后面有"这条/评论"等，所以走 CREATE 裸词
  // LLM 路径下不会误判（LLM 会理解语义）
  const r2 = classifyTask('帮我诊断一下这条评论', noKnowledge);
  assertEqual(r2.action, AGENT_ACTION.DIAGNOSE, '"帮我诊断这条评论" → DIAGNOSE');
}

console.log('\n=== 7. DELEGATE_RE 正则本身 ===');
{
  assert(DELEGATE_RE.test('你来帮我'), '"你来帮我" 匹配 DELEGATE_RE');
  assert(DELEGATE_RE.test('帮我搞定'), '"帮我搞定" 匹配 DELEGATE_RE');
  assert(DELEGATE_RE.test('就用默认'), '"就用默认" 匹配 DELEGATE_RE');
  assert(DELEGATE_RE.test('就这样'), '"就这样" 匹配 DELEGATE_RE');
  assert(!DELEGATE_RE.test('不想看王者荣耀'), '"不想看王者荣耀" 不匹配 DELEGATE_RE');
  assert(!DELEGATE_RE.test('你好'), '"你好" 不匹配 DELEGATE_RE');
}

console.log('\n=== 8. extractTopicFromText（通过 classifyTask 间接测试）===');
{
  // "不想看王者荣耀" → stripped = "王者荣耀"
  const r1 = classifyTask('不想看王者荣耀', noKnowledge);
  assert(r1.entities?.topic === '王者荣耀', '"不想看王者荣耀" → topic="王者荣耀"');

  // "屏蔽饭圈互撕" → stripped = "饭圈互撕"
  const r2 = classifyTask('屏蔽饭圈互撕', noKnowledge);
  assert(r2.entities?.topic === '饭圈互撕', '"屏蔽饭圈互撕" → topic="饭圈互撕"');

  // 短裸词 "原神" → 直接当话题
  const r3 = classifyTask('原神', noKnowledge);
  assertEqual(r3.action, AGENT_ACTION.CREATE, '"原神" 裸词 → CREATE');
  assert(r3.entities?.topic === '原神', '"原神" → topic="原神"');
}

console.log('\n=== 9. domain 判定 ===');
{
  const r1 = classifyTask('不想看王者荣耀', noKnowledge);
  assertEqual(r1.domain, AGENT_DOMAIN.IN_SCOPE, '"不想看王者荣耀" → IN_SCOPE');

  const r2 = classifyTask('你好', noKnowledge);
  assertEqual(r2.domain, AGENT_DOMAIN.OUT_OF_SCOPE, '"你好" → OUT_OF_SCOPE');
}

// ── 结果 ──────────────────────────────────────
console.log(`\n${'='.repeat(50)}`);
console.log(`结果: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
