import { supabase } from '@/lib/customSupabaseClient';

export async function fetchUserPrompts(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('ai_chat_prompts')
    .select('id, user_id, name, description, content, is_favorite, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createUserPrompt({ userId, name, description, content }) {
  if (!userId) throw new Error('userId é obrigatório para criar prompt.');

  const payload = {
    user_id: userId,
    name: name || 'Novo prompt',
    description: description || null,
    content: content || '',
  };

  const { data, error } = await supabase
    .from('ai_chat_prompts')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserPrompt(id, updates) {
  const payload = {
    ...(updates.name !== undefined ? { name: updates.name || 'Sem título' } : {}),
    ...(updates.description !== undefined ? { description: updates.description || null } : {}),
    ...(updates.content !== undefined ? { content: updates.content || '' } : {}),
    ...(updates.is_favorite !== undefined ? { is_favorite: !!updates.is_favorite } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('ai_chat_prompts')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteUserPrompt(id) {
  const { error } = await supabase.from('ai_chat_prompts').delete().eq('id', id);
  if (error) throw error;
}

