import { UI } from "./data/ui";
import "./style.css";
import {
  TEXT as T,
  STAT_NAMES,
  STAGE_NAMES,
  TILE_NAMES,
  TILE_ICONS,
  PERSONALITIES,
  DATE_QUESTIONS,
} from "./data/text";
import {
  RULES as R,
  CLUBS,
  GODS,
  PARTNERS,
  ZODIACS,
  MAPS,
  FORK_ROUTES,
  TUTORIAL,
  MINI_GAMES,
  STAT_KEYS,
} from "./data/config";
import { QUESTIONS } from "./data/questions";
import * as E from "./game/engine";
import { save, load, slotInfo, serialize, parseSave } from "./game/storage";
import { mountMini } from "./game/minigames";
import type { GameState, Profile, Stat } from "./game/types";
const root = document.querySelector<HTMLDivElement>("#app")!;
let game: GameState | null = null,
  screen: "home" | "create" | "game" = "home",
  overlay:
    "save" | "family" | "records" | "help" | "practice" | "status" | null =
    null,
  styleChoice = false,
  miniCleanup: (() => void) | null = null,
  practiceId: number | null = null,
  practiceResult: string | null = null;
let draft: Profile = {
  name: UI.defaultName,
  gender: "female",
  month: 5,
  day: 21,
  blood: "A",
  zodiac: 5,
};
const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const fmt = (n: number) => n.toLocaleString("zh-TW");
const button = (label: string, action: string, cls = "", disabled = false) =>
  `<button class="${cls}" data-action="${action}" ${disabled ? "disabled" : ""}>${esc(label)}</button>`;
const tag = (s: string, cls = "") =>
  `<span class="tag ${cls}">${esc(s)}</span>`;
function statsHTML(stats: GameState["stats"]) {
  return STAT_KEYS.map(
    (key, i) =>
      `<div class="stat stat-${i}"><span class="stat-icon">${["◇", "♡", "✦", "⚡"][i]}</span><span>${STAT_NAMES[key]}</span><strong>${fmt(stats[key])}</strong></div>`,
  ).join("");
}
function header() {
  return `<header class="site-header"><a href="#" class="brand" data-action="home"><span class="brand-mark">✦</span><span>${T.title}<small>${T.subtitle}</small></span></a><nav>${game ? button(T.stats, "status", "quiet") + button(T.save, "save", "quiet") : ""}${button(T.help, "help", "quiet")}<span class="edition">${UI.edition} <b>01</b></span></nav></header>`;
}
function checkpoint() {
  if (game) {
    try {
      save(game, 0);
    } catch {
      toast(T.saveFailed);
    }
  }
}
function toast(message: string) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = message;
  setTimeout(() => el?.remove(), 3500);
}
function render() {
  miniCleanup?.();
  miniCleanup = null;
  root.innerHTML =
    header() +
    `<main>${screen === "home" ? home() : screen === "create" ? create() : play()}</main><footer>${UI.footer} <span>${UI.footerMark}</span></footer>` +
    (overlay ? modal() : "");
  if (screen === "game" && game?.phase === "mini" && !overlay && game.mini) {
    const m = game.mini;
    miniCleanup = mountMini(
      document.querySelector("#minigame")!,
      m.id,
      (won, score) => {
        miniCleanup?.();
        miniCleanup = null;
        const result = `${won ? T.win : T.lose} · ${score} ${T.points}`;
        E.completeMini(game!, won, score);
        checkpoint();
        render();
        toast(result);
      },
    );
  }
  if (overlay === "practice" && practiceId !== null && !practiceResult) {
    miniCleanup = mountMini(
      document.querySelector("#practice-game")!,
      practiceId,
      (won, score) => {
        practiceResult = `${won ? T.win : T.lose} · ${score} ${T.points}`;
        render();
      },
    );
  }
}
function home() {
  const saved = slotInfo(0);
  return `<section class="hero"><div class="hero-copy"><div class="eyebrow"><span></span> ${T.eyebrow}</div><h1>${UI.heroTitle}<br>${UI.heroSecond}<span>${UI.heroThird}</span></h1><p>${UI.heroLine1}<br>${UI.heroLine2}</p><div class="hero-actions">${button(T.newLife + " ↗", "new", "primary")}${saved ? button(T.continue, "continue", "secondary") : ""}</div><p class="subtle">${T.startHint}</p><div class="hero-facts"><div><strong>80</strong><span>${UI.heroTurns}</span></div><div><strong>8</strong><span>${UI.heroGames}</span></div><div><strong>∞</strong><span>${UI.heroPossibilities}</span></div></div></div><div class="hero-art"><span class="art-orbit"></span><div class="sun"></div><div class="cloud cloud-a"></div><div class="cloud cloud-b"></div><div class="school"><div class="school-roof"></div><div class="school-clock">✦</div><div class="windows">${"<i></i>".repeat(6)}</div><div class="school-door"></div></div><div class="tree tree-a"></div><div class="tree tree-b"></div><div class="path"></div><div class="art-dice">⚄</div><div class="float-card card-a">✦<span>${UI.heroStart}</span><small>${UI.heroRange}</small></div><div class="float-card card-b">♡ <span>${UI.heroCard}</span></div><span class="art-caption">${UI.heroCaption}</span></div></section><section class="chapter-strip"><span class="eyebrow">${UI.chapters}</span>${[
    ["00", UI.primarySchool, UI.primaryDesc],
    ["01", UI.juniorSchool, UI.juniorDesc],
    ["02", UI.seniorSchool, UI.seniorDesc],
    ["03", UI.universitySchool, UI.universityDesc],
  ]
    .map(
      ([n, t, s]) =>
        `<div><small>${n}</small><strong>${t}</strong><span>${s}</span></div>`,
    )
    .join("")}</section>`;
}
function create() {
  const stats = E.initialStats(draft);
  const z = ZODIACS[E.zodiac(draft.month, draft.day)];
  const days = new Date(2000, draft.month, 0).getDate();
  return `<section class="create-page"><div class="section-heading"><span class="eyebrow">${UI.characterEyebrow}</span><h1>${T.profileTitle}</h1><p>${T.profileIntro}</p></div><div class="create-layout"><form id="profile-form" class="panel"><label>${T.name}<input name="name" maxlength="24" required value="${esc(draft.name)}" autocomplete="off"></label><div class="form-row"><label>${T.gender}<select name="gender"><option value="female" ${draft.gender === "female" ? "selected" : ""}>${T.female}</option><option value="male" ${draft.gender === "male" ? "selected" : ""}>${T.male}</option></select></label><label>${T.blood}<select name="blood">${["A", "B", "O", "AB"].map((v) => `<option ${draft.blood === v ? "selected" : ""}>${v}</option>`).join("")}</select></label></div><fieldset><legend>${T.birthday}</legend><div class="form-row"><label>${T.month}<select name="month">${Array.from({ length: 12 }, (_, i) => `<option ${draft.month === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></label><label>${T.day}<select name="day">${Array.from({ length: days }, (_, i) => `<option ${draft.day === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></label></div></fieldset><button class="primary wide" type="submit">${T.newLife} ↗</button></form><aside class="profile-card"><div class="avatar">${draft.gender === "female" ? "◕" : "◉"}<span>✦</span></div><div>${tag(z.name)} ${tag(`${draft.blood} ${UI.bloodType}`)}</div><h2>${esc(draft.name)}</h2><p>${STAT_NAMES[z.main]} +${R.zodiacMain}・${STAT_NAMES[z.sub]} +${R.zodiacSub}</p><p class="subtle">${T.baseHint}${UI.extraBonus}</p><div class="stats-grid">${statsHTML(stats)}</div><p class="subtle">${UI.seasonBonus}${STAT_NAMES[E.seasonStat(draft.month)]} +${R.season}</p></aside></div></section>`;
}
function status(g: GameState) {
  return `<section class="status-strip"><div class="player-badge"><div class="small-avatar">${g.profile.gender === "female" ? "◕" : "◉"}</div><div><strong>${esc(g.profile.name)}</strong><small>${ZODIACS[g.profile.zodiac].name} · ${g.profile.blood} ${UI.bloodType}</small></div></div><div class="stats-grid">${statsHTML(g.stats)}</div><div class="wallet"><span>${T.cash}</span><strong>$ ${fmt(g.cash)}</strong><small>${T.level} ${g.level}</small></div></section>`;
}
function effects(g: GameState) {
  return `<div class="effects">${tag(`${g.retrograde > 0 ? 1 : 2} ${T.dice}`)}${g.retrograde ? tag(`${T.retro} ${g.retrograde} ${T.turn}`, "bad") : ""}${g.fortune ? tag(`${T.fortune} ${g.fortune} ${T.turn}`, "good") : ""}${g.god ? tag(`${GODS[g.god.id].symbol} ${GODS[g.god.id].name}・${GODS[g.god.id].good ? T.good : T.bad} ${g.god.remaining} ${T.turn}`, GODS[g.god.id].good ? "good" : "bad") : tag(T.noGod)}${g.fortuneQueued ? tag(UI.fortuneQueued, "good") : ""}</div>`;
}
function play() {
  const g = game!;
  if (!g) return home();
  const end = g.phase === "end";
  const limit = g.stage === "society" ? g.totalTurn : R.turns[g.stage];
  return `${status(g)}<section class="game-heading"><div><span class="eyebrow">${UI.chapter} ${g.stage === "tutorial" ? "00" : g.stage === "junior" ? "01" : g.stage === "senior" ? "02" : "03"} / ${g.stage === "society" ? T.continuation : T.progress}</span><h1>${end ? T.ending : `${STAGE_NAMES[g.stage]}，${g.stage === "tutorial" ? UI.tutorialChapter : g.stage === "university" ? UI.universityChapter : UI.schoolChapter}`}</h1></div><div class="turn-badge"><strong>${g.turn.toString().padStart(2, "0")}</strong><span>/ ${limit} ${T.turn}</span></div></section>${effects(g)}<div class="game-layout"><section class="board-panel">${end ? ending(g) : board(g)}<div class="board-caption"><span>${UI.youPosition}</span><span>${CLUBS[g.club].symbol} ${CLUBS[g.club].name}</span>${g.stage === "tutorial" ? button(T.skipTutorial, "skip", "text-button") : ""}</div></section><aside class="action-column"><section class="action-panel" aria-live="polite">${actionPanel(g)}</section><section class="journal"><div class="panel-title"><h3>${T.journal}</h3><span>✎</span></div><ol>${g.log
    .slice(0, 4)
    .map((s) => `<li>${esc(s)}</li>`)
    .join(
      "",
    )}</ol></section><div class="quick-links">${button("♡ " + T.family, "family")}${button("▤ " + T.collection, "records")}${button("▣ " + T.practice, "practice")}</div></aside></div>`;
}
function board(g: GameState) {
  const map = MAPS[g.stage];
  return `<div class="board"><div class="board-center"><div class="campus-icon"><span>⚑</span><div></div><div></div><div></div></div><small>${UI.daysGrow}</small><h2>${STAGE_NAMES[g.stage]}${UI.daily}</h2><p>${g.stage === "tutorial" ? UI.curious : `${UI.remainingTurns} ${Math.max(0, R.turns[g.stage] - g.turn)} ${UI.meetMore}`}</p><div class="board-progress"><span style="width:${(g.turn / R.turns[g.stage]) * 100}%"></span></div>${g.god ? `<div class="board-god">${GODS[g.god.id].symbol}<small>${GODS[g.god.id].effect}</small></div>` : ""}</div><div class="tiles">${map
    .map((tile, i) => {
      const angle = (i / map.length) * Math.PI * 2 - Math.PI / 2;
      const x = 50 + 42 * Math.cos(angle),
        y = 50 + 42 * Math.sin(angle);
      return `<div class="tile tile-${tile} ${i === g.position ? "current" : ""}" style="left:${x}%;top:${y}%" aria-label="${i + 1} ${TILE_NAMES[tile]}${i === g.position ? " " + UI.youHere : ""}"><span>${TILE_ICONS[tile]}</span><small>${TILE_NAMES[tile]}</small>${i === g.position ? '<b class="player-pin">●</b>' : ""}</div>`;
    })
    .join(
      "",
    )}</div></div><div class="map-legend">${(["event", "game", "club", "quiz", "contest", ...(g.stage === "university" ? ["love"] : [])] as (keyof typeof TILE_NAMES)[]).map((t) => `<span class="legend-${t}">${TILE_ICONS[t]} ${TILE_NAMES[t]}</span>`).join("")}</div>`;
}
function actionPanel(g: GameState): string {
  const heading = (label: string, title: string) =>
    `<span class="eyebrow">${label}</span><h2>${title}</h2>`;
  if (g.phase === "ready")
    return `${heading(UI.nextMove, g.stage === "tutorial" ? T.tutorial : T.ready)}<p>${g.stage === "tutorial" ? TUTORIAL[g.tutorialStep] : `${STAGE_NAMES[g.stage]}${UI.ordinal} ${g.turn + 1} ${T.turn}，${UI.dayQuestion}`}</p><div class="dice-display">${g.dice.length ? g.dice.map((n) => `<span>${["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][n]}</span>`).join("") : "<span>⚄</span><span>⚂</span>"}</div>${g.god?.id === 2 ? `<label>${T.steps}<input id="chosen-steps" type="number" min="${g.retrograde ? 1 : 2}" max="${g.retrograde ? 6 : 12}" value="${g.retrograde ? 3 : 7}"></label>` : ""}${button(T.roll + " ↗", "roll", "primary wide")}<small class="subtle">${UI.autoHint}</small>`;
  if (g.phase === "fork")
    return `${heading(UI.choosePath, T.forkTitle)}<p>${T.forkHint}</p>${tag(`${T.remaining} ${g.remainingSteps}`)}<div class="choice-list">${FORK_ROUTES[g.stage].map((f, i) => button(`${f.label} → ${TILE_NAMES[MAPS[g.stage][f.destination % MAPS[g.stage].length]]}`, "fork:" + i, "choice")).join("")}</div>`;
  if (g.phase === "notice")
    return `${heading(UI.littleChapter, g.stage === "tutorial" ? TUTORIAL[Math.min(g.tutorialStep, TUTORIAL.length - 1)] : T.journal)}<div class="event-symbol">✦</div><p>${esc(g.notice)}</p>${button(T.next + " →", "next", "primary wide")}`;
  if (g.phase === "club")
    return `${heading(UI.findPeople, T.chooseClub)}<p>${T.clubHint}</p><div class="club-grid">${CLUBS.map((c, i) => button(`${c.symbol} ${c.name} · ${STAT_NAMES[c.main]} / ${STAT_NAMES[c.sub]}`, "club:" + i, "club-choice")).join("")}</div>`;
  if (g.phase === "quiz" && g.quiz) {
    const quiz = g.quiz;
    const q = QUESTIONS.find((q) => q.id === quiz.ids[quiz.index])!;
    return `${heading(q.category, T[quiz.kind])}<div class="quiz-meta">${quiz.index + 1} / ${quiz.ids.length} ${T.question}<span>${T.correctCount} ${quiz.correct}</span></div><h3 class="question">${esc(q.prompt)}</h3><div class="choice-list">${q.choices.map((c, i) => button(`${String.fromCharCode(65 + i)}. ${c}`, "answer:" + i, `choice ${quiz.feedback !== null && i === q.answer ? "answer-correct" : ""} ${quiz.selected === i ? "selected" : ""}`, quiz.feedback !== null || E.quizHint(g) === i)).join("")}</div>${quiz.feedback !== null ? `<p class="feedback">${esc(quiz.feedback)}</p>${button(quiz.index === quiz.ids.length - 1 ? T.quizSubmit : T.quizNext, "question-next", "primary wide")}` : `<small class="subtle">${T.answerHint}${E.quizHint(g) !== null ? T.intelligenceHint : ""}</small>`}`;
  }
  if (g.phase === "mini" && g.mini) {
    const m = g.mini;
    return `${heading(m.contest ? T.contest : `${T.round} ${m.round + 1} / ${R.miniRounds} · ${m.wins} ${UI.victories}`, MINI_GAMES[m.id].name)}<p>${MINI_GAMES[m.id].instruction}</p><div id="minigame"></div>`;
  }
  if (g.phase === "contest")
    return `${heading(UI.cup, styleChoice ? T.styleTitle : T.contest)}<p>${styleChoice ? T.styleHint : T.contestHint}</p><div class="choice-list">${styleChoice ? T.styleOptions.map((s, i) => button(s, "style:" + i, "choice")).join("") : T.contestNames.map((s, i) => button(`${["◇", "✦", "⚡"][i]} ${s}`, "contest:" + i, "choice")).join("")}</div>`;
  if (g.phase === "love") return lovePanel(g);
  if (g.phase === "date" && g.date) {
    const q = DATE_QUESTIONS[g.date.index];
    return `${heading(`${T.date} ${g.date.index + 1} / ${R.dateQuestions}`, q.prompt)}<div class="choice-list">${q.options.map((s, i) => button(s, "date-answer:" + i, "choice")).join("")}</div>`;
  }
  if (g.phase === "offering" && g.god) {
    const god = GODS[g.god.id];
    return `${heading(T.offering, god.name)}<p>${god.effect}</p><p>${T.offeringHint}</p>${button(`${T.offeringPay} $${fmt(god.cost)}`, "offer", "primary wide", g.cash < god.cost)}${button(T.offeringSkip, "leave", "quiet wide")}`;
  }
  if (g.phase === "end")
    return `${heading(UI.toContinue, T.continuation)}<p>${T.endingHint}</p>${button(T.export, "export", "primary wide")}${button(T.save, "save", "secondary wide")}${button(T.restart, "new", "quiet wide")}`;
  return "";
}
function partnerName(g: GameState) {
  return g.partner === null
    ? ""
    : PARTNERS[g.partner].names[g.profile.gender === "male" ? 0 : 1];
}
function lovePanel(g: GameState) {
  if (g.marriedAt !== null)
    return `<span class="eyebrow">HOME, SWEET HOME</span><h2>${T.family}</h2><p>${esc(partnerName(g))}・${T.married}</p><div class="choice-list">${T.familyChoices.map((s, i) => button(s, "nurture:" + STAT_KEYS[i], "choice")).join("")}</div>`;
  if (g.partner !== null) {
    const partner = PARTNERS[g.partner];
    return `<span class="eyebrow">A LITTLE CLOSER</span><h2>${esc(partnerName(g))}</h2><p>${partner.bio}</p><p>${T.love} <strong>${g.love} / ${R.loveMax}</strong></p><p class="subtle">${DATE_QUESTIONS.map((q, i) => q.options[partner.likes[i]]).join("・")}</p><p>${T.loveHint}</p>${button(T.date, "date", "primary wide")}${button(T.marry, "marry", "secondary wide", g.love < R.loveMax)}${button(T.breakup, "breakup", "quiet")}${button(T.leave, "leave", "quiet")}`;
  }
  return `<span class="eyebrow">NICE TO MEET YOU</span><h2>${T.loveTitle}</h2><div class="partner-list">${PARTNERS.map((p, i) => `<div><strong>${p.names[g.profile.gender === "male" ? 0 : 1]}</strong> ${tag(p.tier)}<p>${p.bio}</p><small>${T.charmNeed} ${p.threshold}・${T.meetingCost} $${fmt(p.cost)}<br>${T.salary} $${fmt(p.salary)}</small>${button(T.meet, "meet:" + i, "secondary wide", g.stats.charm < p.threshold || g.cash < p.cost)}</div>`).join("")}</div>${button(T.leave, "leave", "quiet wide")}`;
}
function familyDetails(g: GameState) {
  return `<div class="detail-block"><h3>${g.partner === null ? T.single : esc(partnerName(g)) + "・" + (g.marriedAt === null ? T.dating : T.married)}</h3><p>${T.love} ${g.love} / ${R.loveMax}</p>${g.partner === null ? `<p>${T.noPartner}</p>` : `<p>${PARTNERS[g.partner].tier}・${T.salary} $${fmt(g.marriedAt !== null ? PARTNERS[g.partner].salary : 0)}</p>`}${g.pregnancy ? `<p>${T.pregnancy}・${UI.remainingTurns} ${Math.max(0, R.pregnancyTurns - (g.totalTurn - g.pregnancy.conceivedTurn))} ${UI.untilBirth} $${R.childCost}</p>` : ""}<p>${T.child} ${g.children.length}・${UI.carePerTurn} $${fmt(g.children.length * R.childCost)}</p>${g.children.length ? g.children.map((c) => `<div class="child-card"><strong>${esc(c.name)}・${PERSONALITIES[c.personality]}</strong><div class="stats-grid">${statsHTML(c.stats)}</div></div>`).join("") : `<p class="subtle">${T.noChildren}</p>`}<p>${T.guardian}</p></div>`;
}
function records(g: GameState) {
  return `<h3>${T.clubHistory}</h3><p>${g.clubHistory.map((c) => `${STAGE_NAMES[c.stage]}・${CLUBS[c.club].name}`).join(" → ") || T.noRecords}</p><h3>${T.exams}</h3>${g.examHistory.map((e) => `<p>${T[e.kind as "quiz"]}：${e.correct} / ${e.total}・${(e.elapsedMs / 1000).toFixed(1)} ${UI.seconds}</p>`).join("") || `<p>${T.noRecords}</p>`}<h3>${T.contest}</h3>${g.contests.map((c) => `<p>${STAGE_NAMES[c.stage]}・${T.contestNames[c.type]}・${T.ranks[c.rank]}</p>`).join("") || `<p>${T.noRecords}</p>`}<h3>${T.cards}</h3><p>${g.cards.length ? g.cards.map((c) => `${c.id === "morning-kite" ? UI.cardName : esc(c.id)} × ${c.count}`).join("、") : T.noRecords}</p><p>${T.level} ${g.level}・${UI.experience} ${g.xp}</p>${g.god ? `<h3>${T.god}：${GODS[g.god.id].name}</h3><p>${GODS[g.god.id].effect}・${g.god.remaining} ${T.turn}</p>` : ""}`;
}
function ending(g: GameState) {
  const title =
    g.education === "university"
      ? T.universityEnding
      : g.education === "senior"
        ? T.seniorEnding
        : T.juniorEnding;
  const career =
    g.education === "university"
      ? T.universityCareer
      : g.education === "senior"
        ? T.seniorCareer
        : T.juniorCareer;
  return `<div class="ending"><span class="ending-icon">✦</span><span class="eyebrow">${UI.endingEyebrow}</span><h2>${title}</h2><p>${career}</p><p>${T.endingHint}</p><div class="detail-block">${records(g)}</div>${familyDetails(g)}</div>`;
}
function modal() {
  let title = "",
    body = "";
  if (overlay === "save") {
    title = T.save;
    body = `<div class="save-slots">${Array.from({ length: 4 }, (_, i) => {
      const info = slotInfo(i);
      return `<div class="save-slot"><div><strong>${i === 0 ? T.auto : T.manual + " " + i}</strong><p>${info ? `${esc(info.state.profile.name)}・${STAGE_NAMES[info.state.stage]} ${info.state.turn} ${T.turn}` : T.empty}</p>${info ? `<small>${new Date(info.savedAt).toLocaleString("zh-TW")}</small>` : ""}</div><div>${i > 0 ? button(T.write, "save-slot:" + i, "secondary", !game) : ""}${button(T.load, "load-slot:" + i, "quiet", !info)}</div></div>`;
    }).join(
      "",
    )}</div><div class="form-row">${button(T.export, "export", "primary", !game)}<label class="file-button">${T.import}<input type="file" id="import-file" accept="application/json,.json"></label></div>`;
  }
  if (overlay === "status") {
    title = T.stats;
    body = status(game!) + effects(game!);
  }
  if (overlay === "family") {
    title = T.family;
    body = familyDetails(game!);
  }
  if (overlay === "records") {
    title = T.collection;
    body = records(game!);
  }
  if (overlay === "help") {
    title = T.help;
    body = `<p>${T.helpBody}</p><h3>${T.god}</h3>${GODS.map((g) => `<p>${g.symbol} <strong>${g.name}</strong>・${g.good ? T.good : T.bad}・${g.turns} ${T.turn}<br>${g.effect}・${T.offeringPay} $${fmt(g.cost)}</p>`).join("")}<p>${UI.artHint}</p>`;
  }
  if (overlay === "practice") {
    title = T.practice;
    body =
      practiceId === null
        ? `<p>${T.practiceHint}</p><div class="club-grid">${MINI_GAMES.map((m, i) => button(m.name, "practice:" + i, "choice")).join("")}</div>`
        : `<h3>${MINI_GAMES[practiceId].name}</h3><p>${MINI_GAMES[practiceId].instruction}</p>${practiceResult ? `<p class="feedback">${practiceResult}</p>${button(T.miniNext, "practice:" + practiceId, "primary")}` : '<div id="practice-game"></div>'}${button(T.miniQuit, "practice-back", "quiet wide")}`;
  }
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="${title}" tabindex="-1"><div class="panel-title"><h2>${title}</h2>${button("✕", "close", "icon-button")}</div>${body}</section></div>`;
}
function exportGame() {
  if (!game) return;
  const blob = new Blob([serialize(game)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `virtual-life-${game.totalTurn}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
root.addEventListener("click", (event) => {
  const el = (event.target as HTMLElement).closest<HTMLElement>(
    "[data-action]",
  );
  if (!el || el.hasAttribute("disabled")) return;
  event.preventDefault();
  const [action, arg] = el.dataset.action!.split(":");
  if (action === "close") {
    overlay = null;
    practiceId = null;
    practiceResult = null;
    render();
    return;
  }
  if (action === "new") {
    if (game && !confirm(T.confirmRestart)) return;
    overlay = null;
    screen = "create";
    render();
    return;
  }
  if (action === "home") {
    screen = game ? "game" : "home";
    render();
    return;
  }
  if (
    ["save", "family", "records", "help", "practice", "status"].includes(
      action,
    ) &&
    arg === undefined
  ) {
    overlay = action as typeof overlay;
    practiceId = null;
    practiceResult = null;
    render();
    document.querySelector<HTMLElement>(".modal")?.focus();
    return;
  }
  if (action === "continue" || action === "load-slot") {
    if (action === "load-slot" && game && !confirm(T.confirmLoad)) return;
    try {
      const loaded = load(action === "continue" ? 0 : Number(arg));
      if (loaded) {
        game = loaded;
        if (game.quiz && game.quiz.feedback === null)
          game.quiz.startedAt = Date.now();
        screen = "game";
        overlay = null;
        styleChoice = false;
        render();
      }
    } catch {
      toast(T.invalidSave);
    }
    return;
  }
  if (action === "save-slot") {
    try {
      save(game!, Number(arg));
      toast(T.saveSuccess);
      render();
    } catch {
      toast(T.saveFailed);
    }
    return;
  }
  if (action === "export") {
    exportGame();
    return;
  }
  if (action === "practice" && arg !== undefined) {
    practiceId = Number(arg);
    practiceResult = null;
    render();
    return;
  }
  if (action === "practice-back") {
    practiceId = null;
    practiceResult = null;
    render();
    return;
  }
  const g = game;
  if (!g) return;
  switch (action) {
    case "roll":
      checkpoint();
      E.beginTurn(
        g,
        Math.random,
        Number(
          document.querySelector<HTMLInputElement>("#chosen-steps")?.value,
        ) || undefined,
      );
      break;
    case "next":
      E.continueTurn(g);
      break;
    case "fork":
      E.takeFork(g, Number(arg));
      break;
    case "club":
      E.selectClub(g, Number(arg));
      break;
    case "skip":
      E.skipTutorial(g);
      break;
    case "answer":
      E.answerQuiz(g, Number(arg));
      break;
    case "question-next":
      E.nextQuestion(g);
      break;
    case "contest":
      if (arg === "1") {
        styleChoice = true;
        render();
        return;
      }
      E.chooseContest(g, Number(arg));
      break;
    case "style":
      E.styleContest(g, Number(arg));
      styleChoice = false;
      break;
    case "meet":
      E.meet(g, Number(arg));
      break;
    case "date":
      E.startDate(g);
      break;
    case "date-answer":
      E.answerDate(g, Number(arg));
      break;
    case "marry":
      E.marry(g);
      break;
    case "breakup":
      if (confirm(T.breakupConfirm)) E.breakup(g);
      break;
    case "nurture":
      E.nurture(g, arg as Stat);
      break;
    case "leave":
      E.leaveTile(g);
      break;
    case "offer":
      E.offer(g);
      break;
  }
  checkpoint();
  render();
});
root.addEventListener("change", async (event) => {
  const el = event.target as HTMLInputElement;
  if (el.id === "import-file") {
    const file = el.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error("size");
      const incoming = parseSave(await file.text());
      if (game && !confirm(T.confirmImport)) return;
      game = incoming;
      if (game.quiz && game.quiz.feedback === null)
        game.quiz.startedAt = Date.now();
      screen = "game";
      overlay = null;
      styleChoice = false;
      checkpoint();
      render();
      toast(T.imported);
    } catch {
      toast(T.invalidSave);
    }
    return;
  }
  if (el.closest("#profile-form")) {
    if (el.name === "name") {
      draft.name = el.value.trim().slice(0, 24) || UI.defaultName;
      const title = root.querySelector(".profile-card h2");
      if (title) title.textContent = draft.name;
      return;
    }
    const form = root.querySelector<HTMLFormElement>("#profile-form")!;
    const data = new FormData(form);
    draft = {
      name: String(data.get("name")).trim().slice(0, 24) || UI.defaultName,
      gender: data.get("gender") as Profile["gender"],
      blood: data.get("blood") as Profile["blood"],
      month: Number(data.get("month")),
      day: Number(data.get("day")),
      zodiac: 0,
    };
    draft.day = Math.min(draft.day, new Date(2000, draft.month, 0).getDate());
    render();
  }
});
root.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  if (form.id !== "profile-form") return;
  draft.name =
    String(new FormData(form).get("name")).trim().slice(0, 24) ||
    UI.defaultName;
  game = E.createGame(draft);
  screen = "game";
  checkpoint();
  render();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && overlay) {
    overlay = null;
    practiceId = null;
    render();
  }
  if (event.key === "Tab" && overlay) {
    const nodes = [
      ...document.querySelectorAll<HTMLElement>(
        '.modal button:not(:disabled), .modal input, .modal select, .modal [tabindex="0"]',
      ),
    ].filter((e) => !e.hidden);
    if (!nodes.length) return;
    const first = nodes[0],
      last = nodes.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
render();
