-- Additive only. Visit UUIDs, list references and all historical data stay intact.
-- No inferred/backfilled IDs: historic names and rounded coordinates are ambiguous.
alter table public.visits add column if not exists geoname_id text
  check (geoname_id ~ '^[1-9][0-9]*$');
alter table public.wishlist_cities add column if not exists geoname_id text
  check (geoname_id ~ '^[1-9][0-9]*$');
create index if not exists visits_user_geoname on public.visits(user_id, geoname_id)
  where geoname_id is not null;
