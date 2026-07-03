/**
 * 用户画像 Profile 体系
 *
 * 每个 Profile 定义了一组默认偏好：默认话题、默认 scope、默认敏感度、推荐规则。
 * 首次启动时自动初始化，用户可通过对话切换 Profile。
 *
 * Profile 不是硬编码的规则，而是"初始推荐基线"——用户后续的操作会覆盖 Profile 默认值。
 */

/**
 * @typedef {Object} Profile
 * @property {string} id - Profile ID
 * @property {string} label - 显示名称
 * @property {string} description - 描述
 * @property {string[]} defaultTopics - 默认启用的话题 ID 列表
 * @property {string[]} preferredScopes - 偏好的 scope 排序（优先级从高到低）
 * @property {string} defaultSensitivity - 默认敏感度 'low' | 'medium' | 'high'
 * @property {Object} aiPreferences - AI 偏好
 * @property {boolean} aiPreferences.useAI - 是否使用 AI 检测
 * @property {string} aiPreferences.mode - 'eco' | 'full'
 * @property {string[]} recommendationHints - 推荐提示（用于 LLM system prompt）
 */

export const PROFILES = {
  developer: {
    id: 'developer',
    label: '开发者',
    description: '关注技术话题，屏蔽招聘广告和技术喷子',
    defaultTopics: ['toxic_community', 'personal_attack'],
    preferredScopes: ['comment', 'reply', 'dynamic'],
    defaultSensitivity: 'medium',
    aiPreferences: { useAI: true, mode: 'eco' },
    recommendationHints: ['技术讨论', '代码相关', '招聘广告'],
  },

  student: {
    id: 'student',
    label: '学生',
    description: '关注学习话题，屏蔽校园暴力和考试焦虑',
    defaultTopics: ['harassment', 'personal_attack', 'toxic_community'],
    preferredScopes: ['comment', 'reply'],
    defaultSensitivity: 'medium',
    aiPreferences: { useAI: true, mode: 'eco' },
    recommendationHints: ['校园暴力', '考试焦虑', '学习压力'],
  },

  gamer: {
    id: 'gamer',
    label: '游戏玩家',
    description: '关注游戏话题，屏蔽游戏喷子和剧透',
    defaultTopics: ['game_toxic', 'spoiler', 'toxic_community'],
    preferredScopes: ['comment', 'reply', 'dynamic'],
    defaultSensitivity: 'high',
    aiPreferences: { useAI: true, mode: 'full' },
    recommendationHints: ['游戏喷子', '剧透', '踩一捧一', '比强度'],
  },

  anime: {
    id: 'anime',
    label: '二次元',
    description: '关注动漫话题，屏蔽剧透和角色攻击',
    defaultTopics: ['spoiler', 'toxic_community', 'personal_attack'],
    preferredScopes: ['comment', 'reply', 'dynamic'],
    defaultSensitivity: 'high',
    aiPreferences: { useAI: true, mode: 'full' },
    recommendationHints: ['动漫剧透', '角色攻击', 'CP 争吵'],
  },

  minimal: {
    id: 'minimal',
    label: '极简',
    description: '最小化配置，只屏蔽骚扰和人身攻击',
    defaultTopics: ['harassment', 'personal_attack'],
    preferredScopes: ['comment'],
    defaultSensitivity: 'low',
    aiPreferences: { useAI: false, mode: 'eco' },
    recommendationHints: ['骚扰', '人身攻击'],
  },

  custom: {
    id: 'custom',
    label: '自定义',
    description: '不使用预设 Profile，完全自定义',
    defaultTopics: [],
    preferredScopes: ['comment', 'reply'],
    defaultSensitivity: 'medium',
    aiPreferences: { useAI: true, mode: 'eco' },
    recommendationHints: [],
  },
};

/**
 * 默认 Profile ID
 */
export const DEFAULT_PROFILE_ID = 'minimal';

/**
 * 获取 Profile by ID
 * @param {string} id
 * @returns {Profile|null}
 */
export function getProfile(id) {
  return PROFILES[id] || null;
}

/**
 * 获取所有 Profile 的摘要列表（不含完整数据）
 * @returns {Array<{id, label, description}>}
 */
export function listProfiles() {
  return Object.values(PROFILES).map(p => ({
    id: p.id,
    label: p.label,
    description: p.description,
  }));
}

/**
 * 初始化用户 Profile
 * - 如果用户已有 Profile，返回当前 Profile
 * - 如果用户没有 Profile，用默认 Profile 初始化
 * @param {object} memory - memoryBridge 实例
 * @param {string} [profileId] - 指定 Profile ID（可选）
 * @returns {Profile}
 */
export function initUserProfile(memory, profileId) {
  // 检查是否已有 Profile
  const existing = memory?.queryByKey?.('user_profile');
  if (existing?.value?.profileId) {
    return getProfile(existing.value.profileId) || PROFILES[DEFAULT_PROFILE_ID];
  }

  // 初始化新 Profile
  const profile = getProfile(profileId) || PROFILES[DEFAULT_PROFILE_ID];

  // 写入 memory
  memory?.write?.({
    type: 'profile',
    key: 'user_profile',
    value: {
      profileId: profile.id,
      label: profile.label,
      createdAt: Date.now(),
    },
  });

  // 写入初始偏好
  memory?.recordPreference?.({
    profileId: profile.id,
    topicLabel: profile.label,
    scopes: profile.preferredScopes,
    sensitivity: profile.defaultSensitivity,
    action: 'profile_init',
    timestamp: Date.now(),
  });

  return profile;
}

/**
 * 切换用户 Profile
 * @param {object} memory - memoryBridge 实例
 * @param {string} profileId
 * @returns {Profile|null}
 */
export function switchProfile(memory, profileId) {
  const profile = getProfile(profileId);
  if (!profile) return null;

  memory?.write?.({
    type: 'profile',
    key: 'user_profile',
    value: {
      profileId: profile.id,
      label: profile.label,
      switchedAt: Date.now(),
    },
  });

  // 记录偏好变更
  memory?.recordPreference?.({
    profileId: profile.id,
    topicLabel: profile.label,
    scopes: profile.preferredScopes,
    sensitivity: profile.defaultSensitivity,
    action: 'profile_switch',
    timestamp: Date.now(),
  });

  return profile;
}

/**
 * 获取当前用户的 Profile
 * @param {object} memory - memoryBridge 实例
 * @returns {Profile|null}
 */
export function getCurrentProfile(memory) {
  const record = memory?.queryByKey?.('user_profile');
  if (!record?.value?.profileId) return null;
  return getProfile(record.value.profileId);
}
