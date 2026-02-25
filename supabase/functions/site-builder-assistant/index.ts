/**
 * Edge Function: site-builder-assistant
 * Assistente de IA para o Criador de Site (standalone e modal).
 * Retorna resposta estruturada { type: 'html_update', html, explanation } quando
 * a IA devolver HTML; caso contrário { type: 'message', content }.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Message = { role: string; content: string };

function extractHtmlFromResponse(text: string): { html: string; explanation: string } | null {
  if (!text || typeof text !== "string") return null;

  // Bloco ```html ... ``` ou ``` ... ``` com tags
  const codeBlockMatch = text.match(/```(?:html|jsx)?\s*\n([\s\S]*?)```/i);
  if (codeBlockMatch) {
    const html = codeBlockMatch[1].trim();
    if (/<\s*(div|section|header|main|footer|nav|article|aside)/i.test(html)) {
      const explanation = text.replace(codeBlockMatch[0], "").trim().slice(0, 200) || "Seção gerada pela IA.";
      return { html, explanation };
    }
  }

  // Primeiro trecho semântico <section>, <div>, etc. (tag de abertura até fechamento correspondente)
  const openTagMatch = text.match(/<\s*(section|header|main|footer|article|aside|div)(\s[^>]*)?>/i);
  if (openTagMatch) {
    const tagName = openTagMatch[1].toLowerCase();
    const startIdx = openTagMatch.index!;
    const rest = text.slice(startIdx);
    const closeRe = new RegExp(`<\\s*\\/${tagName}\\s*>`, "i");
    const closeMatch = rest.match(closeRe);
    if (closeMatch && closeMatch.index !== undefined) {
      const endIdx = closeMatch.index + closeMatch[0].length;
      const html = rest.slice(0, endIdx).trim();
      if (html.length > 20) {
        return { html, explanation: "Seção gerada pela IA." };
      }
    }
  }

  return null;
}

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

    const chatUrl = apiUrl.includes("/v1") ? `${apiUrl}/chat/completions` : `${apiUrl}/v1/chat/completions`;
    const res = await fetch(chatUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(
        JSON.stringify({
          error: `API de IA retornou erro: ${res.status}`,
          details: text.slice(0, 500),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const rawContent = data?.choices?.[0]?.message?.content ?? "";

    const extracted = extractHtmlFromResponse(rawContent);
    if (extracted) {
      return new Response(
        JSON.stringify({
          response: {
            type: "html_update",
            html: extracted.html,
            explanation: extracted.explanation,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        response: {
          type: "message",
          content: rawContent,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
