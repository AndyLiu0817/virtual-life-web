import backdrop from "../art/mg_rhythm_bg_final.jpg";
import notes from "../art/mg_rhythm_sheet_final.jpg";
import type { ContestScore } from "./game/contests";

export const rhythmArt = `<img class="event-background" src="${backdrop}" alt="">`;

// Step 6 can replace this round while returning the same accuracy score.
export async function playRhythmRound(
  dialog: HTMLDialogElement,
): Promise<ContestScore> {
  const beats = 8;
  const interval = 700;
  const windowMs = 130;
  dialog.innerHTML = `<section class="rhythm-round">
    <div class="event-stage" data-tone="scene">${rhythmArt}</div>
    <div class="event-copy">
      <h2 id="activity-title">衝刺擂台</h2>
      <p>音符亮起時點一下。全程共 8 拍，每拍最多算一次。</p>
      <p class="rhythm-status" role="status">準備就緒</p>
      <button class="action rhythm-tap" type="button" autofocus>
        <span class="rhythm-note" style="background-image:url('${notes}')" aria-hidden="true"></span>
        <span>開始</span>
      </button>
    </div>
  </section>`;
  dialog.oncancel = (event) => event.preventDefault();
  dialog.showModal();

  const tap = dialog.querySelector<HTMLButtonElement>(".rhythm-tap")!;
  const label = tap.querySelector("span:last-child")!;
  const status = dialog.querySelector(".rhythm-status")!;
  const hit = new Set<number>();
  await new Promise<void>((resolve) => {
    tap.onclick = () => {
      const start = performance.now() + interval;
      label.textContent = "拍擊";
      status.textContent = "等候第一拍";
      tap.onclick = () => {
        const elapsed = performance.now() - start;
        const index = Math.round(elapsed / interval);
        if (
          index >= 0 &&
          index < beats &&
          Math.abs(elapsed - index * interval) <= windowMs
        ) {
          hit.add(index);
          status.textContent = `命中 ${hit.size} ／ ${beats} 拍`;
          tap.classList.remove("on-beat");
        }
      };
      for (let i = 0; i < beats; i++) {
        const at = (i + 1) * interval;
        setTimeout(() => tap.classList.add("on-beat"), at);
        setTimeout(() => tap.classList.remove("on-beat"), at + windowMs);
      }
      setTimeout(
        () => {
          tap.onclick = null;
          resolve();
        },
        beats * interval + windowMs + 40,
      );
    };
  });
  await new Promise<void>((resolve) => {
    dialog.onclose = () => resolve();
    dialog.close();
  });
  dialog.replaceChildren();
  return { score: (hit.size / beats) * 100 };
}
