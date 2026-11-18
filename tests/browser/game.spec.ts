import { test, expect } from "@playwright/test";
async function create(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "開啟我的人生", exact: false })
    .click();
  await page.locator('input[name="name"]').fill("小橙");
  await page
    .getByRole("button", { name: "開啟我的人生", exact: false })
    .click();
}
test("create character, play, save, reload, import and export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await create(page);
  await expect(page.locator(".player-badge")).toContainText("小橙");
  await page.getByRole("button", { name: "略過教學" }).click();
  await page.getByRole("button", { name: /研習社 ·/ }).click();
  await page.getByRole("button", { name: /擲出下一步/ }).click();
  await page.getByRole("button", { name: "存檔與進度" }).click();
  await page.getByRole("button", { name: "儲存", exact: true }).first().click();
  await expect(page.locator(".save-slot").nth(1)).toContainText("小橙");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "匯出目前進度" }).click();
  expect((await download).suggestedFilename()).toMatch(/virtual-life-1.json/);
  await page.reload();
  await page.getByRole("button", { name: "繼續旅程" }).click();
  await expect(page.locator(".player-badge")).toContainText("小橙");
  await page.getByRole("button", { name: "存檔與進度" }).click();
  await page.locator("#import-file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.locator(".toast")).toContainText("無法讀取");
  expect(errors).toEqual([]);
});
for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1280, height: 800 },
  { width: 320, height: 568 },
])
  test(`no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await create(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "略過教學" }).click();
    await page.getByRole("button", { name: /研習社 ·/ }).click();
    await expect(page.locator(".stat")).toHaveCount(4);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `work/game-${viewport.width}.png`,
      fullPage: true,
    });
  });
test("all eight practice games mount and release handlers", async ({
  page,
}) => {
  await create(page);
  await page.getByRole("button", { name: /小遊戲練習室/ }).click();
  const names = [
    "準心射擊",
    "節奏拍擊",
    "記憶翻牌",
    "打地鼠",
    "找不同",
    "接水果",
    "數字快算",
    "疊疊樂",
  ];
  for (const name of names) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByRole("button", { name: "開始這一局" }).click();
    await expect(page.locator(".playfield")).toBeVisible();
    await page.getByRole("button", { name: "離開練習" }).click();
  }
});

test("eight minigames can be completed through their real controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.7;
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await create(page);
  await page.getByRole("button", { name: /小遊戲練習室/ }).click();
  const names = [
    "準心射擊",
    "節奏拍擊",
    "記憶翻牌",
    "打地鼠",
    "找不同",
    "接水果",
    "數字快算",
    "疊疊樂",
  ];
  for (let id = 0; id < names.length; id++) {
    await page.getByRole("button", { name: names[id], exact: true }).click();
    await page.getByRole("button", { name: "開始這一局" }).click();
    if (id === 0)
      for (let i = 0; i < 8; i++) {
        await page.clock.runFor(900);
        await page.locator("[data-hit]").click({ force: true });
      }
    if (id === 1) {
      await page.clock.runFor(350);
      for (let i = 0; i < 10; i++) {
        await page.locator("[data-beat-tap]").click();
        await page.clock.runFor(700);
      }
    }
    if (id === 2)
      for (let i = 0; i < 4; i++) {
        await page.locator(`[data-card="${i}"]`).click();
        await page.locator(`[data-card="${i + 4}"]`).click();
      }
    if (id === 3)
      for (let i = 0; i < 9; i++) {
        await page.clock.runFor(900);
        await page.locator(".active-mole").click();
      }
    if (id === 4)
      for (const i of [1, 5, 8])
        await page.locator(`[data-diff="${i}"]`).click();
    if (id === 5) {
      await page.locator("[data-right]").click();
      await page.clock.runFor(12000);
    }
    if (id === 6)
      for (let i = 0; i < 8; i++) {
        const equation = await page.locator(".equation").innerText();
        const nums = equation.match(/\d+/g)!.map(Number);
        await page.locator(`[data-answer="${nums[0] + nums[1]}"]`).click();
      }
    if (id === 7) {
      await page.locator("[data-drop]").click();
      for (let i = 0; i < 5; i++) {
        await page.clock.runFor(1351);
        await page.locator("[data-drop]").click();
      }
    }
    await page.clock.runFor(13000);
    await expect(page.locator(".modal .feedback"), names[id]).toContainText(
      "過關",
    );
    await page.getByRole("button", { name: "離開練習" }).click();
  }
});
