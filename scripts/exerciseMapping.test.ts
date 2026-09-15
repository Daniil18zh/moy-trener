import { describe, expect, it } from 'vitest';
import { mapMuscleGroup, mapEquipmentTiers, mapMechanic, isUsableCategory, normalizeExercise } from './exerciseMapping';

describe('exerciseMapping', () => {
  it('maps muscle names to our 6 groups, and neck to null', () => {
    expect(mapMuscleGroup('lats')).toBe('back');
    expect(mapMuscleGroup('quadriceps')).toBe('legs');
    expect(mapMuscleGroup('abdominals')).toBe('core');
    expect(mapMuscleGroup('neck')).toBeNull();
  });

  it('maps raw equipment to our 3 tiers', () => {
    expect(mapEquipmentTiers('body only')).toEqual(['bodyweight', 'home_dumbbells', 'full_gym']);
    expect(mapEquipmentTiers('dumbbell')).toEqual(['home_dumbbells', 'full_gym']);
    expect(mapEquipmentTiers('barbell')).toEqual(['full_gym']);
    expect(mapEquipmentTiers(null)).toEqual([]);
    expect(mapEquipmentTiers('other')).toEqual([]);
  });

  it('maps mechanic, defaulting null to isolation', () => {
    expect(mapMechanic('compound')).toBe('compound');
    expect(mapMechanic('isolation')).toBe('isolation');
    expect(mapMechanic(null)).toBe('isolation');
  });

  it('accepts strength/powerlifting/olympic weightlifting categories only', () => {
    expect(isUsableCategory('strength')).toBe(true);
    expect(isUsableCategory('powerlifting')).toBe(true);
    expect(isUsableCategory('olympic weightlifting')).toBe(true);
    expect(isUsableCategory('cardio')).toBe(false);
    expect(isUsableCategory('stretching')).toBe(false);
    expect(isUsableCategory('plyometrics')).toBe(false);
    expect(isUsableCategory('strongman')).toBe(false);
  });

  it('normalizes a real dataset entry, applying the Russian dictionary', () => {
    const raw = {
      id: '3_4_Sit-Up',
      name: '3/4 Sit-Up',
      force: 'pull',
      level: 'beginner' as const,
      mechanic: null,
      equipment: 'body only',
      primaryMuscles: ['abdominals'],
      secondaryMuscles: [],
      instructions: ['Lie down.', 'Sit up.'],
      category: 'strength',
    };
    const result = normalizeExercise(
      raw,
      { '3_4_Sit-Up': 'Скручивания на 3/4' },
      { '3_4_Sit-Up': 'Лягте и поднимитесь.' },
    );
    expect(result).toEqual({
      id: '3_4_Sit-Up',
      nameRu: 'Скручивания на 3/4',
      nameEn: '3/4 Sit-Up',
      muscleGroup: 'core',
      secondaryMuscleGroups: [],
      equipmentTiers: ['bodyweight', 'home_dumbbells', 'full_gym'],
      mechanic: 'isolation',
      level: 'beginner',
      instructions: ['Lie down.', 'Sit up.'],
      instructionsRu: 'Лягте и поднимитесь.',
      diagramPath: '/exercises/3_4_Sit-Up.svg',
    });
  });

  it('omits instructionsRu entirely when no curated Russian cue exists', () => {
    const raw = {
      id: 'Some_Exercise', name: 'Some Exercise', force: null, level: 'beginner' as const,
      mechanic: 'compound', equipment: 'barbell', primaryMuscles: ['chest'], secondaryMuscles: ['triceps'],
      instructions: ['Do it.'], category: 'strength',
    };
    const result = normalizeExercise(raw, {}, { Other_Exercise: 'Не про это упражнение.' });
    expect(result?.instructionsRu).toBeUndefined();
    expect(Object.hasOwn(result!, 'instructionsRu')).toBe(false);
    // The diagram path is derived from the id, never from the (now removed) upstream image list.
    expect(result?.diagramPath).toBe('/exercises/Some_Exercise.svg');
    expect(result?.secondaryMuscleGroups).toEqual(['arms']);
  });

  it('falls back to the English name when no translation exists', () => {
    const raw = {
      id: 'Some_Exercise', name: 'Some Exercise', force: null, level: 'beginner' as const,
      mechanic: 'compound', equipment: 'barbell', primaryMuscles: ['chest'], secondaryMuscles: [],
      instructions: ['Do it.'], category: 'strength',
    };
    expect(normalizeExercise(raw, {})?.nameRu).toBe('Some Exercise');
  });

  it('returns null for unusable categories or unmappable primary muscle', () => {
    const cardio = { id: 'x', name: 'X', force: null, level: 'beginner' as const, mechanic: null, equipment: 'body only', primaryMuscles: ['abdominals'], secondaryMuscles: [], instructions: [], category: 'cardio' };
    expect(normalizeExercise(cardio, {})).toBeNull();

    const neck = { id: 'y', name: 'Y', force: null, level: 'beginner' as const, mechanic: null, equipment: 'body only', primaryMuscles: ['neck'], secondaryMuscles: [], instructions: [], category: 'strength' };
    expect(normalizeExercise(neck, {})).toBeNull();

    const noEquipmentTier = { id: 'z', name: 'Z', force: null, level: 'beginner' as const, mechanic: null, equipment: 'other', primaryMuscles: ['chest'], secondaryMuscles: [], instructions: [], category: 'strength' };
    expect(normalizeExercise(noEquipmentTier, {})).toBeNull();
  });
});
