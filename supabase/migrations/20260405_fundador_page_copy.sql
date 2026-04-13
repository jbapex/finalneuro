-- Textos e links da landing pública /fundador (Super Admin > Landing Fundador)
alter table public.system_branding
  add column if not exists fundador_page_copy jsonb not null default '{}'::jsonb;

comment on column public.system_branding.fundador_page_copy is
  'Chaves da página /fundador; valores em JSON plano sobrescrevem os padrões da aplicação (textos, URLs de checkout, VSL, links).';
