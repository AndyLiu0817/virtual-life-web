import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { schoolBoards } from "../src/data/school-board";
import { juniorLoop, juniorShortcut } from "../src/data/junior-routes";
import {
  collectStory,
  elementaryIds,
  galleryRecord,
  restartStage,
  snapshotStage,
  stageStory,
  story,
  storyEnding,
} from "../src/game/main-story";
import { createSave, exportSave, importSave } from "../src/game/saves";

const player = createSave({
  name: "小晴",
  gender: "girl",
  birthday: { month: 5, day: 13 },
  bloodType: "A",
});

it("十九個碎片都有唯一 ID、指定學段順序與本文", () => {
  expect(story).toHaveLength(19);
  expect(new Set(story.map(({ id }) => id)).size).toBe(19);
  for (const [stage, count] of [
    ["elementary", 3],
    ["junior", 5],
    ["high", 6],
    ["university", 5],
  ] as const) {
    const fragments = stageStory(stage);
    expect(fragments.map(({ order }) => order)).toEqual(
      Array.from({ length: count }, (_, i) => i + 1),
    );
    expect(
      fragments.every(({ title, text, hook }) => title && text && hook),
    ).toBe(true);
  }
});

it.each([
  ["junior", [1, 9, 18, 26, 35], 42],
  ["high", [1, 7, 14, 22, 25, 35], 36],
  ["university", [1, 10, 18, 28, 37], 38],
] as const)("%s 原路線上的指定故事格", (stage, ids, size) => {
  const board = schoolBoards[stage];
  expect(board.tiles).toHaveLength(size);
  expect(
    board.tiles.flatMap(({ kind }, id) => (kind === "story" ? [id] : [])),
  ).toEqual(ids);
  if (stage === "junior") {
    const routes = board.tiles.map(() => [] as number[]);
    juniorLoop.forEach((id, i) =>
      routes[id].push(juniorLoop[(i + 1) % juniorLoop.length]),
    );
    juniorShortcut.slice(1).forEach((id, i) => {
      routes[juniorShortcut[i]].push(id);
      routes[id].push(juniorShortcut[i]);
    });
    expect(board.tiles.map(({ next }) => next)).toEqual(routes);
  } else {
    expect(board.tiles.map(({ next }) => next)).toEqual(
      Array.from({ length: size }, (_, i) => [(i + 1) % size]),
    );
  }
});

it("故事格依序收集，同格與集滿只增加經驗，不動四維、現金與收集卡", () => {
  let save = { ...player, cards: ["example"] };
  const ids = [35, 26, 18, 9, 1];
  for (const [i, id] of ids.entries()) {
    const visit = collectStory(save, "junior", id);
    expect(visit.fragment?.id).toBe(`junior-${i + 1}`);
    const repeat = collectStory(visit.save, "junior", id);
    expect(repeat.fragment).toBeUndefined();
    expect(repeat.save.experience - save.experience).toBe(6);
    save = repeat.save;
  }
  expect(collectStory(save, "junior", 2).fragment).toBeUndefined();
  expect(save).toMatchObject({
    experience: 30,
    stats: player.stats,
    cash: player.cash,
    cards: ["example"],
  });
});

it("快照維持非巢狀，重玩還原資源與起點、清空該學段碎片並保留考試", () => {
  const initial = snapshotStage({ ...player, storyFragments: elementaryIds });
  const high = snapshotStage({
    ...initial,
    stage: "high",
    storyFragments: [...elementaryIds, "junior-1"],
  });
  const moved = collectStory(
    { ...high, turn: 18, boardTile: 7, cash: 1234 },
    "high",
    7,
  ).save;
  const late = importSave(
    exportSave({ ...moved, exams: [{ id: "universityEntrance", correct: 7 }] }),
  );
  const replay = restartStage(late, "high")!;
  expect(replay).toMatchObject({
    boardTile: 0,
    turn: 0,
    cash: high.cash,
    stats: high.stats,
    storyTilesUsed: [],
    storyFragments: [...elementaryIds, "junior-1"],
    exams: late.exams,
  });
  expect(replay.stageSnapshots).toEqual(high.stageSnapshots);
  expect(replay.stageSnapshots.high).not.toHaveProperty("stageSnapshots");
  expect(restartStage(replay, "university")).toBeUndefined();
});

it("舊版存檔自動補國小而保留版本 1，畫廊遇到讀寫失敗仍使用本局資料", () => {
  const { stageSnapshots, storyFragments, storyTilesUsed, ...old } = player;
  expect(importSave(JSON.stringify(old))).toMatchObject({
    version: 1,
    storyFragments: elementaryIds,
    storyTilesUsed: [],
    stageSnapshots: {},
  });
  expect(
    galleryRecord(() => {
      throw Error();
    }, elementaryIds),
  ).toMatchObject({ seen: elementaryIds, unavailable: true });
  expect(
    galleryRecord(
      () => ({
        getItem: () => null,
        setItem: () => {
          throw Error();
        },
      }),
      elementaryIds,
      true,
    ),
  ).toMatchObject({ seen: elementaryIds, unavailable: true });
  let record = "";
  const storage = () => ({
    getItem: () => record || null,
    setItem: (_key: string, value: string) => {
      record = value;
    },
  });
  galleryRecord(storage, ["junior-1"], true);
  galleryRecord(storage, elementaryIds, true);
  expect(galleryRecord(storage).seen).toEqual([...elementaryIds, "junior-1"]);
});

it("只有畢業且 19 片齊全才是真結局，其餘結局使用各自的故事加句", () => {
  const graduate = {
    ...player,
    stage: "graduated",
    ending: "universityGraduate",
    storyFragments: story.map(({ id }) => id),
  } as const;
  expect(storyEnding(graduate)).toBe("true");
  expect(
    storyEnding({
      ...graduate,
      storyFragments: graduate.storyFragments.slice(0, 18),
    }),
  ).toBe("bittersweet");
  expect(
    storyEnding({
      ...player,
      stage: "earlyExit",
      ending: "universityExamFail",
    }),
  ).toBe("阿公還在等郵差，你也還在等一個答案。");
  expect(
    storyEnding({ ...player, stage: "earlyExit", ending: "juniorEarlyExit" }),
  ).toBe("牆上的地圖，還有好多圖釘沒插上。");
});

it.each([
  [
    "junior",
    "92a97b58b4bfa2d758de7551381860eccaea881f538869e1600efb710c8e0f41",
  ],
  ["high", "45563293f73434477b5da6bbc92fddedb2dce88c892a2787c0f562ea9c583eb4"],
  [
    "university",
    "09891f4177843433e3b2fb7a151f8234c2bfece6f2b1f04db7a36514dcefd63a",
  ],
] as const)(
  "%s 版面座標與路線保留 main faeddc7 的幾何資料",
  (stage, baseline) => {
    const { layouts, tiles } = schoolBoards[stage];
    const geometry = [layouts, tiles.map(({ next }) => next)];
    const checksum = createHash("sha256")
      .update(JSON.stringify(geometry))
      .digest("hex");
    expect(checksum).toBe(baseline);
  },
);
