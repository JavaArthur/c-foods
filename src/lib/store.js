import { reactive, ref, shallowRef, computed, watch } from "vue";
import {
  localDate,
  allowed,
  canAddToMenu,
  sameDish,
  uniqueDishes,
} from "./menu.js";
import {
  customDishView,
  validateDishName,
  deleteCustomRecord,
} from "./custom-dishes.js";
import {
  migrateRecipeIds,
  normalizeState,
  migrateFamilyCatalog,
} from "./migrate.js";
import { isLeafDish } from "./nutrition.js";
import { cacheDishImages } from "./offline.js";
const KEY = "dinner-v1";
const defaults = () => ({
  settings: {
    servings: 2,
    avoids: [],
    spicy: 0,
    family: { adults: 2, children: 1, childAge: 3 },
    blacklist: [],
    classification: {},
  },
  favorites: [],
  customDishes: [],
  history: [],
  today: null,
  checks: {},
  progress: {},
  timers: {},
});
let saved;
try {
  saved = JSON.parse(localStorage.getItem(KEY) || "null");
} catch {}
export const state = reactive(normalizeState(saved, defaults()));
export const familyLabel = "两大一小 · 宝宝3岁";
export const portionLabel = computed(
  () => `备菜约 ${state.settings.servings} 份`,
);
export const toast = ref("");
let toastId;
export function tell(text) {
  toast.value = text;
  clearTimeout(toastId);
  toastId = setTimeout(() => (toast.value = ""), 4500);
}
watch(
  state,
  () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      tell("手机存储空间有点满，这次的记录可能存不下来。");
    }
  },
  { deep: true },
);
export const catalogMeta = shallowRef({ removed: {} });
export const rawDishes = shallowRef([]),
  loading = ref(true),
  loadError = ref(false);
export const dishes = computed(() => [
  ...rawDishes.value.map((d) => ({
    ...d,
    isMeat:
      ["egg", "tofu"].includes(d.proteinType) && !d._meta?.nutrition.isMeat
        ? (state.settings.classification[d.id] ?? d.isMeat)
        : d.isMeat,
  })),
  ...state.customDishes.map(customDishView),
]);
export const visibleDishes = computed(() =>
  dishes.value.filter((d) => !state.settings.blacklist.includes(d.id)),
);
export const recommendationDishes = computed(() =>
  dishes.value.filter((d) => allowed(d, state.settings)),
);
export const dishById = computed(
  () => new Map(dishes.value.map((d) => [d.id, d])),
);
export const menuIds = ref([]),
  lockedIds = ref([]),
  step = ref(1),
  maxStep = ref(1),
  menuNote = ref("");
export const menu = computed(() =>
  menuIds.value.map((id) => dishById.value.get(id)).filter(Boolean),
);
export async function loadDishes() {
  loading.value = true;
  loadError.value = false;
  try {
    const responses = await Promise.all(
      ["dishes.json", "dish-meta.json"].map((name) =>
        fetch(import.meta.env.BASE_URL + "data/" + name),
      ),
    );
    if (responses.some((r) => !r.ok)) throw Error();
    const [data, meta] = await Promise.all(responses.map((r) => r.json()));
    if (
      !Array.isArray(data) ||
      !data.length ||
      !data.every((d) => d.id && d.ingredients?.length && d.steps?.length)
    )
      throw Error();
    if (
      meta.version !== 2 ||
      !meta.dishes ||
      data.some((d) => !meta.dishes[d.id] || d.spicyLevel !== 0)
    )
      throw Error("菜谱版本不一致");
    migrateRecipeIds(state, meta.redirects);
    const migrated = migrateFamilyCatalog(
      state,
      meta,
      data.map((d) => d.id),
    );
    catalogMeta.value = meta;
    rawDishes.value = data.map((d) => ({ ...d, _meta: meta.dishes[d.id] }));
    if (state.today?.date === localDate()) {
      const previousIds = state.today.ids;
      state.today.ids = previousIds.filter(
        (id) =>
          dishById.value.has(id) &&
          canAddToMenu(dishById.value.get(id), state.settings),
      );
      if (
        state.today.ids.length !== previousIds.length ||
        !state.today.ids.some((id) => isLeafDish(dishById.value.get(id)))
      ) {
        state.today.needsConfirmation = true;
        state.checks = {};
      }
      menuIds.value = uniqueDishes(
        state.today.ids.map((id) => dishById.value.get(id)).filter(Boolean),
      ).map((d) => d.id);
      state.today.ids = [...menuIds.value];
      step.value = menuIds.value.length ? 2 : 1;
      maxStep.value = state.today.needsConfirmation ? 2 : 4;
      if (migrated || state.today.needsConfirmation)
        tell("菜库已更新，请补齐绿叶菜并重新确认今晚菜单。");
    }
    cacheDishImages(
      [...state.favorites, ...menuIds.value]
        .map((id) => dishById.value.get(id))
        .filter(Boolean),
    );
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}
export function goStep(n) {
  if (
    (n === 1 || menu.value.length) &&
    (n <= 2 ||
      (state.today &&
        !state.today.needsConfirmation &&
        menu.value.some(isLeafDish) &&
        menu.value.every((d) => canAddToMenu(d, state.settings))))
  ) {
    step.value = n;
    maxStep.value = Math.max(n, maxStep.value);
    window.scrollTo(0, 0);
  }
}
export function invalidate() {
  state.today = null;
  state.checks = {};
  state.progress = {};
  state.timers = {};
  maxStep.value = 2;
}
export function confirmMenu() {
  if (!menu.value.length || !menu.value.some(isLeafDish)) {
    tell("这餐还缺一道绿叶菜，先加一道再确认。");
    return false;
  }
  if (menu.value.some((d) => !canAddToMenu(d, state.settings))) {
    tell("这桌里有不符合当前忌口的菜，换一道再确认吧。");
    return false;
  }
  const date = localDate();
  const ids = [...menuIds.value];
  state.today = { date, ids };
  if (
    !state.history.some((h) => h.date === date && h.ids.join() === ids.join())
  )
    state.history.unshift({ date, ids, servings: state.settings.servings });
  state.history = state.history.slice(0, 90);
  maxStep.value = 4;
  cacheDishImages(menu.value);
  return true;
}
export function favorite(id) {
  state.favorites = state.favorites.includes(id)
    ? state.favorites.filter((x) => x !== id)
    : [...state.favorites, id];
  if (state.favorites.includes(id) && dishById.value.has(id))
    cacheDishImages([dishById.value.get(id)]);
}
export function addDish(d) {
  // Resolve the current record, so stale dialogs cannot re-add deleted dishes.
  d = dishById.value.get(d.id);
  if (!d || !canAddToMenu(d, state.settings)) {
    tell("这道菜不符合你的忌口或辣度设置，先换一道吧。");
    return false;
  }
  if (menu.value.some((current) => sameDish(current, d))) {
    tell("这道菜或同款做法已经在今晚菜单里啦。");
    return false;
  }
  if (menuIds.value.length >= 10) {
    tell("一桌最多 10 道，已经很丰盛啦。");
    return false;
  }
  menuIds.value.push(d.id);
  invalidate();
  goStep(2);
  tell("加入今晚菜单啦，记得确认这一桌。");
  return true;
}

export function removeFromMenu(id) {
  const affected = menuIds.value.includes(id) || state.today?.ids.includes(id);
  menuIds.value = menuIds.value.filter((x) => x !== id);
  lockedIds.value = lockedIds.value.filter((x) => x !== id);
  delete state.progress[id];
  for (const key of Object.keys(state.timers))
    if (key === id || key.startsWith(id + ":")) delete state.timers[key];
  if (!affected) return;
  state.checks = {};
  if (state.today) {
    state.today.ids = state.today.ids.filter((x) => x !== id);
    state.today.needsConfirmation = true;
  }
  step.value = menuIds.value.length ? 2 : 1;
  maxStep.value = step.value;
  menuNote.value = "";
}

export function blacklistDish(id) {
  if (!dishById.value.has(id)) return;
  state.settings.blacklist = [...new Set([...state.settings.blacklist, id])];
  removeFromMenu(id);
  tell("已拉黑，可在「我的 → 已拉黑菜品」恢复。");
}
export function restoreDish(id) {
  state.settings.blacklist = state.settings.blacklist.filter((x) => x !== id);
  tell("已恢复，可以在菜谱库找到啦。");
}
export function saveCustomDish(value, id) {
  const result = validateDishName(value, dishes.value, id);
  if (result.error) return result;
  const now = new Date().toISOString();
  if (id) {
    const record = state.customDishes.find((d) => d.id === id);
    if (!record) return { error: "这道菜已删除。" };
    record.name = result.name;
    record.updatedAt = now;
    const updated = customDishView(record);
    if (!canAddToMenu(updated, state.settings)) removeFromMenu(id);
  } else {
    id = "custom-" + crypto.randomUUID();
    state.customDishes.push({
      id,
      name: result.name,
      createdAt: now,
      updatedAt: now,
    });
  }
  tell("菜名已保存，详情以后慢慢补。");
  return { id };
}
export function deleteCustomDish(id) {
  if (!state.customDishes.some((d) => d.id === id)) return;
  removeFromMenu(id);
  deleteCustomRecord(state, id);
  tell("已删除，过去的菜单记录仍会保留菜名。");
}
export function resetAll() {
  Object.assign(state, defaults());
  menuIds.value = [];
  lockedIds.value = [];
  step.value = 1;
  maxStep.value = 1;
  tell("已经清空，我们从新的一餐开始。");
}

watch(
  () => [
    state.settings.avoids,
    state.settings.blacklist,
    state.settings.classification,
  ],
  () => {
    if (
      menu.value.length &&
      (menu.value.some((d) => !canAddToMenu(d, state.settings)) ||
        !menu.value.some(isLeafDish))
    ) {
      if (state.today) state.today.needsConfirmation = true;
      state.checks = {};
      lockedIds.value = lockedIds.value.filter(
        (id) =>
          dishById.value.has(id) &&
          canAddToMenu(dishById.value.get(id), state.settings),
      );
      step.value = Math.min(step.value, 2);
      maxStep.value = Math.min(maxStep.value, 2);
    }
  },
  { deep: true },
);
watch(
  () => state.settings.servings,
  () => {
    state.checks = {};
  },
);
