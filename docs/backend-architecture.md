# CityLog backend architecture

## Principles

- Supabase Auth is the identity source.
- PostgreSQL with Row Level Security is the authority for private user data.
- The client never chooses which user it is acting as; backend helpers derive the user from the verified session.
- UI state is a cache of server state, not a second database.
- Legacy photograph storage remains private and scoped as `{user_id}/{visit_id}/{random_filename}`.
- Account and visit deletion still cleans up any legacy Storage objects through authenticated Edge Functions.

## Client modules

- `src/backend/client.ts`: configured client access and verified current-user lookup.
- `src/backend/model.ts`: domain/database types, explicit field mapping, and validation.
- `src/backend/visits.ts`: visit queries and retry-safe mutations.
- `src/backend/preferences.ts`: profile preferences, wishlist and personal-list persistence.
- `src/backend/pagination.ts`: shared paginated reads for visits, collections and exports.
- `src/backend/account.ts`: current-user-only export.
- `src/backend/errors.ts`: stable error codes; some underlying database messages are still passed through (see the backend review).
- `supabase/functions/_shared/photo-cleanup.ts`: paginated legacy-photo cleanup with account/path ownership checks and bounded removal batches.
- `src/backend/index.ts`: narrow public API used by the frontend.

## Reliability behavior

- New visits receive a client-generated UUID and use an idempotent upsert, so retrying the same operation does not duplicate it.
- Visit queries list explicit columns to prevent accidental data exposure and schema coupling.
- Foreground refreshes use a sequence guard and defer while a journal write is active. Mutations invalidate older refresh responses.
- `JournalOperations` permits one journal mutation at a time, rejects stale account handlers, and prevents a previous account's completion from committing UI state. Ranked/list changes are committed only after a successful save.
- Database `updated_at` values are maintained by triggers.
- Deletion functions verify the JWT and derive the user from that session; neither accepts an arbitrary user ID.
- Before privileged storage deletion, every metadata path must match the authenticated user's storage prefix, and visit deletion also checks the visit prefix. Invalid paths stop deletion.

## Audit status

See `docs/backend-review-2026-10-17.md` for verified local checks, remaining risks and deployment requirements. Repository migrations and Edge Function source are not proof of the deployed database/function versions.

## Deployment order

1. Apply migrations in filename order.
2. Deploy `delete-visit`.
3. Deploy `delete-account`.
4. Configure client environment variables.
5. Run RLS integration checks with two disposable users.
6. Test create, edit, reload, export, visit deletion and account deletion.

## Operations

- Monitor Edge Function failures and any remaining legacy Storage usage.
- Treat a `storage_cleanup_pending` response from `delete-visit` as an operational cleanup alert.
- Back up PostgreSQL according to the project recovery target.
- Rotate secret keys through Supabase; never commit them.
- Review RLS whenever a table, view, RPC or Storage path convention changes.
