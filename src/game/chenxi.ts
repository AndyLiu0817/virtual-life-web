import {
  chenxiBoard,
  districtAt,
  districtTileIds,
  metroStations,
} from "../data/chenxi-board";
import { freshman, jobByName, type ChenxiJob } from "../data/chenxi-jobs";
import { chenxiTileLabels } from "../data/junior";
import { walkStep } from "./board";
import type { Save } from "./saves";

export type JobLevel = Save["chenxi"]["jobLevel"];
type Property = Save["chenxi"]["districts"][string];

export function enterChenxi(save: Save): Save {
  if (save.stage === "chenxi") return save;
  const start = {
    ...save,
    stage: "chenxi" as const,
    turn: 0,
    boardTile: chenxiBoard.start,
    previousTile: null,
    nextTile: null,
    examResultPending: false,
    updatedAt: new Date().toISOString(),
    chenxi: {
      job: freshman,
      jobLevel: 1 as const,
      history: {},
      districts: {},
      debt: 0,
      clues: 0,
      introSeen: false,
      conditionsAnnounced: false,
      lastRerollTurn: null,
    },
  };
  const { stageSnapshots, chenxiStart: previousStart, ...snapshot } = start;
  return {
    ...snapshot,
    stageSnapshots,
    chenxiStart: previousStart ?? snapshot,
  };
}

export function jobRestriction(save: Save, job: ChenxiJob) {
  if (job.tier >= 4) return "之後開放";
  if (save.ending === "universityExamFail" && job.examLocked)
    return "聯考未錄取，此為知識型職業";
  if (job.stats?.some((stat) => save.stats[stat] < 500)) return "四維尚未達標";
  const level = (name: string) =>
    Math.max(
      save.chenxi.history[name] ?? 0,
      name === save.chenxi.job ? save.chenxi.jobLevel : 0,
    );
  if (
    job.experience &&
    job.experience.filter(([name, rank]) => level(name) >= rank).length <
      job.required!
  )
    return "前置職級尚未達標";
  return "";
}

export function changeJob(save: Save, job: ChenxiJob): Save {
  const { chenxi } = save;
  if (job.name === chenxi.job || jobRestriction(save, job)) return save;
  const highest = Math.max(
    chenxi.history[chenxi.job] ?? 0,
    chenxi.jobLevel,
  ) as JobLevel;
  return {
    ...save,
    chenxi: {
      ...chenxi,
      job: job.name,
      jobLevel: 1,
      history: { ...chenxi.history, [chenxi.job]: highest },
    },
  };
}

export function salary(save: Save) {
  const { job, jobLevel } = save.chenxi;
  return Math.round(
    jobByName(job).income * jobLevel * 2000 * (job === "助理" ? 1.1 : 1),
  );
}

export function paySalary(save: Save, gross = salary(save)) {
  const { chenxi } = save;
  const multiplier = chenxi.job === "會計師" ? 1.2 : 1;
  const withheld = Math.min(gross, Math.ceil(chenxi.debt / multiplier));
  const repaid = Math.min(chenxi.debt, Math.floor(withheld * multiplier));
  return {
    gross,
    repaid,
    received: gross - withheld,
    save: {
      ...save,
      cash: save.cash + gross - withheld,
      chenxi: { ...chenxi, debt: chenxi.debt - repaid },
    },
  };
}

export function promotion(save: Save, gross: number, random = Math.random) {
  const draw = random();
  const { jobLevel } = save.chenxi;
  if (draw < 0.5 && jobLevel === 3) {
    const bonus = paySalary(save, gross);
    return { save: bonus.save, result: "bonus" as const, bonus };
  }
  const level = Math.min(
    3,
    Math.max(1, jobLevel + (draw < 0.5 ? 1 : draw < 0.8 ? 0 : -1)),
  ) as JobLevel;
  const result: "up" | "down" | "same" =
    level > jobLevel ? "up" : level < jobLevel ? "down" : "same";
  const { chenxi } = save;
  const history =
    result === "down"
      ? {
          ...chenxi.history,
          [chenxi.job]: Math.max(
            chenxi.history[chenxi.job] ?? 0,
            jobLevel,
          ) as JobLevel,
        }
      : chenxi.history;
  return {
    save: { ...save, chenxi: { ...chenxi, jobLevel: level, history } },
    result,
  };
}

export function propertyCost(save: Save, tile: number) {
  const district = districtAt(tile);
  const property = save.chenxi.districts[tile];
  if (
    !district ||
    (property && (property.owner !== "player" || property.level === 3))
  )
    return null;
  const job = save.chenxi.job;
  return (
    district.price *
    (property ? (job === "工程師" ? 0.8 : job === "工程助理" ? 0.9 : 1) : 1)
  );
}

export function invest(save: Save, tile: number): Save {
  const price = propertyCost(save, tile);
  if (price === null || save.cash < price) return save;
  const current = save.chenxi.districts[tile];
  const property = {
    owner: "player",
    invested: (current?.invested ?? 0) + price,
    level: ((current?.level ?? 0) + 1) as JobLevel,
  };
  const updated = {
    ...save,
    cash: save.cash - price,
    chenxi: {
      ...save.chenxi,
      districts: { ...save.chenxi.districts, [tile]: property },
    },
  };
  return current ? onDistrictUpgraded(updated, tile) : updated;
}

// The stock system can raise the corresponding share price by 5% here.
const onDistrictUpgraded = (save: Save, _tile: number) => save;

export function toll(
  save: Save,
  tile: number,
  ownerJob?: string,
  payerJob?: string,
) {
  const property = save.chenxi.districts[tile];
  if (!property) return 0;
  const monopoly = districtAt(tile)?.tiles.every(
    (id) => save.chenxi.districts[id]?.owner === property.owner,
  );
  ownerJob ??= property.owner === "player" ? save.chenxi.job : undefined;
  payerJob ??= property.owner !== "player" ? save.chenxi.job : undefined;
  const ownerBonus = ownerJob === "律師" ? 1.5 : ownerJob === "倉管" ? 1.1 : 1;
  return Math.round(
    property.invested *
      [0.2, 0.4, 0.8][property.level - 1] *
      (monopoly ? 2 : 1) *
      ownerBonus *
      (payerJob === "房仲" ? 0.5 : 1),
  );
}

// Stock liquidation can supply cash before property sales when trading opens.
const sellStockForToll = (save: Save, _amount: number) => save;

export function payToll(save: Save, amount: number): Save {
  if (save.cash < amount) save = sellStockForToll(save, amount);
  const districts = { ...save.chenxi.districts };
  let { cash } = save;
  const available = Object.entries(districts)
    .filter(([, property]) => property.owner === "player")
    .sort(([, a], [, b]) => a.invested - b.invested);
  for (const [tile, property] of available) {
    if (cash >= amount) break;
    cash += property.invested;
    delete districts[tile];
  }
  return {
    ...save,
    cash: Math.max(0, cash - amount),
    chenxi: {
      ...save.chenxi,
      districts,
      debt: save.chenxi.debt + Math.max(0, amount - cash),
    },
  };
}

export function forcedPurchase(
  property: Property,
  buyer: string,
  cash: number,
  lawyerLetter: boolean,
) {
  const price = property.invested * 2;
  if (property.owner === buyer || lawyerLetter || cash < price)
    return { property, price: 0 };
  return { property: { ...property, owner: buyer, invested: price }, price };
}

export function chenxiStep(save: Save, steps: number) {
  const move = walkStep(chenxiBoard, save, steps);
  const reward =
    move.save.boardTile === chenxiBoard.start && save.chenxi.job === "創業家"
      ? salary(save) / 2
      : 0;
  return { ...move, reward, save: { ...move.save, cash: save.cash + reward } };
}

export function metroDestination(tile: number) {
  return tile === 9 ? 37 : tile === 37 ? 9 : null;
}
export function rideMetro(save: Save): Save {
  const to = metroDestination(save.boardTile);
  return to === null
    ? save
    : { ...save, boardTile: to, previousTile: null, nextTile: null };
}
export const stationName = (tile: number) =>
  metroStations[tile as keyof typeof metroStations];
export const ownedDistricts = (save: Save) =>
  districtTileIds.filter((id) => save.chenxi.districts[id]?.owner === "player")
    .length;
export const progress = (save: Save) => [
  { label: "職級", value: save.chenxi.jobLevel, target: 2 },
  { label: "街區", value: ownedDistricts(save), target: 3 },
  { label: "父親線索", value: save.chenxi.clues, target: 3 },
];
export const canRollChenxi = (save: Save) => save.turn < chenxiBoard.turns;
export function finishChenxiTurn(save: Save): Save {
  if (!canRollChenxi(save)) return save;
  return { ...save, turn: save.turn + 1, updatedAt: new Date().toISOString() };
}

export function stubNotice(tile: number) {
  const kind = chenxiBoard.tiles[tile].kind;
  if (
    kind === "start" ||
    kind === "job" ||
    kind === "district" ||
    kind === "metro"
  )
    return "";
  return `${kind === "story" ? "主線故事" : kind === "game" ? "小遊戲" : chenxiTileLabels[kind]}之後開放`;
}
