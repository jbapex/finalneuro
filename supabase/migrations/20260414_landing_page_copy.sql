-- Textos personalizáveis da landing de login (super admin > Configurações de IA > Landing Page)
alter table public.system_branding
  add column if not exists landing_page_copy jsonb not null default '{}'::jsonb;

comment on column public.system_branding.landing_page_copy is
  'Chaves de texto da página /auth; valores em JSON plano sobrescrevem os padrões da aplicação.';
