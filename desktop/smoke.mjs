import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { chromium, expect } from "@playwright/test";

const [executable, output] = process.argv.slice(2);
const profile = await mkdtemp(path.join(tmpdir(), "future-life-smoke-"));
const server = createServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const endpoint = `http://127.0.0.1:${server.address().port}`;
const port = server.address().port;
await new Promise((resolve) => server.close(resolve));

let child;
let browser;
async function launch() {
  child = spawn(
    path.resolve(executable),
    [
      ...(process.platform === "linux" ? ["--no-sandbox", "desktop"] : []),
      `--remote-debugging-port=${port}`,
    ],
    {
      env: { ...process.env, FUTURE_LIFE_SMOKE_PROFILE: profile },
      stdio: "inherit",
    },
  );
  child.on("error", console.error);
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(endpoint + "/json/version")).ok;
        } catch {
          return false;
        }
      },
      { timeout: 90_000 },
    )
    .toBe(true);
  browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.waitForEvent("page"));
  await page.waitForURL("life-game://local/shell.html");
  return { page, game: page.frameLocator("iframe") };
}

async function close() {
  const session = await browser.newBrowserCDPSession();
  await session.send("Browser.close").catch((error) => {
    if (browser.isConnected()) throw error;
  });
  await expect
    .poll(() => child.exitCode ?? child.signalCode, {
      timeout: 30_000,
    })
    .not.toBeNull();
  expect(child.exitCode).toBe(0);
  browser = undefined;
  child = undefined;
}

try {
  await mkdir(output, { recursive: true });
  const { page, game } = await launch();
  await expect(page).toHaveTitle("未來人生・進行曲");
  await expect(
    game.getByRole("heading", { name: "未來人生・進行曲" }),
  ).toBeVisible();
  const image = game.locator("picture img");
  expect(
    await image.evaluate(async (img) => {
      await img.decode();
      return img.currentSrc;
    }),
  ).toMatch(/life-game:\/\/local\/assets\/title_kv_landscape_final/);
  await page.screenshot({ path: path.join(output, "title.png") });

  const music = page.waitForResponse((response) =>
    /bgm_title-.*\.mp3/.test(response.url()),
  );
  await game.getByRole("button", { name: "開始新人生" }).click();
  const audio = await music;
  expect(audio.ok()).toBe(true);
  const frames = await image.evaluate(async (_img, url) => {
    const response = await fetch(url);
    const context = new OfflineAudioContext(1, 1, 44100);
    return (await context.decodeAudioData(await response.arrayBuffer())).length;
  }, audio.url());
  expect(frames).toBeGreaterThan(0);

  await game.getByLabel("名字").fill("安安");
  await game.getByRole("button", { name: "查看開局結果" }).click();
  await game.getByRole("button", { name: "確認開局" }).click();
  await game.getByRole("button", { name: "略過" }).click();
  await game.getByRole("button", { name: /研習社/ }).click();
  await expect(game.getByRole("heading", { name: "國中棋盤" })).toBeVisible();
  await expect(game.locator(".board-tile")).toHaveCount(42);
  await image.evaluate((img) => img.decode());
  await page.screenshot({ path: path.join(output, "junior-board.png") });

  await close();
  const reopened = await launch();
  await reopened.game.getByRole("button", { name: "繼續遊戲" }).click();
  await reopened.game.locator("#use-0").click();
  await expect(
    reopened.game.getByRole("heading", { name: "安安" }),
  ).toBeVisible();
  await close();
  const { size } = await stat(executable);
  console.log(
    `Smoke test passed for ${path.basename(executable)} (${size} bytes)`,
  );
} finally {
  await browser?.close();
  if (child && child.exitCode === null) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
      });
    } else {
      child.kill();
    }
    await setTimeout(1000);
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 5 });
}
