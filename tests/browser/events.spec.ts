import { expect, test, type Page } from "@playwright/test";
import { schoolBoards } from "../../src/data/school-board";
import { chooseClub } from "../../src/game/clubs";
import { createSave, type Save } from "../../src/game/saves";

import { enterSchool } from "../../src/game/school";

const saveKey = "virtual-life-web:v3:slot:0";
const initial = chooseClub(
  createSave({
    gender: "boy",
    name: "小宇",
    birthday: { month: 3, day: 21 },
    bloodType: "A",
  }),
  "junior",
  "study",
);

async function loadBoard(
  page: Page,
  random: number[],
  save: Partial<Save> = {},
) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ key, data, random }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(data));
      // The queue is consumed only after loading the board.
      document.addEventListener(
        "click",
        (event) => {
          if (
            !(event.target instanceof HTMLElement) ||
            event.target.id !== "roll"
          )
            return;
          Math.random = () => random.shift() ?? 0.3;
        },
        true,
      );
    },
    {
      key: saveKey,
      data: { ...initial, boardTile: 5, previousTile: 4, ...save },
      random,
    },
  );
  await page.goto("/");
  await continueGame(page);
}

async function continueGame(page: Page) {
  await page.getByRole("button", { name: "繼續遊戲" }).click();
  await page.locator("#use-0").click();
}

async function saved(page: Page): Promise<Save> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    saveKey,
  );
}

for (const scene of [
  {
    label: "好事",
    title: "口水地圖",
    random: [0.8, 0, 0, 0, 0],
    result: "智力 ＋10",
    name: "good-landscape",
    id: "junior-good-01",
    width: 1080,
    height: 664,
  },
  {
    label: "壞事",
    title: "套到老闆",
    random: [0.8, 0.9, 0.36, 0],
    result: "現金 −200 元",
    name: "bad-portrait",
    id: "junior-bad-08",
    width: 390,
    height: 844,
  },
  {
    label: "神祇登場",
    title: "空袋客",
    random: [0.1, 0.9, 0.4],
    result: "人生經驗 ＋5",
    name: "deity-landscape",
    width: 1080,
    height: 664,
  },
] as const) {
  test(`${scene.label}畫面、素材與自動存檔`, async ({ page }) => {
    await page.setViewportSize({ width: scene.width, height: scene.height });
    await loadBoard(page, [0.3, 0.1, 0.1, ...scene.random], {
      boardTile: 29,
      previousTile: 28,
    });
    await page.getByRole("button", { name: "擲骰" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: scene.title }),
    ).toBeVisible();
    await expect(dialog).toContainText(scene.label);
    await expect(dialog).toContainText(scene.result);
    if (scene.label === "神祇登場") {
      const sprite = dialog.locator(".event-portrait");
      await expect(sprite).toHaveAttribute("src", /empty-bag\.webp/);
      await sprite.evaluate((image: HTMLImageElement) => image.decode());
    } else {
      const image = dialog.locator(".event-illustration");
      await expect(image).toHaveAttribute("src", new RegExp(`${scene.id}_m`));
      await image.evaluate((image: HTMLImageElement) => image.decode());
      await expect(dialog.locator(".event-background, .event-npc")).toHaveCount(
        0,
      );
    }
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const confirm = dialog.getByRole("button", { name: "確定" });
    await expect(confirm).toBeInViewport();
    expect((await confirm.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    if (process.env.EVENT_SCREENSHOTS) {
      await page.screenshot({
        path: `${process.env.EVENT_SCREENSHOTS}/junior-event-${scene.name}.png`,
      });
    }
    expect((await saved(page)).experience).toBe(0);
    await confirm.click();
    await expect(page.getByRole("status")).toContainText("已自動存檔");
    expect(await saved(page)).toMatchObject({
      experience: 5,
      turn: 1,
      boardTile: 31,
    });
    if (scene.label === "神祇登場") {
      await page.reload();
      await continueGame(page);
      await expect(page.locator(".board-status")).toContainText(
        "空袋客・5 回合",
      );
    }
  });
}

test("步數童可在水星逆行時指定一步，付費還願後附身消失", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await loadBoard(page, [0.02, 0.2], {
    deity: { id: "step-child", remainingTurns: 3 },
  });
  await page.getByRole("button", { name: "擲骰" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("水星逆行");
  await dialog.getByRole("button", { name: "確定" }).click();
  await expect(dialog).toContainText("這回合可以走 1～6 步");
  await expect(dialog.getByRole("button", { name: "7 步" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "1 步", exact: true }).click();
  await expect(dialog).toContainText("1,500 元");
  await dialog.getByRole("button", { name: "還願", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已自動存檔");
  expect(await saved(page)).toMatchObject({
    deity: null,
    cash: 3500,
    experience: 5,
    boardTile: 6,
  });
});

test("迷途使自選岔路並減一步，最後一回合結束時消失", async ({ page }) => {
  await loadBoard(page, [0.3, 0.2, 0.2, 0.99], {
    deity: { id: "lost-envoy", remainingTurns: 1 },
    boardTile: 3,
    previousTile: 2,
  });
  await page.getByRole("button", { name: "擲骰" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("研習社");
  await expect(page.locator(".board-pawn")).toHaveAttribute("data-tile", "39");
  await expect(page.getByRole("button", { name: /沿外圈/ })).toHaveCount(0);
  await dialog.getByRole("button", { name: "確定" }).click();
  await expect(page.getByRole("status")).toContainText("已自動存檔");
  expect(await saved(page)).toMatchObject({ deity: null, boardTile: 39 });
});

test("護心獅 uses a transparent portrait in the deity scene", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1080, height: 664 });
  await loadBoard(page, [0.3, 0.1, 0.1, 0.1, 0.1, 0.9], {
    boardTile: 29,
    previousTile: 28,
  });
  await page.getByRole("button", { name: "擲骰" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "護心獅" })).toBeVisible();
  const portrait = dialog.locator(".event-portrait");
  await expect(portrait).toHaveAttribute("src", /guard-lion\.webp/);
  await portrait.evaluate((image: HTMLImageElement) => image.decode());
  if (process.env.ANDY_SCREENSHOTS) {
    await page.screenshot({
      path: `${process.env.ANDY_SCREENSHOTS}/guard-lion.png`,
    });
  }
});

const reviewCases = [
  ["junior", "口水地圖", "夢中點名"],
  ["high", "塗卡藝術", "全猜C"],
  ["university", "午睡學分", "五個鬧鐘"],
] as const;

for (const [stage, goodTitle, badTitle] of reviewCases) {
  for (const [kind, title, polarity] of [
    ["good", goodTitle, 0],
    ["bad", badTitle, 0.9],
  ] as const) {
    for (const [gender, suffix] of [
      ["girl", "f"],
      ["boy", "m"],
    ] as const) {
      for (const [orientation, width, height] of [
        ["landscape", 1280, 800],
        ["portrait", 390, 844],
      ] as const) {
        const id = `${stage}-${kind}-01`;
        const name = `${id}_${suffix}-${orientation}`;
        test(name, async ({ page }) => {
          await page.setViewportSize({ width, height });
          const save =
            stage === "junior"
              ? initial
              : chooseClub(enterSchool(initial, stage), stage, "study");
          const target =
            stage === "junior"
              ? 31
              : schoolBoards[stage].tiles.findIndex(
                  ({ kind }, index, tiles) =>
                    index > 2 &&
                    kind === "event" &&
                    tiles
                      .slice(index - 2, index)
                      .every((tile) => tile.kind !== "fork"),
                );
          await loadBoard(page, [0.3, 0.1, 0.1, 0.8, polarity, 0, 0, 0], {
            ...save,
            gender,
            stageIntroSeen: ["high", "university"],
            boardTile: target - 2,
            previousTile: target - 3,
          });
          await page.getByRole("button", { name: "擲骰" }).click();
          const dialog = page.getByRole("dialog");
          await expect(
            dialog.getByRole("heading", { name: title }),
          ).toBeVisible();
          await expect(dialog.locator(".event-label")).toHaveText(
            kind === "good" ? "好事" : "壞事",
          );
          const image = dialog.locator(".event-illustration");
          await expect(image).toHaveAttribute(
            "src",
            new RegExp(`${id}_${suffix}`),
          );
          expect(
            await image.evaluate(async (image: HTMLImageElement) => {
              await image.decode();
              return [
                image.naturalWidth,
                image.naturalHeight,
                getComputedStyle(image).objectFit,
              ];
            }),
          ).toEqual([1280, 960, "contain"]);
          await expect(dialog.locator("#event-text")).toBeInViewport({
            ratio: 1,
          });
          await expect(
            dialog.getByRole("button", { name: "確定" }),
          ).toBeInViewport({ ratio: 1 });
          if (process.env.STEP12_SCREENSHOTS) {
            await page.screenshot({
              path: `${process.env.STEP12_SCREENSHOTS}/${name}.jpg`,
              quality: 88,
            });
          }
        });
      }
    }
  }
}

test("收集卡使用同一事件的女主角配圖", async ({ page }) => {
  await loadBoard(page, [0.3, 0.1, 0.1, 0.2, 0, 0], {
    gender: "girl",
    boardTile: 29,
    previousTile: 28,
  });
  await page.getByRole("button", { name: "擲骰" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".event-label")).toHaveText("收集卡");
  await expect(dialog.locator(".event-illustration")).toHaveAttribute(
    "src",
    /junior-good-01_f/,
  );
  await dialog.getByRole("button", { name: "確定" }).click();
  await expect(page.getByRole("status")).toContainText("已自動存檔");
  expect((await saved(page)).cards).toEqual(["junior-good-01"]);
});

test("配圖模組無法載入時顯示原場景及 NPC", async ({ page }) => {
  await page.route("**/junior-good-01_m.webp?*", (route) => route.abort());
  await loadBoard(page, [0.3, 0.1, 0.1, 0.8, 0, 0, 0, 0], {
    boardTile: 29,
    previousTile: 28,
  });
  await page.getByRole("button", { name: "擲骰" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "口水地圖" })).toBeVisible();
  await expect(dialog.locator(".event-background")).toHaveAttribute(
    "src",
    /event_classroom_final/,
  );
  await expect(dialog.locator(".event-npc")).toHaveAttribute(
    "src",
    /teacher.*\.webp$/,
  );
});
