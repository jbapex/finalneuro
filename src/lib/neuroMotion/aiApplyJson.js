import { NEURO_MOTION_TRANSITIONS } from '@/lib/neuroMotion/constants';
import {
  sanitizeLayerBlendMode,
  sanitizeLayerBoxShadow,
  sanitizeLayerFill,
  sanitizeLayerImageUrl,
} from '@/lib/neuroMotion/layerVisual';

const ALLOWED_FORMATS = new Set(['youtube', 'story', 'reel', 'square']);
const ALLOWED_LAYER_TYPES = new Set(['circle', 'rect', 'ellipse', 'text', 'line', 'image', 'cursor']);
const ALLOWED_OBJECT_FIT = new Set(['cover', 'contain', 'fill']);
const ALLOWED_ANIM_IN = new Set([
  'none',
  'fade',
  'spring',
  'slideUp',
  'slideLeft',
  'scale',
  'blurIn',
  'revealX',
  'rise',
  'tap',
  'snap',
]);
const ALLOWED_ANIM_LOOP = new Set(['none', 'pulse', 'rotate', 'drift', 'orbit', 'breathe', 'glowPulse']);

/** Remove vírgulas finais inválidas antes de } ou ] (erro comum em JSON gerado por LLM). */
function stripTrailingCommas(jsonStr) {
  let result = jsonStr;
  let prev;
  do {
    prev = result;
    result = result.replace(/,(\s*[}\]])/g, '$1');
  } while (result !== prev);
  return result;
}

/**
 * Extrai o primeiro objeto JSON com chaves balanceadas a partir de `start` (respeita strings).
 * Evita cortar no `}` errado quando há objetos aninhados ou } dentro de strings.
 */
function extractBalancedObject(s, startIdx) {
  const start = s.indexOf('{', startIdx);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/** Gera candidatos a JSON (fences ```, objetos balanceados, slice primeiro/último `{`…`}`). */
function collectJsonStringCandidates(raw) {
  const s = String(raw).trim().replace(/^\uFEFF/, '');
  if (!s) return [];
  const ordered = [];

  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
  let fm;
  while ((fm = fenceRe.exec(s)) !== null) ordered.push(fm[1].trim());

  const balanced = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '{') continue;
    const block = extractBalancedObject(s, i);
    if (block && block.length > 10) balanced.push(block);
  }
  balanced.sort((a, b) => b.length - a.length);
  ordered.push(...balanced);

  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) ordered.push(s.slice(start, end + 1));

  ordered.push(s);

  const uniq = [];
  const seen = new Set();
  for (const t of ordered) {
    const x = String(t).trim();
    if (x.length < 2 || seen.has(x)) continue;
    seen.add(x);
    uniq.push(x);
  }
  return uniq;
}

function tryParseJsonLoose(str) {
  try {
    const v = JSON.parse(str);
    if (Array.isArray(v) && v.length === 1 && v[0] && typeof v[0] === 'object' && Array.isArray(v[0].scenes)) {
      return v[0];
    }
    return v;
  } catch {
    try {
      const v = JSON.parse(stripTrailingCommas(str));
      if (Array.isArray(v) && v.length === 1 && v[0] && typeof v[0] === 'object' && Array.isArray(v[0].scenes)) {
        return v[0];
      }
      return v;
    } catch {
      return null;
    }
  }
}

/**
 * Extrai JSON de uma resposta que pode vir com texto extra, markdown, prosa antes do objeto, vírgulas finais, etc.
 */
export function parseJsonFromAssistant(raw) {
  if (raw == null) return null;
  const candidates = collectJsonStringCandidates(raw);
  const looksLikeProject = (obj) =>
    obj &&
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    (Array.isArray(obj.scenes) || obj.format != null || obj.transitionFrames != null);

  for (const chunk of candidates) {
    const parsed = tryParseJsonLoose(chunk);
    if (parsed && typeof parsed === 'object' && looksLikeProject(parsed)) return parsed;
  }
  for (const chunk of candidates) {
    const parsed = tryParseJsonLoose(chunk);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  }
  return null;
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

const CHOREO_FRAME_MAX = 480;

/** Coreografia intra-cena: atraso de entrada, path (arrastar), 2º tramo, twist, punch. */
function attachChoreography(out, l) {
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

function sanitizeLayer(l) {
  if (!l || typeof l !== 'object') return null;
  const type = String(l.type || '').toLowerCase();
  if (!ALLOWED_LAYER_TYPES.has(type)) return null;

  if (type === 'image') {
    const src = sanitizeLayerImageUrl(l.imageUrl ?? l.src);
    if (!src) return null;
    const of = String(l.objectFit ?? 'cover').toLowerCase();
    const objectFit = ALLOWED_OBJECT_FIT.has(of) ? of : 'cover';
    const boxShadow = sanitizeLayerBoxShadow(l.boxShadow);
    const out = {
      type: 'image',
      imageUrl: src,
      objectFit,
      ...(l.id != null && String(l.id).trim() !== '' ? { id: String(l.id).slice(0, 64) } : {}),
      x: clamp(l.x, 0, 100),
      y: clamp(l.y, 0, 100),
      w: clamp(l.w ?? 40, 2, 100),
      h: clamp(l.h ?? 40, 2, 100),
      fill: '#ffffff',
      stroke: String(l.stroke ?? '').slice(0, 32),
      strokeWidth: clamp(l.strokeWidth ?? 0, 0, 40),
      rotation: clamp(l.rotation ?? 0, -360, 360),
      opacity: clamp(l.opacity ?? 1, 0, 1),
      zIndex: Math.round(clamp(l.zIndex ?? 0, -100, 100)),
      text: '',
      fontSize: 48,
      fontWeight: 600,
      animIn: ALLOWED_ANIM_IN.has(String(l.animIn)) ? String(l.animIn) : 'fade',
      animLoop: ALLOWED_ANIM_LOOP.has(String(l.animLoop)) ? String(l.animLoop) : 'none',
      blur: clamp(l.blur ?? 0, 0, 48),
      borderRadius: clamp(l.borderRadius ?? 8, 0, 200),
      mixBlendMode: sanitizeLayerBlendMode(l.mixBlendMode),
    };
    if (boxShadow) out.boxShadow = boxShadow;
    const tapAt = l.tapAtFrame;
    if (tapAt != null && Number.isFinite(Number(tapAt))) {
      out.tapAtFrame = Math.round(clamp(tapAt, 0, CHOREO_FRAME_MAX));
    }
    attachChoreography(out, l);
    return out;
  }

  if (type === 'cursor') {
    const fill = sanitizeLayerFill(l.fill ?? 'rgba(255,255,255,0.95)');
    const boxShadow = sanitizeLayerBoxShadow(l.boxShadow);
    const mf = Math.round(clamp(l.moveFromFrame ?? 0, 0, CHOREO_FRAME_MAX));
    const mt = Math.round(clamp(l.moveToFrame ?? 0, 0, CHOREO_FRAME_MAX));
    const out = {
      type: 'cursor',
      ...(l.id != null && String(l.id).trim() !== '' ? { id: String(l.id).slice(0, 64) } : {}),
      x: clamp(l.x, 0, 100),
      y: clamp(l.y, 0, 100),
      cursorToX: clamp(l.cursorToX ?? l.x, 0, 100),
      cursorToY: clamp(l.cursorToY ?? l.y, 0, 100),
      moveFromFrame: mf,
      moveToFrame: mt >= mf ? mt : mf,
      w: clamp(l.w ?? 3.5, 1, 20),
      h: clamp(l.h ?? 3.5, 1, 20),
      fill,
      stroke: String(l.stroke ?? 'rgba(0,0,0,0.35)').slice(0, 32),
      strokeWidth: clamp(l.strokeWidth ?? 2.5, 0, 12),
      rotation: clamp(l.rotation ?? 0, -360, 360),
      opacity: clamp(l.opacity ?? 1, 0, 1),
      zIndex: Math.round(clamp(l.zIndex ?? 50, -100, 200)),
      text: '',
      fontSize: 48,
      fontWeight: 600,
      animIn: ALLOWED_ANIM_IN.has(String(l.animIn)) ? String(l.animIn) : 'fade',
      animLoop: 'none',
      blur: 0,
      borderRadius: 999,
      mixBlendMode: 'normal',
    };
    if (boxShadow) out.boxShadow = boxShadow;
    const tapAt = l.tapAtFrame;
    if (tapAt != null && Number.isFinite(Number(tapAt))) {
      out.tapAtFrame = Math.round(clamp(tapAt, 0, CHOREO_FRAME_MAX));
    }
    attachChoreography(out, l);
    return out;
  }

  const fill = sanitizeLayerFill(l.fill ?? '#ffffff');
  const boxShadow = sanitizeLayerBoxShadow(l.boxShadow);
  const out = {
    type,
    ...(l.id != null && String(l.id).trim() !== '' ? { id: String(l.id).slice(0, 64) } : {}),
    x: clamp(l.x, 0, 100),
    y: clamp(l.y, 0, 100),
    w: clamp(l.w ?? 20, 0.5, 100),
    h: clamp(l.h ?? 20, 0.5, 100),
    fill,
    stroke: String(l.stroke ?? '').slice(0, 32),
    strokeWidth: clamp(l.strokeWidth ?? 0, 0, 40),
    rotation: clamp(l.rotation ?? 0, -360, 360),
    opacity: clamp(l.opacity ?? 1, 0, 1),
    zIndex: Math.round(clamp(l.zIndex ?? 0, -100, 100)),
    text: String(l.text ?? '').slice(0, 1200),
    fontSize: clamp(l.fontSize ?? 48, 8, 200),
    fontWeight: Math.round(clamp(l.fontWeight ?? 600, 100, 900)),
    animIn: ALLOWED_ANIM_IN.has(String(l.animIn)) ? String(l.animIn) : 'fade',
    animLoop: ALLOWED_ANIM_LOOP.has(String(l.animLoop)) ? String(l.animLoop) : 'none',
    blur: clamp(l.blur ?? 0, 0, 48),
    borderRadius: clamp(l.borderRadius ?? 0, 0, 200),
    mixBlendMode: sanitizeLayerBlendMode(l.mixBlendMode),
  };
  if (boxShadow) out.boxShadow = boxShadow;
  const tapAt = l.tapAtFrame;
  if (tapAt != null && Number.isFinite(Number(tapAt))) {
    out.tapAtFrame = Math.round(clamp(tapAt, 0, CHOREO_FRAME_MAX));
  }
  attachChoreography(out, l);
  if (type === 'text') {
    const ta = String(l.textAlign ?? 'center').toLowerCase();
    if (ta === 'left' || ta === 'right' || ta === 'center') out.textAlign = ta;
    const lh = Number(l.lineHeight);
    if (Number.isFinite(lh) && lh >= 1 && lh <= 2.5) out.lineHeight = lh;
  }
  if (type !== 'text') {
    out.text = '';
  }
  return out;
}

function sanitizeScene(s, idx) {
  if (!s || typeof s !== 'object') return null;
  const title = String(s.title ?? `Cena ${idx + 1}`).slice(0, 200);
  const subtitle = String(s.subtitle ?? '').slice(0, 2000);
  const accentColor = String(s.accentColor ?? '#7c3aed').slice(0, 32);
  const backgroundColor = String(s.backgroundColor ?? '#0f172a').slice(0, 32);
  const durationSec = clamp(s.durationSec ?? 3, 1, 12);
  const tr = String(s.transition ?? 'fade');
  const transition = NEURO_MOTION_TRANSITIONS.includes(tr) ? tr : 'fade';
  const imageUrlRaw = String(s.imageUrl ?? '').trim().slice(0, 2048);
  const imageUrl = /^https:\/\//i.test(imageUrlRaw) ? imageUrlRaw : '';
  const hideClassicText = Boolean(s.hideClassicText);
  const layersRaw = Array.isArray(s.layers) ? s.layers : [];
  const layers = layersRaw.map(sanitizeLayer).filter(Boolean).slice(0, 24);

  const out = {
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
}

/**
 * Aplica JSON sanitizado ao estado do editor (precisa de ids de cena gerados no caller).
 * Retorna { format, transitionFrames, scenesData } ou null.
 */
export function sanitizeNeuroMotionProjectJson(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const formatRaw = String(parsed.format ?? 'youtube');
  const format = ALLOWED_FORMATS.has(formatRaw) ? formatRaw : 'youtube';
  const transitionFrames = Math.round(clamp(parsed.transitionFrames ?? 10, 0, 30));
  const scenesRaw = Array.isArray(parsed.scenes) ? parsed.scenes : [];
  const scenesData = scenesRaw.map((s, i) => sanitizeScene(s, i)).filter(Boolean).slice(0, 20);
  if (!scenesData.length) return null;
  return { format, transitionFrames, scenesData };
}
