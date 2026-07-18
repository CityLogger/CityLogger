# CityLogger backend architecture

## Principles

- Supabase Auth is the identity source.
- PostgreSQL with Row Level Security is the authority for private user data.
- The client never chooses which user it is acting as; backend helpers derive the user from the verified session.
- UI state is a cache of server state, not a second database.
- Storage paths are private and scoped as `{user_id}/{visit_id}/{random_filename}`.
- Account and visit deletion that touches both PostgreSQL and Storage runs in authenticated Edge Functions.

## Client modules

- `src/backend/client.ts`: configured client access and verified current-user lookup.
- `src/backend/model.ts`: domain/database types, explicit field mapping, and validation.
- `src/backend/visits.ts`: visit queries and retry-safe mutations.
- `src/backend/photos.ts`: private upload and signed URL creation.
- `src/backend/account.ts`: current-user-only export.
- `src/backend/errors.ts`: stable error codes and user-safe messages.
- `src/backend/index.ts`: narrow public API used by the frontend.

## Reliability behavior

- New visits receive a client-generated UUID and use an idempotent upsert, so retrying the same operation does not duplicate it.
- Visit queries list explicit columns to prevent accidental data exposure and schema coupling.
- Foreground refreshes use a sequence guard so an older request cannot overwrite newer state.
- Photograph failure does not roll back or hide an already-saved visit.
- Database `updated_at` values are maintained by triggers.
- Photograph metadata and Storage inserts both verify ownership of the referenced visit.
- Deletion functions verify the JWT and derive the user from that session; neither accepts an arbitrary user ID.

## Deployment order

1. Apply migrations in filename order.
2. Deploy `delete-visit`.
3. Deploy `delete-account`.
4. Configure client environment variables.
5. Run RLS integration checks with two disposable users.
6. Test create, reload, photo upload, export, visit deletion and account deletion.

## Operations

- Monitor Edge Function failures and Storage growth.
- Treat a `storage_cleanup_pending` response from `delete-visit` as an operational cleanup alert.
- Back up PostgreSQL according to the project recovery target.
- Rotate secret keys through Supabase; never commit them.
- Review RLS whenever a table, view, RPC or Storage path convention changes.
