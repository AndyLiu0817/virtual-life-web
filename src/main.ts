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
  panel(
    "國中棋盤（下一步製作中）",
    `${character(save, "junior")}
    <div class="actions">${button("save", "儲存到存檔格")}${button("export", "匯出存檔")}${button("home", "回標題")}</div>`,
    "junior",
  );
  element("#character-name").textContent = save.name;
  element("#notice").textContent = message;
  action("save", () => selectSlot("write", save));
  action("export", () => download(save));
  action("home", title);
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
