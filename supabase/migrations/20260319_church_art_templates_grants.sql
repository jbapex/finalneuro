-- Sem estes GRANTs, o PostgREST retorna 403 (permission denied) para church_art_templates.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.church_art_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.church_art_templates TO service_role;
