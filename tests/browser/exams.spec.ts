import { expect, test, type Page } from "@playwright/test";
import { chooseClub } from "../../src/game/clubs";
import { createSave, type Save } from "../../src/game/saves";
import { questionBank } from "../../src/game/questions";

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

async function seed(page: Page, save: Save) {
  await page.goto("/");
  await page.evaluate(
    ([key, data]) => localStorage.setItem(key, JSON.stringify(data)),
    [slot, save] as const,
  );
  await page.reload();
  await load(page);
}

async function load(page: Page) {
  await page.getByRole("button", { name: "繼續遊戲" }).click();
  await page.locator("#use-0").click();
}

async function readSave(page: Page): Promise<Save> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), slot);
}

async function answer(page: Page, correct: boolean) {
  const prompt = await page.locator(".assessment-question").textContent();
  const question = questionBank.find((item) => item.prompt === prompt)!;
  const index = question.options.findIndex(
    (option) => option.correct === correct,
  );
  await page.locator(".assessment-option").nth(index).click();
}

async function capture(page: Page, file: string) {
  if (process.env.EXAM_SCREENSHOTS) {
    await expect
      .poll(() =>
        page
          .locator(".assessment img, .assessment-result img")
          .evaluateAll((images) =>
            images.every(
              (image) => (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    await page.screenshot({
      path: `${process.env.EXAM_SCREENSHOTS}/${file}.jpg`,
      type: "jpeg",
      quality: 88,
    });
  }
}

test("直式小考可觸控作答，結算獎勵和已出題目會存檔", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Math.random = () => 0.1;
  });
  await seed(page, { ...player, boardTile: 3, previousTile: 2 });
  await page.getByRole("button", { name: "擲骰" }).click();
  await page.getByRole("button", { name: /沿外圈/ }).click();
  await expect(
    page.getByRole("heading", { name: "小考", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".assessment-meta")).toContainText("第 1 ／ 5 題");
  await expect(page.getByRole("button", { name: "智力輔助" })).toHaveCount(0);
  expect(
    (await page.locator(".assessment-option").first().boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
  await capture(page, "quiz-portrait");
  for (let index = 0; index < 5; index++) await answer(page, true);
  await expect(page.getByRole("dialog")).toContainText(
    "答對 5 ／ 5 題・智力 ＋25・現金 ＋500 元",
  );
  await page.getByRole("button", { name: "確定" }).click();
  await expect(page.getByRole("status")).toContainText("已自動存檔");
  const save = await readSave(page);
  expect(save.exams).toEqual([{ id: "quiz", correct: 5 }]);
  expect(save.seenQuestionIds).toHaveLength(5);
  expect(save.stats.intellect).toBe(player.stats.intellect + 25);
  expect(save.cash).toBe(player.cash + 500);
});

test("橫式升學考輔助只排除錯誤選項，重整後接續並可錄取", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 650 });
  await page.addInitScript(() => {
    Math.random = () => 0.4;
  });
  const seenQuestionIds = questionBank.slice(0, 5).map(({ id }) => id);
  await seed(page, {
    ...player,
    turn: 15,
    stats: { ...player.stats, intellect: 220 },
    seenQuestionIds,
  });
  await expect(page.locator(".assessment-help")).toContainText("剩餘 2 次");
  const attempt = (await readSave(page)).entranceAttempt!;
  expect(attempt.items.every(({ id }) => !seenQuestionIds.includes(id))).toBe(
    true,
  );
  await page.getByRole("button", { name: "智力輔助" }).click();
  const removed = page.getByRole("button", { name: /已排除/ });
  await expect(removed).toBeDisabled();
  await expect(page.locator(".assessment-help")).toContainText("剩餘 1 次");
  await capture(page, "exam-assist-landscape");
  await page.reload();
  await load(page);
  await expect(removed).toBeDisabled();
  await expect(page.locator(".assessment-help")).toContainText("剩餘 1 次");
  for (let index = 0; index < 10; index++) await answer(page, index < 6);
  await expect(page.getByRole("heading", { name: "錄取！" })).toBeVisible();
  await expect(page.getByText("答對 6 ／ 10 題・錄取門檻 6 題")).toBeVisible();
  await capture(page, "exam-pass");
  await page.reload();
  await load(page);
  await page.getByRole("button", { name: "前往高中篇" }).click();
  await expect(page.getByRole("heading", { name: "升上高中" })).toBeVisible();
  const save = await readSave(page);
  expect(save).toMatchObject({
    stage: "high",
    education: "junior",
    entranceAttempt: null,
    examResultPending: false,
  });
  expect(save.exams).toEqual([{ id: "highEntrance", correct: 6 }]);
  expect(save.seenQuestionIds).toHaveLength(15);
});

test("升學考未錄取，回標題後讀檔仍是提前出社會結局", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 650 });
  await page.addInitScript(() => {
    Math.random = () => 0.4;
  });
  await seed(page, {
    ...player,
    turn: 15,
    stats: { ...player.stats, intellect: 99 },
  });
  await expect(page.getByRole("button", { name: "智力輔助" })).toBeDisabled();
  for (let index = 0; index < 10; index++) await answer(page, index < 5);
  await expect(page.getByRole("heading", { name: "未錄取" })).toBeVisible();
  await expect(page.getByText("答對 5 ／ 10 題・錄取門檻 6 題")).toBeVisible();
  await page.getByRole("button", { name: "查看結局" }).click();
  const ending = page.getByRole("heading", { name: "提前出社會" });
  await expect(ending).toBeVisible();
  await capture(page, "early-exit");
  await page.getByRole("button", { name: "回標題" }).click();
  await load(page);
  await expect(ending).toBeVisible();
  expect(await readSave(page)).toMatchObject({
    stage: "earlyExit",
    education: "junior",
    hiddenJobUnlock: false,
    exams: [{ id: "highEntrance", correct: 5 }],
  });
});
