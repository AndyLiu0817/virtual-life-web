import { readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("every minigame, deity and HUD sprite has clean transparent edges", async ({
  page,
}) => {
  const sprites = [
    "art/minigames",
    "art/shoot",
    "art/deities",
    "art/hud",
  ].flatMap((dir) =>
    readdirSync(dir, { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".webp"))
      .map((file) => `/${dir}/${file}`),
  );
  expect(sprites.filter((url) => url.includes("/deities/"))).toHaveLength(7);
  expect(sprites.filter((url) => url.includes("/hud/"))).toHaveLength(65);
  expect(
    sprites.filter((url) => /\/hud\/avatar-.*-(128|256)\.webp$/.test(url)),
  ).toHaveLength(16);
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
        // Sample every partially transparent edge pixel. Skip essentially
        // invisible pixels where canvas unpremultiplication rounds RGB.
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha === 255) opaque++;
          if (alpha < 16 || alpha === 255) continue;
          translucent++;
          const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
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
        };
      }),
    );
  }, sprites);
  for (const sample of samples) {
    expect(sample.corners, sample.url).toEqual([0, 0, 0, 0]);
    expect(sample.opaque, sample.url).toBeGreaterThan(0);
    expect(sample.translucent, sample.url).toBeGreaterThan(0);
    expect(sample.whiteFringe, sample.url).toBe(0);
    if (sample.url.includes("/hud/"))
      expect(sample.creamFringe, sample.url).toBe(0);
  }
});
