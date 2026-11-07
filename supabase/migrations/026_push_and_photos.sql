-- 026: phone notifications (Web Push) and profile photos.
--
-- Push: each phone that turns notifications on saves a subscription. When a
-- row is added to notifications, the database posts it (with that user's
-- subscriptions) to the app's /api/push route, which sends the push. The
-- route's address and shared secret live in Supabase Vault, set up below.
-- A daily job reminds doctors the evening before a rota duty or booked shift.
--
-- Photos: a public "avatars" bucket; each user writes only in their own
-- folder, and profiles.photo_url may only point there.

-- 1. Subscriptions.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2. Sending: notifications -> /api/push.
create extension if not exists pg_net with schema extensions;

create or replace function public.push_setting(p_name text)
returns text language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1
$$;
revoke execute on function public.push_setting(text) from public, anon, authenticated;

create or replace function public.send_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare subs jsonb; url text; secret text;
begin
  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'locale', s.locale))
    into subs from push_subscriptions s where s.user_id = new.user_id;
  if subs is null then return null; end if;
  url := push_setting('shiftna_push_url');
  secret := push_setting('shiftna_push_secret');
  if url is null or secret is null then return null; end if;
  perform net.http_post(
    url := url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
    body := jsonb_build_object('id', new.id, 'kind', new.kind, 'payload', new.payload, 'subscriptions', subs),
    timeout_milliseconds := 5000);
  return null;
exception when others then
  -- A push problem must never stop the notification itself.
  return null;
end $$;
revoke execute on function public.send_push() from public, anon, authenticated;
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications
  for each row execute function public.send_push();

-- The route removes subscriptions a phone has revoked (it proves the secret).
create or replace function public.remove_push_subscriptions(p_secret text, p_endpoints text[])
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_secret is null or p_secret is distinct from push_setting('shiftna_push_secret') then
    raise exception 'Not allowed';
  end if;
  delete from push_subscriptions where endpoint = any(p_endpoints);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.remove_push_subscriptions(text, text[]) from public;
grant execute on function public.remove_push_subscriptions(text, text[]) to anon, authenticated;

-- 3. Evening reminders for tomorrow's rota duties and booked shifts (Cairo time).
create or replace function public.queue_duty_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare tomorrow date := (now() at time zone 'Africa/Cairo')::date + 1;
begin
  insert into notifications (user_id, kind, payload)
  select d.doctor_id, 'duty_reminder', jsonb_build_object(
    'team_id', d.group_id, 'team', g.name, 'date', d.duty_date, 'slot', d.slot)
  from team_duties d join groups g on g.id = d.group_id
  where d.duty_date = tomorrow and rota_published(d.group_id, d.duty_date);

  insert into notifications (user_id, kind, payload)
  select b.doctor_id, 'shift_reminder', jsonb_build_object(
    'booking_id', b.id, 'hospital', h.name, 'start_at', s.start_at)
  from bookings b join shifts s on s.id = b.shift_id join hospitals h on h.id = s.hospital_id
  where b.cancelled_at is null and (s.start_at at time zone 'Africa/Cairo')::date = tomorrow;
end $$;
revoke execute on function public.queue_duty_reminders() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('duty-reminders');
exception when others then null; end $$;
-- 18:30 UTC is 8:30 pm in Cairo in winter (9:30 pm in summer).
select cron.schedule('duty-reminders', '30 18 * * *', $$select public.queue_duty_reminders()$$);

-- 4. Profile photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "avatars own upload" on storage.objects;
create policy "avatars own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars own update" on storage.objects;
create policy "avatars own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars own delete" on storage.objects;
create policy "avatars own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- A photo must be the user's own file in the avatars bucket.
alter table public.profiles drop constraint if exists profiles_photo_url_check;
alter table public.profiles add constraint profiles_photo_url_check check (
  photo_url is null
  or photo_url like 'https://teyveqqssxznuzcdtlkr.supabase.co/storage/v1/object/public/avatars/' || id::text || '/%');
