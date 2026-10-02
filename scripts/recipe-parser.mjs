import path from "node:path";
import { createHash } from "node:crypto";

export const clean = (s) =>
  s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*`_]/g, "")
    .trim();
export const canonical = (s) =>
  clean(s)
    .split(/[（(]/)[0]
    .replace(/\s+/g, "")
    .replace(/生抽酱油/g, "生抽")
    .replace(/老抽酱油/g, "老抽")
    .replace(/白砂糖/g, "白糖")
    .replace(/蒜头|蒜子|蒜末|大蒜末/g, "大蒜")
    .replace(/姜片|生姜/g, "姜")
    .replace(/西红柿/g, "番茄")
    .replace(/大豆油|植物油/g, "食用油");
const proteins = [
  [
    "pork",
    /猪|五花|排骨|里脊|瘦肉|肥肉|肉末|肉馅|肉丝|肉片|火腿|香肠|培根|肥肠/,
  ],
  ["beef", /牛/],
  ["lamb", /羊/],
  ["chicken", /鸡(?!蛋|精)|手枪腿/],
  ["duck", /鸭(?!蛋)/],
  ["shrimp", /虾/],
  ["fish", /鱼|鲈|鲤|鳕|鳝|鳊|蟹|蛤|蚝|蛏|海参|鱿/],
  ["egg", /鸡蛋|鸭蛋|鹌鹑蛋|蛋液|皮蛋/],
  ["tofu", /豆腐|香干|豆皮|千张|腐竹|豆干/],
];
export function protein(s) {
  s = s
    .replace(/牛奶|牛油/g, "乳制品")
    .replace(/素鸡|白干|兰花干/g, "豆腐")
    .replace(/蛋皮/g, "鸡蛋")
    .replace(/红肠/g, "香肠");
  const explicit = proteins
    .filter(([p]) => p !== "pork")
    .find(([p, r]) => !["egg", "tofu"].includes(p) && r.test(s));
  return (
    explicit?.[0] ||
    proteins.find(([, r]) => r.test(s))?.[0] ||
    (/肉|肘子|猪油|油渣/.test(s) ? "pork" : "vegetable")
  );
}
export function group(name) {
  const s = canonical(name);
  if (
    /^(.*油|.*盐|.*糖|.*酱油|生抽|老抽|.*醋|料酒|.*淀粉|水|清水|饮用水|开水|鸡精|味精|蚝油)$/.test(
      s,
    )
  )
    return "pantry";
  if (
    /酱|调料|调味|肉汁|汤膏|粉$|花椒|八角|桂皮|香叶|辣椒|剁椒|泡椒|小米椒|胡椒|大蒜|^姜$|^葱$|大葱|小葱|香葱|蒜瓣|陈皮|料包|酒|香料/.test(
      s,
    )
  )
    return "seasoning";
  if (
    protein(s + (name.match(/（(鸡肉|猪肉|牛肉|鱼肉)）/)?.[1] || "")) !==
      "vegetable" &&
    protein(s) !== "tofu"
  )
    return "meat";
  return "veg";
}
export function timer(text) {
  const cn = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
    半: 0.5,
  };
  const values = [
    ...text.matchAll(
      /(\d+(?:\.\d+)?|[一二三四五六七八九十半])\s*(?:[-~～到至]\s*(\d+(?:\.\d+)?))?\s*(小时|分钟|秒钟|秒|min\b|[sS]\b)/g,
    ),
  ].map(
    (m) =>
      (Number(m[2] || m[1]) || cn[m[1]]) *
      (m[3] === "小时" ? 3600 : /分钟|min/.test(m[3]) ? 60 : 1),
  );
  return values.length ? Math.round(Math.max(...values)) : null;
}
export function section(md, re) {
  const parts = md.split(/^##\s+/m);
  return (
    parts
      .find((s) => re.test(s.split("\n")[0]))
      ?.split("\n")
      .slice(1)
      .join("\n") || ""
  );
}
function lines(s) {
  return s
    .split("\n")
    .map((x) => clean(x.replace(/^\s*(?:[-*+]\s*|\d+[.、]\s*)+/, "")))
    .filter((x) => x && !x.startsWith("#") && !x.startsWith("<!--"));
}
function bulletLines(s) {
  return lines(
    s
      .split("\n")
      .filter((x) => /^\s*[-*+]\s+/.test(x))
      .join("\n"),
  );
}
function stepLines(s) {
  const result = [];
  for (const line of s.split("\n")) {
    if (!line.trim() || /^\s*#|^\s*!\[|<!--/.test(line)) continue;
    if (/^\s*(?:[-*+]|\d+[.、])/.test(line) || !result.length)
      result.push(clean(line.replace(/^\s*(?:[-*+]\s*|\d+[.、]\s*)+/, "")));
    else result[result.length - 1] += " " + clean(line);
  }
  return result.filter(Boolean);
}
const quantity =
  /(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(?:[-–~～到至]\s*(\d+(?:\.\d+)?))?\s*(kg|千克|公斤|g|克|ml|毫升|升|斤|两|个|颗|根|瓣|片|支|只|勺|茶匙|汤匙|块|把|袋|条|头|棵|杯|包|瓶|段|扎|粒|罐)/i;
function qvalue(m) {
  const value = m[2] || m[1];
  let a = value.includes("/")
    ? value
        .split(/\s+/)
        .reduce(
          (sum, v) =>
            sum +
            (v.includes("/")
              ? Number(v.split("/")[0]) / Number(v.split("/")[1])
              : Number(v)),
          0,
        )
    : Number(value);
  let u = m[3].toLowerCase();
  if (/kg|千克|公斤/.test(u)) {
    a *= 1000;
    u = "g";
  }
  if (u === "斤") {
    a *= 500;
    u = "g";
  }
  if (u === "两") {
    a *= 50;
    u = "g";
  }
  if (u === "克") u = "g";
  if (u === "毫升") u = "ml";
  if (u === "升") {
    a *= 1000;
    u = "ml";
  }
  return [a, u];
}
function parseIngredient(line) {
  const m = line.match(quantity);
  let n = (m ? line.slice(0, m.index) : line)
    .replace(/\s*[=：:]\s*$/, "")
    .replace(/约$|大约$/, "")
    .trim();
  if (
    !n ||
    /必须配料|进阶配料|可选配料|每份|人份|使用|注意|计算|工具|锅|剪刀|保鲜膜|^注|刀|砧板|烤箱|烤盘|烤炉|烤网|锡纸|盆|碗|筷|塑料盘|依据|每次|准备|建议/.test(
      n,
    ) ||
    n.length > 35
  )
    return null;
  n = n
    .split(/[，,。；;]/)[0]
    .trim()
    .replace(/大约$|约$/, "")
    .trim();
  n = n
    .split(/[=：:]/)[0]
    .trim()
    .replace(/的数量$|数量$|总量$|量$/, "")
    .replace(/\d.*$/, "")
    .trim();
  n = n.replace(/适量$|少许$|若干$/, "").trim();
  if (!n) return null;
  const [amount, unit] = m ? qvalue(m) : [null, "适量"];
  return { name: canonical(n), amount, unit, group: group(n) };
}
function merge(items) {
  const map = new Map();
  for (const i of items) {
    if (!i) continue;
    const key = i.name + "|" + i.unit;
    const old = map.get(key);
    if (old && old.amount !== null && i.amount !== null) old.amount += i.amount;
    else if (!old) map.set(key, i);
  }
  return [...map.values()];
}
function firstVersion(s) {
  const parts = s.split(/^###\s+/m);
  if (
    parts.length > 2 &&
    parts
      .slice(1)
      .some((x) => /版本|做法[一二]|方法[一二]/.test(x.split("\n")[0]))
  )
    return parts[0] + "\n" + parts[1].split("\n").slice(1).join("\n");
  return s;
}
function method(name, p) {
  if (/凉拌/.test(name + p)) return "凉拌";
  if (/砂锅/.test(name + p)) return "砂锅";
  if (/汤/.test(name + p)) return "汤";
  if (/炖|焖|红烧/.test(name + p)) return "炖";
  if (/蒸/.test(name + p)) return "蒸";
  if (/卤/.test(name + p)) return "卤";
  if (/烫/.test(name + p)) return "烫";
  if (/煮/.test(name + p)) return "煮";
  return "炒";
}
export function scaleMass(text, factor, round5 = false) {
  return text.replace(
    /(\d+(?:\.\d+)?)\s*(kg|千克|公斤|克|g|毫升|ml|升|斤|两)(?![a-z])/gi,
    (_, n, u) => {
      let [a, unit] = qvalue([null, n, null, u]);
      a *= factor;
      return `${round5 ? Math.max(5, Math.round(a / 5) * 5) : Number(a.toFixed(1))}${unit}`;
    },
  );
}
export function sourceImage(md, source, p) {
  const repo =
      source === "howtocook" ? "Anduin2017/HowToCook" : "Gar-b-age/CookLikeHOC",
    branch = source === "howtocook" ? "master" : "main";
  const img = md.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1];
  if (!img) return null;
  const imagePath = path.posix.normalize(
    path.posix.join(path.posix.dirname(p), img),
  );
  return /^https:\/\//.test(img)
    ? img
    : `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${imagePath.split("/").map(encodeURIComponent).join("/")}`;
}
export function parseRecipe(md, source, p, overlays) {
  const name = clean(md.match(/^#\s+(.+)$/m)?.[1] || "").replace(/的做法$/, "");
  if (!name) throw Error("无菜名");
  if (
    source === "cooklikehoc" &&
    /饭|米线|面条|拌面|馄饨|松糕|粗粮盒/.test(name)
  )
    throw Error("属于主食，不纳入荤素配菜");
  let rawSteps = stepLines(
    firstVersion(
      section(md, source === "howtocook" ? /操作|步骤/ : /步骤|做法/),
    ),
  ).filter((x) => !x.includes("Issue") && !x.includes("Pull request"));
  if (!rawSteps.length) throw Error("无可解析步骤");
  let ingredients,
    scale = 1,
    mainMass = null;
  if (source === "howtocook") {
    const calc = section(md, /计算/);
    if (
      bulletLines(calc).some((s) => /份数|兔肉斤数|=.*数量|=\s*面粉/.test(s)) &&
      !overlays.dishes[name]?.ingredients
    )
      throw Error("含参数化用量公式，需要人工明确基准份量");
    ingredients = merge(
      bulletLines(calc)
        .filter((x) => quantity.test(x))
        .map(parseIngredient),
    );
    const names = bulletLines(section(md, /必备原料/))
      .flatMap((s) =>
        !quantity.test(s) && !s.includes("（") ? s.split(/[、，,]/) : [s],
      )
      .map(parseIngredient)
      .filter(Boolean);
    for (const i of names)
      if (
        !ingredients.some(
          (j) =>
            j.name === i.name ||
            j.name.includes(i.name) ||
            i.name.includes(j.name),
        )
      )
        ingredients.push(i);
    // 原料表偶有遗漏油水，只补充步骤里明确写出的常备品，绝不估算。
    const extra = [];
    for (const step of rawSteps)
      for (const m of step.matchAll(
        /(\d+(?:\.\d+)?)\s*(g|克|ml|毫升)\s*(食用油|植物油|饮用水|清水|生抽|老抽|蚝油|白糖|盐)/gi,
      )) {
        const [amount, unit] = qvalue([null, m[1], null, m[2]]);
        extra.push({ name: canonical(m[3]), amount, unit, group: "pantry" });
      }
    for (const item of merge(extra))
      if (!ingredients.some((i) => i.name === item.name))
        ingredients.push(item);
  } else {
    const listed = bulletLines(section(md, /配料|原料/));
    ingredients = listed.map((s) => ({
      name: clean(s),
      amount: null,
      unit: "适量",
      group: group(s),
    }));
    // 门店报告的用量在步骤里，先对照配料表，再识别步骤补充的盐、油等。
    const measured = [];
    for (const step of rawSteps) {
      const re =
        /(\d+(?:\.\d+)?)\s*(kg|千克|公斤|g|克|ml|毫升|升)\s*([^，。、；;：:（）()\d]+)/gi;
      let m;
      while ((m = re.exec(step))) {
        const tail = clean(m[3]);
        let best = null;
        for (const item of ingredients) {
          const base = canonical(item.name);
          const aliases = [
            base,
            base.replace(/片|块|丝|丁|米|液/g, ""),
            base.replace(/^混合|^玉米|^圆|^新鲜|^冷冻/, ""),
            ...(base.includes("五花肉") ? ["肥肉", "五花肉"] : []),
          ].filter((x) => x.length > 1);
          if (
            aliases.some(
              (x) =>
                canonical(tail).startsWith(x) &&
                !/^汤|^酱|^汁|^调料/.test(canonical(tail).slice(x.length)),
            ) &&
            (!best || base.length > canonical(best.name).length)
          )
            best = item;
        }
        const fallback = tail.match(
          /^(食用油|大豆油|盐|鸡精|味精|水淀粉|生抽|老抽|白糖|清水|开水|水|料酒|蚝油|香醋|白醋)/,
        )?.[0];
        if (best || fallback) {
          const [amount, unit] = qvalue([null, m[1], null, m[2]]);
          measured.push({
            name: best?.name || fallback,
            amount,
            unit,
            group: best?.group || group(fallback),
          });
        }
      }
    }
    const merged = merge(measured);
    ingredients = ingredients.map(
      (i) => merged.find((j) => j.name === i.name) || i,
    );
    for (const i of merged)
      if (!ingredients.some((j) => j.name === i.name)) ingredients.push(i);
    if (
      ingredients.some(
        (i) => ["meat", "veg"].includes(i.group) && i.amount === null,
      )
    )
      throw Error("部分主料用量不明确，避免错误缩放");
    mainMass = ingredients
      .filter((i) => ["meat", "veg"].includes(i.group) && i.unit === "g")
      .reduce((s, i) => s + i.amount, 0);
    if (!mainMass) throw Error("缺少可核实的主料克数，待人工覆盖");
    scale = 350 / mainMass;
    // 每次下料分别取整，再相加，确保清单与分步里的总用量一致。
    const scaled = merge(
      measured.map((i) => ({
        ...i,
        amount: Math.max(5, Math.round((i.amount * scale) / 5) * 5),
      })),
    );
    ingredients = ingredients.map(
      (i) => scaled.find((j) => j.name === i.name && j.unit === i.unit) || i,
    );
    rawSteps = rawSteps.map((s) => scaleMass(s, scale, true));
  }
  if (!ingredients.length) throw Error("无可解析原料");
  const main = ingredients.filter(
    (i) =>
      ["meat", "veg"].includes(i.group) && !/^水|米饭|饮用水|开水/.test(i.name),
  );
  const summary = main.map((i) => canonical(i.name)).join(" ");
  let proteinType = protein(
    main
      .map(
        (i) =>
          canonical(i.name) +
          (i.name.match(/（(鸡肉|猪肉|牛肉|鱼肉)）/)?.[1] || ""),
      )
      .join(" "),
  );
  let isMeat =
    source === "howtocook"
      ? !p.includes("vegetable_dish")
      : !["egg", "tofu", "vegetable"].includes(proteinType);
  if (
    source === "cooklikehoc" &&
    !["vegetable", "egg", "tofu"].includes(protein(name)) &&
    proteinType === "vegetable"
  )
    throw Error("菜名含肉类但主料肉量不明，待人工确认");
  if (proteinType in overlays.proteinDefaults)
    isMeat = overlays.proteinDefaults[proteinType];
  const cookMethod = method(name, p);
  const intro = md.split(/^##/m)[0];
  const explicitTime = timer(intro);
  const steps = rawSteps.map((text) => ({ text, timerSeconds: timer(text) }));
  const spicyText = ingredients.map((i) => i.name).join(" ");
  const spicyLevel = /小米辣|朝天椒|干辣椒|麻辣|剁椒/.test(spicyText)
    ? 2
    : /辣椒|豆瓣|泡椒|辣酱|螺丝椒/.test(spicyText)
      ? 1
      : 0;
  const cookTimeMinutes = explicitTime
    ? Math.ceil(explicitTime / 60)
    : Math.max(
        cookMethod === "炖" ? 40 : 15,
        Math.ceil(steps.reduce((s, x) => s + (x.timerSeconds || 0), 0) / 60) +
          10,
      );
  const repo =
    source === "howtocook" ? "Anduin2017/HowToCook" : "Gar-b-age/CookLikeHOC";
  const branch = source === "howtocook" ? "master" : "main";
  const image = sourceImage(md, source, p);
  const commercial =
    source === "cooklikehoc" &&
    ingredients.some((i) => /调料|调味|酱.*（|料包|汤膏|肉汁/.test(i.name));
  const dish = {
    id: "dish-" + createHash("sha1").update(name).digest("hex").slice(0, 12),
    name,
    source,
    sourceUrl: `https://github.com/${repo}/blob/${branch}/${p.split("/").map(encodeURIComponent).join("/")}`,
    image,
    isMeat,
    mainIngredients: main.slice(0, 3).map((i) => canonical(i.name)),
    proteinType,
    cookMethod,
    flavorTags: [
      spicyLevel ? (spicyLevel === 1 ? "微辣" : "辣") : "清淡",
      ...(/糖醋|酸甜/.test(name) ? ["酸甜"] : []),
    ],
    spicyLevel,
    difficulty: Math.min(
      5,
      (intro.match(/★/g) || []).length || (cookMethod === "炒" ? 2 : 3),
    ),
    cookTimeMinutes,
    servings: 2,
    ingredients,
    steps,
    tips: clean(section(md, /附加内容/))
      .split(/如果您遵循/)[0]
      .trim(),
    homeSubstitute: commercial
      ? "家庭替代建议：商用复合调味料可按口味尝试用生抽、醋、糖等家常调料少量调配；番茄口味可加番茄酱。此为家庭建议，不是原报告配方，也无法保证还原风味。"
      : null,
  };
  if (source === "howtocook") {
    const calc = section(md, /计算/);
    const serving = calc.match(/(?:够|供)\s*([1-6一二三四五六两])\s*(?:个)?人/);
    if (serving)
      dish.servings =
        Number(serving[1]) ||
        { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6 }[serving[1]];
  }
  Object.assign(dish, overlays.dishes[name] || {});
  if (overlays.dishes[name]?.ingredients) {
    const perPerson = section(md, /计算/).match(/一份正好够\s*1\s*个人/);
    if (perPerson)
      dish.steps = dish.steps.map((s) => ({
        ...s,
        text: s.text.replace(
          /(\d+(?:\.\d+)?)\s*(g|克|ml)\s*份数/g,
          (_, n, u) => `${Number(n) * dish.servings}${u}`,
        ),
      }));
  }
  return {
    dish,
    audit: {
      name,
      path: p,
      source,
      scale,
      mainMass,
      unknownAmounts: ingredients
        .filter((i) => i.amount === null)
        .map((i) => i.name),
    },
  };
}
