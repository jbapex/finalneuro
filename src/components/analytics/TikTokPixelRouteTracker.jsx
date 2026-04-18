import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { BRANDING_ROW_ID } from '@/lib/landingPageCopy';
import {
  initTikTokPixel,
  normalizeTikTokPixelId,
  trackTikTokPageView,
  getInitializedTikTokPixelId,
} from '@/lib/tiktokPixel';

function resolveTikTokPixelId(row) {
  const fromDb = normalizeTikTokPixelId(row?.tiktok_pixel_id);
  const fromEnv = normalizeTikTokPixelId(import.meta.env.VITE_TIKTOK_PIXEL_ID);
  return fromDb || fromEnv || '';
}

/**
 * Carrega TikTok Pixel a partir de system_branding ou VITE_TIKTOK_PIXEL_ID;
 * envia PageView em cada mudança de rota (SPA).
 */
export default function TikTokPixelRouteTracker() {
  const location = useLocation();
  const [ready, setReady] = useState(() => Boolean(getInitializedTikTokPixelId()));

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('system_branding')
        .select('tiktok_pixel_id')
        .eq('id', BRANDING_ROW_ID)
        .maybeSingle();

      if (cancelled) return;
      if (error && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[TikTokPixel] branding:', error);
      }

      const id = resolveTikTokPixelId(data || {});
      if (!id) return;

      if (initTikTokPixel(id)) {
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready && !getInitializedTikTokPixelId()) return;
    trackTikTokPageView();
  }, [location.pathname, location.search, ready]);

  return null;
}
