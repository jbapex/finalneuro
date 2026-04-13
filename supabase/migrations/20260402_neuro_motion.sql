-- NeuroMotion: filas de render de vídeo (Remotion) + storage

CREATE TABLE IF NOT EXISTS public.neuro_motion_render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  input_props jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_path text,
  output_url text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS neuro_motion_render_jobs_user_created_idx
  ON public.neuro_motion_render_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS neuro_motion_render_jobs_status_created_idx
  ON public.neuro_motion_render_jobs (status, created_at)
  WHERE status = 'pending';

ALTER TABLE public.neuro_motion_render_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "NeuroMotion jobs: select own" ON public.neuro_motion_render_jobs;
CREATE POLICY "NeuroMotion jobs: select own"
  ON public.neuro_motion_render_jobs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Sem INSERT/UPDATE pelo cliente: apenas service role (Edge Function + worker)

COMMENT ON TABLE public.neuro_motion_render_jobs IS 'Filas de export MP4 NeuroMotion (processadas por worker Node + Remotion).';

GRANT SELECT ON public.neuro_motion_render_jobs TO authenticated;
GRANT ALL ON public.neuro_motion_render_jobs TO service_role;

-- updated_at
CREATE OR REPLACE FUNCTION public.set_neuro_motion_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_neuro_motion_render_jobs_updated ON public.neuro_motion_render_jobs;
CREATE TRIGGER trg_neuro_motion_render_jobs_updated
  BEFORE UPDATE ON public.neuro_motion_render_jobs
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_neuro_motion_jobs_updated_at();

-- Storage bucket (URLs públicas de leitura, upload via service role no worker)
INSERT INTO storage.buckets (id, name, public)
VALUES ('neuromotion', 'neuromotion', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "NeuroMotion storage: leitura pública" ON storage.objects;
CREATE POLICY "NeuroMotion storage: leitura pública"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'neuromotion');
