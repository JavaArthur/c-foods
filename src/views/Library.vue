<script setup>
import { ref, computed, watch } from "vue";
import { isLeafDish } from "../lib/nutrition";
import { visibleDishes as dishes } from "../lib/store";
import { isCustomDish } from "../lib/custom-dishes";
import { matchesDiscovery } from "../lib/discovery";
import Sheet from "../components/Sheet.vue";
import CustomDishForm from "../components/CustomDishForm.vue";
import DishCard from "../components/DishCard.vue";
import DishDetails from "../components/DishDetails.vue";
import Icon from "../components/Icon.vue";
const limit = ref(24),
  category = ref("all"),
  creating = ref(false);
const query = ref(""),
  ingredient = ref(""),
  flavor = ref(""),
  preview = ref(null),
  filterPanel = ref("");
const steamed = ref(false),
  weightFriendly = ref(false);
const options = {
  猪: /猪|五花|排骨|里脊|肉丝|肉片/,
  牛: /牛/,
  羊: /羊/,
  鸡: /鸡(?!蛋|精)|手枪腿/,
  鸭: /鸭/,
  鱼虾: /鱼|虾|鲈|鲤|蟹|蚝|蛤|鳝/,
  蛋: /蛋/,
  豆制品: /豆腐|豆干|香干|腐竹|豆皮|千张/,
  菌菇: /菇|蘑|木耳/,
  叶菜: /菜|菠菜|生菜|油麦|空心/,
  根茎: /土豆|萝卜|山药|藕|笋|芋/,
  瓜果: /瓜|番茄|西红柿|茄子/,
};
const customTab = computed(() => category.value === "custom");
const filtered = computed(() =>
  dishes.value.filter(
    (d) =>
      (customTab.value
        ? isCustomDish(d)
        : !isCustomDish(d) &&
          (category.value === "all" ||
            d.isMeat === (category.value === "meat"))) &&
      d.name.includes(query.value.trim()) &&
      (customTab.value ||
        (matchesDiscovery(d, {
          steamed: steamed.value,
          weightFriendly: weightFriendly.value,
        }) &&
          (!ingredient.value ||
            (ingredient.value === "叶菜"
              ? isLeafDish(d)
              : options[ingredient.value].test(d.mainIngredients.join(" ")))) &&
          (!flavor.value ||
            (flavor.value === "不辣"
              ? d.spicyLevel === 0
              : d.flavorTags.includes(flavor.value))))),
  ),
);
const visible = computed(() => filtered.value.slice(0, limit.value));
const activeFilters = computed(() =>
  Boolean(
    query.value ||
    ingredient.value ||
    flavor.value ||
    steamed.value ||
    weightFriendly.value ||
    category.value !== "all",
  ),
);
const panelOptions = computed(() =>
  filterPanel.value === "ingredient" ? Object.keys(options) : ["不辣", "酸甜"],
);
function choose(value) {
  if (filterPanel.value === "ingredient") ingredient.value = value;
  else flavor.value = value;
  filterPanel.value = "";
}
function clear() {
  category.value = "all";
  query.value = "";
  ingredient.value = "";
  flavor.value = "";
  steamed.value = false;
  weightFriendly.value = false;
}
watch([category, query, ingredient, flavor, steamed, weightFriendly], () => {
  limit.value = 24;
});
</script>
<template>
  <main class="page library">
    <div class="page-title-row">
      <div>
        <p class="eyebrow">寻常食材，好好吃饭</p>
        <h1>家常菜谱库</h1>
      </div>
      <button class="secondary add-recipe" @click="creating = true">
        <Icon name="plus" :size="18" />录入菜品
      </button>
    </div>
    <label class="search-input"
      ><Icon name="search" /><input
        v-model="query"
        placeholder="搜搜想吃的菜"
        aria-label="按菜名搜索"
    /></label>
    <div class="segmented library-categories" aria-label="菜谱分类">
      <button
        v-for="[key, label] in [
          ['all', '全部'],
          ['meat', '荤菜库'],
          ['veg', '素菜库'],
          ['custom', '我录入的'],
        ]"
        :key="key"
        :class="{ selected: category === key }"
        :aria-pressed="category === key"
        @click="category = key"
      >
        {{ label }}
      </button>
    </div>
    <div v-if="!customTab" class="discovery-filters">
      <button
        class="filter-chip"
        :class="{ selected: weightFriendly }"
        :aria-pressed="weightFriendly"
        @click="weightFriendly = !weightFriendly"
      >
        <Icon name="leaf" :size="18" />减脂友好
      </button>
      <button
        class="filter-chip"
        :class="{ selected: steamed }"
        :aria-pressed="steamed"
        @click="steamed = !steamed"
      >
        <Icon name="pot" :size="18" />蒸菜
      </button>
      <button
        class="filter-chip"
        :class="{ selected: ingredient }"
        aria-haspopup="dialog"
        @click="filterPanel = 'ingredient'"
      >
        主料 · {{ ingredient || "全部" }}<Icon name="filter" :size="16" />
      </button>
      <button
        class="filter-chip"
        :class="{ selected: flavor }"
        aria-haspopup="dialog"
        @click="filterPanel = 'flavor'"
      >
        口味 · {{ flavor || "全部" }}<Icon name="filter" :size="16" />
      </button>
    </div>
    <p v-if="weightFriendly && !customTab" class="filter-explanation">
      按食材、用油用糖与做法精选，点开菜谱可看入选理由。供成人选菜参考。
    </p>
    <div class="result-toolbar">
      <p class="result-count">
        找到 {{ filtered.length }} 道{{ customTab ? "自家菜" : "家常菜" }}
      </p>
      <button
        v-if="activeFilters"
        class="secondary clear-filters"
        @click="clear"
      >
        清除筛选
      </button>
    </div>
    <div v-if="filtered.length" class="dish-grid">
      <DishCard
        v-for="(d, i) in visible"
        :key="d.id"
        :eager="i < 2"
        :dish="d"
        compact
        @open="preview = d"
      />
    </div>
    <div v-else class="empty">
      <Icon name="bowl" :size="48" />
      <h2>还没找到这道菜</h2>
      <p>
        {{
          customTab
            ? "把你家的拿手菜先记个名字吧。"
            : "换个名字，或者少选一个筛选条件试试。"
        }}
      </p>
      <button class="secondary" @click="clear">看看全部菜谱</button>
    </div>
    <button
      v-if="limit < filtered.length"
      class="secondary full load-more"
      @click="limit += 24"
    >
      再看 24 道（已显示 {{ visible.length }} / {{ filtered.length }}）
    </button>
    <footer class="source">
      做法整理自
      <a
        href="https://github.com/Anduin2017/HowToCook"
        target="_blank"
        rel="noopener noreferrer"
        >HowToCook</a
      >、<a
        href="https://github.com/Gar-b-age/CookLikeHOC"
        target="_blank"
        rel="noopener noreferrer"
        >CookLikeHOC</a
      >
      和署名公开菜谱。<br />完整出处与家庭改编见详情 · 仅供非商业学习
    </footer>
    <DishDetails v-if="preview" :dish="preview" @close="preview = null" />
    <Sheet
      v-if="filterPanel"
      :title="filterPanel === 'ingredient' ? '选择主料' : '选择口味'"
      @close="filterPanel = ''"
    >
      <div class="filter-options">
        <button
          v-for="value in ['', ...panelOptions]"
          :key="value"
          class="secondary"
          :class="{
            selected:
              (filterPanel === 'ingredient' ? ingredient : flavor) === value,
          }"
          :aria-pressed="
            (filterPanel === 'ingredient' ? ingredient : flavor) === value
          "
          @click="choose(value)"
        >
          {{ value || "全部"
          }}<Icon
            v-if="
              (filterPanel === 'ingredient' ? ingredient : flavor) === value
            "
            name="check"
            :size="18"
          />
        </button>
      </div>
    </Sheet>
    <Sheet v-if="creating" title="录入菜品" @close="creating = false">
      <CustomDishForm
        @cancel="creating = false"
        @saved="
          creating = false;
          category = 'custom';
          query = '';
        "
        @existing="
          creating = false;
          preview = $event;
        "
      />
    </Sheet>
  </main>
</template>
