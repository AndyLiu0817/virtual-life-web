import heroBoy from "../art/hero_boy_uni_final.jpg";
import heroGirl from "../art/hero_girl_uni_final.jpg";
import { openAudioDialog, playEffect } from "./audio";
import {
  chenxiBoard,
  districtLabel,
  districtTileIds,
} from "./data/chenxi-board";
import { jobByName, jobs, type ChenxiJob } from "./data/chenxi-jobs";
import { rollDice } from "./game/board";
import {
  canRollChenxi,
  changeJob,
  chenxiStep,
  finishChenxiTurn,
  invest,
  jobRestriction,
  metroDestination,
  paySalary,
  progress,
  promotion,
  propertyCost,
  rideMetro,
  stationName,
  stubNotice,
} from "./game/chenxi";
import { STAT_LABELS } from "./game/opening";
import type { Save } from "./game/saves";
import "./chenxi-view.css";

interface CityControls {
  app: HTMLElement;
  prompt(title: string, detail?: string, choices?: string[]): Promise<number>;
  roll: HTMLButtonElement;
  debug: boolean;
  persist(showNotice?: boolean): void;
  getSave(): Save;
  update(save: Save): void;
  place(): void;
  animateStep(from: number, to: number): Promise<void>;
  follow(active: boolean): void;
  lock(active: boolean): void;
  dice(values: number[]): Promise<void>;
}

const money = (n: number) => `${n.toLocaleString("zh-TW")} 元`;
const title = (save: Save) =>
  jobByName(save.chenxi.job).titles[save.chenxi.jobLevel - 1];
const exhausted = "回合已用盡，失敗結局之後開放";

function requirements(job: ChenxiJob) {
  if (job.stats)
    return job.stats.map((key) => STAT_LABELS[key]).join("、") + "各 500";
  if (job.experience)
    return (
      job.experience
        .map(([name, level]) => `${name}第 ${level} 級`)
        .join("、") + `（任 ${job.required} 種）`
    );
  if (job.finalRequirements) {
    const { jobs, level, allStats, cash } = job.finalRequirements;
    return `任 ${jobs} 種靈能職業第 ${level} 級、四維各 ${allStats}、現金 ${money(cash)}`;
  }
  return "";
}

export function bindChenxiTurns(controls: CityControls) {
  const { app, prompt, getSave, update, persist, roll } = controls;
  const tree = document.createElement("dialog");
  tree.className = "board-dialog chenxi-tree";
  tree.setAttribute("aria-labelledby", "chenxi-tree-title");
  app.querySelector(".stage")!.append(tree);
  app.querySelector<HTMLButtonElement>("#job-tree")!.onclick = () => {
    const save = getSave();
    const tiers = ["起始", "第一層", "第二層", "第三層", "靈能", "最終職業"];
    tree.innerHTML = `<form method="dialog"><h2 id="chenxi-tree-title">晨曦市轉職樹</h2>
      <button autofocus class="action">關閉</button>
      ${tiers
        .map(
          (tier, index) =>
            `<section><h3>${tier}</h3><ul>${jobs
              .filter(({ tier }) => tier === index)
              .map((job) => {
                const restriction = jobRestriction(save, job);
                const status =
                  job.name === save.chenxi.job
                    ? "現職"
                    : restriction || "已解鎖";
                return `<li><strong>${job.name}</strong> <span>${status}</span>
        ${job.tier === 4 && save.ending === "universityExamFail" && job.examLocked ? "<span>聯考未錄取，前置職業受限</span>" : ""}
        ${requirements(job) ? `<small>${requirements(job)}</small>` : ""}</li>`;
              })
              .join("")}</ul></section>`,
        )
        .join("")}</form>`;
    openAudioDialog(tree);
  };

  async function work() {
    const before = getSave();
    const pay = paySalary(before);
    update(pay.save);
    const available = jobs.filter(
      (job) => job.name !== before.chenxi.job && !jobRestriction(pay.save, job),
    );
    const detail = pay.repaid
      ? `抵債 ${money(pay.repaid)}，入帳 ${money(pay.received)}。`
      : "";
    const choice = await prompt(
      `${title(before)}・薪水 ${money(pay.gross)}`,
      detail,
      ["轉職", "不轉職、看升遷"],
    );
    if (choice === 0) {
      const index = await prompt(
        "選擇新職業",
        available.length ? "轉職後從第 1 級開始。" : "目前沒有符合條件的職業。",
        [...available.map(({ name }) => name), "返回升遷"],
      );
      if (available[index]) {
        const changed = changeJob(getSave(), available[index]);
        update(changed);
        await prompt(`轉職成功・${title(changed)}`);
        return;
      }
    }
    const result = promotion(getSave(), pay.gross);
    update(result.save);
    const labels = {
      up: "升職",
      down: "降職",
      same: "職級維持",
      bonus: "績優獎金",
    };
    await prompt(
      `${labels[result.result]}・${title(result.save)}`,
      "bonus" in result && result.bonus
        ? `獎金 ${money(result.bonus.gross)}，入帳 ${money(result.bonus.received)}。`
        : "",
    );
  }

  async function property() {
    const save = getSave();
    const tile = save.boardTile;
    const name = districtLabel(tile);
    const existing = save.chenxi.districts[tile];
    if (existing && existing.owner !== "player") return;
    const cost = propertyCost(save, tile);
    if (cost === null) {
      await prompt(name, "這塊街區已蓋到第 3 級。");
      return;
    }
    if (save.cash < cost) {
      await prompt(name, `需要 ${money(cost)}，目前現金不足。`);
      return;
    }
    const action = existing ? "加蓋" : "買下";
    if (
      (await prompt(name, `${action}需要 ${money(cost)}。`, [
        action,
        "放棄",
      ])) !== 0
    )
      return;
    const updated = invest(save, tile);
    update(updated);
    await prompt(
      `${action}完成・${name}`,
      `第 ${updated.chenxi.districts[tile].level} 級`,
    );
  }

  async function walk(steps: number) {
    controls.follow(true);
    while (steps > 0) {
      const save = getSave();
      const move = chenxiStep(save, steps);
      steps = move.steps;
      update(move.save);
      await controls.animateStep(save.boardTile, move.save.boardTile);
      if (move.reward) await prompt(`領取股利 ${money(move.reward)}`);
    }
    controls.follow(false);
  }

  async function landing() {
    const save = getSave();
    const tile = save.boardTile;
    const kind = chenxiBoard.tiles[tile].kind;
    if (kind === "job") await work();
    if (kind === "district") await property();
    if (kind === "metro") {
      const destination = metroDestination(tile)!;
      if (
        (await prompt(
          stationName(tile),
          `要搭捷運前往${stationName(destination)}嗎？`,
          ["前往", "留在本站"],
        )) !== 0
      )
        return;
      update(rideMetro(save));
      controls.place();
      if (save.chenxi.job !== "空服員") return;
      const steps = await prompt(
        stationName(destination),
        "空服員可以接著走 1～2 格。",
        ["結束本回合", "走 1 格", "走 2 格"],
      );
      if (steps === 0) return;
      await walk(steps);
      await landing();
    }
    const stub = stubNotice(tile);
    if (stub) await prompt(stub);
  }

  async function checkProgress() {
    const save = getSave();
    const remaining = chenxiBoard.turns - save.turn;
    const conditions = progress(save);
    if (
      !save.chenxi.conditionsAnnounced &&
      conditions.every(({ value, target }) => value >= target)
    ) {
      update({
        ...save,
        chenxi: { ...save.chenxi, conditionsAnnounced: true },
      });
      persist(false);
      await prompt("過關條件已達成，魔王戰之後開放");
    }
    if (remaining === 10 || remaining === 5)
      await prompt(
        `剩下 ${remaining} 回`,
        conditions
          .map(
            ({ label, value, target }) =>
              `${label}${value >= target ? "已達成" : `還差 ${target - value}`}`,
          )
          .join("、"),
      );
    if (!remaining) await prompt(exhausted);
  }

  async function playChenxiOpening() {
    const portrait = document.createElement("img");
    portrait.className = "chenxi-intro-portrait";
    portrait.alt = "";
    portrait.src = getSave().gender === "girl" ? heroGirl : heroBoy;
    app.querySelector("#board-prompt")!.before(portrait);
    try {
      await prompt("開場劇情之後開放");
    } finally {
      portrait.remove();
    }
  }

  let busy = false;
  async function run(work: () => Promise<void>, endsTurn = true) {
    if (busy || !canRollChenxi(getSave())) return;
    busy = true;
    controls.lock(true);
    try {
      await work();
      if (endsTurn) {
        update(finishChenxiTurn(getSave()));
        playEffect("turn");
      }
      persist();
      if (endsTurn) await checkProgress();
    } finally {
      busy = false;
      controls.lock(false);
      roll.disabled = !canRollChenxi(getSave());
      if (!roll.disabled) roll.focus();
    }
  }
  roll.onclick = () =>
    void run(async () => {
      const draw = async () => {
        const values = rollDice(2);
        playEffect("dice_roll");
        await controls.dice(values);
        return values.reduce((sum, n) => sum + n, 0);
      };
      let steps = await draw();
      const save = getSave();
      const turn = save.turn + 1;
      const last = save.chenxi.lastRerollTurn;
      if (
        save.chenxi.job === "職業運動員" &&
        turn % 5 === 0 &&
        last !== turn &&
        (await prompt("職業運動員・重擲", `已擲出 ${steps} 點。`, [
          "保留",
          "重擲一次",
        ])) === 1
      ) {
        update({ ...save, chenxi: { ...save.chenxi, lastRerollTurn: turn } });
        steps = await draw();
      }
      await walk(steps);
      await landing();
    });

  if (controls.debug)
    for (const button of app.querySelectorAll<HTMLButtonElement>(
      "[data-chenxi-debug]",
    )) {
      button.onclick = () =>
        void run(async () => {
          let save = getSave();
          const kind = button.dataset.chenxiDebug!;
          const own = districtTileIds.find(
            (id) => save.chenxi.districts[id]?.owner === "player",
          );
          const open = districtTileIds.find((id) => !save.chenxi.districts[id]);
          if (kind === "build" && own === undefined && open !== undefined)
            save = invest({ ...save, cash: Math.max(save.cash, 200000) }, open);
          const target = {
            job: 2,
            buy: open,
            build: own ?? open,
            metro: 9,
            stub: 10,
          }[kind];
          if (target === undefined && !["10", "5", "0"].includes(kind)) return;
          if (target === undefined) {
            update({ ...save, turn: chenxiBoard.turns - Number(kind) - 1 });
            return;
          }
          update({
            ...save,
            boardTile: target,
            previousTile: null,
            nextTile: null,
          });
          controls.place();
          await landing();
        });
    }

  // Opening scene insertion point. Persist acknowledgement before the first roll.
  if (!getSave().chenxi.introSeen) {
    void run(async () => {
      await playChenxiOpening();
      const save = getSave();
      update({ ...save, chenxi: { ...save.chenxi, introSeen: true } });
    }, false);
  }
  if (!canRollChenxi(getSave())) {
    roll.disabled = true;
    app.querySelector("#notice")!.textContent = exhausted;
  }
}
