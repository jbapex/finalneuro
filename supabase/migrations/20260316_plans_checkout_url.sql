-- Link de checkout por plano (usado na aba Assinatura para upgrades).

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS checkout_url text;

COMMENT ON COLUMN public.plans.checkout_url IS
'URL de checkout (ex.: Kiwify) para upgrade direto deste plano.';
