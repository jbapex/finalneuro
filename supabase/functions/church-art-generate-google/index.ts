import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { enqueueUserGoogle } from "../_shared/googleUserQueue.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NO_PEOPLE_RESTRICTION =
  "OBRIGATÓRIO: Não incluir pessoas, rostos ou figuras humanas na imagem. A arte deve conter apenas texto, elementos visuais, símbolos e o rodapé indicado. ";

type PreacherEntry = { name?: string; description?: string; image_urls?: string[] };
type SingerEntry = { name?: string; image_urls?: string[] };

/** Builds prompt only for church art (rodapé 3 colunas + tema, data/hora, louvores, preletores/cantores). */
function buildChurchArtPrompt(config: Record<string, unknown>): string {
  const multiPreachers = !!config.multi_preachers_enabled;
  const preachersArr = (Array.isArray(config.preachers) ? config.preachers : []) as PreacherEntry[];
  const singersArr = (Array.isArray(config.singers) ? config.singers : []) as SingerEntry[];
  const singersWithPhotos = !!config.singers_with_photos_enabled;

  const subjectImageUrls = Array.isArray(config.subject_image_urls)
    ? (config.subject_image_urls as string[]).filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];
  const singleSubjectName = (config.subject_name as string)?.trim() || "";

  const useMultiPreachers = multiPreachers && preachersArr.length > 0;
  const preacherNames = useMultiPreachers ? preachersArr.map((p) => (p.name || "").trim()).filter(Boolean) : [];
  const preacherPhotos = useMultiPreachers
    ? preachersArr.map((p) => (Array.isArray(p.image_urls) ? p.image_urls[0] : "")).filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];
  const hasPreacherImage = useMultiPreachers ? preacherPhotos.length > 0 : subjectImageUrls.length > 0;

  const singerNames = singersArr.map((s) => (s.name || "").trim()).filter(Boolean);
  const singerPhotos =
    singersArr.length > 0 && singersWithPhotos
      ? singersArr.map((s) => (Array.isArray(s.image_urls) ? s.image_urls[0] : "")).filter((u): u is string => typeof u === "string" && u.length > 0)
      : [];
  const hasSingerPhotos = singerPhotos.length > 0;
  const hasAnyPersonImage = hasPreacherImage || hasSingerPhotos;

  const textBlockParts: string[] = [];
  if (!hasAnyPersonImage) {
    textBlockParts.push(NO_PEOPLE_RESTRICTION);
  }
  const fp = (config.footer_pastor_presidente as string)?.trim() || "";
  const fi = (config.footer_igreja_nome as string)?.trim() || "";
  const fl = (config.footer_igreja_local as string)?.trim() || "";
  const fpl = (config.footer_pastor_local as string)?.trim() || "";
  const footerLines: string[] = [];
  footerLines.push("OBRIGATÓRIO - RODAPÉ FIXO na parte inferior da arte, em três colunas:");
  if (fp) footerLines.push("À ESQUERDA o texto exatamente: \"" + fp + "\".");
  else footerLines.push("À esquerda: deixar em branco ou não exibir.");
  footerLines.push("AO CENTRO: a logo da igreja (imagem anexa) com o nome da igreja \"" + (fi || "[nome da igreja]") + "\" e abaixo \"" + (fl || "[local]") + "\".");
  if (fpl) footerLines.push("À DIREITA o texto exatamente: \"" + fpl + "\".");
  else footerLines.push("À direita: deixar em branco ou não exibir.");
  footerLines.push("Manter esse layout fixo em três colunas.");
  textBlockParts.push(footerLines.join(" "));
  const h1 = (config.headline_h1 as string)?.trim() || "";
  const subtheme = (config.headline_subtheme as string)?.trim() || "";
  const eventDate = (config.event_date as string)?.trim() || "";
  const eventTime = (config.event_time as string)?.trim() || "";
  const h2 = (config.subheadline_h2 as string)?.trim() || "";
  const bodyLines: string[] = [];
  if (h1) bodyLines.push("Título principal em destaque: \"" + h1 + "\".");
  if (subtheme) bodyLines.push("Sub-tema/direção: \"" + subtheme + "\".");
  if (useMultiPreachers) {
    if (preacherNames.length) {
      if (hasPreacherImage) {
        bodyLines.push(
          "Preletores a exibir na arte: \"" + preacherNames.join(", ") + "\". Use as fotos anexas na ordem: " +
          preacherNames.map((_, i) => (i + 1) + "ª = Preletor " + (i + 1)).join(", ") + "."
        );
      } else {
        bodyLines.push("Exibir os nomes dos preletores como texto na arte: \"" + preacherNames.join(", ") + "\" (apenas texto, sem retrato ou figuras humanas).");
      }
    }
  } else if (singleSubjectName) {
    if (hasPreacherImage) bodyLines.push("Preletor a exibir na arte: \"" + singleSubjectName + "\" (use a(s) foto(s) do sujeito anexa(s) para o rosto).");
    else bodyLines.push("Exibir o nome do preletor como texto na arte: \"" + singleSubjectName + "\" (apenas texto, sem retrato ou figura humana).");
  }
  if (eventDate || eventTime) bodyLines.push("Data e horário do culto: \"" + [eventDate, eventTime].filter(Boolean).join(" às ") + "\".");
  if (singersArr.length > 0 && singerNames.length > 0) {
    bodyLines.push("Louvores/cantores: \"" + singerNames.join(", ") + "\".");
    if (hasSingerPhotos) {
      bodyLines.push("Use as fotos anexas dos cantores na ordem: " + singerNames.map((_, i) => (i + 1) + "ª = Cantor " + (i + 1)).join(", ") + ".");
    }
  } else if (h2) {
    bodyLines.push("Louvores/cantores: \"" + h2 + "\".");
  }
  if (bodyLines.length) textBlockParts.push("OBRIGATÓRIO - CONTEÚDO DA ARTE: " + bodyLines.join(" "));

  const parts: string[] = [];
  if (useMultiPreachers && preacherNames.length > 0) {
    if (hasPreacherImage) {
      const descParts = preachersArr.map((p) => (p.description || "").trim()).filter(Boolean);
      if (descParts.length) parts.push("Preletores: " + descParts.join(" | ") + ".");
      parts.push("A imagem deve conter exatamente " + preacherPhotos.length + " pessoa(s) (os preletores). As primeiras " + preacherPhotos.length + " imagem(ns) anexa(s) são os preletores, na ordem indicada.");
      parts.push("Arte de culto para igreja. Composição: tema principal, sub-tema ou direção, " + preacherPhotos.length + " preletores com foto, data e horário, louvores; rodapé fixo em três colunas conforme instruções de texto.");
    } else {
      parts.push("Arte de culto para igreja. Composição: tema principal, sub-tema ou direção, nomes dos preletores apenas como texto, data e horário, louvores; rodapé fixo em três colunas conforme instruções de texto. Sem pessoas, rostos ou figuras humanas na imagem.");
    }
  } else if (!useMultiPreachers) {
    if (hasPreacherImage) {
      const subjectDesc = (config.subject_description as string)?.trim() || "";
      if (subjectDesc) parts.push("Sujeito principal: " + subjectDesc + ".");
      parts.push("A imagem deve conter exatamente 1 sujeito/pessoa (o preletor).");
      parts.push("Arte de culto para igreja. Composição: tema principal, sub-tema ou direção, preletor com foto, data e horário, louvores; rodapé fixo em três colunas conforme instruções de texto.");
    } else {
      parts.push("Arte de culto para igreja. Composição: tema principal, sub-tema ou direção, nome do preletor apenas como texto, data e horário, louvores; rodapé fixo em três colunas conforme instruções de texto. Sem pessoas, rostos ou figuras humanas na imagem.");
    }
  } else {
    parts.push("Arte de culto para igreja. Composição: tema principal, sub-tema ou direção, data e horário, louvores; rodapé fixo em três colunas conforme instruções de texto.");
  }
  if (hasSingerPhotos) {
    parts.push("As imagens anexas após os preletores são dos cantores (use na ordem indicada para os rostos dos cantores).");
  }
  const styleRefs = Array.isArray(config.style_reference_urls) ? config.style_reference_urls : [];
  const styleInstructions = Array.isArray(config.style_reference_instructions) ? config.style_reference_instructions as string[] : [];
  if (styleRefs.length > 0) {
    const perRef: string[] = [];
    for (let i = 0; i < styleRefs.length; i++) {
      const t = styleInstructions[i] != null ? String(styleInstructions[i]).trim() : "";
      if (t) perRef.push("Referência " + (i + 1) + ": copie " + t + ".");
      else perRef.push("Referência " + (i + 1) + ": reproduza o estilo visual geral.");
    }
    if (perRef.length) parts.push("Das imagens de referência anexas: " + perRef.join(" ") + " A imagem gerada deve ser semelhante ao estilo enviado.");
    else parts.push("Copie e reproduza o estilo visual das imagens de referência anexas: cores, iluminação, composição e estética.");
  }
  const logoUrl = (config.logo_url as string)?.trim();
  if (logoUrl) parts.push("Inclua a logo anexa na arte, em posição visível e adequada (centro do rodapé).");
  const dims = (config.dimensions as string) || "1:1";
  parts.push("Formato: " + dims + ". Safe area para texto.");
  if ((config.additional_prompt as string)?.trim()) parts.push((config.additional_prompt as string).trim());
  const mainPrompt = parts.filter(Boolean).join(" ");
  const textBlock = textBlockParts.filter(Boolean).join(" ");
  return textBlock ? textBlock + " " + mainPrompt : mainPrompt;
}

/** Returns [preacherUrls, singerUrls] for multi mode; for single mode preacherUrls from subject_image_urls, singerUrls []. */
function getChurchArtImageUrls(config: Record<string, unknown>): { preacherUrls: string[]; singerUrls: string[] } {
  const multiPreachers = !!config.multi_preachers_enabled;
  const preachersArr = (Array.isArray(config.preachers) ? config.preachers : []) as PreacherEntry[];
  const singersArr = (Array.isArray(config.singers) ? config.singers : []) as SingerEntry[];
  const singersWithPhotos = !!config.singers_with_photos_enabled;
  const subjectImageUrls = Array.isArray(config.subject_image_urls)
    ? (config.subject_image_urls as string[]).filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];

  if (multiPreachers && preachersArr.length > 0) {
    const preacherUrls = preachersArr
      .map((p) => (Array.isArray(p.image_urls) ? p.image_urls[0] : "")).filter((u): u is string => typeof u === "string" && u.length > 0)
      .slice(0, 3);
    const singerUrls =
      singersArr.length > 0 && singersWithPhotos
        ? singersArr
            .map((s) => (Array.isArray(s.image_urls) ? s.image_urls[0] : "")).filter((u): u is string => typeof u === "string" && u.length > 0)
            .slice(0, 3)
        : [];
    return { preacherUrls, singerUrls };
  }
  const preacherUrls = subjectImageUrls.slice(0, 2);
  return { preacherUrls, singerUrls: [] };
}

const SUBJECT_FACE_INSTRUCTION =
  "Obrigatório: use sempre o rosto e a identidade da pessoa da(s) imagem(ns) de sujeito principal como rosto na imagem gerada. Mantenha a mesma pessoa. ";

const STYLE_REFERENCE_INSTRUCTION =
  "Copie o estilo das imagens de referência anexas. A imagem gerada deve ser semelhante ao estilo enviado: reproduza cores, iluminação, composição e estética visual. ";

const LOGO_INSTRUCTION = "Inclua a logo anexa na arte, em posição visível e adequada (ex.: canto inferior, junto ao texto ou à marca). ";

type Conn = { id: number; user_id: string; provider: string; api_key: string; api_url: string; default_model: string | null };

function getAspectRatio(dimensions: string): string {
  const d = (dimensions || "1:1").trim();
  if (d === "4:5" || d === "9:16" || d === "16:9") return d;
  return "1:1";
}

async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    
    // Otimização de memória: se a imagem for muito grande (> 2MB), não vamos converter para base64
    // para evitar estourar a memória da Edge Function.
    if (buf.byteLength > 2 * 1024 * 1024) {
      console.warn(`Imagem ignorada por ser muito grande: ${buf.byteLength} bytes`);
      return null;
    }
    
    const bytes = new Uint8Array(buf);
    let binary = "";
    
    // Processamento em chunks menores para não estourar a call stack
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const data = btoa(binary);
    const contentType = res.headers.get("content-type") || "";
    const mimeType = contentType.includes("png") ? "image/png" : contentType.includes("webp") ? "image/webp" : "image/jpeg";
    return { data, mimeType };
  } catch (e) {
    console.error("Erro ao baixar imagem:", e);
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
  logoUrl?: string
): Promise<{ url: string }[]> {
  const baseUrl = conn.api_url.replace(/\/$/, "");
  const model = conn.default_model || "gemini-2.5-flash-image";
  const url = `${baseUrl}/models/${model}:generateContent`;
  const aspectRatio = getAspectRatio(dimensions);
  let textPrompt = prompt;
  if (subjectImageUrls.length > 0) textPrompt = SUBJECT_FACE_INSTRUCTION + textPrompt;
  if (styleReferenceUrls.length > 0) textPrompt = (styleInstruction || STYLE_REFERENCE_INSTRUCTION) + textPrompt;
  if (logoUrl?.trim()) textPrompt = LOGO_INSTRUCTION + textPrompt;
  const urlsToFetch: string[] = [
    ...subjectImageUrls.slice(0, 6),
    ...styleReferenceUrls.slice(0, 3),
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
    throw new Error("Gemini " + res.status + ": " + text.slice(0, 300));
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
      urls.push({ url: "data:" + mime + ";base64," + inline.data });
      if (urls.length >= Math.min(quantity, 1)) break;
    }
  }
  if (urls.length === 0) throw new Error("A API não retornou imagens. Pode ser filtro de conteúdo ou limite. Tente outro prompt ou conexão.");
  return urls;
}

serve(async (req) => {
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Configuração do servidor incompleta (variáveis de ambiente)." }), { status: 200, headers: jsonHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: jsonHeaders });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token ausente" }), { status: 401, headers: jsonHeaders });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: jsonHeaders });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch (_) {
      return new Response(JSON.stringify({ error: "Corpo da requisição inválido (JSON esperado)." }), { status: 200, headers: jsonHeaders });
    }
    if (body === null || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Corpo da requisição deve ser um objeto JSON." }), { status: 200, headers: jsonHeaders });
    }
    const { projectId, configId, config, userAiConnectionId } = body as { projectId: string; configId?: string; config: Record<string, unknown>; userAiConnectionId?: string };

    if (!projectId || !config) {
      return new Response(JSON.stringify({ error: "projectId e config são obrigatórios" }), { status: 200, headers: jsonHeaders });
    }

    if (!userAiConnectionId) {
      return new Response(JSON.stringify({ error: "Selecione uma conexão de imagem (Google) no builder antes de gerar." }), { status: 200, headers: jsonHeaders });
    }

    const { data: project, error: projectError } = await supabase.from("neurodesign_projects").select("id, owner_user_id").eq("id", projectId).single();
    if (projectError || !project || project.owner_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Projeto não encontrado ou acesso negado" }), { status: 200, headers: jsonHeaders });
    }

    const { data: conn, error: connError } = await supabase
      .from("user_ai_connections")
      .select("id, user_id, provider, api_key, api_url, default_model")
      .eq("id", userAiConnectionId)
      .single();

    if (connError || !conn || conn.user_id !== user.id || !conn.api_key || !conn.api_url) {
      return new Response(JSON.stringify({ error: "Conexão de imagem não encontrada ou inválida. Verifique em Configurações → Minha IA." }), { status: 200, headers: jsonHeaders });
    }

    const quantityForApi = 1;
    const prompt = buildChurchArtPrompt(config);
    const { preacherUrls, singerUrls } = getChurchArtImageUrls(config);
    const subjectImageUrls: string[] = [...preacherUrls, ...singerUrls];
    const styleReferenceUrls: string[] = Array.isArray(config.style_reference_urls)
      ? (config.style_reference_urls as string[]).filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, 3)
      : [];
    const styleInstructionsArr = Array.isArray(config.style_reference_instructions) ? (config.style_reference_instructions as string[]).slice(0, styleReferenceUrls.length) : [];
    const perRefParts: string[] = [];
    for (let i = 0; i < styleReferenceUrls.length; i++) {
      const t = styleInstructionsArr[i] != null ? String(styleInstructionsArr[i]).trim() : "";
      if (t) perRefParts.push("Referência " + (i + 1) + ": copie " + t + ".");
      else perRefParts.push("Referência " + (i + 1) + ": reproduza o estilo visual geral.");
    }
    const styleInstruction = perRefParts.length > 0
      ? "Das imagens de referência anexas (na ordem): " + perRefParts.join(" ") + " A imagem gerada deve ser semelhante ao estilo enviado. "
      : undefined;
    const logoUrl = (config.logo_url && typeof config.logo_url === "string" && config.logo_url.trim()) ? config.logo_url.trim() : undefined;

    if (!prompt || !prompt.trim()) {
      return new Response(JSON.stringify({ error: "O prompt está vazio. Preencha pelo menos o tema ou o rodapé." }), { status: 200, headers: jsonHeaders });
    }

    const runInsert = {
      project_id: projectId,
      config_id: configId || null,
      type: "generate",
      status: "running",
      provider: "google",
      provider_request_json: { prompt, config: { ...config, subject_image_urls: undefined, preachers: undefined, singers: undefined, style_reference_urls: undefined, logo_url: undefined } },
    };
    const { data: run, error: runError } = await supabase.from("neurodesign_generation_runs").insert(runInsert).select("id").single();
    if (runError || !run) {
      return new Response(JSON.stringify({ error: runError?.message || "Erro ao criar run" }), { status: 200, headers: jsonHeaders });
    }

    const imageSize = normalizeImageSize(config.image_size);
    let images: { url: string }[];
    try {
      images = await enqueueUserGoogle(user.id, () =>
        generateWithGoogleGemini(
          conn as Conn,
          prompt,
          quantityForApi,
          (config.dimensions as string) || "1:1",
          imageSize,
          subjectImageUrls,
          styleReferenceUrls,
          styleInstruction,
          logoUrl
        )
      );
    } catch (apiErr) {
      await supabase.from("neurodesign_generation_runs").update({ error_message: String(apiErr), completed_at: new Date().toISOString() }).eq("id", run.id);
      return new Response(JSON.stringify({ error: String(apiErr) }), { status: 200, headers: jsonHeaders });
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
      .select("id, run_id, project_id, url, thumbnail_url, width, height, created_at");

    if (insertError) {
      await supabase
        .from("neurodesign_generation_runs")
        .update({ status: "error", error_message: insertError.message, completed_at: new Date().toISOString() })
        .eq("id", run.id);
      return new Response(JSON.stringify({ error: "Erro ao salvar imagens: " + insertError.message }), { status: 200, headers: jsonHeaders });
    }

    await supabase.from("neurodesign_generation_runs").update({
      status: "success",
      provider: "google",
      error_message: null,
      provider_response_json: { images: insertedImages },
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);

    const { data: toKeep } = await supabase.from("neurodesign_generated_images").select("id").eq("project_id", projectId).order("created_at", { ascending: false }).range(0, 4);
    const keepSet = new Set((toKeep || []).map((r) => r.id));
    
    // Deleta imagens que não estão entre as 5 mais recentes OU que são mais antigas que 1 hora
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: all } = await supabase.from("neurodesign_generated_images").select("id, created_at").eq("project_id", projectId);
    
    const idsToDelete = (all || [])
      .filter((r) => !keepSet.has(r.id) || r.created_at < oneHourAgo)
      .map((r) => r.id);
      
    if (idsToDelete.length > 0) {
      await supabase.from("neurodesign_generated_images").delete().in("id", idsToDelete);
    }

    // Deleta os runs (histórico de geração) que são mais antigos que 1 hora para liberar espaço
    await supabase.from("neurodesign_generation_runs")
      .delete()
      .eq("project_id", projectId)
      .lt("created_at", oneHourAgo);

    const payload = insertedImages?.length
      ? insertedImages
      : imageRows.map((r) => ({ run_id: run.id, project_id: projectId, url: r.url, thumbnail_url: r.url, width: 1024, height: 1024 }));
    return new Response(JSON.stringify({ runId: run.id, images: payload }), { headers: jsonHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
