/** Normaliza a resposta da edge get-openrouter-models. */
export function normalizeOpenRouterModelsList(data) {
  const list = data?.models ?? data?.data ?? (Array.isArray(data) ? data : []);
  return Array.isArray(list) ? list : [];
}

/** Modelos utilizáveis em chat de texto (exclui só embeddings, etc.). */
export function isOpenRouterTextChatModel(m) {
  const mods = m?.architecture?.output_modalities ?? m?.output_modalities;
  return Array.isArray(mods) && mods.includes('text');
}

export function isOpenRouterFreeModelId(id) {
  if (!id || typeof id !== 'string') return false;
  const lower = id.toLowerCase();
  return lower.includes(':free') || lower === 'openrouter/free' || lower.endsWith('/free');
}

/** Gratuitos / rotas free primeiro; depois nome. */
export function compareOpenRouterLlmModels(a, b) {
  const ra = isOpenRouterFreeModelId(a?.id) ? 0 : 1;
  const rb = isOpenRouterFreeModelId(b?.id) ? 0 : 1;
  if (ra !== rb) return ra - rb;
  return (a?.name || a?.id || '').localeCompare(b?.name || b?.id || '');
}

export function toOpenRouterIdNameList(models) {
  return models
    .map((m) => ({ id: m?.id ?? m?.name ?? '', name: m?.name ?? m?.id ?? '' }))
    .filter((m) => m.id);
}
