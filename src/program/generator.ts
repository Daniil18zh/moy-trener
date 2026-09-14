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
