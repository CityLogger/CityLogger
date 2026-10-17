-- Keep each person's Want to Visit priority in a single atomic profile update.
-- Existing lists retain their created-at order until the user first reorders them.
alter table public.profiles
  add column if not exists wishlist_order uuid[] not null default '{}'::uuid[];

notify pgrst, 'reload schema';
