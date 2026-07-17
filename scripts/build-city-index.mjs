import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const sourceDir = new URL("../work/geonames/", import.meta.url);
const outputDir = new URL("../public/cities/", import.meta.url);
const outputPath = fileURLToPath(outputDir);
const text = await readFile(new URL("cities500.txt", sourceDir), "utf8");
const countryText = await readFile(new URL("countryInfo.txt", sourceDir), "utf8");

const countries = new Map();
for (const line of countryText.split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const cols = line.split("\t");
  countries.set(cols[0], { name: cols[4], continent: cols[8] });
}

const continentNames = {
  AF: "Africa", AS: "Asia", EU: "Europe", NA: "North America",
  OC: "Oceania", SA: "South America", AN: "Antarctica"
};

const normalize = value => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const chunks = new Map();
let count = 0;

for (const line of text.split(/\r?\n/)) {
  if (!line) continue;
  const cols = line.split("\t");
  const name = cols[1];
  const ascii = cols[2];
  const countryCode = cols[8];
  const country = countries.get(countryCode);
  const key = normalize(ascii || name).replace(/[^a-z0-9]/g, "").slice(0, 2) || "__";
  const record = [
    name,
    ascii,
    country?.name || countryCode,
    continentNames[country?.continent] || "Other",
    Number(cols[4]),
    Number(cols[5]),
    Number(cols[14]) || 0,
    countryCode
  ];
  if (!chunks.has(key)) chunks.set(key, []);
  chunks.get(key).push(record);
  count++;
}

await mkdir(outputDir, { recursive: true });
for (const oldFile of await readdir(outputDir).catch(() => [])) {
  if (oldFile.endsWith(".json")) {
    // Files are overwritten below; stale prefixes are harmless and deliberately retained.
  }
}

for (const [key, records] of chunks) {
  records.sort((a, b) => b[6] - a[6]);
  await writeFile(join(outputPath, `${key}.json`), JSON.stringify(records));
}

await writeFile(
  new URL("manifest.json", outputDir),
  JSON.stringify({ source: "GeoNames cities500", count, generatedAt: new Date().toISOString() })
);
console.log(`Generated ${count.toLocaleString()} cities across ${chunks.size} search chunks.`);
