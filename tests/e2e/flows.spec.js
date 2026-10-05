import { test, expect } from "@playwright/test";
import fs from "node:fs";
const dishes = JSON.parse(fs.readFileSync("public/data/dishes.json", "utf8"));
async function start(page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "帮我配菜" })).toBeVisible();
  await page.getByRole("button", { name: "帮我配菜" }).click();
  await expect(page.locator(".menu-cards .dish-card")).toHaveCount(2);
}
test("375×667 主流程、确认、清单持久化、做菜", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await start(page);
  const bounds = await page.locator(".menu-cards").boundingBox(),
    actions = await page.locator(".action-bar").boundingBox();
  expect(bounds.y + bounds.height).toBeLessThan(actions.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    375,
  );
  await page.screenshot({ path: "test-results/menu-375.png", fullPage: true });
  const names = await page.locator(".dish-copy h2").allTextContents();
  await page.getByRole("button", { name: "就做这些" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  for (const name of names)
    await expect(page.locator(".confirm-dishes")).toContainText(name);
  await expect(page.locator(".confirm-info")).toContainText("样食材");
  await page.getByRole("button", { name: "去看要买啥" }).click();
  const checkbox = page.locator(".shopping-row input").first();
  await checkbox.check();
  await page.getByRole("button", { name: "复制清单" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "今晚的买菜清单",
  );
  await page.reload();
  await expect(page.locator(".menu-cards .dish-card")).toHaveCount(2);
  await page.getByRole("button", { name: "3 买菜" }).click();
  await expect(page.locator(".shopping-row input").first()).toBeChecked();
  await page.getByRole("button", { name: "买好了，开做" }).click();
  await page.locator(".cook-list-row").first().click();
  const cooked = dishes.find((d) => d.name === names[0]);
  await expect(page.locator(".step-text")).toHaveCount(cooked.steps.length);
  await expect(page.locator(".cooking-ingredients")).toContainText("备好这些");
  await page.locator(".mark-step").nth(1).click();
  await expect(page.locator(".cooking-progress")).toContainText("当前 2");
  await expect(page.getByRole("navigation")).toBeVisible();
  expect(errors).toEqual([]);
});
test("锁定与换菜、收藏、筛选、自定义、人数和忌口", async ({ page }) => {
  await start(page);
  const card = page.locator(".menu-cards .dish-card").first();
  const name = await card.locator("h2").textContent();
  await card.getByRole("button", { name: "锁定" + name }).click();
  await page.getByRole("button", { name: "整桌换一换" }).click();
  await expect(page.locator(".menu-cards")).toContainText(name);
  await page.getByRole("link", { name: "菜谱库", exact: true }).click();
  await page.getByRole("textbox", { name: "按菜名搜索" }).fill("蒜蓉西兰花");
  await page.getByRole("button", { name: /素菜库/ }).click();
  await page.getByRole("button", { name: "查看蒜蓉西兰花" }).click();
  await page.getByRole("button", { name: "想再吃" }).click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("link", { name: "收藏", exact: true }).click();
  await expect(page.locator(".dish-grid")).toContainText("蒜蓉西兰花");
  await page.getByRole("link", { name: "我的", exact: true }).click();
  await page.getByRole("button", { name: "增加备菜份量" }).click();
  await page.getByRole("button", { name: "花生", exact: true }).click();
  await expect(page.getByRole("heading", { name: "全家无辣" })).toBeVisible();
  await page.reload();
  await expect(page.locator(".servings")).toContainText("3");
  await expect(
    page.getByRole("button", { name: "花生", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "今晚吃啥", exact: true }).click();
  await page.getByRole("button", { name: /选搭配/ }).click();
  await page.getByRole("button", { name: /自定义/ }).click();
  await page.getByRole("button", { name: "减少荤菜" }).click();
  await page
    .getByRole("button", { name: "减少素菜" })
    .isDisabled()
    .then((x) => expect(x).toBeTruthy());
});
test("完整步骤、计时结束、常亮申请与释放", async ({ page }) => {
  const dish = dishes.find((d) => d.name === "蒜蓉西兰花");
  const timed = dish.steps.findIndex((s) => s.timerSeconds);
  await page.addInitScript(
    ({ id, step }) => {
      localStorage.setItem(
        "dinner-v1",
        JSON.stringify({ progress: { [id]: { step } } }),
      );
      window.wakeCalls = 0;
      window.wakeReleased = 0;
      Object.defineProperty(navigator, "wakeLock", {
        value: {
          request: async () => {
            window.wakeCalls++;
            return { release: async () => window.wakeReleased++ };
          },
        },
      });
      Object.defineProperty(navigator, "vibrate", {
        value: () => {
          window.vibrated = true;
          return true;
        },
      });
    },
    { id: dish.id, step: timed },
  );
  await page.goto("/#/cook/" + dish.id);
  const step = page.locator(".cooking-step").nth(timed);
  await expect(step.getByRole("button", { name: /开始计时/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.wakeCalls)).toBe(1);
  await step.getByRole("button", { name: /开始计时/ }).click();
  await expect(step.getByLabel("剩余时间")).toBeVisible();
  await page.clock.install();
  await page.clock.fastForward((dish.steps[timed].timerSeconds + 1) * 1000);
  await expect(step.getByRole("status")).toContainText("时间到");
  expect(await page.evaluate(() => window.vibrated)).toBeTruthy();
  await page
    .locator(".mark-step")
    .nth(timed + 1)
    .click();
  await expect(page.locator(".cooking-progress")).toContainText(
    String(timed + 2),
  );
  await page.getByRole("button", { name: "返回今晚做菜列表" }).click();
  expect(await page.evaluate(() => window.wakeReleased)).toBe(1);
});
test("加载错误兜底、重试与空状态", async ({ page }) => {
  await page.route("**/data/dishes.json", (r) => r.abort());
  await page.goto("/");
  await expect(page.getByText("菜谱没加载出来，点我再试一次。")).toBeVisible();
  await page.unroute("**/data/dishes.json");
  await page.getByRole("button", { name: "再试一次" }).click();
  await expect(page.getByRole("button", { name: "帮我配菜" })).toBeVisible();
  await page.getByRole("link", { name: "收藏", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "留个位置给喜欢的菜" }),
  ).toBeVisible();
});

test("示意图片、估时依据、前置准备和旧收藏迁移", async ({ page }) => {
  const meta = JSON.parse(
    fs.readFileSync("public/data/dish-meta.json", "utf8"),
  );
  const [old, current] = Object.entries(meta.redirects)[0];
  await page.addInitScript(
    ({ old }) =>
      localStorage.setItem("dinner-v1", JSON.stringify({ favorites: [old] })),
    { old },
  );
  await page.goto("/#/favorites");
  await expect(
    page.getByRole("heading", { name: "留个位置给喜欢的菜" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "菜谱库", exact: true }).click();
  await page.getByRole("button", { name: /素菜库/ }).click();
  await page.getByRole("textbox", { name: "按菜名搜索" }).fill("蒜蓉西兰花");
  await expect(page.locator(".dish-grid .image-label")).toHaveText("示意图");
  const img = page.locator(".dish-grid img");
  await expect
    .poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0))
    .toBe(true);
  await page.getByRole("button", { name: "查看蒜蓉西兰花" }).click();
  await expect(page.locator(".time-explanation")).toContainText("预计");
  await expect(page.getByRole("dialog")).toContainText("AI 生成");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: /荤菜库/ }).click();
  await page
    .getByRole("textbox", { name: "按菜名搜索" })
    .fill("香菇烧肉（家庭无辣版）");
  await page
    .getByRole("button", { name: "查看香菇烧肉（家庭无辣版）" })
    .click();
  await expect(page.locator(".time-explanation")).toContainText("55–70");
  await expect(page.locator(".time-explanation")).toContainText("香菇");
});
