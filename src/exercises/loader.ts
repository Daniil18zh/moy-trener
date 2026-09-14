import type { Exercise } from '../types';

let cache: Exercise[] | null = null;

export async function loadExercises(): Promise<Exercise[]> {
  if (cache) return cache;
  // BASE_URL is "/" in dev and "/<repo>/" on GitHub Pages (set via VITE_BASE_PATH at build time);
  // it always ends in a slash, so this never produces a double slash.
  const response = await fetch(`${import.meta.env.BASE_URL}data/exercises.json`);
  if (!response.ok) throw new Error(`Failed to load exercises: ${response.status}`);
  cache = (await response.json()) as Exercise[];
  return cache;
}
