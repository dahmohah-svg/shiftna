-- 025: logbook sign-off by the team's supervisor (free).
-- Doctors (mostly residents) keep a training logbook: date, procedure or
-- activity, sub-specialty, number of cases, their role, hours and a note.
-- They send entries to a team they belong to; the team's supervisor (the
-- consultant) signs them or returns them with a note. Signed entries are
-- locked. Entries made automatically from completed Shiftna shifts stay
-- "verified" as before.

alter table public.logbook_entries add column if not exists procedure text;
alter table public.logbook_entries add column if not exists role text;
alter table public.logbook_entries add column if not exists sign_team_id uuid references public.groups (id) on delete set null;
alter table public.logbook_entries add column if not exists sign_status text not null default 'none';
alter table public.logbook_entries add column if not exists signed_by uuid references public.profiles (id) on delete set null;
alter table public.logbook_entries add column if not exists signed_at timestamptz;
alter table public.logbook_entries add column if not exists sign_note text;
alter table public.logbook_entries drop constraint if exists logbook_entries_signoff_check;
alter table public.logbook_entries add constraint logbook_entries_signoff_check check (
  sign_status in ('none', 'requested', 'signed', 'returned')
  and (role is null or role in ('observed', 'assisted', 'performed', 'supervised'))
  and coalesce(char_length(procedure), 0) <= 120
  and coalesce(char_length(sign_note), 0) <= 300);
create index if not exists logbook_sign_team_idx on public.logbook_entries (sign_team_id, sign_status);

-- Sign-off columns change only through the functions below.
create or replace function public.protect_logbook_signoff()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('shiftna.logbook', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    new.sign_team_id := null; new.sign_status := 'none'; new.signed_by := null; new.signed_at := null; new.sign_note := null;
  else
    new.sign_team_id := old.sign_team_id; new.sign_status := old.sign_status; new.signed_by := old.signed_by;
    new.signed_at := old.signed_at; new.sign_note := old.sign_note;
  end if;
  return new;
end $$;
revoke execute on function public.protect_logbook_signoff() from public, anon, authenticated;
drop trigger if exists logbook_protect_signoff on public.logbook_entries;
create trigger logbook_protect_signoff before insert or update on public.logbook_entries
  for each row execute function public.protect_logbook_signoff();

-- Signed entries are locked like verified ones; supervisors read what was sent to them.
drop policy if exists "edit own unverified entry" on public.logbook_entries;
create policy "edit own unverified entry" on public.logbook_entries for update
  using (user_id = auth.uid() and verified = false and signed_by is null)
  with check (user_id = auth.uid() and verified = false);
drop policy if exists "delete own unverified entry" on public.logbook_entries;
create policy "delete own unverified entry" on public.logbook_entries for delete
  using (user_id = auth.uid() and verified = false and signed_by is null);
drop policy if exists "read own logbook" on public.logbook_entries;
create policy "read own logbook" on public.logbook_entries for select using (
  user_id = auth.uid() or is_admin()
  or (sign_team_id is not null and is_team_supervisor(sign_team_id)));

-- Send entries for sign-off to one of my teams that has a supervisor.
create or replace function public.request_logbook_signoff(p_entries uuid[], p_team uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not is_group_member(p_team) then raise exception 'Not allowed'; end if;
  if not team_has_supervisor(p_team) then raise exception 'This team has no supervisor yet'; end if;
  perform set_config('shiftna.logbook', 'on', true);
  update logbook_entries set sign_team_id = p_team, sign_status = 'requested', sign_note = null
  where id = any(p_entries) and user_id = auth.uid() and verified = false and signed_by is null;
  get diagnostics n = row_count;
  perform set_config('shiftna.logbook', 'off', true);
  if n > 0 then
    insert into notifications (user_id, kind, payload)
    select m.user_id, 'logbook_request', jsonb_build_object(
      'team_id', p_team, 'team', (select name from groups where id = p_team),
      'doctor', (select full_name from profiles where id = auth.uid()), 'count', n::text)
    from group_members m
    where m.group_id = p_team and m.status = 'active' and m.supervisor and m.user_id <> auth.uid();
  end if;
  return n;
end $$;

-- Supervisor: sign entries, or return them with a note.
create or replace function public.sign_logbook_entries(p_entries uuid[], p_sign boolean, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer; r record;
begin
  perform set_config('shiftna.logbook', 'on', true);
  for r in
    select e.user_id, e.sign_team_id, count(*) c from logbook_entries e
    where e.id = any(p_entries) and e.sign_status = 'requested' and e.user_id <> auth.uid()
      and is_team_supervisor(e.sign_team_id)
    group by e.user_id, e.sign_team_id
  loop
    perform notify(r.user_id, case when p_sign then 'logbook_signed' else 'logbook_returned' end, jsonb_build_object(
      'team_id', r.sign_team_id, 'team', (select name from groups where id = r.sign_team_id),
      'doctor', (select full_name from profiles where id = auth.uid()), 'count', r.c::text,
      'reason', coalesce(nullif(trim(p_note), ''), '—')));
  end loop;
  update logbook_entries e set
    sign_status = case when p_sign then 'signed' else 'returned' end,
    signed_by = case when p_sign then auth.uid() end,
    signed_at = case when p_sign then now() end,
    sign_note = nullif(trim(p_note), '')
  where e.id = any(p_entries) and e.sign_status = 'requested' and e.user_id <> auth.uid()
    and is_team_supervisor(e.sign_team_id);
  get diagnostics n = row_count;
  perform set_config('shiftna.logbook', 'off', true);
  if n = 0 then raise exception 'Not allowed'; end if;
  return n;
end $$;

revoke execute on function public.request_logbook_signoff(uuid[], uuid) from public, anon;
revoke execute on function public.sign_logbook_entries(uuid[], boolean, text) from public, anon;
grant execute on function public.request_logbook_signoff(uuid[], uuid) to authenticated;
grant execute on function public.sign_logbook_entries(uuid[], boolean, text) to authenticated;
