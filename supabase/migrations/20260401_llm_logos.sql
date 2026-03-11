-- Logos por provedor de LLM (ex.: OpenAI, Gemini, Grok) para exibir no Chat IA
CREATE TABLE IF NOT EXISTS public.llm_logos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE,
  logo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.llm_logos ENABLE ROW LEVEL SECURITY;

-- Todos os autenticados podem ler (para mostrar no Chat)
DROP POLICY IF EXISTS "llm_logos_select_authenticated" ON public.llm_logos;
CREATE POLICY "llm_logos_select_authenticated"
  ON public.llm_logos FOR SELECT
  TO authenticated
  USING (true);

-- Apenas super_admin pode inserir/atualizar/remover (via perfil)
DROP POLICY IF EXISTS "llm_logos_insert_super_admin" ON public.llm_logos;
CREATE POLICY "llm_logos_insert_super_admin"
  ON public.llm_logos FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "llm_logos_update_super_admin" ON public.llm_logos;
CREATE POLICY "llm_logos_update_super_admin"
  ON public.llm_logos FOR UPDATE
  TO authenticated
  USING (
    (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "llm_logos_delete_super_admin" ON public.llm_logos;
CREATE POLICY "llm_logos_delete_super_admin"
  ON public.llm_logos FOR DELETE
  TO authenticated
  USING (
    (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE INDEX IF NOT EXISTS idx_llm_logos_provider ON public.llm_logos (provider);

COMMENT ON TABLE public.llm_logos IS 'Logo URL por provider (OpenAI, Gemini, etc.) para o seletor de modelo no Chat IA';
