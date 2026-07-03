/**
 * content-blurrer.js — 内容模糊 & 揭示/重屏蔽 UI
 *
 * 从 scanner.js 提取的模糊遮罩、揭示按钮、重屏蔽按钮逻辑。
 * 只模糊违规文本，不模糊整个评论条目。
 */

import { t } from './i18n.js';

/**
 * 内容模糊器
 *
 * @param {object} opts
 * @param {Set}      opts.revealedTexts - 已手动解除的文本哈希集合（共享状态）
 * @param {Function} opts.textHash      - (text) => string  文本哈希函数
 */
export class ContentBlurrer {
  constructor({ revealedTexts, textHash }) {
    this._revealedTexts = revealedTexts;
    this._textHash = textHash;
  }

  /**
   * 屏蔽具体内容元素（只模糊违规文本，不模糊整个评论条目）。
   * 解除显示后提供"再次屏蔽"按钮防止误操作。
   *
   * @param {Element} targetEl - 要模糊的目标元素
   * @param {object}  result   - 检测结果对象
   * @param {string}  type     - 'toxic' | 'spam' | 'harass'
   */
  blurContent(targetEl, result, type = 'toxic') {
    // 跳过已手动解除的内容
    if (targetEl.dataset.csRevealed === 'true') return;
    // 跳过已模糊处理的内容
    if (targetEl.dataset.csVerdict) return;

    // 为目标元素分配唯一 ID
    if (!targetEl.dataset.csId) {
      targetEl.dataset.csId = `cs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    const csId = targetEl.dataset.csId;

    targetEl.dataset.csVerdict = type;
    targetEl.dataset.csReason = result.reason;
    targetEl.style.filter = 'blur(12px)';
    targetEl.style.pointerEvents = 'none';
    targetEl.style.userSelect = 'none';
    targetEl.style.opacity = '0.5';
    targetEl.style.transition = 'filter 0.2s ease, opacity 0.2s ease';

    // 移除属于当前目标元素的按钮
    document.querySelectorAll(`.cs-reveal-btn[data-cs-target="${csId}"]`).forEach(b => b.remove());
    document.querySelectorAll(`.cs-reblock-btn[data-cs-target="${csId}"]`).forEach(b => b.remove());

    // 创建覆盖按钮
    const btn = document.createElement('button');
    btn.className = 'cs-reveal-btn';
    btn.textContent = `🛡️ ${t('blurBtn')}`;
    btn.dataset.csOverlay = 'true';
    btn.dataset.csTarget = csId;
    if (type === 'spam') btn.classList.add('cs-spam-overlay');
    if (type === 'harass') btn.classList.add('cs-harass-overlay');

    Object.assign(btn.style, {
      position: 'fixed',
      zIndex: '2147483640',
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(4px)',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.25)',
      borderRadius: '8px',
      padding: '6px 14px',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      transition: 'background 0.15s ease',
      lineHeight: '1.4',
    });

    const positionOverlay = () => {
      if (!btn.isConnected) return;
      const r = targetEl.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || !isInViewport(r)) {
        btn.style.display = 'none';
        return;
      }
      btn.style.display = '';
      btn.style.top = `${r.top + r.height / 2 - 14}px`;
      btn.style.left = `${r.left + r.width / 2 - 70}px`;
    };

    positionOverlay();

    const updatePos = () => positionOverlay();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);

    const origRemove = btn.remove.bind(btn);
    btn.remove = () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
      observer.disconnect();
      origRemove();
    };

    document.body.appendChild(btn);

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          btn.style.display = 'none';
        } else {
          positionOverlay();
        }
      }
    }, { threshold: [0, 0.05] });
    observer.observe(targetEl);

    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(0,0,0,0.75)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(0,0,0,0.55)'; });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      targetEl.style.filter = '';
      targetEl.style.pointerEvents = '';
      targetEl.style.userSelect = '';
      targetEl.style.opacity = '';
      targetEl.dataset.csRevealed = 'true';
      const hash = this._textHash(targetEl.innerText || targetEl.textContent || '');
      if (hash) this._revealedTexts.add(hash);
      btn.remove();
      this.addReBlockOption(targetEl, result, type);
    });
  }

  /**
   * 解除屏蔽后，在文本元素旁添加"再次屏蔽"按钮。
   *
   * @param {Element} targetEl - 目标元素
   * @param {object}  result   - 检测结果对象
   * @param {string}  type     - 'toxic' | 'spam' | 'harass'
   */
  addReBlockOption(targetEl, result, type) {
    const csId = targetEl.dataset.csId || '';

    document.querySelectorAll(`.cs-reblock-btn[data-cs-target="${csId}"]`).forEach(b => b.remove());
    document.querySelectorAll(`.cs-reveal-btn[data-cs-target="${csId}"]`).forEach(b => b.remove());

    const reBlockBtn = document.createElement('button');
    reBlockBtn.className = 'cs-reblock-btn';
    reBlockBtn.textContent = `🛡️ ${t('reblockBtn')}`;
    reBlockBtn.title = t('reblockHint');
    reBlockBtn.dataset.csTarget = csId;
    reBlockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      reBlockBtn.remove();
      delete targetEl.dataset.csRevealed;
      delete targetEl.dataset.csVerdict;
      this.blurContent(targetEl, result, type);
    });

    const isInShadow = targetEl.getRootNode() instanceof ShadowRoot;

    if (!isInShadow) {
      try {
        if (targetEl.nextSibling) {
          targetEl.parentNode.insertBefore(reBlockBtn, targetEl.nextSibling);
        } else {
          targetEl.parentNode.appendChild(reBlockBtn);
        }
      } catch (e) {
        const r = targetEl.getBoundingClientRect();
        Object.assign(reBlockBtn.style, {
          position: 'fixed', top: `${r.top}px`, left: `${r.right + 8}px`, zIndex: '2147483640',
        });
        document.body.appendChild(reBlockBtn);
      }
    } else {
      const r = targetEl.getBoundingClientRect();
      Object.assign(reBlockBtn.style, {
        position: 'fixed', top: `${r.top}px`, left: `${r.right + 8}px`, zIndex: '2147483640',
      });
      document.body.appendChild(reBlockBtn);

      const updatePos = () => {
        if (!reBlockBtn.isConnected) { window.removeEventListener('scroll', updatePos, true); return; }
        const rect = targetEl.getBoundingClientRect();
        reBlockBtn.style.top = `${rect.top}px`;
        reBlockBtn.style.left = `${rect.right + 8}px`;
      };
      window.addEventListener('scroll', updatePos, true);
      const origRemove = reBlockBtn.remove.bind(reBlockBtn);
      reBlockBtn.remove = () => { window.removeEventListener('scroll', updatePos, true); origRemove(); };
    }
  }

  /**
   * 计算文本的简单哈希，用于去重。
   *
   * @param {string} text - 输入文本
   * @returns {string}
   */
  static textHash(text) {
    if (!text) return '';
    const s = text.slice(0, 100).toLowerCase().replace(/\s+/g, ' ');
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + c;
      hash = hash & hash;
    }
    return `h${Math.abs(hash)}`;
  }
}

/** 检测矩形是否在视口范围内 */
function isInViewport(r) {
  return !(r.right < 0 || r.bottom < 0 || r.left > window.innerWidth || r.top > window.innerHeight);
}
