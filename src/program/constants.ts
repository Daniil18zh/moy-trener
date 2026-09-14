import type { Goal } from '../types';

export const SET_EXEC_SEC = 45; // время выполнения одного рабочего подхода
export const TRANSITION_SEC = 90; // переход между станциями/упражнениями

export const REST_SEC_BY_GOAL: Record<Goal, number> = {
  strength: 150,
  mass: 90,
  fitness: 75,
  fatloss: 45,
  maintenance: 90,
};

export interface RepScheme {
  setsMin: number;
  setsMax: number;
  repsMin: number;
  repsMax: number;
}

// Numbers for strength/mass/fatloss come directly from spec §5.3.
// fitness/maintenance are not specified numerically there; both reuse a
// moderate general-fitness scheme (YAGNI — no product requirement yet
// distinguishes them further).
export const REP_SCHEME_BY_GOAL: Record<Goal, RepScheme> = {
  strength: { setsMin: 3, setsMax: 5, repsMin: 3, repsMax: 6 },
  mass: { setsMin: 2, setsMax: 4, repsMin: 6, repsMax: 12 },
  fitness: { setsMin: 3, setsMax: 4, repsMin: 8, repsMax: 12 },
  fatloss: { setsMin: 2, setsMax: 3, repsMin: 12, repsMax: 20 },
  maintenance: { setsMin: 3, setsMax: 4, repsMin: 8, repsMax: 12 },
};
