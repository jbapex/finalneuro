-- Bucket para upload das logos do sistema (Neuro Ápice)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'system_branding',
  'system_branding',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública para o bucket de branding
drop policy if exists "system_branding_storage_public_read" on storage.objects;
create policy "system_branding_storage_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'system_branding');

-- Apenas super_admin pode fazer upload/alterar/remover arquivos deste bucket
drop policy if exists "system_branding_storage_super_admin_insert" on storage.objects;
create policy "system_branding_storage_super_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'system_branding'
    and (select user_type from public.profiles where id = auth.uid()) = 'super_admin'
  );

drop policy if exists "system_branding_storage_super_admin_update" on storage.objects;
create policy "system_branding_storage_super_admin_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'system_branding'
    and (select user_type from public.profiles where id = auth.uid()) = 'super_admin'
  )
  with check (
    bucket_id = 'system_branding'
    and (select user_type from public.profiles where id = auth.uid()) = 'super_admin'
  );

drop policy if exists "system_branding_storage_super_admin_delete" on storage.objects;
create policy "system_branding_storage_super_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'system_branding'
    and (select user_type from public.profiles where id = auth.uid()) = 'super_admin'
  );

