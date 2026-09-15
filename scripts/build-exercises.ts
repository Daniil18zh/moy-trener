import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeExercise, type RawExercise } from './exerciseMapping';
import { renderMuscleDiagram } from './generateMuscleDiagram';

const __dirname = dirname(fileURLToPath(import.meta.url));

// We only need free-exercise-db's metadata, not its ~200MB of exercise photos, so this fetches the
// single dist/exercises.json over plain HTTPS instead of shallow-cloning the whole repo. The photos
// are gone for good: every exercise image in the app is now a diagram generated locally by
// renderMuscleDiagram(), which keeps the repo small and the asset licensing unambiguous.
const SOURCE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

const PUBLIC_DATA_DIR = join(__dirname, '..', 'public', 'data');
const PUBLIC_EXERCISES_DIR = join(__dirname, '..', 'public', 'exercises');

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

  mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
  // Wiped and rebuilt from scratch: the directory previously held one subfolder of photos per
  // exercise, and a plain overwrite would leave all of those (plus diagrams for exercises the
  // upstream dataset has since dropped) lying around forever.
  rmSync(PUBLIC_EXERCISES_DIR, { recursive: true, force: true });
  mkdirSync(PUBLIC_EXERCISES_DIR, { recursive: true });

  const kept = [];
  let withRuInstructions = 0;
  for (const raw of rawExercises) {
    const normalized = normalizeExercise(raw, ruDict, ruInstructions);
    if (!normalized) continue;
    // Upstream ids become both a filename and a URL path segment. They have always been plain
    // slugs, but they come from a third-party dataset we re-fetch on every build, so refuse
    // anything that could escape public/exercises/ or need URL-encoding rather than silently
    // writing it somewhere unexpected.
    if (!/^[A-Za-z0-9_.-]+$/.test(raw.id) || raw.id.startsWith('.')) {
      throw new Error(`Unsafe exercise id in upstream dataset: ${JSON.stringify(raw.id)}`);
    }
    kept.push(normalized);
    if (normalized.instructionsRu) withRuInstructions++;

    const svg = renderMuscleDiagram(normalized.muscleGroup, normalized.secondaryMuscleGroups);
    writeFileSync(join(PUBLIC_EXERCISES_DIR, `${raw.id}.svg`), svg, 'utf-8');
  }

  writeFileSync(join(PUBLIC_DATA_DIR, 'exercises.json'), JSON.stringify(kept, null, 2));
  console.log(`Wrote ${kept.length} exercises (of ${rawExercises.length} total in dataset) to public/data/exercises.json`);
  console.log(`Wrote ${kept.length} muscle diagrams to public/exercises/<id>.svg`);
  console.log(`${withRuInstructions} of ${kept.length} exercises have a curated Russian instruction`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
