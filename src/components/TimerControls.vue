<script setup>
import { computed } from "vue";
import {
  timerNow,
  actOnTimer,
  timerLabel,
  formatClock,
} from "../lib/timers.js";
import { remainingSeconds } from "../lib/timer-model.js";
const props = defineProps({
  entry: { type: Object, required: true },
  compact: Boolean,
});
const remaining = computed(() =>
  remainingSeconds(props.entry.timer, timerNow.value),
);
</script>
<template>
  <section
    class="timer-item"
    :class="{
      'timer-ended': entry.timer.status === 'done',
      'timer-inline': compact,
    }"
    :aria-label="timerLabel(entry)"
  >
    <div class="timer-item-heading">
      <strong v-if="!compact">{{ timerLabel(entry) }}</strong>
      <span class="timer-digits" aria-label="剩余时间">{{
        formatClock(remaining)
      }}</span>
      <span
        v-if="entry.timer.status === 'done'"
        class="timer-state"
        role="status"
        >时间到</span
      >
      <span v-else-if="entry.timer.status === 'paused'" class="timer-state"
        >已暂停</span
      >
    </div>
    <div class="timer-controls">
      <button
        v-if="entry.timer.status === 'running'"
        class="secondary"
        @click="actOnTimer(entry, 'pause')"
      >
        暂停
      </button>
      <button
        v-else-if="entry.timer.status === 'paused'"
        class="primary"
        @click="actOnTimer(entry, 'resume')"
      >
        继续
      </button>
      <button v-else class="primary" @click="actOnTimer(entry, 'restart')">
        重新计时
      </button>
      <button class="secondary" @click="actOnTimer(entry, 'add', 30)">
        ＋30 秒
      </button>
      <button class="secondary" @click="actOnTimer(entry, 'add', 60)">
        ＋1 分
      </button>
      <button class="secondary" @click="actOnTimer(entry, 'cancel')">
        {{ entry.timer.status === "done" ? "关闭计时" : "取消计时" }}
      </button>
    </div>
  </section>
</template>
