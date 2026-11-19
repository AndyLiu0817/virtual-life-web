import { diceCount } from "./game/board";
import { clubs, isClubId } from "./game/clubs";
import { activeDeity, deities, goodDeities } from "./game/deities";
import { STAT_LABELS, type Stat } from "./game/opening";
import type { Save } from "./game/saves";
import "./board-hud.css";

const sprites = import.meta.glob<string>(
  [
    "../art/hud/avatar-*.webp",
    "../art/hud/deity-*.webp",
    "../art/hud/{intellect,morality,charm,fitness,kit-dice,dice-glow-1,dice-disabled-1,close-normal-1}.webp",
  ],
  { eager: true, import: "default", query: "?url" },
);
const sprite = (name: string) => sprites[`../art/hud/${name}.webp`];
const schools = {
  elementary: { title: "小學", art: "elem", target: 100 },
  junior: { title: "國中", art: "junior", target: 200 },
  high: { title: "高中", art: "high", target: 350 },
  university: { title: "大學", art: "uni", target: 500 },
};
const stats: Stat[] = ["intellect", "morality", "charm", "fitness"];

function avatar(size: 128 | 256, className: string, trigger = false) {
  const art = `<img class="hud-hero" data-size="${size}" alt="">
    <img class="hud-ring" alt="">`;
  return trigger
    ? `<button class="hud-avatar ${className}" type="button" aria-label="玩家狀態與選單" aria-controls="hud-menu" aria-expanded="false">${art}</button>`
    : `<div class="hud-avatar ${className}">${art}</div>`;
}

export const boardHudMarkup = (
  debug: boolean,
) => `<section class="board-controls" aria-label="玩家儀表板">
  <div class="board-status">
    <header class="hud-identity">
      ${avatar(256, "hud-avatar-desktop", true)}
      ${avatar(128, "hud-avatar-compact", true)}
      <div class="hud-person">
        <h1 tabindex="-1"></h1>
        <h2 id="character-name"></h2>
        <span class="hud-stage"></span>
        <span class="hud-date"></span>
      </div>
    </header>
    <dl class="hud-stats" aria-label="四維">
      ${stats
        .map(
          (key) => `<div class="hud-stat" data-stat="${key}">
        <img class="hud-stat-icon" src="${sprite(key)}" alt="">
        <dt>${STAT_LABELS[key]}</dt><dd><span class="hud-value"></span></dd>
        <div class="hud-meter" role="meter" aria-label="${STAT_LABELS[key]}" aria-valuemin="0"><span></span></div>
      </div>`,
        )
        .join("")}
    </dl>
    <dl class="hud-summary">
      <div class="hud-cash"><dt>現金</dt><dd><span class="hud-value"></span></dd></div>
      <div class="hud-turn"><dt>回合</dt><dd></dd></div>
    </dl>
    <div class="hud-attached" hidden>
      <span class="hud-deity-head"><img alt=""></span><span class="hud-attached-detail"></span>
    </div>
  </div>
  <div class="hud-bottom">
    ${avatar(256, "hud-avatar-mobile", true)}
    <div class="board-roll">
      <button id="roll" type="button" aria-label="擲骰">
        <img class="hud-die-ready" src="${sprite("kit-dice")}" alt="">
        <img class="hud-die-pressed" src="${sprite("dice-glow-1")}" alt="">
        <img class="hud-die-disabled" src="${sprite("dice-disabled-1")}" alt="">
      </button>
      <div class="hud-roll-result">
        <div class="dice" aria-label="骰子點數"></div>
        <span id="dice-total"></span>
      </div>
    </div>
    <button class="hud-clay hud-menu-trigger" type="button" aria-controls="hud-menu" aria-expanded="false">選單</button>
    <section id="hud-menu" class="hud-menu" aria-label="棋盤選單" hidden>
      <button class="hud-close" type="button" aria-label="關閉選單">
        <img src="${sprite("close-normal-1")}" alt="">
      </button>
      <dl class="hud-badges hud-badges-drawer"></dl>
      <div class="actions">
        <button class="hud-clay" id="overview" type="button" aria-pressed="false">看全圖</button>
        <button class="hud-clay" id="save" type="button">儲存到存檔格</button>
        <button class="hud-clay" id="export" type="button">匯出存檔</button>
        <button class="hud-clay" id="home" type="button">回標題</button>
      </div>
    </section>
    ${debug ? '<label class="board-debug-option"><input id="scenery-anchors" type="checkbox"> 顯示前景物件錨點</label>' : ""}
    <p id="notice" role="status"></p>
  </div>
</section>`;

export function boardHud(root: HTMLElement, turns: number) {
  const status = root.querySelector<HTMLElement>(".board-status")!;
  const menu = root.querySelector<HTMLElement>("#hud-menu")!;
  const close = menu.querySelector<HTMLButtonElement>(".hud-close")!;
  const triggers = root.querySelectorAll<HTMLButtonElement>(
    "[aria-controls=hud-menu]",
  );
  let opener: HTMLButtonElement | undefined;

  function closeMenu(restoreFocus = true) {
    if (menu.hidden) return;
    menu.hidden = true;
    triggers.forEach((trigger) =>
      trigger.setAttribute("aria-expanded", "false"),
    );
    if (restoreFocus) {
      const visibleOpener = opener?.getClientRects().length
        ? opener
        : root.querySelector<HTMLButtonElement>(".hud-menu-trigger");
      visibleOpener?.focus();
    }
  }

  triggers.forEach((trigger) => {
    trigger.onclick = () => {
      if (!menu.hidden) {
        closeMenu();
        return;
      }
      opener = trigger;
      menu.hidden = false;
      triggers.forEach((button) =>
        button.setAttribute("aria-expanded", "true"),
      );
      close.focus({ preventScroll: true });
    };
  });
  root.parentElement
    ?.querySelector(".board-map")
    ?.addEventListener("click", () => closeMenu());
  close.onclick = () => closeMenu();
  root.onkeydown = (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      event.preventDefault();
      closeMenu();
    }
  };
  root.addEventListener("focusout", (event) => {
    if (
      !menu.hidden &&
      event.relatedTarget instanceof HTMLElement &&
      !menu.contains(event.relatedTarget) &&
      !event.relatedTarget.matches("[aria-controls=hud-menu]")
    )
      closeMenu(false);
  });

  let previous: { stats: Save["stats"]; cash: number } | undefined;
  const statRows = new Map(
    stats.map((key) => [
      key,
      status.querySelector<HTMLElement>(`[data-stat="${key}"]`)!,
    ]),
  );
  const cash = status.querySelector<HTMLElement>(".hud-cash")!;
  const turn = status.querySelector<HTMLElement>(".hud-turn dd")!;
  const turnGroup = turn.parentElement!;
  const summary = status.querySelector<HTMLElement>(".hud-summary")!;
  const person = status.querySelector<HTMLElement>(".hud-person")!;
  const portrait = matchMedia("(orientation: portrait)");
  function placeTurn() {
    (portrait.matches ? summary : person).append(turnGroup);
  }
  placeTurn();
  const badges = root.querySelectorAll<HTMLElement>(".hud-badges");
  const attached = status.querySelector<HTMLElement>(".hud-attached")!;
  const attachedHead = attached.querySelector<HTMLImageElement>("img")!;
  const attachedDetail = attached.querySelector<HTMLElement>(
    ".hud-attached-detail",
  )!;
  const avatars = root.querySelectorAll<HTMLElement>(".hud-avatar");
  const date = status.querySelector<HTMLElement>(".hud-date")!;
  const stageLabel = root.querySelector<HTMLElement>(".hud-stage")!;
  const name = root.querySelector<HTMLElement>("#character-name")!;
  const heading = root.querySelector<HTMLElement>(".hud-identity h1")!;

  function delta(element: HTMLElement, change: number) {
    if (!change) return;
    element.querySelector(".hud-delta")?.remove();
    const label = document.createElement("span");
    label.className = "hud-delta";
    label.dataset.negative = String(change < 0);
    label.setAttribute("aria-hidden", "true");
    label.textContent = `${change > 0 ? "+" : "−"}${Math.abs(change).toLocaleString("zh-TW")}`;
    element.append(label);
    label.addEventListener("animationend", () => label.remove(), {
      once: true,
    });
  }

  function update(save: Save) {
    const school =
      save.stage in schools
        ? (save.stage as keyof typeof schools)
        : (save.education ?? "junior");
    const { title, art, target } = schools[school];
    const deity = activeDeity(save);
    const tone = deity
      ? goodDeities.some((id) => id === deity.id)
        ? "good"
        : "bad"
      : "normal";
    name.textContent = save.name;
    date.textContent = `生日 ${save.birthday.month}/${save.birthday.day}`;
    heading.textContent = `${title}棋盤`;
    // The junior grade is decorative. Each of its three labels spans five turns.
    stageLabel.textContent =
      school === "junior"
        ? `${title} ${Math.min(3, Math.floor(save.turn / 5) + 1)} 年級`
        : title;
    turn.textContent = `${Math.min(save.turn + 1, turns)} ／ ${turns}`;
    avatars.forEach((element) => {
      element.dataset.tone = tone;
      const hero = element.querySelector<HTMLImageElement>(".hud-hero")!;
      const ring = element.querySelector<HTMLImageElement>(".hud-ring")!;
      hero.src = sprite(`avatar-${save.gender}-${art}-${hero.dataset.size}`);
      ring.src = sprite(
        tone === "bad"
          ? "avatar-ring-red"
          : tone === "good"
            ? "avatar-halo"
            : "avatar-ring",
      );
    });

    for (const [key, row] of statRows) {
      const value = save.stats[key];
      const meter = row.querySelector<HTMLElement>(".hud-meter")!;
      const fill = meter.firstElementChild as HTMLElement;
      row.querySelector(".hud-value")!.textContent = String(value);
      meter.setAttribute("aria-valuemax", String(target));
      meter.setAttribute("aria-valuenow", String(Math.min(value, target)));
      meter.setAttribute("aria-valuetext", `${value} ／ ${target}`);
      meter.dataset.over = String(value > target);
      fill.style.transform = `translateX(${100 * (Math.min(value / target, 1) - 1)}%)`;
      const change = previous ? value - previous.stats[key] : 0;
      if (change) {
        delta(row, change);
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
          row
            .querySelector(".hud-stat-icon")!
            .animate(
              [
                { transform: "scale(1)" },
                { transform: "scale(1.27)" },
                { transform: "scale(1)" },
              ],
              { duration: 380, easing: "ease-out" },
            );
        }
      }
    }
    cash.querySelector(".hud-value")!.textContent =
      `${save.cash.toLocaleString("zh-TW")} 元`;
    if (previous) delta(cash, save.cash - previous.cash);
    previous = { stats: { ...save.stats }, cash: save.cash };

    const clubId = save.clubHistory.find(
      ({ stage }) => stage === save.stage,
    )?.clubId;
    const club = clubId && isClubId(clubId) ? clubs[clubId].name : "";
    const head = deity ? sprite(`deity-${deity.id}`) : "";
    const deityLabel = deity
      ? `${deities[deity.id].name}・${deity.remainingTurns} 回合`
      : "";
    attached.hidden = !deity;
    if (deity) {
      attachedHead.src = head;
      attachedDetail.textContent = deityLabel;
    }
    const fields = [
      ["骰子顆數", `${diceCount(save)} 顆`, true],
      ["水星逆行", `${save.retrogradeTurns} 回合`, save.retrogradeTurns > 0],
      ["否極泰來", `${save.turnaroundTurns} 回合`, save.turnaroundTurns > 0],
      ["附身神祇", deityLabel || "—", Boolean(deity)],
      ["社團", club || "—", Boolean(club)],
      ["人生經驗", String(save.experience), save.experience > 0],
      ["收集卡", `${save.cards.length} 張`, save.cards.length > 0],
    ] as const;
    const markup = fields
      .map(
        ([label, value, active]) =>
          `<div data-active="${active}"${label === "附身神祇" && deity ? ' class="hud-deity"' : ""}>
        ${label === "附身神祇" && deity ? `<span class="hud-deity-head"><img src="${head}" alt=""></span>` : ""}
        <dt>${label}</dt><dd>${value}</dd>
      </div>`,
      )
      .join("");
    badges.forEach((list) => (list.innerHTML = markup));
  }

  return {
    update,
    closeMenu,
    reorient() {
      placeTurn();
      if (opener && !opener.getClientRects().length) closeMenu();
    },
  };
}
