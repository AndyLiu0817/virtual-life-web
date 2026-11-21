import { expect, test, type Page } from "@playwright/test";
import { chooseClub } from "../../src/game/clubs";
import { createSave, type Save } from "../../src/game/saves";
import { schoolBoards } from "../../src/data/school-board";
import { questionsById, startAssessment } from "../../src/game/questions";

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

async function seed(page: Page, save: unknown) {
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
  const question = [...questionsById.values()].find(
    (item) => item.prompt === prompt,
  )!;
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

const high = chooseClub(
  {
    ...player,
    stage: "high",
    education: "junior",
    stageIntroSeen: ["high"],
  },
  "high",
  "study",
);

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`高中學測可存讀檔，放榜後續讀高三並參加聯考（${viewport.width}）`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await seed(page, {
      ...high,
      turn: 16,
      stats: { ...high.stats, intellect: 220 },
    });
    await expect(
      page.getByRole("heading", { name: "高中學測", exact: true }),
    ).toBeVisible();
    const original = (await readSave(page)).entranceAttempt!;
    expect(original.items.every(({ id }) => id.startsWith("gsat-"))).toBe(true);
    await answer(page, true);
    await page.getByRole("button", { name: "智力輔助" }).click();
    await page.reload();
    await load(page);
    await expect(page.locator(".assessment-meta")).toContainText(
      "第 2 ／ 10 題",
    );
    await expect(page.getByRole("button", { name: /已排除/ })).toBeDisabled();
    const resumed = (await readSave(page)).entranceAttempt!;
    expect(resumed.items.map(({ id }) => id)).toEqual(
      original.items.map(({ id }) => id),
    );
    const correct = viewport.width === 390 ? 5 : 6;
    for (let index = 1; index < 10; index++)
      await answer(page, index < correct);
    await expect(
      page.getByRole("heading", { name: "高中學測放榜" }),
    ).toBeVisible();
    await expect(
      page.getByText(`答對 ${correct} ／ 10 題・通過門檻 6 題`),
    ).toBeVisible();
    await page.reload();
    await load(page);
    await page
      .getByRole("button", { name: "繼續前往高三、仍須參加大學聯考" })
      .click();
    await expect(page.locator(".hud-turn")).toContainText("17 ／ 25");
    const after = await readSave(page);
    expect(after).toMatchObject({
      stage: "high",
      turn: 16,
      ending: null,
      examResultPending: false,
      exams: [{ id: "gsat", correct }],
    });

    await seed(page, { ...after, turn: 25 });
    await page.getByRole("button", { name: "繼續前進" }).click();
    await expect(
      page.getByRole("heading", { name: "大學聯考", exact: true }),
    ).toBeVisible();
    expect(
      (await readSave(page)).entranceAttempt!.items.every(({ id }) =>
        id.startsWith("joint-"),
      ),
    ).toBe(true);
    for (let index = 0; index < 10; index++)
      await answer(page, index < correct);
    await expect(
      page.getByRole("heading", { name: "大學聯考放榜" }),
    ).toBeVisible();
    if (correct === 5) {
      await page.getByRole("button", { name: "查看結局" }).click();
      await expect(
        page.getByRole("heading", { name: "聯考落榜" }),
      ).toBeVisible();
      expect(await readSave(page)).toMatchObject({
        ending: "universityExamFail",
        hiddenJobUnlock: true,
      });
    } else {
      await page.getByRole("button", { name: "前往大學篇" }).click();
      await expect(
        page.getByRole("heading", { name: "進入大學" }),
      ).toBeVisible();
    }
  });
}

test("高中第 16 回踩到故事格會先讀故事，再進學測", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Math.random = () => 0.1;
  });
  const tile = schoolBoards.high.tiles.findIndex(
    ({ kind }) => kind === "story",
  );
  await seed(page, {
    ...high,
    turn: 15,
    retrogradeTurns: 1,
    boardTile: tile - 1,
    previousTile: null,
    competitions: [
      { stage: "high", matchNumber: 1, event: "style", score: 300, rank: 1 },
    ],
  });
  await page.locator("#roll").click();
  const story = page
    .getByRole("dialog")
    .filter({ hasText: "主線故事・高中 1／6" });
  await expect(story).toBeVisible();
  await story.getByRole("button", { name: "繼續" }).click();
  await expect(
    page.getByRole("heading", { name: "高中學測", exact: true }),
  ).toBeVisible();
  expect(await readSave(page)).toMatchObject({
    turn: 16,
    storyTilesUsed: [{ stage: "high", tile }],
    entranceAttempt: { kind: "gsat" },
  });
});

test("讀取舊國中落榜存檔會接到高中第 1 回", async ({ page }) => {
  const old = {
    ...player,
    stage: "earlyExit",
    ending: "juniorEarlyExit",
    turn: 15,
    education: "junior",
    examResultPending: true,
  };
  await seed(page, old);
  await expect(page.getByRole("heading", { name: "升上高中" })).toBeVisible();
  await page.getByRole("button", { name: "開始", exact: true }).click();
  await page.getByRole("button", { name: /研習社/ }).click();
  await expect(page.locator(".hud-turn")).toContainText("1 ／ 25");
  expect(await readSave(page)).toMatchObject({
    stage: "high",
    turn: 0,
    ending: null,
    examResultPending: false,
    entranceAttempt: null,
  });
});

test("既有聯考作答可保留國中舊題及答案", async ({ page }) => {
  const entranceAttempt = {
    ...startAssessment("contestTrivia", []),
    kind: "universityEntrance" as const,
  };
  entranceAttempt.items[0].answer = 1;
  await seed(page, { ...high, turn: 25, entranceAttempt });
  await expect(page.locator(".assessment-meta")).toContainText("第 2 ／ 10 題");
  expect((await readSave(page)).entranceAttempt).toEqual(entranceAttempt);
});
