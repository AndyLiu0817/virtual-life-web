import { expect, it } from "vitest";
import { juniorBoard as board } from "../src/data/junior";
import {
  beforeRoll,
  diceCount,
  directions,
  finishTurn,
  rollDice,
  stageFinished,
  walkStep,
} from "../src/game/board";
import {
  createSave,
  exportSave,
  importSave,
  saveStorage,
} from "../src/game/saves";

const opening = createSave({
  gender: "boy",
  name: "小宇",
  birthday: { month: 3, day: 21 },
  bloodType: "A",
});
const hit = () => 0.0499;
const miss = () => 0.05;

it("國中兩版共用 18 格及指定種類", () => {
  expect(board.tiles.map((tile) => tile.kind).sort()).toEqual(
    [
      "start",
      ...Array(5).fill("event"),
      ...Array(4).fill("game"),
      ...Array(2).fill("club"),
      ...Array(3).fill("quiz"),
      "contest",
      "fork",
      "fork",
    ].sort(),
  );
  for (const tile of board.tiles) {
    for (const orientation of ["landscape", "portrait"] as const) {
      const [x, y] = tile[orientation];
      const { width, height } = board.layouts[orientation];
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(width);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(height);
    }
    expect(tile.next.every((id) => board.tiles[id])).toBe(true);
  }
});

it("正常擲兩顆，水星逆行擲一顆，每顆為 1 至 6", () => {
  expect(diceCount(opening)).toBe(2);
  expect(rollDice(2, () => 0)).toEqual([1, 1]);
  expect(rollDice(2, () => 0.9999)).toEqual([6, 6]);
  const { save } = beforeRoll(opening, hit);
  expect(diceCount(save)).toBe(1);
  expect(rollDice(1, () => 0)).toEqual([1]);
  expect(rollDice(1, () => 0.9999)).toEqual([6]);
});

it("5% 門檻，逆行共三回合，期間再中不延長並接續三回合泰來", () => {
  expect(beforeRoll(opening, miss).save).toBe(opening);
  let { save } = beforeRoll(opening, hit);
  expect(save.retrogradeTurns).toBe(3);
  expect(save.retrogradeRepeated).toBe(false);
  save = finishTurn(save).save;
  save = beforeRoll(save, hit).save;
  expect(save.retrogradeTurns).toBe(2);
  expect(save.retrogradeRepeated).toBe(true);
  expect(save.turnaroundTurns).toBe(0);
  save = finishTurn(save).save;
  save = beforeRoll(save, miss).save;
  expect(diceCount(save)).toBe(1);
  const finished = finishTurn(save);
  expect(finished.turnaroundStarted).toBe(true);
  save = finished.save;
  expect(save).toMatchObject({
    retrogradeTurns: 0,
    retrogradeRepeated: false,
    turnaroundTurns: 3,
  });
  expect(diceCount(save)).toBe(2);
  for (const turns of [2, 1, 0]) {
    save = finishTurn(beforeRoll(save, miss).save).save;
    expect(save.turnaroundTurns).toBe(turns);
  }
});

it("逆行期間沒有再次抽中時直接回到正常狀態", () => {
  let { save } = beforeRoll(opening, hit);
  for (let index = 0; index < 3; index++) save = finishTurn(save).save;
  expect(save).toMatchObject({ retrogradeTurns: 0, turnaroundTurns: 0 });
});

it("經過與停在起點分別加 200 與 1,000，且不重複領取", () => {
  const prior = { ...opening, boardTile: 16 };
  const pass = walkStep(board, prior, 2);
  expect(pass).toMatchObject({
    save: { boardTile: 0, cash: 5200 },
    steps: 1,
    reward: 200,
  });
  expect(walkStep(board, pass.save, 1).save.cash).toBe(5200);
  expect(walkStep(board, prior, 1)).toMatchObject({
    save: { boardTile: 0, cash: 6000 },
    steps: 0,
    reward: 1000,
  });
});

it("岔路保留剩餘步數，可走外圈或雙向捷徑", () => {
  const fork = walkStep(board, { ...opening, boardTile: 3 }, 4);
  expect(fork.steps).toBe(3);
  expect(directions(board, fork.save)).toEqual([5, 17]);
  const outer = walkStep(board, { ...fork.save, nextTile: 5 }, fork.steps);
  expect(outer.save.boardTile).toBe(5);
  const inner = walkStep(board, { ...fork.save, nextTile: 17 }, fork.steps);
  expect(inner).toMatchObject({
    save: { boardTile: 17, nextTile: null },
    steps: 2,
  });
  const exit = walkStep(board, inner.save, inner.steps);
  expect(exit).toMatchObject({ save: { boardTile: 14 }, steps: 1 });
  expect(directions(board, exit.save)).toEqual([15]);
  const otherFork = {
    ...opening,
    boardTile: 14,
    previousTile: 13,
    nextTile: 17,
  };
  const back = walkStep(board, otherFork, 2);
  expect(walkStep(board, back.save, back.steps).save.boardTile).toBe(4);
});

it("完成第 15 回合才結束", () => {
  let save = opening;
  for (let turn = 1; turn <= 15; turn++) {
    expect(stageFinished(board, save)).toBe(false);
    save = finishTurn(save).save;
    expect(save.turn).toBe(turn);
  }
  expect(stageFinished(board, save)).toBe(true);
});

it("舊存檔補上起點，新存檔保留格子、岔路選擇、回合與狀態", () => {
  const legacy = JSON.parse(exportSave(opening));
  for (const key of [
    "boardTile",
    "previousTile",
    "nextTile",
    "retrogradeRepeated",
  ])
    delete legacy[key];
  expect(importSave(JSON.stringify(legacy))).toEqual(opening);
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  };
  const retrograde = {
    ...opening,
    boardTile: 4,
    previousTile: 3,
    nextTile: 17,
    turn: 6,
    retrogradeTurns: 1,
    retrogradeRepeated: true,
  };
  saveStorage(storage).write(0, retrograde);
  const restored = saveStorage(storage).read(0)!;
  expect(restored).toEqual(retrograde);
  expect(walkStep(board, restored, 1).save.boardTile).toBe(17);
  const turnaround = finishTurn(restored).save;
  saveStorage(storage).write(0, turnaround);
  expect(saveStorage(storage).read(0)).toEqual(turnaround);
  expect(turnaround.turnaroundTurns).toBe(3);
});
