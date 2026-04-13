/**
 * Edge Function: site-generator
 * Chamada pelo nó "Criador de Site" no fluxo: inicializa page_structure/html_content
 * e marca o projeto como concluído. O utilizador refina depois no editor (chat IA).
 *
 * Body: { project_id: number }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Alinhado ao DEFAULT_HTML_TEMPLATE do SiteBuilder.jsx (página inicial editável). */
const DEFAULT_MODULE_HTML = `
<section class="bg-slate-900 text-white" data-section-id="section_0">
  <div class="mx-auto max-w-screen-xl px-4 py-24 lg:py-32 lg:flex lg:items-center">
    <div class="mx-auto max-w-3xl text-center">
      <h1 class="text-3xl font-bold tracking-tight sm:text-5xl" style="font-family: 'Outfit', sans-serif;" data-id="b3f2c1a0" data-type="heading">
        Sua Jornada Digital Começa Aqui.
        <span class="sm:block text-slate-300 mt-2" data-id="b3f2c1a1" data-type="text">Construa o Futuro.</span>
      </h1>
      <p class="mx-auto mt-6 max-w-xl text-slate-400 sm:text-lg leading-relaxed" style="font-family: 'Plus Jakarta Sans', sans-serif;" data-id="b3f2c1a2" data-type="text">
        Crie, inove e inspire. Use o chat ao lado para gerar um site único, com tipografia e cores personalizadas.
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-4">
        <a class="inline-flex rounded-lg bg-white px-8 py-3 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 transition-colors" href="#" data-id="b3f2c1a3" data-type="button">Começar</a>
        <a class="inline-flex rounded-lg border border-slate-500 px-8 py-3 text-sm font-medium text-white hover:bg-slate-800 transition-colors" href="#" data-id="b3f2c1a4" data-type="button">Saber Mais</a>
      </div>
    </div>
  </div>
</section>
`.trim();

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
    const projectId = body.project_id;
    if (projectId == null || projectId === "") {
      return new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Não pedir page_structure no select: instalações antigas podem não ter a coluna (PostgREST falharia).
    const { data: proj, error: fetchErr } = await supabase
      .from("site_projects")
      .select("id, user_id, html_content, status")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchErr || !proj) {
      return new Response(JSON.stringify({ error: "Projeto não encontrado ou sem permissão" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const htmlStr = proj.html_content != null ? String(proj.html_content) : "";
    const hasHtml = htmlStr.trim().length > 80;

    if (hasHtml) {
      const { error: upErr } = await supabase
        .from("site_projects")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)
        .eq("user_id", user.id);

      if (upErr) {
        return new Response(JSON.stringify({ error: upErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, message: "Projeto já tinha conteúdo; estado atualizado." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const modId = crypto.randomUUID();
    const page_structure = [
      {
        id: modId,
        name: "Hero inicial",
        html: DEFAULT_MODULE_HTML,
      },
    ];

    const now = new Date().toISOString();
    let upErr = (
      await supabase
        .from("site_projects")
        .update({
          page_structure,
          html_content: DEFAULT_MODULE_HTML,
          status: "completed",
          updated_at: now,
        })
        .eq("id", projectId)
        .eq("user_id", user.id)
    ).error;

    if (upErr && /page_structure|schema cache/i.test(String(upErr.message || ""))) {
      upErr = (
        await supabase
          .from("site_projects")
          .update({
            html_content: DEFAULT_MODULE_HTML,
            status: "completed",
            updated_at: now,
          })
          .eq("id", projectId)
          .eq("user_id", user.id)
      ).error;
    }

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, message: "Site inicializado." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: "Erro interno", details: msg.slice(0, 400) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
