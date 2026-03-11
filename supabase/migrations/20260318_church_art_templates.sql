-- Templates de Artes de Culto: salvar e reutilizar configurações do formulário
CREATE TABLE IF NOT EXISTS public.church_art_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.church_art_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_art_templates_select_own"
  ON public.church_art_templates FOR SELECT
  USING (auth.uid() = owner_user_id);

CREATE POLICY "church_art_templates_insert_own"
  ON public.church_art_templates FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "church_art_templates_update_own"
  ON public.church_art_templates FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "church_art_templates_delete_own"
  ON public.church_art_templates FOR DELETE
  USING (auth.uid() = owner_user_id);

CREATE INDEX IF NOT EXISTS idx_church_art_templates_owner
  ON public.church_art_templates(owner_user_id);
