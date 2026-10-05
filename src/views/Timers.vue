<script setup>
import { ref } from "vue";
import { state, tell } from "../lib/store.js";
import { allTimers, startKitchenTimer, formatClock } from "../lib/timers.js";
import { inputSeconds } from "../lib/timer-model.js";
import TimerControls from "../components/TimerControls.vue";
import Sheet from "../components/Sheet.vue";
import Icon from "../components/Icon.vue";
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
  startKitchenTimer(duration, name.value);
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
      <Icon name="clock" :size="32" />
    </div>
    <form class="timer-create panel" @submit.prevent="start">
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
        >计时名称 <span>选填</span
        ><input v-model="name" maxlength="40" placeholder="例如：蒸鱼、煮汤"
      /></label>
      <p v-if="error" role="alert" class="form-error">{{ error }}</p>
      <button type="submit" class="primary full">
        <Icon name="clock" :size="20" />开始计时
      </button>
    </form>
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
          @click="startKitchenTimer(preset.seconds, preset.name)"
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
    <div class="section-heading">
      <h2>我的计时</h2>
      <span class="muted">{{ allTimers.length }} 个</span>
    </div>
    <div v-if="!allTimers.length" class="timer-empty">
      还没有计时。选择常用时长，或输入分钟和秒。
    </div>
    <TimerControls
      v-for="entry in allTimers"
      :key="entry.kind + entry.id"
      :entry="entry"
    />
    <p class="note timer-note">
      离开本页也会继续计时。锁屏或关闭浏览器可能延迟响铃，回来后会校正并提示到期。
    </p>
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
