import { expect, it } from "vitest";
import {
  chooseClub,
  clubChoice,
  clubIds,
  clubs,
  visitClub,
} from "../src/game/clubs";
import {
  championLine,
  compareContestScores,
  contestRank,
  nextMatch,
  outfitBonuses,
  settleContest,
} from "../src/game/contests";
import { allowsAssists, drawQuestions } from "../src/game/questions";
import {
  createSave,
  exportSave,
  importSave,
  type Save,
} from "../src/game/saves";

const player = createSave({
  name: "小晴",
  gender: "girl",
  birthday: { month: 5, day: 13 },
  bloodType: "A",
});

it.each(clubIds)("%s 主副參數、現金機率邊界、造訪次數及交替場景", (id) => {
  const save = chooseClub(player, "junior", id);
  const { main, sub } = clubs[id];
  const first = visitClub(save, () => 0.0999)!;
  expect(first.save.stats).toEqual({
    ...save.stats,
    [main]: save.stats[main] + 12,
    [sub]: save.stats[sub] + 6,
  });
  expect(first.cash).toBe(200);
  expect(first.save.cash).toBe(save.cash + 200);
  expect(first.scene).toBe("clubroom");
  const second = visitClub(first.save, () => 0.1)!;
  expect(second.cash).toBe(0);
  expect(second.save.cash).toBe(first.save.cash);
  expect(second.scene).toBe("field");
  expect(second.save.clubHistory).toEqual([
    { stage: "junior", clubId: id, visits: 2 },
  ]);
});

it("國中必選，高中與大學可各選一次，略過就沿用現有社團", () => {
  expect(chooseClub(player, "junior")).toBe(player);
  expect(chooseClub(player, "high", "study")).toBe(player);
  const junior = visitClub(
    chooseClub(player, "junior", "study"),
    () => 0.5,
  )!.save;
  const high = { ...junior, stage: "high" } satisfies Save;
  expect(clubChoice(high, "high")?.current).toBe("study");
  const switched = chooseClub(high, "high", "sports");
  expect(clubChoice(switched, "high")).toBeUndefined();
  expect(chooseClub(switched, "high", "drama")).toBe(switched);
  const university = { ...switched, stage: "university" } satisfies Save;
  expect(clubChoice(university, "university")?.current).toBe("sports");
  const kept = chooseClub(university, "university");
  expect(kept.clubHistory).toEqual([
    { stage: "junior", clubId: "study", visits: 1 },
    { stage: "high", clubId: "sports", visits: 0 },
    { stage: "university", clubId: "sports", visits: 0 },
  ]);
  expect(chooseClub(kept, "university", "drama")).toBe(kept);
});

it("自動開賽在第 8 回合，提前參賽會取消同場自動賽及重複獎勵", () => {
  expect(nextMatch({ ...player, turn: 6 }, "turn")).toBeUndefined();
  const match = nextMatch({ ...player, turn: 7 }, "turn")!;
  expect(match).toEqual({ stage: "junior", matchNumber: 1 });
  expect(nextMatch(player, "tile")).toEqual(match);
  const { save } = settleContest(player, match, "style", { score: 100 }, 180)!;
  expect(nextMatch({ ...save, turn: 7 }, "turn")).toBeUndefined();
  expect(nextMatch(save, "tile")).toBeUndefined();
  expect(
    settleContest(save, match, "style", { score: 190 }, 180),
  ).toBeUndefined();
});

it("高中第 13 回合及大學第 14、30 回合共用排程", () => {
  const high = { ...player, stage: "high", turn: 11 } satisfies Save;
  expect(nextMatch(high, "turn")).toBeUndefined();
  expect(nextMatch({ ...high, turn: 12 }, "turn")).toEqual({
    stage: "high",
    matchNumber: 1,
  });
  const college = { ...player, stage: "university", turn: 12 } satisfies Save;
  expect(nextMatch(college, "turn")).toBeUndefined();
  expect(nextMatch({ ...college, turn: 13 }, "turn")).toEqual({
    stage: "university",
    matchNumber: 1,
  });
  const { save } = settleContest(
    college,
    nextMatch(college, "tile")!,
    "rhythm",
    { score: 90 },
    90,
  )!;
  expect(nextMatch({ ...save, turn: 13 }, "turn")).toBeUndefined();
  expect(nextMatch({ ...save, turn: 28 }, "turn")).toBeUndefined();
  expect(nextMatch({ ...save, turn: 29 }, "turn")).toEqual({
    stage: "university",
    matchNumber: 2,
  });
  expect(nextMatch(save, "tile")).toEqual({
    stage: "university",
    matchNumber: 2,
  });
});

it("冠軍線浮動範圍及名次門檻含等號", () => {
  expect(championLine("junior", "trivia", () => 0)).toBe(7.6);
  expect(championLine("high", "style", () => 0.5)).toBe(300);
  expect(championLine("university", "rhythm", () => 1 - Number.EPSILON)).toBe(
    94.5,
  );
  expect(championLine("junior", "trivia", () => 1 - Number.EPSILON)).toBe(8.4);
  expect(
    [200, 199.99, 170, 169.99, 140, 139.99].map((score) =>
      contestRank({ score }, 200),
    ),
  ).toEqual([1, 2, 2, 3, 3, 4]);
  expect(contestRank({ score: 70.07 }, 100.1)).toBe(3);
});

it.each([
  [8, 1, 4500, 60],
  [7, 2, 2700, 40],
  [6, 3, 1500, 25],
  [5, 4, 500, 8],
])(
  "答對 %i 題得第 %i 名的對應獎勵，護心獅加兩成",
  (score, rank, cash, stat) => {
    const match = nextMatch(player, "tile")!;
    const performance = { score, elapsedMs: 1234 };
    const regular = settleContest(player, match, "trivia", performance, 8)!;
    expect(regular).toMatchObject({ rank, cash, stat, target: "intellect" });
    const protectedPlayer = {
      ...player,
      deity: { id: "guard-lion", remainingTurns: 1 },
    };
    expect(
      settleContest(protectedPlayer, match, "trivia", performance, 8),
    ).toMatchObject({
      rank,
      cash: Math.round(cash * 1.2),
      stat: Math.round(stat * 1.2),
    });
  },
);

it("可匯回社團經歷、分數、項目、場次、名次和作答時間", () => {
  const visited = visitClub(
    chooseClub(player, "junior", "study"),
    () => 0.5,
  )!.save;
  const { save } = settleContest(
    visited,
    nextMatch(visited, "tile")!,
    "trivia",
    { score: 9, elapsedMs: 1234 },
    8,
  )!;
  const restored = importSave(exportSave(save));
  expect(restored.clubHistory).toEqual([
    { stage: "junior", clubId: "study", visits: 1 },
  ]);
  expect(restored.competitions).toEqual([
    {
      stage: "junior",
      matchNumber: 1,
      event: "trivia",
      score: 9,
      rank: 1,
      elapsedMs: 1234,
    },
  ]);
  expect(nextMatch(restored, "tile")).toBeUndefined();
});

it("搶答同分用時短者優先，抽十題且無輔助，穿搭加分每場重洗", () => {
  const questions = drawQuestions("contestTrivia", [], () => 0.5);
  expect(new Set(questions.map(({ id }) => id)).size).toBe(10);
  expect(allowsAssists("contestTrivia")).toBe(false);
  expect(
    compareContestScores(
      { score: 9, elapsedMs: 300 },
      { score: 9, elapsedMs: 500 },
    ),
  ).toBeLessThan(0);
  expect(
    compareContestScores(
      { score: 8, elapsedMs: 100 },
      { score: 9, elapsedMs: 500 },
    ),
  ).toBeGreaterThan(0);
  expect(outfitBonuses(() => 0)).toEqual([20, 40, 0]);
  expect(outfitBonuses(() => 0.99)).toEqual([0, 20, 40]);
});
