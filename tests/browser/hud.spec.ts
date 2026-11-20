import { expect, test, type Page } from "@playwright/test";
import { chooseClub } from "../../src/game/clubs";
import { createSave, type Save } from "../../src/game/saves";

const saveKey = "virtual-life-web:v3:slot:0";
const initial = chooseClub(
  createSave({
    gender: "girl",
    name: "安安",
    birthday: { month: 3, day: 21 },
    bloodType: "A",
  }),
  "junior",
  "study",
);
const boardSave: Save = {
  ...initial,
  turn: 2,
  boardTile: 5,
  previousTile: 4,
  stats: { intellect: 173, morality: 118, charm: 91, fitness: 62 },
  cash: 5300,
  experience: 15,
};

async function loadBoard(page: Page, patch: Partial<Save> = {}) {
  await page.addInitScript(
    ({ key, save }) => {
      localStorage.setItem(key, JSON.stringify(save));
      Math.random = () => 0.3;
    },
    { key: saveKey, save: { ...boardSave, ...patch } },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "繼續遊戲" }).click();
  await page.locator("#use-0").click();
  await expect(page.locator("#roll")).toBeEnabled();
}

for (const layout of [
  { name: "desktop-1280x800", width: 1280, height: 800 },
  { name: "phone-390x844", width: 390, height: 844 },
  {
    name: "landscape-bad-deity-1280x800",
    width: 1280,
    height: 800,
    deity: { id: "empty-bag", remainingTurns: 3 },
  },
  {
    name: "portrait-good-deity-390x844",
    width: 390,
    height: 844,
    deity: { id: "sky-elder", remainingTurns: 4 },
  },
  {
    name: "portrait-bad-over-target-390x844",
    width: 390,
    height: 844,
    deity: { id: "empty-bag", remainingTurns: 3 },
    over: true,
  },
]) {
  test(`HUD layout ${layout.name}`, async ({ page }) => {
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await loadBoard(page, {
      deity: layout.deity ?? null,
      stats: { ...boardSave.stats, intellect: layout.over ? 9999 : 173 },
    });
    const meter = page.getByRole("meter", { name: "智力" });
    await expect(meter).toHaveAttribute("aria-valuemax", "200");
    await expect(meter).toHaveAttribute(
      "data-over",
      String(Boolean(layout.over)),
    );
    await expect(page.locator(".hud-stat .hud-value")).toHaveText([
      layout.over ? "9999" : "173",
      "118",
      "91",
      "62",
    ]);
    await expect(page.locator(".hud-cash dd")).toHaveText("5,300 元");
    await expect(page.locator(".hud-turn dd")).toHaveText("3 ／ 15");
    await expect(page.locator(".hud-stage")).toHaveText("國中 1 年級");
    const portrait = layout.width < layout.height;
    const avatar = page.locator(
      portrait ? ".hud-avatar-mobile" : ".hud-avatar-desktop",
    );
    for (const [selector, minimum] of portrait
      ? ([
          [".hud-avatar-compact", 72],
          [".hud-avatar-mobile", 145],
        ] as const)
      : ([[".hud-avatar-desktop", 144]] as const)) {
      const box = (await page.locator(selector).boundingBox())!;
      const ringBounds = (await page
        .locator(`${selector} .hud-ring`)
        .boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(minimum);
      expect(box.height).toBeCloseTo(box.width, 1);
      expect(ringBounds).toEqual(box);
    }
    for (const [selector, minimum] of [
      ["#character-name", portrait ? 16 : 38],
      [".hud-stage, .hud-date", portrait ? 12 : 27],
      [".hud-turn dd, .hud-cash dd", portrait ? 13 : 29],
      [".hud-stat .hud-value", portrait ? 12 : 29],
      [".hud-menu-trigger", portrait ? 26 : 22],
      ...(layout.deity
        ? [[".hud-attached-detail", portrait ? 13 : 25] as const]
        : []),
    ] as const) {
      for (const element of await page.locator(selector).all()) {
        const text = await element.evaluate((node) => {
          const controls = node.closest(".board-controls")!;
          const panel = controls.getClientRects().length
            ? controls
            : node.closest(".board-status, .hud-bottom")!;
          const frame = panel.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(node);
          const fits = [...range.getClientRects()].every(
            (rect) =>
              rect.left >= frame.left - 1 &&
              rect.right <= frame.right + 1 &&
              rect.top >= frame.top - 1 &&
              rect.bottom <= frame.bottom + 1,
          );
          return {
            fontSize: parseFloat(getComputedStyle(node).fontSize),
            fits,
          };
        });
        expect(text.fontSize, selector).toBeGreaterThanOrEqual(minimum);
        if (!portrait)
          expect(text.fontSize, selector).toBeLessThanOrEqual(minimum + 1);
        expect(text.fits, selector).toBe(true);
        if (portrait && selector !== ".hud-menu-trigger")
          expect(text.fontSize, selector).toBeLessThanOrEqual(16);
      }
    }
    for (const stat of await page.locator(".hud-stat").all()) {
      const icon = (await stat.locator(".hud-stat-icon").boundingBox())!;
      const value = (await stat.locator("dd").boundingBox())!;
      const bar = (await stat.locator(".hud-meter").boundingBox())!;
      expect(icon.height).toBe(portrait ? 26 : 66);
      expect(bar.height).toBe(portrait ? 6 : 14);
      expect(icon.y + icon.height).toBeLessThanOrEqual(value.y);
      expect(value.y + value.height).toBeLessThanOrEqual(bar.y);
    }
    const diceButton = (await page.locator("#roll").boundingBox())!;
    expect(diceButton.x).toBeGreaterThanOrEqual(0);
    expect(diceButton.y).toBeGreaterThanOrEqual(0);
    expect(
      layout.width - diceButton.x - diceButton.width,
    ).toBeGreaterThanOrEqual(20);
    expect(
      layout.height - diceButton.y - diceButton.height,
    ).toBeGreaterThanOrEqual(20);
    await expect(avatar.locator(".hud-hero")).toHaveAttribute(
      "src",
      /girl-junior-256\.webp/,
    );
    const tone = !layout.deity
      ? "normal"
      : layout.deity.id === "empty-bag"
        ? "bad"
        : "good";
    await expect(avatar).toHaveAttribute("data-tone", tone);
    const ring =
      tone === "good"
        ? "avatar-halo"
        : tone === "bad"
          ? "avatar-ring-red"
          : "avatar-ring";
    await expect(avatar.locator(".hud-ring")).toHaveAttribute(
      "src",
      new RegExp(ring),
    );

    if (tone === "bad") {
      const geometry = await avatar.evaluate(async (button) => {
        const actual = button.querySelector<HTMLImageElement>(".hud-ring")!;
        const normal = new Image();
        normal.src = actual.src.replace("avatar-ring-red", "avatar-ring");
        await Promise.all([normal.decode(), actual.decode()]);
        return {
          sameSize:
            normal.naturalHeight === actual.naturalHeight &&
            normal.naturalWidth === actual.naturalWidth,
          radius: getComputedStyle(button).borderRadius,
        };
      });
      expect(geometry).toEqual({ sameSize: true, radius: "50%" });
    }

    const assertLayout = async () => {
      const map = (await page.locator(".board-map").boundingBox())!;
      expect(map.x).toBe(0);
      expect(map.width).toBe(layout.width);
      for (const selector of portrait
        ? [".board-status", ".hud-bottom"]
        : [".board-controls"]) {
        const hud = (await page.locator(selector).boundingBox())!;
        expect(
          map.x + map.width <= hud.x ||
            map.y + map.height <= hud.y ||
            hud.y + hud.height <= map.y,
        ).toBe(true);
        expect(hud.y + hud.height).toBeLessThanOrEqual(layout.height);
      }
      const controls = page.locator(".board-controls button:visible");
      for (const button of await controls.all()) {
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    };
    await assertLayout();
    if (portrait) {
      const top = (await page.locator(".board-status").boundingBox())!;
      const board = (await page.locator(".board-map").boundingBox())!;
      expect(top.height).toBeLessThanOrEqual(130);
      expect(board.height).toBeGreaterThanOrEqual(500);
      const cash = (await page.locator(".hud-cash").boundingBox())!;
      const turn = (await page.locator(".hud-turn").boundingBox())!;
      if (layout.deity) {
        const deity = (await page.locator(".hud-attached").boundingBox())!;
        expect(deity.y).toBeCloseTo(cash.y, -1);
        expect(cash.x + cash.width).toBeLessThanOrEqual(deity.x);
        expect(deity.x + deity.width).toBeLessThanOrEqual(turn.x);
      }
    }
    const scene = (await page.locator(".board-world").boundingBox())!;
    const viewport = (await page.locator(".board-map").boundingBox())!;
    expect(scene.x).toBeLessThanOrEqual(viewport.x + 0.5);
    expect(scene.y).toBeLessThanOrEqual(viewport.y + 0.5);
    expect(scene.x + scene.width).toBeGreaterThanOrEqual(
      viewport.x + viewport.width - 0.5,
    );
    expect(scene.y + scene.height).toBeGreaterThanOrEqual(
      viewport.y + viewport.height - 0.5,
    );
    if (process.env.HUD_SCREENSHOTS) {
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images]
            .filter((img) => img.src)
            .map((img) => img.decode()),
        );
      });
      await page.screenshot({
        path: `${process.env.HUD_SCREENSHOTS}/${layout.name}.png`,
      });
    }
    const worldBeforeDrawer = await page.locator(".board-world").boundingBox();
    await avatar.click();
    await expect(page.getByRole("region", { name: "棋盤選單" })).toBeVisible();
    await expect(page.locator(".hud-badges-drawer")).toContainText("人生經驗");
    if (layout.deity) {
      const deity = tone === "bad" ? "空袋客・3 回合" : "晴空爺・4 回合";
      await expect(page.locator(".hud-badges-drawer")).toContainText(deity);
      if (!portrait)
        await expect(page.locator(".hud-attached")).toHaveText(deity);
    }
    await assertLayout();
    expect(await page.locator(".board-map").boundingBox()).toEqual(viewport);
    expect(await page.locator(".board-world").boundingBox()).toEqual(
      worldBeforeDrawer,
    );
    if (process.env.HUD_SCREENSHOTS && layout.name === "desktop-1280x800") {
      await page.screenshot({
        path: `${process.env.HUD_SCREENSHOTS}/landscape-drawer.png`,
      });
    }
    await page.keyboard.press("Escape");
    await expect(avatar).toBeFocused();
  });
}

test("all 42 tiles fit in the landscape board at 1280×800 and a larger desktop", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadBoard(page);
  const map = page.locator(".board-map");
  await expect(map.locator(".board-tile")).toHaveCount(42);
  for (const size of [
    { width: 1280, height: 800 },
    { width: 1600, height: 1000 },
  ]) {
    await page.setViewportSize(size);
    const clipped = await map.evaluate((board) => {
      const frame = board.getBoundingClientRect();
      return [...board.querySelectorAll(".board-tile")]
        .filter((tile) => {
          const box = tile.getBoundingClientRect();
          return (
            box.left < frame.left - 0.5 ||
            box.right > frame.right + 0.5 ||
            box.top < frame.top - 0.5 ||
            box.bottom > frame.bottom + 0.5
          );
        })
        .map((tile) => tile.getAttribute("data-tile"));
    });
    expect(clipped).toEqual([]);
    const bounds = (await map.boundingBox())!;
    expect(bounds.x).toBe(0);
    expect(bounds.width).toBe(size.width);
    expect(bounds.y + bounds.height).toBe(size.height);
    const roll = (await page.locator("#roll").boundingBox())!;
    expect(roll.width).toBeGreaterThanOrEqual(88);
    expect(size.width - roll.x - roll.width).toBeGreaterThanOrEqual(20);
    expect(size.height - roll.y - roll.height).toBeGreaterThanOrEqual(20);
    const covered = await map.locator(".board-tile, .board-pawn").evaluateAll(
      (pieces, die) =>
        pieces
          .filter((piece) => {
            const bounds = piece.getBoundingClientRect();
            return (
              bounds.left < die.x + die.width &&
              bounds.right > die.x &&
              bounds.top < die.y + die.height &&
              bounds.bottom > die.y
            );
          })
          .map((piece) => piece.getAttribute("data-tile")),
      roll,
    );
    expect(covered).toEqual([]);
  }
});

for (const size of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`dice settles before the pawn starts moving at ${size.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await loadBoard(page);
    const roll = page.locator("#roll");
    const flight = page.locator(".board-dice-flight");
    const pawn = page.locator(".board-pawn");
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1_000));
    await roll.evaluate((button: HTMLButtonElement) => button.click());
    await expect(flight).toHaveAttribute("data-phase", "rolling");
    await expect(roll).toBeDisabled();
    await expect(pawn.locator('[data-pose="stand"]')).toHaveAttribute(
      "visibility",
      "visible",
    );
    if (process.env.HUD_SCREENSHOTS && size.width === 1280) {
      await page.evaluate(async () => {
        const flight = document.querySelector(".board-dice-flight")!;
        for (const motion of flight.getAnimations({ subtree: true })) {
          motion.pause();
          motion.currentTime = 360;
        }
      });
      await page.screenshot({
        path: `${process.env.HUD_SCREENSHOTS}/dice-rolling.png`,
      });
    }
    await page.clock.runFor(1_000);
    await expect(flight).toHaveAttribute("data-phase", "settled");
    await expect(flight.locator('.flight-die[data-face="2"]')).toHaveCount(2);
    await expect(pawn.locator('[data-pose="stand"]')).toHaveAttribute(
      "visibility",
      "visible",
    );
    await expect(roll).toBeDisabled();
    await page.clock.runFor(520);
    await expect(flight).toHaveCount(0);
    await expect(pawn.locator('[data-pose="stand"]')).toHaveAttribute(
      "visibility",
      "hidden",
    );
  });
}

test("dice disables through pawn movement and the landing popup", async ({
  page,
}) => {
  await loadBoard(page, { boardTile: 5, previousTile: 4 });
  const roll = page.getByRole("button", { name: "擲骰" });
  await roll.click();
  await expect(roll).toBeDisabled();
  await expect(page.locator(".hud-die-disabled")).toBeVisible();
  await expect(page.locator(".board-pawn")).not.toHaveAttribute(
    "data-tile",
    "5",
  );
  await expect(roll).toBeDisabled();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "小考", exact: true }),
  ).toBeVisible();
  await expect(roll).toBeDisabled();
  for (let question = 0; question < 5; question++) {
    await dialog.locator(".assessment-option").first().click();
  }
  await dialog.getByRole("button", { name: "確定", exact: true }).click();
  await expect(roll).toBeEnabled();
  await expect(page.locator(".dice")).toHaveText("22");
});

test("mounted HUD updates avatars, grade, targets and value motion", async ({
  page,
}) => {
  await page.goto("/");
  const results = await page.evaluate(async (save) => {
    // Mount the HUD on its own to check value changes across every stage.
    const moduleUrl = "/src/board-hud.ts";
    const { boardHud, boardHudMarkup } = await import(moduleUrl);
    const fixture = document.createElement("div");
    fixture.innerHTML = boardHudMarkup(false);
    document.body.replaceChildren(fixture);
    const hud = boardHud(fixture, 15);
    hud.update(save);
    return (["elementary", "junior", "high", "university"] as const).map(
      (stage, index) => {
        const gender = index % 2 ? "girl" : "boy";
        hud.update({
          ...save,
          stage,
          gender,
          turn: 5,
          stats: { ...save.stats, intellect: 9999 },
          cash: save.cash + 300,
        });
        const meter = fixture.querySelector(
          '[data-stat="intellect"] [role="meter"]',
        )!;
        return {
          avatar: fixture.querySelector<HTMLImageElement>(
            ".hud-avatar-desktop .hud-hero",
          )!.src,
          stageLabel: fixture.querySelector(".hud-stage")!.textContent,
          target: meter.getAttribute("aria-valuemax"),
          now: meter.getAttribute("aria-valuenow"),
          over: meter.getAttribute("data-over"),
          statDelta: fixture.querySelector(".hud-stat .hud-delta")?.textContent,
          cashDelta: fixture.querySelector(".hud-cash .hud-delta")?.textContent,
        };
      },
    );
  }, boardSave);
  for (const [index, [stage, label, target]] of [
    ["boy-elem", "小學", "100"],
    ["girl-junior", "國中 2 年級", "200"],
    ["boy-high", "高中 1 年級", "350"],
    ["girl-uni", "大學 1 年級", "500"],
  ].entries()) {
    expect(results[index].avatar).toMatch(`avatar-${stage}-256.webp`);
    expect(results[index]).toMatchObject({
      stageLabel: label,
      target,
      now: target,
      over: "true",
    });
  }
  expect(results[0]).toMatchObject({ statDelta: "+9,826", cashDelta: "+300" });
});

for (const [direction, width, height] of [
  ["landscape", 1280, 800],
  ["portrait", 390, 844],
] as const) {
  test(`HUD 外框 ${direction} 順時針循環並支援減少動態效果`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await loadBoard(page);
    const frames = page.locator(".hud-frame-light:visible");
    await expect(frames).toHaveCount(direction === "landscape" ? 1 : 2);
    for (const frame of await frames.all()) {
      await expect(frame).toBeInViewport({ ratio: 1 });
      const { start, later, duration, iterations } = await frame.evaluate(
        (svg) => {
          const animation = svg.getAnimations()[0];
          animation.pause();
          const { duration, iterations } = animation.effect!.getTiming();
          const trail = svg.querySelector("rect")!;
          animation.currentTime = 0;
          const start = Number.parseFloat(
            getComputedStyle(trail).strokeDashoffset,
          );
          animation.currentTime = 1250;
          const later = Number.parseFloat(
            getComputedStyle(trail).strokeDashoffset,
          );
          animation.currentTime = 2250;
          return { start, later, duration, iterations: String(iterations) };
        },
      );
      expect(start).toBeCloseTo(20);
      expect(later).toBeCloseTo(-5);
      expect(duration).toBe(5000);
      expect(iterations).toBe("Infinity");
    }
    const directory = process.env.STEP_9A_FRAME_SCREENSHOTS;
    if (directory)
      await page.screenshot({
        path: `${directory}/hud-light-${direction}.jpg`,
        quality: 93,
      });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(frames).toHaveCount(0);
    await expect(page.locator("#roll")).toBeVisible();
  });
}
