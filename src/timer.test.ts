import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createCountdown } from './timer';

describe('createCountdown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ticks down every second and calls onDone at zero', () => {
    const onTick = vi.fn();
    const onDone = vi.fn();
    createCountdown(3, onTick, onDone);

    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledWith(2);
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledWith(1);
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledWith(0);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stop() halts further ticks', () => {
    const onTick = vi.fn();
    const { stop } = createCountdown(5, onTick, vi.fn());
    vi.advanceTimersByTime(1000);
    stop();
    vi.advanceTimersByTime(3000);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('addSeconds adjusts the remaining time without resetting the interval', () => {
    const onTick = vi.fn();
    const { addSeconds } = createCountdown(10, onTick, vi.fn());
    addSeconds(15);
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenLastCalledWith(24);
    addSeconds(-100);
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenLastCalledWith(0);
  });
});
