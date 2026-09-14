export interface Countdown {
  stop: () => void;
  addSeconds: (delta: number) => void;
}

export function createCountdown(totalSec: number, onTick: (remainingSec: number) => void, onDone: () => void): Countdown {
  let remaining = totalSec;

  const intervalId = setInterval(() => {
    remaining = Math.max(0, remaining - 1);
    onTick(remaining);
    if (remaining === 0) {
      clearInterval(intervalId);
      onDone();
    }
  }, 1000);

  return {
    stop: () => clearInterval(intervalId),
    addSeconds: (delta: number) => {
      remaining = Math.max(0, remaining + delta);
    },
  };
}

export function playBeep(): void {
  const ctx = new AudioContext();
  const oscillator = ctx.createOscillator();
  oscillator.frequency.value = 880;
  oscillator.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.3);
  oscillator.onended = () => ctx.close();
}
