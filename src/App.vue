<script setup>
import { onMounted, onBeforeUnmount } from "vue";
import {
  startTimerService,
  runningTimers,
  nearestTimer,
  doneTimers,
  ringingTimers,
  timerLabel,
  stopTimerSound,
  soundUnavailable,
} from "./lib/timers.js";
import { useRoute } from "vue-router";
import Icon from "./components/Icon.vue";
import {
  loadDishes,
  loading,
  loadError,
  toast,
  step,
  maxStep,
  goStep,
} from "./lib/store";
const route = useRoute();
const tabs = [
  ["/", "pot", "今晚吃啥"],
  ["/recipes", "book", "菜谱库"],
  ["/timers", "clock", "计时器"],
  ["/favorites", "heart", "收藏"],
  ["/me", "user", "我的"],
];
let stopTimers;
onMounted(() => {
  stopTimers = startTimerService();
  loadDishes();
});
onBeforeUnmount(() => stopTimers?.());
</script>
<template>
  <div class="app-shell" :class="{ 'has-timer-alarm': ringingTimers.length }">
    <template v-if="!route.path.startsWith('/cook/')"
      ><header class="brand">
        <router-link to="/" class="brand-name"
          ><span class="brand-mark"><Icon name="pot" :size="25" /></span
          >今晚吃什么<span class="brand-dot">.</span></router-link
        ><span class="brand-tag">好好吃饭，慢慢生活</span>
      </header>
      <nav class="stepper" aria-label="今晚做饭进度" v-if="route.path === '/'">
        <button
          v-for="(name, i) in ['选搭配', '看菜单', '买菜', '做菜']"
          :key="name"
          :class="{ active: step === i + 1, done: step > i + 1 }"
          :disabled="i + 1 > maxStep"
          :aria-current="step === i + 1 ? 'step' : undefined"
          @click="goStep(i + 1)"
        >
          <span>{{ step > i + 1 ? "✓" : i + 1 }}</span
          >{{ name }}
        </button>
      </nav></template
    >
    <main
      v-if="loading"
      class="page"
      aria-busy="true"
      aria-label="正在准备菜谱"
    >
      <div class="skeleton sk-title"></div>
      <div class="skeleton sk-card"></div>
      <div class="skeleton sk-card"></div>
    </main>
    <main v-else-if="loadError" class="page empty">
      <Icon name="bowl" :size="64" />
      <h1>菜谱还没端上来</h1>
      <p>菜谱没加载出来，点我再试一次。</p>
      <button class="primary" @click="loadDishes">再试一次</button>
    </main>
    <router-view v-else v-slot="{ Component }"
      ><Transition name="page" mode="out-in"
        ><component :is="Component" :key="route.path" /></Transition
    ></router-view>
    <nav class="bottom-nav" aria-label="主导航">
      <router-link
        v-for="[url, icon, label] in tabs"
        :key="url"
        :to="url"
        :class="{ active: route.path === url }"
        ><Icon :name="icon" /><span
          >{{ label
          }}{{
            url === "/timers" && runningTimers.length
              ? " · " + runningTimers.length
              : ""
          }}</span
        ><small
          v-if="url === '/timers' && (nearestTimer || doneTimers.length)"
          class="nav-timer"
          >{{ nearestTimer || "时间到" }}</small
        ></router-link
      >
    </nav>
    <aside
      v-if="ringingTimers.length"
      class="timer-alarm"
      aria-label="计时到期提醒"
    >
      <div class="timer-alarm-copy" role="alert">
        <strong
          >时间到<span v-if="soundUnavailable"> · 声音未启用</span></strong
        >
        <p>{{ ringingTimers.map(timerLabel).join("、") }}</p>
      </div>
      <button class="primary" @click="stopTimerSound">停止响铃</button>
    </aside>
    <Transition name="page"
      ><div v-if="toast" class="toast" role="status">
        {{ toast }}
      </div></Transition
    >
  </div>
</template>
