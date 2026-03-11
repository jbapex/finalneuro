-- Adiciona coluna para logo de ícone (sidebar recolhida) na tabela system_branding
alter table public.system_branding
add column if not exists icon_logo_url text;

