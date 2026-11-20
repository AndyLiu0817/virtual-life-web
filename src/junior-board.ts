import { activityPrompt, promptForClub, promptForShop } from "./activity-view";
import { playContest } from "./contest-view";
import {
  clubChoice,
  drawClubEvent,
  settleClubEvent,
  visitClub,
} from "./game/clubs";
import { nextMatch } from "./game/contests";
import type { SchoolBoard } from "./data/school-board";
import { handleLoveTile } from "./game/school";
import { tileLabels } from "./data/junior";
import { boardCamera } from "./board-camera";
import { playDiceFlight } from "./board-dice-flight";
import { boardView } from "./board-view";
import { boardHud, boardHudMarkup } from "./board-hud";
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
import {
  activeDeity,
  deities,
  deityTurnEffect,
  payOffering,
  randomFork,
  stepChoices,
  walkingSteps,
} from "./game/deities";
import { drawEvent } from "./game/events";
import { changeText, eventPresentation, sceneArt } from "./event-view";
import { showAssessment } from "./exam-view";
import { quizReward, scoreAttempt, startAssessment } from "./game/questions";
import { playMinigame } from "./minigame-view";
import type { Save } from "./game/saves";
import "./junior-board.css";
import "./event-view.css";

const walkStepMs = 550;
interface BoardActions {
  autoSave: (save: Save) => void;
  manualSave: (save: Save) => void;
  exportSave: (save: Save) => void;
  home: () => void;
  complete: (save: Save) => void;
}

export function showStageBoard(
  app: HTMLElement,
  initial: Save,
  board: SchoolBoard,
  message: string,
  actions: BoardActions,
) {
  let save = initial;
  const debugMode = new URLSearchParams(location.search).get("debug");
  const showRoadArt = debugMode === "road" && !!board.roadMaps;
  const debug = debugMode === "path" || showRoadArt;
  const maps = showRoadArt ? board.roadMaps! : board.maps;
  const { portrait, landscape } = maps;
  app.innerHTML = `<main class="stage junior" data-board-stage="${board.stage}">
    <div class="board-map" role="group" aria-label="${board.label}">
      <div class="board-world"><picture><source media="(orientation: portrait)" srcset="${portrait}"><img src="${landscape}" alt=""></picture>
      <svg class="board-track" preserveAspectRatio="none"></svg></div>
    </div>
    ${boardHudMarkup(debug)}
    <dialog class="board-dialog" aria-labelledby="board-prompt"><form method="dialog">
      <h2 id="board-prompt"></h2><p class="board-detail"></p><div class="actions"></div>
    </form></dialog>
    <dialog class="event-dialog activity-dialog" aria-labelledby="activity-title"></dialog>
    <dialog class="assessment-dialog" aria-labelledby="assessment-title"></dialog>
    <dialog class="event-dialog" aria-labelledby="event-title" aria-describedby="event-text event-result">
      <form method="dialog">
        <div class="event-stage"></div>
        <div class="event-copy">
          <p class="event-label"></p><h2 id="event-title"></h2>
          <p id="event-text"></p><p class="event-result" id="event-result"></p>
          <div class="actions">
            <button class="action" value="offer" type="submit" hidden>還願</button>
            <button class="action" value="continue" type="submit" autofocus>確定</button>
          </div>
        </div>
      </form>
    </dialog>
  </main>`;
  const find = <T extends HTMLElement>(selector: string) =>
    app.querySelector<T>(selector)!;
  const viewport = find(".board-map");
  const track = app.querySelector<SVGSVGElement>(".board-track")!;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const camera = boardCamera(find(".board-world"), reducedMotion);
  const media = matchMedia("(orientation: portrait)");
  if (debug) {
    const anchors = find<HTMLInputElement>("#scenery-anchors");
    anchors.onchange = () =>
      track.classList.toggle("show-scenery-anchors", anchors.checked);
  }
  const hud = boardHud(find(".board-controls"), board.turns);
  let orientation: Orientation = media.matches ? "portrait" : "landscape";
  const overview = find<HTMLButtonElement>("#overview");
  let overviewPreference: boolean | undefined;
  let walking = false;
  function syncOverview(immediate = false) {
    const active =
      !walking && (overviewPreference ?? orientation === "landscape");
    overview.setAttribute("aria-pressed", String(active));
    camera.setOverview(active, immediate);
  }
  viewport.style.setProperty("--scene", `url("${maps[orientation]}")`);
  let view = boardView(
    track,
    board.layouts[orientation],
    orientation,
    board,
    save.gender,
    debug,
    maps[orientation],
    camera.follow,
  );
  let facing = 1;
  let landed = save.boardTile;
  let pose: "stand" | "win" = "stand";
  let moving: { from: number; to: number; progress: number } | undefined;

  const orientationChange = new ResizeObserver(() => {
    const next = media.matches ? "portrait" : "landscape";
    if (next === orientation) {
      camera.snap();
      return;
    }
    orientation = next;
    viewport.style.setProperty("--scene", `url("${maps[orientation]}")`);
    hud.reorient();
    view = boardView(
      track,
      board.layouts[orientation],
      orientation,
      board,
      save.gender,
      debug,
      maps[orientation],
      camera.follow,
    );
    if (moving) {
      facing = view.step(moving.from, moving.to, moving.progress);
    } else {
      view.place(landed, pose, facing);
    }
    syncOverview(true);
  });
  orientationChange.observe(viewport);

  const dialog = find<HTMLDialogElement>(".board-dialog");
  const eventDialog = find<HTMLDialogElement>(
    ".event-dialog:not(.activity-dialog)",
  );
  const activityDialog = find<HTMLDialogElement>(".activity-dialog");
  const roll = find<HTMLButtonElement>("#roll");
  const dice = find(".dice");
  const total = find("#dice-total");
  const notice = find("#notice");
  const quizDialog = find<HTMLDialogElement>(".assessment-dialog");
  const navigation = Array.from(
    app.querySelectorAll<HTMLButtonElement>(
      ".board-controls .actions button, [aria-controls=hud-menu]",
    ),
  );
  syncOverview(true);
  overview.onclick = () => {
    overviewPreference = overview.getAttribute("aria-pressed") !== "true";
    syncOverview();
    hud.closeMenu();
  };

  notice.textContent = message;
  find<HTMLButtonElement>("#save").onclick = () => {
    hud.closeMenu(false);
    orientationChange.disconnect();
    actions.manualSave(save);
  };
  find<HTMLButtonElement>("#export").onclick = () => {
    hud.closeMenu();
    actions.exportSave(save);
  };
  find<HTMLButtonElement>("#home").onclick = () => {
    orientationChange.disconnect();
    actions.home();
  };
  dialog.oncancel =
    eventDialog.oncancel =
    quizDialog.oncancel =
      (event) => event.preventDefault();

  function status() {
    hud.update(save);
  }

  function placePawn(nextPose: "stand" | "win") {
    pose = nextPose;
    landed = save.boardTile;
    view.place(landed, pose, facing);
  }

  async function animateStep(from: number, to: number) {
    if (!reducedMotion) {
      await new Promise<void>((resolve) => {
        const started = performance.now();
        function frame(now: number) {
          const progress = Math.max(
            0,
            Math.min(1, (now - started) / walkStepMs),
          );
          moving = { from, to, progress };
          facing = view.step(from, to, progress);
          if (progress < 1) requestAnimationFrame(frame);
          else resolve();
        }
        frame(started);
      });
    }
    moving = undefined;
    placePawn("stand");
  }

  function prompt(
    title: string,
    detail = "",
    choices = ["確定"],
    stepGrid = false,
  ) {
    find("#board-prompt").textContent = title;
    find(".board-detail").textContent = detail;
    const buttons = find(".board-dialog .actions");
    buttons.classList.toggle("step-options", stepGrid);
    buttons.innerHTML = choices
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
    if (activeDeity(save)?.id === "lost-envoy") {
      // Pick on departure so an expiring deity cannot dictate the next turn.
      if (steps > 0) save = { ...save, nextTile: randomFork(save, routes) };
      return;
    }
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

  async function playEvent() {
    const { save: updated, outcome } = drawEvent(save);
    save = updated;
    status();
    const presentation = eventPresentation(outcome);
    const stage = eventDialog.querySelector<HTMLElement>(".event-stage")!;
    stage.dataset.tone = presentation.tone;
    stage.innerHTML = presentation.art;
    eventDialog.querySelector<HTMLElement>(".event-label")!.textContent =
      presentation.label;
    find("#event-title").textContent = presentation.title;
    find("#event-text").textContent = presentation.text;
    find("#event-result").textContent = presentation.result;
    const offer = find<HTMLButtonElement>('.event-dialog [value="offer"]');
    const confirm = find<HTMLButtonElement>('.event-dialog [value="continue"]');
    offer.hidden = outcome.kind !== "offering";
    offer.disabled =
      outcome.kind !== "offering" || save.cash < deities[outcome.id].price;
    confirm.textContent = outcome.kind === "offering" ? "繼續附身" : "確定";
    if (outcome.kind === "offering" && offer.disabled) {
      find("#event-result").textContent += " ・ 現金不足";
    }
    await new Promise<void>((resolve) => {
      eventDialog.onclose = () => resolve();
      eventDialog.showModal();
    });
    if (outcome.kind === "offering" && eventDialog.returnValue === "offer") {
      save = payOffering(save);
    }
    stage.replaceChildren();
    return outcome.kind === "deity";
  }

  function showDice(values: number[]) {
    dice.innerHTML = values.map((value) => `<span>${value}</span>`).join("");
  }

  async function playQuiz() {
    const attempt = startAssessment("quiz", save.seenQuestionIds);
    await new Promise<void>((resolve) => {
      showAssessment(
        quizDialog,
        attempt,
        save.stats.intellect,
        undefined,
        resolve,
      );
      quizDialog.showModal();
      find(".assessment-question").focus();
    });
    quizDialog.close();
    quizDialog.replaceChildren();
    const correct = scoreAttempt(attempt);
    const reward = quizReward(correct);
    const intellect = Math.min(9999, save.stats.intellect + reward.intellect);
    const gained = intellect - save.stats.intellect;
    save = {
      ...save,
      stats: { ...save.stats, intellect },
      cash: save.cash + reward.cash,
      exams: [...save.exams, { id: "quiz", correct }],
      seenQuestionIds: [
        ...new Set([
          ...save.seenQuestionIds,
          ...attempt.items.map(({ id }) => id),
        ]),
      ],
    };
    status();
    await prompt(
      "小考成績",
      `答對 ${correct} ／ 5 題・智力 ＋${gained}・現金 ＋${reward.cash} 元`,
    );
  }

  async function playClubVisit() {
    if (save.stage !== "junior") {
      const event = drawClubEvent(save);
      if (!event) return;
      const art = sceneArt(event.scene, "senior-girl");
      const choice = await activityPrompt(activityDialog, {
        art,
        speaker: "社團活動",
        title: event.title,
        text: event.text,
        choices: event.choices.map(({ name }) => ({ name })),
        choiceLayout: "club-event",
      });
      const result = settleClubEvent(save, event, choice);
      if (!result) return;
      save = result.save;
      status();
      await activityPrompt(activityDialog, {
        art,
        speaker: "社團活動",
        title: event.title,
        text: result.text,
        details: [result.changes.map(changeText).join("・")],
        choiceLayout: "club-event",
      });
      return;
    }
    const visit = visitClub(save);
    if (!visit) return;
    save = visit.save;
    status();
    await activityPrompt(activityDialog, {
      art: sceneArt(visit.scene, "senior-girl"),
      speaker: "社團學姊",
      title: visit.club.name,
      text: visit.text,
      details: [
        visit.changes.map(changeText).join("・"),
        ...(visit.cash
          ? [changeText({ target: "cash", amount: visit.cash })]
          : []),
      ],
    });
  }

  async function automaticContest() {
    const match = nextMatch(save, "turn");
    if (!match) return;
    save = await playContest(activityDialog, quizDialog, save, match, false);
    status();
    persist();
  }

  async function contestTile() {
    const match = nextMatch(save, "tile");
    if (match) {
      save = await playContest(activityDialog, quizDialog, save, match, true);
    } else {
      await activityPrompt(activityDialog, {
        art: sceneArt("auditorium", "host"),
        speaker: "大賽主持人",
        title: "大賽觀賽",
        text: "這場已經比完啦！你留下來幫忙，把最後一排椅子也排得像頒獎隊伍。",
      });
    }
  }

  async function playTurn() {
    if (roll.disabled || stageFinished(board, save)) return;
    hud.closeMenu(false);
    roll.disabled = true;
    navigation.forEach((button) => (button.disabled = true));
    notice.textContent = "";
    total.textContent = "";
    persist(false);
    const effect = deityTurnEffect(save);
    save = effect.save;
    const draw = beforeRoll(save);
    save = draw.save;
    status();
    if (draw.notice) await prompt(draw.notice);
    const deity = activeDeity(save);
    if (effect.change && deity) {
      await prompt(deities[deity.id].name, changeText(effect.change));
    }

    const count = diceCount(save);
    const choices = stepChoices(save, count);
    let steps: number;
    if (choices.length) {
      showDice([]);
      const choice = await prompt(
        "步數童・指定步數",
        `這回合可以走 ${count}～${count * 6} 步。`,
        choices.map((value) => `${value} 步`),
        true,
      );
      steps = choices[choice];
      total.textContent = `指定 ${steps} 步`;
    } else {
      const values = rollDice(count);
      if (!reducedMotion) {
        showDice([]);
        await playDiceFlight(find(".junior"), find(".board-map"), roll, values);
      }
      showDice(values);
      const points = values.reduce((sum, value) => sum + value, 0);
      steps = walkingSteps(save, points);
      total.textContent =
        deity?.id === "lost-envoy"
          ? `共 ${points} 點・迷途使：走 ${steps} 步`
          : `共 ${points} 點`;
    }

    await chooseRoute(steps);
    walking = steps > 0;
    syncOverview();
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
    walking = false;
    syncOverview();
    const kind = board.tiles[save.boardTile].kind;
    const deityJustArrived = kind === "event" && (await playEvent());
    if (kind === "quiz") await playQuiz();
    if (kind === "club") await playClubVisit();
    if (kind === "contest") await contestTile();
    if (kind === "shop")
      await promptForShop(activityDialog, save, (updated) => {
        save = updated;
        status();
      });
    if (kind === "love") await prompt("愛情", handleLoveTile(save));
    if (kind === "game") save = await playMinigame(activityDialog, save);

    const finished = finishTurn(save, deityJustArrived);
    save = finished.save;
    status();
    persist();
    if (finished.turnaroundStarted)
      await prompt("否極泰來！", "水星逆行已結束。接下來 3 回合為否極泰來。");
    if (stageFinished(board, save)) {
      orientationChange.disconnect();
      actions.complete(save);
      return;
    }
    await automaticContest();
    roll.disabled = false;
    roll.focus();
    navigation.forEach((button) => (button.disabled = false));
  }

  function persist(showNotice = true) {
    try {
      actions.autoSave(save);
      if (showNotice) notice.textContent = "已自動存檔。";
    } catch {
      notice.textContent = "無法自動存檔，請確認瀏覽器允許儲存網站資料。";
    }
  }

  status();
  placePawn("stand");
  roll.onclick = () => void playTurn();
  find("h1").focus({ preventScroll: true });

  async function startBoard() {
    const needsClub = clubChoice(save, board.stage);
    if (!needsClub && !nextMatch(save, "turn")) return;
    hud.closeMenu(false);
    roll.disabled = true;
    navigation.forEach((button) => (button.disabled = true));
    if (needsClub) {
      save = await promptForClub(activityDialog, save, board.stage);
      status();
      persist();
    }
    await automaticContest();
    roll.disabled = false;
    navigation.forEach((button) => (button.disabled = false));
    roll.focus();
  }

  void startBoard();
}
