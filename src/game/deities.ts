import { clampStat, STAT_LABELS, type Stat } from "./opening";
import type { Save } from "./saves";

export const deities = {
  "sky-elder": {
    name: "晴空爺",
    turns: 5,
    price: 1000,
    detail: "每回合隨機一項四維 ＋8～15。",
  },
  "gold-maiden": {
    name: "金穗娘",
    turns: 5,
    price: 1000,
    detail: "每回合現金 ＋400～800 元。",
  },
  "step-child": {
    name: "步數童",
    turns: 3,
    price: 1500,
    detail: "每回合可在目前骰子的點數範圍內指定步數。",
  },
  "guard-lion": {
    name: "護心獅",
    turns: 5,
    price: 1000,
    detail: "普通壞事改為「無事發生」。小遊戲與大賽獎勵增加 20%。",
  },
  "rain-crone": {
    name: "晦雨婆",
    turns: 5,
    price: 2000,
    detail: "每回合隨機一項四維 −8～15。",
  },
  "empty-bag": {
    name: "空袋客",
    turns: 5,
    price: 2000,
    detail: "每回合現金 −300～700 元。",
  },
  "lost-envoy": {
    name: "迷途使",
    turns: 4,
    price: 2500,
    detail: "岔路隨機選方向，擲骰步數減 1，最少走 1 步。",
  },
} as const;

export type DeityId = keyof typeof deities;
export const goodDeities = [
  "sky-elder",
  "gold-maiden",
  "step-child",
  "guard-lion",
] as const;
export const badDeities = ["rain-crone", "empty-bag", "lost-envoy"] as const;

export function isDeityId(id: string): id is DeityId {
  return Object.hasOwn(deities, id);
}

export function activeDeity(save: Save) {
  const deity = save.deity;
  if (deity && deity.remainingTurns > 0 && isDeityId(deity.id)) {
    return { id: deity.id, remainingTurns: deity.remainingTurns };
  }
  return null;
}

export const randomInt = (min: number, max: number, random: () => number) =>
  min + Math.floor(random() * (max - min + 1));

export const pick = <T>(items: readonly T[], random: () => number) =>
  items[randomInt(0, items.length - 1, random)];

const stats = Object.keys(STAT_LABELS) as Stat[];
export const randomStat = (random: () => number) => pick(stats, random);

export function changeValue(save: Save, target: Stat | "cash", delta: number) {
  const before = target === "cash" ? save.cash : save.stats[target];
  const after =
    target === "cash" ? Math.max(0, before + delta) : clampStat(before + delta);
  return {
    save:
      target === "cash"
        ? { ...save, cash: after }
        : { ...save, stats: { ...save.stats, [target]: after } },
    change: { target, amount: after - before },
  };
}

export type ValueChange = ReturnType<typeof changeValue>["change"];

export function deityTurnEffect(save: Save, random = Math.random) {
  switch (activeDeity(save)?.id) {
    case "sky-elder":
      return changeValue(save, randomStat(random), randomInt(8, 15, random));
    case "gold-maiden":
      return changeValue(save, "cash", randomInt(400, 800, random));
    case "rain-crone":
      return changeValue(save, randomStat(random), -randomInt(8, 15, random));
    case "empty-bag":
      return changeValue(save, "cash", -randomInt(300, 700, random));
    default:
      return { save, change: null };
  }
}

export function nextDeity(save: Save) {
  const deity = activeDeity(save);
  return deity && deity.remainingTurns > 1
    ? { ...deity, remainingTurns: deity.remainingTurns - 1 }
    : null;
}

export function payOffering(save: Save): Save {
  const deity = activeDeity(save);
  if (!deity || save.cash < deities[deity.id].price) return save;
  return { ...save, deity: null, cash: save.cash - deities[deity.id].price };
}

export const stepChoices = (save: Save, dice: number) =>
  activeDeity(save)?.id === "step-child"
    ? Array.from({ length: 5 * dice + 1 }, (_, index) => dice + index)
    : [];

export const walkingSteps = (save: Save, steps: number) =>
  activeDeity(save)?.id === "lost-envoy" ? Math.max(1, steps - 1) : steps;

export const randomFork = (
  save: Save,
  routes: readonly number[],
  random = Math.random,
) => (activeDeity(save)?.id === "lost-envoy" ? pick(routes, random) : null);

// Apply once to each numeric minigame or contest reward when those tiles are implemented.
export const boostActivityReward = (save: Save, amount: number) =>
  activeDeity(save)?.id === "guard-lion" ? Math.round(amount * 1.2) : amount;
