import { boostActivityReward } from "./deities";
import type { Save } from "./saves";

export const minigames = {
  rhythm: {
    name: "節奏拍擊",
    stat: "fitness",
    normal: 70,
    excellent: 95,
    unit: "%",
    instructions: "音符落進亮框時，點一下拍擊區。亂點會降低準確率。",
  },
  memory: {
    name: "記憶翻牌",
    stat: "intellect",
    normal: 60,
    excellent: 40,
    unit: " 秒",
    instructions: "每次翻兩張牌。60 秒內找出全部 8 對相同圖案。",
  },
  math: {
    name: "數字快算",
    stat: "intellect",
    normal: 8,
    excellent: 12,
    unit: " 題",
    instructions: "點選正確答案。45 秒內盡量多答對幾題。",
  },
  shoot: {
    name: "準心射擊",
    stat: "fitness",
    normal: 15,
    excellent: 23,
    unit: " 個",
    instructions: "看到靶子就點它。30 秒內盡量多命中幾個。",
  },
} as const;

export type Minigame = keyof typeof minigames;
export const minigameIds = Object.keys(minigames) as Minigame[];
export const minigameTiers = ["未達", "普通", "優秀"] as const;
export type RoundScore = { score: number; elapsedMs?: number };

export function pickMinigame(random = Math.random) {
  return minigameIds[Math.floor(random() * minigameIds.length)];
}

export function minigameTier(
  game: Minigame,
  result: RoundScore,
): (typeof minigameTiers)[number] {
  const { normal, excellent } = minigames[game];
  if (game === "memory") {
    const seconds = (result.elapsedMs ?? Infinity) / 1000;
    if (result.score < 8 || seconds > normal) return "未達";
    return seconds <= excellent ? "優秀" : "普通";
  }
  if (result.score >= excellent) return "優秀";
  return result.score >= normal ? "普通" : "未達";
}

const rewards = {
  優秀: { stat: 18, cash: 600 },
  普通: { stat: 12, cash: 400 },
  未達: { stat: 3, cash: 100 },
};

export function settleMinigame(save: Save, game: Minigame, result: RoundScore) {
  const tier = minigameTier(game, result);
  const reward = rewards[tier];
  const target = minigames[game].stat;
  const stat = Math.min(
    9999 - save.stats[target],
    boostActivityReward(save, reward.stat),
  );
  const cash = boostActivityReward(save, reward.cash);
  return {
    tier,
    stat,
    cash,
    save: {
      ...save,
      cash: save.cash + cash,
      stats: { ...save.stats, [target]: save.stats[target] + stat },
      minigames: [
        ...save.minigames,
        { stage: save.stage, game, ...result, tier },
      ],
    },
  };
}

function shuffle<T>(items: T[], random: () => number) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function memoryDeck(random = Math.random) {
  return shuffle(
    Array.from({ length: 16 }, (_, i) => (i % 8) + 1),
    random,
  );
}

export function mathQuestion(random = Math.random) {
  const integer = (max: number) => 1 + Math.floor(random() * max);
  const operation = integer(3);
  const a = integer(operation === 3 ? 9 : 20);
  const b = integer(operation === 2 ? a : operation === 3 ? 9 : 20);
  const answer = operation === 1 ? a + b : operation === 2 ? a - b : a * b;
  const first = Math.max(0, answer - 2);
  const options = Array.from({ length: 4 }, (_, i) => first + i);
  return {
    prompt: `${a} ${["＋", "−", "×"][operation - 1]} ${b} ＝ ?`,
    answer,
    options: shuffle(options, random),
  };
}
