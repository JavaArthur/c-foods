import { normalizeTimers, normalizePresets } from "./timer-model.js";
import { normalizeBreakfast } from "./meal-extras.js";
// 合并菜谱时迁移用户选项；旧做菜步骤与新菜谱不同，重置其进度和计时。
export function migrateRecipeIds(state, redirects = {}) {
  const id = (value) => redirects[value] || value;
  const ids = (values) => [...new Set((values || []).map(id))];
  state.favorites = ids(state.favorites);
  state.settings.blacklist = ids(state.settings.blacklist);
  if (state.today) state.today.ids = ids(state.today.ids);
  state.history = state.history.map((h) => ({ ...h, ids: ids(h.ids) }));
  for (const [old, current] of Object.entries(redirects)) {
    if (old in state.settings.classification) {
      state.settings.classification[current] ??=
        state.settings.classification[old];
      delete state.settings.classification[old];
    }
    delete state.progress[old];
    for (const key of Object.keys(state.timers)) {
      if (key === old || key.startsWith(old + ":")) delete state.timers[key];
    }
  }
}

export function normalizeState(saved, defaults) {
  const object = (value) =>
    value && typeof value === "object" && !Array.isArray(value);
  const list = (value) =>
    Array.isArray(value) ? value.filter((x) => typeof x === "string") : [];
  const source = object(saved) ? saved : {};
  const state = {
    ...defaults,
    ...source,
    settings: {
      ...defaults.settings,
      ...(object(source.settings) ? source.settings : {}),
    },
  };
  state.settings.spicy = 0;
  state.breakfast = normalizeBreakfast(source.breakfast);
  state.drinks = {
    lastPickedId:
      typeof source.drinks?.lastPickedId === "string"
        ? source.drinks.lastPickedId
        : null,
  };
  state.settings.servings = Number.isFinite(state.settings.servings)
    ? Math.min(6, Math.max(1, state.settings.servings))
    : 2;
  state.settings.family = { adults: 2, children: 1, childAge: 3 };
  state.settings.avoids = list(state.settings.avoids);
  state.settings.blacklist = [...new Set(list(state.settings.blacklist))];
  const customIds = new Set();
  state.customDishes = (
    Array.isArray(state.customDishes) ? state.customDishes : []
  )
    .filter((d) => {
      if (
        !object(d) ||
        typeof d.id !== "string" ||
        !d.id.startsWith("custom-") ||
        customIds.has(d.id) ||
        typeof d.name !== "string" ||
        !d.name.trim() ||
        [...d.name.trim()].length > 50
      )
        return false;
      customIds.add(d.id);
      return true;
    })
    .map((d) => ({
      id: d.id,
      name: d.name.trim(),
      createdAt: d.createdAt || null,
      updatedAt: d.updatedAt || null,
    }));
  state.settings.classification = object(state.settings.classification)
    ? Object.fromEntries(
        Object.entries(state.settings.classification).filter(
          ([, v]) => typeof v === "boolean",
        ),
      )
    : {};
  state.favorites = list(state.favorites);
  state.history = Array.isArray(state.history)
    ? state.history
        .filter(
          (h) =>
            object(h) &&
            /^\d{4}-\d{2}-\d{2}$/.test(h.date) &&
            Array.isArray(h.ids),
        )
        .map((h) => ({ ...h, ids: list(h.ids) }))
    : [];
  state.today =
    object(state.today) && Array.isArray(state.today.ids)
      ? { ...state.today, ids: list(state.today.ids) }
      : null;
  for (const key of ["checks", "progress", "timers"])
    if (!object(state[key])) state[key] = {};
  state.timers = normalizeTimers(state.timers);
  state.kitchenTimers = normalizeTimers(state.kitchenTimers);
  state.timerPresets = normalizePresets(state.timerPresets);
  for (const [key, p] of Object.entries(state.progress))
    if (!object(p) || !Number.isInteger(p.step) || p.step < 0)
      delete state.progress[key];
  return state;
}

export function migrateFamilyCatalog(state, meta, activeIds) {
  const known = new Set([
    ...activeIds,
    ...(state.customDishes || []).map((d) => d.id),
  ]);
  const removed = meta.removed || {};
  const exists = (id) => known.has(id);
  state.favorites = state.favorites.filter(exists);
  state.settings.blacklist = state.settings.blacklist.filter(exists);
  for (const id of Object.keys(state.settings.classification))
    if (!exists(id)) delete state.settings.classification[id];
  for (const h of state.history) {
    h.removed = Object.fromEntries(
      h.ids
        .filter((id) => !exists(id))
        .map((id) => [
          id,
          removed[id] ||
            h.removed?.[id] || {
              name: "已下架菜谱",
              reason: "当前菜库已不收录",
            },
        ]),
    );
  }
  let changed = false;
  if (state.today && state.today.ids.some((id) => !exists(id))) {
    state.today.ids = state.today.ids.filter(exists);
    state.today.needsConfirmation = true;
    state.checks = {};
    changed = true;
  }
  for (const id of Object.keys(state.progress))
    if (!exists(id)) delete state.progress[id];
  for (const key of Object.keys(state.timers))
    if (!exists(key.split(":")[0])) delete state.timers[key];
  state.catalogVersion = meta.version;
  return changed;
}
