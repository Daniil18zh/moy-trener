import { describe, expect, it } from 'vitest';
import { pickSplit, dayTemplatesForSplit, MUSCLE_GROUPS_BY_TEMPLATE } from './splitPicker';

describe('pickSplit', () => {
  it('picks fullbody for 2 and 3 days', () => {
    expect(pickSplit(2)).toBe('fullbody');
    expect(pickSplit(3)).toBe('fullbody');
  });

  it('picks upper_lower for 4 days', () => {
    expect(pickSplit(4)).toBe('upper_lower');
  });

  it('picks ppl for 5 and 6 days', () => {
    expect(pickSplit(5)).toBe('ppl');
    expect(pickSplit(6)).toBe('ppl');
  });

  it('throws for out-of-range values', () => {
    expect(() => pickSplit(1)).toThrow();
    expect(() => pickSplit(7)).toThrow();
  });
});

describe('dayTemplatesForSplit', () => {
  it('repeats "full" for fullbody', () => {
    expect(dayTemplatesForSplit('fullbody', 3)).toEqual(['full', 'full', 'full']);
  });

  it('alternates upper/lower', () => {
    expect(dayTemplatesForSplit('upper_lower', 4)).toEqual(['upper', 'lower', 'upper', 'lower']);
  });

  it('cycles push/pull/legs', () => {
    expect(dayTemplatesForSplit('ppl', 5)).toEqual(['push', 'pull', 'legs', 'push', 'pull']);
  });
});

describe('MUSCLE_GROUPS_BY_TEMPLATE', () => {
  it('covers all 6 muscle groups across a fullbody day', () => {
    expect(MUSCLE_GROUPS_BY_TEMPLATE.full.sort()).toEqual(['arms', 'back', 'chest', 'core', 'legs', 'shoulders']);
  });
});
