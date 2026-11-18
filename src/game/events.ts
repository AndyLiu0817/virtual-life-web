import juniorEvents from "../data/junior-events.json";
import {
  activeDeity,
  badDeities,
  changeValue,
  deities,
  goodDeities,
  pick,
  randomInt,
  randomStat,
  type DeityId,
  type ValueChange,
} from "./deities";
import type { Save } from "./saves";

interface Story {
  id: string;
  scene: string;
  npc: string;
  title: string;
  text: string;
  reward: "cash" | "stat";
}

const stories = juniorEvents as Record<"good" | "bad", Story[]>;

export type EventOutcome =
  | { kind: "deity" | "offering"; id: DeityId }
  | { kind: "card"; story: Story }
  | { kind: "protected"; story: Story }
  | { kind: "good" | "bad"; story: Story; change: ValueChange };

const stageMultipliers = { high: 1.25, university: 1.5 };
const goodChance = (save: Save) => (save.turnaroundTurns > 0 ? 2 / 3 : 1 / 2);

export function drawEvent(
  initial: Save,
  random = Math.random,
): { save: Save; outcome: EventOutcome } {
  const deity = activeDeity(initial);
  const save = { ...initial, experience: initial.experience + 5 };
  const roll = random();
  if (roll < 0.15) {
    const id = pick(
      random() < goodChance(save) ? goodDeities : badDeities,
      random,
    );
    return {
      save: { ...save, deity: { id, remainingTurns: deities[id].turns } },
      outcome: { kind: "deity", id },
    };
  }
  if (deity && roll < 0.23)
    return { save, outcome: { kind: "offering", id: deity.id } };

  const kind = random() < goodChance(save) ? "good" : "bad";
  const story = pick(stories[kind], random);
  if (roll < (deity ? 0.29 : 0.21)) {
    return {
      save: { ...save, cards: [...save.cards, story.id] },
      outcome: { kind: "card", story },
    };
  }
  if (kind === "bad" && deity?.id === "guard-lion") {
    return { save, outcome: { kind: "protected", story } };
  }
  const cash = story.reward === "cash";
  const target = cash ? "cash" : randomStat(random);
  const range =
    kind === "good"
      ? cash
        ? [300, 800]
        : [10, 20]
      : cash
        ? [200, 600]
        : [8, 15];
  const multiplier =
    save.stage === "high" || save.stage === "university"
      ? stageMultipliers[save.stage]
      : 1;
  const delta = Math.round(randomInt(range[0], range[1], random) * multiplier);
  const result = changeValue(save, target, kind === "good" ? delta : -delta);
  return { save: result.save, outcome: { kind, story, change: result.change } };
}
