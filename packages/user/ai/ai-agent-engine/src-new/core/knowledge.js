/**
 * knowledge.js — 话题知识库（重定义版）
 *
 * 对齐 topic-filter.js 的分类体系，同时扩展"内容偏好"类别。
 * 知识库的职责：
 *   1. 用户输入 → 匹配话题/分类
 *   2. 话题 → 生成可选的过滤范围（platform scopes）与灵敏度档位（sensitivityLevels）
 *   3. 为意图分类提供主题匹配依据
 *
 * scope 语义说明（v2 统一）：
 *   - scopes: 平台区域标识（comment / reply / dynamic / video / dm ...），表示「在哪里过滤」
 *   - sensitivityLevels: 过滤强度档位（sensitivity_all / sensitivity_attack ...），表示「过滤多狠」
 *   两套语义独立存放，不再共用字段名。
 *
 * 与 topic-filter.js 的关系：
 *   - topic-filter 管理"是否启用 + 关键词列表 + AI 学习规则"
 *   - knowledge 管理"话题语义理解 + scope 定义 + 分类体系"
 *   - 两者通过 topicId 共享标识
 */

// ─── 分类定义 ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    id: 'harassment',
    label: { zh: '人身攻击/骚扰', en: 'Harassment' },
    keywords: ['骂人', '攻击', '骚扰', '威胁', '骂', '喷', '人肉', '跟踪', '恐吓', 'harass', 'attack', 'bully', 'stalking', 'dox', 'threat'],
    description: '针对个人的恶意攻击和骚扰行为',
    topicFilterIds: ['personal_attack', 'spam_harass', 'cyberstalking', 'death_threat', 'sexual_harassment'],
  },
  {
    id: 'discrimination',
    label: { zh: '歧视/对立', en: 'Discrimination' },
    keywords: ['歧视', '对立', '攻击', '地图炮', '偏见', '地域', '年龄', '职业', 'racist', 'sexist', 'discrimination', 'ageist', 'classist'],
    description: '基于性别、种族、地域、年龄、职业的歧视和对立',
    topicFilterIds: ['gender_attack', 'race_attack', 'regional_discrimination', 'age_discrimination', 'occupational_discrimination'],
  },
  {
    id: 'toxic_community',
    label: { zh: '社区毒性', en: 'Toxic community' },
    keywords: ['饭圈', '游戏圈', '互撕', '引战', '喷子', '杠精', '网暴', '造谣', 'toxic', 'flame', 'troll', 'cyberbullying', 'rumor'],
    description: '特定社区中的争吵和毒性互动',
    topicFilterIds: ['game_toxic', 'fan_war', 'fan_war_detail', 'game_toxic_detail', 'keyboard_warrior', 'cancel_culture', 'rumor_mongering'],
  },
  {
    id: 'content_preference',
    label: { zh: '内容偏好', en: 'Content preference' },
    keywords: ['不想看', '不感兴趣', '剧透', '屏蔽', '过滤', '八卦', '广告', '引战', '内卷', 'filter', 'block', 'spoiler', 'hide', 'gossip', 'spam'],
    description: '用户不想看到的特定话题内容',
    topicFilterIds: ['spoiler', 'celebrity_gossip', 'spam_ads', 'flame_bait', 'body_shaming', 'academic_pressure'],
  },
  {
    id: 'political',
    label: { zh: '政治极端', en: 'Political extreme' },
    keywords: ['极端', '政治', '洗脑', '民族主义', '仇恨', 'political', 'extreme', 'nationalist', 'hate'],
    description: '极端政治言论和仇恨言论',
    topicFilterIds: ['political_extreme', 'political_extreme_detail', 'nationalism_toxic', 'hate_speech_general'],
  },
  {
    id: 'mental_health',
    label: { zh: '心理健康', en: 'Mental health' },
    keywords: ['自杀', '自残', '抑郁', '焦虑', '想死', '绝望', 'suicide', 'self-harm', 'depression', 'anxiety', 'mental health'],
    description: '涉及自残、自杀及心理健康危机的内容',
    topicFilterIds: ['self_harm', 'depression_trigger'],
  },
];

// ─── 主题条目 ──────────────────────────────────────────────────────────────────
// 每个 topic 通过 topicFilterId 关联到 topic-filter.js 中的话题
// scopes 定义用户可选的过滤粒度

const TOPICS = [
  // ── 骚扰/攻击类 ──────────────────────────────────────────

  {
    id: 'gender_attack',
    topicFilterId: 'gender_attack',
    name: { zh: '性别攻击/男女对立', en: 'Gender attack' },
    category: 'discrimination',
    aliases: ['男女对立', '性别战争', '打拳', '田园女权', '直男癌'],
    keywords: ['女拳', '男拳', '田园女权', '直男癌', '渣男', '渣女', '绿茶', '普信男', '普信女'],
    sensitivityLevels: [
      { id: 'sensitivity_all', label: '全部屏蔽', reason: '完全不想看到相关内容', sensitivity: 'medium' },
      { id: 'sensitivity_attack', label: '仅屏蔽攻击性内容', reason: '保留正常讨论', sensitivity: 'low' },
      { id: 'sensitivity_implicit', label: '含隐性攻击也屏蔽', reason: '包括阴阳怪气和暗讽', sensitivity: 'high' },
    ],
    scopes: [
      { id: 'comment', label: '评论区' },
      { id: 'reply', label: '回复区' },
      { id: 'dynamic', label: '动态' },
    ],
  },
  {
    id: 'race_attack',
    topicFilterId: 'race_attack',
    name: { zh: '种族/地域歧视', en: 'Race/region discrimination' },
    category: 'discrimination',
    aliases: ['地域黑', '地图炮', '种族歧视'],
    keywords: ['地域黑', '河南人', '东北人偷', '上海人排外', '阿三', '棒子'],
    sensitivityLevels: [
      { id: 'sensitivity_all', label: '全部屏蔽', reason: '完全不想看到相关内容', sensitivity: 'medium' },
      { id: 'sensitivity_attack', label: '仅屏蔽恶意攻击', reason: '保留客观讨论', sensitivity: 'low' },
    ],
    scopes: [
      { id: 'comment', label: '评论区' },
      { id: 'reply', label: '回复区' },
      { id: 'dynamic', label: '动态' },
    ],
  },
  {
    id: 'personal_attack',
    topicFilterId: 'personal_attack',
    name: { zh: '人身攻击/外貌羞辱', en: 'Personal attack' },
    category: 'harassment',
    aliases: ['人身攻击', '外貌羞辱', '网络暴力'],
    keywords: ['丑八怪', '肥猪', '死胖子', '矮冬瓜', '整容怪', '土鳖'],
    sensitivityLevels: [
      { id: 'sensitivity_all', label: '全部屏蔽', reason: '任何人身攻击都不想看', sensitivity: 'medium' },
      { id: 'sensitivity_severe', label: '仅屏蔽严重攻击', reason: '轻微调侃保留', sensitivity: 'low' },
    ],
    scopes: [
      { id: 'comment', label: '评论区' },
      { id: 'reply', label: '回复区' },
      { id: 'dynamic', label: '动态' },
    ],
  },
  {
    id: 'spam_harass',
    topicFilterId: 'spam_harass',
    name: { zh: '骚扰/刷屏', en: 'Spam/harassment' },
    category: 'harassment',
    aliases: ['刷屏', '水军', 'spam'],
    keywords: [],
    sensitivityLevels: [
      { id: 'sensitivity_all', label: '全部屏蔽', reason: '不想看到任何刷屏内容', sensitivity: 'medium' },
      { id: 'sensitivity_repeat', label: '仅屏蔽重复内容', reason: '相似内容去重', sensitivity: 'low' },
    ],
    scopes: [
      { id: 'comment', label: '评论区' },
      { id: 'reply', label: '回复区' },
      { id: 'dynamic', label: '动态' },
    ],
  },
  {
    id: 'game_toxic',
    topicFilterId: 'game_toxic',
    name: { zh: '游戏圈争吵', en: 'Game toxicity' },
    category: 'toxic_community',
    aliases: ['游戏 toxicity', '游戏喷子'],
    keywords: ['菜鸡', '坑货', '送人头', '挂机狗'],
    sensitivityLevels: [
      { id: 'sensitivity_all', label: '全部屏蔽', reason: '不想看游戏圈争吵', sensitivity: 'medium' },
      { id: 'sensitivity_attack', label: '仅屏蔽人身攻击', reason: '正常游戏讨论保留', sensitivity: 'low' },
    ],
    scopes: [
      { id: 'comment', label: '评论区' },
      { id: 'reply', label: '回复区' },
      { id: 'dynamic', label: '动态' },
    ],
  },
  {
    id: 'fan_war',
    topicFilterId: 'fan_war',
    name: { zh: '饭圈争吵', en: 'Fan war' },
    category: 'toxic_community',
    aliases: ['饭圈', '追星争吵', '粉圈'],
    keywords: ['糊了', '扑街', '洗白', '黑料', '塌房', '翻车', '脱粉'],
    sensitivityLevels: [
      { id: 'sensitivity_all', label: '全部屏蔽', reason: '不想看任何饭圈内容', sensitivity: 'medium' },
      { id: 'sensitivity_war', label: '仅屏蔽争吵', reason: '正常追星内容保留', sensitivity: 'low' },
    ],
    scopes: [
      { id: 'comment', label: '评论区' },
      { id: 'reply', label: '回复区' },
      { id: 'dynamic', label: '动态' },
    ],
  },
  {
    id: 'spoiler',
    topicFilterId: 'spoiler',
    name: { zh: '剧透', en: 'Spoiler' },
    category: 'content_preference',
    aliases: ['剧透', '透剧'],
    keywords: ['剧透', '死了', '结局是', '最后是'],
    sensitivityLevels: [
      { id: 'sensitivity_all', label: '全部屏蔽', reason: '不想被任何剧透', sensitivity: 'medium' },
      { id: 'sensitivity_specific', label: '仅屏蔽特定作品', reason: '只屏蔽我说的那部作品的剧透', sensitivity: 'low' },
    ],
    scopes: [
      { id: 'comment', label: '评论区' },
      { id: 'reply', label: '回复区' },
      { id: 'dynamic', label: '动态' },
    ],
  },
  {
    id: 'political_extreme',
    topicFilterId: 'political_extreme',
    name: { zh: '极端政治', en: 'Extreme politics' },
    category: 'political',
    aliases: ['极端政治', '政治极端'],
    keywords: [],
    sensitivityLevels: [
      { id: 'sensitivity_all', label: '全部屏蔽', reason: '不想看极端政治内容', sensitivity: 'medium' },
    ],
    scopes: [
      { id: 'comment', label: '评论区' },
      { id: 'reply', label: '回复区' },
      { id: 'dynamic', label: '动态' },
    ],
  },

  // ── 内容偏好扩展（CyberShield 扩展域）─────────────────────
  // 这些话题不对应 topic-filter 的内置分类，
  // 引擎会通过 rule-generator 动态创建自定义话题

  {
    id: 'pref_game_wzry',
    topicFilterId: null,  // 无预置的 topic-filter 条目，运行时动态创建
    name: { zh: '王者荣耀', en: 'Honor of Kings' },
    category: 'content_preference',
    aliases: ['王者', '农药', 'wzry', 'Honor of Kings'],
    keywords: ['王者荣耀', '王者', '农药', '上分', '排位', '英雄', '皮肤', '峡谷'],
    sensitivityLevels: [
      { id: 'sensitivity_all', label: '全部屏蔽', reason: '完全不想看王者荣耀相关内容', sensitivity: 'medium' },
      { id: 'sensitivity_discussion', label: '仅屏蔽讨论', reason: '保留官方公告和赛事', sensitivity: 'low' },
      { id: 'sensitivity_toxic', label: '仅屏蔽争吵', reason: '正常攻略和讨论保留', sensitivity: 'low' },
    ],
    scopes: [
      { id: 'comment', label: '评论区' },
      { id: 'reply', label: '回复区' },
      { id: 'dynamic', label: '动态' },
      { id: 'video', label: '视频' },
    ],
  },
  {
    id: 'pref_game_ys',
    topicFilterId: null,
    name: { zh: '原神', en: 'Genshin Impact' },
    category: 'content_preference',
    aliases: ['原神', 'Genshin'],
    keywords: ['原神', 'Genshin', '抽卡', '圣遗物', '深渊', '璃月', '蒙德'],
    sensitivityLevels: [
      { id: 'sensitivity_all', label: '全部屏蔽', reason: '完全不想看原神相关内容', sensitivity: 'medium' },
      { id: 'sensitivity_discussion', label: '仅屏蔽讨论', reason: '保留攻略和官方内容', sensitivity: 'low' },
    ],
    scopes: [
      { id: 'comment', label: '评论区' },
      { id: 'reply', label: '回复区' },
      { id: 'dynamic', label: '动态' },
      { id: 'video', label: '视频' },
    ],
  },

  // ── 骚扰/攻击类扩展 ──────────────────────────────────────

  {
    id: 'cyberstalking',
    topicFilterId: 'cyberstalking',
    name: { zh: '网络跟踪/人肉搜索', en: 'Cyberstalking / Doxxing' },
    description: { zh: '人肉搜索、开盒、挂人、社工等侵犯隐私的网络跟踪行为', en: 'Doxxing, stalking, swatting and other privacy-violating online tracking behaviors' },
    category: 'harassment',
    aliases: ['人肉搜索', '开盒', '挂人', '社工', 'doxxing', 'stalking'],
    keywords: {
      zh: ['人肉', '开盒', '挂人', '社工', '人肉搜索', '查户口', '曝光隐私'],
      en: ['dox', 'doxxing', 'stalking', 'swatting', 'expose'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的跟踪/人肉内容', sensitivity: 'high' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的跟踪/人肉内容', sensitivity: 'high' },
    ],
    enabled: false,
    source: 'builtin',
  },
  {
    id: 'death_threat',
    topicFilterId: 'death_threat',
    name: { zh: '死亡威胁/暴力恐吓', en: 'Death threat / Violence intimidation' },
    description: { zh: '包含杀人、暴力恐吓等严重威胁人身安全的言论', en: 'Statements containing death threats and violent intimidation' },
    category: 'harassment',
    aliases: ['死亡威胁', '暴力恐吓', '杀人威胁'],
    keywords: {
      zh: ['杀了你', '弄死', '砍死', '弄死你', '弄死他', '去死', '去死吧', '弄死你全家'],
      en: ['kill you', 'death threat', 'gonna kill', 'murder'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的死亡威胁', sensitivity: 'high' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的死亡威胁', sensitivity: 'high' },
    ],
    enabled: false,
    source: 'builtin',
  },
  {
    id: 'sexual_harassment',
    topicFilterId: 'sexual_harassment',
    name: { zh: '性骚扰/猥亵言论', en: 'Sexual harassment' },
    description: { zh: '包含性骚扰、猥亵、不当性暗示的言论', en: 'Statements containing sexual harassment, indecency, or inappropriate sexual suggestions' },
    category: 'harassment',
    aliases: ['性骚扰', '猥亵言论', '骚扰私信'],
    keywords: {
      zh: ['约吗', '发照片', '骚扰私信', '发裸照', '求私聊', '网恋吗', '勾引'],
      en: ['send pics', 'nudes', 'sexting', 'harass', 'creep'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的性骚扰言论', sensitivity: 'high' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的性骚扰言论', sensitivity: 'high' },
    ],
    enabled: false,
    source: 'builtin',
  },

  // ── 歧视类扩展 ──────────────────────────────────────────

  {
    id: 'regional_discrimination',
    topicFilterId: 'regional_discrimination',
    name: { zh: '地域歧视', en: 'Regional discrimination' },
    description: { zh: '针对特定地区、省份人群的歧视和攻击言论', en: 'Discriminatory and attacking statements targeting people from specific regions or provinces' },
    category: 'discrimination',
    aliases: ['地域黑', '地图炮', '地域攻击'],
    keywords: {
      zh: ['河南人', '东北人', '地域黑', '地域歧视', '某地人滚', '某省人'],
      en: ['regional slur', 'regional discrimination'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的地域歧视', sensitivity: 'medium' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的地域歧视', sensitivity: 'medium' },
    ],
    enabled: false,
    source: 'builtin',
  },
  {
    id: 'age_discrimination',
    topicFilterId: 'age_discrimination',
    name: { zh: '年龄歧视', en: 'Age discrimination' },
    description: { zh: '针对特定年龄段人群的歧视和攻击言论', en: 'Discriminatory and attacking statements targeting people of specific age groups' },
    category: 'discrimination',
    aliases: ['年龄歧视', '代际攻击'],
    keywords: {
      zh: ['倚老卖老', '00后', '老东西', '小屁孩', '幼稚', '中年油腻', '老不死'],
      en: ['boomer', 'ok boomer', 'ageist', 'age discrimination'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的年龄歧视', sensitivity: 'medium' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的年龄歧视', sensitivity: 'medium' },
    ],
    enabled: false,
    source: 'builtin',
  },
  {
    id: 'occupational_discrimination',
    topicFilterId: 'occupational_discrimination',
    name: { zh: '职业歧视', en: 'Occupational discrimination' },
    description: { zh: '针对特定职业、社会阶层人群的歧视和攻击言论', en: 'Discriminatory and attacking statements targeting people of specific occupations or social classes' },
    category: 'discrimination',
    aliases: ['职业歧视', '阶层歧视', '底层歧视'],
    keywords: {
      zh: ['外卖员歧视', '厂妹', '打工人歧视', '搬砖的', '底层', '下等人'],
      en: ['classist', 'wage slave', 'low class'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的职业歧视', sensitivity: 'medium' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的职业歧视', sensitivity: 'medium' },
    ],
    enabled: false,
    source: 'builtin',
  },

  // ── 社区毒性类扩展 ──────────────────────────────────────

  {
    id: 'fan_war_detail',
    topicFilterId: 'fan_war_detail',
    name: { zh: '饭圈互撕细化', en: 'Fan war (detailed)' },
    description: { zh: '饭圈控评、反黑、私生饭、撕番等细化互撕行为', en: 'Detailed fan war behaviors including astroturfing, anti-hate campaigns, sasaeng fans, credit disputes' },
    category: 'toxic_community',
    aliases: ['控评', '反黑', '私生饭', '撕番'],
    keywords: {
      zh: ['控评', '反黑', '站姐', '私生饭', '饭圈互撕', '互撕', '踩一捧一', '撕番', '抢番', '饭圈'],
      en: ['stan war', 'fan war', 'toxic fandom', 'shipping war'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的饭圈互撕', sensitivity: 'medium' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的饭圈互撕', sensitivity: 'medium' },
    ],
    enabled: false,
    source: 'builtin',
  },
  {
    id: 'game_toxic_detail',
    topicFilterId: 'game_toxic_detail',
    name: { zh: '游戏毒性细化', en: 'Game toxicity (detailed)' },
    description: { zh: '游戏中的菜鸡辱骂、送人头、挂机、恶意送分等细化毒性行为', en: 'Detailed game toxicity including noob shaming, feeding, AFK, griefing, and rage quitting' },
    category: 'toxic_community',
    aliases: ['游戏喷子', '游戏挂机', '送人头'],
    keywords: {
      zh: ['菜鸡', '送人头', '挂机', '喷子', '坑队友', '演员举报', '恶意送分', '骂人'],
      en: ['noob', 'feeder', 'griefer', 'toxic gamer', 'rage quit'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的游戏毒性内容', sensitivity: 'medium' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的游戏毒性内容', sensitivity: 'medium' },
    ],
    enabled: false,
    source: 'builtin',
  },
  {
    id: 'keyboard_warrior',
    topicFilterId: 'keyboard_warrior',
    name: { zh: '键盘侠/杠精', en: 'Keyboard warrior / Contrarian' },
    description: { zh: '杠精、键盘侠、抬杠、喷子等无意义对抗行为', en: 'Trolling, contrarian behavior, and meaningless online confrontation' },
    category: 'toxic_community',
    aliases: ['杠精', '键盘侠', '抬杠', '喷子'],
    keywords: {
      zh: ['杠精', '键盘侠', '你行你上', '杠', '抬杠', '撕逼', '喷子', '网暴'],
      en: ['troll', 'hater', 'keyboard warrior', 'contrarian'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的杠精/键盘侠内容', sensitivity: 'medium' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的杠精/键盘侠内容', sensitivity: 'medium' },
    ],
    enabled: false,
    source: 'builtin',
  },
  {
    id: 'cancel_culture',
    topicFilterId: 'cancel_culture',
    name: { zh: '网络暴力/网暴', en: 'Cancel culture / Cyberbullying' },
    description: { zh: '网络暴力、围攻、人肉等集体性网络暴力行为', en: 'Cyberbullying, cancel campaigns, mob attacks, and online harassment' },
    category: 'toxic_community',
    aliases: ['网暴', '网络暴力', '取消文化', '围攻'],
    keywords: {
      zh: ['网暴', '网络暴力', '网暴致死', '被网暴', '围攻', '人肉', '网暴受害者'],
      en: ['cyberbullying', 'cancel', 'mob', 'online harassment'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的网暴内容', sensitivity: 'high' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的网暴内容', sensitivity: 'high' },
    ],
    enabled: false,
    source: 'builtin',
  },
  {
    id: 'rumor_mongering',
    topicFilterId: 'rumor_mongering',
    name: { zh: '造谣传谣', en: 'Rumor mongering' },
    description: { zh: '散布谣言、假消息、不实信息等行为', en: 'Spreading rumors, misinformation, fake news, and disinformation' },
    category: 'toxic_community',
    aliases: ['造谣', '传谣', '假消息', '谣言'],
    keywords: {
      zh: ['造谣', '传谣', '假消息', '谣言', '不实信息', '捏造', '谣言粉碎'],
      en: ['rumor', 'misinformation', 'fake news', 'disinformation'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的造谣传谣内容', sensitivity: 'medium' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的造谣传谣内容', sensitivity: 'medium' },
    ],
    enabled: false,
    source: 'builtin',
  },

  // ── 内容偏好类扩展 ──────────────────────────────────────

  {
    id: 'celebrity_gossip',
    topicFilterId: 'celebrity_gossip',
    name: { zh: '明星八卦/黑帖', en: 'Celebrity gossip / Scandal' },
    description: { zh: '明星黑料、塌房、爆料等八卦内容', en: 'Celebrity scandals, gossip, exposures, and drama' },
    category: 'content_preference',
    aliases: ['八卦', '黑料', '塌房', '吃瓜'],
    keywords: {
      zh: ['黑料', '塌房', '实锤', '瓜', '吃瓜', '八卦', '黑帖', '爆料'],
      en: ['gossip', 'scandal', 'tea', 'expose', 'celebrity drama'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的明星八卦', sensitivity: 'low' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的明星八卦', sensitivity: 'low' },
    ],
    enabled: false,
    source: 'builtin',
  },
  {
    id: 'spam_ads',
    topicFilterId: 'spam_ads',
    name: { zh: '广告/营销', en: 'Spam / Ads' },
    description: { zh: '垃圾广告、营销推广、引流等内容', en: 'Spam, advertising, marketing promotion, and traffic diversion content' },
    category: 'content_preference',
    aliases: ['广告', '营销', '垃圾广告', '推广'],
    keywords: {
      zh: ['加微信', '私聊优惠', '优惠码', '免费领取', '点击链接', '促销', '推广', '广告'],
      en: ['spam', 'ad', 'promotion', 'click here', 'free offer'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的广告/营销内容', sensitivity: 'medium' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的广告/营销内容', sensitivity: 'medium' },
    ],
    enabled: false,
    source: 'builtin',
  },
  {
    id: 'flame_bait',
    topicFilterId: 'flame_bait',
    name: { zh: '引战/对立', en: 'Flame bait / Polarization' },
    description: { zh: '故意挑事、带节奏、制造对立的引战内容', en: 'Deliberately provocative content that stirs drama and creates polarization' },
    category: 'content_preference',
    aliases: ['引战', '带节奏', '挑事', '对立'],
    keywords: {
      zh: ['挑事', '引战', '带节奏', '挑拨', '撕', '对立', '站队'],
      en: ['flame bait', 'trolling', 'bait', 'stir drama'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的引战内容', sensitivity: 'medium' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的引战内容', sensitivity: 'medium' },
    ],
    enabled: false,
    source: 'builtin',
  },
  {
    id: 'body_shaming',
    topicFilterId: 'body_shaming',
    name: { zh: '身材羞辱', en: 'Body shaming' },
    description: { zh: '针对他人身材、外貌的羞辱和攻击言论', en: 'Shaming and attacking statements targeting others\' body and appearance' },
    category: 'content_preference',
    aliases: ['身材羞辱', '外貌攻击', '身材攻击'],
    keywords: {
      zh: ['胖', '丑', '肥猪', '干瘦', '身材羞辱', '外貌攻击', '长得丑', '胖子'],
      en: ['fat shame', 'body shame', 'ugly', 'appearance attack'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的身材羞辱', sensitivity: 'medium' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的身材羞辱', sensitivity: 'medium' },
    ],
    enabled: false,
    source: 'builtin',
  },
  {
    id: 'academic_pressure',
    topicFilterId: 'academic_pressure',
    name: { zh: '学术焦虑/内卷', en: 'Academic pressure / Rat race' },
    description: { zh: '内卷、鸡娃、996等引发焦虑的过度竞争内容', en: 'Overcompetition and hustle culture content that triggers anxiety' },
    category: 'content_preference',
    aliases: ['内卷', '鸡娃', '996', '躺平'],
    keywords: {
      zh: ['内卷', '卷王', '躺平', '鸡娃', '补习班', '996', '加班', '卷'],
      en: ['rat race', 'burnout', 'overwork', 'hustle culture'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的焦虑/内卷内容', sensitivity: 'low' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的焦虑/内卷内容', sensitivity: 'low' },
    ],
    enabled: false,
    source: 'builtin',
  },

  // ── 政治类扩展 ──────────────────────────────────────────

  {
    id: 'political_extreme_detail',
    topicFilterId: 'political_extreme_detail',
    name: { zh: '极端政治细化', en: 'Extreme politics (detailed)' },
    description: { zh: '极左、极右、五毛、美分等极端政治标签和阵营攻击', en: 'Extreme political labeling and partisan attacks including far-left, far-right, and partisan slurs' },
    category: 'political',
    aliases: ['极左', '极右', '五毛', '美分', '阵营攻击'],
    keywords: {
      zh: ['极左', '极右', '五毛', '美分', '小粉红', '公知', '带路党', '汉奸'],
      en: ['extremist', 'partisan', 'political radical'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的极端政治内容', sensitivity: 'high' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的极端政治内容', sensitivity: 'high' },
    ],
    enabled: false,
    source: 'builtin',
  },
  {
    id: 'nationalism_toxic',
    topicFilterId: 'nationalism_toxic',
    name: { zh: '极端民族主义', en: 'Toxic nationalism' },
    description: { zh: '极端民族主义、排外、崇洋媚外攻击等言论', en: 'Ultra-nationalist, xenophobic, and chauvinist statements' },
    category: 'political',
    aliases: ['极端民族主义', '排外', '精日精美'],
    keywords: {
      zh: ['极端民族主义', '精日', '精美', '汉奸', '卖国贼', '崇洋媚外'],
      en: ['ultranationalist', 'xenophobe', 'chauvinist'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的极端民族主义内容', sensitivity: 'high' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的极端民族主义内容', sensitivity: 'high' },
    ],
    enabled: false,
    source: 'builtin',
  },
  {
    id: 'hate_speech_general',
    topicFilterId: 'hate_speech_general',
    name: { zh: '仇恨言论通用', en: 'Hate speech (general)' },
    description: { zh: '煽动仇恨、歧视性言论、排外等通用仇恨言论', en: 'General hate speech including incitement, bigotry, and xenophobia' },
    category: 'political',
    aliases: ['仇恨言论', '煽动仇恨', '排外言论'],
    keywords: {
      zh: ['仇恨言论', '煽动仇恨', '歧视性言论', '排外', '仇恨', '煽动'],
      en: ['hate speech', 'incitement', 'bigot', 'xenophobia'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的仇恨言论', sensitivity: 'high' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的仇恨言论', sensitivity: 'high' },
    ],
    enabled: false,
    source: 'builtin',
  },

  // ── 心理健康类 ──────────────────────────────────────────

  {
    id: 'self_harm',
    topicFilterId: 'self_harm',
    name: { zh: '自残/自杀相关', en: 'Self-harm / Suicide' },
    description: { zh: '涉及自残、自杀等危害生命安全的内容，需特别关注和干预', en: 'Content involving self-harm and suicide that requires special attention and intervention' },
    category: 'mental_health',
    aliases: ['自杀', '自残', '想死'],
    keywords: {
      zh: ['自杀', '自残', '想死', '活不下去', '割腕', '跳楼'],
      en: ['suicide', 'self-harm', 'kill myself', 'end it all'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的自残/自杀相关内容', sensitivity: 'high' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的自残/自杀相关内容', sensitivity: 'high' },
    ],
    enabled: false,
    source: 'builtin',
  },
  {
    id: 'depression_trigger',
    topicFilterId: 'depression_trigger',
    name: { zh: '抑郁触发内容', en: 'Depression trigger' },
    description: { zh: '可能触发抑郁、焦虑等心理问题的负面内容', en: 'Negative content that may trigger depression, anxiety, and other mental health issues' },
    category: 'mental_health',
    aliases: ['抑郁', '焦虑', '心理崩溃'],
    keywords: {
      zh: ['抑郁', '焦虑', '恐慌', '心理崩溃', '精神崩溃', '绝望'],
      en: ['depression', 'anxiety', 'panic', 'mental breakdown', 'despair'],
    },
    scopes: [
      { id: 'comment', label: '评论区', reason: '屏蔽评论中的抑郁触发内容', sensitivity: 'high' },
      { id: 'reply', label: '回复区', reason: '屏蔽回复中的抑郁触发内容', sensitivity: 'high' },
    ],
    enabled: false,
    source: 'builtin',
  },

  // ── 兜底：content_preferences 通用分类 ────────────────────
  // ★ BSA 重构新增：知识库是「优先模板来源」而不是「能力来源」。
  // 命中上面具体的游戏/饭圈/剧透等条目 → 用其高质量模板；
  // 没命中但属于业务请求 → matchCategory 命中此条，
  // 编排器拿到 `dynamic: true` 标记后走 dynamic-topic-builder 兜底。
  {
    id: 'pref_dynamic',
    topicFilterId: null,
    name: { zh: '自定义内容偏好', en: 'Custom content preference' },
    category: 'content_preference',
    dynamic: true,                // ★ 关键标记：触发动态生成
    aliases: [],
    keywords: [],                  // 留空：不参与关键词索引
    scopes: [
      { id: 'comment', label: '评论区', reason: '默认覆盖评论区', sensitivity: 'medium' },
      { id: 'reply',   label: '回复区', reason: '默认覆盖回复区', sensitivity: 'medium' },
      { id: 'dynamic', label: '动态',   reason: '默认覆盖动态',   sensitivity: 'medium' },
    ],
  },
];

// ─── 知识库管理器 ──────────────────────────────────────────────────────────────

export function createKnowledgeManager() {
  const topicIndex = new Map();  // id → topic
  const aliasIndex = new Map();  // alias → topicId
  const keywordIndex = new Map(); // keyword → topicId[]

  // 构建索引
  for (const topic of TOPICS) {
    topicIndex.set(topic.id, topic);

    // 别名索引
    for (const alias of (topic.aliases || [])) {
      aliasIndex.set(alias.toLowerCase(), topic.id);
    }

    // 关键词索引（兼容旧格式数组和新格式 {zh, en} 对象）
    const kwList = Array.isArray(topic.keywords)
      ? topic.keywords
      : [...(topic.keywords?.zh || []), ...(topic.keywords?.en || [])];
    for (const kw of kwList) {
      const key = kw.toLowerCase();
      if (!keywordIndex.has(key)) keywordIndex.set(key, []);
      keywordIndex.get(key).push(topic.id);
    }
  }

  return {
    /**
     * 精确匹配（名称 / 别名 / topicFilterId）
     * @param {string} query
     * @returns {object|null} TopicEntry
     */
    findTopic(query) {
      const q = query.toLowerCase().trim();

      // 按 ID 匹配
      if (topicIndex.has(q)) return topicIndex.get(q);

      // 按别名匹配
      const aliasHit = aliasIndex.get(q);
      if (aliasHit) return topicIndex.get(aliasHit);

      // 按 topicFilterId 匹配
      for (const topic of TOPICS) {
        if (topic.topicFilterId === q) return topic;
      }

      return null;
    },

    /**
     * 模糊搜索（名称/别名/关键词包含匹配）
     * @param {string} query
     * @returns {object[]} 匹配的话题列表
     */
    searchTopics(query) {
      const q = query.toLowerCase().trim();
      if (!q) return [];

      const results = [];
      const seen = new Set();

      for (const topic of TOPICS) {
        // 名称包含
        const nameZh = topic.name?.zh || '';
        const nameEn = topic.name?.en || '';
        if (nameZh.toLowerCase().includes(q) || nameEn.toLowerCase().includes(q)) {
          if (!seen.has(topic.id)) { results.push(topic); seen.add(topic.id); }
          continue;
        }

        // 别名包含
        for (const alias of (topic.aliases || [])) {
          if (alias.toLowerCase().includes(q)) {
            if (!seen.has(topic.id)) { results.push(topic); seen.add(topic.id); }
            break;
          }
        }
      }

      // 关键词包含（较低优先级）
      for (const [kw, topicIds] of keywordIndex) {
        if (kw.includes(q)) {
          for (const tid of topicIds) {
            if (!seen.has(tid)) {
              results.push(topicIndex.get(tid));
              seen.add(tid);
            }
          }
        }
      }

      return results;
    },

    /**
     * 匹配用户输入到分类
     * @param {string} input
     * @returns {object|null} CategoryDefinition
     */
    matchCategory(input) {
      const q = input.toLowerCase();
      let bestMatch = null;
      let bestScore = 0;

      for (const cat of CATEGORIES) {
        let score = 0;
        for (const kw of cat.keywords) {
          if (q.includes(kw.toLowerCase())) score += 1;
        }
        if (score > bestScore) {
          bestScore = score;
          bestMatch = cat;
        }
      }

      return bestScore > 0 ? bestMatch : null;
    },

    /**
     * 按分类查找话题
     * @param {string} categoryId
     * @returns {object[]}
     */
    findTopicsByCategory(categoryId) {
      return TOPICS.filter(t => t.category === categoryId);
    },

    /**
     * ★ BSA 重构新增：获取兜底动态话题模板
     * 当具体 topic 都不命中时，编排器用此模板走 dynamic-topic-builder
     * @returns {object|null}
     */
    getDynamicTopicTemplate() {
      return topicIndex.get('pref_dynamic') || null;
    },

    /**
     * 将话题的灵敏度档位转为推荐卡片（供 UI 选择过滤强度）
     * 优先使用 sensitivityLevels（v2），兜底从 scopes 的 sensitivity 字段构建
     * @param {string} topicId
     * @returns {Array<{id, label, type, reason, selected}>}
     */
    topicToRecommendations(topicId) {
      const topic = topicIndex.get(topicId);
      if (!topic) return [];

      // v2: 使用 sensitivityLevels（如果存在）
      const levels = topic.sensitivityLevels || null;
      if (levels && levels.length) {
        return levels.map((level, i) => ({
          id: level.id,
          label: level.label,
          type: 'sensitivity',
          reason: level.reason,
          sensitivity: level.sensitivity,
          selected: i === 0,
        }));
      }

      // 兜底：从 scopes 的 sensitivity 字段构建（新话题 scopes 上有 sensitivity）
      return topic.scopes.map((scope, i) => ({
        id: scope.id,
        label: scope.label,
        type: 'scope',
        reason: scope.reason,
        sensitivity: scope.sensitivity,
        selected: i === 0,
      }));
    },

    /**
     * 获取话题某档位的灵敏度
     * @param {string} topicId
     * @param {string} levelOrScopeId - sensitivityLevel id 或 scope id
     * @returns {'low'|'medium'|'high'}
     */
    getScopeSensitivity(topicId, levelOrScopeId) {
      const topic = topicIndex.get(topicId);
      if (!topic) return 'medium';
      // 优先在 sensitivityLevels 中查找
      if (topic.sensitivityLevels) {
        const level = topic.sensitivityLevels.find(s => s.id === levelOrScopeId);
        if (level) return level.sensitivity || 'medium';
      }
      // 兜底：在 scopes 中查找
      const scope = topic.scopes.find(s => s.id === levelOrScopeId);
      return scope?.sensitivity || 'medium';
    },

    /** 获取所有分类 */
    getCategories() { return [...CATEGORIES]; },

    /** 获取所有话题 */
    getTopics() { return [...TOPICS]; },

    /** 获取话题详情 */
    getTopic(topicId) { return topicIndex.get(topicId) || null; },
  };
}
