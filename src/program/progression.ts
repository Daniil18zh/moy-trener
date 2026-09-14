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
  // Baseline to restore after a scheduled deload; see ExerciseProgress in ../types.
  preDeloadSets: number | null;
  preDeloadWeightKg: number | null;
  reason: string;
}

export function estimateOneRepMax(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

export function isDeloadWeek(weekNumber: number): boolean {
  return weekNumber % DELOAD_INTERVAL_WEEKS === 0;
}

export function roundToPlate(kg: number): number {
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
  // Baseline saved by the previous (deload) week, if any. Passing them is what makes the deload
  // temporary: this call restores them before applying normal progression, then reports them as
  // consumed (null) in the result. Defaulted so callers that never deload can ignore them.
  preDeloadSets: number | null = null,
  preDeloadWeightKg: number | null = null,
): ProgressionResult {
  if (isDeloadWeek(weekNumber)) {
    // Capture the real working baseline *before* cutting it. If a baseline is already pending
    // (two deload weeks back to back — not possible with a 6-week interval, but cheap to guard),
    // keep the original one so the dip is never compounded into the saved baseline.
    const baselineSets = preDeloadSets ?? exercise.sets;
    const baselineWeightKg = preDeloadSets === null ? exercise.targetWeightKg : preDeloadWeightKg;
    const reason = 'Разгрузочная неделя — объём и вес снижены для восстановления';
    return {
      exercise: {
        ...exercise,
        sets: Math.max(1, Math.round(baselineSets * (1 - DELOAD_VOLUME_PCT))),
        targetWeightKg: baselineWeightKg === null ? null : roundToPlate(baselineWeightKg * (1 - DELOAD_VOLUME_PCT)),
        lastChangeReason: reason,
      },
      phase,
      consecutiveFailures: 0,
      weeksWithoutIncrease,
      preDeloadSets: baselineSets,
      preDeloadWeightKg: baselineWeightKg,
      reason,
    };
  }

  // First non-deload week after a deload: put the pre-deload sets/weight back, then let the normal
  // branches below progress from that restored baseline (not from the temporarily reduced values).
  const restored: ProgramExercise =
    preDeloadSets === null ? exercise : { ...exercise, sets: preDeloadSets, targetWeightKg: preDeloadWeightKg };
  const restoredSuffix = preDeloadSets === null ? '' : ' (объём после разгрузки восстановлен)';

  if (restored.targetWeightKg === null) {
    if (allSetsMetReps(lastWeekSets, restored.repsMax)) {
      const reason = 'Ты выполнил все подходы на верхнюю границу повторов — диапазон повторов увеличен' + restoredSuffix;
      return {
        exercise: { ...restored, repsMin: restored.repsMin + BODYWEIGHT_REP_STEP, repsMax: restored.repsMax + BODYWEIGHT_REP_STEP, lastChangeReason: reason },
        phase, consecutiveFailures: 0, weeksWithoutIncrease: 0, preDeloadSets: null, preDeloadWeightKg: null, reason,
      };
    }
    const reason = 'Пока не все подходы выполнены на верхнюю границу повторов — продолжай на том же диапазоне' + restoredSuffix;
    return { exercise: { ...restored, lastChangeReason: reason }, phase, consecutiveFailures, weeksWithoutIncrease: weeksWithoutIncrease + 1, preDeloadSets: null, preDeloadWeightKg: null, reason };
  }

  if (phase === 'linear') {
    if (allSetsMetReps(lastWeekSets, restored.repsMin)) {
      const reason = 'Ты выполнил все подходы на прошлой неделе — вес увеличен' + restoredSuffix;
      return {
        exercise: { ...restored, targetWeightKg: roundToPlate(restored.targetWeightKg * (1 + WEIGHT_INCREASE_PCT)), lastChangeReason: reason },
        phase: 'linear', consecutiveFailures: 0, weeksWithoutIncrease: 0, preDeloadSets: null, preDeloadWeightKg: null, reason,
      };
    }

    const newFailures = consecutiveFailures + 1;
    if (newFailures >= 2) {
      const reason = 'Два срыва подряд — вес снижен для стабилизации техники (делоад)' + restoredSuffix;
      return {
        exercise: { ...restored, targetWeightKg: roundToPlate(restored.targetWeightKg * (1 - WEIGHT_DECREASE_PCT)), lastChangeReason: reason },
        phase: 'linear', consecutiveFailures: 0, weeksWithoutIncrease: weeksWithoutIncrease + 1, preDeloadSets: null, preDeloadWeightKg: null, reason,
      };
    }

    const newWeeksWithoutIncrease = weeksWithoutIncrease + 1;
    if (newWeeksWithoutIncrease >= PLATEAU_WEEKS_THRESHOLD) {
      const reason = 'Вес не растёт уже 2 недели — переключаемся на двойную прогрессию (сначала растим повторы)' + restoredSuffix;
      return { exercise: { ...restored, lastChangeReason: reason }, phase: 'double_progression', consecutiveFailures: newFailures, weeksWithoutIncrease: 0, preDeloadSets: null, preDeloadWeightKg: null, reason };
    }

    const reason = 'Не все подходы выполнены — вес пока не меняем' + restoredSuffix;
    return { exercise: { ...restored, lastChangeReason: reason }, phase: 'linear', consecutiveFailures: newFailures, weeksWithoutIncrease: newWeeksWithoutIncrease, preDeloadSets: null, preDeloadWeightKg: null, reason };
  }

  // double_progression
  if (allSetsMetReps(lastWeekSets, restored.repsMax)) {
    const reason = 'Повторы дошли до верхней границы на всех подходах — вес увеличен, повторы сброшены к нижней границе' + restoredSuffix;
    return {
      exercise: { ...restored, targetWeightKg: roundToPlate(restored.targetWeightKg * (1 + WEIGHT_INCREASE_PCT)), lastChangeReason: reason },
      phase: 'double_progression', consecutiveFailures: 0, weeksWithoutIncrease: 0, preDeloadSets: null, preDeloadWeightKg: null, reason,
    };
  }
  const reason = 'Продолжаем расти в повторах на текущем весе — вес пока не меняем' + restoredSuffix;
  return { exercise: { ...restored, lastChangeReason: reason }, phase: 'double_progression', consecutiveFailures, weeksWithoutIncrease: weeksWithoutIncrease + 1, preDeloadSets: null, preDeloadWeightKg: null, reason };
}

export function maybeLevelUp(experience: Experience, consecutiveGoodWeeks: number): Experience {
  if (experience === 'beginner' && consecutiveGoodWeeks >= 4) return 'intermediate';
  if (experience === 'intermediate' && consecutiveGoodWeeks >= 10) return 'advanced';
  return experience;
}
