import type { AppState } from './types';
import { getState, updateState } from './state';

const REQUIRED_KEYS: (keyof AppState)[] = ['auth', 'profile', 'program', 'exerciseLog', 'settings'];

export function exportAllAsJson(): string {
  return JSON.stringify(getState(), null, 2);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Minimal shape check on the values, not just the keys. Key-presence validation alone let a file
 * like {"program": {"days": []}} through: home.ts then computes exerciseLog.length % days.length,
 * divides by zero, indexes program.days[NaN], and throws on the undefined day — a blank screen with
 * the corrupt state already persisted and no way back. Returns a Russian error message, or null.
 */
function validateShape(state: Record<string, unknown>): string | null {
  const { program, profile, exerciseLog, settings } = state;

  if (program !== null && program !== undefined) {
    if (!isObject(program)) return 'Поле "program" повреждено';
    const days = program.days;
    if (!Array.isArray(days) || days.length === 0) {
      return 'Программа в файле повреждена: нет ни одного тренировочного дня';
    }
    for (const day of days) {
      if (!isObject(day) || !Array.isArray(day.exercises)) {
        return 'Программа в файле повреждена: у тренировочного дня нет списка упражнений';
      }
    }
  }

  if (profile !== null && profile !== undefined) {
    if (!isObject(profile)) return 'Поле "profile" повреждено';
    if (!Number.isFinite(profile.heightCm) || !Number.isFinite(profile.weightKg)) {
      return 'Анкета в файле повреждена: рост и вес должны быть числами';
    }
  }

  if (!Array.isArray(exerciseLog)) {
    return 'История тренировок в файле повреждена: ожидался список';
  }

  if (!isObject(settings) || (settings.units !== 'metric' && settings.units !== 'imperial')) {
    return 'Настройки в файле повреждены: неизвестные единицы измерения';
  }

  return null;
}

export function importAllFromJson(json: string): { ok: true } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Файл повреждён или не является корректным JSON' };
  }

  if (!isObject(parsed)) {
    return { ok: false, error: 'Некорректная структура файла' };
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in parsed)) {
      return { ok: false, error: `В файле отсутствует обязательное поле "${key}"` };
    }
  }

  // Validate everything BEFORE writing anything: a partial write would leave the app in a state
  // that is half-imported and half-previous, with no recovery path.
  const shapeError = validateShape(parsed);
  if (shapeError) {
    return { ok: false, error: shapeError };
  }

  const state = parsed as unknown as AppState;
  for (const key of REQUIRED_KEYS) {
    updateState(key, state[key] as never);
  }
  return { ok: true };
}
