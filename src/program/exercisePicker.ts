import type { Equipment, Exercise, Experience, Goal, MuscleGroup, ProgramExercise } from '../types';
import { filterExercises } from '../exercises/filter';
import { REP_SCHEME_BY_GOAL, REST_SEC_BY_GOAL, SET_EXEC_SEC, TRANSITION_SEC } from './constants';

export interface PickOptions {
  targetMuscles: MuscleGroup[];
  equipment: Equipment;
  timeBudgetMin: number;
  goal: Goal;
  experience: Experience;
  excludeKeywords?: string[];
}

function exerciseTimeMin(sets: number, restSec: number): number {
  return (sets * (SET_EXEC_SEC + restSec) + TRANSITION_SEC) / 60;
}

export function pickExercisesForDay(exercises: Exercise[], opts: PickOptions): ProgramExercise[] {
  const scheme = REP_SCHEME_BY_GOAL[opts.goal];
  const restSec = REST_SEC_BY_GOAL[opts.goal];
  const isolationSlotsPerMuscle = opts.experience === 'advanced' ? 2 : 1;

  // maxLevel keeps a beginner out of advanced-level exercises: they see beginner movements only,
  // an intermediate sees beginner + intermediate, an advanced user sees everything.
  const pool = filterExercises(exercises, {
    equipment: opts.equipment,
    excludeKeywords: opts.excludeKeywords,
    maxLevel: opts.experience,
  });

  // Build a priority-ordered candidate list: pass 1 = one compound per muscle,
  // pass 2 = a second compound if available, then isolation slots. This keeps
  // muscle-group coverage first, extra volume second.
  const candidates: Exercise[] = [];
  const usedIds = new Set<string>();

  function takeOne(muscle: MuscleGroup, mechanic: 'compound' | 'isolation'): Exercise | null {
    const found = pool.find((e) => e.muscleGroup === muscle && e.mechanic === mechanic && !usedIds.has(e.id));
    if (found) usedIds.add(found.id);
    return found ?? null;
  }

  for (const muscle of opts.targetMuscles) {
    const compound = takeOne(muscle, 'compound');
    if (compound) candidates.push(compound);
  }
  for (const muscle of opts.targetMuscles) {
    const secondCompound = takeOne(muscle, 'compound');
    if (secondCompound) candidates.push(secondCompound);
  }
  for (let slot = 0; slot < isolationSlotsPerMuscle; slot++) {
    for (const muscle of opts.targetMuscles) {
      const isolation = takeOne(muscle, 'isolation');
      if (isolation) candidates.push(isolation);
    }
  }

  const picked: ProgramExercise[] = [];
  let runningMin = 0;

  for (const candidate of candidates) {
    const sets = candidate.mechanic === 'compound' ? scheme.setsMax : scheme.setsMin;
    const cost = exerciseTimeMin(sets, restSec);
    if (runningMin + cost > opts.timeBudgetMin) continue;
    runningMin += cost;
    picked.push({
      exerciseId: candidate.id,
      sets,
      repsMin: scheme.repsMin,
      repsMax: scheme.repsMax,
      targetWeightKg: null,
      restSec,
    });
  }

  return picked;
}
