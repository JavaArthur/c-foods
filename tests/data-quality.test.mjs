import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import sharp from "sharp";
import { timer } from "../scripts/recipe-time.mjs";
import { migrateRecipeIds } from "../src/lib/migrate.js";
import { generateMenu, sameDish } from "../src/lib/menu.js";
const dishes = JSON.parse(fs.readFileSync("public/data/dishes.json", "utf8"));
const meta = JSON.parse(fs.readFileSync("public/data/dish-meta.json", "utf8"));
test("中文数词、半小时、区间、复合时间回归", () => {
  for (const [text, seconds] of [
    ["三十分钟", 1800],
    ["五十分钟", 3000],
    ["四十分钟", 2400],
    ["两个半小时", 9000],
    ["二十五分钟", 1500],
    ["2–3个小时", 10800],
    ["1小时30分钟", 5400],
    ["3分40秒", 220],
    ["半小时", 1800],
    ["两到四天", 345600],
    ["焖二十到三十分钟", 1800],
  ])
    assert.equal(timer(text), seconds, text);
  assert.equal(timer("三分之一勺盐"), null);
  assert.equal(timer("炸至7分熟"), null);
});
test("每道菜图片本地可解码，出处和示意标记完整", async () => {
  assert.equal(new Set(dishes.map((x) => x.image)).size, dishes.length);
  for (const d of dishes) {
    assert.match(d.image, /^\/images\/dish-[a-f0-9]{12}\.webp$/);
    const image = await sharp("public" + d.image).metadata();
    assert(image.width >= 100 && image.height >= 100, d.name);
    const info = meta.dishes[d.id].image;
    assert(["photo", "illustration"].includes(info.kind));
    if (info.kind === "photo") {
      if (info.sourceUrl.includes("user-images.githubusercontent.com"))
        assert.match(
          info.sourcePageUrl,
          /github.com\/Anduin2017\/HowToCook\/blob\//,
        );
      else
        assert.match(
          info.sourceUrl,
          /Anduin2017\/HowToCook|Gar-b-age\/CookLikeHOC/,
        );
    } else assert(info.prompt && info.generator === "image_gen", d.name);
  }
});
test("同菜别名从库中移除，旧 ID 可迁移", () => {
  const aliases = JSON.parse(
    fs.readFileSync("data/recipe-aliases.json", "utf8"),
  ).names;
  for (const [alias, name] of Object.entries(aliases)) {
    assert(!dishes.some((x) => x.name === alias));
    assert(dishes.some((x) => x.name === name));
  }
  const [old, current] = Object.entries(meta.redirects)[0];
  const state = {
    favorites: [old, current],
    settings: { blacklist: [old], classification: { [old]: true } },
    today: { ids: [old, current] },
    history: [{ ids: [old, current] }],
    progress: { [old]: { step: 3 } },
    timers: { [old]: 123, [old + ":3"]: { end: 123 } },
  };
  migrateRecipeIds(state, meta.redirects);
  assert.deepEqual(state.favorites, [current]);
  assert.deepEqual(state.today.ids, [current]);
  assert.deepEqual(state.history[0].ids, [current]);
  assert.deepEqual(state.settings.blacklist, [current]);
  assert.equal(state.settings.classification[current], true);
  assert(!state.progress[old]);
  assert(!state.timers[old]);
  assert(!state.timers[old + ":3"]);
});
test("菜谱变体在主料放宽阶段也不重复上桌", () => {
  const pool = dishes
    .map((d) => ({ ...d, _meta: meta.dishes[d.id] }))
    .filter((d) => meta.dishes[d.id].family === "红烧肉");
  assert(pool.length > 1);
  const result = generateMenu(
    pool,
    { meat: 2, veg: 0 },
    { avoids: [], blacklist: [], spicy: 3 },
  );
  assert.equal(result.menu.length, 1);
  assert(sameDish(pool[0], pool[1]));
});
test("估时有依据，关键误读和提前准备已修正", () => {
  for (const d of dishes) {
    const t = meta.dishes[d.id].time;
    assert(t.min > 0 && t.max >= t.min && t.basis, d.name);
    assert.equal(d.cookTimeMinutes, t.max);
  }
  for (const [name, min] of [
    ["清蒸鲈鱼", 30],
    ["水煮牛肉", 40],
    ["意式烤鸡", 50],
    ["枝竹羊腩煲", 140],
  ])
    assert.equal(
      meta.dishes[dishes.find((d) => d.name === name).id].time.min,
      min,
    );
  const beef = meta.dishes[dishes.find((d) => d.name === "酱牛肉").id].time;
  assert(beef.max < 300);
  assert(beef.preparations.length);
});
