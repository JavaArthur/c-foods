<script setup>
import { computed, onMounted, ref } from "vue";
import { state, tell } from "../lib/store.js";
import {
  drinks,
  allowedDrinks,
  drinksLoading,
  drinksError,
  loadDrinks,
} from "../lib/drinks.js";
import { drinkCategories, pickRandom } from "../lib/meal-extras.js";
import Icon from "../components/Icon.vue";
import Sheet from "../components/Sheet.vue";
const category = ref("全部"),
  query = ref(""),
  previewId = ref(null);
const icons = {
  豆浆: "bowl",
  谷物饮: "bowl",
  果蔬汁: "leaf",
  奶饮: "cup",
  花果茶: "flower",
  炖饮: "pot",
};
const filtered = computed(() =>
  allowedDrinks.value.filter(
    (d) =>
      (category.value === "全部" || d.category === category.value) &&
      d.name.includes(query.value.trim()),
  ),
);
const selected = computed(() =>
  filtered.value.find((d) => d.id === state.drinks.lastPickedId),
);
const preview = computed(() =>
  allowedDrinks.value.find((d) => d.id === previewId.value),
);
onMounted(() => {
  if (!drinks.value.length) loadDrinks();
});
function choose() {
  const item = pickRandom(filtered.value, state.drinks.lastPickedId);
  if (!item) return;
  state.drinks.lastPickedId = item.id;
  if (filtered.value.length === 1)
    tell("当前筛选只有这一杯，可以切换分类再试试。");
}
</script>
<template>
  <div class="page extras-page">
    <p class="eyebrow">一杯家常，慢慢喝</p>
    <h1>今天喝什么<span class="orange">？</span></h1>
    <p class="extras-intro">豆香、果香，还有锅里慢煮的暖意。</p>
    <section
      v-if="drinksLoading"
      class="random-panel"
      aria-busy="true"
      aria-label="正在准备饮品"
    >
      <p>正在整理这一杯的做法…</p>
    </section>
    <section v-else-if="drinksError" class="random-panel">
      <h2>饮品还没准备好</h2>
      <p>加载失败，请再试一次。</p>
      <button class="primary" @click="loadDrinks">重新加载饮品</button>
    </section>
    <template v-else>
      <section class="random-panel drink-panel" aria-label="饮品随机结果">
        <Icon :name="icons[selected?.category] || 'cup'" :size="36" />
        <div role="status" aria-live="polite">
          <template v-if="selected"
            ><p>这次喝 · {{ selected.category }}</p>
            <h2>{{ selected.name }}</h2>
            <p>{{ selected.equipment }}</p></template
          ><template v-else
            ><h2>给今天选一杯</h2>
            <p>{{ filtered.length }} 款可选 · 按当前分类与忌口抽取</p></template
          >
        </div>
        <button
          class="primary full"
          :disabled="!filtered.length"
          @click="choose"
        >
          <Icon name="refresh" />{{ selected ? "换一杯" : "随机选一杯" }}
        </button>
        <button
          v-if="selected"
          class="text-button full"
          @click="previewId = selected.id"
        >
          查看这杯做法<Icon name="right" :size="18" />
        </button>
      </section>
      <div class="extras-search">
        <label for="drink-search">找一杯喜欢的</label
        ><input
          id="drink-search"
          v-model="query"
          type="search"
          placeholder="按饮品名称搜索"
        />
      </div>
      <div class="chips drink-filters" role="group" aria-label="饮品分类">
        <button
          v-for="c in ['全部', ...drinkCategories]"
          :key="c"
          :class="{ selected: category === c }"
          :aria-pressed="category === c"
          @click="category = c"
        >
          {{ c }}
        </button>
      </div>
      <p class="note extras-space">
        {{ filtered.length }} 款饮品<span
          v-if="allowedDrinks.length < drinks.length"
        >
          · 已按忌口隐藏 {{ drinks.length - allowedDrinks.length }} 款</span
        >
      </p>
      <div v-if="!filtered.length" class="extras-empty">
        <h2>暂时没有匹配的饮品</h2>
        <p>试试其他名称或分类；忌口条件会始终保留。</p>
        <button
          class="text-button"
          @click="
            query = '';
            category = '全部';
          "
        >
          清除搜索与分类
        </button>
      </div>
      <div class="drink-list">
        <button
          v-for="d in filtered"
          :key="d.id"
          class="drink-card"
          :aria-label="'查看' + d.name"
          @click="previewId = d.id"
        >
          <span class="drink-icon"
            ><Icon :name="icons[d.category]" :size="28" /></span
          ><span class="drink-copy"
            ><strong>{{ d.name }}</strong
            ><span>{{ d.category }} · {{ d.equipment }}</span
            ><span>{{
              d.ingredients
                .slice(0, 3)
                .map((i) => i.name)
                .join(" / ")
            }}</span></span
          ><Icon name="right" :size="18" />
        </button>
      </div>
    </template>
    <Sheet v-if="preview" :title="preview.name" @close="previewId = null">
      <p>{{ preview.category }} · {{ preview.equipment }}</p>
      <h3>这一份的用量</h3>
      <p>{{ preview.yield }}</p>
      <ul class="ingredient-detail">
        <li v-for="i in preview.ingredients" :key="i.name">
          <span>{{ i.name }}</span
          ><strong>{{ i.amount }}</strong>
        </li>
      </ul>
      <template v-if="preview.preparation.length"
        ><h3>提前准备</h3>
        <p v-for="p in preview.preparation" :key="p">{{ p }}</p></template
      >
      <h3>跟着这样做</h3>
      <ol class="drink-steps">
        <li v-for="(s, i) in preview.steps" :key="i">
          <span>{{ i + 1 }}</span>
          <p>{{ s }}</p>
        </li>
      </ol>
      <template v-if="preview.adaptation"
        ><h3>家庭整理说明</h3>
        <p>{{ preview.adaptation }}</p></template
      >
      <div class="drink-source">
        <p>作者：{{ preview.author }}</p>
        <a
          :href="preview.url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-button"
          >查看原始配方<Icon name="right" :size="16"
        /></a>
        <p class="note">
          整理于 {{ preview.reviewedAt }} · 用量按原方，不随晚餐人数调整
        </p>
      </div>
    </Sheet>
  </div>
</template>
