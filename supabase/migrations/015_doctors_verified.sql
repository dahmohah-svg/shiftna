-- 015: "Syndicate verified" badge for many doctors at once.
-- A doctor is verified when their Syndicate card, practice license and
-- specialty certificate are all approved and not expired (same rule as
-- doctor_trust). Only says yes or no; no document details are shown.
create or replace function public.doctors_verified(p_ids uuid[])
returns table (doctor_id uuid, verified boolean)
language sql stable security definer set search_path = public as $$
  select p.id,
         (select count(distinct d.type) = 3 from documents d
          where d.user_id = p.id and d.status = 'approved'
            and d.type in ('syndicate_card', 'license', 'certificate')
            and (d.expires_on is null or d.expires_on >= current_date))
  from profiles p
  where p.id = any(p_ids) and (is_approved() or is_admin())
$$;
revoke execute on function public.doctors_verified(uuid[]) from public, anon;
grant execute on function public.doctors_verified(uuid[]) to authenticated, service_role;
