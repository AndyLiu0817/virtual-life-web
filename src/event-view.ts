import npcSheet from "../art/npc_final.jpg";
import goodSheet from "../art/deities_good_final.jpg";
import badSheet from "../art/deities_bad_final.jpg";
import {
  badDeities,
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

const npcRows = [
  {
    ids: ["teacher", "proctor", "senior-boy", "senior-girl", "host", "nurse"],
    edges: [52, 249, 444, 643, 833, 1044, 1235],
    y: 30,
    height: 315,
  },
  {
    ids: [
      "classmate-a",
      "classmate-b",
      "emcee",
      "clerk",
      "janitor",
      "passerby",
    ],
    edges: [54, 245, 436, 640, 825, 1049, 1258],
    y: 354,
    height: 340,
  },
];

function sheetCrop(
  url: string,
  x: number,
  y: number,
  width: number,
  height: number,
  shadowless = false,
) {
  // The source includes a painted floor shadow. This outline follows 空袋客
  // in sheet coordinates (relative to x=395), including both shoe soles.
  const outline = shadowless
    ? `<defs><clipPath id="empty-bag-outline">
    <path transform="translate(395)" d="M170 82 Q195 71 233 62 Q248 57 262 114 Q310 103 315 117 Q320 127 279 147 L287 165 L284 178 Q305 178 304 216 Q335 221 374 346 L373 369 Q386 404 377 421 L368 413 Q368 450 348 472 L357 499 L382 541 L371 534 L370 553 L363 545 L354 557 L340 544 L338 556 L325 550 L325 581 L329 600 L325 610 Q348 656 336 661 Q303 670 286 657 L282 647 L281 596 L272 592 L273 570 L266 540 L247 562 L243 543 L235 549 L227 538 L222 548 L219 563 L224 571 L219 590 L210 596 L216 640 L198 644 L187 643 Q145 659 119 646 Q111 635 129 620 L157 607 L171 589 L166 572 L171 560 L172 541 L163 539 L160 550 L151 544 L144 538 L138 546 L129 536 L110 570 Q100 544 124 495 L158 431 L130 378 L128 347 L123 318 L114 265 Q128 314 98 332 L73 339 L74 354 L67 361 L61 338 Q18 331 29 277 Q38 243 61 216 L50 203 L31 205 L25 199 L53 192 L63 198 L51 169 L57 164 L78 187 L84 165 L91 159 L103 175 L92 196 L110 195 L113 212 L96 210 L143 307 L155 306 L181 263 L179 244 L190 240 L167 222 L184 198 L169 172 Q123 183 126 164 Q128 149 169 131 Z"/>
    </clipPath></defs>`
    : "";
  return `<svg class="event-portrait" viewBox="${x} ${y} ${width} ${height}" aria-hidden="true">
    ${outline}<image href="${url}" width="1280" height="720"${shadowless ? ' clip-path="url(#empty-bag-outline)"' : ""}/>
  </svg>`;
}

function npcPortrait(id: string) {
  const row = npcRows.find(({ ids }) => ids.includes(id))!;
  const index = row.ids.indexOf(id);
  const x = row.edges[index];
  return sheetCrop(npcSheet, x, row.y, row.edges[index + 1] - x, row.height);
}

function deityPortrait(id: DeityId) {
  const goodIndex = goodDeities.findIndex((entry) => entry === id);
  if (goodIndex >= 0) {
    const edges = [19, 383, 666, 903, 1265];
    return sheetCrop(
      goodSheet,
      edges[goodIndex],
      55,
      edges[goodIndex + 1] - edges[goodIndex],
      600,
    );
  }
  if (id === "empty-bag") return sheetCrop(badSheet, 395, 45, 395, 630, true);
  const index = badDeities.findIndex((entry) => entry === id);
  const edges = [20, 396, 820, 1265];
  return sheetCrop(
    badSheet,
    edges[index],
    45,
    edges[index + 1] - edges[index],
    632,
  );
}

export function changeText({ target, amount }: ValueChange) {
  const value = `${amount < 0 ? "−" : amount > 0 ? "＋" : ""}${Math.abs(amount).toLocaleString("zh-TW")}`;
  return target === "cash"
    ? `現金 ${value} 元`
    : `${STAT_LABELS[target]} ${value}`;
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
  const background = scenes[`../art/event_${story.scene}_final.jpg`];
  const art = `<img class="event-background" src="${background}" alt="">${npcPortrait(story.npc)}`;
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
