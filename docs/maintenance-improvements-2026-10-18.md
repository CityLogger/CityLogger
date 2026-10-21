# Remaining maintenance improvements — 18 October 2026

Scope: medium/low-priority follow-up to the 17 October backend review. Existing high-priority fixes were preserved, not reimplemented. No production data, deployments or remote branches were changed during this follow-up.

## Completed

- Extracted guest-import orchestration into `src/frontend/importGuestJournal.ts`. Preserved stable per-account identifiers, conflict-safe insertion, readback and merge behaviour. Added account-change protection and regression tests for interrupted/repeated imports. The UI still retains local guest data until successful transfer and an unchanged-snapshot check.
- Added a static alias lookup index and a bounded, retryable search cache. Searches support accented names, alternative names, Unicode and prefixes of later name words without changing canonical GeoNames identity. Results load only relevant lookup/canonical shards. Search failures now offer retry rather than appearing as an empty result.
- Extracted the Leaflet map, shared types and rating helpers from `CityLogger.tsx`. Marker selection updates styling without rebuilding every marker. Tile fallback listeners are detached before adding the fallback layer. Map provider, styling and functionality are unchanged.
- Centralised safe backend/auth feedback. Technical backend causes remain available for debugging; displayed messages and diagnostic warnings avoid raw database content.
- Shared an explicit public environment-variable allowlist between web and mobile builds, including the existing map configuration.
- Added a GitHub Actions workflow for TypeScript, tests and both builds. It requires no production credentials and does not deploy.
- Updated architecture and Supabase setup documentation, documented dataset regeneration, and clarified that account JSON exports include photograph metadata rather than original private image files.

## Main files

`src/frontend/CityLogger.tsx`, `InteractiveMap.tsx`, `importGuestJournal.ts`, `citySearch.ts`, `authFeedback.ts`, `ratings.ts`, `types.ts`; `src/shared/citySearchKey.ts`; `src/backend/errors.ts`, `account.ts`; `scripts/build-city-index.mjs`; `public/city-search/`; `public/cities/manifest.json`; `build/public-env.ts`; both Vite configurations; `.github/workflows/checks.yml`; `package.json`; architecture, Supabase and dataset documentation; search/import/error regression tests and updated backend test expectations.

## Verification

- TypeScript: passed (`tsc --noEmit`).
- Automated tests: 57 passed across 16 files (`vitest run`).
- Web production build: passed (`vinext build`).
- Mobile production build: passed (`vite build --config vite.mobile.config.ts`).
- Dataset regeneration: completed with 234,934 cities, 529 canonical shards and 256 alias lookup buckets. Generator skips identical files; this also avoided a transient Windows rewrite error during verification.
- Local mobile-preview smoke check: existing map displayed; city-search dialog opened; Munich returned German results and Bombay returned Mumbai. No cities were saved, deleted or imported during this browser check.
- Git whitespace check: passed.

## Limitations and deferred work

- Alias assets add approximately 62 MiB uncompressed (21 MiB summed gzip) to the dataset. Web requests are sharded; native packaging currently includes all assets. Consider native compression only after measuring download/install size against release requirements.
- Search is alias/word-prefix based, not fuzzy typo correction or arbitrary substring search. No paid service was added.
- Mobile build retains a nonblocking approximately 500 kB main-chunk warning; route splitting should follow measured startup needs. Vinext retains its route-classification warning.
- CI has been prepared locally, not executed on GitHub yet. No push was performed.
- Live Supabase migration/RLS tests, real email delivery, clean-device account transfer and Xcode/device release tests remain separate checks. This report does not assert production or App Store readiness. Previously prepared high-priority migrations still require the approved release sequence.
- Photograph binary export remains deferred while photo functionality is disabled; if restored, implement authenticated file export and test it before promising complete image backups.
- Use existing Supabase/auth/email-provider dashboards for lightweight failure and quota monitoring; no paid monitoring infrastructure was introduced.

## Follow-up backend consolidation

A second focused pass on 18 October preserved all of the above work and made these additional local changes:

- `src/backend/model.ts` now owns the shared location type, row mapping and validation used by both visits and wishlist cities. Invalid wishlist coordinates/location details fail before network writes. No stored fields were renamed.
- `src/backend/preferences.ts` makes personal-list creation retry-safe: conflicts return the existing owned title and paginated membership without replacing its position/title. Wishlist deletion explicitly filters the owner as well as the row ID.
- `src/frontend/importGuestJournal.ts` merges membership returned by creation readback, including a list created after the import's initial account read.
- `src/backend/account.ts` filters all export tables/pages by the initiating owner, including geographic-schema fallback queries. The existing final account check remains; the UI passes its initiating account ID.
- Network error copy describes an unconfirmed request instead of falsely asserting that an ambiguous write did not save.
- Added export and list-mutation regression suites; expanded location, import and photo-cleanup tests. Later metadata-page failure causes no Storage deletion; a later Storage-batch failure stops further deletion and permits retry. No Edge Function implementation changed.
- Updated the architecture guide with practical persistence conventions, without a new abstraction framework or dependency.

Final follow-up verification: **86 tests passed in 18 files**, TypeScript passed, and both web/mobile production builds passed. The initial all-suite attempt could not load tests because Windows sandbox temporary-cache renames returned EPERM; the permitted rerun passed. Existing Vinext route-classification and mobile chunk-size warnings remain (main JS approximately 500 kB). No database/schema changes, commits, pushes, deployment or production writes were performed in this follow-up. Live RLS and native-device checks remain separate release requirements.

## Final focused code pass

Additional requested review on 18 October addressed three concrete issues rather than adding another broad refactor:

1. **Incomplete journal loads:** `JournalOperations` tracks account load readiness. `CityLogger.tsx` applies visits/preferences together only when both reads succeed, keeps the displayed snapshot on failure, and blocks mutations until Retry succeeds. Sign-out and account switches reset readiness. Guest logging remains local and does not require a cloud load.
2. **Creation retries at the UI boundary:** the Create List form now reuses a stable UUID for the same account/title until success, so the backend's conflict-safe creation also protects actual button retries. A successful retry reconciles rows by ID rather than appending a duplicate; visit saves also avoid duplicate visible IDs after a refresh. Pending form IDs remain in memory, not a persistent offline write queue.
3. **Ranking work:** a memoized linear lookup maps each geographic identity to its saved representative and position. This replaces repeated full-history filtering/sorting inside comparison callbacks and reorder actions. Tests check equivalence against the old lookup with 600 visits and repeated/homonymous cities.

Files: `src/frontend/CityLogger.tsx`, `journalOperations.ts`, `rankingOrder.ts`; `tests/journal-operations.test.ts`, `tests/ranking-order.test.ts`; architecture notes and this report.

Verification: **93 tests passed across 18 files**, TypeScript passed, web production build passed, mobile production build passed, and whitespace checks passed. Existing Vinext route-classification and mobile chunk-size warnings remain (main JS 501.38 kB, gzip 143.46 kB). No dependencies, database schemas, production data, visual layout or map provider changed. Nothing was committed, pushed or deployed. Real Supabase interruption/account-switch tests and native iPhone testing are still release gates, not established by these unit tests.
