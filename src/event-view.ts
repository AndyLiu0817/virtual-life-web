import {
  deities,
  goodDeities,
  type DeityId,
  type ValueChange,
} from "./game/deities";
import type { EventOutcome } from "./game/events";
import { STAT_LABELS } from "./game/opening";

const scenes = import.meta.glob<string>("../art/event_*_final.jpg", {
  eager: true,
  import: "default",
  query: "?url",
});

// Individual alpha-matted portraits from art/npc_final.jpg.
const npcPortraits = import.meta.glob<string>("./event-art/npc/*.webp", {
  eager: true,
  import: "default",
  query: "?url",
});

const npcByRole: Record<string, string> = {
  librarian: "teacher",
  vendor: "clerk",
};

const deitySprites = import.meta.glob<string>("../art/deities/*.webp", {
  eager: true,
  import: "default",
  query: "?url",
});

function deityPortrait(id: DeityId) {
  return `<img class="event-portrait" src="${deitySprites[`../art/deities/${id}.webp`]}" alt="">`;
}

export function changeText({ target, amount }: ValueChange) {
  const value = `${amount < 0 ? "−" : amount > 0 ? "＋" : ""}${Math.abs(amount).toLocaleString("zh-TW")}`;
  return target === "cash"
    ? `現金 ${value} 元`
    : `${STAT_LABELS[target]} ${value}`;
}

export function sceneArt(scene: string, role?: string) {
  const background = scenes[`../art/event_${scene}_final.jpg`];
  const npc =
    role && npcPortraits[`./event-art/npc/${npcByRole[role] ?? role}.webp`];
  return `<img class="event-background" src="${background}" alt="">${npc ? `<img class="event-npc" src="${npc}" alt="">` : ""}`;
}

export function eventPresentation(outcome: EventOutcome) {
  if ("id" in outcome) {
    const deity = deities[outcome.id];
    return {
      tone: goodDeities.some((id) => id === outcome.id) ? "blessing" : "hex",
      art: deityPortrait(outcome.id),
      label: outcome.kind === "deity" ? "神祇登場" : "還願",
      title: deity.name,
      text:
        outcome.kind === "deity"
          ? `將附身 ${deity.turns} 回合。${deity.detail}`
          : `花費 ${deity.price.toLocaleString("zh-TW")} 元，送走${deity.name}。`,
      result: "人生經驗 ＋5",
    };
  }

  const { story } = outcome;
  const art = sceneArt(story.scene, story.npc);
  if (outcome.kind === "protected") {
    return {
      tone: "scene",
      art,
      label: "護心獅",
      title: "無事發生",
      text: "護心獅打了個哈欠，順手把今天的小倒楣吹走了。",
      result: "人生經驗 ＋5",
    };
  }
  if (outcome.kind === "card") {
    return {
      tone: "scene",
      art,
      label: "收集卡",
      title: story.title,
      text: story.text,
      result: "已放入卡片欄 ・ 人生經驗 ＋5",
    };
  }
  return {
    tone: "scene",
    art,
    label: outcome.kind === "good" ? "好事" : "壞事",
    title: story.title,
    text: story.text,
    result: `${changeText(outcome.change)} ・ 人生經驗 ＋5`,
  };
}
