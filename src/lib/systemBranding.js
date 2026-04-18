import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const BRANDING_ID = 'neuro_apice';
const BUCKET = 'system_branding';

async function fetchFromTable() {
  const { data, error } = await supabase
    .from('system_branding')
    .select('id, light_logo_url, dark_logo_url, icon_logo_url, icon_light_logo_url, icon_dark_logo_url, meta_pixel_id, tiktok_pixel_id')
    .eq('id', BRANDING_ID)
    .maybeSingle();

  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[systemBranding] erro ao buscar system_branding:', error);
    }
    return {
      lightLogoUrl: null,
      darkLogoUrl: null,
      iconLogoUrl: null,
      iconLightLogoUrl: null,
      iconDarkLogoUrl: null,
      metaPixelId: null,
      tiktokPixelId: null,
      error,
    };
  }

  return {
    lightLogoUrl: data?.light_logo_url ?? null,
    darkLogoUrl: data?.dark_logo_url ?? null,
    iconLogoUrl: data?.icon_logo_url ?? null,
    iconLightLogoUrl: data?.icon_light_logo_url ?? null,
    iconDarkLogoUrl: data?.icon_dark_logo_url ?? null,
    metaPixelId: data?.meta_pixel_id != null ? String(data.meta_pixel_id).trim() || null : null,
    tiktokPixelId: data?.tiktok_pixel_id != null ? String(data.tiktok_pixel_id).trim() || null : null,
    error: null,
  };
}

async function fetchFromStorageFallback() {
  const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 50 });
  if (error || !data?.length) {
    if (import.meta.env.DEV && error) {
      // eslint-disable-next-line no-console
      console.warn('[systemBranding] erro ao listar bucket system_branding:', error);
    }
    return { lightLogoUrl: null, darkLogoUrl: null, iconLogoUrl: null, metaPixelId: null, tiktokPixelId: null };
  }

  let lightLogoUrl = null;
  let darkLogoUrl = null;
  let iconLogoUrl = null;

  for (const file of data) {
    if (!file?.name || file.name === '.emptyFolderPlaceholder') continue;
    if (!lightLogoUrl && file.name.startsWith(`${BRANDING_ID}_light`)) {
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(file.name);
      lightLogoUrl = publicUrl;
    }
    if (!darkLogoUrl && file.name.startsWith(`${BRANDING_ID}_dark`)) {
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(file.name);
      darkLogoUrl = publicUrl;
    }
  }

  return { lightLogoUrl, darkLogoUrl, iconLogoUrl, metaPixelId: null, tiktokPixelId: null };
}

export async function fetchSystemBranding() {
  // 1) Tenta buscar da tabela
  const tableResult = await fetchFromTable();

  // Se já tiver URLs válidas, usa direto
  if (tableResult.lightLogoUrl || tableResult.darkLogoUrl || tableResult.iconLightLogoUrl || tableResult.iconDarkLogoUrl) {
    return tableResult;
  }

  // 2) Fallback: buscar direto do bucket system_branding
  const storageResult = await fetchFromStorageFallback();
  return {
    lightLogoUrl: storageResult.lightLogoUrl,
    darkLogoUrl: storageResult.darkLogoUrl,
    iconLogoUrl: storageResult.iconLogoUrl,
    iconLightLogoUrl: tableResult.iconLightLogoUrl, // fallback não suporta ainda
    iconDarkLogoUrl: tableResult.iconDarkLogoUrl, // fallback não suporta ainda
    metaPixelId: tableResult.metaPixelId,
    tiktokPixelId: tableResult.tiktokPixelId,
    error: tableResult.error,
  };
}

export function useSystemLogo() {
  const [lightLogoUrl, setLightLogoUrl] = useState(null);
  const [darkLogoUrl, setDarkLogoUrl] = useState(null);
  const [iconLogoUrl, setIconLogoUrl] = useState(null);
  const [iconLightLogoUrl, setIconLightLogoUrl] = useState(null);
  const [iconDarkLogoUrl, setIconDarkLogoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      setLoading(true);
      const result = await fetchSystemBranding();
      if (!isMounted) return;

      setLightLogoUrl(result.lightLogoUrl);
      setDarkLogoUrl(result.darkLogoUrl);
      setIconLogoUrl(result.iconLogoUrl);
      setIconLightLogoUrl(result.iconLightLogoUrl);
      setIconDarkLogoUrl(result.iconDarkLogoUrl);
      setError(result.error);
      setLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return { lightLogoUrl, darkLogoUrl, iconLogoUrl, iconLightLogoUrl, iconDarkLogoUrl, loading, error };
}

