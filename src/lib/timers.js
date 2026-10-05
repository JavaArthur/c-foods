import { computed, ref } from "vue";
import { state, dishById, tell } from "./store.js";
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
let audio,
  ticker,
  users = 0;
export function enableTimerSound() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume().catch(() => {});
  } catch {}
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
  if (!expired.length) return;
  const names = allTimers.value
    .filter((e) => expired.includes(e.timer))
    .map(timerLabel);
  tell(`时间到：${names.join("、")}`);
  try {
    navigator.vibrate?.([300, 150, 300]);
  } catch {}
  try {
    const oscillator = audio.createOscillator(),
      gain = audio.createGain();
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.9);
    oscillator.start();
    oscillator.stop(audio.currentTime + 1);
  } catch {}
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
    audio?.close().catch(() => {});
    audio = null;
  };
}
export function startKitchenTimer(seconds, label = "") {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 59999) return;
  enableTimerSound();
  state.kitchenTimers[crypto.randomUUID()] = createTimer(
    seconds,
    label.trim() || `计时 ${formatClock(seconds)}`,
  );
  tick();
}
export function startStepTimer(dish, index) {
  const key = `${dish.id}:${index}`,
    old = state.timers[key];
  if (old && old.status !== "done") return;
  const seconds = dish.steps[index]?.timerSeconds;
  if (!seconds || state.settings.blacklist.includes(dish.id)) return;
  enableTimerSound();
  state.timers[key] = createTimer(seconds, `${dish.name} · 第 ${index + 1} 步`);
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
