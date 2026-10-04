// Shared by the data builder and browser. These are food groups, not nutrient estimates.
export const guidelineUrl = "https://dg.cnsoc.org/imgnewslist_0602_2.htm";
export const diversityUrl =
  "https://www.cnsoc.org/activitykit2/6522002010.html";
const leafNames = [
  "菠菜",
  "油麦菜",
  "生菜",
  "上海青",
  "菜心",
  "空心菜",
  "毛白菜",
  "春菜",
  "青菜",
  "小白菜",
  "苋菜",
  "芥蓝",
  "茼蒿",
  "莴笋叶",
  "包菜",
  "娃娃菜",
  "大白菜",
  "菜苔",
];
const rootNames = ["土豆", "山药", "芋头", "红薯"];
const proteinRules = [
  [
    "fish",
    /鱼肉|鱼片|鱼块|鱼头|鲈|鲤|鲫|鳕|鲷|鳊|鲳|黄鱼|鲑|鲮|三文鱼|龙利|巴沙|鳝|带鱼/,
  ],
  ["shrimp", /虾|蟹(?!味菇)|蛤|贝肉|鱿鱼|蛏|蚬|生蚝|海参/],
  [
    "chicken",
    /鸡肉|鸡胸|鸡腿|鸡翅|整鸡|三黄鸡|土鸡|母鸡|童子鸡|仔鸡|鸡块|鸡血|鸡汤/,
  ],
  ["duck", /鸭肉|鸭腿|鸭胸|鸭块|老鸭|整鸭/],
  ["beef", /牛肉|牛腩|牛排|牛腱|牛柳|肥牛|牛杂/],
  ["lamb", /羊肉|羊排|羊腿|羊腩/],
  [
    "pork",
    /猪(?!油)|五花肉|排骨|肋排|里脊|瘦肉|前腿肉|肉馅|肉末|肉糜|肉丝|肉片|肉饼|肉丸|火腿|午餐肉|红肠|培根|腊肠|香肠|肥肠|排条/,
  ],
];
export function foodName(name) {
  const raw = name
    .split(/[（(]/)[0]
    .replace(/\s/g, "")
    .replace(/西红柿/g, "番茄")
    .replace(/马铃薯/g, "土豆")
    .replace(/芥兰/g, "芥蓝")
    .replace(/洋白菜|卷心菜|圆白菜/g, "包菜")
    .replace(/小油菜|小青菜/g, "青菜")
    .replace(/干香菇|鲜香菇/g, "香菇")
    .replace(/猪肉馅|猪肉末|猪肉糜|猪瘦肉|五花肉|猪里脊/g, "猪肉")
    .replace(/鸡胸肉|鸡腿肉/g, "鸡肉")
    .replace(/牛腩|牛里脊/g, "牛肉")
    .replace(/虾仁/g, "虾")
    .replace(/嫩豆腐|老豆腐|内酯豆腐/g, "豆腐");
  for (const [pattern, canonical] of [
    [/猪|瘦肉|肉末|肉馅|肉丝|肉片|肋排|排骨/, "猪肉"],
    [/鸡腿|鸡块|鸡胸|鸡翅|母鸡|鸡肉/, "鸡肉"],
    [/牛腩|牛肉/, "牛肉"],
    [/虾/, "虾"],
    [/鸡蛋|蛋皮|蛋黄/, "鸡蛋"],
    [/香菇/, "香菇"],
    [/茶树菇/, "茶树菇"],
    [/包菜/, "包菜"],
    [/芹/, "芹菜"],
    [/胡萝卜/, "胡萝卜"],
    [/空心菜/, "空心菜"],
    [/玉米粒/, "玉米"],
    [/松子仁|松仁/, "松子"],
    [/甜青豌豆/, "豌豆"],
  ])
    if (pattern.test(raw)) return canonical;
  return raw.replace(/^新鲜|^泡发好的|嫩叶$|段$|片$/g, "");
}
export function stimulusReasons(dish) {
  const text = [
    dish.name,
    ...dish.ingredients.map((i) => i.name),
    ...dish.steps.map((s) => s.text),
    dish.tips || "",
    dish.homeSubstitute || "",
  ]
    .join(" ")
    .replace(/(?:不|无)辣/g, "")
    .replace(/(?:甜椒|彩椒|甜彩椒)/g, "");
  const reasons = [];
  if (
    /辣|小米椒|朝天椒|线椒|螺丝椒|尖椒|青椒|红椒|泡椒|剁椒|虎皮椒|二荆条|杭椒/.test(
      text,
    )
  )
    reasons.push("含辣椒或无法确认无辣的椒类");
  if (/胡椒|花椒|藤椒|麻椒|芥末|椒盐|山葵/.test(text))
    reasons.push("含刺激性调味");
  const ingredients = dish.ingredients.map((i) => i.name).join(" ");
  if (
    /十三香|五香粉|咖喱|豆瓣|火锅底料|卤料包|调味粉|调味酱|复合调味|汤膏|鸡汁|肉汁|料包|调料|调味料|调味汁|酱汁|果味糖醋酱|豉油汁|烧烤料|腌料|南德|王守义|盐焗鸡粉|蒲烧汁|蒜蓉酱|风干牛肉酱料|酱蒸白干料|红烧鱼块料/.test(
      ingredients,
    )
  )
    reasons.push("复合调味成分未确认");
  if (dish.spicyLevel > 0 && !reasons.length) reasons.push("原配方标记为辣");
  return reasons;
}
export function classifyFood(dish) {
  const foods = dish.ingredients.filter(
    (i) =>
      !/油|酱|醋|盐|糖|蜂蜜|可乐|淀粉|生粉|地瓜粉|豆豉|腐乳|鱼露|味精|鸡精|味极鲜|小苏打|芝麻|清水|温水|开水|沸水|饮用水|^水$|(?<!洋)葱|姜|大蒜|蒜(?!苔|苗|花)|香菜|八角|桂皮|香叶|料酒|米酒|葡萄酒|花椒|胡椒/.test(
        i.name.replace(/油麦菜/g, "麦菜"),
      ) && !/^叶菜类蔬菜$/.test(i.name),
  );
  const names = [...new Set(foods.map((i) => foodName(i.name)))];
  const raw = foods
    .map(
      (i) =>
        i.name.split(/[（(]/)[0] +
        (/[（(]鸡肉[）)]/.test(i.name) ? "鸡肉" : ""),
    )
    .join(" ");
  const proteins = proteinRules.filter(([, r]) => r.test(raw)).map(([p]) => p);
  if (/鸡蛋|鸭蛋|鹌鹑蛋|蛋液|鸡子|皮蛋|蛋皮|日本豆腐|玉子豆腐/.test(raw))
    proteins.push("egg");
  if (
    /豆腐|豆干|腐竹|豆皮|千张|香干|白干|大豆|黄豆/.test(raw) &&
    !/日本豆腐|玉子豆腐/.test(raw)
  )
    proteins.push("tofu");
  const leaves = leafNames.filter((n) => names.some((s) => s.includes(n)));
  const tubers = rootNames.filter((n) => names.some((s) => s.includes(n)));
  const vegetables = names.filter(
    (n) =>
      /菜|瓜|萝卜|茄|番茄|菇|木耳|菌|洋葱|笋|藕|豌豆|荷兰豆|豆角|茼蒿|芥蓝|苋|彩椒|甜椒|茭白|蒜苔|蒜苗|蒜花|虫草花|商芝/.test(
        n,
      ) &&
      !proteinRules.some(([, r]) => r.test(n)) &&
      !/蛋|豆腐|豆干|香干|腐竹|千张|粉条|粉丝|米饭|糯米|面条/.test(n) &&
      !rootNames.some((x) => n.includes(x)),
  );
  const darkVegetables = vegetables.filter((n) =>
    /菠菜|油麦|上海青|菜心|空心菜|青菜|苋菜|芥蓝|茼蒿|菜苔|胡萝卜|番茄|西兰花|南瓜|彩椒/.test(
      n,
    ),
  );
  const animal = proteins.filter((p) => !["egg", "tofu"].includes(p));
  const mixed =
    animal.length > 0 &&
    (vegetables.length > 0 || tubers.length > 0 || proteins.includes("tofu"));
  return {
    foods: names,
    proteins,
    leaves,
    vegetables,
    darkVegetables,
    tubers,
    mixed,
    isMeat: animal.length > 0,
    proteinType: animal[0] || proteins[0] || "vegetable",
    occasional:
      /油炸|酥炸|炸|拔丝|蜜汁|糖醋|糖拌|红烧肉|烧肉|可乐/.test(
        dish.name + dish.cookMethod,
      ) || /五花|培根|火腿|腊肉|香肠|腊肠|红肠|午餐肉/.test(raw),
    childNotes: [
      "共餐时把食材切小、做软，按宝宝食量分取；清淡调味。",
      ...(animal.includes("fish") ? ["鱼肉上桌前逐块检查并去净鱼刺。"] : []),
      ...(animal.includes("shrimp") ? ["虾蟹去壳，切成方便咀嚼的小块。"] : []),
      ...(/排骨|鸡腿|鸡翅|鸭腿/.test(raw) ? ["给宝宝分餐前去净骨头。"] : []),
      ...(/花生|坚果|核桃|腰果|松仁/.test(raw)
        ? ["坚果碾碎后拌入，避免整粒给宝宝。"]
        : []),
    ],
  };
}
export const nutrition = (d) => d._meta?.nutrition || classifyFood(d);
export const isLeafDish = (d) => !d.isMeat && nutrition(d).leaves.length > 0;
export function mealBalance(menu) {
  const union = (key) => [...new Set(menu.flatMap((d) => nutrition(d)[key]))];
  return {
    leaves: union("leaves"),
    vegetables: union("vegetables"),
    darkVegetables: union("darkVegetables"),
    tubers: union("tubers"),
    proteins: union("proteins"),
    foods: union("foods"),
  };
}
export function weekDiversity(history, byId, today) {
  const cutoff = new Date(today + "T00:00:00");
  cutoff.setDate(cutoff.getDate() - 6);
  const records = history.filter(
    (h) => h.date <= today && new Date(h.date + "T00:00:00") >= cutoff,
  );
  const foods = new Set(
    records.flatMap((h) =>
      h.ids.flatMap((id) =>
        byId.get(id) ? nutrition(byId.get(id)).foods : [],
      ),
    ),
  );
  return { days: new Set(records.map((h) => h.date)).size, foods: foods.size };
}
