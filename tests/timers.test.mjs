import test from "node:test";
import assert from "node:assert/strict";
import {
  inputSeconds,
  createTimer,
  remainingSeconds,
  changeTimer,
  expireTimers,
  normalizeTimers,
  normalizePresets,
  formatClock,
} from "../src/lib/timer-model.js";
import { normalizeState, migrateFamilyCatalog } from "../src/lib/migrate.js";

test("分钟秒数输入边界、展示及六个常用时长校验", () => {
  assert.equal(inputSeconds("1", "30"), 90);
  assert.equal(inputSeconds(999, 59), 59999);
  for (const pair of [
    [0, 0],
    [0, 60],
    [-1, 1],
    [1.5, 0],
    [1000, 0],
    ["x", 0],
  ])
    assert.equal(inputSeconds(...pair), null);
  assert.equal(formatClock(90), "01:30");
  const presets = normalizePresets(null);
  assert.deepEqual(
    presets.map((p) => p.seconds),
    [30, 60, 180, 300, 600, 900],
  );
  presets[0] = { ...presets[0], name: "焯菜", seconds: 45 };
  assert.deepEqual(normalizePresets(presets), presets);
  assert.equal(
    normalizePresets([{ id: "bad", name: "bad", seconds: -1 }]).length,
    6,
  );
});

test("暂停后不流逝、刷新后恢复、继续按时间戳计时", () => {
  const timer = createTimer(90, "蒸鱼", 1000);
  assert.equal(remainingSeconds(timer, 11500), 80);
  changeTimer(timer, "pause", 11500);
  const restored = normalizeTimers(JSON.parse(JSON.stringify({ a: timer }))).a;
  assert.equal(remainingSeconds(restored, 900000), 80);
  changeTimer(restored, "resume", 900000);
  assert.equal(remainingSeconds(restored, 950000), 30);
  assert.equal(remainingSeconds(restored, 990000), 0);
});

test("多个到期计时仅提醒一次，重新计时及加时可再次提醒", () => {
  const timers = { a: createTimer(2, "蛋", 0), b: createTimer(5, "鱼", 0) };
  assert.deepEqual(
    expireTimers(timers, 2000).map((t) => t.label),
    ["蛋"],
  );
  assert.equal(expireTimers(timers, 4000).length, 0);
  assert.deepEqual(
    expireTimers(timers, 7000).map((t) => t.label),
    ["鱼"],
  );
  changeTimer(timers.a, "restart", 10000);
  assert.equal(remainingSeconds(timers.a, 10000), 2);
  changeTimer(timers.b, "add", 10000, 30);
  assert.equal(remainingSeconds(timers.b, 10000), 30);
  assert.equal(expireTimers(timers, 50000).length, 2);
  assert.equal(expireTimers(timers, 60000).length, 0);
});

test("旧步骤计时兼容、损坏记录清理和迁移幂等", () => {
  const old = {
    a: { end: 100, notified: false },
    b: { end: "oops" },
    c: { end: 100, status: "paused", remaining: 12 },
  };
  const normalized = normalizeTimers(old);
  assert.equal(normalized.a.status, "running");
  assert(!normalized.b);
  assert.deepEqual(normalizeTimers(normalized), normalized);
  assert.equal(remainingSeconds(normalized.c, 10000), 12);
  assert.equal(expireTimers(normalized, 200).length, 1);
});

test("菜库迁移保留独立计时及自定义常用时长", () => {
  const state = normalizeState(
    {
      kitchenTimers: { a: createTimer(300, "煮汤", 0) },
      timers: { "removed:1": createTimer(20, "旧菜", 0) },
    },
    {
      settings: {},
      favorites: [],
      customDishes: [],
      history: [],
      checks: {},
      progress: {},
    },
  );
  const expected = JSON.stringify(state.kitchenTimers);
  migrateFamilyCatalog(state, { version: 2, removed: {} }, []);
  assert.equal(JSON.stringify(state.kitchenTimers), expected);
  assert.deepEqual(state.timers, {});
  assert.equal(state.timerPresets.length, 6);
});
