-- Permissões para as roles do Supabase acessarem ai_chat_folders e ai_chat_experts.
-- Sem estes GRANTs, o Postgres retorna "permission denied for table" (403) mesmo com RLS correto.

GRANT ALL ON public.ai_chat_folders TO authenticated;
GRANT ALL ON public.ai_chat_experts TO authenticated;
GRANT ALL ON public.ai_chat_prompts TO authenticated;

-- service_role para operações administrativas (opcional)
GRANT ALL ON public.ai_chat_folders TO service_role;
GRANT ALL ON public.ai_chat_experts TO service_role;
GRANT ALL ON public.ai_chat_prompts TO service_role;
