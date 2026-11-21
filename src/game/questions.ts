import { z } from "zod";
import questions from "../data/questions.json" with { type: "json" };

import gsatQuestions from "../data/gsat-questions.json" with { type: "json" };
import jointQuestions from "../data/joint-questions.json" with { type: "json" };

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
export const schoolQuestionBanks = {
  junior: questionBank,
  high: bankSchema.parse(gsatQuestions),
  university: bankSchema.parse(jointQuestions),
};
export const questionsById = new Map(
  bankSchema
    .parse(Object.values(schoolQuestionBanks).flat())
    .map((question) => [question.id, question]),
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
  gsat: [
    "normal",
    "normal",
    "normal",
    "normal",
    "normal",
    "easy",
    "easy",
    "hard",
    "hard",
    "hard",
  ],
  universityEntrance: [
    "normal",
    "normal",
    "normal",
    "easy",
    "hard",
    "hard",
    "hard",
    "hard",
    "hard",
    "hard",
  ],
} as const;
export type Assessment = keyof typeof examPlans;
export type MajorExam = "gsat" | "universityEntrance";
export const allowsAssists = (kind: Assessment): kind is MajorExam =>
  kind === "gsat" || kind === "universityEntrance";

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let end = result.length - 1; end > 0; end--) {
    const index = Math.floor(random() * (end + 1));
    [result[end], result[index]] = [result[index], result[end]];
  }
  return result;
}

// Keep two questions per category. For each difficulty total, retain the
// selection with the fewest repeats, then compare totals against the plan.
function drawMajorExam(
  pool: Question[],
  seen: ReadonlySet<string>,
  kind: MajorExam,
) {
  type Selection = {
    items: Question[];
    easy: number;
    hard: number;
    repeats: number;
  };
  let selections: Selection[] = [{ items: [], easy: 0, hard: 0, repeats: 0 }];
  for (const category of categories) {
    const candidates = pool.filter(
      (question) => question.category === category,
    );
    const next = new Map<string, Selection>();
    for (const selection of selections) {
      for (const [index, first] of candidates.entries()) {
        for (const second of candidates.slice(index + 1)) {
          const pair = [first, second];
          const easy =
            selection.easy + pair.filter((q) => q.difficulty === "easy").length;
          const hard =
            selection.hard + pair.filter((q) => q.difficulty === "hard").length;
          const repeats =
            selection.repeats + pair.filter((q) => seen.has(q.id)).length;
          const key = `${easy}:${hard}`;
          if (repeats < (next.get(key)?.repeats ?? Infinity)) {
            next.set(key, {
              items: [...selection.items, ...pair],
              easy,
              hard,
              repeats,
            });
          }
        }
      }
    }
    selections = [...next.values()];
  }
  const plan: readonly Question["difficulty"][] = examPlans[kind];
  const easy = plan.filter((difficulty) => difficulty === "easy").length;
  const hard = plan.filter((difficulty) => difficulty === "hard").length;
  const deviation = (selection: Selection) =>
    Math.abs(selection.easy - easy) +
    Math.abs(selection.hard - hard) +
    Math.abs(selection.easy + selection.hard - easy - hard);
  return selections.sort(
    (a, b) => a.repeats - b.repeats || deviation(a) - deviation(b),
  )[0].items;
}

export function drawQuestions(
  kind: Assessment,
  seenIds: readonly string[],
  random = Math.random,
  stage: keyof typeof schoolQuestionBanks = "junior",
) {
  const seen = new Set(seenIds);
  const bank =
    schoolQuestionBanks[
      kind === "gsat"
        ? "high"
        : kind === "universityEntrance"
          ? "university"
          : stage
    ];
  const available = shuffle(
    stage === "university" && !allowsAssists(kind)
      ? bank.filter(({ difficulty }) => difficulty !== "hard")
      : bank,
    random,
  );
  if (allowsAssists(kind))
    return shuffle(drawMajorExam(available, seen, kind), random);
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
    kind: z.enum(["quiz", "gsat", "universityEntrance", "contestTrivia"]),
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
  stage?: keyof typeof schoolQuestionBanks,
): Attempt {
  return {
    kind,
    items: drawQuestions(kind, seenIds, Math.random, stage).map(({ id }) => ({
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
