import type { MuscleGroup, Split } from '../types';

export type DayTemplate = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs';

export function pickSplit(daysPerWeek: number): Split {
  if (daysPerWeek < 2 || daysPerWeek > 6) {
    throw new Error(`daysPerWeek must be between 2 and 6, got ${daysPerWeek}`);
  }
  if (daysPerWeek <= 3) return 'fullbody';
  if (daysPerWeek === 4) return 'upper_lower';
  return 'ppl';
}

export function dayTemplatesForSplit(split: Split, daysPerWeek: number): DayTemplate[] {
  if (split === 'fullbody') {
    return Array.from({ length: daysPerWeek }, () => 'full');
  }
  if (split === 'upper_lower') {
    return Array.from({ length: daysPerWeek }, (_, i) => (i % 2 === 0 ? 'upper' : 'lower'));
  }
  const cycle: DayTemplate[] = ['push', 'pull', 'legs'];
  return Array.from({ length: daysPerWeek }, (_, i) => cycle[i % 3]);
}

export const MUSCLE_GROUPS_BY_TEMPLATE: Record<DayTemplate, MuscleGroup[]> = {
  full: ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'],
  upper: ['chest', 'back', 'shoulders', 'arms'],
  lower: ['legs', 'core'],
  push: ['chest', 'shoulders', 'arms'],
  pull: ['back', 'arms'],
  legs: ['legs', 'core'],
};
