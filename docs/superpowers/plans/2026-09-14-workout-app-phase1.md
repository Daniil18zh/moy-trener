# Мой тренер — Фаза 1 (ядро) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core loop of "Мой тренер" — login, onboarding, exercise database, deterministic program generator with weekly progression, and a workout-logging screen with rest/session timers — as a static Vite+TypeScript app with no backend.

**Architecture:** Vanilla TypeScript, no UI framework. Pure-function core (state, auth hashing, exercise filtering, program generation, progression math) is unit-tested with Vitest; screens are thin DOM-rendering modules wired together by a hash router. All persistence is `localStorage`, mirrored by a JSON export/import module.

**Tech Stack:** Vite, TypeScript, Vitest (jsdom environment), `tsx` (dev-only, to run the one-off data-build script), `free-exercise-db` (vendored dataset, Unlicense).

**Spec:** `docs/superpowers/specs/2026-09-14-workout-app-phase1-design.md`

## Global Constraints

- Interface language: Russian, everywhere in the UI (spec §0.8).
- No backend, no paid APIs; all logic and data run client-side (spec §2.4, §3).
- Must render correctly from 360px width and inside an iframe (spec §2.4, §6).
- Tap targets ≥ 44×44px (spec §6).
- Default credentials are `danya` / `a0zOlB6rbhN914`, hashed with SHA-256 before storage, never stored or logged in plaintext (spec §5.1; user explicitly approved committing this exact value despite the repo being public).
- Repository is standalone (`E:\itproject\bodybuilding program`, own git history) — not part of the `E:\itproject` monorepo.
- Exercise dataset: vendored from `free-exercise-db` (https://github.com/yuhonas/free-exercise-db, Unlicense), filtered to `category` in `strength`, `powerlifting`, `olympic weightlifting`; images for kept exercises are committed to git as-is (user's explicit choice, accepting the repo-size cost).
- Deload cadence is fixed at every 6th week (spec's "5–6-ю неделю" resolved to a single deterministic modulus, 6, for implementation).

---

## Task 1: Project scaffold, shared types, and state module

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`
- Create: `src/types.ts`
- Create: `src/state.ts`
- Create: `src/test-setup.ts`
- Test: `src/state.test.ts`

**Interfaces:**
- Produces: `AppState`, `Profile`, `Program`, `ProgramExercise`, `ProgramDay`, `WorkoutLog`, `SetLogEntry`, `Settings`, `Auth`, `Exercise`, `MuscleGroup`, `Equipment`, `Goal`, `Experience`, `Split`, `ProgressionPhase` types (all consumed by every later task). `getState(): AppState`, `updateState<K extends keyof AppState>(key: K, value: AppState[K]): void`, `subscribe(listener: (s: AppState) => void): () => void`, `isStorageAvailable(): boolean`, `resetStateForTests(): void`.

- [ ] **Step 1: Scaffold the Vite + TypeScript project**

```bash
npm create vite@latest . -- --template vanilla-ts
```

When prompted about the non-empty directory (the `docs/` folder already exists), confirm proceeding.

- [ ] **Step 2: Install test dependencies**

```bash
npm install
npm install -D vitest jsdom
```

- [ ] **Step 3: Replace `vite.config.ts` with test config**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
  },
});
```

- [ ] **Step 4: Add crypto polyfill for the test environment**

```ts
// src/test-setup.ts
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto?.subtle) {
  // jsdom does not implement SubtleCrypto; Node's webcrypto does.
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
```

- [ ] **Step 5: Add the `test` script to `package.json`**

Edit `package.json` `"scripts"` to include:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest run"
}
```

- [ ] **Step 6: Write `src/types.ts`**

```ts
export type Goal = 'mass' | 'fatloss' | 'strength' | 'fitness' | 'maintenance';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Equipment = 'full_gym' | 'home_dumbbells' | 'bodyweight';
export type Split = 'fullbody' | 'upper_lower' | 'ppl';
export type ProgressionPhase = 'linear' | 'double_progression';
export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core';

export interface Auth {
  login: string;
  passwordHash: string; // SHA-256 hex
}

export interface Profile {
  age?: number;
  sex?: 'male' | 'female';
  heightCm: number;
  weightKg: number;
  measurements?: { waist?: number; chest?: number; hips?: number; biceps?: number; thigh?: number };
  goal: Goal;
  experience: Experience;
  daysPerWeek: number; // 2-6
  sessionDurationMin: number;
  equipment: Equipment;
  preferredStartTimes: Record<string, string>; // "monday" -> "18:00", used by Phase 2 schedule
  injuries?: string;
}

export interface Exercise {
  id: string;
  nameRu: string;
  nameEn: string;
  muscleGroup: MuscleGroup;
  secondaryMuscleGroups: MuscleGroup[];
  equipmentTiers: Equipment[]; // which of our 3 tiers can perform it
  mechanic: 'compound' | 'isolation';
  level: Experience;
  instructions: string[];
  images: string[]; // paths under /exercises/<id>/N.jpg
}

export interface ProgramExercise {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  targetWeightKg: number | null; // null = bodyweight / not yet established
  restSec: number;
  lastChangeReason?: string;
}

export interface ProgramDay {
  dayIndex: number;
  template: 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs';
  exercises: ProgramExercise[];
}

export interface ExerciseProgress {
  phase: ProgressionPhase;
  consecutiveFailures: number;
  weeksWithoutIncrease: number;
}

export interface Program {
  split: Split;
  days: ProgramDay[];
  currentWeek: number;
  progressByExercise: Record<string, ExerciseProgress>;
  estimatedOneRepMax: Record<string, number>;
  consecutiveGoodWeeks: number;
}

export interface SetLogEntry {
  planned: { weightKg: number | null; reps: number };
  actual: { weightKg: number | null; reps: number };
  done: boolean;
}

export interface WorkoutLog {
  date: string; // ISO date
  dayIndex: number;
  exercises: { exerciseId: string; sets: SetLogEntry[] }[];
  durationMin: number;
  totalTonnageKg: number;
}

export interface Settings {
  units: 'metric' | 'imperial';
}

export interface AppState {
  auth: Auth | null;
  profile: Profile | null;
  program: Program | null;
  exerciseLog: WorkoutLog[];
  settings: Settings;
}
```

- [ ] **Step 7: Write the failing test for `state.ts`**

```ts
// src/state.test.ts
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
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npm test -- state.test.ts`
Expected: FAIL — `src/state.ts` does not exist yet.

- [ ] **Step 9: Implement `src/state.ts`**

```ts
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
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npm test -- state.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 11: Write `index.html` with mobile-first viewport**

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no" />
    <title>Мой тренер</title>
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 12: Write base mobile-first CSS**

```css
/* src/style.css */
:root {
  color-scheme: light;
  --bg: #ffffff;
  --fg: #1a1a1a;
  --accent: #2563eb;
  --danger: #dc2626;
  --border: #d4d4d8;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  min-width: 320px;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--fg);
}

#app {
  max-width: 480px;
  margin: 0 auto;
  padding: 12px;
}

button {
  min-height: 44px;
  min-width: 44px;
  font-size: 1rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--accent);
  color: white;
  cursor: pointer;
}

button.secondary { background: white; color: var(--fg); }
button.danger { background: var(--danger); }

input, select {
  min-height: 44px;
  font-size: 1rem;
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

label { display: block; margin: 12px 0 4px; font-weight: 600; }
```

- [ ] **Step 13: Add a placeholder `src/main.ts` so the dev server boots**

```ts
import './style.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = '<p>Мой тренер — сборка в процессе</p>';
```

- [ ] **Step 14: Verify the dev server starts**

Run: `npm run dev` (then stop it, e.g. Ctrl+C — this is only a smoke check)
Expected: Vite prints a local URL with no errors.

- [ ] **Step 15: Write `.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 16: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html .gitignore src/
git commit -m "feat: scaffold Vite+TS project with state module"
```

---

## Task 2: Auth module (password hashing, default credentials)

**Files:**
- Create: `src/auth.ts`
- Test: `src/auth.test.ts`

**Interfaces:**
- Consumes: `getState()`, `updateState('auth', ...)` from `src/state.ts` (Task 1).
- Produces: `hashPassword(password: string): Promise<string>`, `DEFAULT_LOGIN: string`, `DEFAULT_PASSWORD: string`, `ensureDefaultAuth(): Promise<void>`, `verifyLogin(login: string, password: string): Promise<boolean>`, `changeCredentials(newLogin: string, newPassword: string): Promise<void>` — consumed by the login and settings screens (Tasks 11, 13).

- [ ] **Step 1: Write the failing test**

```ts
// src/auth.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword, ensureDefaultAuth, verifyLogin, changeCredentials, DEFAULT_LOGIN, DEFAULT_PASSWORD } from './auth';
import { getState, resetStateForTests } from './state';

describe('auth', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStateForTests();
  });

  it('hashes with SHA-256 (known test vector)', async () => {
    expect(await hashPassword('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85');
    expect(await hashPassword('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('seeds default credentials only when none exist', async () => {
    await ensureDefaultAuth();
    expect(getState().auth?.login).toBe(DEFAULT_LOGIN);
    await changeCredentials('someone', 'newpass123');
    await ensureDefaultAuth();
    expect(getState().auth?.login).toBe('someone');
  });

  it('verifies correct and rejects incorrect login', async () => {
    await ensureDefaultAuth();
    expect(await verifyLogin(DEFAULT_LOGIN, DEFAULT_PASSWORD)).toBe(true);
    expect(await verifyLogin(DEFAULT_LOGIN, 'wrong')).toBe(false);
    expect(await verifyLogin('wrong-user', DEFAULT_PASSWORD)).toBe(false);
  });

  it('changeCredentials updates login and password hash', async () => {
    await ensureDefaultAuth();
    await changeCredentials('newlogin', 'newpassword1');
    expect(await verifyLogin('newlogin', 'newpassword1')).toBe(true);
    expect(await verifyLogin(DEFAULT_LOGIN, DEFAULT_PASSWORD)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- auth.test.ts`
Expected: FAIL — `src/auth.ts` does not exist.

- [ ] **Step 3: Implement `src/auth.ts`**

```ts
import { getState, updateState } from './state';

export const DEFAULT_LOGIN = 'danya';
export const DEFAULT_PASSWORD = 'a0zOlB6rbhN914';

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function ensureDefaultAuth(): Promise<void> {
  if (getState().auth === null) {
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);
    updateState('auth', { login: DEFAULT_LOGIN, passwordHash });
  }
}

export async function verifyLogin(login: string, password: string): Promise<boolean> {
  const auth = getState().auth;
  if (!auth || auth.login !== login) return false;
  return (await hashPassword(password)) === auth.passwordHash;
}

export async function changeCredentials(newLogin: string, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  updateState('auth', { login: newLogin, passwordHash });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- auth.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/auth.ts src/auth.test.ts
git commit -m "feat: add auth module with SHA-256 password hashing"
```

---

## Task 3: Exercise mapping (pure functions from raw dataset to our model)

**Files:**
- Create: `scripts/exerciseMapping.ts`
- Test: `scripts/exerciseMapping.test.ts`

**Interfaces:**
- Produces: `RawExercise` type, `mapMuscleGroup(raw: string): MuscleGroup | null`, `mapEquipmentTiers(raw: string | null): Equipment[]`, `mapMechanic(raw: string | null): 'compound' | 'isolation'`, `isUsableCategory(category: string): boolean`, `normalizeExercise(raw: RawExercise, ruDict: Record<string, string>): Exercise | null` — consumed by the build script (Task 4).
- Consumes: `Exercise`, `MuscleGroup`, `Equipment` types from `src/types.ts` (Task 1).

- [ ] **Step 1: Write the failing test using a real fixture from the dataset**

```ts
// scripts/exerciseMapping.test.ts
import { describe, expect, it } from 'vitest';
import { mapMuscleGroup, mapEquipmentTiers, mapMechanic, isUsableCategory, normalizeExercise } from './exerciseMapping';

describe('exerciseMapping', () => {
  it('maps muscle names to our 6 groups, and neck to null', () => {
    expect(mapMuscleGroup('lats')).toBe('back');
    expect(mapMuscleGroup('quadriceps')).toBe('legs');
    expect(mapMuscleGroup('abdominals')).toBe('core');
    expect(mapMuscleGroup('neck')).toBeNull();
  });

  it('maps raw equipment to our 3 tiers', () => {
    expect(mapEquipmentTiers('body only')).toEqual(['bodyweight', 'home_dumbbells', 'full_gym']);
    expect(mapEquipmentTiers('dumbbell')).toEqual(['home_dumbbells', 'full_gym']);
    expect(mapEquipmentTiers('barbell')).toEqual(['full_gym']);
    expect(mapEquipmentTiers(null)).toEqual([]);
    expect(mapEquipmentTiers('other')).toEqual([]);
  });

  it('maps mechanic, defaulting null to isolation', () => {
    expect(mapMechanic('compound')).toBe('compound');
    expect(mapMechanic('isolation')).toBe('isolation');
    expect(mapMechanic(null)).toBe('isolation');
  });

  it('accepts strength/powerlifting/olympic weightlifting categories only', () => {
    expect(isUsableCategory('strength')).toBe(true);
    expect(isUsableCategory('powerlifting')).toBe(true);
    expect(isUsableCategory('olympic weightlifting')).toBe(true);
    expect(isUsableCategory('cardio')).toBe(false);
    expect(isUsableCategory('stretching')).toBe(false);
    expect(isUsableCategory('plyometrics')).toBe(false);
    expect(isUsableCategory('strongman')).toBe(false);
  });

  it('normalizes a real dataset entry, applying the Russian dictionary', () => {
    const raw = {
      id: '3_4_Sit-Up',
      name: '3/4 Sit-Up',
      force: 'pull',
      level: 'beginner' as const,
      mechanic: null,
      equipment: 'body only',
      primaryMuscles: ['abdominals'],
      secondaryMuscles: [],
      instructions: ['Lie down.', 'Sit up.'],
      category: 'strength',
      images: ['3_4_Sit-Up/0.jpg', '3_4_Sit-Up/1.jpg'],
    };
    const result = normalizeExercise(raw, { '3_4_Sit-Up': 'Скручивания на 3/4' });
    expect(result).toEqual({
      id: '3_4_Sit-Up',
      nameRu: 'Скручивания на 3/4',
      nameEn: '3/4 Sit-Up',
      muscleGroup: 'core',
      secondaryMuscleGroups: [],
      equipmentTiers: ['bodyweight', 'home_dumbbells', 'full_gym'],
      mechanic: 'isolation',
      level: 'beginner',
      instructions: ['Lie down.', 'Sit up.'],
      images: ['3_4_Sit-Up/0.jpg', '3_4_Sit-Up/1.jpg'],
    });
  });

  it('falls back to the English name when no translation exists', () => {
    const raw = {
      id: 'Some_Exercise', name: 'Some Exercise', force: null, level: 'beginner' as const,
      mechanic: 'compound', equipment: 'barbell', primaryMuscles: ['chest'], secondaryMuscles: [],
      instructions: ['Do it.'], category: 'strength', images: [],
    };
    expect(normalizeExercise(raw, {})?.nameRu).toBe('Some Exercise');
  });

  it('returns null for unusable categories or unmappable primary muscle', () => {
    const cardio = { id: 'x', name: 'X', force: null, level: 'beginner' as const, mechanic: null, equipment: 'body only', primaryMuscles: ['abdominals'], secondaryMuscles: [], instructions: [], category: 'cardio', images: [] };
    expect(normalizeExercise(cardio, {})).toBeNull();

    const neck = { id: 'y', name: 'Y', force: null, level: 'beginner' as const, mechanic: null, equipment: 'body only', primaryMuscles: ['neck'], secondaryMuscles: [], instructions: [], category: 'strength', images: [] };
    expect(normalizeExercise(neck, {})).toBeNull();

    const noEquipmentTier = { id: 'z', name: 'Z', force: null, level: 'beginner' as const, mechanic: null, equipment: 'other', primaryMuscles: ['chest'], secondaryMuscles: [], instructions: [], category: 'strength', images: [] };
    expect(normalizeExercise(noEquipmentTier, {})).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- scripts/exerciseMapping.test.ts`
Expected: FAIL — `scripts/exerciseMapping.ts` does not exist.

- [ ] **Step 3: Implement `scripts/exerciseMapping.ts`**

```ts
import type { Exercise, Equipment, MuscleGroup, Experience } from '../src/types';

export interface RawExercise {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

const MUSCLE_MAP: Record<string, MuscleGroup | null> = {
  chest: 'chest',
  lats: 'back', 'middle back': 'back', 'lower back': 'back', traps: 'back',
  quadriceps: 'legs', hamstrings: 'legs', calves: 'legs', glutes: 'legs', adductors: 'legs', abductors: 'legs',
  shoulders: 'shoulders',
  biceps: 'arms', triceps: 'arms', forearms: 'arms',
  abdominals: 'core',
  neck: null,
};

const EQUIPMENT_TIERS: Record<string, Equipment[]> = {
  'body only': ['bodyweight', 'home_dumbbells', 'full_gym'],
  dumbbell: ['home_dumbbells', 'full_gym'],
  kettlebells: ['home_dumbbells', 'full_gym'],
  bands: ['home_dumbbells', 'full_gym'],
  'exercise ball': ['home_dumbbells', 'full_gym'],
  'medicine ball': ['home_dumbbells', 'full_gym'],
  'foam roll': ['home_dumbbells', 'full_gym'],
  barbell: ['full_gym'],
  cable: ['full_gym'],
  machine: ['full_gym'],
  'e-z curl bar': ['full_gym'],
};

const USABLE_CATEGORIES = new Set(['strength', 'powerlifting', 'olympic weightlifting']);
const VALID_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);

export function mapMuscleGroup(raw: string): MuscleGroup | null {
  return MUSCLE_MAP[raw] ?? null;
}

export function mapEquipmentTiers(raw: string | null): Equipment[] {
  if (!raw) return [];
  return EQUIPMENT_TIERS[raw] ?? [];
}

export function mapMechanic(raw: string | null): 'compound' | 'isolation' {
  return raw === 'compound' ? 'compound' : 'isolation';
}

export function isUsableCategory(category: string): boolean {
  return USABLE_CATEGORIES.has(category);
}

function mapLevel(raw: string): Experience {
  // dataset uses "expert" where our app uses "advanced"
  if (raw === 'expert') return 'advanced';
  return VALID_LEVELS.has(raw) ? (raw as Experience) : 'beginner';
}

export function normalizeExercise(raw: RawExercise, ruDict: Record<string, string>): Exercise | null {
  if (!isUsableCategory(raw.category)) return null;

  const muscleGroup = mapMuscleGroup(raw.primaryMuscles[0] ?? '');
  if (!muscleGroup) return null;

  const equipmentTiers = mapEquipmentTiers(raw.equipment);
  if (equipmentTiers.length === 0) return null;

  const secondaryMuscleGroups = raw.secondaryMuscles
    .map(mapMuscleGroup)
    .filter((m): m is MuscleGroup => m !== null);

  return {
    id: raw.id,
    nameRu: ruDict[raw.id] ?? raw.name,
    nameEn: raw.name,
    muscleGroup,
    secondaryMuscleGroups,
    equipmentTiers,
    mechanic: mapMechanic(raw.mechanic),
    level: mapLevel(raw.level),
    instructions: raw.instructions,
    images: raw.images,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- scripts/exerciseMapping.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/exerciseMapping.ts scripts/exerciseMapping.test.ts
git commit -m "feat: add pure mapping functions from free-exercise-db to our exercise model"
```

---

## Task 4: Vendor the exercise dataset and build `public/data/exercises.json`

**Files:**
- Create: `scripts/ru-dict.json`
- Create: `scripts/build-exercises.ts`
- Modify: `package.json` (add `build:exercises` script, add `tsx` devDependency)
- Generates (not hand-written, produced by running the script): `public/data/exercises.json`, `public/exercises/<id>/*.jpg`

**Interfaces:**
- Consumes: `RawExercise`, `normalizeExercise` from `scripts/exerciseMapping.ts` (Task 3).
- Produces: `public/data/exercises.json` (an `Exercise[]`), consumed at runtime by `src/exercises/loader.ts` (Task 5).

- [ ] **Step 1: Install `tsx`**

```bash
npm install -D tsx
```

- [ ] **Step 2: Write `scripts/ru-dict.json`** (curated translations for the ~55 most common lifts; everything else falls back to the English name per the spec, which explicitly allows this)

```json
{
  "Barbell_Bench_Press_-_Medium_Grip": "Жим штанги лёжа",
  "Barbell_Incline_Bench_Press_-_Medium_Grip": "Жим штанги на наклонной скамье",
  "Dumbbell_Bench_Press": "Жим гантелей лёжа",
  "Decline_Dumbbell_Bench_Press": "Жим гантелей лёжа на скамье с наклоном вниз",
  "Flat_Bench_Cable_Flyes": "Сведение рук в кроссовере лёжа",
  "Incline_Cable_Flye": "Сведение рук в кроссовере на наклонной скамье",
  "Cable_Crossover": "Кроссовер (сведение рук на блоках)",
  "Barbell_Squat": "Приседания со штангой",
  "Barbell_Full_Squat": "Приседания со штангой (полная амплитуда)",
  "Front_Squat_Clean_Grip": "Фронтальные приседания со штангой",
  "Goblet_Squat": "Гоблет-присед с гирей",
  "Barbell_Deadlift": "Становая тяга",
  "Romanian_Deadlift": "Румынская тяга",
  "Sumo_Deadlift": "Становая тяга сумо",
  "Barbell_Hip_Thrust": "Ягодичный мостик со штангой",
  "Barbell_Glute_Bridge": "Ягодичный мостик со штангой с пола",
  "Pullups": "Подтягивания",
  "Chin-Up": "Подтягивания обратным хватом",
  "Bent_Over_Barbell_Row": "Тяга штанги в наклоне",
  "One-Arm_Dumbbell_Row": "Тяга гантели в наклоне одной рукой",
  "Seated_Cable_Rows": "Тяга блока к поясу сидя",
  "Wide-Grip_Lat_Pulldown": "Тяга верхнего блока широким хватом",
  "Wide-Grip_Pulldown_Behind_The_Neck": "Тяга верхнего блока за голову широким хватом",
  "Standing_Military_Press": "Армейский жим стоя",
  "Seated_Barbell_Military_Press": "Жим штанги сидя",
  "Dumbbell_Shoulder_Press": "Жим гантелей сидя",
  "Push_Press": "Жим штанги толчковый",
  "Side_Lateral_Raise": "Разведение гантелей стоя на дельты",
  "Seated_Side_Lateral_Raise": "Разведение гантелей сидя на дельты",
  "Reverse_Flyes": "Разведение гантелей в наклоне на задние дельты",
  "Face_Pull": "Тяга каната к лицу",
  "Barbell_Shrug": "Шраги со штангой",
  "Leg_Press": "Жим ногами в тренажёре",
  "Lying_Leg_Curls": "Сгибание ног лёжа в тренажёре",
  "Seated_Leg_Curl": "Сгибание ног сидя в тренажёре",
  "Leg_Extensions": "Разгибание ног в тренажёре",
  "Dumbbell_Lunges": "Выпады с гантелями",
  "Barbell_Lunge": "Выпады со штангой",
  "Standing_Calf_Raises": "Подъём на носки стоя",
  "Seated_Calf_Raise": "Подъём на носки сидя",
  "Standing_Dumbbell_Calf_Raise": "Подъём на носки стоя с гантелями",
  "Plank": "Планка",
  "Hanging_Leg_Raise": "Подъём ног в висе",
  "Crunches": "Скручивания",
  "Russian_Twist": "Русские скручивания",
  "Cable_Crunch": "Скручивания на блоке",
  "Superman": "Гиперэкстензия «супермен»",
  "Barbell_Curl": "Подъём штанги на бицепс",
  "Alternate_Hammer_Curl": "Молотки с гантелями попеременно",
  "Incline_Dumbbell_Curl": "Подъём гантелей на бицепс на наклонной скамье",
  "EZ-Bar_Skullcrusher": "Французский жим EZ-штанги лёжа",
  "Triceps_Pushdown": "Разгибание рук на блоке на трицепс",
  "Cable_Rope_Overhead_Triceps_Extension": "Разгибание рук из-за головы на блоке с канатом",
  "Bench_Dips": "Отжимания от скамьи на трицепс",
  "Dips_-_Triceps_Version": "Отжимания на брусьях на трицепс",
  "Dips_-_Chest_Version": "Отжимания на брусьях на грудь",
  "Pushups": "Отжимания от пола"
}
```

- [ ] **Step 3: Write `scripts/build-exercises.ts`**

```ts
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { normalizeExercise, type RawExercise } from './exerciseMapping';

const VENDOR_DIR = join(__dirname, '..', 'vendor', 'free-exercise-db');
const PUBLIC_DATA_DIR = join(__dirname, '..', 'public', 'data');
const PUBLIC_EXERCISES_DIR = join(__dirname, '..', 'public', 'exercises');

function ensureVendorRepo(): void {
  if (existsSync(VENDOR_DIR)) return;
  console.log('Cloning free-exercise-db...');
  mkdirSync(dirname(VENDOR_DIR), { recursive: true });
  execSync(`git clone --depth 1 https://github.com/yuhonas/free-exercise-db.git "${VENDOR_DIR}"`, { stdio: 'inherit' });
}

function main(): void {
  ensureVendorRepo();

  const rawExercises: RawExercise[] = JSON.parse(
    readFileSync(join(VENDOR_DIR, 'dist', 'exercises.json'), 'utf-8'),
  );
  const ruDict: Record<string, string> = JSON.parse(readFileSync(join(__dirname, 'ru-dict.json'), 'utf-8'));

  mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
  mkdirSync(PUBLIC_EXERCISES_DIR, { recursive: true });

  const kept = [];
  for (const raw of rawExercises) {
    const normalized = normalizeExercise(raw, ruDict);
    if (!normalized) continue;
    kept.push(normalized);

    const destDir = join(PUBLIC_EXERCISES_DIR, raw.id);
    mkdirSync(destDir, { recursive: true });
    for (const imagePath of raw.images) {
      const src = join(VENDOR_DIR, 'exercises', imagePath);
      const fileName = imagePath.split('/').pop() as string;
      if (existsSync(src)) {
        copyFileSync(src, join(destDir, fileName));
      }
    }
  }

  writeFileSync(join(PUBLIC_DATA_DIR, 'exercises.json'), JSON.stringify(kept, null, 2));
  console.log(`Wrote ${kept.length} exercises (of ${rawExercises.length} total in dataset) to public/data/exercises.json`);
}

main();
```

- [ ] **Step 4: Add the build script to `package.json`**

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "build:exercises": "tsx scripts/build-exercises.ts"
}
```

- [ ] **Step 5: Add `vendor/` to `.gitignore`** (the cloned dataset repo itself is not vendored wholesale — only the filtered output goes into `public/`)

```
node_modules/
dist/
vendor/
```

- [ ] **Step 6: Run it for real**

Run: `npm run build:exercises`
Expected: Prints `Wrote N exercises (of 876 total in dataset) to public/data/exercises.json` with N in the low hundreds (strength/powerlifting/olympic-weightlifting categories only).

- [ ] **Step 7: Spot-check the output**

Run (bash):
```bash
node -e "
const data = require('./public/data/exercises.json');
console.log('count:', data.length);
console.log('sample:', data.find(e => e.id === 'Barbell_Squat'));
"
```
Expected: `sample` shows `nameRu: 'Приседания со штангой'` and a non-empty `images` array.

- [ ] **Step 8: Commit** (this includes the generated `public/data/exercises.json` and `public/exercises/**` images — per the user's explicit choice to commit all filtered images as-is)

```bash
git add scripts/ package.json package-lock.json .gitignore public/data/exercises.json public/exercises
git commit -m "feat: vendor and normalize free-exercise-db into public/data/exercises.json"
```

---

## Task 5: Exercise loader and filter module

**Files:**
- Create: `src/exercises/loader.ts`
- Create: `src/exercises/filter.ts`
- Test: `src/exercises/filter.test.ts`

**Interfaces:**
- Consumes: `Exercise`, `Equipment`, `MuscleGroup` from `src/types.ts`.
- Produces: `loadExercises(): Promise<Exercise[]>` (fetches `/data/exercises.json`, consumed by Task 9's generator); `filterExercises(exercises: Exercise[], opts: { equipment: Equipment; excludeKeywords?: string[] }): Exercise[]` (consumed by Task 7's `exercisePicker`).

- [ ] **Step 1: Write the failing test for `filterExercises`**

```ts
// src/exercises/filter.test.ts
import { describe, expect, it } from 'vitest';
import { filterExercises } from './filter';
import type { Exercise } from '../types';

function makeExercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: 'x', nameRu: 'X', nameEn: 'X', muscleGroup: 'chest', secondaryMuscleGroups: [],
    equipmentTiers: ['full_gym'], mechanic: 'compound', level: 'beginner',
    instructions: [], images: [], ...overrides,
  };
}

describe('filterExercises', () => {
  const barbellBench = makeExercise({ id: 'bench', muscleGroup: 'chest', equipmentTiers: ['full_gym'] });
  const pushup = makeExercise({ id: 'pushup', muscleGroup: 'chest', equipmentTiers: ['bodyweight', 'home_dumbbells', 'full_gym'] });
  const kneeExercise = makeExercise({ id: 'legext', muscleGroup: 'legs', equipmentTiers: ['full_gym'], instructions: ['Extend at the knee joint.'] });
  const all = [barbellBench, pushup, kneeExercise];

  it('keeps only exercises available for the given equipment tier', () => {
    const result = filterExercises(all, { equipment: 'bodyweight' });
    expect(result.map((e) => e.id)).toEqual(['pushup']);
  });

  it('includes everything usable at full_gym', () => {
    const result = filterExercises(all, { equipment: 'full_gym' });
    expect(result.map((e) => e.id).sort()).toEqual(['bench', 'legext', 'pushup']);
  });

  it('excludes exercises whose instructions mention an excluded keyword', () => {
    const result = filterExercises(all, { equipment: 'full_gym', excludeKeywords: ['колен'] });
    // "колен" (knee, RU) won't match English instructions - use an English keyword instead to prove the mechanism
    const resultEn = filterExercises(all, { equipment: 'full_gym', excludeKeywords: ['knee'] });
    expect(resultEn.map((e) => e.id)).not.toContain('legext');
    expect(result.map((e) => e.id)).toContain('legext'); // RU keyword doesn't match EN instructions - documents current limitation
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- filter.test.ts`
Expected: FAIL — `src/exercises/filter.ts` does not exist.

- [ ] **Step 3: Implement `src/exercises/filter.ts`**

```ts
import type { Equipment, Exercise } from '../types';

export interface FilterOptions {
  equipment: Equipment;
  excludeKeywords?: string[];
}

export function filterExercises(exercises: Exercise[], opts: FilterOptions): Exercise[] {
  const keywords = (opts.excludeKeywords ?? []).map((k) => k.toLowerCase()).filter(Boolean);

  return exercises.filter((exercise) => {
    if (!exercise.equipmentTiers.includes(opts.equipment)) return false;
    if (keywords.length === 0) return true;

    const haystack = exercise.instructions.join(' ').toLowerCase();
    return !keywords.some((keyword) => haystack.includes(keyword));
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- filter.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Implement `src/exercises/loader.ts`** (not unit tested — thin `fetch` wrapper; verified manually in Task 16)

```ts
import type { Exercise } from '../types';

let cache: Exercise[] | null = null;

export async function loadExercises(): Promise<Exercise[]> {
  if (cache) return cache;
  const response = await fetch('/data/exercises.json');
  if (!response.ok) throw new Error(`Failed to load exercises: ${response.status}`);
  cache = (await response.json()) as Exercise[];
  return cache;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/exercises/
git commit -m "feat: add exercise loader and equipment/injury filter"
```

---

## Task 6: Program generator — split and day templates

**Files:**
- Create: `src/program/constants.ts`
- Create: `src/program/splitPicker.ts`
- Test: `src/program/splitPicker.test.ts`

**Interfaces:**
- Produces: `REP_SCHEME_BY_GOAL`, `REST_SEC_BY_GOAL`, `SET_EXEC_SEC`, `TRANSITION_SEC` constants (consumed by Task 7); `pickSplit(daysPerWeek: number): Split`, `dayTemplatesForSplit(split: Split, daysPerWeek: number): DayTemplate[]`, `MUSCLE_GROUPS_BY_TEMPLATE: Record<DayTemplate, MuscleGroup[]>`, `DayTemplate` type (consumed by Task 7 and Task 9).

- [ ] **Step 1: Write `src/program/constants.ts`** (no test — pure data, exercised indirectly by every test that imports it)

```ts
import type { Goal } from '../types';

export const SET_EXEC_SEC = 45; // время выполнения одного рабочего подхода
export const TRANSITION_SEC = 90; // переход между станциями/упражнениями

export const REST_SEC_BY_GOAL: Record<Goal, number> = {
  strength: 150,
  mass: 90,
  fitness: 75,
  fatloss: 45,
  maintenance: 90,
};

export interface RepScheme {
  setsMin: number;
  setsMax: number;
  repsMin: number;
  repsMax: number;
}

// Numbers for strength/mass/fatloss come directly from spec §5.3.
// fitness/maintenance are not specified numerically there; both reuse a
// moderate general-fitness scheme (YAGNI — no product requirement yet
// distinguishes them further).
export const REP_SCHEME_BY_GOAL: Record<Goal, RepScheme> = {
  strength: { setsMin: 3, setsMax: 5, repsMin: 3, repsMax: 6 },
  mass: { setsMin: 3, setsMax: 4, repsMin: 6, repsMax: 12 },
  fitness: { setsMin: 3, setsMax: 4, repsMin: 8, repsMax: 12 },
  fatloss: { setsMin: 2, setsMax: 3, repsMin: 12, repsMax: 20 },
  maintenance: { setsMin: 3, setsMax: 4, repsMin: 8, repsMax: 12 },
};
```

- [ ] **Step 2: Write the failing test for `splitPicker.ts`**

```ts
// src/program/splitPicker.test.ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- splitPicker.test.ts`
Expected: FAIL — `src/program/splitPicker.ts` does not exist.

- [ ] **Step 4: Implement `src/program/splitPicker.ts`**

```ts
import type { MuscleGroup, Split } from '../types';

export type DayTemplate = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs';

export function pickSplit(daysPerWeek: number): Split {
  if (daysPerWeek < 2 || daysPerWeek > 6) {
    throw new Error(`daysPerWeek must be between 2 and 6, got ${daysPerWeek}`);
  }
  if (daysPerWeek <= 3) return 'fullbody';
  if (daysPerWeek === 4) return 'upper_lower';
  return 'ppl';
}

export function dayTemplatesForSplit(split: Split, daysPerWeek: number): DayTemplate[] {
  if (split === 'fullbody') {
    return Array.from({ length: daysPerWeek }, () => 'full');
  }
  if (split === 'upper_lower') {
    return Array.from({ length: daysPerWeek }, (_, i) => (i % 2 === 0 ? 'upper' : 'lower'));
  }
  const cycle: DayTemplate[] = ['push', 'pull', 'legs'];
  return Array.from({ length: daysPerWeek }, (_, i) => cycle[i % 3]);
}

export const MUSCLE_GROUPS_BY_TEMPLATE: Record<DayTemplate, MuscleGroup[]> = {
  full: ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'],
  upper: ['chest', 'back', 'shoulders', 'arms'],
  lower: ['legs', 'core'],
  push: ['chest', 'shoulders', 'arms'],
  pull: ['back', 'arms'],
  legs: ['legs', 'core'],
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- splitPicker.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add src/program/constants.ts src/program/splitPicker.ts src/program/splitPicker.test.ts
git commit -m "feat: add split picker and day templates"
```

---

## Task 7: Program generator — exercise picker (time-budget algorithm)

**Files:**
- Create: `src/program/exercisePicker.ts`
- Test: `src/program/exercisePicker.test.ts`

**Interfaces:**
- Consumes: `filterExercises` (Task 5), `MUSCLE_GROUPS_BY_TEMPLATE`, `DayTemplate`, `REP_SCHEME_BY_GOAL`, `REST_SEC_BY_GOAL`, `SET_EXEC_SEC`, `TRANSITION_SEC` (Task 6).
- Produces: `pickExercisesForDay(exercises: Exercise[], opts: PickOptions): ProgramExercise[]` — consumed by Task 9's `generateInitialProgram`.

- [ ] **Step 1: Write the failing test**

```ts
// src/program/exercisePicker.test.ts
import { describe, expect, it } from 'vitest';
import { pickExercisesForDay } from './exercisePicker';
import type { Exercise } from '../types';

function makeExercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: 'x', nameRu: 'X', nameEn: 'X', muscleGroup: 'chest', secondaryMuscleGroups: [],
    equipmentTiers: ['full_gym'], mechanic: 'compound', level: 'beginner',
    instructions: [], images: [], ...overrides,
  };
}

const pool: Exercise[] = [
  makeExercise({ id: 'bench', muscleGroup: 'chest', mechanic: 'compound' }),
  makeExercise({ id: 'flye', muscleGroup: 'chest', mechanic: 'isolation' }),
  makeExercise({ id: 'row', muscleGroup: 'back', mechanic: 'compound' }),
  makeExercise({ id: 'pulldown', muscleGroup: 'back', mechanic: 'isolation' }),
  makeExercise({ id: 'squat', muscleGroup: 'legs', mechanic: 'compound' }),
  makeExercise({ id: 'legext', muscleGroup: 'legs', mechanic: 'isolation' }),
  makeExercise({ id: 'ohp', muscleGroup: 'shoulders', mechanic: 'compound' }),
  makeExercise({ id: 'raise', muscleGroup: 'shoulders', mechanic: 'isolation' }),
  makeExercise({ id: 'curl', muscleGroup: 'arms', mechanic: 'isolation' }),
  makeExercise({ id: 'crunch', muscleGroup: 'core', mechanic: 'isolation' }),
];

describe('pickExercisesForDay', () => {
  it('covers every target muscle group at least once when time allows', () => {
    const result = pickExercisesForDay(pool, {
      targetMuscles: ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'],
      equipment: 'full_gym',
      timeBudgetMin: 90,
      goal: 'mass',
      experience: 'beginner',
    });
    const coveredMuscles = new Set(result.map((r) => pool.find((e) => e.id === r.exerciseId)?.muscleGroup));
    expect(coveredMuscles).toEqual(new Set(['chest', 'back', 'legs', 'shoulders', 'arms', 'core']));
  });

  it('never exceeds the time budget', () => {
    const result = pickExercisesForDay(pool, {
      targetMuscles: ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'],
      equipment: 'full_gym',
      timeBudgetMin: 30,
      goal: 'mass',
      experience: 'beginner',
    });
    const totalMin = result.reduce((sum, ex) => {
      const restSec = 90; // mass
      return sum + (ex.sets * (45 + restSec) + 90) / 60;
    }, 0);
    expect(totalMin).toBeLessThanOrEqual(30);
  });

  it('gives compound exercises more sets than isolation for the same goal', () => {
    const result = pickExercisesForDay(pool, {
      targetMuscles: ['chest'],
      equipment: 'full_gym',
      timeBudgetMin: 90,
      goal: 'mass',
      experience: 'beginner',
    });
    const bench = result.find((r) => r.exerciseId === 'bench');
    const flye = result.find((r) => r.exerciseId === 'flye');
    expect(bench!.sets).toBeGreaterThan(flye!.sets);
  });

  it('never picks the same exercise twice in one day', () => {
    const result = pickExercisesForDay(pool, {
      targetMuscles: ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'],
      equipment: 'full_gym',
      timeBudgetMin: 120,
      goal: 'mass',
      experience: 'advanced',
    });
    const ids = result.map((r) => r.exerciseId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- exercisePicker.test.ts`
Expected: FAIL — `src/program/exercisePicker.ts` does not exist.

- [ ] **Step 3: Implement `src/program/exercisePicker.ts`**

```ts
import type { Equipment, Exercise, Experience, Goal, MuscleGroup, ProgramExercise } from '../types';
import { filterExercises } from '../exercises/filter';
import { REP_SCHEME_BY_GOAL, REST_SEC_BY_GOAL, SET_EXEC_SEC, TRANSITION_SEC } from './constants';

export interface PickOptions {
  targetMuscles: MuscleGroup[];
  equipment: Equipment;
  timeBudgetMin: number;
  goal: Goal;
  experience: Experience;
  excludeKeywords?: string[];
}

function exerciseTimeMin(sets: number, restSec: number): number {
  return (sets * (SET_EXEC_SEC + restSec) + TRANSITION_SEC) / 60;
}

export function pickExercisesForDay(exercises: Exercise[], opts: PickOptions): ProgramExercise[] {
  const scheme = REP_SCHEME_BY_GOAL[opts.goal];
  const restSec = REST_SEC_BY_GOAL[opts.goal];
  const isolationSlotsPerMuscle = opts.experience === 'advanced' ? 2 : 1;

  const pool = filterExercises(exercises, { equipment: opts.equipment, excludeKeywords: opts.excludeKeywords });

  // Build a priority-ordered candidate list: pass 1 = one compound per muscle,
  // pass 2 = a second compound if available, then isolation slots. This keeps
  // muscle-group coverage first, extra volume second.
  const candidates: Exercise[] = [];
  const usedIds = new Set<string>();

  function takeOne(muscle: MuscleGroup, mechanic: 'compound' | 'isolation'): Exercise | null {
    const found = pool.find((e) => e.muscleGroup === muscle && e.mechanic === mechanic && !usedIds.has(e.id));
    if (found) usedIds.add(found.id);
    return found ?? null;
  }

  for (const muscle of opts.targetMuscles) {
    const compound = takeOne(muscle, 'compound');
    if (compound) candidates.push(compound);
  }
  for (const muscle of opts.targetMuscles) {
    const secondCompound = takeOne(muscle, 'compound');
    if (secondCompound) candidates.push(secondCompound);
  }
  for (let slot = 0; slot < isolationSlotsPerMuscle; slot++) {
    for (const muscle of opts.targetMuscles) {
      const isolation = takeOne(muscle, 'isolation');
      if (isolation) candidates.push(isolation);
    }
  }

  const picked: ProgramExercise[] = [];
  let runningMin = 0;

  for (const candidate of candidates) {
    const sets = candidate.mechanic === 'compound' ? scheme.setsMax : scheme.setsMin;
    const cost = exerciseTimeMin(sets, restSec);
    if (runningMin + cost > opts.timeBudgetMin) continue;
    runningMin += cost;
    picked.push({
      exerciseId: candidate.id,
      sets,
      repsMin: scheme.repsMin,
      repsMax: scheme.repsMax,
      targetWeightKg: null,
      restSec,
    });
  }

  return picked;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- exercisePicker.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/program/exercisePicker.ts src/program/exercisePicker.test.ts
git commit -m "feat: add time-budget exercise picker"
```

---

## Task 8: Progression module (linear/double progression, deload, Epley 1RM)

**Files:**
- Create: `src/program/progression.ts`
- Test: `src/program/progression.test.ts`

**Interfaces:**
- Consumes: `ProgramExercise`, `SetLogEntry`, `ProgressionPhase`, `Experience`, `Goal` from `src/types.ts`.
- Produces: `estimateOneRepMax(weightKg: number, reps: number): number`, `applyProgression(exercise: ProgramExercise, lastWeekSets: SetLogEntry[], phase: ProgressionPhase, consecutiveFailures: number, weeksWithoutIncrease: number, weekNumber: number): ProgressionResult`, `maybeLevelUp(experience: Experience, consecutiveGoodWeeks: number): Experience`, `isDeloadWeek(weekNumber: number): boolean` — all consumed by Task 9's `advanceWeek`.

- [ ] **Step 1: Write the failing test**

```ts
// src/program/progression.test.ts
import { describe, expect, it } from 'vitest';
import { estimateOneRepMax, applyProgression, maybeLevelUp, isDeloadWeek } from './progression';
import type { ProgramExercise, SetLogEntry } from '../types';

function makeExercise(overrides: Partial<ProgramExercise> = {}): ProgramExercise {
  return { exerciseId: 'bench', sets: 3, repsMin: 6, repsMax: 12, targetWeightKg: 60, restSec: 90, ...overrides };
}

function setsAt(reps: number, count: number, done = true): SetLogEntry[] {
  return Array.from({ length: count }, () => ({ planned: { weightKg: 60, reps }, actual: { weightKg: 60, reps }, done }));
}

describe('estimateOneRepMax', () => {
  it('applies the Epley formula', () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(100 * (1 + 5 / 30), 5);
    expect(estimateOneRepMax(60, 0)).toBe(60);
  });
});

describe('isDeloadWeek', () => {
  it('is true every 6th week', () => {
    expect(isDeloadWeek(6)).toBe(true);
    expect(isDeloadWeek(12)).toBe(true);
    expect(isDeloadWeek(1)).toBe(false);
    expect(isDeloadWeek(5)).toBe(false);
  });
});

describe('applyProgression', () => {
  it('increases weight after a fully successful linear week', () => {
    const result = applyProgression(makeExercise(), setsAt(8, 3), 'linear', 0, 0, 1);
    expect(result.exercise.targetWeightKg).toBeGreaterThan(60);
    expect(result.phase).toBe('linear');
    expect(result.consecutiveFailures).toBe(0);
    expect(result.reason).toMatch(/вес увеличен/);
  });

  it('keeps weight after a single failed week, incrementing failure counter', () => {
    const result = applyProgression(makeExercise(), setsAt(4, 3), 'linear', 0, 0, 1);
    expect(result.exercise.targetWeightKg).toBe(60);
    expect(result.consecutiveFailures).toBe(1);
  });

  it('deloads by 10% after two consecutive failures', () => {
    const result = applyProgression(makeExercise(), setsAt(4, 3), 'linear', 1, 0, 1);
    expect(result.exercise.targetWeightKg).toBeCloseTo(60 * 0.9, 1);
    expect(result.consecutiveFailures).toBe(0);
    expect(result.reason).toMatch(/делоад/);
  });

  it('switches to double_progression after 2 weeks without a weight increase', () => {
    const result = applyProgression(makeExercise(), setsAt(4, 3), 'linear', 0, 1, 1);
    expect(result.phase).toBe('double_progression');
    expect(result.weeksWithoutIncrease).toBe(0);
  });

  it('in double_progression, only increases weight once all sets reach repsMax', () => {
    const notYet = applyProgression(makeExercise(), setsAt(8, 3), 'double_progression', 0, 0, 1);
    expect(notYet.exercise.targetWeightKg).toBe(60);

    const maxed = applyProgression(makeExercise(), setsAt(12, 3), 'double_progression', 0, 0, 1);
    expect(maxed.exercise.targetWeightKg).toBeGreaterThan(60);
  });

  it('applies a forced deload every 6th week regardless of phase', () => {
    const result = applyProgression(makeExercise(), setsAt(12, 3), 'linear', 0, 0, 6);
    expect(result.exercise.targetWeightKg).toBeLessThan(60);
    expect(result.exercise.sets).toBeLessThan(3);
    expect(result.reason).toMatch(/разгрузочная/i);
  });

  it('progresses bodyweight exercises (null weight) via reps instead of weight', () => {
    const bodyweightExercise = makeExercise({ targetWeightKg: null });
    const maxed = applyProgression(bodyweightExercise, setsAt(12, 3), 'linear', 0, 0, 1);
    expect(maxed.exercise.repsMin).toBe(8);
    expect(maxed.exercise.repsMax).toBe(14);

    const notMaxed = applyProgression(bodyweightExercise, setsAt(7, 3), 'linear', 0, 0, 1);
    expect(notMaxed.exercise.repsMin).toBe(6);
    expect(notMaxed.exercise.repsMax).toBe(12);
  });
});

describe('maybeLevelUp', () => {
  it('promotes beginner to intermediate after 4 good weeks', () => {
    expect(maybeLevelUp('beginner', 3)).toBe('beginner');
    expect(maybeLevelUp('beginner', 4)).toBe('intermediate');
  });

  it('promotes intermediate to advanced after 10 good weeks', () => {
    expect(maybeLevelUp('intermediate', 9)).toBe('intermediate');
    expect(maybeLevelUp('intermediate', 10)).toBe('advanced');
  });

  it('does not change advanced', () => {
    expect(maybeLevelUp('advanced', 100)).toBe('advanced');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- progression.test.ts`
Expected: FAIL — `src/program/progression.ts` does not exist.

- [ ] **Step 3: Implement `src/program/progression.ts`**

```ts
import type { Experience, ProgramExercise, ProgressionPhase, SetLogEntry } from '../types';

const WEIGHT_INCREASE_PCT = 0.05;
const WEIGHT_DECREASE_PCT = 0.10;
const DELOAD_VOLUME_PCT = 0.45;
const PLATE_STEP_KG = 1.25;
const PLATEAU_WEEKS_THRESHOLD = 2;
const DELOAD_INTERVAL_WEEKS = 6;
const BODYWEIGHT_REP_STEP = 2;

export interface ProgressionResult {
  exercise: ProgramExercise;
  phase: ProgressionPhase;
  consecutiveFailures: number;
  weeksWithoutIncrease: number;
  reason: string;
}

export function estimateOneRepMax(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

export function isDeloadWeek(weekNumber: number): boolean {
  return weekNumber % DELOAD_INTERVAL_WEEKS === 0;
}

function roundToPlate(kg: number): number {
  return Math.round(kg / PLATE_STEP_KG) * PLATE_STEP_KG;
}

function allSetsMetReps(sets: SetLogEntry[], targetReps: number): boolean {
  return sets.length > 0 && sets.every((s) => s.done && s.actual.reps >= targetReps);
}

export function applyProgression(
  exercise: ProgramExercise,
  lastWeekSets: SetLogEntry[],
  phase: ProgressionPhase,
  consecutiveFailures: number,
  weeksWithoutIncrease: number,
  weekNumber: number,
): ProgressionResult {
  if (isDeloadWeek(weekNumber)) {
    const reason = 'Разгрузочная неделя — объём и вес снижены для восстановления';
    return {
      exercise: {
        ...exercise,
        sets: Math.max(1, Math.round(exercise.sets * (1 - DELOAD_VOLUME_PCT))),
        targetWeightKg: exercise.targetWeightKg === null ? null : roundToPlate(exercise.targetWeightKg * (1 - DELOAD_VOLUME_PCT)),
        lastChangeReason: reason,
      },
      phase,
      consecutiveFailures: 0,
      weeksWithoutIncrease,
      reason,
    };
  }

  if (exercise.targetWeightKg === null) {
    if (allSetsMetReps(lastWeekSets, exercise.repsMax)) {
      const reason = 'Ты выполнил все подходы на верхнюю границу повторов — диапазон повторов увеличен';
      return {
        exercise: { ...exercise, repsMin: exercise.repsMin + BODYWEIGHT_REP_STEP, repsMax: exercise.repsMax + BODYWEIGHT_REP_STEP, lastChangeReason: reason },
        phase, consecutiveFailures: 0, weeksWithoutIncrease: 0, reason,
      };
    }
    const reason = 'Пока не все подходы выполнены на верхнюю границу повторов — продолжай на том же диапазоне';
    return { exercise: { ...exercise, lastChangeReason: reason }, phase, consecutiveFailures, weeksWithoutIncrease: weeksWithoutIncrease + 1, reason };
  }

  if (phase === 'linear') {
    if (allSetsMetReps(lastWeekSets, exercise.repsMin)) {
      const reason = 'Ты выполнил все подходы на прошлой неделе — вес увеличен';
      return {
        exercise: { ...exercise, targetWeightKg: roundToPlate(exercise.targetWeightKg * (1 + WEIGHT_INCREASE_PCT)), lastChangeReason: reason },
        phase: 'linear', consecutiveFailures: 0, weeksWithoutIncrease: 0, reason,
      };
    }

    const newFailures = consecutiveFailures + 1;
    if (newFailures >= 2) {
      const reason = 'Два срыва подряд — вес снижен для стабилизации техники (делоад)';
      return {
        exercise: { ...exercise, targetWeightKg: roundToPlate(exercise.targetWeightKg * (1 - WEIGHT_DECREASE_PCT)), lastChangeReason: reason },
        phase: 'linear', consecutiveFailures: 0, weeksWithoutIncrease: weeksWithoutIncrease + 1, reason,
      };
    }

    const newWeeksWithoutIncrease = weeksWithoutIncrease + 1;
    if (newWeeksWithoutIncrease >= PLATEAU_WEEKS_THRESHOLD) {
      const reason = 'Вес не растёт уже 2 недели — переключаемся на двойную прогрессию (сначала растим повторы)';
      return { exercise: { ...exercise, lastChangeReason: reason }, phase: 'double_progression', consecutiveFailures: newFailures, weeksWithoutIncrease: 0, reason };
    }

    const reason = 'Не все подходы выполнены — вес пока не меняем';
    return { exercise: { ...exercise, lastChangeReason: reason }, phase: 'linear', consecutiveFailures: newFailures, weeksWithoutIncrease: newWeeksWithoutIncrease, reason };
  }

  // double_progression
  if (allSetsMetReps(lastWeekSets, exercise.repsMax)) {
    const reason = 'Повторы дошли до верхней границы на всех подходах — вес увеличен, повторы сброшены к нижней границе';
    return {
      exercise: { ...exercise, targetWeightKg: roundToPlate(exercise.targetWeightKg * (1 + WEIGHT_INCREASE_PCT)), lastChangeReason: reason },
      phase: 'double_progression', consecutiveFailures: 0, weeksWithoutIncrease: 0, reason,
    };
  }
  const reason = 'Продолжаем расти в повторах на текущем весе — вес пока не меняем';
  return { exercise: { ...exercise, lastChangeReason: reason }, phase: 'double_progression', consecutiveFailures, weeksWithoutIncrease: weeksWithoutIncrease + 1, reason };
}

export function maybeLevelUp(experience: Experience, consecutiveGoodWeeks: number): Experience {
  if (experience === 'beginner' && consecutiveGoodWeeks >= 4) return 'intermediate';
  if (experience === 'intermediate' && consecutiveGoodWeeks >= 10) return 'advanced';
  return experience;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- progression.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add src/program/progression.ts src/program/progression.test.ts
git commit -m "feat: add weekly progression algorithm (linear/double progression/deload/Epley 1RM)"
```

---

## Task 9: Program generator orchestration

**Files:**
- Create: `src/program/generator.ts`
- Test: `src/program/generator.test.ts`

**Interfaces:**
- Consumes: `pickSplit`, `dayTemplatesForSplit`, `MUSCLE_GROUPS_BY_TEMPLATE` (Task 6); `pickExercisesForDay` (Task 7); `applyProgression`, `estimateOneRepMax`, `maybeLevelUp` (Task 8); `Exercise`, `Profile`, `Program`, `WorkoutLog` (Task 1).
- Produces: `generateInitialProgram(profile: Profile, exercises: Exercise[]): Program` (consumed by Task 12's onboarding screen), `advanceWeek(program: Program, profile: Profile, lastWeekLogs: WorkoutLog[]): { program: Program; experience: Experience }` (consumed by Task 15's workout screen on "Завершить тренировку").

- [ ] **Step 1: Write the failing test**

```ts
// src/program/generator.test.ts
import { describe, expect, it } from 'vitest';
import { generateInitialProgram, advanceWeek } from './generator';
import type { Exercise, Profile, WorkoutLog } from '../types';

function makeExercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: 'x', nameRu: 'X', nameEn: 'X', muscleGroup: 'chest', secondaryMuscleGroups: [],
    equipmentTiers: ['full_gym'], mechanic: 'compound', level: 'beginner',
    instructions: [], images: [], ...overrides,
  };
}

const exercises: Exercise[] = [
  makeExercise({ id: 'bench', muscleGroup: 'chest', mechanic: 'compound' }),
  makeExercise({ id: 'row', muscleGroup: 'back', mechanic: 'compound' }),
  makeExercise({ id: 'squat', muscleGroup: 'legs', mechanic: 'compound' }),
  makeExercise({ id: 'ohp', muscleGroup: 'shoulders', mechanic: 'compound' }),
  makeExercise({ id: 'curl', muscleGroup: 'arms', mechanic: 'isolation' }),
  makeExercise({ id: 'crunch', muscleGroup: 'core', mechanic: 'isolation' }),
];

const profile: Profile = {
  heightCm: 180, weightKg: 80, goal: 'mass', experience: 'beginner',
  daysPerWeek: 3, sessionDurationMin: 60, equipment: 'full_gym', preferredStartTimes: {},
};

describe('generateInitialProgram', () => {
  it('creates one day per daysPerWeek, matching the chosen split', () => {
    const program = generateInitialProgram(profile, exercises);
    expect(program.split).toBe('fullbody');
    expect(program.days).toHaveLength(3);
    expect(program.currentWeek).toBe(1);
  });

  it('initializes progress tracking for every exercise in the program', () => {
    const program = generateInitialProgram(profile, exercises);
    const allExerciseIds = program.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    for (const id of allExerciseIds) {
      expect(program.progressByExercise[id]).toEqual({ phase: 'linear', consecutiveFailures: 0, weeksWithoutIncrease: 0 });
    }
  });
});

describe('advanceWeek', () => {
  it('advances currentWeek by 1 and applies progression to logged exercises', () => {
    const program = generateInitialProgram(profile, exercises);
    // Manually give the bench exercise in day 0 a real starting weight, as the workout screen would.
    program.days[0].exercises = program.days[0].exercises.map((e) =>
      e.exerciseId === 'bench' ? { ...e, targetWeightKg: 40 } : e,
    );

    const log: WorkoutLog = {
      date: '2026-01-01', dayIndex: 0,
      exercises: [{ exerciseId: 'bench', sets: [
        { planned: { weightKg: 40, reps: 6 }, actual: { weightKg: 40, reps: 8 }, done: true },
        { planned: { weightKg: 40, reps: 6 }, actual: { weightKg: 40, reps: 8 }, done: true },
        { planned: { weightKg: 40, reps: 6 }, actual: { weightKg: 40, reps: 8 }, done: true },
      ] }],
      durationMin: 45, totalTonnageKg: 960,
    };

    const { program: updated } = advanceWeek(program, profile, [log]);
    expect(updated.currentWeek).toBe(2);
    const benchDay = updated.days[0].exercises.find((e) => e.exerciseId === 'bench')!;
    expect(benchDay.targetWeightKg).toBeGreaterThan(40);
    expect(updated.estimatedOneRepMax['bench']).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- generator.test.ts`
Expected: FAIL — `src/program/generator.ts` does not exist.

- [ ] **Step 3: Implement `src/program/generator.ts`**

```ts
import type { Exercise, ExerciseProgress, Experience, Profile, Program, ProgramDay, WorkoutLog } from '../types';
import { pickSplit, dayTemplatesForSplit, MUSCLE_GROUPS_BY_TEMPLATE } from './splitPicker';
import { pickExercisesForDay } from './exercisePicker';
import { applyProgression, estimateOneRepMax, maybeLevelUp } from './progression';

export function generateInitialProgram(profile: Profile, exercises: Exercise[]): Program {
  const split = pickSplit(profile.daysPerWeek);
  const templates = dayTemplatesForSplit(split, profile.daysPerWeek);
  const excludeKeywords = profile.injuries
    ? profile.injuries.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
    : undefined;

  const days: ProgramDay[] = templates.map((template, dayIndex) => ({
    dayIndex,
    template,
    exercises: pickExercisesForDay(exercises, {
      targetMuscles: MUSCLE_GROUPS_BY_TEMPLATE[template],
      equipment: profile.equipment,
      timeBudgetMin: profile.sessionDurationMin,
      goal: profile.goal,
      experience: profile.experience,
      excludeKeywords,
    }),
  }));

  const progressByExercise: Record<string, ExerciseProgress> = {};
  for (const day of days) {
    for (const ex of day.exercises) {
      progressByExercise[ex.exerciseId] = { phase: 'linear', consecutiveFailures: 0, weeksWithoutIncrease: 0 };
    }
  }

  return {
    split,
    days,
    currentWeek: 1,
    progressByExercise,
    estimatedOneRepMax: {},
    consecutiveGoodWeeks: 0,
  };
}

export function advanceWeek(
  program: Program,
  profile: Profile,
  lastWeekLogs: WorkoutLog[],
): { program: Program; experience: Experience } {
  const setsByExerciseId = new Map<string, WorkoutLog['exercises'][number]['sets']>();
  for (const log of lastWeekLogs) {
    for (const exerciseLog of log.exercises) {
      setsByExerciseId.set(exerciseLog.exerciseId, exerciseLog.sets);
    }
  }

  const progressByExercise = { ...program.progressByExercise };
  const estimatedOneRepMax = { ...program.estimatedOneRepMax };
  let anyFailureDeload = false;

  const days = program.days.map((day) => ({
    ...day,
    exercises: day.exercises.map((exercise) => {
      const lastWeekSets = setsByExerciseId.get(exercise.exerciseId) ?? [];
      const progress = progressByExercise[exercise.exerciseId] ?? { phase: 'linear' as const, consecutiveFailures: 0, weeksWithoutIncrease: 0 };

      if (lastWeekSets.length === 0) {
        return exercise; // not trained last week (e.g. was swapped) — leave untouched
      }

      const result = applyProgression(
        exercise, lastWeekSets, progress.phase, progress.consecutiveFailures, progress.weeksWithoutIncrease, program.currentWeek,
      );

      progressByExercise[exercise.exerciseId] = {
        phase: result.phase,
        consecutiveFailures: result.consecutiveFailures,
        weeksWithoutIncrease: result.weeksWithoutIncrease,
      };
      if (result.consecutiveFailures === 0 && progress.consecutiveFailures > 0) anyFailureDeload = true;

      const bestSet = lastWeekSets
        .filter((s) => s.done && s.actual.weightKg !== null)
        .sort((a, b) => estimateOneRepMax(b.actual.weightKg as number, b.actual.reps) - estimateOneRepMax(a.actual.weightKg as number, a.actual.reps))[0];
      if (bestSet && bestSet.actual.weightKg !== null) {
        estimatedOneRepMax[exercise.exerciseId] = estimateOneRepMax(bestSet.actual.weightKg, bestSet.actual.reps);
      }

      return result.exercise;
    }),
  }));

  const consecutiveGoodWeeks = anyFailureDeload ? 0 : program.consecutiveGoodWeeks + 1;
  const experience = maybeLevelUp(profile.experience, consecutiveGoodWeeks);

  return {
    program: {
      ...program,
      days,
      currentWeek: program.currentWeek + 1,
      progressByExercise,
      estimatedOneRepMax,
      consecutiveGoodWeeks,
    },
    experience,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- generator.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/program/generator.ts src/program/generator.test.ts
git commit -m "feat: add program generator orchestration (initial program + weekly advance)"
```

---

## Task 10: Router and app bootstrap

**Files:**
- Create: `src/router.ts`
- Test: `src/router.test.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `getState()`, `subscribe()` (Task 1).
- Produces: `resolveRoute(hash: string, state: AppState): ScreenName`, `ScreenName` type, `startRouter(container: HTMLElement, screens: Record<ScreenName, (container: HTMLElement) => void>): void` — consumed by `main.ts` and indirectly by every screen task (11-15).

- [ ] **Step 1: Write the failing test for the pure routing decision**

```ts
// src/router.test.ts
import { describe, expect, it } from 'vitest';
import { resolveRoute } from './router';
import type { AppState } from './types';

function makeState(overrides: Partial<AppState>): AppState {
  return { auth: null, profile: null, program: null, exerciseLog: [], settings: { units: 'metric' }, ...overrides };
}

describe('resolveRoute', () => {
  it('goes to login when not authenticated, regardless of hash', () => {
    expect(resolveRoute('#/home', makeState({ auth: null }))).toBe('login');
  });

  it('goes to onboarding when authenticated but no profile', () => {
    const state = makeState({ auth: { login: 'x', passwordHash: 'y' } });
    expect(resolveRoute('#/home', state)).toBe('onboarding');
  });

  it('honors the requested hash once authenticated with a profile', () => {
    const state = makeState({
      auth: { login: 'x', passwordHash: 'y' },
      profile: { heightCm: 180, weightKg: 80, goal: 'mass', experience: 'beginner', daysPerWeek: 3, sessionDurationMin: 60, equipment: 'full_gym', preferredStartTimes: {} },
    });
    expect(resolveRoute('#/workout', state)).toBe('workout');
    expect(resolveRoute('#/settings', state)).toBe('settings');
    expect(resolveRoute('#/unknown', state)).toBe('home');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- router.test.ts`
Expected: FAIL — `src/router.ts` does not exist.

- [ ] **Step 3: Implement `src/router.ts`**

```ts
import type { AppState } from './types';
import { getState, subscribe } from './state';

export type ScreenName = 'login' | 'onboarding' | 'home' | 'workout' | 'settings';

const KNOWN_SCREENS: ScreenName[] = ['login', 'onboarding', 'home', 'workout', 'settings'];

export function resolveRoute(hash: string, state: AppState): ScreenName {
  if (!state.auth) return 'login';
  if (!state.profile) return 'onboarding';

  const requested = hash.replace('#/', '') as ScreenName;
  return KNOWN_SCREENS.includes(requested) ? requested : 'home';
}

export function startRouter(
  container: HTMLElement,
  screens: Record<ScreenName, (container: HTMLElement) => void>,
): void {
  function render(): void {
    const screen = resolveRoute(window.location.hash, getState());
    container.innerHTML = '';
    screens[screen](container);
  }

  window.addEventListener('hashchange', render);
  subscribe(render);
  render();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- router.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/router.ts src/router.test.ts
git commit -m "feat: add hash router with auth/profile redirect rules"
```

---

## Task 11: Login screen

**Files:**
- Create: `src/screens/login.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `ensureDefaultAuth`, `verifyLogin` (Task 2); `ScreenName` (Task 10).
- Produces: `renderLogin(container: HTMLElement): void`.

- [ ] **Step 1: Implement `src/screens/login.ts`** (UI screens are verified manually in Task 16, per the design doc's testing plan — no unit test framework is a good fit for DOM event wiring here)

```ts
import { ensureDefaultAuth, verifyLogin } from '../auth';

export function renderLogin(container: HTMLElement): void {
  void ensureDefaultAuth();

  container.innerHTML = `
    <h1>Мой тренер</h1>
    <form id="login-form">
      <label for="login">Логин</label>
      <input id="login" name="login" type="text" autocomplete="username" required />
      <label for="password">Пароль</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <p id="login-error" style="color: var(--danger); display: none;">Неверный логин или пароль</p>
      <button type="submit" style="width: 100%; margin-top: 16px;">Войти</button>
      <p style="font-size: 0.85rem; color: #666; margin-top: 24px;">
        Это локальная защита уровня браузера, а не полноценная аутентификация —
        при просмотре исходного кода страницы её можно обойти.
      </p>
    </form>
  `;

  const form = container.querySelector<HTMLFormElement>('#login-form')!;
  const errorEl = container.querySelector<HTMLParagraphElement>('#login-error')!;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const login = (container.querySelector('#login') as HTMLInputElement).value;
    const password = (container.querySelector('#password') as HTMLInputElement).value;

    if (await verifyLogin(login, password)) {
      errorEl.style.display = 'none';
      window.location.hash = '#/home';
    } else {
      errorEl.style.display = 'block';
    }
  });
}
```

- [ ] **Step 2: Wire it into `src/main.ts`** (placeholder screens for now; replaced task-by-task as they're built)

```ts
import './style.css';
import { startRouter } from './router';
import { renderLogin } from './screens/login';

function placeholder(name: string) {
  return (container: HTMLElement) => {
    container.innerHTML = `<p>Экран "${name}" ещё не реализован</p>`;
  };
}

const container = document.querySelector<HTMLDivElement>('#app')!;
startRouter(container, {
  login: renderLogin,
  onboarding: placeholder('onboarding'),
  home: placeholder('home'),
  workout: placeholder('workout'),
  settings: placeholder('settings'),
});
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open the printed URL. Confirm: the login screen appears, wrong credentials show the error message, `danya` / `a0zOlB6rbhN914` redirects to the onboarding placeholder (no profile exists yet).

- [ ] **Step 4: Commit**

```bash
git add src/screens/login.ts src/main.ts
git commit -m "feat: add login screen"
```

---

## Task 12: Onboarding screen

**Files:**
- Create: `src/screens/onboarding.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `updateState` (Task 1); `loadExercises` (Task 5); `generateInitialProgram` (Task 9).
- Produces: `renderOnboarding(container: HTMLElement): void`.

- [ ] **Step 1: Implement `src/screens/onboarding.ts`**

```ts
import type { Equipment, Goal, Profile } from '../types';
import { updateState } from '../state';
import { loadExercises } from '../exercises/loader';
import { generateInitialProgram } from '../program/generator';

const GOAL_LABELS: Record<Goal, string> = {
  mass: 'Набор мышечной массы',
  fatloss: 'Похудение',
  strength: 'Сила',
  fitness: 'Общая физическая форма',
  maintenance: 'Поддержание формы',
};

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  full_gym: 'Полный зал',
  home_dumbbells: 'Дома с гантелями',
  bodyweight: 'Только своё тело',
};

export function renderOnboarding(container: HTMLElement): void {
  container.innerHTML = `
    <h1>Анкета</h1>
    <form id="onboarding-form">
      <label for="heightCm">Рост (см)</label>
      <input id="heightCm" type="number" min="100" max="250" required />

      <label for="weightKg">Вес (кг)</label>
      <input id="weightKg" type="number" min="30" max="300" required />

      <label for="goal">Цель тренировок</label>
      <select id="goal">
        ${Object.entries(GOAL_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
      </select>

      <label for="daysPerWeek">Тренировочных дней в неделю</label>
      <input id="daysPerWeek" type="number" min="2" max="6" value="3" required />

      <label for="sessionDurationMin">Длительность тренировки (мин)</label>
      <input id="sessionDurationMin" type="number" min="20" max="180" value="60" required />

      <label for="equipment">Доступное оборудование</label>
      <select id="equipment">
        ${Object.entries(EQUIPMENT_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
      </select>

      <label for="injuries">Травмы/ограничения (необязательно)</label>
      <input id="injuries" type="text" placeholder="например: колено, поясница" />

      <button type="submit" style="width: 100%; margin-top: 16px;">Сгенерировать программу</button>
    </form>
  `;

  const form = container.querySelector<HTMLFormElement>('#onboarding-form')!;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = (id: string) => (container.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement).value;

    const profile: Profile = {
      heightCm: Number(value('heightCm')),
      weightKg: Number(value('weightKg')),
      goal: value('goal') as Goal,
      experience: 'beginner',
      daysPerWeek: Number(value('daysPerWeek')),
      sessionDurationMin: Number(value('sessionDurationMin')),
      equipment: value('equipment') as Equipment,
      preferredStartTimes: {},
      injuries: value('injuries') || undefined,
    };

    updateState('profile', profile);

    const exercises = await loadExercises();
    const program = generateInitialProgram(profile, exercises);
    updateState('program', program);

    window.location.hash = '#/home';
  });
}
```

- [ ] **Step 2: Wire it into `src/main.ts`**

```ts
import { renderOnboarding } from './screens/onboarding';
// ...
startRouter(container, {
  login: renderLogin,
  onboarding: renderOnboarding,
  home: placeholder('home'),
  workout: placeholder('workout'),
  settings: placeholder('settings'),
});
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. Log in, fill the onboarding form, submit. Confirm no console errors and that `localStorage` (via devtools) now has `mtrainer:profile` and `mtrainer:program` populated, with `program.days.length` matching `daysPerWeek`.

- [ ] **Step 4: Commit**

```bash
git add src/screens/onboarding.ts src/main.ts
git commit -m "feat: add onboarding screen, wired to program generation"
```

---

## Task 13: Export/import module and settings screen

**Files:**
- Create: `src/exportImport.ts`
- Test: `src/exportImport.test.ts`
- Create: `src/screens/settings.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `getState`, `updateState` (Task 1); `changeCredentials` (Task 2).
- Produces: `exportAllAsJson(): string`, `importAllFromJson(json: string): { ok: true } | { ok: false; error: string }` (consumed by `renderSettings`); `renderSettings(container: HTMLElement): void`.

- [ ] **Step 1: Write the failing test for `exportImport.ts`**

```ts
// src/exportImport.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- exportImport.test.ts`
Expected: FAIL — `src/exportImport.ts` does not exist.

- [ ] **Step 3: Implement `src/exportImport.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- exportImport.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Implement `src/screens/settings.ts`**

```ts
import { changeCredentials } from '../auth';
import { getState, updateState } from '../state';
import { exportAllAsJson, importAllFromJson } from '../exportImport';

export function renderSettings(container: HTMLElement): void {
  const units = getState().settings.units;

  container.innerHTML = `
    <h1>Настройки</h1>

    <section>
      <h2>Смена логина/пароля</h2>
      <form id="credentials-form">
        <label for="new-login">Новый логин</label>
        <input id="new-login" type="text" required />
        <label for="new-password">Новый пароль</label>
        <input id="new-password" type="password" minlength="8" required />
        <button type="submit" style="width: 100%; margin-top: 12px;">Сохранить</button>
        <p id="credentials-saved" style="display: none; color: green;">Сохранено</p>
      </form>
    </section>

    <section style="margin-top: 24px;">
      <h2>Единицы измерения</h2>
      <select id="units">
        <option value="metric" ${units === 'metric' ? 'selected' : ''}>Метрические (кг/см)</option>
        <option value="imperial" ${units === 'imperial' ? 'selected' : ''}>Имперские (фунты/дюймы)</option>
      </select>
    </section>

    <section style="margin-top: 24px;">
      <h2>Резервная копия</h2>
      <button id="export-btn" class="secondary" style="width: 100%;">Экспортировать данные в JSON</button>
      <label for="import-file" style="margin-top: 12px;">Импортировать из JSON</label>
      <input id="import-file" type="file" accept="application/json" />
      <p id="import-status"></p>
    </section>

    <section style="margin-top: 24px;">
      <p style="font-size: 0.85rem; color: #666;">
        Для настоящих push-уведомлений открой приложение отдельной вкладкой
        (вне Google Sites) и установи на главный экран.
      </p>
    </section>
  `;

  container.querySelector('#credentials-form')!.addEventListener('submit', async (event) => {
    event.preventDefault();
    const login = (container.querySelector('#new-login') as HTMLInputElement).value;
    const password = (container.querySelector('#new-password') as HTMLInputElement).value;
    await changeCredentials(login, password);
    container.querySelector<HTMLParagraphElement>('#credentials-saved')!.style.display = 'block';
  });

  container.querySelector('#units')!.addEventListener('change', (event) => {
    const value = (event.target as HTMLSelectElement).value as 'metric' | 'imperial';
    updateState('settings', { ...getState().settings, units: value });
  });

  container.querySelector('#export-btn')!.addEventListener('click', () => {
    const blob = new Blob([exportAllAsJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moy-trener-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  container.querySelector('#import-file')!.addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    const statusEl = container.querySelector<HTMLParagraphElement>('#import-status')!;
    if (!file) return;

    if (!window.confirm('Импорт полностью заменит текущие данные приложения. Продолжить?')) return;

    const text = await file.text();
    const result = importAllFromJson(text);
    statusEl.textContent = result.ok ? 'Данные успешно импортированы' : `Ошибка: ${result.error}`;
    statusEl.style.color = result.ok ? 'green' : 'var(--danger)';
  });
}
```

- [ ] **Step 6: Wire it into `src/main.ts`**

```ts
import { renderSettings } from './screens/settings';
// ...
startRouter(container, {
  login: renderLogin,
  onboarding: renderOnboarding,
  home: placeholder('home'),
  workout: placeholder('workout'),
  settings: renderSettings,
});
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev`. Navigate to `#/settings`. Export data, verify a JSON file downloads with all 5 top-level keys. Change units, confirm `localStorage`'s `mtrainer:settings` updates. Import the previously exported file, confirm the confirmation dialog appears and data round-trips.

- [ ] **Step 8: Commit**

```bash
git add src/exportImport.ts src/exportImport.test.ts src/screens/settings.ts src/main.ts
git commit -m "feat: add export/import and settings screen"
```

---

## Task 14: Home screen

**Files:**
- Create: `src/screens/home.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `getState` (Task 1).
- Produces: `renderHome(container: HTMLElement): void`.

- [ ] **Step 1: Implement `src/screens/home.ts`**

```ts
import { getState } from '../state';

export function renderHome(container: HTMLElement): void {
  const { program, exerciseLog } = getState();

  if (!program) {
    container.innerHTML = '<p>Программа не найдена. Пройди анкету заново в настройках.</p>';
    return;
  }

  const nextDayIndex = exerciseLog.length % program.days.length;
  const nextDay = program.days[nextDayIndex];
  const templateLabels: Record<string, string> = {
    full: 'Всё тело', upper: 'Верх тела', lower: 'Низ тела', push: 'Жимовой день', pull: 'Тяговый день', legs: 'Ноги',
  };

  container.innerHTML = `
    <h1>Мой тренер</h1>
    <section style="border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <h2 style="margin-top: 0;">Ближайшая тренировка</h2>
      <p>${templateLabels[nextDay.template]} · Неделя ${program.currentWeek}</p>
      <button id="start-workout" style="width: 100%;">Начать тренировку</button>
    </section>
    <button id="open-settings" class="secondary" style="width: 100%;">Настройки</button>
  `;

  container.querySelector('#start-workout')!.addEventListener('click', () => {
    window.location.hash = '#/workout';
  });
  container.querySelector('#open-settings')!.addEventListener('click', () => {
    window.location.hash = '#/settings';
  });
}
```

- [ ] **Step 2: Wire it into `src/main.ts`**

```ts
import { renderHome } from './screens/home';
// ...
startRouter(container, {
  login: renderLogin,
  onboarding: renderOnboarding,
  home: renderHome,
  workout: placeholder('workout'),
  settings: renderSettings,
});
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. After onboarding, confirm the home screen shows the correct next-day template and week number, and that "Начать тренировку" navigates to the workout placeholder.

- [ ] **Step 4: Commit**

```bash
git add src/screens/home.ts src/main.ts
git commit -m "feat: add home screen with next-workout summary"
```

---

## Task 15: Rest/session timers and the workout screen

**Files:**
- Create: `src/timer.ts`
- Test: `src/timer.test.ts`
- Create: `src/screens/workout.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `getState`, `updateState` (Task 1); `loadExercises` (Task 5); `advanceWeek` (Task 9).
- Produces: `createCountdown(totalSec: number, onTick: (remainingSec: number) => void, onDone: () => void): { stop: () => void; addSeconds: (delta: number) => void }` (consumed by `renderWorkout`); `renderWorkout(container: HTMLElement): void`.

- [ ] **Step 1: Write the failing test for the pure countdown logic**

```ts
// src/timer.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createCountdown } from './timer';

describe('createCountdown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ticks down every second and calls onDone at zero', () => {
    const onTick = vi.fn();
    const onDone = vi.fn();
    createCountdown(3, onTick, onDone);

    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledWith(2);
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledWith(1);
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledWith(0);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stop() halts further ticks', () => {
    const onTick = vi.fn();
    const { stop } = createCountdown(5, onTick, vi.fn());
    vi.advanceTimersByTime(1000);
    stop();
    vi.advanceTimersByTime(3000);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('addSeconds adjusts the remaining time without resetting the interval', () => {
    const onTick = vi.fn();
    const { addSeconds } = createCountdown(10, onTick, vi.fn());
    addSeconds(15);
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenLastCalledWith(24);
    addSeconds(-100);
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenLastCalledWith(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- timer.test.ts`
Expected: FAIL — `src/timer.ts` does not exist.

- [ ] **Step 3: Implement `src/timer.ts`**

```ts
export interface Countdown {
  stop: () => void;
  addSeconds: (delta: number) => void;
}

export function createCountdown(totalSec: number, onTick: (remainingSec: number) => void, onDone: () => void): Countdown {
  let remaining = totalSec;

  const intervalId = setInterval(() => {
    remaining = Math.max(0, remaining - 1);
    onTick(remaining);
    if (remaining === 0) {
      clearInterval(intervalId);
      onDone();
    }
  }, 1000);

  return {
    stop: () => clearInterval(intervalId),
    addSeconds: (delta: number) => {
      remaining = Math.max(0, remaining + delta);
    },
  };
}

export function playBeep(): void {
  const ctx = new AudioContext();
  const oscillator = ctx.createOscillator();
  oscillator.frequency.value = 880;
  oscillator.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.3);
  oscillator.onended = () => ctx.close();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- timer.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Implement `src/screens/workout.ts`**

```ts
import type { Exercise, SetLogEntry, WorkoutLog } from '../types';
import { getState, updateState } from '../state';
import { loadExercises } from '../exercises/loader';
import { advanceWeek } from '../program/generator';
import { createCountdown, playBeep, type Countdown } from '../timer';

export function renderWorkout(container: HTMLElement): void {
  const { program, exerciseLog } = getState();
  if (!program) {
    container.innerHTML = '<p>Программа не найдена.</p>';
    return;
  }

  const dayIndex = exerciseLog.length % program.days.length;
  const day = program.days[dayIndex];
  const startedAt = Date.now();

  // Working copy of set logs, keyed by "exerciseId:setIndex"
  const logs = new Map<string, SetLogEntry>();
  let restCountdown: Countdown | null = null;
  let allExercisesCache: Exercise[] = [];

  loadExercises().then((allExercises) => {
    allExercisesCache = allExercises;
    const byId = new Map(allExercises.map((e) => [e.id, e]));
    renderScreen(byId);
  });

  function findReplacement(currentId: string, byId: Map<string, Exercise>): Exercise | null {
    const current = byId.get(currentId);
    const { profile } = getState();
    if (!current || !profile) return null;
    const usedIds = new Set(day.exercises.map((e) => e.exerciseId));
    return (
      allExercisesCache.find(
        (e) => e.id !== currentId && !usedIds.has(e.id) && e.muscleGroup === current.muscleGroup && e.equipmentTiers.includes(profile.equipment),
      ) ?? null
    );
  }

  function renderScreen(byId: Map<string, Exercise>): void {
    container.innerHTML = `
      <h1>Тренировка</h1>
      <p id="session-timer">Прошло: 0 мин</p>
      <div id="exercise-list"></div>
      <div id="rest-timer" style="display: none; text-align: center; margin: 16px 0;">
        <p>Отдых: <span id="rest-remaining"></span> сек</p>
        <button id="rest-minus" class="secondary">-15 сек</button>
        <button id="rest-plus" class="secondary">+15 сек</button>
      </div>
      <button id="finish-workout" style="width: 100%; margin-top: 16px;">Завершить тренировку</button>
    `;

    const list = container.querySelector<HTMLDivElement>('#exercise-list')!;
    for (const ex of day.exercises) {
      const exercise = byId.get(ex.exerciseId);
      const wrapper = document.createElement('section');
      wrapper.style.cssText = 'border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 12px;';
      wrapper.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <h3 style="margin: 0;">${exercise?.nameRu ?? ex.exerciseId}</h3>
          <button class="replace-btn secondary" style="font-size: 0.8rem; padding: 4px 8px; min-height: 32px;">Заменить</button>
        </div>
        ${exercise?.images[0] ? `<img src="/exercises/${exercise.id}/${exercise.images[0].split('/').pop()}" alt="${exercise.nameRu}" style="max-width: 100%; border-radius: 8px;" />` : ''}
        <p>${ex.sets} × ${ex.repsMin}-${ex.repsMax} ${ex.targetWeightKg !== null ? `@ ${ex.targetWeightKg} кг` : '(вес тела)'}</p>
        <div class="set-rows"></div>
      `;

      wrapper.querySelector('.replace-btn')!.addEventListener('click', () => {
        const replacement = findReplacement(ex.exerciseId, byId);
        if (!replacement) {
          window.alert('Аналог не найден среди доступных упражнений');
          return;
        }
        const { program: currentProgram } = getState();
        if (!currentProgram) return;
        const updatedDays = currentProgram.days.map((d, idx) =>
          idx === dayIndex
            ? { ...d, exercises: d.exercises.map((e) => (e.exerciseId === ex.exerciseId ? { ...e, exerciseId: replacement.id } : e)) }
            : d,
        );
        updateState('program', { ...currentProgram, days: updatedDays });
        day.exercises = updatedDays[dayIndex].exercises; // keep this render's local `day` reference in sync
        renderScreen(byId); // re-render with the swapped exercise; in-progress set logs for the swapped exercise are cleared, matching "replace before you start it" usage
      });

      const setRows = wrapper.querySelector<HTMLDivElement>('.set-rows')!;
      for (let setIndex = 0; setIndex < ex.sets; setIndex++) {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-bottom: 8px;';
        row.innerHTML = `
          <input class="actual-weight" type="number" value="${ex.targetWeightKg ?? ''}" placeholder="кг" style="width: 80px;" />
          <input class="actual-reps" type="number" value="${ex.repsMin}" placeholder="повторы" style="width: 80px;" />
          <button class="done-btn secondary">Готово ✓</button>
        `;
        const doneBtn = row.querySelector<HTMLButtonElement>('.done-btn')!;
        doneBtn.addEventListener('click', () => {
          const weightInput = row.querySelector<HTMLInputElement>('.actual-weight')!;
          const repsInput = row.querySelector<HTMLInputElement>('.actual-reps')!;
          logs.set(`${ex.exerciseId}:${setIndex}`, {
            planned: { weightKg: ex.targetWeightKg, reps: ex.repsMin },
            actual: { weightKg: weightInput.value ? Number(weightInput.value) : null, reps: Number(repsInput.value) },
            done: true,
          });
          doneBtn.textContent = 'Выполнено';
          doneBtn.disabled = true;
          startRest(ex.restSec);
        });
        setRows.appendChild(row);
      }
      list.appendChild(wrapper);
    }

    const sessionTimerEl = container.querySelector<HTMLParagraphElement>('#session-timer')!;
    setInterval(() => {
      const elapsedMin = Math.floor((Date.now() - startedAt) / 60000);
      sessionTimerEl.textContent = `Прошло: ${elapsedMin} мин`;
    }, 15000);

    container.querySelector('#finish-workout')!.addEventListener('click', () => finishWorkout());
  }

  function startRest(restSec: number): void {
    restCountdown?.stop();
    const restEl = container.querySelector<HTMLDivElement>('#rest-timer')!;
    const remainingEl = container.querySelector<HTMLSpanElement>('#rest-remaining')!;
    restEl.style.display = 'block';
    remainingEl.textContent = String(restSec);

    restCountdown = createCountdown(
      restSec,
      (remaining) => { remainingEl.textContent = String(remaining); },
      () => { playBeep(); restEl.style.display = 'none'; },
    );

    container.querySelector('#rest-minus')!.addEventListener('click', () => restCountdown?.addSeconds(-15));
    container.querySelector('#rest-plus')!.addEventListener('click', () => restCountdown?.addSeconds(15));
  }

  function finishWorkout(): void {
    const durationMin = Math.round((Date.now() - startedAt) / 60000);
    let totalTonnageKg = 0;
    const exercisesLog: WorkoutLog['exercises'] = day.exercises.map((ex) => {
      const sets: SetLogEntry[] = [];
      for (let setIndex = 0; setIndex < ex.sets; setIndex++) {
        const entry = logs.get(`${ex.exerciseId}:${setIndex}`);
        if (entry) {
          sets.push(entry);
          if (entry.actual.weightKg) totalTonnageKg += entry.actual.weightKg * entry.actual.reps;
        }
      }
      return { exerciseId: ex.exerciseId, sets };
    });

    const log: WorkoutLog = { date: new Date().toISOString(), dayIndex, exercises: exercisesLog, durationMin, totalTonnageKg };
    const { exerciseLog: currentLog, program: currentProgram, profile } = getState();
    updateState('exerciseLog', [...currentLog, log]);

    // Advance the week once every day in the split has been logged since the last advance.
    const logsSinceProgramStart = currentLog.length + 1;
    if (currentProgram && profile && logsSinceProgramStart % currentProgram.days.length === 0) {
      const weekLogs = [...currentLog, log].slice(-currentProgram.days.length);
      const { program: updatedProgram, experience: updatedExperience } = advanceWeek(currentProgram, profile, weekLogs);
      updateState('program', updatedProgram);
      if (updatedExperience !== profile.experience) {
        updateState('profile', { ...profile, experience: updatedExperience });
      }
    }

    container.innerHTML = `
      <h1>Тренировка завершена</h1>
      <p>Время: ${durationMin} мин</p>
      <p>Тоннаж: ${Math.round(totalTonnageKg)} кг</p>
      <button id="back-home" style="width: 100%;">На главную</button>
    `;
    container.querySelector('#back-home')!.addEventListener('click', () => { window.location.hash = '#/home'; });
  }
}
```

- [ ] **Step 6: Wire it into `src/main.ts`**

```ts
import { renderWorkout } from './screens/workout';
// ...
startRouter(container, {
  login: renderLogin,
  onboarding: renderOnboarding,
  home: renderHome,
  workout: renderWorkout,
  settings: renderSettings,
});
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev`. Start a workout, mark several sets "Готово" and confirm the rest timer auto-starts, counts down, and beeps at zero (browser tab must have received a user gesture already — the click itself satisfies autoplay policy). Confirm ±15 sec buttons adjust the countdown. Click "Заменить" on an exercise and confirm it swaps to a same-muscle-group alternative and the swap survives a page reload (persisted via `updateState`). Finish the workout and confirm the summary shows correct tonnage/time, and `mtrainer:exerciseLog` in localStorage now has one more entry.

- [ ] **Step 8: Commit**

```bash
git add src/timer.ts src/timer.test.ts src/screens/workout.ts src/main.ts
git commit -m "feat: add workout screen with set logging and rest/session timers"
```

---

## Task 16: Final integration, README, and manual QA pass

**Files:**
- Create: `README.md`
- Modify: none (verification only)

**Interfaces:**
- Consumes: the entire app built in Tasks 1-15.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests across all files PASS.

- [ ] **Step 2: Run a production build**

Run: `npm run build`
Expected: Completes with no TypeScript errors; `dist/` is created.

- [ ] **Step 3: Preview the production build**

Run: `npm run preview` (then open the printed URL)
Expected: Full flow works identically to `npm run dev`: login → onboarding → home → workout → finish → home.

- [ ] **Step 4: Manual QA at 360px width**

Using browser devtools device toolbar, set width to 360px. Walk through login → onboarding → home → workout. Confirm: no horizontal scroll, all buttons remain tappable (≥44px), text doesn't overflow its container.

- [ ] **Step 5: Manual QA inside a simulated iframe**

Create a throwaway local file (not committed) `iframe-test.html`:
```html
<!doctype html><html><body style="margin:0">
<iframe src="http://localhost:4173" style="width:100%;height:100vh;border:0"></iframe>
</body></html>
```
Serve the built app (`npm run preview`, default port 4173) and open `iframe-test.html` directly in a browser. Confirm the app loads and functions identically inside the iframe (this simulates the Google Sites embed from spec §2.1).

- [ ] **Step 6: Write `README.md`**

```markdown
# Мой тренер

Персональные тренировки в зале — генерирует программу по анкете, ведёт
прогрессию нагрузки и логирует тренировки. Полностью на клиенте, без
бэкенда.

## Разработка

\`\`\`bash
npm install
npm run build:exercises  # один раз — вендорит базу упражнений
npm run dev
\`\`\`

## Тесты

\`\`\`bash
npm test
\`\`\`

## Сборка

\`\`\`bash
npm run build
npm run preview
\`\`\`

## Статус

Фаза 1 (это репозиторий): вход, анкета, генератор программы, экран
тренировки, экспорт/импорт JSON. Расписание, напоминания, статистика и
PWA/офлайн-режим — отдельные последующие фазы (см. `docs/superpowers/specs/`).
```

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: add README with dev/build/test instructions"
```

---

## What Phase 1 does NOT cover (by design)

Deferred to Phase 2: weekly schedule screen, in-page reminders, progress/stats charts, theme switching. Deferred to Phase 3: `manifest.json` + service worker + push notifications for the standalone PWA mode. Deployment (GitHub Pages + Google Sites embed) is a separate, explicitly-confirmed step after this plan is executed — not part of this plan.
