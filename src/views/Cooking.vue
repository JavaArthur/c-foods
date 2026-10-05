<script setup>
import { computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  dishById,
  catalogMeta,
  portionLabel,
  state,
  tell,
  goStep,
} from "../lib/store";
import { portionText, shoppingList } from "../lib/menu";
import { isCustomDish } from "../lib/custom-dishes";
import { startStepTimer, formatClock } from "../lib/timers";
import Icon from "../components/Icon.vue";
import DishActions from "../components/DishActions.vue";
import TimerControls from "../components/TimerControls.vue";
const route = useRoute(),
  router = useRouter();
const dish = computed(() => dishById.value.get(route.params.id));
const available = computed(
  () => dish.value && !state.settings.blacklist.includes(dish.value.id),
);
const index = computed(() =>
  Math.min(
    state.progress[dish.value?.id]?.step || 0,
    (dish.value?.steps.length || 1) - 1,
  ),
);
let wake = null,
  disposed = false;
async function acquireWake() {
  try {
    if (
      !disposed &&
      !wake &&
      "wakeLock" in navigator &&
      document.visibilityState === "visible"
    ) {
      const acquired = await navigator.wakeLock.request("screen");
      if (disposed) {
        await acquired.release();
        return;
      }
      wake = acquired;
      acquired.addEventListener?.("release", () => {
        if (wake === acquired) wake = null;
      });
    }
  } catch {}
}
function markStep(i) {
  state.progress[dish.value.id] = { step: i, done: false };
}
function back() {
  goStep(4);
  router.push("/");
}
function blocked() {
  router.push("/");
}
function finish() {
  if (!available.value) return;
  state.progress[dish.value.id] = { step: index.value, done: true };
  tell("这道完成啦，辛苦了！");
  back();
}
function entry(i) {
  const id = dish.value.id + ":" + i;
  return { id, kind: "step", timer: state.timers[id] };
}
onMounted(() => {
  if (!available.value) return;
  if (!state.progress[dish.value.id]) markStep(0);
  acquireWake();
  document.addEventListener("visibilitychange", acquireWake);
});
onBeforeUnmount(() => {
  disposed = true;
  document.removeEventListener("visibilitychange", acquireWake);
  wake?.release().catch(() => {});
});
</script>
<template>
  <main v-if="available" class="cooking cooking-flat">
    <header class="cooking-header">
      <button class="icon-button" aria-label="返回今晚做菜列表" @click="back">
        <Icon name="left" />
      </button>
      <h1>{{ dish.name }}</h1>
    </header>
    <DishActions :dish="dish" @blocked="blocked" />
    <div v-if="isCustomDish(dish)" class="custom-cooking">
      <span class="badge custom">自家菜 · 详情待补</span>
      <p>做法待补</p>
      <p class="note">按你家的习惯做，做好后记一下就行。</p>
    </div>
    <template v-else>
      <section class="cooking-ingredients">
        <div class="section-heading">
          <h2>备好这些</h2>
          <span>{{ portionLabel }}</span>
        </div>
        <ul class="ingredient-detail">
          <li
            v-for="item in shoppingList([dish], state.settings.servings)"
            :key="item.key"
          >
            <span>{{ item.name }}</span
            ><strong>{{ item.quantity }}</strong>
          </li>
        </ul>
      </section>
      <section v-if="dish._meta?.time" class="cooking-preparation">
        <strong
          >预计 {{ dish._meta.time.min }}–{{ dish._meta.time.max }} 分钟</strong
        >
        <p>{{ dish._meta.time.basis }}</p>
        <p v-for="text in dish._meta.time.preparations" :key="text">
          <strong>提前准备：</strong>{{ text }}
        </p>
        <p v-if="dish._meta.time.note">{{ dish._meta.time.note }}</p>
      </section>
      <div class="section-heading cooking-progress">
        <h2>跟着这样做</h2>
        <span>当前 {{ index + 1 }} / {{ dish.steps.length }} 步</span>
      </div>
      <ol class="cooking-steps">
        <li
          v-for="(step, i) in dish.steps"
          :key="i"
          class="cooking-step"
          :class="{ 'current-step': i === index }"
          :aria-current="i === index ? 'step' : undefined"
        >
          <div class="step-heading">
            <strong>步骤 {{ String(i + 1).padStart(2, "0") }}</strong
            ><button
              class="secondary mark-step"
              :aria-pressed="i === index"
              @click="markStep(i)"
            >
              {{ i === index ? "正在做这步" : "做到这步" }}
            </button>
          </div>
          <p class="step-text">
            {{
              portionText(step.text, state.settings.servings / dish.servings)
            }}
          </p>
          <template v-if="step.timerSeconds">
            <TimerControls
              v-if="state.timers[dish.id + ':' + i]"
              :entry="entry(i)"
              compact
            />
            <button
              v-else
              class="secondary step-timer"
              @click="startStepTimer(dish, i)"
            >
              <Icon name="clock" :size="20" />开始计时
              {{ formatClock(step.timerSeconds) }}
            </button>
          </template>
        </li>
      </ol>
      <p v-if="dish.tips" class="note">{{ dish.tips }}</p>
      <p v-if="dish.homeSubstitute" class="note">{{ dish.homeSubstitute }}</p>
      <section class="child-notes">
        <h2>给宝宝分餐</h2>
        <p v-for="text in dish._meta?.nutrition.childNotes" :key="text">
          {{ text }}
        </p>
      </section>
      <p class="source">
        <a :href="dish.sourceUrl" target="_blank" rel="noopener noreferrer"
          >查看原做法 ↗</a
        >
      </p>
    </template>
    <button class="primary full cooking-finish" @click="finish">
      这道完成啦
    </button>
  </main>
  <main v-else class="page empty">
    <h1>
      {{
        dish
          ? "这道菜已拉黑"
          : catalogMeta.removed[route.params.id]?.name || "这道菜暂时找不到啦"
      }}
    </h1>
    <p v-if="dish">可在「我的 → 已拉黑菜品」恢复。</p>
    <p v-if="catalogMeta.removed[route.params.id]">
      已下架：{{ catalogMeta.removed[route.params.id].reason }}
    </p>
    <router-link to="/" class="primary">回今晚菜单</router-link>
  </main>
</template>
