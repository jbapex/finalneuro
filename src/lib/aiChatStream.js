/**
 * Consome resposta SSE estilo OpenAI (chat completions) e acumula raciocínio + texto.
 */

function appendFromDelta(delta, append) {
  if (!delta || typeof delta !== 'object') return;
  let r = '';
  let t = '';
  if (typeof delta.reasoning_content === 'string') r += delta.reasoning_content;
  if (typeof delta.reasoning === 'string') r += delta.reasoning;
  if (typeof delta.thought === 'string') r += delta.thought;
  if (typeof delta.thinking === 'string') r += delta.thinking;
  const c = delta.content;
  if (typeof c === 'string') t += c;
  else if (Array.isArray(c)) {
    for (const part of c) {
      const typ = part?.type;
      const ptxt = typeof part?.text === 'string' ? part.text : '';
      if (typ === 'thinking' || typ === 'reasoning' || typ === 'thought') {
        r += ptxt;
      } else if (ptxt) {
        t += ptxt;
      }
    }
  }
  append(r, t);
}

function appendFromChoice(choice, onChunk) {
  if (!choice || typeof choice !== 'object') return;
  const delta = choice.delta;
  appendFromDelta(delta, onChunk);
  const msg = choice.message;
  if (msg && typeof msg === 'object') {
    if (typeof msg.reasoning_content === 'string') {
      onChunk(msg.reasoning_content, '');
    }
  }
}

function parseSseLine(line, onChunk) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return;
  const data = trimmed.slice(5).trim();
  if (!data || data === '[DONE]') return;
  try {
    const json = JSON.parse(data);
    const choices = json.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      appendFromChoice(choices[0], onChunk);
      return;
    }
    const cands = json.candidates;
    if (Array.isArray(cands) && cands[0]?.content?.parts) {
      let r = '';
      let t = '';
      for (const part of cands[0].content.parts) {
        if (part?.thought === true && typeof part.text === 'string') r += part.text;
        else if (typeof part.text === 'string') t += part.text;
      }
      onChunk(r, t);
    }
  } catch {
    /* chunk inválido */
  }
}

/**
 * @param {Response} response
 * @param {AbortSignal} [signal]
 * @param {(state: { reasoning: string, text: string }) => void} [onProgress]
 * @returns {Promise<{ reasoning: string, text: string }>}
 */
export async function consumeOpenAICompatibleSse(response, signal, onProgress) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Resposta sem corpo (stream).');
  }
  const decoder = new TextDecoder();
  let buffer = '';
  let reasoning = '';
  let text = '';

  const flush = () => {
    if (typeof onProgress === 'function') onProgress({ reasoning, text });
  };

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        throw new DOMException('Aborted', 'AbortError');
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const line of parts) {
        parseSseLine(line, (r, txt) => {
          reasoning += r;
          text += txt;
        });
      }
      flush();
    }
    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        parseSseLine(line, (r, txt) => {
          reasoning += r;
          text += txt;
        });
      }
    }
    flush();
    return { reasoning, text };
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}
