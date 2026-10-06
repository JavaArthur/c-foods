import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { validDrinkCatalog } from "../src/lib/meal-extras.js";

export async function buildDrinks() {
  const { recipes } = JSON.parse(
    await fs.readFile("data/drink-recipes.json", "utf8"),
  );
  if (!validDrinkCatalog(recipes)) throw Error("饮品配方字段不完整或 ID 重复");
  await fs.mkdir("public/data", { recursive: true });
  await fs.writeFile(
    "public/data/drinks.json",
    JSON.stringify(recipes, null, 2) + "\n",
  );
  console.log(`完成：${recipes.length} 款饮品`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await buildDrinks();
