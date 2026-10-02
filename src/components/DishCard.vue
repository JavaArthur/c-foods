<script setup>
import Icon from "./Icon.vue";
import DishImage from "./DishImage.vue";
defineProps({ dish: Object, locked: Boolean, compact: Boolean });
const emit = defineEmits(["open", "replace", "lock"]);
let start = null,
  swiped = false;
function down(e) {
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
    :class="{ compact }"
    @pointerdown="down"
    @pointerup="up"
    @pointercancel="start = null"
  >
    <div class="card-top">
      <span class="badge" :class="dish.isMeat ? 'meat' : 'veg'">{{
        dish.isMeat ? "荤" : "素"
      }}</span>
      <div v-if="!compact" class="card-controls">
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
      <DishImage :dish="dish" />
      <div class="dish-copy">
        <h2>{{ dish.name }}</h2>
        <p>{{ dish.mainIngredients.slice(0, 2).join(" · ") || "家常食材" }}</p>
      </div>
    </button>
    <div class="dish-meta">
      <span>{{ dish.cookTimeMinutes }} 分钟</span
      ><span :aria-label="'难度' + dish.difficulty + '星'">{{
        "★".repeat(dish.difficulty)
      }}</span
      ><span>{{ dish.spicyLevel ? "🌶".repeat(dish.spicyLevel) : "不辣" }}</span>
    </div>
  </article>
</template>
