import type { AppState } from './types';
import { getState, updateState } from './state';

const REQUIRED_KEYS: (keyof AppState)[] = ['auth', 'profile', 'program', 'exerciseLog', 'settings'];

export function exportAllAsJson(): string {
  return JSON.stringify(getState(), null, 2);
}

export function importAllFromJson(json: string): { ok: true } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Файл повреждён или не является корректным JSON' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'Некорректная структура файла' };
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in parsed)) {
      return { ok: false, error: `В файле отсутствует обязательное поле "${key}"` };
    }
  }

  const state = parsed as AppState;
  for (const key of REQUIRED_KEYS) {
    updateState(key, state[key] as never);
  }
  return { ok: true };
}
