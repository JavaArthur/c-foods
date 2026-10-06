import { test, expect } from "@playwright/test";
import fs from "node:fs";
const catalog = JSON.parse(fs.readFileSync("public/data/drinks.json", "utf8"));
const saved = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("dinner-v1")));
async function addBreakfast(page, name) {
  await page.getByRole("button", { name: "添加早餐", exact: true }).click();
  await page.getByLabel("早餐名称").fill(name);
  await page.getByRole("button", { name: "保存早餐" }).click();
}
test("早餐空库、录入校验、随机换选、改名删除、刷新及键盘操作", async ({
  page,
}) => {
  await page.goto("/#/breakfast");
  await expect(page.getByText("还没有早餐，先添加几个常吃的吧")).toBeVisible();
  await expect(page.getByRole("button", { name: "随机选早餐" })).toBeDisabled();
  await addBreakfast(page, " 小米粥 ");
  const id = (await saved(page)).breakfast.items[0].id;
  await addBreakfast(page, "小米粥");
  await expect(page.getByRole("alert")).toContainText("已经有");
  await page.getByLabel("早餐名称").fill("鸡蛋三明治");
  await page.getByLabel("早餐名称").press("Enter");
  await page.getByRole("button", { name: "随机选早餐" }).click();
  const first = (await saved(page)).breakfast.lastPickedId;
  await page.getByRole("button", { name: "换一个", exact: true }).click();
  expect((await saved(page)).breakfast.lastPickedId).not.toBe(first);
  const chosen = (await saved(page)).breakfast.lastPickedId;
  await page.reload();
  await expect(
    page.getByRole("button", { name: "换一个", exact: true }),
  ).toBeVisible();
  expect((await saved(page)).breakfast.lastPickedId).toBe(chosen);
  await page.getByRole("button", { name: "修改小米粥" }).click();
  await page.getByLabel("早餐名称").fill("南瓜粥");
  await page.getByRole("button", { name: "保存早餐" }).click();
  expect(
    (await saved(page)).breakfast.items.find((i) => i.id === id).name,
  ).toBe("南瓜粥");
  for (const name of ["南瓜粥", "鸡蛋三明治"]) {
    await page
      .getByRole("button", { name: "删除" + name, exact: true })
      .click();
    await page.getByRole("button", { name: "确认删除" }).click();
  }
  await expect(page.getByRole("button", { name: "随机选早餐" })).toBeDisabled();
  expect((await saved(page)).breakfast.lastPickedId).toBeNull();
});
test("饮品分类搜索、随机范围、完整做法、刷新和单项提示", async ({ page }) => {
  await page.goto("/#/drinks");
  await expect(page.locator(".drink-card")).toHaveCount(18);
  await page.getByRole("button", { name: "豆浆", exact: true }).click();
  await expect(page.locator(".drink-card")).toHaveCount(
    catalog.filter((d) => d.category === "豆浆").length,
  );
  await page.getByRole("button", { name: "随机选一杯", exact: true }).click();
  const first = (await saved(page)).drinks.lastPickedId;
  await page.getByRole("button", { name: "换一杯", exact: true }).click();
  expect((await saved(page)).drinks.lastPickedId).not.toBe(first);
  await page.getByRole("button", { name: "查看这杯做法" }).click();
  await expect(page.getByRole("dialog")).toContainText("作者：");
  await expect(
    page.getByRole("dialog").locator(".drink-steps li").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "换一杯", exact: true }),
  ).toBeVisible();
  await page.getByLabel("找一杯喜欢的").fill("原味豆浆");
  await expect(page.locator(".drink-card")).toHaveCount(1);
  await page.locator(".random-panel .primary").click();
  await expect(page.locator(".toast")).toContainText("只有这一杯");
  await page.getByLabel("找一杯喜欢的").fill("不存在的饮品");
  await expect(
    page.getByRole("button", { name: "随机选一杯", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("暂时没有匹配的饮品")).toBeVisible();
});
test("全局忌口立即清除当前饮品与早餐；清空数据包含两个模块", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "dinner-v1",
      JSON.stringify({
        breakfast: {
          items: [{ id: "breakfast-a", name: "豆浆" }],
          lastPickedId: "breakfast-a",
        },
        drinks: { lastPickedId: "drink-soy" },
      }),
    ),
  );
  await page.goto("/#/drinks");
  await expect(page.locator(".random-panel h2")).toHaveText("原味豆浆");
  await page.getByRole("link", { name: "我的", exact: true }).click();
  await page.getByRole("button", { name: "大豆", exact: true }).click();
  await page.getByRole("link", { name: "吃什么", exact: true }).click();
  await page.getByRole("link", { name: "饮品", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "查看原味豆浆", exact: true }),
  ).toHaveCount(0);
  expect((await saved(page)).drinks.lastPickedId).toBeNull();
  expect((await saved(page)).breakfast.lastPickedId).toBeNull();
  await page.getByRole("link", { name: "早餐", exact: true }).click();
  await expect(page.getByRole("button", { name: "随机选早餐" })).toBeDisabled();
  await page.getByRole("link", { name: "我的", exact: true }).click();
  await page.getByRole("button", { name: "清除本地数据" }).click();
  await page.getByRole("button", { name: "确认清空" }).click();
  expect((await saved(page)).breakfast.items).toEqual([]);
  expect((await saved(page)).drinks.lastPickedId).toBeNull();
});
test("晚餐加载失败不阻塞早餐和饮品；饮品加载失败可重试", async ({ page }) => {
  await page.route("**/data/dishes.json", (route) => route.abort());
  await page.route("**/data/drinks.json", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.goto("/#/breakfast");
  await addBreakfast(page, "小米粥");
  await page.getByRole("button", { name: "随机选早餐" }).click();
  await expect(page.locator(".random-panel h2")).toHaveText("小米粥");
  await page.getByRole("link", { name: "饮品", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "重新加载饮品" }),
  ).toBeVisible();
  await page.unroute("**/data/drinks.json");
  await page.getByRole("button", { name: "重新加载饮品" }).click();
  await expect(page.locator(".drink-card")).toHaveCount(18);
  await page.getByRole("link", { name: "晚餐", exact: true }).click();
  await expect(page.getByText("菜谱还没端上来")).toBeVisible();
});
test("切换保留晚餐搭配、确认和清单；手机布局与计时不受影响", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "帮我配菜" }).click();
  const names = await page.locator(".dish-copy h2").allTextContents();
  const cards = await page.locator(".menu-cards").boundingBox();
  const actions = await page.locator(".action-bar").boundingBox();
  expect(cards.y + cards.height).toBeLessThan(actions.y);
  await page.getByRole("button", { name: "就做这些" }).click();
  await page.getByRole("button", { name: "去看要买啥" }).click();
  await page.locator(".shopping-row input").first().check();
  await page.getByRole("link", { name: "早餐", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "今晚做饭进度" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "饮品", exact: true }).click();
  await expect(page.locator(".drink-card")).toHaveCount(18);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    375,
  );
  await page.screenshot({
    path: "test-results/drinks-375.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "晚餐", exact: true }).click();
  await expect(page.locator(".shopping-row input").first()).toBeChecked();
  await page.getByRole("button", { name: /看菜单/ }).click();
  expect(await page.locator(".dish-copy h2").allTextContents()).toEqual(names);
  await page.getByRole("link", { name: "计时器", exact: true }).click();
  await page.getByRole("button", { name: "1 分钟 01:00", exact: true }).click();
  const before = (await saved(page)).kitchenTimers;
  await page.getByRole("link", { name: "吃什么", exact: true }).click();
  await page.getByRole("link", { name: "早餐", exact: true }).click();
  expect((await saved(page)).kitchenTimers).toEqual(before);
  await page.goBack();
  await expect(page.getByRole("button", { name: "就做这些" })).toBeVisible();
  expect(errors).toEqual([]);
});
