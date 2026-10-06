import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { localDate } from "../../src/lib/menu.js";
const dishes = JSON.parse(fs.readFileSync("public/data/dishes.json"));
const leaf = dishes.find((d) => d.name === "清炒茼蒿");
const meat = dishes.find((d) => d.name === "山药蒸肉饼（家庭无辣版）");
const custom = {
  id: "custom-fixture",
  name: "妈妈的蒸肉饼",
  createdAt: "2026-10-04T00:00:00.000Z",
};
async function seed(page, saved = {}) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "帮我配菜" })).toBeVisible();
  await page.evaluate(
    (s) => localStorage.setItem("dinner-v1", JSON.stringify(s)),
    saved,
  );
  await page.reload();
  await expect(page.locator(".skeleton")).toHaveCount(0);
}
async function library(page) {
  await page.getByRole("link", { name: "菜谱库", exact: true }).click();
}
async function create(page, name) {
  await library(page);
  await page.getByRole("button", { name: "录入菜品" }).click();
  await page.getByLabel("菜名", { exact: true }).fill(name);
  await page.getByRole("button", { name: "保存菜名" }).click();
}
async function stored(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("dinner-v1")));
}

test("自录菜贯穿菜单、换菜、购物清单和做菜，刷新保留且无虚构详情", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await seed(page, { today: { date: localDate(), ids: [meat.id, leaf.id] } });
  await create(page, custom.name);
  await expect(page.locator(".library .dish-card")).toHaveCount(1);
  await expect(page.locator(".library .dish-card")).toContainText("详情待补");
  await expect(page.locator(".library .dish-card")).not.toContainText("不辣");
  await page.getByRole("button", { name: "查看" + custom.name }).click();
  await expect(page.getByRole("dialog")).not.toContainText("HowToCook");
  await page.getByRole("button", { name: "想再吃" }).click();
  await page.getByRole("button", { name: "加入今晚菜单" }).click();
  await page.getByRole("link", { name: "吃什么", exact: true }).click();
  await expect(page.locator(".menu-cards .dish-card")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "移出今晚：" + custom.name }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "锁定" + custom.name }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "整桌换一换" }).click();
  await expect(page.locator(".menu-cards")).toContainText(custom.name);
  await expect(page.locator(".menu-cards .dish-card")).toHaveCount(3);
  await expect(page.locator(".menu-heading")).toContainText("不含自录菜");
  await page.getByRole("button", { name: "就做这些" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "以下自家菜的食材待补：" + custom.name,
  );
  await page.getByRole("button", { name: "去看要买啥" }).click();
  await expect(page.locator(".pending-ingredients")).toContainText(custom.name);
  await page.getByRole("button", { name: "复制清单" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "以下自家菜的食材待补：" + custom.name,
  );
  await page.getByRole("button", { name: "买好了，开做" }).click();
  await page.locator(".cook-list-row").filter({ hasText: custom.name }).click();
  await expect(page.locator(".custom-cooking")).toContainText("做法待补");
  await expect(
    page.locator(".step-text, .timer-box, .cooking-progress"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "这道完成啦" }).click();
  await expect(
    page.locator(".cook-list-row").filter({ hasText: custom.name }),
  ).toContainText("已完成");
  await page.reload();
  await expect(page.locator(".menu-cards")).toContainText(custom.name);
  const s = await stored(page);
  expect(s.today.ids).toContain(s.customDishes[0].id);
  expect(s.progress[s.customDishes[0].id].done).toBe(true);
  await page.getByRole("link", { name: "收藏", exact: true }).click();
  await expect(page.locator(".dish-grid")).toContainText(custom.name);
  expect(errors).toEqual([]);
});

test("拉黑立即隐藏、移出菜单并要求重确认；恢复保留收藏但不自动加入菜单", async ({
  page,
}) => {
  await seed(page, {
    today: { date: localDate(), ids: [meat.id, leaf.id] },
    history: [{ date: localDate(), ids: [meat.id, leaf.id] }],
    favorites: [meat.id],
    checks: { 盐: true },
    progress: { [meat.id]: { step: 1 } },
    timers: { [meat.id + ":1"]: { end: Date.now() + 999999 } },
  });
  await page.getByRole("button", { name: "锁定" + meat.name }).click();
  await page.getByRole("button", { name: "查看" + meat.name }).click();
  await page.getByRole("button", { name: "拉黑菜品", exact: true }).click();
  await expect(page.locator(".menu-cards .dish-card")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "3 买菜" })).toBeDisabled();
  let s = await stored(page);
  expect(s.settings.blacklist).toEqual([meat.id]);
  expect(s.today.needsConfirmation).toBe(true);
  expect(s.checks).toEqual({});
  expect(s.timers).toEqual({});
  expect(s.progress).toEqual({});
  await page.goto("/#/cook/" + meat.id);
  await expect(
    page.getByRole("heading", { name: "这道菜已拉黑" }),
  ).toBeVisible();
  expect((await stored(page)).progress).toEqual({});
  await page.goto("/#/");
  await library(page);
  await page.getByRole("textbox", { name: "按菜名搜索" }).fill(meat.name);
  await expect(page.locator(".dish-card")).toHaveCount(0);
  await page.getByRole("link", { name: "收藏", exact: true }).click();
  await expect(page.locator(".dish-card")).toHaveCount(0);
  await page.getByRole("button", { name: "历史菜单" }).click();
  await expect(page.locator(".history-card")).toContainText(meat.name);
  await page.getByRole("button", { name: "再做一次这桌" }).click();
  await expect(page.locator(".menu-cards .dish-card")).toHaveCount(1);
  await page.getByRole("link", { name: "我的", exact: true }).click();
  await page.locator("summary").filter({ hasText: "已拉黑菜品" }).click();
  await page.getByRole("button", { name: "恢复" + meat.name }).click();
  await page.getByRole("link", { name: "收藏", exact: true }).click();
  await expect(page.locator(".dish-card")).toContainText(meat.name);
  await page.getByRole("link", { name: "吃什么", exact: true }).click();
  await expect(page.locator(".menu-cards .dish-card")).toHaveCount(1);
  await page.reload();
  s = await stored(page);
  expect(s.settings.blacklist).toEqual([]);
  expect(s.favorites).toEqual([meat.id]);
});

test("录入校验、同名菜恢复、改名保持 ID、删除后历史仍显示菜名", async ({
  page,
}) => {
  await seed(page, {
    customDishes: [custom],
    favorites: [custom.id],
    settings: { blacklist: [meat.id, meat.id] },
    today: { date: localDate(), ids: [custom.id, leaf.id] },
    history: [{ date: localDate(), ids: [custom.id, leaf.id] }],
  });
  await create(page, " ");
  await expect(page.getByRole("alert")).toContainText("请填写菜名");
  const input = page.getByLabel("菜名", { exact: true });
  await input.fill("菜".repeat(51));
  await page.getByRole("button", { name: "保存菜名" }).click();
  await expect(page.getByRole("alert")).toContainText("最多 50 字");
  await input.fill(custom.name);
  await input.press("Enter");
  await expect(
    page.getByRole("button", { name: "查看已有菜品" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "查看已有菜品" }).click();
  await expect(page.getByRole("dialog")).toContainText(custom.name);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "录入菜品" }).click();
  await input.fill(meat.name);
  await page.getByRole("button", { name: "保存菜名" }).click();
  await page.getByRole("button", { name: "恢复这道已拉黑的菜" }).click();
  await expect(page.getByRole("dialog")).toContainText(meat.name);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: /我录入的/ }).click();
  await page.getByRole("button", { name: "查看" + custom.name }).click();
  await page.getByRole("button", { name: "修改菜名" }).click();
  await page.getByLabel("菜名", { exact: true }).fill("奶奶的蒸肉饼");
  await page.getByRole("button", { name: "保存菜名" }).click();
  await expect(page.getByRole("dialog")).toContainText("奶奶的蒸肉饼");
  const s = await stored(page);
  expect(s.customDishes[0].id).toBe(custom.id);
  expect(s.today.ids).toContain(custom.id);
  await page.getByRole("button", { name: "删除菜品", exact: true }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(page.locator(".library .dish-card")).toHaveCount(0);
  await page.reload();
  await page.getByRole("link", { name: "收藏", exact: true }).click();
  await page.getByRole("button", { name: "历史菜单" }).click();
  await expect(page.locator(".history-card")).toContainText(
    "奶奶的蒸肉饼（已删除）",
  );
  await page.getByRole("button", { name: "再做一次这桌" }).click();
  await expect(page.locator(".menu-cards .dish-card")).toHaveCount(1);
});

test("自录菜不能替代绿叶菜，不绕过忌口，长菜名和录入弹窗适配 375px", async ({
  page,
}) => {
  await seed(page);
  const name = "我家清炒菠菜" + "家常".repeat(22);
  await library(page);
  await page.getByRole("button", { name: "录入菜品" }).click();
  await page.getByLabel("菜名", { exact: true }).fill(name);
  await page.screenshot({
    path: "test-results/custom-form-375.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "保存菜名" }).click();
  await page.getByRole("button", { name: "查看" + name }).click();
  await page.screenshot({
    path: "test-results/custom-detail-375.png",
    animations: "disabled",
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    375,
  );
  for (const label of ["加入今晚菜单", "拉黑菜品", "修改菜名", "删除菜品"]) {
    const box = await page
      .getByRole("button", { name: label, exact: true })
      .boundingBox();
    expect(Number(box.height.toFixed(2))).toBeGreaterThanOrEqual(44);
    expect(Number(box.width.toFixed(2))).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: "加入今晚菜单" }).click();
  await page.getByRole("link", { name: "吃什么", exact: true }).click();
  await page.getByRole("button", { name: "就做这些" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("绿叶菜");
  await page.getByRole("button", { name: "整桌换一换" }).click();
  await expect(page.locator(".menu-cards .dish-card")).toHaveCount(1);
  await expect(page.getByRole("status")).toContainText("自家菜会为你保留");
  await page.screenshot({
    path: "test-results/custom-menu-375.png",
    animations: "disabled",
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    375,
  );
  await page.getByRole("button", { name: "移出今晚：" + name }).click();
  await expect(page.getByRole("button", { name: "帮我配菜" })).toBeVisible();
  await create(page, "胡椒蒸肉");
  await page.getByRole("button", { name: "查看胡椒蒸肉" }).click();
  await page.getByRole("button", { name: "加入今晚菜单" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("忌口或辣度");
});
