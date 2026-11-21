import { z } from "zod";
import { elementaryIds, snapshotStage } from "./main-story";
import { isBoardStage, schoolBoards } from "../data/school-board";
import {
  BLOOD_TYPES,
  calculateOpening,
  isBirthday,
  seasonFor,
  zodiacFor,
  type Profile,
} from "./opening";

import { clubStages } from "./clubs";
import { contestEventIds } from "./contests";
import { minigameIds, minigameTiers } from "./minigames";
import { allowsAssists, attemptSchema } from "./questions";

export const SAVE_VERSION = 1;
export const SLOT_NAMES = [
  "自動存檔",
  "存檔格 1",
  "存檔格 2",
  "存檔格 3",
] as const;
const count = z.number().int().nonnegative();
const stat = count.max(9999);
const nullableId = z.string().min(1).nullable();
const school = z.enum(["elementary", "junior", "high", "university"]);
const saveFields = z.object({
  version: z.literal(SAVE_VERSION),
  updatedAt: z.iso.datetime(),
  gender: z.enum(["boy", "girl"]),
  name: z.string().trim().min(1).max(20),
  birthday: z.object({ month: count, day: count }).refine(isBirthday),
  zodiac: z.string(),
  season: z.string(),
  bloodType: z.enum(bloodTypesKeys()),
  stats: z.object({
    intellect: stat,
    morality: stat,
    charm: stat,
    fitness: stat,
  }),
  cash: count,
  level: count.min(1),
  experience: count,
  cards: z.array(z.string()),
  stage: z.enum([...school.options, "graduated", "earlyExit"]),
  turn: count,
  education: school.nullable(),
  hiddenJobUnlock: z.boolean(),
  exams: z.array(z.object({ id: z.string(), correct: count })),
  seenQuestionIds: z.array(z.string()).default([]),
  entranceAttempt: attemptSchema
    .refine(
      ({ kind, items }) =>
        allowsAssists(kind) && items.some(({ answer }) => answer === null),
    )
    .nullable()
    .default(null),
  ending: z
    .enum(["universityExamFail", "universityGraduate"])
    .nullable()
    .default(null),
  stageIntroSeen: z.array(z.enum(["high", "university"])).default([]),
  examResultPending: z.boolean().default(false),
  clubHistory: z
    .array(z.object({ stage: school, clubId: z.string(), visits: count }))
    .default([]),
  clubEventHistory: z.array(z.string()).default([]),
  shopPurchases: z
    .array(
      z.object({
        stage: z.enum(["high", "university"]),
        itemId: z.string(),
        count,
      }),
    )
    .default([]),
  competitions: z
    .array(
      z.union([
        z.object({
          stage: z.enum(clubStages),
          matchNumber: count.min(1),
          event: z.enum(contestEventIds),
          score: z.number().nonnegative(),
          rank: count.min(1).max(4),
          elapsedMs: count.optional(),
        }),
        z.object({ id: z.string(), rank: count.min(1) }),
      ]),
    )
    .default([]),
  minigames: z
    .array(
      z.object({
        stage: z.enum([...school.options, "graduated", "earlyExit"]),
        game: z.enum(minigameIds),
        score: z.number().nonnegative(),
        tier: z.enum(minigameTiers),
        elapsedMs: count.optional(),
        misses: count.optional(),
      }),
    )
    .default([]),
  partner: nullableId.default(null),
  dating: z.boolean().default(false),
  affection: count.max(99).default(0),
  metPartners: z.array(z.string()).default([]),
  completedDates: count.default(0),
  lastDateQuestions: z.array(z.string()).default([]),
  spouse: nullableId.default(null),
  marriage: z.null().default(null),
  children: z.array(z.object({ id: z.string(), name: z.string() })),
  deity: z.object({ id: z.string(), remainingTurns: count }).nullable(),
  retrogradeTurns: count,
  turnaroundTurns: count,
  retrogradeRepeated: z.boolean().default(false),
  storyFragments: z.array(z.string()).default(elementaryIds),
  storyTilesUsed: z
    .array(
      z.object({
        stage: z.enum(["junior", "high", "university"]),
        tile: count,
      }),
    )
    .default([]),
  boardTile: count.default(0),
  previousTile: count.nullable().default(null),
  nextTile: count.nullable().default(null),
});
const saveSchema = saveFields
  .extend({
    stageSnapshots: z
      .object({
        junior: saveFields.extend({ stage: z.literal("junior") }).optional(),
        high: saveFields.extend({ stage: z.literal("high") }).optional(),
        university: saveFields
          .extend({ stage: z.literal("university") })
          .optional(),
      })
      .default({}),
  })
  .transform((save) => {
    if (!isBoardStage(save.stage)) return save;
    const board = schoolBoards[save.stage];
    const tile = board.tiles[save.boardTile];
    if (
      save.stage === "high" &&
      save.turn === schoolBoards.junior.turns &&
      !save.stageIntroSeen.includes("high") &&
      !save.clubHistory.some(({ stage }) => stage === "high")
    )
      return {
        ...save,
        turn: 0,
        boardTile: board.start,
        previousTile: null,
        nextTile: null,
      };
    if (!tile) {
      return {
        ...save,
        boardTile: board.start,
        previousTile: null,
        nextTile: null,
      };
    }

    const previous = save.previousTile;
    const previousTile =
      previous !== null &&
      board.tiles[previous]?.next.includes(save.boardTile) &&
      tile.next.some((id) => id !== previous)
        ? previous
        : null;
    const next = save.nextTile;
    const nextTile =
      next !== null && next !== previousTile && tile.next.includes(next)
        ? next
        : null;
    return { ...save, previousTile, nextTile };
  })
  .refine(
    (save) =>
      save.zodiac === zodiacFor(save.birthday)[0] &&
      save.season === seasonFor(save.birthday.month)[0],
  );

function bloodTypesKeys() {
  return Object.keys(BLOOD_TYPES) as (keyof typeof BLOOD_TYPES)[];
}

export type Save = z.infer<typeof saveSchema>;

export function createSave(profile: Profile): Save {
  const { stats, zodiac, season, cash } = calculateOpening(
    profile.birthday,
    profile.bloodType,
  );
  return saveSchema.parse({
    ...profile,
    version: SAVE_VERSION,
    updatedAt: new Date().toISOString(),
    stats,
    zodiac,
    season,
    cash,
    level: 1,
    experience: 0,
    cards: [],
    stage: "junior",
    turn: 0,
    education: null,
    hiddenJobUnlock: false,
    exams: [],
    storyFragments: [],
    clubHistory: [],
    competitions: [],
    partner: null,
    affection: 0,
    spouse: null,
    children: [],
    deity: null,
    retrogradeTurns: 0,
    turnaroundTurns: 0,
  });
}

export const exportSave = (save: Save) =>
  JSON.stringify(saveSchema.parse(save), null, 2);

function isLegacyJuniorExit(data: unknown) {
  if (!data || typeof data !== "object") return;
  const save = data as Record<string, unknown>;
  const attempt = save.entranceAttempt as { kind?: string } | null | undefined;
  if (
    attempt?.kind === "highEntrance" ||
    save.ending === "juniorEarlyExit" ||
    (save.stage === "earlyExit" &&
      save.education !== "high" &&
      save.ending == null) ||
    (save.stage === "high" &&
      save.education === "junior" &&
      save.examResultPending === true &&
      Array.isArray(save.exams) &&
      save.exams.at(-1)?.id === "highEntrance")
  )
    return save;
}

export function importSave(text: string): Save {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("無法讀取存檔。請選擇遊戲匯出的 JSON 檔案。");
  }
  if (
    typeof data === "object" &&
    data !== null &&
    "version" in data &&
    data.version !== SAVE_VERSION
  ) {
    throw new Error("此存檔版本與目前遊戲不相容。");
  }
  const legacy = isLegacyJuniorExit(data);
  const parsed = saveSchema.safeParse(
    legacy
      ? {
          ...legacy,
          stage: "high",
          education: "junior",
          turn: 0,
          boardTile: schoolBoards.high.start,
          previousTile: null,
          nextTile: null,
          ending: null,
          entranceAttempt: null,
          examResultPending: false,
        }
      : data,
  );

  if (!parsed.success) throw new Error("存檔內容不完整或格式不正確。");
  return legacy ? snapshotStage(parsed.data) : parsed.data;
}

export function saveStorage(storage: Pick<Storage, "getItem" | "setItem">) {
  const key = (slot: number) => {
    if (!Number.isInteger(slot) || slot < 0 || slot >= SLOT_NAMES.length) {
      throw new RangeError("找不到存檔格。");
    }
    return `virtual-life-web:v3:slot:${slot}`;
  };
  return {
    read(slot: number) {
      const text = storage.getItem(key(slot));
      return text === null ? null : importSave(text);
    },
    write(slot: number, save: Save) {
      storage.setItem(key(slot), exportSave(save));
    },
  };
}
