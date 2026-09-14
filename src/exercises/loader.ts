import type { Exercise } from '../types';

let cache: Exercise[] | null = null;

export async function loadExercises(): Promise<Exercise[]> {
  if (cache) return cache;
  const response = await fetch('/data/exercises.json');
  if (!response.ok) throw new Error(`Failed to load exercises: ${response.status}`);
  cache = (await response.json()) as Exercise[];
  return cache;
}
