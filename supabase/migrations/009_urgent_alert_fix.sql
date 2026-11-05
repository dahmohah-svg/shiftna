-- 009: urgent "needs cover" alerts.
-- Never alert the doctor who just cancelled the shift, and store hospital
-- and start time in the alert like the other notifications do.
create or replace function public.notify_urgent_reopen()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'open' and new.urgent and old.status = 'filled' then
    insert into notifications (user_id, kind, payload)
    select c.doctor_id, 'urgent_shift', shift_brief(new.id)
    from candidate_doctors(new.id) c
    where c.doctor_id is distinct from auth.uid()
    order by c.has_availability desc, c.avg_rating desc nulls last
    limit 10;
  end if;
  return null;
end $$;
revoke execute on function public.notify_urgent_reopen() from public, anon, authenticated;
