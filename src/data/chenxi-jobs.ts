import type { Stat } from "../game/opening";

type Requirement = readonly [job: string, level: number];
export interface ChenxiJob {
  tier: number;
  name: string;
  titles: readonly [string, string, string];
  income: number;
  examLocked: boolean;
  stats?: readonly Stat[];
  experience?: readonly Requirement[];
  required?: number;
  finalRequirements?: {
    jobs: number;
    level: number;
    allStats: number;
    cash: number;
  };
  skill?: string;
  specials?: readonly string[];
}

export const freshman = "社會新鮮人";
const first = (
  name: string,
  titles: ChenxiJob["titles"],
  income: number,
  stats: readonly Stat[],
  skill: string,
  examLocked = false,
): ChenxiJob => ({ tier: 1, name, titles, income, stats, skill, examLocked });
const later = (
  tier: number,
  name: string,
  titles: ChenxiJob["titles"],
  income: number,
  experience: readonly Requirement[],
  skill: string,
  examLocked = false,
): ChenxiJob => ({
  tier,
  name,
  titles,
  income,
  experience,
  required: tier === 2 ? 1 : 2,
  skill,
  examLocked,
});
const any = (...names: string[]): Requirement[] =>
  names.map((name) => [name, 1]);

export const jobs: readonly ChenxiJob[] = [
  {
    tier: 0,
    name: freshman,
    titles: ["實習生", "約聘人員", "正職新人"],
    income: 1,
    examLocked: false,
    specials: ["拚命三郎", "熱血衝刺", "不屈鬥魂"],
  },
  first(
    "保全",
    ["保全員", "保全組長", "保全主任"],
    2,
    ["morality", "fitness"],
    "街區被搶佔時反擊",
  ),
  first(
    "廚師",
    ["學徒", "二廚", "主廚"],
    3,
    ["fitness", "charm"],
    "主角裝備 8 折",
  ),
  first(
    "門市",
    ["門市人員", "門市主管", "區督導"],
    2,
    ["charm", "intellect"],
    "道具店商品 9 折",
  ),
  first(
    "倉管",
    ["倉管員", "倉儲組長", "物流主任"],
    2,
    ["intellect", "morality"],
    "街區過路費收入增加 10%",
  ),
  first(
    "護理師",
    ["護理師", "護理長", "護理部主任"],
    2,
    ["morality", "charm"],
    "主角回復道具 8 折",
    true,
  ),
  first(
    "助理",
    ["行政助理", "特別助理", "秘書長"],
    2,
    ["intellect", "morality"],
    "領薪增加 10%",
    true,
  ),
  first(
    "工程助理",
    ["工務助理", "現場技術員", "工務督導"],
    2,
    ["intellect", "fitness"],
    "街區加蓋 9 折",
    true,
  ),
  first(
    "空服員",
    ["空服員", "客艙長", "客艙經理"],
    3,
    ["charm", "fitness"],
    "搭捷運後可多走 1～2 格",
    true,
  ),
  later(
    2,
    "消防員",
    ["消防員", "小隊長", "大隊長"],
    3,
    any("保全", "護理師"),
    "陷阱卡效果減半",
  ),
  later(
    2,
    "業務",
    ["業務專員", "業務主任", "業務經理"],
    4,
    any("廚師", "護理師", "空服員"),
    "戰鬥獎金加成",
  ),
  later(
    2,
    "徵信偵探",
    ["調查員", "資深調查員", "徵信社長"],
    2,
    any("廚師"),
    "可查看對手手牌",
  ),
  later(
    2,
    "修護技工",
    ["修護學徒", "修護技工", "修護師傅"],
    3,
    any("保全", "倉管"),
    "主角與靈獸已穿戴的裝備效果增加 5%",
  ),
  later(
    2,
    "美容師",
    ["美容助理", "美容師", "美容店長"],
    3,
    any("門市", "廚師"),
    "事件四維加成",
  ),
  later(
    2,
    "攝影師",
    ["攝影助理", "攝影師", "攝影總監"],
    3,
    any("業務", "助理", "空服員"),
    "戰鬥額外經驗",
  ),
  later(
    2,
    "研究員",
    ["助理研究員", "副研究員", "研究員"],
    2,
    any("助理", "護理師"),
    "收服率加成",
    true,
  ),
  later(
    2,
    "工程師",
    ["助理工程師", "工程師", "資深工程師"],
    3,
    any("工程助理", "保全", "研究員"),
    "街區加蓋 8 折",
    true,
  ),
  later(
    2,
    "社工",
    ["社工員", "督導", "社工主任"],
    1,
    any("保全", "工程師"),
    "戰敗免扣錢",
    true,
  ),
  later(
    2,
    "老師",
    ["代課老師", "正式老師", "校長"],
    2,
    any("助理", "社工"),
    "事件四維加成",
    true,
  ),
  later(
    2,
    "程式設計師",
    ["初級程式設計師", "資深程式設計師", "技術長"],
    4,
    any("工程師", "研究員"),
    "股票交易免手續費",
    true,
  ),
  later(
    2,
    "會計",
    ["會計助理", "會計專員", "主辦會計"],
    3,
    any("助理", "倉管"),
    "股票交易手續費減半",
    true,
  ),
  later(
    3,
    "偶像",
    ["練習生", "新人偶像", "天王天后"],
    3,
    [
      ["業務", 3],
      ["廚師", 2],
    ],
    "事件四維加成",
  ),
  later(
    3,
    "房仲",
    ["房仲專員", "店長", "區經理"],
    5,
    [
      ["業務", 3],
      ["徵信偵探", 2],
    ],
    "繳交過路費減半",
  ),
  later(
    3,
    "職業運動員",
    ["二軍選手", "一軍選手", "明星選手"],
    4,
    [
      ["保全", 3],
      ["消防員", 2],
    ],
    "每 5 回合可重擲骰子一次",
  ),
  later(
    3,
    "造型師",
    ["造型助理", "造型師", "首席造型師"],
    3,
    [
      ["美容師", 2],
      ["廚師", 3],
    ],
    "靈獸裝備 8 折",
  ),
  later(
    3,
    "特勤警察",
    ["警員", "小隊長", "特勤隊長"],
    4,
    [
      ["工程師", 2],
      ["社工", 3],
    ],
    "戰前補血",
    true,
  ),
  later(
    3,
    "記者",
    ["實習記者", "記者", "總編輯"],
    4,
    [
      ["社工", 3],
      ["研究員", 3],
    ],
    "事件四維加成",
    true,
  ),
  later(
    3,
    "醫師",
    ["住院醫師", "主治醫師", "院長"],
    5,
    [
      ["護理師", 3],
      ["研究員", 3],
    ],
    "住院回合減半",
    true,
  ),
  later(
    3,
    "律師",
    ["實習律師", "律師", "合夥律師"],
    5,
    [
      ["老師", 3],
      ["徵信偵探", 3],
    ],
    "街區過路費收入增加 50%",
    true,
  ),
  later(
    3,
    "電競選手",
    ["替補選手", "正式選手", "世界冠軍"],
    4,
    [
      ["程式設計師", 3],
      ["攝影師", 2],
    ],
    "小遊戲獎勵加倍",
    true,
  ),
  later(
    3,
    "創業家",
    ["新創老闆", "公司董事長", "集團總裁"],
    5,
    [
      ["業務", 3],
      ["程式設計師", 2],
    ],
    "經過起點領目前月薪一半的股利",
    true,
  ),
  later(
    3,
    "會計師",
    ["會計師", "合夥會計師", "所長"],
    5,
    [
      ["會計", 3],
      ["助理", 2],
    ],
    "薪水抵債時多抵 20%",
    true,
  ),
  later(
    3,
    "心理師",
    ["實習心理師", "諮商心理師", "所長"],
    4,
    [
      ["社工", 3],
      ["老師", 2],
    ],
    "平常戰開始時對手攻擊降低一階",
    true,
  ),
  later(
    4,
    "時空行者",
    ["時空學徒", "時空行者", "時空主宰"],
    5,
    [
      ["偶像", 2],
      ["造型師", 3],
      ["房仲", 3],
    ],
    "增加步數",
  ),
  later(
    4,
    "馭獸師",
    ["馴獸員", "馭獸師", "萬獸之王"],
    5,
    [
      ["創業家", 3],
      ["職業運動員", 3],
      ["偶像", 2],
    ],
    "收買折扣",
  ),
  later(
    4,
    "織影者",
    ["織影學徒", "織影者", "影縫宗師"],
    5,
    [
      ["房仲", 3],
      ["偶像", 2],
      ["特勤警察", 2],
    ],
    "對靈能對手傷害增加 15%，較易識破陷害與監視",
  ),
  later(
    4,
    "靈域守",
    ["靈域學徒", "靈域守", "界域宗主"],
    5,
    [
      ["房仲", 3],
      ["職業運動員", 3],
      ["創業家", 2],
    ],
    "駐守加成",
  ),
  later(
    4,
    "靈甲戰士",
    ["靈甲兵", "靈甲騎士", "靈甲將軍"],
    5,
    [
      ["記者", 2],
      ["房仲", 3],
      ["特勤警察", 2],
    ],
    "陷害效果減半",
    true,
  ),
  later(
    4,
    "靈醫",
    ["靈療師", "靈醫", "聖手"],
    5,
    [
      ["醫師", 3],
      ["社工", 3],
      ["造型師", 2],
    ],
    "回復生命",
    true,
  ),
  later(
    4,
    "預知者",
    ["占星者", "預知者", "天機師"],
    5,
    [
      ["律師", 3],
      ["記者", 3],
      ["電競選手", 2],
    ],
    "查看下一格",
    true,
  ),
  later(
    4,
    "鎮罪使",
    ["鎮罪學徒", "鎮罪使", "斷罪聖裁"],
    5,
    [
      ["律師", 3],
      ["記者", 3],
      ["心理師", 2],
    ],
    "七宗罪地圖魔王戰傷害增加 15%，較易揭開隱藏弱點",
    true,
  ),
  {
    tier: 5,
    name: "靈尊",
    titles: ["靈尊", "天靈尊", "至高靈尊"],
    income: 5,
    examLocked: false,
    finalRequirements: { jobs: 2, level: 3, allStats: 9999, cash: 500000 },
    skill: "同時擁有兩種練滿的靈能地圖技",
  },
];
export const jobNames = jobs.map(({ name }) => name);
export const jobByName = (name: string) =>
  jobs.find((job) => job.name === name)!;
