import { assets } from "./assets";
import { juniorBoard as board, tileLabels } from "./data/junior";
import { boardView } from "./board-view";
import type { Orientation } from "./data/board-layout";
import {
  beforeRoll,
  diceCount,
  directions,
  finishTurn,
  rollDice,
  stageFinished,
  walkStep,
} from "./game/board";
import { STAT_LABELS, type Stat } from "./game/opening";
import type { Save } from "./game/saves";
import "./junior-board.css";

const stepsByTile = {
  event: 3,
  game: 6,
  club: 5,
  quiz: 4,
  contest: 5,
} as const;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

interface BoardActions {
  autoSave: (save: Save) => void;
  manualSave: (save: Save) => void;
  exportSave: (save: Save) => void;
  home: () => void;
}

export function showJuniorBoard(
  app: HTMLElement,
  initial: Save,
  message: string,
  actions: BoardActions,
) {
  let save = initial;
  const { portrait, landscape } = assets.junior;
  app.innerHTML = `<main class="stage junior">
    <div class="board-map backdrop" role="group" aria-label="國中地圖">
      <picture><source media="(orientation: portrait)" srcset="${portrait}"><img src="${landscape}" alt=""></picture>
      <svg class="board-track" preserveAspectRatio="none"></svg>
    </div>
    <section class="board-controls">
      <header><h1 tabindex="-1">國中棋盤</h1><h2 id="character-name"></h2></header>
      <dl class="board-status" aria-label="玩家狀態"></dl>
      <div class="board-roll">
        <button class="action" id="roll" type="button">擲骰</button>
        <div class="dice" aria-label="骰子點數"></div>
        <span id="dice-total"></span>
      </div>
      <p id="ending" tabindex="-1" hidden>國中階段結束，升學考試第 4 步製作中</p>
      <p id="notice" role="status"></p>
      <div class="actions">
        <button class="action" id="save" type="button">儲存到存檔格</button>
        <button class="action" id="export" type="button">匯出存檔</button>
        <button class="action" id="home" type="button">回標題</button>
      </div>
    </section>
    <dialog class="board-dialog" aria-labelledby="board-prompt"><form method="dialog">
      <h2 id="board-prompt"></h2><p class="board-detail"></p><div class="actions"></div>
    </form></dialog>
  </main>`;
  const find = <T extends HTMLElement>(selector: string) =>
    app.querySelector<T>(selector)!;
  const track = app.querySelector<SVGSVGElement>(".board-track")!;
  const artwork = find<HTMLImageElement>(".board-map img");
  const media = matchMedia("(orientation: portrait)");
  const debug = new URLSearchParams(location.search).get("debug") === "path";
  let orientation: Orientation = media.matches ? "portrait" : "landscape";
  let view = boardView(
    track,
    board.layouts[orientation],
    board.tiles,
    save.gender,
    debug,
  );
  let facing = 1;
  let stride = false;
  let landed = save.boardTile;
  let pose: "stand" | "win" = "stand";

  artwork.addEventListener("load", () => {
    const next = media.matches ? "portrait" : "landscape";
    if (next === orientation) return;
    orientation = next;
    view = boardView(
      track,
      board.layouts[orientation],
      board.tiles,
      save.gender,
      debug,
    );
    view.place(landed, pose, facing);
  });

  const dialog = find<HTMLDialogElement>("dialog");
  const roll = find<HTMLButtonElement>("#roll");
  const dice = find(".dice");
  const total = find("#dice-total");
  const notice = find("#notice");
  const ending = find("#ending");
  const navigation = Array.from(
    app.querySelectorAll<HTMLButtonElement>(".board-controls .actions button"),
  );
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  find("#character-name").textContent = save.name;
  notice.textContent = message;
  find<HTMLButtonElement>("#save").onclick = () => actions.manualSave(save);
  find<HTMLButtonElement>("#export").onclick = () => actions.exportSave(save);
  find<HTMLButtonElement>("#home").onclick = actions.home;
  dialog.oncancel = (event) => event.preventDefault();

  function status() {
    const fields = [
      ["回合", `${Math.min(save.turn + 1, board.turns)} ／ ${board.turns}`],
      ["骰子", `${diceCount(save)} 顆`],
      ["水星逆行", `${save.retrogradeTurns} 回合`],
      ["否極泰來", `${save.turnaroundTurns} 回合`],
      ["附身神祇", "—"],
      ...Object.entries(STAT_LABELS).map(([key, label]) => [
        label,
        save.stats[key as Stat],
      ]),
      ["現金", `${save.cash.toLocaleString("zh-TW")} 元`],
    ];
    find(".board-status").innerHTML = fields
      .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
      .join("");
  }

  function placePawn(nextPose: "stand" | "win") {
    pose = nextPose;
    landed = save.boardTile;
    view.place(landed, pose, facing);
  }

  async function animateStep(from: number, to: number) {
    stride = !stride;
    if (!reducedMotion) {
      await new Promise<void>((resolve) => {
        let started: number | undefined;
        function frame(now: number) {
          started ??= now;
          const progress = Math.min(1, (now - started) / 300);
          facing = view.step(from, to, progress, facing, stride);
          if (progress < 1) requestAnimationFrame(frame);
          else resolve();
        }
        requestAnimationFrame(frame);
      });
    }
    placePawn("stand");
  }

  function prompt(title: string, detail = "", choices = ["確定"]) {
    find("#board-prompt").textContent = title;
    find(".board-detail").textContent = detail;
    find("dialog .actions").innerHTML = choices
      .map(
        (choice, index) =>
          `<button class="action" value="${index}">${choice}</button>`,
      )
      .join("");
    return new Promise<number>((resolve) => {
      dialog.onclose = () => resolve(Number(dialog.returnValue));
      dialog.showModal();
    });
  }

  async function chooseRoute(steps: number) {
    const routes = directions(board, save);
    if (
      routes.length < 2 ||
      board.tiles[save.boardTile].kind !== "fork" ||
      save.nextTile !== null
    )
      return;
    const choice = await prompt(
      "岔路：選擇方向",
      steps ? `還有 ${steps} 步。` : "請選擇下一回合的前進方向。",
      routes.map(
        (tile, index) =>
          `${index === 0 ? "沿外圈" : "走捷徑"}・第 ${tile + 1} 格${tileLabels[board.tiles[tile].kind]}`,
      ),
    );
    save = { ...save, nextTile: routes[choice] };
  }

  function showDice(values: number[]) {
    dice.innerHTML = values.map((value) => `<span>${value}</span>`).join("");
  }

  function showEnding() {
    ending.hidden = false;
    roll.hidden = true;
    placePawn("win");
  }

  async function playTurn() {
    if (roll.disabled || stageFinished(board, save)) return;
    roll.disabled = true;
    navigation.forEach((button) => (button.disabled = true));
    notice.textContent = "";
    total.textContent = "";
    const draw = beforeRoll(save);
    save = draw.save;
    status();
    if (draw.notice) await prompt(draw.notice);

    const count = diceCount(save);
    const values = rollDice(count);
    if (!reducedMotion) {
      for (let frame = 0; frame < 5; frame++) {
        showDice(values.map((value) => ((value + frame) % 6) + 1));
        await delay(70);
      }
    }
    showDice(values);
    let steps = values.reduce((sum, value) => sum + value, 0);
    total.textContent = `共 ${steps} 點`;

    await chooseRoute(steps);
    while (steps > 0) {
      const from = save.boardTile;
      const move = walkStep(board, save, steps);
      save = move.save;
      steps = move.steps;
      await animateStep(from, save.boardTile);
      status();
      if (move.reward) {
        placePawn("win");
        await prompt(
          `${steps ? "經過起點" : "停在起點"}，現金 ＋${move.reward.toLocaleString("zh-TW")} 元`,
        );
      }
      await chooseRoute(steps);
    }
    placePawn("stand");
    const kind = board.tiles[save.boardTile].kind;
    if (kind in stepsByTile)
      await prompt(
        `${tileLabels[kind]}：第 ${stepsByTile[kind as keyof typeof stepsByTile]} 步製作中`,
      );

    const finished = finishTurn(save);
    save = finished.save;
    status();
    persist();
    if (finished.turnaroundStarted)
      await prompt("否極泰來！", "水星逆行已結束。接下來 3 回合為否極泰來。");
    if (stageFinished(board, save)) {
      showEnding();
      ending.focus();
    } else {
      roll.disabled = false;
      roll.focus();
    }
    navigation.forEach((button) => (button.disabled = false));
  }

  function persist() {
    try {
      actions.autoSave(save);
      notice.textContent = "已自動存檔。";
    } catch {
      notice.textContent = "無法自動存檔，請確認瀏覽器允許儲存網站資料。";
    }
  }

  status();
  placePawn("stand");
  if (stageFinished(board, save)) showEnding();
  roll.onclick = () => void playTurn();
  find("h1").focus();
}
