import { expect, test, type Page } from "@playwright/test";
import { chooseClub } from "../../src/game/clubs";
import {
  galleryKey,
  snapshotStage,
  stageStory,
  story,
} from "../../src/game/main-story";
import { createSave, type Save } from "../../src/game/saves";

const slot = "virtual-life-web:v3:slot:0";
const player = createSave({
  name: "安安",
  gender: "girl",
  birthday: { month: 3, day: 21 },
  bloodType: "A",
});
const allIds = story.map(({ id }) => id);
const chapters = (stage: "junior" | "high" | "university") =>
  chooseClub(
    {
      ...player,
      stage,
      storyFragments: [],
      stageIntroSeen: ["high", "university"],
      competitions: [
        {
          stage: "junior",
          matchNumber: 1,
          event: "style",
          score: 180,
          rank: 1,
        },
      ],
    },
    stage,
    "study",
  );

async function capture(page: Page, name: string, direction: string) {
  const step16 = [
    "setup",
    "confirm-opening",
    "junior-opening",
    "opening-gallery",
  ];
  const dir =
    process.env.STEP16_SCREENSHOTS && step16.includes(name)
      ? process.env.STEP16_SCREENSHOTS
      : process.env.STORY_SCREENSHOTS;
  if (!dir) return;
  await page
    .locator("img:visible")
    .evaluateAll((images) =>
      Promise.all(images.map((image) => (image as HTMLImageElement).decode())),
    );
  await page.screenshot({
    path: `${dir}/${name}-${direction}.jpg`,
    quality: 88,
  });
}

async function load(page: Page, save: Save) {
  await page.goto("/");
  await page.evaluate(
    ({ slot, save }) => localStorage.setItem(slot, JSON.stringify(save)),
    { slot, save },
  );
  await page.reload();
  await page.getByRole("button", { name: "繼續遊戲" }).click();
  await page.locator("#use-0").click();
}

async function visibleStory(page: Page, title: string | RegExp) {
  const modal = page.getByRole("dialog", { name: title });
  await expect(modal).toBeVisible();
  return modal;
}

for (const [direction, width, height] of [
  ["landscape", 1280, 800],
  ["portrait", 390, 844],
] as const) {
  test.describe(direction, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(() => {
        Math.random = () => 0.1;
      });
    });

    test("新人生只播放國中首段，本局與畫廊都收錄", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "開始新人生" }).click();
      await page.getByLabel("名字").fill("安安");
      await expect(page.locator(".hero-options img").nth(0)).toHaveAttribute(
        "src",
        /hero_boy_junior_final-portrait/,
      );
      await expect(page.locator(".hero-options img").nth(1)).toHaveAttribute(
        "src",
        /hero_girl_junior_final-portrait/,
      );
      const gender = direction === "portrait" ? "girl" : "boy";
      await page.locator(`[name="gender"][value="${gender}"]`).check();
      await capture(page, "setup", direction);
      await page.getByRole("button", { name: "查看開局結果" }).click();
      await expect(page.locator(".character .portrait img")).toHaveAttribute(
        "src",
        new RegExp(`hero_${gender}_junior_final-portrait`),
      );
      await capture(page, "confirm-opening", direction);
      await page.getByRole("button", { name: "確認開局" }).click();
      const first = await visibleStory(page, "失蹤人口");
      await expect(first.getByText("主線故事・國中 1／5")).toBeVisible();
      await expect(first.getByText(/^升上國中那年/)).toBeVisible();
      const next = first.getByRole("button", { name: "繼續" });
      await expect(next).toBeInViewport();
      await capture(page, "junior-opening", direction);
      await next.click();
      await page.getByRole("button", { name: /研習社/ }).click();
      await expect(
        page.getByText("已收集主線故事・國中 1／5，可在記憶畫廊重看"),
      ).toBeVisible();
      const save: Save = await page.evaluate(
        (slot) => JSON.parse(localStorage.getItem(slot)!),
        slot,
      );
      expect(save.storyFragments).toEqual(["junior-1"]);
      expect(save.storyTilesUsed).toEqual([]);
      expect(save.stageSnapshots.junior).toMatchObject({
        stage: "junior",
        turn: 0,
        storyFragments: ["junior-1"],
      });
      await page.getByRole("button", { name: "選單", exact: true }).click();
      await page.getByRole("button", { name: "回標題" }).click();
      await page.getByRole("button", { name: "記憶畫廊" }).click();
      const gallery = await visibleStory(page, "記憶畫廊");
      await expect(gallery.getByRole("heading", { level: 3 })).toHaveText([
        "國中 1／5",
        "高中 0／6",
        "大學 0／5",
      ]);
      await capture(page, "opening-gallery", direction);
      await gallery.getByRole("button", { name: /失蹤人口/ }).click();
      const replay = await visibleStory(page, "失蹤人口");
      await expect(
        replay.getByRole("button", { name: "上一片" }),
      ).toBeDisabled();
      await expect(
        replay.getByRole("button", { name: "下一片" }),
      ).toBeDisabled();
      await replay.getByRole("button", { name: "回畫廊" }).click();
      await expect(gallery).toBeVisible();
    });

    test("故事格只在停格交付，學段結束可重玩", async ({ page }) => {
      const opening = snapshotStage(chapters("junior"));
      await load(page, {
        ...opening,
        turn: 14,
        retrogradeTurns: 1,
        exams: [{ id: "quiz", correct: 3 }],
      });
      await page.locator("#roll").click();
      const fragment = await visibleStory(page, "失蹤人口");
      await expect(fragment.getByText("主線故事・國中 1／5")).toBeVisible();
      await capture(page, "fragment-earned", direction);
      await fragment.getByRole("button", { name: "繼續" }).click();
      const reminder = await visibleStory(page, /尚未完成（1／5）/);
      await expect(reminder.getByRole("button")).toHaveCount(3);
      await capture(page, "stage-incomplete", direction);
      await reminder.getByRole("button", { name: "查看記憶畫廊" }).click();
      const gallery = await visibleStory(page, "記憶畫廊");
      await expect(gallery.getByText("本局 1／16")).toBeVisible();
      if (direction === "portrait")
        await gallery
          .getByRole("heading", { name: "國中 1／5" })
          .scrollIntoViewIfNeeded();
      await capture(page, "gallery-partial", direction);
      await gallery.getByRole("button", { name: "關閉" }).click();
      await reminder.getByRole("button", { name: "從本學段起點重玩" }).click();
      const confirm = await visibleStory(page, /第 1 回合重新開始/);
      await capture(page, "restart-confirm", direction);
      await confirm.getByRole("button", { name: "確定重玩" }).click();
      await expect(page.locator(".hud-turn")).toContainText("1 ／ 15");
      const restarted = await page.evaluate(
        ({ slot, galleryKey }) => ({
          save: JSON.parse(localStorage.getItem(slot)!),
          gallery: JSON.parse(localStorage.getItem(galleryKey)!),
        }),
        { slot, galleryKey },
      );
      expect(restarted.save).toMatchObject({
        stats: opening.stats,
        cash: opening.cash,
        storyFragments: [],
        storyTilesUsed: [],
        exams: [{ id: "quiz", correct: 3 }],
      });
      expect(restarted.gallery.seen).toContain("junior-1");
    });

    test("故事格已拼過與集滿提醒", async ({ page }) => {
      await load(page, {
        ...chapters("junior"),
        turn: 14,
        retrogradeTurns: 1,
        storyFragments: [...stageStory("junior").map(({ id }) => id)],
        storyTilesUsed: [{ stage: "junior", tile: 1 }],
      });
      await page.locator("#roll").click();
      const repeated = await visibleStory(page, "這段記憶你已經拼過了");
      await capture(page, "fragment-repeated", direction);
      await repeated.getByRole("button", { name: "確定" }).click();
      const complete = await visibleStory(page, /完成了（5／5）/);
      await expect(complete.locator(".story-pin i")).toBeVisible();
      await capture(page, "stage-complete", direction);
      await complete.getByRole("button", { name: "繼續" }).click();
      await expect(
        page.getByRole("heading", { name: "高中棋盤" }),
      ).toBeVisible();
    });

    for (const gender of ["boy", "girl"] as const) {
      test(`真結局 ${gender} 使用世界地圖`, async ({ page }) => {
        await load(page, {
          ...chapters("university"),
          stage: "graduated",
          ending: "universityGraduate",
          gender,
          storyFragments: allIds,
        });
        await page.getByRole("button", { name: "查看結算" }).click();
        const first = await visibleStory(page, "阿公的明信片");
        await expect(first.locator(".event-background")).toHaveAttribute(
          "src",
          /cg_world_map/,
        );
        await expect(first.getByRole("button", { name: "略過" })).toHaveCount(
          0,
        );
        if (process.env.STEP11_SCREENSHOTS) {
          await first
            .locator(".event-background")
            .evaluate((image: HTMLImageElement) => image.decode());
          await page.screenshot({
            path: `${process.env.STEP11_SCREENSHOTS}/true-ending-1-${gender}-${direction}.jpg`,
            quality: 88,
          });
        }
        await capture(page, `true-ending-1-${gender}`, direction);
        if (gender === "boy") return;
        const next = () =>
          page
            .getByRole("dialog")
            .getByRole("button", { name: "繼續" })
            .click();
        await next();
        await expect(page.getByText(/明天記得叫阿公起床/)).toBeVisible();
        await next();
        await visibleStory(page, "隔天早上");
        await capture(page, "true-ending-3", direction);
        await next();
        await expect(page.locator(".story-paper")).toBeVisible();
        await capture(page, "true-ending-4", direction);
        await next();
        await visibleStory(page, /這一次，換我寫信給你了/);
        await capture(page, "true-ending-5", direction);
        await next();
        await expect(
          page.getByRole("heading", { name: "—— 完 ——" }),
        ).toBeVisible();
        await next();
        await expect(page.getByRole("dialog", { name: "片尾" })).toContainText(
          "2016",
        );
        await expect(
          page.getByRole("heading", { name: "大學畢業結算" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "記憶畫廊" }).click();
        const gallery = await visibleStory(page, "記憶畫廊");
        const special = gallery.getByRole("button", {
          name: "第十八張明信片",
          exact: true,
        });
        await special.scrollIntoViewIfNeeded();
        await capture(page, "gallery-all", direction);
        await special.click();
        await (
          await visibleStory(page, "阿公的明信片")
        )
          .getByRole("button", { name: "略過" })
          .click();
        await expect(gallery).toBeVisible();
      });
    }

    test("苦甜版與聯考落榜文案", async ({ page }) => {
      await load(page, {
        ...snapshotStage(chapters("university")),
        stage: "graduated",
        ending: "universityGraduate",
        storyFragments: allIds.slice(0, -1),
      });
      await page.getByRole("button", { name: "查看結算" }).click();
      const bittersweet = await visibleStory(page, "第十八張明信片");
      await expect(bittersweet.getByText(/主線故事 15／16/)).toBeVisible();
      await expect(
        bittersweet.getByRole("button", { name: "從大學起點重玩" }),
      ).toBeVisible();
      await capture(page, "bittersweet", direction);
      await load(page, {
        ...snapshotStage(chapters("junior")),
        stage: "earlyExit",
        ending: "universityExamFail",
      });
      await expect(
        page.getByRole("heading", { name: "聯考落榜" }),
      ).toBeVisible();
      await expect(
        page.getByText("阿公還在等郵差，你也還在等一個答案。"),
      ).toBeVisible();
      await capture(page, "exam-fail", direction);
      await page.getByRole("button", { name: "記憶畫廊" }).click();
      const gallery = await visibleStory(page, "記憶畫廊");
      await expect(
        gallery.getByRole("heading", { name: "大學・尚未開放" }),
      ).toBeVisible();
    });

    test("三學段都顯示故事格圖示", async ({ page }) => {
      for (const [stage, tile] of [
        ["junior", 1],
        ["high", 7],
        ["university", 10],
      ] as const) {
        await load(page, { ...chapters(stage), boardTile: tile });
        await expect(page.locator("#roll")).toBeEnabled();
        const face = page.locator(
          `.board-tile[data-tile="${tile}"][data-kind="story"] .paver-top`,
        );
        await expect(face).toHaveAttribute("href", /story-clay/);
        await expect(face).toBeInViewport();
        await expect(
          page.locator(`[data-tile="${tile}"] .story-tile-postcard`),
        ).toBeVisible();
        if (process.env.STEP11_SCREENSHOTS) {
          await face.evaluate(async (element) => {
            const img = new Image();
            img.src = element.getAttribute("href")!;
            await img.decode();
          });
          await page.screenshot({
            path: `${process.env.STEP11_SCREENSHOTS}/board-${stage}-${direction}.jpg`,
            quality: 88,
          });
        }
        await capture(page, `board-${stage}`, direction);
      }
    });
  });
}
