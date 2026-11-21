import { currentPartner } from "./data/love-partners";
import { clubs, isClubId } from "./game/clubs";
import { activeDeity, deities } from "./game/deities";
import { contestEvents, contestRanks } from "./game/contests";
import { STAT_LABELS, type Stat } from "./game/opening";
import type { Save } from "./game/saves";
import frame from "../art/hud/frame-large.webp";
import "./school-view.css";

const portraits = import.meta.glob<string>(
  "./board-art/{high,university}/*-intro.webp",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);
const icons = import.meta.glob<string>(
  "../art/hud/{intellect,morality,charm,fitness}.webp",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);

export const introArt = (
  stage: "high" | "university",
  gender: Save["gender"],
) => portraits[`./board-art/${stage}/${gender}-intro.webp`];

export function endingScene(
  title: string,
  content: string,
  background: string,
  summary = false,
) {
  return `<main class="stage assessment-result school-ending">
    <img class="event-background" src="${background}" alt="">
    <section class="assessment-card ${summary ? "graduation-summary" : ""}" ${summary ? `style="--graduation-frame: url('${frame}')"` : ""}>
      <h1>${title}</h1>${content}<p id="notice" role="status"></p>
    </section>
  </main>`;
}

const labels = { junior: "國中", high: "高中", university: "大學" } as const;
const stages = Object.keys(labels) as (keyof typeof labels)[];
export function graduationDetails(save: Save) {
  const statRows = (Object.keys(STAT_LABELS) as Stat[])
    .map(
      (stat) =>
        `<div><dt><img src="${icons[`../art/hud/${stat}.webp`]}" alt="">${STAT_LABELS[stat]}</dt><dd>${save.stats[stat]}</dd></div>`,
    )
    .join("");
  const clubRows = stages
    .map((stage) => {
      const entry = save.clubHistory.find((item) => item.stage === stage);
      return `<li>${labels[stage]}・${entry && isClubId(entry.clubId) ? `${clubs[entry.clubId].name}，${entry.visits} 次` : "—"}</li>`;
    })
    .join("");
  const contests = save.competitions
    .flatMap((entry) =>
      "stage" in entry
        ? [
            `<li>${labels[entry.stage]}第 ${entry.matchNumber} 場・${contestEvents[entry.event].name}・${contestRanks[entry.rank - 1]}</li>`,
          ]
        : [`<li>早期大賽紀錄・第 ${entry.rank} 名</li>`],
    )
    .join("");
  const exam = (id: string) =>
    [...save.exams].reverse().find((entry) => entry.id === id)?.correct;
  const quizCount = save.exams.filter((entry) => entry.id === "quiz").length;
  const deity = activeDeity(save);
  const partner = save.dating ? currentPartner(save.partner) : null;
  const games = ["優秀", "普通", "未達"]
    .map(
      (tier) =>
        `${tier} ${save.minigames.filter((game) => game.tier === tier).length} 次`,
    )
    .join("・");
  return `<div class="graduation-details">
    <section><h2 id="graduate-name"></h2><p>${save.gender === "boy" ? "男" : "女"}・${save.zodiac}座・${save.bloodType} 型</p><p>學歷：大學畢業</p>
      <dl class="graduation-stats">${statRows}</dl><p>現金 ${save.cash.toLocaleString("zh-TW")} 元</p>
    </section>
    <section><h2>社團經歷</h2><ul>${clubRows}</ul></section>
    <section><h2>虛擬城大賽</h2><ul>${contests || "<li>—</li>"}</ul></section>
    <section><h2>考試</h2><p>高中學測 ${exam("gsat") ?? "—"} ／ 10</p><p>大學聯考 ${exam("universityEntrance") ?? "—"} ／ 10</p><p>小考 ${quizCount} 次</p></section>
    <section><h2>小遊戲</h2><p>${games}</p></section>
    <section><h2>其他紀錄</h2><p>收集卡 ${save.cards.length} 張・人生經驗 ${save.experience}</p><p>附身神祇 ${deity ? deities[deity.id].name : "—"}</p><p>交往對象 ${partner ? `${partner.name}・愛情度 ${save.affection} ／ 99` : "—"}</p></section>
  </div>`;
}
