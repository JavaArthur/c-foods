<script setup>
import { computed, nextTick, ref } from "vue";
import { state, tell } from "../lib/store.js";
import {
  allTimers,
  currentTimer,
  selectTimer,
  timerKey,
  timerLabel,
  timerNow,
  startKitchenTimer,
  formatClock,
  previewTimerSound,
  previewingSound,
  ringingTimers,
  soundUnavailable,
} from "../lib/timers.js";
import { inputSeconds, remainingSeconds } from "../lib/timer-model.js";
import TimerControls from "../components/TimerControls.vue";
import Sheet from "../components/Sheet.vue";
import Icon from "../components/Icon.vue";
const creating = ref(false),
  currentCard = ref();
const otherTimers = computed(() =>
  allTimers.value.filter(
    (entry) =>
      timerKey(entry) !== (currentTimer.value && timerKey(currentTimer.value)),
  ),
);
async function revealCurrent() {
  document.activeElement?.blur();
  await nextTick();
  currentCard.value?.focus({ preventScroll: true });
  currentCard.value?.scrollIntoView({ block: "start", behavior: "instant" });
}
function choose(entry) {
  selectTimer(entry);
  revealCurrent();
}
function launch(duration, label) {
  const id = startKitchenTimer(duration, label);
  if (!id) return;
  creating.value = false;
  revealCurrent();
}
const minutes = ref(5),
  seconds = ref(0),
  name = ref(""),
  error = ref("");
const editing = ref(null),
  presetName = ref(""),
  presetMinutes = ref(0),
  presetSeconds = ref(0),
  presetError = ref("");
function start() {
  const duration = inputSeconds(minutes.value, seconds.value);
  if (!duration) {
    error.value = "请输入 1 秒至 999 分 59 秒，秒数应在 0–59 之间。";
    return;
  }
  error.value = "";
  launch(duration, name.value);
  name.value = "";
}
function edit(p) {
  editing.value = p.id;
  presetName.value = p.name;
  presetMinutes.value = Math.floor(p.seconds / 60);
  presetSeconds.value = p.seconds % 60;
  presetError.value = "";
}
function savePreset() {
  const duration = inputSeconds(presetMinutes.value, presetSeconds.value);
  if (!duration || !presetName.value.trim()) {
    presetError.value = "填写名称，并输入有效的分钟和秒。";
    return;
  }
  const preset = state.timerPresets.find((p) => p.id === editing.value);
  Object.assign(preset, { name: presetName.value.trim(), seconds: duration });
  editing.value = null;
  tell("常用时长已保存");
}
</script>
<template>
  <main class="page timers-page">
    <div class="page-title-row">
      <div>
        <p class="eyebrow">几个锅，一起照看</p>
        <h1>厨房计时器</h1>
      </div>
      <button
        class="primary timer-new"
        @click="
          creating = true;
          error = '';
        "
      >
        新建计时
      </button>
    </div>
    <div
      v-if="currentTimer"
      ref="currentCard"
      class="current-timer"
      tabindex="-1"
    >
      <TimerControls
        :key="timerKey(currentTimer)"
        :entry="currentTimer"
        featured
      />
    </div>
    <div v-else class="timer-empty">
      <Icon name="clock" :size="32" />
      <h2>让时间帮你看着锅</h2>
      <p>点下方常用时长，即刻开始。<br />也可以新建一个自己的计时。</p>
    </div>
    <div class="section-heading">
      <h2>常用时长</h2>
      <span class="muted">点时长即开始</span>
    </div>
    <div class="timer-presets">
      <div
        v-for="preset in state.timerPresets"
        :key="preset.id"
        class="timer-preset"
      >
        <button
          class="preset-start"
          @click="launch(preset.seconds, preset.name)"
        >
          <strong>{{ preset.name }}</strong
          ><span>{{ formatClock(preset.seconds) }}</span>
        </button>
        <button
          class="preset-edit"
          :aria-label="'编辑常用计时：' + preset.name"
          @click="edit(preset)"
        >
          编辑
        </button>
      </div>
    </div>
    <template v-if="otherTimers.length">
      <div class="section-heading">
        <h2>其他计时</h2>
        <span class="muted">{{ otherTimers.length }} 个 · 点选切换</span>
      </div>
      <div class="timer-list">
        <button
          v-for="entry in otherTimers"
          :key="timerKey(entry)"
          class="timer-summary"
          :class="{ 'timer-ended': entry.timer.status === 'done' }"
          :aria-label="'查看计时：' + timerLabel(entry)"
          @click="choose(entry)"
        >
          <span class="timer-summary-copy"
            ><strong>{{ timerLabel(entry) }}</strong>
            <span>{{
              entry.timer.status === "done"
                ? "时间到"
                : entry.timer.status === "paused"
                  ? "已暂停"
                  : "计时中"
            }}</span>
          </span>
          <span class="timer-summary-clock">{{
            formatClock(remainingSeconds(entry.timer, timerNow))
          }}</span>
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </template>
    <div class="timer-sound-settings">
      <span>到时响铃约 15 秒</span>
      <button
        class="secondary"
        :disabled="ringingTimers.length > 0"
        @click="previewTimerSound"
      >
        {{ previewingSound ? "停止试听" : "试听提醒" }}
      </button>
    </div>
    <p v-if="soundUnavailable" class="form-error" role="status">
      声音暂未启用，请点“试听提醒”重试，并检查设备媒体音量。
    </p>
    <p class="note timer-note">
      离开本页也会继续计时。锁屏或关闭浏览器可能延迟响铃，回来后会校正并提示到期。
    </p>
    <Sheet v-if="creating" title="新建计时" @close="creating = false">
      <form class="timer-create" @submit.prevent="start">
        <div class="duration-fields">
          <label
            >分钟<input
              v-model="minutes"
              type="number"
              inputmode="numeric"
              min="0"
              max="999"
              step="1"
              aria-label="计时分钟"
          /></label>
          <span aria-hidden="true">:</span>
          <label
            >秒<input
              v-model="seconds"
              type="number"
              inputmode="numeric"
              min="0"
              max="59"
              step="1"
              aria-label="计时秒数"
          /></label>
        </div>
        <label class="timer-name"
          >计时名称 <span>选填</span>
          <input v-model="name" maxlength="40" placeholder="例如：蒸鱼、煮汤" />
        </label>
        <p v-if="error" role="alert" class="form-error">{{ error }}</p>
        <button type="submit" class="primary full">
          <Icon name="clock" :size="20" />开始计时
        </button>
      </form>
    </Sheet>
    <Sheet v-if="editing" title="编辑常用时长" @close="editing = null">
      <form class="timer-create" @submit.prevent="savePreset">
        <label class="timer-name"
          >名称<input v-model="presetName" maxlength="20" required
        /></label>
        <div class="duration-fields">
          <label
            >分钟<input
              v-model="presetMinutes"
              type="number"
              inputmode="numeric"
              min="0"
              max="999"
              aria-label="常用分钟"
          /></label>
          <span aria-hidden="true">:</span>
          <label
            >秒<input
              v-model="presetSeconds"
              type="number"
              inputmode="numeric"
              min="0"
              max="59"
              aria-label="常用秒数"
          /></label>
        </div>
        <p v-if="presetError" class="form-error" role="alert">
          {{ presetError }}
        </p>
        <button class="primary full" type="submit">保存常用时长</button>
      </form>
    </Sheet>
  </main>
</template>
