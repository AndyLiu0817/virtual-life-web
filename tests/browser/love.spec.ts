import { expect, test, type Page } from "@playwright/test";
import { loveQuestions } from "../../src/data/love-questions";
import { chooseClub } from "../../src/game/clubs";
import { createSave, type Save } from "../../src/game/saves";
import { enterSchool } from "../../src/game/school";

const slot = "virtual-life-web:v3:slot:0";
const screenshots = process.env.STEP15_SCREENSHOTS;

function player(gender: Save["gender"], charm: number): Save {
  const save = enterSchool(
    createSave({
      name: gender === "boy" ? "宇安" : "晨希",
      gender,
      birthday: { month: 5, day: 13 },
      bloodType: "A",
    }),
    "university",
  );
  return chooseClub(
    {
      ...save,
      stageIntroSeen: ["university"],
      education: "high",
      stats: { ...save.stats, charm },
      cash: 4600,
    },
    "university",
    "study",
  );
}

async function start(page: Page, save: Save) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ slot, save }) => {
      if (!localStorage.getItem(slot))
        localStorage.setItem(slot, JSON.stringify(save));
    },
    { slot, save },
  );
  await page.goto("/?debug=love");
  await page.getByRole("button", { name: "繼續遊戲" }).click();
  await page.locator("#use-0").click();
  await expect(page.locator("#roll")).toBeEnabled();
}

async function openMenu(page: Page) {
  await page.locator('[aria-controls="hud-menu"]:visible').first().click();
}

async function trigger(page: Page) {
  await openMenu(page);
  await page.getByRole("button", { name: "跳到愛情格" }).click();
}

async function readSave(page: Page): Promise<Save> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), slot);
}

async function capture(page: Page, name: string) {
  if (screenshots) {
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images, (img) => img.decode().catch(() => {})),
      );
    });
    await page.screenshot({
      path: `${screenshots}/${name}.png`,
      animations: "disabled",
    });
  }
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  const size = `${viewport.width}x${viewport.height}`;
  test.describe(size, () => {
    test.use({ viewport });

    test("認識、約會出題、分手與重新認識", async ({ page }) => {
      await start(page, player("boy", 230));
      await trigger(page);
      const dialog = page.getByRole("dialog");
      await expect(dialog.locator(".love-candidate")).toHaveCount(4);
      await expect(
        dialog.getByRole("button", { name: /蘇以寧.*350/ }),
      ).toBeDisabled();
      await capture(page, `selection-${size}`);
      await dialog.getByRole("button", { name: /林小晴/ }).click();
      await dialog.getByRole("button", { name: "確定" }).click();
      await expect(page.locator("#roll")).toBeEnabled();
      expect(await readSave(page)).toMatchObject({
        cash: 2600,
        partner: "lin_xiaoqing",
        metPartners: ["lin_xiaoqing"],
      });
      await trigger(page);
      await dialog.getByRole("button", { name: "約會" }).click();
      await dialog.getByRole("button", { name: "開始聊天" }).click();
      await expect(dialog.getByText(/第 1 題/)).toBeVisible();
      await capture(page, `date-${size}`);
      const asked = new Set<string>();
      for (let question = 0; question < 3; question++) {
        const text = await dialog.getByRole("heading").innerText();
        asked.add(text);
        const { choices } = loveQuestions.lin_xiaoqing.find(
          (entry) => entry.text === text,
        )!;
        await dialog
          .getByRole("button", {
            name: choices[question === 0 ? 1 : 0],
            exact: true,
          })
          .click();
        await expect(dialog.locator(".love-expression")).toHaveAttribute(
          "src",
          question === 0 ? /annoyed/ : /happy/,
        );
        await dialog
          .getByRole("button", { name: question < 2 ? "下一題" : "查看結果" })
          .click();
      }
      expect(asked.size).toBe(3);
      await expect(dialog).toContainText("愛情度 ＋15");
      await dialog.getByRole("button", { name: "確定" }).click();
      await expect(page.locator("#roll")).toBeEnabled();
      expect((await readSave(page)).affection).toBe(15);
      await trigger(page);
      await dialog.getByRole("button", { name: "分手", exact: true }).click();
      await dialog.getByRole("button", { name: "確認分手" }).click();
      await expect(page.locator("#roll")).toBeEnabled();
      expect(await readSave(page)).toMatchObject({
        cash: 2600,
        partner: null,
        affection: 0,
        metPartners: ["lin_xiaoqing"],
      });
      await trigger(page);
      await expect(
        dialog.getByRole("heading", { name: "想認識誰？" }),
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: /許芷妍.*現金不足/ }),
      ).toBeDisabled();
      await dialog.getByRole("button", { name: "先不要" }).click();
    });

    for (const [gender, partner] of [
      ["boy", "lin_xiaoqing"],
      ["girl", "chen_boyu"],
    ] as const) {
      test(`${gender} 主角由約會結算進入告白並寫入 HUD`, async ({ page }) => {
        await start(page, {
          ...player(gender, 120),
          partner,
          metPartners: [partner],
          affection: 57,
        });
        await trigger(page);
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("button", { name: "約會" }).click();
        await dialog.getByRole("button", { name: "開始聊天" }).click();
        for (let index = 0; index < 3; index++) {
          await dialog.locator(".love-actions button").first().click();
          await dialog
            .getByRole("button", { name: index === 2 ? "查看結果" : "下一題" })
            .click();
        }
        await expect(dialog).toContainText("目前 60 ／ 60");
        await dialog.getByRole("button", { name: "告白" }).click();
        await expect(
          dialog.getByRole("heading", { name: "告白成功" }),
        ).toBeVisible();
        await expect(
          dialog.locator(".love-couple img").first(),
        ).toHaveAttribute("src", new RegExp(`hero-${gender}`));
        await capture(page, `confession-${gender}-${size}`);
        await dialog.getByRole("button", { name: "確定" }).click();
        await expect(page.locator("#roll")).toBeEnabled();
        expect(await readSave(page)).toMatchObject({
          dating: true,
          affection: 60,
          spouse: null,
          marriage: null,
        });
        await page.goto("/");
        await page.getByRole("button", { name: "繼續遊戲" }).click();
        await page.locator("#use-0").click();
        await expect(page.locator("#roll")).toBeEnabled();
        await openMenu(page);
        await expect(page.locator(".hud-love")).toContainText(
          "交往中 ・ 愛情度 60 ／ 99",
        );
        if (gender === "boy") await capture(page, `hud-${size}`);
      });
    }
  });
}

test("恢復待告白的存檔時會重查魅力，失敗後再約會會婉拒", async ({ page }) => {
  await start(page, {
    ...player("girl", 119),
    partner: "chen_boyu",
    affection: 60,
  });
  await trigger(page);
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "約會" }).click();
  await expect(dialog.getByRole("heading", { name: "告白失敗" })).toBeVisible();
  await dialog.getByRole("button", { name: "確定" }).click();
  await expect(page.locator("#roll")).toBeEnabled();
  expect(await readSave(page)).toMatchObject({ dating: false, affection: 50 });
  await trigger(page);
  await dialog.getByRole("button", { name: "約會" }).click();
  await expect(dialog).toContainText("改天再約");
  await dialog.getByRole("button", { name: "確定" }).click();
  await expect(page.locator("#roll")).toBeEnabled();
  expect((await readSave(page)).affection).toBe(50);
});
