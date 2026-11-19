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

export function finishEntrance(save: Save, attempt: Attempt): Save {
  const correct = scoreAttempt(attempt);
  const university = attempt.kind === "universityEntrance";
  const passed = passesExam(correct);
  const completed: Save = {
    ...save,
    education: university ? "high" : "junior",
    stage: "earlyExit",
    ending: passed
      ? null
      : university
        ? "universityExamFail"
        : "juniorEarlyExit",
    hiddenJobUnlock: save.hiddenJobUnlock || (university && !passed),
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
  return passed
    ? enterSchool(completed, university ? "university" : "high")
    : completed;
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
