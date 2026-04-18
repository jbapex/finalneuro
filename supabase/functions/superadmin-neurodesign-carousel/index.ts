/**
 * Contorna PostgREST com schema cache desatualizado: grava/lê o flag em auth.users.app_metadata
 * via Auth Admin API (GoTrue), não na API REST de tabelas.
 *
 * Deploy: supabase functions deploy superadmin-neurodesign-carousel
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHUNK = 12;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace(/^Bearer\s+/i, "");

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = userData.user.id;
    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("user_type")
      .eq("id", callerId)
      .maybeSingle();

    if (profErr || prof?.user_type !== "super_admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const action = body?.action as string | undefined;

    if (action === "set") {
      const targetId = body?.p_user_id as string | undefined;
      const enabled = Boolean(body?.p_enabled);
      if (!targetId) {
        return new Response(JSON.stringify({ error: "Missing p_user_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: targetUser, error: guErr } = await admin.auth.admin.getUserById(targetId);
      if (guErr || !targetUser?.user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const meta = { ...(targetUser.user.app_metadata ?? {}) };
      meta.neurodesign_carousel_access = enabled;

      const { error: upErr } = await admin.auth.admin.updateUserById(targetId, { app_metadata: meta });
      if (upErr) {
        return new Response(JSON.stringify({ error: upErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const ids = body?.p_user_ids as string[] | undefined;
      if (!Array.isArray(ids)) {
        return new Response(JSON.stringify({ error: "Missing p_user_ids" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const out: { id: string; neurodesign_carousel_access: boolean }[] = [];

      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const batch = await Promise.all(
          slice.map(async (id) => {
            const { data: tu, error: e } = await admin.auth.admin.getUserById(id);
            if (e || !tu?.user) {
              return { id, neurodesign_carousel_access: false };
            }
            return {
              id,
              neurodesign_carousel_access: Boolean(tu.user.app_metadata?.neurodesign_carousel_access),
            };
          }),
        );
        out.push(...batch);
      }

      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
