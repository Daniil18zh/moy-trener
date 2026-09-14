import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getState, updateState, subscribe, resetStateForTests, isStorageAvailable } from './state';

describe('state', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStateForTests();
  });

  it('starts with null profile and empty exerciseLog', () => {
    expect(getState().profile).toBeNull();
    expect(getState().exerciseLog).toEqual([]);
  });

  it('persists a slice to localStorage on update', () => {
    updateState('profile', { heightCm: 180, weightKg: 80, goal: 'mass', experience: 'beginner', daysPerWeek: 3, sessionDurationMin: 60, equipment: 'full_gym', preferredStartTimes: {} });
    const raw = localStorage.getItem('mtrainer:profile');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).heightCm).toBe(180);
  });

  it('notifies subscribers on update', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    updateState('settings', { units: 'imperial' });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    updateState('settings', { units: 'metric' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reports storage availability', () => {
    expect(isStorageAvailable()).toBe(true);
  });
});
