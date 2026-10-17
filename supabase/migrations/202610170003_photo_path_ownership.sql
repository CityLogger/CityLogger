-- Enforce all future writes without discarding or rewriting legacy metadata.
-- Audit pre-existing violations separately before VALIDATE CONSTRAINT.
alter table public.visit_photographs add constraint photo_path_matches_owner_visit
check (
  storage_path like user_id::text || '/' || visit_id::text || '/%'
  and length(storage_path) > length(user_id::text || '/' || visit_id::text || '/')
  and storage_path !~ '(^|/)(\.|\.\.)(/|$)'
  and position('//' in storage_path) = 0
  and position(chr(92) in storage_path) = 0
) not valid;
