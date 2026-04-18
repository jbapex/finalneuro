-- Acesso antecipado à aba Carrossel no NeuroDesign (super admin ativa por utilizador em Usuários).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS neurodesign_carousel_access BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.neurodesign_carousel_access IS
  'Quando true, o utilizador vê conteúdo beta na aba Carrossel do NeuroDesign; caso contrário vê apenas "em construção".';
