import type { MuscleGroup } from '../types';

// ---------------------------------------------------------------------------
// Original, hand-authored schematic body diagram.
//
// This lives under src/ (not scripts/) because the browser bundle renders from
// it: the workout screen calls renderMuscleDiagram() and inlines the result.
// The diagram is a pure function of (muscleGroup, secondaryMuscleGroups), and
// the whole 598-exercise catalogue collapses to a few dozen distinct outputs —
// so writing one SVG file per exercise meant shipping ~4.4MB of byte-identical
// duplicates. Nothing is generated to disk at all now; the build script only
// emits exercises.json and does not import this module.
//
// Every coordinate below was written by hand for this app: no shape, path, or
// coordinate set is copied from, traced over, or extracted from any third-party
// image, icon set, or anatomy library. That keeps the generated assets free of
// licensing ambiguity — they are as MIT-clean as the rest of the repo.
//
// The figure is deliberately schematic: flat polygons, no anatomical detail. It
// only has to answer one question at a glance — "which muscles does this
// exercise hit?" — so the regions are big, blocky and unmistakable.
//
// Two figures side by side (front + back) because our MuscleGroup union
// includes `back`, which simply is not visible on a front view. Muscle groups
// that exist on both sides (shoulders, arms, legs) are highlighted on both
// figures so a highlight never looks like it was forgotten on one of them.
// ---------------------------------------------------------------------------

/** Fill for the exercise's primary muscle group. */
export const PRIMARY_COLOR = '#dc2626';
/** Fill for each of the exercise's secondary muscle groups. */
export const SECONDARY_COLOR = '#3b82f6';
/** Fill for every muscle region the exercise does not work. */
export const NEUTRAL_COLOR = '#d4d4d8';
/** Fill for non-muscle body parts (head, neck, hands, pelvis, feet). */
const BODY_COLOR = '#e4e4e7';
const OUTLINE_COLOR = '#52525b';

const VIEW_WIDTH = 240;
const VIEW_HEIGHT = 238;
/** Horizontal centre line of the front-view figure. */
const FRONT_CX = 62;
/** Horizontal centre line of the back-view figure. */
const BACK_CX = 178;

/**
 * A polygon expressed as [dx, y] pairs, where dx is the horizontal offset from
 * the figure's centre line. Storing offsets (rather than absolute x) is what
 * lets `mirrored()` produce the opposite limb from the same source shape, so
 * left and right can never drift out of symmetry.
 */
type OffsetPoints = readonly (readonly [number, number])[];

interface Region {
  /** null for non-muscle body parts, which are never highlighted. */
  muscle: MuscleGroup | null;
  points: OffsetPoints;
}

function mirrored(points: OffsetPoints): OffsetPoints {
  return points.map(([dx, y]) => [-dx, y] as const);
}

/** Both limbs of a symmetric pair, from one source shape. */
function pair(muscle: MuscleGroup | null, points: OffsetPoints): Region[] {
  return [
    { muscle, points },
    { muscle, points: mirrored(points) },
  ];
}

// --- Shared body parts (identical on both views) ----------------------------

const NECK: Region = {
  muscle: null,
  points: [
    [-5, 22],
    [5, 22],
    [6, 33],
    [-6, 33],
  ],
};

const PELVIS: Region = {
  muscle: null,
  points: [
    [-16, 91],
    [16, 91],
    [18, 106],
    [-18, 106],
  ],
};

const UPPER_ARM: OffsetPoints = [
  [-34, 47],
  [-23, 47],
  [-26, 74],
  [-36, 74],
];

const FOREARM: OffsetPoints = [
  [-36, 76],
  [-26, 76],
  [-28, 101],
  [-37, 101],
];

const HAND: OffsetPoints = [
  [-37, 103],
  [-28, 103],
  [-29, 112],
  [-36, 112],
];

const THIGH: OffsetPoints = [
  [-17, 108],
  [-2, 108],
  [-3, 146],
  [-16, 146],
];

const SHIN: OffsetPoints = [
  [-16, 148],
  [-4, 148],
  [-5, 180],
  [-15, 180],
];

const FOOT: OffsetPoints = [
  [-15, 182],
  [-5, 182],
  [-5, 189],
  [-18, 189],
];

const LIMBS: Region[] = [
  ...pair('arms', UPPER_ARM),
  ...pair('arms', FOREARM),
  ...pair(null, HAND),
  ...pair('legs', THIGH),
  ...pair('legs', SHIN),
  ...pair(null, FOOT),
];

// --- Front-view torso -------------------------------------------------------

/** Left pectoral; the right one is mirrored from it. */
const PEC: OffsetPoints = [
  [-21, 35],
  [-2, 35],
  [-2, 60],
  [-20, 58],
];

const ABDOMEN: Region = {
  muscle: 'core',
  points: [
    [-20, 62],
    [20, 62],
    [16, 89],
    [-16, 89],
  ],
};

const FRONT_REGIONS: Region[] = [NECK, ...pair('chest', PEC), ABDOMEN, PELVIS, ...LIMBS];

// --- Back-view torso --------------------------------------------------------
// Split into an upper slab (traps / rhomboids) and a lower one (lats / erectors)
// purely so the back reads as a back rather than as one undifferentiated box —
// both carry the same `back` muscle group and always highlight together.

const UPPER_BACK: Region = {
  muscle: 'back',
  points: [
    [-21, 35],
    [21, 35],
    [20, 60],
    [-20, 60],
  ],
};

const LOWER_BACK: Region = {
  muscle: 'back',
  points: [
    [-20, 62],
    [20, 62],
    [16, 89],
    [-16, 89],
  ],
};

const BACK_REGIONS: Region[] = [NECK, UPPER_BACK, LOWER_BACK, PELVIS, ...LIMBS];

// --- Rendering --------------------------------------------------------------

function fillFor(
  muscle: MuscleGroup | null,
  primaryMuscle: MuscleGroup,
  secondary: ReadonlySet<MuscleGroup>,
): string {
  if (muscle === null) return BODY_COLOR;
  if (muscle === primaryMuscle) return PRIMARY_COLOR;
  // Primary wins over secondary: a dataset entry that lists the same group in
  // both places must not end up blue.
  if (secondary.has(muscle)) return SECONDARY_COLOR;
  return NEUTRAL_COLOR;
}

function renderPolygon(region: Region, cx: number, fill: string): string {
  const points = region.points.map(([dx, y]) => `${cx + dx},${y}`).join(' ');
  const muscleAttr = region.muscle ? ` data-muscle="${region.muscle}"` : '';
  return `<polygon${muscleAttr} points="${points}" fill="${fill}" stroke="${OUTLINE_COLOR}" stroke-width="1" stroke-linejoin="round" />`;
}

function renderFigure(
  regions: Region[],
  cx: number,
  label: string,
  primaryMuscle: MuscleGroup,
  secondary: ReadonlySet<MuscleGroup>,
): string {
  const shoulderFill = fillFor('shoulders', primaryMuscle, secondary);
  const parts = [
    `<circle cx="${cx}" cy="13" r="10.5" fill="${BODY_COLOR}" stroke="${OUTLINE_COLOR}" stroke-width="1" />`,
    ...regions.map((region) => renderPolygon(region, cx, fillFor(region.muscle, primaryMuscle, secondary))),
    // Deltoids sit on top of the arm/torso seam, so they are drawn last.
    `<ellipse data-muscle="shoulders" cx="${cx - 25}" cy="40" rx="10.5" ry="10" fill="${shoulderFill}" stroke="${OUTLINE_COLOR}" stroke-width="1" />`,
    `<ellipse data-muscle="shoulders" cx="${cx + 25}" cy="40" rx="10.5" ry="10" fill="${shoulderFill}" stroke="${OUTLINE_COLOR}" stroke-width="1" />`,
    `<text x="${cx}" y="203" text-anchor="middle" font-size="10" fill="#52525b">${label}</text>`,
  ];
  return parts.join('\n  ');
}

/** Russian display names for the six muscle groups, used in the accessible label. */
export const MUSCLE_NAMES_RU: Record<MuscleGroup, string> = {
  chest: 'грудь',
  back: 'спина',
  legs: 'ноги',
  shoulders: 'плечи',
  arms: 'руки',
  core: 'пресс',
};

/**
 * The secondary groups that actually get painted blue: de-duplicated, and with
 * the primary group removed because primary always wins the fill. The upstream
 * dataset routinely repeats groups and re-lists the primary group as secondary
 * — 74 of the 598 exercises have a secondary array containing nothing but the
 * primary group again (e.g. Barbell_Curl: primary `arms`, secondary
 * `["arms"]`). For those the diagram has no blue region at all, so both the
 * legend and the accessible label have to key off this list rather than the
 * raw array, or they end up explaining a colour that is not on the figure.
 */
export function effectiveSecondaryMuscles(
  primaryMuscle: MuscleGroup,
  secondaryMuscles: MuscleGroup[],
): MuscleGroup[] {
  return [...new Set(secondaryMuscles)].filter((m) => m !== primaryMuscle);
}

/**
 * The text a screen reader announces in place of the diagram. Without this the
 * figure is just an unlabelled picture — the colours carry the entire message,
 * so the same information has to exist in words.
 */
export function muscleDiagramLabel(primaryMuscle: MuscleGroup, secondaryMuscles: MuscleGroup[]): string {
  const secondary = effectiveSecondaryMuscles(primaryMuscle, secondaryMuscles);
  const primaryPart = `Основные мышцы: ${MUSCLE_NAMES_RU[primaryMuscle]}`;
  if (secondary.length === 0) return `${primaryPart}.`;
  return `${primaryPart}. Второстепенные: ${secondary.map((m) => MUSCLE_NAMES_RU[m]).join(', ')}.`;
}

/**
 * Renders a complete, standalone SVG document (as a string) showing which
 * muscles an exercise works: `primaryMuscle` in red, every entry of
 * `secondaryMuscles` in blue, and everything else in neutral grey.
 */
export function renderMuscleDiagram(primaryMuscle: MuscleGroup, secondaryMuscles: MuscleGroup[]): string {
  const effectiveSecondary = effectiveSecondaryMuscles(primaryMuscle, secondaryMuscles);
  const secondary = new Set(effectiveSecondary);
  const label = muscleDiagramLabel(primaryMuscle, secondaryMuscles);
  const legendLines = [
    `<circle cx="14" cy="216" r="4.5" fill="${PRIMARY_COLOR}" />`,
    `<text x="24" y="219.5" font-size="9.5" fill="#3f3f46">Основные мышцы</text>`,
  ];
  // Only when something on the figure is actually blue — see effectiveSecondaryMuscles().
  if (effectiveSecondary.length > 0) {
    legendLines.push(
      `<circle cx="14" cy="230" r="4.5" fill="${SECONDARY_COLOR}" />`,
      `<text x="24" y="233.5" font-size="9.5" fill="#3f3f46">Второстепенные мышцы</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" width="${VIEW_WIDTH}" height="${VIEW_HEIGHT}" style="display: block; width: 100%; height: auto;" role="img" aria-label="${label}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
  <title>${label}</title>
  <rect x="0" y="0" width="${VIEW_WIDTH}" height="${VIEW_HEIGHT}" fill="#ffffff" />
  ${renderFigure(FRONT_REGIONS, FRONT_CX, 'Вид спереди', primaryMuscle, secondary)}
  ${renderFigure(BACK_REGIONS, BACK_CX, 'Вид сзади', primaryMuscle, secondary)}
  ${legendLines.join('\n  ')}
</svg>
`;
}
