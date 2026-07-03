import { describe, it, expect } from 'vitest';
import { normalizeText, normalizeDeep } from '../text-normalizer.js';

describe('normalizeText', () => {
  // ── 基础功能 ────────────────────────────────────────────────

  it('returns empty string for falsy input', () => {
    expect(normalizeText('')).toBe('');
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
  });

  it('converts to lowercase', () => {
    expect(normalizeText('HELLO World')).toBe('hello world');
  });

  // ── 零宽字符去除 ────────────────────────────────────────────

  it('removes zero-width characters', () => {
    expect(normalizeText('he​llo')).toBe('hello');
    expect(normalizeText('te‌st')).toBe('test');
    expect(normalizeText('ab﻿cd')).toBe('abcd');
  });

  // ── 全角转半角 ──────────────────────────────────────────────

  it('converts fullwidth to halfwidth', () => {
    // Ａ (U+FF21) → A, ！(U+FF01) → ! → leet: i
    expect(normalizeText('ＡＢＣ')).toBe('abc');
    // ！→! then leet map !→i; ＂→"
    expect(normalizeText('！＂')).toBe('i"');
  });

  it('converts fullwidth space to halfwidth', () => {
    expect(normalizeText('hello　world')).toBe('hello world');
  });

  // ── 空格折叠 ────────────────────────────────────────────────

  it('collapses multiple spaces', () => {
    expect(normalizeText('hello   world')).toBe('hello world');
    expect(normalizeText('a  b  c')).toBe('a b c');
  });

  // ── Leet speak 还原 ─────────────────────────────────────────

  it('restores leet speak characters', () => {
    expect(normalizeText('@ss')).toBe('ass');
    expect(normalizeText('h3llo')).toBe('hello');
    expect(normalizeText('t3st')).toBe('test');
  });

  it('preserves numbers in leet speak when option is set', () => {
    // preserveNumbers prevents 0→o leet replacement, but compressRepeats still applies (000→0)
    expect(normalizeText('transfer 2000', { preserveNumbers: true })).toBe('transfer 20');
    // without preserveNumbers, 0→o then ooo compresses to o
    expect(normalizeText('transfer 2000')).toBe('transfer zo');
  });

  it('replaces numbers by default (full leet)', () => {
    expect(normalizeText('h3llo')).toBe('hello');
    expect(normalizeText('t3st')).toBe('test');
  });

  // ── 重复字符压缩 ────────────────────────────────────────────

  it('compresses repeated characters (3+)', () => {
    expect(normalizeText('aaaa')).toBe('a');
    expect(normalizeText('helllllo')).toBe('helo');
    expect(normalizeText('nooo')).toBe('no');
  });

  it('does not compress 2 repeated characters', () => {
    expect(normalizeText('hello')).toBe('hello');
  });

  // ── 综合测试 ────────────────────────────────────────────────

  it('handles combined normalizations', () => {
    // 全角 + 大写 + 重复
    expect(normalizeText('ＨＥＬＬＯ')).toBe('hello');
  });
});

describe('normalizeDeep', () => {
  it('removes all spaces', () => {
    expect(normalizeDeep('hello world')).toBe('helloworld');
  });

  it('removes special characters', () => {
    expect(normalizeDeep('hello.world-test_foo')).toBe('helloworldtestfoo');
  });

  it('applies base normalization first', () => {
    // 全角 → 半角 → 去空格 → 去符号
    expect(normalizeDeep('ＡＢ Ｃ')).toBe('abc');
  });

  it('returns empty for falsy input', () => {
    expect(normalizeDeep('')).toBe('');
    expect(normalizeDeep(null)).toBe('');
  });
});
