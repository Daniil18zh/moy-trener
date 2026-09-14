import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { normalizeExercise, type RawExercise } from './exerciseMapping';

const __dirname = dirname(fileURLToPath(import.meta.url));

const VENDOR_DIR = join(__dirname, '..', 'vendor', 'free-exercise-db');
const PUBLIC_DATA_DIR = join(__dirname, '..', 'public', 'data');
const PUBLIC_EXERCISES_DIR = join(__dirname, '..', 'public', 'exercises');

function ensureVendorRepo(): void {
  if (existsSync(VENDOR_DIR)) return;
  console.log('Cloning free-exercise-db...');
  mkdirSync(dirname(VENDOR_DIR), { recursive: true });
  execSync(`git clone --depth 1 https://github.com/yuhonas/free-exercise-db.git "${VENDOR_DIR}"`, { stdio: 'inherit' });
}

function main(): void {
  ensureVendorRepo();

  const rawExercises: RawExercise[] = JSON.parse(
    readFileSync(join(VENDOR_DIR, 'dist', 'exercises.json'), 'utf-8'),
  );
  const ruDict: Record<string, string> = JSON.parse(readFileSync(join(__dirname, 'ru-dict.json'), 'utf-8'));

  mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
  mkdirSync(PUBLIC_EXERCISES_DIR, { recursive: true });

  const kept = [];
  for (const raw of rawExercises) {
    const normalized = normalizeExercise(raw, ruDict);
    if (!normalized) continue;
    kept.push(normalized);

    const destDir = join(PUBLIC_EXERCISES_DIR, raw.id);
    mkdirSync(destDir, { recursive: true });
    for (const imagePath of raw.images) {
      const src = join(VENDOR_DIR, 'exercises', imagePath);
      const fileName = imagePath.split('/').pop() as string;
      if (existsSync(src)) {
        copyFileSync(src, join(destDir, fileName));
      }
    }
  }

  writeFileSync(join(PUBLIC_DATA_DIR, 'exercises.json'), JSON.stringify(kept, null, 2));
  console.log(`Wrote ${kept.length} exercises (of ${rawExercises.length} total in dataset) to public/data/exercises.json`);
}

main();
