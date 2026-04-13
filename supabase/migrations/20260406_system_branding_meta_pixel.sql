-- Pixel Meta (Facebook): ID numérico configurável no Super Admin → Branding (landing /fundador + app inteiro)
alter table public.system_branding
  add column if not exists meta_pixel_id text;

comment on column public.system_branding.meta_pixel_id is
  'ID do Meta Pixel (apenas dígitos). Aplicado a todo o domínio: /fundador, /auth e área logada. Fallback: VITE_META_PIXEL_ID no build.';
