import type { RoundScore } from "./game/minigames";

type Elements = { field: HTMLElement; score: HTMLElement; clock: HTMLElement };
export type Round = (elements: Elements) => Promise<RoundScore>;

export function timedRound(
  clock: HTMLElement,
  seconds: number,
  start: number,
  update: (elapsed: number, finish: () => void) => void,
  signClock?: HTMLElement,
) {
  return new Promise<number>((resolve) => {
    const duration = seconds * 1000;
    let interval: number;
    let remaining = -1;
    const finish = () => {
      clearInterval(interval);
      resolve(Math.min(duration, Math.round(performance.now() - start)));
    };
    const tick = () => {
      const elapsed = performance.now() - start;
      const next = Math.max(0, Math.ceil((duration - elapsed) / 1000));
      if (next !== remaining) {
        clock.textContent = `${next} 秒`;
        if (signClock) signClock.textContent = clock.textContent;
        remaining = next;
      }
      if (elapsed >= duration) finish();
      else update(elapsed, finish);
    };
    interval = window.setInterval(tick, 50);
    tick();
  });
}
