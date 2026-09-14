import type { Exercise, ExerciseProgress, Experience, Profile, Program, ProgramDay, ProgramExercise, WorkoutLog } from '../types';
import { pickSplit, dayTemplatesForSplit, MUSCLE_GROUPS_BY_TEMPLATE } from './splitPicker';
import { pickExercisesForDay } from './exercisePicker';
import { applyProgression, estimateOneRepMax, isDeloadWeek, maybeLevelUp } from './progression';

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
  // Merge (concatenate, never overwrite) sets across all day-logs for the week: the same
  // exerciseId can appear on multiple ProgramDays (e.g. every day of a fullbody split shares
  // the same template, so the same exercises repeat), and a user training it in more than one
  // session that week should have all of those sets considered, not just the last one seen.
  const setsByExerciseId = new Map<string, WorkoutLog['exercises'][number]['sets']>();
  for (const log of lastWeekLogs) {
    for (const exerciseLog of log.exercises) {
      const existing = setsByExerciseId.get(exerciseLog.exerciseId);
      setsByExerciseId.set(exerciseLog.exerciseId, existing ? [...existing, ...exerciseLog.sets] : exerciseLog.sets);
    }
  }

  // One representative ProgramExercise per unique exerciseId. When the same exercise appears
  // on multiple days, pickExercisesForDay produced identical entries for each occurrence (it's
  // a pure function of the day template's target muscles), so any occurrence can serve as the
  // input to applyProgression — it must run exactly once per exerciseId per week, not once per
  // day-slot, or repeated exerciseIds would have progression applied multiple times in a row,
  // each read compounding the previous write within the same week.
  const exerciseById = new Map<string, ProgramExercise>();
  for (const day of program.days) {
    for (const exercise of day.exercises) {
      if (!exerciseById.has(exercise.exerciseId)) {
        exerciseById.set(exercise.exerciseId, exercise);
      }
    }
  }

  const progressByExercise = { ...program.progressByExercise };
  const estimatedOneRepMax = { ...program.estimatedOneRepMax };
  const updatedExerciseById = new Map<string, ProgramExercise>();
  let anyFailureDeload = false;

  for (const [exerciseId, exercise] of exerciseById) {
    const lastWeekSets = setsByExerciseId.get(exerciseId);
    if (!lastWeekSets || lastWeekSets.length === 0) continue; // not trained last week (e.g. was swapped) — leave untouched

    const progress = progressByExercise[exerciseId] ?? { phase: 'linear' as const, consecutiveFailures: 0, weeksWithoutIncrease: 0 };

    const result = applyProgression(
      exercise, lastWeekSets, progress.phase, progress.consecutiveFailures, progress.weeksWithoutIncrease, program.currentWeek,
    );

    progressByExercise[exerciseId] = {
      phase: result.phase,
      consecutiveFailures: result.consecutiveFailures,
      weeksWithoutIncrease: result.weeksWithoutIncrease,
    };
    // A routine scheduled recovery week (isDeloadWeek) also resets consecutiveFailures to 0,
    // but that is not a failure-triggered deload — only count it when it wasn't scheduled.
    if (!isDeloadWeek(program.currentWeek) && result.consecutiveFailures === 0 && progress.consecutiveFailures > 0) {
      anyFailureDeload = true;
    }

    const bestSet = lastWeekSets
      .filter((s) => s.done && s.actual.weightKg !== null)
      .sort((a, b) => estimateOneRepMax(b.actual.weightKg as number, b.actual.reps) - estimateOneRepMax(a.actual.weightKg as number, a.actual.reps))[0];
    if (bestSet && bestSet.actual.weightKg !== null) {
      estimatedOneRepMax[exerciseId] = estimateOneRepMax(bestSet.actual.weightKg, bestSet.actual.reps);
    }

    updatedExerciseById.set(exerciseId, result.exercise);
  }

  const days = program.days.map((day) => ({
    ...day,
    exercises: day.exercises.map((exercise) => updatedExerciseById.get(exercise.exerciseId) ?? exercise),
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
