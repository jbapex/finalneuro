-- Permite que cada usuário autenticado veja apenas suas próprias transações
-- para alimentar a aba "Assinatura" no painel de Configurações.

ALTER TABLE public.kiwify_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kiwify_transactions_user_select_own"
  ON public.kiwify_transactions;

CREATE POLICY "kiwify_transactions_user_select_own"
  ON public.kiwify_transactions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR lower(buyer_email) = lower(
        COALESCE(
          nullif(auth.jwt() ->> 'email', ''),
          nullif(auth.jwt() -> 'user_metadata' ->> 'email', '')
        )
      )
    )
  );
