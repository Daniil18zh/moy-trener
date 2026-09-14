import { beforeEach, describe, expect, it } from 'vitest';
import { exportAllAsJson, importAllFromJson } from './exportImport';
import { getState, updateState, resetStateForTests } from './state';

describe('exportImport', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStateForTests();
  });

  it('round-trips profile and settings through export/import', () => {
    updateState('settings', { units: 'imperial' });
    updateState('auth', { login: 'x', passwordHash: 'y' });

    const json = exportAllAsJson();
    resetStateForTests();
    expect(getState().settings.units).toBe('metric');

    const result = importAllFromJson(json);
    expect(result.ok).toBe(true);
    expect(getState().settings.units).toBe('imperial');
    expect(getState().auth?.login).toBe('x');
  });

  it('rejects malformed JSON without changing state', () => {
    updateState('settings', { units: 'imperial' });
    const result = importAllFromJson('{not valid json');
    expect(result.ok).toBe(false);
    expect(getState().settings.units).toBe('imperial'); // unchanged
  });

  it('rejects JSON missing required top-level keys', () => {
    const result = importAllFromJson(JSON.stringify({ settings: { units: 'metric' } }));
    expect(result.ok).toBe(false);
  });

  describe('shape validation (regression)', () => {
    function fileWith(overrides: Record<string, unknown>): string {
      return JSON.stringify({
        auth: null,
        profile: null,
        program: null,
        exerciseLog: [],
        settings: { units: 'metric' },
        ...overrides,
      });
    }

    it('rejects a program with no training days instead of persisting a crash-inducing state', () => {
      // This exact file used to pass validation, get written to state, and then make the home
      // screen divide by zero -> program.days[NaN] -> throw on undefined.
      const result = importAllFromJson(fileWith({ program: { days: [] } }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/тренировочного дня/);
    });

    it('rejects a day without an exercises array', () => {
      const result = importAllFromJson(fileWith({ program: { days: [{ dayIndex: 0, template: 'full' }] } }));
      expect(result.ok).toBe(false);
    });

    it('rejects a profile with non-numeric height/weight', () => {
      const result = importAllFromJson(fileWith({ profile: { heightCm: 'высокий', weightKg: 80 } }));
      expect(result.ok).toBe(false);
    });

    it('rejects a non-array exerciseLog and an unknown units value', () => {
      expect(importAllFromJson(fileWith({ exerciseLog: {} })).ok).toBe(false);
      expect(importAllFromJson(fileWith({ settings: { units: 'stones' } })).ok).toBe(false);
    });

    it('writes nothing at all when validation fails', () => {
      updateState('settings', { units: 'imperial' });
      updateState('auth', { login: 'before', passwordHash: 'h' });

      const result = importAllFromJson(fileWith({
        auth: { login: 'after', passwordHash: 'h2' },
        program: { days: [] }, // the failure
      }));

      expect(result.ok).toBe(false);
      // auth is validated *after* nothing — the point is that no key was written, not even the
      // ones that appear before the offending one.
      expect(getState().auth?.login).toBe('before');
      expect(getState().settings.units).toBe('imperial');
    });

    it('accepts a well-formed program and profile', () => {
      const result = importAllFromJson(fileWith({
        profile: { heightCm: 180, weightKg: 80 },
        program: { days: [{ dayIndex: 0, template: 'full', exercises: [] }] },
      }));
      expect(result.ok).toBe(true);
    });
  });
});
