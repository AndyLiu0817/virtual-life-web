import { boostActivityReward } from "./deities";
import type { Save } from "./saves";

export const contestEvents = {
  trivia: {
    name: "智囊搶答",
    stat: "intellect",
    unit: " 題",
    description: "答 10 道常識題，同分比用時。",
  },
  style: {
    name: "風采秀",
    stat: "charm",
    unit: " 分",
    description: "魅力加上所選穿搭的加分。",
  },
  rhythm: {
    name: "衝刺擂台",
    stat: "fitness",
    unit: "%",
    description: "跟著節拍點擊，比準確率。",
  },
} as const;
export type ContestEvent = keyof typeof contestEvents;
export const contestEventIds = Object.keys(contestEvents) as ContestEvent[];

export const contestSchedule = {
  junior: { turns: [8], lines: { trivia: 8, style: 180, rhythm: 85 } },
  high: { turns: [13], lines: { trivia: 8, style: 300, rhythm: 88 } },
  university: { turns: [14, 30], lines: { trivia: 9, style: 450, rhythm: 90 } },
} as const;

export type ContestStage = keyof typeof contestSchedule;
export interface ContestMatch {
  stage: ContestStage;
  matchNumber: number;
}

export function nextMatch(
  save: Save,
  trigger: "tile" | "turn",
): ContestMatch | undefined {
  const { stage } = save;
  if (stage !== "junior" && stage !== "high" && stage !== "university") return;
  const index = contestSchedule[stage].turns.findIndex(
    (_, i) =>
      !save.competitions.some(
        (entry) =>
          "stage" in entry &&
          entry.stage === stage &&
          entry.matchNumber === i + 1,
      ),
  );
  if (
    index === -1 ||
    (trigger === "turn" && save.turn + 1 < contestSchedule[stage].turns[index])
  )
    return;
  return { stage, matchNumber: index + 1 };
}

export function championLine(
  stage: ContestStage,
  event: ContestEvent,
  random = Math.random,
) {
  return (
    Math.round(
      contestSchedule[stage].lines[event] * (0.95 + random() * 0.1) * 100,
    ) / 100
  );
}

export const contestRanks = ["冠軍", "亞軍", "季軍", "參加獎"] as const;
const ranks = [
  { minimum: 100, cash: 4500, stat: 60 },
  { minimum: 85, cash: 2700, stat: 40 },
  { minimum: 70, cash: 1500, stat: 25 },
  { minimum: 0, cash: 500, stat: 8 },
];

export function contestRank(score: number, line: number) {
  return (
    ranks.findIndex(
      ({ minimum }) =>
        Math.round(score * 100) * 100 >= Math.round(line * 100) * minimum,
    ) + 1
  );
}

export interface ContestScore {
  score: number;
  elapsedMs?: number;
}

export const compareContestScores = (a: ContestScore, b: ContestScore) =>
  b.score - a.score || (a.elapsedMs ?? 0) - (b.elapsedMs ?? 0);

export function settleContest(
  save: Save,
  match: ContestMatch,
  event: ContestEvent,
  performance: ContestScore,
  line: number,
) {
  const next = nextMatch(save, "tile");
  if (next?.stage !== match.stage || next.matchNumber !== match.matchNumber)
    return;
  const rank = contestRank(performance.score, line);
  const reward = ranks[rank - 1];
  const target = contestEvents[event].stat;
  const cash = boostActivityReward(save, reward.cash);
  const stat = Math.min(
    9999 - save.stats[target],
    boostActivityReward(save, reward.stat),
  );
  const result = { ...match, ...performance, event, rank };
  return {
    rank,
    target,
    stat,
    cash,
    save: {
      ...save,
      cash: save.cash + cash,
      stats: { ...save.stats, [target]: save.stats[target] + stat },
      competitions: [...save.competitions, result],
    },
  };
}

export const outfits = [
  {
    name: "晴天郵差",
    description: "鵝黃外套配斜背包，口袋剛好裝得下一封好消息。",
  },
  {
    name: "操場晚風",
    description: "寬鬆運動外套配帆布鞋，轉身時袖口會跟著跳舞。",
  },
  {
    name: "月光書店",
    description: "深藍背心配銀色書籤胸針，安靜也能有自己的亮點。",
  },
];

export function outfitBonuses(random = Math.random) {
  const bonuses = [0, 20, 40];
  for (let i = bonuses.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [bonuses[i], bonuses[j]] = [bonuses[j], bonuses[i]];
  }
  return bonuses;
}
