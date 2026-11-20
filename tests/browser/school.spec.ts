import { expect, test, type Page } from "@playwright/test";
import { measureTrack } from "../../src/board-track";
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
  random = 0.45,
) {
  await page.emulateMedia({
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
  });
  await page.addInitScript(
    ({ key, save, random }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(save));
      let calls = 0;
      Math.random = () => (++calls <= 3 ? 0.08 : random);
    },
    { key: slot, save, random },
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
        await expect
          .poll(() =>
            page
              .locator(".board-world picture img")
              .evaluate((node) => (node as HTMLImageElement).currentSrc),
          )
          .toMatch(
            new RegExp(
              `map_${stage === "high" ? "high" : "uni"}_noroad_${direction}_v2`,
            ),
          );
        const overview = page.locator("#overview");
        if ((await overview.getAttribute("aria-pressed")) === "false") {
          await page.locator(".hud-avatar-mobile").click();
          await overview.click();
        }
        await capture(page, `step-8h-${stage}-overview-${direction}`);
        await page.locator("#roll").click();
        await page
          .getByRole("button", {
            name: stage === "high" ? "離開" : "確定",
            exact: true,
          })
          .click();
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
          await expect(page.locator("[data-clearance-tile]")).toHaveCount(
            schoolBoards[stage].tiles.length,
          );
          await capture(page, `${stage}-debug-${direction}`);
        });
    }

    test("高中最後一回進聯考，供錄取及落榜", async ({ page }) => {
      const pass = viewport === landscape;
      const save = completeScheduledContests(schoolSave("high"));
      await seed(page, {
        ...save,
        turn: 24,
        boardTile: 1,
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
  const map = "**/map_high_noroad_landscape_v2.jpg";
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
        const { centers } = measureTrack(layouts.landscape);
        const start = centers.findIndex(({ y }, index) => {
          if (index < 5 || tiles[index].kind === "fork") return false;
          const { y: ty } = centers[tiles[index].next[0]];
          return direction === "front" ? ty > y : ty <= y;
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

    test(`${stage} 樹冠與路燈可遮擋棋子`, async ({ page }) => {
      await page.setViewportSize(landscape);
      await seed(page, {
        ...schoolSave(stage),
        boardTile: 0,
      });
      await page.locator(".hud-menu-trigger").click();
      await page.locator("#overview").click();
      await expect(page.locator(".pawn-silhouette")).toHaveAttribute(
        "href",
        "#pawn-pose-stand",
      );
      const names = await page
        .locator(".board-scenery")
        .evaluateAll((scenery) =>
          scenery.map((item) => item.getAttribute("data-name")),
        );
      expect(names.length).toBeGreaterThan(0);
      expect(names.every((name) => /樹|路燈|燈串/.test(name!))).toBe(true);
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
    await expect(page.locator(".road-centerline")).toHaveCount(1);
    await expect(page.locator(".board-tile .paver-top")).toHaveCount(
      schoolBoards[stage].tiles.length,
    );
    await expect(page.locator("[data-clearance-tile]")).toHaveCount(
      schoolBoards[stage].tiles.length,
    );
    await expect(
      page.locator("[data-clearance-tile][data-overlap=true]"),
    ).toHaveCount(0);
    await capture(page, `${stage}-painted-road-landscape`);
  });
}

test("國中與高中使用相同原尺寸的方磚", async ({ browser }) => {
  const crops: string[] = [];
  const sizes: { width: number; height: number }[] = [];
  for (const [stage, save] of [
    ["junior", player],
    ["high", schoolSave("high")],
  ] as const) {
    const { layouts, tiles, start } = schoolBoards[stage];
    const layout = layouts.landscape;
    const { centers } = measureTrack(layout);
    const loop = [start];
    for (let id = tiles[start].next[0]; id !== start; id = tiles[id].next[0])
      loop.push(id);
    const cellAt = (i: number) =>
      layout.cells[loop[(i + loop.length) % loop.length]];
    const direction = (i: number) => {
      const [x, y] = cellAt(i);
      const [nextX, nextY] = cellAt(i + 1);
      return [nextX - x, nextY - y].join();
    };
    const score = (id: number) => {
      const { x, y } = centers[id];
      return Math.hypot(x / layout.width - 0.32, y / layout.height - 0.8);
    };
    const corner = loop
      .filter((_, i) => direction(i - 1) !== direction(i))
      .sort((a, b) => score(a) - score(b))[0];
    expect(corner).toBeDefined();

    const page = await browser.newPage({ viewport: landscape });
    try {
      await seed(page, save);
      const tile = page.locator(`.board-tile[data-tile="${corner}"]`);
      const top = tile.locator(".paver-top");
      await expect(tile.locator('use[href="#clay-body"]')).toHaveCount(2);
      const { x, y, width, height } = (await top.boundingBox())!;
      sizes.push(
        await top.evaluate((node, mapWidth) => {
          const matrix = (node as SVGImageElement).transform.baseVal.getItem(
            0,
          ).matrix;
          return { width: matrix.a / mapWidth, height: matrix.b / mapWidth };
        }, layout.width),
      );
      if (reviewPath) {
        await page.locator(".paver-top").evaluateAll(async (elements) =>
          Promise.all(
            elements.map((element) => {
              const image = new Image();
              image.src = element.getAttribute("href")!;
              return image.decode();
            }),
          ),
        );
        const crop = await page.screenshot({
          clip: {
            x: Math.max(
              0,
              Math.min(landscape.width - 324, Math.round(x + width / 2) - 162),
            ),
            y: Math.max(
              0,
              Math.min(landscape.height - 186, Math.round(y + height / 2) - 93),
            ),
            width: 324,
            height: 186,
          },
          type: "jpeg",
          quality: 92,
        });
        crops.push(crop.toString("base64"));
      }
    } finally {
      await page.close();
    }
  }
  expect(sizes[0].width).toBeCloseTo(sizes[1].width, 7);
  expect(sizes[0].height).toBeCloseTo(sizes[1].height, 7);
  if (reviewPath) {
    const page = await browser.newPage({
      viewport: { width: 678, height: 236 },
    });
    try {
      await page.setContent(`<body style="margin:0;background:#193941;color:white;display:flex;gap:10px;padding:10px;font:16px sans-serif">
        ${crops.map((src, i) => `<section><strong>${i === 0 ? "國中" : "高中"}</strong><br><img width="324" height="186" src="data:image/jpeg;base64,${src}"></section>`).join("")}
      </body>`);
      await capture(page, "junior-high-clay-detail");
    } finally {
      await page.close();
    }
  }
});

for (const [stage, viewport] of [
  ["junior", landscape],
  ["high", landscape],
  ["high", portrait],
  ["university", landscape],
  ["university", portrait],
] as const) {
  const direction = viewport === landscape ? "landscape" : "portrait";
  test(`${stage} ${direction} 走路自動跟拍並恢復全圖`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seed(
      page,
      stage === "junior" ? player : schoolSave(stage),
      false,
      false,
    );
    const overview = page.locator("#overview");
    if (direction === "portrait") {
      await page.locator(".hud-avatar-mobile").click();
      await overview.click();
    }
    const world = page.locator(".board-world");
    const zoom = () =>
      world.evaluate(
        (node) => new DOMMatrix(getComputedStyle(node).transform).a,
      );
    await expect.poll(zoom).toBe(1);
    await page.locator("#roll").click();
    await expect.poll(zoom).toBeGreaterThan(2.1);
    await expect(
      page.locator(".board-pawn image[id^=pawn-pose-][visibility=visible]"),
    ).toHaveAttribute("id", /^pawn-pose-(front|back)-/);
    await capture(page, `step-8h-${stage}-walk-${direction}`);
    await expect.poll(zoom).toBe(1);
    await expect(overview).toHaveAttribute("aria-pressed", "true");
  });
}

for (const [stage, tile, tree] of [
  ["high", 24, "西中粉紅樹"],
  ["university", 16, "東側中段樹冠與燈"],
] as const) {
  test(`${stage} 直版走到樹冠後方時顯示淡色剪影`, async ({ page }) => {
    await page.setViewportSize(portrait);
    await seed(page, { ...schoolSave(stage), boardTile: tile }, false, false);

    const track = page.locator(".board-track");
    await page.locator("#roll").click();
    await expect
      .poll(
        () =>
          track.evaluate((svg, name) => {
            const layer = [
              ...svg.querySelectorAll<SVGGElement>(".board-scenery"),
            ].find((item) => item.dataset.name === name)!;
            const id = layer.dataset.scenery;
            const cover = svg.querySelector(`[data-pawn-cover="${id}"]`);
            const outline = svg.querySelector<SVGPolygonElement>(
              `#scenery-outline-${id}`,
            )!;
            const pawn = svg.querySelector<SVGGElement>(".board-pawn")!;
            const pose = pawn.querySelector<SVGImageElement>(
              "image[visibility=visible]",
            )!;
            if (
              cover?.getAttribute("visibility") !== "visible" ||
              !/^pawn-pose-(front|back)-/.test(pose.id)
            )
              return false;

            const { e: x, f: y } = pawn.transform.baseVal.getItem(0).matrix;
            const height = pose.height.baseVal.value;
            const torso = [0.3, 0.5, 0.7].flatMap((level) =>
              [-10, 0, 10].map((offset) =>
                outline.isPointInFill(
                  new DOMPoint(x + offset, y - height * level),
                ),
              ),
            );
            const silhouette = svg.querySelector(".pawn-silhouette");
            return (
              torso.filter(Boolean).length >= 3 &&
              torso.includes(false) &&
              silhouette?.getAttribute("href") === `#${pose.id}`
            );
          }, tree),
        { intervals: [25, 50, 50] },
      )
      .toBe(true);
    await capture(page, `step-8h-${stage}-occlusion-portrait`);
  });
}

async function step9aReview(page: Page, name: string) {
  const directory = process.env.STEP_9A_SCREENSHOTS;
  if (!directory) return;
  await page
    .locator("img:visible")
    .evaluateAll((images) =>
      Promise.all(images.map((image) => (image as HTMLImageElement).decode())),
    );
  await page.screenshot({ path: `${directory}/${name}.jpg`, quality: 90 });
}

for (const [direction, viewport] of [
  ["landscape", landscape],
  ["portrait", portrait],
] as const) {
  test(`福利社 ${direction} 可購買、離開並存下限購`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seed(page, { ...schoolSave("high"), cash: 2300 });
    await page.locator("#roll").click();
    const dialog = page.getByRole("dialog", { name: "福利社" });
    const buy = dialog.getByRole("button", { name: /參考書套組/ });
    const leave = dialog.getByRole("button", { name: "離開" });
    await expect(dialog.getByText("現金 2,300 元")).toBeInViewport({
      ratio: 1,
    });
    await expect(leave).toBeInViewport({ ratio: 1 });
    await expect(
      dialog.getByRole("button", { name: /校慶福袋/ }),
    ).toBeEnabled();
    expect((await buy.boundingBox())!.height).toBeGreaterThanOrEqual(72);
    await buy.click();
    await expect(dialog.getByRole("status")).toContainText("智力 ＋10");
    await expect(buy).toContainText("剩餘限購 1 件");
    await expect(
      dialog.getByRole("button", { name: /校慶福袋/ }),
    ).toBeDisabled();
    await expect(dialog.getByText("現金 1,500 元")).toBeInViewport({
      ratio: 1,
    });
    await step9aReview(page, `shop-${direction}`);
    await buy.click();
    await expect(buy).toBeDisabled();
    await expect(buy).toContainText("剩餘限購 0 件");
    await dialog.getByRole("button", { name: /運動飲料/ }).click();
    await expect(dialog.getByRole("status")).toContainText("體能 ＋8");
    if (direction === "portrait") {
      await dialog
        .getByRole("button", { name: /校慶福袋/ })
        .scrollIntoViewIfNeeded();
      await expect(leave).toBeInViewport({ ratio: 1 });
      await expect(dialog.getByText("現金 200 元")).toBeInViewport({
        ratio: 1,
      });
    }
    await leave.click();
    await expect(page.locator("#roll")).toBeEnabled();
    const raw = await page.evaluate((key) => localStorage.getItem(key), slot);
    expect(JSON.parse(raw!).shopPurchases).toEqual([
      { stage: "high", itemId: "high-shop-notes", count: 2 },
      { stage: "high", itemId: "high-shop-drink", count: 1 },
    ]);
  });

  test(`社團選擇 ${direction} 先選擇才公布數字`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const portraitMode = direction === "portrait";
    const count = portraitMode ? 4 : 3;
    const save = schoolSave("high");
    await seed(
      page,
      {
        ...save,
        boardTile: 3,
        clubEventHistory: portraitMode ? ["high-club-01", "high-club-02"] : [],
      },
      false,
      true,
      0,
    );
    await page.locator("#roll").click();
    const dialog = page.getByRole("dialog", {
      name: portraitMode ? "校慶擺攤日" : "幹部改選",
    });
    const buttons = dialog.getByRole("button");
    await expect(buttons).toHaveCount(count);
    for (const button of await buttons.all()) {
      await expect(button).toBeInViewport({ ratio: 1 });
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(72);
      await expect(button.locator("img, span")).toHaveCount(0);
      await expect(button).not.toHaveText(/[↑↓＋－\d]/);
    }
    await step9aReview(page, `club-${count}-choices`);
    await buttons.first().click();
    await expect(dialog.locator(".activity-details")).toContainText(
      portraitMode ? "現金 ＋600" : "魅力 ＋18",
    );
    await step9aReview(page, `club-${count}-result`);
    await dialog.getByRole("button", { name: "確定" }).click();
    await expect(page.locator("#roll")).toBeEnabled();
    const raw = await page.evaluate((key) => localStorage.getItem(key), slot);
    expect(JSON.parse(raw!).clubHistory).toContainEqual(
      expect.objectContaining({ stage: "high", visits: 1 }),
    );
  });
}

if (process.env.STEP_9A_SCREENSHOTS) {
  test("愛情格近景", async ({ page }) => {
    await page.setViewportSize(landscape);
    await seed(page, schoolSave("university"));
    await page.locator("#roll").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("戀愛系統即將開放");
    await dialog.getByRole("button", { name: "確定" }).click();
    await expect(page.locator("#roll")).toBeEnabled();
    const icon = page.locator('[data-tile="2"] .paver-top');
    const box = (await icon.boundingBox())!;
    await page.screenshot({
      path: `${process.env.STEP_9A_SCREENSHOTS}/love-tile.jpg`,
      quality: 95,
      style: ".board-pawn { display: none; }",
      clip: {
        x: box.x - 35,
        y: box.y - 25,
        width: box.width + 70,
        height: box.height + 50,
      },
      scale: "device",
    });
  });
}
