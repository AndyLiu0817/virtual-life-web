import { describe, expect, it } from "vitest";
import { paverClearance } from "../src/board-clearance";
import { measureTrack } from "../src/board-track";
import { chenxiBoard, districts } from "../src/data/chenxi-board";
import { freshman, jobByName, jobs } from "../src/data/chenxi-jobs";
import {
  canRollChenxi,
  changeJob,
  chenxiStep,
  enterChenxi,
  finishChenxiTurn,
  forcedPurchase,
  invest,
  jobRestriction,
  paySalary,
  payToll,
  promotion,
  propertyCost,
  rideMetro,
  salary,
  stubNotice,
  toll,
} from "../src/game/chenxi";
import {
  createSave,
  exportSave,
  importSave,
  type Save,
} from "../src/game/saves";

const graduate: Save = {
  ...createSave({
    name: "晨曦旅人",
    gender: "girl",
    birthday: { month: 3, day: 21 },
    bloodType: "A",
  }),
  stage: "graduated",
  education: "university",
  ending: "universityGraduate",
  turn: 40,
  boardTile: 20,
  previousTile: 19,
  nextTile: 21,
  cash: 200000,
  stats: { morality: 500, fitness: 500, intellect: 500, charm: 500 },
  cards: ["旅行紀念"],
  partner: "friend",
  dating: true,
  affection: 80,
  metPartners: ["friend"],
};
const city = enterChenxi(graduate);
const employed = (
  job: string,
  jobLevel: Save["chenxi"]["jobLevel"] = 1,
): Save => ({ ...city, chenxi: { ...city.chenxi, job, jobLevel } });

describe("晨曦市棋盤", () => {
  it("48 格依指定順序閉合，接縫對位、只在路面且避開景物", () => {
    const kinds = chenxiBoard.tiles.map(({ kind }) => kind);
    expect(kinds).toEqual(
      "start district job event district love card district lot metro story district job game district shop battle district event district battle card district story lot district battle game district job love district event battle district shop card metro district job story district lot battle district game event battle".split(
        " ",
      ),
    );
    chenxiBoard.tiles.forEach(({ next }, i) =>
      expect(next).toEqual([(i + 1) % 48]),
    );
    for (const layout of Object.values(chenxiBoard.layouts)) {
      expect(layout.cells).toHaveLength(48);
      expect(new Set(layout.cells.map(String)).size).toBe(48);
      const vectors = layout.cells.map(([x, y], i) => {
        const [nx, ny] = layout.cells[(i + 1) % 48];
        expect(Math.abs(x - nx) + Math.abs(y - ny)).toBe(1);
        return [nx - x, ny - y];
      });
      vectors.forEach(([x, y], i) => {
        const [nx, ny] = vectors[(i + 1) % 48];
        expect([0, 1]).toContain(x * nx + y * ny);
      });
      const track = measureTrack(layout);
      for (const { x, y } of track.centers) {
        expect(x).toBeGreaterThan(track.faceWidth / 2);
        expect(x).toBeLessThan(layout.width - track.faceWidth / 2);
        expect(y).toBeGreaterThan(track.faceHeight / 2);
        expect(y).toBeLessThan(
          layout.height - track.faceHeight / 2 - track.depth,
        );
      }
      expect(
        paverClearance(layout).filter(
          ({ onRoad, hitsScenery }) => !onRoad || hitsScenery,
        ),
      ).toEqual([]);
    }
  });

  it.each([
    ["graduated", "university", "universityGraduate"],
    ["earlyExit", "high", "universityExamFail"],
  ] as const)(
    "從 %s 讀取舊存檔，保留資料並另存地圖開頭",
    (stage, education, ending) => {
      const { chenxi, chenxiStart, ...legacy } = {
        ...graduate,
        stage,
        education,
        ending,
      };
      const imported = importSave(JSON.stringify(legacy));
      expect(imported).toMatchObject({
        stage,
        education,
        ending,
        chenxi,
        chenxiStart,
      });
      const started = enterChenxi(imported);
      expect(started).toMatchObject({
        stage: "chenxi",
        education,
        ending,
        turn: 0,
        boardTile: 0,
        previousTile: null,
        nextTile: null,
        cash: graduate.cash,
        stats: graduate.stats,
        cards: graduate.cards,
        partner: graduate.partner,
        dating: true,
        affection: 80,
        metPartners: graduate.metPartners,
        chenxi: {
          job: freshman,
          jobLevel: 1,
          history: {},
          districts: {},
          debt: 0,
          clues: 0,
        },
        chenxiStart: { stage: "chenxi", turn: 0, boardTile: 0 },
      });
      expect(importSave(exportSave(started))).toEqual(started);
    },
  );

  it("捷運雙向、沒有學校起點獎金，創業家經過或停下皆領股利", () => {
    const west = { ...city, boardTile: 9, previousTile: 8, nextTile: 10 };
    const east = rideMetro(west);
    expect(east).toMatchObject({
      boardTile: 37,
      previousTile: null,
      nextTile: null,
      turn: 0,
    });
    expect(rideMetro(east).boardTile).toBe(9);
    expect(chenxiStep(east, 1).save.boardTile).toBe(38);
    expect(chenxiStep({ ...city, boardTile: 47 }, 1).reward).toBe(0);
    for (const steps of [1, 2]) {
      const move = chenxiStep(
        { ...employed("創業家", 3), boardTile: 47 },
        steps,
      );
      expect(move.reward).toBe(15000);
      expect(move.save.cash).toBe(city.cash + 15000);
    }
  });

  it("第 60 回後保留存檔並停止，樁格只有提示", () => {
    const final = finishChenxiTurn({ ...city, turn: 59, boardTile: 10 });
    expect(final.turn).toBe(60);
    expect(canRollChenxi(final)).toBe(false);
    expect(finishChenxiTurn(final)).toBe(final);
    expect(importSave(exportSave(final))).toEqual(final);
    for (const tile of [3, 5, 6, 8, 10, 13, 15, 16])
      expect(stubNotice(tile)).toMatch(/之後開放$/);
    expect(final).toMatchObject({
      chenxiStart: city.chenxiStart,
      chenxi: city.chenxi,
      cash: city.cash,
      stats: city.stats,
      cards: city.cards,
      affection: city.affection,
    });
  });
});

describe("晨曦市職業與街區", () => {
  it("按收入、職級與職業加成發薪，升遷機率與上下限正確", () => {
    expect(salary(city)).toBe(2000);
    expect(salary(employed("房仲", 3))).toBe(30000);
    expect(salary(employed("助理", 3))).toBe(13200);
    const middle = employed("助理", 2);
    expect(promotion(middle, 8800, () => 0.4999).save.chenxi.jobLevel).toBe(3);
    expect(promotion(middle, 8800, () => 0.5).result).toBe("same");
    expect(promotion(middle, 8800, () => 0.8).save.chenxi.jobLevel).toBe(1);
    expect(promotion(city, 2000, () => 0.95).result).toBe("same");
    const top = employed("助理", 3);
    expect(promotion(top, salary(top), () => 0.2)).toMatchObject({
      result: "bonus",
      save: { cash: 213200 },
    });
  });

  it("檢查四維、前置職級、同層轉職、落榜鎖定與靈能鎖定", () => {
    const to = (save: Save, name: string) => changeJob(save, jobByName(name));
    expect(
      to({ ...city, stats: { ...city.stats, morality: 499 } }, "保全").chenxi
        .job,
    ).toBe(freshman);
    expect(to(city, "消防員")).toBe(city);
    expect(to(to(city, "護理師"), "消防員").chenxi.job).toBe("消防員");
    expect(to(to(to(city, "廚師"), "業務"), "攝影師").chenxi.job).toBe(
      "攝影師",
    );
    for (const [tier, locked] of [
      [1, 4],
      [2, 6],
      [3, 8],
    ]) {
      const group = jobs.filter((job) => job.tier === tier);
      expect(group.filter(({ examLocked }) => examLocked)).toHaveLength(locked);
      for (const job of group)
        expect(
          jobRestriction(
            { ...city, ending: "universityExamFail" },
            job,
          ).includes("聯考未錄取"),
        ).toBe(job.examLocked);
    }
    const security = {
      ...employed("保全", 3),
      ending: "universityExamFail" as const,
    };
    const demoted = promotion(security, 12000, () => 0.9).save;
    const firefighter = to(demoted, "消防員");
    expect(firefighter.chenxi.history["保全"]).toBe(3);
    expect(to(firefighter, "職業運動員")).toBe(firefighter);
    expect(
      to(
        { ...firefighter, chenxi: { ...firefighter.chenxi, jobLevel: 2 } },
        "職業運動員",
      ).chenxi.job,
    ).toBe("職業運動員");
    expect(jobs).toHaveLength(42);
    for (const job of jobs.filter(({ tier }) => tier >= 4))
      expect(to(city, job.name)).toBe(city);
  });

  it("累加實付地價、各級租金、同區加倍與職業加成", () => {
    for (const { price, tiles } of districts)
      for (const tile of tiles) expect(propertyCost(city, tile)).toBe(price);
    expect(invest({ ...city, cash: 19999 }, 1).chenxi.districts).toEqual({});
    const bought = invest(employed("工程師"), 1);
    expect(bought.chenxi.districts[1]).toMatchObject({
      owner: "player",
      invested: 20000,
      level: 1,
    });
    expect(toll(bought, 1)).toBe(4000);
    expect(
      propertyCost(
        { ...bought, chenxi: { ...bought.chenxi, job: "工程助理" } },
        1,
      ),
    ).toBe(18000);
    const upgraded = invest(bought, 1);
    expect(upgraded.chenxi.districts[1]).toMatchObject({
      invested: 36000,
      level: 2,
    });
    expect(toll(upgraded, 1)).toBe(14400);
    const top = invest(invest(invest(upgraded, 1), 4), 7);
    expect(invest(top, 1)).toBe(top);
    expect(toll(top, 1)).toBe(83200);
    expect(toll(top, 1, "律師", "房仲")).toBe(62400);
    expect(toll(top, 1, "倉管")).toBe(91520);
    const opponent = { owner: "shadow", level: 2, invested: 36000 } as const;
    expect(forcedPurchase(opponent, "player", 72000, true)).toEqual({
      property: opponent,
      price: 0,
    });
    expect(forcedPurchase(opponent, "player", 71999, false)).toEqual({
      property: opponent,
      price: 0,
    });
    expect(forcedPurchase(opponent, "player", 72000, false)).toEqual({
      property: { owner: "player", level: 2, invested: 72000 },
      price: 72000,
    });
  });

  it("付不起先從投入最低的街區開始變賣，薪水先抵債", () => {
    const save = { ...invest(invest(city, 1), 11), cash: 1000 };
    const paid = payToll(save, 21000);
    expect(paid.cash).toBe(0);
    expect(paid.chenxi.districts[1]).toBeUndefined();
    expect(paid.chenxi.districts[11]).toBeDefined();
    const debt = payToll(save, 50000);
    expect(debt.chenxi.districts).toEqual({});
    expect(debt.chenxi.debt).toBe(5000);
    expect(paySalary(debt)).toMatchObject({
      repaid: 2000,
      received: 0,
      save: { chenxi: { debt: 3000 } },
    });
    expect(
      paySalary({
        ...debt,
        chenxi: { ...debt.chenxi, job: "會計師", debt: 1200 },
      }),
    ).toMatchObject({
      repaid: 1200,
      received: 9000,
      save: { chenxi: { debt: 0 } },
    });
  });
});
