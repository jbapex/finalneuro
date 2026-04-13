-- O app não usa mais estas colunas (evita 400 no PostgREST quando o cache do schema não as reconhece).
ALTER TABLE plans DROP COLUMN IF EXISTS has_neuro_flow_access;
ALTER TABLE plans DROP COLUMN IF EXISTS has_neuro_motion_access;
