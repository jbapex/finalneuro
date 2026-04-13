/**
 * Extrai JSON da resposta da IA (pode vir em bloco ```json ... ```).
 * Usado por CarouselNode e ImageGeneratorNode.
 */
export function extractJsonFromAiResponse(str) {
  if (!str || typeof str !== 'string') return null;
  let s = str.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const firstBrace = s.indexOf('{');
  if (firstBrace === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = firstBrace; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const jsonStr = end !== -1 ? s.slice(firstBrace, end + 1) : s.slice(firstBrace);
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}
