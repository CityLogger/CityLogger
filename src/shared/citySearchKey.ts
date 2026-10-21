export function normalizeCitySearch(value: string) {
  return value.normalize("NFKD").replace(/\p{Mark}/gu, "").toLowerCase()
    .replace(/[’']/g, "").replace(/[^\p{Letter}\p{Number}]+/gu, " ").trim();
}

// Fixed bucket count keeps multilingual names from producing thousands of tiny files.
export function citySearchBucket(value: string) {
  const prefix = Array.from(normalizeCitySearch(value)).slice(0, 2).join("");
  let hash = 0;
  for (const character of prefix) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  return (hash % 256).toString(16).padStart(2, "0");
}
