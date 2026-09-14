export type Goal = 'mass' | 'fatloss' | 'strength' | 'fitness' | 'maintenance';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Equipment = 'full_gym' | 'home_dumbbells' | 'bodyweight';
export type Split = 'fullbody' | 'upper_lower' | 'ppl';
export type ProgressionPhase = 'linear' | 'double_progression';
export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core';

export interface Auth {
  login: string;
  passwordHash: string; // SHA-256 hex
}

export interface Profile {
  age?: number;
  sex?: 'male' | 'female';
  heightCm: number;
  weightKg: number;
  measurements?: { waist?: number; chest?: number; hips?: number; biceps?: number; thigh?: number };
  goal: Goal;
  experience: Experience;
  daysPerWeek: number; // 2-6
  sessionDurationMin: number;
  equipment: Equipment;
  preferredStartTimes: Record<string, string>; // "monday" -> "18:00", used by Phase 2 schedule
  injuries?: string;
}

export interface Exercise {
  id: string;
  nameRu: string;
  nameEn: string;
  muscleGroup: MuscleGroup;
  secondaryMuscleGroups: MuscleGroup[];
  equipmentTiers: Equipment[]; // which of our 3 tiers can perform it
  mechanic: 'compound' | 'isolation';
  level: Experience;
  instructions: string[];
  images: string[]; // paths under /exercises/<id>/N.jpg
}

export interface ProgramExercise {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  targetWeightKg: number | null; // null = bodyweight / not yet established
  restSec: number;
  lastChangeReason?: string;
}

export interface ProgramDay {
  dayIndex: number;
  template: 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs';
  exercises: ProgramExercise[];
}

export interface ExerciseProgress {
  phase: ProgressionPhase;
  consecutiveFailures: number;
  weeksWithoutIncrease: number;
}

export interface Program {
  split: Split;
  days: ProgramDay[];
  currentWeek: number;
  progressByExercise: Record<string, ExerciseProgress>;
  estimatedOneRepMax: Record<string, number>;
  consecutiveGoodWeeks: number;
}

export interface SetLogEntry {
  planned: { weightKg: number | null; reps: number };
  actual: { weightKg: number | null; reps: number };
  done: boolean;
}

export interface WorkoutLog {
  date: string; // ISO date
  dayIndex: number;
  exercises: { exerciseId: string; sets: SetLogEntry[] }[];
  durationMin: number;
  totalTonnageKg: number;
}

export interface Settings {
  units: 'metric' | 'imperial';
}

export interface AppState {
  auth: Auth | null;
  profile: Profile | null;
  program: Program | null;
  exerciseLog: WorkoutLog[];
  settings: Settings;
}
