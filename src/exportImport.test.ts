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
});
