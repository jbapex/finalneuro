/**
 * Gera 3–4 sugestões de continuação (próximos passos) com prompts completos,
 * com base na última troca usuário ↔ assistente. Usado apenas pelo Chat IA.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { enqueueUserGoogle } from "../_shared/googleUserQueue.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LLM_TIMEOUT_MS = 90_000;

type Suggestion = { label: string; prompt: string };

const SYSTEM_PT =
  `Você sugere continuações para um chat de IA em português do Brasil.

REGRAS OBRIGATÓRIAS (violação = resposta inválida):
1) TODAS as 4 sugestões devem permanecer ESTRITAMENTE no MESMO ASSUNTO, tema, objetivo e contexto da conversa fornecida. Não mude de tópico, não introduza assuntos novos ou paralelos.
2) Proibido: sugestões genéricas que poderiam servir para qualquer chat ("explique melhor", "dê exemplos", "resuma", "próximos passos" sem citar o que foi falado). Cada prompt deve citar ou pressupor elementos concretos do tema em discussão (conceitos, formato, público, produto, roteiro, tom, etc.).
3) Os próximos passos devem ser continuações naturais do que já foi tratado: aprofundar um ponto já mencionado, adaptar formato, refinar detalhes, validar hipóteses sobre o MESMO tema — nunca um tema diferente.
4) Se houver um "trecho da conversa", trate-o como a âncora do assunto; a última pergunta e a última resposta são o foco imediato, mas o assunto global não pode ser abandonado.

Formato de cada sugestão:
- "label": título bem curto (máx. 8 palavras), específico ao assunto.
- "prompt": mensagem COMPLETA que o usuário enviaria no chat, rica e acionável, alinhada ao fio da conversa.

Responda APENAS com JSON válido, sem markdown nem texto extra:
{"suggestions":[{"label":"...","prompt":"..."},...]}`;

function parseSuggestionsFromModelText(raw: string): Suggestion[] {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  try {
    const obj = JSON.parse(text) as { suggestions?: unknown };
    const arr = obj.suggestions;
    if (!Array.isArray(arr)) return [];
    const out: Suggestion[] = [];
    for (const item of arr) {
      if (typeof item === "string" && item.trim()) {
        const p = item.trim();
        out.push({ label: p.length > 72 ? `${p.slice(0, 69)}…` : p, prompt: p });
        continue;
      }
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
        if (!prompt) continue;
        let label = typeof o.label === "string" ? o.label.trim() : "";
        if (!label) label = prompt.length > 72 ? `${prompt.slice(0, 69)}…` : prompt;
        if (label.length > 100) label = `${label.slice(0, 97)}…`;
        out.push({ label, prompt });
      }
    }
    return out.slice(0, 4);
  } catch {
    return [];
  }
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
    const lastUser = String(body.last_user_message || "").trim();
    const lastAssistant = String(body.last_assistant_message || "").trim();
    const conversationThread = typeof body.conversation_thread === "string" ? body.conversation_thread.trim() : "";
    const llmIntegrationId = body.llm_integration_id;
    const isUserConnection = body.is_user_connection === true;

    if (!lastUser || !lastAssistant) {
      return new Response(
        JSON.stringify({ error: "last_user_message e last_assistant_message são obrigatórios" }),
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

    const userBlock = lastUser.length > 12000 ? `${lastUser.slice(0, 12000)}\n…` : lastUser;
    const asstBlock = lastAssistant.length > 14000 ? `${lastAssistant.slice(0, 14000)}\n…` : lastAssistant;
    const threadBlock =
      conversationThread.length > 16000 ? `${conversationThread.slice(0, 16000)}\n…` : conversationThread;

    let userTurnContent = "";
    if (threadBlock) {
      userTurnContent =
        `Trecho recente da conversa (o assunto das sugestões DEVE ser coerente com este fio — não desvie):\n${threadBlock}\n\n` +
        `---\nÚltima pergunta do usuário (foco imediato):\n${userBlock}\n\nÚltima resposta do assistente:\n${asstBlock}`;
    } else {
      userTurnContent = `Última mensagem do usuário:\n${userBlock}\n\nResposta do assistente:\n${asstBlock}`;
    }

    const chatMessages = [
      { role: "system", content: SYSTEM_PT },
      {
        role: "user",
        content: userTurnContent,
      },
    ];

    const runCompletion = async (): Promise<Response> => {
      const chatUrl = isGoogle
        ? `${apiUrl}/v1beta/openai/chat/completions`
        : apiUrl.includes("/v1")
        ? `${apiUrl}/chat/completions`
        : `${apiUrl}/v1/chat/completions`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

      const buildPayload = (withJsonFormat: boolean): Record<string, unknown> => {
        const p: Record<string, unknown> = {
          model,
          messages: chatMessages,
          stream: false,
          temperature: 0.35,
          max_tokens: 1400,
        };
        if (!isGoogle && withJsonFormat) {
          p.response_format = { type: "json_object" };
        }
        return p;
      };

      let res: Response;
      try {
        let payload = buildPayload(true);
        res = await fetch(chatUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!isGoogle && !res.ok && res.status === 400 && payload.response_format) {
          payload = buildPayload(false);
          res = await fetch(chatUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
        }
      } catch (e) {
        clearTimeout(timeoutId);
        const errMsg = e instanceof Error ? e.message : String(e);
        return new Response(
          JSON.stringify({ error: "Falha ao conectar com a API de IA.", details: errMsg.slice(0, 200) }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
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

      const suggestions = parseSuggestionsFromModelText(content);
      return new Response(JSON.stringify({ suggestions }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
