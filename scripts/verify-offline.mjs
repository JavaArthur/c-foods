// Run after `npm run build`. Pass an optional previous production dist to test an upgrade.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
const current = path.resolve("dist");
const previous = process.argv[2] && path.resolve(process.argv[2]);
let root = previous || current;
const dishes = JSON.parse(
  await fs.readFile(path.join(current, "data/dishes.json")),
);
const meta = JSON.parse(
  await fs.readFile(path.join(current, "data/dish-meta.json")),
);
const leaf = dishes.find((d) => d.name === "蒜泥菠菜");
const meat = dishes.find((d) => d.name === "香菇滑鸡");
const removed = Object.keys(meta.removed).find(
  (id) => meta.removed[id].name === "水煮牛肉",
);
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const relative = pathname.replace(/^\/c-foods\//, "") || "index.html";
  const file = path.resolve(root, decodeURIComponent(relative));
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await fs.readFile(file);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".webp": "image/webp",
        ".png": "image/png",
      }[path.extname(file)] || "application/octet-stream",
    );
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 375, height: 667 },
  serviceWorkers: "allow",
});
const page = await context.newPage();
const base = `http://127.0.0.1:${server.address().port}/c-foods/`;
try {
  await page.goto(base);
  await page.getByRole("button", { name: "帮我配菜" }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.evaluate(
    async ({ ids }) => {
      const d = new Date(),
        date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      localStorage.setItem(
        "dinner-v1",
        JSON.stringify({
          settings: { spicy: 3 },
          favorites: ids,
          today: { date, ids },
          history: [{ date, ids }],
          checks: { 盐: true },
        }),
      );
      const cache = await caches.open("dish-images");
      await cache.put(
        new URL("images/stale.webp", location.href),
        new Response("old"),
      );
    },
    { ids: previous ? [removed, leaf.id] : [meat.id, leaf.id] },
  );
  if (previous) {
    root = current;
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      const changed = new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error("Service worker update timed out")),
          30000,
        );
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });
      await reg.update();
      await changed;
    });
  }
  await page.reload();
  await page.locator(".menu-cards .dish-card").first().waitFor();
  if (previous) {
    const state = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("dinner-v1")),
    );
    assert.deepEqual(state.favorites, [leaf.id]);
    assert(state.today.needsConfirmation);
    assert.deepEqual(state.checks, {});
    assert.equal(await page.evaluate(() => caches.has("dish-images")), false);
  }
  await page.waitForFunction(async (image) => {
    const cache = await caches.open("dish-images-family-v2");
    return !!(await cache.match(new URL(image.slice(1), location.href)));
  }, leaf.image);
  const keys = await page.evaluate(() => caches.keys());
  const precache = await page.evaluate(async () => {
    const keys = await caches.keys();
    const cache = await caches.open(keys.find((k) => k.includes("precache")));
    return (await cache.keys()).map((r) => r.url);
  });
  assert(!precache.some((url) => url.includes("/images/")));
  // Name-only dishes must survive catalog migration and work without image requests.
  const customName = "我家的蒸肉饼";
  await page.getByRole("link", { name: "菜谱库", exact: true }).click();
  await page.getByRole("button", { name: "录入菜品" }).click();
  await page.getByLabel("菜名", { exact: true }).fill(customName);
  await page.getByRole("button", { name: "保存菜名" }).click();
  await page.getByRole("button", { name: "查看" + customName }).click();
  await page.getByRole("button", { name: "想再吃" }).click();
  await page.getByRole("button", { name: "加入今晚菜单" }).click();
  await page.getByRole("link", { name: "今晚吃啥", exact: true }).click();
  await page.getByRole("button", { name: "就做这些" }).click();
  await page.getByRole("button", { name: "去看要买啥" }).click();
  const customId = await page.evaluate(
    () => JSON.parse(localStorage.getItem("dinner-v1")).customDishes[0].id,
  );
  await context.setOffline(true);
  await page.reload();
  await page.locator(".menu-cards .dish-card").first().waitFor();
  assert(
    (await page.locator(".menu-cards").textContent()).includes(customName),
  );
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".menu-cards img")].every(
      (i) => i.complete && i.naturalWidth > 0,
    ),
  );
  await page.getByRole("button", { name: "就做这些" }).click();
  await page.getByRole("button", { name: "去看要买啥" }).click();
  assert(
    (await page.locator(".pending-ingredients").textContent()).includes(
      customName,
    ),
  );
  await page.locator(".shopping-row input").first().check();
  await page.getByRole("button", { name: "买好了，开做" }).click();
  await page.locator(".cook-list-row").first().click();
  await page.locator(".step-text").first().waitFor();
  await page.locator(".ingredient-detail").waitFor();
  await page.getByRole("link", { name: "计时器", exact: true }).click();
  await page.getByRole("button", { name: "1 分钟 01:00", exact: true }).click();
  const timers = await page.evaluate(
    () => JSON.parse(localStorage.getItem("dinner-v1")).kitchenTimers,
  );
  await page.reload();
  await page.locator(".timer-item").waitFor();
  const reloaded = await page.evaluate(
    () => JSON.parse(localStorage.getItem("dinner-v1")).kitchenTimers,
  );
  assert.deepEqual(Object.keys(reloaded), Object.keys(timers));
  assert.equal(Object.values(reloaded)[0].end, Object.values(timers)[0].end);
  await page.goto(base + "#/cook/" + customId);
  await page.locator(".custom-cooking").waitFor();
  await page.getByRole("button", { name: "这道完成啦" }).click();
  await page.reload();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dinner-v1")),
  );
  assert(saved.customDishes.some((d) => d.id === customId));
  assert(saved.favorites.includes(customId));
  assert(saved.progress[customId].done);
  if (previous) {
    await page.goto(base + "#/cook/" + removed);
    await page.getByText("已下架：", { exact: false }).waitFor();
  }
  console.log(
    JSON.stringify(
      {
        result: "passed",
        scope: "/c-foods/",
        upgrade: !!previous,
        offline: [
          "reload",
          "menu images",
          "shopping",
          "cooking",
          "details",
          "independent timer reload",
          "custom dish persistence and cooking",
          ...(previous ? ["retired recipe link"] : []),
        ],
        cacheKeys: keys,
        precacheEntries: precache.length,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  server.close();
}
