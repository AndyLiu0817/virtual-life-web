import { expect, test, type Page } from "@playwright/test";
import { enterChenxi } from "../../src/game/chenxi";
import { createSave, type Save } from "../../src/game/saves";

const slot = "virtual-life-web:v3:slot:0";
const debugSlot = `${slot}:debug-chenxi`;
const player = createSave({
  name: "小晴",
  gender: "girl",
  birthday: { month: 5, day: 13 },
  bloodType: "A",
});
const city = enterChenxi({
  ...player,
  stage: "graduated",
  education: "university",
  ending: "universityGraduate",
  cash: 70000,
});
const prompt = (page: Page) => page.locator(".board-dialog:not(.chenxi-tree)");
const confirm = (page: Page) =>
  prompt(page).getByRole("button", { name: "確定", exact: true }).click();

async function menu(page: Page, option: string) {
  const trigger = page.locator("[aria-controls=hud-menu]:visible").first();
  await trigger.click();
  await page.getByRole("button", { name: option, exact: true }).click();
}

async function saved(page: Page, key = slot): Promise<Save> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
}
async function load(page: Page, save: Save, debug = "") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(save));
      Math.random = () => 0;
    },
    { key: slot, save },
  );
  await page.goto(debug ? `/?debug=${debug}` : "/");
  await page.getByRole("button", { name: "繼續遊戲" }).click();
  await page.locator("#use-0").click();
}

for (const [direction, viewport] of [
  ["landscape", { width: 1280, height: 800 }],
  ["portrait", { width: 390, height: 844 }],
] as const) {
  test.describe(`晨曦市 ${direction}`, () => {
    test.use({ viewport });

    test("全圖、跟隨鏡頭、職業、購地、加蓋、捷運、提醒與安全樁格", async ({
      page,
    }) => {
      test.setTimeout(90000);
      const capture = async (scene: string, walking = false) => {
        const path = process.env.CHENXI_SCREENSHOTS;
        if (path)
          await page.screenshot({
            path: `${path}/${scene}-${direction}.jpg`,
            type: "jpeg",
            quality: 87,
            animations: walking ? "allow" : "disabled",
          });
      };
      await page.addInitScript(() => {
        Math.random = () => 0;
      });
      await page.goto("/?debug=chenxi");
      await page.getByRole("button", { name: "除錯：前往晨曦市" }).click();
      await expect(prompt(page)).toContainText("開場劇情之後開放");
      await confirm(page);
      const world = page.locator(".board-world");
      const zoom = () =>
        world.evaluate((world) =>
          Number(getComputedStyle(world).getPropertyValue("--board-zoom")),
        );
      await expect.poll(zoom).toBe(direction === "portrait" ? 2.3 : 1);
      if (direction === "portrait") await menu(page, "看全圖");
      await expect.poll(zoom).toBe(1);
      await expect(page.locator(".board-tile")).toHaveCount(48);
      await expect(page.locator(".board-world picture img")).toHaveJSProperty(
        "complete",
        true,
      );
      await capture("03-full-map");

      await page.locator("#roll").click();
      await expect.poll(zoom, { intervals: [25, 50] }).toBeGreaterThan(2.13);
      await capture("04-follow-walk", true);
      await expect(prompt(page)).toContainText("實習生・薪水 2,000 元");
      await capture("05-salary");
      await page.getByRole("button", { name: "轉職", exact: true }).click();
      await page.getByRole("button", { name: "保全", exact: true }).click();
      await confirm(page);
      await expect(page.locator(".hud-stage")).toHaveText("保全員");
      expect((await saved(page, debugSlot)).cash).toBe(202000);
      expect(await saved(page)).toBeNull();

      await menu(page, "轉職樹");
      const tree = page.getByRole("dialog", { name: "晨曦市轉職樹" });
      await expect(tree.locator("li")).toHaveCount(42);
      await expect(tree.getByText("之後開放", { exact: true })).toHaveCount(9);
      await capture("06-job-tree");
      await tree.getByRole("button", { name: "關閉" }).click();

      await menu(page, "跳到無主街區");
      await expect(prompt(page)).toContainText("晨光西町一");
      await capture("07-buy-district");
      await page.getByRole("button", { name: "買下", exact: true }).click();
      await confirm(page);
      await menu(page, "跳到自己的街區");
      await expect(prompt(page)).toContainText("加蓋需要 20,000 元");
      await capture("08-upgrade-district");
      await page.getByRole("button", { name: "加蓋", exact: true }).click();
      await confirm(page);
      await expect
        .poll(
          async () => (await saved(page, debugSlot)).chenxi.districts[1]?.level,
        )
        .toBe(2);

      await menu(page, "跳到捷運");
      await expect(prompt(page)).toContainText("要搭捷運前往天星站嗎？");
      await capture("09-metro");
      await page.getByRole("button", { name: "前往", exact: true }).click();
      await expect
        .poll(async () => (await saved(page, debugSlot)).boardTile)
        .toBe(37);
      await expect(prompt(page)).toBeHidden();

      const before = await saved(page, debugSlot);
      await menu(page, "跳到主線故事格");
      await expect(prompt(page)).toContainText("主線故事之後開放");
      await capture("11-story-placeholder");
      await confirm(page);
      await expect
        .poll(async () => (await saved(page, debugSlot)).turn)
        .toBe(before.turn + 1);
      expect(await saved(page, debugSlot)).toMatchObject({
        stats: before.stats,
        cash: before.cash,
        chenxi: before.chenxi,
        cards: before.cards,
        storyFragments: before.storyFragments,
      });

      await menu(page, "下一回提醒剩 10 回");
      await expect(prompt(page)).toContainText("剩下 10 回");
      await expect(prompt(page)).toContainText(
        "職級還差 1、街區還差 2、父親線索還差 3",
      );
      await capture("10-ten-turn-warning");
      await confirm(page);
      await menu(page, "下一回提醒剩 5 回");
      await expect(prompt(page)).toContainText("剩下 5 回");
      await confirm(page);
      await menu(page, "下一回結束第 60 回");
      await expect(prompt(page)).toContainText("回合已用盡，失敗結局之後開放");
      await confirm(page);
      await expect(page.locator("#roll")).toBeDisabled();
      expect(await saved(page, debugSlot)).toMatchObject({
        turn: 60,
        chenxiStart: { turn: 0, boardTile: 0 },
      });
    });
  });
}

test("落榜讀檔保留高中學歷、同格重載並標記職業鎖定", async ({ page }) => {
  await load(page, {
    ...city,
    education: "high",
    ending: "universityExamFail",
    boardTile: 37,
  });
  await confirm(page);
  await page.reload();
  await page.getByRole("button", { name: "繼續遊戲" }).click();
  await page.locator("#use-0").click();
  await expect(page.getByRole("heading", { name: "晨曦市棋盤" })).toBeVisible();
  expect(await saved(page)).toMatchObject({ education: "high", boardTile: 37 });
  await menu(page, "轉職樹");
  await expect(
    page.getByText("聯考未錄取，此為知識型職業", { exact: true }),
  ).toHaveCount(18);
});

test("空服員轉乘後多走 2 格，職業格照常發薪", async ({ page }) => {
  await load(page, {
    ...city,
    boardTile: 7,
    chenxi: { ...city.chenxi, job: "空服員", introSeen: true },
  });
  await page.locator("#roll").click();
  await expect(prompt(page)).toContainText("西町站");
  await page.getByRole("button", { name: "前往", exact: true }).click();
  await page.getByRole("button", { name: "走 2 格", exact: true }).click();
  await expect(prompt(page)).toContainText("空服員・薪水 6,000 元");
  await page.getByRole("button", { name: "不轉職、看升遷" }).click();
  await confirm(page);
  await expect.poll(async () => (await saved(page)).boardTile).toBe(39);
  expect(await saved(page)).toMatchObject({
    cash: 76000,
    turn: 1,
    chenxi: { jobLevel: 2 },
  });
});

for (const debug of ["path", "road"]) {
  test(`除錯 ${debug} 顯示道路向量並選擇對應底圖`, async ({ page }) => {
    await load(
      page,
      { ...city, chenxi: { ...city.chenxi, introSeen: true } },
      debug,
    );
    await expect(page.locator(".road-centerline")).toHaveCount(1);
    await expect(page.locator(".board-world picture img")).toHaveAttribute(
      "src",
      new RegExp(
        debug === "road"
          ? "placeholder_landscape"
          : "placeholder_noroad_landscape",
      ),
    );
  });
}

test("舊版聯考落榜存檔從結局進入晨曦市（橫向）", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await load(page, {
    ...player,
    stage: "earlyExit",
    education: "high",
    ending: "universityExamFail",
    hiddenJobUnlock: true,
  });
  await expect(page.getByRole("heading", { name: "聯考落榜" })).toBeVisible();
  const path = process.env.CHENXI_SCREENSHOTS;
  if (path)
    await page.screenshot({
      path: `${path}/02-exam-fail-entry-landscape.jpg`,
      type: "jpeg",
      quality: 87,
    });
  await page.getByRole("button", { name: "前往晨曦市" }).click();
  await confirm(page);
  await expect(page.getByRole("heading", { name: "晨曦市棋盤" })).toBeVisible();
  await expect
    .poll(async () => (await saved(page)).chenxi.introSeen)
    .toBe(true);
  expect(await saved(page)).toMatchObject({
    education: "high",
    ending: "universityExamFail",
    stage: "chenxi",
  });
});
