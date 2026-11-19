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
    name: "mumu-landscape-good-960x540",
    width: 960,
    height: 540,
    deity: { id: "sky-elder", remainingTurns: 4 },
  },
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
    name: "mumu-portrait-bad-over-target-540x960",
    width: 540,
    height: 960,
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
    if (
      process.env.HUD_SCREENSHOTS &&
      (portrait ? layout.over : tone === "good")
    ) {
      const screenshot = portrait ? "mumu-portrait-drawer" : "landscape-drawer";
      await page.screenshot({
        path: `${process.env.HUD_SCREENSHOTS}/${screenshot}.png`,
      });
    }
    await page.keyboard.press("Escape");
    await expect(avatar).toBeFocused();
  });
}

test("all 42 tiles fit in the landscape board at both requested sizes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadBoard(page);
  const map = page.locator(".board-map");
  await expect(map.locator(".board-tile")).toHaveCount(42);
  for (const size of [
    { width: 1280, height: 800 },
    { width: 960, height: 540 },
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
  }
});

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
    // The other school boards aren't routed in this MVP. Mount the same HUD
    // independently to cover every stage without adding new game entry points.
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
    ["boy-high", "高中", "350"],
    ["girl-uni", "大學", "500"],
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
