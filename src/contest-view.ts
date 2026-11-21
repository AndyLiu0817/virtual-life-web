import { openAudioDialog, playEffect } from "./audio";
import { isBoardStage } from "./data/school-board";
import { activityPrompt } from "./activity-view";
import { changeText, sceneArt } from "./event-view";
import { showAssessment } from "./exam-view";
import { clubStageNames } from "./game/clubs";
import {
  championLine,
  contestEvents,
  contestEventIds,
  contestRanks,
  outfitBonuses,
  outfits,
  settleContest,
  type ContestEvent,
  type ContestMatch,
  type ContestScore,
} from "./game/contests";
import { scoreAttempt, startAssessment } from "./game/questions";
import type { Save } from "./game/saves";
import { playRhythmRound, rhythmArt } from "./rhythm-round";

const auditorium = () => sceneArt("auditorium", "host");

async function playTrivia(dialog: HTMLDialogElement, save: Save) {
  const attempt = startAssessment(
    "contestTrivia",
    save.seenQuestionIds,
    isBoardStage(save.stage) ? save.stage : undefined,
  );
  const elapsedMs = await new Promise<number>((resolve) => {
    showAssessment(dialog, attempt, 0, undefined, () =>
      resolve(Math.round(performance.now() - start)),
    );
    openAudioDialog(dialog, "dialog_open", "mg_memory");
    dialog.querySelector<HTMLElement>(".assessment-question")!.focus();
    const start = performance.now();
  });
  dialog.close();
  dialog.replaceChildren();
  const seenQuestionIds = [
    ...new Set([...save.seenQuestionIds, ...attempt.items.map(({ id }) => id)]),
  ];
  return {
    performance: { score: scoreAttempt(attempt), elapsedMs },
    seenQuestionIds,
  };
}

export async function playContest(
  activityDialog: HTMLDialogElement,
  quizDialog: HTMLDialogElement,
  save: Save,
  match: ContestMatch,
  early: boolean,
): Promise<Save> {
  const speaker = `大賽主持人・${clubStageNames[match.stage]}第 ${match.matchNumber} 場`;
  const index = await activityPrompt(activityDialog, {
    art: auditorium(),
    speaker,
    title: "虛擬城大賽",
    text: early
      ? "你提前抵達會場。選一個項目參賽吧！"
      : "大賽開始了！選一個項目參賽。",
    choices: contestEventIds.map((id) => ({
      name: contestEvents[id].name,
      detail: contestEvents[id].description,
    })),
    choiceLayout: "contest",
  });
  const event: ContestEvent = contestEventIds[index];
  const line = championLine(match.stage, event);
  let performance: ContestScore;
  let reveal = "";
  if (event === "trivia") {
    const trivia = await playTrivia(quizDialog, save);
    performance = trivia.performance;
    save = { ...save, seenQuestionIds: trivia.seenQuestionIds };
    reveal = `作答用時 ${(performance.elapsedMs! / 1000).toFixed(2)} 秒`;
  } else if (event === "style") {
    const bonuses = outfitBonuses();
    const selected = await activityPrompt(activityDialog, {
      art: auditorium(),
      speaker,
      title: "風采秀・挑選穿搭",
      text: `目前魅力 ${save.stats.charm}。選定後才會揭曉穿搭加分。`,
      choices: outfits.map(({ name, description }) => ({
        name,
        detail: description,
      })),
      choiceLayout: "contest",
    });
    performance = { score: save.stats.charm + bonuses[selected] };
    reveal = `${outfits[selected].name}・穿搭 ＋${bonuses[selected]} 分`;
  } else {
    performance = await playRhythmRound(activityDialog);
  }
  const reward = settleContest(save, match, event, performance, line);
  if (!reward) return save;
  playEffect(reward.rank < 4 ? "mg_clear" : "mg_fail");
  const { name, unit } = contestEvents[event];
  await activityPrompt(activityDialog, {
    art: event === "rhythm" ? rhythmArt : auditorium(),
    speaker: event === "rhythm" ? "虛擬城大賽" : speaker,
    title: `${name}・${contestRanks[reward.rank - 1]}`,
    text: reveal,
    details: [
      `成績 ${performance.score}${unit}`,
      `冠軍線 ${line}${unit}`,
      [
        changeText({ target: "cash", amount: reward.cash }),
        changeText({ target: reward.target, amount: reward.stat }),
      ].join("・"),
    ],
  });
  return reward.save;
}
