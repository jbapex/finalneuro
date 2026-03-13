import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STORAGE_BUCKET = "neurodesign";

function getStoragePathFromPublicUrl(imageUrl: string, supabaseUrl: string): string | null {
  const base = supabaseUrl.replace(/\/$/, "");
  const prefix = `${base}/storage/v1/object/public/${STORAGE_BUCKET}/`;
  if (!imageUrl || !imageUrl.startsWith(prefix)) return null;
  return imageUrl.slice(prefix.length);
}

async function ensureFetchableUrl(
  imageUrl: string,
  supabaseUrl: string,
  supabase: { storage: { from: (bucket: string) => { createSignedUrl: (path: string, expiresIn: number) => Promise<{ data: { signedUrl: string } | null; error: unknown }> } } }
): Promise<string> {
  if (imageUrl.startsWith("data:")) return imageUrl;
  const path = getStoragePathFromPublicUrl(imageUrl, supabaseUrl);
  if (!path) return imageUrl;
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 120);
  if (error || !data?.signedUrl) return imageUrl;
  return data.signedUrl;
}

function getDimensionsFromConfig(dimensions: string | undefined): { width: number; height: number } {
  const d = (dimensions || "1:1").trim();
  if (d === "4:5") return { width: 1024, height: 1280 };
  if (d === "9:16") return { width: 1024, height: 1820 };
  if (d === "16:9") return { width: 1820, height: 1024 };
  return { width: 1024, height: 1024 };
}

function getAspectRatio(dimensions: string | undefined): string {
  const d = (dimensions || "1:1").trim();
  if (d === "4:5" || d === "9:16" || d === "16:9") return d;
  return "1:1";
}

type Conn = { id: number; user_id: string; provider: string; api_key: string; api_url: string; default_model: string | null };

async function imageUrlToBase64(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) return { data: match[2], mimeType: match[1].trim() || "image/png" };
  }
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    
    if (buf.byteLength > 2 * 1024 * 1024) {
      console.warn(`Imagem ignorada por ser muito grande: ${buf.byteLength} bytes`);
      return null;
    }
    
    const bytes = new Uint8Array(buf);
    let binary = "";
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

async function refineWithGoogleGemini(conn: Conn, imageUrls: string[], textPrompt: string, dimensions: string | undefined, imageSize: "1K" | "2K" | "4K"): Promise<{ url: string } | null> {
  const baseUrl = conn.api_url.replace(/\/$/, "");
  const model = conn.default_model || "gemini-2.5-flash-image";
  const apiUrl = `${baseUrl}/models/${model}:generateContent`;
  const results = await Promise.all(imageUrls.map(imageUrlToBase64));
  if (results.some((r) => r === null)) return null;
  const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = results
    .filter((r): r is { data: string; mimeType: string } => r !== null)
    .map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));
  parts.push({ text: textPrompt });
  const aspectRatio = getAspectRatio(dimensions);
  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      ...(aspectRatio && { imageConfig: { aspectRatio, imageSize } }),
    },
  };
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": conn.api_key },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
  };
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) return null;
  const mime = part.inlineData.mimeType || "image/png";
  return { url: `data:${mime};base64,${part.inlineData.data}` };
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
    const {
      projectId,
      runId,
      imageId,
      instruction,
      configOverrides,
      userAiConnectionId,
      referenceImageUrl,
      replacementImageUrl,
      addImageUrl,
      region,
      regionCropImageUrl,
      selectionAction,
      selectionText,
      selectionFont,
      selectionFontStyle,
    } = body as {
      projectId: string;
      runId: string;
      imageId: string;
      instruction?: string;
      configOverrides?: Record<string, unknown>;
      userAiConnectionId?: string;
      referenceImageUrl?: string;
      replacementImageUrl?: string;
      addImageUrl?: string;
      region?: { x: number; y: number; width: number; height: number };
      regionCropImageUrl?: string;
      selectionAction?: string;
      selectionText?: string;
      selectionFont?: string;
      selectionFontStyle?: string;
    };

    const instructionTrimmed = (instruction ?? "").trim();
    const selectionTextTrimmed = (selectionText ?? "").trim();
    const dimensionsOverride = (configOverrides?.dimensions as string)?.trim();
    const hasSelectionAction = region && regionCropImageUrl && selectionAction;
    const hasAnyAction =
      hasSelectionAction ||
      instructionTrimmed ||
      referenceImageUrl ||
      replacementImageUrl ||
      addImageUrl ||
      region ||
      (dimensionsOverride && dimensionsOverride !== "1:1");
    if (!projectId || !runId || !imageId) {
      return new Response(JSON.stringify({ error: "projectId, runId e imageId são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!hasAnyAction) {
      return new Response(JSON.stringify({ error: "Envie ao menos uma ação: instrução, referência de arte, imagem para substituir, imagem para adicionar na cena ou região selecionada" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!userAiConnectionId) {
      return new Response(JSON.stringify({ error: "Conexão de imagem (Google) é obrigatória" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: project, error: projectError } = await supabase.from("neurodesign_projects").select("id, owner_user_id").eq("id", projectId).single();
    if (projectError || !project || project.owner_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Projeto não encontrado ou acesso negado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: sourceImage, error: imgError } = await supabase
      .from("neurodesign_generated_images")
      .select("id, url, thumbnail_url, project_id")
      .eq("id", imageId)
      .eq("project_id", projectId)
      .single();
    if (imgError || !sourceImage?.url) {
      return new Response(JSON.stringify({ error: "Imagem não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: existingRun } = await supabase.from("neurodesign_generation_runs").select("id, config_id").eq("id", runId).eq("project_id", projectId).single();
    if (!existingRun) {
      return new Response(JSON.stringify({ error: "Execução não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: conn, error: connError } = await supabase
      .from("user_ai_connections")
      .select("id, user_id, provider, api_key, api_url, default_model")
      .eq("id", userAiConnectionId)
      .single();

    if (connError || !conn || conn.user_id !== user.id || !conn.api_key) {
      return new Response(JSON.stringify({ error: "Conexão de imagem não encontrada ou inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const runInsert = {
      project_id: projectId,
      config_id: existingRun.config_id,
      type: "refine",
      status: "running",
      provider: "google",
      parent_run_id: runId,
      refine_instruction: instructionTrimmed,
      provider_request_json: {
        instruction: instructionTrimmed,
        configOverrides,
        referenceImageUrl: referenceImageUrl ?? null,
        replacementImageUrl: replacementImageUrl ?? null,
        addImageUrl: addImageUrl ?? null,
        region: region ?? null,
        regionCropImageUrl: regionCropImageUrl ?? null,
        selectionAction: selectionAction ?? null,
        selectionText: selectionTextTrimmed || null,
        selectionFont: (selectionFont ?? "").trim() || null,
        selectionFontStyle: (selectionFontStyle ?? "").trim() || null,
      },
    };
    const { data: run, error: runError } = await supabase.from("neurodesign_generation_runs").insert(runInsert).select("id").single();
    if (runError || !run) {
      return new Response(JSON.stringify({ error: runError?.message || "Erro ao criar run de refino" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sourceImageUrl = sourceImage.url || sourceImage.thumbnail_url;
    const imageUrls: string[] = [sourceImageUrl];
    let textPrompt: string;

    if (region && regionCropImageUrl && selectionAction) {
      switch (selectionAction) {
        case "add_text": {
          imageUrls.push(regionCropImageUrl);
          const fontName = (selectionFont ?? "").trim();
          const fontStyleRaw = (selectionFontStyle ?? "").trim().toLowerCase();
          const fontStyleMap: Record<string, string> = {
            elegante: "elegant",
            moderno: "modern",
            negrito: "bold",
            script: "script or cursive",
            minimalista: "minimalist",
            retro: "retro/vintage",
            corporate: "corporate/professional",
          };
          const fontStyleEn = fontStyleRaw && fontStyleMap[fontStyleRaw] ? fontStyleMap[fontStyleRaw] : "";
          let typographyHint = "";
          if (fontName) typographyHint += ` Use the font named "${fontName}" or a very similar one.`;
          if (fontStyleEn) typographyHint += ` The typography should be ${fontStyleEn} style.`;
          if (selectionTextTrimmed) {
            textPrompt = `In the first image, add the following text inside or at the selected region (the second image shows the exact area). Text to add: "${selectionTextTrimmed}". Make the text look integrated and professional with the scene.${typographyHint} Do not change the rest of the image.`;
          } else {
            textPrompt = instructionTrimmed
              ? `Apply this change only to the selected region (second image) of the first image. Keep the rest unchanged. ${instructionTrimmed}`
              : "Apply minimal adjustments to the selected region only. Keep the rest of the image unchanged.";
          }
          break;
        }
        case "remove_text":
          imageUrls.push(regionCropImageUrl);
          textPrompt = "In the first image, remove only the text or text-like content that appears in the selected region (shown in the second image). Leave the rest of the image completely unchanged. Fill or blend the area where text was removed so it looks natural.";
          break;
        case "remove_content":
          imageUrls.push(regionCropImageUrl);
          textPrompt = "In the first image, remove all content inside the selected region (shown in the second image). Fill that area naturally so it blends with the surrounding background. Do not change anything outside the selected region.";
          break;
        case "replace":
          if (replacementImageUrl) {
            imageUrls.push(regionCropImageUrl, replacementImageUrl);
            textPrompt = instructionTrimmed
              ? `In the first image, replace the region that corresponds to the content shown in the second image (the selected crop) with the content of the third image. Keep the rest of the first image unchanged. ${instructionTrimmed}`
              : "In the first image, replace the region that corresponds to the content shown in the second image (the selected crop) with the content of the third image. Keep the rest of the first image unchanged.";
          } else {
            imageUrls.push(regionCropImageUrl);
            textPrompt = instructionTrimmed
              ? `Apply this change only to the selected region (second image) of the first image. ${instructionTrimmed}`
              : "Apply minimal adjustments to the selected region only. Keep the rest of the image unchanged.";
          }
          break;
        case "free":
        default:
          imageUrls.push(regionCropImageUrl);
          textPrompt = instructionTrimmed
            ? `In the first image, apply the following change only to the selected region (shown in the second image). Leave the rest of the image unchanged. Instruction: ${instructionTrimmed}`
            : "Apply minimal adjustments to the selected region only. Keep the rest of the image unchanged.";
          break;
      }
    } else if (referenceImageUrl && !replacementImageUrl) {
      imageUrls.push(referenceImageUrl);
      textPrompt = instructionTrimmed
        ? `Apply the visual style of the second image (reference art) to the first image. Keep the same composition and subject of the first image, but make it look similar to the reference. Additional instruction: ${instructionTrimmed}`
        : "Apply the visual style of the second image (reference art) to the first image. Keep the same composition and subject of the first image, but make it look similar to the reference.";
    } else if (replacementImageUrl) {
      if (regionCropImageUrl) {
        imageUrls.push(regionCropImageUrl, replacementImageUrl);
        textPrompt = instructionTrimmed
          ? `In the first image, replace the region that corresponds to the content shown in the second image (the selected crop) with the content of the third image. Keep the rest of the first image unchanged. ${instructionTrimmed}`
          : "In the first image, replace the region that corresponds to the content shown in the second image (the selected crop) with the content of the third image. Keep the rest of the first image unchanged.";
      } else {
        imageUrls.push(replacementImageUrl);
        textPrompt = instructionTrimmed
          ? `In the first image, replace the element or area described in the following instruction with the content of the second image. Keep the rest unchanged. Instruction: ${instructionTrimmed}`
          : "In the first image, replace the element or area with the content of the second image. Keep the rest unchanged.";
      }
    } else {
      textPrompt = instructionTrimmed
        ? `Apply this change to the image, keep the rest the same: ${instructionTrimmed}`
        : "Apply minimal adjustments to the image.";
    }

    if (addImageUrl) {
      imageUrls.push(addImageUrl);
      const addPart = instructionTrimmed
        ? ` The last image is an element to add into the first image's scene. Integrate it naturally. User instruction: ${instructionTrimmed}`
        : " The last image is an element to add into the first image's scene. Integrate it naturally.";
      textPrompt = (textPrompt + addPart).trim();
    }

    const dimensionsForApi = (dimensionsOverride || (configOverrides?.dimensions as string) || "").trim() || "1:1";
    const imageSizeForApi = normalizeImageSize(configOverrides?.image_size);
    const aspectRatioForPrompt = getAspectRatio(dimensionsForApi);
    const hasDimensionOverride = aspectRatioForPrompt && aspectRatioForPrompt !== "1:1";
    const hasOtherAction = !!(
      instructionTrimmed ||
      (region && regionCropImageUrl && selectionAction) ||
      referenceImageUrl ||
      replacementImageUrl ||
      addImageUrl
    );
    if (hasDimensionOverride) {
      const aspectRatioInstruction = `Recreate this image in exactly ${aspectRatioForPrompt} aspect ratio. Fill the entire frame with the same scene, style and subjects; extend or recompose the composition so the new frame is fully filled with content. Do not add black bars, letterboxing, or empty borders. Output a single coherent image in the requested aspect ratio.`;
      if (!hasOtherAction) {
        textPrompt = aspectRatioInstruction + (instructionTrimmed ? ` Also apply: ${instructionTrimmed}` : "");
      } else {
        textPrompt = (textPrompt + " " + aspectRatioInstruction).trim();
      }
    }

    const resolvedImageUrls: string[] = [];
    for (const u of imageUrls) {
      resolvedImageUrls.push(await ensureFetchableUrl(u, supabaseUrl, supabase));
    }

    const userUploadUrls: { url: string; label: string }[] = [];
    if (referenceImageUrl) userUploadUrls.push({ url: referenceImageUrl, label: "referência de arte" });
    if (replacementImageUrl) userUploadUrls.push({ url: replacementImageUrl, label: "imagem para substituir" });
    if (addImageUrl) userUploadUrls.push({ url: addImageUrl, label: "imagem para adicionar na cena" });
    if (regionCropImageUrl) userUploadUrls.push({ url: regionCropImageUrl, label: "região selecionada" });
    for (let i = 0; i < userUploadUrls.length; i++) {
      const resolved = resolvedImageUrls[imageUrls.indexOf(userUploadUrls[i].url)] ?? userUploadUrls[i].url;
      const data = await imageUrlToBase64(resolved);
      if (!data) {
        return new Response(
          JSON.stringify({ error: `Não foi possível acessar a imagem de ${userUploadUrls[i].label}. Verifique o upload e tente novamente.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let refinedUrl: string | null = null;
    try {
      const result = await refineWithGoogleGemini(conn as Conn, resolvedImageUrls, textPrompt, dimensionsForApi, imageSizeForApi);
      if (result) refinedUrl = result.url;
    } catch (apiErr) {
      await supabase
        .from("neurodesign_generation_runs")
        .update({ error_message: String(apiErr), completed_at: new Date().toISOString() })
        .eq("id", run.id);
      return new Response(JSON.stringify({ error: String(apiErr) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!refinedUrl) {
      await supabase
        .from("neurodesign_generation_runs")
        .update({ status: "error", error_message: "Refino não retornou imagem", completed_at: new Date().toISOString() })
        .eq("id", run.id);
      return new Response(JSON.stringify({ error: "Refino não retornou imagem da API Google" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { width, height } = getDimensionsFromConfig(dimensionsForApi);
    const imageRow = {
      run_id: run.id,
      project_id: projectId,
      url: refinedUrl,
      thumbnail_url: refinedUrl,
      width,
      height,
    };
    const { data: insertedImages, error: insertError } = await supabase.from("neurodesign_generated_images").insert([imageRow]).select("id, url, thumbnail_url, width, height");
    if (insertError) {
      await supabase
        .from("neurodesign_generation_runs")
        .update({ status: "error", error_message: insertError.message, completed_at: new Date().toISOString() })
        .eq("id", run.id);
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    const { data: all } = await supabase.from("neurodesign_generated_images").select("id").eq("project_id", projectId);
    const idsToDelete = (all || []).filter((r) => !keepSet.has(r.id)).map((r) => r.id);
    if (idsToDelete.length > 0) await supabase.from("neurodesign_generated_images").delete().in("id", idsToDelete);

    return new Response(JSON.stringify({ runId: run.id, images: insertedImages || [imageRow] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
