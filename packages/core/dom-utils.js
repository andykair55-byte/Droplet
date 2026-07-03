/**
 * dom-utils.js — Shadow DOM 深度查询工具
 *
 * 从 scanner.js 提取的纯工具函数，支持穿透嵌套 Web Component
 * 的 Shadow DOM 查找元素。无副作用，可独立测试。
 */

/**
 * 在元素及其嵌套 Shadow DOM 中查找匹配选择器的第一个元素。
 * 优先检查 root 自身的 shadowRoot（Web Component 子元素都在 shadowRoot 内）。
 *
 * @param {Element} root     - 起始元素
 * @param {string}  selector - CSS 选择器
 * @returns {Element|null}
 */
export function deepQuerySelectorInEl(root, selector) {
  if (!selector || !root) return null;

  // 优先检查 root 自身的 shadowRoot（核心修复点）
  if (root.shadowRoot) {
    const srDirect = root.shadowRoot.querySelector(selector);
    if (srDirect) return srDirect;
    const srDeep = deepQuerySelectorInEl(root.shadowRoot, selector);
    if (srDeep) return srDeep;
  }

  // 在当前 DOM 层级（light DOM）查找
  const direct = root.querySelector(selector);
  if (direct) return direct;

  // 遍历所有子元素，遇到 shadowRoot 就递归进去
  for (const child of root.children || []) {
    if (child.shadowRoot) {
      const srHit = child.shadowRoot.querySelector(selector);
      if (srHit) return srHit;
      const deepHit = deepQuerySelectorInEl(child.shadowRoot, selector);
      if (deepHit) return deepHit;
    }
    const childHit = deepQuerySelectorInEl(child, selector);
    if (childHit) return childHit;
  }
  return null;
}

/**
 * 在整个页面（包括所有 Shadow DOM）中查找匹配选择器的所有元素。
 *
 * @param {string} selector - CSS 选择器
 * @returns {Element[]}
 */
export function deepQueryAll(selector) {
  const results = [];
  deepQueryAllRecursive(document.body, selector, results);
  return results;
}

/**
 * 递归辅助：在 root 及其所有嵌套 Shadow DOM 中查找匹配元素。
 *
 * @param {Element}  root     - 起始元素
 * @param {string}   selector - CSS 选择器
 * @param {Element[]} results  - 结果累加数组
 */
export function deepQueryAllRecursive(root, selector, results) {
  if (root.shadowRoot) {
    deepQueryAllRecursive(root.shadowRoot, selector, results);
  }

  try {
    const found = root.querySelectorAll(selector);
    for (const el of found) {
      results.push(el);
    }
  } catch (e) { /* invalid selector in context */ }

  for (const child of root.children || []) {
    if (child.shadowRoot) {
      deepQueryAllRecursive(child.shadowRoot, selector, results);
    }
    deepQueryAllRecursive(child, selector, results);
  }
}

/**
 * 在指定 shadowRoot 内查找所有匹配选择器的元素。
 *
 * @param {Document|ShadowRoot} root     - 查找范围
 * @param {string}              selector - CSS 选择器
 * @returns {Element[]}
 */
export function deepQuerySelectorAllInRoot(root, selector) {
  if (!root || !selector) return [];
  try {
    return [...root.querySelectorAll(selector)];
  } catch {
    return [];
  }
}
