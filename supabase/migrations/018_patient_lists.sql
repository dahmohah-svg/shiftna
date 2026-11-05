-- Anaesthesia patient list tool.
-- A private bucket where a doctor uploads one PDF (list + patient sheets).
-- The server reads it once, as that doctor, and deletes it straight away.
-- Each doctor can only touch files in their own folder: "<user id>/...".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patient-lists', 'patient-lists', false, 20971520, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "patient_lists_insert_own" on storage.objects;
create policy "patient_lists_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'patient-lists'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'approved')
  );

drop policy if exists "patient_lists_select_own" on storage.objects;
create policy "patient_lists_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'patient-lists' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "patient_lists_delete_own" on storage.objects;
create policy "patient_lists_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'patient-lists' and (storage.foldername(name))[1] = (select auth.uid())::text);
