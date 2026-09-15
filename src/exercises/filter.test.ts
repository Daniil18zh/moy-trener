import { describe, expect, it } from 'vitest';
import { filterExercises } from './filter';
import type { Exercise } from '../types';

function makeExercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: 'x', nameRu: 'X', nameEn: 'X', muscleGroup: 'chest', secondaryMuscleGroups: [],
    equipmentTiers: ['full_gym'], mechanic: 'compound', level: 'beginner',
    instructions: [], diagramPath: '/exercises/x.svg', ...overrides,
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
    const resultEn = filterExercises(all, { equipment: 'full_gym', excludeKeywords: ['knee'] });
    expect(resultEn.map((e) => e.id)).not.toContain('legext');
  });

  it('translates Russian injury keywords to the English terms the instructions actually use', () => {
    // The onboarding placeholder asks for Russian ("например: колено, поясница"), so Russian input
    // must exclude the matching English-instruction exercises rather than silently no-op.
    for (const keyword of ['колено', 'колен', 'Колени']) {
      const result = filterExercises(all, { equipment: 'full_gym', excludeKeywords: [keyword] });
      expect(result.map((e) => e.id)).not.toContain('legext');
    }
  });

  it('keeps the untranslated keyword too, so English input still works', () => {
    const result = filterExercises(all, { equipment: 'full_gym', excludeKeywords: ['knee', 'колено'] });
    expect(result.map((e) => e.id)).not.toContain('legext');
    expect(result.map((e) => e.id)).toContain('bench');
  });

  it('does not exclude anything for an unrelated keyword', () => {
    const result = filterExercises(all, { equipment: 'full_gym', excludeKeywords: ['мигрень'] });
    expect(result.map((e) => e.id).sort()).toEqual(['bench', 'legext', 'pushup']);
  });
});

describe('filterExercises — maxLevel', () => {
  const beginnerEx = makeExercise({ id: 'beg', level: 'beginner' });
  const intermediateEx = makeExercise({ id: 'int', level: 'intermediate' });
  const advancedEx = makeExercise({ id: 'adv', level: 'advanced' });
  const byLevel = [beginnerEx, intermediateEx, advancedEx];

  it('shows a beginner only beginner-level exercises', () => {
    const result = filterExercises(byLevel, { equipment: 'full_gym', maxLevel: 'beginner' });
    expect(result.map((e) => e.id)).toEqual(['beg']);
  });

  it('shows an intermediate beginner and intermediate exercises', () => {
    const result = filterExercises(byLevel, { equipment: 'full_gym', maxLevel: 'intermediate' });
    expect(result.map((e) => e.id)).toEqual(['beg', 'int']);
  });

  it('shows an advanced user everything', () => {
    const result = filterExercises(byLevel, { equipment: 'full_gym', maxLevel: 'advanced' });
    expect(result.map((e) => e.id)).toEqual(['beg', 'int', 'adv']);
  });

  it('applies no level filtering when maxLevel is omitted', () => {
    const result = filterExercises(byLevel, { equipment: 'full_gym' });
    expect(result).toHaveLength(3);
  });
});
