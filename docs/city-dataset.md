# Static city dataset maintenance

Requires Node 24 (the generator imports the shared TypeScript normalization helper).

1. Obtain GeoNames `cities500.txt` and `countryInfo.txt`, preserving attribution/licensing obligations.
2. Place them in ignored `work/geonames/`. Never invent or renumber geographic IDs.
3. Run `pnpm cities:build`. It writes canonical `public/cities/*.json`, the manifest, and all 256 `public/city-search/*.json` buckets.
4. Review count/size differences and run search tests and both builds. Commit generated assets together; raw inputs stay ignored.
5. Publish both directories with the client. Missing assets produce a retryable search error, not an empty success.

Canonical tuple: name, ASCII name, country, continent, latitude, longitude, population, country code, GeoNames ID. Visit UUIDs remain separate.

The alias index uses all source alternate names plus primary/ASCII names, deduplicated after Unicode normalization. Word prefixes route to fixed buckets; matches reference canonical city shards. This supports later words (`York City`), aliases (`Bombay`, `Munich`) and diacritics (`São Paulo`). Exact names rank first, then full-name prefixes, then word matches; population breaks ties. Up to 12 distinct geographic IDs are returned.

Partial queries start at a word boundary. Arbitrary middle-of-word substrings and typo/fuzzy correction are not implemented. Country suffixes can narrow a city-first query. No paid API or database search is involved.

Current lookup size: 65,037,913 raw bytes (~62 MiB), 22,077,073 bytes gzipped bucket-by-bucket (~21 MiB), largest compressed bucket 462,455 bytes. Compression is a measurement, not a guarantee of hosting settings. Web fetches one lookup bucket and up to 12 canonical shards per uncached query, not the full index. A 24-resource cache and 200ms debounce reduce repeat traffic.

Native builds bundle all raw static assets, so installed size increases. Review the actual archive size before release. If this becomes a constraint, measure a compressed native index separately rather than introduce another remote service.

Old canonical prefixes remain for compatibility; search references current IDs only. Dataset regeneration does not backfill or merge user records.
