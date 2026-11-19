import { expect, test, type Page } from "@playwright/test";
import { schoolBoards, type BoardStage } from "../../src/data/school-board";
import { chooseClub } from "../../src/game/clubs";
import { questionBank } from "../../src/game/questions";
import { createSave, type Save } from "../../src/game/saves";
import { enterSchool } from "../../src/game/school";

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
const landscape = { width: 1280, height: 800 };
const portrait = { width: 390, height: 844 };
const reviewPath = process.env.SCHOOL_SCREENSHOTS;

function schoolSave(stage: Exclude<BoardStage, "junior">): Save {
  let save = enterSchool(player, "high");
  save = chooseClub(
    { ...save, stageIntroSeen: ["high"], education: "junior" },
    "high",
  );
  if (stage === "high") return save;
  save = enterSchool(save, "university");
  return chooseClub(
    { ...save, stageIntroSeen: ["high", "university"], education: "high" },
    "university",
  );
}

function completeScheduledContests(save: Save): Save {
  const matchNumbers = save.stage === "university" ? [1, 2] : [1];
  const stage = save.stage === "university" ? "university" : "high";
  return {
    ...save,
    competitions: [
      { stage: "junior", matchNumber: 1, event: "style", score: 180, rank: 1 },
      ...(stage === "university"
        ? [
            {
              stage: "high",
              matchNumber: 1,
              event: "style",
              score: 300,
              rank: 1,
            } as const,
          ]
        : []),
      ...matchNumbers.map(
        (matchNumber) =>
          ({
            stage,
            matchNumber,
            event: "style",
            score: 450,
            rank: 1,
          }) as const,
      ),
    ],
  };
}

async function openSlot(page: Page) {
  await page.getByRole("button", { name: "繼續遊戲" }).click();
  await page.locator("#use-0").click();
}

async function seed(
  page: Page,
  save: Save,
  debug: boolean | "road" = false,
  reducedMotion = true,
) {
  await page.emulateMedia({
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
  });
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(save));
      let calls = 0;
      Math.random = () => (++calls <= 3 ? 0.08 : 0.45);
    },
    { key: slot, save },
  );
  await page.goto(
    debug ? `/?debug=${debug === "road" ? "road" : "path"}` : "/",
  );
  await openSlot(page);
}

async function capture(page: Page, name: string) {
  if (!reviewPath) return;
  await page
    .locator("img:visible")
    .evaluateAll((images) =>
      Promise.all(images.map((img) => (img as HTMLImageElement).decode())),
    );
  await page.screenshot({ path: `${reviewPath}/${name}.jpg`, quality: 89 });
}

async function checkTiles(page: Page, stage: BoardStage) {
  const board = schoolBoards[stage];
  await expect(page.locator(".board-tile")).toHaveCount(board.tiles.length);
  const tops = page.locator(".paver-top");
  await expect(tops).toHaveCount(board.tiles.length);
  const valid = await tops.evaluateAll(async (images) =>
    Promise.all(
      images.map(async (node) => {
        const image = new Image();
        image.src = node.getAttribute("href")!;
        await image.decode();
        const box = (node as SVGImageElement).getBBox();
        return image.naturalWidth > 0 && box.width > 0 && box.height > 0;
      }),
    ),
  );
  expect(valid.every(Boolean)).toBe(true);
  expect(
    await page.locator(".board-track").evaluate((svg) => {
      const track = svg.querySelector(".board-depth")!;
      const pawn = svg.querySelector(".board-pawn")!;
      return Boolean(
        track.compareDocumentPosition(pawn) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }),
  ).toBe(true);
  await expect(page.locator(".pawn-glow")).toHaveCount(0);
}

for (const viewport of [landscape, portrait]) {
  const direction = viewport === landscape ? "landscape" : "portrait";
  test.describe(direction, () => {
    test.use({ viewport });
    for (const stage of ["high", "university"] as const) {
      const name = stage === "high" ? "高中" : "大學";
      test(`${name}第 0 回、地磚、儀表板和擲骰`, async ({ page }) => {
        await seed(page, schoolSave(stage));
        await expect(
          page.getByRole("group", { name: `${name}地圖` }),
        ).toBeVisible();
        await expect(page.locator(".hud-stage")).toHaveText(`${name} 1 年級`);
        await expect(page.locator(".hud-turn dd")).toHaveText(
          `1 ／ ${schoolBoards[stage].turns}`,
        );
        await expect(page.locator(".hud-hero:visible").first()).toHaveAttribute(
          "src",
          new RegExp(`avatar-girl-${stage === "high" ? "high" : "uni"}-`),
        );
        await checkTiles(page, stage);
        const overview = page.locator("#overview");
        if ((await overview.getAttribute("aria-pressed")) === "false") {
          await page.locator(".hud-avatar-mobile").click();
          await overview.click();
        }
        await capture(page, `${stage}-overview-${direction}`);
        await page.locator("#roll").click();
        await page.getByRole("button", { name: "確定", exact: true }).click();
        await expect(page.locator(".hud-turn dd")).toHaveText(
          `2 ／ ${schoolBoards[stage].turns}`,
        );
        await expect(page.locator(".board-pawn")).toHaveAttribute(
          "data-tile",
          "2",
        );
      });

      if (reviewPath)
        test(`${name}地圖路線與格子 ID`, async ({ page }) => {
          await seed(page, schoolSave(stage), true);
          const overview = page.locator("#overview");
          await expect(
            page.getByRole("heading", { name: `${name}棋盤` }),
          ).toHaveText(`${name}棋盤`);
          if ((await overview.getAttribute("aria-pressed")) === "false") {
            await page.locator(".hud-avatar-mobile").click();
            await overview.click();
          }
          await expect(page.locator(".path-debug text")).toHaveCount(
            schoolBoards[stage].tiles.length,
          );
          await expect(
            page.locator("[data-clearance-tile][data-overlap=false]"),
          ).toHaveCount(schoolBoards[stage].tiles.length);
          await expect(
            page.locator("[data-clearance-tile][data-overlap=true]"),
          ).toHaveCount(0);
          await capture(page, `${stage}-debug-${direction}`);
        });
    }

    test("高中最後一回進聯考，供錄取及落榜", async ({ page }) => {
      const pass = viewport === landscape;
      const save = completeScheduledContests(schoolSave("high"));
      await seed(page, {
        ...save,
        turn: 24,
        stats: { ...save.stats, intellect: 320 },
      });
      await expect(page.locator(".hud-turn dd")).toHaveText("25 ／ 25");
      await page.locator("#roll").click();
      await expect(
        page.getByRole("dialog", { name: /黑板|吉祥|校慶|./ }),
      ).toBeVisible();
      if (pass) await capture(page, "high-event");
      await page.getByRole("button", { name: "確定", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "大學聯考", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "智力輔助" }).click();
      await expect(page.getByRole("button", { name: /已排除/ })).toBeDisabled();
      if (pass) {
        await capture(page, "university-exam");
        await page.reload();
        await openSlot(page);
        await expect(
          page.getByRole("button", { name: /已排除/ }),
        ).toBeDisabled();
      }
      for (let i = 0; i < 10; i++) {
        const prompt = await page.locator(".assessment-question").textContent();
        const question = questionBank.find((q) => q.prompt === prompt)!;
        const answer = question.options.findIndex(
          (option, j) =>
            option.correct === i < (pass ? 6 : 5) &&
            !(i === 0 && j === question.options.findIndex((o) => !o.correct)),
        );
        await page.locator(".assessment-option").nth(answer).click();
      }
      await expect(
        page.getByRole("heading", { name: "大學聯考放榜" }),
      ).toBeVisible();
      await capture(
        page,
        pass ? "university-exam-pass" : "university-exam-fail",
      );
      await page
        .getByRole("button", { name: pass ? "前往大學篇" : "查看結局" })
        .click();
      if (pass) {
        await expect(
          page.getByRole("heading", { name: "進入大學" }),
        ).toBeVisible();
        await capture(page, "university-intro");
        await page.getByRole("button", { name: "開始", exact: true }).click();
        await page.getByRole("button", { name: /保留研習社/ }).click();
        await expect(page.locator(".hud-turn dd")).toHaveText("1 ／ 40");
        await page.reload();
        await openSlot(page);
        await expect(page.locator(".hud-turn dd")).toHaveText("1 ／ 40");
        await expect(page.getByRole("dialog")).toHaveCount(0);
      } else {
        await expect(
          page.getByRole("heading", { name: "聯考落榜" }),
        ).toBeVisible();
        await expect(page.getByText("之後可解鎖隱藏職業")).toBeVisible();
        await capture(page, "university-fail-ending");
        await page.getByRole("button", { name: "下一章預告" }).click();
        await expect(page.getByText("社會篇敬請期待")).toBeVisible();
      }
    });

    test("大學第 40 回畢業、結算與預告", async ({ page }) => {
      const save = completeScheduledContests(schoolSave("university"));
      await seed(page, {
        ...save,
        turn: 39,
        stats: { ...save.stats, intellect: 9999 },
      });
      await expect(page.locator(".hud-stage")).toHaveText("大學 4 年級");
      await expect(page.locator(".hud-turn dd")).toHaveText("40 ／ 40");
      await capture(page, `university-hud-${direction}`);
      await page.locator("#roll").click();
      await expect(page.getByRole("dialog")).toContainText("戀愛系統即將開放");
      if (viewport === portrait) await capture(page, "university-love");
      await page.getByRole("button", { name: "確定", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "大學畢業", exact: true }),
      ).toBeVisible();
      if (viewport === landscape) await capture(page, "graduation");
      await page.getByRole("button", { name: "查看結算" }).click();
      await expect(
        page.getByRole("heading", { name: "大學畢業結算" }),
      ).toBeVisible();
      await expect(page.getByText("交往對象 —")).toBeVisible();
      await expect(page.getByText("9999", { exact: true })).toBeVisible();
      await capture(page, `graduation-summary-${direction}`);
      await page.getByRole("button", { name: "下一章預告" }).click();
      await expect(page.getByText("社會篇敬請期待")).toBeVisible();
      if (viewport === landscape) await capture(page, "next-chapter");
    });
  });
}

test("舊高中存檔在起點換裝、換社後重整仍可遊玩", async ({ page }) => {
  await page.setViewportSize(portrait);
  const save = {
    ...player,
    turn: 15,
    stage: "high",
    education: "junior",
  } as const;
  await seed(page, save);
  await expect(page.getByRole("heading", { name: "升上高中" })).toBeVisible();
  await capture(page, "high-intro");
  await page.getByRole("button", { name: "開始", exact: true }).click();
  await expect(page.getByRole("heading", { name: "高中換社" })).toBeVisible();
  await capture(page, "high-club");
  await page.getByRole("button", { name: /保留研習社/ }).click();
  await expect(page.locator("#roll")).toBeEnabled();
  await page.reload();
  await openSlot(page);
  await expect(page.locator(".hud-turn dd")).toHaveText("1 ／ 25");
  await expect(page.locator(".board-pawn")).toHaveAttribute("data-tile", "0");
  await expect(page.locator("#roll")).toBeEnabled();
});

test("高中第 13 回在手機橫向自動舉辦大賽", async ({ page }) => {
  await page.setViewportSize(landscape);
  await seed(page, { ...schoolSave("high"), turn: 12 });
  await expect(page.getByRole("dialog")).toContainText("虛擬城大賽");
  await expect(page.locator(".hud-stage")).toHaveText("高中 2 年級");
  await expect(page.locator(".hud-turn dd")).toHaveText("13 ／ 25");
  await capture(page, "high-hud-contest");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole("button", { name: /風采秀/ })).toBeInViewport({
    ratio: 1,
  });
  await page.getByRole("button", { name: /風采秀/ }).click();
  await page.locator("dialog[open] .activity-option").first().click();
  await page.getByRole("button", { name: "確定", exact: true }).click();
  await expect(page.locator("#roll")).toBeEnabled();
});

test("載入新校園素材失敗後可以重試", async ({ page }) => {
  await page.setViewportSize(landscape);
  const map = "**/map_high_noroad_landscape_final.jpg";
  await page.route(map, (route) => route.abort());
  await seed(page, schoolSave("high"));
  await expect(
    page.getByRole("heading", { name: "校園素材載入失敗" }),
  ).toBeVisible();
  await page.unroute(map);
  await page.getByRole("button", { name: "重試" }).click();
  await expect(page.getByRole("heading", { name: "高中棋盤" })).toBeAttached();
});

if (reviewPath) {
  test("大學普通事件使用學段自己的文案與場景", async ({ page }) => {
    await page.setViewportSize(landscape);
    const board = schoolBoards.university;
    const target = board.tiles.findIndex(
      ({ kind }, i) =>
        kind === "event" &&
        i > 2 &&
        board.tiles.slice(i - 2, i).every((tile) => tile.kind !== "fork"),
    );
    await seed(page, { ...schoolSave("university"), boardTile: target - 2 });
    await page.locator("#roll").click();
    await expect(page.locator(".event-dialog[open] .event-npc")).toBeVisible();
    await capture(page, "university-event");
  });

  for (const stage of ["high", "university"] as const) {
    for (const [gender, direction] of [
      ["boy", "front"],
      ["girl", "back"],
    ] as const) {
      test(`${stage} ${gender} ${direction}走路幀`, async ({ page }) => {
        const { layouts, tiles } = schoolBoards[stage];
        const { cells } = layouts.landscape;
        const start = cells.findIndex(([x, y], index) => {
          if (index < 5 || tiles[index].kind === "fork") return false;
          const [tx, ty] = cells[tiles[index].next[0]];
          return direction === "front" ? tx + ty > x + y : tx + ty < x + y;
        });
        await page.setViewportSize(landscape);
        await seed(
          page,
          { ...schoolSave(stage), gender, boardTile: start },
          false,
          false,
        );
        await page.locator(".hud-menu-trigger").click();
        await page.locator("#overview").click();
        await page.locator("#roll").click();
        const moving = page.locator(
          `[id^=pawn-pose-${direction}][visibility=visible]`,
        );
        await expect(moving).toHaveCount(1);
        await capture(page, `${stage}-walk-${gender}-${direction}`);
      });
    }

    test(`${stage} 前景遮擋用剪影`, async ({ page }) => {
      await page.setViewportSize(landscape);
      await seed(page, {
        ...schoolSave(stage),
        boardTile: stage === "high" ? 18 : 35,
      });
      await page.locator(".hud-menu-trigger").click();
      await page.locator("#overview").click();
      await expect(page.locator(".pawn-silhouette")).toHaveAttribute(
        "href",
        "#pawn-pose-stand",
      );
      expect(
        await page.locator("[data-mask-depth][visibility=visible]").count(),
      ).toBeGreaterThan(0);
      await capture(page, `${stage}-follow-silhouette`);
    });
  }
}

for (const viewport of [landscape, { width: 1280, height: 720 }, portrait]) {
  test(`兩學段換裝卡片在 ${viewport.width}×${viewport.height} 等大`, async ({
    browser,
  }) => {
    const layouts = [];
    for (const stage of ["high", "university"] as const) {
      const page = await browser.newPage({ viewport });
      try {
        const save = schoolSave(stage);
        await seed(page, {
          ...save,
          stageIntroSeen: save.stageIntroSeen.filter((seen) => seen !== stage),
        });
        const card = page.locator(".assessment-card");
        const heading = page.getByRole("heading", {
          name: stage === "high" ? "升上高中" : "進入大學",
        });
        const hero = card.locator(".school-hero");
        const start = card.getByRole("button", { name: "開始", exact: true });
        await expect(heading).toBeVisible();
        await expect(start).toBeInViewport({ ratio: 1 });
        await expect(hero).toHaveCSS("object-fit", "contain");
        const bounds = (await card.boundingBox())!;
        const heroHeight = (await hero.boundingBox())!.height;
        expect(heroHeight).toBeGreaterThan(bounds.height / 2);
        layouts.push({
          width: bounds.width,
          height: bounds.height,
          heroHeight,
          headingFont: await heading.evaluate(
            (node) => getComputedStyle(node).fontSize,
          ),
          startHeight: (await start.boundingBox())!.height,
        });
        if (viewport.height !== 720)
          await capture(
            page,
            `${stage}-intro-${viewport === portrait ? "portrait" : "landscape"}`,
          );
      } finally {
        await page.close();
      }
    }
    expect(layouts[0]).toEqual(layouts[1]);
  });
}

for (const [viewport, gender] of [
  [landscape, "boy"],
  [portrait, "girl"],
] as const) {
  test(`大學 ${gender} 儀表板顯示新版頭像`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seed(page, { ...schoolSave("university"), gender });
    const avatar = page.locator(
      viewport === portrait
        ? ".hud-avatar-mobile .hud-hero"
        : ".hud-avatar-desktop .hud-hero",
    );
    await expect(avatar).toHaveAttribute(
      "src",
      new RegExp(`avatar-${gender}-uni-256`),
    );
    await expect(avatar).toBeVisible();
    await capture(
      page,
      `university-avatar-${viewport === portrait ? "portrait" : "landscape"}`,
    );
  });
}

for (const [stage, filename] of [
  ["high", "high"],
  ["university", "uni"],
] as const) {
  test(`${stage} 有路版對照顯示跑道與同一套地磚`, async ({ page }) => {
    await page.setViewportSize(landscape);
    await seed(page, schoolSave(stage), "road");
    await expect(page.locator(".board-world picture img")).toHaveAttribute(
      "src",
      new RegExp(`map_${filename}_landscape_final`),
    );
    await expect(page.locator(".road-centerline")).toHaveCount(3);
    await expect(page.locator("[data-road-face]")).toHaveCount(
      schoolBoards[stage].tiles.length,
    );
    await expect(
      page.locator("[data-clearance-tile][data-overlap=false]"),
    ).toHaveCount(schoolBoards[stage].tiles.length);
    await expect(
      page.locator("[data-clearance-tile][data-overlap=true]"),
    ).toHaveCount(0);
    await capture(page, `${stage}-painted-road-landscape`);
  });
}
