<script setup>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import {
  state,
  dishes,
  menuIds,
  lockedIds,
  goStep,
  invalidate,
  tell,
} from "../lib/store";
import { allowed } from "../lib/menu";
import DishCard from "../components/DishCard.vue";
import DishDetails from "../components/DishDetails.vue";
const tab = ref("saved"),
  preview = ref(null),
  router = useRouter();
const saved = computed(() =>
  dishes.value.filter((d) => state.favorites.includes(d.id)),
);
function names(ids) {
  return ids
    .map((id) => dishes.value.find((d) => d.id === id)?.name)
    .filter(Boolean);
}
function again(h) {
  const valid = h.ids
    .map((id) => dishes.value.find((d) => d.id === id))
    .filter((d) => d && allowed(d, state.settings));
  if (!valid.length) {
    tell("这桌不符合现在的忌口，重新配一桌吧。");
    return;
  }
  menuIds.value = valid.map((d) => d.id);
  lockedIds.value = [];
  invalidate();
  goStep(2);
  router.push("/");
  if (valid.length < h.ids.length) tell("已帮你去掉不符合当前忌口的菜。");
}
</script>
<template>
  <div class="page">
    <p class="eyebrow">喜欢的味道，记得再见</p>
    <h1>我的小食光</h1>
    <div class="segmented">
      <button :class="{ selected: tab === 'saved' }" @click="tab = 'saved'">
        想再吃 · {{ saved.length }}</button
      ><button
        :class="{ selected: tab === 'history' }"
        @click="tab = 'history'"
      >
        历史菜单
      </button>
    </div>
    <template v-if="tab === 'saved'"
      ><div v-if="saved.length" class="dish-grid">
        <DishCard
          v-for="d in saved"
          :key="d.id"
          :dish="d"
          compact
          @open="preview = d"
        />
      </div>
      <div v-else class="empty">
        <span class="empty-art">♡</span>
        <h2>留个位置给喜欢的菜</h2>
        <p>点开菜谱，按一下「想再吃」，<br />下次就能在这里找到啦。</p>
        <router-link to="/recipes" class="primary">去菜谱库逛逛</router-link>
      </div></template
    ><template v-else
      ><article
        v-for="(h, i) in [...state.history].sort((a, b) =>
          b.date.localeCompare(a.date),
        )"
        :key="i"
        class="history-card"
      >
        <p class="eyebrow">{{ h.date }} · {{ h.servings }} 人份</p>
        <h2>{{ names(h.ids).join("、") }}</h2>
        <button class="secondary" @click="again(h)">再做一次这桌 →</button>
      </article>
      <div v-if="!state.history.length" class="empty">
        <h2>第一桌，等你来定</h2>
        <p>确认今晚的菜单后，会自动记在这里。</p>
        <router-link to="/" class="primary">去配今晚的菜</router-link>
      </div></template
    ><DishDetails v-if="preview" :dish="preview" @close="preview = null" />
  </div>
</template>
