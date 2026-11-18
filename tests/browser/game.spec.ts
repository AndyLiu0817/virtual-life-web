import { expect, test } from "@playwright/test";

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
  await expect(page.getByRole("heading", { name: "國中棋盤" })).toBeVisible();
  await expect
    .poll(() =>
      backdrop.evaluate((img) => (img as HTMLImageElement).currentSrc),
    )
    .toContain("map_junior_portrait_final");
  await expect(page.getByText("5,000 元")).toBeVisible();
  await page.getByRole("button", { name: "儲存到存檔格" }).click();
  await page.locator("#use-1").click();
  await expect(page.getByRole("status")).toContainText("已儲存至存檔格 1");
  const downloading = page.waitForEvent("download");
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
    .toContain("map_junior_landscape_final");
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

  const tile = page.locator(".board-tile");
  const pawn = page.locator(".board-pawn");
  const map = page.getByRole("group", { name: "國中地圖" });
  const status = page.locator(".board-status");
  const roll = page.getByRole("button", { name: "擲骰" });
  const dialog = page.getByRole("dialog");
  await expect(tile).toHaveCount(18);
  await expect(pawn).toHaveAttribute("data-tile", "0");
  await expect(status).toContainText("1 ／ 15");
  async function checkLayout() {
    const mapBounds = (await map.boundingBox())!;
    const statusBounds = (await status.boundingBox())!;
    expect(
      mapBounds.y + mapBounds.height <= statusBounds.y ||
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
  await expect(dialog).toContainText("遊戲：第 6 步製作中");
  await expect(pawn).toHaveAttribute("data-tile", "16");
  await dialog.getByRole("button", { name: "確定" }).click();
  await expect(status).toContainText("3 ／ 15");
  for (let turn = 3; turn <= 15; turn++) {
    await roll.click();
    while (await roll.isDisabled()) {
      // A turn can include a reward, a route choice and a landing notice.
      const confirm = dialog.getByRole("button", { name: "確定" });
      const outer = dialog.getByRole("button", { name: /沿外圈/ });
      await expect(
        page
          .locator("dialog:modal, #roll:enabled:visible, #ending:visible")
          .first(),
      ).toBeVisible();
      if (await outer.isVisible()) await outer.click();
      else if (await confirm.isVisible()) await confirm.click();
      else break;
    }
  }
  await expect(
    page.getByText("國中階段結束，升學考試第 4 步製作中"),
  ).toBeVisible();
  await expect(roll).toBeHidden();
  await page.getByRole("button", { name: "回標題" }).click();
  await page.getByRole("button", { name: "繼續遊戲" }).click();
  await page.locator("#use-0").click();
  await expect(
    page.getByText("國中階段結束，升學考試第 4 步製作中"),
  ).toBeVisible();
});
