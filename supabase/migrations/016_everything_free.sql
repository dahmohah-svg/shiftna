-- 016: everything is free during the pilot.
-- Every approved doctor counts as Premium: they can create teams (the admin
-- still approves each team, and the 3-teams-per-doctor limit stays) and see
-- other doctors' rank. The profiles.is_premium column is kept for later.
--
-- To start charging again, restore the original check:
--   create or replace function public.is_premium() returns boolean
--   language sql stable security definer set search_path = public as $$
--     select coalesce((select is_premium from profiles where id = auth.uid()), false)
--   $$;
create or replace function public.is_premium()
returns boolean language sql stable security definer set search_path = public as $$
  select is_approved()
$$;
