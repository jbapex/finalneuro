/**
 * Galeria de carrosséis no Supabase (conta do utilizador), em alternativa ao localStorage.
 */

import {
  carrosselGalleryStorageKey,
  readCarrosselGallerySaves,
} from '@/lib/neurodesign/carrosselGalleryStorage';

function rowToEntry(row) {
  if (!row || typeof row !== 'object') return null;
  const payload = row.payload;
  if (!payload || !Array.isArray(payload.slides) || payload.slides.length === 0) return null;
  return {
    id: row.id,
    name: String(row.name || ''),
    savedAt: row.saved_at || row.savedAt,
    payload,
  };
}

/** Lista entradas válidas, mais recentes primeiro. */
export async function fetchCarrosselGallerySaves(supabase, userId) {
  if (!userId || !supabase) return [];
  const { data, error } = await supabase
    .from('neurodesign_carousel_saves')
    .select('id, name, payload, saved_at')
    .eq('owner_user_id', userId)
    .order('saved_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data || []).map(rowToEntry).filter(Boolean);
}

/** Conta entradas do utilizador (para limite). */
export async function countCarrosselGallerySaves(supabase, userId) {
  if (!userId || !supabase) return 0;
  const { count, error } = await supabase
    .from('neurodesign_carousel_saves')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', userId);
  if (error) throw error;
  return typeof count === 'number' ? count : 0;
}

export async function insertCarrosselGallerySave(supabase, userId, { name, payload }) {
  if (!userId || !supabase) throw new Error('Sessão inválida');
  const { data, error } = await supabase
    .from('neurodesign_carousel_saves')
    .insert({
      owner_user_id: userId,
      name: String(name || '').trim(),
      payload,
    })
    .select('id, saved_at')
    .single();
  if (error) throw error;
  return data;
}

export async function updateCarrosselGallerySave(supabase, userId, id, { name, payload }) {
  if (!userId || !supabase) throw new Error('Sessão inválida');
  const { error } = await supabase
    .from('neurodesign_carousel_saves')
    .update({
      name: String(name || '').trim(),
      payload,
      saved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('owner_user_id', userId);
  if (error) throw error;
}

export async function deleteCarrosselGallerySave(supabase, userId, id) {
  if (!userId || !supabase) throw new Error('Sessão inválida');
  const { error } = await supabase
    .from('neurodesign_carousel_saves')
    .delete()
    .eq('id', id)
    .eq('owner_user_id', userId);
  if (error) throw error;
}

/**
 * Se o servidor ainda não tiver carrosséis e existirem dados no localStorage, copia uma vez e limpa o local.
 */
export async function migrateLocalCarrosselGalleryToServer(supabase, userId) {
  if (!userId || !supabase) return { migrated: 0 };
  const local = readCarrosselGallerySaves(userId);
  if (!local.length) return { migrated: 0 };

  let remoteCount = 0;
  try {
    remoteCount = await countCarrosselGallerySaves(supabase, userId);
  } catch {
    return { migrated: 0 };
  }
  if (remoteCount > 0) return { migrated: 0 };

  let migrated = 0;
  for (const entry of local) {
    const row = {
      id: entry.id,
      owner_user_id: userId,
      name: entry.name,
      payload: entry.payload,
      saved_at: entry.savedAt || new Date().toISOString(),
    };
    const { error } = await supabase.from('neurodesign_carousel_saves').insert(row);
    if (error) {
      console.warn('[carrossel gallery migrate]', error);
      break;
    }
    migrated += 1;
  }
  if (migrated > 0) {
    try {
      localStorage.removeItem(carrosselGalleryStorageKey(userId));
    } catch {
      /* ignore */
    }
  }
  return { migrated };
}
