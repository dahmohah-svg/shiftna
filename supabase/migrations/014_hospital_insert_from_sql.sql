-- 014: hospitals added outside the app (Supabase SQL Editor, server jobs,
-- where no doctor is signed in) keep the values given, like an admin's.
-- Doctors in the app are still always "unverified" and limited to 5 a day.
create or replace function public.hospitals_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  if char_length(new.name) < 3 or char_length(new.name) > 120 then
    raise exception 'Hospital name must be 3 to 120 characters';
  end if;
  if auth.uid() is null or is_admin() then
    new.added_by := coalesce(new.added_by, auth.uid());
    return new;
  end if;
  new.added_by := auth.uid();
  new.verified := false;
  if (select count(*) from hospitals
      where added_by = auth.uid() and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Too many hospitals today';
  end if;
  return new;
end $$;
revoke execute on function public.hospitals_before_insert() from public, anon, authenticated;
