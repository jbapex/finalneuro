-- Parcelamento manual por oferta (para refletir taxas reais do checkout).

ALTER TABLE public.plan_offers
  ADD COLUMN IF NOT EXISTS installment_count integer,
  ADD COLUMN IF NOT EXISTS installment_value numeric(10,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plan_offers_installment_count_chk'
  ) THEN
    ALTER TABLE public.plan_offers
      ADD CONSTRAINT plan_offers_installment_count_chk
      CHECK (installment_count IS NULL OR installment_count >= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plan_offers_installment_value_chk'
  ) THEN
    ALTER TABLE public.plan_offers
      ADD CONSTRAINT plan_offers_installment_value_chk
      CHECK (installment_value IS NULL OR installment_value >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.plan_offers.installment_count IS
'Quantidade de parcelas exibida para esta oferta (ex.: 12).';

COMMENT ON COLUMN public.plan_offers.installment_value IS
'Valor da parcela exibida para esta oferta (define manualmente para refletir taxas).';
