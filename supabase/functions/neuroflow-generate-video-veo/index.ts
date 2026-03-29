import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractVideoUris(operationStatus: any): string[] {
  const samples =
    operationStatus?.response?.generateVideoResponse?.generatedSamples ??
    operationStatus?.response?.generatedSamples ??
    operationStatus?.response?.generated_videos ??
    [];

  if (Array.isArray(samples)) {
    const uris: string[] = [];
    for (const s of samples) {
      const uri =
        s?.video?.uri ??
        s?.video?.downloadUri ??
        s?.video ??
        s?.videoUri;
      if (uri) uris.push(String(uri));
    }
    if (uris.length) return uris;
  }

  const altUri =
    operationStatus?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ??
    operationStatus?.response?.generated_videos?.[0]?.video?.uri;

  return altUri ? [String(altUri)] : [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const apiKey = String(body?.apiKey || body?.api_key || "").trim();
    const videoModel = String(body?.videoModel || body?.video_model || "").trim() || "veo-3.1-generate-preview";
    const prompt = String(body?.prompt || "").trim();

    const sampleCount = Number(body?.sampleCount ?? body?.sample_count ?? 1);
    const resolution = String(body?.resolution || "720p").trim(); // "720p" | "1080p" | "4k"
    const aspectRatio = String(body?.aspectRatio || "16:9").trim(); // "16:9" | "9:16"
    const durationSecondsRaw = Number(body?.durationSeconds ?? body?.duration_seconds ?? 4);
    const durationSeconds = Number.isFinite(durationSecondsRaw) && durationSecondsRaw > 0 ? Math.round(durationSecondsRaw) : 4;

    const initialFrame = body?.initialFrame ?? body?.initial_frame ?? null;
    const finalFrame = body?.finalFrame ?? body?.final_frame ?? null;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "apiKey é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For Veo, "videos per request" may be limited; we generate sequentially to honor sampleCount.
    const n = Number.isFinite(sampleCount) && sampleCount > 0 ? Math.min(sampleCount, 4) : 1;

    const baseUrl = "https://generativelanguage.googleapis.com/v1beta";
    const genUrl = `${baseUrl}/models/${encodeURIComponent(videoModel)}:predictLongRunning`;
    const pollIntervalMs = 10000; // Veo often takes ~11s min; poll every 10s.
    const maxPollMs = 6 * 60 * 1000; // up to 6 minutes per docs.

    async function generateOneVideo(): Promise<string> {
      type PayloadVariant = { kind: "instances_only" | "snake" | "camel" | "params_config" | "bytes_b64" | "none" };

      function buildInstances(variant: PayloadVariant["kind"]): Record<string, any> {
        const instances0: Record<string, any> = { prompt };

        const shouldUseFrames = variant !== "none";
        const useSnake = variant === "snake";
        const inlineKey = useSnake ? "inline_data" : "inlineData";

        if (!shouldUseFrames) return instances0;

        if (variant === "bytes_b64") {
          if (initialFrame && typeof initialFrame === "object") {
            const mimeType = String(initialFrame?.mimeType || initialFrame?.mime_type || "image/png").trim();
            const data = String(initialFrame?.data || initialFrame?.base64 || "").trim().replace(/\s/g, "");
            if (data) instances0.image = { mimeType, bytesBase64Encoded: data };
          }
          if (finalFrame && typeof finalFrame === "object") {
            const mimeType = String(finalFrame?.mimeType || finalFrame?.mime_type || "image/png").trim();
            const data = String(finalFrame?.data || finalFrame?.base64 || "").trim().replace(/\s/g, "");
            if (data) instances0.lastFrame = { mimeType, bytesBase64Encoded: data };
          }
          return instances0;
        }

        if (initialFrame && typeof initialFrame === "object") {
          const mimeType = String(initialFrame?.mimeType || initialFrame?.mime_type || "image/png").trim();
          const data = String(initialFrame?.data || initialFrame?.base64 || "").trim().replace(/\s/g, "");
          if (data) instances0.image = { [inlineKey]: { mimeType, data } };
        }
        if (finalFrame && typeof finalFrame === "object" && variant !== "params_config") {
          const mimeType = String(finalFrame?.mimeType || finalFrame?.mime_type || "image/png").trim();
          const data = String(finalFrame?.data || finalFrame?.base64 || "").trim().replace(/\s/g, "");
          if (data) instances0.lastFrame = { [inlineKey]: { mimeType, data } };
        }
        return instances0;
      }

      async function requestWithVariant(variant: PayloadVariant["kind"]): Promise<string> {
        const instances0 = buildInstances(variant);
        const useSnake = variant === "snake";
        const inlineKey = useSnake ? "inline_data" : "inlineData";
        // Doc "Como usar o primeiro e o último frame" (Veo 3.1): REST envia só "instances" com prompt, image e lastFrame
        // em inlineData — sem bloco "parameters". https://ai.google.dev/gemini-api/docs/video?hl=pt-br
        let payload: Record<string, any>;
        if (variant === "instances_only") {
          payload = { instances: [instances0] };
        } else {
          // API Veo exige durationSeconds como número (não string). Valores comuns: 4, 6, 8.
          const parameters: Record<string, any> = {
            aspectRatio,
            resolution,
            durationSeconds,
            personGeneration: hasFrames ? "allow_adult" : "allow_all",
          };
          if (variant === "params_config" && finalFrame && typeof finalFrame === "object") {
            const mimeType = String(finalFrame?.mimeType || finalFrame?.mime_type || "image/png").trim();
            const data = String(finalFrame?.data || finalFrame?.base64 || "").trim().replace(/\s/g, "");
            if (data) parameters.lastFrame = { [inlineKey]: { mimeType, data } };
          }
          payload = { instances: [instances0], parameters };
        }

        const startRes = await fetch(genUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(payload),
        });

        const startText = await startRes.text();

        if (!startRes.ok) {
          const msg = String(startText || "");
          const low = msg.toLowerCase();
          const isInlineRejected =
            low.includes("inlinedata") ||
            low.includes("inline_data") ||
            low.includes("inlinedata isn't supported") ||
            low.includes("isn't supported by this model");
          // Qualquer 400 com frames costuma ser formato/campo errado — tentar próxima variante
          const isRetryable400 =
            hasFrames &&
            startRes.status === 400 &&
            !low.includes("api key") &&
            !low.includes("permission") &&
            !low.includes("quota") &&
            !low.includes("billing");

          if (isInlineRejected || isRetryable400) {
            throw new Error("INLINE_REJECTED: " + msg.slice(0, 500));
          }
          throw new Error(`Veo request failed ${startRes.status}: ${msg.slice(0, 500)}`);
        }

        let op: any;
        try {
          op = JSON.parse(startText);
        } catch {
          throw new Error("Veo start response não é JSON.");
        }

        const operationName: string = String(op?.name || "").trim();
        if (!operationName) {
          throw new Error("Veo operationName ausente na resposta.");
        }

        const startMs = Date.now();
        let nextPollMs = 3000;
        while (true) {
          if (Date.now() - startMs > maxPollMs) {
            throw new Error("Timeout no polling do Veo.");
          }
          await new Promise((r) => setTimeout(r, nextPollMs));
          nextPollMs = pollIntervalMs;
          const pollUrl = `${baseUrl}/${operationName}`;
          const pollRes = await fetch(pollUrl, {
            method: "GET",
            headers: { "x-goog-api-key": apiKey },
          });
          const pollText = await pollRes.text();
          if (!pollRes.ok) {
            throw new Error(`Veo poll failed ${pollRes.status}: ${pollText.slice(0, 300)}`);
          }

          let statusJson: any;
          try {
            statusJson = JSON.parse(pollText);
          } catch {
            statusJson = {};
          }

          if (statusJson?.done === true) {
            const opErr = statusJson?.error;
            if (opErr) {
              const em = typeof opErr === "object" ? JSON.stringify(opErr) : String(opErr);
              throw new Error("Veo operation falhou: " + em.slice(0, 800));
            }
            const uris = extractVideoUris(statusJson);
            if (!uris.length) {
              throw new Error(
                "Veo finalizou, mas não encontrou video.uri. Resposta: " + pollText.slice(0, 600),
              );
            }
            return uris[0];
          }
        }
      }

      const hasFrames = (initialFrame && typeof initialFrame === "object" && String(initialFrame?.data || initialFrame?.base64 || "").trim()) ||
        (finalFrame && typeof finalFrame === "object" && String(finalFrame?.data || finalFrame?.base64 || "").trim());
      const variants: PayloadVariant["kind"][] = hasFrames
        ? ["instances_only", "camel", "snake", "params_config", "bytes_b64"]
        : ["camel", "snake", "none"];
      let lastErr: any = null;

      for (const v of variants) {
        try {
          return await requestWithVariant(v);
        } catch (e) {
          lastErr = e;
          const msg = String(e instanceof Error ? e.message : e);
          if (!msg.includes("INLINE_REJECTED")) {
            throw e;
          }
        }
      }

      if (hasFrames) {
        const googleMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
        throw new Error(
          "O modelo selecionado não aceita imagem inicial/final. Para transição entre suas imagens, use um modelo Veo 3.1 (ex.: veo-3.1-generate-preview) na configuração da API. Detalhe da API: " + googleMsg.slice(0, 300)
        );
      }
      throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));

    }

    const videoUris: string[] = [];
    for (let i = 0; i < n; i++) {
      const uri = await generateOneVideo();
      if (uri) videoUris.push(uri);
    }

    return new Response(JSON.stringify({ videoUris }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        error: "Erro ao gerar vídeo Veo",
        details,
        hint: "Abra o corpo JSON desta resposta e leia o campo details. Não compartilhe sua API key.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
