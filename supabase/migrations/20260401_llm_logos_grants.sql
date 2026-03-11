-- PostgREST retorna 404 se o role da requisição não tiver nenhum privilégio na tabela
GRANT SELECT ON public.llm_logos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.llm_logos TO authenticated;
GRANT ALL ON public.llm_logos TO service_role;
