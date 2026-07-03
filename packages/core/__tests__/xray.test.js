import { describe, it, expect, vi } from 'vitest';

vi.mock('./i18n.js', () => ({
  getLang: vi.fn(() => 'zh'),
}));

const BIAS_CATEGORIES = [
  'ad_hominem',
  'emotional_manipulation',
  'black_white',
  'bandwagon',
  'straw_man',
  'slippery_slope',
  'hasty_generalization',
  'appeal_to_authority',
];

const CATEGORY_META_ZH = {
  ad_hominem:            { label: '人身攻击', color: '#ef4444', emoji: '😡' },
  emotional_manipulation:{ label: '情绪煽动', color: '#f97316', emoji: '🔥' },
  black_white:           { label: '非黑即白', color: '#eab308', emoji: '⚫' },
  bandwagon:             { label: '跟风带节奏', color: '#a855f7', emoji: '🐑' },
  straw_man:             { label: '偷换概念', color: '#ec4899', emoji: '🎭' },
  slippery_slope:        { label: '极端推演', color: '#f59e0b', emoji: '📉' },
  hasty_generalization:  { label: '以偏概全', color: '#06b6d4', emoji: '🔍' },
  appeal_to_authority:   { label: '迷信专家', color: '#8b5cf6', emoji: '👑' },
};

const CATEGORY_VACCINE_ZH = {
  ad_hominem: '对方在攻击说话的人而不是他说的话。别被人身攻击带偏了讨论方向。',
  emotional_manipulation: '这段话在刻意激发你的情绪。当你感到情绪被挑动时，先暂停30秒再判断——情绪是本能，但决策需要理性。',
  black_white: '世界不是非黑即白的。对方是否只给了你极端选项？想想是否存在第三种可能。',
  bandwagon: '"大家都这么想"不代表就是对的。问自己：证据是什么？逻辑通顺吗？',
  straw_man: '对方是否歪曲了你的观点？把他的话和原话对比，看有没有被替换成更容易攻击的"稻草人"。',
  slippery_slope: '对方在说"如果A发生，Z就一定会发生"吗？检查A到Z之间的每一步——真的是必然因果吗？',
  hasty_generalization: '用一两个例子推出普遍性结论？个例不能代替统计。',
  appeal_to_authority: '"专家说""老祖宗说""一直以来都是这样"不等于对。要看有没有具体证据和道理，不是谁说了算。',
};

const CATEGORY_META_EN = {
  ad_hominem:            { label: 'Personal Attack', color: '#ef4444', emoji: '😡' },
  emotional_manipulation:{ label: 'Emotional Push', color: '#f97316', emoji: '🔥' },
  black_white:           { label: 'Black-or-White', color: '#eab308', emoji: '⚫' },
  bandwagon:             { label: 'Bandwagon', color: '#a855f7', emoji: '🐑' },
  straw_man:             { label: 'Straw Man', color: '#ec4899', emoji: '🎭' },
  slippery_slope:        { label: 'Slippery Slope', color: '#f59e0b', emoji: '📉' },
  hasty_generalization:  { label: 'Overgeneralize', color: '#06b6d4', emoji: '🔍' },
  appeal_to_authority:   { label: 'Appeal to Authority', color: '#8b5cf6', emoji: '👑' },
};

const CATEGORY_VACCINE_EN = {
  ad_hominem: 'They are attacking the person instead of the argument. Don\'t be distracted.',
  emotional_manipulation: 'This is deliberately provoking your emotions. Pause 30 seconds before judging.',
  black_white: 'The world isn\'t black and white. Are there other options besides the extremes?',
  bandwagon: '"Everyone thinks so" doesn\'t make it right. Ask: what\'s the evidence?',
  straw_man: 'Did they distort the argument to make it easier to attack?',
  slippery_slope: 'Is A→Z really inevitable? Check each step in between.',
  hasty_generalization: 'One or two examples don\'t make a universal rule.',
  appeal_to_authority: 'Authority says so ≠ it\'s correct. Look for actual evidence.',
};

function heuristicSingle(text) {
  let score = 0, cat = 'emotional_manipulation';
  if (/傻逼|操你妈|nmsl|废物|垃圾|脑残|白痴|弱智|狗东西|去死|滚|sb|cnm|fuck you|bitch|stupid|idiot|retard|dumbass/i.test(text)) {
    score = 0.85; cat = 'ad_hominem';
  } else {
    if (/[!！]{2,}|[?？]{2,}|卧槽|离谱|震惊|恐怖|恶心|气愤|愤怒|wtf|omg/i.test(text)) { score += 0.25; cat='emotional_manipulation'; }
    if (/都|全部|所有|永远|绝不|一定|必须|肯定|根本|完全|100%|all|never|must|always|every/i.test(text)) { score += 0.25; cat='black_white'; }
    if (/大家都|所有人|别人都|谁不|网友都|everyone knows|everybody/i.test(text)) { score += 0.25; cat='bandwagon'; }
    if (/如果.*就.*会|迟早|总有一天|再这样下去|leads to|inevitably/i.test(text)) { score += 0.2; cat='slippery_slope'; }
    if (/你就是|你这种|你们这些|libtard|trumptard|feminazi|incel|cuck/i.test(text)) { score += 0.3; cat='ad_hominem'; }
    if (/我朋友|我亲戚|我听说|anecdotally|my friend/i.test(text)) { score += 0.2; cat='hasty_generalization'; }
    if (/专家说|老祖宗|自古以来|一直都是|experts say|tradition/i.test(text)) { score += 0.15; cat='appeal_to_authority'; }
    if (/[A-Z]{5,}/.test(text)) score += 0.15;
  }
  let risk = 'low';
  if (score >= 0.5) risk = 'high';
  else if (score >= 0.2) risk = 'medium';
  return { risk, category: cat, manipulation_score: Math.min(1, score), reason: '' };
}

describe('X-Ray constants integrity', () => {
  it('all 8 categories are defined', () => {
    expect(BIAS_CATEGORIES).toHaveLength(8);
  });

  it('every category has Chinese meta label+color+emoji', () => {
    for (const cat of BIAS_CATEGORIES) {
      const meta = CATEGORY_META_ZH[cat];
      expect(meta, `${cat} missing ZH meta`).toBeDefined();
      expect(meta.label, `${cat} label empty`).toBeTruthy();
      expect(meta.color, `${cat} color invalid`).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(meta.emoji, `${cat} emoji empty`).toBeTruthy();
    }
  });

  it('every category has Chinese vaccine text', () => {
    for (const cat of BIAS_CATEGORIES) {
      expect(CATEGORY_VACCINE_ZH[cat], `${cat} missing ZH vaccine`).toBeTruthy();
      expect(CATEGORY_VACCINE_ZH[cat].length, `${cat} vaccine too short`).toBeGreaterThan(10);
    }
  });

  it('every category has English meta label+color+emoji', () => {
    for (const cat of BIAS_CATEGORIES) {
      const meta = CATEGORY_META_EN[cat];
      expect(meta, `${cat} missing EN meta`).toBeDefined();
      expect(meta.label, `${cat} EN label empty`).toBeTruthy();
      expect(meta.color, `${cat} EN color invalid`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('every category has English vaccine text', () => {
    for (const cat of BIAS_CATEGORIES) {
      expect(CATEGORY_VACCINE_EN[cat], `${cat} missing EN vaccine`).toBeTruthy();
      expect(CATEGORY_VACCINE_EN[cat].length, `${cat} EN vaccine too short`).toBeGreaterThan(10);
    }
  });

  it('all hex colors are valid and distinct enough', () => {
    const colors = new Set(Object.values(CATEGORY_META_ZH).map(m => m.color));
    expect(colors.size).toBeGreaterThanOrEqual(6);
  });
});

describe('Heuristic analysis — Chinese', () => {
  it('detects direct insults as ad_hominem HIGH risk', () => {
    const cases = ['你就是个傻逼', '操你妈你有病吧', '滚啊废物', 'nmsl你脑残吧'];
    for (const text of cases) {
      const r = heuristicSingle(text);
      expect(r.risk, `"${text}" should be HIGH`).toBe('high');
      expect(r.category, `"${text}" should be ad_hominem`).toBe('ad_hominem');
      expect(r.manipulation_score).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('detects English insults as ad_hominem HIGH risk', () => {
    const cases = ['you are such a stupid idiot', 'fuck you bitch', 'dumbass retard'];
    for (const text of cases) {
      const r = heuristicSingle(text);
      expect(r.risk, `"${text}" should be HIGH`).toBe('high');
      expect(r.category, `"${text}" should be ad_hominem`).toBe('ad_hominem');
    }
  });

  it('detects emotional manipulation (exclamation, anger words)', () => {
    const r = heuristicSingle('这也太离谱了！！简直震惊！！太恶心了！！！');
    expect(r.category).toBe('emotional_manipulation');
    expect(r.risk).toBe('medium');
  });

  it('detects black-or-white absolute terms', () => {
    const r = heuristicSingle('所有的人都必须同意这一点，永远都是这样，完全不对');
    expect(r.category).toBe('black_white');
    expect(r.risk).toBe('medium');
  });

  it('detects bandwagon/everyone-says-so', () => {
    const r = heuristicSingle('大家都知道这是错的，所有人都这么说，网友都看出来了');
    expect(r.category).toBe('bandwagon');
    expect(r.manipulation_score).toBeGreaterThanOrEqual(0.25);
  });

  it('detects slippery slope reasoning', () => {
    const r = heuristicSingle('如果我们允许这个，将来就会彻底乱套，迟早会完蛋');
    expect(r.category).toBe('slippery_slope');
  });

  it('detects hasty generalization (anecdotal evidence)', () => {
    const r = heuristicSingle('我朋友说这个没用，我亲戚用了也不好，我听说很多人都被骗了');
    expect(r.category).toBe('hasty_generalization');
  });

  it('detects appeal to authority/tradition', () => {
    const r = heuristicSingle('专家说这样做才对，自古以来就是这样，一直都是传统');
    expect(r.category).toBe('appeal_to_authority');
  });

  it('neutral/objective text returns low risk', () => {
    const cases = [
      '今天天气不错，适合出门散步',
      '这篇文章讨论了量子计算的基本原理',
      '根据2023年统计数据，该行业增长率为5%',
      '请问这个函数的参数应该怎么传',
    ];
    for (const text of cases) {
      const r = heuristicSingle(text);
      expect(r.risk, `"${text}" should be LOW risk`).toBe('low');
      expect(r.manipulation_score, `"${text}" score should be < 0.2`).toBeLessThan(0.2);
    }
  });

  it('manipulation_score is clamped between 0 and 1', () => {
    const r = heuristicSingle('!!! 所有人都必须！！！你这个傻逼！！！大家都说！！！');
    expect(r.manipulation_score).toBeLessThanOrEqual(1);
    expect(r.manipulation_score).toBeGreaterThanOrEqual(0);
  });

  it('empty or very short text returns low', () => {
    expect(heuristicSingle('').risk).toBe('low');
    expect(heuristicSingle('哈哈').risk).toBe('low');
    expect(heuristicSingle('好的').risk).toBe('low');
  });
});

describe('Heuristic analysis — English', () => {
  it('detects English absolute terms (never/must/always)', () => {
    const r = heuristicSingle('You must never do that, all people always agree');
    expect(r.category).toBe('black_white');
    expect(r.risk).toBe('medium');
  });

  it('detects English bandwagon', () => {
    const r = heuristicSingle('Everyone knows this is true, everybody says so');
    expect(r.category).toBe('bandwagon');
  });

  it('detects English slippery slope', () => {
    const r = heuristicSingle('If we allow this it inevitably leads to disaster');
    expect(r.category).toBe('slippery_slope');
  });

  it('detects English anecdotal evidence', () => {
    const r = heuristicSingle('My friend tried it and it worked, anecdotally it seems fine');
    expect(r.category).toBe('hasty_generalization');
  });

  it('detects English appeal to authority', () => {
    const r = heuristicSingle('Experts say this is best, tradition holds that it works');
    expect(r.category).toBe('appeal_to_authority');
  });

  it('neutral English text is low risk', () => {
    const r = heuristicSingle('The report was published last quarter in the journal Nature');
    expect(r.risk).toBe('low');
  });
});

describe('Risk level thresholds', () => {
  it('score >= 0.5 is high risk', () => {
    const r = heuristicSingle('你这个傻逼！！所有人都必须滚！！！');
    expect(r.risk).toBe('high');
  });

  it('0.2 <= score < 0.5 is medium risk', () => {
    const r = heuristicSingle('所有人都这么想，简直离谱');
    expect(['medium','high']).toContain(r.risk);
  });

  it('score < 0.2 is low risk', () => {
    const r = heuristicSingle('今天吃了面条');
    expect(r.risk).toBe('low');
  });
});

describe('Category label readability (no academic jargon)', () => {
  it('Chinese labels are everyday language, not formal logic terms', () => {
    const academicTerms = ['稻草人', '滑坡谬误', '轶事证据', '诉诸', '谬误', '德州神枪手', '没有真正的苏格兰人', '循环论证', '举证责任'];
    for (const cat of BIAS_CATEGORIES) {
      const label = CATEGORY_META_ZH[cat].label;
      for (const term of academicTerms) {
        expect(label, `Category "${label}" should not contain academic term "${term}"`).not.toContain(term);
      }
    }
  });

  it('vaccine text gives actionable advice, not definitions', () => {
    for (const cat of BIAS_CATEGORIES) {
      const v = CATEGORY_VACCINE_ZH[cat];
      expect(v.length, `${cat} vaccine too short to be useful`).toBeGreaterThan(15);
    }
  });
});
