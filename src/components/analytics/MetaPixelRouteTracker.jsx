import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { BRANDING_ROW_ID } from '@/lib/landingPageCopy';
import { initMetaPixel, normalizeMetaPixelId, trackMetaPageView, getInitializedMetaPixelId } from '@/lib/metaPixel';

function resolveMetaPixelId(row) {
  const fromDb = normalizeMetaPixelId(row?.meta_pixel_id);
  const fromEnv = normalizeMetaPixelId(import.meta.env.VITE_META_PIXEL_ID);
  return fromDb || fromEnv || '';
}

/**
 * Carrega Meta Pixel a partir de system_branding (prioridade) ou VITE_META_PIXEL_ID;
 * envia PageView em cada mudança de rota (SPA), incluindo /fundador.
 */
export default function MetaPixelRouteTracker() {
  const location = useLocation();
  const [ready, setReady] = useState(() => Boolean(getInitializedMetaPixelId()));

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('system_branding')
        .select('meta_pixel_id')
        .eq('id', BRANDING_ROW_ID)
        .maybeSingle();

      if (cancelled) return;
      if (error && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[MetaPixel] branding:', error);
      }

      const id = resolveMetaPixelId(data || {});
      if (!id) return;

      if (initMetaPixel(id)) {
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready && !getInitializedMetaPixelId()) return;
    trackMetaPageView();
  }, [location.pathname, location.search, ready]);

  return null;
}
