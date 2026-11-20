import { expect, test } from "vitest";
import {
  chooseClub,
  drawClubEvent,
  settleClubEvent,
  visitClub,
} from "../src/game/clubs";
import {
  catchPoints,
  memoryMismatchMs,
  minigameTier,
  penalizeScore,
  rhythmAccuracy,
  settleMinigame,
  whackPoints,
} from "../src/game/minigames";
import { createSave, exportSave, importSave } from "../src/game/saves";
import { buyShopItem, shopStock } from "../src/game/shop";

const player = createSave({
  name: "小晴",
  gender: "girl",
  birthday: { month: 5, day: 13 },
  bloodType: "A",
});

test("數字快算與射擊扣 1 分，最低 0", () => {
  expect(penalizeScore(4, 1)).toBe(3);
  expect(penalizeScore(0, 1)).toBe(0);
});

test.each([whackPoints, catchPoints])(
  "打到老師或接到壞物扣 2 分，正確動作加 1 分",
  (points) => {
    expect(points(6, true)).toBe(4);
    expect(points(1, true)).toBe(0);
    expect(points(1, false)).toBe(2);
  },
);

test("亂點拉低節奏準確率，記憶翻錯加二秒", () => {
  expect(rhythmAccuracy(20, 20, 1)).toBe(95.2);
  expect(rhythmAccuracy(0, 20, 10)).toBe(0);
  expect(
    minigameTier("memory", { score: 8, elapsedMs: 39_000 + memoryMismatchMs }),
  ).toBe("普通");
  expect(
    minigameTier("memory", { score: 7, elapsedMs: 58_001 + memoryMismatchMs }),
  ).toBe("未達");
});

test("找不同同時用找到處數及點錯次數評級，存檔保留點錯次數", () => {
  expect(minigameTier("diff", { score: 5, misses: 1 })).toBe("優秀");
  expect(minigameTier("diff", { score: 5, misses: 2 })).toBe("普通");
  expect(minigameTier("diff", { score: 4, misses: 3 })).toBe("普通");
  expect(minigameTier("diff", { score: 4, misses: 4 })).toBe("未達");
  expect(minigameTier("diff", { score: 3, misses: 0 })).toBe("未達");
  const result = settleMinigame(player, "diff", { score: 4, misses: 3 });
  expect(importSave(exportSave(result.save)).minigames[0]).toMatchObject({
    score: 4,
    misses: 3,
    tier: "普通",
  });
});

test("國中社團固定給主副能力並保留額外現金機會", () => {
  const visit = visitClub(chooseClub(player, "junior", "study"), () => 0.09)!;
  expect(visit.changes).toEqual([
    { target: "intellect", amount: 12 },
    { target: "morality", amount: 6 },
  ]);
  expect(visit.cash).toBe(200);
  expect(visit.save.clubHistory[0].visits).toBe(1);
});

test.each(["high", "university"] as const)(
  "%s 社團抽完 12 則才重洗，跨輪不重複",
  (stage) => {
    let save = chooseClub({ ...player, stage }, stage, "study");
    for (let draw = 0; draw < 13; draw++) {
      const event = drawClubEvent(save, () => 0.999)!;
      save = settleClubEvent(save, event, 0)!.save;
      if (draw === 5) save = importSave(exportSave(save));
    }
    expect(new Set(save.clubEventHistory.slice(0, 12)).size).toBe(12);
    expect(save.clubEventHistory[12]).not.toBe(save.clubEventHistory[11]);
    expect(save.clubHistory.find((club) => club.stage === stage)?.visits).toBe(
      13,
    );
  },
);

test("社團選擇以資料的數值結算，能力與現金遵守上下限", () => {
  const initial = chooseClub(
    {
      ...player,
      stage: "high",
      stats: { intellect: 1, morality: 9995, charm: 100, fitness: 0 },
      cash: 100,
    },
    "high",
    "study",
  );
  const first = drawClubEvent(initial, () => 0)!;
  expect(settleClubEvent(initial, first, 0)?.save.stats).toEqual({
    intellect: 0,
    morality: 9995,
    charm: 118,
    fitness: 0,
  });
  const festival = drawClubEvent(initial, () => 0.2)!;
  const result = settleClubEvent(initial, festival, 3)!;
  expect(result.save.cash).toBe(0);
  expect(result.save.stats.morality).toBe(9999);
  expect(result.changes).toContainEqual({ target: "cash", amount: -100 });
});

test("福利社拒絕超額、跨學段或售罄購買，存檔保留限購", () => {
  const high = {
    ...player,
    stage: "high" as const,
    cash: 9000,
    stats: { ...player.stats, intellect: 9996 },
  };
  const item = "high-shop-notes";
  expect(buyShopItem(player, item)).toBeUndefined();
  expect(buyShopItem({ ...high, cash: 799 }, item)).toBeUndefined();
  expect(buyShopItem(high, "uni-shop-copy")).toBeUndefined();
  const first = buyShopItem(high, item)!;
  expect(first.save).toMatchObject({ cash: 8200, stats: { intellect: 9999 } });
  const restored = importSave(exportSave(first.save));
  expect(shopStock(restored)[0]).toMatchObject({
    remaining: 1,
    available: true,
  });
  const second = buyShopItem(restored, item)!;
  expect(shopStock(second.save)[0]).toMatchObject({
    remaining: 0,
    available: false,
  });
  expect(buyShopItem(second.save, item)).toBeUndefined();
  const university = { ...second.save, stage: "university" as const };
  expect(shopStock(university)[0]).toMatchObject({
    remaining: 2,
    available: true,
  });
  expect(
    buyShopItem(university, "uni-shop-copy")?.save.shopPurchases,
  ).toHaveLength(2);
});
