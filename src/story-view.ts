import { sceneArt } from "./event-view";
import {
  elementaryIds,
  galleryRecord,
  stageStory,
  stampYear,
  story,
  storyProgress,
  storyStageNames,
  storyStages,
  type StoryStage,
} from "./game/main-story";
import type { BoardStage } from "./data/school-board";
import type { Save } from "./game/saves";
import worldmap from "../art/story/cg_world_map_1280.jpg";
import male from "../art/story/cg_graduation_male_1280.jpg";
import female from "../art/story/cg_graduation_female_1280.jpg";
import father from "../art/story/father_memory.jpg";
import boy from "../art/hero_boy_elem_final.jpg";
import girl from "../art/hero_girl_elem_final.jpg";
import "./story-view.css";

const people = import.meta.glob<string>("../art/story/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});
const locations = import.meta.glob<string>("../art/event_*_final.jpg", {
  eager: true,
  query: "?url",
  import: "default",
});
type Fragment = (typeof story)[number];
type Gender = Save["gender"];
export const graduationStoryArt = (gender: Gender) =>
  gender === "boy" ? male : female;
const background = (scene: string, gender: Gender) =>
  scene === "worldmap"
    ? worldmap
    : scene === "graduation"
      ? graduationStoryArt(gender)
      : locations[`../art/event_${scene}_final.jpg`];
const img = (url: string, css: string) =>
  `<img class="${css}" src="${url}" alt="">`;

function art(
  scene: string,
  figure: string | null,
  gender: Gender,
  childhood = false,
) {
  if (figure?.startsWith("npc:")) return sceneArt(scene, figure.slice(4));
  const person =
    figure === "father"
      ? img(father, "story-photo")
      : figure
        ? img(people[`../art/story/${figure}.webp`], "event-npc")
        : "";
  return (
    img(background(scene, gender), "event-background") +
    person +
    (childhood
      ? `<span class="portrait story-child">${img(gender === "boy" ? boy : girl, "story-child-art")}</span>`
      : "")
  );
}

const option = (value: string, label: string, disabled = false) =>
  `<button class="action" type="submit" value="${value}" ${disabled ? "disabled" : ""}>${label}</button>`;
function dialogPage(markup: string, classes = "", cancel = false) {
  const dialog = document.createElement("dialog");
  dialog.className = `event-dialog story-dialog ${classes}`;
  dialog.setAttribute("aria-labelledby", "story-heading");
  dialog.innerHTML = `<form method="dialog">${markup}</form>`;
  return new Promise<string>((resolve) => {
    dialog.oncancel = (event) => {
      event.preventDefault();
      if (cancel) dialog.close("back");
    };
    dialog.onclose = () => {
      const result = dialog.returnValue;
      dialog.remove();
      resolve(result);
    };
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector<HTMLElement>("#story-heading")?.focus();
  });
}

function sceneMarkup(
  title: string,
  contents: string,
  controls: string,
  scenery: string,
  scene: string,
  label = "",
  extra = "",
) {
  return `<div class="event-stage story-stage" data-scene="${scene}">${scenery}${extra}</div>
    <section class="event-copy">
    ${label ? `<p class="event-label">${label}</p>` : ""}
    <h2 id="story-heading" tabindex="-1">${title}</h2>${contents}
    <div class="actions">${controls}</div></section>`;
}

export function showStoryFragment(
  fragment: Fragment,
  gender: Gender,
  controls = option("next", "繼續"),
  reread = false,
  skip = false,
) {
  const label = `主線故事・${storyStageNames[fragment.stage]} ${fragment.order}／${stageStory(fragment.stage).length}`;
  return dialogPage(
    sceneMarkup(
      fragment.title,
      `<p>${fragment.text}</p><p class="story-hook">${fragment.hook}</p>
    ${fragment.stage !== "elementary" && !reread ? '<p class="story-note">已收入記憶畫廊</p>' : ""}`,
      controls,
      art(fragment.scene, fragment.figure, gender, fragment.id === "elem-1"),
      fragment.scene,
      label,
      skip
        ? '<button class="story-skip action" type="submit" value="skip">略過</button>'
        : "",
    ),
    reread ? "story-reread" : "",
    reread,
  );
}

export function rememberStory(save: Save, ending = false) {
  galleryRecord(() => window.localStorage, save.storyFragments, true, ending);
}

export async function playElementaryStory(save: Save) {
  for (const fragment of stageStory("elementary")) {
    if (
      (await showStoryFragment(
        fragment,
        save.gender,
        undefined,
        false,
        fragment.order === 1,
      )) === "skip"
    )
      break;
  }
  const updated = { ...save, storyFragments: elementaryIds };
  rememberStory(updated);
  return updated;
}

function pin() {
  return `<span class="story-pin">${img(worldmap, "story-map-thumb")}<i aria-hidden="true"></i></span>`;
}

const closure: Record<StoryStage, string> = {
  elementary: "你開始學會等待。",
  junior: "你開始懷疑，也開始長大。",
  high: "最痛的那幾年，你沒有放手。",
  university: "所有的明信片，都寄到了。",
};

export function stageStoryReminder(save: Save, stage: BoardStage) {
  const { count, total } = storyProgress(save.storyFragments, stage);
  const done = count === total;
  return dialogPage(
    `<section class="event-copy">
    ${done ? pin() : ""}
    <h2 id="story-heading" tabindex="-1">這一階段的記憶拼圖${done ? "完成了" : "尚未完成"}（${count}／${total}）</h2>
    ${done ? "" : "<p>可在畫廊查看，或從本學段起點重玩補齊。</p>"}
    <div class="actions">${
      done
        ? option("next", "繼續")
        : option("next", "繼續前進") +
          (save.stageSnapshots[stage]
            ? option("restart", "從本學段起點重玩")
            : "") +
          option("gallery", "查看記憶畫廊")
    }</div></section>`,
    "story-reminder",
  );
}

export async function confirmStoryRestart(stage: BoardStage) {
  return (
    (await dialogPage(
      `<section class="event-copy">
    <h2 id="story-heading" tabindex="-1">要回到 ${storyStageNames[stage]} 第 1 回合重新開始嗎？</h2>
    <p>這一學段的進度、四維、現金都會回到當時，已經考過的考試成績保留。</p>
    <div class="actions">${option("back", "取消")}${option("restart", "確定重玩")}</div></section>`,
      "story-reminder",
      true,
    )) === "restart"
  );
}

function isLocked(stage: StoryStage, save?: Save) {
  return (
    (stage === "high" && save?.ending === "juniorEarlyExit") ||
    (stage === "university" &&
      (save?.ending === "juniorEarlyExit" ||
        save?.ending === "universityExamFail"))
  );
}

export const replayButtons = (save: Save) =>
  storyStages
    .filter(
      (stage): stage is BoardStage =>
        stage !== "elementary" && Boolean(save.stageSnapshots[stage]),
    )
    .map((stage) =>
      option(`restart:${stage}`, `從${storyStageNames[stage]}起點重玩`),
    )
    .join("");

export async function openStoryGallery(
  save?: Save,
  gender: Gender = save?.gender ?? "girl",
  restart?: (stage: BoardStage) => Promise<boolean>,
) {
  const record = galleryRecord(
    () => localStorage,
    save?.storyFragments,
    Boolean(save),
  );
  const available = story.filter(
    ({ id, stage }) => !isLocked(stage, save) && record.seen.includes(id),
  );
  const progress = save && storyProgress(save.storyFragments);
  while (true) {
    const sections = storyStages
      .map((stage) => {
        if (isLocked(stage, save))
          return `<section class="story-shelf"><h3>${storyStageNames[stage]}・尚未開放</h3></section>`;
        const { count, total } = storyProgress(record.seen, stage);
        const cards = stageStory(stage)
          .map((fragment) => {
            const seen = record.seen.includes(fragment.id);
            return `<button class="story-postcard" value="${fragment.id}" ${seen ? "" : "disabled"}>
          ${seen ? img(background(fragment.scene, gender), "story-card-art") : ""}
          <span class="story-stamp">${fragment.order}</span><strong>${seen ? fragment.title : "尚未寄達"}</strong></button>`;
          })
          .join("");
        const special =
          stage === "university" &&
          record.trueEndingSeen &&
          record.seen.length === story.length
            ? `<button class="story-postcard" value="true-ending">${img(graduationStoryArt(gender), "story-card-art")}<strong>第十八張明信片</strong></button>`
            : "";
        return `<section class="story-shelf"><header><h3>${storyStageNames[stage]} ${count}／${total}</h3>
        ${stage !== "elementary" && save?.stageSnapshots[stage] ? option(`restart:${stage}`, `從${storyStageNames[stage]}起點重玩`) : ""}</header>
        <div class="story-cards">${cards}${special}</div>
        ${count === total ? `<div class="story-closure">${pin()}<p>${closure[stage]}</p></div>` : ""}</section>`;
      })
      .join("");
    const choice = await dialogPage(
      `<header class="story-gallery-header"><div><h2 id="story-heading" tabindex="-1">記憶畫廊</h2>
      ${progress ? `<p>本局 ${progress.count}／${progress.total}</p>` : ""}</div>
      ${option("back", "關閉")}</header><div class="story-shelves">${sections}
      ${record.unavailable ? "<p>無法存取全域紀錄，顯示本局主線故事。</p>" : ""}</div>`,
      "story-gallery",
      true,
    );
    if (choice === "back") return;
    if (choice.startsWith("restart:")) {
      if (await restart?.(choice.slice(8) as BoardStage)) return;
    } else if (choice === "true-ending") {
      await playTrueStoryEnding(gender, true);
    } else {
      let index = available.findIndex(({ id }) => id === choice);
      while (index >= 0 && index < available.length) {
        const where = await showStoryFragment(
          available[index],
          gender,
          option("prev", "上一片", index === 0) +
            option("next", "下一片", index === available.length - 1) +
            option("back", "回畫廊"),
          true,
        );
        if (where === "back") break;
        index += where === "prev" ? -1 : 1;
      }
    }
  }
}

export const bittersweetCopy =
  "畢業典禮後，阿公把第十八張明信片交給你，卡片卻被雨水暈開，只看得清『謝謝你』三個字。阿公一直叫你阿誠，你沒有糾正他，只是握著他的手回家。";
export function showBittersweet(save: Save) {
  return dialogPage(
    sceneMarkup(
      "第十八張明信片",
      `<p>${bittersweetCopy}</p><p class="story-note">主線故事 ${storyProgress(save.storyFragments).count}／19。從學段起點重玩補齊碎片，可以看見真正的結局。</p>`,
      option("next", "繼續") +
        option("gallery", "記憶畫廊") +
        replayButtons(save),
      art("graduation", null, save.gender),
      "graduation",
    ),
  );
}

const truePages = [
  {
    scene: "graduation",
    figure: null,
    text: "畢業那晚，你推阿公回家，兩個人一起把最後一根圖釘插上世界地圖。阿公看了很久，說：「插滿了。」又輕輕說了一句：「阿誠，你的孩子，我顧好了。」",
  },
  {
    scene: "worldmap",
    figure: "grandpa_uni",
    text: "你替阿公蓋好被子，他握著你的手，像你五歲那年一樣拍了拍你的手背，說：「明天記得叫阿公起床。」",
  },
  {
    scene: "dawn",
    figure: null,
    title: "隔天早上",
    text: "窗外傳來郵差的腳踏車鈴聲。阿公睡得很安詳，嘴角帶著笑，再也沒有醒來。",
  },
  {
    scene: "worldmap",
    figure: null,
    text: "你整理阿公的鐵盒，在練習紙的最底下發現最後一張紙。上面不是地址，是阿公描了好幾遍、歪歪扭扭的六個字：「阿公以你為傲。」那是他這輩子學會寫的第一句話，也是最後一句。",
  },
  { scene: "black", text: "「這一次，換我寫信給你了，阿公。」" },
  { scene: "black", text: "—— 完 ——" },
] as const;

export async function playTrueStoryEnding(gender: Gender, reread = false) {
  const controls =
    option("next", "繼續") + (reread ? option("back", "略過") : "");
  for (const [index, page] of truePages.entries()) {
    const black = page.scene === "black";
    const paper =
      index === 3
        ? '<div class="story-paper"><span data-ink="阿公以你為傲">阿公以你為傲</span></div>'
        : "";
    const markup = black
      ? `<section class="story-black-copy"><h2 id="story-heading" tabindex="-1">${page.text}</h2><div class="actions">${controls}</div></section>`
      : sceneMarkup(
          "title" in page ? page.title : "阿公的明信片",
          `<p>${page.text}</p>`,
          controls,
          art(
            page.scene === "dawn" ? "worldmap" : page.scene,
            "figure" in page ? page.figure : null,
            gender,
          ),
          page.scene,
          "",
          paper,
        );
    if (
      (await dialogPage(
        markup,
        `story-ending ${black ? "story-black" : ""}`,
        reread,
      )) === "back"
    )
      return;
  }
  const teaser = document.createElement("dialog");
  teaser.className = "event-dialog story-dialog story-teaser";
  teaser.setAttribute("aria-label", "片尾");
  teaser.innerHTML = `${img(worldmap, "story-teaser-art")}
    <div class="story-desk"><div class="story-teaser-card"><span>${stampYear}</span></div><div class="story-tin"></div>
    <svg class="story-key" width="100" height="40" viewBox="0 0 100 40" aria-hidden="true">
      <path fill="#ac8646" stroke="#e0bc75" stroke-width="2" d="M21 4a16 16 0 1 0 14 24h51v-6h10V13H35A16 16 0 0 0 21 4Zm-3 9a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z" fill-rule="evenodd"/>
      <text x="46" y="21" font-size="7" fill="#63481e">317024</text></svg></div>`;
  teaser.oncancel = (event) => event.preventDefault();
  document.body.append(teaser);
  teaser.showModal();
  await new Promise((resolve) => window.setTimeout(resolve, 3000));
  teaser.close();
  teaser.remove();
}
