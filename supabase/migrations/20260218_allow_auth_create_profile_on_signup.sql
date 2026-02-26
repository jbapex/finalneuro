-- Permite que o trigger on_auth_user_created (handle_new_user) crie a linha em public.profiles.
-- No signup quem insere em auth.users é o GoTrue (role supabase_auth_admin); auth.uid() é NULL,
-- então a policy "Users can insert their own profile" bloqueava o INSERT e o cadastro falhava (422).
-- Esta policy permite apenas o role do Auth criar perfis no signup.

GRANT INSERT ON public.profiles TO supabase_auth_admin;

DROP POLICY IF EXISTS "Auth service can create profile on signup" ON public.profiles;
CREATE POLICY "Auth service can create profile on signup"
  ON public.profiles
  FOR INSERT
  TO supabase_auth_admin
  WITH CHECK (true);
