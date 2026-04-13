/** Zonas 3×3 (mesmo vocabulário que ZoneGrid no front). */
const ZONE_TO_PT: Record<string, string> = {
  "top-left": "canto superior esquerdo",
  "top-center": "topo central",
  "top-right": "canto superior direito",
  "center-left": "lado esquerdo ao centro vertical",
  center: "centro da arte",
  "center-right": "lado direito ao centro vertical",
  "bottom-left": "canto inferior esquerdo",
  "bottom-center": "rodapé central",
  "bottom-right": "canto inferior direito",
};

/** Frase no corpo do prompt principal (termina sem espaço extra). */
export function logoPlacementPromptSentence(logoPosition: string | undefined): string {
  const p = typeof logoPosition === "string" ? logoPosition.trim() : "";
  if (p && ZONE_TO_PT[p]) {
    return `Inclua a logo anexa na arte na zona ${ZONE_TO_PT[p]}, visível, com margem segura e sem cortar.`;
  }
  return "Inclua a logo anexa na arte, em posição visível e adequada (ex.: canto inferior, junto ao texto ou à marca).";
}

/** Prefixo antes do restante do prompt multimodal (termina com espaço). */
export function logoPlacementInstructionPrefix(logoPosition: string | undefined): string {
  return logoPlacementPromptSentence(logoPosition).trim() + " ";
}
