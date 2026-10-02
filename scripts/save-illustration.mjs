import fs from "node:fs/promises";
import sharp from "sharp";
const [id, source] = process.argv.slice(2);
if (!/^dish-[a-f0-9]{12}$/.test(id) || !source)
  throw Error("Invalid image arguments");
await fs.mkdir("public/images", { recursive: true });
await sharp(source)
  .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
  .webp({ quality: 82 })
  .toFile(`public/images/${id}.webp`);
