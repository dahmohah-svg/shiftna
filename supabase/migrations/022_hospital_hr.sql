-- 022: hospital HR accounts.
-- A hospital's HR person signs up, uploads a letter or staff card from the
-- hospital, and the admin approves them for one hospital (one HR account per
-- hospital, through hospital_staff). Approved HR can:
--   * search approved doctors who are open to job offers,
--   * post shifts, but only at their own hospital (marked "from the hospital"),
--   * send a doctor a job offer (one shift, part time or full time); the
--     doctor accepts or declines, and both can chat about it. Accepting an
--     offer for a shift books that shift straight away.
-- HR accounts cannot offer on or book shifts themselves.

-- 1. Account type and HR details.
alter table public.profiles add column if not exists account_type text not null default 'doctor';
alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles add constraint profiles_account_type_check check (account_type in ('doctor', 'hr'));
alter table public.profiles add column if not exists job_title text;
alter table public.profiles add column if not exists hr_hospital_name text;
-- Doctors appear in HR search and can receive job offers unless they turn it off.
alter table public.profiles add column if not exists open_to_offers boolean not null default true;
alter table public.profiles add column if not exists offer_note text;
alter table public.profiles drop constraint if exists profiles_hr_text_check;
alter table public.profiles add constraint profiles_hr_text_check check (
  coalesce(char_length(job_title), 0) <= 120
  and coalesce(char_length(hr_hospital_name), 0) <= 160
  and coalesce(char_length(offer_note), 0) <= 200);
grant select (account_type, job_title, hr_hospital_name, open_to_offers, offer_note) on public.profiles to authenticated;

-- HR's document: a letter on hospital paper or a hospital staff card.
alter type public.doc_type add value if not exists 'hr_letter';

-- One HR account per hospital, one hospital per HR account.
create unique index if not exists hospital_staff_one_per_hospital on public.hospital_staff (hospital_id);
create unique index if not exists hospital_staff_one_per_user on public.hospital_staff (user_id);

create or replace function public.is_hr()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select account_type = 'hr' and status = 'approved' from profiles where id = auth.uid()), false)
$$;
revoke execute on function public.is_hr() from public, anon;
grant execute on function public.is_hr() to authenticated;

-- 2. HR accounts have no grade (so they can never offer on or book shifts),
--    and the account type is fixed once approved.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() and auth.uid() is not null then
    new.status := old.status;
    new.is_premium := old.is_premium;
    new.is_admin := old.is_admin;
    new.max_groups := old.max_groups;
    if old.status = 'approved' then
      new.grade := old.grade;
      new.specialty := old.specialty;
      new.account_type := old.account_type;
    end if;
  end if;
  if new.account_type = 'hr' then new.grade := null; end if;
  return new;
end $$;
revoke execute on function public.protect_profile_columns() from public, anon, authenticated;

-- 3. HR post shifts only at their own hospital; those shifts are marked.
alter table public.shifts add column if not exists by_hospital boolean not null default false;

drop policy if exists "post shifts" on public.shifts;
create policy "post shifts" on public.shifts for insert with check (
  is_approved() and poster_id = auth.uid()
  and (group_id is null or is_group_member(group_id))
  and (not is_hr() or exists (
        select 1 from hospital_staff hs where hs.user_id = auth.uid() and hs.hospital_id = shifts.hospital_id)));

create or replace function public.set_shift_by_hospital()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.by_hospital := exists (
    select 1 from hospital_staff hs where hs.user_id = new.poster_id and hs.hospital_id = new.hospital_id);
  return new;
end $$;
revoke execute on function public.set_shift_by_hospital() from public, anon, authenticated;
drop trigger if exists shifts_by_hospital on public.shifts;
create trigger shifts_by_hospital before insert or update of hospital_id, poster_id, by_hospital on public.shifts
  for each row execute function public.set_shift_by_hospital();

-- 4. Job offers and their chat.
create table if not exists public.job_offers (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals (id) on delete cascade,
  hr_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('shift', 'part_time', 'full_time')),
  shift_id uuid references public.shifts (id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  details text check (char_length(details) <= 2000),
  pay_egp integer check (pay_egp > 0 and pay_egp < 10000000),
  pay_period text check (pay_period in ('shift', 'hour', 'month')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  booking_id uuid references public.bookings (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index if not exists job_offers_doctor_idx on public.job_offers (doctor_id, created_at desc);
create index if not exists job_offers_hr_idx on public.job_offers (hr_id, created_at desc);
alter table public.job_offers enable row level security;
drop policy if exists "parties read job offers" on public.job_offers;
create policy "parties read job offers" on public.job_offers for select
  using (hr_id = auth.uid() or doctor_id = auth.uid() or is_admin());
-- Rows are written only by the functions below.

create table if not exists public.job_messages (
  id uuid primary key default gen_random_uuid(),
  job_offer_id uuid not null references public.job_offers (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists job_messages_offer_idx on public.job_messages (job_offer_id, created_at);
alter table public.job_messages enable row level security;
drop policy if exists "parties read job messages" on public.job_messages;
create policy "parties read job messages" on public.job_messages for select using (
  is_admin() or exists (
    select 1 from job_offers j where j.id = job_messages.job_offer_id and (j.hr_id = auth.uid() or j.doctor_id = auth.uid())));
drop policy if exists "parties send job messages" on public.job_messages;
create policy "parties send job messages" on public.job_messages for insert with check (
  sender_id = auth.uid() and exists (
    select 1 from job_offers j where j.id = job_messages.job_offer_id
      and (j.hr_id = auth.uid() or j.doctor_id = auth.uid())
      and j.status in ('pending', 'accepted')));

do $$ begin
  alter publication supabase_realtime add table public.job_messages;
exception when duplicate_object then null; end $$;

create or replace function public.notify_job_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare j job_offers; other uuid;
begin
  select * into j from job_offers where id = new.job_offer_id;
  other := case when new.sender_id = j.doctor_id then j.hr_id else j.doctor_id end;
  if exists (select 1 from notifications n where n.user_id = other and n.kind = 'job_message'
             and n.read_at is null and n.payload->>'job_id' = j.id::text) then
    return null;
  end if;
  perform notify(other, 'job_message', jsonb_build_object(
    'job_id', j.id, 'title', j.title,
    'sender', (select full_name from profiles where id = new.sender_id),
    'hospital', (select name from hospitals where id = j.hospital_id)));
  return null;
end $$;
revoke execute on function public.notify_job_message() from public, anon, authenticated;
drop trigger if exists job_messages_notify on public.job_messages;
create trigger job_messages_notify after insert on public.job_messages
  for each row execute function public.notify_job_message();

-- 5. Sending, answering and withdrawing job offers.
create or replace function public.send_job_offer(
  p_doctor uuid, p_kind text, p_shift uuid, p_title text, p_details text,
  p_pay_egp integer, p_pay_period text)
returns uuid language plpgsql security definer set search_path = public as $$
declare h uuid; d profiles; s shifts; v_id uuid;
begin
  if not is_hr() then raise exception 'Only hospital HR can send job offers'; end if;
  select hospital_id into h from hospital_staff where user_id = auth.uid();
  if h is null then raise exception 'Only hospital HR can send job offers'; end if;
  select * into d from profiles where profiles.id = p_doctor;
  if d.id is null or d.status <> 'approved' or d.account_type <> 'doctor' or not d.open_to_offers then
    raise exception 'This doctor is not taking job offers';
  end if;
  if (select count(*) from job_offers where hr_id = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Daily job offer limit reached';
  end if;
  if exists (select 1 from job_offers where hr_id = auth.uid() and doctor_id = p_doctor and status = 'pending'
             and shift_id is not distinct from p_shift) then
    raise exception 'You already sent this doctor an offer that is still waiting';
  end if;
  if p_kind = 'shift' then
    select * into s from shifts where shifts.id = p_shift;
    if s.id is null or s.hospital_id <> h then raise exception 'Choose a shift at your hospital'; end if;
    if s.status <> 'open' then raise exception 'This shift is no longer open'; end if;
    if grade_rank(d.grade) < grade_rank(s.min_grade) then
      raise exception 'Your grade is below the minimum for this shift';
    end if;
  elsif p_shift is not null then
    raise exception 'Choose a shift at your hospital';
  end if;
  insert into job_offers (hospital_id, hr_id, doctor_id, kind, shift_id, title, details, pay_egp, pay_period)
  values (h, auth.uid(), p_doctor, p_kind, case when p_kind = 'shift' then p_shift end,
          p_title, nullif(trim(p_details), ''), p_pay_egp, p_pay_period)
  returning job_offers.id into v_id;
  perform notify(p_doctor, 'job_offer', jsonb_build_object(
    'job_id', v_id, 'title', p_title, 'hospital', (select name from hospitals where hospitals.id = h)));
  return v_id;
end $$;

create or replace function public.respond_job_offer(p_offer uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare j job_offers; s shifts; me profiles; b uuid;
begin
  select * into j from job_offers where id = p_offer for update;
  if j.id is null or j.doctor_id <> auth.uid() then raise exception 'Not allowed'; end if;
  if j.status <> 'pending' then raise exception 'This offer was already answered'; end if;
  if not p_accept then
    update job_offers set status = 'declined', responded_at = now() where id = j.id;
    perform notify(j.hr_id, 'job_offer_declined', jsonb_build_object(
      'job_id', j.id, 'title', j.title, 'doctor', (select full_name from profiles where id = j.doctor_id)));
    return null;
  end if;
  if j.kind = 'shift' then
    select * into me from profiles where id = auth.uid();
    select * into s from shifts where id = j.shift_id for update;
    if s.id is null or s.status <> 'open' then raise exception 'This shift is no longer open'; end if;
    if grade_rank(me.grade) < grade_rank(s.min_grade) then
      raise exception 'Your grade is below the minimum for this shift';
    end if;
    if doctor_has_overlap(auth.uid(), s.id) then raise exception 'This shift overlaps another confirmed shift'; end if;
    insert into offers (shift_id, doctor_id, message, status) values (s.id, auth.uid(), 'Job offer', 'accepted')
      on conflict (shift_id, doctor_id) do update set status = 'accepted';
    insert into bookings (shift_id, doctor_id, poster_id) values (s.id, auth.uid(), s.poster_id) returning id into b;
    update offers set status = 'refused' where shift_id = s.id and doctor_id <> auth.uid() and status = 'pending';
    update shifts set status = 'filled' where id = s.id;
  end if;
  update job_offers set status = 'accepted', responded_at = now(), booking_id = b where id = j.id;
  perform notify(j.hr_id, 'job_offer_accepted', jsonb_build_object(
    'job_id', j.id, 'title', j.title, 'doctor', (select full_name from profiles where id = j.doctor_id)));
  return b;
end $$;

create or replace function public.withdraw_job_offer(p_offer uuid)
returns void language plpgsql security definer set search_path = public as $$
declare j job_offers;
begin
  select * into j from job_offers where id = p_offer for update;
  if j.id is null or j.hr_id <> auth.uid() then raise exception 'Not allowed'; end if;
  if j.status <> 'pending' then raise exception 'This offer was already answered'; end if;
  update job_offers set status = 'withdrawn', responded_at = now() where id = j.id;
  perform notify(j.doctor_id, 'job_offer_withdrawn', jsonb_build_object(
    'job_id', j.id, 'title', j.title, 'hospital', (select name from hospitals where id = j.hospital_id)));
end $$;

-- 6. Doctor search for HR (and the admin).
create or replace function public.search_doctors(
  p_specialty text default null, p_city text default null, p_min_grade text default null, p_limit integer default 50)
returns table (doctor_id uuid, full_name text, grade text, specialty text, city text, photo_url text,
               offer_note text, avg_rating numeric, shifts_done bigint, show_up_pct numeric, verified boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_hr() or is_admin()) then raise exception 'Not allowed'; end if;
  return query
    select p.id, p.full_name, p.grade, p.specialty, p.city, p.photo_url, p.offer_note,
           st.avg_rating, coalesce(st.shifts_done, 0), st.show_up_pct, docs_verified_for(p.id)
    from profiles p
    cross join lateral doctor_stats(p.id) st
    where p.status = 'approved' and p.account_type = 'doctor' and p.open_to_offers
      and (p_specialty is null or p.specialty = p_specialty)
      and (p_city is null or p.city = p_city)
      and (p_min_grade is null or grade_rank(p.grade) >= grade_rank(p_min_grade))
    order by docs_verified_for(p.id) desc, coalesce(st.shifts_done, 0) desc, st.avg_rating desc nulls last, p.full_name
    limit least(greatest(p_limit, 1), 100);
end $$;

-- 7. Admin approves an HR account for one hospital; the hospital becomes verified.
create or replace function public.admin_approve_hr(p_user uuid, p_hospital uuid)
returns void language plpgsql security definer set search_path = public as $$
declare u profiles; h hospitals;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  select * into u from profiles where id = p_user;
  if u.id is null or u.account_type <> 'hr' then raise exception 'Not an HR account'; end if;
  select * into h from hospitals where id = p_hospital;
  if h.id is null then raise exception 'Hospital not found'; end if;
  if exists (select 1 from hospital_staff where hospital_id = p_hospital and user_id <> p_user) then
    raise exception 'This hospital already has an HR account';
  end if;
  delete from hospital_staff where user_id = p_user and hospital_id <> p_hospital;
  insert into hospital_staff (hospital_id, user_id) values (p_hospital, p_user) on conflict do nothing;
  update hospitals set verified = true where id = p_hospital;
  update profiles set status = 'approved', suspended_reason = null, city = h.city where id = p_user;
end $$;

revoke execute on function public.send_job_offer(uuid, text, uuid, text, text, integer, text) from public, anon;
revoke execute on function public.respond_job_offer(uuid, boolean) from public, anon;
revoke execute on function public.withdraw_job_offer(uuid) from public, anon;
revoke execute on function public.search_doctors(text, text, text, integer) from public, anon;
revoke execute on function public.admin_approve_hr(uuid, uuid) from public, anon;
grant execute on function public.send_job_offer(uuid, text, uuid, text, text, integer, text) to authenticated;
grant execute on function public.respond_job_offer(uuid, boolean) to authenticated;
grant execute on function public.withdraw_job_offer(uuid) to authenticated;
grant execute on function public.search_doctors(text, text, text, integer) to authenticated;
grant execute on function public.admin_approve_hr(uuid, uuid) to authenticated;

-- 8. Phone numbers: also shared between HR and a doctor who accepted their job offer.
create or replace function public.contact_phones(p_ids uuid[])
returns table (user_id uuid, phone text)
language sql stable security definer set search_path = public as $$
  select p.id, p.phone
  from profiles p
  where p.id = any(p_ids)
    and p.phone is not null
    and (
      p.id = auth.uid()
      or is_admin()
      or (p.show_phone and exists (
            select 1 from bookings b join shifts s on s.id = b.shift_id
            where b.cancelled_at is null
              and s.start_at + s.duration_hours * interval '1 hour' + interval '2 days' > now()
              and ((b.doctor_id = auth.uid() and b.poster_id = p.id)
                or (b.poster_id = auth.uid() and b.doctor_id = p.id))))
      or (p.show_phone and exists (
            select 1 from job_offers j
            where j.status = 'accepted'
              and ((j.hr_id = auth.uid() and j.doctor_id = p.id)
                or (j.doctor_id = auth.uid() and j.hr_id = p.id))))
    )
$$;
