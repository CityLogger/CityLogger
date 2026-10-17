# High-priority implementation handoff — 17 October 2026

Branch: `codex/high-priority-audit-fixes`. Existing uncommitted work was preserved. Nothing was committed, pushed, deployed or applied to a database. This report supersedes the earlier audit's status, not its historical observations.

## A. Implemented fixes

| Issue | Implementation and safety | Files / evidence |
| --- | --- | --- |
| Filtered reorder dropped hidden cities | Canonical ranking includes all cities. Reordering replaces only visible slots. Historical visit UUIDs retain a city's slot after a repeat visit; deleting a representative transfers the slot before deletion. Stale/deleted IDs are ignored. | `src/frontend/rankingOrder.ts`, `CityLogger.tsx`, `tests/ranking-order.test.ts` |
| Same-name places merged | GeoNames ID is separate from visit UUID. Search now preserves each source ID, rather than deduplicating by name/country. Legacy identity includes exact coordinates; no rounded-coordinate matching or inferred backfill. Stories, map summaries, rankings, wishlist actions and statistics use the shared identity. | `journey.ts`, `model.ts`, `preferences.ts`, `visits.ts`, `account.ts`, `scripts/build-city-index.mjs`; 234,934 source records regenerated in 529 shards |
| Delayed account operations | Existing mutation generations are retained. Mutations accept the expected account; paginated journal reads explicitly filter the initiating owner and reverify the session before returning. Account deletion sends the initiating session token explicitly, preventing a subsequent account from becoming its target. | `client.ts`, `preferences.ts`, `visits.ts`, `CityLogger.tsx`, session/coordinator tests |
| Creation retry overwrote later edits | Visit creation now uses conflict-do-nothing, then reads the already-owned record on retry. Editing continues through the separate update method. | `visits.ts`, `tests/visit-retry.test.ts` |
| Partial guest import | Stable per-account transfer UUIDs prevent cross-account collisions. Existing visits are retained; missing list entries are merged. Fresh cloud records are read back and checked for visits, lists, wishlist and ranking membership before guest storage is cleared. A guest snapshot changed by another tab is retained. Every import write is account-bound. | `guestTransfer.ts`, `CityLogger.tsx`, transfer/retry tests |
| Missing metadata-path enforcement | Additive CHECK constraint prevents future photo metadata referencing another account/visit or traversal path. Existing rows are not rewritten or discarded. | Pending migration `202610170003_photo_path_ownership.sql` |
| Insufficient RLS test | Executable two-user harness seeds owned fixtures and checks both directions of table isolation, RPC ownership, metadata paths, Storage, malformed/foreign deletion, owned deletion and account cascades. Remote URLs are refused. | `scripts/test-rls.mjs`, `pnpm test:rls`; prepared, **not executed against a database** |

There was no map-provider, visual-layout, hosting or authentication-provider change. New search results can legitimately contain homonymous cities at different locations. Historical rounded locations remain separate from identified records unless the user explicitly logs another visit from that existing City Story. This intentionally favors preserving data over uncertain automatic merging; a future explicit reconciliation tool may be useful.

## B. Existing fixes verified

- One journal mutation at a time; rejected repeated actions show a wait message. Successful persistence precedes UI commit; failures retain saved state. This is a local write gate, not a multi-device conflict-resolution system.
- Refresh generation guards and account changes invalidate stale UI completions. Editor closure is blocked during a pending write.
- Collection pagination uses 500-row pages and unique ordering tie-breakers. Tests include 1,001 entries and failure on a later page; errors do not become empty success.
- Shared photo cleanup validates every path before privileged removal and batches at 100 objects. Failure retains database records for retry. Invalid deletion IDs are rejected. Both Edge Functions derive the caller through `auth.getUser`, never a request-body user ID.
- Object URL cleanup is delayed for exports; the optional-date review script fix remains.

Limitations: offset pagination is not a transactional snapshot during simultaneous writes from another device. Cross-device writes remain last-writer-wins. Storage and SQL cleanup are not atomic; partial object removal can leave broken photo references until a retry. Unreferenced/orphan storage objects are not enumerated by the current cleanup.

## C. Database rollout — NOT APPLIED

1. `202610170001_serialize_list_replacement.sql`: lock the owned parent list before transactional replacement. Existing security-invoker ownership checks remain.
2. `202610170002_geographic_identity.sql`: nullable text `geoname_id` columns on visits and wishlist; numeric identifier validation; user/geographic index. Visit UUIDs and list foreign keys are unchanged. No legacy backfill.
3. `202610170003_photo_path_ownership.sql`: CHECK constraint marked NOT VALID, enforcing new writes without rejecting migration due to historic invalid rows. Audit legacy violations before separately validating it.

Apply and test all three on an isolated local/staging database first. Deployment requires approval. Apply the additive geographic migration **before** publishing the new search index/client. Reads fall back to the old schema only for a missing geographic column. New identified-city writes do not silently drop their geographic ID: they retain the editor and report a database-update requirement. Old clients can continue using nullable fields after migration.

Rollback the client first if necessary; do not drop populated geographic columns or rewrite visits as an automatic rollback.

## D. Dependency security

Original four critical advisories are now outside their affected ranges, not merely hidden from the audit:

| Advisory | Original → installed | Relevant affected range / first patch | CityLog exposure assessment |
| --- | --- | --- | --- |
| [Next Windows-server RCE](https://github.com/advisories/GHSA-p293-qw3h-jr36) | Next 16.2.6 → 16.3.8 | 16.x before 16.3.3; first 16.3.3 | Production is Vinext/Cloudflare, not a Windows Next server. Installed package still patched. |
| [Next AVIF optimizer RCE](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) | Next 16.2.6 → 16.3.8 | 16.x before 16.3.3; first 16.3.3 | No Next image optimization use found; worker uses Cloudflare/Vinext handling. |
| [Next Node ImageResponse RCE](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) | Next 16.2.6 → 16.3.8 | >=16.2.0 <16.3.6; first 16.3.6 | No application `next/og` generation found. |
| [Capacitor internal HTTP proxy](https://github.com/advisories/GHSA-rvm3-566m-v7fv) | iOS/core/CLI 8.4.2 → 8.4.3 | Installed 8.4.2 affected; first patch 8.4.3 | Native runtime is used. Disabling CapacitorHttp is not a sufficient mitigation. Local Swift package pins 8.4.3; old installed binaries need replacement. |

Next 16.3.8 also covers the other reported Next advisories. React/React DOM/server renderer updated together to 19.2.8; Vite to 8.0.16; Vitest to 4.1.11. Compatible transitive updates and narrowly scoped same-major overrides remove additional toolchain advisories. See `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and the iOS Swift package. Install reported no peer incompatibility; final TypeScript/tests/build checks passed.

Final production dependency audit: **0 advisories**.

Full audit: **0 critical, 4 high, 0 moderate, 1 low** (reduced from 66 findings discovered in this run). Remaining:

- `sharp` 0.34.5 in Cloudflare/Miniflare development tooling: GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c, GHSA-wq5f-xc86-pv6w (high). Required cumulative patch is 0.35.5, outside the pinned pre-1.0 minor. Not force-overridden without validating the upstream native image-processing integration. Avoid untrusted image inputs in local image-processing services; update the Cloudflare toolchain with its image tests before treating this as cleared.
- `braces` 3.0.3 through Vinext's CommonJS/dynamic-import glob tooling: GHSA-vfj7-8cjw-p6xm (high); audit reports **no published patch**. Do not compile untrusted source/glob patterns. Track upstream rather than remove the functioning build dependency.
- `esbuild` 0.27.3: GHSA-g7r4-m6w7-qqqr (low), Windows development-server file-read issue; patch 0.28.1 is outside the current pre-1.0 minor. Keep development servers loopback-only; update through a compatible toolchain release.

Dependency classification is not proof of runtime non-reachability. The production audit excludes development dependencies even though build tools can affect artifacts. These five findings remain explicitly open; no claim of a fully clean dependency tree is made.

## E. Validation

- Baseline: 32 tests passed, TypeScript passed, web/mobile production builds passed.
- Final: **46 tests passed, 0 failed, 13 test files**. TypeScript passed.
- Web production build passed; Vinext still labels routes unclassified, its pre-existing analyzer warning.
- Mobile production build passed. Capacitor asset copy succeeds with Windows user-info permission. Xcode/native compilation is **not tested** on Windows.
- Production and full audit executed; results above.
- `git diff --check` and RLS harness syntax check passed.
- `node scripts/test-rls.mjs` correctly refused to run without isolated credentials (exit 2). Docker and Deno are unavailable here. **No live RLS, SQL migration or Edge Function runtime test passed in this run.**
- Guest transfer tests cover deterministic retry identity, incomplete readback rejection and successful readback; visit tests cover conflict retry preserving edits and failed insertion. They do not simulate every step of a real interrupted Supabase import. Device/end-to-end guest import remains a release check.
- Web and native use the same auth component and OTP helper. No production email was sent, no production auth settings changed, and the hosted website was not updated.

## F. Remaining work and test instructions

Completed locally: critical package fixes, controlled writes, account guards, filtered ranking order, geographic source identity, guest-transfer safeguards, pagination/deletion unit verification, test harness.

Awaiting live verification: migrations, deployed deletion functions, actual two-user isolation, partial guest import/retry, new-device persistence and email confirmation/recovery. These cannot be established by unit tests.

Blocked by environment/approval: local Docker/Supabase and Edge Function runtime, Mac/Xcode/physical iPhone testing, production migration/deployment approval. No access to real accounts is needed to run the isolated tests.

To run the RLS harness: start a disposable **local** Supabase stack with all repository migrations, serve the two Edge Functions, then set `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY` in the terminal environment and run `pnpm test:rls`. Never commit those keys. The harness accepts only loopback URLs, creates two random confirmed fixture users, and cleans up only those fixture IDs/paths. Cleanup runs on assertion failure too. An interrupted process may require manual fixture cleanup in that disposable stack. The script contains mutation/deletion tests and must not be repurposed for production.

Deferred: ambiguous historic geography reconciliation, snapshot exports/cursor pagination at scale, orphan-photo maintenance, native export interaction tests, and the five explicitly listed development-tool advisories requiring upstream/integration work.

## G. Release decision

Ready for focused staging validation, **not an unconditional public-release sign-off**. Approve and verify the migrations/functions before deploying this client; run the two-account harness and real signup/OTP/recovery/import/export/deletion flows on web and iOS. Resolve or explicitly assess the remaining toolchain advisories. Existing live users and production configuration were not changed.
