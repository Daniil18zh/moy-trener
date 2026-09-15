import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeExercise, type RawExercise } from './exerciseMapping';

const __dirname = dirname(fileURLToPath(import.meta.url));

// We only need free-exercise-db's metadata, not its ~200MB of exercise photos, so this fetches the
// single dist/exercises.json over plain HTTPS instead of shallow-cloning the whole repo. The photos
// are gone for good: the app's exercise illustration is a muscle diagram the browser renders at
// runtime from the exercise's own muscleGroup/secondaryMuscleGroups (see
// src/exercises/muscleDiagram.ts), so this script produces exactly one artifact — the JSON.
const SOURCE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

const PUBLIC_DATA_DIR = join(__dirname, '..', 'public', 'data');

async function fetchRawExercises(): Promise<RawExercise[]> {
  console.log(`Fetching exercise metadata from ${SOURCE_URL} ...`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch exercise metadata: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as RawExercise[];
}

async function main(): Promise<void> {
  const rawExercises = await fetchRawExercises();
  const ruDict: Record<string, string> = JSON.parse(readFileSync(join(__dirname, 'ru-dict.json'), 'utf-8'));
  const ruInstructions: Record<string, string> = JSON.parse(
    readFileSync(join(__dirname, 'ru-instructions.json'), 'utf-8'),
  );

  const kept = [];
  let withRuInstructions = 0;
  for (const raw of rawExercises) {
    const normalized = normalizeExercise(raw, ruDict, ruInstructions);
    if (!normalized) continue;
    kept.push(normalized);
    if (normalized.instructionsRu) withRuInstructions++;
  }

  // Nothing is written until the whole dataset has been normalized, and exercises.json is the only
  // output, so a mid-loop failure leaves the previous build fully intact rather than half-replaced.
  mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
  writeFileSync(join(PUBLIC_DATA_DIR, 'exercises.json'), JSON.stringify(kept, null, 2));
  console.log(`Wrote ${kept.length} exercises (of ${rawExercises.length} total in dataset) to public/data/exercises.json`);
  console.log(`${withRuInstructions} of ${kept.length} exercises have a curated Russian instruction`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
