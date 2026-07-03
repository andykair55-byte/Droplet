import { describe, it, expect, beforeEach, vi } from 'vitest';

// memory.js uses GM_getValue/GM_setValue — mock them before import
globalThis.GM_getValue = vi.fn(() => '[]');
globalThis.GM_setValue = vi.fn();

import { MemoryManager } from '../memory.js';

describe('MemoryManager', () => {
  let mem;

  beforeEach(() => {
    vi.clearAllMocks();
    GM_getValue.mockReturnValue('[]');
    mem = new MemoryManager();
  });

  // ── write / queryByType / queryByKey ────────────────────────

  describe('write + query', () => {
    it('writes and queries by type', () => {
      mem.write({ type: 'topic', key: 'sports', value: { label: 'Sports' } });
      mem.write({ type: 'pattern', key: 'spam', value: 'buy now' });
      const topics = mem.queryByType('topic');
      expect(topics).toHaveLength(1);
      expect(topics[0].key).toBe('sports');
    });

    it('writes and queries by key', () => {
      mem.write({ type: 'topic', key: 'sports', value: { label: 'Sports' } });
      const result = mem.queryByKey('sports');
      expect(result).not.toBeNull();
      expect(result.type).toBe('topic');
      expect(result.value).toEqual({ label: 'Sports' });
    });

    it('returns null for non-existent key', () => {
      expect(mem.queryByKey('nonexistent')).toBeNull();
    });

    it('returns empty array for non-existent type', () => {
      expect(mem.queryByType('nonexistent')).toEqual([]);
    });

    it('sets default confidence to 0.5', () => {
      const id = mem.write({ type: 'topic', key: 'test', value: 'v' });
      const entry = mem.queryByKey('test');
      expect(entry.confidence).toBe(0.5);
    });

    it('uses provided confidence', () => {
      mem.write({ type: 'topic', key: 'test', value: 'v', confidence: 0.8 });
      const entry = mem.queryByKey('test');
      expect(entry.confidence).toBe(0.8);
    });

    it('calls GM_setValue on write', () => {
      mem.write({ type: 'topic', key: 'test', value: 'v' });
      expect(GM_setValue).toHaveBeenCalled();
    });
  });

  // ── recordHit ───────────────────────────────────────────────

  describe('recordHit', () => {
    it('increments hitCount and boosts confidence', () => {
      const id = mem.write({ type: 'topic', key: 'test', value: 'v', confidence: 0.5 });
      mem.recordHit(id);
      const entry = mem.queryByKey('test');
      expect(entry.hitCount).toBe(1);
      expect(entry.confidence).toBeCloseTo(0.52, 5);
    });

    it('caps confidence at 0.95', () => {
      const id = mem.write({ type: 'topic', key: 'test', value: 'v', confidence: 0.94 });
      mem.recordHit(id);
      mem.recordHit(id);
      const entry = mem.queryByKey('test');
      expect(entry.confidence).toBe(0.95);
    });

    it('does nothing for non-existent id', () => {
      expect(() => mem.recordHit('fake_id')).not.toThrow();
    });
  });

  // ── recordCorrection ────────────────────────────────────────

  describe('recordCorrection', () => {
    it('reduces confidence by 0.1', () => {
      const id = mem.write({ type: 'topic', key: 'test', value: 'v', confidence: 0.7 });
      mem.recordCorrection(id);
      const entry = mem.queryByKey('test');
      expect(entry.confidence).toBeCloseTo(0.6, 5);
    });

    it('auto-deletes when confidence drops below 0.45', () => {
      const id = mem.write({ type: 'topic', key: 'test', value: 'v', confidence: 0.5 });
      const deleted = mem.recordCorrection(id);
      expect(deleted).toBe(true);
      expect(mem.queryByKey('test')).toBeNull();
    });

    it('force-deletes after 3 reverse marks', () => {
      const id = mem.write({ type: 'topic', key: 'test', value: 'v', confidence: 0.9 });
      mem.recordCorrection(id); // reverseCount=1, conf=0.8
      mem.recordCorrection(id); // reverseCount=2, conf=0.7
      const deleted = mem.recordCorrection(id); // reverseCount=3 → delete
      expect(deleted).toBe(true);
      expect(mem.queryByKey('test')).toBeNull();
    });

    it('returns false for non-existent id', () => {
      expect(mem.recordCorrection('fake_id')).toBe(false);
    });
  });

  // ── prune ───────────────────────────────────────────────────

  describe('prune', () => {
    it('removes entries with low confidence', () => {
      mem.write({ type: 'topic', key: 'low', value: 'v', confidence: 0.3 });
      const cleaned = mem.prune();
      expect(cleaned).toBe(1);
      expect(mem.queryByKey('low')).toBeNull();
    });

    it('keeps entries with valid confidence', () => {
      mem.write({ type: 'topic', key: 'ok', value: 'v', confidence: 0.8 });
      mem.prune();
      expect(mem.queryByKey('ok')).not.toBeNull();
    });
  });

  // ── getStats ────────────────────────────────────────────────

  describe('getStats', () => {
    it('counts entries by type', () => {
      mem.write({ type: 'topic', key: 'a', value: 'v' });
      mem.write({ type: 'topic', key: 'b', value: 'v' });
      mem.write({ type: 'pattern', key: 'c', value: 'v' });
      const stats = mem.getStats();
      expect(stats.total).toBe(3);
      expect(stats.byType.topic).toBe(2);
      expect(stats.byType.pattern).toBe(1);
    });

    it('returns zero for empty store', () => {
      const stats = mem.getStats();
      expect(stats.total).toBe(0);
      expect(stats.byType).toEqual({});
    });
  });

  // ── _load from GM_getValue ──────────────────────────────────

  describe('_load', () => {
    it('loads entries from GM_getValue', () => {
      const saved = [
        { id: 't_topic_a', type: 'topic', key: 'a', value: 'v', confidence: 0.7, hitCount: 2, reverseCount: 0, lastHit: 0, createdAt: Date.now(), source: 'system' },
      ];
      GM_getValue.mockReturnValue(JSON.stringify(saved));
      const m = new MemoryManager();
      expect(m.queryByKey('a')).not.toBeNull();
      expect(m.queryByKey('a').confidence).toBe(0.7);
    });

    it('handles corrupted GM_getValue data gracefully', () => {
      GM_getValue.mockReturnValue('invalid json');
      expect(() => new MemoryManager()).not.toThrow();
    });
  });
});
