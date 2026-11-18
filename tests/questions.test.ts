import { expect, it } from "vitest";
import {
  bankSchema,
  categories,
  drawQuestions,
  intellectAssists,
  passesExam,
  questionBank,
  questionsById,
  quizReward,
  remainingAssists,
  scoreAttempt,
  startAssessment,
  useAssist,
} from "../src/game/questions";

it("首批題庫有五類各 12 題，且每類都有三種難度", () => {
  expect(questionBank).toHaveLength(60);
  for (const category of categories) {
    const group = questionBank.filter(
      (question) => question.category === category,
    );
    expect(group).toHaveLength(12);
    expect(new Set(group.map(({ difficulty }) => difficulty))).toEqual(
      new Set(["easy", "normal", "hard"]),
    );
  }
});

it("驗證四個不同選項、唯一正解和不重複的題目編號", () => {
  const [first, ...rest] = questionBank;
  const options = first.options;
  const invalid = [
    options.slice(1),
    options.map((option) => ({ ...option, correct: true })),
    options.map((option) => ({ ...option, correct: false })),
    options.map((option) => ({ ...option, text: "重複選項" })),
  ];
  for (const bad of invalid) {
    expect(
      bankSchema.safeParse([{ ...first, options: bad }, ...rest]).success,
    ).toBe(false);
  }
  expect(bankSchema.safeParse([first, first, ...rest]).success).toBe(false);
});

it("按考試類型配置難度，並在題庫不足時才重用舊題", () => {
  const quiz = drawQuestions("quiz", []);
  expect(quiz.filter(({ difficulty }) => difficulty === "easy")).toHaveLength(
    4,
  );
  const exam = drawQuestions(
    "highEntrance",
    quiz.map(({ id }) => id),
  );
  expect(exam.filter(({ difficulty }) => difficulty === "hard")).toHaveLength(
    2,
  );
  expect(new Set([...quiz, ...exam].map(({ id }) => id)).size).toBe(15);
  const fresh = questionBank.slice(-2);
  const seen = questionBank.slice(0, -2).map(({ id }) => id);
  const refill = drawQuestions("quiz", seen);
  expect(new Set(refill.map(({ id }) => id)).size).toBe(5);
  expect(refill).toEqual(expect.arrayContaining(fresh));
});

it("依答對題數計分，升學考答對六題開始錄取", () => {
  const attempt = startAssessment("highEntrance", []);
  attempt.items.forEach((item, index) => {
    item.answer = questionsById
      .get(item.id)!
      .options.findIndex(({ correct }) => correct === index < 6);
  });
  expect(scoreAttempt(attempt)).toBe(6);
  expect(passesExam(5)).toBe(false);
  expect(passesExam(6)).toBe(true);
  expect(passesExam(10)).toBe(true);
});

it("小考六種分數依規則對應三個獎勵級距", () => {
  expect([0, 1, 2, 3, 4, 5].map(quizReward)).toEqual([
    { intellect: 4, cash: 50 },
    { intellect: 4, cash: 50 },
    { intellect: 12, cash: 200 },
    { intellect: 12, cash: 200 },
    { intellect: 25, cash: 500 },
    { intellect: 25, cash: 500 },
  ]);
});

it("智力每達 100 給一次輔助，上限三次，每題最多刪去一個錯誤選項", () => {
  expect([0, 99, 100, 199, 200, 299, 300, 9999].map(intellectAssists)).toEqual([
    0, 0, 1, 1, 2, 2, 3, 3,
  ]);
  expect(remainingAssists(startAssessment("quiz", []), 999)).toBe(0);
  const attempt = startAssessment("highEntrance", []);
  const first = attempt.items[0];
  useAssist(attempt, 200);
  expect(questionsById.get(first.id)!.options[first.removed!].correct).toBe(
    false,
  );
  const removed = first.removed;
  useAssist(attempt, 200);
  expect(first.removed).toBe(removed);
  expect(remainingAssists(attempt, 200)).toBe(1);
  first.answer = questionsById
    .get(first.id)!
    .options.findIndex(({ correct }) => correct);
  useAssist(attempt, 200);
  expect(remainingAssists(attempt, 200)).toBe(0);
});
