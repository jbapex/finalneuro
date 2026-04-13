/**
 * Gera um título curto para a conversa (Chat IA), após a primeira troca usuário ↔ assistente.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { enqueueUserGoogle } from "../_shared/googleUserQueue.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEOUT_MS = 45_000;

const SYSTEM_PT =
  `Você gera um título curto para uma conversa de chat em português do Brasil.

REGRAS:
- No máximo 8 palavras.
- Sem aspas, sem dois-pontos no início, sem emoji.
- Descreva o tema ou objetivo principal da conversa (não "Conversa com IA" nem genérico).
- Se o usuário só anexou arquivos sem texto, infira o tema pelo conteúdo da resposta do assistente.
- Responda APENAS com uma linha: o título, sem texto extra.`;

function cleanTitle(raw: string): string {
  let t = raw.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ");
  if (t.length > 120) t = `${t.slice(0, 117)}…`;
  return t;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const firstUser = String(body.first_user_message || "").trim();
    const firstAssistant = String(body.first_assistant_message || "").trim();
    const llmIntegrationId = body.llm_integration_id;
    const isUserConnection = body.is_user_connection === true;

    if (!firstAssistant) {
      return new Response(
        JSON.stringify({ error: "first_assistant_message é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let apiKey = "";
    let apiUrl = "";
    let model = "gpt-4o-mini";
    let isGoogle = false;

    if (llmIntegrationId) {
      if (isUserConnection) {
        const { data: conn, error } = await supabase
          .from("user_ai_connections")
          .select("id, user_id, provider, api_key, api_url, default_model")
          .eq("id", llmIntegrationId)
          .eq("user_id", user.id)
          .single();
        if (error || !conn) {
          return new Response(
            JSON.stringify({ error: "Conexão de IA não encontrada ou sem permissão" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        apiKey = conn.api_key || "";
        apiUrl = (conn.api_url || "").trim().replace(/\/$/, "");
        if (!apiUrl && String((conn as { provider?: string }).provider || "").toLowerCase() === "google") {
          apiUrl = "https://generativelanguage.googleapis.com";
        }
        isGoogle = String((conn as { provider?: string }).provider || "").toLowerCase() === "google";
        model = conn.default_model || model;
      } else {
        const { data: conn, error } = await supabase
          .from("llm_integrations")
          .select("id, api_key, api_url, default_model")
          .eq("id", llmIntegrationId)
          .single();
        if (error || !conn) {
          return new Response(JSON.stringify({ error: "Integração de IA não encontrada" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        apiKey = conn.api_key || "";
        apiUrl = (conn.api_url || "").trim().replace(/\/$/, "");
        isGoogle = apiUrl.includes("generativelanguage.googleapis.com");
        model = conn.default_model || model;
      }
    }

    if (!apiKey || !apiUrl) {
      return new Response(
        JSON.stringify({ error: "Nenhuma conexão de IA configurada." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const uBlock = firstUser.length > 8000 ? `${firstUser.slice(0, 8000)}…` : firstUser;
    const aBlock = firstAssistant.length > 12000 ? `${firstAssistant.slice(0, 12000)}…` : firstAssistant;

    const userPrompt =
      `Primeira mensagem do usuário:\n${uBlock || "(sem texto, só anexos ou contexto implícito)"}\n\n` +
      `Primeira resposta do assistente:\n${aBlock}`;

    const chatMessages = [
      { role: "system", content: SYSTEM_PT },
      { role: "user", content: userPrompt },
    ];

    const runCompletion = async (): Promise<Response> => {
      const chatUrl = isGoogle
        ? `${apiUrl}/v1beta/openai/chat/completions`
        : apiUrl.includes("/v1")
        ? `${apiUrl}/chat/completions`
        : `${apiUrl}/v1/chat/completions`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const res = await fetch(chatUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: chatMessages,
            stream: false,
            temperature: 0.25,
            max_tokens: 80,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const rawText = await res.text();
        if (!res.ok) {
          return new Response(
            JSON.stringify({
              error: `API de IA retornou erro: ${res.status}`,
              details: rawText.slice(0, 400),
            }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        let content = "";
        try {
          const data = JSON.parse(rawText) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const c = data?.choices?.[0]?.message?.content;
          content = typeof c === "string" ? c : "";
        } catch {
          return new Response(
            JSON.stringify({ error: "Resposta da IA inválida (JSON)." }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const title = cleanTitle(content.split("\n")[0] || "");
        if (!title) {
          return new Response(JSON.stringify({ error: "Título vazio" }), {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ title }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        clearTimeout(timeoutId);
        const errMsg = e instanceof Error ? e.message : String(e);
        return new Response(
          JSON.stringify({ error: "Falha ao conectar com a API de IA.", details: errMsg.slice(0, 200) }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    };

    if (isUserConnection && isGoogle) {
      return await enqueueUserGoogle(user.id, runCompletion);
    }
    return await runCompletion();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: "Erro interno.", details: msg.slice(0, 300) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
