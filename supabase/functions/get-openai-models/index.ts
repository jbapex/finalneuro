/**
 * Edge Function: get-openai-models
 * Lista modelos disponíveis na API OpenAI.
 * Usado em Conexões de Modelos de Linguagem para exibir modelos ao informar a API key.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";

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

    const res = await fetch(OPENAI_MODELS_URL, {
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
          error: "Falha ao buscar modelos da API OpenAI",
          details:
            res.status === 401 || res.status === 403
              ? "Chave da API inválida ou sem permissão."
              : text.slice(0, 300),
        }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = (await res.json()) as { data?: Array<{ id: string; object?: string }> };
    const rawList = Array.isArray(data?.data) ? data.data : [];

    const models = rawList
      .map((m) => ({
        id: m?.id ?? "",
        name: m?.id ?? "",
      }))
      .filter((m) => m.id.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

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
