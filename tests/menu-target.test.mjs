import test from "node:test";
import assert from "node:assert/strict";
import { restoreMenuTarget, recipeCounts } from "../src/lib/menu-target.js";

const byId = new Map([
  ["meat", { id: "meat", isMeat: true }],
  ["leaf", { id: "leaf", isMeat: false }],
  ["custom-a", { id: "custom-a", source: "custom", isMeat: null }],
]);
const date = "2026-10-07";

test("恢复数量优先使用保存目标，旧版从当天原菜单恢复，不计自录菜", () => {
  const today = { date, ids: ["leaf"] };
  const history = [{ date, ids: ["meat", "leaf", "custom-a"] }];
  assert.deepEqual(restoreMenuTarget(today, history, byId), {
    meat: 1,
    veg: 1,
  });
  assert.deepEqual(
    restoreMenuTarget(
      { ...today, targetCounts: { meat: 2, veg: 2 } },
      history,
      byId,
    ),
    { meat: 2, veg: 2 },
  );
  assert.deepEqual(restoreMenuTarget({ ...today, ids: [] }, history, byId), {
    meat: 1,
    veg: 1,
  });
  assert.deepEqual(recipeCounts([...byId.values()]), { meat: 1, veg: 1 });
});

test("异常目标和不相关历史不影响恢复，缺少可用信息默认一荤一素", () => {
  const today = { date, ids: ["leaf"], targetCounts: { meat: -1, veg: 99 } };
  const history = [
    { date, ids: ["meat"] },
    { date: "2026-10-06", ids: ["meat", "leaf"] },
  ];
  assert.deepEqual(restoreMenuTarget(today, history, byId), {
    meat: 0,
    veg: 1,
  });
  assert.deepEqual(restoreMenuTarget({ date, ids: ["missing"] }, [], byId), {
    meat: 1,
    veg: 1,
  });
});
