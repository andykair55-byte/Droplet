/**
 * domain-classifier.js — 第 1 层决策：业务域判定
 *
 * 决定输入是否属于 CyberShield 业务范围。
 * 命中 OUT_OF_SCOPE → 编排器走专属回拒路径，不再进入任务层。
 *
 * 设计原则：
 *   - 规则优先：明确的 OUT_OF_SCOPE 信号词（写代码/翻译/写诗/聊天/百科）直接判定
 *   - 业务优先：业务信号（屏蔽/过滤/诊断/撤销）即使夹杂其他内容也按业务处理
 *   - 短确认默认 IN_SCOPE：让编排器结合上下文判断是确认还是新任务
 *   - 兜底 IN_SCOPE：避免误杀，让编排器走完整意图识别
 *
 * v2.1 — 软/硬越界区分：
 *   - HARD_OUT_OF_SCOPE：编程/翻译/纯聊天/算术 — 几乎不可能属于业务
 *   - SOFT_OUT_OF_SCOPE：百科/知识查询 — 可能是用户在问业务概念（"什么是人身攻击"）
 *     命中 soft 时不直接返回 OUT_OF_SCOPE，而是降低置信度让后续层兜底
 */

import { AGENT_DOMAIN } from './types.js';

// ── HARD_OUT_OF_SCOPE 词典（绝对越界：编程/翻译/纯聊天/算术）──
const HARD_OUT_OF_SCOPE_PATTERNS = [
  // 编程（"写一段代码"、"帮我写代码"、"写个程序"等）
  new RegExp('(?:^|[\\s\\u3000，。.!?;:；：\\u4e00-\\u9fa5])写[一]?[个段篇]?[\\s\\u3000]*(代码|程序|脚本|函数|算法|正则|sql|html|css|js|java|python|ts|jsx|tsx)', 'i'),
  new RegExp('(?:^|[\\s\\u3000，。.!?;:；：\\u4e00-\\u9fa5])(code|coding|program|debug)', 'i'),
  // 翻译
  new RegExp('(?:^|[\\s\\u3000，。.!?;:；：\\u4e00-\\u9fa5])(翻译|译成|translate|translation)', 'i'),
  // 写作（与配置/过滤/规则无关的纯写作）
  new RegExp('(?:^|[\\s\\u3000，。.!?;:；：\\u4e00-\\u9fa5])写.{0,8}(诗|词|歌词|小说|故事|文章|文案|读后感|影评|书评|日记)'),
  // 通用聊天（严格匹配：仅当整句都是聊天问候时）
  new RegExp('^\\s*(讲[个]?笑话|说[个]?笑话|聊天|闲聊|陪我|你好|hello|hi|hey)[\\s\\u3000,。.！!]*$', 'i'),
  // 数学/计算
  new RegExp('^\\s*\\d+[\\s\\u3000]*[\\+\\-\\*\\/×x÷][\\s\\u3000]*\\d+'),
  new RegExp('(?:^|[\\s\\u3000，。.!?;:；：\\u4e00-\\u9fa5])(计算|算[一]?[下个]?|求[值和]?)[\\s\\u3000]*\\d'),
];

// ── SOFT_OUT_OF_SCOPE 词典（可能越界：百科/知识查询，交由后续层兜底）──
// 命中 soft 时返回 IN_SCOPE 但降低置信度，让意图识别层决定
const SOFT_OUT_OF_SCOPE_PATTERNS = [
  // 百科查询（"什么是X"可能是问业务概念如"什么是人身攻击"）
  new RegExp('什么是.{0,8}[？?]?\\s*$'),
  new RegExp('(what|who)\\s+is\\b', 'i'),
  new RegExp('how\\s+(do|does|did|can|to)\\b', 'i'),
];

// ── 业务信号（任一命中 → 强制 IN_SCOPE）────────────────────
const IN_SCOPE_SIGNALS = [
  // 屏蔽/过滤/拦截/隐藏 类动词
  new RegExp('(屏蔽|过滤|拦截|隐藏|不想看|不要|拉黑|讨厌|屏蔽掉|看烦|不想见|不想浏览|不想读|不想听|不想再看到)'),
  // 开关配置类
  new RegExp('(开启|启用|关闭|禁用|打开|关掉|调整|设置|修改|改)[\\s\\u3000,。.]{0,6}(过滤|话题|规则|关键词|语义|检测|识别|敏感度|阈值|scope)'),
  new RegExp('(过滤|话题|规则|关键词|语义|检测|识别|scope)[\\s\\u3000,。.]{0,4}(开启|启用|关闭|禁用|打开|关掉|列表|哪些|什么)'),
  // 诊断/排查
  new RegExp('(为什么|怎么|咋)[\\s\\u3000,。.]{0,6}(没|不)(过滤|拦截|屏蔽|屏蔽掉|命中|识别|拦)'),
  new RegExp('(诊断|排查|分析下|分析一下|看下|看一下)[\\s\\u3000,。.]{0,6}(这条|这个|该|那|这|帖子|评论|回复|内容|文本)'),
  // 撤销/回滚
  new RegExp('(撤销|回滚|undo|恢复上一|恢复之前|回到之前|撤销刚才|撤销最近)'),
  // 询问当前状态
  new RegExp('^(现在|当前|目前)[\\s\\u3000]*(过滤|话题|规则|配置|状态|开了啥|有什么)'),
  new RegExp('过滤了[\\s\\u3000]*(什么|哪些|啥|几个|多少)'),
  // 学习/规则相关
  new RegExp('(学习|记住|以后都|这种都|下次也|都给我(过滤|屏蔽|拦))'),
  // ── 新增话题信号词 ──
  // 骚扰类：人肉/跟踪/恐吓/性骚扰
  new RegExp('(人肉|开盒|挂人|社工|查户口|曝光隐私|dox|doxxing|stalking|swatting)'),
  new RegExp('(杀了你|弄死|砍死|去死|去死吧|死亡威胁|暴力恐吓|death threat|kill you|gonna kill)'),
  new RegExp('(约吗|发照片|骚扰私信|发裸照|求私聊|网恋吗|勾引|send pics|nudes|sexting|creep)'),
  // 歧视类：地域/年龄/职业
  new RegExp('(地域黑|地域歧视|地域攻击|某地人滚|某省人|regional discrimination)'),
  new RegExp('(倚老卖老|老东西|小屁孩|中年油腻|老不死|boomer|ageist|age discrimination)'),
  new RegExp('(厂妹|打工人歧视|搬砖的|底层|下等人|classist|wage slave|low class)'),
  // 社区毒性类：饭圈/游戏/杠精/网暴/造谣
  new RegExp('(控评|反黑|站姐|私生饭|饭圈互撕|踩一捧一|撕番|抢番|stan war|fan war|toxic fandom)'),
  new RegExp('(菜鸡|送人头|挂机|坑队友|恶意送分|noob|feeder|griefer|rage quit)'),
  new RegExp('(杠精|键盘侠|你行你上|抬杠|撕逼|troll|keyboard warrior|contrarian)'),
  new RegExp('(网暴|网络暴力|网暴致死|被网暴|围攻|cyberbullying|cancel culture)'),
  new RegExp('(造谣|传谣|假消息|谣言|不实信息|捏造|misinformation|fake news|disinformation)'),
  // 内容偏好类：八卦/广告/引战/身材羞辱/内卷
  new RegExp('(黑料|塌房|实锤|吃瓜|八卦|黑帖|爆料|gossip|scandal|celebrity drama)'),
  new RegExp('(加微信|私聊优惠|优惠码|免费领取|点击链接|促销|推广|spam|click here|free offer)'),
  new RegExp('(挑事|引战|带节奏|挑拨|站队|flame bait|stir drama)'),
  new RegExp('(身材羞辱|外貌攻击|肥猪|干瘦|长得丑|胖子|fat shame|body shame|appearance attack)'),
  new RegExp('(内卷|卷王|躺平|鸡娃|996|加班|rat race|burnout|overwork|hustle culture)'),
  // 政治类：极端政治/民族主义/仇恨言论
  new RegExp('(极左|极右|五毛|美分|小粉红|公知|带路党|extremist|partisan|political radical)'),
  new RegExp('(极端民族主义|精日|精美|卖国贼|崇洋媚外|ultranationalist|xenophobe|chauvinist)'),
  new RegExp('(仇恨言论|煽动仇恨|歧视性言论|排外|hate speech|incitement|bigot|xenophobia)'),
  // 心理健康类：自残/自杀/抑郁
  new RegExp('(自杀|自残|想死|活不下去|割腕|跳楼|suicide|self-harm|kill myself|end it all)'),
  new RegExp('(抑郁|焦虑|恐慌|心理崩溃|精神崩溃|绝望|depression|anxiety|mental breakdown|despair)'),
];

/**
 * 判定业务域
 * @param {string} input
 * @returns {{ domain: 'in_scope' | 'out_of_scope', reason: string, confidence: number }}
 */
export function classifyDomain(input) {
  const text = String(input || '').trim();
  if (!text) {
    return { domain: AGENT_DOMAIN.OUT_OF_SCOPE, reason: 'empty', confidence: 0 };
  }

  // 1) 强业务信号优先（业务永远优于越界判定）
  for (const re of IN_SCOPE_SIGNALS) {
    if (re.test(text)) {
      return { domain: AGENT_DOMAIN.IN_SCOPE, reason: 'in_scope_signal', confidence: 0.9 };
    }
  }

  // 2) 硬越界信号（编程/翻译/纯聊天/算术 — 几乎不可能属于业务）
  for (const re of HARD_OUT_OF_SCOPE_PATTERNS) {
    if (re.test(text)) {
      return { domain: AGENT_DOMAIN.OUT_OF_SCOPE, reason: 'hard_out_of_scope', confidence: 0.9 };
    }
  }

  // 3) 软越界信号（百科/知识查询 — 可能是在问业务概念）
  //    不直接返回 OUT_OF_SCOPE，而是降低置信度让后续意图层兜底
  for (const re of SOFT_OUT_OF_SCOPE_PATTERNS) {
    if (re.test(text)) {
      return { domain: AGENT_DOMAIN.IN_SCOPE, reason: 'soft_out_of_scope', confidence: 0.35 };
    }
  }

  // 4) 极短确认/取消 → 视为上下文相关（默认 in_scope，让编排器结合 active task 判断）
  if (/^(好|是|对|行|可以|继续|确认|ok|yes|y|sure|嗯|哦|好的|对的|没错|好的吧|不要|算了|取消|no|n|nope)\s*[。.！!]?\s*$/i.test(text)) {
    return { domain: AGENT_DOMAIN.IN_SCOPE, reason: 'short_ack', confidence: 0.6 };
  }

  // 5) 兜底：默认 in_scope（让编排器走意图识别）
  return { domain: AGENT_DOMAIN.IN_SCOPE, reason: 'default_in_scope', confidence: 0.5 };
}
