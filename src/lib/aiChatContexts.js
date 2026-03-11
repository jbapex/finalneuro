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

