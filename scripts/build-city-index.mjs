import { readFile, writeFile, mkdir } from "node:fs/promises";
import { normalizeCitySearch, citySearchBucket } from "../src/shared/citySearchKey.ts";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const sourceDir = new URL("../work/geonames/", import.meta.url);
const outputDir = new URL("../public/cities/", import.meta.url);
const outputPath = fileURLToPath(outputDir);
// Avoid rewriting hundreds of identical assets (and triggering dev-server reloads).
async function writeChanged(path, contents) {
  try { if (await readFile(path,"utf8") === contents) return; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  await writeFile(path, contents);
}
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
const uniqueCities = new Map();
const aliasesById = new Map();
const searchBuckets = Array.from({length:256}, () => new Map());
let count = 0;

for (const line of text.split(/\r?\n/)) {
  if (!line) continue;
  const cols = line.split("\t");
  const name = cols[1];
  const ascii = cols[2];
  const countryCode = cols[8];
  const country = countries.get(countryCode);
  const record = [
    name,
    ascii,
    country?.name || countryCode,
    continentNames[country?.continent] || "Other",
    Number(cols[4]),
    Number(cols[5]),
    Number(cols[14]) || 0,
    countryCode,
    cols[0]
  ];
  const uniqueKey = cols[0];
  aliasesById.set(uniqueKey, [...new Set([name, ascii, ...cols[3].split(",")].map(normalizeCitySearch).filter(alias => alias.length >= 2 && alias.length <= 160))]);
  const existing = uniqueCities.get(uniqueKey);
  if (!existing || record[6] > existing[6]) uniqueCities.set(uniqueKey, record);
}

for (const record of uniqueCities.values()) {
  const key = normalize(record[1] || record[0]).replace(/[^a-z0-9]/g, "").slice(0, 2) || "__";
  if (!chunks.has(key)) chunks.set(key, []);
  chunks.get(key).push(record);
  for (const alias of aliasesById.get(record[8])) {
    const buckets = new Set(alias.split(" ").filter(word => word.length >= 2).map(citySearchBucket));
    for (const bucket of buckets) {
      const items = searchBuckets[parseInt(bucket,16)];
      let entry = items.get(record[8]);
      if (!entry) { entry = [record[8], key, record[6], [], normalizeCitySearch(record[2])]; items.set(record[8],entry); }
      entry[3].push(alias);
    }
  }
  count++;
}

await mkdir(outputDir, { recursive: true });
const searchDir = new URL("../public/city-search/", import.meta.url);
await mkdir(searchDir, {recursive:true});
for (let index=0; index<256; index++) {
  const entries=[...searchBuckets[index].values()].sort((a,b)=>b[2]-a[2] || a[0].localeCompare(b[0]));
  await writeChanged(new URL(`${index.toString(16).padStart(2,"0")}.json`,searchDir),JSON.stringify(entries));
}

for (const [key, records] of chunks) {
  records.sort((a, b) => b[6] - a[6]);
  await writeChanged(join(outputPath, `${key}.json`), JSON.stringify(records));
}

await writeChanged(
  new URL("manifest.json", outputDir),
  JSON.stringify({ source: "GeoNames cities500", count, searchVersion: 1, searchBuckets: 256, generatedAt: new Date().toISOString() })
);
console.log(`Generated ${count.toLocaleString()} cities across ${chunks.size} search chunks.`);
