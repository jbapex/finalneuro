-- Módulos do Criador de Site (editor por secções / modal no fluxo). Instalações antigas só tinham html_content.
ALTER TABLE site_projects ADD COLUMN IF NOT EXISTS page_structure JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN site_projects.page_structure IS 'Array JSON de módulos { id, name, html, ... }; compatível com SiteBuilder modal.';
