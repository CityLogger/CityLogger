-- Preserve every existing visit; only relax fields that the editor now makes optional.
alter table public.visits
  alter column date_from drop not null,
  alter column date_to drop not null,
  alter column culture_rating drop not null,
  alter column architecture_rating drop not null,
  alter column food_rating drop not null;

-- Existing range, half-star and date-order checks still apply to supplied values.
-- Personal experience remains required. NULL means "not rated", never zero.
notify pgrst, 'reload schema';
