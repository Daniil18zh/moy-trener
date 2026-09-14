import type { AppState, Auth, Profile, Program, Settings, WorkoutLog } from './types';

const STORAGE_PREFIX = 'mtrainer:';

const defaultSettings: Settings = { units: 'metric' };

function readSlice<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeSlice(key: string, value: unknown): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // localStorage unavailable (private mode, quota, partitioned iframe) — continue without persistence
  }
}

function freshState(): AppState {
  return {
    auth: readSlice<Auth | null>('auth', null),
    profile: readSlice<Profile | null>('profile', null),
    program: readSlice<Program | null>('program', null),
    exerciseLog: readSlice<WorkoutLog[]>('exerciseLog', []),
    settings: readSlice<Settings>('settings', defaultSettings),
  };
}

let state: AppState = freshState();

type Listener = (state: AppState) => void;
const listeners = new Set<Listener>();

export function getState(): AppState {
  return state;
}

export function updateState<K extends keyof AppState>(key: K, value: AppState[K]): void {
  state = { ...state, [key]: value };
  writeSlice(key, value);
  listeners.forEach((listener) => listener(state));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isStorageAvailable(): boolean {
  try {
    const testKey = STORAGE_PREFIX + '__test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function resetStateForTests(): void {
  state = {
    auth: null,
    profile: null,
    program: null,
    exerciseLog: [],
    settings: { ...defaultSettings },
  };
}
