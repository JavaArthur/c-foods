import { isCustomDish } from "./custom-dishes.js";

export function recipeCounts(dishes) {
  const recipes = dishes.filter((d) => d && !isCustomDish(d));
  return {
    meat: recipes.filter((d) => d.isMeat).length,
    veg: recipes.filter((d) => !d.isMeat).length,
  };
}

export function validTarget(target) {
  return (
    target &&
    [target.meat, target.veg].every((n) => Number.isInteger(n) && n >= 0) &&
    target.meat + target.veg > 0 &&
    target.meat + target.veg <= 10
  );
}

export function restoreMenuTarget(today, history, byId) {
  if (validTarget(today.targetCounts)) return { ...today.targetCounts };
  // Old confirmed menus may already have lost a blacklisted dish. History
  // retains the original IDs and is ordered newest first.
  const previous = history.find(
    (h) => h.date === today.date && today.ids.every((id) => h.ids.includes(id)),
  );
  for (const ids of [previous?.ids, today.ids]) {
    if (!ids) continue;
    const counts = recipeCounts(ids.map((id) => byId.get(id)));
    if (validTarget(counts)) return counts;
  }
  return { meat: 1, veg: 1 };
}
