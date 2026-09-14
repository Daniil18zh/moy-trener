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
