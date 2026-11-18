import { expect, test, type Locator, type Page } from "@playwright/test";
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
  await page.goto("/");
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
  await tap(page, start, touch);
  await expect(dialog.locator(".mg-field button").first()).toBeAttached();
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
  const dialog = await openGame(page, 0.1, true);
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
  const random = 0.42;
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
  const random = 0.58;
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

test("準心射擊靶子會換位，每個靶只計一次，30 秒後結算", async ({ page }) => {
  const dialog = await openGame(page, 0.88, false);
  await freeze(page);
  await begin(page, dialog);
  const target = dialog.getByRole("button", { name: "命中靶子" });
  const first = await target.boundingBox();
  await page.clock.runFor(1_000);
  expect(await target.boundingBox()).not.toEqual(first);
  await capture(page, "shoot-landscape");
  for (let i = 0; i < 23; i++) {
    await tap(page, target);
    await expect(target).toHaveCount(0);
    if (i < 22) await page.clock.runFor(920);
  }
  await page.clock.fastForward(9_000);
  await confirmResult(page, dialog, "shoot", 23, "優秀");
});

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
