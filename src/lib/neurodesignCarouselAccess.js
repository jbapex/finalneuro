import { isPostgrestRpcNotFoundError } from '@/lib/customSupabaseClient';

const EDGE = 'superadmin-neurodesign-carousel';

/**
 * Grava acesso Carrossel NeuroDesign. Ordem: Edge (Auth API) → RPC → PATCH profiles.
 * A Edge Function contorna PostgREST com schema cache antigo.
 */
export async function setNeurodesignCarouselAccess(supabase, userId, enabled) {
  const inv = await supabase.functions.invoke(EDGE, {
    body: { action: 'set', p_user_id: userId, p_enabled: enabled },
  });
  if (!inv.error && inv.data && typeof inv.data === 'object' && inv.data.ok === true) {
    return { error: null };
  }

  const rpcRes = await supabase.rpc('superadmin_set_neurodesign_carousel_access', {
    p_user_id: userId,
    p_enabled: enabled,
  });
  if (!rpcRes.error) return { error: null };
  if (isPostgrestRpcNotFoundError(rpcRes.error)) {
    const patch = await supabase
      .from('profiles')
      .update({ neurodesign_carousel_access: enabled })
      .eq('id', userId);
    return { error: patch.error };
  }
  return { error: rpcRes.error };
}

/**
 * Lista flags por utilizador (super admin). Ordem: Edge → RPC → SELECT profiles.
 */
export async function fetchNeurodesignCarouselFlags(supabase, userIds) {
  if (!userIds.length) return { rows: [], error: null };

  const inv = await supabase.functions.invoke(EDGE, {
    body: { action: 'list', p_user_ids: userIds },
  });
  if (!inv.error && Array.isArray(inv.data)) {
    let rows = inv.data.map((r) => ({
      id: r.id,
      neurodesign_carousel_access: Boolean(r.neurodesign_carousel_access),
    }));
    const sel = await supabase.from('profiles').select('id, neurodesign_carousel_access').in('id', userIds);
    if (!sel.error && sel.data?.length) {
      const pmap = Object.fromEntries(sel.data.map((r) => [r.id, Boolean(r.neurodesign_carousel_access)]));
      rows = rows.map((r) => ({
        ...r,
        neurodesign_carousel_access: r.neurodesign_carousel_access || pmap[r.id],
      }));
    }
    return { rows, error: null };
  }

  const rpcFlags = await supabase.rpc('superadmin_profiles_carousel_flags', { p_user_ids: userIds });
  if (!rpcFlags.error) {
    return { rows: rpcFlags.data || [], error: null };
  }
  if (isPostgrestRpcNotFoundError(rpcFlags.error)) {
    const sel = await supabase.from('profiles').select('id, neurodesign_carousel_access').in('id', userIds);
    return { rows: sel.data || [], error: sel.error };
  }
  return { rows: [], error: rpcFlags.error };
}

/** Interpreta flag vinda do GoTrue (boolean, string, número). */
function parseCarouselMetaFlag(raw) {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
  }
  return null;
}

/**
 * Flag para o utilizador autenticado (NeuroDesign).
 * - Coluna `profiles.neurodesign_carousel_access` (RPC ou SELECT).
 * - `app_metadata.neurodesign_carousel_access` (Edge superadmin-neurodesign-carousel).
 * Concede se QUALQUER uma for verdadeira: o admin pode ter ativado só na BD, só no Auth, ou ambos.
 * Revoga só quando a coluna é false (lida com sucesso) E o metadata não é true (admin deve limpar ambos).
 */
export async function getMyNeurodesignCarouselAccess(supabase) {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const uid = authData?.user?.id;
  if (!uid) return false;

  let dbAllowed = null;

  const rpc = await supabase.rpc('get_my_neurodesign_carousel_access');
  if (!rpc.error) {
    dbAllowed = Boolean(rpc.data);
  } else if (isPostgrestRpcNotFoundError(rpc.error)) {
    const { data: row, error: selErr } = await supabase
      .from('profiles')
      .select('neurodesign_carousel_access')
      .eq('id', uid)
      .maybeSingle();
    if (!selErr) {
      dbAllowed = Boolean(row?.neurodesign_carousel_access);
    }
  }

  const u = !authErr ? authData?.user : null;
  const metaRaw =
    u?.app_metadata?.neurodesign_carousel_access ?? u?.user_metadata?.neurodesign_carousel_access;
  const metaTrue = parseCarouselMetaFlag(metaRaw) === true;

  if (dbAllowed === true || metaTrue) return true;
  if (dbAllowed === false && !metaTrue) return false;
  return false;
}
