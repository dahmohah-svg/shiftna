-- 017: teams work straight away; the admin verifies or pauses them later.
-- A new team is active at once and shows "Unverified team" until the admin
-- checks it. The proof file is optional. The admin can verify, remove
-- verification, pause (the team stops working at once) or resume a team.

alter table public.groups add column if not exists verified boolean not null default false;

-- Teams that were waiting for review before this change become active.
update public.groups set status = 'approved' where status = 'pending';

create or replace function public.create_group(p_name text, p_institution text, p_hospital uuid, p_description text, p_proof_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if not is_approved() then raise exception 'Your account is not approved'; end if;
  if not is_premium() then raise exception 'Creating a private group needs Premium'; end if;
  if (select count(*) from groups where created_by = auth.uid() and status in ('pending','approved'))
       >= (select max_groups from profiles where id = auth.uid()) then
    raise exception 'Your plan does not allow more groups';
  end if;
  insert into groups (name, institution, hospital_id, description, proof_path, created_by, status, verified)
    values (p_name, p_institution, p_hospital, nullif(p_description, ''), nullif(p_proof_path, ''), auth.uid(), 'approved', false)
    returning id into g;
  insert into group_members (group_id, user_id, role, status, decided_at)
    values (g, auth.uid(), 'owner', 'active', now());
  insert into group_invites (group_id) values (g);
  return g;
end $$;

-- Admin: verify / unverify / pause / resume a team, written to the audit log.
create or replace function public.admin_set_team(p_group uuid, p_action text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  if p_action = 'verify' then
    update groups set verified = true, reviewed_by = auth.uid(), reviewed_at = now() where id = p_group;
  elsif p_action = 'unverify' then
    update groups set verified = false, reviewed_by = auth.uid(), reviewed_at = now() where id = p_group;
  elsif p_action = 'pause' then
    update groups set status = 'suspended', reject_reason = p_reason, reviewed_by = auth.uid(), reviewed_at = now() where id = p_group;
  elsif p_action = 'resume' then
    update groups set status = 'approved', reject_reason = null, reviewed_by = auth.uid(), reviewed_at = now() where id = p_group;
  else
    raise exception 'Unknown action';
  end if;
  if not found then raise exception 'Team not found'; end if;
  insert into audit_log (admin_id, action, target_table, target_id, detail)
    values (auth.uid(), 'team_' || p_action, 'groups', p_group, p_reason);
end $$;
revoke execute on function public.admin_set_team(uuid, text, text) from public, anon;
grant execute on function public.admin_set_team(uuid, text, text) to authenticated, service_role;

-- Alerts: new team -> admins; verified / paused / resumed -> the creator.
create or replace function public.notify_team_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, kind, payload)
  select p.id, 'team_created',
         jsonb_build_object('team_id', new.id, 'team', new.name,
           'doctor', (select full_name from profiles where id = new.created_by))
  from profiles p
  where p.is_admin and p.id <> new.created_by;
  return null;
end $$;
drop trigger if exists groups_notify_created on public.groups;
create trigger groups_notify_created after insert on public.groups
  for each row execute function public.notify_team_created();

create or replace function public.notify_team_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare payload jsonb := jsonb_build_object('team_id', new.id, 'team', new.name, 'reason', new.reject_reason);
begin
  if new.verified and not old.verified then
    perform notify(new.created_by, 'team_verified', payload);
  end if;
  if new.status is distinct from old.status then
    if new.status = 'suspended' then
      perform notify(new.created_by, 'team_paused', payload);
    elsif new.status = 'approved' and old.status = 'suspended' then
      perform notify(new.created_by, 'team_resumed', payload);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists groups_notify_review on public.groups;
create trigger groups_notify_review after update of status, verified on public.groups
  for each row execute function public.notify_team_review();

revoke execute on function public.notify_team_created() from public, anon, authenticated;
revoke execute on function public.notify_team_review() from public, anon, authenticated;
