import { openAudioDialog, playEffect, setDialogMusic } from "./audio";
import {
  minigames,
  pickMinigame,
  settleMinigame,
  type Minigame,
} from "./game/minigames";
import { STAT_LABELS } from "./game/opening";
import type { Save } from "./game/saves";
import { minigameBackground, sprite } from "./minigame-art";
import { minigameRounds } from "./minigame-rounds";
import "./minigame-view.css";
import "./minigame-second.css";

function confirmation(dialog: HTMLDialogElement) {
  const button = dialog.querySelector<HTMLButtonElement>(".mg-confirm")!;
  button.focus();
  return new Promise<void>((resolve) => {
    button.onclick = () => {
      button.disabled = true;
      resolve();
    };
  });
}

function card(dialog: HTMLDialogElement, game: Minigame, content: string) {
  dialog.innerHTML = `<section class="mg-card-layout">
    <div class="mg-illustration" data-game="${game}">${minigameBackground(game)}${sprite(game)}</div>
    <div class="mg-copy">${content}</div>
  </section>`;
}

export async function playMinigameRound(
  dialog: HTMLDialogElement,
  game: Minigame,
  title: string = minigames[game].name,
) {
  const definition = minigames[game];
  dialog.classList.add("mg-dialog");
  dialog.oncancel = (event) => event.preventDefault();
  card(
    dialog,
    game,
    `<h2 id="activity-title">${title}</h2>
    <p>${definition.instructions}</p>
    <button class="action mg-confirm" type="button" data-audio-action>開始</button>`,
  );
  openAudioDialog(
    dialog,
    title === definition.name ? "game_start" : "dialog_open",
  );
  await confirmation(dialog);
  playEffect("game_start");
  setDialogMusic(dialog, `mg_${game}`);
  dialog.innerHTML = `<section class="mg-play" data-game="${game}">
    ${game === "diff" || game === "whack" || game === "catch" ? "" : minigameBackground(game)}
    <header class="mg-hud">
      <h2 id="activity-title" tabindex="-1">${title}</h2>
      <div><span class="mg-score"></span><span class="mg-clock"></span></div>
    </header>
    <div class="mg-field"></div>
  </section>`;
  dialog.querySelector("h2")!.focus();
  return minigameRounds[game]({
    field: dialog.querySelector(".mg-field")!,
    score: dialog.querySelector(".mg-score")!,
    clock: dialog.querySelector(".mg-clock")!,
  });
}

export async function closeMinigame(dialog: HTMLDialogElement) {
  // Wait for the native close event before the contest can open its result modal.
  await new Promise<void>((resolve) => {
    dialog.addEventListener("close", () => resolve(), { once: true });
    dialog.close();
  });
  dialog.classList.remove("mg-dialog");
  dialog.replaceChildren();
}

export async function playMinigame(dialog: HTMLDialogElement, save: Save) {
  const game = pickMinigame();
  const result = await playMinigameRound(dialog, game);
  const reward = settleMinigame(save, game, result);
  playEffect(reward.tier === "未達" ? "mg_fail" : "mg_clear");
  const { name, normal, excellent, unit, stat } = minigames[game];
  const target = (threshold: number) =>
    game === "memory"
      ? `${threshold} 秒內配完 8 對`
      : `${threshold}${unit}以上${game === "catch" ? "・漏接最多 5 個" : game === "diff" ? `・點錯最多 ${threshold === excellent ? 1 : 3} 次` : ""}`;
  const score =
    game === "memory"
      ? `${result.score} ／ 8 對・${((result.elapsedMs ?? 0) / 1000).toFixed(3)} 秒`
      : `${result.score}${unit}${game === "catch" ? `・漏接 ${result.misses} 個` : game === "diff" ? `・點錯 ${result.misses} 次` : ""}`;
  card(
    dialog,
    game,
    `<h2 id="activity-title">${name}・${reward.tier}</h2>
    <p class="mg-result">成績 ${score}</p>
    <dl class="mg-goals"><div><dt>普通</dt><dd>${target(normal)}</dd></div>
    <div><dt>優秀</dt><dd>${target(excellent)}</dd></div></dl>
    <p class="mg-reward">${STAT_LABELS[stat]} ＋${reward.stat}・現金 ＋${reward.cash} 元</p>
    <button class="action mg-confirm" type="button" data-audio-action>確定</button>`,
  );
  await confirmation(dialog);
  await closeMinigame(dialog);
  return reward.save;
}
