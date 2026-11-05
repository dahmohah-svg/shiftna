-- 018: phone numbers are private (part 1 of 2; part 2 is 019).
-- Before, any approved doctor could read every approved doctor's phone number
-- through the API (the privacy rule covered whole rows, not the phone column).
-- Now no doctor can read profiles.phone directly. contact_phones() returns a
-- number only to: the doctor themself, the admin, or the other doctor in a
-- confirmed booking (until 2 days after the shift ends), and only if that
-- doctor allows it (show_phone, on by default).

alter table public.profiles add column if not exists show_phone boolean not null default true;

create or replace function public.contact_phones(p_ids uuid[])
returns table (user_id uuid, phone text)
language sql stable security definer set search_path = public as $$
  select p.id, p.phone
  from profiles p
  where p.id = any(p_ids)
    and p.phone is not null
    and (
      p.id = auth.uid()
      or is_admin()
      or (p.show_phone and exists (
            select 1 from bookings b join shifts s on s.id = b.shift_id
            where b.cancelled_at is null
              and s.start_at + s.duration_hours * interval '1 hour' + interval '2 days' > now()
              and ((b.doctor_id = auth.uid() and b.poster_id = p.id)
                or (b.poster_id = auth.uid() and b.doctor_id = p.id))))
    )
$$;
revoke execute on function public.contact_phones(uuid[]) from public, anon;
grant execute on function public.contact_phones(uuid[]) to authenticated, service_role;
