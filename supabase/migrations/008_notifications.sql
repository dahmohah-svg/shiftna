-- 008: in-app notifications.
-- Adds "read" tracking, creates notifications automatically for the main
-- events, sends them to the app live, and matches new shifts to saved alerts.
-- Nobody is ever notified about their own action.

-- 1. Read tracking and a fast "my latest" lookup.
alter table public.notifications add column if not exists read_at timestamptz;
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

-- 2. Signed-in users may read their own notifications and mark them read.
--    Only database functions create them. Row Level Security still applies.
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- 3. Helper: insert one notification, skipping the person who acted.
create or replace function public.notify(p_user uuid, p_kind text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = auth.uid() then return; end if;
  insert into notifications (user_id, kind, payload) values (p_user, p_kind, coalesce(p_payload, '{}'::jsonb));
end $$;
revoke execute on function public.notify(uuid, text, jsonb) from public, anon, authenticated;

-- Short description of a shift, stored in the notification so the app
-- can show it without extra lookups.
create or replace function public.shift_brief(p_shift uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('shift_id', s.id, 'hospital', h.name, 'start_at', s.start_at)
  from shifts s join hospitals h on h.id = s.hospital_id where s.id = p_shift
$$;
revoke execute on function public.shift_brief(uuid) from public, anon, authenticated;

-- 4. Offers: new offer -> poster; accepted / declined -> doctor.
create or replace function public.notify_offer_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare s shifts; b uuid;
begin
  select * into s from shifts where id = new.shift_id;
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform notify(s.poster_id, 'new_offer',
        shift_brief(s.id) || jsonb_build_object('doctor', (select full_name from profiles where id = new.doctor_id)));
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'accepted' then
      select id into b from bookings
        where shift_id = new.shift_id and doctor_id = new.doctor_id and cancelled_at is null
        order by created_at desc limit 1;
      if b is not null then
        perform notify(new.doctor_id, 'offer_accepted', shift_brief(s.id) || jsonb_build_object('booking_id', b));
      end if;
    elsif new.status = 'refused' and old.status = 'pending' then
      perform notify(new.doctor_id, 'offer_refused', shift_brief(s.id));
    end if;
  end if;
  return null;
end $$;
drop trigger if exists offers_notify on public.offers;
create trigger offers_notify after insert or update of status on public.offers
  for each row execute function public.notify_offer_change();

-- 5. Bookings: cancelled -> the other doctor.
create or replace function public.notify_booking_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
declare other uuid;
begin
  if new.cancelled_at is not null and old.cancelled_at is null then
    other := case when new.cancelled_by = new.doctor_id then new.poster_id else new.doctor_id end;
    perform notify(other, 'booking_cancelled',
      shift_brief(new.shift_id) || jsonb_build_object('booking_id', new.id, 'reason', new.cancel_reason));
  end if;
  return null;
end $$;
drop trigger if exists bookings_notify_cancel on public.bookings;
create trigger bookings_notify_cancel after update of cancelled_at on public.bookings
  for each row execute function public.notify_booking_cancel();

-- 6. Chat: new message -> the other doctor, at most one unread alert per booking.
create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare b bookings; other uuid;
begin
  select * into b from bookings where id = new.booking_id;
  other := case when new.sender_id = b.doctor_id then b.poster_id else b.doctor_id end;
  if other = new.sender_id then return null; end if;
  if exists (select 1 from notifications n where n.user_id = other and n.kind = 'new_message'
             and n.read_at is null and n.payload->>'booking_id' = b.id::text) then
    return null;
  end if;
  perform notify(other, 'new_message',
    shift_brief(b.shift_id) || jsonb_build_object('booking_id', b.id,
      'sender', (select full_name from profiles where id = new.sender_id)));
  return null;
end $$;
drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_new_message();

-- 7. Account approved -> the doctor.
create or replace function public.notify_profile_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    perform notify(new.id, 'account_approved', '{}'::jsonb);
  end if;
  return null;
end $$;
drop trigger if exists profiles_notify_status on public.profiles;
create trigger profiles_notify_status after update of status on public.profiles
  for each row execute function public.notify_profile_status();

-- 8. New shift -> doctors whose saved alert matches it (one alert per doctor).
create or replace function public.notify_shift_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
declare h hospitals;
begin
  if new.status <> 'open' then return null; end if;
  select * into h from hospitals where id = new.hospital_id;
  insert into notifications (user_id, kind, payload)
  select distinct on (p.id) p.id, 'shift_alert',
         jsonb_build_object('shift_id', new.id, 'hospital', h.name, 'start_at', new.start_at, 'pay_egp', new.pay_egp)
  from saved_alerts a
  join profiles p on p.id = a.user_id and p.status = 'approved'
  where p.id <> new.poster_id
    and (a.city is null or a.city = h.city)
    and (a.shift_type is null or a.shift_type = new.type)
    and (a.subspecialty is null or a.subspecialty = new.subspecialty)
    and (not a.immediate_only or new.payment = 'immediate')
    and (not a.urgent_only or new.urgent)
    and (a.min_pay_egp is null or new.pay_egp >= a.min_pay_egp)
    and grade_rank(p.grade) >= grade_rank(new.min_grade)
    and (new.group_id is null or exists (
          select 1 from group_members m where m.group_id = new.group_id and m.user_id = p.id and m.status = 'active'))
  limit 500;
  return null;
end $$;
drop trigger if exists shifts_notify_alerts on public.shifts;
create trigger shifts_notify_alerts after insert on public.shifts
  for each row execute function public.notify_shift_alerts();

-- Trigger functions are never called directly.
revoke execute on function public.notify_offer_change() from public, anon, authenticated;
revoke execute on function public.notify_booking_cancel() from public, anon, authenticated;
revoke execute on function public.notify_new_message() from public, anon, authenticated;
revoke execute on function public.notify_profile_status() from public, anon, authenticated;
revoke execute on function public.notify_shift_alerts() from public, anon, authenticated;

-- 9. Send new notifications to the app live (Row Level Security decides who gets each one).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
