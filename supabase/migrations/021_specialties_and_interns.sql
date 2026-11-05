-- 021: more specialties, and interns.
-- Shiftna was anesthesia only. Now every doctor and every shift has a
-- specialty (anesthesia, internal medicine, emergency, surgery, ICU,
-- pediatrics, OB/GYN, orthopedics, cardiology and more; see SPECIALTIES in
-- src/lib/constants.ts), each with its own sub-specialties. Interns get their own grade
-- (below resident) and their own documents: Syndicate card, internship
-- letter, selfie. A shift allows interns when its minimum grade is "intern".
-- Existing doctors and shifts become "anesthesia". Approved doctors can no
-- longer change their own grade or specialty (the admin can).

-- 1. Sub-specialties for the new specialties (shared ones like general,
--    pediatric, cardiac, neuro, icu and other are reused).
alter type public.subspecialty add value if not exists 'cardiology';
alter type public.subspecialty add value if not exists 'gastroenterology';
alter type public.subspecialty add value if not exists 'nephrology';
alter type public.subspecialty add value if not exists 'dialysis';
alter type public.subspecialty add value if not exists 'endocrinology';
alter type public.subspecialty add value if not exists 'hematology';
alter type public.subspecialty add value if not exists 'rheumatology';
alter type public.subspecialty add value if not exists 'trauma';
alter type public.subspecialty add value if not exists 'laparoscopic';
alter type public.subspecialty add value if not exists 'oncology';
alter type public.subspecialty add value if not exists 'neonatal';
alter type public.subspecialty add value if not exists 'gynecology';
alter type public.subspecialty add value if not exists 'fertility';
alter type public.subspecialty add value if not exists 'spine';
alter type public.subspecialty add value if not exists 'ccu';
alter type public.subspecialty add value if not exists 'cath_lab';
alter type public.subspecialty add value if not exists 'echo';
alter type public.subspecialty add value if not exists 'stroke';
alter type public.subspecialty add value if not exists 'cosmetic';
alter type public.subspecialty add value if not exists 'addiction';
alter type public.subspecialty add value if not exists 'burns';
alter type public.subspecialty add value if not exists 'ultrasound';
alter type public.subspecialty add value if not exists 'ct_mri';
alter type public.subspecialty add value if not exists 'interventional';
alter type public.subspecialty add value if not exists 'blood_bank';
alter type public.subspecialty add value if not exists 'radiotherapy';
alter type public.subspecialty add value if not exists 'hepatology';

-- 2. Interns' document.
alter type public.doc_type add value if not exists 'internship_letter';

-- 3. Specialty on doctors, shifts and saved alerts.
alter table public.profiles add column if not exists specialty text not null default 'anesthesia';
alter table public.shifts add column if not exists specialty text not null default 'anesthesia';
alter table public.saved_alerts add column if not exists specialty text;
alter table public.profiles drop constraint if exists profiles_specialty_check;
alter table public.profiles add constraint profiles_specialty_check
  check (specialty in (
    'anesthesia', 'internal_medicine', 'emergency', 'surgery', 'icu',
    'pediatrics', 'obgyn', 'orthopedics', 'cardiology', 'chest',
    'neurology', 'neurosurgery', 'urology', 'ent', 'ophthalmology',
    'dermatology', 'psychiatry', 'cardiothoracic', 'vascular', 'plastic',
    'oncology', 'radiology', 'clinical_pathology', 'tropical_medicine', 'family_medicine'));
alter table public.shifts drop constraint if exists shifts_specialty_check;
alter table public.shifts add constraint shifts_specialty_check
  check (specialty in (
    'anesthesia', 'internal_medicine', 'emergency', 'surgery', 'icu',
    'pediatrics', 'obgyn', 'orthopedics', 'cardiology', 'chest',
    'neurology', 'neurosurgery', 'urology', 'ent', 'ophthalmology',
    'dermatology', 'psychiatry', 'cardiothoracic', 'vascular', 'plastic',
    'oncology', 'radiology', 'clinical_pathology', 'tropical_medicine', 'family_medicine'));
alter table public.saved_alerts drop constraint if exists saved_alerts_specialty_check;
alter table public.saved_alerts add constraint saved_alerts_specialty_check
  check (specialty is null or specialty in (
    'anesthesia', 'internal_medicine', 'emergency', 'surgery', 'icu',
    'pediatrics', 'obgyn', 'orthopedics', 'cardiology', 'chest',
    'neurology', 'neurosurgery', 'urology', 'ent', 'ophthalmology',
    'dermatology', 'psychiatry', 'cardiothoracic', 'vascular', 'plastic',
    'oncology', 'radiology', 'clinical_pathology', 'tropical_medicine', 'family_medicine'));
create index if not exists shifts_specialty_open_idx on public.shifts (specialty, start_at) where status = 'open';

-- Doctors may read their specialty like the other profile fields (see 019).
grant select (specialty) on public.profiles to authenticated;

-- 4. Intern grade.
alter table public.profiles drop constraint if exists profiles_grade_check;
alter table public.profiles add constraint profiles_grade_check
  check (grade = any (array['intern', 'resident', 'specialist', 'consultant']));
alter table public.shifts drop constraint if exists shifts_min_grade_check;
alter table public.shifts add constraint shifts_min_grade_check
  check (min_grade = any (array['intern', 'resident', 'specialist', 'consultant']));
alter table public.rota_templates drop constraint if exists rota_templates_min_grade_check;
alter table public.rota_templates add constraint rota_templates_min_grade_check
  check (min_grade = any (array['intern', 'resident', 'specialist', 'consultant']));

create or replace function public.grade_rank(g text)
returns integer language sql immutable set search_path = public as $$
  select case g when 'intern' then 0 when 'resident' then 1 when 'specialist' then 2 when 'consultant' then 3 else -1 end
$$;

-- 5. "Verified": interns need the Syndicate card and internship letter;
--    everyone else the Syndicate card, practice license and certificate.
create or replace function public.docs_verified_for(p_doctor uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case when (select grade from profiles where id = p_doctor) = 'intern' then
      (select count(distinct d.type) = 2 from documents d
        where d.user_id = p_doctor and d.status = 'approved'
          and d.type::text in ('syndicate_card', 'internship_letter')
          and (d.expires_on is null or d.expires_on >= current_date))
    else
      (select count(distinct d.type) = 3 from documents d
        where d.user_id = p_doctor and d.status = 'approved'
          and d.type::text in ('syndicate_card', 'license', 'certificate')
          and (d.expires_on is null or d.expires_on >= current_date))
    end
$$;
revoke execute on function public.docs_verified_for(uuid) from public, anon, authenticated;

create or replace function public.doctors_verified(p_ids uuid[])
returns table (doctor_id uuid, verified boolean)
language sql stable security definer set search_path = public as $$
  select p.id, docs_verified_for(p.id)
  from profiles p
  where p.id = any(p_ids) and (is_approved() or is_admin())
$$;

create or replace function public.doctor_trust(p_doctor uuid)
returns table (badge text, docs_verified boolean, selfie_verified boolean, confirmed_shifts bigint)
language sql stable security definer set search_path = public as $$
  select
    case
      when coalesce(st.shifts_done, 0) >= 20 and coalesce(st.show_up_pct, 0) >= 98
           and coalesce(st.late_cancels, 0) = 0 and coalesce(st.avg_rating, 0) >= 4.5 then 'gold'
      when coalesce(st.shifts_done, 0) >= 5 and coalesce(st.show_up_pct, 0) >= 95 then 'silver'
      else 'new'
    end,
    docs_verified_for(p_doctor),
    exists (select 1 from documents d where d.user_id = p_doctor and d.type = 'selfie' and d.status = 'approved'),
    (select count(*) from bookings b where b.doctor_id = p_doctor and b.arrival_confirmed_at is not null)
  from doctor_stats(p_doctor) st
$$;

-- 6. Urgent-cover candidates and saved alerts match the shift's specialty.
create or replace function public.candidate_doctors(p_shift uuid)
returns table (doctor_id uuid, full_name text, grade text, avg_rating numeric, has_availability boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.grade,
         (select round(avg((r.score_1 + r.score_2 + r.score_3) / 3.0), 2) from ratings r where r.to_user = p.id and r.visible),
         exists (select 1 from availability a
                 where a.doctor_id = p.id and a.active
                   and a.from_at <= s.start_at and a.to_at >= s.start_at + s.duration_hours * interval '1 hour')
  from shifts s
  join hospitals h on h.id = s.hospital_id
  join profiles p on p.status = 'approved' and p.id <> s.poster_id and p.city = h.city and p.specialty = s.specialty
  where s.id = p_shift
    and grade_rank(p.grade) >= grade_rank(s.min_grade)
    and (s.group_id is null or exists (
          select 1 from group_members m where m.group_id = s.group_id and m.user_id = p.id and m.status = 'active'))
    and not doctor_has_overlap(p.id, p_shift)
$$;

create or replace function public.notify_shift_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
declare h hospitals;
begin
  if new.status <> 'open' then return null; end if;
  select * into h from hospitals where id = new.hospital_id;
  insert into notifications (user_id, kind, payload)
  select distinct on (p.id) p.id, 'shift_alert',
         jsonb_build_object('shift_id', new.id, 'hospital', h.name, 'start_at', new.start_at, 'pay_egp', new.pay_egp)
  from saved_alerts a
  join profiles p on p.id = a.user_id and p.status = 'approved'
  where p.id <> new.poster_id
    and (a.specialty is null or a.specialty = new.specialty)
    and (a.city is null or a.city = h.city)
    and (a.shift_type is null or a.shift_type = new.type)
    and (a.subspecialty is null or a.subspecialty = new.subspecialty)
    and (not a.immediate_only or new.payment = 'immediate')
    and (not a.urgent_only or new.urgent)
    and (a.min_pay_egp is null or new.pay_egp >= a.min_pay_egp)
    and grade_rank(p.grade) >= grade_rank(new.min_grade)
    and (new.group_id is null or exists (
          select 1 from group_members m where m.group_id = new.group_id and m.user_id = p.id and m.status = 'active'))
  limit 500;
  return null;
end $$;
revoke execute on function public.notify_shift_alerts() from public, anon, authenticated;

-- 7. Grade and specialty are checked at approval, so approved doctors cannot
--    change them themselves (before, a resident could switch to consultant).
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() and auth.uid() is not null then
    new.status := old.status;
    new.is_premium := old.is_premium;
    new.is_admin := old.is_admin;
    new.max_groups := old.max_groups;
    if old.status = 'approved' then
      new.grade := old.grade;
      new.specialty := old.specialty;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.protect_profile_columns() from public, anon, authenticated;
