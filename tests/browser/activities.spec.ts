import { expect, test, type Page } from "@playwright/test";
import { chooseClub } from "../../src/game/clubs";
import { questionBank } from "../../src/game/questions";
import { createSave, type Save } from "../../src/game/saves";

const slot = "virtual-life-web:v3:slot:0";
const player = chooseClub(
  createSave({
    name: "小晴",
    gender: "girl",
    birthday: { month: 5, day: 13 },
    bloodType: "A",
  }),
  "junior",
  "study",
);

async function seed(page: Page, data: Partial<Save>) {
  await page.evaluate(
    ([key, save]) => localStorage.setItem(key, JSON.stringify(save)),
    [slot, { ...player, ...data }] as const,
  );
}

async function readSave(page: Page): Promise<Save> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), slot);
}

async function continueGame(page: Page) {
  await page.getByRole("button", { name: "繼續遊戲" }).click();
  await page.locator("#use-0").click();
}

async function capture(page: Page, name: string) {
  const directory = process.env.ACTIVITY_SCREENSHOTS;
  if (!directory) return;
  await page
    .locator("dialog:modal img")
    .evaluateAll((images) =>
      Promise.all(images.map((img) => (img as HTMLImageElement).decode())),
    );
  await page.screenshot({ path: `${directory}/${name}.jpg`, quality: 86 });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Math.random = () => 0.08;
  });
  await page.setViewportSize({ width: 1080, height: 664 });
});

test("直向必選社團，橫向造訪領獎並更新存檔", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "開始新人生" }).click();
  await page.getByLabel("名字").fill("小晴");
  await page.getByRole("button", { name: "查看開局結果" }).click();
  await page.getByRole("button", { name: "確認開局" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "國中選社" })).toBeVisible();
  await expect(dialog.getByRole("button")).toHaveCount(8);
  await expect(
    dialog.getByRole("button", { name: /研習社 主 智力 ／ 副 道德/ }),
  ).toBeVisible();
  await expect(page.locator("#roll")).toBeDisabled();
  await expect(dialog.locator(".event-npc")).toHaveAttribute(
    "src",
    /senior-girl/,
  );
  for (const button of await dialog.getByRole("button").all()) {
    await expect(button).toBeInViewport({ ratio: 1 });
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await capture(page, "club-choice-portrait");
  await dialog.getByRole("button", { name: /研習社/ }).click();
  await expect(page.locator("#roll")).toBeEnabled();
  expect((await readSave(page)).clubHistory).toEqual([
    { stage: "junior", clubId: "study", visits: 0 },
  ]);

  await seed(page, { boardTile: 1, previousTile: 0 });
  await page.setViewportSize({ width: 1080, height: 664 });
  await page.reload();
  await continueGame(page);
  await page.locator("#roll").click();
  await expect(dialog).toContainText("智力 ＋12・道德 ＋6");
  await expect(dialog).toContainText("現金 ＋200 元");
  await expect(dialog.locator(".event-background")).toHaveAttribute(
    "src",
    /event_clubroom/,
  );
  await capture(page, "club-visit-landscape");
  await dialog.getByRole("button", { name: "確定" }).click();
  await expect(page.locator("#roll")).toBeEnabled();
  const save = await readSave(page);
  expect(save.clubHistory[0].visits).toBe(1);
  expect(save.cash).toBe(player.cash + 200);
  await seed(page, { ...save, boardTile: 1, previousTile: 0 });
  await page.reload();
  await continueGame(page);
  await page.locator("#roll").click();
  await expect(dialog.locator(".event-background")).toHaveAttribute(
    "src",
    /event_field/,
  );
});

test("回合 8 在擲骰前選項目、揭曉穿搭並發放護心獅加成", async ({ page }) => {
  await page.goto("/");
  await seed(page, {
    turn: 6,
    stats: { ...player.stats, charm: 200 },
    deity: { id: "guard-lion", remainingTurns: 2 },
  });
  await continueGame(page);
  const dialog = page.getByRole("dialog");
  const roll = page.locator("#roll");
  await expect(dialog).toHaveCount(0);
  await roll.click();
  await dialog.getByRole("button", { name: "確定" }).click();
  await expect(
    dialog.getByRole("heading", { name: "虛擬城大賽" }),
  ).toBeVisible();
  await expect(dialog.locator(".event-background")).toHaveAttribute(
    "src",
    /event_auditorium/,
  );
  await expect(dialog.locator(".event-npc")).toHaveAttribute("src", /host/);
  await expect(roll).toBeDisabled();
  await expect(page.locator(".board-status")).toContainText("8 ／ 15");
  await expect(dialog.getByRole("button")).toHaveCount(3);
  await capture(page, "contest-choice");
  await dialog.getByRole("button", { name: /風采秀/ }).click();
  await expect(
    dialog.getByRole("heading", { name: "風采秀・挑選穿搭" }),
  ).toBeVisible();
  await expect(dialog.getByRole("button")).toHaveCount(3);
  await expect(dialog.locator("button")).not.toContainText([/＋/]);
  await capture(page, "contest-outfits");
  await dialog.getByRole("button", { name: /晴天郵差/ }).click();
  await expect(
    dialog.getByRole("heading", { name: "風采秀・冠軍" }),
  ).toBeVisible();
  await expect(dialog).toContainText("穿搭 ＋20 分");
  await expect(dialog).toContainText("成績 220 分");
  await expect(dialog).toContainText("冠軍線 172.44 分");
  await expect(dialog).toContainText("現金 ＋5,400 元・魅力 ＋72");
  await capture(page, "contest-result");
  await dialog.getByRole("button", { name: "確定" }).click();
  await expect(roll).toBeEnabled();
  const save = await readSave(page);
  expect(save).toMatchObject({
    turn: 7,
    cash: 10400,
    competitions: [
      { stage: "junior", matchNumber: 1, event: "style", score: 220, rank: 1 },
    ],
  });
  await page.reload();
  await continueGame(page);
  await expect(roll).toBeEnabled();
  await expect(dialog).toHaveCount(0);
});

test("提前搶答存十題與用時，取消第 8 回合大賽，回到大賽格可觀賽", async ({
  page,
}) => {
  await page.goto("/");
  await seed(page, { boardTile: 19, previousTile: 8 });
  await continueGame(page);
  const dialog = page.getByRole("dialog");
  await page.locator("#roll").click();
  await expect(dialog).toContainText("提前抵達");
  await dialog.getByRole("button", { name: /智囊搶答/ }).click();
  await expect(dialog.getByRole("heading", { name: "智囊搶答" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "智力輔助" })).toHaveCount(0);
  for (let i = 0; i < 10; i++) {
    await expect(dialog.locator(".assessment-meta")).toContainText(
      `第 ${i + 1} ／ 10 題`,
    );
    const prompt = await dialog.locator(".assessment-question").textContent();
    const question = questionBank.find((item) => item.prompt === prompt)!;
    const index = question.options.findIndex(({ correct }) => correct);
    await dialog.locator(".assessment-option").nth(index).click();
  }
  await expect(dialog).toContainText("作答用時");
  await expect(dialog).toContainText("成績 10 題");
  await dialog.getByRole("button", { name: "確定" }).click();
  await expect(page.locator("#roll")).toBeEnabled();
  const save = await readSave(page);
  expect(save.seenQuestionIds).toHaveLength(10);
  expect(save.competitions).toEqual([
    {
      stage: "junior",
      matchNumber: 1,
      event: "trivia",
      score: 10,
      rank: 1,
      elapsedMs: expect.any(Number),
    },
  ]);
  await seed(page, { ...save, turn: 7, boardTile: 19, previousTile: 8 });
  await page.reload();
  await continueGame(page);
  await expect(dialog).toHaveCount(0);
  await page.locator("#roll").click();
  await expect(dialog.getByRole("heading", { name: "大賽觀賽" })).toBeVisible();
  await dialog.getByRole("button", { name: "確定" }).click();
  await expect(page.locator("#roll")).toBeEnabled();
  expect((await readSave(page)).competitions).toEqual(save.competitions);
});

test("衝刺擂台亮拍時才能得分，同一拍重複點擊只計一次", async ({ page }) => {
  await page.goto("/");
  await seed(page, { turn: 7 });
  await continueGame(page);
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /衝刺擂台/ }).click();
  await expect(dialog.locator(".event-background")).toHaveAttribute(
    "src",
    /mg_rhythm_bg/,
  );
  await expect(dialog.locator(".rhythm-note")).toHaveCSS(
    "background-image",
    /mg_rhythm_sheet/,
  );
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const tap = dialog.locator(".rhythm-tap");
  const press = () =>
    tap.evaluate((button: HTMLButtonElement) => button.click());
  await press();
  await press();
  for (let i = 0; i < 7; i++) {
    await page.clock.runFor(700);
    await expect(tap).toHaveClass(/on-beat/);
    await press();
    await press();
  }
  await page.clock.runFor(1000);
  await page.clock.resume();
  await expect(dialog).toContainText("成績 87.5%");
  await dialog.getByRole("button", { name: "確定" }).click();
  await expect(page.locator("#roll")).toBeEnabled();
  expect((await readSave(page)).competitions[0]).toMatchObject({
    event: "rhythm",
    score: 87.5,
    rank: 1,
  });
});
