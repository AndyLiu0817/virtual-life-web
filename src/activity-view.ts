import { sceneArt } from "./event-view";
import {
  chooseClub,
  clubChoice,
  clubs,
  clubStageNames,
  type ClubStage,
} from "./game/clubs";
import { STAT_LABELS } from "./game/opening";
import type { Save } from "./game/saves";
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
  choiceLayout?: "clubs" | "contest";
  defaultChoice?: number;
}

export function activityPrompt(
  dialog: HTMLDialogElement,
  scene: ActivityScene,
) {
  const choices = scene.choices ?? [{ name: "確定" }];
  dialog.innerHTML = `<form method="dialog">
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
