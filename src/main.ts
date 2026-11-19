import { showStageBoard } from "./junior-board";
import { preloadSchool } from "./board-view";
import {
  isBoardStage,
  schoolBoards,
  type SchoolBoard,
} from "./data/school-board";
import { finishEntrance, graduate } from "./game/school";
import { graduationDetails, introArt, endingScene } from "./school-view";
import firstJob from "../art/cg_first_job_final.jpg";
import graduation from "../art/cg_graduation_final.jpg";
import { assets, preloadOpening } from "./assets";
import {
  BLOOD_TYPES,
  calculateOpening,
  daysInMonth,
  SEASONS,
  seasonFor,
  STAT_LABELS,
  ZODIACS,
  zodiacFor,
  type Birthday,
  type Profile,
  type Stat,
} from "./game/opening";
import {
  createSave,
  exportSave,
  importSave,
  saveStorage,
  SLOT_NAMES,
  type Save,
} from "./game/saves";
import { stageFinished } from "./game/board";
import { startAssessment } from "./game/questions";
import { resultScene, scoreText, showAssessment } from "./exam-view";
import "./style.css";

const app = document.querySelector<HTMLElement>("#app")!;
const slots = saveStorage({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
});
const gameName = "未來人生・進行曲";
type SlotMode = "load" | "write" | "import";

function element<T extends HTMLElement>(selector: string) {
  return app.querySelector<T>(selector)!;
}
function action(id: string, handler: () => void | Promise<void>) {
  element<HTMLButtonElement>("#" + id).onclick = handler;
}
function backdrop(scene: keyof Pick<typeof assets, "title" | "junior">) {
  const { portrait, landscape } = assets[scene];
  return `<picture class="backdrop"><source media="(orientation: portrait)" srcset="${portrait}"><img src="${landscape}" alt=""></picture>`;
}
function button(id: string, text: string, disabled = false) {
  return `<button id="${id}" class="action" type="button" ${disabled ? "disabled" : ""}>${text}</button>`;
}
function show(content: string, focus = true) {
  app.innerHTML = content;
  if (focus) {
    const heading = app.querySelector("h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }
}
function panel(title: string, content: string, scene?: "junior") {
  show(`<div class="stage interior">${scene ? backdrop(scene) : ""}
    <section class="panel"><h1>${title}</h1>${content}<p id="notice" role="status"></p></section></div>`);
}
function notice(error: unknown) {
  element("#notice").textContent =
    error instanceof Error ? error.message : "操作失敗，請再試一次。";
}
function readSlots() {
  return SLOT_NAMES.map((_, slot) => {
    try {
      return { save: slots.read(slot), unreadable: false };
    } catch {
      return { save: null, unreadable: true };
    }
  });
}

function title() {
  const records = readSlots();
  show(`<div class="stage title">${backdrop("title")}
    <h1 class="brand"><img alt="${gameName}" src="${assets.logo}"></h1>
    <nav class="title-actions" aria-label="遊戲選單">
      ${button("start", "開始新人生")}
      ${button("continue", "繼續遊戲", !records.some((record) => record.save))}
      ${button("import", "匯入存檔")}
      <input type="file" id="file" accept=".json,application/json" hidden>
      <p id="notice" role="status"></p>
    </nav>
  </div>`);
  action("start", () => setup());
  action("continue", () => selectSlot("load"));
  const file = element<HTMLInputElement>("#file");
  action("import", () => file.click());
  file.onchange = async () => {
    const selected = file.files?.[0];
    file.value = "";
    if (!selected) return;
    try {
      if (selected.size > 1024 * 1024) throw new Error("存檔檔案超過 1 MB。");
      selectSlot("import", importSave(await selected.text()));
    } catch (error) {
      if (file.isConnected) notice(error);
    }
  };
}

const initialProfile: Profile = {
  gender: "boy",
  name: "",
  birthday: { month: 3, day: 21 },
  bloodType: "A",
};
const options = (values: readonly (string | number)[], suffix = "") =>
  values
    .map((value) => `<option value="${value}">${value}${suffix}</option>`)
    .join("");
const numbers = (length: number) =>
  Array.from({ length }, (_, index) => index + 1);
const birthdays = numbers(12).flatMap((month) =>
  numbers(daysInMonth(month)).map((day) => ({ month, day })),
);
const portrait = (gender: Profile["gender"], stage: "elem" | "junior") =>
  `<span class="portrait"><img src="${assets.heroes[stage][gender]}" alt=""></span>`;

function setup(profile = initialProfile) {
  panel(
    "建立你的角色",
    `<form id="profile">
    <div class="setup-grid">
      <fieldset class="characters"><legend>選擇主角</legend>
        <div class="hero-options">
          <label><input type="radio" name="gender" value="boy">${portrait("boy", "elem")}男主角</label>
          <label><input type="radio" name="gender" value="girl">${portrait("girl", "elem")}女主角</label>
        </div>
      </fieldset>
      <div class="fields">
        <label class="wide">名字<input id="name" name="name" required maxlength="20" autocomplete="off" placeholder="輸入角色名字"></label>
        <fieldset class="wide birthday"><legend>生日</legend>
          <select id="month" aria-label="出生月份">${options(numbers(12), " 月")}</select>
          <select id="day" aria-label="出生日期"></select>
        </fieldset>
        <label>星座<select id="zodiac">${options([...new Set(ZODIACS.map((row) => row[0]))], "座")}</select></label>
        <label>血型<select id="blood">${options(Object.keys(BLOOD_TYPES), " 型")}</select></label>
        <label class="wide">出生季節<select id="season">${options(SEASONS.map((row) => row[0]))}</select></label>
        <p class="wide hint">星座與出生季節會依生日帶出。選擇星座或季節時，生日也會同步調整。</p>
      </div>
    </div>
    <div class="actions">${button("back", "回標題")}<button class="action" type="submit">查看開局結果</button></div>
  </form>`,
  );
  const name = element<HTMLInputElement>("#name");
  const month = element<HTMLSelectElement>("#month");
  const day = element<HTMLSelectElement>("#day");
  const zodiac = element<HTMLSelectElement>("#zodiac");
  const season = element<HTMLSelectElement>("#season");
  const blood = element<HTMLSelectElement>("#blood");
  element<HTMLInputElement>(`[name=gender][value=${profile.gender}]`).checked =
    true;
  name.value = profile.name;
  blood.value = profile.bloodType;
  function sync(birthday: Birthday) {
    month.value = String(birthday.month);
    day.innerHTML = options(numbers(daysInMonth(birthday.month)), " 日");
    day.value = String(birthday.day);
    zodiac.value = zodiacFor(birthday)[0];
    season.value = seasonFor(birthday.month)[0];
  }
  sync(profile.birthday);
  const currentBirthday = () => ({
    month: Number(month.value),
    day: Number(day.value),
  });
  month.onchange = () =>
    sync({
      month: Number(month.value),
      day: Math.min(Number(day.value), daysInMonth(Number(month.value))),
    });
  day.onchange = () => sync(currentBirthday());
  function pickBirthday(
    primary: (date: Birthday) => boolean,
    preferred: (date: Birthday) => boolean,
  ) {
    const matches = birthdays.filter(primary);
    sync(matches.find(preferred) ?? matches[0]);
  }
  zodiac.onchange = () => {
    if (zodiac.value === zodiacFor(currentBirthday())[0]) return;
    pickBirthday(
      (date) => zodiacFor(date)[0] === zodiac.value,
      (date) => seasonFor(date.month)[0] === season.value,
    );
  };
  season.onchange = () => {
    if (season.value === seasonFor(currentBirthday().month)[0]) return;
    pickBirthday(
      (date) => seasonFor(date.month)[0] === season.value,
      (date) => zodiacFor(date)[0] === zodiac.value,
    );
  };
  name.oninput = () => name.setCustomValidity("");
  element<HTMLFormElement>("#profile").onsubmit = (event) => {
    event.preventDefault();
    if (!name.value.trim()) {
      name.setCustomValidity("請輸入角色名字。");
      name.reportValidity();
      return;
    }
    confirmOpening({
      name: name.value.trim(),
      gender: element<HTMLInputElement>("[name=gender]:checked")
        .value as Profile["gender"],
      birthday: currentBirthday(),
      bloodType: blood.value as Profile["bloodType"],
    });
  };
  action("back", title);
}

function character(save: Save, stage: "elem" | "junior") {
  return `<div class="character">${portrait(save.gender, stage)}<div>
      <h2 id="character-name"></h2>
      <p>${save.gender === "boy" ? "男主角" : "女主角"} · ${save.birthday.month} 月 ${save.birthday.day} 日</p>
      <p>${save.zodiac}座 · ${save.bloodType} 型 · ${save.season}</p>
    </div></div>
    <dl class="stats">${(Object.keys(STAT_LABELS) as Stat[])
      .map(
        (stat) =>
          `<div><dt>${STAT_LABELS[stat]}</dt><dd>${save.stats[stat].toLocaleString("zh-TW")}</dd></div>`,
      )
      .join("")}
      <div class="cash"><dt>現金</dt><dd>${save.cash.toLocaleString("zh-TW")} 元</dd></div>
    </dl>`;
}
function confirmOpening(profile: Profile) {
  const save = createSave(profile);
  const { bonuses } = calculateOpening(profile.birthday, profile.bloodType);
  panel(
    "確認開局結果",
    `${character(save, "elem")}
    <h2>開局加成</h2>
    <ul class="bonuses">${bonuses
      .map(
        ({ source, entries }) =>
          `<li><strong>${source}</strong> ${entries.map(([stat, value]) => `${STAT_LABELS[stat]} ＋${value}`).join("、")}</li>`,
      )
      .join("")}</ul>
    <div class="actions">${button("edit", "返回修改")}${button("confirm", "確認開局")}</div>`,
  );
  element("#character-name").textContent = save.name;
  action("edit", () => setup(profile));
  action("confirm", () => {
    try {
      if (
        readSlots()[0].save &&
        !window.confirm("開始新人生將覆蓋自動存檔。確定開始嗎？")
      )
        return;
      slots.write(0, save);
      board(save, "已自動存檔。");
    } catch {
      notice(new Error("無法自動存檔，請確認瀏覽器允許儲存網站資料。"));
    }
  });
}

function board(save: Save, message = "") {
  if (save.examResultPending) return schoolResult(save, message);
  if (save.stage === "earlyExit" || save.stage === "graduated")
    return showEnding(save, message);
  if (!isBoardStage(save.stage)) {
    panel(
      "國中棋盤（下一步製作中）",
      `${character(save, "junior")}${endingActions()}`,
      "junior",
    );
    element("#character-name").textContent = save.name;
    element("#notice").textContent = message;
    bindEndingActions(save);
    return;
  }

  const school = schoolBoards[save.stage];
  if (stageFinished(school, save)) return completeSchool(save);
  if (school.stage === "junior") return openBoard(save, school, message);
  return loadSchool(save, school, message);
}

function openBoard(save: Save, school: SchoolBoard, message: string) {
  showStageBoard(app, save, school, message, {
    autoSave: (updated) => slots.write(0, updated),
    manualSave: (updated) => selectSlot("write", updated),
    exportSave: download,
    home: title,
    complete: completeSchool,
  });
}

async function loadSchool(save: Save, school: SchoolBoard, message: string) {
  const stage = school.stage;
  if (stage === "junior") return;
  const needsIntro = !save.stageIntroSeen.includes(stage);
  panel(
    "正在載入校園",
    '<progress id="school-progress" aria-label="校園素材載入進度"></progress>',
  );
  const progress = element<HTMLProgressElement>("#school-progress");
  try {
    await preloadSchool(
      school,
      save.gender,
      (done, total) => {
        progress.max = total;
        progress.value = done;
      },
      needsIntro ? introArt(stage, save.gender) : undefined,
    );
  } catch {
    panel(
      "校園素材載入失敗",
      `<div class="actions">${button("retry-school", "重試")}${button("home", "回標題")}</div>`,
    );
    action("retry-school", () => loadSchool(save, school, message));
    action("home", title);
    return;
  }

  if (!needsIntro) return openBoard(save, school, message);
  const heading = stage === "high" ? "升上高中" : "進入大學";
  const dialogue =
    stage === "high"
      ? "新制服的口袋終於裝得下兩枝筆了。聽說模擬考的題目也增加了。"
      : "選課系統還在轉圈，你已經先研究完校門口的宵夜地圖。";
  show(
    endingScene(
      heading,
      `<img class="school-hero" src="${introArt(stage, save.gender)}" alt="">
    <p>${dialogue}</p><div class="actions">${button("begin-stage", "開始")}</div>`,
      school.maps[
        matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape"
      ],
    ),
  );
  action("begin-stage", () => {
    const updated = {
      ...save,
      stageIntroSeen: [...save.stageIntroSeen, stage],
      updatedAt: new Date().toISOString(),
    };
    openBoard(updated, school, persistExam(updated));
  });
}

function completeSchool(save: Save) {
  if (save.stage === "university") {
    const completed = graduate(save);
    return showEnding(completed, persistExam(completed));
  }
  entranceExam(save);
}

function persistExam(save: Save) {
  try {
    slots.write(0, save);
    return "";
  } catch {
    return "無法自動存檔，請確認瀏覽器允許儲存網站資料。";
  }
}

function entranceExam(save: Save) {
  const attempt =
    save.entranceAttempt ??
    startAssessment(
      save.stage === "high" ? "universityEntrance" : "highEntrance",
      save.seenQuestionIds,
    );
  const inProgress = { ...save, entranceAttempt: attempt };
  show('<main class="stage assessment-screen"></main>', false);
  function persistProgress() {
    const warning = element(".assessment-save");
    warning.textContent = persistExam({
      ...inProgress,
      updatedAt: new Date().toISOString(),
    });
    warning.hidden = !warning.textContent;
  }
  showAssessment(
    element("main"),
    attempt,
    save.stats.intellect,
    persistProgress,
    () => {
      const completed = finishEntrance(save, attempt);
      schoolResult(completed, persistExam(completed));
    },
  );
  persistProgress();
}

function schoolResult(save: Save, message: string) {
  const university = save.education === "high";
  const exam = save.exams.find(
    ({ id }) => id === (university ? "universityEntrance" : "highEntrance"),
  );
  const passed = save.stage === (university ? "university" : "high");
  show(
    resultScene(
      university ? "大學聯考放榜" : "升高中考試放榜",
      `<h2>${passed ? "錄取！" : "未錄取"}</h2>
      ${exam ? `<p>${scoreText(exam.correct)}</p>` : ""}
      <div class="actions">${button("continue-result", passed ? (university ? "前往大學篇" : "前往高中篇") : "查看結局")}</div>`,
      passed,
    ),
  );
  action("continue-result", () => {
    const acknowledged = {
      ...save,
      examResultPending: false,
      updatedAt: new Date().toISOString(),
    };
    board(acknowledged, persistExam(acknowledged));
  });
  element("#notice").textContent = message;
}

function showEnding(save: Save, message: string) {
  const graduated =
    save.ending === "universityGraduate" || save.stage === "graduated";
  const high = save.ending === "universityExamFail";
  const exam = save.exams.find(
    ({ id }) => id === (high ? "universityEntrance" : "highEntrance"),
  );
  const title = graduated ? "大學畢業" : high ? "聯考落榜" : "提前出社會";
  const copy = graduated
    ? "<p>畢業帽飛起來的那一刻，連趕報告的鬧鐘也終於可以關掉了。</p>"
    : high
      ? "<p>畢業證書已經到手。下一份考卷可能是午餐訂單，答錯還能加點。</p><p>學歷：高中畢業</p><p>知識型工作不能選</p><p>之後可解鎖隱藏職業</p>"
      : "<p>制服先收進衣櫃，鬧鐘還得留著。下一站是職場，從第一份工作慢慢練等吧。</p><p>學歷・國中畢業</p>";
  show(
    endingScene(
      title,
      `${copy}
    ${!graduated && exam ? `<p>${scoreText(exam.correct)}</p>` : ""}
    <div class="actions">${button("advance-ending", graduated ? "查看結算" : "下一章預告")}</div>
    ${graduated ? "" : endingActions()}`,
      graduated ? graduation : firstJob,
    ),
  );
  element("#notice").textContent = message;
  if (!graduated) bindEndingActions(save);
  action("advance-ending", () =>
    graduated ? showGraduation(save) : showPreview(save),
  );
}

function endingActions() {
  return `<div class="actions">${button("save", "儲存到存檔格")}${button("export", "匯出存檔")}${button("home", "回標題")}</div>`;
}

function bindEndingActions(save: Save) {
  action("save", () => selectSlot("write", save));
  action("export", () => download(save));
  action("home", title);
}

function showGraduation(save: Save) {
  show(
    endingScene(
      "大學畢業結算",
      `${graduationDetails(save)}
    <div class="actions">${button("next-chapter", "下一章預告")}</div>${endingActions()}`,
      graduation,
      true,
    ),
  );
  element("#graduate-name").textContent = save.name;
  bindEndingActions(save);
  action("next-chapter", () => showPreview(save));
}

function showPreview(save: Save) {
  show(
    endingScene(
      "下一章預告",
      `<p>社會篇敬請期待</p>${endingActions()}`,
      firstJob,
    ),
  );
  bindEndingActions(save);
}

function download(save: Save) {
  const url = URL.createObjectURL(
    new Blob([exportSave(save)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "未來人生-存檔.json";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function selectSlot(mode: SlotMode, pending?: Save) {
  const records = readSlots();
  const heading = { load: "繼續遊戲", write: "儲存遊戲", import: "匯入存檔" }[
    mode
  ];
  const available = SLOT_NAMES.map((label, index) => ({
    label,
    index,
    ...records[index],
  })).filter((slot) => mode !== "write" || slot.index !== 0);
  panel(
    heading,
    `${mode === "import" ? '<p id="import-name"></p>' : ""}
    <ul class="slot-list">${available
      .map(
        ({ label, index, save, unreadable }) =>
          `<li><div><strong>${label}</strong><p id="slot-${index}"></p></div><div class="actions">
        ${button("use-" + index, mode === "load" ? "讀取" : mode === "write" ? "儲存" : "匯入", mode === "load" && !save)}
        ${mode === "load" ? button("export-" + index, "匯出", !save) : ""}
      </div></li>`,
      )
      .join("")}</ul>
    <div class="actions">${button("cancel", "返回")}</div>`,
  );
  if (mode === "import" && pending)
    element("#import-name").textContent =
      `選擇要匯入「${pending.name}」的存檔格。`;
  action("cancel", () =>
    mode === "write" && pending ? board(pending) : title(),
  );
  for (const { index, label, save, unreadable } of available) {
    element("#slot-" + index).textContent = save
      ? `${save.name} · ${new Date(save.updatedAt).toLocaleString("zh-TW")}`
      : unreadable
        ? "無法讀取"
        : "空白";
    action("use-" + index, () => {
      if (mode === "load" && save) board(save);
      if (!pending) return;
      const current = readSlots()[index];
      if (
        (current.save || current.unreadable) &&
        !window.confirm(`確定覆蓋「${label}」？`)
      )
        return;
      try {
        const updated = { ...pending, updatedAt: new Date().toISOString() };
        slots.write(index, updated);
        board(
          updated,
          `已${mode === "import" ? "匯入至" : "儲存至"}${label}。`,
        );
      } catch {
        notice(new Error("無法寫入存檔，請確認瀏覽器允許儲存網站資料。"));
      }
    });
    if (mode === "load" && save)
      action("export-" + index, () => download(save));
  }
}

async function boot() {
  app.style.setProperty("--button-sheet", `url("${assets.button}")`);
  panel(
    "正在載入遊戲",
    `<progress aria-label="素材載入進度" value="0"></progress><p id="progress-text"></p>`,
  );
  const orientation = matchMedia("(orientation: portrait)").matches
    ? "portrait"
    : "landscape";
  try {
    await preloadOpening(orientation, (loaded, total) => {
      const progress = element<HTMLProgressElement>("progress");
      progress.max = total;
      progress.value = loaded;
      element("#progress-text").textContent = `素材 ${loaded} ／ ${total}`;
    });
    title();
  } catch (error) {
    panel("載入失敗", button("retry", "重新載入"));
    notice(error);
    action("retry", boot);
  }
}

void boot();
