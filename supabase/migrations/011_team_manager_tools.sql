-- 011: team manager tools.
-- 1. Leaving records who decided (the doctor themself), so a doctor who
--    left can be told apart from one removed or declined by a manager.
-- 2. Managers can renew the invite code (the old code stops working).
-- 3. Managers can re-add a doctor they removed or declined.
-- 4. Managers can let a doctor who left ask to join again (not re-add them).
-- 5. Accepting only works on pending requests.

create or replace function public.leave_group(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update group_members set status = 'removed', decided_by = auth.uid(), decided_at = now()
  where group_id = p_group and user_id = auth.uid() and role = 'member';
end $$;

-- Accept only pending requests; decline or remove only pending or active
-- members. (Before, accepting could also pull back a doctor who had left.)
create or replace function public.decide_member(p_group uuid, p_user uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_group_manager(p_group) then raise exception 'Not allowed'; end if;
  update group_members set
    status = case when p_accept then 'active' else 'removed' end::member_status,
    decided_by = auth.uid(), decided_at = now()
  where group_id = p_group and user_id = p_user and role = 'member'
    and (case when p_accept then status = 'pending' else status in ('pending', 'active') end);
end $$;
revoke execute on function public.decide_member(uuid, uuid, boolean) from public, anon;
grant execute on function public.decide_member(uuid, uuid, boolean) to authenticated, service_role;

create or replace function public.renew_invite_code(p_group uuid)
returns text language plpgsql security definer set search_path = public as $$
declare new_code text;
begin
  if not is_group_manager(p_group) then raise exception 'Not allowed'; end if;
  new_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into group_invites (group_id, code) values (p_group, new_code)
    on conflict (group_id) do update set code = excluded.code;
  return new_code;
end $$;

create or replace function public.readd_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_group_manager(p_group) then raise exception 'Not allowed'; end if;
  update group_members set status = 'active', decided_by = auth.uid(), decided_at = now()
  where group_id = p_group and user_id = p_user and role = 'member' and status = 'removed'
    and decided_by is distinct from p_user;
  if not found then raise exception 'Not allowed'; end if;
end $$;

create or replace function public.allow_rejoin(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_group_manager(p_group) then raise exception 'Not allowed'; end if;
  delete from group_members
  where group_id = p_group and user_id = p_user and role = 'member' and status = 'removed';
  if not found then raise exception 'Not allowed'; end if;
end $$;

revoke execute on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated, service_role;
revoke execute on function public.renew_invite_code(uuid) from public, anon;
grant execute on function public.renew_invite_code(uuid) to authenticated, service_role;
revoke execute on function public.readd_member(uuid, uuid) from public, anon;
grant execute on function public.readd_member(uuid, uuid) to authenticated, service_role;
revoke execute on function public.allow_rejoin(uuid, uuid) from public, anon;
grant execute on function public.allow_rejoin(uuid, uuid) to authenticated, service_role;

-- A re-added doctor gets the same "you joined" alert as a newly accepted one.
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
  elsif tg_op = 'UPDATE' and old.status in ('pending', 'removed') and new.status = 'active' then
    perform notify(new.user_id, 'team_joined', jsonb_build_object('team_id', g.id, 'team', g.name));
  end if;
  return null;
end $$;
revoke execute on function public.notify_team_member() from public, anon, authenticated;
