-- 023: team rota, supervisors and swaps (free for every team).
-- A team (department) keeps a monthly duty rota: who is on day, night,
-- 24-hour or on-call duty each day. Team managers and supervisors build it.
-- The team owner can make members supervisors (usually the consultant).
-- When a team has a supervisor, a manager's rota goes to the supervisor for
-- approval before members see it; a supervisor can publish directly.
-- Members can ask a colleague to swap a duty or cover it; once the colleague
-- agrees, a supervisor (or a manager when there is none) approves it and the
-- rota updates. Every change is kept in the rota history.

-- 1. Supervisors.
alter table public.group_members add column if not exists supervisor boolean not null default false;

create or replace function public.is_team_supervisor(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members m join groups g on g.id = m.group_id
    where m.group_id = p_group and m.user_id = auth.uid()
      and m.status = 'active' and m.supervisor and g.status = 'approved')
$$;

-- Managers and supervisors edit the rota.
create or replace function public.can_edit_rota(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_group_manager(p_group) or is_team_supervisor(p_group)
$$;

create or replace function public.team_has_supervisor(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = p_group and status = 'active' and supervisor)
$$;

create or replace function public.set_team_supervisor(p_group uuid, p_user uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if not exists (select 1 from group_members where group_id = p_group and user_id = auth.uid()
                 and status = 'active' and role = 'owner') then
    raise exception 'Not allowed';
  end if;
  update group_members set supervisor = p_on
  where group_id = p_group and user_id = p_user and status = 'active';
  if not found then raise exception 'Not a team member'; end if;
  select * into g from groups where id = p_group;
  if p_on then
    perform notify(p_user, 'team_supervisor', jsonb_build_object('team_id', p_group, 'team', g.name));
  end if;
end $$;

-- 2. Duties and months.
create table if not exists public.team_duties (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  duty_date date not null,
  slot text not null check (slot in ('day', 'night', 'full', 'on_call')),
  doctor_id uuid not null references public.profiles (id) on delete cascade,
  note text check (char_length(note) <= 200),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, duty_date, slot, doctor_id)
);
create index if not exists team_duties_group_date_idx on public.team_duties (group_id, duty_date);
create index if not exists team_duties_doctor_idx on public.team_duties (doctor_id, duty_date);

create table if not exists public.team_rota_months (
  group_id uuid not null references public.groups (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  status text not null default 'draft' check (status in ('draft', 'pending', 'published')),
  submitted_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  return_note text check (char_length(return_note) <= 300),
  primary key (group_id, month)
);

create or replace function public.rota_published(p_group uuid, p_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_rota_months
                 where group_id = p_group and month = date_trunc('month', p_date)::date and status = 'published')
$$;

alter table public.team_duties enable row level security;
drop policy if exists "team read duties" on public.team_duties;
create policy "team read duties" on public.team_duties for select using (
  is_admin() or (is_group_member(group_id) and (can_edit_rota(group_id) or rota_published(group_id, duty_date))));
drop policy if exists "editors add duties" on public.team_duties;
create policy "editors add duties" on public.team_duties for insert with check (
  can_edit_rota(group_id) and created_by = auth.uid()
  and exists (select 1 from group_members m where m.group_id = team_duties.group_id
              and m.user_id = team_duties.doctor_id and m.status = 'active'));
drop policy if exists "editors remove duties" on public.team_duties;
create policy "editors remove duties" on public.team_duties for delete using (can_edit_rota(group_id));

alter table public.team_rota_months enable row level security;
drop policy if exists "team read rota months" on public.team_rota_months;
create policy "team read rota months" on public.team_rota_months for select
  using (is_admin() or is_group_member(group_id));

-- 3. History.
create table if not exists public.team_rota_log (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  duty_date date,
  slot text,
  doctor_id uuid references public.profiles (id) on delete set null,
  other_doctor_id uuid references public.profiles (id) on delete set null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists team_rota_log_group_idx on public.team_rota_log (group_id, created_at desc);
alter table public.team_rota_log enable row level security;
drop policy if exists "team read rota log" on public.team_rota_log;
create policy "team read rota log" on public.team_rota_log for select
  using (is_admin() or can_edit_rota(group_id));

create or replace function public.log_team_duty()
returns trigger language plpgsql security definer set search_path = public as $$
declare r team_duties; g groups;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  -- Swaps log themselves (see decide_swap).
  if current_setting('shiftna.swap', true) = 'on' then return null; end if;
  insert into team_rota_log (group_id, actor_id, action, duty_date, slot, doctor_id)
  values (r.group_id, auth.uid(), case when tg_op = 'DELETE' then 'removed' else 'added' end, r.duty_date, r.slot, r.doctor_id);
  -- Changes to a published rota are announced to the doctor concerned.
  if rota_published(r.group_id, r.duty_date) and r.doctor_id is distinct from auth.uid() then
    select * into g from groups where id = r.group_id;
    perform notify(r.doctor_id, 'rota_changed', jsonb_build_object(
      'team_id', r.group_id, 'team', g.name, 'date', r.duty_date, 'slot', r.slot,
      'change', case when tg_op = 'DELETE' then 'removed' else 'added' end));
  end if;
  return null;
end $$;
drop trigger if exists team_duties_log on public.team_duties;
create trigger team_duties_log after insert or delete on public.team_duties
  for each row execute function public.log_team_duty();

-- 4. Publishing a month.
create or replace function public.submit_rota(p_group uuid, p_month date)
returns text language plpgsql security definer set search_path = public as $$
declare m date := date_trunc('month', p_month)::date; g groups; st text; sup boolean;
begin
  if not can_edit_rota(p_group) then raise exception 'Not allowed'; end if;
  select * into g from groups where id = p_group;
  sup := is_team_supervisor(p_group);
  st := case when sup or not team_has_supervisor(p_group) then 'published' else 'pending' end;
  insert into team_rota_months (group_id, month, status, submitted_by, submitted_at, approved_by, approved_at, return_note)
  values (p_group, m, st, auth.uid(), now(), case when st = 'published' then auth.uid() end,
          case when st = 'published' then now() end, null)
  on conflict (group_id, month) do update set
    status = excluded.status, submitted_by = excluded.submitted_by, submitted_at = excluded.submitted_at,
    approved_by = excluded.approved_by, approved_at = excluded.approved_at, return_note = null;
  insert into team_rota_log (group_id, actor_id, action, duty_date)
  values (p_group, auth.uid(), case when st = 'published' then 'published' else 'submitted' end, m);
  if st = 'pending' then
    insert into notifications (user_id, kind, payload)
    select m2.user_id, 'rota_pending', jsonb_build_object('team_id', p_group, 'team', g.name, 'month', m,
           'doctor', (select full_name from profiles where id = auth.uid()))
    from group_members m2 where m2.group_id = p_group and m2.status = 'active' and m2.supervisor and m2.user_id <> auth.uid();
  else
    insert into notifications (user_id, kind, payload)
    select m2.user_id, 'rota_published', jsonb_build_object('team_id', p_group, 'team', g.name, 'month', m)
    from group_members m2 where m2.group_id = p_group and m2.status = 'active' and m2.user_id <> auth.uid();
  end if;
  return st;
end $$;

create or replace function public.decide_rota(p_group uuid, p_month date, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare m date := date_trunc('month', p_month)::date; r team_rota_months; g groups;
begin
  if not is_team_supervisor(p_group) then raise exception 'Not allowed'; end if;
  select * into r from team_rota_months where group_id = p_group and month = m for update;
  if r.group_id is null or r.status <> 'pending' then raise exception 'This rota is not waiting for approval'; end if;
  select * into g from groups where id = p_group;
  if p_approve then
    update team_rota_months set status = 'published', approved_by = auth.uid(), approved_at = now()
    where group_id = p_group and month = m;
    insert into team_rota_log (group_id, actor_id, action, duty_date) values (p_group, auth.uid(), 'approved', m);
    insert into notifications (user_id, kind, payload)
    select m2.user_id, 'rota_published', jsonb_build_object('team_id', p_group, 'team', g.name, 'month', m)
    from group_members m2 where m2.group_id = p_group and m2.status = 'active' and m2.user_id <> auth.uid();
  else
    update team_rota_months set status = 'draft', return_note = nullif(trim(p_note), '')
    where group_id = p_group and month = m;
    insert into team_rota_log (group_id, actor_id, action, duty_date, detail)
    values (p_group, auth.uid(), 'returned', m, nullif(trim(p_note), ''));
    perform notify(r.submitted_by, 'rota_returned', jsonb_build_object(
      'team_id', p_group, 'team', g.name, 'month', m, 'reason', coalesce(nullif(trim(p_note), ''), '—')));
  end if;
end $$;

-- 5. Swaps.
create table if not exists public.rota_swaps (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  requester_duty_id uuid not null references public.team_duties (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  -- Null when the colleague is asked to cover the duty rather than swap.
  target_duty_id uuid references public.team_duties (id) on delete cascade,
  note text check (char_length(note) <= 300),
  status text not null default 'asked' check (status in ('asked', 'accepted', 'approved', 'declined', 'rejected', 'cancelled')),
  decided_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  decided_at timestamptz
);
create index if not exists rota_swaps_group_idx on public.rota_swaps (group_id, created_at desc);
alter table public.rota_swaps enable row level security;
drop policy if exists "read swaps" on public.rota_swaps;
create policy "read swaps" on public.rota_swaps for select using (
  is_admin() or requester_id = auth.uid() or target_id = auth.uid() or can_edit_rota(group_id));

create or replace function public.swap_payload(s rota_swaps)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'team_id', s.group_id, 'team', (select name from groups where id = s.group_id),
    'date', (select duty_date from team_duties where id = s.requester_duty_id),
    'slot', (select slot from team_duties where id = s.requester_duty_id),
    'month', (select date_trunc('month', duty_date)::date from team_duties where id = s.requester_duty_id),
    'doctor', (select full_name from profiles where id = s.requester_id),
    'sender', (select full_name from profiles where id = s.target_id))
$$;
revoke execute on function public.swap_payload(rota_swaps) from public, anon, authenticated;

create or replace function public.request_swap(p_duty uuid, p_target uuid, p_target_duty uuid, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare d team_duties; td team_duties; s rota_swaps; today date := (now() at time zone 'Africa/Cairo')::date;
begin
  select * into d from team_duties where id = p_duty;
  if d.id is null or d.doctor_id <> auth.uid() then raise exception 'Not allowed'; end if;
  if not is_group_member(d.group_id) or not rota_published(d.group_id, d.duty_date) then raise exception 'Not allowed'; end if;
  if d.duty_date < today then raise exception 'This duty has already passed'; end if;
  if p_target = auth.uid() or not exists (select 1 from group_members where group_id = d.group_id and user_id = p_target and status = 'active') then
    raise exception 'Choose a colleague from this team';
  end if;
  if p_target_duty is not null then
    select * into td from team_duties where id = p_target_duty;
    if td.id is null or td.group_id <> d.group_id or td.doctor_id <> p_target or td.duty_date < today then
      raise exception 'Choose one of your colleague''s coming duties';
    end if;
  end if;
  if exists (select 1 from rota_swaps where requester_duty_id = p_duty and status in ('asked', 'accepted')) then
    raise exception 'You already asked to swap this duty';
  end if;
  insert into rota_swaps (group_id, requester_id, requester_duty_id, target_id, target_duty_id, note)
  values (d.group_id, auth.uid(), p_duty, p_target, p_target_duty, nullif(trim(p_note), ''))
  returning * into s;
  perform notify(p_target, 'swap_request', swap_payload(s));
  return s.id;
end $$;

create or replace function public.answer_swap(p_swap uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare s rota_swaps; sup boolean;
begin
  select * into s from rota_swaps where id = p_swap for update;
  if s.id is null or s.target_id <> auth.uid() then raise exception 'Not allowed'; end if;
  if s.status <> 'asked' then raise exception 'This request was already answered'; end if;
  if not p_accept then
    update rota_swaps set status = 'declined', answered_at = now() where id = s.id;
    perform notify(s.requester_id, 'swap_declined', swap_payload(s));
    return;
  end if;
  update rota_swaps set status = 'accepted', answered_at = now() where id = s.id;
  -- Supervisors approve; teams without one are approved by their managers.
  sup := team_has_supervisor(s.group_id);
  insert into notifications (user_id, kind, payload)
  select m.user_id, 'swap_needs_approval', swap_payload(s)
  from group_members m
  where m.group_id = s.group_id and m.status = 'active'
    and (case when sup then m.supervisor else m.role in ('owner', 'moderator') end)
  limit 20;
end $$;

create or replace function public.decide_swap(p_swap uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare s rota_swaps; d team_duties; td team_duties;
begin
  select * into s from rota_swaps where id = p_swap for update;
  if s.id is null then raise exception 'Not allowed'; end if;
  if not (case when team_has_supervisor(s.group_id) then is_team_supervisor(s.group_id) else is_group_manager(s.group_id) end) then
    raise exception 'Not allowed';
  end if;
  if s.status <> 'accepted' then raise exception 'This request is not waiting for approval'; end if;
  if not p_approve then
    update rota_swaps set status = 'rejected', decided_by = auth.uid(), decided_at = now() where id = s.id;
    perform notify(s.requester_id, 'swap_rejected', swap_payload(s));
    perform notify(s.target_id, 'swap_rejected', swap_payload(s));
    return;
  end if;
  select * into d from team_duties where id = s.requester_duty_id for update;
  if d.id is null or d.doctor_id <> s.requester_id then raise exception 'The rota changed; ask again'; end if;
  if s.target_duty_id is not null then
    select * into td from team_duties where id = s.target_duty_id for update;
    if td.id is null or td.doctor_id <> s.target_id then raise exception 'The rota changed; ask again'; end if;
  end if;
  if exists (select 1 from team_duties where group_id = d.group_id and duty_date = d.duty_date and slot = d.slot
             and doctor_id = s.target_id)
     or (td.id is not null and exists (select 1 from team_duties where group_id = td.group_id and duty_date = td.duty_date
             and slot = td.slot and doctor_id = s.requester_id)) then
    raise exception 'The rota changed; ask again';
  end if;
  perform set_config('shiftna.swap', 'on', true);
  update team_duties set doctor_id = s.target_id where id = d.id;
  if td.id is not null then update team_duties set doctor_id = s.requester_id where id = td.id; end if;
  perform set_config('shiftna.swap', 'off', true);
  insert into team_rota_log (group_id, actor_id, action, duty_date, slot, doctor_id, other_doctor_id, detail)
  values (s.group_id, auth.uid(), case when td.id is null then 'covered' else 'swapped' end, d.duty_date, d.slot,
          s.requester_id, s.target_id,
          case when td.id is not null then to_char(td.duty_date, 'YYYY-MM-DD') || ' ' || td.slot end);
  update rota_swaps set status = 'approved', decided_by = auth.uid(), decided_at = now() where id = s.id;
  perform notify(s.requester_id, 'swap_approved', swap_payload(s));
  perform notify(s.target_id, 'swap_approved', swap_payload(s));
end $$;

create or replace function public.cancel_swap(p_swap uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update rota_swaps set status = 'cancelled', decided_at = now()
  where id = p_swap and requester_id = auth.uid() and status in ('asked', 'accepted');
  if not found then raise exception 'Not allowed'; end if;
end $$;

-- The duty update in decide_swap runs as the function owner, so team_duties
-- needs no update policy for members.

revoke execute on function public.is_team_supervisor(uuid) from public, anon;
revoke execute on function public.can_edit_rota(uuid) from public, anon;
revoke execute on function public.team_has_supervisor(uuid) from public, anon;
revoke execute on function public.rota_published(uuid, date) from public, anon;
revoke execute on function public.set_team_supervisor(uuid, uuid, boolean) from public, anon;
revoke execute on function public.submit_rota(uuid, date) from public, anon;
revoke execute on function public.decide_rota(uuid, date, boolean, text) from public, anon;
revoke execute on function public.request_swap(uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.answer_swap(uuid, boolean) from public, anon;
revoke execute on function public.decide_swap(uuid, boolean) from public, anon;
revoke execute on function public.cancel_swap(uuid) from public, anon;
revoke execute on function public.log_team_duty() from public, anon, authenticated;
grant execute on function public.is_team_supervisor(uuid) to authenticated;
grant execute on function public.can_edit_rota(uuid) to authenticated;
grant execute on function public.team_has_supervisor(uuid) to authenticated;
grant execute on function public.rota_published(uuid, date) to authenticated;
grant execute on function public.set_team_supervisor(uuid, uuid, boolean) to authenticated;
grant execute on function public.submit_rota(uuid, date) to authenticated;
grant execute on function public.decide_rota(uuid, date, boolean, text) to authenticated;
grant execute on function public.request_swap(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.answer_swap(uuid, boolean) to authenticated;
grant execute on function public.decide_swap(uuid, boolean) to authenticated;
grant execute on function public.cancel_swap(uuid) to authenticated;
