import type { Exercise, Equipment, MuscleGroup, Experience } from '../src/types';

export interface RawExercise {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

const MUSCLE_MAP: Record<string, MuscleGroup | null> = {
  chest: 'chest',
  lats: 'back', 'middle back': 'back', 'lower back': 'back', traps: 'back',
  quadriceps: 'legs', hamstrings: 'legs', calves: 'legs', glutes: 'legs', adductors: 'legs', abductors: 'legs',
  shoulders: 'shoulders',
  biceps: 'arms', triceps: 'arms', forearms: 'arms',
  abdominals: 'core',
  neck: null,
};

const EQUIPMENT_TIERS: Record<string, Equipment[]> = {
  'body only': ['bodyweight', 'home_dumbbells', 'full_gym'],
  dumbbell: ['home_dumbbells', 'full_gym'],
  kettlebells: ['home_dumbbells', 'full_gym'],
  bands: ['home_dumbbells', 'full_gym'],
  'exercise ball': ['home_dumbbells', 'full_gym'],
  'medicine ball': ['home_dumbbells', 'full_gym'],
  'foam roll': ['home_dumbbells', 'full_gym'],
  barbell: ['full_gym'],
  cable: ['full_gym'],
  machine: ['full_gym'],
  'e-z curl bar': ['full_gym'],
};

const USABLE_CATEGORIES = new Set(['strength', 'powerlifting', 'olympic weightlifting']);
const VALID_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);

export function mapMuscleGroup(raw: string): MuscleGroup | null {
  return MUSCLE_MAP[raw] ?? null;
}

export function mapEquipmentTiers(raw: string | null): Equipment[] {
  if (!raw) return [];
  return EQUIPMENT_TIERS[raw] ?? [];
}

export function mapMechanic(raw: string | null): 'compound' | 'isolation' {
  return raw === 'compound' ? 'compound' : 'isolation';
}

export function isUsableCategory(category: string): boolean {
  return USABLE_CATEGORIES.has(category);
}

function mapLevel(raw: string): Experience {
  // dataset uses "expert" where our app uses "advanced"
  if (raw === 'expert') return 'advanced';
  return VALID_LEVELS.has(raw) ? (raw as Experience) : 'beginner';
}

export function normalizeExercise(raw: RawExercise, ruDict: Record<string, string>): Exercise | null {
  if (!isUsableCategory(raw.category)) return null;

  const muscleGroup = mapMuscleGroup(raw.primaryMuscles[0] ?? '');
  if (!muscleGroup) return null;

  const equipmentTiers = mapEquipmentTiers(raw.equipment);
  if (equipmentTiers.length === 0) return null;

  const secondaryMuscleGroups = raw.secondaryMuscles
    .map(mapMuscleGroup)
    .filter((m): m is MuscleGroup => m !== null);

  return {
    id: raw.id,
    nameRu: ruDict[raw.id] ?? raw.name,
    nameEn: raw.name,
    muscleGroup,
    secondaryMuscleGroups,
    equipmentTiers,
    mechanic: mapMechanic(raw.mechanic),
    level: mapLevel(raw.level),
    instructions: raw.instructions,
    images: raw.images,
  };
}
