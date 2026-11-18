import { expect, test } from "@playwright/test";

test("手機直向開局、重新整理讀檔，旋轉後轉移存檔", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "未來人生・進行曲" }),
  ).toBeVisible();
  const backdrop = page.locator(".backdrop img");
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
  await expect(
    page.getByRole("heading", { name: "國中棋盤（下一步製作中）" }),
  ).toBeVisible();
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
