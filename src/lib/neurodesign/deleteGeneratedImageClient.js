import { supabase, supabaseUrl } from '@/lib/customSupabaseClient';

const BUCKET = 'neurodesign';

/** Extrai o path no bucket a partir da URL pública do Storage. */
export function neurodesignStoragePathFromPublicUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const base = (supabaseUrl || '').replace(/\/$/, '');
  const prefix = `${base}/storage/v1/object/public/${BUCKET}/`;
  if (!imageUrl.startsWith(prefix)) return null;
  const pathPart = imageUrl.slice(prefix.length).split('?')[0];
  try {
    return decodeURIComponent(pathPart);
  } catch {
    return pathPart;
  }
}

/**
 * Remove a linha em neurodesign_generated_images e tenta apagar o ficheiro no bucket neurodesign.
 * A linha na base é o essencial para libertar o registo; o storage é best-effort.
 */
export async function deleteNeurodesignGeneratedImageClient(image) {
  if (!image?.id || String(image.id).startsWith('temp-')) {
    return { ok: true, skipped: true };
  }

  const { error: dbError } = await supabase.from('neurodesign_generated_images').delete().eq('id', image.id);
  if (dbError) {
    return { ok: false, error: dbError };
  }

  const urls = [image.url, image.thumbnail_url].filter((u) => typeof u === 'string' && u.trim());
  const paths = [...new Set(urls.map(neurodesignStoragePathFromPublicUrl).filter(Boolean))];
  for (const p of paths) {
    const { error: stError } = await supabase.storage.from(BUCKET).remove([p]);
    if (stError) {
      console.warn('[neurodesign] storage remove', p, stError.message);
    }
  }

  return { ok: true };
}
