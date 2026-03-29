const KEY_PREFIX = 'custom_default_ai_connection:';

function scopedKey(userId, scope) {
  return `${KEY_PREFIX}${String(userId)}:${String(scope)}`;
}

export function getDefaultAiConnection(userId, scope) {
  if (!userId) return '';
  try {
    const scoped = localStorage.getItem(scopedKey(userId, scope)) || '';
    if (scoped) return scoped;
    return localStorage.getItem(`${KEY_PREFIX}${String(userId)}`) || '';
  } catch {
    return '';
  }
}

export function setDefaultAiConnection(userId, scope, connectionId) {
  if (!userId) return;
  try {
    const key = scopedKey(userId, scope);
    if (!connectionId) localStorage.removeItem(key);
    else localStorage.setItem(key, String(connectionId));
  } catch {
    // ignore
  }
}
