-- Pixel TikTok (Events Manager) — ID guardado em Super Admin → Branding (fallback: VITE_TIKTOK_PIXEL_ID)
alter table public.system_branding
  add column if not exists tiktok_pixel_id text;

comment on column public.system_branding.tiktok_pixel_id is
  'ID do pixel TikTok Ads; opcional. Usado no frontend para analytics.tiktok.com (PageView em SPA).';

-- Obrigatório em muitos setups self‑hosted: sem isto o REST responde
-- "Could not find the 'tiktok_pixel_id' column ... in the schema cache" até o PostgREST recarregar.
NOTIFY pgrst, 'reload schema';
