import type { Equipment, Exercise, Experience } from '../types';

// Exercise instructions in the bundled dataset are English, but the injuries field on the
// onboarding screen asks for Russian ("например: колено, поясница"), so a real user's keywords
// never matched anything and the exclusion silently did nothing. Translate the common injury sites
// into the English terms that actually appear in the instructions. The user's original keyword is
// kept alongside the translation, since some entries do carry partial Latin/English terms.
const INJURY_KEYWORDS_RU_TO_EN: Record<string, string[]> = {
  колено: ['knee'],
  поясница: ['lower back', 'lumbar'],
  спина: ['back'],
  плечо: ['shoulder', 'deltoid'],
  локоть: ['elbow'],
  запястье: ['wrist'],
  шея: ['neck'],
  бедро: ['hip', 'thigh'],
  голеностоп: ['ankle'],
  грудь: ['chest'],
  пресс: ['abdominal', 'core'],
  голень: ['calf', 'shin'],
};

const LEVEL_RANK: Record<Experience, number> = { beginner: 0, intermediate: 1, advanced: 2 };

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// Users type any inflected form — "колено", "колени", "колен" — so match on a shared stem rather
// than exact equality. Requiring 4 shared leading characters (or the whole of the shorter word,
// for genuinely short terms like "шея") is enough to separate "спина" from "спорт".
function translateKeyword(keyword: string): string[] {
  if (keyword.length < 3) return [];
  const translations: string[] = [];
  for (const [ru, en] of Object.entries(INJURY_KEYWORDS_RU_TO_EN)) {
    const required = Math.min(4, ru.length, keyword.length);
    if (commonPrefixLength(ru, keyword) >= required) translations.push(...en);
  }
  return translations;
}

/** Exported for tests and for callers that want to show the user what was actually excluded. */
export function expandExcludeKeywords(keywords: string[]): string[] {
  const expanded = new Set<string>();
  for (const raw of keywords) {
    const keyword = raw.trim().toLowerCase();
    if (!keyword) continue;
    expanded.add(keyword);
    for (const translation of translateKeyword(keyword)) expanded.add(translation);
  }
  return [...expanded];
}

export interface FilterOptions {
  equipment: Equipment;
  excludeKeywords?: string[];
  /** Highest exercise level the user should be shown. Omitted means no level filtering. */
  maxLevel?: Experience;
}

export function filterExercises(exercises: Exercise[], opts: FilterOptions): Exercise[] {
  const keywords = expandExcludeKeywords(opts.excludeKeywords ?? []);
  const maxRank = opts.maxLevel ? LEVEL_RANK[opts.maxLevel] : null;

  return exercises.filter((exercise) => {
    if (!exercise.equipmentTiers.includes(opts.equipment)) return false;
    if (maxRank !== null && LEVEL_RANK[exercise.level] > maxRank) return false;
    if (keywords.length === 0) return true;

    const haystack = exercise.instructions.join(' ').toLowerCase();
    return !keywords.some((keyword) => haystack.includes(keyword));
  });
}
