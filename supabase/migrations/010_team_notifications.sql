-- 010: alerts for Teams (the app's name for private groups from 003).
-- No security rule is changed; teams still work only through the 003 functions.

-- Team approved or rejected by the admin -> the doctor who created it.
create or replace function public.notify_team_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform notify(new.created_by,
      case when new.status = 'approved' then 'team_approved' else 'team_rejected' end,
      jsonb_build_object('team_id', new.id, 'team', new.name, 'reason', new.reject_reason));
  end if;
  return null;
end $$;
drop trigger if exists groups_notify_review on public.groups;
create trigger groups_notify_review after update of status on public.groups
  for each row execute function public.notify_team_review();

-- Join request -> the team's managers. Request accepted -> the doctor.
create or replace function public.notify_team_member()
returns trigger language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  select * into g from groups where id = new.group_id;
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into notifications (user_id, kind, payload)
    select m.user_id, 'team_join_request',
           jsonb_build_object('team_id', g.id, 'team', g.name,
             'doctor', (select full_name from profiles where id = new.user_id))
    from group_members m
    where m.group_id = new.group_id and m.status = 'active' and m.role in ('owner', 'moderator')
      and m.user_id <> new.user_id;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'active' then
    perform notify(new.user_id, 'team_joined', jsonb_build_object('team_id', g.id, 'team', g.name));
  end if;
  return null;
end $$;
drop trigger if exists group_members_notify on public.group_members;
create trigger group_members_notify after insert or update of status on public.group_members
  for each row execute function public.notify_team_member();

-- New team shift -> active members who can take it (skipping anyone already
-- alerted for this shift by a saved alert).
create or replace function public.notify_team_shift()
returns trigger language plpgsql security definer set search_path = public as $$
declare g groups; h hospitals;
begin
  if new.group_id is null or new.status <> 'open' then return null; end if;
  select * into g from groups where id = new.group_id;
  select * into h from hospitals where id = new.hospital_id;
  insert into notifications (user_id, kind, payload)
  select m.user_id, 'team_shift',
         jsonb_build_object('shift_id', new.id, 'team_id', g.id, 'team', g.name,
           'hospital', h.name, 'start_at', new.start_at)
  from group_members m
  join profiles p on p.id = m.user_id and p.status = 'approved'
  where m.group_id = new.group_id and m.status = 'active'
    and m.user_id <> new.poster_id
    and grade_rank(p.grade) >= grade_rank(new.min_grade)
    and not exists (select 1 from notifications n
                    where n.user_id = m.user_id and n.payload->>'shift_id' = new.id::text);
  return null;
end $$;
drop trigger if exists shifts_notify_team on public.shifts;
create trigger shifts_notify_team after insert on public.shifts
  for each row execute function public.notify_team_shift();

revoke execute on function public.notify_team_review() from public, anon, authenticated;
revoke execute on function public.notify_team_member() from public, anon, authenticated;
revoke execute on function public.notify_team_shift() from public, anon, authenticated;
