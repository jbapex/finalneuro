-- Brief opcional do projeto (Criador de Site)
-- Estrutura sugerida: { site_name, niche, primary_color, secondary_color, tone, target_audience, notes }
ALTER TABLE site_projects ADD COLUMN IF NOT EXISTS project_brief JSONB;

COMMENT ON COLUMN site_projects.project_brief IS 'Brief do projeto: site_name, niche, primary_color, secondary_color, tone, target_audience, notes (todos opcionais)';
