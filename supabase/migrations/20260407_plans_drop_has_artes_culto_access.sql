-- Se a migração anterior chegou a criar has_artes_culto_access, remove (ferramenta sem controle por plano).
ALTER TABLE plans DROP COLUMN IF EXISTS has_artes_culto_access;
