import { expect, test, type Page } from "@playwright/test";
import { chooseClub } from "../../src/game/clubs";
import { createSave, type Save } from "../../src/game/saves";

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
    title: "粉筆救援隊",
    random: [0.8, 0, 0, 0, 0],
    result: "智力 ＋10",
    name: "good-landscape",
    background: "classroom",
    npc: "teacher",
    width: 1080,
    height: 664,
  },
  {
    label: "壞事",
    title: "撈到的是盆",
    random: [0.8, 0.9, 0.36, 0],
    result: "現金 −200 元",
    name: "bad-portrait",
    background: "festival",
    npc: "clerk",
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
    await loadBoard(page, [0.3, 0.1, 0.1, ...scene.random]);
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
      const background = dialog.locator(".event-background");
      await expect(background).toHaveAttribute(
        "src",
        new RegExp(`event_${scene.background}_final`),
      );
      await background.evaluate((image: HTMLImageElement) => image.decode());
      const npc = dialog.locator(".event-npc");
      await expect(npc).toHaveAttribute(
        "src",
        new RegExp(`/${scene.npc}[^/]*\\.webp$`),
      );
      const transparency = await npc.evaluate(
        async (image: HTMLImageElement) => {
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          ).data;
          return [
            pixels[3],
            pixels[(canvas.width - 1) * 4 + 3],
            pixels[
              (Math.floor(canvas.height / 2) * canvas.width +
                Math.floor(canvas.width / 2)) *
                4 +
                3
            ],
          ];
        },
      );
      expect(transparency).toEqual([0, 0, 255]);
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
      boardTile: 18,
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
  await expect(dialog.getByRole("button", { name: /沿外圈/ })).toHaveCount(0);
  await dialog.getByRole("button", { name: "確定" }).click();
  await expect(page.getByRole("status")).toContainText("已自動存檔");
  expect(await saved(page)).toMatchObject({ deity: null, boardTile: 39 });
});

test("護心獅 uses a transparent portrait in the deity scene", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1080, height: 664 });
  await loadBoard(page, [0.3, 0.1, 0.1, 0.1, 0.1, 0.9]);
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
