import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalizeBreakfast,
  saveBreakfast,
  removeBreakfast,
  pickRandom,
  extraAllowed,
  validDrinkCatalog,
  drinkCategories,
} from "../src/lib/meal-extras.js";
import { normalizeState, migrateFamilyCatalog } from "../src/lib/migrate.js";
const catalog = JSON.parse(fs.readFileSync("public/data/drinks.json", "utf8"));

test("早餐空库、增改删、重名和长度校验；改名 ID 稳定", () => {
  const breakfast = normalizeBreakfast();
  assert.deepEqual(breakfast, { items: [], lastPickedId: null });
  assert.equal(pickRandom([]), null);
  assert(saveBreakfast(breakfast, "  ").error);
  assert(saveBreakfast(breakfast, "早".repeat(51)).error);
  const { id } = saveBreakfast(breakfast, " 小米粥 ");
  assert(id.startsWith("breakfast-"));
  assert(saveBreakfast(breakfast, "小米粥").error);
  breakfast.lastPickedId = id;
  assert.equal(saveBreakfast(breakfast, "南瓜粥", id).id, id);
  assert.equal(pickRandom(breakfast.items, id).name, "南瓜粥");
  removeBreakfast(breakfast, id);
  assert.equal(breakfast.lastPickedId, null);
  assert(saveBreakfast(breakfast, "失效编辑", id).error);
});
test("随机只取候选；多项排除当前项且能覆盖所有其他项", () => {
  const items = ["a", "b", "c"].map((id) => ({ id }));
  assert.equal(pickRandom(items, "a", () => 0).id, "b");
  assert.equal(pickRandom(items, "a", () => 0.99).id, "c");
  assert.equal(pickRandom(items.slice(0, 1), "a").id, "a");
});
test("饮品完整食材匹配大豆、牛奶、坚果、自定义忌口和黑名单", () => {
  for (const ingredient of ["黄豆", "黑豆", "豆浆"])
    assert(
      !extraAllowed(
        { name: "测试", ingredients: [{ name: ingredient }] },
        { avoids: ["大豆"] },
      ),
    );
  for (const ingredient of ["核桃仁", "黑芝麻", "腰果", "花生"])
    assert(
      !extraAllowed(
        { name: "测试", ingredients: [{ name: ingredient }] },
        { avoids: ["坚果"] },
      ),
    );
  for (const ingredient of ["酸奶", "乳粉", "牛奶"])
    assert(
      !extraAllowed(
        { name: "测试", ingredients: [{ name: ingredient }] },
        { avoids: ["牛奶"] },
      ),
    );
  assert(!extraAllowed({ name: "红枣豆浆" }, { avoids: ["红枣"] }));
  assert(
    !extraAllowed(
      { id: "drink-a", name: "苹果汁" },
      { blacklist: ["drink-a"] },
    ),
  );
  assert(extraAllowed({ name: "小米粥" }, { avoids: ["大豆", "牛奶"] }));
});
test("旧存储补默认值；损坏数据清理幂等；晚餐迁移保留早餐与饮品", () => {
  const defaults = {
    settings: {},
    favorites: [],
    history: [],
    checks: {},
    progress: {},
    timers: {},
  };
  const old = normalizeState(
    { customDishes: [{ id: "custom-old", name: "老菜" }] },
    defaults,
  );
  assert.deepEqual(old.breakfast, { items: [], lastPickedId: null });
  const saved = normalizeState(
    {
      breakfast: {
        items: [
          { id: "breakfast-a", name: "粥" },
          { id: "breakfast-a", name: "重复ID" },
          { id: "breakfast-b", name: "粥" },
          null,
        ],
        lastPickedId: "breakfast-a",
      },
      drinks: { lastPickedId: "drink-soy" },
    },
    defaults,
  );
  assert.equal(saved.breakfast.items.length, 1);
  assert.deepEqual(normalizeState(saved, defaults), saved);
  migrateFamilyCatalog(saved, { version: 2, removed: {} }, []);
  assert.equal(saved.breakfast.lastPickedId, "breakfast-a");
  assert.equal(saved.drinks.lastPickedId, "drink-soy");
  assert.equal(old.customDishes[0].name, "老菜");
});
test("18款饮品完整署名覆盖六类，与源数据一致且不混入晚餐", () => {
  assert(validDrinkCatalog(catalog));
  assert.equal(catalog.length, 18);
  assert.deepEqual(
    new Set(catalog.map((d) => d.category)),
    new Set(drinkCategories),
  );
  assert.deepEqual(
    catalog,
    JSON.parse(fs.readFileSync("data/drink-recipes.json", "utf8")).recipes,
  );
  assert(!validDrinkCatalog([...catalog, catalog[0]]));
  assert(!validDrinkCatalog([{ ...catalog[0], steps: [] }]));
  const dinner = JSON.parse(fs.readFileSync("public/data/dishes.json", "utf8"));
  assert(dinner.every((d) => !d.id.startsWith("drink-")));
  for (const d of catalog) {
    const displayed = [
      d.name,
      ...d.steps,
      ...d.ingredients.map((i) => i.name),
    ].join(" ");
    assert(
      !/补肾|养颜|降血糖|止咳|排毒|治愈|辣椒|胡椒|花椒|芥末/.test(displayed),
      d.name,
    );
  }
});
