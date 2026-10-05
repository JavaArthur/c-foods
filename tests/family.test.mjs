import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  classifyFood,
  stimulusReasons,
  isLeafDish,
  foodName,
  weekDiversity,
} from "../src/lib/nutrition.js";
import {
  generateMenu,
  allowed,
  selectionWeight,
  portionText,
  shoppingList,
  localDate,
} from "../src/lib/menu.js";
import {
  normalizeState,
  migrateFamilyCatalog,
  migrateRecipeIds,
} from "../src/lib/migrate.js";
const meta = JSON.parse(fs.readFileSync("public/data/dish-meta.json"));
const dishes = JSON.parse(fs.readFileSync("public/data/dishes.json")).map(
  (d) => ({ ...d, _meta: meta.dishes[d.id] }),
);
const settings = { avoids: [], blacklist: [], spicy: 0 };
const fixture = (ingredients, steps = "蒸熟", extra = {}) => ({
  id: "fixture",
  name: "测试菜",
  ingredients: ingredients.map((name) => ({
    name,
    group: "veg",
    amount: 10,
    unit: "g",
  })),
  steps: [{ text: steps, timerSeconds: null }],
  tips: "",
  spicyLevel: 0,
  cookMethod: "蒸",
  servings: 2,
  isMeat: false,
  mainIngredients: ingredients,
  flavorTags: [],
  ...extra,
});
test("刺激调味检查覆盖食材、蘸料、可选步骤、标签及复合调味；甜椒不误判", () => {
  for (const name of [
    "辣椒",
    "花椒",
    "白胡椒粉",
    "椒盐",
    "芥末",
    "咖喱",
    "调味料",
    "汤膏",
    "酱汁",
    "果味糖醋酱",
  ])
    assert(stimulusReasons(fixture([name])).length, name);
  for (const steps of ["蘸料中加胡椒", "可选干辣椒", "加入辣椒酱"])
    assert(stimulusReasons(fixture(["菠菜"], steps)).length);
  assert(stimulusReasons(fixture(["菠菜"], "炒熟", { spicyLevel: 1 })).length);
  assert.equal(
    stimulusReasons(fixture(["甜椒", "彩椒"], "甜椒炒熟")).length,
    0,
  );
  assert.equal(stimulusReasons(fixture(["芥蓝"])).length, 0);
});
test("完整食材纠正荤素，调味配料不算食物种类，薯类不算绿叶菜", () => {
  const x = fixture(["菠菜", "鸡蛋", "香菇", "五花肉"]);
  assert.equal(classifyFood(x).isMeat, true);
  assert.equal(classifyFood(fixture(["蟹味菇"])).isMeat, false);
  assert.equal(
    classifyFood(fixture(["咕咾肉（鸡肉）（供应商）"])).proteinType,
    "chicken",
  );
  assert.equal(classifyFood(fixture(["排条"])).isMeat, true);
  assert.equal(isLeafDish(fixture(["土豆", "葱花", "蒜瓣"])), false);
  assert.equal(isLeafDish(fixture(["西兰花"])), false);
  const n = classifyFood(
    fixture([
      "洋葱",
      "蒜苔",
      "猪五花肉",
      "小葱",
      "食用油",
      "味极鲜",
      "沸水",
      "小苏打",
    ]),
  );
  assert.deepEqual(n.foods, ["洋葱", "蒜苔", "猪肉"]);
  assert(n.mixed);
  assert.equal(foodName("西红柿"), foodName("番茄"));
  assert.equal(foodName("五花肉"), foodName("猪瘦肉"));
});
test("发布菜库全无辣，有至少八种叶菜及带依据的新菜；重建产物不恢复已下架菜", () => {
  assert.equal(meta.version, 2);
  assert(
    new Set(dishes.filter(isLeafDish).flatMap((d) => d._meta.nutrition.leaves))
      .size >= 8,
  );
  const curated = JSON.parse(fs.readFileSync("data/family-recipes.json"));
  assert.equal(dishes.filter((d) => d.source === "family").length, 60);
  for (const d of dishes) {
    assert.equal(d.spicyLevel, 0, d.name);
    assert.deepEqual(stimulusReasons(d), [], d.name);
    assert(!meta.removed[d.id], d.name);
    assert.equal(d.isMeat, d._meta.nutrition.isMeat, d.name);
    if (d.source === "family") {
      const r = curated.recipes.find((r) => r.name === d.name);
      assert(r?.author && r.url && r.adaptation && r.basis && r.steps.length);
      assert.equal(d.sourceUrl, encodeURI(r.url));
    }
  }
});
test("200次配餐和单菜替换保留绿叶菜、锁定菜、忌口；候选不足不越过硬约束", () => {
  for (let i = 0; i < 200; i++) {
    const r = generateMenu(dishes, { meat: 2, veg: 2 }, settings);
    assert.equal(r.menu.length, 4);
    assert(r.menu.some(isLeafDish));
    const keep = r.menu.filter((d) => !isLeafDish(d));
    const swapped = generateMenu(
      dishes,
      { meat: 2, veg: 2 },
      settings,
      [],
      [],
      keep,
      r.menu.filter(isLeafDish).map((d) => d.id),
    );
    assert(swapped.menu.some(isLeafDish));
    assert(keep.every((k) => swapped.menu.some((d) => d.id === k.id)));
  }
  const tofu = dishes.find((d) => d.name === "脆皮豆腐");
  const locked = generateMenu(
    dishes,
    { meat: 1, veg: 1 },
    settings,
    [],
    [],
    [tofu],
  );
  assert.equal(locked.valid, false);
  assert.deepEqual(locked.menu, [tofu]);
  const noLeaves = generateMenu(
    dishes.filter((d) => !isLeafDish(d)),
    { meat: 1, veg: 1 },
    settings,
  );
  assert.equal(noLeaves.menu.length, 0);
  assert.equal(noLeaves.valid, false);
  const allBlocked = generateMenu(
    dishes,
    { meat: 1, veg: 1 },
    { ...settings, blacklist: dishes.filter(isLeafDish).map((d) => d.id) },
  );
  assert.equal(allBlocked.menu.length, 0);
  assert(
    generateMenu(dishes, { meat: 1, veg: 0 }, settings).menu.some(isLeafDish),
  );
  assert.equal(
    allowed(fixture(["日本豆腐"]), { ...settings, avoids: ["蛋"] }),
    false,
  );
});
test("近七天食材和蛋白重复降权，复合荤菜和温和做法优先，晚餐统计不含过期记录", () => {
  const mixed = dishes.find((d) => d.name === "鱼片豆腐汤（家庭无辣版）");
  assert(selectionWeight(mixed, [mixed]) < selectionWeight(mixed));
  const plain = {
    ...mixed,
    ingredients: [{ name: "巴沙鱼", group: "meat" }],
    _meta: undefined,
  };
  assert(selectionWeight(mixed) > selectionWeight(plain));
  const tomato = fixture(["西红柿", "油", "盐"], "炒熟", { id: "tomato" }),
    tomato2 = fixture(["番茄"], "炒熟", { id: "tomato2" });
  const byId = new Map([
    ["tomato", tomato],
    ["tomato2", tomato2],
  ]);
  const stats = weekDiversity(
    [
      { date: "2026-10-04", ids: ["tomato"] },
      { date: "2026-10-03", ids: ["tomato2"] },
      { date: "2026-09-01", ids: ["old"] },
    ],
    byId,
    "2026-10-04",
  );
  assert.deepEqual(stats, { days: 2, foods: 1 });
});
test("下架迁移幂等，保留历史名称和有效收藏，清理当前菜单、计时和购物勾选", () => {
  const active = dishes[0].id,
    removed = Object.keys(meta.removed)[0];
  const defaults = {
    settings: {
      servings: 2,
      spicy: 0,
      avoids: [],
      blacklist: [],
      classification: {},
    },
    favorites: [],
    history: [],
    today: null,
    checks: {},
    progress: {},
    timers: {},
  };
  const s = normalizeState(
    {
      settings: {
        servings: 4,
        spicy: 3,
        avoids: ["花生"],
        classification: { [removed]: true },
      },
      favorites: [active, removed],
      today: { date: localDate(), ids: [active, removed] },
      history: [{ date: localDate(), ids: [active, removed] }],
      checks: { 盐: true },
      progress: { [active]: { step: 1 }, [removed]: { step: 2 } },
      timers: {
        [active + ":1"]: { end: Date.now() + 1000 },
        [removed + ":2"]: { end: Date.now() + 1000 },
      },
    },
    defaults,
  );
  migrateFamilyCatalog(
    s,
    meta,
    dishes.map((d) => d.id),
  );
  assert.deepEqual(s.favorites, [active]);
  assert.deepEqual(s.today.ids, [active]);
  assert(s.today.needsConfirmation);
  assert.equal(s.history[0].removed[removed].name, meta.removed[removed].name);
  assert.deepEqual(s.checks, {});
  assert.equal(s.settings.servings, 4);
  assert.deepEqual(s.settings.avoids, ["花生"]);
  assert.equal(s.settings.spicy, 0);
  assert(!s.progress[removed]);
  assert(s.progress[active]);
  assert(!s.timers[removed + ":2"]);
  const before = JSON.stringify(s);
  migrateFamilyCatalog(
    s,
    meta,
    dishes.map((d) => d.id),
  );
  assert.equal(JSON.stringify(s), before);
  const broken = normalizeState(
    {
      settings: {
        servings: "bad",
        avoids: null,
        classification: { a: "meat" },
      },
      favorites: 1,
      history: [null],
      progress: { a: null },
      timers: { a: 10 },
    },
    defaults,
  );
  assert.deepEqual(broken.favorites, []);
  assert.deepEqual(broken.history, []);
  assert.deepEqual(broken.settings.classification, {});
  assert.deepEqual(broken.timers, {});
});
test("备菜份量对清单与步骤一致，计时时长不随份量放大，未知用量保留", () => {
  const d = fixture(["胡萝卜"]);
  d.ingredients.push({ name: "盐", amount: null, unit: "g", group: "pantry" });
  assert.equal(shoppingList([d], 4)[0].quantity, "20g");
  assert.equal(shoppingList([d], 4)[1].quantity, "按原文适量");
  assert.equal(
    portionText("10g胡萝卜，蒸15分钟，水200ml", 2),
    "20g胡萝卜，蒸15分钟，水400ml",
  );
});
