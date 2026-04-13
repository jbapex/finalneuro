/** Presets rápidos do NeuroDesign (alinhado a neurodesignFontPrompt.ts na Edge). */
const QUICK_FONT_PT = {
  sans: 'sans serifa',
  serif: 'serifa',
  bold: 'negrito',
  modern: 'moderno',
};

/** @deprecated use getNeuroDesignFontPromptLine; mantido para imports antigos */
export const NEURODESIGN_QUICK_FONT_LABELS = QUICK_FONT_PT;

/**
 * Converte headline_font / subheadline_font / cta_font (ex.: gf:Roboto, nome livre) em linha de prompt.
 * @param {string} rolePt — ex.: "título", "subtítulo", "CTA"
 * @param {unknown} fontKey
 * @returns {string|null}
 */
export function getNeuroDesignFontPromptLine(rolePt, fontKey) {
  const f = String(fontKey ?? '').trim();
  if (!f) return null;
  if (QUICK_FONT_PT[f]) {
    return `Fonte do ${rolePt}: ${QUICK_FONT_PT[f]} — prioridade tipográfica: manter este estilo no texto renderizado.`;
  }
  const lower = f.toLowerCase();
  if (lower.startsWith('gf:')) {
    const name = f.slice(3).trim().replace(/\+/g, ' ');
    if (!name) return null;
    return `Fonte do ${rolePt}: usar prioritariamente a família "${name}" (Google Fonts, licença aberta). Reproduzir letras com formato, espessura e personalidade reconhecíveis desta família; não substituir por uma fonte genérica apenas parecida.`;
  }
  return `Fonte do ${rolePt}: "${f}" — prioridade tipográfica: reproduzir esta tipografia o mais fielmente possível na imagem.`;
}
