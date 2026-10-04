<script setup>
import { computed } from "vue";
import {
  mealBalance,
  weekDiversity,
  guidelineUrl,
  diversityUrl,
} from "../lib/nutrition";
import { state, dishById } from "../lib/store";
import { localDate } from "../lib/menu";
import { isCustomDish } from "../lib/custom-dishes";
const props = defineProps({ menu: Array, note: String });
const balance = computed(() => mealBalance(props.menu));
const week = computed(() =>
  weekDiversity(state.history, dishById.value, localDate()),
);
const labels = {
  pork: "猪肉",
  beef: "牛肉",
  lamb: "羊肉",
  chicken: "鸡肉",
  duck: "鸭肉",
  fish: "鱼",
  shrimp: "虾贝",
  egg: "蛋",
  tofu: "豆制品",
};
</script>
<template>
  <details class="meal-balance">
    <summary>
      这餐搭配 · {{ balance.leaves.length ? "有绿叶菜" : "还需加绿叶菜" }}
      {{ note ? " · 搭配提示" : "" }}
    </summary>
    <p v-if="note">{{ note }}</p>
    <p v-if="menu.some(isCustomDish)">
      自录菜的食材待补，未计入绿叶菜和食材多样性统计。
    </p>
    <p>绿叶菜：{{ balance.leaves.join("、") || "暂缺，先补一道再确认" }}</p>
    <p>
      其他蔬菜：{{
        balance.vegetables
          .filter((x) => !balance.leaves.some((l) => x.includes(l)))
          .join("、") || "可以另搭菌菇或瓜果"
      }}
    </p>
    <p>
      深色蔬菜：{{
        balance.darkVegetables.join("、") || "可以增加深绿色、橙红色蔬菜"
      }}
    </p>
    <p>
      蛋白来源：{{
        balance.proteins.map((p) => labels[p]).join("、") ||
        "可搭配蛋、豆制品或鱼禽肉"
      }}
    </p>
    <p v-if="balance.tubers.length">
      {{
        balance.tubers.join("、")
      }}属于薯类，可以替代部分主食，不能代替绿叶菜。
    </p>
    <p>
      主食搭配米饭、杂粮饭或面食；全天另安排奶、水果和适量饮水。蔬菜每天换着吃，清淡烹调。
    </p>
    <p>
      近七天记录了 {{ week.days }} 天晚餐，共
      {{ week.foods }} 种食材（归并同义食材，不含调味料）。
    </p>
    <p>
      每天 12 种、每周 25 种以上是全天食物多样性的参考，这里仅统计已记录晚餐。
    </p>
    <p>宝宝的食材切小、做软，鱼肉去刺、带骨肉去骨；按食量分餐。</p>
    <p class="source">
      <a :href="guidelineUrl" target="_blank" rel="noopener noreferrer"
        >中国居民膳食指南（2022）</a
      >
      ·
      <a :href="diversityUrl" target="_blank" rel="noopener noreferrer"
        >食物多样说明</a
      >
    </p>
  </details>
</template>
