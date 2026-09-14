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
