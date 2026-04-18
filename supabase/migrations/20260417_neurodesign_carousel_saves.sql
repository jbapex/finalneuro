-- Carrosséis guardados pelo editor NeuroDesign (galeria) — conta do utilizador, não localStorage.
-- Se após aplicar isto o browser ainda tiver 404 em .../rest/v1/neurodesign_carousel_saves
-- (PostgREST self-hosted com cache antigo): NOTIFY pgrst, 'reload schema'; ou reiniciar o PostgREST.
CREATE TABLE IF NOT EXISTS public.neurodesign_carousel_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  payload JSONB NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_neurodesign_carousel_saves_owner_saved
  ON public.neurodesign_carousel_saves (owner_user_id, saved_at DESC);

COMMENT ON TABLE public.neurodesign_carousel_saves IS
  'Snapshots do editor Carrossel (NeuroDesign); RLS restringe ao dono.';

ALTER TABLE public.neurodesign_carousel_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own neurodesign carousel saves" ON public.neurodesign_carousel_saves;
CREATE POLICY "Users manage own neurodesign carousel saves"
  ON public.neurodesign_carousel_saves
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.neurodesign_carousel_saves TO authenticated;
GRANT ALL ON public.neurodesign_carousel_saves TO service_role;

DROP TRIGGER IF EXISTS neurodesign_carousel_saves_updated_at ON public.neurodesign_carousel_saves;
CREATE TRIGGER neurodesign_carousel_saves_updated_at
  BEFORE UPDATE ON public.neurodesign_carousel_saves
  FOR EACH ROW
  EXECUTE PROCEDURE public.neurodesign_projects_updated_at();

NOTIFY pgrst, 'reload schema';
