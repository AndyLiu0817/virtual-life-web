import { describe, expect, it } from "vitest";
import {
  calculateOpening,
  clampStat,
  isBirthday,
  zodiacFor,
} from "../src/game/opening";

describe("開局加成", () => {
  it("四維各從 80 起算並疊加星座、血型及出生季節，現金固定為 5000", () => {
    const opening = calculateOpening({ month: 11, day: 1 }, "AB");
    expect(opening).toMatchObject({
      zodiac: "天蠍",
      season: "秋季",
      cash: 5000,
      stats: { intellect: 140, morality: 80, charm: 105, fitness: 80 },
      bonuses: [
        {
          source: "天蠍座",
          entries: [
            ["intellect", 30],
            ["charm", 15],
          ],
        },
        {
          source: "AB 型",
          entries: [
            ["intellect", 20],
            ["charm", 10],
          ],
        },
        { source: "秋季", entries: [["intellect", 10]] },
      ],
    });
  });
  it.each([
    [1, 19, "摩羯"],
    [1, 20, "水瓶"],
    [2, 19, "雙魚"],
    [3, 21, "牡羊"],
    [4, 20, "金牛"],
    [5, 21, "雙子"],
    [6, 22, "巨蟹"],
    [7, 23, "獅子"],
    [8, 23, "處女"],
    [9, 23, "天秤"],
    [10, 24, "天蠍"],
    [11, 23, "射手"],
    [12, 22, "摩羯"],
  ] as const)("%i 月 %i 日屬於 %s 座", (month, day, zodiac) => {
    expect(zodiacFor({ month, day })[0]).toBe(zodiac);
  });
  it("接受閏日、拒絕無效日期並限制四維範圍", () => {
    expect(isBirthday({ month: 2, day: 29 })).toBe(true);
    expect(() => calculateOpening({ month: 2, day: 30 }, "A")).toThrow();
    expect([-1, 80, 10000].map(clampStat)).toEqual([0, 80, 9999]);
  });
});
