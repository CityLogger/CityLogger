# CityLog architecture

Supabase Auth supplies identity; PostgreSQL with RLS is the authority for private data. The UI is a cache, not a second database. Visit UUIDs and GeoNames city IDs are distinct.

## Backend modules

- `client.ts`: verified user and optional expected-account checks.
- `model.ts`: persisted types, explicit field mapping and validation. Visits and Want to Visit share `StoredLocation`/`LocationRow` and their validation/mapping; visit-specific fields remain separate.
- `visits.ts`: owned paginated reads, conflict-do-nothing creation/retry and separate editing.
- `preferences.ts`: goals, wishlist, lists and ranking persistence.
- `pagination.ts`: 500-row reads with caller-provided unique ordering.
- `geography.ts`: missing-column read compatibility for additive geographic-ID rollout.
- `account.ts`: owner-filtered paginated JSON export with an expected-account check and final session verification, including photo metadata but not image files.
- `errors.ts`: safe messages and sanitized code/status diagnostics; original errors remain on `cause` for deliberate debugging. Never forward causes to users/telemetry automatically.
- `supabase/functions/`: verified-session deletion functions with shared paginated ownership-checked photo cleanup.

## Frontend modules

- `src/frontend/CityLogger.tsx`: page composition, authenticated state and interaction coordinator.
- `types.ts`: UI types derived from stored types; draft ratings may be unset.
- `ratings.ts`: shared rating/color presentation.
- `InteractiveMap.tsx`: existing Leaflet map and provider logic. Selecting a marker changes its class without rebuilding every marker; data/category changes still redraw.
- `citySearch.ts`: static alias lookup, top-12 result selection and bounded 24-resource LRU cache. The UI debounces by 200ms and ignores obsolete results.
- `src/shared/citySearchKey.ts`: identical generator/client Unicode normalization and bucket selection.
- `importGuestJournal.ts`: testable transfer orchestration; retains the previous per-account IDs, readback checks and retry semantics. Never deletes local storage itself.
- `guestTransfer.ts`, `journalOperations.ts`, `rankingOrder.ts`, `journey.ts`: focused identity, mutation, ranking and visit-history helpers.
- `authFeedback.ts`: auth codes mapped to safe recovery messages.
- `Onboarding.tsx`: existing onboarding flow.

## Reliability and limits

One journal mutation is permitted at a time; stale account completions are discarded. UI ordering changes commit after successful persistence. Refreshes defer during writes and older refresh results cannot overwrite a newer mutation. Visit and personal-list creation retries use conflict-do-nothing and read the owned record rather than overwriting newer edits. List readback includes all ordered entries, which guest transfer merges even if the conflict was discovered after its initial read. Rename/edit operations remain explicit.

Guest transfer is resumable, not an atomic database transaction. Local data is removed only after readback verification and an unchanged local snapshot. Offset pagination is not a transactional snapshot during concurrent writes from another device. Multi-device updates remain last-writer-wins.

The UI applies visits and account preferences together only when both reads succeed. A failed load retains the displayed snapshot and blocks mutations until a successful retry; account changes reset this readiness. This is client-side consistency, not a transactional database snapshot. Guest journals do not require a cloud read.

The list-creation form retains its operation UUID across retries of the same account/title, including a journal reload, and clears it after success or account change. This in-memory protection does not survive an app restart. Visit/list results are reconciled by ID so a retry after refresh does not duplicate visible rows. Manual ranking uses a memoized identity-to-position index while retaining historic representative visit IDs.

Deletion obtains identity from a verified JWT, not a caller-supplied user ID. Every photo path is validated before privileged removal. SQL and Storage cleanup are not atomic; a partial Storage failure retains database records for retry. Orphan objects without metadata are not enumerated.

Database RLS is still mandatory even when queries include explicit owner filters. Network failures can mean a response was lost after a successful commit; errors must not promise that nothing was saved. Keep stable operation IDs for creation retries.

## Maintenance boundaries

- Keep public backend exports in `src/backend/index.ts`; keep row mapping and validation out of page components.
- Select and write explicit fields. Reuse the shared location model when adding city-bearing records; do not spread arbitrary UI objects into database writes.
- Bind private operations to the initiating account and retain unique ordering on every paginated read.
- Do not turn create methods into implicit updates. Add regression tests for retries, failed readback and account switches when changing persistence.
- Prefer small functions in the existing modules to a generic repository/framework layer. Add migrations for actual schema needs, not speculative future features.

## Configuration and checks

`build/public-env.ts` is the explicit public-variable allowlist for web and mobile, including the existing CARTO key. Never spread all environment variables into the client. Web config changes require a rebuild; native releases require rebuilding and Capacitor sync.

`.github/workflows/checks.yml` runs tests, typecheck and both JS builds without production credentials or deployments. It does not prove RLS, Xcode compatibility or real email delivery.

Follow `docs/supabase-setup.md` for approval-gated deployment and isolated integration testing. Geographic-ID migrations must precede corresponding client writes. Publish city/search assets together.

## Operations and exports

Use existing Supabase/email-provider dashboards to check auth/SMTP failures, Edge Function errors, Storage/database quota and backup/restore coverage. Do not log notes, emails, OTPs or tokens. No new telemetry service is introduced.

Exports include paginated photo metadata, not binary files. If uploads return, add authenticated bounded file export/ZIP handling, expired-link recovery and device tests; do not make the bucket public.

Current status: `docs/high-priority-fixes-2026-10-17.md` and `docs/maintenance-improvements-2026-10-18.md`. The older audit is historical, not evidence of the deployed schema.
