/**
 * text-extractor.js — DOM 文本提取工具
 *
 * 从 scanner.js 提取的文本/用户名/UID 提取函数。
 * 支持 Shadow DOM 穿透，处理 B站等使用嵌套 Web Component 的平台。
 *
 * 所有函数通过参数接收依赖（platform、currentMessageSelectors 等），
 * 保持无状态、可测试。
 */

import { deepQuerySelectorInEl } from './dom-utils.js';

// ── 文本提取 ──────────────────────────────────────────────────────────────────

/**
 * 从评论元素中提取文本。
 * 根据 contentType 选择不同的文本选择器，支持 Shadow DOM 穿透。
 *
 * @param {Element}  el                      - 评论元素
 * @param {string}   contentType             - 'comment' | 'reply' | 'message'
 * @param {object}   platform                - 平台适配器
 * @param {object|null} currentMessageSelectors - 消息中心选择器覆盖
 * @returns {string}
 */
export function extractText(el, contentType = 'comment', platform, currentMessageSelectors = null) {
  let sel;
  if (currentMessageSelectors) {
    sel = currentMessageSelectors.textSel;
  } else {
    sel = contentType === 'message'
      ? platform.selectors.messageText
      : platform.selectors.commentText;
  }

  // 1. 传统 DOM
  const textEl = sel ? el.querySelector(sel) : null;
  if (textEl) return textEl.innerText?.trim() || '';

  // 2. Shadow DOM 穿透
  const shadowTextEl = deepQuerySelectorInEl(el, sel);
  if (shadowTextEl) {
    const text = shadowTextEl.innerText?.trim() || '';
    if (text.length >= 3) return text;
    if (shadowTextEl.shadowRoot) {
      const innerP = shadowTextEl.shadowRoot.querySelector('p, span, [class*="text"]');
      if (innerP) {
        const innerText = innerP.innerText?.trim() || '';
        if (innerText.length >= 3) return innerText;
      }
    }
  }

  // 3. Web Component 智能提取
  if (el.shadowRoot) {
    const shadowText = extractTextFromShadow(el);
    if (shadowText && shadowText.length >= 3) return shadowText;
  }

  // 4. Fallback
  const fallbackText = el.innerText?.trim() || '';
  if (fallbackText.length >= 3 && fallbackText.length < 2000) {
    if (el.shadowRoot && fallbackText.length > 500) return '';
    return fallbackText;
  }

  return '';
}

/**
 * 从 Web Component 的 Shadow DOM 中智能提取评论文本。
 * 针对 B站等使用嵌套 Web Component 的平台。
 *
 * @param {Element} el - Web Component 元素
 * @returns {string|null}
 */
export function extractTextFromShadow(el) {
  // 策略1: 直接搜索 bili-rich-text 元素（最精确的评论文本容器）
  const richTextEl = deepQuerySelectorInEl(el, 'bili-rich-text');
  if (richTextEl) {
    if (richTextEl.shadowRoot) {
      const pEl = richTextEl.shadowRoot.querySelector('p');
      if (pEl) return pEl.innerText?.trim() || '';
    }
    return richTextEl.innerText?.trim() || '';
  }

  // 策略2: 搜索所有 <p> 元素（最底层文本容器）
  const pEl = deepQuerySelectorInEl(el, 'p');
  if (pEl) {
    const text = pEl.innerText?.trim() || '';
    if (text.length >= 10) return text;
  }

  // 策略3: 搜索包含长文本的 span 元素
  const spanEl = deepQuerySelectorInEl(el, 'span[class*="text"], span[class*="content"]');
  if (spanEl) {
    const text = spanEl.innerText?.trim() || '';
    if (text.length >= 10) return text;
  }

  return null;
}

// ── 用户名提取 ────────────────────────────────────────────────────────────────

/**
 * 从评论元素中提取用户名。
 *
 * @param {Element}  el                      - 评论元素
 * @param {string}   contentType             - 'comment' | 'reply' | 'message'
 * @param {object}   platform                - 平台适配器
 * @param {object|null} currentMessageSelectors - 消息中心选择器覆盖
 * @param {string|null} whisperChatPartner   - 私信对方用户名（缓存）
 * @returns {string|null}
 */
export function extractUsername(el, contentType = 'comment', platform, currentMessageSelectors = null, whisperChatPartner = null) {
  if (contentType === 'message' && whisperChatPartner) {
    return whisperChatPartner;
  }

  let sel;
  if (currentMessageSelectors) {
    sel = currentMessageSelectors.usernameSel;
  } else {
    sel = contentType === 'message'
      ? platform.selectors.messageUsername
      : platform.selectors.username;
  }
  if (!sel) return null;

  // 1. 传统 DOM
  const userEl = el.querySelector(sel);
  if (userEl) return userEl.innerText?.trim() || userEl?.getAttribute('href')?.split('/').pop() || null;

  // 2. Shadow DOM 穿透
  const shadowUserEl = deepQuerySelectorInEl(el, sel);
  if (shadowUserEl) {
    const name = shadowUserEl.innerText?.trim() || shadowUserEl?.getAttribute('href')?.split('/').pop() || null;
    if (name && name.length < 50) return name;
    if (shadowUserEl.shadowRoot) {
      const innerName = shadowUserEl.shadowRoot.querySelector('[class*="name"], a');
      if (innerName) {
        const innerText = innerName.innerText?.trim() || innerName.getAttribute('href')?.split('/').pop() || null;
        if (innerText && innerText.length < 50) return innerText;
      }
    }
  }

  return null;
}

/**
 * 从评论元素中提取用户 UID（B站专用）。
 *
 * @param {Element} el - 评论元素
 * @returns {string|null}
 */
export function extractUserUID(el) {
  // 1. 传统 DOM：查找 space.bilibili.com 链接
  const userLink = el.querySelector('a[href*="space.bilibili.com"]');
  if (userLink) {
    const href = userLink.getAttribute('href') || '';
    const m = href.match(/space\.bilibili\.com\/(\d+)/);
    if (m) return m[1];
  }

  // 2. Shadow DOM 中递归查找用户链接
  const shadowUserEl = deepQuerySelectorInEl(el, 'a[href*="space.bilibili.com"]');
  if (shadowUserEl) {
    const href = shadowUserEl.getAttribute('href') || '';
    const m = href.match(/space\.bilibili\.com\/(\d+)/);
    if (m) return m[1];
  }

  // 3. data-mid / data-userid / data-uid 属性
  const anyUserEl = el.querySelector('[data-mid], [data-userid], [data-uid]');
  if (anyUserEl) {
    return anyUserEl.dataset.mid || anyUserEl.dataset.userid || anyUserEl.dataset.uid;
  }

  return null;
}

/**
 * 从私信页面头部提取聊天对方的用户名。
 *
 * @param {object} platform - 平台适配器
 * @returns {string|null}
 */
export function extractWhisperPartnerName(platform) {
  try {
    const headerEl = document.querySelector(
      platform.selectors?.messageHeader || '.chat-header, .session-header, [class*="header"]'
    );
    if (!headerEl) return null;
    const nameEl = headerEl.querySelector(
      platform.selectors?.messageHeaderName || '[class*="name"], [class*="nick"], h2, h3'
    );
    if (nameEl) return nameEl.innerText?.trim() || null;
    return headerEl.innerText?.trim()?.split('\n')?.[0] || null;
  } catch {
    return null;
  }
}

// ── 内容类型判断 ──────────────────────────────────────────────────────────────

/**
 * 判断元素类型：'comment' | 'reply' | 'message'
 *
 * @param {Element} el       - DOM 元素
 * @param {object}  platform - 平台适配器
 * @returns {string}
 */
export function detectContentType(el, platform) {
  const pageType = platform.isMessagePage?.();
  if (pageType) {
    if (pageType === 'whisper') return 'message';
    if (pageType === 'reply' || pageType === 'at') return 'reply';
    return 'message';
  }

  const root = el.getRootNode();
  if (root instanceof ShadowRoot && root.host) {
    const hostTag = root.host.tagName?.toLowerCase();
    if (hostTag === 'bili-comment-replies-renderer') return 'reply';
    if (hostTag === 'bili-comment-thread-renderer') return 'comment';
  }

  if (platform.selectors.replyContainer) {
    if (el.matches?.(platform.selectors.replyContainer)) return 'reply';
    if (el.closest?.(platform.selectors.replyContainer)) return 'reply';
  }

  if (platform.selectors.whisperContainer) {
    if (el.matches?.(platform.selectors.whisperContainer)) return 'message';
  }
  if (platform.selectors.messageContainer) {
    if (el.matches?.(platform.selectors.messageContainer)) return 'message';
  }

  return 'comment';
}

/**
 * 判断私信气泡是否是用户自己发送的。
 *
 * @param {Element} el       - 气泡元素
 * @param {object}  platform - 平台适配器
 * @returns {boolean}
 */
export function isSelfMessage(el, platform) {
  // 策略1：平台选择器
  const selfSel = platform.selectors?.selfMessage;
  if (selfSel && el.matches?.(selfSel)) return true;

  // 策略2：检查消息气泡内部是否有 MsgTextIsMe 类名（B站）
  const msgTextEl = el.querySelector('[class*="MsgText"]');
  if (msgTextEl) {
    const cls = msgTextEl.className || '';
    if (cls.includes('MsgTextIsMe') || cls.includes('IsMe')) return true;
  }

  // 策略3：向上查找父元素，检查是否有 MsgIsMe 标记（B站）
  let parent = el.parentElement;
  while (parent && parent !== document.body) {
    const cls = parent.className || '';
    if (cls.includes('MsgIsMe') && !cls.includes('MsgTextIsMe')) return true;
    if (parent.classList.contains('interaction-item')) break;
    parent = parent.parentElement;
  }

  // 策略4：通用 CSS 类匹配
  if (el.closest?.('[class*="self"], [class*="mine"], [class*="right"]')) return true;

  return false;
}

// ── 辅助工具 ──────────────────────────────────────────────────────────────────

/**
 * 定位包含评论文本的具体元素（而非整个评论容器）。
 * 返回文本元素用于精确屏蔽。
 *
 * @param {Element}  el                      - 评论容器
 * @param {string}   contentType             - 'comment' | 'reply' | 'message'
 * @param {object}   platform                - 平台适配器
 * @param {object|null} currentMessageSelectors - 消息中心选择器覆盖
 * @returns {Element|null}
 */
export function findTextElement(el, contentType, platform, currentMessageSelectors = null) {
  let sel;
  if (currentMessageSelectors) {
    sel = currentMessageSelectors.textSel;
  } else {
    sel = contentType === 'message'
      ? platform.selectors.messageText
      : platform.selectors.commentText;
  }
  if (!sel) return null;

  // 1. 传统 DOM
  const textEl = el.querySelector(sel);
  if (textEl) {
    if (textEl.shadowRoot) {
      const pEl = textEl.shadowRoot.querySelector('p, [class*="text"], [class*="content"], span');
      if (pEl && pEl.innerText?.trim().length >= 3) return pEl;
    }
    return textEl;
  }

  // 2. Shadow DOM 穿透
  const shadowTextEl = deepQuerySelectorInEl(el, sel);
  if (shadowTextEl) {
    if (shadowTextEl.shadowRoot) {
      const innerText = shadowTextEl.shadowRoot.querySelector('p, [class*="text"], span');
      if (innerText && innerText.innerText?.trim().length >= 3) return innerText;
    }
    return shadowTextEl;
  }

  // 3. Web Component 自身 shadowRoot
  if (el.shadowRoot) {
    const richTextEl = deepQuerySelectorInEl(el, 'bili-rich-text');
    if (richTextEl?.shadowRoot) {
      const pEl = richTextEl.shadowRoot.querySelector('p');
      if (pEl && pEl.innerText?.trim().length >= 3) return pEl;
      const anyTextEl = richTextEl.shadowRoot.querySelector('[class*="text"], [class*="content"], span, div');
      if (anyTextEl && anyTextEl.innerText?.trim().length >= 3) return anyTextEl;
    }
    if (richTextEl) return richTextEl;
  }

  // 4. 通用 fallback
  const allTextCandidates = el.shadowRoot
    ? deepQuerySelectorInEl(el, 'p, span, [class*="text"], [class*="content"]')
    : el.querySelector('p, span, [class*="text"], [class*="content"]');
  if (allTextCandidates) {
    const text = allTextCandidates.innerText?.trim() || '';
    if (text.length >= 3) return allTextCandidates;
  }

  return null;
}

/**
 * 提取文本中的负面信号词。
 *
 * @param {string} text - 要分析的文本
 * @returns {string[]}
 */
export function extractNegativeSignals(text) {
  const signals = ['滚', '去死', '你个', '废物', '蠢', '傻', '恶心', '垃圾', '死', '贱', '骂', '打'];
  return signals.filter(s => text.includes(s));
}

/**
 * 构建检测上下文对象。
 *
 * @param {object}      platform  - 平台适配器
 * @param {string|null} username  - 当前用户名
 * @param {boolean}     isReply   - 是否为回复
 * @param {string}      text      - 评论文本
 * @param {Function}    extractFn - 文本提取函数（用于提及检测）
 * @returns {object}
 */
export function buildContext(platform, username, isReply, text, extractFn) {
  return {
    platform:    platform.name,
    username:    username,
    isReply:     isReply,
    mentionsUser: checkMentionsUser(text, username),
  };
}

/**
 * 检查评论文本是否提及当前用户。
 *
 * @param {string}      text - 评论文本
 * @param {string|null} me   - 当前用户名
 * @returns {boolean}
 */
export function checkMentionsUser(text, me) {
  if (!me) return false;
  const lower = text.toLowerCase();
  const normalizedMe = me.toLowerCase().replace(/^@/, '').trim();
  return normalizedMe.length > 0 && (lower.includes(`@${normalizedMe}`) || lower.includes(normalizedMe));
}
