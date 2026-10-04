import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { localDate, shoppingList } from "../../src/lib/menu.js";
const dishes = JSON.parse(fs.readFileSync("public/data/dishes.json"));
const meta = JSON.parse(fs.readFileSync("public/data/dish-meta.json"));
const pork = dishes.find((d) => d.name === "山药蒸肉饼（家庭无辣版）");
const leaf = dishes.find((d) => d.name === "清炒茼蒿");
async function seed(page, saved) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "帮我配菜" })).toBeVisible();
  await page.evaluate(
    (s) => localStorage.setItem("dinner-v1", JSON.stringify(s)),
    saved,
  );
  await page.reload();
}
test("旧菜单迁移、历史下架标记和旧链接提示；受影响菜单需要重新确认", async ({
  page,
}) => {
  const old = Object.keys(meta.redirects)[0],
    removed = meta.redirects[old];
  await seed(page, {
    favorites: [old, leaf.id],
    today: { date: localDate(), ids: [old, leaf.id] },
    history: [{ date: localDate(), ids: [old, leaf.id], servings: 2 }],
    checks: { 盐: true },
    progress: { [old]: { step: 1 } },
    timers: { [old + ":1"]: { end: Date.now() + 600000 } },
  });
  await expect(page.locator(".menu-cards .dish-card")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "3 买菜" })).toBeDisabled();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dinner-v1")),
  );
  expect(stored.favorites).toEqual([leaf.id]);
  expect(stored.today.needsConfirmation).toBe(true);
  expect(stored.checks).toEqual({});
  expect(stored.timers).toEqual({});
  await page.getByRole("link", { name: "收藏", exact: true }).click();
  await page.getByRole("button", { name: "历史菜单" }).click();
  await expect(page.locator(".history-card")).toContainText(
    meta.removed[removed].name + "（已下架）",
  );
  await page.goto("/#/cook/" + old);
  await expect(page.getByText("已下架：", { exact: false })).toBeVisible();
});
test("调份量后清空旧购物勾选，详情、购物和做菜用量保持一致；忌口变更阻止确认", async ({
  page,
}) => {
  await seed(page, {
    today: { date: localDate(), ids: [pork.id, leaf.id] },
    checks: { 盐: true },
  });
  await page.getByRole("link", { name: "我的", exact: true }).click();
  await page.getByRole("button", { name: "增加备菜份量" }).click();
  await page.getByRole("link", { name: "今晚吃啥", exact: true }).click();
  await page.getByRole("button", { name: "查看" + pork.name }).click();
  const expected = shoppingList([pork], 3)[0];
  await expect(page.getByRole("dialog")).toContainText("备菜约 3 份");
  await expect(
    page
      .locator(".ingredient-detail")
      .getByText(expected.quantity, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "3 买菜" }).click();
  await expect(page.locator(".shopping-row input:checked")).toHaveCount(0);
  await expect(
    page.locator(".shopping-row").filter({ hasText: expected.name }).first(),
  ).toContainText(expected.quantity);
  await page.getByRole("button", { name: "买好了，开做" }).click();
  await page
    .getByRole("button", {
      name: new RegExp(pork.name.replace(/[（）]/g, ".")),
    })
    .click();
  await expect(page.locator(".cooking-progress")).toContainText("备菜约 3 份");
  await page.getByRole("button", { name: "返回今晚做菜列表" }).click();
  await page.getByRole("link", { name: "我的", exact: true }).click();
  await page.getByRole("button", { name: "猪肉", exact: true }).click();
  await page.getByRole("link", { name: "今晚吃啥", exact: true }).click();
  await expect(page.getByRole("button", { name: "3 买菜" })).toBeDisabled();
  await page.getByRole("button", { name: "就做这些" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("忌口");
});
test("菜库分批展示，切换筛选重置批次；营养说明在小屏折叠", async ({ page }) => {
  const beef = dishes.find((d) => d.name === "番茄土豆炖牛肉（家庭无辣版）");
  await seed(page, { today: { date: localDate(), ids: [beef.id, leaf.id] } });
  const cards = await page.locator(".menu-cards").boundingBox();
  const actions = await page.locator(".action-bar").boundingBox();
  expect(cards.y + cards.height).toBeLessThan(actions.y);
  const summary = await page.locator(".meal-balance summary").boundingBox();
  expect(summary.y + summary.height).toBeLessThanOrEqual(actions.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    375,
  );
  await page.screenshot({
    path: "test-results/family-menu-375.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.locator(".meal-balance summary").click();
  await expect(page.locator(".meal-balance")).toContainText("仅统计已记录晚餐");
  await expect(page.locator(".meal-balance")).toContainText("不能代替绿叶菜");
  await page.getByRole("link", { name: "菜谱库", exact: true }).click();
  await expect(page.locator(".library .dish-card")).toHaveCount(24);
  await page.getByRole("button", { name: /再看 24 道/ }).click();
  await expect(page.locator(".library .dish-card")).toHaveCount(
    dishes.filter((d) => d.isMeat).length,
  );
  await page.getByRole("button", { name: /素菜库/ }).click();
  await expect(page.locator(".library .dish-card")).toHaveCount(24);
  await page.getByRole("textbox", { name: "按菜名搜索" }).fill("茼蒿");
  await expect(page.locator(".library .dish-card")).toHaveCount(1);
  await page.getByRole("button", { name: "查看清炒茼蒿" }).click();
  await expect(page.getByRole("dialog")).toContainText("整理日期：2026-10-04");
  await page.screenshot({
    path: "test-results/family-detail-375.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("存储损坏可恢复；刷新后倒计时保留原截止时间", async ({ page }) => {
  await seed(page, {
    favorites: 3,
    settings: { avoids: null, servings: "x" },
    history: [null],
    timers: { a: 123 },
  });
  await expect(page.getByRole("button", { name: "帮我配菜" })).toBeVisible();
  const d = dishes.find((d) => d.name === "蒜蓉西兰花"),
    step = d.steps.findIndex((s) => s.timerSeconds);
  await page.evaluate(
    ({ id, step }) =>
      localStorage.setItem(
        "dinner-v1",
        JSON.stringify({ progress: { [id]: { step } } }),
      ),
    { id: d.id, step },
  );
  await page.goto("/#/cook/" + d.id);
  await page.reload();
  await page.getByRole("button", { name: /开始计时/ }).click();
  await expect(page.getByRole("button", { name: /剩余/ })).toBeVisible();
  const end = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem("dinner-v1")).timers[key].end,
    d.id + ":" + step,
  );
  await page.reload();
  await expect(page.getByRole("button", { name: /剩余/ })).toBeVisible();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem("dinner-v1")).timers[key].end,
      d.id + ":" + step,
    ),
  ).toBe(end);
});
