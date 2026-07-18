-- Backend reliability and ownership hardening.

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger visits_set_updated_at before update on public.visits
  for each row execute procedure public.set_updated_at();

alter table public.visits
  add constraint visits_city_name_length check (char_length(city_name) between 1 and 160),
  add constraint visits_country_length check (char_length(country) between 1 and 120),
  add constraint visits_continent_length check (char_length(continent) between 1 and 80),
  add constraint visits_visit_type_length check (visit_type is null or char_length(visit_type) <= 80),
  add constraint visits_personal_half_star check (mod(personal_rating * 2, 1) = 0),
  add constraint visits_culture_half_star check (mod(culture_rating * 2, 1) = 0),
  add constraint visits_architecture_half_star check (mod(architecture_rating * 2, 1) = 0),
  add constraint visits_food_half_star check (mod(food_rating * 2, 1) = 0),
  add constraint visits_nature_half_star check (nature_rating is null or mod(nature_rating * 2, 1) = 0),
  add constraint visits_nightlife_half_star check (nightlife_rating is null or mod(nightlife_rating * 2, 1) = 0);

drop policy if exists "photos_insert_own" on public.visit_photographs;
drop policy if exists "photos_update_own" on public.visit_photographs;

create policy "photos_insert_for_owned_visit" on public.visit_photographs for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.visits
      where visits.id = visit_id and visits.user_id = (select auth.uid())
    )
  );

create policy "photos_update_for_owned_visit" on public.visit_photographs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.visits
      where visits.id = visit_id and visits.user_id = (select auth.uid())
    )
  );

drop policy if exists "storage_insert_own_visit_photos" on storage.objects;
drop policy if exists "storage_update_own_visit_photos" on storage.objects;

create policy "storage_insert_for_owned_visit" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'visit-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.visits
      where visits.id::text = (storage.foldername(name))[2]
        and visits.user_id = (select auth.uid())
    )
  );

create policy "storage_update_for_owned_visit" on storage.objects for update to authenticated
  using (
    bucket_id = 'visit-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'visit-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.visits
      where visits.id::text = (storage.foldername(name))[2]
        and visits.user_id = (select auth.uid())
    )
  );

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
