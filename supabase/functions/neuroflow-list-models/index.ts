import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeModelName(raw: unknown): string {
  const s = String(raw || "").trim();
  // Sometimes API returns: "models/<id>".
  return s.replace(/^models\//i, "");
}

function looksLikeVideoModel(modelId: string): boolean {
  const m = String(modelId || "").toLowerCase();
  return m.includes("veo") || m.startsWith("veo-");
}

function looksLikeImageModel(modelId: string): boolean {
  const m = String(modelId || "").toLowerCase();
  if (looksLikeVideoModel(modelId)) return false;
  // Gemini image models + Imagen models usually contain these tokens.
  return m.includes("image") || m.includes("imagen");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const apiKey = String(body?.apiKey || body?.api_key || "").trim();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "apiKey é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=100`;
    const res = await fetch(url);
    const text = await res.text();

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: "Falha ao buscar modelos da API Google",
          details: res.status === 401 || res.status === 403 ? "Chave da API inválida ou sem permissão." : text.slice(0, 200),
        }),
        {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch (_) {}

    const modelsArr = Array.isArray(data?.models) ? data.models : [];

    const videoModels: string[] = [];
    const imageModels: string[] = [];

    for (const m of modelsArr) {
      const id = normalizeModelName(m?.name ?? m?.id ?? m);
      if (!id) continue;
      if (looksLikeVideoModel(id)) videoModels.push(id);
      else if (looksLikeImageModel(id)) imageModels.push(id);
    }

    // Dedup + stable order
    const dedup = (arr: string[]) => Array.from(new Set(arr));

    return new Response(
      JSON.stringify({
        videoModels: dedup(videoModels),
        imageModels: dedup(imageModels),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Erro ao buscar modelos",
        details: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
