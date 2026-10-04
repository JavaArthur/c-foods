import { stimulusReasons, nutrition, isLeafDish } from "./nutrition.js";
import { isCustomDish } from "./custom-dishes.js";
// 忌口、过敏和黑名单始终是硬约束，候选不足也不能放宽。
const aliases = {
  花生: ["花生"],
  坚果: ["花生", "核桃", "腰果", "松仁", "杏仁", "芝麻"],
  蛋: ["蛋", "日本豆腐", "玉子豆腐"],
  牛奶: ["牛奶", "奶油", "黄油", "奶酪"],
  大豆: [
    "豆腐",
    "豆皮",
    "豆干",
    "香干",
    "腐竹",
    "酱油",
    "生抽",
    "老抽",
    "豆瓣",
    "大豆",
  ],
  鱼虾: [
    "鱼",
    "虾",
    "蟹",
    "贝",
    "蛤",
    "蚝",
    "蛏",
    "鱿",
    "鲈",
    "鳕",
    "鳝",
    "海参",
  ],
  海鲜: [
    "鱼",
    "虾",
    "蟹",
    "贝",
    "蛤",
    "蚝",
    "蛏",
    "鱿",
    "鲈",
    "鳕",
    "鳝",
    "海参",
  ],
  小麦: ["面粉", "面筋", "酱油", "生抽", "老抽", "麦"],
  猪肉: [
    "猪",
    "五花",
    "排骨",
    "里脊",
    "瘦肉",
    "肉末",
    "肉丝",
    "肉片",
    "火腿",
    "香肠",
    "培根",
    "肥肠",
  ],
  牛肉: ["牛"],
  羊肉: ["羊"],
  鸡肉: ["鸡肉", "鸡腿", "鸡胸", "鸡翅", "手枪腿"],
  香菜: ["香菜"],
};
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function allowed(d, settings) {
  return !isCustomDish(d) && canAddToMenu(d, settings);
}
export function canAddToMenu(d, settings) {
  if (
    settings.blacklist.includes(d.id) ||
    (!isCustomDish(d) && d.spicyLevel !== 0) ||
    stimulusReasons(d).length
  )
    return false;
  const text =
    d.name +
    " " +
    d.ingredients.map((i) => i.name).join(" ") +
    " " +
    d.steps.map((s) => s.text).join(" ");
  const proteinAvoids = {
    猪肉: "pork",
    牛肉: "beef",
    羊肉: "lamb",
    鸡肉: "chicken",
    蛋: "egg",
    大豆: "tofu",
  };
  const proteins = nutrition(d).proteins;
  return !settings.avoids.some(
    (a) =>
      proteins.includes(proteinAvoids[a]) ||
      (aliases[a] || [a]).some((word) =>
        text.replace(/蟹味菇/g, "菌菇").includes(word),
      ),
  );
}
const mainKey = (s) =>
  s
    .replace(/[（(].*?[）)]/g, "")
    .replace(/\s|片|块|丝|丁|末|液|熟|生/g, "")
    .replace(/西红柿/g, "番茄");
export function conflict(a, b) {
  return (
    (a.isMeat && b.isMeat && a.proteinType === b.proteinType) ||
    a.mainIngredients.some((x) =>
      b.mainIngredients.some((y) => mainKey(x) === mainKey(y)),
    )
  );
}
export const sameDish = (a, b) =>
  a.id === b.id || (a._meta?.family || a.name) === (b._meta?.family || b.name);
export const uniqueDishes = (list) =>
  list.filter((d, i) => !list.slice(0, i).some((other) => sameDish(d, other)));
export function selectionWeight(d, historyDishes = [], favorites = []) {
  const n = nutrition(d);
  const repeats = historyDishes.reduce((sum, old) => {
    const other = nutrition(old);
    return (
      sum +
      n.proteins.filter((p) => other.proteins.includes(p)).length * 0.4 +
      n.foods.filter((f) => other.foods.includes(f)).length * 0.18 +
      (old.cookMethod === d.cookMethod ? 0.1 : 0)
    );
  }, 0);
  return (
    ((n.mixed ? 2.5 : 1) *
      (n.occasional ? 0.35 : 1) *
      (n.proteins.some((p) => ["fish", "shrimp", "chicken"].includes(p))
        ? 1.4
        : 1) *
      (/蒸|煮|炖/.test(d.cookMethod) ? 1.2 : 1) *
      (favorites.includes(d.id) ? 1.2 : 1)) /
    (1 + repeats)
  );
}
export function generateMenu(
  dishes,
  counts,
  settings,
  history = [],
  favorites = [],
  locked = [],
  exclude = [],
) {
  const pool = dishes.filter((d) => allowed(d, settings));
  const byId = new Map(dishes.map((d) => [d.id, d]));
  const age = (h) =>
    (new Date(localDate() + "T00:00:00") - new Date(h.date + "T00:00:00")) /
    86400000;
  const recent = history
    .filter((h) => age(h) >= 0 && age(h) < 3)
    .flatMap((h) => h.ids)
    .map((id) => byId.get(id))
    .filter(Boolean);
  const week = history
    .filter((h) => age(h) >= 0 && age(h) < 7)
    .flatMap((h) => h.ids)
    .map((id) => byId.get(id))
    .filter(Boolean);
  const weights = new Map(
    pool.map((d) => [d.id, selectionWeight(d, week, favorites)]),
  );
  const fixed = uniqueDishes(locked);
  const target = {
    meat: Math.max(0, counts.meat),
    veg: Math.max(1, counts.veg),
  };
  if (
    fixed.some((d) => !allowed(d, settings)) ||
    fixed.filter((d) => d.isMeat).length > target.meat ||
    fixed.filter((d) => !d.isMeat).length > target.veg ||
    (!fixed.some(isLeafDish) &&
      fixed.filter((d) => !d.isMeat).length === target.veg)
  ) {
    return {
      menu: fixed,
      valid: false,
      note: "锁定的菜无法满足无辣、忌口和每餐一道绿叶菜，请先解锁调整。",
    };
  }
  let best = [];
  for (let tier = 0; tier < 3; tier++) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const selected = [...fixed];
      const choose = (predicate) => {
        let winner,
          key = Infinity;
        for (const d of pool) {
          if (
            !predicate(d) ||
            selected.some((s) => sameDish(s, d)) ||
            exclude.includes(d.id) ||
            (tier === 0 && recent.some((s) => sameDish(s, d))) ||
            (tier < 2 && selected.some((s) => conflict(s, d)))
          )
            continue;
          const score =
            -Math.log(Math.max(Math.random(), 0.00001)) / weights.get(d.id);
          if (score < key) {
            winner = d;
            key = score;
          }
        }
        if (winner) selected.push(winner);
        return winner;
      };
      // Reserve a real leafy vegetable before filling the other slots.
      if (!selected.some(isLeafDish) && !choose(isLeafDish)) continue;
      for (const meat of [true, false]) {
        const need =
          target[meat ? "meat" : "veg"] -
          selected.filter((d) => d.isMeat === meat).length;
        for (let i = 0; i < need; i++) choose((d) => d.isMeat === meat);
      }
      if (selected.length > best.length) best = selected;
      if (selected.length === target.meat + target.veg)
        return {
          menu: selected.sort((a, b) => Number(b.isMeat) - Number(a.isMeat)),
          valid: true,
          note:
            tier === 1
              ? "近期吃过的菜也参与搭配，仍保留绿叶菜和无辣要求。"
              : tier === 2
                ? "部分主料重复，仍保留绿叶菜和无辣要求。"
                : "",
        };
    }
  }
  return {
    menu: best.sort((a, b) => Number(b.isMeat) - Number(a.isMeat)),
    valid: best.some(isLeafDish),
    note: best.length
      ? "符合要求的菜有点少，先配好这些；可以减少道数。"
      : "没有符合忌口的绿叶菜，暂时无法配齐这餐。",
  };
}
export function ingredientName(s) {
  return s
    .split(/[（(]/)[0]
    .replace(/\s/g, "")
    .replace(/生抽酱油/g, "生抽")
    .replace(/老抽酱油/g, "老抽")
    .replace(/白砂糖/g, "白糖")
    .replace(/蒜头|蒜子|蒜末/g, "大蒜")
    .replace(/姜片|生姜/g, "姜")
    .replace(/西红柿/g, "番茄")
    .replace(/植物油|大豆油/g, "食用油");
}
export function shoppingList(menu, servings) {
  const map = new Map();
  for (const d of menu)
    for (const i of d.ingredients) {
      const name = ingredientName(i.name);
      const key = name;
      let item = map.get(key);
      if (!item) {
        item = { key, name, group: i.group, parts: {}, dishes: [] };
        map.set(key, item);
      }
      const unit = i.unit || "适量";
      if (i.amount === null) item.parts["适量"] = null;
      else
        item.parts[unit] =
          (item.parts[unit] || 0) + (i.amount * servings) / d.servings;
      if (!item.dishes.includes(d.name)) item.dishes.push(d.name);
    }
  return [...map.values()].map((i) => ({
    ...i,
    quantity: Object.entries(i.parts)
      .map(([u, n]) =>
        n === null ? "按原文适量" : `${Number(n.toFixed(1))}${u}`,
      )
      .join(" + "),
  }));
}
export const dishTime = (d) =>
  isCustomDish(d)
    ? "用时待补"
    : d._meta?.time
      ? `${d._meta.time.min}–${d._meta.time.max}`
      : `约 ${d.cookTimeMinutes}`;
export const estimateTime = (menu) => {
  menu = menu.filter((d) => !isCustomDish(d));
  const min = menu.reduce(
    (s, d) => s + (d._meta?.time.min ?? d.cookTimeMinutes),
    0,
  );
  const max = menu.reduce(
    (s, d) => s + (d._meta?.time.max ?? d.cookTimeMinutes),
    0,
  );
  return min === max ? `${max}` : `${min}–${max}`;
};
export const cookOrder = (menu) =>
  [...menu].sort((a, b) => {
    const rank = (d) =>
      isCustomDish(d)
        ? -1
        : /炖|汤|蒸|卤|砂锅|煮/.test(d.cookMethod)
          ? 2
          : d.cookMethod === "凉拌"
            ? 0
            : 1;
    return rank(b) - rank(a) || b.cookTimeMinutes - a.cookTimeMinutes;
  });
export function portionText(text, ratio) {
  return text.replace(
    /(\d+(?:\.\d+)?)\s*(kg|千克|公斤|克|g|毫升|ml|升|斤|两|个|颗|根|瓣|片|支|只|勺|茶匙|汤匙|块|把|袋|条|棵|杯|包|粒)(?![a-z])/gi,
    (_, n, u) => `${Number((Number(n) * ratio).toFixed(1))}${u}`,
  );
}
