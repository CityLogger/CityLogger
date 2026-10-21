# Supabase setup and release sequence

## Local configuration

Copy `.env.example` to ignored `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_APP_URL`. The optional existing CARTO key is passed consistently to web/mobile through `build/public-env.ts`. Provider/fallback logic is unchanged.

Never put service-role credentials in public variables. Environment values are embedded at build time; web/native assets must be rebuilt after configuration changes.

## Test before production

1. Use a disposable local Supabase stack (Docker + Supabase CLI).
2. Apply **all** repository migrations in filename order locally, not just the first accounts migration. Verify RLS on profiles, visits, photographs, wishlist, personal lists and entries; keep the `visit-photos` bucket private.
3. Serve both deletion Edge Functions locally with their shared helpers.
4. Set `TEST_SUPABASE_URL` (loopback only), `TEST_SUPABASE_ANON_KEY` and `TEST_SUPABASE_SERVICE_ROLE_KEY` from that disposable stack. Run `pnpm test:rls`. It creates and cleans up two fixture accounts. The older SQL template is not a substitute.
5. Run `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm build:mobile`. CI performs code checks without live credentials; it does not establish actual RLS/native correctness.
6. Test signup, eight-digit confirmation, recovery, clean-device loading, repeat visits, interrupted import, export and deletion. Do not delete the sole App Review account.

## Approval-gated production changes

Check project identity and applied migration history before SQL. Never reset a hosted database or repair migration history blindly.

Pending migrations from the high-priority work:

- `202610170001_serialize_list_replacement.sql`: serialize owned-list replacement.
- `202610170002_geographic_identity.sql`: nullable city IDs; required before identified-city writes from the updated client.
- `202610170003_photo_path_ownership.sql`: enforce future photo metadata paths without deleting legacy rows. Audit violations before separately validating the NOT VALID constraint.

After approval and isolated tests, apply outstanding migrations in order, then deploy `delete-visit` and `delete-account` including shared helpers. Supabase supplies server-side keys; never include service-role keys in client builds.

Keep email confirmation enabled, match the eight-digit OTP flow, and configure production SMTP. Confirm the Site URL is the owned HTTPS domain and allow only intended web/native callbacks plus necessary development URLs. Test templates and real delivery using a disposable external inbox. Do not infer live settings from local files.

Publish client and both static city directories together. Rebuild/sync Capacitor, then perform Mac/Xcode and physical-device checks. The new CI does not deploy or modify databases.

## Operations and exports

JSON exports contain all paginated account-owned records and legacy photo metadata, not private image files. If photos return, implement authenticated binary export and cleanup tests before enabling uploads.

Use existing provider dashboards for auth errors, email delivery, function failures, quota and backup/restore checks. Inspect sanitized client codes, not raw user content or tokens. Check review-account availability before submission. No paid monitoring service is required.
