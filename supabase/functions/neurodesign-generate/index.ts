import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildPrompt(config: Record<string, unknown>): string {
  const textOff = config.text_enabled === false || config.text_enabled === "false";
  const subjectOff = config.subject_enabled === false || config.subject_enabled === "false";

  const restrictionParts: string[] = [];
  if (textOff) restrictionParts.push("OBRIGATÓRIO: Não incluir texto, títulos, slogans ou botões na imagem. Imagem apenas visual, sem nenhuma escrita.");
  if (subjectOff) restrictionParts.push("OBRIGATÓRIO: Não incluir pessoas, rostos ou figuras humanas na imagem. Imagem totalmente sem sujeito/pessoa.");

  const fontLabel: Record<string, string> = { sans: "sans serifa", serif: "serifa", bold: "negrito", modern: "moderno" };
  const shapeLabel: Record<string, string> = { rounded_rectangle: "retângulo arredondado", banner: "faixa/banner", pill: "pill/cápsula" };
  const ZONE_TO_LABEL: Record<string, string> = {
    "top-left": "zona superior esquerda", "top-center": "zona superior centro", "top-right": "zona superior direita",
    "center-left": "zona meio esquerda", "center": "centro", "center-right": "zona meio direita",
    "bottom-left": "zona inferior esquerda", "bottom-center": "zona inferior centro", "bottom-right": "zona inferior direita",
  };
  function resolvePositionPhrase(zone: string, position: string, textPos: string): string {
    const t = (textPos || "").trim() || "centro";
    if (zone && ZONE_TO_LABEL[zone]) return ZONE_TO_LABEL[zone];
    return (position || "").trim() || t;
  }
  function fieldFont(cfg: Record<string, unknown>, field: "headline" | "subheadline" | "cta"): string {
    const v = field === "headline" ? cfg.headline_font : field === "subheadline" ? cfg.subheadline_font : cfg.cta_font;
    return (String(v || "").trim() || String(cfg.text_font || "").trim()) as string;
  }
  function fieldColor(cfg: Record<string, unknown>, field: "headline" | "subheadline" | "cta"): string {
    const v = field === "headline" ? cfg.headline_color : field === "subheadline" ? cfg.subheadline_color : cfg.cta_color;
    const raw = (String(v || "").trim() || String(cfg.text_color || "").trim()) as string;
    return raw && /^#[0-9a-fA-F]{3,6}$/.test(raw) ? raw : "";
  }
  function fieldShape(cfg: Record<string, unknown>, field: "headline" | "subheadline" | "cta"): { style: string; color: string } | null {
    const enabled = field === "headline" ? cfg.headline_shape_enabled : field === "subheadline" ? cfg.subheadline_shape_enabled : cfg.cta_shape_enabled;
    const styleKey = field === "headline" ? cfg.headline_shape_style : field === "subheadline" ? cfg.subheadline_shape_style : cfg.cta_shape_style;
    const colorRaw = field === "headline" ? cfg.headline_shape_color : field === "subheadline" ? cfg.subheadline_shape_color : cfg.cta_shape_color;
    if (enabled) {
      const style = shapeLabel[String(styleKey)] || "retângulo arredondado";
      const color = (colorRaw && /^#[0-9a-fA-F]{3,6}$/.test(String(colorRaw).trim())) ? String(colorRaw).trim() : "destaque";
      return { style, color };
    }
    if (cfg.text_shape_enabled) {
      const style = shapeLabel[cfg.text_shape_style as string] || "retângulo arredondado";
      const color = (cfg.text_shape_color && /^#[0-9a-fA-F]{3,6}$/.test(String(cfg.text_shape_color).trim())) ? String(cfg.text_shape_color).trim() : "destaque";
      return { style, color };
    }
    return null;
  }

  const textBlockParts: string[] = [];
  if (!textOff && config.text_enabled) {
    const h1 = (config.headline_h1 as string)?.trim() || "";
    const h2 = (config.subheadline_h2 as string)?.trim() || "";
    const cta = (config.cta_button_text as string)?.trim() || "";
    const textPos = (config.text_position as string)?.trim() || "centro";
    const posH = resolvePositionPhrase(String(config.headline_zone || ""), String(config.headline_position || ""), textPos);
    const posH2 = resolvePositionPhrase(String(config.subheadline_zone || ""), String(config.subheadline_position || ""), textPos);
    const posCta = resolvePositionPhrase(String(config.cta_zone || ""), String(config.cta_position || ""), textPos);
    if (h1 || h2 || cta) {
      const textLines: string[] = [];
      if (h1) textLines.push(`Título em destaque: "${h1}"`);
      if (h2) textLines.push(`Subtítulo: "${h2}"`);
      if (cta) textLines.push(`Botão: "${cta}"`);
      const posParts: string[] = [];
      if (h1) posParts.push(`Título na ${posH}`);
      if (h2) posParts.push(`Subtítulo na ${posH2}`);
      if (cta) posParts.push(`CTA na ${posCta}`);
      let posPhrase = posParts.join(", ") + ".";
      if (!h1 || !h2 || !cta) {
        posPhrase += " Não incluir na imagem título, subtítulo ou CTA que não tenham sido listados acima.";
      }
      posPhrase += " Incluir na imagem APENAS estes textos; não adicionar título, subtítulo ou botão que não tenham sido especificados.";
      textBlockParts.push(
        "OBRIGATÓRIO - TEXTO VISÍVEL NA IMAGEM: A arte deve exibir este texto de forma clara e legível, sem alterar uma letra: " +
          textLines.join(". ") + ". " + posPhrase
      );
      if (config.text_gradient) textBlockParts.push("O texto deve ter efeito de gradiente (degradê nas letras).");
      if (h1) {
        const f = fieldFont(config, "headline");
        if (f && fontLabel[f]) textBlockParts.push(`Fonte do título: ${fontLabel[f]}.`);
        const c = fieldColor(config, "headline");
        if (c) textBlockParts.push(`Cor do título: ${c}.`);
        const sh = fieldShape(config, "headline");
        if (sh) textBlockParts.push(`Título sobre faixa/forma de destaque atrás (${sh.style}, cor ${sh.color}).`);
      }
      if (h2) {
        const f = fieldFont(config, "subheadline");
        if (f && fontLabel[f]) textBlockParts.push(`Fonte do subtítulo: ${fontLabel[f]}.`);
        const c = fieldColor(config, "subheadline");
        if (c) textBlockParts.push(`Cor do subtítulo: ${c}.`);
        const sh = fieldShape(config, "subheadline");
        if (sh) textBlockParts.push(`Subtítulo sobre faixa/forma de destaque atrás (${sh.style}, cor ${sh.color}).`);
      }
      if (cta) {
        const f = fieldFont(config, "cta");
        if (f && fontLabel[f]) textBlockParts.push(`Fonte do CTA: ${fontLabel[f]}.`);
        const c = fieldColor(config, "cta");
        if (c) textBlockParts.push(`Cor do CTA: ${c}.`);
        const sh = fieldShape(config, "cta");
        if (sh) textBlockParts.push(`CTA sobre faixa/forma de destaque atrás (${sh.style}, cor ${sh.color}).`);
      }
    } else {
      textBlockParts.push("Não incluir texto, títulos, subtítulos ou botões na imagem (nenhum texto foi definido pelo usuário).");
    }
  }

  const parts: string[] = [];
  if (!subjectOff) {
    const numSubjects = Math.min(Math.max(Number(config.quantity) || 1, 1), 5);
    parts.push(`A imagem deve conter exatamente ${numSubjects} ${numSubjects === 1 ? "sujeito/pessoa" : "sujeitos/pessoas"}.`);
    const gender = config.subject_gender === "masculino" ? "homem" : config.subject_gender === "feminino" ? "mulher" : "";
    const subjectDesc = (config.subject_description as string)?.trim() || "";
    if (gender || subjectDesc) parts.push(`Sujeito principal: ${[gender, subjectDesc].filter(Boolean).join(", ")}.`);
  }
  const niche = (config.niche_project as string)?.trim();
  if (niche) parts.push(`Contexto/nicho: ${niche}. Objetivo: criativo de marca/ads.`);
  const env = (config.environment as string)?.trim();
  if (env) parts.push(`Ambiente: ${env}.`);
  const useScenario = config.use_scenario_photos === true || config.use_scenario_photos === "true";
  const scenarioUrls = Array.isArray(config.scenario_photo_urls) ? config.scenario_photo_urls : [];
  if (useScenario && scenarioUrls.length > 0) {
    parts.push("Use as imagens de cenário anexas como referência para o ambiente/fundo. O cenário da arte deve ser inspirado ou reproduzir o ambiente dessas fotos.");
  }
  const colors = [config.ambient_color, config.rim_light_color, config.fill_light_color].filter(Boolean) as string[];
  if (colors.length) parts.push(`Iluminação e cores: ${colors.join(", ")}.`);
  const shot = config.shot_type as string;
  const layoutPos = config.layout_position as string;
  if (shot) parts.push(`Enquadramento: ${shot}.`);
  if (layoutPos) parts.push(`Posição do sujeito: ${layoutPos}.`);
  if (!textOff && config.text_enabled) {
    const h1 = (config.headline_h1 as string)?.trim() || "";
    const h2 = (config.subheadline_h2 as string)?.trim() || "";
    const cta = (config.cta_button_text as string)?.trim() || "";
    if (h1 || h2 || cta) {
      parts.push("Espaço reservado para texto na composição.");
      parts.push("O texto exibido na imagem deve ser exatamente: " + [h1, h2, cta].filter(Boolean).map((t) => `"${t}"`).join(", ") + ".");
      const textPos = (config.text_position as string)?.trim() || "centro";
      const posH = resolvePositionPhrase(String(config.headline_zone || ""), String(config.headline_position || ""), textPos);
      const posH2 = resolvePositionPhrase(String(config.subheadline_zone || ""), String(config.subheadline_position || ""), textPos);
      const posCta = resolvePositionPhrase(String(config.cta_zone || ""), String(config.cta_position || ""), textPos);
      const posParts: string[] = [];
      if (h1) posParts.push(`Título na ${posH}`);
      if (h2) posParts.push(`Subtítulo na ${posH2}`);
      if (cta) posParts.push(`CTA na ${posCta}`);
      parts.push(posParts.join(", ") + ".");
      if (!h1 || !h2 || !cta) {
        parts.push("Não incluir na imagem título, subtítulo ou CTA que não tenham sido listados acima.");
      }
      parts.push("Incluir na imagem APENAS estes textos; não adicionar título, subtítulo ou botão que não tenham sido especificados.");
      if (config.text_gradient) parts.push("O texto na imagem deve ter efeito de gradiente (degradê nas letras), visível e aplicado ao título e subtítulo.");
      if (h1) {
        const f = fieldFont(config, "headline");
        if (f && fontLabel[f]) parts.push(`Fonte do título: ${fontLabel[f]}.`);
        const c = fieldColor(config, "headline");
        if (c) parts.push(`Cor do título: ${c}.`);
        const sh = fieldShape(config, "headline");
        if (sh) parts.push(`Título sobre faixa/forma de destaque (${sh.style}, cor ${sh.color}).`);
      }
      if (h2) {
        const f = fieldFont(config, "subheadline");
        if (f && fontLabel[f]) parts.push(`Fonte do subtítulo: ${fontLabel[f]}.`);
        const c = fieldColor(config, "subheadline");
        if (c) parts.push(`Cor do subtítulo: ${c}.`);
        const sh = fieldShape(config, "subheadline");
        if (sh) parts.push(`Subtítulo sobre faixa/forma de destaque (${sh.style}, cor ${sh.color}).`);
      }
      if (cta) {
        const f = fieldFont(config, "cta");
        if (f && fontLabel[f]) parts.push(`Fonte do CTA: ${fontLabel[f]}.`);
        const c = fieldColor(config, "cta");
        if (c) parts.push(`Cor do CTA: ${c}.`);
        const sh = fieldShape(config, "cta");
        if (sh) parts.push(`CTA sobre faixa/forma de destaque (${sh.style}, cor ${sh.color}).`);
      }
    } else {
      parts.push("Não incluir texto, títulos, subtítulos ou botões na imagem (nenhum texto foi definido pelo usuário).");
    }
  }
  const attrs = (config.visual_attributes as Record<string, unknown>) || {};
  const tags = Array.isArray(attrs.style_tags) ? attrs.style_tags : [];
  if (tags.length) parts.push(`Estilo: ${tags.join(", ")}.`);
  if (attrs.sobriety != null) parts.push(`Tom visual: ${Number(attrs.sobriety) <= 50 ? "mais criativo" : "mais profissional"}.`);
  if (attrs.ultra_realistic) parts.push("Ultra realista.");
  if (attrs.blur_enabled) parts.push("Blur de fundo suave.");
  if (attrs.lateral_gradient_enabled) parts.push("Degradê lateral.");
  if (config.floating_elements_enabled && (config.floating_elements_text as string)?.trim()) {
    parts.push(`Elementos flutuantes: ${(config.floating_elements_text as string).trim()}.`);
  }
  const styleRefs = Array.isArray(config.style_reference_urls) ? config.style_reference_urls : [];
  const styleInstructions = Array.isArray(config.style_reference_instructions) ? config.style_reference_instructions as string[] : [];
  if (styleRefs.length > 0) {
    const perRef: string[] = [];
    for (let i = 0; i < styleRefs.length; i++) {
      const t = styleInstructions[i] != null ? String(styleInstructions[i]).trim() : "";
      if (t) perRef.push(`Referência ${i + 1}: copie ${t}.`);
      else perRef.push(`Referência ${i + 1}: reproduza o estilo visual geral.`);
    }
    if (perRef.length) parts.push("Das imagens de referência anexas: " + perRef.join(" ") + " A imagem gerada deve ser semelhante ao estilo enviado.");
    else parts.push("Copie e reproduza o estilo visual das imagens de referência anexas: cores, iluminação, composição e estética. A imagem gerada deve ser semelhante ao estilo que foi enviado.");
  }
  const logoUrl = (config.logo_url as string)?.trim();
  if (logoUrl) parts.push("Inclua a logo anexa na arte, em posição visível e adequada (ex.: canto inferior, junto ao texto ou à marca).");
  const dims = (config.dimensions as string) || "1:1";
  if (textOff) {
    parts.push(`Formato: ${dims}.`);
  } else {
    parts.push(`Formato: ${dims}. Safe area para texto.`);
  }
  if ((config.additional_prompt as string)?.trim()) parts.push((config.additional_prompt as string).trim());
  const mainPrompt = parts.filter(Boolean).join(" ");
  const restrictionBlock = restrictionParts.filter(Boolean).join(" ");
  const textBlock = textBlockParts.filter(Boolean).join(" ");
  const prefix = [restrictionBlock, textBlock].filter(Boolean).join(" ");
  return prefix ? prefix + " " + mainPrompt : mainPrompt;
}

const SUBJECT_FACE_INSTRUCTION =
  "Obrigatório: use sempre o rosto e a identidade da pessoa da(s) imagem(ns) de sujeito principal como rosto na imagem gerada. Mantenha a mesma pessoa. ";

const PLACEHOLDER_IMAGE = "https://placehold.co/1024x1024/1a1a2e/eee?text=NeuroDesign";

async function mockGenerate(_config: Record<string, unknown>, quantity: number): Promise<{ url: string }[]> {
  return Array.from({ length: Math.min(quantity, 5) }, () => ({ url: PLACEHOLDER_IMAGE }));
}

type Conn = { id: number; user_id: string; provider: string; api_key: string; api_url: string; default_model: string | null };

function getAspectRatio(dimensions: string): string {
  const d = (dimensions || "1:1").trim();
  if (d === "4:5" || d === "9:16" || d === "16:9") return d;
  return "1:1";
}

const STYLE_REFERENCE_INSTRUCTION =
  "Copie o estilo das imagens de referência anexas. A imagem gerada deve ser semelhante ao estilo enviado: reproduza cores, iluminação, composição e estética visual. ";

const LOGO_INSTRUCTION = "Inclua a logo anexa na arte, em posição visível e adequada (ex.: canto inferior, junto ao texto ou à marca). ";

const SCENARIO_INSTRUCTION =
  "Use as imagens de cenário anexas como referência para o ambiente/fundo da imagem. O cenário da arte deve ser inspirado ou reproduzir o ambiente dessas fotos. ";

async function generateWithOpenRouter(
  conn: Conn,
  prompt: string,
  quantity: number,
  dimensions: string,
  subjectImageUrls: string[] = [],
  styleReferenceUrls: string[] = [],
  styleInstruction?: string,
  logoUrl?: string,
  scenarioPhotoUrls: string[] = []
): Promise<{ url: string }[]> {
  const baseUrl = conn.api_url.replace(/\/$/, "");
  const url = `${baseUrl}/chat/completions`;
  const model = conn.default_model || "google/gemini-2.0-flash-exp:free";
  let textPrompt = prompt;
  if (scenarioPhotoUrls.length > 0) textPrompt = SCENARIO_INSTRUCTION + textPrompt;
  if (subjectImageUrls.length > 0) textPrompt = SUBJECT_FACE_INSTRUCTION + textPrompt;
  if (styleReferenceUrls.length > 0) textPrompt = (styleInstruction || STYLE_REFERENCE_INSTRUCTION) + textPrompt;
  if (logoUrl?.trim()) textPrompt = LOGO_INSTRUCTION + textPrompt;
  const hasSubject = subjectImageUrls.length > 0;
  const hasStyle = styleReferenceUrls.length > 0;
  const hasScenario = scenarioPhotoUrls.length > 0;
  const hasLogo = !!(logoUrl?.trim());
  const content: unknown =
    hasSubject || hasStyle || hasScenario || hasLogo
      ? [
          { type: "text", text: textPrompt },
          ...subjectImageUrls.slice(0, 2).map((subjectUrl) => ({ type: "image_url" as const, image_url: { url: subjectUrl }, imageUrl: { url: subjectUrl } })),
          ...styleReferenceUrls.slice(0, 3).map((styleUrl) => ({ type: "image_url" as const, image_url: { url: styleUrl }, imageUrl: { url: styleUrl } })),
          ...scenarioPhotoUrls.slice(0, 3).map((scenarioUrl) => ({ type: "image_url" as const, image_url: { url: scenarioUrl }, imageUrl: { url: scenarioUrl } })),
          ...(hasLogo ? [{ type: "image_url" as const, image_url: { url: logoUrl!.trim() }, imageUrl: { url: logoUrl!.trim() } }] : []),
        ]
      : textPrompt;
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content }],
    modalities: ["image", "text"],
    stream: false,
    image_config: { aspect_ratio: getAspectRatio(dimensions) },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${conn.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { images?: Array<{ type?: string; image_url?: { url?: string }; imageUrl?: { url?: string } }> } }>;
  };
  const message = data?.choices?.[0]?.message;
  const images = message?.images;
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("A API não retornou imagens. Pode ser filtro de conteúdo ou limite do modelo. Tente outro prompt ou conexão.");
  }
  const urls: { url: string }[] = [];
  for (const img of images.slice(0, Math.min(quantity, 1))) {
    const urlStr = img.image_url?.url ?? img.imageUrl?.url;
    if (urlStr) urls.push({ url: urlStr });
  }
  if (urls.length === 0) throw new Error("A API não retornou imagens. Tente outro prompt ou conexão.");
  return urls;
}

async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const data = btoa(binary);
    const contentType = res.headers.get("content-type") || "";
    const mimeType = contentType.includes("png") ? "image/png" : contentType.includes("webp") ? "image/webp" : "image/jpeg";
    return { data, mimeType };
  } catch {
    return null;
  }
}

const ALLOWED_IMAGE_SIZES = ["1K", "2K", "4K"] as const;
function normalizeImageSize(raw: unknown): "1K" | "2K" | "4K" {
  const s = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return ALLOWED_IMAGE_SIZES.includes(s as "1K" | "2K" | "4K") ? (s as "1K" | "2K" | "4K") : "1K";
}

async function generateWithGoogleGemini(
  conn: Conn,
  prompt: string,
  quantity: number,
  dimensions: string,
  imageSize: "1K" | "2K" | "4K",
  subjectImageUrls: string[] = [],
  styleReferenceUrls: string[] = [],
  styleInstruction?: string,
  logoUrl?: string,
  scenarioPhotoUrls: string[] = []
): Promise<{ url: string }[]> {
  const baseUrl = conn.api_url.replace(/\/$/, "");
  const model = conn.default_model || "gemini-2.5-flash-image";
  const url = `${baseUrl}/models/${model}:generateContent`;
  const aspectRatio = getAspectRatio(dimensions);
  let textPrompt = prompt;
  if (scenarioPhotoUrls.length > 0) textPrompt = SCENARIO_INSTRUCTION + textPrompt;
  if (subjectImageUrls.length > 0) textPrompt = SUBJECT_FACE_INSTRUCTION + textPrompt;
  if (styleReferenceUrls.length > 0) textPrompt = (styleInstruction || STYLE_REFERENCE_INSTRUCTION) + textPrompt;
  if (logoUrl?.trim()) textPrompt = LOGO_INSTRUCTION + textPrompt;
  const urlsToFetch: string[] = [
    ...subjectImageUrls.slice(0, 2),
    ...styleReferenceUrls.slice(0, 3),
    ...scenarioPhotoUrls.slice(0, 3),
    ...(logoUrl?.trim() ? [logoUrl.trim()] : []),
  ];
  const fetchResults = await Promise.all(urlsToFetch.map(fetchImageAsBase64));
  const contentParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  for (const img of fetchResults) {
    if (img) contentParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }
  contentParts.push({ text: textPrompt });
  const body = {
    contents: [{ parts: contentParts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio, imageSize },
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": conn.api_key,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
    }>;
  };
  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason && blockReason !== "BLOCK_REASON_UNSPECIFIED") {
    throw new Error("O prompt foi bloqueado pelo filtro de segurança. Tente outro texto ou remova referências sensíveis.");
  }
  const candidates = data?.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error("A geração foi bloqueada ou não retornou resultado. Tente outro prompt ou referência.");
  }
  const firstCandidate = candidates[0];
  const finishReason = firstCandidate?.finishReason;
  if (finishReason === "SAFETY" || finishReason === "RECITATION" || finishReason === "BLOCKED") {
    throw new Error("A geração foi bloqueada (conteúdo sensível). Tente outro prompt ou referência.");
  }
  const parts = firstCandidate?.content?.parts;
  if (!Array.isArray(parts)) throw new Error("A API não retornou conteúdo de imagem. Tente outro prompt ou conexão.");
  const urls: { url: string }[] = [];
  for (const part of parts) {
    const inline = part.inlineData;
    if (inline?.data) {
      const mime = inline.mimeType || "image/png";
      urls.push({ url: `data:${mime};base64,${inline.data}` });
      if (urls.length >= Math.min(quantity, 5)) break;
    }
  }
  if (urls.length === 0) throw new Error("A API não retornou imagens. Pode ser filtro de conteúdo ou limite. Tente outro prompt ou conexão.");
  return urls;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { projectId, configId, config, userAiConnectionId, style_reference_only } = body as { projectId: string; configId?: string; config: Record<string, unknown>; userAiConnectionId?: string; style_reference_only?: boolean };

    if (!projectId || !config) {
      return new Response(JSON.stringify({ error: "projectId e config são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: project, error: projectError } = await supabase.from("neurodesign_projects").select("id, owner_user_id").eq("id", projectId).single();
    if (projectError || !project || project.owner_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Projeto não encontrado ou acesso negado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const quantityForApi = 1;
    const prompt = buildPrompt(config);
    const subjectOff = config.subject_enabled === false || config.subject_enabled === "false";
    let subjectImageUrls: string[] = Array.isArray(config.subject_image_urls)
      ? (config.subject_image_urls as string[]).filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, 2)
      : [];
    if (subjectOff) subjectImageUrls = [];
    const useScenarioPhotos = config.use_scenario_photos === true || config.use_scenario_photos === "true";
    const scenarioPhotoUrls: string[] =
      useScenarioPhotos && Array.isArray(config.scenario_photo_urls)
        ? (config.scenario_photo_urls as string[]).filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, 3)
        : [];
    const styleReferenceUrls: string[] = Array.isArray(config.style_reference_urls)
      ? (config.style_reference_urls as string[]).filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, 3)
      : [];
    const styleInstructionsArr = Array.isArray(config.style_reference_instructions) ? (config.style_reference_instructions as string[]).slice(0, styleReferenceUrls.length) : [];
    const perRefParts: string[] = [];
    for (let i = 0; i < styleReferenceUrls.length; i++) {
      const t = styleInstructionsArr[i] != null ? String(styleInstructionsArr[i]).trim() : "";
      if (t) perRefParts.push(`Referência ${i + 1}: copie ${t}.`);
      else perRefParts.push(`Referência ${i + 1}: reproduza o estilo visual geral.`);
    }
    let styleInstruction = perRefParts.length > 0
      ? "Das imagens de referência anexas (na ordem): " + perRefParts.join(" ") + " A imagem gerada deve ser semelhante ao estilo enviado. "
      : undefined;
    if (style_reference_only === true && (styleInstruction || styleReferenceUrls.length > 0)) {
      const base = styleInstruction ?? STYLE_REFERENCE_INSTRUCTION;
      styleInstruction = base + " Use a referência apenas para estilo visual. Os textos, slogans e logos a exibir são os descritos no prompt abaixo; não copie o texto ou a marca das imagens de referência.";
    }
    const hasRef = styleReferenceUrls.length > 0;
    const hasSubject = subjectImageUrls.length > 0;
    const hasColors = [config.ambient_color, config.rim_light_color, config.fill_light_color].some((c) => typeof c === "string" && c.trim());
    let promptToUse = prompt;
    if (style_reference_only === true && (hasRef || hasSubject || hasColors)) {
      const priority = "Prioridade: use obrigatoriamente a referência de estilo, o sujeito principal (se fornecido) e as cores indicadas na geração. A imagem deve refletir essas configurações. ";
      if (styleInstruction) styleInstruction = priority + styleInstruction;
      else promptToUse = priority + prompt;
    }
    const logoUrl = (config.logo_url && typeof config.logo_url === "string" && config.logo_url.trim()) ? config.logo_url.trim() : undefined;

    if (!promptToUse || !promptToUse.trim()) {
      return new Response(
        JSON.stringify({ error: "O prompt está vazio. Preencha a descrição da imagem ou conecte nós com contexto." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let providerLabel = "mock";
    const runInsert = {
      project_id: projectId,
      config_id: configId || null,
      type: "generate",
      status: "running",
      provider: providerLabel,
      provider_request_json: { prompt, config: { ...config, subject_image_urls: undefined, scenario_photo_urls: undefined, style_reference_urls: undefined, logo_url: undefined } },
    };
    const { data: run, error: runError } = await supabase.from("neurodesign_generation_runs").insert(runInsert).select("id").single();
    if (runError || !run) {
      return new Response(JSON.stringify({ error: runError?.message || "Erro ao criar run" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let images: { url: string }[] = [];
    try {
      if (userAiConnectionId) {
        const { data: conn } = await supabase.from("user_ai_connections").select("id, user_id, provider, api_key, api_url, default_model").eq("id", userAiConnectionId).single();
        if (conn && conn.user_id === user.id && conn.api_key) {
          const apiUrl = (conn.api_url || "").toLowerCase();
          try {
            if (apiUrl.includes("openrouter")) {
              providerLabel = "openrouter";
              images = await generateWithOpenRouter(conn as Conn, promptToUse, quantityForApi, (config.dimensions as string) || "1:1", subjectImageUrls, styleReferenceUrls, styleInstruction, logoUrl, scenarioPhotoUrls);
            } else if (apiUrl.includes("generativelanguage") || conn.provider?.toLowerCase() === "google") {
              providerLabel = "google";
              const imageSize = normalizeImageSize(config.image_size);
              images = await generateWithGoogleGemini(conn as Conn, promptToUse, quantityForApi, (config.dimensions as string) || "1:1", imageSize, subjectImageUrls, styleReferenceUrls, styleInstruction, logoUrl, scenarioPhotoUrls);
            }
          } catch (apiErr) {
            await supabase.from("neurodesign_generation_runs").update({ error_message: String(apiErr), completed_at: new Date().toISOString() }).eq("id", run.id);
            images = await mockGenerate(config, quantityForApi);
            providerLabel = "mock_fallback";
          }
        }
      }
      if (images.length === 0) images = await mockGenerate(config, quantityForApi);
    } catch (e) {
      await supabase.from("neurodesign_generation_runs").update({ status: "error", error_message: String(e), completed_at: new Date().toISOString() }).eq("id", run.id);
      return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const imageRows = images.map((img) => ({
      run_id: run.id,
      project_id: projectId,
      url: img.url,
      thumbnail_url: img.url,
      width: 1024,
      height: 1024,
    }));
    const { data: insertedImages, error: insertError } = await supabase
      .from("neurodesign_generated_images")
      .insert(imageRows)
      .select("id, run_id, project_id, url, thumbnail_url, width, height");

    if (insertError) {
      await supabase
        .from("neurodesign_generation_runs")
        .update({ status: "error", error_message: insertError.message, completed_at: new Date().toISOString() })
        .eq("id", run.id);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar imagens: " + insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("neurodesign_generation_runs").update({
      status: "success",
      provider: providerLabel,
      error_message: null,
      provider_response_json: { images: insertedImages },
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);

    const { data: toKeep } = await supabase.from("neurodesign_generated_images").select("id").eq("project_id", projectId).order("created_at", { ascending: false }).range(0, 4);
    const keepSet = new Set((toKeep || []).map((r) => r.id));
    const { data: all } = await supabase.from("neurodesign_generated_images").select("id").eq("project_id", projectId);
    const idsToDelete = (all || []).filter((r) => !keepSet.has(r.id)).map((r) => r.id);
    if (idsToDelete.length > 0) await supabase.from("neurodesign_generated_images").delete().in("id", idsToDelete);

    const payload = insertedImages?.length
      ? insertedImages
      : imageRows.map((r) => ({ run_id: run.id, project_id: projectId, url: r.url, thumbnail_url: r.url, width: 1024, height: 1024 }));
    return new Response(JSON.stringify({ runId: run.id, images: payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
