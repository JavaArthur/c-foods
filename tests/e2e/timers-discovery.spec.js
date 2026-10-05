import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { localDate } from "../../src/lib/menu.js";
const dishes = JSON.parse(fs.readFileSync("public/data/dishes.json", "utf8"));
const meta = JSON.parse(fs.readFileSync("public/data/dish-meta.json", "utf8"));
const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("dinner-v1")));
for (const entry of ["今晚菜单", "菜库卡片", "收藏卡片", "做菜列表"])
  test(`${entry}直接拉黑，保留收藏历史和独立计时`, async ({ page }) => {
    const meat = dishes.find((d) => d.name === "清蒸生蚝");
    const leaf = dishes.find((d) => d.name === "清炒茼蒿");
    await page.addInitScript(
      (saved) => localStorage.setItem("dinner-v1", JSON.stringify(saved)),
      {
        today: { date: localDate(), ids: [meat.id, leaf.id] },
        history: [{ date: localDate(), ids: [meat.id, leaf.id] }],
        favorites: [meat.id],
        kitchenTimers: {
          independent: {
            label: "炖汤",
            status: "running",
            duration: 600,
            end: Date.now() + 600000,
            remaining: 600,
            notified: false,
          },
        },
      },
    );
    await page.goto(
      entry === "菜库卡片"
        ? "/#/recipes"
        : entry === "收藏卡片"
          ? "/#/favorites"
          : "/",
    );
    if (entry === "做菜列表")
      await page.getByRole("button", { name: "4 做菜", exact: true }).click();
    await page
      .getByRole("button", { name: "拉黑" + meat.name, exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "拉黑" + meat.name, exact: true }),
    ).toHaveCount(0);
    const saved = await stored(page);
    expect(saved.settings.blacklist).toContain(meat.id);
    expect(saved.today.ids).not.toContain(meat.id);
    expect(saved.today.needsConfirmation).toBe(true);
    expect(saved.favorites).toContain(meat.id);
    expect(saved.history[0].ids).toContain(meat.id);
    expect(saved.kitchenTimers.independent.label).toBe("炖汤");
  });
test("独立计时并行、暂停与刷新、加时、到期、预设持久化", async ({ page }) => {
  await page.goto("/#/timers");
  await expect(page.getByRole("heading", { name: "厨房计时器" })).toBeVisible();
  await page.clock.install();
  await page.getByRole("button", { name: "新建计时", exact: true }).click();
  await page.getByLabel("计时分钟", { exact: true }).fill("0");
  await page.getByLabel("计时秒数", { exact: true }).fill("5");
  await page.getByPlaceholder("例如：蒸鱼、煮汤").fill("短计时");
  await page.getByRole("button", { name: "开始计时", exact: true }).click();
  await page.getByRole("button", { name: "1 分钟 01:00", exact: true }).click();
  await expect(page.locator(".timer-item, .timer-summary")).toHaveCount(2);
  const long = page.getByRole("region", { name: "1 分钟", exact: true });
  await long.getByRole("button", { name: "暂停", exact: true }).click();
  await page.clock.fastForward(6000);
  await expect(
    page.getByRole("button", { name: "查看计时：短计时", exact: true }),
  ).toContainText("时间到");
  await expect(long).toContainText("已暂停");
  const paused = (await stored(page)).kitchenTimers;
  const left = Object.values(paused).find(
    (t) => t.status === "paused",
  ).remaining;
  await page.getByRole("link", { name: "菜谱库", exact: true }).click();
  await page.reload();
  await page.getByRole("link", { name: /计时器/ }).click();
  await expect(long).toContainText("已暂停");
  expect(
    Object.values((await stored(page)).kitchenTimers).find(
      (t) => t.status === "paused",
    ).remaining,
  ).toBe(left);
  await long.getByRole("button", { name: "＋30 秒", exact: true }).click();
  await long.getByRole("button", { name: "继续", exact: true }).click();
  await expect(
    long.getByRole("button", { name: "暂停", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "编辑常用计时：30 秒", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("名称", { exact: true }).fill("焯水");
  await dialog.getByLabel("常用秒数", { exact: true }).fill("45");
  await dialog.getByRole("button", { name: "保存常用时长" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "焯水 00:45", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".timers-page")).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "test-results/timers-375.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("精选筛选取交集，主料弹层、拉黑后计数同步", async ({ page }) => {
  await page.goto("/#/recipes");
  await page.getByRole("button", { name: "蒸菜", exact: true }).click();
  await page.getByRole("button", { name: "减脂友好", exact: true }).click();
  const count = dishes.filter(
    (d) =>
      meta.dishes[d.id].discovery.steamed &&
      meta.dishes[d.id].discovery.weightFriendly,
  ).length;
  await expect(page.locator(".result-count")).toHaveText(
    `找到 ${count} 道家常菜`,
  );
  await page.getByRole("button", { name: "主料 · 全部", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "鸡", exact: true })
    .click();
  const chicken = dishes.filter(
    (d) =>
      meta.dishes[d.id].discovery.steamed &&
      meta.dishes[d.id].discovery.weightFriendly &&
      /鸡(?!蛋|精)|手枪腿/.test(d.mainIngredients.join(" ")),
  );
  await expect(page.locator(".result-count")).toHaveText(
    `找到 ${chicken.length} 道家常菜`,
  );
  const name = chicken[0].name;
  await page.getByRole("button", { name: "查看" + name, exact: true }).click();
  await expect(page.locator(".discovery-note")).toContainText(
    meta.dishes[chicken[0].id].discovery.reason,
  );
  await page.getByRole("button", { name: "拉黑菜品", exact: true }).click();
  await expect(page.locator(".result-count")).toHaveText(
    `找到 ${chicken.length - 1} 道家常菜`,
  );
  await page.getByRole("button", { name: "清除筛选", exact: true }).click();
  await expect(page.locator(".result-count")).toHaveText(
    `找到 ${dishes.length - 1} 道家常菜`,
  );
  await expect(page.locator(".library")).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "test-results/library-375.png",
    fullPage: false,
    animations: "disabled",
  });
});
for (const width of [375, 430, 1280])
  test(`完整步骤与计时页适配 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 667 : 900 });
    const dish = dishes.find((d) => d.name === "番茄香菇蒸牛肉");
    await page.goto("/#/cook/" + dish.id);
    await expect(page.locator(".step-text")).toHaveCount(dish.steps.length);
    await expect(page.locator(".cooking")).toHaveCSS("opacity", "1");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    expect(
      (await page.locator(".app-shell").boundingBox()).width,
    ).toBeLessThanOrEqual(480);
    expect(
      await page
        .locator(".step-text")
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(22);
    await page.screenshot({
      path: `test-results/cooking-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("link", { name: "计时器", exact: true }).click();
    await expect(page.locator(".timers-page")).toHaveCSS("opacity", "1");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  });
test("步骤计时同步全局页，拉黑只清理菜谱计时", async ({ page }) => {
  const dish = dishes.find((d) => d.name === "香菇蒸鸡胸肉");
  const timed = dish.steps.findIndex((s) => s.timerSeconds);
  await page.goto("/#/timers");
  await page.getByRole("button", { name: "5 分钟 05:00", exact: true }).click();
  await page.goto("/#/cook/" + dish.id);
  await expect(page.locator(".step-text")).toHaveCount(dish.steps.length);
  await page
    .locator(".cooking-step")
    .nth(timed)
    .getByRole("button", { name: /开始计时/ })
    .click();
  await page.getByRole("link", { name: /计时器/ }).click();
  await expect(page.locator(".timer-item, .timer-summary")).toHaveCount(2);
  await page.goto("/#/cook/" + dish.id);
  await page.getByRole("button", { name: "拉黑菜品", exact: true }).click();
  // Blacklisting redirects out of the recipe before the next navigation.
  await expect(page.locator(".tonight")).toHaveCSS("opacity", "1");
  await page.getByRole("link", { name: /计时器/ }).click();
  await expect(page.locator(".timer-item")).toHaveCount(1);
  await expect(page.locator(".timer-item")).toContainText("5 分钟");
  expect((await stored(page)).timers).toEqual({});
});
