import { describe, it, expect } from "vitest";
import * as E from "../src/game/engine";
import { RULES as R, MAPS } from "../src/data/config";
import { QUESTIONS } from "../src/data/questions";
import { parseSave, serialize } from "../src/game/storage";
import type { GameState } from "../src/game/types";
const profile = {
  name: "測試生",
  gender: "female" as const,
  month: 3,
  day: 21,
  blood: "O" as const,
  zodiac: 0,
};
const game = () => E.createGame(profile);
const fixed = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};
function ready(g: GameState) {
  E.skipTutorial(g);
  E.selectClub(g, 0);
  return g;
}
function settle(g: GameState, pass = true) {
  for (let i = 0; i < 200 && g.phase !== "ready" && g.phase !== "end"; i++) {
    if (g.phase === "notice") E.continueTurn(g, () => 0.7);
    else if (g.phase === "club") E.selectClub(g, g.club);
    else if (g.phase === "fork") E.takeFork(g, 0, () => 0.7);
    else if (g.phase === "quiz") {
      const q = QUESTIONS.find((q) => q.id === g.quiz!.ids[g.quiz!.index])!;
      if (g.quiz!.feedback === null)
        E.answerQuiz(g, pass ? q.answer : (q.answer + 1) % 4);
      E.nextQuestion(g, () => 0.7);
    } else if (g.phase === "mini") E.completeMini(g, true, 10, () => 0.7);
    else if (g.phase === "contest") E.styleContest(g, 0, () => 0.7);
    else if (g.phase === "love" || g.phase === "offering") E.leaveTile(g);
    else throw new Error(g.phase);
  }
  return g;
}
describe("original question bank", () => {
  it("contains 200 unique, valid questions across 5 categories", () => {
    expect(QUESTIONS).toHaveLength(200);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(200);
    expect(new Set(QUESTIONS.map((q) => q.prompt)).size).toBe(200);
    expect(new Set(QUESTIONS.map((q) => q.category)).size).toBe(5);
    for (const q of QUESTIONS) {
      expect(new Set(q.choices).size).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
      expect(q.explanation).toBeTruthy();
    }
  });
  it("draws without replacement and has 20%/40% difficult exam questions", () => {
    const g = game();
    const a = E.drawQuestions(g, "junior");
    const b = E.drawQuestions(g, "senior");
    expect(
      a.filter((id) => QUESTIONS.find((q) => q.id === id)!.hard),
    ).toHaveLength(2);
    expect(
      b.filter((id) => QUESTIONS.find((q) => q.id === id)!.hard),
    ).toHaveLength(4);
    expect(a.some((id) => b.includes(id))).toBe(false);
  });
});
describe("school journey", () => {
  it("applies birthday, zodiac, blood and season bonuses", () => {
    const g = game();
    expect(g.stats).toEqual({
      intelligence: 80,
      morality: 80,
      charm: 115,
      fitness: 130,
    });
    expect(E.zodiac(1, 19)).toBe(0);
    expect(E.zodiac(1, 20)).toBe(1);
    expect(E.zodiac(12, 22)).toBe(0);
  });
  it("plays the entire tutorial and 15/25/40 turns through graduation", () => {
    const g = game();
    let guard = 0;
    while (g.stage !== "society" && guard++ < 100) {
      if (g.phase === "ready") E.beginTurn(g, () => 0.7);
      settle(g);
    }
    expect(g.education).toBe("university");
    expect(g.totalTurn).toBe(80);
    expect(g.contests.map((c) => c.stage)).toEqual([
      "junior",
      "senior",
      "university",
      "university",
    ]);
    expect(
      g.examHistory.filter((e) => e.kind === "junior" || e.kind === "senior"),
    ).toHaveLength(2);
    expect(g.clubHistory).toHaveLength(3);
    expect(g.future.chapter).toBe("society");
    expect(parseSave(serialize(g))).toEqual(g);
  });
  it("does not allow retakes after junior failure", () => {
    const g = ready(game());
    g.turn = 14;
    E.beginTurn(g, () => 0.7);
    settle(g, false);
    expect(g.education).toBe("junior");
    expect(g.phase).toBe("end");
    const before = g.totalTurn;
    E.beginTurn(g);
    expect(g.totalTurn).toBe(before);
  });
  it("ends with senior education after failed entrance exam", () => {
    const g = ready(game());
    E.enterStage(g, "senior");
    E.selectClub(g, 0);
    g.turn = 24;
    E.beginTurn(g, () => 0.7);
    settle(g, false);
    expect(g.education).toBe("senior");
    expect(g.phase).toBe("end");
  });
  it("passes with exactly six correct answers", () => {
    const g = ready(game());
    g.turn = 15;
    E.startQuiz(g, "junior");
    for (let i = 0; i < 10; i++) {
      const q = QUESTIONS.find((q) => q.id === g.quiz!.ids[g.quiz!.index])!;
      E.answerQuiz(g, i < 6 ? q.answer : (q.answer + 1) % 4);
      E.answerQuiz(g, q.answer);
      E.nextQuestion(g);
    }
    expect(g.stage).toBe("senior");
    expect(g.examHistory.at(-1)?.correct).toBe(6);
  });
  it("fork preserves remaining steps and takes the selected edge", () => {
    const g = ready(game());
    g.position = 4;
    E.beginTurn(g, fixed(0.9, 0, 0.2));
    expect(g.phase).toBe("fork");
    expect(g.remainingSteps).toBe(2);
    E.takeFork(g, 1, () => 0.9);
    expect(g.position).toBe(10);
    expect(g.remainingSteps).toBe(0);
  });
});
describe("dice timing and gods", () => {
  it("retrograde lasts three turns; re-trigger queues exactly three fortune turns", () => {
    const g = ready(game());
    g.position = 0;
    E.beginTurn(g, fixed(0, 0, 0.9));
    expect(g.dice).toHaveLength(1);
    settle(g);
    expect(g.retrograde).toBe(2);
    E.beginTurn(g, fixed(0, 0, 0.9));
    settle(g);
    expect(g.retrograde).toBe(1);
    E.beginTurn(g, fixed(0, 0, 0.9));
    settle(g);
    expect(g.retrograde).toBe(0);
    expect(g.fortune).toBe(3);
    expect(E.goodProbability(g)).toBeCloseTo(2 / 3);
    E.beginTurn(g, () => 0.9);
    expect(g.dice).toHaveLength(2);
    settle(g);
    expect(g.fortune).toBe(2);
  });
  it("god effects tick exactly once per turn and expire after all effects", () => {
    const g = ready(game());
    g.god = { id: 1, remaining: 1 };
    const cash = g.cash;
    g.position = 0;
    E.beginTurn(g, fixed(0.9, 0.5, 0, 0, 0.9));
    expect(g.cash).toBeGreaterThanOrEqual(cash + 400);
    settle(g);
    expect(g.god).toBeNull();
  });
  it("step god clamps selected steps to retrograde range", () => {
    const g = ready(game());
    g.god = { id: 2, remaining: 3 };
    g.retrograde = 2;
    E.beginTurn(g, () => 0.9, 12);
    expect(g.dice).toHaveLength(1);
    expect(g.remainingSteps).toBeLessThanOrEqual(6);
  });
  it("protective god boosts all game rewards with rounding", () => {
    const g = ready(game());
    g.god = { id: 3, remaining: 4 };
    g.phase = "mini";
    g.mini = { id: 0, round: 2, wins: 2, contest: false };
    const before = g.stats.fitness,
      cash = g.cash;
    E.completeMini(g, true, 10);
    expect(g.stats.fitness - before).toBe(Math.round(18 * 1.2));
    expect(g.cash - cash).toBe(720);
  });
});
describe("family ledger", () => {
  it("pregnancy starts next turn after marriage and gives birth six turns later", () => {
    const g = ready(game());
    g.stage = "university";
    g.phase = "love";
    g.partner = 0;
    g.love = 99;
    E.marry(g);
    settle(g);
    expect(g.pregnancy).toBeNull();
    g.phase = "ready";
    const cash = g.cash;
    E.beginTurn(g, fixed(0.9, 0, 0.9));
    expect(g.pregnancy?.conceivedTurn).toBe(1);
    expect(g.cash).toBeGreaterThanOrEqual(cash + 800 - 600);
    settle(g);
    for (let i = 0; i < 5; i++) {
      g.phase = "ready";
      E.beginTurn(g, () => 0.9);
      settle(g);
    }
    expect(g.children).toHaveLength(0);
    g.phase = "ready";
    E.beginTurn(g, fixed(0.9, 0, 0.9));
    expect(g.children).toHaveLength(2);
    expect(g.pregnancy).toBeNull();
    expect(g.births).toBe(1);
    expect(g.children[0].stats.intelligence).toBe(30);
    expect(g.future.guardianAngels).toHaveLength(2);
  });
  it("rejects unaffordable introductions and enforces charm", () => {
    const g = ready(game());
    g.stage = "university";
    g.phase = "love";
    g.cash = 100;
    E.meet(g, 0);
    expect(g.partner).toBeNull();
    g.cash = 5000;
    E.meet(g, 3);
    expect(g.partner).toBeNull();
    g.stats.charm = 500;
    E.meet(g, 3);
    expect(g.partner).toBe(3);
    expect(g.cash).toBe(0);
  });
  it("preserves pregnancy and children at graduation", () => {
    const g = ready(game());
    g.stage = "university";
    g.turn = 39;
    g.totalTurn = 79;
    g.partner = 0;
    g.marriedAt = 78;
    g.pregnancy = { conceivedTurn: 79 };
    E.beginTurn(g, () => 0.9);
    settle(g);
    expect(g.phase).toBe("end");
    expect(g.pregnancy?.conceivedTurn).toBe(79);
  });
});
describe("save validation", () => {
  it("round trips each playable phase", () => {
    const g = ready(game());
    for (const phase of [
      "ready",
      "notice",
      "club",
      "contest",
      "love",
    ] as const) {
      g.phase = phase;
      expect(parseSave(serialize(g))).toEqual(g);
    }
    E.startQuiz(g, "quiz");
    expect(parseSave(serialize(g))).toEqual(g);
  });
  it("rejects corrupt, future, nonfinite and structurally inconsistent saves", () => {
    const g = ready(game());
    for (const raw of [
      "bad",
      "{}",
      serialize({ ...g, version: 2 } as unknown as GameState),
      serialize({ ...g, phase: "quiz", quiz: null }),
      serialize({ ...g, position: 99 }),
      serialize({ ...g, cash: Infinity }),
      serialize({ ...g, profile: { ...g.profile, month: 2, day: 31 } }),
    ])
      expect(() => parseSave(raw)).toThrow();
  });
  it("all active map tiles belong to MVP scope and love only appears at university", () => {
    for (const [s, map] of Object.entries(MAPS)) {
      expect(map).not.toContain("monster");
      expect(map).not.toContain("quest");
      if (s !== "university") expect(map).not.toContain("love");
    }
  });
});

describe("boundary conditions", () => {
  it("remembers a route selected with zero steps, across save and next turn", () => {
    let g = ready(game());
    g.position = 5;
    g.phase = "fork";
    g.remainingSteps = 0;
    E.takeFork(g, 1, () => 0.9);
    expect(g.position).toBe(5);
    expect(g.plannedDestination).toBe(9);
    settle(g);
    g = parseSave(serialize(g));
    E.beginTurn(g, fixed(0.9, 0, 0));
    expect(g.position).toBe(10);
    expect(g.plannedDestination).toBeNull();
  });
  it("charm and gender have symmetric introductions and relationship rules", () => {
    for (const gender of ["male", "female"] as const) {
      const g = ready(E.createGame({ ...profile, gender }));
      g.stage = "university";
      g.phase = "love";
      g.stats.charm = 120;
      E.meet(g, 0);
      settle(g);
      g.phase = "love";
      g.love = 98;
      E.marry(g);
      expect(g.marriedAt).toBeNull();
      g.love = 99;
      E.marry(g);
      expect(g.marriedAt).toBe(g.totalTurn);
    }
  });
  it("high intelligence gives a hint that never removes the correct answer", () => {
    const g = ready(game());
    E.startQuiz(g, "senior");
    g.stats.intelligence = 150;
    const hint = E.quizHint(g);
    expect(hint).not.toBe(
      QUESTIONS.find((q) => q.id === g.quiz!.ids[0])!.answer,
    );
    g.stats.intelligence = 149;
    expect(E.quizHint(g)).toBeNull();
  });
});
