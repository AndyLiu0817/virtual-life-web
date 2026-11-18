import { expect, test } from "vitest";
import {
  mathQuestion,
  memoryDeck,
  minigameIds,
  minigameTier,
  pickMinigame,
  settleMinigame,
  type Minigame,
} from "../src/game/minigames";
import { createSave, exportSave, importSave } from "../src/game/saves";

const player = createSave({
  name: "小晴",
  gender: "girl",
  birthday: { month: 5, day: 13 },
  bloodType: "A",
});

test.each([
  ["rhythm", 69.9, 70, 94.9, 95],
  ["math", 7, 8, 11, 12],
  ["shoot", 14, 15, 22, 23],
] as const)(
  "%s classifies both tier boundaries",
  (game, fail, normal, close, excellent) => {
    expect(
      [fail, normal, close, excellent].map((score) =>
        minigameTier(game, { score }),
      ),
    ).toEqual(["未達", "普通", "普通", "優秀"]);
  },
);

test("memory requires eight pairs and uses the inclusive 60- and 40-second limits", () => {
  expect(minigameTier("memory", { score: 7, elapsedMs: 20_000 })).toBe("未達");
  expect(minigameTier("memory", { score: 8, elapsedMs: 60_001 })).toBe("未達");
  expect(minigameTier("memory", { score: 8, elapsedMs: 60_000 })).toBe("普通");
  expect(minigameTier("memory", { score: 8, elapsedMs: 40_001 })).toBe("普通");
  expect(minigameTier("memory", { score: 8, elapsedMs: 40_000 })).toBe("優秀");
});

test.each([
  [7, 3, 100, 4, 120],
  [8, 12, 400, 14, 480],
  [12, 18, 600, 22, 720],
])(
  "awards score %d with the shared lion bonus",
  (score, stat, cash, boostedStat, boostedCash) => {
    const lion = { id: "guard-lion", remainingTurns: 1 };
    expect(settleMinigame(player, "math", { score })).toMatchObject({
      stat,
      cash,
    });
    expect(
      settleMinigame({ ...player, deity: lion }, "math", { score }),
    ).toMatchObject({ stat: boostedStat, cash: boostedCash });
    expect(
      settleMinigame(
        { ...player, deity: { ...lion, remainingTurns: 0 } },
        "math",
        { score },
      ),
    ).toMatchObject({ stat, cash });
  },
);

test("caps only the game's main stat and records the score and stage", () => {
  const nearCap = {
    ...player,
    stage: "high" as const,
    stats: { ...player.stats, fitness: 9998 },
  };
  const { save, stat } = settleMinigame(nearCap, "shoot", { score: 25 });
  expect(stat).toBe(1);
  expect(save.stats).toEqual({ ...nearCap.stats, fitness: 9999 });
  expect(save.cash).toBe(nearCap.cash + 600);
  expect(importSave(exportSave(save)).minigames).toEqual([
    { stage: "high", game: "shoot", score: 25, tier: "優秀" },
  ]);
  const legacy: Partial<typeof player> = { ...player };
  delete legacy.minigames;
  expect(importSave(JSON.stringify(legacy)).minigames).toEqual([]);
  const memory = settleMinigame(save, "memory", {
    score: 8,
    elapsedMs: 31_000,
  });
  expect(importSave(exportSave(memory.save)).minigames[1]).toEqual({
    stage: "high",
    game: "memory",
    score: 8,
    elapsedMs: 31_000,
    tier: "優秀",
  });
});

test("random pick uses all games in the data list", () => {
  expect(minigameIds).toEqual([
    "rhythm",
    "memory",
    "math",
    "shoot",
  ] satisfies Minigame[]);
  expect(
    minigameIds.map((_, i) =>
      pickMinigame(() => (i + 0.5) / minigameIds.length),
    ),
  ).toEqual(minigameIds);
  expect(pickMinigame(() => 0)).toBe(minigameIds[0]);
  expect(pickMinigame(() => 0.999)).toBe(minigameIds.at(-1));
});

test("memory deck has two copies of each of the eight faces", () => {
  const cards = memoryDeck(() => 0.42);
  expect(cards).toHaveLength(16);
  expect([...new Set(cards)].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  for (const face of new Set(cards))
    expect(cards.filter((card) => card === face)).toHaveLength(2);
});

test("each arithmetic problem offers exactly one correct answer", () => {
  for (const operation of [0, 0.5, 0.999]) {
    for (const a of [0, 0.4, 0.999]) {
      for (const b of [0, 0.6, 0.999]) {
        const values = [operation, a, b];
        const question = mathQuestion(() => values.shift() ?? 0.6);
        const [, left, sign, right] = question.prompt.match(/(\d+) (.) (\d+)/)!;
        const expected =
          sign === "＋"
            ? +left + +right
            : sign === "−"
              ? +left - +right
              : +left * +right;
        expect(question.answer).toBe(expected);
        expect(new Set(question.options).size).toBe(4);
        expect(
          question.options.filter((option) => option === expected),
        ).toHaveLength(1);
      }
    }
  }
});

test("arithmetic answers are spread uniformly across the four sorted positions", () => {
  let seed = 0x8b633e64;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const ranks = [0, 0, 0, 0];
  const count = 4000;
  for (let i = 0; i < count; i++) {
    const { answer, options } = mathQuestion(random);
    const sorted = [...options].sort((a, b) => a - b);
    expect(options).toHaveLength(4);
    expect(new Set(options).size).toBe(4);
    expect(sorted[0]).toBeGreaterThanOrEqual(0);
    expect(sorted[3] - sorted[0]).toBeGreaterThan(3);
    expect(options.filter((option) => option === answer)).toHaveLength(1);
    ranks[sorted.indexOf(answer)]++;
  }
  for (const rank of ranks) {
    expect(rank / count).toBeGreaterThan(0.22);
    expect(rank / count).toBeLessThan(0.28);
  }
});
