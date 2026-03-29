-- Cadastro de clientes: remover limite varchar curto nas colunas de texto (alinha com formulário sem max).
-- client_contexts já usa text; esta migração cobre instalações antigas com varchar em `clients`.

DO $$
DECLARE
  col text;
  cols text[] := ARRAY[
    'name',
    'creator_name',
    'niche',
    'style_in_3_words',
    'product_to_promote',
    'target_audience',
    'success_cases',
    'profile_views',
    'followers',
    'appearance_format',
    'catchphrases',
    'phone',
    'about'
  ];
BEGIN
  FOREACH col IN ARRAY cols
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'clients'
        AND column_name = col
        AND data_type <> 'text'
    ) THEN
      EXECUTE format('ALTER TABLE public.clients ALTER COLUMN %I TYPE text', col);
    END IF;
  END LOOP;
END $$;
