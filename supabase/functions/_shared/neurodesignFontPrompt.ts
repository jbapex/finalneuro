/** Presets rápidos do NeuroDesign (alinhado a fontPrompt.js no client). */
const QUICK_FONT_PT: Record<string, string> = {
  sans: "sans serifa",
  serif: "serifa",
  bold: "negrito",
  modern: "moderno",
};

/**
 * Converte headline_font / subheadline_font / cta_font (ex.: gf:Roboto, nome livre) em linha de prompt.
 * Antes o Edge só aplicava sans/serif/bold/modern — gf: e nomes eram ignorados.
 */
export function neurodesignFontKeyToPromptLine(rolePt: string, fontKey: unknown): string | null {
  const f = String(fontKey ?? "").trim();
  if (!f) return null;
  if (QUICK_FONT_PT[f]) {
    return `Fonte do ${rolePt}: ${QUICK_FONT_PT[f]} — prioridade tipográfica: manter este estilo no texto renderizado.`;
  }
  const lower = f.toLowerCase();
  if (lower.startsWith("gf:")) {
    const name = f.slice(3).trim().replace(/\+/g, " ");
    if (!name) return null;
    return `Fonte do ${rolePt}: usar prioritariamente a família "${name}" (Google Fonts, licença aberta). Reproduzir letras com formato, espessura e personalidade reconhecíveis desta família; não substituir por uma fonte genérica apenas parecida.`;
  }
  return `Fonte do ${rolePt}: "${f}" — prioridade tipográfica: reproduzir esta tipografia o mais fielmente possível na imagem.`;
}
