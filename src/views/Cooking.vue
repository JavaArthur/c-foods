<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  dishById,
  catalogMeta,
  portionLabel,
  state,
  tell,
  goStep,
} from "../lib/store";
import { portionText } from "../lib/menu";
import { isCustomDish } from "../lib/custom-dishes";
import Icon from "../components/Icon.vue";
import DishDetails from "../components/DishDetails.vue";
const route = useRoute(),
  router = useRouter(),
  showIngredients = ref(false),
  now = ref(Date.now()),
  timerDone = ref(false);
const dish = computed(() => dishById.value.get(route.params.id));
const index = computed(() =>
  Math.min(
    state.progress[dish.value?.id]?.step || 0,
    (dish.value?.steps.length || 1) - 1,
  ),
);
const current = computed(() => dish.value?.steps[index.value]),
  key = computed(() => dish.value?.id + ":" + index.value);
const activeTimer = computed(() => state.timers[key.value]),
  remaining = computed(() =>
    activeTimer.value
      ? Math.max(0, Math.ceil((activeTimer.value.end - now.value) / 1000))
      : current.value?.timerSeconds || 0,
  );
const clock = computed(
  () =>
    `${Math.floor(remaining.value / 60)
      .toString()
      .padStart(2, "0")}:${(remaining.value % 60).toString().padStart(2, "0")}`,
);
let wake = null,
  ticker = null,
  audio = null,
  swipe = null;
async function acquireWake() {
  try {
    if ("wakeLock" in navigator && document.visibilityState === "visible")
      wake = await navigator.wakeLock.request("screen");
  } catch {}
}
function onVisibility() {
  now.value = Date.now();
  if (document.visibilityState === "visible") acquireWake();
}
function alarm() {
  navigator.vibrate?.([300, 150, 300]);
  try {
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.connect(g);
    g.connect(audio.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.9);
    o.start();
    o.stop(audio.currentTime + 1);
  } catch {}
  timerDone.value = true;
  tell("时间到啦，看看锅里的菜。");
}
function startTimer() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
  } catch {}
  state.timers[key.value] = {
    end: Date.now() + current.value.timerSeconds * 1000,
    notified: false,
  };
  timerDone.value = false;
}
function move(delta) {
  if (!dish.value) return;
  state.progress[dish.value.id] = {
    step: Math.max(
      0,
      Math.min(dish.value.steps.length - 1, index.value + delta),
    ),
    done: false,
  };
  timerDone.value = false;
}
function finish() {
  if (state.settings.blacklist.includes(dish.value.id)) return;
  state.progress[dish.value.id] = { step: index.value, done: true };
  tell("这道完成啦 🎉 辛苦了，真香！");
  goStep(4);
  router.push("/");
}
function up(e) {
  if (swipe) {
    const dx = e.clientX - swipe.x;
    if (Math.abs(dx) > 65 && Math.abs(e.clientY - swipe.y) < 70)
      move(dx < 0 ? 1 : -1);
  }
  swipe = null;
}
onMounted(() => {
  if (!dish.value || state.settings.blacklist.includes(dish.value.id)) return;
  if (!state.progress[dish.value.id])
    state.progress[dish.value.id] = { step: 0, done: false };
  acquireWake();
  document.addEventListener("visibilitychange", onVisibility);
  ticker = setInterval(() => {
    now.value = Date.now();
    for (const t of Object.values(state.timers))
      if (!t.notified && t.end <= now.value) {
        t.notified = true;
        alarm();
      }
  }, 250);
});
onBeforeUnmount(() => {
  clearInterval(ticker);
  document.removeEventListener("visibilitychange", onVisibility);
  wake?.release().catch(() => {});
  audio?.close().catch(() => {});
});
</script>
<template>
  <main
    v-if="dish && !state.settings.blacklist.includes(dish.id)"
    class="cooking"
  >
    <header class="cooking-header">
      <button
        class="icon-button"
        aria-label="返回今晚做菜列表"
        @click="
          goStep(4);
          router.push('/');
        "
      >
        <Icon name="left" /></button
      ><strong>{{ dish.name }}</strong
      ><button
        v-if="!isCustomDish(dish)"
        class="text-button"
        @click="showIngredients = true"
      >
        食材
      </button>
    </header>
    <div v-if="isCustomDish(dish)" class="custom-cooking">
      <span class="badge custom">自家菜 · 详情待补</span>
      <h1>{{ dish.name }}</h1>
      <p>做法待补</p>
      <p class="note">按你家的习惯做，做好后记一下就行。</p>
      <button class="primary full" @click="finish">这道完成啦 🎉</button>
    </div>
    <template v-else>
      <div class="cooking-progress">
        <p>
          第 <strong>{{ index + 1 }}</strong> /
          {{ dish.steps.length }} 步<span>{{ portionLabel }}</span>
        </p>
        <div class="progress-track">
          <div
            :style="{ width: ((index + 1) / dish.steps.length) * 100 + '%' }"
          ></div>
        </div>
      </div>
      <div
        class="cooking-stage"
        @pointerdown="(e) => (swipe = { x: e.clientX, y: e.clientY })"
        @pointerup="up"
        @pointercancel="swipe = null"
      >
        <span class="step-number">{{
          String(index + 1).padStart(2, "0")
        }}</span>
        <p class="step-text">
          {{
            portionText(current.text, state.settings.servings / dish.servings)
          }}
        </p>
        <div v-if="current.timerSeconds" class="timer-box">
          <button
            class="timer-button"
            @click="startTimer"
            :disabled="activeTimer && remaining > 0"
          >
            ⏱
            {{
              activeTimer && remaining > 0
                ? "剩余"
                : timerDone || (activeTimer && remaining === 0)
                  ? "再计时"
                  : "开始计时"
            }}
            {{ clock }}</button
          ><button
            v-if="activeTimer && remaining > 0"
            class="text-button"
            @click="delete state.timers[key]"
          >
            取消计时
          </button>
          <p v-if="timerDone || (activeTimer && remaining === 0)" role="status">
            时间到啦，看看锅里的菜 🔔
          </p>
        </div>
      </div>
      <p class="kitchen-hint">左右轻轻滑动，也可以切换步骤</p>
      <div class="cooking-actions">
        <button class="secondary" :disabled="index === 0" @click="move(-1)">
          上一步</button
        ><button
          v-if="index < dish.steps.length - 1"
          class="primary"
          @click="move(1)"
        >
          下一步 →</button
        ><button v-else class="primary" @click="finish">这道完成啦 🎉</button>
      </div>
      <DishDetails
        v-if="showIngredients"
        :dish="dish"
        ingredients-only
        @close="showIngredients = false"
      />
    </template>
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
