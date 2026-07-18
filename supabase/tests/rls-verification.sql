-- Run in a disposable Supabase test project after replacing the two UUIDs.
-- These checks document the expected isolation. Execute API-level tests with
-- JWTs for both users in CI before production release.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
begin
  if exists (
    select 1 from public.visits
    where user_id = '00000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'RLS failure: User A can read User B visits';
  end if;
end $$;
rollback;
