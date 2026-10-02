// 中文数词必须整体解析，不能让“三十”只匹配到“十”。
export function numberValue(raw) {
  const s = raw.replace(/个/g, "");
  if (s === "半") return 0.5;
  if (s.endsWith("半")) return numberValue(s.slice(0, -1)) + 0.5;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const digits = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  let total = 0,
    n = 0;
  for (const c of s) {
    if (c in digits) n = digits[c];
    else if (c === "十") {
      total += (n || 1) * 10;
      n = 0;
    } else if (c === "百") {
      total += (n || 1) * 100;
      n = 0;
    } else return NaN;
  }
  return total + n;
}
const num = "(?:\\d+(?:\\.\\d+)?|[零〇一二两三四五六七八九十百]+)(?:个?半)?|半";
const re = new RegExp(
  `(${num})\\s*(?:[-–—~～到至]\\s*(${num}))?\\s*(?:个)?\\s*(小时|分钟|秒钟|天|分(?!之|熟)|秒|min\\b|[sS]\\b)`,
  "g",
);
export function durations(text) {
  const out = [];
  for (const m of text.matchAll(re)) {
    const unit = m[3],
      factor =
        unit === "天"
          ? 86400
          : unit === "小时"
            ? 3600
            : /分钟|分|min/.test(unit)
              ? 60
              : 1;
    const item = {
      text: m[0],
      seconds: numberValue(m[2] || m[1]) * factor,
      index: m.index,
      end: m.index + m[0].length,
    };
    const prev = out.at(-1);
    // “1小时30分钟”“3分40秒”是一个时长，不能只取其中最大值。
    if (prev && /^\s*(?:零|又)?\s*$/.test(text.slice(prev.end, item.index))) {
      prev.seconds += item.seconds;
      prev.end = item.end;
      prev.text = text.slice(prev.index, prev.end);
    } else out.push(item);
  }
  return out.filter((x) => Number.isFinite(x.seconds) && x.seconds > 0);
}
export function timer(text) {
  const values = durations(text);
  return values.length
    ? Math.round(Math.max(...values.map((x) => x.seconds)))
    : null;
}
export function timeAudit(dish, md, override) {
  if (override) return { ...override, kind: "reviewed-estimate" };
  const intro = md.split(/^##/m)[0];
  const stated = durations(intro).filter(
    (x) => x.seconds >= 60 && !x.text.includes("天"),
  );
  const sourceMinutes = stated.length
    ? Math.max(...stated.map((x) => x.seconds)) / 60
    : null;
  const timed = dish.steps.map((s) => ({
    text: s.text,
    minutes: (timer(s.text) || 0) / 60,
  }));
  const advance = timed.filter(
    (s) =>
      (s.minutes >= 60 ||
        (/泡发|浸泡|干木耳泡/.test(s.text) && s.minutes >= 30)) &&
      /泡发|浸泡|干木耳泡|腌制|腌晒|冷藏|冷冻|解冻|晾晒|冰箱/.test(s.text) &&
      !/炖|煮|蒸|烤/.test(s.text),
  );
  const cooking = timed.filter((s) => !advance.includes(s));
  const explicitMinutes = cooking.reduce((sum, s) => sum + s.minutes, 0);
  const base =
    {
      炒: 20,
      蒸: 25,
      炖: 50,
      煮: 25,
      凉拌: 15,
      汤: dish.source === "cooklikehoc" ? 20 : 40,
      卤: 60,
      烫: 15,
      砂锅: 25,
    }[dish.cookMethod] || 25;
  const reference = advance.length
    ? Math.max(base, explicitMinutes + 10)
    : Math.max(sourceMinutes || base, explicitMinutes + 10, 15);
  const min = Math.ceil(reference / 5) * 5;
  const max = min + Math.max(5, Math.ceil((min * 0.2) / 5) * 5);
  const preparations = advance.map((s) => s.text);
  for (const s of dish.steps.filter((s) =>
    /隔夜|一晚|泡发|解冻|浸泡|干木耳泡/.test(s.text),
  ))
    if (!preparations.includes(s.text)) preparations.push(s.text);
  const introPrep = intro
    .split(/[。！\n]/)
    .filter((s) => /提前|泡发|隔夜|一晚|静养|吐沙/.test(s));
  if (!preparations.length) preparations.push(...introPrep);
  const prepared =
    dish.source === "cooklikehoc" &&
    /炸制|卤鸡|熟制|调理|风干|牛杂|虾滑/.test(
      dish.ingredients.map((i) => i.name).join(" ") +
        dish.steps.map((s) => s.text).join(" "),
    );
  return {
    kind: sourceMinutes ? "source-estimate" : "step-estimate",
    min,
    max,
    basis: advance.length
      ? "长时间泡发、腌制、解冻另列；按其余步骤计时，加切配和烧水余量估算。"
      : sourceMinutes
        ? `原文概述约 ${sourceMinutes} 分钟；对照步骤中的计时，补足切配、烧水与装盘余量。`
        : "原文未给完整家庭总用时；按步骤计时和切配、烧水余量估算。",
    sourceMinutes,
    timedSteps: timed.filter((s) => s.minutes > 0),
    preparations,
    note: prepared
      ? "以原文所用的熟制或预处理食材已备好为前提；从生食材制作还需额外时间。"
      : null,
  };
}
