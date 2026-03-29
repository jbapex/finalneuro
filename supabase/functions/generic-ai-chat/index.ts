/**
 * Edge Function: generic-ai-chat
 * Chat com IA (OpenAI-compatible). Usado pelo Gerador de Conteúdo, Agente, NeuroDesign Preencher, etc.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { enqueueUserGoogle } from "../_shared/googleUserQueue.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Timeout da chamada à API de IA (ms). 5 min. O Kong/gateway precisa ter timeout >= este valor. */
const LLM_REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

/** Conteúdo texto ou multimodal (OpenAI: array com type text / image_url). */
type Message = { role: string; content: string | Array<Record<string, unknown>> };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const messages = (body.messages as Message[]) || [];
    const llmIntegrationId = body.llm_integration_id;
    const isUserConnection = body.is_user_connection === true;

    if (!messages.length) {
      return new Response(
        JSON.stringify({ error: "messages is required and must be a non-empty array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        apiKey = conn.api_key || "";
        apiUrl = (conn.api_url || "").trim().replace(/\/$/, "");
        if (!apiUrl && (conn as { provider?: string }).provider?.toLowerCase() === "google") {
          apiUrl = "https://generativelanguage.googleapis.com";
        }
        isGoogle = (conn as { provider?: string }).provider?.toLowerCase() === "google";
        model = conn.default_model || model;
      } else {
        const { data: conn, error } = await supabase
          .from("llm_integrations")
          .select("id, api_key, api_url, default_model")
          .eq("id", llmIntegrationId)
          .single();
        if (error || !conn) {
          return new Response(
            JSON.stringify({ error: "Integração de IA não encontrada" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        apiKey = conn.api_key || "";
        apiUrl = (conn.api_url || "").trim().replace(/\/$/, "");
        isGoogle = apiUrl.includes("generativelanguage.googleapis.com");
        model = conn.default_model || model;
      }
    }

    if (!apiKey || !apiUrl) {
      return new Response(
        JSON.stringify({
          error: "Nenhuma conexão de IA configurada. Configure em Minha IA ou selecione uma integração.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const runChatCompletion = async (): Promise<Response> => {
    // Google Gemini: endpoint compatível com OpenAI é /v1beta/openai/chat/completions
    const chatUrl = isGoogle
      ? `${apiUrl}/v1beta/openai/chat/completions`
      : apiUrl.includes("/v1") ? `${apiUrl}/chat/completions` : `${apiUrl}/v1/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_REQUEST_TIMEOUT_MS);

    const bodyPayload: Record<string, unknown> = {
      model,
      messages: messages.map((m) => {
        const c = m.content;
        if (Array.isArray(c)) {
          return { role: m.role, content: c };
        }
        return { role: m.role, content: typeof c === "string" ? c : String(c ?? "") };
      }),
      stream: false,
    };
    // Opção B: para Google, tentar pedir raciocínio; se API retornar 4xx, refazer sem o parâmetro (não devolver 502)
    if (isGoogle) {
      bodyPayload.reasoning_effort = "medium";
    }

    const doFetch = (payload: Record<string, unknown>) =>
      fetch(chatUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

    let res: Response;
    try {
      res = await doFetch(bodyPayload);
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      const isTimeout = fetchErr instanceof Error && fetchErr.name === "AbortError";
      if (isTimeout) {
        return new Response(
          JSON.stringify({
            error: "A resposta da IA demorou muito (timeout). Tente um pedido mais curto ou tente novamente em instantes.",
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      return new Response(
        JSON.stringify({
          error: "Falha ao conectar com a API de IA. Verifique sua conexão e tente novamente.",
          details: errMsg.slice(0, 300),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    clearTimeout(timeoutId);

    let rawText = await res.text();

    if (!res.ok && isGoogle && res.status >= 400 && res.status < 500 && bodyPayload.reasoning_effort) {
      delete bodyPayload.reasoning_effort;
      try {
        const res2 = await doFetch(bodyPayload);
        const rawText2 = await res2.text();
        if (res2.ok) {
          res = res2;
          rawText = rawText2;
        }
      } catch (_) {
        // mantém primeira resposta para retornar 502 abaixo
      }
    }

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: `API de IA retornou erro: ${res.status}`,
          details: rawText.slice(0, 500),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let content = "";
    let reasoning: string | undefined;
    try {
      const data = JSON.parse(rawText) as Record<string, unknown>;

      // Log temporário: inspecionar estrutura da resposta para ajustar parsing (remover após validar)
      if (isGoogle && res.ok) {
        const msg = (data?.choices as Array<{ message?: Record<string, unknown> }>)?.[0]?.message;
        const keys = msg ? Object.keys(msg) : [];
        console.log("[generic-ai-chat] Resposta Google – top-level keys:", Object.keys(data).join(", "), "| message keys:", keys.join(", "));
      }

      const choices = data?.choices as Array<{
        message?: {
          content?: string | Array<{ type?: string; text?: string }>;
          reasoning_content?: string;
          thought?: string;
          thinking?: string;
          reasoning?: string;
        };
      }> | undefined;

      if (choices?.[0]?.message) {
        const msg = choices[0].message;
        // OpenAI o1/o3: reasoning_content no message
        const reasoningContent = msg.reasoning_content;
        if (typeof reasoningContent === "string" && reasoningContent.trim()) {
          reasoning = reasoningContent.trim();
        }
        // Outros nomes possíveis para raciocínio (Gemini/adapters)
        if (!reasoning && typeof (msg as Record<string, unknown>).thought === "string") {
          reasoning = (msg as { thought: string }).thought.trim();
        }
        if (!reasoning && typeof (msg as Record<string, unknown>).thinking === "string") {
          reasoning = (msg as { thinking: string }).thinking.trim();
        }
        if (!reasoning && typeof (msg as Record<string, unknown>).reasoning === "string") {
          reasoning = (msg as { reasoning: string }).reasoning.trim();
        }
        // content pode ser string ou array de parts (thinking + text)
        const rawContent = msg.content;
        if (typeof rawContent === "string") {
          content = rawContent;
        } else if (Array.isArray(rawContent)) {
          let mainText = "";
          for (const part of rawContent) {
            const partType = (part as { type?: string })?.type;
            const partText = (part as { text?: string })?.text;
            if (partType === "thinking" || partType === "reasoning" || partType === "thought") {
              if (partText && !reasoning) reasoning = String(partText).trim();
            } else if (partText) {
              mainText += (mainText ? "\n" : "") + String(partText);
            }
          }
          if (mainText) content = mainText;
        }
      }

      // Gemini (formato nativo ou resposta alternativa): candidates[0].content.parts com part.thought === true = raciocínio
      const candidates = data?.candidates as Array<{
        content?: { parts?: Array<{ text?: string; thought?: boolean; inlineData?: unknown }> };
      }> | undefined;
      const parts = candidates?.[0]?.content?.parts;
      if (parts?.length) {
        const reasoningParts: string[] = [];
        const contentParts: string[] = [];
        for (const part of parts) {
          if (!part?.text) continue;
          const text = String(part.text).trim();
          if (text) {
            if (part.thought === true) {
              reasoningParts.push(text);
            } else {
              contentParts.push(text);
            }
          }
        }
        if (reasoningParts.length && !reasoning) {
          reasoning = reasoningParts.join("\n\n");
        }
        if (contentParts.length) {
          content = contentParts.join("\n");
        }
        // Fallback: se não separou por thought, primeiro part = raciocínio e segundo = resposta
        if (!content && parts.length >= 2 && parts[0].text && parts[1].text) {
          if (!reasoning) reasoning = String(parts[0].text).trim();
          content = String(parts[1].text);
        } else if (!content && parts[0].text) {
          content = String(parts[0].text);
        }
      }
    } catch (_) {
      return new Response(
        JSON.stringify({
          error: "A API de IA retornou uma resposta inválida (não é JSON). Tente novamente.",
          details: rawText.slice(0, 300),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = reasoning
      ? { response: content, reasoning }
      : { response: content };
    return new Response(
      JSON.stringify(payload),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    };

    if (isUserConnection && isGoogle) {
      return await enqueueUserGoogle(user.id, runChatCompletion);
    }
    return await runChatCompletion();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({
        error: "Erro interno ao processar a resposta da IA. Tente novamente.",
        details: msg.slice(0, 500),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
