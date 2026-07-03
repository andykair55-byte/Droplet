import { describe, it, expect } from 'vitest';
import {
  Verdict,
  RiskLevel,
  getMinRiskLevel,
  shouldAct,
} from '../detector.js';

describe('Verdict constants', () => {
  it('has correct values', () => {
    expect(Verdict.TOXIC).toBe('toxic');
    expect(Verdict.SUSPICIOUS).toBe('suspicious');
    expect(Verdict.SAFE).toBe('safe');
  });
});

describe('RiskLevel constants', () => {
  it('has correct values', () => {
    expect(RiskLevel.SAFE).toBe('safe');
    expect(RiskLevel.LOW).toBe('low');
    expect(RiskLevel.MEDIUM).toBe('medium');
    expect(RiskLevel.HIGH).toBe('high');
  });
});

describe('getMinRiskLevel', () => {
  it('returns HIGH for low sensitivity', () => {
    expect(getMinRiskLevel('low')).toBe(RiskLevel.HIGH);
  });

  it('returns MEDIUM for medium (default) sensitivity', () => {
    expect(getMinRiskLevel('medium')).toBe(RiskLevel.MEDIUM);
    expect(getMinRiskLevel(undefined)).toBe(RiskLevel.MEDIUM);
    expect(getMinRiskLevel('unknown')).toBe(RiskLevel.MEDIUM);
  });

  it('returns LOW for high sensitivity', () => {
    expect(getMinRiskLevel('high')).toBe(RiskLevel.LOW);
  });
});

describe('shouldAct', () => {
  it('HIGH always passes all sensitivities', () => {
    expect(shouldAct(RiskLevel.HIGH, 'low')).toBe(true);
    expect(shouldAct(RiskLevel.HIGH, 'medium')).toBe(true);
    expect(shouldAct(RiskLevel.HIGH, 'high')).toBe(true);
  });

  it('MEDIUM passes medium and high, not low', () => {
    expect(shouldAct(RiskLevel.MEDIUM, 'low')).toBe(false);
    expect(shouldAct(RiskLevel.MEDIUM, 'medium')).toBe(true);
    expect(shouldAct(RiskLevel.MEDIUM, 'high')).toBe(true);
  });

  it('LOW only passes high sensitivity', () => {
    expect(shouldAct(RiskLevel.LOW, 'low')).toBe(false);
    expect(shouldAct(RiskLevel.LOW, 'medium')).toBe(false);
    expect(shouldAct(RiskLevel.LOW, 'high')).toBe(true);
  });

  it('SAFE never passes', () => {
    expect(shouldAct(RiskLevel.SAFE, 'low')).toBe(false);
    expect(shouldAct(RiskLevel.SAFE, 'medium')).toBe(false);
    expect(shouldAct(RiskLevel.SAFE, 'high')).toBe(false);
  });
});
