import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseRecipe, sourceImage, clean } from "./recipe-parser.mjs";
import { timeAudit } from "./recipe-time.mjs";
const sources = [
  {
    key: "a",
    repo: "Anduin2017/HowToCook",
    branch: "master",
    source: "howtocook",
    include: /^dishes\/(meat_dish|aquatic|vegetable_dish)\/.+\.md$/,
  },
  {
    key: "b",
    repo: "Gar-b-age/CookLikeHOC",
    branch: "main",
    source: "cooklikehoc",
    include:
      /^(炒菜|蒸菜|炖菜|凉拌|汤|卤菜|烫菜|煮锅|砂锅菜)\/(?!README).+\.md$/,
  },
];
const overlays = JSON.parse(await fs.readFile("data/overlays.json", "utf8"));
const aliases = JSON.parse(
  await fs.readFile("data/recipe-aliases.json", "utf8"),
).names;
const timeOverrides = JSON.parse(
  await fs.readFile("data/time-overrides.json", "utf8"),
);
const images = JSON.parse(
  await fs.readFile("data/image-manifest.json", "utf8"),
);
const families = JSON.parse(
  await fs.readFile("data/recipe-families.json", "utf8"),
);
await fs.mkdir(".cache/md", { recursive: true });
await fs.mkdir("public/data", { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  sources: [],
  included: [],
  skipped: [],
  merged: [],
};
const output = new Map(),
  supplementalImages = new Map(),
  primaryNames = new Set();
async function get(url) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(25000),
    headers: {
      "User-Agent": "TonightDinner-data-builder",
      ...(process.env.GITHUB_TOKEN && url.startsWith("https://api.github.com/")
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : {}),
    },
  });
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  return r.text();
}
async function download(s, p, sha) {
  const file =
    ".cache/md/" +
    createHash("sha1")
      .update(s.repo + p + sha)
      .digest("hex") +
    ".md";
  try {
    return await fs.readFile(file, "utf8");
  } catch {}
  const encoded = p.split("/").map(encodeURIComponent).join("/");
  let last;
  for (const host of [
    `https://raw.githubusercontent.com/${s.repo}/${s.branch}/${encoded}`,
    `https://cdn.jsdelivr.net/gh/${s.repo}@${s.branch}/${encoded}`,
  ])
    try {
      const md = await get(host);
      await fs.writeFile(file, md);
      return md;
    } catch (e) {
      last = e;
    }
  throw last;
}
for (const s of sources) {
  let tree;
  try {
    tree = JSON.parse(
      await get(
        `https://api.github.com/repos/${s.repo}/git/trees/${s.branch}?recursive=1`,
      ),
    );
    await fs.writeFile(`.cache/tree-${s.key}.json`, JSON.stringify(tree));
  } catch (e) {
    tree = JSON.parse(await fs.readFile(`.cache/tree-${s.key}.json`, "utf8"));
    console.warn("目录使用本地缓存：" + s.repo);
  }
  if (tree.truncated) throw Error("GitHub 目录被截断，不能生成不完整数据");
  const files = tree.tree.filter(
    (x) => x.type === "blob" && s.include.test(x.path),
  );
  report.sources.push({
    repo: s.repo,
    revision: tree.sha,
    files: files.length,
  });
  let idx = 0,
    done = 0;
  const results = [];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (idx < files.length) {
        const f = files[idx++];
        try {
          const md = await download(s, f.path, f.sha);
          const name = clean(md.match(/^#\s+(.+)$/m)?.[1] || "").replace(
            /的做法$/,
            "",
          );
          if (s.source === "howtocook") primaryNames.add(name);
          else {
            const image = sourceImage(md, s.source, f.path);
            if (image) supplementalImages.set(name, image);
            if (primaryNames.has(name) && !output.has(name))
              throw Error("主库同名做法待修正，不用补充库替代");
          }
          const parsed = parseRecipe(md, s.source, f.path, overlays);
          parsed.audit.time = timeAudit(
            parsed.dish,
            md,
            timeOverrides[parsed.dish.name],
          );
          results.push(parsed);
        } catch (e) {
          report.skipped.push({ path: f.path, reason: e.message });
        }
        done++;
        if (done % 40 === 0) console.log(`${s.repo}: ${done}/${files.length}`);
      }
    }),
  );
  for (const r of results.sort((a, b) =>
    a.audit.path.localeCompare(b.audit.path, "zh-CN"),
  )) {
    report.included.push(r.audit);
    const old = output.get(r.dish.name);
    if (old) {
      if (s.source === "cooklikehoc" && r.dish.image) old.image = r.dish.image;
      report.merged.push(r.dish.name);
    } else output.set(r.dish.name, r.dish);
  }
}
for (const [name, image] of supplementalImages)
  if (output.has(name)) output.get(name).image = image;
const redirects = {};
for (const [alias, name] of Object.entries(aliases)) {
  const duplicate = output.get(alias),
    kept = output.get(name);
  if (!duplicate || !kept) throw Error(`去重映射失效：${alias} → ${name}`);
  redirects[duplicate.id] = kept.id;
  output.delete(alias);
  report.merged.push({ alias, name, reason: "已核对的同菜别名或设备版本" });
}
const dishes = [...output.values()];
const meta = { redirects, dishes: {} };
for (const dish of dishes) {
  const audit = report.included.find(
    (x) => x.name === dish.name && x.source === dish.source,
  );
  const image = images[dish.id];
  if (!image)
    throw Error(
      `缺少图片记录：${dish.name}。请补充 data/image-manifest.json。`,
    );
  await fs.access("public" + image.file);
  dish.image = image.file;
  dish.cookTimeMinutes = audit.time.max;
  const family =
    Object.entries(families).find(([, names]) =>
      names.includes(dish.name),
    )?.[0] || dish.name;
  meta.dishes[dish.id] = { time: audit.time, image, family };
}
if (
  dishes.filter((x) => x.isMeat).length < 30 ||
  dishes.filter((x) => !x.isMeat).length < 30
)
  throw Error("荤素菜数量不足 30，保留旧数据");
await fs.writeFile(
  "public/data/dishes.json",
  JSON.stringify(dishes, null, 2) + "\n",
);
await fs.writeFile(
  "data/build-report.json",
  JSON.stringify(report, null, 2) + "\n",
);
await fs.writeFile(
  "public/data/dish-meta.json",
  JSON.stringify(meta, null, 2) + "\n",
);
console.log(
  `完成：${dishes.length} 道，荤 ${dishes.filter((x) => x.isMeat).length} / 素 ${dishes.filter((x) => !x.isMeat).length}；跳过 ${report.skipped.length}，详情见 data/build-report.json`,
);
