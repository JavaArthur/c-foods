import { chromium } from "@playwright/test";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve("dist");
const server = http.createServer(async (req, res) => {
  const file = path.resolve(
    root,
    "." +
      decodeURIComponent(
        req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0],
      ),
  );
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const data = await fs.readFile(file);
    res.setHeader(
      "Content-Type",
      {
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".html": "text/html",
        ".webp": "image/webp",
      }[path.extname(file)] || "application/octet-stream",
    );
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch();
const runs = [];
try {
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 40,
      downloadThroughput: 1_250_000,
      uploadThroughput: 625_000,
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.getByRole("button", { name: /帮我配菜/ }).waitFor();
    const ready = await page.evaluate(() => performance.now());
    const bytes = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .reduce((s, r) => s + r.transferSize, 0),
    );
    await page.evaluate(() => {
      window.benchStart = performance.now();
      document.querySelector(".action-bar .primary").click();
    });
    await page.locator(".menu-cards .dish-card").first().waitFor();
    const generate = await page.evaluate(
      () => performance.now() - window.benchStart,
    );
    await page.evaluate(() => {
      window.benchStart = performance.now();
      document.querySelector('a[href="#/recipes"]').click();
    });
    await page.locator(".library .dish-card").first().waitFor();
    const library = await page.evaluate(
      () => performance.now() - window.benchStart,
    );
    runs.push({
      readyMs: Math.round(ready),
      generateMs: Math.round(generate),
      libraryMs: Math.round(library),
      initialBytes: bytes,
    });
    await context.close();
  }
  console.log(
    JSON.stringify(
      {
        network:
          "10 Mbps, 40 ms latency; 375×667 Chromium; cold context, SW blocked",
        runs,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  server.close();
}
