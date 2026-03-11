-- Bucket para upload de logos de LLM (Super Admin)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'llm_logos',
  'llm_logos',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Leitura pública
DROP POLICY IF EXISTS "llm_logos_storage_public_read" ON storage.objects;
CREATE POLICY "llm_logos_storage_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'llm_logos');

-- Apenas super_admin pode fazer upload
DROP POLICY IF EXISTS "llm_logos_storage_super_admin_insert" ON storage.objects;
CREATE POLICY "llm_logos_storage_super_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'llm_logos'
    AND (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "llm_logos_storage_super_admin_update" ON storage.objects;
CREATE POLICY "llm_logos_storage_super_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'llm_logos'
    AND (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    bucket_id = 'llm_logos'
    AND (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "llm_logos_storage_super_admin_delete" ON storage.objects;
CREATE POLICY "llm_logos_storage_super_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'llm_logos'
    AND (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );
