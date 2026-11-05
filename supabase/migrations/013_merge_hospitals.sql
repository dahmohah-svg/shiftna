-- 013: admin tool to merge duplicate hospitals, and duplicate suggestions.

create extension if not exists pg_trgm with schema extensions;

-- Name reduced to what matters for matching: lower case, no punctuation,
-- without words like "hospital", "al"/"el", "مستشفى" or a leading "ال".
create or replace function public.hospital_name_key(p text)
returns text language sql immutable set search_path = public as $$
  select btrim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(coalesce(p, '')), '[^[:alnum:][:space:]]', ' ', 'g'),
        '\m(hospitals?|hosp|the|al|el|مستشفى|مستشفي|مستشفيات)\M', ' ', 'g'),
      '\mال', '', 'g'),
    '\s+', ' ', 'g'))
$$;

-- Pairs of hospitals in the same city whose names look alike (admin only).
create or replace function public.possible_duplicate_hospitals()
returns table (a_id uuid, a_name text, b_id uuid, b_name text, city text, score real)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  return query
  with k as (select id, name, hospitals.city, hospital_name_key(name) as key from hospitals)
  select a.id, a.name, b.id, b.name, a.city, similarity(a.key, b.key)
  from k a join k b on a.city = b.city and a.id < b.id
  where a.key <> '' and b.key <> ''
    and (similarity(a.key, b.key) >= 0.45
         or position(a.key in b.key) > 0 or position(b.key in a.key) > 0)
  order by 6 desc
  limit 50;
end $$;
revoke execute on function public.possible_duplicate_hospitals() from public, anon;
grant execute on function public.possible_duplicate_hospitals() to authenticated, service_role;

-- Move everything from p_remove onto p_keep, then delete p_remove (admin only).
create or replace function public.merge_hospitals(p_keep uuid, p_remove uuid)
returns void language plpgsql security definer set search_path = public as $$
declare k hospitals; r hospitals;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  if p_keep = p_remove then raise exception 'Choose two different hospitals'; end if;
  select * into k from hospitals where id = p_keep for update;
  select * into r from hospitals where id = p_remove for update;
  if k.id is null or r.id is null then raise exception 'Hospital not found'; end if;

  perform set_config('app.bypass', '1', true);
  update shifts set hospital_id = k.id where hospital_id = r.id;
  update ratings set to_hospital = k.id where to_hospital = r.id;
  update groups set hospital_id = k.id where hospital_id = r.id;
  update logbook_entries set hospital_id = k.id where hospital_id = r.id;
  update rota_templates set hospital_id = k.id where hospital_id = r.id;
  update work_history set hospital_id = k.id where hospital_id = r.id;
  insert into hospital_staff
    select (jsonb_populate_record(null::hospital_staff, to_jsonb(s) || jsonb_build_object('hospital_id', k.id))).*
    from hospital_staff s where s.hospital_id = r.id
  on conflict do nothing;
  delete from hospital_staff where hospital_id = r.id;
  update notifications set payload = jsonb_set(payload, '{hospital_id}', to_jsonb(k.id::text))
    where payload->>'hospital_id' = r.id::text;

  update hospitals set
    verified = k.verified or r.verified,
    area = coalesce(k.area, r.area),
    address = coalesce(k.address, r.address),
    contact = coalesce(k.contact, r.contact),
    added_by = coalesce(k.added_by, r.added_by)
  where id = k.id;
  delete from hospitals where id = r.id;

  insert into audit_log (admin_id, action, target_table, target_id, detail)
    values (auth.uid(), 'hospital_merged', 'hospitals', k.id,
            format('Merged "%s" (%s) into "%s"', r.name, r.id, k.name));
end $$;
revoke execute on function public.merge_hospitals(uuid, uuid) from public, anon;
grant execute on function public.merge_hospitals(uuid, uuid) to authenticated, service_role;
