# CityLogger

CityLogger is a private travel journal for logging, rating, mapping and ranking cities.

## Project layout

```text
app/                  Thin framework routes and page metadata
src/
  frontend/           React interface and application styling
  backend/            Supabase client, data model and service operations
supabase/
  migrations/         PostgreSQL schema and Row Level Security changes
  functions/          Authenticated server-side deletion operations
  tests/              Database security verification
public/cities/        Static, sharded worldwide city search index
mobile/               Static React entry point used by Capacitor
ios/                  Generated native Xcode project
scripts/              Dataset and deployment preparation scripts
tests/                Fast TypeScript unit tests
docs/                 Setup, architecture and App Store notes
```

The frontend and backend are deliberately separated under `src/`. The `app/`
directory stays small because Next/Vinext requires routes to live there.

## Development

```bash
pnpm install
pnpm dev
```

The normal local preview is `http://localhost:3215` when started with that port.

## Verification

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Backend setup

Copy `.env.example` to `.env.local`, connect a Supabase project, apply migrations
in filename order and deploy both Edge Functions. Full instructions are in
[`docs/supabase-setup.md`](docs/supabase-setup.md).

Never commit `.env.local` or a Supabase service-role key.

## iOS

The Capacitor project is included in this repository. See
[`docs/ios-capacitor.md`](docs/ios-capacitor.md) for the mobile build, Xcode and
TestFlight handoff.
