-- 019: phone numbers are private (part 2 of 2).
-- Run only after the app version that reads phone numbers through
-- contact_phones() (from 018) is live; older app code reads profiles with
-- "select *", which this blocks.
-- Column-level read access: every column except phone.
-- If you add a column to profiles later, add it to this list too.
revoke select on public.profiles from anon, authenticated;
grant select (id, full_name, city, grade, photo_url, status, is_premium, is_admin,
              created_at, max_groups, suspended_reason, show_phone)
  on public.profiles to authenticated;

