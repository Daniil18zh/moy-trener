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

  it('applies the identical, correctly-computed update to every day sharing the same exercise', () => {
    const program = generateInitialProgram(profile, exercises);
    // Fullbody at 3 days/week repeats the same template on every day, so 'bench' appears on
    // all 3 days with identical starting data. Give it a real weight on every occurrence, as
    // the workout screen would.
    const daysWithBenchAt40 = program.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.exerciseId === 'bench' ? { ...e, targetWeightKg: 40 } : e)),
    }));
    program.days = daysWithBenchAt40;
    expect(program.days.filter((d) => d.exercises.some((e) => e.exerciseId === 'bench'))).toHaveLength(3);

    // The user trains bench in all 3 sessions this week — one WorkoutLog per day.
    const successfulSets = [
      { planned: { weightKg: 40, reps: 6 }, actual: { weightKg: 40, reps: 8 }, done: true },
      { planned: { weightKg: 40, reps: 6 }, actual: { weightKg: 40, reps: 8 }, done: true },
      { planned: { weightKg: 40, reps: 6 }, actual: { weightKg: 40, reps: 8 }, done: true },
    ];
    const logs: WorkoutLog[] = [0, 1, 2].map((dayIndex) => ({
      date: '2026-01-0' + (dayIndex + 1),
      dayIndex,
      exercises: [{ exerciseId: 'bench', sets: successfulSets }],
      durationMin: 45,
      totalTonnageKg: 960,
    }));

    const { program: updated } = advanceWeek(program, profile, logs);
    const benchCopies = updated.days.map((d) => d.exercises.find((e) => e.exerciseId === 'bench')!);
    expect(benchCopies).toHaveLength(3);
    // Every day's copy of 'bench' must show the identical, single-step update — not one
    // increase per day-occurrence.
    for (const copy of benchCopies) {
      expect(copy).toEqual(benchCopies[0]);
    }
    expect(benchCopies[0].targetWeightKg).toBeGreaterThan(40);
    // A single successful week should not compound into repeated weight increases: at 5% per
    // step, 3 compounded increases from 40 would exceed 46; one increase stays under it.
    expect(benchCopies[0].targetWeightKg).toBeLessThan(46);
  });

  it('does not turn a single real failure into a two-consecutive-failure deload just because the exercise appears on multiple days', () => {
    const program = generateInitialProgram(profile, exercises);
    const daysWithBenchAt40 = program.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.exerciseId === 'bench' ? { ...e, targetWeightKg: 40 } : e)),
    }));
    program.days = daysWithBenchAt40;
    expect(program.days.filter((d) => d.exercises.some((e) => e.exerciseId === 'bench'))).toHaveLength(3);

    // A single real failure this week: reps fall short of repsMin (6) on every set, logged once
    // per session across the week's 3 fullbody days (as the workout screen would log it).
    const failedSets = [
      { planned: { weightKg: 40, reps: 6 }, actual: { weightKg: 40, reps: 4 }, done: true },
      { planned: { weightKg: 40, reps: 6 }, actual: { weightKg: 40, reps: 4 }, done: true },
      { planned: { weightKg: 40, reps: 6 }, actual: { weightKg: 40, reps: 4 }, done: true },
    ];
    const logs: WorkoutLog[] = [0, 1, 2].map((dayIndex) => ({
      date: '2026-01-0' + (dayIndex + 1),
      dayIndex,
      exercises: [{ exerciseId: 'bench', sets: failedSets }],
      durationMin: 45,
      totalTonnageKg: 480,
    }));

    const { program: updated } = advanceWeek(program, profile, logs);
    // One real failure recorded, not a two-in-a-row deload.
    expect(updated.progressByExercise['bench'].consecutiveFailures).toBe(1);
    const benchCopies = updated.days.map((d) => d.exercises.find((e) => e.exerciseId === 'bench')!);
    for (const copy of benchCopies) {
      expect(copy).toEqual(benchCopies[0]);
    }
    // No deload should have fired — weight must be unchanged.
    expect(benchCopies[0].targetWeightKg).toBe(40);
  });
});
