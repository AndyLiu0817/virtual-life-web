import { expect, test, type Page } from "@playwright/test";

async function skipMinigame(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "開始", exact: true })
    .click();
  await page.clock.fastForward(61_000);
}

test("手機直向開局、重新整理讀檔，旋轉後轉移存檔", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "未來人生・進行曲" }),
  ).toBeVisible();
  const backdrop = page.locator("picture img");
  await expect
    .poll(() =>
      backdrop.evaluate((img) => (img as HTMLImageElement).currentSrc),
    )
    .toContain("title_kv_portrait_final");
  await expect(page.getByRole("button", { name: "繼續遊戲" })).toBeDisabled();
  await page.getByRole("button", { name: "開始新人生" }).click();
  await page.getByText("女主角", { exact: true }).click();
  await page.getByLabel("名字").fill("安安");
  await page.getByLabel("星座").selectOption("天蠍");
  await expect(page.getByLabel("出生季節")).toHaveValue("秋季");
  await page.getByLabel("血型").selectOption("AB");
  await page.getByRole("button", { name: "查看開局結果" }).click();
  await expect(page.getByText("140", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "確認開局" }).click();
  await page.getByRole("button", { name: /研習社/ }).click();
  await expect(page.getByRole("heading", { name: "國中棋盤" })).toBeVisible();
  await expect
    .poll(() =>
      backdrop.evaluate((img) => (img as HTMLImageElement).currentSrc),
    )
    .toContain("map_junior_noroad_portrait_final");
  await expect(page.getByText("5,000 元")).toBeVisible();
  await page.getByRole("button", { name: "選單", exact: true }).click();
  await page.getByRole("button", { name: "儲存到存檔格" }).click();
  await page.locator("#use-1").click();
  await expect(page.getByRole("status")).toContainText("已儲存至存檔格 1");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "選單", exact: true }).click();
  await page.getByRole("button", { name: "匯出存檔" }).click();
  const download = await downloading;
  const exported = await download.path();

  await page.reload();
  await page.setViewportSize({ width: 960, height: 540 });
  await expect
    .poll(() =>
      backdrop.evaluate((img) => (img as HTMLImageElement).currentSrc),
    )
    .toContain("title_kv_landscape_final");
  await page.getByRole("button", { name: "繼續遊戲" }).click();
  await page.locator("#use-0").click();
  await expect(page.getByRole("heading", { name: "安安" })).toBeVisible();
  await expect
    .poll(() =>
      backdrop.evaluate((img) => (img as HTMLImageElement).currentSrc),
    )
    .toContain("map_junior_noroad_landscape_final");
  await page.getByRole("button", { name: "選單", exact: true }).click();
  await page.getByRole("button", { name: "回標題" }).click();

  await page.locator("#file").setInputFiles({
    name: "壞掉.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(page.getByRole("status")).toContainText("無法讀取存檔");
  await page.locator("#file").setInputFiles(exported);
  await page.locator("#use-3").click();
  await expect(page.getByRole("status")).toContainText("已匯入至存檔格 3");
  await expect(page.getByRole("heading", { name: "安安" })).toBeVisible();
});

test("岔路選擇、跨回合自動存檔、旋轉與結束畫面", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    // 兩顆骰子各擲出 2，首回合恰好停在第一個岔路。
    Math.random = () => 0.2;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "開始新人生" }).click();
  await page.getByLabel("名字").fill("小宇");
  await page.getByRole("button", { name: "查看開局結果" }).click();
  await page.getByRole("button", { name: "確認開局" }).click();
  await page.getByRole("button", { name: /研習社/ }).click();

  const tile = page.locator(".board-tile");
  const pawn = page.locator(".board-pawn");
  const map = page.getByRole("group", { name: "國中地圖" });
  const status = page.locator(".board-status");
  const roll = page.locator("#roll");
  const dialog = page.getByRole("dialog");
  await expect(tile).toHaveCount(42);
  await expect(pawn).toHaveAttribute("data-tile", "0");
  await expect(status).toContainText("1 ／ 15");
  async function checkLayout() {
    const mapBounds = (await map.boundingBox())!;
    const statusBounds = (await status.boundingBox())!;
    expect(
      mapBounds.y + mapBounds.height <= statusBounds.y ||
        statusBounds.y + statusBounds.height <= mapBounds.y ||
        mapBounds.x + mapBounds.width <= statusBounds.x,
    ).toBe(true);
  }
  await checkLayout();
  await roll.click();
  await expect(dialog).toContainText("下一回合的前進方向");
  await dialog.getByRole("button", { name: /走捷徑/ }).click();
  await expect(status).toContainText("2 ／ 15");
  await expect(pawn).toHaveAttribute("data-tile", "4");

  await page.reload();
  await page.setViewportSize({ width: 960, height: 540 });
  await page.getByRole("button", { name: "繼續遊戲" }).click();
  await page.locator("#use-0").click();
  await expect(pawn).toHaveAttribute("data-tile", "4");
  await expect(status).toContainText("2 ／ 15");
  await checkLayout();

  await roll.click();
  await expect(dialog.getByRole("heading", { name: "記憶翻牌" })).toBeVisible();
  await page.clock.install();
  await skipMinigame(page);
  await expect(pawn).toHaveAttribute("data-tile", "41");
  await dialog.getByRole("button", { name: "確定" }).click();
  await expect(status).toContainText("3 ／ 15");
  for (let turn = 3; turn <= 15; turn++) {
    await roll.click();
    while (true) {
      // A turn can include a reward, a route choice and a landing notice.
      const confirm = dialog.getByRole("button", { name: "確定" });
      const outer = dialog.getByRole("button", { name: /沿外圈/ });
      await expect(
        page
          .locator(
            "dialog:modal, #roll:enabled:visible, .assessment-screen:visible",
          )
          .first(),
      ).toBeVisible();
      if (!(await dialog.isVisible())) break;
      const option = page
        .locator(".assessment-dialog .assessment-option")
        .first();
      const event = dialog.getByRole("button", { name: /智囊搶答/ });
      if (await option.isVisible()) await option.click();
      else if (await event.isVisible()) await event.click();
      else if (await outer.isVisible()) await outer.click();
      else if (await confirm.isVisible()) await confirm.click();
      else if (
        await dialog
          .getByRole("button", { name: "開始", exact: true })
          .isVisible()
      )
        await skipMinigame(page);
      else break;
    }
  }
  await expect(page.getByRole("heading", { name: "升高中考試" })).toBeVisible();
  await expect(roll).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "繼續遊戲" }).click();
  await page.locator("#use-0").click();
  await expect(page.getByRole("heading", { name: "升高中考試" })).toBeVisible();
});

test("路徑除錯標示與逐格落點在旋轉後仍對齊", async ({ page }) => {
  await page.setViewportSize({ width: 1060, height: 650 });
  await page.addInitScript(() => {
    Math.random = () => 0.1; // 兩顆骰子各擲出 1。
  });
  await page.goto("/?debug=path");
  await page.getByRole("button", { name: "開始新人生" }).click();
  await page.getByLabel("名字").fill("小宇");
  await page.getByRole("button", { name: "查看開局結果" }).click();
  await page.getByRole("button", { name: "確認開局" }).click();
  await page.getByRole("button", { name: /研習社/ }).click();

  const track = page.locator(".board-track");
  await expect(track.locator(".path-debug path").first()).toBeAttached();
  const gridSlopes = await track
    .locator(".path-debug path")
    .evaluateAll((lines) =>
      [
        ...new Set(
          lines.map((line) => {
            const [x1, y1, x2, y2] = line
              .getAttribute("d")!
              .match(/-?[\d.]+/g)!
              .map(Number);
            return Math.sign((y2 - y1) / (x2 - x1));
          }),
        ),
      ].sort(),
    );
  expect(gridSlopes).toEqual([-1, 1]);
  await expect(track.locator(".path-debug text")).toHaveCount(42);
  await expect(track.locator(".board-pawn")).toHaveAttribute("data-tile", "0");

  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1_000));
  const trace = await page.evaluateHandle(() => {
    const pawn = document.querySelector(".board-pawn")!;
    const tiles = [...document.querySelectorAll(".board-tile")];
    const coveredPoses: string[] = [];
    const landings: string[] = [];
    const frames = new Map<string, Set<string>>();
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.attributeName === "data-tile") {
          landings.push(pawn.getAttribute("data-tile")!);
        }
      }
      const image = pawn.querySelector<SVGImageElement>(
        'image[visibility="visible"]',
      )!;
      const pose = image.dataset.pose!;
      if (
        tiles.some(
          (tile) =>
            tile.compareDocumentPosition(pawn) &
            Node.DOCUMENT_POSITION_PRECEDING,
        )
      )
        coveredPoses.push(pose);
      if (pose === "stand") return;
      const tile = pawn.getAttribute("data-tile")!;
      if (!frames.has(tile)) frames.set(tile, new Set());
      frames.get(tile)!.add(`${pose}:${image.getAttribute("transform")}`);
    }).observe(pawn, { subtree: true, attributes: true });
    return { landings, frames, coveredPoses };
  });

  await page
    .locator("#roll")
    .evaluate((button: HTMLButtonElement) => button.click());
  await page.clock.runFor(1_600);
  await page.clock.resume();
  await expect(page.getByRole("dialog").locator(".mg-confirm")).toHaveText(
    "開始",
  );
  expect(await trace.evaluate(({ landings }) => landings)).toEqual(["1", "2"]);
  expect(await trace.evaluate(({ coveredPoses }) => coveredPoses)).toEqual([]);
  const leftWalk = Array.from(
    { length: 8 },
    (_, index) => `front-${index + 1}:scale(-1 1)`,
  );
  expect(
    await trace.evaluate(({ frames }) =>
      [...frames.values()].map((set) => [...set]),
    ),
  ).toEqual([leftWalk, leftWalk]);

  async function checkLanding(viewBox: string) {
    await expect(track).toHaveAttribute("viewBox", viewBox);
    await expect(track.locator(".pawn-base, #pawn-base-glow")).toHaveCount(0);
    const aligned = await track.evaluate((svg) => {
      const label = [...svg.querySelectorAll(".path-debug text")].find(
        (node) => node.textContent === "2",
      )!;
      const pawn = svg.querySelector(".board-pawn")!;
      const shadow = pawn.querySelector(".pawn-shadow")!;
      const aboveTiles = [...svg.querySelectorAll(".board-tile")].every(
        (tile) =>
          tile.compareDocumentPosition(pawn) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
      const marker = label.previousElementSibling!;
      const contact = shadow.getBoundingClientRect();
      const center = marker.getBoundingClientRect();
      return (
        aboveTiles &&
        Math.abs(contact.x + contact.width / 2 - center.x - center.width / 2) <
          1 &&
        Math.abs(
          contact.y + contact.height / 2 - center.y - center.height / 2,
        ) < 1
      );
    });
    expect(aligned).toBe(true);
  }

  await checkLanding("0 0 780 439");
  await page.setViewportSize({ width: 390, height: 844 });
  await checkLanding("0 0 439 780");
  await expect(track.locator('[data-pose="stand"]')).toHaveAttribute(
    "visibility",
    "visible",
  );
});

test("橫直版均可切換全圖且鏡頭移動時不露出地圖外緣", async ({ page }) => {
  await page.setViewportSize({ width: 1240, height: 740 });
  await page.goto("/");
  await page.getByRole("button", { name: "開始新人生" }).click();
  await page.getByLabel("名字").fill("小宇");
  await page.getByRole("button", { name: "查看開局結果" }).click();
  await page.getByRole("button", { name: "確認開局" }).click();
  await page.getByRole("button", { name: /研習社/ }).click();

  const map = page.locator(".board-map");
  const toggle = page.getByRole("button", { name: "看全圖" });
  const status = page.locator(".board-status");

  async function checkCamera(zoom: number) {
    await expect
      .poll(() =>
        map.evaluate(async (viewport) => {
          await new Promise(requestAnimationFrame);
          const world = viewport.querySelector(".board-world")!;
          const frame = viewport.getBoundingClientRect();
          const artwork = world.getBoundingClientRect();
          const pawn = world
            .querySelector(".board-pawn .pawn-shadow")!
            .getBoundingClientRect();
          const tolerance = 0.1;
          const covered =
            artwork.left <= frame.left + tolerance &&
            artwork.top <= frame.top + tolerance &&
            artwork.right >= frame.right - tolerance &&
            artwork.bottom >= frame.bottom - tolerance;
          const pawnVisible =
            pawn.left >= frame.left &&
            pawn.top >= frame.top &&
            pawn.right <= frame.right &&
            pawn.bottom <= frame.bottom;
          if (!covered || !pawnVisible)
            throw new Error("鏡頭超出地圖或棋子離開畫面");
          return new DOMMatrix(getComputedStyle(world).transform).a;
        }),
      )
      .toBe(zoom);
  }

  await checkCamera(2.3);
  const landscapeStatus = await status.boundingBox();
  await page.getByRole("button", { name: "選單", exact: true }).click();
  await toggle.click();
  await expect(page.locator("#overview")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await checkCamera(1);
  expect(await status.boundingBox()).toEqual(landscapeStatus);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(map.locator("svg")).toHaveAttribute("viewBox", "0 0 439 780");
  await checkCamera(1);
  const portraitStatus = await status.boundingBox();
  await page.getByRole("button", { name: "選單", exact: true }).click();
  await toggle.click();
  await expect(page.locator("#overview")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await checkCamera(2.3);
  expect(await status.boundingBox()).toEqual(portraitStatus);
  await expect(map.locator(".board-pawn")).toHaveAttribute("data-tile", "0");
});

test("前景依接地點遮擋棋子，兩版圖示仍可辨認並可檢查錨點", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1240, height: 740 });
  await page.addInitScript(() => {
    Math.random = () => 0.1;
  });
  await page.goto("/?debug=path");
  await page.getByRole("button", { name: "開始新人生" }).click();
  await page.getByLabel("名字").fill("小宇");
  await page.getByRole("button", { name: "查看開局結果" }).click();
  await page.getByRole("button", { name: "確認開局" }).click();
  await page.getByRole("button", { name: /研習社/ }).click();

  const track = page.locator(".board-track");
  const anchors = track.locator(".scenery-debug");
  const toggle = page.getByRole("checkbox", { name: "顯示前景物件錨點" });
  await expect(anchors).toBeHidden();
  await toggle.check();
  await expect(anchors).toBeVisible();
  await expect(anchors.locator(".scenery-anchor")).toHaveCount(9);

  const pawn = track.locator(".board-pawn");
  await page.getByRole("button", { name: "擲骰" }).click();
  await page.clock.install();
  await skipMinigame(page);
  await page.getByRole("dialog").getByRole("button", { name: "確定" }).click();
  await expect(page.getByRole("status")).toContainText("已自動存檔");

  const library = track.locator('[data-name="圖書館"]');
  const libraryId = await library.getAttribute("data-scenery");
  const mask = track.locator(
    `#pawn-occlusion [data-mask-depth="${libraryId}"]`,
  );
  await expect(pawn).toHaveAttribute("data-tile", "2");
  await expect(mask).toHaveAttribute("visibility", "hidden");

  await page.evaluate(() => {
    const key = "virtual-life-web:v3:slot:0";
    const save = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(
      key,
      JSON.stringify({ ...save, boardTile: 37, previousTile: 36 }),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "繼續遊戲" }).click();
  await page.locator("#use-0").click();
  await expect(pawn).toHaveAttribute("data-tile", "37");
  await expect(mask).toHaveAttribute("visibility", "visible");
  await expect(track.locator(".pawn-silhouette")).toHaveAttribute(
    "href",
    "#pawn-pose-stand",
  );
  await expect(
    track.locator(`#pawn-visible [data-pawn-cover="${libraryId}"]`),
  ).toHaveAttribute("visibility", "visible");
  await toggle.check();

  async function checkTilePrints() {
    const obscured = await track.evaluate((svg) => {
      const buildings = [
        ...svg.querySelectorAll<SVGGElement>(".board-scenery"),
      ].map((object) => ({
        y: Number(object.dataset.depth),
        shape: svg.querySelector<SVGPolygonElement>(
          `#scenery-outline-${object.dataset.scenery}`,
        )!,
      }));
      return [...svg.querySelectorAll<SVGGElement>(".board-tile")].flatMap(
        (tile) => {
          const icon = tile.querySelector("image")!;
          const matrix = icon.transform.baseVal.consolidate()!.matrix;
          const step = icon.width.baseVal.value * 0.22;
          const samples = [-step, 0, step].flatMap((x) =>
            [-step, 0, step].map((y) =>
              new DOMPoint(x, y).matrixTransform(matrix),
            ),
          );
          const visible = samples.filter((point) =>
            buildings.every(
              ({ y, shape }) =>
                y <= Number(tile.dataset.depth) || !shape.isPointInFill(point),
            ),
          );
          return visible.length < 6 ? [tile.dataset.tile] : [];
        },
      );
    });
    expect(obscured).toEqual([]);
  }

  await checkTilePrints();
  await page.setViewportSize({ width: 430, height: 932 });
  await expect(anchors.locator(".scenery-anchor")).toHaveCount(9);
  await expect(anchors).toBeVisible();
  await checkTilePrints();
  await toggle.uncheck();
  await expect(anchors).toBeHidden();
});

for (const portrait of [false, true]) {
  const orientation = portrait ? "portrait" : "landscape";
  test(`all 國中 tile faces are visible and decoded in ${orientation} on turn 3`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize(
      portrait ? { width: 430, height: 932 } : { width: 1240, height: 740 },
    );
    await page.addInitScript(() => {
      Math.random = () => 0.2;
    });
    await page.goto("/");
    await page.getByRole("button", { name: "開始新人生" }).click();
    await page.getByLabel("名字").fill("小宇");
    await page.getByRole("button", { name: "查看開局結果" }).click();
    await page.getByRole("button", { name: "確認開局" }).click();
    await page.getByRole("button", { name: /研習社/ }).click();
    const roll = page.locator("#roll");
    const dialog = page.getByRole("dialog");
    await roll.click();
    await dialog.getByRole("button", { name: /走捷徑/ }).click();
    await roll.click();
    await page.clock.install();
    await skipMinigame(page);
    await dialog.getByRole("button", { name: "確定" }).click();
    await expect(page.locator(".board-status")).toContainText("3 ／ 15");
    await expect(page.locator(".board-pawn")).toHaveAttribute(
      "data-tile",
      "41",
    );
    await page.getByRole("button", { name: "選單", exact: true }).click();
    await page.getByRole("button", { name: "看全圖" }).click();
    const tiles = page.locator(".board-tile");
    await expect(tiles).toHaveCount(42);
    for (const tile of await tiles.all()) {
      const art = tile.locator(".paver-top");
      await expect(art).toHaveCount(1);
      await expect(art).toBeVisible();
      await expect(art).toBeInViewport();
      const kind = await tile.getAttribute("data-kind");
      await expect(art).toHaveAttribute(
        "href",
        new RegExp(`/${kind}-clay(?:[-.])`),
      );
    }
    const faces = tiles.locator(".paver-top");
    const decoded = await faces.evaluateAll((elements) =>
      Promise.all(
        elements.map(async (element) => {
          const image = new Image();
          image.src = (element as SVGImageElement).href.baseVal;
          await image.decode();
          return image.naturalWidth > 0 && image.naturalHeight > 0;
        }),
      ),
    );
    expect(decoded).toEqual(Array(42).fill(true));
    const map = page.locator(".board-map");
    const withArt = await map.screenshot({ scale: "css" });
    const withoutArt = await map.screenshot({
      scale: "css",
      style: ".paver-top { visibility: hidden !important; }",
    });
    const bounds = (await map.boundingBox())!;
    const missing = await faces.evaluateAll(
      async (elements, { withArt, withoutArt, bounds }) => {
        async function pixels(source: string) {
          const image = new Image();
          image.src = `data:image/png;base64,${source}`;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(image, 0, 0);
          return ctx;
        }
        const [before, after] = await Promise.all([
          pixels(withArt),
          pixels(withoutArt),
        ]);
        return elements.flatMap((element) => {
          const rect = element.getBoundingClientRect();
          const x = Math.round(rect.left + rect.width / 2 - bounds.x);
          const y = Math.round(rect.top + rect.height / 2 - bounds.y);
          const size = Math.max(3, Math.floor(rect.height * 0.35));
          const a = before.getImageData(
            x - size,
            y - size,
            size * 2,
            size * 2,
          ).data;
          const b = after.getImageData(
            x - size,
            y - size,
            size * 2,
            size * 2,
          ).data;
          const changed = a.filter(
            (value, i) => Math.abs(value - b[i]) > 12,
          ).length;
          return changed > (size * size) / 2
            ? []
            : [element.parentElement?.getAttribute("data-tile")];
        });
      },
      {
        withArt: withArt.toString("base64"),
        withoutArt: withoutArt.toString("base64"),
        bounds,
      },
    );
    expect(missing).toEqual([]);
    if (process.env.ANDY_SCREENSHOTS) {
      await page.screenshot({
        path: `${process.env.ANDY_SCREENSHOTS}/board-${orientation}.png`,
      });
    }
  });
}
