import { computed, ref, watch } from "vue";
import { scheduleTimerSound } from "./timer-sound.js";
import { state, dishById } from "./store.js";
import {
  createTimer,
  changeTimer,
  expireTimers,
  remainingSeconds,
  formatClock,
} from "./timer-model.js";
export { formatClock } from "./timer-model.js";
export const timerNow = ref(Date.now());
export const allTimers = computed(() => [
  ...Object.entries(state.kitchenTimers).map(([id, timer]) => ({
    id,
    kind: "kitchen",
    timer,
  })),
  ...Object.entries(state.timers).map(([id, timer]) => ({
    id,
    kind: "step",
    timer,
  })),
]);
export const runningTimers = computed(() =>
  allTimers.value.filter(({ timer }) => timer.status === "running"),
);
export const nearestTimer = computed(() =>
  runningTimers.value.length
    ? formatClock(
        Math.min(
          ...runningTimers.value.map(({ timer }) =>
            remainingSeconds(timer, timerNow.value),
          ),
        ),
      )
    : "",
);
export const doneTimers = computed(() =>
  allTimers.value.filter(({ timer }) => timer.status === "done"),
);
export const timerKey = (entry) => `${entry.kind}:${entry.id}`;
const selectedKey = ref("");
export const currentTimer = computed(() => {
  const selected = allTimers.value.find(
    (entry) => timerKey(entry) === selectedKey.value,
  );
  if (selected) return selected;
  return [...allTimers.value].sort((a, b) => {
    const rank = { running: 0, paused: 1, done: 2 };
    return (
      rank[a.timer.status] - rank[b.timer.status] ||
      (a.timer.status === "running" ? a.timer.end - b.timer.end : 0)
    );
  })[0];
});
export function selectTimer(entry) {
  selectedKey.value = entry ? timerKey(entry) : "";
}
watch(currentTimer, (entry) => selectTimer(entry), { immediate: true });
export const ringingTimers = ref([]);
export const previewingSound = ref(false);
export const soundUnavailable = ref(false);
let audio,
  ticker,
  users = 0;
let alarmUntil = 0,
  previewUntil = 0,
  playbackRequest = 0;
let stopSound = () => {};
export function enableTimerSound() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    return audio
      .resume()
      .then(() => {
        soundUnavailable.value = audio?.state !== "running";
      })
      .catch(() => {
        soundUnavailable.value = true;
      });
  } catch {
    soundUnavailable.value = true;
  }
}
function stopPlayback() {
  playbackRequest++;
  stopSound();
  stopSound = () => {};
}
function playUntil(deadline) {
  stopPlayback();
  const request = playbackRequest;
  const play = () => {
    if (request !== playbackRequest || Date.now() >= deadline) return;
    if (!audio || audio.state !== "running") {
      soundUnavailable.value = true;
      return;
    }
    try {
      stopSound = scheduleTimerSound(audio, (deadline - Date.now()) / 1000);
      soundUnavailable.value = false;
    } catch {
      soundUnavailable.value = true;
    }
  };
  if (audio?.state === "running") play();
  else if (audio)
    audio
      .resume()
      .then(play)
      .catch(() => {
        if (request === playbackRequest) soundUnavailable.value = true;
      });
  else play();
}
export function stopTimerSound() {
  stopPlayback();
  ringingTimers.value = [];
  previewingSound.value = false;
  alarmUntil = previewUntil = 0;
  try {
    navigator.vibrate?.(0);
  } catch {}
}
export function previewTimerSound() {
  if (ringingTimers.value.length) return;
  if (previewingSound.value) return stopTimerSound();
  const enabled = enableTimerSound();
  previewingSound.value = true;
  previewUntil = Date.now() + 1000;
  playUntil(previewUntil);
  return enabled;
}
export function timerLabel(entry) {
  if (entry.timer.label) return entry.timer.label;
  const [dishId, step] = entry.id.split(":");
  return `${dishById.value.get(dishId)?.name || "菜谱"} · 第 ${Number(step) + 1} 步`;
}
function tick() {
  timerNow.value = Date.now();
  const expired = [
    ...expireTimers(state.kitchenTimers, timerNow.value),
    ...expireTimers(state.timers, timerNow.value),
  ];
  if (ringingTimers.value.length) {
    ringingTimers.value = ringingTimers.value.filter(
      (entry) =>
        entry.timer.status === "done" &&
        allTimers.value.some(
          (e) => timerKey(e) === timerKey(entry) && e.timer === entry.timer,
        ),
    );
    if (!ringingTimers.value.length || timerNow.value >= alarmUntil)
      stopTimerSound();
  }
  if (previewingSound.value && timerNow.value >= previewUntil) stopTimerSound();
  if (expired.length) {
    const entries = allTimers.value.filter((e) => expired.includes(e.timer));
    ringingTimers.value = [...ringingTimers.value, ...entries];
    previewingSound.value = false;
    alarmUntil = timerNow.value + 15000;
    playUntil(alarmUntil);
    try {
      navigator.vibrate?.([300, 150, 300]);
    } catch {}
  }
}
export function startTimerService() {
  if (users++ === 0) {
    tick();
    ticker = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
  }
  return () => {
    if (--users > 0) return;
    clearInterval(ticker);
    document.removeEventListener("visibilitychange", tick);
    stopTimerSound();
    audio?.close().catch(() => {});
    audio = null;
  };
}
export function startKitchenTimer(seconds, label = "") {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 59999) return;
  enableTimerSound();
  const id = crypto.randomUUID();
  state.kitchenTimers[id] = createTimer(
    seconds,
    label.trim() || `计时 ${formatClock(seconds)}`,
  );
  selectTimer({ kind: "kitchen", id });
  tick();
  return id;
}
export function startStepTimer(dish, index) {
  const key = `${dish.id}:${index}`,
    old = state.timers[key];
  if (old && old.status !== "done") return;
  const seconds = dish.steps[index]?.timerSeconds;
  if (!seconds || state.settings.blacklist.includes(dish.id)) return;
  enableTimerSound();
  state.timers[key] = createTimer(seconds, `${dish.name} · 第 ${index + 1} 步`);
  selectTimer({ kind: "step", id: key });
  tick();
}
export function actOnTimer(entry, action, extra = 0) {
  const book = entry.kind === "step" ? state.timers : state.kitchenTimers;
  if (!book[entry.id]) return;
  if (action === "cancel") delete book[entry.id];
  else {
    enableTimerSound();
    if (!entry.timer.duration && entry.kind === "step") {
      const [dishId, index] = entry.id.split(":");
      entry.timer.duration =
        dishById.value.get(dishId)?.steps[index]?.timerSeconds;
    }
    changeTimer(book[entry.id], action, Date.now(), extra);
  }
  tick();
}
