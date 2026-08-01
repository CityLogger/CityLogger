-- Persist every account-owned feature needed by the App Review demo account.

alter table public.profiles
  add column if not exists yearly_goal integer not null default 10
    check (yearly_goal between 1 and 999),
  add column if not exists ranking_order uuid[] not null default '{}'::uuid[];

alter table public.visits alter column emoji set default '🌍';

create table if not exists public.wishlist_cities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  city_name text not null check (char_length(city_name) between 1 and 160),
  country text not null check (char_length(country) between 1 and 120),
  continent text not null check (char_length(continent) between 1 and 80),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  emoji text not null default '🌍',
  created_at timestamptz not null default now(),
  unique (user_id, city_name, country, latitude, longitude)
);

create table if not exists public.personal_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_list_cities (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.personal_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (list_id, visit_id)
);

create index if not exists wishlist_cities_user_id_idx on public.wishlist_cities(user_id);
create index if not exists personal_lists_user_id_position_idx on public.personal_lists(user_id, position);
create index if not exists personal_list_cities_list_position_idx on public.personal_list_cities(list_id, position);
create index if not exists personal_list_cities_user_id_idx on public.personal_list_cities(user_id);

alter table public.wishlist_cities enable row level security;
alter table public.personal_lists enable row level security;
alter table public.personal_list_cities enable row level security;

create policy "wishlist_select_own" on public.wishlist_cities for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "wishlist_insert_own" on public.wishlist_cities for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "wishlist_update_own" on public.wishlist_cities for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "wishlist_delete_own" on public.wishlist_cities for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "personal_lists_select_own" on public.personal_lists for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "personal_lists_insert_own" on public.personal_lists for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "personal_lists_update_own" on public.personal_lists for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "personal_lists_delete_own" on public.personal_lists for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "personal_list_cities_select_own" on public.personal_list_cities for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "personal_list_cities_insert_owned" on public.personal_list_cities for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.personal_lists where id = list_id and user_id = (select auth.uid()))
    and exists (select 1 from public.visits where id = visit_id and user_id = (select auth.uid()))
  );
create policy "personal_list_cities_update_owned" on public.personal_list_cities for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.personal_lists where id = list_id and user_id = (select auth.uid()))
    and exists (select 1 from public.visits where id = visit_id and user_id = (select auth.uid()))
  );
create policy "personal_list_cities_delete_own" on public.personal_list_cities for delete to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists personal_lists_set_updated_at on public.personal_lists;
create trigger personal_lists_set_updated_at before update on public.personal_lists
  for each row execute procedure public.set_updated_at();

-- Replacing list contents in one database transaction prevents a temporary
-- network failure from leaving an account with an accidentally emptied list.
create or replace function public.replace_personal_list_cities(target_list_id uuid, ordered_visit_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.personal_lists
    where id = target_list_id and user_id = (select auth.uid())
  ) then
    raise exception 'List not found or not owned by the current user';
  end if;

  if exists (
    select 1 from unnest(ordered_visit_ids) as requested(visit_id)
    left join public.visits on visits.id = requested.visit_id
      and visits.user_id = (select auth.uid())
    where visits.id is null
  ) then
    raise exception 'A requested visit is not owned by the current user';
  end if;

  delete from public.personal_list_cities where list_id = target_list_id;
  insert into public.personal_list_cities (list_id, user_id, visit_id, position)
  select target_list_id, (select auth.uid()), visit_id, ordinal - 1
  from unnest(ordered_visit_ids) with ordinality as requested(visit_id, ordinal);
end;
$$;

revoke all on function public.replace_personal_list_cities(uuid, uuid[]) from public;
grant execute on function public.replace_personal_list_cities(uuid, uuid[]) to authenticated;
