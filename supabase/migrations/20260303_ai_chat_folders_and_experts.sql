-- Chat com IA: pastas de conversas e experts
-- Esta migration é idempotente e assume que a tabela ai_chat_sessions já existe.

-- 1. Pastas de conversas do Chat IA
CREATE TABLE IF NOT EXISTS ai_chat_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_chat_folders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_chat_folders'
      AND policyname = 'Users can manage own ai chat folders'
  ) THEN
    CREATE POLICY "Users can manage own ai chat folders"
      ON ai_chat_folders
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_ai_chat_folders_user
  ON ai_chat_folders (user_id, created_at DESC);

-- 2. Experts (agentes) do Chat IA
CREATE TABLE IF NOT EXISTS ai_chat_experts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon_emoji TEXT,
  system_prompt TEXT,
  default_llm_integration_id BIGINT REFERENCES llm_integrations(id) ON DELETE SET NULL,
  default_user_ai_connection_id BIGINT REFERENCES user_ai_connections(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_chat_experts ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver experts globais (user_id IS NULL) e seus próprios
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_chat_experts'
      AND policyname = 'Users can view global or own ai chat experts'
  ) THEN
    CREATE POLICY "Users can view global or own ai chat experts"
      ON ai_chat_experts
      FOR SELECT
      USING (user_id IS NULL OR auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_chat_experts'
      AND policyname = 'Users can manage own ai chat experts'
  ) THEN
    CREATE POLICY "Users can manage own ai chat experts"
      ON ai_chat_experts
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_ai_chat_experts_user
  ON ai_chat_experts (user_id, is_active, created_at DESC);

-- 3. Extensões na tabela de sessões do Chat IA
ALTER TABLE IF EXISTS ai_chat_sessions
  ADD COLUMN IF NOT EXISTS folder_id UUID NULL REFERENCES ai_chat_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expert_id UUID NULL REFERENCES ai_chat_experts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_folder
  ON ai_chat_sessions (folder_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_expert
  ON ai_chat_sessions (expert_id);

