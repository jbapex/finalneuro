import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, useVideoConfig } from 'remotion';
import {
  isGradientFill,
  sanitizeLayerBlendMode,
  sanitizeLayerBoxShadow,
  sanitizeLayerFill,
  sanitizeLayerImageUrl,
} from '@/lib/neuroMotion/layerVisual';
import { neuromotionFontFamily } from '@/lib/neuroMotion/loadInterFont';

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 1;
  return Math.min(1, Math.max(0, x));
}

const DEFAULT_LAYER = {
  type: 'rect',
  x: 50,
  y: 50,
  w: 20,
  h: 20,
  fill: '#ffffff',
  stroke: '',
  strokeWidth: 0,
  rotation: 0,
  opacity: 1,
  zIndex: 0,
  text: '',
  fontSize: 48,
  fontWeight: 600,
  animIn: 'fade',
  animLoop: 'none',
  blur: 0,
  borderRadius: 0,
  mixBlendMode: 'normal',
  boxShadow: '',
  imageUrl: '',
  objectFit: 'cover',
  cursorToX: 50,
  cursorToY: 50,
  textAlign: 'center',
  lineHeight: 1.06,
  moveFromFrame: 0,
  moveToFrame: 0,
  tapAtFrame: undefined,
  animDelay: 0,
  path2FromFrame: undefined,
  path2ToFrame: undefined,
  path2ToX: undefined,
  path2ToY: undefined,
  twistAtFrame: undefined,
  twistDeg: undefined,
  punchAtFrame: undefined,
  punchScale: 1.12,
};

function layerStyleBase(layer, width, height) {
  const cx = (layer.x / 100) * width;
  const cy = (layer.y / 100) * height;
  const wPx = (layer.w / 100) * width;
  const hPx = (layer.h / 100) * height;
  return { cx, cy, wPx, hPx };
}

const PATH_MOVE_EASE = Easing.out(Easing.cubic);

/** Primeiro tramo: (x,y) → (pathToX, pathToY) entre pathFromFrame e pathToFrame (ou move/cursor). */
function getLayerXYOnlyPath1(layer, frame) {
  const x0 = Number(layer.x) || 0;
  const y0 = Number(layer.y) || 0;
  const p1f = Number(layer.pathFromFrame ?? layer.moveFromFrame) || 0;
  const p1t = Number(layer.pathToFrame ?? layer.moveToFrame) || 0;
  const tx1 = layer.pathToX ?? layer.cursorToX;
  const ty1 = layer.pathToY ?? layer.cursorToY;
  const x1 = Number.isFinite(Number(tx1)) ? Number(tx1) : x0;
  const y1 = Number.isFinite(Number(ty1)) ? Number(ty1) : y0;

  let x = x0;
  let y = y0;
  if (p1t > p1f) {
    const u = interpolate(frame, [p1f, p1t], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: PATH_MOVE_EASE,
    });
    x = x0 + (x1 - x0) * u;
    y = y0 + (y1 - y0) * u;
  }
  return { x, y };
}

/** Path completo: segundo tramo opcional (ex.: cursor vai ao botão e depois sai). Qualquer layer pode “arrastar”. */
function getLayerXYAtFrame(layer, frame) {
  const p2f = Number(layer.path2FromFrame);
  const p2t = Number(layer.path2ToFrame);
  const tx2 = Number(layer.path2ToX);
  const ty2 = Number(layer.path2ToY);
  if (!(Number.isFinite(p2f) && Number.isFinite(p2t) && p2t > p2f && Number.isFinite(tx2) && Number.isFinite(ty2))) {
    return getLayerXYOnlyPath1(layer, frame);
  }
  if (frame < p2f) {
    return getLayerXYOnlyPath1(layer, frame);
  }
  const start2 = getLayerXYOnlyPath1(layer, p2f);
  const u2 = interpolate(frame, [p2f, p2t], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: PATH_MOVE_EASE,
  });
  return {
    x: start2.x + (tx2 - start2.x) * u2,
    y: start2.y + (ty2 - start2.y) * u2,
  };
}

/** Micro-escala tipo “clique” num frame absoluto da cena (qualquer layer). */
function tapRippleScale(localFrame, tapAtFrame) {
  if (tapAtFrame == null || !Number.isFinite(Number(tapAtFrame))) return 1;
  const tf = Number(tapAtFrame);
  return interpolate(localFrame, [tf, tf + 2, tf + 8], [1, 0.84, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
}

/** “Punch” de escala num instante (transformação forte). */
function punchScaleMul(localFrame, punchAtFrame, punchScale) {
  if (punchAtFrame == null || !Number.isFinite(Number(punchAtFrame))) return 1;
  const pf = Number(punchAtFrame);
  const ps = Number.isFinite(Number(punchScale)) ? Number(punchScale) : 1.12;
  return interpolate(localFrame, [pf, pf + 2, pf + 12], [1, ps, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
}

/** Rotação extra (graus → rad) num instante — cartão a tombar, UI a girar. */
function twistExtraRad(layer, localFrame) {
  const tf = layer.twistAtFrame;
  const deg = layer.twistDeg;
  if (tf == null || deg == null || !Number.isFinite(Number(tf)) || !Number.isFinite(Number(deg))) return 0;
  const d = interpolate(
    localFrame,
    [Number(tf), Number(tf) + 4, Number(tf) + 16],
    [0, Number(deg), 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    }
  );
  return (d * Math.PI) / 180;
}

/** Curvas tipo pacote TV: entra rápido no sítio, sem “molas” longas. */
const BC_CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
const BC_OUT = Easing.out(Easing.cubic);
const BC_OUT_QUAD = Easing.out(Easing.quad);
const BC_IN_OUT = Easing.inOut(Easing.cubic);

function bcInterp(frame, input, output, easing = BC_OUT) {
  return interpolate(frame, input, output, { ...BC_CLAMP, easing });
}

function computeInTransform(layer, localFrame, fps, { cx, cy, wPx, hPx }) {
  const delay = Math.max(0, Math.round(Number(layer.animDelay) || 0));
  if (localFrame < delay) {
    const t0 = String(layer.animIn || 'fade');
    if (t0 === 'none') {
      return {
        opacity: 0,
        tx: 0,
        ty: 0,
        scale: 1,
        scaleX: 1,
        baseRot: ((layer.rotation || 0) * Math.PI) / 180,
        cx,
        cy,
        wPx,
        hPx,
        animBlur: 0,
      };
    }
    return {
      opacity: 0,
      tx: 0,
      ty: 0,
      scale: 0.96,
      scaleX: 1,
      baseRot: ((layer.rotation || 0) * Math.PI) / 180,
      cx,
      cy,
      wPx,
      hPx,
      animBlur: 0,
    };
  }

  const f = localFrame - delay;
  const t = String(layer.animIn || 'fade');
  let opacity = 1;
  let tx = 0;
  let ty = 0;
  let scale = 1;
  let scaleX = 1;
  let animBlur = 0;

  if (t === 'none') {
    opacity = 1;
  } else if (t === 'fade') {
    opacity = bcInterp(f, [0, 11], [0, 1]);
  } else if (t === 'spring') {
    scale = spring({ fps, frame: f, config: { damping: 16, stiffness: 178, mass: 0.85 } });
    opacity = bcInterp(f, [0, 6], [0, 1]);
  } else if (t === 'slideUp') {
    ty = bcInterp(f, [0, 14], [hPx * 0.92, 0], BC_OUT_QUAD);
    opacity = bcInterp(f, [0, 10], [0, 1]);
  } else if (t === 'slideLeft') {
    tx = bcInterp(f, [0, 14], [wPx * 0.72, 0], BC_OUT_QUAD);
    opacity = bcInterp(f, [0, 10], [0, 1]);
  } else if (t === 'scale') {
    scale = bcInterp(f, [0, 12], [0.08, 1], Easing.out(Easing.back(1.1)));
    opacity = bcInterp(f, [0, 9], [0, 1]);
  } else if (t === 'blurIn') {
    animBlur = bcInterp(f, [0, 18], [32, 0], BC_IN_OUT);
    opacity = bcInterp(f, [0, 14], [0, 1]);
  } else if (t === 'revealX') {
    scaleX = bcInterp(f, [0, 14], [0.02, 1], Easing.out(Easing.cubic));
    opacity = bcInterp(f, [0, 10], [0, 1]);
  } else if (t === 'rise') {
    ty = bcInterp(f, [0, 15], [hPx * 0.62, 0], BC_OUT_QUAD);
    scale = bcInterp(f, [0, 15], [0.88, 1], BC_OUT);
    opacity = bcInterp(f, [0, 12], [0, 1]);
  } else if (t === 'snap') {
    scale = interpolate(f, [0, 8, 13], [0.5, 1.1, 1], {
      ...BC_CLAMP,
      easing: Easing.out(Easing.cubic),
    });
    opacity = bcInterp(f, [0, 6], [0, 1]);
  } else if (t === 'tap') {
    opacity = bcInterp(f, [0, 5], [0, 1]);
    const press = interpolate(f, [10, 12, 17], [1, 0.9, 1], {
      ...BC_CLAMP,
      easing: Easing.out(Easing.back(1.05)),
    });
    scale = press;
  } else {
    opacity = bcInterp(f, [0, 10], [0, 1]);
  }

  const baseRot = ((layer.rotation || 0) * Math.PI) / 180;
  return { opacity, tx, ty, scale, scaleX, baseRot, cx, cy, wPx, hPx, animBlur };
}

function computeLoopMotion(layer, localFrame, fps, durationInFrames, geom) {
  const loop = String(layer.animLoop || 'none');
  const { wPx } = geom;
  let extraRot = 0;
  let ox = 0;
  let oy = 0;
  let pulseScale = 1;
  let glowMul = 1;

  const time = localFrame / Math.max(1, fps);
  const orbitR = Math.min(wPx * 0.35, 80);

  if (loop === 'pulse') {
    pulseScale = 1 + 0.055 * Math.sin(time * 4.2);
  } else if (loop === 'breathe') {
    pulseScale = 1 + 0.042 * Math.sin(time * 2.45);
  } else if (loop === 'glowPulse') {
    glowMul = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(time * 3.6));
  } else if (loop === 'rotate') {
    extraRot = (time * 0.45) % (Math.PI * 2);
  } else if (loop === 'drift') {
    ox = Math.sin(time * 0.85) * orbitR * 0.32;
    oy = Math.cos(time * 0.65) * orbitR * 0.28;
  } else if (loop === 'orbit') {
    ox = Math.cos(time * 0.95) * orbitR;
    oy = Math.sin(time * 0.95) * orbitR;
  }

  return { extraRot, ox, oy, pulseScale, glowMul };
}

function shapeBorderRadius(layer, wPx, type) {
  const br = Number(layer.borderRadius) || 0;
  if (br > 0) return `${Math.min(br, 999)}px`;
  if (type === 'circle') return '50%';
  if (type === 'ellipse') return `${Math.min(24, wPx * 0.1)}px`;
  return `${Math.min(32, wPx * 0.12)}px`;
}

const OneLayer = ({ layer: raw, localFrame, durationInFrames }) => {
  const { width, height, fps } = useVideoConfig();
  const vertical = height > width;
  const layer = { ...DEFAULT_LAYER, ...raw };
  if (layer.type !== 'image') {
    layer.fill = sanitizeLayerFill(layer.fill);
  } else {
    layer.fill = layer.fill || '#ffffff';
  }
  layer.boxShadow = sanitizeLayerBoxShadow(layer.boxShadow);
  layer.mixBlendMode = sanitizeLayerBlendMode(layer.mixBlendMode);

  const pos = getLayerXYAtFrame(layer, localFrame);
  const layerPos = { ...layer, x: pos.x, y: pos.y };
  const geom = layerStyleBase(layerPos, width, height);
  const { opacity: inOp, tx, ty, scale, scaleX, baseRot, cx, cy, wPx, hPx, animBlur } = computeInTransform(
    layer,
    localFrame,
    fps,
    geom
  );
  const { extraRot, ox, oy, pulseScale, glowMul } = computeLoopMotion(layer, localFrame, fps, durationInFrames, geom);

  const baseBlur = Math.max(0, Number(layer.blur) || 0);
  const totalBlur = baseBlur + animBlur;
  const filter = totalBlur > 0.5 ? `blur(${totalBlur}px)` : undefined;

  const tapMul = tapRippleScale(localFrame, layer.tapAtFrame);
  const punchMul = punchScaleMul(localFrame, layer.punchAtFrame, layer.punchScale);
  const op = inOp * clamp01(layer.opacity ?? 1) * glowMul;
  const rot = baseRot + extraRot + twistExtraRad(layer, localFrame);
  const common = {
    position: 'absolute',
    left: cx + ox + tx,
    top: cy + oy + ty,
    transform: `translate(-50%, -50%) rotate(${rot}rad) scaleX(${scaleX}) scale(${scale * pulseScale * tapMul * punchMul})`,
    opacity: op,
    zIndex: layer.zIndex ?? 0,
    mixBlendMode: layer.mixBlendMode !== 'normal' ? layer.mixBlendMode : undefined,
    filter,
    willChange: filter ? 'filter, transform' : 'transform',
  };

  const stroke = layer.stroke && String(layer.stroke).length > 2 ? layer.stroke : undefined;
  const sw = stroke ? Math.max(0, Number(layer.strokeWidth) || 0) : 0;
  const shadow = layer.boxShadow || undefined;

  if (layer.type === 'image') {
    const src = sanitizeLayerImageUrl(layer.imageUrl || layer.src);
    if (!src) return <div style={{ display: 'none' }} aria-hidden />;
    const br = shapeBorderRadius(layer, wPx, 'rect');
    return (
      <div
        style={{
          ...common,
          width: wPx,
          height: hPx,
          borderRadius: br,
          overflow: 'hidden',
          boxSizing: 'border-box',
          boxShadow: shadow,
          border: stroke ? `${sw}px solid ${stroke}` : undefined,
        }}
      >
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: layer.objectFit || 'cover',
            display: 'block',
          }}
        />
      </div>
    );
  }

  if (layer.type === 'cursor') {
    const swCur = Math.max(0, Number(layer.strokeWidth) || 2.5);
    const dot = Math.max(20, Math.min(wPx, hPx, 56));
    return (
      <div
        style={{
          ...common,
          width: dot,
          height: dot,
          borderRadius: '50%',
          backgroundColor: layer.fill || 'rgba(255,255,255,0.95)',
          border: stroke ? `${swCur}px solid ${stroke}` : `${swCur}px solid rgba(0,0,0,0.35)`,
          boxShadow: shadow || '0 6px 28px rgba(0,0,0,0.45)',
          boxSizing: 'border-box',
        }}
      />
    );
  }

  if (layer.type === 'text') {
    const grad = isGradientFill(layer.fill);
    const alignRaw = String(layer.textAlign || 'center').toLowerCase();
    const textAlign = alignRaw === 'left' || alignRaw === 'right' ? alignRaw : 'center';
    const lh = Number(layer.lineHeight);
    const lineHeight =
      Number.isFinite(lh) && lh >= 1 && lh <= 2.5 ? lh : textAlign === 'left' ? 1.28 : 1.08;
    return (
      <div
        style={{
          ...common,
          fontFamily: neuromotionFontFamily,
          fontWeight: layer.fontWeight ?? 700,
          fontSize: Math.max(12, Number(layer.fontSize) || 48),
          lineHeight,
          letterSpacing: textAlign === 'left' ? '-0.02em' : '-0.045em',
          whiteSpace: 'pre-wrap',
          textAlign,
          maxWidth: width * (vertical ? 0.86 : 0.9),
          ...(grad
            ? {
                backgroundImage: layer.fill,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                WebkitTextFillColor: 'transparent',
                filter: filter
                  ? `${filter} drop-shadow(0 6px 36px rgba(0,0,0,0.72))`
                  : 'drop-shadow(0 6px 36px rgba(0,0,0,0.72))',
              }
            : {
                color: layer.fill || '#fff',
                textShadow:
                  '0 0 2px rgba(0,0,0,0.95), 0 4px 48px rgba(0,0,0,0.65), 0 1px 0 rgba(0,0,0,0.4)',
              }),
          boxShadow: shadow,
        }}
      >
        {layer.text || ' '}
      </div>
    );
  }

  if (layer.type === 'line') {
    const len = Math.max(wPx, 8);
    const fill = layer.fill;
    const isGrad = isGradientFill(fill);
    return (
      <div
        style={{
          ...common,
          width: len,
          height: Math.max(2, sw || 3),
          borderRadius: 9999,
          ...(isGrad
            ? { backgroundImage: fill, backgroundColor: 'transparent' }
            : { backgroundColor: fill || '#fff' }),
          boxShadow: shadow || (stroke ? `0 0 0 ${sw}px ${stroke}` : undefined),
        }}
      />
    );
  }

  const fill = layer.fill;
  const isGrad = isGradientFill(fill);
  const boxStyle = {
    ...common,
    width: wPx,
    height: hPx,
    ...(isGrad ? { backgroundImage: fill, backgroundColor: 'transparent' } : { backgroundColor: fill || '#888' }),
    border: stroke ? `${sw}px solid ${stroke}` : undefined,
    boxSizing: 'border-box',
    boxShadow: shadow,
    borderRadius: shapeBorderRadius(layer, wPx, layer.type),
  };

  return <div style={boxStyle} />;
};

/**
 * Camadas animadas (motion design) por cena.
 */
const MotionLayers = ({ layers, localFrame, durationInFrames }) => {
  const list = Array.isArray(layers) ? layers : [];
  const filtered = list.filter((layer) => {
    if (String(layer?.type).toLowerCase() === 'image') {
      return Boolean(sanitizeLayerImageUrl(layer.imageUrl || layer.src));
    }
    return true;
  });
  if (!filtered.length) return null;
  const sorted = [...filtered].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {sorted.map((layer, idx) => (
        <OneLayer
          key={layer.id || `layer-${idx}`}
          layer={layer}
          localFrame={localFrame}
          durationInFrames={durationInFrames}
        />
      ))}
    </AbsoluteFill>
  );
};

export default MotionLayers;
