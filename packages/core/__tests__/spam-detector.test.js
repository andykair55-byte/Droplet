import { describe, it, expect, beforeEach } from 'vitest';
import { SpamDetector } from '../spam-detector.js';

describe('SpamDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new SpamDetector();
  });

  // ── 刷屏检测 ────────────────────────────────────────────────

  describe('recordSpamFingerprint + detectSpam', () => {
    it('returns empty when no fingerprints recorded', () => {
      expect(detector.detectSpam()).toEqual([]);
    });

    it('does not trigger below threshold (< 3)', () => {
      const el1 = { id: 'a' };
      const el2 = { id: 'b' };
      detector.recordSpamFingerprint('hello world this is spam', el1);
      detector.recordSpamFingerprint('hello world this is spam', el2);
      expect(detector.detectSpam()).toEqual([]);
    });

    it('triggers when same fingerprint appears 3+ times', () => {
      const el1 = { id: 'a' };
      const el2 = { id: 'b' };
      const el3 = { id: 'c' };
      detector.recordSpamFingerprint('buy now click here', el1);
      detector.recordSpamFingerprint('buy now click here', el2);
      detector.recordSpamFingerprint('buy now click here', el3);
      const results = detector.detectSpam();
      expect(results).toHaveLength(1);
      expect(results[0].count).toBe(3);
      expect(results[0].elements).toEqual([el1, el2, el3]);
    });

    it('normalizes text for fingerprint (case, spaces, punctuation)', () => {
      detector.recordSpamFingerprint('Hello, World!', {});
      detector.recordSpamFingerprint('hello world', {});
      detector.recordSpamFingerprint('HELLO WORLD', {});
      // All should map to the same fingerprint "helloworld"
      const results = detector.detectSpam();
      expect(results).toHaveLength(1);
      expect(results[0].count).toBe(3);
    });

    it('ignores short text (< 5 chars after normalization)', () => {
      detector.recordSpamFingerprint('hi', {});
      detector.recordSpamFingerprint('hi', {});
      detector.recordSpamFingerprint('hi', {});
      expect(detector.detectSpam()).toEqual([]);
    });
  });

  // ── 骚扰检测 ────────────────────────────────────────────────

  describe('recordHarassFingerprint + detectHarassment', () => {
    it('returns empty when no fingerprints recorded', () => {
      expect(detector.detectHarassment()).toEqual([]);
    });

    it('does not trigger below threshold (< 5)', () => {
      for (let i = 0; i < 4; i++) {
        detector.recordHarassFingerprint('troll_user', {});
      }
      expect(detector.detectHarassment()).toEqual([]);
    });

    it('triggers when same user appears 5+ times', () => {
      const elements = [];
      for (let i = 0; i < 5; i++) {
        const el = { id: i };
        elements.push(el);
        detector.recordHarassFingerprint('troll_user', el);
      }
      const results = detector.detectHarassment();
      expect(results).toHaveLength(1);
      expect(results[0].username).toBe('troll_user');
      expect(results[0].count).toBe(5);
      expect(results[0].elements).toEqual(elements);
    });

    it('ignores empty username', () => {
      detector.recordHarassFingerprint('', {});
      detector.recordHarassFingerprint(null, {});
      expect(detector.detectHarassment()).toEqual([]);
    });
  });

  // ── reset ───────────────────────────────────────────────────

  describe('reset', () => {
    it('clears all fingerprint data', () => {
      detector.recordSpamFingerprint('test spam text', {});
      detector.recordSpamFingerprint('test spam text', {});
      detector.recordHarassFingerprint('user1', {});
      detector.reset();
      expect(detector.detectSpam()).toEqual([]);
      expect(detector.detectHarassment()).toEqual([]);
    });
  });
});
