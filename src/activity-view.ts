import { changeText, sceneArt } from "./event-view";
import {
  chooseClub,
  clubChoice,
  clubs,
  clubStageNames,
  type ClubStage,
} from "./game/clubs";
import { STAT_LABELS } from "./game/opening";
import type { Save } from "./game/saves";
import { buyShopItem, shopStock } from "./game/shop";
import intellect from "../art/hud/intellect.webp";
import morality from "../art/hud/morality.webp";
import charm from "../art/hud/charm.webp";
import fitness from "../art/hud/fitness.webp";
import "./activity-view.css";

interface Choice {
  name: string;
  detail?: string;
}

interface ActivityScene {
  art: string;
  speaker: string;
  title: string;
  text?: string;
  details?: string[];
  choices?: Choice[];
  choiceLayout?: "clubs" | "contest" | "club-event";
  defaultChoice?: number;
}

export function activityPrompt(
  dialog: HTMLDialogElement,
  scene: ActivityScene,
) {
  const choices = scene.choices ?? [{ name: "確定" }];
  dialog.innerHTML = `<form method="dialog" class="${scene.choiceLayout === "club-event" ? "club-event-form" : ""}">
    <div class="event-stage" data-tone="scene">${scene.art}</div>
    <section class="event-copy">
      <p class="event-label">${scene.speaker}</p>
      <h2 id="activity-title" tabindex="-1">${scene.title}</h2>
      ${scene.text ? `<p>${scene.text}</p>` : ""}
      ${scene.details ? `<ul class="activity-details">${scene.details.map((detail) => `<li>${detail}</li>`).join("")}</ul>` : ""}
      <div class="${scene.choiceLayout ? `activity-options ${scene.choiceLayout}` : "actions"}">
        ${choices
          .map(
            (
              { name, detail },
              i,
            ) => `<button class="${scene.choiceLayout ? "activity-option" : "action"}" type="submit" value="${i}"
          ${i === scene.defaultChoice ? "autofocus" : ""}><strong>${name}</strong>${detail ? `<span>${detail}</span>` : ""}</button>`,
          )
          .join("")}
      </div>
    </section>
  </form>`;
  dialog.oncancel = (event) => event.preventDefault();
  const result = new Promise<number>((resolve) => {
    dialog.onclose = () => {
      resolve(Number(dialog.returnValue));
      dialog.replaceChildren();
    };
  });
  dialog.showModal();
  if (scene.defaultChoice === undefined) dialog.querySelector("h2")!.focus();
  return result;
}

export async function promptForClub(
  dialog: HTMLDialogElement,
  save: Save,
  stage: ClubStage,
) {
  const choice = clubChoice(save, stage);
  if (!choice) return save;
  const clubOption = (id: keyof typeof clubs, keep = false) => {
    const { name, main, sub } = clubs[id];
    return {
      name: keep ? `保留${name}` : name,
      detail: `主 ${STAT_LABELS[main]} ／ 副 ${STAT_LABELS[sub]}`,
    };
  };
  const options = choice.options.filter((id) => id !== choice.current);
  const index = await activityPrompt(dialog, {
    art: sceneArt("clubroom", "senior-girl"),
    speaker: "社團學姊",
    title: `${clubStageNames[stage]}${stage === "junior" ? "選社" : "換社"}`,
    text:
      stage === "junior"
        ? "挑一個你想加入的社團吧！"
        : "這個階段可以換一次社團。",
    choices: [
      ...(choice.current ? [clubOption(choice.current, true)] : []),
      ...options.map((id) => clubOption(id)),
    ],
    choiceLayout: "clubs",
    defaultChoice: choice.current ? 0 : undefined,
  });
  return chooseClub(
    save,
    stage,
    choice.current ? options[index - 1] : options[index],
  );
}

const shopIcons = import.meta.glob<string>("../art/shop/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});
const statIcons = { intellect, morality, charm, fitness };
const money = (value: number) => `${value.toLocaleString("zh-TW")} 元`;

export function promptForShop(
  dialog: HTMLDialogElement,
  save: Save,
  update: (save: Save) => void,
) {
  dialog.innerHTML = `<form method="dialog" class="shop-form">
    <header class="shop-header">
      <div><h2 id="activity-title">福利社</h2><p class="shop-cash"></p></div>
      <button class="action" type="submit" autofocus>離開</button>
    </header>
    <p class="shop-result" role="status"></p>
    <div class="shop-stock"></div>
  </form>`;
  const list = dialog.querySelector<HTMLElement>(".shop-stock")!;
  const cash = dialog.querySelector(".shop-cash")!;
  const result = dialog.querySelector(".shop-result")!;
  const leave = dialog.querySelector<HTMLButtonElement>(".shop-header button")!;
  function render() {
    cash.textContent = `現金 ${money(save.cash)}`;
    list.innerHTML = shopStock(save)
      .map(
        (item) => `
      <button class="activity-option" type="button" data-item="${item.id}" ${item.available ? "" : "disabled"}>
        <img class="shop-item-icon" src="${shopIcons[`../art/shop/${item.id}.webp`]}" alt="">
        <span class="shop-item-copy">
          <strong>${item.name}・${money(item.price)}</strong>
          <span class="shop-effects">${item.effects.map((effect) => `<span>${effect.target === "cash" ? "" : `<img src="${statIcons[effect.target]}" alt="">`}${changeText(effect)}</span>`).join("")}</span>
          <span>剩餘限購 ${item.remaining} 件${item.remaining && save.cash < item.price ? "・現金不足" : ""}</span>
        </span>
      </button>`,
      )
      .join("");
  }
  list.onclick = (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button",
    );
    if (!button?.dataset.item) return;
    const purchase = buyShopItem(save, button.dataset.item);
    if (!purchase) return;
    save = purchase.save;
    update(save);
    result.textContent = `${purchase.item.result ?? `你買了${purchase.item.name}。`} ${purchase.changes.map(changeText).join("・")}`;
    const scroll = list.scrollTop;
    render();
    const replacement = list.querySelector<HTMLButtonElement>(
      `[data-item="${purchase.item.id}"]:not(:disabled)`,
    );
    (replacement ?? leave).focus({ preventScroll: true });
    list.scrollTop = scroll;
  };
  render();
  dialog.oncancel = null;
  const closed = new Promise<void>((resolve) => {
    dialog.onclose = () => {
      dialog.replaceChildren();
      resolve();
    };
  });
  dialog.showModal();
  return closed;
}
