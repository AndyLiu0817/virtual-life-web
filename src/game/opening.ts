export const STAT_LABELS = {
  intellect: "智力",
  morality: "道德",
  charm: "魅力",
  fitness: "體能",
} as const;
export type Stat = keyof typeof STAT_LABELS;
export type Stats = Record<Stat, number>;
export type Gender = "boy" | "girl";
export interface Birthday {
  month: number;
  day: number;
}

export const ZODIACS = [
  ["摩羯", 101, "morality", "intellect"],
  ["水瓶", 120, "intellect", "fitness"],
  ["雙魚", 219, "charm", "morality"],
  ["牡羊", 321, "fitness", "charm"],
  ["金牛", 420, "morality", "fitness"],
  ["雙子", 521, "intellect", "charm"],
  ["巨蟹", 622, "morality", "charm"],
  ["獅子", 723, "charm", "fitness"],
  ["處女", 823, "intellect", "morality"],
  ["天秤", 923, "charm", "intellect"],
  ["天蠍", 1024, "intellect", "charm"],
  ["射手", 1123, "fitness", "intellect"],
  ["摩羯", 1222, "morality", "intellect"],
] as const satisfies readonly (readonly [string, number, Stat, Stat])[];

export const BLOOD_TYPES = {
  A: ["morality", "intellect"],
  B: ["charm", "fitness"],
  O: ["fitness", "charm"],
  AB: ["intellect", "charm"],
} as const satisfies Record<string, readonly [Stat, Stat]>;

export const SEASONS = [
  ["冬季", "morality"],
  ["春季", "charm"],
  ["夏季", "fitness"],
  ["秋季", "intellect"],
] as const satisfies readonly (readonly [string, Stat])[];

export type BloodType = keyof typeof BLOOD_TYPES;
export interface Profile {
  gender: Gender;
  name: string;
  birthday: Birthday;
  bloodType: BloodType;
}

export const daysInMonth = (month: number) =>
  new Date(Date.UTC(2000, month, 0)).getUTCDate();
export function isBirthday(value: Birthday) {
  return (
    Number.isInteger(value.month) &&
    value.month >= 1 &&
    value.month <= 12 &&
    Number.isInteger(value.day) &&
    value.day >= 1 &&
    value.day <= daysInMonth(value.month)
  );
}
export function zodiacFor({ month, day }: Birthday) {
  return ZODIACS.reduce((sign, entry) =>
    month * 100 + day >= entry[1] ? entry : sign,
  );
}
export const seasonFor = (month: number) => SEASONS[Math.floor(month / 3) % 4];
export const clampStat = (value: number) => Math.min(9999, Math.max(0, value));

export function calculateOpening(birthday: Birthday, bloodType: BloodType) {
  if (!isBirthday(birthday)) throw new Error("請選擇有效的生日。");
  const [zodiac, , zodiacMain, zodiacSide] = zodiacFor(birthday);
  const [bloodMain, bloodSide] = BLOOD_TYPES[bloodType];
  const [season, seasonStat] = seasonFor(birthday.month);
  const bonuses = [
    {
      source: zodiac + "座",
      entries: [
        [zodiacMain, 30],
        [zodiacSide, 15],
      ],
    },
    {
      source: bloodType + " 型",
      entries: [
        [bloodMain, 20],
        [bloodSide, 10],
      ],
    },
    { source: season, entries: [[seasonStat, 10]] },
  ] satisfies { source: string; entries: [Stat, number][] }[];
  const stats: Stats = { intellect: 80, morality: 80, charm: 80, fitness: 80 };
  for (const { entries } of bonuses) {
    for (const [stat, amount] of entries)
      stats[stat] = clampStat(stats[stat] + amount);
  }
  return { zodiac, season, stats, cash: 5000, bonuses };
}
