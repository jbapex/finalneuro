-- Artes de Culto: diferenciar projetos por tipo (neurodesign | church_art)
ALTER TABLE public.neurodesign_projects
  ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'neurodesign'
  CHECK (project_type IN ('neurodesign', 'church_art'));

CREATE INDEX IF NOT EXISTS idx_neurodesign_projects_owner_type
  ON public.neurodesign_projects (owner_user_id, project_type);
