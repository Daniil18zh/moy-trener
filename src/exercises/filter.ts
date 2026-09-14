import type { Equipment, Exercise } from '../types';

export interface FilterOptions {
  equipment: Equipment;
  excludeKeywords?: string[];
}

export function filterExercises(exercises: Exercise[], opts: FilterOptions): Exercise[] {
  const keywords = (opts.excludeKeywords ?? []).map((k) => k.toLowerCase()).filter(Boolean);

  return exercises.filter((exercise) => {
    if (!exercise.equipmentTiers.includes(opts.equipment)) return false;
    if (keywords.length === 0) return true;

    const haystack = exercise.instructions.join(' ').toLowerCase();
    return !keywords.some((keyword) => haystack.includes(keyword));
  });
}
