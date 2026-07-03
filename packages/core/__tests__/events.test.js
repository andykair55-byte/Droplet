import { describe, it, expect, beforeEach, vi } from 'vitest';
import { on, off, emit, once, clear, EventBus, Events } from '../events.js';

describe('EventBus', () => {
  beforeEach(() => {
    clear();
  });

  // ── 命名空间 ────────────────────────────────────────────────

  it('auto-prefixes events with cs: namespace', () => {
    const handler = vi.fn();
    on('test:event', handler);
    emit('test:event', 'data');
    expect(handler).toHaveBeenCalledWith('data');
  });

  it('does not double-prefix cs: events', () => {
    const handler = vi.fn();
    on('cs:scan:result', handler);
    emit('cs:scan:result', 'data');
    expect(handler).toHaveBeenCalledWith('data');
  });

  // ── on / emit ───────────────────────────────────────────────

  it('registers and calls multiple listeners', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    on('evt', h1);
    on('evt', h2);
    emit('evt', 42);
    expect(h1).toHaveBeenCalledWith(42);
    expect(h2).toHaveBeenCalledWith(42);
  });

  it('passes data to handler', () => {
    const handler = vi.fn();
    on('evt', handler);
    emit('evt', { foo: 'bar' });
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
  });

  // ── off ─────────────────────────────────────────────────────

  it('unsubscribes a specific listener', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    on('evt', h1);
    on('evt', h2);
    off('evt', h1);
    emit('evt');
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it('returns unsubscribe function from on()', () => {
    const handler = vi.fn();
    const unsub = on('evt', handler);
    unsub();
    emit('evt');
    expect(handler).not.toHaveBeenCalled();
  });

  // ── once ────────────────────────────────────────────────────

  it('fires handler only once', () => {
    const handler = vi.fn();
    once('evt', handler);
    emit('evt', 'first');
    emit('evt', 'second');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('first');
  });

  // ── clear ───────────────────────────────────────────────────

  it('clears all listeners for a specific event', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    on('evt1', h1);
    on('evt2', h2);
    clear('evt1');
    emit('evt1');
    emit('evt2');
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it('clears all listeners when no event specified', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    on('evt1', h1);
    on('evt2', h2);
    clear();
    emit('evt1');
    emit('evt2');
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  // ── 错误隔离 ────────────────────────────────────────────────

  it('isolates listener errors (one handler throws, others still run)', () => {
    const h1 = vi.fn(() => { throw new Error('boom'); });
    const h2 = vi.fn();
    on('evt', h1);
    on('evt', h2);
    emit('evt');
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  // ── EventBus 集合导出 ───────────────────────────────────────

  it('exports EventBus object with all methods', () => {
    expect(EventBus).toHaveProperty('on');
    expect(EventBus).toHaveProperty('off');
    expect(EventBus).toHaveProperty('emit');
    expect(EventBus).toHaveProperty('once');
    expect(EventBus).toHaveProperty('clear');
  });

  // ── Events 常量 ─────────────────────────────────────────────

  it('exports Events constants with cs: prefix', () => {
    expect(Events.SCAN_RESULT).toBe('cs:scan:result');
    expect(Events.SCAN_STATUS).toBe('cs:scan:status');
    expect(Events.CONFIG_UPDATED).toBe('cs:config:updated');
  });
});
