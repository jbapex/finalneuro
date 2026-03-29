/**
 * Conteúdo vindo de nós anteriores no fluxo criativo (para enriquecer o prompt do Agente).
 * `inputData` vem de getUpstreamNodesData: chaves = tipo do nó (ex.: agent, agent_2, generated_content).
 */

const AGENT_LIKE = /^(agent|generated_content)(_\d+)?$/;
const CHAT_LIKE = /^chat(_\d+)?$/;
const JSON_CONTEXT_TYPES = /^(planning|analysis|page_analyzer)(_\d+)?$/;

/** Mesmo texto do agente aparece no nó `generated_content` filho — preferir uma só fonte. */
function sourceKeyPriority(key) {
  if (/^generated_content(_\d+)?$/.test(key)) return 0;
  if (/^agent(_\d+)?$/.test(key)) return 1;
  return 2;
}

/**
 * Remove entradas `agent_output` com texto idêntico (após trim), mantendo a de maior prioridade
 * (ex.: `generated_content` em vez de `agent`).
 */
function dedupeAgentOutputByText(items) {
  const agentOutputs = [];
  const other = [];
  for (const item of items) {
    if (item.kind === 'agent_output') agentOutputs.push(item);
    else other.push(item);
  }
  const pickBetter = (a, b) => {
    const pa = sourceKeyPriority(a.key);
    const pb = sourceKeyPriority(b.key);
    if (pa !== pb) return pa < pb ? a : b;
    return a.key.localeCompare(b.key) < 0 ? a : b;
  };
  const byFingerprint = new Map();
  for (const item of agentOutputs) {
    const fp = item.text.trim();
    if (!fp) continue;
    const prev = byFingerprint.get(fp);
    byFingerprint.set(fp, prev ? pickBetter(prev, item) : item);
  }
  const merged = Array.from(byFingerprint.values()).sort((a, b) => {
    const d = sourceKeyPriority(a.key) - sourceKeyPriority(b.key);
    if (d !== 0) return d;
    return a.key.localeCompare(b.key);
  });
  return [...other, ...merged];
}

function formatChatMessagesForPrompt(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return '';
  const lines = [];
  for (const msg of messages) {
    const role = msg?.role === 'assistant' ? 'Assistente' : msg?.role === 'user' ? 'Usuário' : String(msg?.role || '?');
    let body = '';
    const c = msg?.content;
    if (typeof c === 'string') body = c;
    else if (c && typeof c === 'object') {
      if (c.type === 'chat' && typeof c.content === 'string') body = c.content;
      else if (typeof c.content === 'string') body = c.content;
      else body = JSON.stringify(c);
    }
    const t = String(body || '').trim();
    if (t) lines.push(`${role}: ${t}`);
  }
  return lines.join('\n\n');
}

function safeJsonSnippet(data, maxLen = 120_000) {
  try {
    const s = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen)}\n\n[… truncado para ${maxLen} caracteres …]`;
  } catch {
    return String(data);
  }
}

/**
 * Lista fontes de texto úteis vindas do grafo upstream (exclui cliente/campanha/nó contexto puros).
 * @param {Record<string, unknown>} inputData
 * @returns {{ key: string, label: string, text: string, kind: string }[]}
 */
export function listUpstreamAgentContextSources(inputData) {
  if (!inputData || typeof inputData !== 'object') return [];
  const skip = new Set(['client', 'campaign', 'context', 'knowledge', 'video_transcriber', 'subject', 'image_logo', 'styles', 'colors', 'reference_image', 'carousel']);
  const out = [];

  for (const key of Object.keys(inputData)) {
    const base = key.replace(/_\d+$/, '') || key;
    if (skip.has(base)) continue;

    const entry = inputData[key];
    if (!entry || typeof entry !== 'object') continue;

    if (AGENT_LIKE.test(key)) {
      const text = typeof entry.data === 'string' ? entry.data.trim() : '';
      if (!text) continue;
      const label = entry.moduleName ? `Conteúdo: ${entry.moduleName}` : `Saída do fluxo (${key})`;
      out.push({ key, label, text, kind: 'agent_output' });
      continue;
    }

    if (CHAT_LIKE.test(key)) {
      const text = formatChatMessagesForPrompt(entry.data);
      if (!text.trim()) continue;
      out.push({ key, label: `Conversa (chat) — ${key}`, text, kind: 'chat' });
      continue;
    }

    if (JSON_CONTEXT_TYPES.test(key) && entry.data != null) {
      const text = safeJsonSnippet(entry.data);
      if (!text.trim()) continue;
      const titles = { planning: 'Planejamento', analysis: 'Análise de campanha', page_analyzer: 'Análise de página' };
      const title = titles[base] || base;
      out.push({ key, label: `${title} (${key})`, text, kind: 'structured' });
    }
  }

  return dedupeAgentOutputByText(out);
}

/**
 * Monta bloco de prompt a partir das fontes selecionadas.
 * @param {{ key: string, label: string, text: string }[]} sources
 * @param {Record<string, boolean> | null | undefined} enabledByKey — se null/undefined, todas ativas; se objeto, só keys com true
 */
export function buildUpstreamContextPromptBlock(sources, enabledByKey) {
  if (!sources?.length) return '';
  const useAll = !enabledByKey || typeof enabledByKey !== 'object';
  const parts = [];
  for (const s of sources) {
    const on = useAll || enabledByKey[s.key] !== false;
    if (!on) continue;
    parts.push(`### ${s.label}\n${s.text}`);
  }
  if (!parts.length) return '';
  return `Conteúdo gerado por nós anteriores no fluxo (use como base, continuidade ou referência; não repita sem necessidade):\n\n${parts.join('\n\n---\n\n')}`;
}
