# CityLog backend review — 17 October 2026

Latest implementation status: see [high-priority implementation handoff](high-priority-fixes-2026-10-17.md). The historical findings below are retained for traceability; the handoff records the current fixes, tests, migrations and remaining blockers.

Subsequent medium/low-priority work is recorded in [maintenance improvements](maintenance-improvements-2026-10-18.md), including static alias search, component extraction, error handling and CI. Do not treat the older open statuses below as a list of unimplemented changes.

## Follow-up fixes and live checks (same day)

This section supersedes the initial status entries below where noted.

- Upgraded Next to 16.3.8 and Capacitor core/iOS/CLI to 8.4.3. Updated compatible transitive packages and narrowly overrode vulnerable nanoid 3.3.16 and source-map-js 1.2.1 pins with patched versions in the same major series. Final production dependency audit: **0 advisories**. The iOS Swift package now uses Capacitor 8.4.3. No claim is made about a full development-dependency audit.
- Added a journal mutation coordinator: one write at a time, no optimistic ranking/list changes before successful persistence, refresh invalidation during writes, and account-generation checks before committing results. Signing out invalidates pending writes. Backend user verification now rejects session changes during verification. New account loads clear editor/busy state.
- Guest import reads fresh cloud state, skips already-imported visits, preserves existing nonempty lists and ranking order, and merges wishlist priority. It checks account continuity between steps and retains guest data until successful completion. This remains a multi-request import rather than one database transaction.
- Export defers object-URL cleanup; account deletion now also requires a positive `deleted` response.
- Added a non-destructive migration, `202610170001_serialize_list_replacement.sql`, which locks the owned parent list during transactional replacement. It is **prepared, not applied**. Concurrent device updates remain last-writer-wins; this prevents mixed replacement contents rather than adding conflict resolution.
- Supabase dashboard access worked even though the CLI token was invalid. Its production migration table records all five existing repository migrations through `202610160002_wishlist_order`. This verifies recorded history, not a full live schema/RLS test.
- Production Auth checked: Confirm email is enabled; Email OTP length is **8**, expiry **3600 seconds**; confirmation template includes `{{ .Token }}` and a legacy `{{ .ConfirmationURL }}` fallback. Site URL is **https://citylogger.app**. Allowed redirects include that URL, `citylogger://auth`, and the existing localhost development URL. No settings were changed.
- Web and mobile source import the same `CityLogger.tsx` and eight-digit helper. The public website currently serves `/assets/CityLogger-CakIzafJ.js`, which lacks the pending-signup storage key, eight-digit screen copy and Confirm-and-continue button. The deployed web bundle is behind the local app. Deploy the new web build to bring verification into parity. No test signup/email was sent in this follow-up.
- Verification: **32 tests pass**, TypeScript passes, production web/mobile builds pass, and Capacitor iOS sync succeeds. Native Xcode compilation and actual email/device integration remain untested on Windows.

Deployment still requires approval: publish the client build, deploy both deletion functions, and apply the new list-locking migration. Nothing has been pushed or deployed by this follow-up.

## A. Overall assessment

The architecture is suitable for the current product: a React client shared by web and Capacitor, Supabase Auth, PostgreSQL protected by Row Level Security, and two privileged Edge Functions for deletion. The web runs through Vinext/Cloudflare. City search uses static JSON shards rather than database searches. There is no need for microservices or a second database.

Strengths include explicit query projections, owner-based RLS on every application table, foreign-key cascades, transactional replacement of list entries, database timestamps, retry IDs for visit creation, and separate guest storage. Multiple visits are separate database rows. The major weaknesses are asynchronous state coordination in the large frontend component, limited integration tests, and unverified production configuration. Dependency advisories also require attention before release.

Scope: inspected all backend modules, all five migrations, both Edge Functions, the SQL test, frontend auth/persistence/search/map-rendering paths, mobile authentication callbacks, web worker/build configuration, package manifests, operational scripts and existing tests. This is a source review plus local validation, not a penetration test, database query-plan study or physical-device certification. No production writes, deployment, commit or push were performed.

## B. Prioritised findings

| Priority | Component | Finding and consequence | Action/status |
| --- | --- | --- | --- |
| Critical advisory severity | `package.json`, `pnpm-lock.yaml` | Production dependency audit reports 28 advisories: 4 critical, 12 high, 11 moderate, 1 low. Includes Capacitor iOS 8.4.2 and Next 16.2.6. | Open: compatibility-tested upgrades and runtime reachability review. See security section. |
| High | Both deletion functions; photograph RLS | Photo metadata accepts arbitrary `storage_path` text. Previously service-role cleanup trusted it. A caller able to insert a known, unclaimed foreign path could request deletion of another user's object. A unique-path constraint limits some cases but does not establish ownership. | Fixed in local Edge Function source: validate every path before any storage deletion. Deployment and database defence-in-depth remain outstanding. |
| High | `CityLogger.tsx` ranking/list mutations | Several optimistic reorder/add operations retain changed UI state after save failure. Overlapping writes can finish out of order; a refresh can overwrite an in-flight mutation. | Open: coordinate mutations per resource, reconcile failures, and add interaction tests. This needs a focused frontend state change rather than isolated catch-block patches. |
| High | `CityLogger.tsx` async handlers | The refresh sequence guard protects refreshes, but save/import/delete completions are not bound to the account that started them. A sign-out/account switch during a request can apply a stale result to new UI state, potentially also to guest persistence. | Open: capture an account/session generation for every mutation and discard stale completions. RLS still protects server-side access; this is a client state/isolation issue. |
| High verification gap | Supabase migrations/RLS | Applied schema, deployed functions and two-user isolation have not been verified in this run. CLI returns HTTP 401 `Invalid access token`. | Refresh CLI authentication and perform read-only schema/history verification, followed by disposable-account isolation tests. |
| Medium | `preferences.ts` | Wishlist, lists and list entries were single capped queries, silently truncating larger accounts. | Fixed: paginated reads with unique ordering tie-breakers; regression test covers 1,001 list entries. |
| Medium | Deletion functions | Photo reads were capped; bulk removal was unbounded. Storage and SQL deletion cannot be one transaction. | Fixed pagination and 100-object batches. Remaining: partial storage success followed by failure can leave broken photo references until retry; orphan files without metadata are not enumerated. |
| Medium | Guest import | Sequential import can partially succeed. Stable visit/list IDs make retries useful, but retrying an upsert may overwrite later cloud edits; imported wishlist ordering replaces the current saved order. | Open: explicit merge strategy and resumable import tests. Guest storage is retained on failure. |
| Medium | List replacement RPC | Transactional replacement prevents half-written lists but does not lock the parent list. Concurrent replacement requests can conflict or produce unintended merged results under concurrency. | Open: review parent-row locking/version checks in a new migration; approval needed before applying SQL. |
| Medium | `journey.ts`, search deduplication | City identity is name plus country, so different cities sharing a name within one country are merged in stories/search. | Open: introduce stable city identifiers with a compatibility plan; do not rewrite existing data automatically. |
| Medium | `model.ts`, schema | Client overall rating can differ from the category average; database enforces range, not derivation. Some client length checks do not match DB constraints; signup display names over 80 characters can fail the profile trigger. | Open: align client validation and decide whether the database should calculate overall scores. |
| Medium | `errors.ts`, auth/UI | Database messages can be shown directly; schema details may surface. Many mutation failures expose only a generic sync status. | Open: map expected error codes to useful messages, retain safe diagnostics without user content. |
| Medium | Mobile auth/export | Deep-link processing uses a prefix check and ignores auth-operation errors; password-recovery transition depends on timing. JSON export uses a browser download and immediately revokes its URL. | Open: exact URL validation, recovery integration tests and actual iOS export testing; consider native file sharing only if necessary. |
| Medium | Legacy Storage | Upload UI is gone, but authenticated upload policies still permit API uploads, up to the configured object size limit. | Open: decide whether to revoke new uploads while preserving legacy reads/deletion. This is a policy change requiring approval. |
| Low | `verify-review-account.mjs` | Optional dates caused `.startsWith` on null. | Fixed with null-safe access. |
| Low | Architecture documentation | Referenced deleted `photos.ts` and overstated refresh/error guarantees. | Corrected. |

## C. Implemented changes

1. Account-state loading now reuses `fetchAllPages`. Each collection query has a unique `id` tie-breaker. Small accounts still require one data request per collection; larger collections no longer silently lose rows at the API cap. List assembly remains linear using a map, with no per-list database query.
2. Shared photo cleanup reads every metadata page, checks ownership of the entire set before removal, and removes objects in batches of at most 100. Paths outside the account/visit prefix or containing ambiguous path segments fail closed. Database rows are retained when cleanup fails, allowing retries.
3. Visit deletion rejects null, non-object and malformed UUID payloads with HTTP 400 instead of throwing or making a malformed database query.
4. Review-account verification handles undated visits.
5. Added seven regression tests for pagination, ordering, malformed input, foreign storage paths and cleanup failures. Updated architecture documentation.

No schema, dependency version, mapping, visual-design or product feature changes were made.

## D. Security assessment

Application-table policies in the repository consistently restrict access to `auth.uid()`. List-entry writes additionally check both list and visit ownership. The list RPC is `security invoker`, has an empty search path and is executable by authenticated users. The signup trigger uses a fixed empty search path. Service-role credentials are referenced only by Edge Functions/administrative scripts, not by client modules; build configuration explicitly exposes public variables. No committed environment-secret file was found in the inspected tracked file inventory. This was not a historical secret scan.

Map strings are escaped before insertion into Leaflet HTML. React renders ordinary user text. Account deletion derives identity from a verified JWT rather than accepting a caller-supplied user ID. Wildcard CORS does not replace authentication; both deletion functions verify it.

The new storage guard fixes a confirmed trust-boundary problem in local source. A future schema constraint should also tie photograph metadata paths to `user_id` and `visit_id`, after auditing existing rows. No live exploit attempt or deletion test was performed.

Dependency audit, queried from the package registry on this date:

- Capacitor iOS: `GHSA-rvm3-566m-v7fv`, patched range reported as `>=8.4.3`.
- Next critical advisories: `GHSA-p293-qw3h-jr36`, `GHSA-2xp9-vwfh-vxw4`, `GHSA-vcvr-r3jv-pc5j`. Across all returned Next advisories, the highest minimum fixed version is `16.3.8`.
- Other affected packages: `sharp`, `postcss`, `nanoid`, `source-map-js`, `baseline-browser-mapping`.

Audit severity describes vulnerable package versions, not confirmed exploitation of CityLog. This app uses Vinext rather than a Next production server, and the mobile build is static; several Next-specific conditions may not apply. Capacitor's native runtime needs separate attention. Update compatible packages and rerun the audit/build/device checks; do not blindly force transitive overrides. Development dependencies were not included in this production-only audit. Edge Functions import Supabase JS via a floating major-version URL, which should eventually be pinned and Deno-checked for reproducibility.

Still unverified: production RLS, grants, email/OTP settings, SMTP delivery, auth rate limits, backup/restore coverage, live function versions and storage contents. The existing SQL isolation test is only a template and can pass vacuously without seeded users/rows. It is not proof of two-user isolation.

## E. Performance and running costs

Confirmed improvements are completeness and bounded request size, not measured latency gains. A 1,001-row collection takes three 500-row range requests. Cleanup of 1,001 photos takes three metadata reads and eleven removal calls of at most 100 objects. No latency or query-plan benchmark against production was run.

For typical small accounts, initial loading performs five data queries (visits plus four account-state queries), plus two verified-user lookups. Foreground visibility refresh repeats the reads. Category/filter navigation uses in-memory data and does not itself query Supabase. City search reads static shards, avoiding database search costs. It currently has no debounce/application cache; HTTP caching and aborted requests provide some protection.

User-ID indexes exist on owned tables. Candidate indexes to measure later include `personal_list_cities(visit_id)` for deletion cascades and a composite visits index matching user/date/id ordering. Do not add all candidate indexes speculatively: writes and storage have a cost. A unique wishlist index already starts with `user_id`; its separate user index may be redundant, but verify actual query plans before dropping it.

| Scenario | Practical focus |
| --- | --- |
| 100 users | Current architecture is reasonable. Resolve security/sync findings, verify emails and restore procedures. |
| 1,000 users | Measure active users, rows per account, authentication email volume and foreground refetch traffic. No new service is justified by user count alone. |
| 10,000 users | Use real query plans and slow-query data to choose composite indexes; consider incremental reads if large journals/refetches dominate bandwidth. |
| 100,000 users | Load-test concurrent sessions, auth delivery and deletion; evaluate compute/egress capacity, cursor pagination and background cleanup based on measurements. |

Illustration only: at 100 visits per user these scenarios imply 10,000 / 100,000 / 1 million / 10 million visit rows. Row counts are not storage-size estimates or plan guarantees. Text-only journals are relatively small; photos are disabled in the UI, although legacy storage and API upload permission still require attention. Map tile and email costs may matter independently of database storage. No pricing quote or assurance that a free plan supports a particular population is made.

Offset pagination is suitable for current sizes but does not provide a consistent snapshot during concurrent changes. At larger account sizes, cursor pagination or snapshot exports may be warranted. Profile UUID arrays can retain deleted IDs and grow; this is not a reason to introduce a new ordering service now.

## F. Checks actually run

| Check | Result |
| --- | --- |
| Baseline Vitest | 19/19 passed |
| Updated Vitest | 26/26 passed, seven files |
| TypeScript `tsc --noEmit` | Passed |
| Production web `vinext build` | Passed; framework reports routes as unclassified by its static analyser |
| Production mobile `vite build --config vite.mobile.config.ts` | Passed |
| Release-content script | Passed; it only checks content, not App Store/runtime readiness |
| `git diff --check` | Passed; Windows line-ending notices only |
| Production dependency audit | Completed with 28 advisory findings; not clean |
| Linked migration history | Failed: saved access token invalid (401) |
| Lint | No lint script/configuration is defined |
| Edge Function runtime/typecheck | Deno unavailable; shared pure logic was tested through Vitest, full Deno functions were not run |
| Live RLS, actual email, account export/deletion, offline/relogin, iPhone/iPad | Not executed in this review |

The normal `pnpm test` wrapper initially tried to reinstall dependencies and stopped at a noninteractive confirmation. The existing local Vitest/TypeScript/build executables ran successfully; dependencies were not reinstalled. The audit was run with dependency preflight disabled. Successful builds are not evidence that live authentication and syncing work.

## G. Outstanding work

Before release: address critical dependency advisories; deploy and exercise the defensive deletion changes after approval; verify live schema/RLS with two disposable accounts; fix mutation/account-switch and failed-ordering behavior; test signup, eight-digit OTP, recovery, guest import, export and deletion on actual mobile builds. Confirm real support email delivery separately.

Next focused update: guest import merge semantics; transactional list concurrency; exact mobile callback validation and error handling; safer database error messages; stable city identity; test coverage for interrupted requests and account switching. Consider narrowing upload policies and enforcing metadata path ownership through reviewed SQL.

At larger scale: measured indexes, incremental refresh, cursor pagination/snapshot exports, retention/cleanup processes and load testing. Preserve the simple Supabase architecture until evidence warrants more infrastructure.

## H. Database and deployment actions

Repository migrations present:

1. `202607180001_accounts_and_visits.sql`
2. `202607180002_backend_hardening.sql`
3. `202608010001_review_ready_account_state.sql`
4. `202610160001_optional_visit_details.sql`
5. `202610160002_wishlist_order.sql`

Their live application could not be confirmed in this run. In particular, verify nullable optional dates/category columns and `profiles.wishlist_order`; do not infer status from filenames or repair migration history without inspecting the live schema. No new migration was created or applied.

After Supabase CLI login is refreshed, inspect migration history, schema constraints/policies and deployed function versions. Reconcile any manually applied SQL before further migration work. Test the local function changes in a disposable/staging environment, then obtain deployment approval for both `delete-visit` and `delete-account`. The shared helper is bundled with those functions. Build and deploy the web/mobile client separately for paginated collections.

Verify production public Supabase URL/key/app URL, HTTPS auth redirects, native callback allowlist, confirmation requirements and OTP length without exposing privileged keys. The web build currently omits the CARTO public-variable definition that exists in the mobile build; this is documented for the separate map task and was not changed here.

All changes from this review remain local for review. Nothing has been pushed or deployed.
