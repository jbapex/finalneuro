/**
 * Edge Function: generic-ai-chat
 * Chat com IA (OpenAI-compatible). Usado pelo Gerador de Conteúdo, Agente, NeuroDesign Preencher, etc.
 *
 * Google: PDF e imagens em data URL usam generateContent (REST nativo); o endpoint OpenAI-compat costuma ignorar ficheiros.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { enqueueUserGoogle } from "../_shared/googleUserQueue.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Timeout da chamada à API de IA (ms). 5 min. O Kong/gateway precisa ter timeout >= este valor. */
const LLM_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

/** Conteúdo texto ou multimodal (text, image_url, input_file para PDF). */
type Message = { role: string; content: string | Array<Record<string, unknown>> };

/** Chat Completions: muitos gateways esperam `type: file` + `file: { filename, file_data }` em vez de `input_file` no topo. */
function mapInputFilePartsForChatApi(parts: Record<string, unknown>[]): Record<string, unknown>[] {
  return parts.map((p) => {
    if (p?.type === "input_file") {
      return {
        type: "file",
        file: {
          filename: p.filename ?? "document.pdf",
          file_data: p.file_data,
        },
      };
    }
    return p;
  });
}

/** PDF ou imagem inline: a camada OpenAI do Gemini não entrega isto ao modelo de forma fiável. */
function messagesNeedGeminiNativeMultimodal(messages: Message[]): boolean {
  for (const m of messages) {
    const c = m.content;
    if (!Array.isArray(c)) continue;
    const arr = c as Record<string, unknown>[];
    for (const p of arr) {
      if (p?.type === "input_file") return true;
    }
    const mapped = mapInputFilePartsForChatApi(arr);
    for (const p of mapped) {
      if (p.type === "file") return true;
      if (p.type === "image_url") {
        const url = (p.image_url as { url?: string })?.url;
        if (typeof url === "string" && url.startsWith("data:image/")) return true;
      }
    }
  }
  return false;
}

function geminiNativeBaseUrl(apiUrl: string): string {
  const u = apiUrl.replace(/\/$/, "");
  const marker = "generativelanguage.googleapis.com";
  const idx = u.indexOf(marker);
  if (idx === -1) return `https://${marker}`;
  return u.slice(0, idx + marker.length);
}

/** ID no path `.../models/{id}:generateContent` (sem prefixo `models/`). */
function normalizeGeminiModelId(model: string): string {
  let m = String(model || "").trim();
  if (m.toLowerCase().startsWith("models/")) {
    m = m.slice("models/".length);
  }
  return m;
}

/** Mesmo formato que neurodesign-generate-google (camelCase na API REST). */
type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

function stripDataUrl(dataUrlOrRaw: string): { mime: string; data: string } {
  const s = String(dataUrlOrRaw);
  const m = s.match(/^data:([^;]+);base64,([\s\S]+)$/i);
  if (m) return { mime: m[1].trim(), data: m[2].replace(/\s/g, "") };
  return { mime: "application/octet-stream", data: s.replace(/\s/g, "") };
}

function openAiPartsToGeminiParts(parts: Record<string, unknown>[]): GeminiPart[] {
  const mapped = mapInputFilePartsForChatApi(parts);
  const out: GeminiPart[] = [];
  for (const p of mapped) {
    const t = p?.type;
    if (t === "text" && typeof p.text === "string" && p.text.length > 0) {
      out.push({ text: p.text });
    } else if (t === "image_url" && p.image_url && typeof (p.image_url as { url?: string }).url === "string") {
      const url = (p.image_url as { url: string }).url;
      if (url.startsWith("data:image/")) {
        const { mime, data } = stripDataUrl(url);
        out.push({ inlineData: { mimeType: mime, data } });
      }
    } else if (t === "file" && p.file) {
      const f = p.file as { file_data?: string };
      if (typeof f.file_data === "string") {
        const { mime, data } = stripDataUrl(f.file_data);
        const mimeType =
          mime && mime !== "application/octet-stream" ? mime : "application/pdf";
        out.push({ inlineData: { mimeType, data } });
      }
    }
  }
  return out;
}

function mergeConsecutiveGemini(contents: GeminiContent[]): GeminiContent[] {
  const out: GeminiContent[] = [];
  for (const item of contents) {
    const last = out[out.length - 1];
    if (last && last.role === item.role) {
      last.parts.push(...item.parts);
    } else {
      out.push({ role: item.role, parts: [...item.parts] });
    }
  }
  return out;
}

function assistantContentToText(c: string | Array<Record<string, unknown>>): string {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    const texts: string[] = [];
    for (const p of c) {
      if (p?.type === "text" && typeof p.text === "string") texts.push(p.text);
    }
    return texts.join("\n");
  }
  return "";
}

function buildGeminiContents(messages: Message[]): { contents: GeminiContent[]; systemText: string } {
  const systemChunks: string[] = [];
  const raw: GeminiContent[] = [];
  for (const m of messages) {
    const role = m.role;
    if (role === "system" || role === "developer") {
      const c = m.content;
      if (typeof c === "string" && c.trim()) systemChunks.push(c.trim());
      continue;
    }
    if (role === "user") {
      const c = m.content;
      if (typeof c === "string") {
        if (c.trim()) raw.push({ role: "user", parts: [{ text: c }] });
      } else if (Array.isArray(c)) {
        const gp = openAiPartsToGeminiParts(c as Record<string, unknown>[]);
        if (gp.length) raw.push({ role: "user", parts: gp });
      }
      continue;
    }
    if (role === "assistant") {
      const text = assistantContentToText(m.content).trim();
      if (text) raw.push({ role: "model", parts: [{ text }] });
    }
  }
  return {
    contents: mergeConsecutiveGemini(raw),
    systemText: systemChunks.join("\n\n"),
  };
}

function jsonResponse(payload: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractAssistantTextFromJson(rawText: string): { content: string; reasoning?: string } {
  let content = "";
  let reasoning: string | undefined;
  const data = JSON.parse(rawText) as Record<string, unknown>;

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
    const reasoningContent = msg.reasoning_content;
    if (typeof reasoningContent === "string" && reasoningContent.trim()) {
      reasoning = reasoningContent.trim();
    }
    if (!reasoning && typeof (msg as Record<string, unknown>).thought === "string") {
      reasoning = (msg as { thought: string }).thought.trim();
    }
    if (!reasoning && typeof (msg as Record<string, unknown>).thinking === "string") {
      reasoning = (msg as { thinking: string }).thinking.trim();
    }
    if (!reasoning && typeof (msg as Record<string, unknown>).reasoning === "string") {
      reasoning = (msg as { reasoning: string }).reasoning.trim();
    }
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

  const candidates = data?.candidates as Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
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
    if (!content && parts.length >= 2 && parts[0].text && parts[1].text) {
      if (!reasoning) reasoning = String(parts[0].text).trim();
      content = String(parts[1].text);
    } else if (!content && parts[0].text) {
      content = String(parts[0].text);
    }
  }

  return { content, reasoning };
}

function buildChatCompletionMessages(messages: Message[]): Array<{ role: string; content: unknown }> {
  return messages.map((m) => {
    const c = m.content;
    if (Array.isArray(c)) {
      return { role: m.role, content: mapInputFilePartsForChatApi(c as Record<string, unknown>[]) };
    }
    return { role: m.role, content: typeof c === "string" ? c : String(c ?? "") };
  });
}

async function fetchGeminiNative(
  messages: Message[],
  model: string,
  apiKey: string,
  apiUrl: string,
  signal: AbortSignal,
  maxOutputTokens = 8192,
): Promise<Response> {
  const base = geminiNativeBaseUrl(apiUrl);
  const modelId = normalizeGeminiModelId(model);
  const url =
    `${base}/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const { contents, systemText } = buildGeminiContents(messages);
  if (!contents.length) {
    return new Response(
      JSON.stringify({ error: "Nenhum turno válido para o Gemini após converter mensagens." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens,
      temperature: 0.7,
    },
  };
  if (systemText.trim()) {
    body.systemInstruction = { parts: [{ text: systemText.trim() }] };
  }
  return await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const chatContext = typeof (body as { context?: string }).context === "string"
      ? String((body as { context?: string }).context)
      : "";
    const neuromotionLargeJson = chatContext === "neuromotion_project";
    /** JSON grande (NeuroMotion) ou preenchimento Neuro Designer: limitar tokens e evitar timeouts no gateway. */
    const neurodesignFillOrLargeJson = neuromotionLargeJson ||
      chatContext === "neurodesign_fill" ||
      chatContext === "neurodesign_prompt_creator" ||
      chatContext === "neurodesign_prompt_creator_wizard" ||
      chatContext === "neurodesign_prompt_creator_wizard_repair";
    const llmMaxOut = neuromotionLargeJson ? 16384 : 8192;
    /**
     * reasoning_effort no Gemini (OpenAI-compat) aumenta latência; em preenchimento de formulário
     * costuma causar 502 no Kong se o gateway tiver timeout curto.
     */
    const googleUseReasoningEffort = (() => {
      if (!chatContext) return true;
      if (chatContext === "neurodesign_fill") return false;
      if (chatContext.startsWith("neurodesign_prompt_creator")) return false;
      return true;
    })();
    const messages = (body.messages as Message[]) || [];
    const llmIntegrationId = body.llm_integration_id;
    const isUserConnection = body.is_user_connection === true;
    const streamRequested = (body as { stream?: boolean }).stream === true;

    if (!messages.length) {
      return new Response(
        JSON.stringify({ error: "messages is required and must be a non-empty array" }),
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
          return new Response(
            JSON.stringify({ error: "Integração de IA não encontrada" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const runChatCompletion = async (): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LLM_REQUEST_TIMEOUT_MS);

      const handleFetchError = (fetchErr: unknown): Response => {
        const isTimeout = fetchErr instanceof Error && fetchErr.name === "AbortError";
        if (isTimeout) {
          return jsonResponse(
            {
              error:
                "A resposta da IA demorou muito (timeout). Tente um pedido mais curto ou tente novamente em instantes.",
            },
            503,
          );
        }
        const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        return jsonResponse(
          {
            error: "Falha ao conectar com a API de IA. Verifique sua conexão e tente novamente.",
            details: errMsg.slice(0, 300),
          },
          502,
        );
      };

      if (isGoogle && messagesNeedGeminiNativeMultimodal(messages)) {
        let res: Response;
        try {
          res = await fetchGeminiNative(messages, model, apiKey, apiUrl, controller.signal, llmMaxOut);
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          return handleFetchError(fetchErr);
        }
        clearTimeout(timeoutId);
        const rawText = await res.text();
        if (!res.ok) {
          return jsonResponse(
            {
              error: `API Gemini (documento/imagem) retornou erro: ${res.status}`,
              details: rawText.slice(0, 800),
            },
            502,
          );
        }
        try {
          const { content, reasoning } = extractAssistantTextFromJson(rawText);
          const payload = reasoning ? { response: content, reasoning } : { response: content };
          return jsonResponse(payload, 200);
        } catch (_) {
          return jsonResponse(
            {
              error: "A API Gemini retornou uma resposta inválida (JSON inesperado).",
              details: rawText.slice(0, 300),
            },
            502,
          );
        }
      }

      const chatUrl = isGoogle
        ? `${apiUrl}/v1beta/openai/chat/completions`
        : apiUrl.includes("/v1") ? `${apiUrl}/chat/completions` : `${apiUrl}/v1/chat/completions`;

      const messagesPayload = buildChatCompletionMessages(messages);

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

      /** SSE: repassa o stream ao cliente para raciocínio / texto em tempo real (sem PDF nativo). */
      if (streamRequested) {
        const bodyPayload: Record<string, unknown> = {
          model,
          messages: messagesPayload,
          stream: true,
          ...(neurodesignFillOrLargeJson ? { max_tokens: llmMaxOut } : {}),
        };
        if (isGoogle && googleUseReasoningEffort) {
          bodyPayload.reasoning_effort = "medium";
        }

        let res: Response;
        try {
          res = await doFetch(bodyPayload);
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          return handleFetchError(fetchErr);
        }

        if (!res.ok && isGoogle && res.status >= 400 && res.status < 500 && bodyPayload.reasoning_effort) {
          const errFirst = await res.text();
          delete bodyPayload.reasoning_effort;
          try {
            res = await doFetch(bodyPayload);
          } catch (fetchErr) {
            clearTimeout(timeoutId);
            return handleFetchError(fetchErr);
          }
          if (!res.ok) {
            clearTimeout(timeoutId);
            return jsonResponse(
              {
                error: `API de IA retornou erro: ${res.status}`,
                details: errFirst.slice(0, 500),
              },
              502,
            );
          }
        } else if (!res.ok) {
          clearTimeout(timeoutId);
          const rawText = await res.text();
          return jsonResponse(
            {
              error: `API de IA retornou erro: ${res.status}`,
              details: rawText.slice(0, 500),
            },
            502,
          );
        }

        clearTimeout(timeoutId);
        const streamHeaders: Record<string, string> = {
          ...corsHeaders,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        };
        return new Response(res.body, { status: 200, headers: streamHeaders });
      }

      const bodyPayload: Record<string, unknown> = {
        model,
        messages: messagesPayload,
        stream: false,
        ...(neurodesignFillOrLargeJson ? { max_tokens: llmMaxOut } : {}),
      };
      if (isGoogle && googleUseReasoningEffort) {
        bodyPayload.reasoning_effort = "medium";
      }

      let res: Response;
      try {
        res = await doFetch(bodyPayload);
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        return handleFetchError(fetchErr);
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
        return jsonResponse(
          {
            error: `API de IA retornou erro: ${res.status}`,
            details: rawText.slice(0, 500),
          },
          502,
        );
      }

      try {
        const { content, reasoning } = extractAssistantTextFromJson(rawText);
        const payload = reasoning ? { response: content, reasoning } : { response: content };
        return jsonResponse(payload, 200);
      } catch (_) {
        return jsonResponse(
          {
            error: "A API de IA retornou uma resposta inválida (não é JSON). Tente novamente.",
            details: rawText.slice(0, 300),
          },
          502,
        );
      }
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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
