-- Adiciona colunas para logo de ícone claro e escuro na tabela system_branding
alter table public.system_branding
add column if not exists icon_light_logo_url text,
add column if not exists icon_dark_logo_url text;
