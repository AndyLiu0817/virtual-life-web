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
  schoolQuestionBanks,
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
    "gsat",
    quiz.map(({ id }) => id),
  );
  expect(exam.filter(({ difficulty }) => difficulty === "hard")).toHaveLength(
    3,
  );
  expect(new Set([...quiz, ...exam].map(({ id }) => id)).size).toBe(15);
  const fresh = questionBank.slice(-2);
  const seen = questionBank.slice(0, -2).map(({ id }) => id);
  const refill = drawQuestions("quiz", seen);
  expect(new Set(refill.map(({ id }) => id)).size).toBe(5);
  expect(refill).toEqual(expect.arrayContaining(fresh));
});

it("依答對題數計分，升學考答對六題開始錄取", () => {
  const attempt = startAssessment("gsat", []);
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
  const attempt = startAssessment("gsat", []);
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

it("三個題庫各有五類、每類 12 題，題號與題幹全域唯一", () => {
  for (const bank of Object.values(schoolQuestionBanks)) {
    expect(bankSchema.parse(bank)).toHaveLength(60);
    for (const category of categories) {
      expect(
        bank.filter((question) => question.category === category),
      ).toHaveLength(12);
    }
  }
  expect(
    bankSchema.parse(Object.values(schoolQuestionBanks).flat()),
  ).toHaveLength(180);
});

it.each([
  ["gsat", "high", { easy: 2, normal: 5, hard: 3 }],
  ["universityEntrance", "university", { easy: 1, normal: 3, hard: 6 }],
] as const)("%s 只用本庫，平衡分類及難度", (kind, stage, counts) => {
  const bank = schoolQuestionBanks[stage];
  const seen = bank.slice(0, 5).map(({ id }) => id);
  const draw = drawQuestions(kind, seen, () => 0.5);
  expect(
    draw.every(
      (question) => bank.includes(question) && !seen.includes(question.id),
    ),
  ).toBe(true);
  for (const category of categories) {
    expect(
      draw.filter((question) => question.category === category),
    ).toHaveLength(2);
  }
  for (const [difficulty, count] of Object.entries(counts)) {
    expect(
      draw.filter((question) => question.difficulty === difficulty),
    ).toHaveLength(count);
  }
});

it("大考優先耗用各類新題，放寬難度後才重用同庫舊題", () => {
  const bank = schoolQuestionBanks.high;
  const seen = bank
    .filter(
      ({ category, difficulty }) =>
        category === "生活" || difficulty !== "normal",
    )
    .map(({ id }) => id);
  const draw = drawQuestions("gsat", seen, () => 0.5);
  expect(new Set(draw.map(({ id }) => id)).size).toBe(10);
  expect(draw.every((question) => bank.includes(question))).toBe(true);
  expect(draw.filter(({ id }) => seen.includes(id))).toHaveLength(2);
  expect(
    draw.filter(({ difficulty }) => difficulty === "normal").length,
  ).toBeGreaterThanOrEqual(8);
  for (const category of categories) {
    expect(
      draw.filter((question) => question.category === category),
    ).toHaveLength(2);
  }
});

it.each(["quiz", "contestTrivia"] as const)(
  "%s 隨學段換題庫，大學只出易與中",
  (kind) => {
    for (const stage of ["junior", "high", "university"] as const) {
      const bank = schoolQuestionBanks[stage];
      const draw = drawQuestions(
        kind,
        bank.map(({ id }) => id),
        () => 0.5,
        stage,
      );
      expect(draw).toHaveLength(kind === "quiz" ? 5 : 10);
      expect(draw.every((question) => bank.includes(question))).toBe(true);
      if (stage === "university")
        expect(draw.every(({ difficulty }) => difficulty !== "hard")).toBe(
          true,
        );
    }
  },
);
