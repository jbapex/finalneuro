import { supabase } from '@/lib/customSupabaseClient';

/**
 * Busca clientes do usuário com contagem de contextos por cliente.
 */
export async function fetchClientsWithContextCounts(userId) {
  let query = supabase
    .from('clients')
    .select('id, name, client_contexts(count)')
    .order('name', { ascending: true });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((client) => ({
    id: client.id,
    name: client.name,
    contextCount:
      Array.isArray(client.client_contexts) && client.client_contexts.length > 0
        ? client.client_contexts[0].count ?? 0
        : 0,
  }));
}

/**
 * Lista todos os contextos de um cliente específico.
 */
export async function fetchClientContexts(clientId) {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from('client_contexts')
    .select('id, client_id, name, content, created_at, updated_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Cria um novo contexto para um cliente.
 */
export async function createClientContext({ clientId, name, content }) {
  const payload = {
    client_id: clientId,
    name: name || null,
    content: content || '',
  };

  const { data, error } = await supabase
    .from('client_contexts')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Atualiza um contexto existente.
 */
export async function updateClientContext(id, updates) {
  const payload = {
    ...(updates.name !== undefined ? { name: updates.name || null } : {}),
    ...(updates.content !== undefined ? { content: updates.content || '' } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('client_contexts')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Exclui um contexto.
 */
export async function deleteClientContext(id) {
  const { error } = await supabase.from('client_contexts').delete().eq('id', id);
  if (error) throw error;
}

/** Campos da ficha usados como contexto no Chat IA (alinhado ao cadastro do cliente). */
const CLIENT_PROFILE_CHAT_SELECT =
  'id, name, creator_name, niche, style_in_3_words, product_to_promote, target_audience, success_cases, profile_views, followers, appearance_format, catchphrases, phone, about, context_document';

/**
 * Busca fichas completas de um ou mais clientes (RLS restringe ao usuário).
 */
export async function fetchClientProfilesForChat(clientIds) {
  if (!clientIds?.length) return [];
  const { data, error } = await supabase
    .from('clients')
    .select(CLIENT_PROFILE_CHAT_SELECT)
    .in('id', clientIds);

  if (error) throw error;
  return data || [];
}

/**
 * Formata a ficha do cliente como texto para mensagem system do chat.
 */
export function formatClientProfileForPrompt(client) {
  if (!client) return '';
  const lines = [];
  const push = (label, val) => {
    const s = val == null ? '' : String(val).trim();
    if (s) lines.push(`${label}: ${s}`);
  };

  push('Nome', client.name);
  push('Nome do criador / persona', client.creator_name);
  push('Nicho', client.niche);
  push('Estilo em 3 palavras', client.style_in_3_words);
  push('Produto a promover', client.product_to_promote);
  push('Público-alvo', client.target_audience);
  push('Casos de sucesso', client.success_cases);
  push('Visualizações do perfil', client.profile_views);
  push('Seguidores', client.followers);
  push('Formato de aparência', client.appearance_format);
  push('Bordões / frases', client.catchphrases);
  push('Telefone', client.phone);
  push('Sobre', client.about);
  push('Documento de contexto (legado)', client.context_document);

  const title = client.name?.trim() || 'Cliente';
  const body = lines.length > 0 ? lines.join('\n') : '(Ficha sem campos preenchidos.)';
  return `Ficha de cadastro — ${title}\n${body}`;
}

