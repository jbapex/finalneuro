-- Corrige 404 no PostgREST: garante que anon e authenticated tenham acesso à tabela.
-- Rode no SQL Editor do Supabase (no projeto de dados.jbapex.com.br).

-- 1) Garantir que a tabela existe (não faz nada se já existir)
-- (use 20260401_llm_logos.sql antes se a tabela ainda não foi criada)

-- 2) Conceder privilégios (RLS continua controlando quem vê o quê)
GRANT SELECT ON public.llm_logos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.llm_logos TO authenticated;
GRANT ALL ON public.llm_logos TO service_role;

-- 3) Se for Supabase self-hosted, recarregar o schema do PostgREST
-- (descomente e rode apenas uma vez, ou reinicie o container postgrest)
-- NOTIFY pgrst, 'reload schema';
