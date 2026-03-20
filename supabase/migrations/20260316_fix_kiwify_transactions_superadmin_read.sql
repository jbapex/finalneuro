-- Corrige carregamento da aba "Transacoes" no Super Admin.
-- 1) Compatibilidade com queries que ordenam por created_at.
-- 2) Permite leitura somente para super_admin via RLS.

ALTER TABLE public.kiwify_transactions
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.kiwify_transactions
SET created_at = COALESCE(created_at, received_at, now())
WHERE created_at IS NULL;

ALTER TABLE public.kiwify_transactions
  ALTER COLUMN created_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_kiwify_transactions_created_at
  ON public.kiwify_transactions (created_at DESC);

ALTER TABLE public.kiwify_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kiwify_transactions_super_admin_select"
  ON public.kiwify_transactions;

CREATE POLICY "kiwify_transactions_super_admin_select"
  ON public.kiwify_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.user_type = 'super_admin'
    )
  );
