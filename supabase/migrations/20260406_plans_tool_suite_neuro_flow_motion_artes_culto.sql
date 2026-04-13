-- Suíte de ferramentas: Neuro Flow e NeuroMotion (controle por plano).
-- Artes de Culto não usa coluna em plans — acesso a qualquer usuário autenticado.
-- DEFAULT true mantém comportamento permissivo até o super admin restringir.

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS has_neuro_flow_access BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_neuro_motion_access BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN plans.has_neuro_flow_access IS 'Acesso à ferramenta Neuro Flow (/ferramentas/neuro-flow)';
COMMENT ON COLUMN plans.has_neuro_motion_access IS 'Acesso à ferramenta NeuroMotion (/ferramentas/neuro-motion)';
