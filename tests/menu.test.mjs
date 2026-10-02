import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  generateMenu,
  allowed,
  shoppingList,
  conflict,
  localDate,
  cookOrder,
} from "../src/lib/menu.js";
import { parseRecipe, timer, canonical } from "../scripts/recipe-parser.mjs";
const dishes = JSON.parse(fs.readFileSync("public/data/dishes.json", "utf8"));
const settings = { servings: 2, spicy: 1, avoids: [], blacklist: [] };
test("两库真实来源、唯一 ID、荤素数量和必要字段", () => {
  assert(dishes.filter((d) => d.isMeat).length >= 30);
  assert(dishes.filter((d) => !d.isMeat).length >= 30);
  assert.equal(new Set(dishes.map((d) => d.id)).size, dishes.length);
  for (const d of dishes) {
    assert.match(
      d.sourceUrl,
      /^https:\/\/github.com\/(Anduin2017\/HowToCook|Gar-b-age\/CookLikeHOC)\/blob\//,
    );
    assert(d.steps.length);
    assert(d.ingredients.length);
    assert(d.servings > 0);
    assert(d.cookTimeMinutes > 0);
    for (const s of d.steps)
      assert(s.timerSeconds === null || s.timerSeconds > 0);
  }
});
test("200 桌不重复菜和主料，并遵守忌口、辣度、黑名单", () => {
  const s = {
    ...settings,
    avoids: ["花生", "鱼虾", "牛肉"],
    blacklist: [dishes[0].id],
  };
  for (let i = 0; i < 200; i++) {
    const r = generateMenu(dishes, { meat: 2, veg: 2 }, s);
    assert.equal(r.menu.length, 4);
    assert.equal(new Set(r.menu.map((d) => d.id)).size, 4);
    assert(r.menu.every((d) => allowed(d, s)));
    assert(!r.note);
    for (const a of r.menu)
      for (const b of r.menu) if (a !== b) assert(!conflict(a, b));
  }
});
test("锁定保留；近期、主料按顺序放宽；硬约束永不放宽", () => {
  const one = dishes.find((d) => !d.isMeat && d.spicyLevel === 0),
    history = [{ date: localDate(), ids: [one.id] }];
  const r = generateMenu([one], { meat: 0, veg: 1 }, settings, history);
  assert.equal(r.menu.length, 1);
  assert.match(r.note, /最近/);
  const r2 = generateMenu([one], { meat: 1, veg: 1 }, settings, [], [], [one]);
  assert.equal(r2.menu.length, 1);
  assert.match(r2.note, /少/);
  assert.equal(
    generateMenu(
      [one],
      { meat: 0, veg: 1 },
      { ...settings, blacklist: [one.id] },
    ).menu.length,
    0,
  );
});
test("清单同名合并、换算人数、保留来源和不兼容单位", () => {
  const table = [
    {
      name: "甲",
      servings: 2,
      ingredients: [
        { name: "生抽酱油", amount: 10, unit: "ml", group: "pantry" },
        { name: "姜", amount: 2, unit: "片", group: "seasoning" },
      ],
    },
    {
      name: "乙",
      servings: 2,
      ingredients: [
        { name: "生抽", amount: 20, unit: "ml", group: "pantry" },
        { name: "姜片", amount: 5, unit: "g", group: "seasoning" },
      ],
    },
  ];
  const list = shoppingList(table, 4);
  assert.equal(list.length, 2);
  assert.equal(list[0].quantity, "60ml");
  assert.deepEqual(list[0].dishes, ["甲", "乙"]);
  assert.equal(list[1].quantity, "4片 + 10g");
});
test("嵌套供应商括号不会污染名称；时间支持中文、范围和秒", () => {
  assert.equal(canonical("胡萝卜（安徽、大年初一（上海）、湖北）"), "胡萝卜");
  assert.equal(timer("焖10分钟"), 600);
  assert.equal(timer("煮 2-3 分钟"), 180);
  assert.equal(timer("翻炒30s"), 30);
  assert.equal(timer("放置半小时"), 1800);
});
test("老乡鸡配料、步骤同步缩放，合计主料为家庭份量", () => {
  const b = dishes.filter((d) => d.source === "cooklikehoc");
  assert(b.length > 30);
  for (const d of b) {
    assert.equal(d.servings, 2);
    const mass = d.ingredients
      .filter((i) => ["meat", "veg"].includes(i.group) && i.unit === "g")
      .reduce((s, i) => s + i.amount, 0);
    assert(mass >= 250 && mass <= 400, `${d.name}: ${mass}`);
    for (const i of d.ingredients)
      if (i.unit === "g" && i.amount !== null) assert.equal(i.amount % 5, 0);
  }
});
test("炖煮优先，快炒和凉菜在后", () => {
  assert.deepEqual(
    cookOrder([
      { id: "a", cookMethod: "凉拌", cookTimeMinutes: 10 },
      { id: "b", cookMethod: "炒", cookTimeMinutes: 15 },
      { id: "c", cookMethod: "炖", cookTimeMinutes: 45 },
    ]).map((x) => x.id),
    ["c", "b", "a"],
  );
});
