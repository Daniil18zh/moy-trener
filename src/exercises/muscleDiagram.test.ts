import { describe, expect, it } from 'vitest';
import type { MuscleGroup } from '../types';
import {
  renderMuscleDiagram,
  muscleDiagramLabel,
  PRIMARY_COLOR,
  SECONDARY_COLOR,
  NEUTRAL_COLOR,
} from './muscleDiagram';

const ALL_GROUPS: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];

// How many separately fillable shapes each group is drawn from. Pinning the exact counts (rather
// than just "at least one") is what catches a region silently losing its data-muscle tag during a
// future edit to the shape tables — the diagram would still render and still look plausible.
// chest/core/back live on one figure only; shoulders/arms/legs are mirrored across both figures.
const REGION_COUNTS: Record<MuscleGroup, number> = {
  chest: 2, // left + right pec, front figure
  core: 1, // abdomen, front figure
  back: 2, // upper + lower slab, back figure
  shoulders: 4, // 2 deltoids x 2 figures
  arms: 8, // (upper arm + forearm) x 2 sides x 2 figures
  legs: 8, // (thigh + shin) x 2 sides x 2 figures
};

/**
 * Collects the distinct fill colors used by every shape tagged with the given
 * muscle group. Reading fills off `data-muscle` (rather than string-searching
 * the whole document) keeps the assertions honest: the legend swatches also use
 * the highlight colors, so a naive `toContain('#dc2626')` would pass no matter
 * which region was actually painted.
 */
function regionsFor(svg: string, muscle: MuscleGroup): Element[] {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return [...doc.querySelectorAll(`[data-muscle="${muscle}"]`)];
}

function fillsFor(svg: string, muscle: MuscleGroup): string[] {
  return [...new Set(regionsFor(svg, muscle).map((node) => node.getAttribute('fill') ?? ''))];
}

describe('renderMuscleDiagram', () => {
  it('fills every region of the primary muscle with the primary color', () => {
    const svg = renderMuscleDiagram('chest', []);
    expect(fillsFor(svg, 'chest')).toEqual([PRIMARY_COLOR]);
  });

  it('fills each secondary muscle with the secondary color', () => {
    const svg = renderMuscleDiagram('chest', ['shoulders', 'arms']);
    expect(fillsFor(svg, 'shoulders')).toEqual([SECONDARY_COLOR]);
    expect(fillsFor(svg, 'arms')).toEqual([SECONDARY_COLOR]);
  });

  it('leaves untargeted muscle groups neutral, never a highlight color', () => {
    const svg = renderMuscleDiagram('chest', ['shoulders']);
    for (const muscle of ['back', 'legs', 'arms', 'core'] as MuscleGroup[]) {
      const fills = fillsFor(svg, muscle);
      expect(fills).toEqual([NEUTRAL_COLOR]);
      expect(fills).not.toContain(PRIMARY_COLOR);
      expect(fills).not.toContain(SECONDARY_COLOR);
    }
  });

  it('renders all six muscle groups with their full complement of regions', () => {
    const svg = renderMuscleDiagram('core', []);
    for (const muscle of ALL_GROUPS) {
      expect(regionsFor(svg, muscle)).toHaveLength(REGION_COUNTS[muscle]);
    }
  });

  it('highlights every region of a mirrored group, not just one side', () => {
    // arms and legs are drawn per-side per-figure; a highlight that only reached the left thigh
    // would still satisfy a "contains the primary color" assertion.
    const svg = renderMuscleDiagram('legs', ['arms']);
    expect(regionsFor(svg, 'legs').map((n) => n.getAttribute('fill'))).toEqual(
      Array(REGION_COUNTS.legs).fill(PRIMARY_COLOR),
    );
    expect(regionsFor(svg, 'arms').map((n) => n.getAttribute('fill'))).toEqual(
      Array(REGION_COUNTS.arms).fill(SECONDARY_COLOR),
    );
  });

  it('keeps a group primary (red) even if the dataset also lists it as secondary', () => {
    const svg = renderMuscleDiagram('legs', ['legs', 'core']);
    expect(fillsFor(svg, 'legs')).toEqual([PRIMARY_COLOR]);
    expect(fillsFor(svg, 'core')).toEqual([SECONDARY_COLOR]);
  });

  it('shows the secondary legend line only when there are secondary muscles', () => {
    expect(renderMuscleDiagram('back', ['arms'])).toContain('Второстепенные мышцы');
    const noSecondary = renderMuscleDiagram('back', []);
    expect(noSecondary).toContain('Основные мышцы');
    expect(noSecondary).not.toContain('Второстепенные мышцы');
  });

  it('hides the secondary legend when the secondary list only repeats the primary muscle', () => {
    // Regression: the upstream dataset routinely re-lists the primary muscle as its own
    // secondary (e.g. Barbell_Curl: primary "arms", secondary ["arms"]). No region is
    // actually painted blue in that case, so the legend must not claim one is.
    const svg = renderMuscleDiagram('arms', ['arms']);
    expect(fillsFor(svg, 'arms')).toEqual([PRIMARY_COLOR]);
    expect(svg).toContain('Основные мышцы');
    expect(svg).not.toContain('Второстепенные мышцы');
  });

  it('shows both a front and a back view', () => {
    const svg = renderMuscleDiagram('back', []);
    expect(svg).toContain('Вид спереди');
    expect(svg).toContain('Вид сзади');
  });

  it('names the highlighted muscles in Russian for screen readers', () => {
    expect(muscleDiagramLabel('chest', ['shoulders', 'arms'])).toBe(
      'Основные мышцы: грудь. Второстепенные: плечи, руки.',
    );
    expect(muscleDiagramLabel('core', [])).toBe('Основные мышцы: пресс.');
    // The dataset repeats groups and re-lists the primary one as secondary; neither should leak
    // into the label as a duplicate.
    expect(muscleDiagramLabel('legs', ['legs', 'back', 'back'])).toBe(
      'Основные мышцы: ноги. Второстепенные: спина.',
    );
    const svg = renderMuscleDiagram('back', ['arms']);
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.documentElement.getAttribute('aria-label')).toBe('Основные мышцы: спина. Второстепенные: руки.');
    expect(doc.querySelector('title')?.textContent).toBe('Основные мышцы: спина. Второстепенные: руки.');
  });

  it('produces well-formed XML that parses as an <svg> document', () => {
    for (const muscle of ALL_GROUPS) {
      const svg = renderMuscleDiagram(muscle, ['core', 'arms']);
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      expect(doc.querySelector('parsererror')).toBeNull();
      expect(doc.documentElement.nodeName).toBe('svg');
      expect(doc.documentElement.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
      expect(doc.documentElement.getAttribute('viewBox')).toBeTruthy();
    }
  });
});
