import test, { beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { nextTick } from "vue";
import { customDishView, validateDishName } from "../src/lib/custom-dishes.js";
import {
  allowed,
  canAddToMenu,
  generateMenu,
  estimateTime,
  shoppingList,
} from "../src/lib/menu.js";
import { mealBalance, isLeafDish } from "../src/lib/nutrition.js";
import { normalizeState, migrateFamilyCatalog } from "../src/lib/migrate.js";
import {
  state,
  rawDishes,
  dishes,
  visibleDishes,
  recommendationDishes,
  dishById,
  menuIds,
  menuTarget,
  lockedIds,
  step,
  maxStep,
  resetAll,
  saveCustomDish,
  deleteCustomDish,
  blacklistDish,
  restoreDish,
  addDish,
  confirmMenu,
} from "../src/lib/store.js";

const catalog = JSON.parse(fs.readFileSync("public/data/dishes.json"));
const leaf = catalog.find((d) => d.name === "清炒茼蒿");
const meat = catalog.find((d) => d.name === "山药蒸肉饼（家庭无辣版）");
const defaults = () => ({
  settings: { avoids: [], blacklist: [], classification: {} },
  favorites: [],
  history: [],
  checks: {},
  progress: {},
  timers: {},
});
beforeEach(async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  globalThis.localStorage = { setItem() {} };
  globalThis.window = { scrollTo() {} };
  resetAll();
  rawDishes.value = [leaf, meat];
  await nextTick();
});
afterEach(async () => {
  await nextTick();
  mock.timers.reset();
});

test("菜名验证去空格、限制长度，识别已有菜和自录菜；改名保持所有引用", () => {
  assert(validateDishName("  ", []).error);
  assert(validateDishName("菜".repeat(51), []).error);
  assert.equal(validateDishName(" 自家菜 ", []).name, "自家菜");
  const { id } = saveCustomDish(" 妈妈的蒸肉饼 ");
  assert(id.startsWith("custom-"));
  assert.equal(saveCustomDish("妈妈的蒸肉饼").duplicate.id, id);
  assert.equal(saveCustomDish(leaf.name).duplicate.id, leaf.id);
  state.favorites = [id];
  addDish(dishById.value.get(id));
  state.history = [{ date: "2026-10-04", ids: [id] }];
  assert.equal(saveCustomDish("姥姥的蒸肉饼", id).id, id);
  assert.equal(dishById.value.get(id).name, "姥姥的蒸肉饼");
  assert.deepEqual([...state.favorites], [id]);
  assert.deepEqual([...menuIds.value], [id]);
  assert.deepEqual([...state.history[0].ids], [id]);
});

test("自录菜可手动加入；不参与推荐、绿叶菜、荤素和食材统计，也不放宽忌口", () => {
  const custom = customDishView({ id: "custom-test", name: "自家清炒菠菜" });
  assert(canAddToMenu(custom, state.settings));
  assert(!allowed(custom, state.settings));
  assert(!isLeafDish(custom));
  assert.equal(custom.isMeat, null);
  assert.deepEqual(mealBalance([custom]).foods, []);
  assert.deepEqual(shoppingList([custom], 2), []);
  assert.equal(estimateTime([leaf, custom]), estimateTime([leaf]));
  for (const name of ["胡椒蒸肉", "辣子鸡", "芥末虾"]) {
    assert(!canAddToMenu({ ...custom, name }, state.settings));
  }
  assert(
    !canAddToMenu(
      { ...custom, name: "花生甜汤" },
      { ...state.settings, avoids: ["花生"] },
    ),
  );
  const menu = generateMenu(
    [...catalog, custom],
    { meat: 1, veg: 1 },
    state.settings,
  ).menu;
  assert(menu.length === 2 && !menu.some((d) => d.id === custom.id));
  const { id } = saveCustomDish(custom.name);
  addDish(dishById.value.get(id));
  assert(!confirmMenu());
  addDish(leaf);
  assert(confirmMenu());
  assert(!recommendationDishes.value.some((d) => d.id === id));
});

test("拉黑幂等、立即隐藏并移出当前菜单，清理计时；恢复保留收藏和历史", () => {
  addDish(meat);
  addDish(leaf);
  confirmMenu();
  state.favorites = [meat.id];
  lockedIds.value = [meat.id];
  state.progress = { [meat.id]: { step: 1 }, [leaf.id]: { step: 0 } };
  state.timers = {
    [meat.id + ":1"]: { end: 123 },
    [leaf.id + ":0"]: { end: 456 },
  };
  state.checks = { 盐: true };
  blacklistDish(meat.id);
  blacklistDish(meat.id);
  assert.deepEqual([...state.settings.blacklist], [meat.id]);
  assert(!visibleDishes.value.some((d) => d.id === meat.id));
  assert(dishById.value.has(meat.id));
  assert.deepEqual([...menuIds.value], [leaf.id]);
  assert.deepEqual({ ...menuTarget.value }, { meat: 1, veg: 1 });
  assert.deepEqual({ ...state.today.targetCounts }, { meat: 1, veg: 1 });
  assert.deepEqual([...lockedIds.value], []);
  assert.deepEqual(Object.keys(state.timers), [leaf.id + ":0"]);
  assert.deepEqual(Object.keys(state.progress), [leaf.id]);
  assert.deepEqual(state.checks, {});
  assert(state.today.needsConfirmation);
  assert.equal(maxStep.value, 2);
  restoreDish(meat.id);
  assert(visibleDishes.value.some((d) => d.id === meat.id));
  assert(state.favorites.includes(meat.id));
  assert(state.history[0].ids.includes(meat.id));
  assert(!menuIds.value.includes(meat.id));
  blacklistDish(leaf.id);
  assert.equal(step.value, 1);
  assert.deepEqual({ ...menuTarget.value }, { meat: 1, veg: 1 });
});

test("手动加菜增加对应目标，自录菜不占荤素名额，清空重置目标", () => {
  addDish(meat);
  addDish(leaf);
  const { id } = saveCustomDish("家里的拿手菜");
  addDish(dishById.value.get(id));
  assert.deepEqual({ ...menuTarget.value }, { meat: 1, veg: 1 });
  assert(confirmMenu());
  assert.deepEqual({ ...state.today.targetCounts }, { meat: 1, veg: 1 });
  blacklistDish(meat.id);
  restoreDish(meat.id);
  addDish(meat);
  assert.deepEqual({ ...menuTarget.value }, { meat: 2, veg: 1 });
  resetAll();
  assert.equal(menuTarget.value, null);
});

test("删除自录菜保留历史菜名，重新迁移幂等；旧版本和异常数据可恢复", () => {
  const { id } = saveCustomDish("我家的菜");
  addDish(dishById.value.get(id));
  addDish(leaf);
  confirmMenu();
  state.favorites = [id];
  deleteCustomDish(id);
  assert(!dishById.value.has(id));
  assert(!state.favorites.includes(id));
  assert.equal(state.history[0].removed[id].name, "我家的菜");
  assert(state.history[0].removed[id].deleted);
  migrateFamilyCatalog(state, { version: 2 }, [leaf.id, meat.id]);
  const migrated = JSON.stringify(state);
  migrateFamilyCatalog(state, { version: 2 }, [leaf.id, meat.id]);
  assert.equal(JSON.stringify(state), migrated);
  assert(state.history[0].removed[id].deleted);
  const normalized = normalizeState(
    {
      customDishes: [
        null,
        { id: "bad", name: "菜" },
        { id: "custom-a", name: " 自家菜 " },
        { id: "custom-a", name: "重复ID" },
      ],
      settings: { blacklist: ["custom-a", "custom-a"] },
      favorites: ["custom-a"],
      today: { ids: ["custom-a"] },
    },
    defaults(),
  );
  assert.equal(normalized.customDishes.length, 1);
  migrateFamilyCatalog(normalized, { version: 2 }, [leaf.id]);
  assert.deepEqual(normalized.favorites, ["custom-a"]);
  assert.deepEqual(normalized.settings.blacklist, ["custom-a"]);
  assert.deepEqual(normalized.today.ids, ["custom-a"]);
  assert.deepEqual(normalizeState({}, defaults()).customDishes, []);
});

test("改名命中忌口时移出菜单，清除本地数据也清除自录菜", () => {
  const { id } = saveCustomDish("自家甜汤");
  addDish(dishById.value.get(id));
  state.settings.avoids = ["花生"];
  saveCustomDish("花生甜汤", id);
  assert(!menuIds.value.includes(id));
  resetAll();
  assert.equal(state.customDishes.length, 0);
  assert(!dishes.value.some((d) => d.id === id));
});
