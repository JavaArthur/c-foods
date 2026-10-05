import { test, expect } from "@playwright/test";

async function create(page, seconds, name) {
  await page.getByRole("button", { name: "新建计时", exact: true }).click();
  await page.getByLabel("计时分钟", { exact: true }).fill("0");
  await page.getByLabel("计时秒数", { exact: true }).fill(String(seconds));
  await page.getByPlaceholder("例如：蒸鱼、煮汤").fill(name);
  await page.getByRole("button", { name: "开始计时", exact: true }).click();
}
async function inViewport(page) {
  await expect(page.locator(".current-timer")).toBeFocused();
  const card = await page.locator(".timer-featured").boundingBox();
  const nav = await page.locator(".bottom-nav").boundingBox();
  expect(card.y).toBeGreaterThanOrEqual(0);
  expect(card.y + card.height).toBeLessThanOrEqual(nav.y);
}
async function mockSound(page, unavailable = false) {
  await page.addInitScript((unavailable) => {
    window.__voices = [];
    window.__gains = [];
    window.AudioContext = unavailable
      ? undefined
      : class {
          state = "running";
          destination = {};
          get currentTime() {
            return Date.now() / 1000;
          }
          resume() {
            return Promise.resolve();
          }
          close() {
            this.state = "closed";
            return Promise.resolve();
          }
          createOscillator() {
            const voice = {
              frequency: {},
              connected: false,
              connect() {
                this.connected = true;
              },
              disconnect() {
                this.connected = false;
              },
              start(time) {
                this.startTime = time;
              },
              stop(time) {
                this.endTime = time ?? Date.now() / 1000;
              },
            };
            window.__voices.push(voice);
            return voice;
          }
          createGain() {
            return {
              connect() {},
              disconnect() {},
              gain: {
                setValueAtTime(value) {
                  window.__gains.push(value);
                },
                linearRampToValueAtTime(value) {
                  window.__gains.push(value);
                },
              },
            };
          }
        };
    window.webkitAudioContext = undefined;
  }, unavailable);
}
const connectedVoices = (page) =>
  page.evaluate(() => window.__voices.filter((v) => v.connected).length);

for (const width of [375, 430, 1280]) {
  test(`新计时和点选计时立即完整可见 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 667 : 900 });
    await page.goto("/#/timers");
    await expect(page.getByText("让时间帮你看着锅")).toBeVisible();
    await page
      .getByRole("button", { name: "15 分钟 15:00", exact: true })
      .click();
    await inViewport(page);
    for (let i = 0; i < 5; i++)
      await page
        .getByRole("button", { name: "5 分钟 05:00", exact: true })
        .click();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page
      .getByRole("button", { name: "查看计时：15 分钟", exact: true })
      .click();
    await expect(page.locator(".timer-featured")).toContainText("15 分钟");
    await inViewport(page);
    const name = "给家人准备的蒸鱼和蔬菜请记得查看锅中水量"
      .repeat(2)
      .slice(0, 40);
    await create(page, 59, name);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".timer-featured")).toContainText(name);
    await inViewport(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    const buttons = await page.locator(".timer-featured button").all();
    for (const button of buttons) {
      const box = await button.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: `test-results/timer-current-${width}.png` });
    await page.getByRole("button", { name: "取消计时", exact: true }).click();
    await expect(page.locator(".timer-featured")).toContainText("5 分钟");
    await page.reload();
    await expect(page.locator(".timer-featured")).toContainText("5 分钟");
  });
}

test("响铃持续15秒、跨页可停止、加时后再次提醒且刷新不重响", async ({
  page,
}) => {
  await mockSound(page);
  await page.goto("/#/timers");
  await page.clock.install();
  await create(page, 2, "蒸鱼");
  await page.clock.runFor(2000);
  const alarm = page.getByRole("complementary", { name: "计时到期提醒" });
  await expect(alarm).toContainText("蒸鱼");
  expect(await connectedVoices(page)).toBe(16);
  expect(await page.evaluate(() => Math.max(...window.__gains))).toBe(0.5);
  await page.clock.runFor(14000);
  await expect(alarm).toBeVisible();
  await page.clock.runFor(1000);
  await expect(alarm).toHaveCount(0);
  expect(await connectedVoices(page)).toBe(0);
  await expect(page.locator(".timer-featured")).toContainText("时间到");
  await page.getByRole("button", { name: "＋30 秒", exact: true }).click();
  await page.clock.runFor(30000);
  await expect(alarm).toBeVisible();
  await page.getByRole("link", { name: "菜谱库", exact: true }).click();
  await alarm.getByRole("button", { name: "停止响铃" }).click();
  expect(await connectedVoices(page)).toBe(0);
  await page.getByRole("link", { name: /计时器/ }).click();
  await expect(page.locator(".timer-featured")).toContainText("时间到");
  await page.reload();
  await expect(alarm).toHaveCount(0);
  expect(await connectedVoices(page)).toBe(0);
});

test("同时及先后到期共用声道，重新计时和删除撤销对应提醒", async ({ page }) => {
  await mockSound(page);
  await page.goto("/#/timers");
  await page.clock.install();
  // Freeze time while creating so the first pair expires together.
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await create(page, 2, "一号锅");
  await create(page, 2, "二号锅");
  await create(page, 6, "三号锅");
  await page.clock.runFor(2000);
  const alarm = page.locator(".timer-alarm");
  await expect(alarm).toContainText("一号锅、二号锅");
  expect(await connectedVoices(page)).toBe(16);
  await page.clock.runFor(4000);
  await expect(alarm).toContainText("三号锅");
  expect(await connectedVoices(page)).toBe(16);
  await page.getByRole("button", { name: "重新计时", exact: true }).click();
  await expect(alarm).not.toContainText("三号锅");
  await page.getByRole("button", { name: "取消计时", exact: true }).click();
  await expect(page.locator(".timer-featured")).toContainText("一号锅");
  await page.getByRole("button", { name: "关闭计时", exact: true }).click();
  await expect(alarm).not.toContainText("一号锅");
  await page.getByRole("button", { name: "＋1 分", exact: true }).click();
  await expect(alarm).toHaveCount(0);
  expect(await connectedVoices(page)).toBe(0);
});

test("试听可停止，音频不可用仍显示到期与停止入口", async ({ page }) => {
  await mockSound(page, true);
  await page.goto("/#/timers");
  await page.clock.install();
  await page.getByRole("button", { name: "试听提醒", exact: true }).click();
  await expect(page.getByText(/声音暂未启用/)).toBeVisible();
  await page.getByRole("button", { name: "停止试听", exact: true }).click();
  await create(page, 1, "煮蛋");
  await page.clock.runFor(1000);
  await expect(page.locator(".timer-alarm")).toContainText("声音未启用");
  await page.getByRole("button", { name: "停止响铃", exact: true }).click();
  await expect(page.locator(".timer-featured")).toContainText("时间到");
});

test("实际音频渲染：提高响度、重复双音、手动停止释放节点", async ({ page }) => {
  await page.goto("/#/timers");
  const result = await page.evaluate(async () => {
    const { scheduleTimerSound } = await import("/src/lib/timer-sound.js");
    const sampleRate = 16000;
    const render = async (old = false, cancelled = false) => {
      const context = new OfflineAudioContext(1, sampleRate * 16, sampleRate);
      if (old) {
        const osc = context.createOscillator(),
          gain = context.createGain();
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(context.destination);
        gain.gain.setValueAtTime(0.15, 0);
        gain.gain.exponentialRampToValueAtTime(0.001, 0.9);
        osc.start();
        osc.stop(1);
      } else {
        const stop = scheduleTimerSound(context);
        if (cancelled) stop();
      }
      return (await context.startRendering()).getChannelData(0);
    };
    const old = await render(true),
      current = await render(),
      stopped = await render(false, true);
    const rms = (samples, from, to) => {
      const part = samples.slice(from * sampleRate, to * sampleRate);
      return Math.sqrt(part.reduce((sum, n) => sum + n * n, 0) / part.length);
    };
    return {
      oldRms: rms(old, 0, 1),
      newRms: rms(current, 0, 1),
      secondTone: rms(current, 0.38, 0.66),
      lastPair: rms(current, 14, 15),
      gap: rms(current, 1, 2),
      after: rms(current, 15, 16),
      stopped: rms(stopped, 0, 16),
      peak: current.reduce((p, n) => Math.max(p, Math.abs(n)), 0),
    };
  });
  expect(result.newRms).toBeGreaterThan(result.oldRms * 4);
  expect(result.secondTone).toBeGreaterThan(0.2);
  expect(result.lastPair).toBeGreaterThan(0.2);
  expect(result.peak).toBeLessThanOrEqual(0.51);
  expect(result.gap).toBe(0);
  expect(result.after).toBe(0);
  expect(result.stopped).toBe(0);
});
