-- Serialize replacements of the same list without changing ownership or existing rows.
create or replace function public.replace_personal_list_cities(target_list_id uuid, ordered_visit_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.personal_lists
    where id = target_list_id and user_id = (select auth.uid())
    for update;
  if not found then
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
