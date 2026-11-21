import { expect, it } from "vitest";
import { partners } from "../src/data/love-partners";
import { loveQuestions } from "../src/data/love-questions";
import {
  breakUp,
  canDate,
  confess,
  drawDate,
  loveChoices,
  meetPartner,
  settleDate,
} from "../src/game/love";
import {
  createSave,
  exportSave,
  importSave,
  type Save,
} from "../src/game/saves";

const base: Save = {
  ...createSave({
    name: "小夏",
    gender: "boy",
    birthday: { month: 5, day: 13 },
    bloodType: "A",
  }),
  stage: "university",
  cash: 5000,
};
const player = { ...base, stats: { ...base.stats, charm: 350 } };
const met = meetPartner(player, "lin_xiaoqing");

it("男女各顯示四種同等門檻與費用的對象", () => {
  for (const gender of ["boy", "girl"] as const) {
    const choices = loveChoices({ ...player, gender });
    expect(choices.every((choice) => choice.gender !== gender)).toBe(true);
    expect(
      choices.map(({ charm, fee, salary, locked }) => [
        charm,
        fee,
        salary,
        locked,
      ]),
    ).toEqual([
      [120, 2000, 800, false],
      [200, 3000, 1500, false],
      [350, 4000, 2500, false],
      [500, 5000, 4000, true],
    ]);
  }
});

it("認識只收一次費用，並檢查性別、魅力、現金與學校階段", () => {
  expect(met).toMatchObject({
    partner: "lin_xiaoqing",
    affection: 0,
    dating: false,
    cash: 3000,
    metPartners: ["lin_xiaoqing"],
  });
  expect(meetPartner(met, "xu_zhiyan")).toBe(met);
  expect(meetPartner(player, "chen_boyu")).toBe(player);
  expect(meetPartner(player, "bai_xingyu")).toBe(player);
  const poor = { ...player, cash: 1999 };
  expect(meetPartner(poor, "lin_xiaoqing")).toBe(poor);
  const high = { ...player, stage: "high" as const };
  expect(meetPartner(high, "lin_xiaoqing")).toBe(high);
});

it("每人六個主題各三題，三個選項各不相同", () => {
  expect(Object.keys(loveQuestions)).toEqual(Object.keys(partners));
  for (const bank of Object.values(loveQuestions)) {
    expect(new Set(bank.map(({ id }) => id)).size).toBe(18);
    const topics = new Set(bank.map(({ topic }) => topic));
    expect(topics.size).toBe(6);
    for (const topic of topics)
      expect(bank.filter((question) => question.topic === topic)).toHaveLength(
        3,
      );
    for (const question of bank) expect(new Set(question.choices).size).toBe(3);
  }
});

it("同次約會與上次已結算的約會皆不會重複出題", () => {
  const first = drawDate(met, () => 0).map(({ id }) => id);
  const second = drawDate(settleDate(met, 0, first).save, () => 0).map(
    ({ id }) => id,
  );
  expect(new Set([...first, ...second]).size).toBe(6);
});

it.each([
  [0, 3],
  [1, 8],
  [2, 15],
  [3, 25],
])("答對 %i 題加 %i 點", (correct, gained) => {
  expect(settleDate(met, correct, ["1-1", "1-2", "1-3"])).toMatchObject({
    gained,
    save: { affection: gained, completedDates: 1 },
  });
});

it("魅力不足時婉拒，無題目且分數維持原樣", () => {
  const low = { ...met, affection: 20, stats: { ...met.stats, charm: 119 } };
  expect(canDate(low)).toBe(false);
  expect(drawDate(low)).toEqual([]);
  expect(settleDate(low, 3, []).save).toBe(low);
});

it("愛情度到 60 時告白，魅力剛好達標也能成功，交往後最多 99", () => {
  const ready = settleDate(
    { ...met, affection: 55, stats: { ...met.stats, charm: 120 } },
    3,
    [],
  );
  expect(ready.gained).toBe(5);
  const result = confess(ready.save)!;
  expect(result).toMatchObject({
    success: true,
    save: { dating: true, affection: 60 },
  });
  const capped = settleDate({ ...result.save, affection: 95 }, 3, []);
  expect(capped).toMatchObject({ gained: 4, save: { affection: 99 } });
  expect(settleDate(capped.save, 3, []).gained).toBe(0);
  expect(confess(capped.save)).toBeNull();
});

it("告白當下魅力不足降到 50，恢復門檻後可再次告白", () => {
  const result = confess({
    ...met,
    affection: 60,
    stats: { ...met.stats, charm: 119 },
  })!;
  expect(result).toMatchObject({
    success: false,
    save: { dating: false, affection: 50 },
  });
  const retry = settleDate({ ...result.save, stats: met.stats }, 2, []);
  expect(confess(retry.save)?.success).toBe(true);
});

it("分手清除關係並保留認識紀錄，之後可再認識", () => {
  const single = breakUp({ ...met, dating: true, affection: 80 });
  expect(single).toMatchObject({
    partner: null,
    dating: false,
    affection: 0,
    cash: 3000,
    metPartners: ["lin_xiaoqing"],
  });
  expect(meetPartner(single, "xu_zhiyan").metPartners).toEqual([
    "lin_xiaoqing",
    "xu_zhiyan",
  ]);
  expect(meetPartner(single, "lin_xiaoqing").metPartners).toEqual([
    "lin_xiaoqing",
  ]);
});

it("舊存檔及階段快照補上預設值，新關係可匯出再匯入", () => {
  const legacy = JSON.parse(exportSave(player));
  const defaults = {
    partner: null,
    dating: false,
    affection: 0,
    metPartners: [],
    completedDates: 0,
    lastDateQuestions: [],
    spouse: null,
    marriage: null,
  };
  for (const field of Object.keys(defaults)) delete legacy[field];
  legacy.stageSnapshots = { university: { ...legacy } };
  const imported = importSave(JSON.stringify(legacy));
  expect(imported).toMatchObject(defaults);
  expect(imported.stageSnapshots.university).toMatchObject(defaults);
  const current = { ...met, dating: true, affection: 80 };
  expect(importSave(exportSave(current))).toEqual(current);
});
