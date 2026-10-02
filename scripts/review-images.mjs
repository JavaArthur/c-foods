import fs from "node:fs/promises";
import sharp from "sharp";
const all = Object.values(
  JSON.parse(await fs.readFile("data/image-manifest.json", "utf8")),
);
const items = [];
for (const x of all) {
  try {
    await fs.access("public" + x.file);
    items.push(x);
  } catch {}
}
await fs.mkdir(".cache/image-review", { recursive: true });
for (let page = 0; page < Math.ceil(items.length / 36); page++) {
  const list = items.slice(page * 36, page * 36 + 36),
    layers = [];
  for (let i = 0; i < list.length; i++) {
    const x = list[i],
      left = (i % 6) * 200,
      top = Math.floor(i / 6) * 165;
    layers.push({
      input: await sharp("public" + x.file)
        .resize(190, 135, { fit: "contain", background: "#fff8f0" })
        .toBuffer(),
      left,
      top,
    });
    const label = `<svg width="200" height="30"><rect width="200" height="30" fill="white"/><text x="4" y="20" font-family="Microsoft YaHei" font-size="13">${x.name.replace(/&/g, "&amp;")} ${x.kind === "photo" ? "实" : "示"}</text></svg>`;
    layers.push({ input: Buffer.from(label), left, top: top + 135 });
  }
  await sharp({
    create: { width: 1200, height: 990, channels: 3, background: "white" },
  })
    .composite(layers)
    .png()
    .toFile(`.cache/image-review/${page + 1}.png`);
}
console.log(`Reviewed sheets: ${items.length} images`);
