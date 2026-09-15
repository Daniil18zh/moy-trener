import { describe, expect, it } from 'vitest';
import { generateInitialProgram, advanceWeek } from './generator';
import type { Exercise, Profile, Program, WorkoutLog } from '../types';

function makeExercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: 'x', nameRu: 'X', nameEn: 'X', muscleGroup: 'chest', secondaryMuscleGroups: [],
    equipmentTiers: ['full_gym'], mechanic: 'compound', level: 'beginner',
    instructions: [], ...overrides,
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
      expect(program.progressByExercise[id]).toEqual({
        phase: 'linear', consecutiveFailures: 0, weeksWithoutIncrease: 0,
        preDeloadSets: null, preDeloadWeightKg: null,
      });
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

// Simulates a fully successful training week: every prescribed set of every exercise on every day
// completed at the prescribed weight and at the top of the rep range. `firstWeightById` supplies the
// weight the user types in for an exercise that has no target weight yet (i.e. week 1); an exercise
// absent from that map is logged with no weight at all, which is what a pure bodyweight exercise
// looks like in the log.
function simulateSuccessfulWeek(program: Program, firstWeightById: Record<string, number>): WorkoutLog[] {
  return program.days.map((day, dayIndex) => ({
    date: `2026-01-${String(dayIndex + 1).padStart(2, '0')}`,
    dayIndex,
    exercises: day.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      sets: Array.from({ length: ex.sets }, () => ({
        planned: { weightKg: ex.targetWeightKg, reps: ex.repsMax },
        actual: { weightKg: ex.targetWeightKg ?? firstWeightById[ex.exerciseId] ?? null, reps: ex.repsMax },
        done: true,
      })),
    })),
    durationMin: 45,
    totalTonnageKg: 0,
  }));
}

function benchOf(program: Program) {
  return program.days[0].exercises.find((e) => e.exerciseId === 'bench')!;
}

describe('advanceWeek — establishing a real working weight (regression)', () => {
  it('seeds targetWeightKg from the weight the user actually logged, then grows it week over week', () => {
    let program = generateInitialProgram(profile, exercises);
    // Everything starts with no established weight — that is all pickExercisesForDay can produce.
    expect(benchOf(program).targetWeightKg).toBeNull();

    // Week 1: the user enters a real 40 kg on every bench set.
    program = advanceWeek(program, profile, simulateSuccessfulWeek(program, { bench: 40 })).program;

    const afterWeek1 = benchOf(program).targetWeightKg;
    expect(afterWeek1).not.toBeNull();
    expect(typeof afterWeek1).toBe('number');
    // Seeded from the logged 40 kg and already progressed once for the successful week.
    expect(afterWeek1!).toBeGreaterThan(40);

    // Weeks 2 and 3: the user keeps hitting the prescription at whatever weight is prescribed.
    const weights = [afterWeek1!];
    for (let i = 0; i < 2; i++) {
      program = advanceWeek(program, profile, simulateSuccessfulWeek(program, {})).program;
      weights.push(benchOf(program).targetWeightKg!);
    }

    // Load genuinely grows, and the rep range stays inside the intended hypertrophy window
    // instead of ratcheting upward forever via the bodyweight branch.
    expect(weights[1]).toBeGreaterThan(weights[0]);
    expect(weights[2]).toBeGreaterThan(weights[1]);
    expect(benchOf(program).repsMin).toBe(6);
    expect(benchOf(program).repsMax).toBe(12);
  });

  it('leaves a genuinely bodyweight exercise (no weight ever logged) on rep-based progression', () => {
    let program = generateInitialProgram(profile, exercises);
    // 'crunch' is logged without any weight, week after week.
    program = advanceWeek(program, profile, simulateSuccessfulWeek(program, { bench: 40 })).program;

    const crunch = program.days[0].exercises.find((e) => e.exerciseId === 'crunch')!;
    expect(crunch.targetWeightKg).toBeNull();
    // Rep-based progression still applies to it.
    expect(crunch.repsMax).toBeGreaterThan(12);
  });
});

describe('advanceWeek — deload is temporary (regression)', () => {
  it('dips sets and weight on a deload week and restores them the next week, across two deload cycles', () => {
    let program = generateInitialProgram(profile, exercises);
    program = advanceWeek(program, profile, simulateSuccessfulWeek(program, { bench: 40 })).program;
    expect(program.currentWeek).toBe(2);

    const workingSets = benchOf(program).sets;
    expect(workingSets).toBeGreaterThan(1);

    // Deload prescriptions are produced by the advanceWeek run whose currentWeek is a multiple of
    // DELOAD_INTERVAL_WEEKS (6), i.e. the runs at week 6 and week 12.
    for (const deloadAtWeek of [6, 12]) {
      // Train normally up to (and including) the week before the deload run.
      while (program.currentWeek < deloadAtWeek) {
        program = advanceWeek(program, profile, simulateSuccessfulWeek(program, {})).program;
      }

      const beforeSets = benchOf(program).sets;
      const beforeWeight = benchOf(program).targetWeightKg!;
      expect(beforeSets).toBe(workingSets);

      // The deload run itself.
      program = advanceWeek(program, profile, simulateSuccessfulWeek(program, {})).program;
      const deloadedSets = benchOf(program).sets;
      const deloadedWeight = benchOf(program).targetWeightKg!;
      expect(deloadedSets).toBeLessThan(beforeSets);
      expect(deloadedWeight).toBeLessThan(beforeWeight);
      expect(program.progressByExercise['bench'].preDeloadSets).toBe(beforeSets);
      expect(program.progressByExercise['bench'].preDeloadWeightKg).toBe(beforeWeight);

      // The week right after the deload must restore the pre-deload baseline (and then progress
      // from it), not keep the reduced values and certainly not reduce them again.
      program = advanceWeek(program, profile, simulateSuccessfulWeek(program, {})).program;
      expect(benchOf(program).sets).toBe(beforeSets);
      expect(benchOf(program).targetWeightKg!).toBeGreaterThanOrEqual(beforeWeight);
      expect(program.progressByExercise['bench'].preDeloadSets).toBeNull();
      expect(program.progressByExercise['bench'].preDeloadWeightKg).toBeNull();
    }

    // After two full deload cycles the working set count is exactly where it started — no one-way
    // ratchet down (the bug: 4 -> 2 -> 1).
    expect(benchOf(program).sets).toBe(workingSets);
  });
});
