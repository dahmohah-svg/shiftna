-- 006: only signed-in users can call app functions; trigger functions can't be called directly.

-- 1) Trigger functions: nobody calls these through the API (triggers still fire normally).
revoke execute on function
  public.block_overlapping_offer(), public.handle_new_user(), public.log_completed_shift(),
  public.notify_urgent_reopen(), public.protect_booking_columns(), public.protect_profile_columns(),
  public.reveal_ratings()
from public, anon, authenticated;

-- 2) App functions: signed-in users only. Each function still checks who is calling.
do $$
declare f text;
begin
  foreach f in array array[
    'public.accept_offer(uuid)',
    'public.admin_resolve_dispute(uuid, text, text, boolean)',
    'public.admin_review_document(uuid, boolean, text, date)',
    'public.admin_review_group(uuid, boolean, text)',
    'public.cancel_booking(uuid, text)',
    'public.confirm_arrival(uuid)',
    'public.create_group(text, text, uuid, text, text)',
    'public.decide_member(uuid, uuid, boolean)',
    'public.doctor_has_overlap(uuid, uuid)',
    'public.doctor_stats(uuid)',
    'public.doctor_trust(uuid)',
    'public.fatigue_check(uuid)',
    'public.generate_rota(uuid, date, date)',
    'public.hospital_report(uuid, date)',
    'public.instant_book(uuid)',
    'public.invite_doctor(uuid, uuid)',
    'public.is_premium()',
    'public.leave_group(uuid)',
    'public.my_duty_hours(date, date)',
    'public.my_pending_requests()',
    'public.open_dispute(uuid, public.dispute_kind, text)',
    'public.pay_benchmark(text, public.shift_type, public.subspecialty)',
    'public.request_to_join(text, text)',
    'public.roster(uuid, date, date)',
    'public.rotate_invite_code(uuid)',
    'public.suggest_doctors_for_shift(uuid, integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- 3) Shared shift links show a short preview to people who aren't signed in.
grant execute on function public.shift_teaser(text) to anon, authenticated, service_role;

-- 4) Kept as they are on purpose: is_admin, is_approved, is_booking_party, is_group_manager,
--    is_group_member, grade_rank. Security rules call them; for someone not signed in they
--    return false, so outsiders get empty results instead of errors.

-- 5) New functions created later start closed to the public.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
