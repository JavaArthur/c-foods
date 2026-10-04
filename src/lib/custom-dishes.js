export const isCustomDish = (dish) => dish?.source === "custom";

export function customDishView(record) {
  return {
    ...record,
    source: "custom",
    isMeat: null,
    spicyLevel: null,
    cookTimeMinutes: null,
    image: "",
    ingredients: [],
    steps: [],
    mainIngredients: [],
    flavorTags: [],
  };
}

export function validateDishName(value, dishes, ownId) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) return { error: "请填写菜名。" };
  if ([...name].length > 50) return { error: "菜名最多 50 字。" };
  const duplicate = dishes.find(
    (d) => d.id !== ownId && d.name.trim() === name,
  );
  if (duplicate) return { error: "这道菜已经有啦。", duplicate };
  return { name };
}

export function deleteCustomRecord(state, id) {
  const record = state.customDishes.find((d) => d.id === id);
  if (!record) return false;
  for (const h of state.history) {
    if (h.ids.includes(id)) {
      h.removed ||= {};
      h.removed[id] = {
        name: record.name,
        reason: "自录菜品已删除",
        deleted: true,
      };
    }
  }
  state.customDishes = state.customDishes.filter((d) => d.id !== id);
  state.favorites = state.favorites.filter((x) => x !== id);
  state.settings.blacklist = state.settings.blacklist.filter((x) => x !== id);
  delete state.settings.classification[id];
  return true;
}
