-- 020: growth dashboard for the admin.
-- 1. track_open(): records that a doctor opened Shiftna, at most once per
--    doctor per day (Cairo time), so "active doctors" can be counted.
-- 2. admin_growth(weeks): one row per week (Monday start, Cairo time).
-- 3. admin_growth_summary(weeks): current totals and the busiest cities.
-- Both report functions are admin-only.

create index if not exists app_events_name_created_idx on public.app_events (name, created_at);

create or replace function public.track_open()
returns void language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'Africa/Cairo')::date;
begin
  if not is_approved() then return; end if;
  if exists (select 1 from app_events
             where user_id = auth.uid() and name = 'open'
               and (created_at at time zone 'Africa/Cairo')::date = today) then
    return;
  end if;
  insert into app_events (user_id, name, props) values (auth.uid(), 'open', '{}'::jsonb);
end $$;
revoke execute on function public.track_open() from public, anon;
grant execute on function public.track_open() to authenticated, service_role;

create or replace function public.admin_growth(p_weeks int default 12)
returns table (
  week_start date,
  signups int,
  active_doctors int,
  shifts_posted int,
  shifts_filled int,
  median_hours_to_fill numeric,
  completed int,
  cancelled int
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  return query
  with weeks as (
    select generate_series(
      date_trunc('week', (now() at time zone 'Africa/Cairo'))::date - (greatest(least(p_weeks, 104), 1) - 1) * 7,
      date_trunc('week', (now() at time zone 'Africa/Cairo'))::date,
      interval '7 days')::date as ws
  ),
  wk as (select ws, ws + 7 as we from weeks)
  select
    w.ws,
    (select count(*)::int from profiles p
      where (p.created_at at time zone 'Africa/Cairo')::date >= w.ws and (p.created_at at time zone 'Africa/Cairo')::date < w.we),
    (select count(distinct u)::int from (
        select e.user_id as u from app_events e where e.name = 'open'
          and (e.created_at at time zone 'Africa/Cairo')::date >= w.ws and (e.created_at at time zone 'Africa/Cairo')::date < w.we
        union select s.poster_id from shifts s
          where (s.created_at at time zone 'Africa/Cairo')::date >= w.ws and (s.created_at at time zone 'Africa/Cairo')::date < w.we
        union select o.doctor_id from offers o
          where (o.created_at at time zone 'Africa/Cairo')::date >= w.ws and (o.created_at at time zone 'Africa/Cairo')::date < w.we
        union select m.sender_id from messages m
          where (m.created_at at time zone 'Africa/Cairo')::date >= w.ws and (m.created_at at time zone 'Africa/Cairo')::date < w.we
      ) a where u is not null),
    (select count(*)::int from shifts s
      where (s.created_at at time zone 'Africa/Cairo')::date >= w.ws and (s.created_at at time zone 'Africa/Cairo')::date < w.we),
    (select count(*)::int from bookings b
      where b.cancelled_at is null
        and (b.created_at at time zone 'Africa/Cairo')::date >= w.ws and (b.created_at at time zone 'Africa/Cairo')::date < w.we),
    (select round((percentile_cont(0.5) within group (
              order by extract(epoch from b.created_at - s.created_at) / 3600))::numeric, 1)
       from bookings b join shifts s on s.id = b.shift_id
      where b.cancelled_at is null
        and (b.created_at at time zone 'Africa/Cairo')::date >= w.ws and (b.created_at at time zone 'Africa/Cairo')::date < w.we),
    (select count(*)::int from bookings b join shifts s on s.id = b.shift_id
      where b.doctor_completed and b.poster_completed
        and (s.start_at at time zone 'Africa/Cairo')::date >= w.ws and (s.start_at at time zone 'Africa/Cairo')::date < w.we),
    (select count(*)::int from bookings b
      where b.cancelled_at is not null
        and (b.cancelled_at at time zone 'Africa/Cairo')::date >= w.ws and (b.cancelled_at at time zone 'Africa/Cairo')::date < w.we)
  from wk w
  order by w.ws;
end $$;
revoke execute on function public.admin_growth(int) from public, anon;
grant execute on function public.admin_growth(int) to authenticated, service_role;

create or replace function public.admin_growth_summary(p_weeks int default 12)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(weeks => greatest(least(p_weeks, 104), 1));
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'doctors_approved', (select count(*) from profiles where status = 'approved'),
    'doctors_pending', (select count(*) from profiles where status = 'pending'),
    'open_shifts_now', (select count(*) from shifts where status = 'open' and start_at > now()),
    'hospitals_verified', (select count(*) from hospitals where verified),
    'hospitals_unverified', (select count(*) from hospitals where not verified),
    'teams_active', (select count(*) from groups where status = 'approved'),
    'median_hours_to_fill', (select round((percentile_cont(0.5) within group (
          order by extract(epoch from b.created_at - s.created_at) / 3600))::numeric, 1)
        from bookings b join shifts s on s.id = b.shift_id
        where b.cancelled_at is null and b.created_at >= since),
    'cities', coalesce((
      select jsonb_agg(jsonb_build_object('city', city, 'shifts', n) order by n desc)
      from (select h.city, count(*) as n from shifts s join hospitals h on h.id = s.hospital_id
            where s.created_at >= since group by h.city order by n desc limit 6) c), '[]'::jsonb)
  );
end $$;
revoke execute on function public.admin_growth_summary(int) from public, anon;
grant execute on function public.admin_growth_summary(int) to authenticated, service_role;
