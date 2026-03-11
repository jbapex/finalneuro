import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type KeywordPlannerRequest = {
  keyword: string;
  geo?: string;
  hl?: string;
};

type KeywordItem = { query: string; formattedValue: string; link: string };
type TopicItem = { topic_title: string; formattedValue: string; link: string };

type KeywordPlannerResponse = {
  relatedQueries: KeywordItem[];
  risingQueries: KeywordItem[];
  relatedTopics: TopicItem[];
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripXssiPrefix(text: string): string {
  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) return text.trim();
  return text.slice(firstBrace);
}

async function fetchExplore(keyword: string, geo: string, hl: string) {
  const reqBody = {
    comparisonItem: [{ keyword, geo, time: "now 7-d" }],
    category: 0,
    property: "",
  };
  const params = new URLSearchParams({
    hl,
    tz: "-180",
    req: JSON.stringify(reqBody),
  });
  const url = `https://trends.google.com/trends/api/explore?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Trends explore ${res.status}: ${text.slice(0, 200)}`);
  }
  const raw = await res.text();
  const json = stripXssiPrefix(raw);
  return JSON.parse(json);
}

async function fetchWidgetData(
  widget: any,
  endpoint: "relatedsearches" | "relatedtopics",
  hl: string,
): Promise<any> {
  if (!widget?.token || !widget?.request) return null;
  const params = new URLSearchParams({
    hl,
    tz: "-180",
    token: widget.token,
    req: JSON.stringify(widget.request),
  });
  const url = `https://trends.google.com/trends/api/widgetdata/${endpoint}?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Google Trends widgetdata/${endpoint} ${res.status}: ${text.slice(0, 200)}`,
    );
  }
  const raw = await res.text();
  const json = stripXssiPrefix(raw);
  return JSON.parse(json);
}

async function getTrendsData(
  keyword: string,
  geo: string,
  hl: string,
): Promise<KeywordPlannerResponse> {
  const explore = await fetchExplore(keyword, geo, hl);
  const widgets: any[] = explore?.widgets ?? [];
  const relatedQueriesWidget = widgets.find((w) =>
    w.id === "RELATED_QUERIES"
  );
  const relatedTopicsWidget = widgets.find((w) =>
    w.id === "RELATED_TOPICS"
  );

  const [queriesData, topicsData] = await Promise.all([
    relatedQueriesWidget
      ? fetchWidgetData(relatedQueriesWidget, "relatedsearches", hl)
      : Promise.resolve(null),
    relatedTopicsWidget
      ? fetchWidgetData(relatedTopicsWidget, "relatedtopics", hl)
      : Promise.resolve(null),
  ]);

  const relatedQueries: KeywordItem[] = [];
  const risingQueries: KeywordItem[] = [];
  if (queriesData?.default?.rankedList) {
    const lists = queriesData.default.rankedList as any[];
    const topList = lists[0]?.rankedKeyword ?? [];
    const risingList = lists[1]?.rankedKeyword ?? [];
    for (const item of topList) {
      const link = item.link
        ? `https://trends.google.com${item.link}`
        : `https://trends.google.com/trends/explore?geo=${geo}&q=${encodeURIComponent(keyword)}`;
      relatedQueries.push({
        query: item.query ?? item.title ?? "",
        formattedValue: item.formattedValue ?? String(item.value?.[0] ?? ""),
        link,
      });
    }
    for (const item of risingList) {
      const link = item.link
        ? `https://trends.google.com${item.link}`
        : `https://trends.google.com/trends/explore?geo=${geo}&q=${encodeURIComponent(keyword)}`;
      risingQueries.push({
        query: item.query ?? item.title ?? "",
        formattedValue: item.formattedValue ?? String(item.value?.[0] ?? ""),
        link,
      });
    }
  }

  const relatedTopics: TopicItem[] = [];
  if (topicsData?.default?.rankedList) {
    const lists = topicsData.default.rankedList as any[];
    const topicList = lists[0]?.rankedKeyword ?? [];
    for (const item of topicList) {
      const topicTitle = item.topic?.title ?? item.title ?? item.query ?? "";
      const link = item.link
        ? `https://trends.google.com${item.link}`
        : `https://trends.google.com/trends/explore?geo=${geo}&q=${encodeURIComponent(
            keyword,
          )}`;
      relatedTopics.push({
        topic_title: topicTitle,
        formattedValue: item.formattedValue ?? String(item.value?.[0] ?? ""),
        link,
      });
    }
  }

  return { relatedQueries, risingQueries, relatedTopics };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) {
      return jsonResponse({
        error: "Configuração do servidor incompleta (variáveis de ambiente).",
      });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Corpo da requisição inválido (JSON esperado)." });
    }

    const { keyword, geo, hl } = body as KeywordPlannerRequest;
    if (!keyword || typeof keyword !== "string" || !keyword.trim()) {
      return jsonResponse({ error: "keyword é obrigatório." });
    }

    const geoFinal = typeof geo === "string" && geo.trim() ? geo.trim() : "BR";
    const hlFinal = typeof hl === "string" && hl.trim() ? hl.trim() : "pt-BR";

    try {
      const data = await getTrendsData(keyword.trim(), geoFinal, hlFinal);
      if (
        data.relatedQueries.length === 0 &&
        data.risingQueries.length === 0 &&
        data.relatedTopics.length === 0
      ) {
        return jsonResponse({
          error: "Nenhum dado encontrado para este termo/período.",
          data,
        });
      }
      return jsonResponse(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("keyword-planner error:", msg);
      return jsonResponse({
        error:
          "Erro ao consultar o Google Trends. Tente outro termo ou aguarde alguns minutos.",
        details: msg,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("keyword-planner unexpected error:", msg);
    return jsonResponse({ error: msg });
  }
});

