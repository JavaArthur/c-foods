<script setup>
import Icon from "./Icon.vue";
import DishImage from "./DishImage.vue";
import { dishTime } from "../lib/menu";
import { isCustomDish } from "../lib/custom-dishes";
const props = defineProps({
  dish: Object,
  locked: Boolean,
  compact: Boolean,
  eager: Boolean,
});
const emit = defineEmits(["open", "replace", "lock", "remove"]);
let start = null,
  swiped = false;
function down(e) {
  if (isCustomDish(props.dish)) return;
  if (e.target.closest("button")) return;
  start = { x: e.clientX, y: e.clientY };
  swiped = false;
}
function up(e) {
  if (start && start.x - e.clientX > 60 && Math.abs(start.y - e.clientY) < 45) {
    swiped = true;
    emit("replace");
  }
  start = null;
}
function open() {
  if (!swiped) emit("open");
  swiped = false;
}
</script>
<template>
  <article
    class="dish-card"
    :class="{ compact, 'custom-dish-card': isCustomDish(dish) }"
    @pointerdown="down"
    @pointerup="up"
    @pointercancel="start = null"
  >
    <div class="card-top">
      <span
        class="badge"
        :class="isCustomDish(dish) ? 'custom' : dish.isMeat ? 'meat' : 'veg'"
        >{{ isCustomDish(dish) ? "自家菜" : dish.isMeat ? "荤" : "素" }}</span
      >
      <button
        v-if="!compact && isCustomDish(dish)"
        class="text-button"
        :aria-label="'移出今晚：' + dish.name"
        @click.stop="emit('remove')"
      >
        移出今晚
      </button>
      <div v-else-if="!compact" class="card-controls">
        <button
          class="icon-button"
          :class="{ selected: locked }"
          :aria-label="(locked ? '解锁' : '锁定') + dish.name"
          :aria-pressed="locked"
          @click.stop="emit('lock')"
        >
          <Icon :name="locked ? 'lock' : 'unlock'" :size="19" /></button
        ><button
          class="icon-button"
          :aria-label="'只换' + dish.name"
          @click.stop="emit('replace')"
        >
          <Icon name="refresh" :size="19" />
        </button>
      </div>
    </div>
    <button class="dish-open" @click="open" :aria-label="'查看' + dish.name">
      <DishImage :dish="dish" :eager="eager" />
      <div class="dish-copy">
        <h2>{{ dish.name }}</h2>
        <p>
          <b v-if="dish._meta?.time.preparations?.length">需提前准备 · </b
          >{{
            isCustomDish(dish)
              ? "自家菜 · 详情待补"
              : dish.mainIngredients.slice(0, 2).join(" · ") || "家常食材"
          }}
        </p>
      </div>
    </button>
    <div v-if="isCustomDish(dish)" class="dish-meta">
      <span>食材、做法和用时待补</span>
    </div>
    <div v-else class="dish-meta">
      <span
        :title="
          dish._meta?.time.preparations?.length
            ? '需提前准备，点开查看详情'
            : '家庭预计用时'
        "
        >{{ dishTime(dish) }} 分钟{{
          dish._meta?.time.preparations?.length ? "*" : ""
        }}</span
      ><span :aria-label="'难度' + dish.difficulty + '星'">{{
        "★".repeat(dish.difficulty)
      }}</span
      ><span>{{ dish.spicyLevel ? "🌶".repeat(dish.spicyLevel) : "不辣" }}</span>
    </div>
  </article>
</template>
