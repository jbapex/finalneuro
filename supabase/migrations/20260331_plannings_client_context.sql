-- Planejamento estratégico: amarrar a client_contexts em vez de obrigar campaigns.

ALTER TABLE public.plannings DROP CONSTRAINT IF EXISTS plannings_version_unique;
ALTER TABLE public.plannings DROP CONSTRAINT IF EXISTS plannings_campaign_id_fkey;

ALTER TABLE public.plannings ALTER COLUMN campaign_id DROP NOT NULL;

ALTER TABLE public.plannings
  ADD COLUMN IF NOT EXISTS client_context_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plannings_client_context_id_fkey'
  ) THEN
    ALTER TABLE public.plannings
      ADD CONSTRAINT plannings_client_context_id_fkey
      FOREIGN KEY (client_context_id) REFERENCES public.client_contexts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Unicidade: período + versão + contexto (ou geral) + campanha legada quando existir
CREATE UNIQUE INDEX IF NOT EXISTS plannings_version_unique_v2
ON public.plannings (
  client_id,
  month,
  year,
  version,
  COALESCE(client_context_id, '-1'::bigint),
  COALESCE(campaign_id, '-1'::bigint)
);
