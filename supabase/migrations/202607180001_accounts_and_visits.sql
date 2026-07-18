create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  privacy_preferences jsonb not null default '{"private_by_default": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  city_name text not null,
  country text not null,
  continent text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  emoji text not null default '🌍',
  overall_rating numeric(2,1) not null check (overall_rating between 1 and 5),
  personal_rating numeric(2,1) not null check (personal_rating between 1 and 5),
  culture_rating numeric(2,1) not null check (culture_rating between 1 and 5),
  architecture_rating numeric(2,1) not null check (architecture_rating between 1 and 5),
  food_rating numeric(2,1) not null check (food_rating between 1 and 5),
  nature_rating numeric(2,1) check (nature_rating between 1 and 5),
  nightlife_rating numeric(2,1) check (nightlife_rating between 1 and 5),
  date_from date not null,
  date_to date not null,
  visit_type text,
  note text check (char_length(note) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_to >= date_from)
);

create table public.visit_photographs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index visits_user_id_idx on public.visits(user_id);
create index visit_photographs_user_id_idx on public.visit_photographs(user_id);
create index visit_photographs_visit_id_idx on public.visit_photographs(visit_id);

alter table public.profiles enable row level security;
alter table public.visits enable row level security;
alter table public.visit_photographs enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles_delete_own" on public.profiles for delete to authenticated
  using ((select auth.uid()) = id);

create policy "visits_select_own" on public.visits for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "visits_insert_own" on public.visits for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "visits_update_own" on public.visits for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "visits_delete_own" on public.visits for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "photos_select_own" on public.visit_photographs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "photos_insert_own" on public.visit_photographs for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "photos_update_own" on public.visit_photographs for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "photos_delete_own" on public.visit_photographs for delete to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('visit-photos', 'visit-photos', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set public = false;

create policy "storage_read_own_visit_photos" on storage.objects for select to authenticated
  using (bucket_id = 'visit-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "storage_insert_own_visit_photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'visit-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "storage_update_own_visit_photos" on storage.objects for update to authenticated
  using (bucket_id = 'visit-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "storage_delete_own_visit_photos" on storage.objects for delete to authenticated
  using (bucket_id = 'visit-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
