/**
 * Edge Function: get-openrouter-models
 * Lista modelos disponíveis na API OpenRouter.
 * Usado na Nova Conexão de Imagem para exibir modelos de geração de imagem ao informar a API key.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Inclui embeddings, imagem, etc.; sem o parâmetro a API omite dezenas de modelos. */
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models?output_modalities=all";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const apiKey = body?.apiKey ?? body?.api_key ?? "";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "apiKey é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch(OPENROUTER_MODELS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(
        JSON.stringify({
          error: "Falha ao buscar modelos da API OpenRouter",
          details:
            res.status === 401 || res.status === 403
              ? "Chave da API inválida ou sem permissão."
              : text.slice(0, 300),
        }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const rawList = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
        ? data.models
        : Array.isArray(data)
          ? data
          : [];

    const models = rawList.map((m: Record<string, unknown>) => {
      const arch = m?.architecture as Record<string, unknown> | undefined;
      const outputModalities = arch?.output_modalities as string[] | undefined;
      const topLevelModalities = m?.output_modalities as string[] | undefined;
      const modalities = Array.isArray(outputModalities)
        ? outputModalities
        : Array.isArray(topLevelModalities)
          ? topLevelModalities
          : [];
      const architecture =
        arch && typeof arch === "object"
          ? {
            modality: arch.modality,
            input_modalities: arch.input_modalities,
            output_modalities: Array.isArray(arch.output_modalities) ? arch.output_modalities : modalities,
          }
          : { output_modalities: modalities };

      return {
        id: String(m?.id ?? m?.name ?? ""),
        name: String(m?.name ?? m?.id ?? ""),
        architecture,
      };
    }).filter((m) => m.id.length > 0);

    return new Response(JSON.stringify({ models }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Erro ao buscar modelos",
        details: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
