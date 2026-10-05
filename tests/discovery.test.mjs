import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { matchesDiscovery } from "../src/lib/discovery.js";
const dishes = JSON.parse(fs.readFileSync("public/data/dishes.json", "utf8"));
const meta = JSON.parse(fs.readFileSync("public/data/dish-meta.json", "utf8"));
const reviews = JSON.parse(fs.readFileSync("data/dish-tags.json", "utf8"));
test("全库人工标签有依据，新增蒸菜与少油精选覆盖足够", () => {
  assert.equal(dishes.length, 130);
  for (const d of dishes) {
    const t = meta.dishes[d.id].discovery;
    assert.deepEqual(t, reviews.dishes[d.id]);
    assert(
      t.reason &&
        t.methodReason &&
        t.reviewedAt &&
        t.sources.includes(d.sourceUrl),
      d.name,
    );
  }
  const newer = JSON.parse(
    fs.readFileSync("data/family-recipes.json", "utf8"),
  ).recipes.slice(10);
  const names = new Set(newer.map((r) => r.name));
  const tags = dishes
    .filter((d) => names.has(d.name))
    .map((d) => meta.dishes[d.id].discovery);
  assert.equal(tags.length, 50);
  assert(tags.filter((t) => t.steamed).length >= 30);
  assert(tags.filter((t) => t.weightFriendly).length >= 30);
  for (const name of ["蜜汁南瓜", "豉汁排骨"]) {
    const t = meta.dishes[dishes.find((d) => d.name === name).id].discovery;
    assert(t.steamed);
    assert(!t.weightFriendly);
  }
  assert(
    !meta.dishes[dishes.find((d) => d.name === "微波葱姜黑鳕鱼").id].discovery
      .steamed,
  );
});
test("两个精选条件取交集，自录和未审核记录不能误入精选", () => {
  const dish = {
    id: "dish-example",
    _meta: { discovery: { steamed: true, weightFriendly: false } },
  };
  assert(matchesDiscovery(dish, { steamed: true }));
  assert(!matchesDiscovery(dish, { steamed: true, weightFriendly: true }));
  assert(!matchesDiscovery({ id: "dish-old" }, { steamed: true }));
  assert(
    !matchesDiscovery(
      {
        id: "custom-one",
        source: "custom",
        _meta: { discovery: { steamed: true, weightFriendly: true } },
      },
      { steamed: true },
    ),
  );
});
