import { validateDishName } from "./custom-dishes.js";

export const drinkCategories = [
  "豆浆",
  "谷物饮",
  "果蔬汁",
  "奶饮",
  "花果茶",
  "炖饮",
];
const avoidAliases = {
  大豆: [
    "大豆",
    "黄豆",
    "黑豆",
    "青豆",
    "豆浆",
    "豆奶",
    "豆腐",
    "酱油",
    "生抽",
    "老抽",
  ],
  牛奶: ["奶", "乳", "黄油"],
  坚果: [
    "坚果",
    "花生",
    "核桃",
    "腰果",
    "杏仁",
    "松子",
    "松仁",
    "榛子",
    "开心果",
    "碧根果",
    "夏威夷果",
    "芝麻",
  ],
  小麦: ["小麦", "面粉", "面包", "馒头", "包子", "面条", "麦仁", "饼干"],
  鱼虾: ["鱼", "虾", "蟹", "贝", "蛤", "蚝", "鱿"],
  海鲜: ["鱼", "虾", "蟹", "贝", "蛤", "蚝", "鱿"],
};
export function extraAllowed(item, settings) {
  if (settings.blacklist?.includes(item.id)) return false;
  const text = [item.name, ...(item.ingredients || []).map((i) => i.name)].join(
    " ",
  );
  return !(settings.avoids || []).some((avoid) =>
    (avoidAliases[avoid] || [avoid]).some((word) => text.includes(word)),
  );
}
export function pickRandom(items, currentId, random = Math.random) {
  if (!items.length) return null;
  const others = items.filter((i) => i.id !== currentId);
  const pool = others.length ? others : items;
  return pool[Math.floor(random() * pool.length)];
}
export function normalizeBreakfast(value) {
  const ids = new Set(),
    names = new Set();
  const items = (Array.isArray(value?.items) ? value.items : [])
    .filter((i) => {
      if (
        !i ||
        typeof i.id !== "string" ||
        !i.id.startsWith("breakfast-") ||
        ids.has(i.id)
      )
        return false;
      const result = validateDishName(i.name, []);
      if (result.error || names.has(result.name)) return false;
      ids.add(i.id);
      names.add(result.name);
      return true;
    })
    .map(({ id, name }) => ({ id, name: name.trim() }));
  return {
    items,
    lastPickedId: ids.has(value?.lastPickedId) ? value.lastPickedId : null,
  };
}
export function saveBreakfast(breakfast, name, id) {
  const result = validateDishName(name, breakfast.items, id);
  if (result.error) return result;
  if (id) {
    const item = breakfast.items.find((i) => i.id === id);
    if (!item) return { error: "这份早餐已删除，请重新添加。" };
    item.name = result.name;
  } else {
    id = "breakfast-" + crypto.randomUUID();
    breakfast.items.push({ id, name: result.name });
  }
  return { id };
}
export function removeBreakfast(breakfast, id) {
  breakfast.items = breakfast.items.filter((i) => i.id !== id);
  if (breakfast.lastPickedId === id) breakfast.lastPickedId = null;
}
export function validDrinkCatalog(data) {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    new Set(data.map((d) => d?.id)).size === data.length &&
    data.every(
      (d) =>
        d &&
        /^drink-[a-z0-9-]+$/.test(d.id) &&
        typeof d.name === "string" &&
        d.name.trim() &&
        drinkCategories.includes(d.category) &&
        typeof d.equipment === "string" &&
        d.equipment &&
        typeof d.yield === "string" &&
        d.yield &&
        Array.isArray(d.preparation) &&
        Array.isArray(d.ingredients) &&
        d.ingredients.length &&
        d.ingredients.every(
          (i) =>
            typeof i.name === "string" &&
            i.name &&
            typeof i.amount === "string" &&
            i.amount,
        ) &&
        Array.isArray(d.steps) &&
        d.steps.length &&
        d.steps.every((s) => typeof s === "string" && s.trim()) &&
        typeof d.author === "string" &&
        d.author &&
        /^https:\/\//.test(d.url) &&
        /^\d{4}-\d{2}-\d{2}$/.test(d.reviewedAt) &&
        typeof d.adaptation === "string",
    )
  );
}
