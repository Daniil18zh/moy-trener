import { describe, expect, it } from 'vitest';
import type { MuscleGroup } from '../src/types';
import { renderMuscleDiagram, PRIMARY_COLOR, SECONDARY_COLOR, NEUTRAL_COLOR } from './generateMuscleDiagram';

const ALL_GROUPS: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];

/**
 * Collects the distinct fill colors used by every shape tagged with the given
 * muscle group. Reading fills off `data-muscle` (rather than string-searching
 * the whole document) keeps the assertions honest: the legend swatches also use
 * the highlight colors, so a naive `toContain('#dc2626')` would pass no matter
 * which region was actually painted.
 */
function fillsFor(svg: string, muscle: MuscleGroup): string[] {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const nodes = [...doc.querySelectorAll(`[data-muscle="${muscle}"]`)];
  return [...new Set(nodes.map((node) => node.getAttribute('fill') ?? ''))];
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

  it('renders all six muscle groups as identifiable regions', () => {
    const svg = renderMuscleDiagram('core', []);
    for (const muscle of ALL_GROUPS) {
      expect(fillsFor(svg, muscle).length).toBeGreaterThan(0);
    }
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

  it('shows both a front and a back view', () => {
    const svg = renderMuscleDiagram('back', []);
    expect(svg).toContain('Вид спереди');
    expect(svg).toContain('Вид сзади');
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
