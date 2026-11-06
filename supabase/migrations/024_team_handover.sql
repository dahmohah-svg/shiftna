-- 024: case handover inside a team (free).
-- At the end of a duty a doctor writes a handover for each patient (name,
-- age, bed, diagnosis, condition, pending tasks, notes), optionally to the
-- colleague who takes over. That colleague taps "received"; anyone in the
-- team, supervisors included, can comment; the author or a manager or
-- supervisor closes the case. Only active members of the team can read it.

create table if not exists public.team_handovers (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  to_doctor_id uuid references public.profiles (id) on delete set null,
  patient text not null check (char_length(patient) between 1 and 120),
  age integer check (age between 0 and 130),
  bed text check (char_length(bed) <= 40),
  diagnosis text check (char_length(diagnosis) <= 300),
  condition text not null default 'stable' check (condition in ('stable', 'watch', 'critical')),
  tasks text check (char_length(tasks) <= 2000),
  notes text check (char_length(notes) <= 2000),
  received_by uuid references public.profiles (id) on delete set null,
  received_at timestamptz,
  closed_by uuid references public.profiles (id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists team_handovers_group_idx on public.team_handovers (group_id, created_at desc);

create table if not exists public.handover_comments (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.team_handovers (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists handover_comments_idx on public.handover_comments (handover_id, created_at);

alter table public.team_handovers enable row level security;
drop policy if exists "team read handovers" on public.team_handovers;
create policy "team read handovers" on public.team_handovers for select using (is_group_member(group_id));
drop policy if exists "members write handovers" on public.team_handovers;
create policy "members write handovers" on public.team_handovers for insert with check (
  is_group_member(group_id) and author_id = auth.uid()
  and received_by is null and closed_at is null
  and (to_doctor_id is null or exists (select 1 from group_members m where m.group_id = team_handovers.group_id
                                       and m.user_id = team_handovers.to_doctor_id and m.status = 'active')));

alter table public.handover_comments enable row level security;
drop policy if exists "team read handover comments" on public.handover_comments;
create policy "team read handover comments" on public.handover_comments for select using (
  exists (select 1 from team_handovers h where h.id = handover_comments.handover_id and is_group_member(h.group_id)));
drop policy if exists "members comment on handovers" on public.handover_comments;
create policy "members comment on handovers" on public.handover_comments for insert with check (
  author_id = auth.uid()
  and exists (select 1 from team_handovers h where h.id = handover_comments.handover_id and is_group_member(h.group_id)));

-- New handover: tell the colleague it's addressed to.
create or replace function public.notify_handover()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.to_doctor_id is not null then
    perform notify(new.to_doctor_id, 'handover_new', jsonb_build_object(
      'team_id', new.group_id, 'team', (select name from groups where id = new.group_id),
      'handover_id', new.id, 'title', new.patient,
      'doctor', (select full_name from profiles where id = new.author_id)));
  end if;
  return null;
end $$;
revoke execute on function public.notify_handover() from public, anon, authenticated;
drop trigger if exists team_handovers_notify on public.team_handovers;
create trigger team_handovers_notify after insert on public.team_handovers
  for each row execute function public.notify_handover();

-- New comment: tell the author and the receiving doctor (not the commenter).
create or replace function public.notify_handover_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare h team_handovers; payload jsonb;
begin
  select * into h from team_handovers where id = new.handover_id;
  payload := jsonb_build_object('team_id', h.group_id, 'team', (select name from groups where id = h.group_id),
    'handover_id', h.id, 'title', h.patient, 'sender', (select full_name from profiles where id = new.author_id));
  perform notify(h.author_id, 'handover_comment', payload);
  if coalesce(h.received_by, h.to_doctor_id) is distinct from h.author_id then
    perform notify(coalesce(h.received_by, h.to_doctor_id), 'handover_comment', payload);
  end if;
  return null;
end $$;
revoke execute on function public.notify_handover_comment() from public, anon, authenticated;
drop trigger if exists handover_comments_notify on public.handover_comments;
create trigger handover_comments_notify after insert on public.handover_comments
  for each row execute function public.notify_handover_comment();

-- "Received": any team member except the author takes the handover.
create or replace function public.receive_handover(p_handover uuid)
returns void language plpgsql security definer set search_path = public as $$
declare h team_handovers;
begin
  select * into h from team_handovers where id = p_handover for update;
  if h.id is null or not is_group_member(h.group_id) or h.author_id = auth.uid() then raise exception 'Not allowed'; end if;
  if h.received_by is not null then raise exception 'This handover was already received'; end if;
  update team_handovers set received_by = auth.uid(), received_at = now() where id = h.id;
  perform notify(h.author_id, 'handover_received', jsonb_build_object(
    'team_id', h.group_id, 'team', (select name from groups where id = h.group_id),
    'handover_id', h.id, 'title', h.patient, 'doctor', (select full_name from profiles where id = auth.uid())));
end $$;

-- Close (discharged / resolved) or reopen: the author, managers and supervisors.
create or replace function public.close_handover(p_handover uuid, p_close boolean)
returns void language plpgsql security definer set search_path = public as $$
declare h team_handovers;
begin
  select * into h from team_handovers where id = p_handover for update;
  if h.id is null or not (h.author_id = auth.uid() or can_edit_rota(h.group_id)) or not is_group_member(h.group_id) then
    raise exception 'Not allowed';
  end if;
  update team_handovers
  set closed_by = case when p_close then auth.uid() end, closed_at = case when p_close then now() end
  where id = h.id;
end $$;

revoke execute on function public.receive_handover(uuid) from public, anon;
revoke execute on function public.close_handover(uuid, boolean) from public, anon;
grant execute on function public.receive_handover(uuid) to authenticated;
grant execute on function public.close_handover(uuid, boolean) to authenticated;
