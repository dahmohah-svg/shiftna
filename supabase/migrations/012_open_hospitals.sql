-- 012: any approved doctor can add a hospital; the admin verifies later.
-- Each hospital gets a credibility level from real activity.

-- 1. Who added it, and no duplicate names in the same city.
alter table public.hospitals
  add column if not exists added_by uuid references public.profiles(id) on delete set null;
create unique index if not exists hospitals_name_city_key
  on public.hospitals (lower(btrim(name)), city);

-- 2. Approved doctors read every hospital, verified or not.
drop policy if exists "approved read verified hospitals" on public.hospitals;
drop policy if exists "approved read hospitals" on public.hospitals;
create policy "approved read hospitals" on public.hospitals
  for select using (is_approved() or is_admin());

-- 3. Approved doctors add hospitals. They are always unverified and
--    recorded as added by that doctor; at most 5 per doctor per day.
drop policy if exists "approved add hospitals" on public.hospitals;
create policy "approved add hospitals" on public.hospitals
  for insert with check (is_approved() and added_by = auth.uid() and verified = false);

create or replace function public.hospitals_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  if char_length(new.name) < 3 or char_length(new.name) > 120 then
    raise exception 'Hospital name must be 3 to 120 characters';
  end if;
  if is_admin() then
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
drop trigger if exists hospitals_before_insert on public.hospitals;
create trigger hospitals_before_insert before insert on public.hospitals
  for each row execute function public.hospitals_before_insert();
revoke execute on function public.hospitals_before_insert() from public, anon, authenticated;

-- 4. Alert the admins when a doctor adds a hospital.
create or replace function public.notify_hospital_added()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, kind, payload)
  select p.id, 'hospital_added',
         jsonb_build_object('hospital_id', new.id, 'hospital', new.name, 'city', new.city,
           'doctor', (select full_name from profiles where id = new.added_by))
  from profiles p
  where p.is_admin and p.id is distinct from new.added_by;
  return null;
end $$;
drop trigger if exists hospitals_notify_added on public.hospitals;
create trigger hospitals_notify_added after insert on public.hospitals
  for each row execute function public.notify_hospital_added();
revoke execute on function public.notify_hospital_added() from public, anon, authenticated;

-- 5. Credibility from activity. Counts different doctors and completed
--    shifts, so one doctor posting many shifts cannot make a hospital trusted.
--    verified: checked by the admin
--    trusted:  10+ shifts posted by 3+ different doctors, 3+ completed
--    active:   3+ shifts posted
--    new:      everything else
create or replace function public.hospital_trust(p_ids uuid[])
returns table (hospital_id uuid, shifts_posted int, posters int, completed int, level text)
language sql stable security definer set search_path = public as $$
  with stats as (
    select h.id, h.verified,
           count(distinct s.id)::int as shifts_posted,
           count(distinct s.poster_id)::int as posters,
           count(distinct b.id) filter (where b.doctor_completed and b.poster_completed)::int as completed
    from hospitals h
    left join shifts s on s.hospital_id = h.id and s.status <> 'cancelled'
    left join bookings b on b.shift_id = s.id and b.cancelled_at is null
    where h.id = any(p_ids) and (is_approved() or is_admin())
    group by h.id, h.verified
  )
  select id, shifts_posted, posters, completed,
         case
           when verified then 'verified'
           when shifts_posted >= 10 and posters >= 3 and completed >= 3 then 'trusted'
           when shifts_posted >= 3 then 'active'
           else 'new'
         end
  from stats
$$;
revoke execute on function public.hospital_trust(uuid[]) from public, anon;
grant execute on function public.hospital_trust(uuid[]) to authenticated, service_role;
