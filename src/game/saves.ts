import { z } from "zod";
import {
  BLOOD_TYPES,
  calculateOpening,
  isBirthday,
  seasonFor,
  zodiacFor,
  type Profile,
} from "./opening";

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
const saveSchema = z
  .object({
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
    clubHistory: z.array(
      z.object({ stage: school, clubId: z.string(), visits: count }),
    ),
    competitions: z.array(z.object({ id: z.string(), rank: count.min(1) })),
    partner: nullableId,
    affection: count.max(99),
    spouse: nullableId,
    children: z.array(z.object({ id: z.string(), name: z.string() })),
    deity: z.object({ id: z.string(), remainingTurns: count }).nullable(),
    retrogradeTurns: count,
    turnaroundTurns: count,
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
  const parsed = saveSchema.safeParse(data);
  if (!parsed.success) throw new Error("存檔內容不完整或格式不正確。");
  return parsed.data;
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
