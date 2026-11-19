import { expect, it } from "vitest";
import stories from "../src/data/junior-events.json";
import { finishTurn } from "../src/game/board";
import {
  boostActivityReward,
  deities,
  deityTurnEffect,
  payOffering,
  randomFork,
  stepChoices,
  walkingSteps,
  type DeityId,
} from "../src/game/deities";
import { drawEvent } from "../src/game/events";
import { createSave, exportSave, importSave } from "../src/game/saves";

const opening = createSave({
  gender: "boy",
  name: "小宇",
  birthday: { month: 3, day: 21 },
  bloodType: "A",
});

function possessed(id: DeityId, remainingTurns = deities[id].turns) {
  return { ...opening, deity: { id, remainingTurns } };
}

function draws(...values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0;
}

it("單次事件抽籤分配 15% 神祇、附身時 8% 還願及 6% 收集卡", () => {
  for (const [save, offers] of [
    [opening, 0],
    [possessed("step-child"), 8],
  ] as const) {
    const kinds = Array.from(
      { length: 100 },
      (_, index) => drawEvent(save, draws((index + 0.5) / 100)).outcome.kind,
    );
    expect(kinds.filter((kind) => kind === "deity")).toHaveLength(15);
    expect(kinds.filter((kind) => kind === "offering")).toHaveLength(offers);
    expect(kinds.filter((kind) => kind === "card")).toHaveLength(6);
    expect(kinds.filter((kind) => kind === "good")).toHaveLength(79 - offers);
  }
});

it("普通事件與神祇的好壞權重在否極泰來中由 1:1 改為 2:1", () => {
  for (const [turnaroundTurns, goodCount] of [
    [0, 3],
    [3, 4],
  ]) {
    const save = { ...opening, turnaroundTurns };
    const results = Array.from({ length: 6 }, (_, i) => (i + 0.5) / 6);
    expect(
      results.filter(
        (value) => drawEvent(save, draws(0.8, value)).outcome.kind === "good",
      ),
    ).toHaveLength(goodCount);
    expect(
      results.filter((value) => {
        const { outcome } = drawEvent(save, draws(0, value));
        return outcome.kind === "deity" && outcome.id === "sky-elder";
      }),
    ).toHaveLength(goodCount);
  }
});

it.each([
  ["good", 0, 0, "fitness", 10, 20],
  ["bad", 0.9, 0, "fitness", -8, -15],
  ["good", 0, 0.36, "cash", 300, 800],
  ["bad", 0.9, 0.36, "cash", -200, -600],
] as const)(
  "%s 事件按階段取值（選取權重 %s）",
  (kind, polarity, story, target, low, high) => {
    for (const [stage, multiplier] of [
      ["junior", 1],
      ["high", 1.25],
      ["university", 1.5],
    ] as const) {
      for (const [amountRoll, expected] of [
        [0, low],
        [0.9999, high],
      ]) {
        const storyRoll =
          stage === "junior" || target !== "cash" ? story : 0.175;
        const random =
          target === "cash"
            ? draws(0.8, polarity, storyRoll, amountRoll)
            : draws(0.8, polarity, storyRoll, 0.9999, amountRoll);
        const result = drawEvent({ ...opening, stage }, random);
        expect(result.outcome).toMatchObject({
          kind,
          change: {
            target,
            amount:
              Math.sign(expected) * Math.round(Math.abs(expected) * multiplier),
          },
        });
        expect(result.save.experience).toBe(5);
      }
    }
  },
);

it("壞事扣款最多扣到零，收集卡只加入卡片欄並給經驗", () => {
  const result = drawEvent(
    { ...opening, cash: 10 },
    draws(0.8, 0.9, 0.36, 0.9999),
  );
  expect(result.save.cash).toBe(0);
  expect(result.outcome).toMatchObject({
    change: { target: "cash", amount: -10 },
  });
  const card = drawEvent(opening, draws(0.2));
  expect(card.outcome.kind).toBe("card");
  expect(card.save).toEqual({
    ...opening,
    cards: ["junior-good-01"],
    experience: 5,
  });
  expect(importSave(exportSave(card.save))).toEqual(card.save);
});

it("國中事件各 20 則，合用 14 個場景與唯一 ID", () => {
  expect(stories.good).toHaveLength(20);
  expect(stories.bad).toHaveLength(20);
  const all = [...stories.good, ...stories.bad];
  expect(new Set(all.map(({ id }) => id)).size).toBe(40);
  expect(new Set(all.map(({ scene }) => scene)).size).toBe(14);
});

it.each([
  ["sky-elder", "intellect", 8, 15],
  ["gold-maiden", "cash", 400, 800],
  ["rain-crone", "intellect", -8, -15],
  ["empty-bag", "cash", -300, -700],
] as const)("%s 每回合套用效果與正確上下限", (id, target, low, high) => {
  const save = { ...possessed(id), stage: "university" as const };
  for (const [roll, amount] of [
    [0, low],
    [0.9999, high],
  ]) {
    const random = target === "cash" ? draws(roll) : draws(0, roll);
    expect(deityTurnEffect(save, random).change).toEqual({ target, amount });
  }
  expect(
    deityTurnEffect({ ...possessed("empty-bag"), cash: 5 }, draws(0)).save.cash,
  ).toBe(0);
});

it("七位神祇使用指定的持續回合及還願價，登場後下回合起計時", () => {
  expect(
    Object.values(deities).map(({ turns, price }) => [turns, price]),
  ).toEqual([
    [5, 1000],
    [5, 1000],
    [3, 1500],
    [5, 1000],
    [5, 2000],
    [5, 2000],
    [4, 2500],
  ]);
  const replaced = drawEvent(possessed("rain-crone"), draws(0)).save;
  expect(replaced.deity).toEqual({ id: "sky-elder", remainingTurns: 5 });
  expect(replaced.experience).toBe(5);
  let { save } = finishTurn(replaced, true);
  expect(save.deity?.remainingTurns).toBe(5);
  expect(importSave(exportSave(save))).toEqual(save);
  for (let remaining = 4; remaining >= 0; remaining--) {
    save = finishTurn(save).save;
    expect(save.deity?.remainingTurns ?? 0).toBe(remaining);
  }
  expect(save.deity).toBeNull();
});

it("還願收費並解除附身，餘額不足時可保留神祇", () => {
  const result = drawEvent(possessed("lost-envoy"), draws(0.22));
  expect(result.outcome).toEqual({ kind: "offering", id: "lost-envoy" });
  expect(result.save.experience).toBe(5);
  expect(payOffering(result.save)).toMatchObject({ cash: 2500, deity: null });
  const exactCash = { ...result.save, cash: 2500 };
  expect(payOffering(exactCash)).toMatchObject({ cash: 0, deity: null });
  const shortCash = { ...result.save, cash: 2499 };
  expect(payOffering(shortCash)).toBe(shortCash);
});

it("步數童使用當前骰子範圍，迷途使隨機走岔路並至少走一步", () => {
  const step = possessed("step-child");
  expect(stepChoices(step, 1)).toEqual([1, 2, 3, 4, 5, 6]);
  expect(stepChoices(step, 2)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  expect(stepChoices(opening, 2)).toEqual([]);
  const lost = possessed("lost-envoy");
  expect(walkingSteps(lost, 1)).toBe(1);
  expect(walkingSteps(lost, 7)).toBe(6);
  expect(walkingSteps(opening, 7)).toBe(7);
  expect(randomFork(lost, [5, 17], draws(0))).toBe(5);
  expect(randomFork(lost, [5, 17], draws(0.9999))).toBe(17);
  expect(randomFork(opening, [5, 17], draws(0))).toBeNull();
});

it("護心獅擋下普通壞事但仍加經驗，神祇與卡片照常，活動獎勵增加 20%", () => {
  const lion = possessed("guard-lion");
  const blocked = drawEvent(lion, draws(0.8, 0.9));
  expect(blocked.outcome.kind).toBe("protected");
  expect(blocked.save).toEqual({ ...lion, experience: 5 });
  expect(drawEvent(lion, draws(0.28, 0.9)).outcome.kind).toBe("card");
  expect(drawEvent(lion, draws(0, 0.9)).outcome.kind).toBe("deity");
  expect(boostActivityReward(lion, 350)).toBe(420);
  expect(boostActivityReward(opening, 350)).toBe(350);
});
