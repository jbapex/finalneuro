/**
 * Cria job de render NeuroMotion (pending). O worker Node processa com Remotion + FFmpeg.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TITLE = 200;
const MAX_SUBTITLE = 2000;
const MAX_SCENES = 20;
const ALLOWED_TRANSITIONS = new Set(["none", "fade", "slide"]);
const ALLOWED_FORMATS = new Set(["youtube", "story", "reel", "square"]);
const ALLOWED_LAYER_TYPES = new Set(["circle", "rect", "ellipse", "text", "line", "image", "cursor"]);
const ALLOWED_OBJECT_FIT = new Set(["cover", "contain", "fill"]);
const ALLOWED_ANIM_IN = new Set([
  "none",
  "fade",
  "spring",
  "slideUp",
  "slideLeft",
  "scale",
  "blurIn",
  "revealX",
  "rise",
  "tap",
  "snap",
]);
const MAX_LAYERS_PER_SCENE = 24;
const BLEND_MODES = new Set([
  "normal",
  "multiply",
  "screen",
  "overlay",
  "soft-light",
  "hard-light",
  "plus-lighter",
  "color-dodge",
]);

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function sanitizeLayerFill(raw: unknown): string {
  const s = String(raw ?? "#ffffff").trim();
  if (!s) return "#ffffff";
  if (/url\s*\(|expression\s*\(|javascript:|[;{}]/i.test(s)) return "#ffffff";
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (s.length > 400) return "#ffffff";
  if (/^(linear-gradient|radial-gradient)\s*\(/i.test(s)) {
    if (/^[\w#%(),.\s+\-/deg]+$/i.test(s)) return s.slice(0, 400);
    return "#ffffff";
  }
  if (/^rgba?\s*\(/i.test(s) && s.length <= 140 && /^rgba?\([^)]*\)$/i.test(s)) {
    return s;
  }
  return "#ffffff";
}

function sanitizeLayerBoxShadow(raw: unknown): string {
  const s = String(raw ?? "").trim().slice(0, 280);
  if (!s) return "";
  if (/url\s*\(|expression|javascript:|[;{}]/i.test(s)) return "";
  if (!/^[\w#%(),.\s+\-pxdeg°0-9]+$/i.test(s)) return "";
  return s;
}

function sanitizeLayerBlendMode(raw: unknown): string {
  const v = String(raw ?? "normal")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  return BLEND_MODES.has(v) ? v : "normal";
}

function sanitizeLayerImageUrl(raw: unknown): string {
  const s = String(raw ?? "").trim().slice(0, 2048);
  if (!s || !/^https:\/\//i.test(s)) return "";
  if (/javascript:/i.test(s)) return "";
  if (/\s/.test(s)) return "";
  return s;
}

const CHOREO_FRAME_MAX = 480;

function attachChoreography(out: Record<string, unknown>, l: Record<string, unknown>): void {
  if (l.animDelay != null && Number.isFinite(Number(l.animDelay))) {
    out.animDelay = Math.round(clamp(Number(l.animDelay), 0, 120));
  }

  const pf = l.pathFromFrame ?? l.moveFromFrame;
  const pt = l.pathToFrame ?? l.moveToFrame;
  if (pf != null && pt != null && Number.isFinite(Number(pf)) && Number.isFinite(Number(pt))) {
    const a = Math.round(clamp(Number(pf), 0, CHOREO_FRAME_MAX));
    const b = Math.round(clamp(Number(pt), 0, CHOREO_FRAME_MAX));
    if (b > a) {
      out.pathFromFrame = a;
      out.pathToFrame = b;
      const ptx = l.pathToX ?? l.cursorToX;
      const pty = l.pathToY ?? l.cursorToY;
      if (ptx != null && Number.isFinite(Number(ptx))) out.pathToX = clamp(Number(ptx), 0, 100);
      if (pty != null && Number.isFinite(Number(pty))) out.pathToY = clamp(Number(pty), 0, 100);
    }
  }

  if (
    l.path2FromFrame != null &&
    l.path2ToFrame != null &&
    l.path2ToX != null &&
    l.path2ToY != null &&
    Number.isFinite(Number(l.path2FromFrame)) &&
    Number.isFinite(Number(l.path2ToFrame))
  ) {
    const a2 = Math.round(clamp(Number(l.path2FromFrame), 0, CHOREO_FRAME_MAX));
    const b2 = Math.round(clamp(Number(l.path2ToFrame), 0, CHOREO_FRAME_MAX));
    if (b2 > a2) {
      out.path2FromFrame = a2;
      out.path2ToFrame = b2;
      out.path2ToX = clamp(Number(l.path2ToX), 0, 100);
      out.path2ToY = clamp(Number(l.path2ToY), 0, 100);
    }
  }

  if (l.twistAtFrame != null && l.twistDeg != null && Number.isFinite(Number(l.twistAtFrame))) {
    out.twistAtFrame = Math.round(clamp(Number(l.twistAtFrame), 0, CHOREO_FRAME_MAX));
    out.twistDeg = clamp(Number(l.twistDeg), -180, 180);
  }

  if (l.punchAtFrame != null && Number.isFinite(Number(l.punchAtFrame))) {
    out.punchAtFrame = Math.round(clamp(Number(l.punchAtFrame), 0, CHOREO_FRAME_MAX));
    out.punchScale = clamp(Number(l.punchScale ?? 1.12), 1.02, 1.5);
  }
}

function sanitizeLayer(raw: unknown): Record<string, unknown> | null {
  const l = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const type = String(l.type ?? "").toLowerCase();
  if (!ALLOWED_LAYER_TYPES.has(type)) return null;

  if (type === "image") {
    const src = sanitizeLayerImageUrl(l.imageUrl ?? l.src);
    if (!src) return null;
    const of = String(l.objectFit ?? "cover").toLowerCase();
    const objectFit = ALLOWED_OBJECT_FIT.has(of) ? of : "cover";
    const boxShadow = sanitizeLayerBoxShadow(l.boxShadow);
    const out: Record<string, unknown> = {
      type: "image",
      imageUrl: src,
      objectFit,
      ...(l.id != null && String(l.id).trim() !== "" ? { id: String(l.id).slice(0, 64) } : {}),
      x: clamp(Number(l.x ?? 50), 0, 100),
      y: clamp(Number(l.y ?? 50), 0, 100),
      w: clamp(Number(l.w ?? 40), 2, 100),
      h: clamp(Number(l.h ?? 40), 2, 100),
      fill: "#ffffff",
      stroke: String(l.stroke ?? "").slice(0, 32),
      strokeWidth: clamp(Number(l.strokeWidth ?? 0), 0, 40),
      rotation: clamp(Number(l.rotation ?? 0), -360, 360),
      opacity: clamp(Number(l.opacity ?? 1), 0, 1),
      zIndex: Math.round(clamp(Number(l.zIndex ?? 0), -100, 100)),
      text: "",
      fontSize: 48,
      fontWeight: 600,
      animIn: ALLOWED_ANIM_IN.has(String(l.animIn)) ? String(l.animIn) : "fade",
      animLoop: String(l.animLoop ?? "none").slice(0, 32),
      blur: clamp(Number(l.blur ?? 0), 0, 48),
      borderRadius: clamp(Number(l.borderRadius ?? 8), 0, 200),
      mixBlendMode: sanitizeLayerBlendMode(l.mixBlendMode),
    };
    if (boxShadow) out.boxShadow = boxShadow;
    if (l.tapAtFrame != null && Number.isFinite(Number(l.tapAtFrame))) {
      out.tapAtFrame = Math.round(clamp(Number(l.tapAtFrame), 0, CHOREO_FRAME_MAX));
    }
    attachChoreography(out, l);
    return out;
  }

  if (type === "cursor") {
    const fill = sanitizeLayerFill(l.fill ?? "rgba(255,255,255,0.95)");
    const boxShadow = sanitizeLayerBoxShadow(l.boxShadow);
    const mf = Math.round(clamp(Number(l.moveFromFrame ?? 0), 0, CHOREO_FRAME_MAX));
    const mtRaw = Math.round(clamp(Number(l.moveToFrame ?? 0), 0, CHOREO_FRAME_MAX));
    const mt = mtRaw >= mf ? mtRaw : mf;
    const out: Record<string, unknown> = {
      type: "cursor",
      ...(l.id != null && String(l.id).trim() !== "" ? { id: String(l.id).slice(0, 64) } : {}),
      x: clamp(Number(l.x ?? 50), 0, 100),
      y: clamp(Number(l.y ?? 50), 0, 100),
      cursorToX: clamp(Number(l.cursorToX ?? l.x ?? 50), 0, 100),
      cursorToY: clamp(Number(l.cursorToY ?? l.y ?? 50), 0, 100),
      moveFromFrame: mf,
      moveToFrame: mt,
      w: clamp(Number(l.w ?? 3.5), 1, 20),
      h: clamp(Number(l.h ?? 3.5), 1, 20),
      fill,
      stroke: String(l.stroke ?? "rgba(0,0,0,0.35)").slice(0, 32),
      strokeWidth: clamp(Number(l.strokeWidth ?? 2.5), 0, 12),
      rotation: clamp(Number(l.rotation ?? 0), -360, 360),
      opacity: clamp(Number(l.opacity ?? 1), 0, 1),
      zIndex: Math.round(clamp(Number(l.zIndex ?? 50), -100, 200)),
      text: "",
      fontSize: 48,
      fontWeight: 600,
      animIn: ALLOWED_ANIM_IN.has(String(l.animIn)) ? String(l.animIn) : "fade",
      animLoop: "none",
      blur: 0,
      borderRadius: 999,
      mixBlendMode: "normal",
    };
    if (boxShadow) out.boxShadow = boxShadow;
    if (l.tapAtFrame != null && Number.isFinite(Number(l.tapAtFrame))) {
      out.tapAtFrame = Math.round(clamp(Number(l.tapAtFrame), 0, CHOREO_FRAME_MAX));
    }
    attachChoreography(out, l);
    return out;
  }

  const fill = sanitizeLayerFill(l.fill);
  const boxShadow = sanitizeLayerBoxShadow(l.boxShadow);
  const animInRaw = String(l.animIn ?? "fade");
  const animIn = ALLOWED_ANIM_IN.has(animInRaw) ? animInRaw : "fade";
  const out: Record<string, unknown> = {
    type,
    ...(l.id != null && String(l.id).trim() !== "" ? { id: String(l.id).slice(0, 64) } : {}),
    x: clamp(Number(l.x ?? 50), 0, 100),
    y: clamp(Number(l.y ?? 50), 0, 100),
    w: clamp(Number(l.w ?? 20), 0.5, 100),
    h: clamp(Number(l.h ?? 20), 0.5, 100),
    fill,
    stroke: String(l.stroke ?? "").slice(0, 32),
    strokeWidth: clamp(Number(l.strokeWidth ?? 0), 0, 40),
    rotation: clamp(Number(l.rotation ?? 0), -360, 360),
    opacity: clamp(Number(l.opacity ?? 1), 0, 1),
    zIndex: Math.round(clamp(Number(l.zIndex ?? 0), -100, 100)),
    text: String(l.text ?? "").slice(0, 1200),
    fontSize: clamp(Number(l.fontSize ?? 48), 8, 200),
    fontWeight: Math.round(clamp(Number(l.fontWeight ?? 600), 100, 900)),
    animIn,
    animLoop: String(l.animLoop ?? "none").slice(0, 32),
    blur: clamp(Number(l.blur ?? 0), 0, 48),
    borderRadius: clamp(Number(l.borderRadius ?? 0), 0, 200),
    mixBlendMode: sanitizeLayerBlendMode(l.mixBlendMode),
  };
  if (boxShadow) out.boxShadow = boxShadow;
  if (l.tapAtFrame != null && Number.isFinite(Number(l.tapAtFrame))) {
    out.tapAtFrame = Math.round(clamp(Number(l.tapAtFrame), 0, CHOREO_FRAME_MAX));
  }
  attachChoreography(out, l);
  if (type === "text") {
    const ta = String(l.textAlign ?? "center").toLowerCase();
    if (ta === "left" || ta === "right" || ta === "center") {
      out.textAlign = ta;
    }
    const lh = Number(l.lineHeight);
    if (Number.isFinite(lh) && lh >= 1 && lh <= 2.5) {
      out.lineHeight = lh;
    }
  }
  if (type !== "text") {
    out.text = "";
  }
  return out;
}

function sanitizeInputProps(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("input_props deve ser um objeto");
  }
  const o = raw as Record<string, unknown>;
  const scenesRaw = Array.isArray(o.scenes) ? o.scenes : [];
  const scenes = scenesRaw
    .slice(0, MAX_SCENES)
    .map((scene) => {
      const s = scene && typeof scene === "object" ? (scene as Record<string, unknown>) : {};
      const title = String(s.title ?? "NeuroMotion").slice(0, MAX_TITLE);
      const subtitle = String(s.subtitle ?? "").slice(0, MAX_SUBTITLE);
      const accentColor = String(s.accentColor ?? "#7c3aed").slice(0, 32);
      const backgroundColor = String(s.backgroundColor ?? "#0f172a").slice(0, 32);
      const durationSecRaw = Number(s.durationSec ?? 3);
      const durationSec = Number.isFinite(durationSecRaw) ? Math.min(12, Math.max(1, Math.round(durationSecRaw))) : 3;
      const transitionRaw = String(s.transition ?? "fade");
      const transition = ALLOWED_TRANSITIONS.has(transitionRaw) ? transitionRaw : "fade";
      const imageUrlRaw = String(s.imageUrl ?? "").trim().slice(0, 2048);
      const imageUrl = /^https:\/\//i.test(imageUrlRaw) ? imageUrlRaw : "";
      const hideClassicText = Boolean(s.hideClassicText);
      const layersRaw = Array.isArray(s.layers) ? s.layers : [];
      const layers = layersRaw
        .map((layer) => sanitizeLayer(layer))
        .filter((x): x is Record<string, unknown> => x != null)
        .slice(0, MAX_LAYERS_PER_SCENE);
      const out: Record<string, unknown> = {
        title,
        subtitle,
        accentColor,
        backgroundColor,
        durationSec,
        transition,
        hideClassicText,
        layers,
      };
      if (imageUrl) out.imageUrl = imageUrl;
      return out;
    })
    .filter((s) => {
      const layers = s.layers;
      const hasLayers = Array.isArray(layers) && layers.length > 0;
      return Boolean(s.title || s.subtitle || s.imageUrl || hasLayers);
    });

  const formatRaw = String(o.format ?? "youtube");
  const format = ALLOWED_FORMATS.has(formatRaw) ? formatRaw : "youtube";
  const transitionFramesRaw = Number(o.transitionFrames ?? 10);
  const transitionFrames = Number.isFinite(transitionFramesRaw)
    ? Math.max(0, Math.min(30, Math.round(transitionFramesRaw)))
    : 10;

  if (scenes.length > 0) {
    return { format, transitionFrames, scenes };
  }

  const fallbackTitle = String(o.title ?? "NeuroMotion").slice(0, MAX_TITLE);
  const fallbackSubtitle = String(o.subtitle ?? "").slice(0, MAX_SUBTITLE);
  const fallbackAccent = String(o.accentColor ?? "#7c3aed").slice(0, 32);
  const fallbackBackground = String(o.backgroundColor ?? "#0f172a").slice(0, 32);
  return {
    scenes: [
      {
        title: fallbackTitle,
        subtitle: fallbackSubtitle,
        accentColor: fallbackAccent,
        backgroundColor: fallbackBackground,
        durationSec: 3,
        transition: "fade",
      },
    ],
    format,
    transitionFrames,
  };
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
    let inputProps: Record<string, unknown>;
    try {
      inputProps = sanitizeInputProps(body?.input_props ?? body?.inputProps);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : "input_props inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: row, error } = await supabase
      .from("neuro_motion_render_jobs")
      .insert({
        user_id: user.id,
        status: "pending",
        input_props: inputProps,
      })
      .select("id")
      .single();

    if (error) {
      console.error("neuro_motion_render_jobs insert", error);
      return new Response(JSON.stringify({ error: error.message || "Erro ao criar job" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ job_id: row.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
