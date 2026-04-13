-- NeuroMotion: projetos (autosave) + upload de assets na pasta do utilizador

CREATE TABLE IF NOT EXISTS public.neuro_motion_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Sem titulo',
  project_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS neuro_motion_projects_user_updated_idx
  ON public.neuro_motion_projects (user_id, updated_at DESC);

ALTER TABLE public.neuro_motion_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "NeuroMotion projects: select own" ON public.neuro_motion_projects;
CREATE POLICY "NeuroMotion projects: select own"
  ON public.neuro_motion_projects
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "NeuroMotion projects: insert own" ON public.neuro_motion_projects;
CREATE POLICY "NeuroMotion projects: insert own"
  ON public.neuro_motion_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "NeuroMotion projects: update own" ON public.neuro_motion_projects;
CREATE POLICY "NeuroMotion projects: update own"
  ON public.neuro_motion_projects
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "NeuroMotion projects: delete own" ON public.neuro_motion_projects;
CREATE POLICY "NeuroMotion projects: delete own"
  ON public.neuro_motion_projects
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.neuro_motion_projects IS 'Projetos NeuroMotion (formato, cenas, etc.) com autosave.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.neuro_motion_projects TO authenticated;
GRANT ALL ON public.neuro_motion_projects TO service_role;

CREATE OR REPLACE FUNCTION public.set_neuro_motion_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_neuro_motion_projects_updated ON public.neuro_motion_projects;
CREATE TRIGGER trg_neuro_motion_projects_updated
  BEFORE UPDATE ON public.neuro_motion_projects
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_neuro_motion_projects_updated_at();

-- Uploads: pasta do utilizador no bucket neuromotion (ex.: {uid}/assets/...)
DROP POLICY IF EXISTS "NeuroMotion storage: upload pasta do utilizador" ON storage.objects;
CREATE POLICY "NeuroMotion storage: upload pasta do utilizador"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'neuromotion'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "NeuroMotion storage: update pasta do utilizador" ON storage.objects;
CREATE POLICY "NeuroMotion storage: update pasta do utilizador"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'neuromotion'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'neuromotion'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "NeuroMotion storage: delete pasta do utilizador" ON storage.objects;
CREATE POLICY "NeuroMotion storage: delete pasta do utilizador"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'neuromotion'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);
