/**
 * abuse-guard.js — 辱骂熔断机制
 *
 * 检测用户输入中的硬词辱骂，触发后 Agent 道歉并静默，
 * 直到用户恢复正常表达才解除熔断。
 *
 * 只匹配硬词，不读屏蔽词库，避免中断任务。
 */

// 硬词正则（只匹配明确的辱骂，不读屏蔽词库）
const ABUSE_PATTERNS = [
  /(?:傻逼|草泥马|废物|垃圾人|滚蛋|操你|你妈|去死|神经病|脑残|智障|贱人|婊子|王八蛋)/,
  /(?:sb|SB|Sb|cnm|CNM|Cnm|nmsl|NMSL|wcnm)/,
];

/**
 * 创建熔断守卫实例（每个 Orchestrator 实例一个）
 * @returns {{ check: Function, isMuted: Function, reset: Function }}
 */
export function createAbuseGuard() {
  let abuseCount = 0;
  let abuseMuted = false;

  return {
    /**
     * 检查输入是否辱骂，更新熔断状态
     * @param {string} input
     * @returns {{ isAbuse: boolean, shouldMute: boolean, unmuted: boolean }}
     */
    check(input) {
      const text = String(input || '').trim();
      const isAbuse = ABUSE_PATTERNS.some(re => re.test(text));

      if (isAbuse) {
        abuseCount++;
        abuseMuted = true;
        return { isAbuse: true, shouldMute: true, unmuted: false };
      }

      let unmuted = false;
      if (abuseMuted) {
        abuseMuted = false;
        abuseCount = 0;
        unmuted = true;
      }
      return { isAbuse: false, shouldMute: false, unmuted };
    },

    /** 当前是否处于熔断状态 */
    isMuted() {
      return abuseMuted;
    },

    /** 重置熔断状态 */
    reset() {
      abuseCount = 0;
      abuseMuted = false;
    },
  };
}
