import { expect, test, type Locator, type Page } from "@playwright/test";
import { differenceHotspots } from "../../src/game/differences";
import { chooseClub } from "../../src/game/clubs";
import {
  mathQuestion,
  memoryDeck,
  minigames,
  type Minigame,
} from "../../src/game/minigames";
import { createSave } from "../../src/game/saves";

test.use({ hasTouch: true });
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

async function openGame(
  page: Page,
  random: number,
  portrait: boolean,
  contest = false,
  search = "",
) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(
    portrait ? { width: 390, height: 844 } : { width: 780, height: 360 },
  );
  await page.addInitScript(
    ({ key, save, random }) => {
      localStorage.setItem(key, JSON.stringify(save));
      let calls = 0;
      Math.random = () => (++calls <= 3 ? 0.08 : random);
    },
    { key: slot, save: { ...player, turn: contest ? 7 : 0 }, random },
  );
  await page.goto(`/${search}`);
  await page.getByRole("button", { name: "繼續遊戲" }).click();
  await page.locator("#use-0").click();
  if (!contest) await page.locator("#roll").click();
  return page.getByRole("dialog");
}

async function freeze(page: Page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1_000));
}

async function capture(page: Page, name: string) {
  const directory = process.env.MINIGAME_SCREENSHOTS;
  if (!directory) return;
  await page
    .locator("dialog:modal img")
    .evaluateAll((images) =>
      Promise.all(images.map((img) => (img as HTMLImageElement).decode())),
    );
  await page.screenshot({ path: `${directory}/${name}.jpg`, quality: 88 });
}

async function tap(page: Page, button: Locator, touch = false) {
  const box = (await button.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

async function begin(page: Page, dialog: Locator, touch = false) {
  const start = dialog.getByRole("button", { name: "開始", exact: true });
  await expect(start).toBeInViewport({ ratio: 1 });
  expect((await start.boundingBox())!.height).toBeGreaterThanOrEqual(72);
  await tap(page, start, touch);
  await expect(
    dialog.locator(".mg-field > :first-child").first(),
  ).toBeAttached();
}

async function confirmResult(
  page: Page,
  dialog: Locator,
  game: Minigame,
  score: number,
  tier: string,
) {
  await expect(dialog.getByRole("heading")).toHaveText(
    `${minigames[game].name}・${tier}`,
  );
  await expect(dialog.locator(".mg-goals")).toContainText("普通");
  await expect(dialog.locator(".mg-goals")).toContainText("優秀");
  await expect(page.locator("#roll")).toBeDisabled();
  await page.clock.resume();
  await dialog.getByRole("button", { name: "確定" }).click();
  await expect(page.locator("#roll")).toBeEnabled();
  const save = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    slot,
  );
  expect(save.turn).toBe(1);
  expect(save.minigames).toEqual([
    expect.objectContaining({ stage: "junior", game, score, tier }),
  ]);
  expect(save.cash).toBe(player.cash + (tier === "優秀" ? 600 : 100));
}

test("遊戲格節奏拍擊接受觸控，靜音可遊玩且鍵盤連按不計分", async ({ page }) => {
  const dialog = await openGame(page, 0.0625, true);
  await expect(dialog.getByRole("heading")).toHaveText("節奏拍擊");
  await capture(page, "how-to-portrait");
  await page.evaluate(() =>
    Object.defineProperty(window, "AudioContext", { value: undefined }),
  );
  await freeze(page);
  await begin(page, dialog, true);
  const lane = dialog.getByRole("button", { name: "拍擊" });
  await page.clock.runFor(960);
  await capture(page, "rhythm-portrait");
  await page.clock.runFor(240);
  await lane.focus();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Space");
    await page.keyboard.press("Enter");
    if (i > 0) await tap(page, lane, true);
    if (i < 19) await page.clock.runFor(600);
  }
  await page.clock.runFor(160);
  await expect(dialog.locator(".mg-result")).toHaveText("成績 95%");
  await capture(page, "result-portrait");
  await confirmResult(page, dialog, "rhythm", 95, "優秀");
});

test("記憶翻牌蓋回錯配，再配完八對", async ({ page }) => {
  const random = 0.1875;
  const dialog = await openGame(page, random, false);
  await freeze(page);
  await begin(page, dialog);
  const cards = dialog.locator(".mg-card");
  const deck = memoryDeck(() => random);
  const other = deck.findIndex((face) => face !== deck[0]);
  await tap(page, cards.nth(0));
  await tap(page, cards.nth(other));
  await expect(cards.nth(0)).toBeDisabled();
  await page.clock.runFor(700);
  await expect(cards.nth(0)).toBeEnabled();
  for (let face = 1; face <= 8; face++) {
    await tap(page, cards.nth(deck.indexOf(face)));
    await tap(page, cards.nth(deck.lastIndexOf(face)));
    if (face === 3) await capture(page, "memory-landscape");
  }
  await confirmResult(page, dialog, "memory", 8, "優秀");
});

test("數字快算四選一，45 秒後結算答對題數", async ({ page }) => {
  const random = 0.3125;
  const dialog = await openGame(page, random, true);
  await freeze(page);
  await begin(page, dialog, true);
  const { answer } = mathQuestion(() => random);
  const button = dialog.getByRole("button", {
    name: String(answer),
    exact: true,
  });
  for (let i = 0; i < 12; i++) {
    await tap(page, button, true);
    await page.clock.runFor(400);
    if (i === 4) await capture(page, "math-portrait");
  }
  await page.clock.fastForward(41_000);
  await confirmResult(page, dialog, "math", 12, "優秀");
});

async function captureShot(page: Page, subject: Locator, name: string) {
  const directory = process.env.MINIGAME_SCREENSHOTS;
  if (!directory) return;
  await subject
    .locator("img:visible")
    .evaluate((image: HTMLImageElement) => image.decode());
  const box = (await subject.boundingBox())!;
  const viewport = page.viewportSize()!;
  const width = 250;
  const height = 164;
  await page.screenshot({
    path: `${directory}/${name}.jpg`,
    quality: 94,
    clip: {
      x: Math.max(
        0,
        Math.min(viewport.width - width, box.x + (box.width - width) / 2),
      ),
      y: Math.max(
        0,
        Math.min(viewport.height - height, box.y + (box.height - height) / 2),
      ),
      width,
      height,
    },
  });
}

async function expectTransparentCorners(image: Locator) {
  const alphas = await image.evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const { naturalWidth: width, naturalHeight: height } = img;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
    ].map(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3]);
  });
  expect(alphas).toEqual([0, 0, 0, 0]);
}

for (const portrait of [false, true]) {
  test.describe(portrait ? "手機直向" : "桌面橫向", () => {
    test.use({ hasTouch: portrait, deviceScaleFactor: 2 });

    test("準心射擊接受指標輸入，鍵盤連按不計分", async ({ page }) => {
      const dialog = await openGame(page, 0.4375, portrait);
      await begin(page, dialog, portrait);
      const target = dialog.getByRole("button", { name: "命中靶子" });
      const hud = dialog.locator(".mg-hud");
      await target.focus();
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press("Enter");
        await page.keyboard.press("Space");
      }
      await expect(hud).toContainText("命中 0 個");
      if (portrait) {
        const box = (await target.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(72);
        expect(box.height).toBeGreaterThanOrEqual(72);
      }
      await tap(page, target, portrait);
      await expect(hud).toContainText("命中 1 個");
    });
  });
}

test("準心射擊靶子會換位，每個靶只計一次，30 秒後結算", async ({ page }) => {
  const dialog = await openGame(page, 0.4375, false);
  await freeze(page);
  await begin(page, dialog);
  const target = dialog.getByRole("button", { name: "命中靶子" });
  const feedback = dialog.locator(".mg-shot-feedback");
  const hud = dialog.locator(".mg-hud");
  const first = (await target.boundingBox())!;
  await expectTransparentCorners(target.locator("img"));
  await page.clock.runFor(1050);
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await expect(hud).toContainText("命中 1 個");
  await expect(feedback).toHaveAttribute("data-shot", "hit");
  await expectTransparentCorners(feedback.locator("img:visible"));
  await page.clock.runFor(200);
  await page.mouse.up();
  expect(await target.boundingBox()).not.toEqual(first);
  await page.mouse.click(first.x + first.width / 2, first.y + first.height / 2);
  await expect(hud).toContainText("命中 1 個");
  await expect(feedback).toHaveAttribute("data-shot", "miss");
  await expectTransparentCorners(feedback.locator("img:visible"));

  for (let i = 1; i < 23; i++) {
    if (i < 4) await expectTransparentCorners(target.locator("img"));
    await tap(page, target);
    await expect(target).toHaveCount(0);
    if (i < 22) await page.clock.runFor(1250);
  }
  await page.clock.fastForward(3000);
  await confirmResult(page, dialog, "shoot", 23, "優秀");
});

if (process.env.MINIGAME_SCREENSHOTS) {
  for (const portrait of [false, true]) {
    test.describe(portrait ? "直向畫面" : "橫向畫面", () => {
      test.use({ deviceScaleFactor: 2 });

      test("準心射擊畫面", async ({ page }) => {
        const dialog = await openGame(page, 0.4375, portrait);
        await freeze(page);
        await begin(page, dialog, portrait);
        await page.clock.runFor(5000);
        const target = dialog.getByRole("button", { name: "命中靶子" });
        await captureShot(
          page,
          target,
          portrait ? "target-portrait" : "target-landscape",
        );
        await tap(page, target, portrait);
        if (!portrait)
          await captureShot(
            page,
            dialog.locator(".mg-shot-feedback"),
            "hit-feedback",
          );
      });
    });
  }
}

test("衝刺擂台共用落下音符的節奏回合並以準確率排名", async ({ page }) => {
  const dialog = await openGame(page, 0.08, false, true);
  await dialog.getByRole("button", { name: /衝刺擂台/ }).click();
  await expect(dialog.getByRole("heading")).toHaveText("衝刺擂台");
  await freeze(page);
  await begin(page, dialog);
  const lane = dialog.getByRole("button", { name: "拍擊" });
  await page.clock.runFor(960);
  await capture(page, "contest-rhythm-landscape");
  await page.clock.runFor(240);
  for (let i = 0; i < 20; i++) {
    await tap(page, lane);
    if (i === 0) await tap(page, lane);
    if (i < 19) await page.clock.runFor(600);
  }
  await page.clock.runFor(180);
  await page.clock.resume();
  await expect(dialog).toContainText("成績 95.2%");
  await dialog.getByRole("button", { name: "確定" }).click();
  await expect(page.locator("#roll")).toBeEnabled();
  const save = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    slot,
  );
  expect(save.competitions[0]).toMatchObject({
    event: "rhythm",
    score: 95.2,
    rank: 1,
  });
  expect(save.minigames).toEqual([]);
});

async function keyMash(page: Page) {
  for (const key of ["Enter", "Space", "Enter", "Space"]) {
    await page.keyboard.press(key);
  }
}

async function expectSignOnBackdrop(dialog: Locator) {
  const backdrop = (await dialog
    .locator(".mg-play .mg-backdrop")
    .boundingBox())!;
  const sign = (await dialog.locator(".mg-signboard").boundingBox())!;
  expect((sign.x + sign.width / 2 - backdrop.x) / backdrop.width).toBeCloseTo(
    0.5,
    2,
  );
  expect((sign.y + sign.height / 2 - backdrop.y) / backdrop.height).toBeCloseTo(
    0.246,
    2,
  );
  await expect(dialog.locator(".mg-signboard")).toBeInViewport({ ratio: 1 });
}

test("打地鼠 scores on real pointerdown and 30 hits earns 優秀", async ({
  page,
}) => {
  const dialog = await openGame(page, 0.5625, false);
  await freeze(page);
  await begin(page, dialog);
  const target = dialog.getByRole("button", { name: "打小怪獸" });
  const sign = dialog.locator(".mg-signboard");
  await expect(sign.locator(".mg-sign-score")).toHaveText("命中 0 隻");
  await expect(sign.locator(".mg-sign-clock")).toHaveText("30 秒");
  await expectSignOnBackdrop(dialog);
  await page.setViewportSize({ width: 360, height: 780 });
  await expectSignOnBackdrop(dialog);
  await page.setViewportSize({ width: 780, height: 360 });
  const score = dialog.locator(".mg-score");
  const first = (await target.boundingBox())!;
  expect(first.width).toBeGreaterThanOrEqual(72);
  expect(first.height).toBeGreaterThanOrEqual(72);
  await target.focus();
  await keyMash(page);
  await expect(score).toHaveText("命中 0 隻");
  await target.blur();
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await expect(score).toHaveText("命中 1 隻");
  await expect(target.locator("img")).toHaveAttribute("src", /clock-dizzy/);
  const impact = dialog.locator(".mg-whack-impact");
  await expect(impact.locator('img[src*="hammer-glow"]')).toBeVisible();
  await expect(impact.locator('img[src*="burst"]')).toBeVisible();
  await capture(page, "whack-hit");
  await page.mouse.up();
  await page.mouse.click(first.x + first.width / 2, first.y + first.height / 2);
  await expect(
    dialog.locator('.mg-whack-puff img[src*="cloud"]'),
  ).toBeVisible();
  await expect(score).toHaveText("命中 1 隻");

  for (let hit = 2; hit <= 30; hit++) {
    await page.clock.runFor(800);
    if (hit === 14) {
      await expect(sign.locator(".mg-sign-score")).toHaveText("命中 13 隻");
      await expect(sign.locator(".mg-sign-clock")).toHaveText("20 秒");
      await capture(page, "whack-landscape");
    }
    await tap(page, target);
    await expect(score).toHaveText(`命中 ${hit} 隻`);
  }
  await page.clock.fastForward(8000);
  await capture(page, "whack-result");
  await confirmResult(page, dialog, "whack", 30, "優秀");
});

test("找不同 marks both images, applies the wrong-tap lockout and saves 5/5", async ({
  page,
}) => {
  const dialog = await openGame(page, 0.6875, true);
  await freeze(page);
  await begin(page, dialog, true);
  const pictures = dialog.locator(".mg-diff-picture");
  const first = (await pictures.nth(0).boundingBox())!;
  const second = (await pictures.nth(1).boundingBox())!;
  const spots = differenceHotspots[2];
  const touchSpot = (index: number) => {
    const box = index % 2 ? second : first;
    const { x, y } = spots[index];
    return page.touchscreen.tap(box.x + x * box.width, box.y + y * box.height);
  };
  expect(Math.abs(first.width / first.height - 4 / 3)).toBeLessThan(0.01);
  expect(second.y).toBeGreaterThan(first.y + first.height);
  const score = dialog.locator(".mg-score");
  await keyMash(page);
  await expect(score).toHaveText("找到 0 ／ 5 處");
  await page.touchscreen.tap(
    first.x + first.width * 0.45,
    first.y + first.height * 0.4,
  );
  await expect(dialog.locator(".mg-tap-mark")).toHaveText("×");
  await touchSpot(0);
  await page.clock.runFor(950);
  await touchSpot(0);
  await expect(score).toHaveText("找到 0 ／ 5 處");
  await page.clock.runFor(50);
  await touchSpot(0);
  await touchSpot(0);
  await expect(dialog.locator(".mg-diff-ring.found")).toHaveCount(2);
  await capture(page, "diff-portrait");
  for (let i = 1; i < 5; i++) await touchSpot(i);
  await confirmResult(page, dialog, "diff", 5, "優秀");
});

test("接水果 accepts a held mouse drag and records fruit and misses", async ({
  page,
}) => {
  const dialog = await openGame(page, 0.8125, true);
  await freeze(page);
  await begin(page, dialog, true);
  const sign = dialog.locator(".mg-signboard");
  await expect(sign.locator(".mg-sign-score")).toHaveText("接到 0・漏接 0/5");
  await expect(sign.locator(".mg-sign-clock")).toHaveText("30 秒");
  await expectSignOnBackdrop(dialog);
  await page.setViewportSize({ width: 780, height: 360 });
  await expectSignOnBackdrop(dialog);
  await page.setViewportSize({ width: 390, height: 844 });
  const basket = dialog.locator(".mg-basket img");
  await expect(basket).toHaveCSS("object-fit", "contain");
  const field = dialog.locator(".mg-field");
  const box = (await field.boundingBox())!;
  const score = dialog.locator(".mg-score");
  await keyMash(page);
  await expect(score).toHaveText("接到 0・漏接 0");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.9);
  await page.mouse.down();
  for (let i = 0; i < 35; i++) {
    const lane = (2 + 4 * (i + 1)) % 5;
    // Miss exactly five fruit by steering one lane away.
    const target = i < 5 ? (lane + 1) % 5 : lane;
    await page.mouse.move(
      box.x + box.width * (0.1 + target * 0.2),
      box.y + box.height * 0.9,
    );
    if (i === 0) await page.clock.runFor(1390);
    if (i === 10) await capture(page, "catch-portrait");
    await page.clock.runFor(790);
  }
  await page.mouse.up();
  await expect(score).toHaveText("接到 30・漏接 5");
  await expect(sign.locator(".mg-sign-score")).toHaveText("接到 30・漏接 5/5");
  await expect(sign.locator(".mg-sign-clock")).toHaveText("1 秒");
  await page.clock.fastForward(2000);
  await confirmResult(page, dialog, "catch", 30, "優秀");
});

async function expectBlockProportions(sprites: Locator) {
  const errors = await sprites.evaluateAll((nodes) =>
    nodes.map((node) => {
      const { naturalWidth: width, naturalHeight: height } =
        node as HTMLImageElement;
      const bounds = node.getBoundingClientRect();
      return Math.abs(bounds.width / bounds.height - width / height);
    }),
  );
  expect(errors.length).toBeGreaterThan(0);
  for (const error of errors) expect(error).toBeLessThan(0.01);
}

for (const portrait of [false, true]) {
  test(`疊疊樂 builds 15 layers and raises the camera (${portrait ? "portrait" : "landscape"})`, async ({
    page,
  }) => {
    const dialog = await openGame(page, 0.9375, portrait);
    await freeze(page);
    await begin(page, dialog, portrait);
    const field = dialog.locator(".mg-field");
    const score = dialog.locator(".mg-score");
    const backdrop = dialog.locator(".mg-play picture img");
    expect(
      await backdrop.evaluate((img: HTMLImageElement) => img.currentSrc),
    ).toContain(`mg_stack_bg_${portrait ? "portrait" : "landscape"}`);
    await keyMash(page);
    await expect(score).toHaveText("疊好 0 層");
    for (let layer = 1; layer <= 15; layer++) {
      await page.clock.runFor(640);
      if (layer === 7) {
        await expectBlockProportions(
          dialog.locator(".mg-stack-world .mg-sprite"),
        );
        await capture(page, portrait ? "stack-portrait" : "stack-landscape");
      }
      await tap(page, field, portrait);
      await page.clock.runFor(160);
      await expect(score).toHaveText(`疊好 ${layer} 層`);
    }
    await expect(dialog.locator(".mg-stack-world")).toHaveCSS(
      "transform",
      /matrix\(1, 0, 0, 1, 0, [1-9]/,
    );
    if (portrait) {
      await page.clock.fastForward(60_000);
      await confirmResult(page, dialog, "stack", 15, "優秀");
    } else {
      // Overhang trims the next block. Dropping it from the left then misses.
      await page.clock.runFor(1210);
      await tap(page, field);
      await page.clock.runFor(160);
      await expect(score).toHaveText("疊好 16 層");
      await expect(
        await dialog
          .locator(".mg-stack-moving")
          .evaluate((block) => (block as HTMLElement).style.clipPath),
      ).toMatch(/inset\(0px [1-9][\d.]*% 0px 0px\)/);
      await expectBlockProportions(
        dialog.locator(".mg-stack-world .mg-sprite"),
      );
      await tap(page, field);
      await page.clock.runFor(160);
      await confirmResult(page, dialog, "stack", 16, "優秀");
    }
  });
}

for (const set of [1, 2, 3]) {
  test(`找不同第 ${set} 組開發檢視描繪兩張圖的五個熱點`, async ({ page }) => {
    const dialog = await openGame(
      page,
      0.6875,
      false,
      false,
      `?diff-debug=${set}`,
    );
    await page.setViewportSize({ width: 1040, height: 660 });
    await freeze(page);
    await begin(page, dialog);
    const pictures = dialog.locator(".mg-diff-picture");
    for (const picture of await pictures.all()) {
      await expect(picture.locator(".mg-diff-ring:visible")).toHaveCount(5);
      await expect(picture.locator("img")).toHaveAttribute(
        "src",
        new RegExp(`mg_diff${set}_`),
      );
    }
    await capture(page, `diff-debug-${set}`);
  });
}

test("記憶翻牌在四種尺寸完整顯示 16 張方形牌", async ({ page }) => {
  const dialog = await openGame(page, 0.1875, false);
  await freeze(page);
  await begin(page, dialog);
  const cards = dialog.locator(".mg-card");
  await expect(cards).toHaveCount(16);

  for (const [width, height] of [
    [1280, 800],
    [1280, 720],
    [390, 844],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    const field = (await dialog.locator(".mg-field").boundingBox())!;
    for (const card of await cards.all()) {
      await expect(card).toBeInViewport({ ratio: 1 });
      const bounds = (await card.boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.width).toBeCloseTo(bounds.height, 1);
      expect(bounds.x).toBeGreaterThanOrEqual(field.x);
      expect(bounds.y).toBeGreaterThanOrEqual(field.y);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(
        field.x + field.width,
      );
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(
        field.y + field.height,
      );
    }
    await capture(page, `memory-${width}x${height}`);
  }
});

for (const [name, roll, subject] of [
  ["節奏拍擊", 0.0625, ".mg-lane"],
  ["數字快算", 0.3125, ".mg-math"],
  ["準心射擊", 0.4375, ".mg-gallery"],
  ["打地鼠", 0.5625, ".mg-critter"],
  ["找不同", 0.6875, ".mg-diff-picture"],
  ["接水果", 0.8125, ".mg-basket"],
  ["疊疊樂", 0.9375, ".mg-stack-moving"],
] as const) {
  test(`${name}的主要操作區在四種尺寸內完整可見`, async ({ page }) => {
    const dialog = await openGame(page, roll, false);
    await freeze(page);
    await begin(page, dialog);
    for (const [width, height] of [
      [1280, 800],
      [1280, 720],
      [390, 844],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      for (const target of await dialog.locator(subject).all()) {
        await expect(target).toBeInViewport({ ratio: 1 });
      }
    }
  });
}
