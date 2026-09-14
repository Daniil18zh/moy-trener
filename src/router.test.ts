import { describe, expect, it, beforeEach } from 'vitest';
import { resolveRoute } from './router';
import { resetAuthenticationForTests, markAuthenticated } from './sessionAuth';
import type { AppState } from './types';

function makeState(overrides: Partial<AppState>): AppState {
  return { auth: null, profile: null, program: null, exerciseLog: [], settings: { units: 'metric' }, ...overrides };
}

describe('resolveRoute', () => {
  beforeEach(() => {
    resetAuthenticationForTests();
  });

  it('goes to login when not authenticated, regardless of hash', () => {
    expect(resolveRoute('#/home', makeState({ auth: null }), false)).toBe('login');
  });

  it('goes to onboarding when authenticated but no profile', () => {
    const state = makeState({ auth: { login: 'x', passwordHash: 'y' } });
    expect(resolveRoute('#/home', state, true)).toBe('onboarding');
  });

  it('honors the requested hash once authenticated with a profile', () => {
    const state = makeState({
      auth: { login: 'x', passwordHash: 'y' },
      profile: { heightCm: 180, weightKg: 80, goal: 'mass', experience: 'beginner', daysPerWeek: 3, sessionDurationMin: 60, equipment: 'full_gym', preferredStartTimes: {} },
    });
    expect(resolveRoute('#/workout', state, true)).toBe('workout');
    expect(resolveRoute('#/settings', state, true)).toBe('settings');
    expect(resolveRoute('#/unknown', state, true)).toBe('home');
  });

  it('goes to login even if credentials and profile exist when not authenticated', () => {
    const state = makeState({
      auth: { login: 'x', passwordHash: 'y' },
      profile: { heightCm: 180, weightKg: 80, goal: 'mass', experience: 'beginner', daysPerWeek: 3, sessionDurationMin: 60, equipment: 'full_gym', preferredStartTimes: {} },
    });
    expect(resolveRoute('#/home', state, false)).toBe('login');
  });
});
