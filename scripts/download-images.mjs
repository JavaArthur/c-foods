import fs from "node:fs/promises";
import sharp from "sharp";
const manifest = JSON.parse(
  await fs.readFile("data/image-manifest.json", "utf8"),
);
await fs.mkdir("public/images", { recursive: true });
const jobs = Object.entries(manifest).filter(([, x]) => x.kind === "photo");
let cursor = 0;
const failed = [];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (cursor < jobs.length) {
      const [id, x] = jobs[cursor++],
        file = "public" + x.file;
      try {
        await fs.access(file);
        continue;
      } catch {}
      try {
        const urls = [
          x.sourceUrl,
          x.sourceUrl
            .replace(
              "https://raw.githubusercontent.com/",
              "https://cdn.jsdelivr.net/gh/",
            )
            .replace("/master/", "@master/")
            .replace("/main/", "@main/"),
        ];
        let buffer, last;
        for (const url of urls)
          try {
            const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
            if (!r.ok) throw Error("HTTP " + r.status);
            buffer = Buffer.from(await r.arrayBuffer());
            await sharp(buffer).metadata();
            break;
          } catch (e) {
            last = e;
            buffer = null;
          }
        if (!buffer) throw last;
        await sharp(buffer)
          .rotate()
          .resize({
            width: 640,
            height: 640,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 82 })
          .toFile(file);
      } catch (e) {
        failed.push({ id, name: x.name, error: e.message });
      }
    }
  }),
);
await fs.writeFile(
  ".cache/image-download-errors.json",
  JSON.stringify(failed, null, 2),
);
console.log(`Images: ${jobs.length - failed.length}/${jobs.length}`, failed);
if (failed.length) process.exitCode = 1;
