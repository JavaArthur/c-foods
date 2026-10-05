export const MAX_TIMER_SECONDS = 999 * 60 + 59;
export const defaultPresets = () =>
  [30, 60, 180, 300, 600, 900].map((seconds) => ({
    id: `preset-${seconds}`,
    name: seconds < 60 ? `${seconds} 秒` : `${seconds / 60} 分钟`,
    seconds,
  }));
export function inputSeconds(minutes, seconds) {
  const m = Number(minutes),
    s = Number(seconds);
  return Number.isInteger(m) &&
    m >= 0 &&
    m <= 999 &&
    Number.isInteger(s) &&
    s >= 0 &&
    s <= 59 &&
    m * 60 + s > 0
    ? m * 60 + s
    : null;
}
export function remainingSeconds(timer, now = Date.now()) {
  if (timer.status === "paused") return timer.remaining;
  if (timer.status === "done") return 0;
  return Math.max(0, Math.ceil((timer.end - now) / 1000));
}
export function formatClock(seconds) {
  const value = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
export function createTimer(seconds, label, now = Date.now()) {
  return {
    label,
    duration: seconds,
    end: now + seconds * 1000,
    remaining: seconds,
    status: "running",
    notified: false,
  };
}
export function normalizeTimers(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([, t]) =>
          t &&
          typeof t === "object" &&
          Number.isFinite(t.end) &&
          (t.status !== "paused" ||
            (Number.isFinite(t.remaining) && t.remaining > 0)),
      )
      .map(([key, t]) => [
        key,
        {
          ...t,
          status: ["paused", "done"].includes(t.status) ? t.status : "running",
          notified: Boolean(t.notified),
        },
      ]),
  );
}
export function normalizePresets(value) {
  const valid =
    Array.isArray(value) &&
    value.length === 6 &&
    value.every(
      (p) =>
        p &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        p.name.trim() &&
        Number.isInteger(p.seconds) &&
        p.seconds > 0 &&
        p.seconds <= MAX_TIMER_SECONDS,
    ) &&
    new Set(value.map((p) => p.id)).size === 6;
  return valid
    ? value.map((p) => ({
        id: p.id,
        name: p.name.trim().slice(0, 20),
        seconds: p.seconds,
      }))
    : defaultPresets();
}
export function changeTimer(timer, action, now = Date.now(), extra = 0) {
  const remaining = remainingSeconds(timer, now);
  if (action === "pause" && timer.status === "running" && remaining > 0) {
    timer.remaining = remaining;
    timer.status = "paused";
  } else if (action === "resume" && timer.status === "paused") {
    timer.end = now + timer.remaining * 1000;
    timer.status = "running";
  } else if (action === "restart" && timer.duration > 0) {
    Object.assign(timer, createTimer(timer.duration, timer.label, now));
  } else if (action === "add" && extra > 0) {
    timer.remaining = remaining + extra;
    timer.end = now + timer.remaining * 1000;
    if (timer.status !== "paused") timer.status = "running";
    timer.notified = false;
  }
}
export function expireTimers(timers, now = Date.now()) {
  const expired = [];
  for (const timer of Object.values(timers)) {
    if (timer.status === "running" && timer.end <= now) {
      timer.status = "done";
      if (!timer.notified) expired.push(timer);
      timer.notified = true;
    }
  }
  return expired;
}
