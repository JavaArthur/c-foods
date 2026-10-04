import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  classifyFood,
  stimulusReasons,
  guidelineUrl,
} from "../src/lib/nutrition.js";
import { timer } from "./recipe-time.mjs";

export const recipeId = (name) =>
  "dish-" + createHash("sha1").update(name).digest("hex").slice(0, 12);
const nonFood =
  /^(?:主料|方法[一二三]|刷子|铲子|冰箱|搅拌器|小斧头|消毒纱布|笊篱|厨房用夹|带皮$|密封袋|铝箔纸|炭火或燃气)/;
export function cleanIngredients(dish) {
  return {
    ...dish,
    ingredients: dish.ingredients.filter((i) => !nonFood.test(i.name)),
  };
}
export async function familyCatalog(original, metadata, images) {
  const curated = JSON.parse(
    await fs.readFile("data/family-recipes.json", "utf8"),
  );
  let previous = {};
  try {
    previous = JSON.parse(
      await fs.readFile("public/data/dish-meta.json", "utf8"),
    );
  } catch {}
  const meta = {
    version: 2,
    redirects: metadata.redirects || {},
    removed: { ...previous.removed },
    dishes: {},
    guidelineUrl,
  };
  const dishes = [];
  const changes = {
    reviewedAt: curated.reviewedAt,
    removed: [],
    added: [],
    corrected: [],
  };
  const finalize = (input, detail, existing = true) => {
    const d = cleanIngredients(input);
    const reasons = stimulusReasons(d);
    if (reasons.length) {
      if (!existing)
        throw Error(`新增配方未通过无辣检查：${d.name}：${reasons.join("；")}`);
      meta.removed[d.id] = { name: d.name, reason: reasons.join("；") };
      changes.removed.push({ id: d.id, ...meta.removed[d.id] });
      return;
    }
    const n = classifyFood(d);
    if (existing && (d.isMeat !== n.isMeat || d.proteinType !== n.proteinType))
      changes.corrected.push({
        name: d.name,
        from: { isMeat: d.isMeat, proteinType: d.proteinType },
        to: { isMeat: n.isMeat, proteinType: n.proteinType },
      });
    d.isMeat = n.isMeat;
    d.proteinType = n.proteinType;
    d.mainIngredients = n.foods;
    d.spicyLevel = 0;
    d.flavorTags = [
      ...new Set(["无辣", ...d.flavorTags.filter((t) => !/辣|清淡/.test(t))]),
    ];
    if (!images[d.id]) throw Error("缺少菜谱配图：" + d.name);
    d.image = images[d.id].file;
    meta.dishes[d.id] = {
      ...detail,
      image: images[d.id],
      nutrition: n,
      reviewedAt: curated.reviewedAt,
    };
    dishes.push(d);
    delete meta.removed[d.id];
  };
  for (const dish of original) {
    if (dish.source === "family") continue;
    finalize(dish, metadata.dishes[dish.id]);
  }
  for (const r of curated.recipes) {
    const id = recipeId(r.name);
    if (dishes.some((d) => d.name === r.name))
      throw Error("新增菜名重复：" + r.name);
    const dish = {
      id,
      name: r.name,
      source: "family",
      sourceUrl: encodeURI(r.url),
      image: "",
      isMeat: true,
      mainIngredients: [],
      proteinType: "vegetable",
      cookMethod: r.method,
      flavorTags: ["无辣"],
      spicyLevel: 0,
      difficulty: 2,
      cookTimeMinutes: r.time[1],
      servings: 2,
      ingredients: r.ingredients.map(([name, amount, unit, group]) => ({
        name,
        amount,
        unit,
        group,
      })),
      steps: r.steps.map((text) => ({ text, timerSeconds: timer(text) })),
      tips: "调味从少量开始。未知用量按原文适量，购买调味品时选择无刺激性配料的产品。",
      homeSubstitute: null,
    };
    finalize(
      dish,
      {
        family: r.family,
        time: {
          kind: "reviewed-estimate",
          min: r.time[0],
          max: r.time[1],
          basis: r.basis,
          preparations: r.preparations || [],
        },
        recipe: {
          author: r.author,
          sourceUrl: encodeURI(r.url),
          reviewedAt: curated.reviewedAt,
          adaptation: r.adaptation,
          portionBasis: curated.note,
        },
      },
      false,
    );
    changes.added.push({
      id,
      name: r.name,
      sourceUrl: encodeURI(r.url),
      author: r.author,
    });
  }
  const aliases = JSON.parse(
    await fs.readFile("data/recipe-aliases.json", "utf8"),
  ).names;
  for (const [alias, name] of Object.entries(aliases)) {
    const target = meta.removed[recipeId(name)];
    if (target) meta.removed[recipeId(alias)] = { ...target, name: alias };
  }
  if (
    dishes.filter((d) => d.isMeat).length < 20 ||
    dishes.filter((d) => !d.isMeat).length < 30
  )
    throw Error("无辣菜库覆盖不足");
  const leaves = new Set(
    dishes
      .filter((d) => !d.isMeat)
      .flatMap((d) => meta.dishes[d.id].nutrition.leaves),
  );
  if (leaves.size < 8) throw Error("绿叶菜种类不足8种");
  return { dishes, meta, changes };
}
