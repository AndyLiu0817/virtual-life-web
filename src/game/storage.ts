import { z } from "zod";
import type { GameState } from "./types";
import { QUESTIONS } from "../data/questions";
import { MAPS, RULES, ZODIACS } from "../data/config";
const n = z.number().finite().nonnegative();
const int = n.int();
const index = (max: number) => int.max(max);
const stage = z.enum(["tutorial", "junior", "senior", "university", "society"]);
const stats = z.object({ intelligence: n, morality: n, charm: n, fitness: n });
const profile = z
  .object({
    name: z.string().min(1).max(24),
    gender: z.enum(["male", "female"]),
    month: int.min(1).max(12),
    day: int.min(1).max(31),
    blood: z.enum(["A", "B", "O", "AB"]),
    zodiac: index(ZODIACS.length - 1),
  })
  .refine((p) => p.day <= new Date(2000, p.month, 0).getDate());
const quiz = z
  .object({
    kind: z.enum(["quiz", "junior", "senior", "contest"]),
    ids: z
      .array(z.string().refine((id) => QUESTIONS.some((q) => q.id === id)))
      .min(5)
      .max(10),
    index: index(9),
    correct: index(10),
    startedAt: n,
    elapsedMs: n,
    feedback: z.string().nullable(),
    selected: index(3).nullable(),
  })
  .refine(
    (q) =>
      q.index < q.ids.length &&
      q.correct <= q.index + (q.feedback === null ? 0 : 1) &&
      q.ids.length === (q.kind === "quiz" ? 5 : 10) &&
      new Set(q.ids).size === q.ids.length,
  );
const schema = z
  .object({
    version: z.literal(1),
    profile,
    stage,
    turn: int.max(80),
    totalTurn: int.max(80),
    position: index(23),
    stats,
    cash: n,
    level: int.min(1),
    xp: n,
    club: index(7),
    clubHistory: z.array(z.object({ stage, club: index(7) })).max(3),
    education: z.enum(["none", "junior", "senior", "university"]),
    retrograde: index(3),
    fortune: index(3),
    fortuneQueued: z.boolean(),
    god: z.object({ id: index(6), remaining: int.min(1).max(5) }).nullable(),
    partner: index(3).nullable(),
    love: index(99),
    marriedAt: int.max(80).nullable(),
    pregnancy: z.object({ conceivedTurn: int.max(80) }).nullable(),
    births: int.max(80),
    children: z
      .array(
        z.object({
          id: z.string(),
          name: z.string().max(100),
          personality: index(3),
          stats,
          bornTurn: int.max(80),
        }),
      )
      .max(160),
    cards: z.array(z.object({ id: z.string(), count: int.min(1) })).max(1000),
    examHistory: z
      .array(
        z.object({
          kind: z.enum(["quiz", "junior", "senior", "contest"]),
          correct: index(10),
          total: index(10),
          elapsedMs: n,
        }),
      )
      .max(200),
    contests: z
      .array(
        z.object({
          stage,
          turn: int,
          type: index(2),
          rank: index(3),
          score: z.number().finite(),
        }),
      )
      .max(4),
    seenQuestions: z.array(z.string()).max(200),
    phase: z.enum([
      "ready",
      "moving",
      "fork",
      "notice",
      "club",
      "quiz",
      "mini",
      "contest",
      "love",
      "date",
      "offering",
      "end",
    ]),
    remainingSteps: index(12),
    plannedDestination: index(23).nullable(),
    dice: z.array(int.min(1).max(6)).max(2),
    notice: z.string().max(10000),
    quiz: quiz.nullable(),
    mini: z
      .object({
        id: index(7),
        round: index(2),
        wins: index(3),
        contest: z.boolean(),
      })
      .nullable(),
    date: z
      .object({
        index: index(2),
        correct: index(3),
        feedback: z.string().nullable(),
      })
      .nullable(),
    log: z.array(z.string().max(10000)).max(60),
    tutorialStep: index(6),
    turnGod: index(6).nullable(),
    future: z.object({
      chapter: z.enum(["student", "society"]),
      job: z.string().nullable(),
      jobHistory: z.array(z.unknown()),
      stocks: z.record(z.string(), n),
      combat: z.object({ hp: n, deck: z.array(z.string()) }),
      guardianAngels: z.array(z.string()),
      extensions: z.record(z.string(), z.unknown()),
    }),
  })
  .superRefine((g, ctx) => {
    const invalid = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (g.phase === "quiz" && !g.quiz) invalid("quiz");
    if (g.phase === "mini" && !g.mini) invalid("mini");
    if (g.phase === "date" && (!g.date || g.partner === null)) invalid("date");
    if (g.phase === "offering" && !g.god) invalid("god");
    if (g.phase === "end" && g.stage !== "society") invalid("end");
    if (g.stage === "society" && g.phase !== "end") invalid("society");
    if (
      g.stage !== "society" &&
      (g.position >= MAPS[g.stage].length || g.turn > RULES.turns[g.stage])
    )
      invalid("map");
    if (
      g.marriedAt !== null &&
      (g.partner === null || g.marriedAt > g.totalTurn)
    )
      invalid("marriage");
    if (
      g.pregnancy &&
      (g.marriedAt === null || g.pregnancy.conceivedTurn > g.totalTurn)
    )
      invalid("pregnancy");
    if (g.phase === "fork" && MAPS[g.stage][g.position] !== "fork")
      invalid("fork");
  });
const envelope = z.object({
  format: z.literal("virtual-life-web"),
  version: z.literal(1),
  savedAt: z.string().datetime(),
  state: schema,
});
export const SAVE_KEY = "virtual-life-web:v1:";
export function serialize(state: GameState) {
  return JSON.stringify({
    format: "virtual-life-web",
    version: 1,
    savedAt: new Date().toISOString(),
    state,
  });
}
export function parseSave(raw: string): GameState {
  if (raw.length > 2_000_000) throw new Error("size");
  return envelope.parse(JSON.parse(raw)).state as GameState;
}
export function save(state: GameState, slot: number) {
  localStorage.setItem(SAVE_KEY + slot, serialize(state));
}
export function load(slot: number): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY + slot);
  return raw ? parseSave(raw) : null;
}
export function slotInfo(slot: number) {
  try {
    const raw = localStorage.getItem(SAVE_KEY + slot);
    if (!raw) return null;
    const state = parseSave(raw);
    return { state, savedAt: JSON.parse(raw).savedAt as string };
  } catch {
    return null;
  }
}
