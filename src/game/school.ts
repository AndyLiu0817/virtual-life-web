import { schoolBoards } from "../data/school-board";
import { passesExam, scoreAttempt, type Attempt } from "./questions";
import type { Save } from "./saves";

export function enterSchool(save: Save, stage: "high" | "university"): Save {
  return {
    ...save,
    stage,
    turn: 0,
    boardTile: schoolBoards[stage].start,
    previousTile: null,
    nextTile: null,
  };
}

export function gsatDue(save: Save) {
  return (
    save.stage === "high" &&
    save.turn === 16 &&
    !save.exams.some(({ id }) => id === "gsat")
  );
}

function recordExam(save: Save, attempt: Attempt, correct: number): Save {
  return {
    ...save,
    updatedAt: new Date().toISOString(),
    entranceAttempt: null,
    examResultPending: true,
    exams: [...save.exams, { id: attempt.kind, correct }],
    seenQuestionIds: [
      ...new Set([
        ...save.seenQuestionIds,
        ...attempt.items.map(({ id }) => id),
      ]),
    ],
  };
}

export const gsatReward = (correct: number) =>
  correct >= 9
    ? { intellect: 45, cash: 1500 }
    : passesExam(correct)
      ? { intellect: 30, cash: 800 }
      : { intellect: 8, cash: 200 };

export function settleGsat(save: Save, attempt: Attempt): Save {
  if (save.exams.some(({ id }) => id === "gsat")) return save;
  const correct = scoreAttempt(attempt);
  const reward = gsatReward(correct);
  return {
    ...recordExam(save, attempt, correct),
    stats: {
      ...save.stats,
      intellect: Math.min(9999, save.stats.intellect + reward.intellect),
    },
    cash: save.cash + reward.cash,
  };
}

export function finishEntrance(save: Save, attempt: Attempt): Save {
  const correct = scoreAttempt(attempt);
  const completed = {
    ...recordExam(save, attempt, correct),
    education: "high" as const,
  };
  return passesExam(correct)
    ? enterSchool(completed, "university")
    : {
        ...completed,
        stage: "earlyExit",
        ending: "universityExamFail",
        hiddenJobUnlock: true,
      };
}

export function graduate(save: Save): Save {
  return {
    ...save,
    stage: "graduated",
    education: "university",
    ending: "universityGraduate",
    updatedAt: new Date().toISOString(),
  };
}

export function handleLoveTile(_save: Readonly<Save>) {
  return "有人朝你揮手，你也揮了回去。走近才發現，你們都在跟同一隻校貓打招呼。戀愛系統即將開放。";
}
