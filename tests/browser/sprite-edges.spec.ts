import { readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("every minigame, deity, HUD and school sprite has clean transparent edges", async ({
  page,
}) => {
  const clay = readdirSync("src/board-art")
    .filter((file) => file.endsWith("-clay.webp"))
    .map((file) => `/src/board-art/${file}`);
  expect(clay).toHaveLength(9);
  const sprites = [
    "art/minigames",
    "art/shop",
    "art/shoot",
    "art/deities",
    "art/hud",
    "src/board-art/high",
    "src/board-art/university",
  ].flatMap((dir) =>
    readdirSync(dir, { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".webp"))
      .map((file) => `/${dir}/${file}`),
  );
  expect(sprites.filter((url) => url.includes("/deities/"))).toHaveLength(7);
  expect(sprites.filter((url) => url.includes("/hud/"))).toHaveLength(72);
  expect(
    sprites.filter((url) => /\/hud\/avatar-.*-(128|256)\.webp$/.test(url)),
  ).toHaveLength(16);
  expect(sprites.filter((url) => url.includes("/hud/deity-"))).toHaveLength(7);
  expect(
    sprites.filter((url) => url.startsWith("/src/board-art/")),
  ).toHaveLength(84);
  expect(sprites.filter((url) => url.startsWith("/art/shop/"))).toHaveLength(
    16,
  );
  sprites.push(...clay, "/art/route-arrow.webp");
  await page.goto("/");
  const samples = await page.evaluate(async (urls) => {
    return Promise.all(
      urls.map(async (url) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        const { naturalWidth: width, naturalHeight: height } = image;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        const { data } = ctx.getImageData(0, 0, width, height);
        const corners = [
          0,
          width - 1,
          width * (height - 1),
          width * height - 1,
        ];
        let opaque = 0;
        let translucent = 0;
        let whiteFringe = 0;
        let creamFringe = 0;
        let paleOpaqueRim = 0;
        const hud = url.includes("/hud/");
        const rimOffsets = [-2, -1, 0, 1, 2].flatMap((dy) =>
          [-2, -1, 0, 1, 2]
            .filter((dx) => dx * dx + dy * dy <= 4)
            .map((dx) => [dx, dy] as const),
        );
        // Sample every partially transparent edge pixel. Skip essentially
        // invisible pixels where canvas unpremultiplication rounds RGB.
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha === 255) opaque++;
          const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
          // Inspect the first two pixels of the visible contour, including
          // solid pixels and the inner edges of holes such as avatar rings.
          if (
            hud &&
            alpha >= 128 &&
            (Math.min(r, g, b) >= 224 || (r >= 235 && g >= 218 && b >= 190))
          ) {
            const pixel = i / 4;
            const x = pixel % width;
            const y = Math.floor(pixel / width);
            if (
              rimOffsets.some(([dx, dy]) => {
                const nx = x + dx;
                const ny = y + dy;
                return (
                  nx < 0 ||
                  ny < 0 ||
                  nx >= width ||
                  ny >= height ||
                  data[(ny * width + nx) * 4 + 3] < 16
                );
              })
            )
              paleOpaqueRim++;
          }
          if (alpha < 16 || alpha === 255) continue;
          translucent++;
          if (Math.min(r, g, b) >= 235) whiteFringe++;
          if (r >= 240 && g >= 222 && b >= 200) creamFringe++;
        }
        return {
          url,
          corners: corners.map((i) => data[4 * i + 3]),
          opaque,
          translucent,
          whiteFringe,
          creamFringe,
          paleOpaqueRim,
        };
      }),
    );
  }, sprites);
  for (const sample of samples) {
    expect(sample.corners, sample.url).toEqual([0, 0, 0, 0]);
    expect(sample.opaque, sample.url).toBeGreaterThan(0);
    expect(sample.translucent, sample.url).toBeGreaterThan(0);
    // The original fork art includes a pale outer bevel.
    if (!sample.url.endsWith("/fork-clay.webp"))
      expect(sample.whiteFringe, sample.url).toBe(0);
    if (
      sample.url.endsWith("/love-clay.webp") ||
      sample.url.endsWith("/shop-clay.webp") ||
      sample.url.startsWith("/art/shop/") ||
      sample.url.endsWith("/route-arrow.webp")
    )
      expect(sample.creamFringe, sample.url).toBe(0);
    if (sample.url.includes("/hud/")) {
      expect(sample.creamFringe, sample.url).toBe(0);
      expect(sample.paleOpaqueRim, sample.url).toBe(0);
    }
  }
});
