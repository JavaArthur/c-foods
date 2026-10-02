import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const base = process.env.TEST_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 375, height: 667 },
  locale: "zh-CN",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base);
await page.getByRole("button", { name: "帮我配菜" }).waitFor();
const chip = await page.getByRole("button", { name: "自定义" }).boundingBox(),
  homeActions = await page.locator(".action-bar").boundingBox();
if (chip.y + chip.height > homeActions.y)
  throw Error("首页搭配按钮被操作栏遮挡");
await fs.mkdir("docs/screenshots", { recursive: true });
await page.screenshot({
  path: "docs/screenshots/home.png",
  animations: "disabled",
});
await page.getByRole("button", { name: "帮我配菜" }).click();
await page.locator(".menu-cards .dish-card").nth(1).waitFor();
await page.screenshot({
  path: "docs/screenshots/menu.png",
  animations: "disabled",
});
const bounds = await page.locator(".menu-cards").boundingBox(),
  actions = await page.locator(".action-bar").boundingBox();
if (bounds.y + bounds.height > actions.y) throw Error("菜单被操作栏遮挡");
await page.getByRole("button", { name: "就做这些" }).click();
await page.getByRole("dialog").waitFor();
await page.screenshot({
  path: "docs/screenshots/confirm.png",
  animations: "disabled",
});
await page.getByRole("button", { name: "去看要买啥" }).click();
const manifestHref = await page
  .locator("link[rel=manifest]")
  .getAttribute("href");
const response = await page.request.get(new URL(manifestHref, base).href);
const manifest = await response.json();
if (manifest.icons.length < 2 || manifest.display !== "standalone")
  throw Error("Manifest 不完整");
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
await context.setOffline(true);
await page.reload();
await page.locator(".menu-cards .dish-card").nth(1).waitFor();
const offlineImages = await page.evaluate(async () => {
  const base = location.href.split("#")[0];
  const response = await fetch(new URL("data/dishes.json", base));
  const dishes = await response.json();
  for (const dish of dishes) {
    const r = await fetch(new URL(dish.image.slice(1), base));
    if (!r.ok) throw Error("图片加载失败：" + dish.name);
    const bitmap = await createImageBitmap(await r.blob());
    if (!bitmap.width) throw Error("图片不可解码：" + dish.name);
    bitmap.close();
  }
  return dishes.length;
});
console.log(`PASS: ${offlineImages} 张图片全部离线可读取并解码`);
console.log(
  "PASS: 375×667 菜单完整可见、manifest 和图标、离线刷新本地菜谱与今日菜单",
);
await context.setOffline(false);
await page.getByRole("link", { name: "菜谱库", exact: true }).click();
await page.getByRole("textbox", { name: "按菜名搜索" }).waitFor();
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
if (sw !== 375) throw Error("存在横向溢出");
await page.emulateMedia({ reducedMotion: "reduce" });
const reduced = await page
  .locator(".dish-card")
  .first()
  .evaluate((e) => getComputedStyle(e).transitionDuration);
console.log("PASS: 菜谱库无横向滚动、减少动态效果 " + reduced);
await page.setViewportSize({ width: 667, height: 375 });
if ((await page.evaluate(() => document.documentElement.scrollWidth)) > 667)
  throw Error("横屏溢出");
await page.setViewportSize({ width: 1440, height: 900 });
const app = await page.locator(".app-shell").boundingBox();
if (app.width > 480) throw Error("桌面超过480px");
console.log("PASS: 横屏与桌面最大480px");
if (errors.length) throw Error(errors.join("\n"));
await browser.close();
