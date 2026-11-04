-- Daily jobs (needs pg_cron: Supabase Dashboard > Database > Extensions)
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('lapse-expired-users', '10 1 * * *', $$select public.lapse_expired_users()$$);
select cron.schedule('expiry-reminders', '20 1 * * *', $$select public.queue_expiry_reminders()$$);
