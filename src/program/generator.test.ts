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
