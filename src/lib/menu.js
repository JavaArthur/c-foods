// 忌口、过敏和黑名单始终是硬约束，候选不足也不能放宽。
const aliases = {
  花生: ["花生"],
  坚果: ["花生", "核桃", "腰果", "松仁", "杏仁", "芝麻"],
  蛋: ["蛋"],
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
  if (settings.blacklist.includes(d.id) || d.spicyLevel > settings.spicy)
    return false;
  const text =
    d.name +
    " " +
    d.ingredients.map((i) => i.name).join(" ") +
    " " +
    d.steps.map((s) => s.text).join(" ");
  return !settings.avoids.some((a) =>
    (aliases[a] || [a]).some((word) => text.includes(word)),
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
  const recent = new Set(
    history
      .filter((h) => {
        const days =
          (Date.now() - new Date(h.date + "T00:00:00").getTime()) / 86400000;
        return days >= 0 && days < 3;
      })
      .flatMap((h) => h.ids),
  );
  let best = [];
  for (let tier = 0; tier < 3; tier++) {
    // 多次随机贪心尝试，避免前一张卡片偶然挡住唯一候选。
    for (let attempt = 0; attempt < 30; attempt++) {
      const selected = locked.filter(
        (d, i) =>
          allowed(d, settings) &&
          !locked.slice(0, i).some((s) => sameDish(s, d)),
      );
      for (const meat of [true, false]) {
        const need =
          counts[meat ? "meat" : "veg"] -
          selected.filter((d) => d.isMeat === meat).length;
        for (let i = 0; i < need; i++) {
          const candidates = pool.filter(
            (d) =>
              d.isMeat === meat &&
              !selected.some((s) => sameDish(s, d)) &&
              !exclude.includes(d.id) &&
              (tier > 0 || !recent.has(d.id)) &&
              (tier > 1 || !selected.some((s) => conflict(s, d))),
          );
          const weighted = candidates
            .map((d) => ({
              d,
              key:
                -Math.log(Math.max(Math.random(), 0.00001)) /
                (favorites.includes(d.id) ? 1.35 : 1),
            }))
            .sort((a, b) => a.key - b.key);
          if (weighted[0]) selected.push(weighted[0].d);
        }
      }
      if (selected.length > best.length) best = selected;
      if (selected.length === counts.meat + counts.veg)
        return {
          menu: selected,
          note:
            tier === 1
              ? "最近吃过的菜也来帮忙啦，换个搭配，一样好吃。"
              : tier === 2
                ? "这次有些主料相同，也帮你搭得尽量丰富啦。"
                : "",
        };
    }
  }
  return {
    menu: best,
    note: "符合忌口的菜有点少，先配好这些。可以减少道数，或去菜谱库挑一挑。",
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
  d._meta?.time
    ? `${d._meta.time.min}–${d._meta.time.max}`
    : `约 ${d.cookTimeMinutes}`;
export const estimateTime = (menu) => {
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
      /炖|汤|蒸|卤|砂锅|煮/.test(d.cookMethod)
        ? 2
        : d.cookMethod === "凉拌"
          ? 0
          : 1;
    return rank(b) - rank(a) || b.cookTimeMinutes - a.cookTimeMinutes;
  });
export function portionText(text, ratio) {
  return text.replace(
    /(\d+(?:\.\d+)?)\s*(kg|千克|公斤|克|g|毫升|ml|升|斤|两)(?![a-z])/gi,
    (_, n, u) => `${Number((Number(n) * ratio).toFixed(1))}${u}`,
  );
}
