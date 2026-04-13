/**
 * Parâmetro `modalities` do OpenRouter em /chat/completions para geração de imagem.
 * @see https://openrouter.ai/docs/guides/overview/multimodal/image-generation
 * Modelos que só devolvem imagem (Riverflow, Flux, etc.) exigem ["image"].
 * Modelos estilo Gemini podem usar ["image", "text"].
 */
export function openRouterImageChatModalities(model: string | null | undefined): ("image" | "text")[] {
  const id = String(model ?? "").toLowerCase().trim();
  if (!id) return ["image", "text"];

  if (id.startsWith("sourceful/riverflow")) return ["image"];
  if (id.startsWith("black-forest-labs/flux")) return ["image"];

  return ["image", "text"];
}
