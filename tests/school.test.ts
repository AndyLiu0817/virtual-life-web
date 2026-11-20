import { describe, expect, it } from "vitest";
import { schoolBoards } from "../src/data/school-board";
import { paverClearance } from "../src/board-clearance";
import highEvents from "../src/data/high-events.json";
import universityEvents from "../src/data/university-events.json";
import { stageFinished } from "../src/game/board";
import { chooseClub, clubChoice } from "../src/game/clubs";
import { nextMatch, settleContest } from "../src/game/contests";
import { drawEvent } from "../src/game/events";
import {
  questionsById,
  remainingAssists,
  startAssessment,
  useAssist,
} from "../src/game/questions";
import { createSave, exportSave, importSave } from "../src/game/saves";
import {
  enterSchool,
  finishEntrance,
  graduate,
  handleLoveTile,
} from "../src/game/school";

const player = chooseClub(
  createSave({
    name: "小晴",
    gender: "girl",
    birthday: { month: 5, day: 13 },
    bloodType: "A",
  }),
  "junior",
  "study",
);

describe("學段棋盤", () => {
  it.each([
    [
      "high",
      25,
      { start: 1, event: 9, shop: 4, game: 9, club: 6, quiz: 5, contest: 2 },
    ],
    [
      "university",
      40,
      {
        start: 1,
        event: 7,
        shop: 4,
        game: 7,
        club: 4,
        quiz: 5,
        contest: 2,
        love: 8,
      },
    ],
  ] as const)("%s 兩種方向共用完整外環及格子 ID", (stage, turns, expected) => {
    const board = schoolBoards[stage];
    const frequencies: Record<string, number> = {};
    for (const { kind } of board.tiles)
      frequencies[kind] = (frequencies[kind] || 0) + 1;
    expect(frequencies).toEqual(expected);
    const total = Object.values(expected).reduce((a, b) => a + b, 0);
    expect(board.tiles).toHaveLength(total);
    expect(board.turns).toBe(turns);
    const save = enterSchool(player, stage);
    expect(stageFinished(board, { ...save, turn: turns - 1 })).toBe(false);
    expect(stageFinished(board, { ...save, turn: turns })).toBe(true);
    const loop = new Set<number>();
    let id = board.start;
    do {
      expect(loop.has(id)).toBe(false);
      loop.add(id);
      id = board.tiles[id].next[0];
    } while (id !== board.start);
    expect(loop.size).toBe(total);
    for (const { cells } of Object.values(board.layouts)) {
      expect(cells).toHaveLength(total);
      expect(new Set(cells.map(String)).size).toBe(total);
      for (const tile of board.tiles) {
        for (const to of tile.next) {
          if (tile.kind === "love")
            expect(board.tiles[to].kind).not.toBe("love");
        }
      }
    }
  });
});

it("聯考十題四難題，智力輔助與作答進度可匯入", () => {
  const high = enterSchool(player, "high");
  const attempt = startAssessment("universityEntrance", []);
  expect(attempt.items).toHaveLength(10);
  expect(
    attempt.items.filter(
      ({ id }) => questionsById.get(id)?.difficulty === "hard",
    ),
  ).toHaveLength(4);
  expect(remainingAssists(attempt, 399)).toBe(3);
  useAssist(attempt, 399, () => 0);
  const item = attempt.items[0];
  expect(questionsById.get(item.id)!.options[item.removed!].correct).toBe(
    false,
  );
  item.answer = questionsById
    .get(item.id)!
    .options.findIndex((option) => option.correct);
  const save = { ...high, turn: 25, entranceAttempt: attempt };
  const restored = importSave(exportSave(save));
  expect(restored).toEqual(save);
  expect(remainingAssists(restored.entranceAttempt!, 399)).toBe(2);
});

it.each([5, 6])("聯考答對 %i 題，寫入學歷、考試與結局", (correct) => {
  const high = {
    ...enterSchool(player, "high"),
    turn: 25,
    boardTile: 7,
    previousTile: 6,
    nextTile: 8,
  };
  const attempt = startAssessment("universityEntrance", []);
  attempt.items.forEach((item, i) => {
    item.answer = questionsById
      .get(item.id)!
      .options.findIndex((option) => option.correct === i < correct);
  });
  const result = finishEntrance(high, attempt);
  expect(result.exams).toEqual([{ id: "universityEntrance", correct }]);
  expect(result.education).toBe("high");
  expect(result.examResultPending).toBe(true);
  if (correct === 6) {
    expect(result).toMatchObject({
      stage: "university",
      ending: null,
      turn: 0,
      boardTile: 0,
      previousTile: null,
      nextTile: null,
    });
  } else {
    expect(result).toMatchObject({
      stage: "earlyExit",
      ending: "universityExamFail",
      hiddenJobUnlock: true,
    });
  }
});

it("畢業保存原始紀錄，愛情格暫時只回傳訊息", () => {
  const university = {
    ...enterSchool(player, "university"),
    turn: 40,
    boardTile: 5,
    cards: ["good"],
    experience: 70,
    retrogradeTurns: 1,
    turnaroundTurns: 2,
    deity: { id: "sky-elder", remainingTurns: 2 },
  };
  const copy = structuredClone(university);
  expect(handleLoveTile(university)).toContain("戀愛系統即將開放");
  expect(university).toEqual(copy);
  expect(graduate(university)).toEqual({
    ...university,
    stage: "graduated",
    education: "university",
    ending: "universityGraduate",
    updatedAt: expect.any(String),
  });
});

it("舊高中存檔從起點換裝，舊落榜仍可讀取，換社只一次", () => {
  const { ending, stageIntroSeen, ...old } = player;
  const loaded = importSave(
    JSON.stringify({
      ...old,
      stage: "high",
      turn: 15,
      boardTile: 3,
      previousTile: 2,
      nextTile: 4,
    }),
  );
  expect(loaded).toMatchObject({
    turn: 0,
    boardTile: 0,
    previousTile: null,
    nextTile: null,
    ending: null,
    stageIntroSeen: [],
  });
  const opted = chooseClub({ ...loaded, stageIntroSeen: ["high"] }, "high");
  expect(opted.clubHistory.at(-1)).toEqual({
    stage: "high",
    clubId: "study",
    visits: 0,
  });
  expect(clubChoice(opted, "high")).toBeUndefined();
  expect(chooseClub(opted, "high", "sports")).toBe(opted);
  expect(importSave(exportSave(opted))).toEqual(opted);
  expect(
    importSave(JSON.stringify({ ...old, stage: "earlyExit" })).ending,
  ).toBe("juniorEarlyExit");
});

it.each([
  ["high", highEvents, 1.25],
  ["university", universityEvents, 1.5],
] as const)(
  "%s 有各 20 則新事件並套用階段倍率",
  (stage, stories, multiplier) => {
    for (const kind of ["good", "bad"] as const) {
      expect(stories[kind]).toHaveLength(20);
      const rolls = [0.8, kind === "good" ? 0 : 0.9, 0.175, 0];
      const result = drawEvent(enterSchool(player, stage), () =>
        rolls.shift()!,
      );
      expect(result.outcome).toMatchObject({
        kind,
        story: { id: stories[kind][3].id },
        change: {
          target: "cash",
          amount: multiplier * (kind === "good" ? 300 : -200),
        },
      });
    }
  },
);

it.each([
  ["high", [13]],
  ["university", [14, 30]],
] as const)("%s 大賽第 %j 回並支援提前參賽", (stage, turns) => {
  let save = enterSchool(player, stage);
  for (const turn of turns) {
    expect(nextMatch({ ...save, turn: turn - 2 }, "turn")).toBeUndefined();
    const match = nextMatch({ ...save, turn: turn - 1 }, "turn")!;
    expect(nextMatch(save, "tile")).toEqual(match);
    save = settleContest(save, match, "style", { score: 450 }, 300)!.save;
    expect(nextMatch({ ...save, turn: turn - 1 }, "turn")).toBeUndefined();
  }
  expect(nextMatch(save, "tile")).toBeUndefined();
});

it("跑道位置與景物重疊是獨立的檢查", () => {
  const layout = schoolBoards.high.layouts.landscape;
  const fakeGround = [
    [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ],
    [
      [47, 61],
      [53, 61],
      [53, 67],
      [47, 67],
    ],
  ] as const;
  const fixture = {
    ...layout,
    road: {
      outlines: [fakeGround[0]],
      obstacles: [fakeGround[1]],
    },
    origin: [50, 54],
    halfWidth: 15,
    halfHeight: 10,
    cells: [
      [0, 0],
      [2, -1],
      [2, -2],
    ],
  } as const;
  expect(
    paverClearance(fixture).map(({ onRoad, hitsScenery }) => ({
      onRoad,
      hitsScenery,
    })),
  ).toEqual([
    { onRoad: true, hitsScenery: true },
    { onRoad: true, hitsScenery: false },
    { onRoad: false, hitsScenery: false },
  ]);
});

it.each(["high", "university"] as const)(
  "%s 橫直版在國中格線上逐格共邊，並避開景物",
  (stage) => {
    const board = schoolBoards[stage];
    for (const orientation of ["landscape", "portrait"] as const) {
      const layout = board.layouts[orientation];
      const junior = schoolBoards.junior.layouts[orientation];
      expect(layout.halfWidth / layout.width).toBeCloseTo(
        junior.halfWidth / junior.width,
        4,
      );
      expect(layout.halfHeight / layout.width).toBeCloseTo(
        junior.halfHeight / junior.width,
        4,
      );
      const clearance = paverClearance(layout);
      expect(clearance).toHaveLength(board.tiles.length);
      expect(
        clearance.filter(({ hitsScenery }) => hitsScenery).map(({ id }) => id),
        orientation,
      ).toEqual([]);
      const directions = board.tiles.map(({ next }, id) => {
        const [column, row] = layout.cells[id];
        const [nextColumn, nextRow] = layout.cells[next[0]];
        expect(Number.isInteger(column) && Number.isInteger(row)).toBe(true);
        const dx = nextColumn - column;
        const dy = nextRow - row;
        expect(Math.abs(dx) + Math.abs(dy), `${orientation} ${id}`).toBe(1);
        return [dx, dy];
      });
      const turns = directions.filter(([dx, dy], i) => {
        const [previousX, previousY] = directions.at(i - 1)!;
        return dx * previousX + dy * previousY === 0;
      });
      expect(turns.length).toBeGreaterThanOrEqual(4);
      for (const { polygon } of clearance)
        for (const [x, y] of polygon) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(layout.width);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(layout.height);
        }
    }
  },
);
