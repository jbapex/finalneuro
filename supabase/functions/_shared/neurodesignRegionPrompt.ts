/**
 * Região normalizada (0–1) como texto para prompts de edição localizada,
 * quando não há imagem de recorte (crop falhou por CORS, etc.).
 */
export function regionBoundsDescriptionEN(region: {
  x: number;
  y: number;
  width: number;
  height: number;
}): string {
  const pct = (n: number) => Math.round(Math.max(0, Math.min(1, Number(n))) * 1000) / 10;
  return `a rectangular area starting at ${pct(region.x)}% from the left edge and ${pct(region.y)}% from the top edge, spanning ${pct(region.width)}% of the image width and ${pct(region.height)}% of the image height (relative to the full canvas)`;
}
