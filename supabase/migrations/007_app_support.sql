-- 007: small additions the app screens need. No existing security rule is changed.

-- 1. The poster can refuse a pending offer on their own open shift.
--    (Before this, only the doctor could change an offer, to withdraw it.)
create or replace function public.refuse_offer(p_offer uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o offers; s shifts;
begin
  select * into o from offers where id = p_offer for update;
  if o.id is null then raise exception 'Offer not found'; end if;
  select * into s from shifts where id = o.shift_id;
  if s.poster_id <> auth.uid() then raise exception 'Not your shift'; end if;
  if o.status <> 'pending' then raise exception 'Offer is not pending'; end if;
  update offers set status = 'refused' where id = p_offer;
end $$;
revoke execute on function public.refuse_offer(uuid) from public, anon;
grant execute on function public.refuse_offer(uuid) to authenticated, service_role;

-- 2. Live chat: send new booking messages to the app in real time.
--    Row Level Security still decides who receives each message.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
