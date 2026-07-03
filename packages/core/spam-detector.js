/**
 * spam-detector.js — 刷屏 & 骚扰指纹追踪
 *
 * 从 scanner.js 提取的刷屏（spam）和骚扰（harassment）指纹记录与阈值检测。
 * 纯数据层：只负责记录指纹和判断阈值，不执行屏蔽动作。
 * 屏蔽动作由调用方（scanner.js）负责。
 */

/**
 * 刷屏 & 骚扰指纹追踪器
 *
 * 使用方式：
 *   const detector = new SpamDetector();
 *   detector.recordSpamFingerprint(text, el);
 *   const spamResults = detector.detectSpam();  // 返回达到阈值的刷屏数据
 *   const harassResults = detector.detectHarassment(); // 返回达到阈值的骚扰数据
 */
export class SpamDetector {
  constructor() {
    this._spamMap = new Map();
    this._harassMap = new Map();
  }

  // ── 刷屏检测 ──────────────────────────────────────────────────────────────

  /**
   * 记录评论文本指纹。
   * 使用标准化文本（去除空格、标点差异）作为指纹 key。
   *
   * @param {string}  text - 评论文本
   * @param {Element} el   - DOM 元素
   */
  recordSpamFingerprint(text, el) {
    const fingerprint = text.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[.,!?:;'"…~\-_—·、。！？：；""''（）【】《》]/g, '')
      .trim();

    if (fingerprint.length < 5) return;

    const existing = this._spamMap.get(fingerprint);
    if (existing) {
      existing.count++;
      existing.elements.push(el);
    } else {
      this._spamMap.set(fingerprint, { count: 1, elements: [el], text });
    }
  }

  /**
   * 执行刷屏检测：同一指纹出现 >= 3 次时判定为刷屏。
   * 返回达到阈值的刷屏数据，调用方负责执行屏蔽动作。
   *
   * @returns {Array<{text: string, elements: Element[], count: number}>}
   */
  detectSpam() {
    const SPAM_THRESHOLD = 3;
    const results = [];

    for (const [fingerprint, data] of this._spamMap) {
      if (data.count >= SPAM_THRESHOLD) {
        results.push({ text: data.text, elements: data.elements, count: data.count });
      }
    }

    return results;
  }

  // ── 骚扰检测 ──────────────────────────────────────────────────────────────

  /**
   * 记录同一用户在回复页面的出现次数。
   *
   * @param {string}      username - 用户名
   * @param {Element}     el       - DOM 元素
   */
  recordHarassFingerprint(username, el) {
    if (!username || username.length < 1) return;
    const existing = this._harassMap.get(username);
    if (existing) {
      existing.count++;
      existing.elements.push(el);
    } else {
      this._harassMap.set(username, { count: 1, elements: [el], username });
    }
  }

  /**
   * 执行骚扰检测：同一用户出现 >= 5 次时判定为骚扰。
   * 返回达到阈值的骚扰数据，调用方负责执行屏蔽动作。
   *
   * @returns {Array<{username: string, elements: Element[], count: number}>}
   */
  detectHarassment() {
    const HARASS_THRESHOLD = 5;
    const results = [];

    for (const [username, data] of this._harassMap) {
      if (data.count >= HARASS_THRESHOLD) {
        results.push({ username, elements: data.elements, count: data.count });
      }
    }

    return results;
  }

  // ── 重置 ──────────────────────────────────────────────────────────────────

  /** 清空所有指纹记录（用于 manualScan 重置） */
  reset() {
    this._spamMap.clear();
    this._harassMap.clear();
  }
}
