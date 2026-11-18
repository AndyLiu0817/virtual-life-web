import type { Stat } from "./opening";
import type { Save } from "./saves";

export const clubStages = ["junior", "high", "university"] as const;
export type ClubStage = (typeof clubStages)[number];
export const clubStageNames = {
  junior: "國中",
  high: "高中",
  university: "大學",
};

interface Club {
  name: string;
  main: Stat;
  sub: Stat;
  lines: readonly string[];
}

export const clubs = {
  study: {
    name: "研習社",
    main: "intellect",
    sub: "morality",
    lines: [
      "你把筆記借給忘帶課本的同學。他說你的字比課本更像人話。",
      "大家解出一道難題，掌聲小到剛好沒被圖書館阿姨聽見。",
      "你把問題寫滿白板，學姊在角落補上一句：先喝水。",
    ],
  },
  sports: {
    name: "體育社",
    main: "fitness",
    sub: "charm",
    lines: [
      "你跑完最後一圈，還轉身陪同學跑了半圈。兩人都說是散步。",
      "你傳出一記好球，隊友接住後立刻把功勞傳回來。",
      "熱身時你左右不分。大家跟著做，意外多發明一套操。",
    ],
  },
  drama: {
    name: "表演社",
    main: "charm",
    sub: "fitness",
    lines: [
      "道具門打不開，你即興演成忘帶鑰匙。觀眾笑得比預演還大聲。",
      "你扶住快倒的布景，台詞照念。學長說連那棵樹都有戲。",
      "全組蹲著排練小矮人。謝幕前，大腿比台詞更有感情。",
    ],
  },
  service: {
    name: "服務社",
    main: "morality",
    sub: "intellect",
    lines: [
      "你替失物箱做索引。下午，三把傘和一隻便當袋順利回家。",
      "你教學弟摺回收紙箱，他回教你怎麼摺得比你快。",
      "你把值日表排得人人有空。大家一致同意把排表也算值日。",
    ],
  },
  rock: {
    name: "熱音社",
    main: "charm",
    sub: "morality",
    lines: [
      "你把音量轉小，第一次聽清楚隔壁同學寫的副歌。",
      "鼓手漏了一拍，你接了一句即興。大家決定把這段留下來。",
      "演完一起收線。有人發現，最難解的和弦其實是延長線。",
    ],
  },
  chess: {
    name: "棋藝社",
    main: "intellect",
    sub: "fitness",
    lines: [
      "你想出了妙招，順便站起來伸展。對手說你的膝蓋先宣布將軍。",
      "棋子滾到桌下，你一邊蹲著找，一邊把剛才的殘局想通了。",
      "快棋結束後大家去散步，終於輪到人走格子。",
    ],
  },
  photo: {
    name: "攝影社",
    main: "charm",
    sub: "intellect",
    lines: [
      "拍團照時你喊「要放學了」。這次每個人的笑都是真的。",
      "你算好逆光角度。同學看完照片，第一次覺得自己的翹毛很好看。",
      "你蹲了一節下課等光線，拍到一隻搶先下課的麻雀。",
    ],
  },
  scouts: {
    name: "童軍社",
    main: "fitness",
    sub: "morality",
    lines: [
      "你背著整組的水上坡。回程大家替你分擔，連空瓶都有專人護送。",
      "你學會打繩結，也替同學解開把自己綁在背包上的那一個。",
      "你們找到了集合點，還沿路把別人遺落的垃圾一起帶了回來。",
    ],
  },
} satisfies Record<string, Club>;

export type ClubId = keyof typeof clubs;
export const clubIds = Object.keys(clubs) as ClubId[];
export const isClubId = (id: string): id is ClubId => Object.hasOwn(clubs, id);

export function clubChoice(save: Save, stage: ClubStage) {
  if (
    save.stage !== stage ||
    save.clubHistory.some((entry) => entry.stage === stage)
  )
    return;
  const previous = stage === "university" ? ["high", "junior"] : ["junior"];
  const current =
    stage === "junior"
      ? undefined
      : previous
          .map(
            (school) =>
              save.clubHistory.find((entry) => entry.stage === school)?.clubId,
          )
          .find((id): id is ClubId => id !== undefined && isClubId(id));
  return { current, options: clubIds };
}

export function chooseClub(
  save: Save,
  stage: ClubStage,
  clubId?: ClubId,
): Save {
  const choice = clubChoice(save, stage);
  const selected = clubId ?? choice?.current;
  if (!choice || !selected || !isClubId(selected)) return save;
  const clubHistory = [
    ...save.clubHistory,
    { stage, clubId: selected, visits: 0 },
  ];
  return { ...save, clubHistory };
}

export function visitClub(save: Save, random = Math.random) {
  const entry = save.clubHistory.find(({ stage }) => stage === save.stage);
  if (!entry || !isClubId(entry.clubId)) return;
  const club = clubs[entry.clubId];
  const stats = { ...save.stats };
  const changes = [
    { target: club.main, amount: Math.min(12, 9999 - stats[club.main]) },
    { target: club.sub, amount: Math.min(6, 9999 - stats[club.sub]) },
  ];
  for (const { target, amount } of changes) stats[target] += amount;
  const cash = random() < 0.1 ? 200 : 0;
  return {
    club,
    changes,
    cash,
    scene: entry.visits % 2 === 0 ? "clubroom" : "field",
    text: club.lines[Math.floor(random() * club.lines.length)],
    save: {
      ...save,
      stats,
      cash: save.cash + cash,
      clubHistory: save.clubHistory.map((item) =>
        item === entry ? { ...item, visits: item.visits + 1 } : item,
      ),
    },
  };
}
