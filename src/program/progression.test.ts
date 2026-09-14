// src/program/progression.test.ts
import { describe, expect, it } from 'vitest';
import { estimateOneRepMax, applyProgression, maybeLevelUp, isDeloadWeek } from './progression';
import type { ProgramExercise, SetLogEntry } from '../types';

function makeExercise(overrides: Partial<ProgramExercise> = {}): ProgramExercise {
  return { exerciseId: 'bench', sets: 3, repsMin: 6, repsMax: 12, targetWeightKg: 60, restSec: 90, ...overrides };
}

function setsAt(reps: number, count: number, done = true): SetLogEntry[] {
  return Array.from({ length: count }, () => ({ planned: { weightKg: 60, reps }, actual: { weightKg: 60, reps }, done }));
}

describe('estimateOneRepMax', () => {
  it('applies the Epley formula', () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(100 * (1 + 5 / 30), 5);
    expect(estimateOneRepMax(60, 0)).toBe(60);
  });
});

describe('isDeloadWeek', () => {
  it('is true every 6th week', () => {
    expect(isDeloadWeek(6)).toBe(true);
    expect(isDeloadWeek(12)).toBe(true);
    expect(isDeloadWeek(1)).toBe(false);
    expect(isDeloadWeek(5)).toBe(false);
  });
});

describe('applyProgression', () => {
  it('increases weight after a fully successful linear week', () => {
    const result = applyProgression(makeExercise(), setsAt(8, 3), 'linear', 0, 0, 1);
    expect(result.exercise.targetWeightKg).toBeGreaterThan(60);
    expect(result.phase).toBe('linear');
    expect(result.consecutiveFailures).toBe(0);
    expect(result.reason).toMatch(/вес увеличен/);
  });

  it('keeps weight after a single failed week, incrementing failure counter', () => {
    const result = applyProgression(makeExercise(), setsAt(4, 3), 'linear', 0, 0, 1);
    expect(result.exercise.targetWeightKg).toBe(60);
    expect(result.consecutiveFailures).toBe(1);
  });

  it('deloads by 10% after two consecutive failures', () => {
    const result = applyProgression(makeExercise(), setsAt(4, 3), 'linear', 1, 0, 1);
    expect(result.exercise.targetWeightKg).toBeCloseTo(60 * 0.9, 1);
    expect(result.consecutiveFailures).toBe(0);
    expect(result.reason).toMatch(/делоад/);
  });

  it('switches to double_progression after 2 weeks without a weight increase', () => {
    const result = applyProgression(makeExercise(), setsAt(4, 3), 'linear', 0, 1, 1);
    expect(result.phase).toBe('double_progression');
    expect(result.weeksWithoutIncrease).toBe(0);
  });

  it('in double_progression, only increases weight once all sets reach repsMax', () => {
    const notYet = applyProgression(makeExercise(), setsAt(8, 3), 'double_progression', 0, 0, 1);
    expect(notYet.exercise.targetWeightKg).toBe(60);

    const maxed = applyProgression(makeExercise(), setsAt(12, 3), 'double_progression', 0, 0, 1);
    expect(maxed.exercise.targetWeightKg).toBeGreaterThan(60);
  });

  it('applies a forced deload every 6th week regardless of phase', () => {
    const result = applyProgression(makeExercise(), setsAt(12, 3), 'linear', 0, 0, 6);
    expect(result.exercise.targetWeightKg).toBeLessThan(60);
    expect(result.exercise.sets).toBeLessThan(3);
    expect(result.reason).toMatch(/разгрузочная/i);
  });

  it('progresses bodyweight exercises (null weight) via reps instead of weight', () => {
    const bodyweightExercise = makeExercise({ targetWeightKg: null });
    const maxed = applyProgression(bodyweightExercise, setsAt(12, 3), 'linear', 0, 0, 1);
    expect(maxed.exercise.repsMin).toBe(8);
    expect(maxed.exercise.repsMax).toBe(14);

    const notMaxed = applyProgression(bodyweightExercise, setsAt(7, 3), 'linear', 0, 0, 1);
    expect(notMaxed.exercise.repsMin).toBe(6);
    expect(notMaxed.exercise.repsMax).toBe(12);
  });
});

describe('maybeLevelUp', () => {
  it('promotes beginner to intermediate after 4 good weeks', () => {
    expect(maybeLevelUp('beginner', 3)).toBe('beginner');
    expect(maybeLevelUp('beginner', 4)).toBe('intermediate');
  });

  it('promotes intermediate to advanced after 10 good weeks', () => {
    expect(maybeLevelUp('intermediate', 9)).toBe('intermediate');
    expect(maybeLevelUp('intermediate', 10)).toBe('advanced');
  });

  it('does not change advanced', () => {
    expect(maybeLevelUp('advanced', 100)).toBe('advanced');
  });
});
