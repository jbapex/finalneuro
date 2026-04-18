-- Contorna cache de schema do PostgREST quando a coluna neurodesign_carousel_access
-- ainda não é reconhecida pelo REST (ex.: self-hosted sem reload efetivo).
--
-- Depois de executar este script no MESMO projeto que serve dados.jbapex.com.br:
--   NOTIFY pgrst, 'reload schema';
-- Se o browser ainda mostrar 404 em POST .../rpc/superadmin_set_neurodesign_carousel_access,
-- a função não está no cache do PostgREST: reinicia o serviço/container do PostgREST.
-- Confirma que a função existe no Postgres:
--   SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND proname LIKE '%neurodesign_carousel%';
--
-- Se o PostgREST continuar com cache antigo (404 em /rpc e 400 em PATCH), faça deploy da
-- Edge Function supabase/functions/superadmin-neurodesign-carousel (usa Auth Admin API).

-- Leitura do próprio utilizador (NeuroDesign)
CREATE OR REPLACE FUNCTION public.get_my_neurodesign_carousel_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.neurodesign_carousel_access FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.get_my_neurodesign_carousel_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_neurodesign_carousel_access() TO authenticated;

-- Lista de flags para gestão de utilizadores (super admin)
CREATE OR REPLACE FUNCTION public.superadmin_profiles_carousel_flags(p_user_ids uuid[])
RETURNS TABLE (id uuid, neurodesign_carousel_access boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.neurodesign_carousel_access
  FROM public.profiles p
  WHERE p.id = ANY(p_user_ids)
    AND EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.user_type = 'super_admin'
    );
$$;

REVOKE ALL ON FUNCTION public.superadmin_profiles_carousel_flags(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.superadmin_profiles_carousel_flags(uuid[]) TO authenticated;

-- Atualização do toggle Carrossel (super admin)
CREATE OR REPLACE FUNCTION public.superadmin_set_neurodesign_carousel_access(
  p_user_id uuid,
  p_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles me
    WHERE me.id = auth.uid() AND me.user_type = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET neurodesign_carousel_access = p_enabled
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.superadmin_set_neurodesign_carousel_access(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.superadmin_set_neurodesign_carousel_access(uuid, boolean) TO authenticated;
