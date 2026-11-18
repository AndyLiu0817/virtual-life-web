import { z } from "zod";
import questions from "../data/questions.json" with { type: "json" };

const text = z.string().trim().min(1);
export const categories = ["生活", "史地", "自然", "數學邏輯", "社會"] as const;
const questionSchema = z
  .object({
    id: text,
    category: z.enum(categories),
    difficulty: z.enum(["easy", "normal", "hard"]),
    prompt: text,
    options: z.array(z.object({ text, correct: z.boolean() })).length(4),
  })
  .refine(
    ({ options }) =>
      options.filter(({ correct }) => correct).length === 1 &&
      new Set(options.map(({ text }) => text)).size === 4,
  );

export const bankSchema = z
  .array(questionSchema)
  .min(10)
  .refine(
    (bank) =>
      new Set(bank.map(({ id }) => id)).size === bank.length &&
      new Set(bank.map(({ prompt }) => prompt)).size === bank.length,
  );
export const questionBank = bankSchema.parse(questions);
export type Question = z.infer<typeof questionSchema>;
export const questionsById = new Map(
  questionBank.map((question) => [question.id, question]),
);
export const examPlans = {
  quiz: ["easy", "easy", "easy", "easy", "normal"],
  contestTrivia: [
    "easy",
    "easy",
    "easy",
    "easy",
    "easy",
    "normal",
    "normal",
    "normal",
    "normal",
    "normal",
  ],
  highEntrance: [
    "normal",
    "normal",
    "normal",
    "normal",
    "normal",
    "easy",
    "easy",
    "easy",
    "hard",
    "hard",
  ],
  universityEntrance: [
    "normal",
    "normal",
    "normal",
    "normal",
    "easy",
    "easy",
    "hard",
    "hard",
    "hard",
    "hard",
  ],
} as const;
export type Assessment = keyof typeof examPlans;
export const allowsAssists = (kind: Assessment) =>
  kind === "highEntrance" || kind === "universityEntrance";

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let end = result.length - 1; end > 0; end--) {
    const index = Math.floor(random() * (end + 1));
    [result[end], result[index]] = [result[index], result[end]];
  }
  return result;
}

export function drawQuestions(
  kind: Assessment,
  seenIds: readonly string[],
  random = Math.random,
) {
  const seen = new Set(seenIds);
  const available = shuffle(questionBank, random);
  const fresh = available.filter(({ id }) => !seen.has(id));
  const selected: Question[] = [];
  const missing: Question["difficulty"][] = [];

  function take(pool: Question[], difficulty?: Question["difficulty"]) {
    const index = pool.findIndex(
      (question) =>
        !selected.includes(question) &&
        (!difficulty || difficulty === question.difficulty),
    );
    if (index === -1) return false;
    selected.push(pool[index]);
    return true;
  }

  for (const difficulty of examPlans[kind]) {
    if (!take(fresh, difficulty)) missing.push(difficulty);
  }
  for (const difficulty of missing) {
    if (!take(fresh)) take(available, difficulty) || take(available);
  }
  return shuffle(selected, random);
}

export const passScore = 6;
export const passesExam = (correct: number) => correct >= passScore;
export const intellectAssists = (intellect: number) =>
  Math.min(3, Math.floor(intellect / 100));
export const quizReward = (correct: number) =>
  correct >= 4
    ? { intellect: 25, cash: 500 }
    : correct >= 2
      ? { intellect: 12, cash: 200 }
      : { intellect: 4, cash: 50 };

const optionIndex = z.number().int().min(0).max(3);
export const attemptSchema = z
  .object({
    kind: z.enum([
      "quiz",
      "highEntrance",
      "universityEntrance",
      "contestTrivia",
    ]),
    items: z.array(
      z.object({
        id: text.refine((id) => questionsById.has(id)),
        answer: optionIndex.nullable(),
        removed: optionIndex.nullable(),
      }),
    ),
  })
  .refine(({ kind, items }) => {
    if (
      items.length !== examPlans[kind].length ||
      new Set(items.map(({ id }) => id)).size !== items.length
    )
      return false;
    let unanswered = false;
    let used = 0;
    for (const { id, answer, removed } of items) {
      if (unanswered && (answer !== null || removed !== null)) return false;
      if (removed !== null) {
        if (
          answer === removed ||
          questionsById.get(id)?.options[removed].correct !== false
        )
          return false;
        used++;
      }
      unanswered = answer === null;
    }
    return used <= (allowsAssists(kind) ? 3 : 0);
  });
export type Attempt = z.infer<typeof attemptSchema>;

export function startAssessment(
  kind: Assessment,
  seenIds: readonly string[],
): Attempt {
  return {
    kind,
    items: drawQuestions(kind, seenIds).map(({ id }) => ({
      id,
      answer: null,
      removed: null,
    })),
  };
}

export const scoreAttempt = (attempt: Attempt) =>
  attempt.items.filter(
    ({ id, answer }) =>
      answer !== null && questionsById.get(id)!.options[answer].correct,
  ).length;

export const remainingAssists = (attempt: Attempt, intellect: number) =>
  !allowsAssists(attempt.kind)
    ? 0
    : Math.max(
        0,
        intellectAssists(intellect) -
          attempt.items.filter(({ removed }) => removed !== null).length,
      );

export function useAssist(
  attempt: Attempt,
  intellect: number,
  random = Math.random,
) {
  const item = attempt.items.find(({ answer }) => answer === null);
  if (
    !item ||
    item.removed !== null ||
    remainingAssists(attempt, intellect) === 0
  )
    return;
  const wrong = [0, 1, 2, 3].filter(
    (index) => !questionsById.get(item.id)!.options[index].correct,
  );
  item.removed = wrong[Math.floor(random() * wrong.length)];
}
