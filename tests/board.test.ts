import { expect, it } from "vitest";
import { juniorBoard as board } from "../src/data/junior";
import { juniorLoop, juniorShortcut } from "../src/data/junior-routes";
import { schoolBoards } from "../src/data/school-board";
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
  type Save,
} from "../src/game/saves";

const opening = createSave({
  gender: "boy",
  name: "小宇",
  birthday: { month: 3, day: 21 },
  bloodType: "A",
});
const hit = () => 0.0499;
const miss = () => 0.05;

it("兩版共用相同路線，每條路只經過斜角網格上的相鄰格", () => {
  expect(juniorLoop).toHaveLength(38);
  expect(juniorShortcut).toHaveLength(6);
  expect(board.tiles.map((tile) => tile.kind).sort()).toEqual(
    [
      "start",
      ...Array(8).fill("event"),
      ...Array(5).fill("story"),
      ...Array(10).fill("game"),
      ...Array(5).fill("club"),
      ...Array(8).fill("quiz"),
      ...Array(3).fill("contest"),
      "fork",
      "fork",
    ].sort(),
  );
  for (const { cells } of Object.values(board.layouts)) {
    expect(cells).toHaveLength(board.tiles.length);
    expect(new Set(cells.map((cell) => cell.join(","))).size).toBe(
      cells.length,
    );
    cells.forEach(([column, row], id) => {
      const neighbors = cells.flatMap(([u, v], other) =>
        Math.abs(u - column) + Math.abs(v - row) === 1 ? [other] : [],
      );
      const connected = board.tiles.flatMap(({ next }, other) =>
        next.includes(id) || board.tiles[id].next.includes(other)
          ? [other]
          : [],
      );
      expect(neighbors).toEqual(connected);
    });
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
  const exit = [39, 40, 41, 14].reduce((save, expected) => {
    expect(directions(board, save)).toEqual([expected]);
    return walkStep(board, save, 1).save;
  }, inner.save);
  expect(directions(board, exit)).toEqual([15]);
  const otherFork: Save = {
    ...opening,
    boardTile: 14,
    previousTile: 22,
    nextTile: 41,
  };
  const back = [41, 40, 39, 17, 4].reduce((save, expected) => {
    const stepped = walkStep(board, save, 1).save;
    expect(stepped.boardTile).toBe(expected);
    return stepped;
  }, otherFork);
  expect(directions(board, back)).toEqual([5]);
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

it("越界位置回起點，失效的岔路連結清除，保留其餘存檔進度", () => {
  const old = {
    ...opening,
    boardTile: 100,
    previousTile: 99,
    nextTile: 101,
    cash: 6400,
    turn: 9,
  };
  expect(importSave(JSON.stringify(old))).toEqual({
    ...old,
    boardTile: 0,
    previousTile: null,
    nextTile: null,
  });
  expect(
    importSave(JSON.stringify({ ...old, boardTile: 14, nextTile: 17 })),
  ).toMatchObject({
    boardTile: 14,
    previousTile: null,
    nextTile: null,
    cash: 6400,
    turn: 9,
  });
});

it.each([
  ["high", [2, 10, 19, 28]],
  ["university", [3, 14, 25, 32]],
] as const)("%s 福利社沿用原格子 ID，橫直共用路線", (stage, ids) => {
  const school = schoolBoards[stage];
  expect(
    school.tiles.flatMap((tile, id) => (tile.kind === "shop" ? [id] : [])),
  ).toEqual(ids);
  for (const id of ids) {
    expect(school.tiles[id].next).toEqual([id + 1]);
    for (const { cells } of Object.values(school.layouts))
      expect(cells[id]).toBeDefined();
  }
});

it.each([
  ["high", 19],
  ["university", 25],
] as const)("舊 %s 存檔沿用原位置並在福利社繼續遊玩", (stage, boardTile) => {
  const { shopPurchases, clubEventHistory, ...oldSave } = opening;
  const imported = importSave(
    JSON.stringify({
      ...oldSave,
      stage,
      boardTile,
      previousTile: boardTile - 1,
      nextTile: boardTile + 1,
    }),
  );
  expect(imported).toMatchObject({
    boardTile,
    previousTile: boardTile - 1,
    nextTile: boardTile + 1,
    shopPurchases: [],
    clubEventHistory: [],
  });
  expect(schoolBoards[stage].tiles[imported.boardTile].kind).toBe("shop");
});
