-- Chat IA: prompts pessoais por usuário

CREATE TABLE IF NOT EXISTS ai_chat_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_chat_prompts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_chat_prompts'
      AND policyname = 'Users can manage own ai chat prompts'
  ) THEN
    CREATE POLICY "Users can manage own ai chat prompts"
      ON ai_chat_prompts
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_ai_chat_prompts_user
  ON ai_chat_prompts (user_id, created_at DESC);

