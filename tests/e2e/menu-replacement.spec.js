import { test, expect } from "@playwright/test";
import fs from "node:fs";
import sharp from "sharp";
import { localDate } from "../../src/lib/menu.js";
import { isLeafDish } from "../../src/lib/nutrition.js";

const dishes = JSON.parse(fs.readFileSync("public/data/dishes.json", "utf8"));
const meat = dishes.find((d) => d.name === "山药蒸肉饼（家庭无辣版）");
const leaf = dishes.find((d) => d.name === "清炒茼蒿");
const otherMeat = dishes.find((d) => d.isMeat && d.id !== meat.id);
const custom = { id: "custom-target", name: "自家的拿手菜" };
const cards = (page) => page.locator(".menu-cards .dish-card");
async function seed(page, saved) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "帮我配菜" })).toBeVisible();
  await page.evaluate(
    (s) => localStorage.setItem("dinner-v1", JSON.stringify(s)),
    saved,
  );
  await page.reload();
  await expect(page.locator(".skeleton")).toHaveCount(0);
}
const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("dinner-v1")));

for (const blocked of [meat, leaf]) {
  test(`拉黑${blocked.isMeat ? "荤菜" : "绿叶菜"}，刷新后整桌仍按原来一荤一素配齐`, async ({
    page,
  }) => {
    await seed(page, { today: { date: localDate(), ids: [meat.id, leaf.id] } });
    await page
      .getByRole("button", { name: "拉黑" + blocked.name, exact: true })
      .click();
    await expect(cards(page)).toHaveCount(1);
    expect((await stored(page)).today.targetCounts).toEqual({
      meat: 1,
      veg: 1,
    });
    await page.reload();
    await page.getByRole("button", { name: "整桌换一换" }).click();
    await expect(cards(page)).toHaveCount(2);
    await expect(page.locator(".menu-heading")).toContainText("1 荤 1 素");
    await expect(page.locator(".menu-cards")).not.toContainText(blocked.name);
    await expect(page.getByRole("button", { name: "3 买菜" })).toBeDisabled();
    await page.getByRole("button", { name: "就做这些" }).click();
    expect(
      (await stored(page)).today.ids.some((id) =>
        isLeafDish(dishes.find((d) => d.id === id)),
      ),
    ).toBe(true);
  });
}

test("新生成的两荤两素拉黑后仍补齐，保留锁定菜", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "两荤两素", exact: true }).click();
  await page.getByRole("button", { name: "帮我配菜" }).click();
  await expect(cards(page)).toHaveCount(4);
  const names = await cards(page).locator("h2").allTextContents();
  await page
    .getByRole("button", { name: "锁定" + names[0], exact: true })
    .click();
  await page
    .getByRole("button", { name: "拉黑" + names[1], exact: true })
    .click();
  await page.getByRole("button", { name: "整桌换一换" }).click();
  await expect(cards(page)).toHaveCount(4);
  await expect(page.locator(".menu-heading")).toContainText("2 荤 2 素");
  await expect(page.locator(".menu-cards")).toContainText(names[0]);
  await expect(page.locator(".menu-cards")).not.toContainText(names[1]);
});

test("旧版缺菜记录从历史恢复目标，保留自录菜和独立计时", async ({ page }) => {
  await seed(page, {
    today: {
      date: localDate(),
      ids: [leaf.id, custom.id],
      needsConfirmation: true,
    },
    history: [{ date: localDate(), ids: [meat.id, leaf.id, custom.id] }],
    settings: { blacklist: [meat.id] },
    customDishes: [custom],
    kitchenTimers: {
      independent: {
        end: Date.now() + 600000,
        label: "煲汤",
        durationSeconds: 600,
      },
    },
  });
  const timers = (await stored(page)).kitchenTimers;
  await page.getByRole("button", { name: "整桌换一换" }).click();
  await expect(cards(page)).toHaveCount(3);
  await expect(page.locator(".menu-cards")).toContainText(custom.name);
  await expect(page.locator(".menu-heading")).toContainText("1 荤 1 素");
  expect((await stored(page)).kitchenTimers).toEqual(timers);
});

test("候选有限时复用允许的原菜配齐；仍不足时保留菜单并提示缺口", async ({
  page,
}) => {
  const available = [meat.id, leaf.id, otherMeat.id];
  await seed(page, {
    today: {
      date: localDate(),
      ids: [meat.id, leaf.id],
      targetCounts: { meat: 1, veg: 1 },
    },
    settings: {
      blacklist: dishes
        .filter((d) => !available.includes(d.id))
        .map((d) => d.id),
    },
  });
  await page
    .getByRole("button", { name: "拉黑" + meat.name, exact: true })
    .click();
  await page.getByRole("button", { name: "整桌换一换" }).click();
  await expect(cards(page)).toHaveCount(2);
  await expect(page.locator(".menu-cards")).toContainText(leaf.name);
  await expect(page.locator(".menu-cards")).toContainText(otherMeat.name);
  await page
    .getByRole("button", { name: "拉黑" + otherMeat.name, exact: true })
    .click();
  await page.getByRole("button", { name: "整桌换一换" }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(page.locator(".toast")).toContainText("还缺 1 道荤菜");
  await expect(page.locator(".menu-cards")).toContainText(leaf.name);
});

test("只换一道不补其他缺口，整桌换菜才恢复原搭配", async ({ page }) => {
  await seed(page, {
    today: { date: localDate(), ids: [meat.id, leaf.id, otherMeat.id] },
  });
  await page
    .getByRole("button", { name: "拉黑" + meat.name, exact: true })
    .click();
  await page
    .getByRole("button", { name: "只换" + otherMeat.name, exact: true })
    .click();
  await expect(cards(page)).toHaveCount(2);
  await expect(page.locator(".menu-cards")).toContainText(leaf.name);
  await page.getByRole("button", { name: "整桌换一换" }).click();
  await expect(cards(page)).toHaveCount(3);
  await expect(page.locator(".menu-heading")).toContainText("2 荤 1 素");
});

for (const [width, height] of [
  [900, 300],
  [300, 900],
  [640, 640],
]) {
  test(`详情完整显示${width}×${height}图片，保留手机和桌面布局`, async ({
    page,
  }) => {
    const image = await sharp({
      create: { width, height, channels: 3, background: "#dd8040" },
    })
      .webp()
      .toBuffer();
    await page.route("**" + leaf.image, (route) =>
      route.fulfill({ contentType: "image/webp", body: image }),
    );
    await seed(page, { today: { date: localDate(), ids: [meat.id, leaf.id] } });
    for (const viewport of [
      { width: 375, height: 667 },
      { width: 1280, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      const bounds = await page.locator(".menu-cards").boundingBox();
      const actions = await page.locator(".action-bar").boundingBox();
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(actions.y);
      await page.getByRole("button", { name: "查看" + leaf.name }).click();
      const img = page.locator(".sheet-content > .dish-image img");
      await expect
        .poll(() => img.evaluate((el) => el.complete && el.naturalWidth))
        .toBe(width);
      const size = await img.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          fit: getComputedStyle(el).objectFit,
        };
      });
      expect(size.fit).toBe("contain");
      expect(size.height).toBeLessThanOrEqual(viewport.height * 0.55 + 1);
      expect(size.width).toBeLessThanOrEqual(480);
      await expect(page.locator(".image-label")).toHaveCount(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(viewport.width);
      await page.screenshot({
        path: `test-results/detail-${width}-${height}-${viewport.width}.png`,
      });
      await page.getByRole("button", { name: "关闭", exact: true }).click();
    }
  });
}
