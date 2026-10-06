import { computed, ref, shallowRef, watch } from "vue";
import { state } from "./store.js";
import { extraAllowed, validDrinkCatalog } from "./meal-extras.js";

export const drinks = shallowRef([]);
export const drinksLoading = ref(false);
export const drinksError = ref(false);
export const allowedDrinks = computed(() =>
  drinks.value.filter((d) => extraAllowed(d, state.settings)),
);
let request;
export async function loadDrinks() {
  if (request) return request;
  drinksLoading.value = true;
  drinksError.value = false;
  request = (async () => {
    try {
      const response = await fetch(
        import.meta.env.BASE_URL + "data/drinks.json",
        { signal: AbortSignal.timeout(15000) },
      );
      if (!response.ok) throw Error("饮品加载失败");
      const data = await response.json();
      if (!validDrinkCatalog(data)) throw Error("饮品数据不完整");
      drinks.value = data;
      if (!allowedDrinks.value.some((d) => d.id === state.drinks.lastPickedId))
        state.drinks.lastPickedId = null;
    } catch {
      drinksError.value = true;
    } finally {
      drinksLoading.value = false;
      request = null;
    }
  })();
  return request;
}
watch(allowedDrinks, (items) => {
  if (
    drinks.value.length &&
    !items.some((d) => d.id === state.drinks.lastPickedId)
  )
    state.drinks.lastPickedId = null;
});
