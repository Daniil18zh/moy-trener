import { describe, expect, it } from 'vitest';
import { pickExercisesForDay } from './exercisePicker';
import type { Exercise } from '../types';

function makeExercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: 'x', nameRu: 'X', nameEn: 'X', muscleGroup: 'chest', secondaryMuscleGroups: [],
    equipmentTiers: ['full_gym'], mechanic: 'compound', level: 'beginner',
    instructions: [], ...overrides,
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
      timeBudgetMin: 120,
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

  it('never assigns a beginner an exercise above their level', () => {
    const mixedPool: Exercise[] = [
      makeExercise({ id: 'adv-bench', muscleGroup: 'chest', mechanic: 'compound', level: 'advanced' }),
      makeExercise({ id: 'beg-bench', muscleGroup: 'chest', mechanic: 'compound', level: 'beginner' }),
      makeExercise({ id: 'int-flye', muscleGroup: 'chest', mechanic: 'isolation', level: 'intermediate' }),
      makeExercise({ id: 'beg-flye', muscleGroup: 'chest', mechanic: 'isolation', level: 'beginner' }),
    ];

    const beginnerResult = pickExercisesForDay(mixedPool, {
      targetMuscles: ['chest'], equipment: 'full_gym', timeBudgetMin: 120, goal: 'mass', experience: 'beginner',
    });
    const beginnerLevels = beginnerResult.map((r) => mixedPool.find((e) => e.id === r.exerciseId)!.level);
    expect(beginnerLevels.every((l) => l === 'beginner')).toBe(true);
    // Level filtering must not starve the day — the beginner-level alternatives are still picked.
    expect(beginnerResult.map((r) => r.exerciseId).sort()).toEqual(['beg-bench', 'beg-flye']);

    const advancedResult = pickExercisesForDay(mixedPool, {
      targetMuscles: ['chest'], equipment: 'full_gym', timeBudgetMin: 120, goal: 'mass', experience: 'advanced',
    });
    expect(advancedResult.map((r) => r.exerciseId)).toContain('adv-bench');
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

  it('rotates between candidates by dayIndex when the dataset offers real alternatives', () => {
    const variedPool: Exercise[] = [
      makeExercise({ id: 'bench', muscleGroup: 'chest', mechanic: 'compound' }),
      makeExercise({ id: 'incline-press', muscleGroup: 'chest', mechanic: 'compound' }),
      makeExercise({ id: 'flye', muscleGroup: 'chest', mechanic: 'isolation' }),
      makeExercise({ id: 'cable-crossover', muscleGroup: 'chest', mechanic: 'isolation' }),
    ];

    const pickedChestCompoundIds = [0, 1, 2].map((dayIndex) => {
      const result = pickExercisesForDay(variedPool, {
        targetMuscles: ['chest'],
        equipment: 'full_gym',
        timeBudgetMin: 120,
        goal: 'mass',
        experience: 'beginner',
        dayIndex,
      });
      return result.find((r) => r.exerciseId === 'bench' || r.exerciseId === 'incline-press')!.exerciseId;
    });

    expect(new Set(pickedChestCompoundIds).size).toBeGreaterThan(1);
  });

  it('always picks the same exercise regardless of dayIndex when only one candidate matches a slot', () => {
    const singleCandidatePool: Exercise[] = [
      makeExercise({ id: 'bench', muscleGroup: 'chest', mechanic: 'compound' }),
    ];

    for (const dayIndex of [0, 1, 2, 5, 100]) {
      const result = pickExercisesForDay(singleCandidatePool, {
        targetMuscles: ['chest'],
        equipment: 'full_gym',
        timeBudgetMin: 120,
        goal: 'mass',
        experience: 'beginner',
        dayIndex,
      });
      expect(result.map((r) => r.exerciseId)).toEqual(['bench']);
    }
  });
});
