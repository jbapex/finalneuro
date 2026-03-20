-- Ofertas comerciais por plano (mensal/anual/fundadora)
-- Permite múltiplos checkouts por plano de forma profissional.

CREATE TABLE IF NOT EXISTS public.plan_offers (
  id bigserial PRIMARY KEY,
  plan_id bigint NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  display_name text,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  offer_type text NOT NULL DEFAULT 'regular' CHECK (offer_type IN ('regular', 'founder')),
  price_override numeric(10,2),
  checkout_url text,
  kiwify_product_id text,
  kiwify_checkout_code text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, billing_cycle, offer_type)
);

CREATE INDEX IF NOT EXISTS idx_plan_offers_plan_id ON public.plan_offers(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_offers_active ON public.plan_offers(is_active);

ALTER TABLE public.plan_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_offers_authenticated_select_active" ON public.plan_offers;
CREATE POLICY "plan_offers_authenticated_select_active"
  ON public.plan_offers
  FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "plan_offers_super_admin_manage" ON public.plan_offers;
CREATE POLICY "plan_offers_super_admin_manage"
  ON public.plan_offers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.user_type = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.user_type = 'super_admin'
    )
  );

-- Backfill inicial a partir de plans.checkout_url (se houver),
-- assumindo ciclo anual como padrão histórico.
INSERT INTO public.plan_offers (
  plan_id, display_name, billing_cycle, offer_type,
  price_override, checkout_url, is_active, sort_order
)
SELECT
  p.id,
  p.name || ' - Anual',
  'yearly',
  'regular',
  p.price,
  p.checkout_url,
  true,
  100
FROM public.plans p
WHERE p.checkout_url IS NOT NULL
ON CONFLICT (plan_id, billing_cycle, offer_type)
DO UPDATE SET
  checkout_url = EXCLUDED.checkout_url,
  price_override = EXCLUDED.price_override,
  updated_at = now();
