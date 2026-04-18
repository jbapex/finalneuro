import React, { forwardRef, useMemo } from 'react';
import { Bookmark, ChevronRight, Heart, Share2, MessageCircle, MousePointer2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LAYOUT_SHELL_FLEX,
  carrosselTituloHorizontalInset,
  carrosselTituloVerticalInset,
  resolveCarrosselCanvasFormat,
  normalizeCarrosselImagemGrade,
} from '@/lib/neurodesign/carrosselSlideModel';

export const DEFAULT_SLIDE_W = 1080;
export const DEFAULT_SLIDE_H = 1350;
/** @deprecated use dimensões por formato; mantido para compatibilidade */
export const SLIDE_W = DEFAULT_SLIDE_W;
export const SLIDE_H = DEFAULT_SLIDE_H;

const ICONS = {
  none: null,
  bookmark: Bookmark,
  arrow: ChevronRight,
  heart: Heart,
  share: Share2,
  comment: MessageCircle,
  cursor: MousePointer2,
};

function parseOverlayBaseColor(hex) {
  const h = String(hex || '')
    .trim()
    .replace('#', '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return { r: 10, g: 10, b: 10 };
    return { r, g, b };
  }
  if (h.length === 6) {
    const n = parseInt(h, 16);
    if (!Number.isNaN(n)) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
      };
    }
  }
  return { r: 10, g: 10, b: 10 };
}

/** No tema claro (fundo claro), o overlay precisa ser claro; no escuro, permanece escuro. */
function resolveOverlayInkRgb(slide) {
  const explicit = String(slide?.overlayCor || '')
    .trim()
    .toLowerCase();
  if (explicit && explicit !== 'auto') {
    return parseOverlayBaseColor(explicit);
  }
  const { r, g, b } = parseOverlayBaseColor(slide?.corFundo || '#0a0a0a');
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (luminance >= 170) return { r: 255, g: 255, b: 255 };
  return { r: 0, g: 0, b: 0 };
}

function renderOverlay(slide, onActivateConfig) {
  const oRaw = slide.overlayEstilo;
  const a = Math.min(100, Math.max(0, Number(slide.overlayOpacidade) || 0)) / 100;
  if (oRaw === 'nenhum') return null;

  const interactive = typeof onActivateConfig === 'function';
  /** Com grade de imagens, o overlay cobria a grelha (z-2 sobre z-1) e roubava cliques para «Sombra / overlay». */
  const overlayPointerPassthrough = interactive && Boolean(slide?.imagemGradeAtiva);
  const ink = resolveOverlayInkRgb(slide);
  const rgba = (alpha) => `rgba(${ink.r},${ink.g},${ink.b},${alpha})`;

  const layout = slide.layoutPosicao;
  let gradient = '';

  if (oRaw === 'total') {
    gradient = `linear-gradient(to bottom, ${rgba(a)}, ${rgba(a * 0.85)})`;
  } else if (oRaw === 'topo-base') {
    gradient =
      `linear-gradient(to bottom, ${rgba(a * 0.95)} 0%, ${rgba(a * 0.28)} 34%, transparent 52%), ` +
      `linear-gradient(to top, ${rgba(a * 0.95)} 0%, ${rgba(a * 0.28)} 34%, transparent 52%)`;
  } else if (oRaw === 'vinheta') {
    gradient =
      `radial-gradient(ellipse 120% 115% at 50% 50%, transparent 48%, ${rgba(a * 0.36)} 72%, ${rgba(a)} 100%)`;
  } else if (oRaw === 'lateral') {
    const pos = String(layout || '');
    const fromRight = pos.includes('dir') && !pos.includes('centro');
    gradient = fromRight
      ? `linear-gradient(to left, ${rgba(a)} 0%, ${rgba(a * 0.38)} 52%, transparent 100%)`
      : `linear-gradient(to right, ${rgba(a)} 0%, ${rgba(a * 0.38)} 52%, transparent 100%)`;
  } else if (oRaw === 'topo-intenso' || oRaw === 'base-intenso' || oRaw === 'topo-suave' || oRaw === 'base-suave') {
    const isSuave = oRaw === 'topo-suave' || oRaw === 'base-suave';
    const strong = isSuave ? a * 0.72 : a;
    const middle = isSuave ? a * 0.24 : a * 0.42;
    if (oRaw === 'topo-intenso' || oRaw === 'topo-suave') {
      gradient = `linear-gradient(to bottom, ${rgba(strong)} 0%, ${rgba(middle)} 52%, transparent 100%)`;
    } else {
      gradient = `linear-gradient(to top, ${rgba(strong)} 0%, ${rgba(middle)} 52%, transparent 100%)`;
    }
  }

  if (!gradient) return null;
  return (
    <div
      className={interactive && !overlayPointerPassthrough ? 'cursor-pointer' : undefined}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: interactive && !overlayPointerPassthrough ? 'auto' : 'none',
        background: gradient,
        zIndex: 2,
      }}
      onClick={interactive && !overlayPointerPassthrough ? () => onActivateConfig('overlay') : undefined}
    />
  );
}

/** `patternId` único por instância — vários slides em fila não podem repetir `id` no DOM. */
function renderPadrao(slide, patternId) {
  const tipo = slide.padrao;
  if (!tipo || tipo === 'nenhum') return null;
  const size = Math.max(20, Number(slide.padraoTamanho) || 150);
  const op = Math.min(100, Math.max(0, Number(slide.padraoOpacidade) || 10)) / 100;
  const stroke = `rgba(255,255,255,${op})`;

  let children = null;
  if (tipo === 'grade') {
    children = (
      <pattern id={patternId} width={size} height={size} patternUnits="userSpaceOnUse">
        <path d={`M ${size} 0 L 0 0 0 ${size}`} fill="none" stroke={stroke} strokeWidth="1" />
      </pattern>
    );
  } else if (tipo === 'bolinhas') {
    children = (
      <pattern id={patternId} width={size} height={size} patternUnits="userSpaceOnUse">
        <circle cx={size / 2} cy={size / 2} r={size * 0.08} fill={stroke} />
      </pattern>
    );
  } else if (tipo === 'linhas-horizontais') {
    children = (
      <pattern id={patternId} width={size} height={size} patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2={size} y2="0" stroke={stroke} strokeWidth="1" />
      </pattern>
    );
  } else if (tipo === 'linhas-diagonais') {
    children = (
      <pattern id={patternId} width={size} height={size} patternUnits="userSpaceOnUse">
        <line x1="0" y1={size} x2={size} y2="0" stroke={stroke} strokeWidth="1" />
      </pattern>
    );
  } else if (tipo === 'xadrez') {
    children = (
      <pattern id={patternId} width={size} height={size} patternUnits="userSpaceOnUse">
        <rect width={size / 2} height={size / 2} fill={stroke} opacity={0.35} />
        <rect x={size / 2} y={size / 2} width={size / 2} height={size / 2} fill={stroke} opacity={0.35} />
      </pattern>
    );
  }

  if (!children) return null;
  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>{children}</defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}

function parseHexRgb(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (h.length !== 6 || Number.isNaN(parseInt(h, 16))) return { r: 10, g: 10, b: 10 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Fundo claro → texto/cantos/CTA auxiliares em tons escuros (modo «Claro» do editor). */
function isSlideFundoLight(slide) {
  const { r, g, b } = parseHexRgb(slide?.corFundo || '#0a0a0a');
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance >= 170;
}

function gradeAspectCssRatio(aspect) {
  const a = String(aspect || '16:9');
  if (a === '1:1') return '1/1';
  if (a === '9:16') return '9/16';
  if (a === '4:5') return '4/5';
  return '16/9';
}

function gradeEmptyHint(aspect) {
  const a = String(aspect || '16:9');
  if (a === '16:9') return '16:9';
  if (a === '1:1') return '1:1';
  if (a === '9:16') return '9:16';
  if (a === '4:5') return '4:5';
  return '';
}

/** Mantém proporção da miniatura dentro da célula (cartão X). */
function GradeSlotAspectBox({ aspect, children }) {
  const r = gradeAspectCssRatio(aspect);
  const arNum =
    aspect === '1:1' ? 1 : aspect === '9:16' ? 9 / 16 : aspect === '4:5' ? 4 / 5 : 16 / 9;
  const portrait = arNum < 1;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <div
        style={
          portrait
            ? {
                height: '100%',
                width: 'auto',
                aspectRatio: r,
                maxWidth: '100%',
                minHeight: 0,
                minWidth: 0,
                position: 'relative',
              }
            : {
                width: '100%',
                height: 'auto',
                aspectRatio: r,
                maxHeight: '100%',
                minHeight: 0,
                minWidth: 0,
                position: 'relative',
              }
        }
      >
        <div style={{ position: 'absolute', inset: 0, minHeight: 0, minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}

function CarrosselGradeSlotCell({ slot, radiusPx, lightBg, emptyHint }) {
  const z = Number(slot?.zoom) > 0 ? Number(slot.zoom) : 100;
  const px = Number.isFinite(Number(slot?.posX)) ? Number(slot.posX) : 50;
  const py = Number.isFinite(Number(slot?.posY)) ? Number(slot.posY) : 50;
  const has = slot?.imagem && String(slot.imagem).trim();
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        borderRadius: Math.max(0, radiusPx),
        overflow: 'hidden',
        backgroundColor: has ? undefined : lightBg ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)',
        backgroundImage: has ? `url(${slot.imagem})` : undefined,
        backgroundRepeat: 'no-repeat',
        backgroundSize: has ? `${z}%` : undefined,
        backgroundPosition: has ? `${px}% ${py}%` : undefined,
      }}
    >
      {!has && emptyHint ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 0.04,
            opacity: 0.42,
            pointerEvents: 'none',
            color: lightBg ? '#111' : '#fff',
          }}
        >
          {emptyHint}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Cabeçalho do perfil (avatar + nome + @ + descrição curta) no estilo X, em fluxo normal
 * (não absoluto) para empilhar com o corpo do tweet e a miniatura.
 */
function TwitterMinimalBadgeProfile({ slide, lightBg, onActivateConfig }) {
  const G = ((Number(slide.badgeTamanhoGlobal) || 100) / 100) * ((Number(slide.badgeTamanhoSlide) || 100) / 100);
  const hitBadge = onActivateConfig
    ? (e) => {
        e.stopPropagation();
        onActivateConfig('badge');
      }
    : undefined;
  return (
    <div
      className={onActivateConfig ? 'cursor-pointer' : undefined}
      onClick={hitBadge}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: `${12 * G}px`,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: `${42 * G}px`,
          height: `${42 * G}px`,
          borderRadius: `${Math.max(0, Math.min(100, Number(slide.badgeFotoRound) || 100))}%`,
          overflow: 'hidden',
          background: lightBg ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: `${14 * G}px`,
          opacity: 0.92,
        }}
      >
        {slide.badgeFotoUrl ? (
          <img src={slide.badgeFotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          '?'
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            fontWeight: 700,
            fontSize: `${26 * G}px`,
            lineHeight: 1.05,
            color: lightBg ? '#111' : '#fff',
          }}
        >
          <span>{slide.badgeTitulo || 'Título verificado'}</span>
          {slide.badgeVerificado ? (
            <span
              style={{
                display: 'inline-flex',
                width: `${16 * G}px`,
                height: `${16 * G}px`,
                borderRadius: '999px',
                background: '#1d9bf0',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: `${11 * G}px`,
                fontWeight: 800,
                color: '#fff',
              }}
            >
              ✓
            </span>
          ) : null}
        </div>
        <div
          style={{
            fontSize: `${17 * G}px`,
            color: lightBg ? 'rgba(0,0,0,0.58)' : 'rgba(255,255,255,0.66)',
            marginTop: 2,
          }}
        >
          {slide.badgeHandle || '@handle'}
        </div>
        {slide.badgeDescricao ? (
          <div
            style={{
              marginTop: 3,
              maxWidth: `${520 * G}px`,
              fontSize: `${16 * G}px`,
              color: lightBg ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.82)',
              lineHeight: 1.25,
            }}
          >
            {slide.badgeDescricao}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function titleToSpans(titulo, destacadas, corDestaque, formatacaoPalavras, onActivateDestaque) {
  const words = String(titulo || '').split(/(\s+)/);
  return words.map((chunk, i) => {
    if (/^\s+$/.test(chunk)) return <span key={i}>{chunk}</span>;
    const low = chunk.replace(/[.,!?;:]+$/g, '').toLowerCase();
    const isDest = destacadas.some((d) => String(d).toLowerCase() === low);
    const fmt = formatacaoPalavras?.[chunk] || formatacaoPalavras?.[low] || {};
    const style = {
      color: isDest ? corDestaque : undefined,
      fontWeight: fmt.bold ? 800 : undefined,
      fontStyle: fmt.italic ? 'italic' : undefined,
      textDecoration: [fmt.underline && 'underline', fmt.strike && 'line-through'].filter(Boolean).join(' ') || undefined,
    };
    return (
      <span
        key={i}
        style={style}
        className={isDest && onActivateDestaque ? 'cursor-pointer' : undefined}
        onClick={
          isDest && onActivateDestaque
            ? (e) => {
                e.stopPropagation();
                onActivateDestaque();
              }
            : undefined
        }
      >
        {chunk}
      </span>
    );
  });
}

const CarrosselSlideCanvas = forwardRef(function CarrosselSlideCanvas(
  { slide, activeIndex, totalSlides, allSlides = [], canvasFormat = 'carousel', onActivateConfig },
  ref
) {
  const { slideW, slideH } = resolveCarrosselCanvasFormat(canvasFormat);
  const padraoPatternId = `carrossel-padrao-${String(slide.id ?? 'slide').replace(/\s/g, '')}`;
  // ref anexado ao root 1080×1350 para export html2canvas
  const layoutShellKey =
    slide.layoutPosicao && LAYOUT_SHELL_FLEX[slide.layoutPosicao] ? slide.layoutPosicao : 'meio';
  const align = slide.alinhamento === 'centro' ? 'center' : slide.alinhamento === 'dir' ? 'right' : 'left';
  const IconCanto = ICONS[slide.cantoIcone] || ICONS.bookmark;

  const mh = Math.max(0, Number(slide.margemHorizontal) || 0);
  const mv = Math.max(0, Number(slide.margemVertical) || 0);
  const lightBg = useMemo(() => isSlideFundoLight(slide), [slide.corFundo]);
  const cantoOp = Math.min(100, Math.max(0, Number(slide.cantoOpacidade) || 60)) / 100;
  const cantoTextColor = lightBg ? `rgba(17,17,17,${cantoOp})` : `rgba(255,255,255,${cantoOp})`;
  const cantoMinimalBorder = lightBg ? '1px solid rgba(0,0,0,0.14)' : '1px solid rgba(255,255,255,0.2)';

  const glassAlvo =
    slide.glassAlvo === 'titulo' || slide.glassAlvo === 'subtitulo' ? slide.glassAlvo : 'ambos';
  const glassSplit = Boolean(slide.glass) && glassAlvo !== 'ambos';

  const glassPanelStyle = useMemo(() => {
    if (!slide.glass) return null;
    const r = Math.min(64, Math.max(0, Number(slide.glassBorderRadius)));
    const glassR = Number.isFinite(r) ? r : 16;
    const p = Math.min(96, Math.max(0, Number(slide.glassPadding)));
    const glassPad = Number.isFinite(p) ? p : 16;
    const op = Math.min(100, Math.max(0, Number(slide.glassOpacidade)));
    const glassOp = (Number.isFinite(op) ? op : 25) / 100;
    const bl = Math.min(40, Math.max(0, Number(slide.glassBlur)));
    const glassBlurPx = Number.isFinite(bl) ? bl : 12;
    const { r: cr, g: cg, b: cb } = parseHexRgb(slide.glassCor || '#0a0a0a');
    const borderA = Math.min(0.55, glassOp + 0.14);
    return {
      boxSizing: 'border-box',
      maxWidth: '100%',
      width: 'fit-content',
      backdropFilter: `blur(${glassBlurPx}px)`,
      background: `rgba(${cr},${cg},${cb},${glassOp})`,
      borderRadius: glassR,
      padding: `${glassPad}px`,
      border: `1px solid rgba(${cr},${cg},${cb},${borderA})`,
    };
  }, [
    slide.glass,
    slide.glassBorderRadius,
    slide.glassPadding,
    slide.glassCor,
    slide.glassOpacidade,
    slide.glassBlur,
  ]);

  const slideGrade = useMemo(() => normalizeCarrosselImagemGrade(slide), [slide]);
  const gradeOn = Boolean(slideGrade.imagemGradeAtiva);
  /** Cartão estilo X: perfil minimal + grelha, sem glass — empilha cabeçalho, texto e miniatura. */
  const twitterStackedPost =
    Boolean(slide.mostrarBadge) &&
    gradeOn &&
    String(slide.badgeEstilo || '') === 'minimal' &&
    !slide.glass;
  const gradeAdaptarTexto = slideGrade.imagemGradeAdaptarTexto !== false;
  const autoTopFrac = gradeAdaptarTexto
    ? twitterStackedPost
      ? 0.46
      : 0.38
    : twitterStackedPost
      ? 0.36
      : 0.3;
  const manualInicio = slideGrade.imagemGradeInicioFrac;
  const gradeTopFrac =
    manualInicio != null && manualInicio !== '' && Number.isFinite(Number(manualInicio))
      ? Math.min(0.58, Math.max(0.14, Number(manualInicio)))
      : autoTopFrac;
  const gradeGridTopPx = Math.round(slideH * gradeTopFrac);
  /** Faixa entre fim do texto e início da grelha (modo X empilhado), em px. */
  const twitterGradeGapPx = twitterStackedPost ? 6 : 0;
  const gradeTopWithGapPx = gradeGridTopPx + twitterGradeGapPx;
  /** Mesmo recuo horizontal do bloco de texto — para a miniatura/grelha não colar às bordas no cartão X. */
  const gradeHorizontalInset = useMemo(
    () => carrosselTituloHorizontalInset(layoutShellKey, mh),
    [layoutShellKey, mh]
  );

  /** Área útil: margem horizontal assimétrica + respiro mínimo às bordas; vertical idem. Com grade, o texto fica acima da zona da grelha. */
  const marginShellStyle = useMemo(() => {
    const { left: insetL, right: insetR } = carrosselTituloHorizontalInset(layoutShellKey, mh);
    const { top: insetT, bottom: insetB } = carrosselTituloVerticalInset(mv);
    let bottom = insetB;
    if (gradeOn) {
      const gradeTopReserve = twitterStackedPost ? gradeTopWithGapPx : gradeGridTopPx;
      const reserveFromBottom = slideH - gradeTopReserve;
      bottom = Math.max(insetB, reserveFromBottom);
    }
    if (twitterStackedPost) {
      const anchorV = ['sup', 'centro', 'inf'].includes(String(slide.twitterConteudoAnchorV))
        ? String(slide.twitterConteudoAnchorV)
        : 'centro';
      const anchorH = ['esq', 'centro', 'dir'].includes(String(slide.twitterConteudoAnchorH))
        ? String(slide.twitterConteudoAnchorH)
        : 'centro';
      const justifyContent =
        anchorV === 'sup' ? 'flex-start' : anchorV === 'inf' ? 'flex-end' : 'center';
      const alignItems =
        anchorH === 'esq' ? 'flex-start' : anchorH === 'dir' ? 'flex-end' : 'center';
      /** Respiro uniforme; âncora vertical vem do slide (padrão «Centro» no Twitter). */
      const twitterTopBreathingPx = 16;
      return {
        position: 'absolute',
        left: insetL,
        right: insetR,
        top: insetT + twitterTopBreathingPx,
        bottom,
        display: 'flex',
        flexDirection: 'column',
        justifyContent,
        alignItems,
        boxSizing: 'border-box',
        zIndex: 8,
        overflow: 'hidden',
        minHeight: 0,
        isolation: 'isolate',
      };
    }
    return {
      position: 'absolute',
      left: insetL,
      right: insetR,
      top: insetT,
      bottom,
      display: 'flex',
      boxSizing: 'border-box',
      zIndex: 4,
      ...LAYOUT_SHELL_FLEX[layoutShellKey],
    };
  }, [
    mh,
    mv,
    layoutShellKey,
    gradeOn,
    gradeGridTopPx,
    gradeTopWithGapPx,
    slideH,
    twitterStackedPost,
    slide.twitterConteudoAnchorV,
    slide.twitterConteudoAnchorH,
  ]);

  const columnCrossAlign =
    align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';

  /** Sem glass: coluna ocupa 100% da shell para textAlign + margens encostarem às laterais. Com glass: encolhe ao conteúdo e alinha no eixo cruzado. */
  const innerColumnStyle = useMemo(() => {
    const comGlass = Boolean(slide.glass);
    const base = {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      maxWidth: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
      textAlign: align,
      ...(comGlass
        ? { width: 'fit-content', alignItems: columnCrossAlign }
        : { width: '100%', alignItems: 'stretch' }),
    };
    if (slide.glass && glassAlvo === 'ambos' && glassPanelStyle) {
      return { ...base, ...glassPanelStyle };
    }
    return base;
  }, [align, columnCrossAlign, slide.glass, glassAlvo, glassPanelStyle]);

  const tituloSize = (Number(slide.tituloTamanho) || 48) * ((Number(slide.tituloEscala) || 70) / 100);
  const subtSize = Number(slide.subtituloTamanho) || 22;
  /** No post X empilhado (perfil + texto + miniatura), a linha extra usa o mesmo corpo visual que o título. */
  const subtituloFontSize = twitterStackedPost ? tituloSize : subtSize;
  const subtituloLineHeightTwitter = (Number(slide.linhaEntreLinhas) || 22) / 10;

  const panSlices = Math.max(1, Math.floor(Number(slide.imagemPanoramaSlices) || 1));
  const panIndex = Math.min(
    panSlices - 1,
    Math.max(0, Math.floor(Number(slide.imagemPanoramaIndex) || 0))
  );

  const originSlide = useMemo(() => {
    if (panSlices <= 1) return slide;
    const oid = slide.imagemPanoramaOriginSlideId;
    if (oid && Array.isArray(allSlides) && allSlides.length) {
      const o = allSlides.find((s) => s.id === oid);
      if (o) return o;
    }
    return slide;
  }, [slide, panSlices, allSlides, slide.imagemPanoramaOriginSlideId]);

  const zoomPct = Number(originSlide.imagemZoom) > 0 ? Number(originSlide.imagemZoom) : 175;
  const posY = originSlide.imagemPosY ?? 50;
  const posX = originSlide.imagemPosX ?? 50;

  const vinhetaRaw = Number(originSlide.imagemPanoramaVinheta);
  const vinhetaPct = Number.isFinite(vinhetaRaw) ? Math.min(100, Math.max(0, vinhetaRaw)) : 100;
  const vinhetaF = vinhetaPct / 100;
  const edgeFadeLayers = [];
  if (panSlices > 1 && vinhetaF > 0) {
    const hStop = 12 * vinhetaF;
    const vStop = 9 * vinhetaF;
    if (panIndex === 0) {
      edgeFadeLayers.push(`linear-gradient(90deg, ${slide.corFundo} 0%, transparent ${hStop}%)`);
    }
    if (panIndex === panSlices - 1) {
      edgeFadeLayers.push(`linear-gradient(to left, ${slide.corFundo} 0%, transparent ${hStop}%)`);
    }
    const vMid = 100 - vStop;
    edgeFadeLayers.push(
      `linear-gradient(180deg, ${slide.corFundo} 0%, transparent ${vStop}%, transparent ${vMid}%, ${slide.corFundo} 100%)`
    );
  }

  const hitFundoSlide = onActivateConfig ? () => onActivateConfig('fundoSlide') : undefined;
  const hitFundoImg = onActivateConfig ? () => onActivateConfig('fundoImg') : undefined;
  const hitGradeImg = onActivateConfig ? () => onActivateConfig('gradeImg') : undefined;
  const gradeGapPx = 14;
  const gradeRaio = slideGrade.imagemGradeRaio;
  const gradeLayout = slideGrade.imagemGradeLayout;
  const gradeSlots = slideGrade.imagemGradeSlots;
  const gradeAspect = slideGrade.imagemGradeAspecto || '16:9';
  const useGradeAspectBox =
    gradeLayout === '1' || gradeLayout === '2h' || gradeLayout === '2v' || gradeLayout === '4q';
  const gradeHint = gradeEmptyHint(gradeAspect);

  const renderGradeSlot = (slot) => {
    const inner = (
      <CarrosselGradeSlotCell
        slot={slot}
        radiusPx={gradeRaio}
        lightBg={lightBg}
        emptyHint={gradeHint}
      />
    );
    if (!useGradeAspectBox) return inner;
    return <GradeSlotAspectBox aspect={gradeAspect}>{inner}</GradeSlotAspectBox>;
  };

  const tituloHeading = (
    <h1
      style={{
        margin: 0,
        fontSize: tituloSize,
        fontWeight: twitterStackedPost ? 400 : slide.tituloPeso,
        letterSpacing: twitterStackedPost ? 0.01 : slide.tituloEspacamento,
        color: slide.corTitulo,
        lineHeight: twitterStackedPost ? (Number(slide.linhaEntreLinhas) || 22) / 10 : 1.05,
        whiteSpace: twitterStackedPost ? 'pre-wrap' : undefined,
        wordBreak: twitterStackedPost ? 'break-word' : undefined,
        overflow: twitterStackedPost ? 'visible' : undefined,
        paddingBottom: twitterStackedPost ? '0.12em' : undefined,
      }}
    >
      {titleToSpans(
        slide.titulo,
        slide.palavrasDestacadas || [],
        slide.corDestaque,
        slide.formatacaoPalavras || {},
        onActivateConfig ? () => onActivateConfig('destaque') : undefined
      )}
    </h1>
  );
  const subtituloBlock = (
    <p
      style={{
        margin: 0,
        fontSize: subtituloFontSize,
        fontFamily: `"${slide.subtituloFonte}", sans-serif`,
        fontWeight: slide.subtituloPeso,
        fontStyle: slide.subtituloItalic ? 'italic' : undefined,
        letterSpacing: slide.subtituloEspacamento,
        lineHeight: twitterStackedPost ? subtituloLineHeightTwitter : (Number(slide.linhaEntreLinhas) || 18) / 10,
        color: slide.corSubtitulo,
        whiteSpace: twitterStackedPost ? 'pre-wrap' : undefined,
        wordBreak: twitterStackedPost ? 'break-word' : undefined,
      }}
    >
      {slide.subtitulo}
    </p>
  );
  const wrapTituloComGlass = slide.glass && glassAlvo === 'titulo' && glassPanelStyle;
  const wrapSubComGlass = slide.glass && glassAlvo === 'subtitulo' && glassPanelStyle;
  const ctaScale = Math.max(0.7, Math.min(1.8, (Number(slide.ctaTamanho) || 100) / 100));
  const ctaPosX = Math.min(100, Math.max(0, Number(slide.ctaPosX) || 50));
  const ctaPosY = Math.min(100, Math.max(0, Number(slide.ctaPosY) || 92));
  const ctaAnchor = slide.ctaAlinhamento === 'esq' ? 'translate(0%, -50%)' : slide.ctaAlinhamento === 'dir' ? 'translate(-100%, -50%)' : 'translate(-50%, -50%)';
  const ctaStyleKind = slide.ctaEstilo === 'outline' || slide.ctaEstilo === 'glass' ? slide.ctaEstilo : 'solid';
  const ctaTextPrimary = String(slide.ctaTextoPrimario || '').trim() || 'Saiba mais';
  const ctaTextSecondary = String(slide.ctaTextoSecundario || '').trim() || 'Ver detalhes';
  const ctaShowSecondary = Boolean(slide.ctaMostrarSecundario) && ctaTextSecondary.length > 0;

  return (
    <div
      ref={ref}
      data-carrossel-slide-root
      style={{
        width: `${slideW}px`,
        height: `${slideH}px`,
        minWidth: `${slideW}px`,
        minHeight: `${slideH}px`,
        maxWidth: `${slideW}px`,
        maxHeight: `${slideH}px`,
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: slide.corFundo,
        fontFamily: `"${slide.tituloFonte}", sans-serif`,
      }}
    >
      {onActivateConfig ? (
        <div
          role="presentation"
          className="absolute inset-0 z-0 cursor-pointer"
          onClick={hitFundoSlide}
        />
      ) : null}
      {slide.imagemFundo && !gradeOn ? (
        <div
          className={cn('absolute inset-0 z-[1] overflow-hidden', onActivateConfig && 'cursor-pointer')}
          onClick={hitFundoImg}
        >
          {panSlices > 1 ? (
            <div
              style={{
                width: `${panSlices * slideW}px`,
                height: `${slideH}px`,
                marginLeft: `${-panIndex * slideW}px`,
                backgroundImage: `url(${slide.imagemFundo})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${zoomPct}%`,
                backgroundPosition: `${posX}% ${posY}%`,
              }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url(${slide.imagemFundo})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${zoomPct}%`,
                backgroundPosition: `${posX}% ${posY}%`,
              }}
            />
          )}
          {edgeFadeLayers.length > 0 ? (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: edgeFadeLayers.join(', '),
              }}
            />
          ) : null}
        </div>
      ) : null}

      {gradeOn ? (
        <div
          role="presentation"
          className={cn(
            'absolute overflow-hidden',
            twitterStackedPost ? 'z-0' : 'z-[1]',
            onActivateConfig && 'cursor-pointer'
          )}
          style={{
            left: twitterStackedPost ? gradeHorizontalInset.left : mh,
            right: twitterStackedPost ? gradeHorizontalInset.right : mh,
            top: twitterStackedPost ? gradeTopWithGapPx : gradeGridTopPx,
            bottom: mv,
            boxSizing: 'border-box',
          }}
          onClick={hitGradeImg}
        >
          {gradeLayout === '1' ? (
            <div style={{ width: '100%', height: '100%' }}>{renderGradeSlot(gradeSlots[0])}</div>
          ) : null}
          {gradeLayout === '2h' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: gradeGapPx,
                width: '100%',
                height: '100%',
              }}
            >
              <div style={{ minHeight: 0, minWidth: 0 }}>{renderGradeSlot(gradeSlots[0])}</div>
              <div style={{ minHeight: 0, minWidth: 0 }}>{renderGradeSlot(gradeSlots[1])}</div>
            </div>
          ) : null}
          {gradeLayout === '2v' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateRows: '1fr 1fr',
                gap: gradeGapPx,
                width: '100%',
                height: '100%',
              }}
            >
              <div style={{ minHeight: 0, minWidth: 0 }}>{renderGradeSlot(gradeSlots[0])}</div>
              <div style={{ minHeight: 0, minWidth: 0 }}>{renderGradeSlot(gradeSlots[1])}</div>
            </div>
          ) : null}
          {gradeLayout === '3' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: '1fr 1fr',
                gap: gradeGapPx,
                width: '100%',
                height: '100%',
              }}
            >
              <div style={{ gridColumn: 1, gridRow: '1 / span 2', minHeight: 0, minWidth: 0 }}>
                <CarrosselGradeSlotCell
                  slot={gradeSlots[0]}
                  radiusPx={gradeRaio}
                  lightBg={lightBg}
                  emptyHint=""
                />
              </div>
              <div style={{ gridColumn: 2, gridRow: 1, minHeight: 0, minWidth: 0 }}>
                <CarrosselGradeSlotCell
                  slot={gradeSlots[1]}
                  radiusPx={gradeRaio}
                  lightBg={lightBg}
                  emptyHint=""
                />
              </div>
              <div style={{ gridColumn: 2, gridRow: 2, minHeight: 0, minWidth: 0 }}>
                <CarrosselGradeSlotCell
                  slot={gradeSlots[2]}
                  radiusPx={gradeRaio}
                  lightBg={lightBg}
                  emptyHint=""
                />
              </div>
            </div>
          ) : null}
          {gradeLayout === '4q' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: '1fr 1fr',
                gap: gradeGapPx,
                width: '100%',
                height: '100%',
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ minHeight: 0, minWidth: 0 }}>
                  {renderGradeSlot(gradeSlots[i])}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {renderOverlay(slide, onActivateConfig)}
      {renderPadrao(slide, padraoPatternId)}

      <div
        style={marginShellStyle}
        className={onActivateConfig ? 'cursor-pointer' : undefined}
        onClick={onActivateConfig ? () => onActivateConfig('titulo') : undefined}
      >
        {twitterStackedPost ? (
          <div
            style={{
              flex: '0 1 auto',
              minHeight: 0,
              maxHeight: '100%',
              width: '100%',
              maxWidth: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: 14,
              textAlign: 'left',
              boxSizing: 'border-box',
              overflowX: 'hidden',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: 4,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <TwitterMinimalBadgeProfile slide={slide} lightBg={lightBg} onActivateConfig={onActivateConfig} />
            {wrapTituloComGlass ? <div style={glassPanelStyle}>{tituloHeading}</div> : tituloHeading}
            {String(slide.subtitulo || '').trim() ? (
              wrapSubComGlass ? (
                <div style={glassPanelStyle}>{subtituloBlock}</div>
              ) : (
                subtituloBlock
              )
            ) : null}
          </div>
        ) : (
          <div style={innerColumnStyle}>
            {wrapTituloComGlass ? <div style={glassPanelStyle}>{tituloHeading}</div> : tituloHeading}
            {wrapSubComGlass ? <div style={glassPanelStyle}>{subtituloBlock}</div> : subtituloBlock}
          </div>
        )}
      </div>

      {slide.cantoSupEsqAtivo && slide.cantoSupEsq ? (
        <div
          className={onActivateConfig ? 'cursor-pointer' : undefined}
          style={{
            position: 'absolute',
            top: slide.cantoDist,
            left: slide.cantoDist,
            fontSize: slide.cantoFonte,
            color: cantoTextColor,
            zIndex: 5,
            backdropFilter: slide.cantoGlass ? 'blur(8px)' : undefined,
            padding: slide.cantoGlass ? '4px 8px' : undefined,
            borderRadius: slide.cantoBordaMinimalista ? 4 : undefined,
            border: slide.cantoBordaMinimalista ? cantoMinimalBorder : undefined,
          }}
          onClick={onActivateConfig ? () => onActivateConfig('cantos') : undefined}
        >
          {slide.cantoSupEsq}
        </div>
      ) : null}
      {slide.cantoSupDirAtivo && slide.cantoSupDir ? (
        <div
          className={onActivateConfig ? 'cursor-pointer' : undefined}
          style={{
            position: 'absolute',
            top: slide.cantoDist,
            right: slide.cantoDist,
            fontSize: slide.cantoFonte,
            color: cantoTextColor,
            zIndex: 5,
            textAlign: 'right',
          }}
          onClick={onActivateConfig ? () => onActivateConfig('cantos') : undefined}
        >
          {slide.cantoSupDir}
        </div>
      ) : null}
      {slide.cantoInfEsqAtivo && slide.cantoInfEsq ? (
        <div
          className={onActivateConfig ? 'cursor-pointer' : undefined}
          style={{
            position: 'absolute',
            bottom: slide.cantoDist,
            left: slide.cantoDist,
            fontSize: slide.cantoFonte,
            color: cantoTextColor,
            zIndex: 5,
          }}
          onClick={onActivateConfig ? () => onActivateConfig('cantos') : undefined}
        >
          {slide.cantoInfEsq}
        </div>
      ) : null}
      {slide.cantoInfDirAtivo ? (
        <div
          className={onActivateConfig ? 'cursor-pointer' : undefined}
          style={{
            position: 'absolute',
            bottom: slide.cantoDist,
            right: slide.cantoDist,
            fontSize: slide.cantoFonte,
            color: cantoTextColor,
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
          onClick={onActivateConfig ? () => onActivateConfig('cantos') : undefined}
        >
          {slide.cantoInfDir}
          {slide.cantoIcone !== 'none' && IconCanto ? (
            <IconCanto
              className="shrink-0 opacity-90"
              style={{ width: slide.cantoFonte + 4, height: slide.cantoFonte + 4, color: cantoTextColor }}
            />
          ) : null}
        </div>
      ) : null}

      {slide.mostrarBolinhas && totalSlides > 1 ? (
        <div
          className={onActivateConfig ? 'cursor-pointer' : undefined}
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 8,
            zIndex: 6,
          }}
          onClick={onActivateConfig ? () => onActivateConfig('cantos') : undefined}
        >
          {Array.from({ length: totalSlides }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: i === activeIndex ? (lightBg ? '#111' : '#fff') : lightBg ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.35)',
              }}
            />
          ))}
        </div>
      ) : null}

      {slide.mostrarBotoes ? (
        <div
          className={onActivateConfig ? 'cursor-pointer' : undefined}
          style={{
            position: 'absolute',
            left: `${ctaPosX}%`,
            top: `${ctaPosY}%`,
            transform: ctaAnchor,
            display: 'flex',
            gap: `${10 * ctaScale}px`,
            zIndex: 6,
            maxWidth: `${Math.max(280, slideW - Math.max(40, Number(slide.margemHorizontal) || 40) * 2)}px`,
            flexWrap: 'wrap',
          }}
          onClick={onActivateConfig ? () => onActivateConfig('botoes') : undefined}
        >
          <button
            type="button"
            style={{
              borderRadius: `${12 * ctaScale}px`,
              border:
                ctaStyleKind === 'solid'
                  ? 'none'
                  : lightBg
                    ? '1px solid rgba(0,0,0,0.22)'
                    : '1px solid rgba(255,255,255,0.36)',
              background:
                ctaStyleKind === 'solid'
                  ? 'rgba(255,255,255,0.95)'
                  : ctaStyleKind === 'glass'
                    ? lightBg
                      ? 'rgba(0,0,0,0.06)'
                      : 'rgba(255,255,255,0.12)'
                    : 'transparent',
              color: ctaStyleKind === 'solid' ? '#111' : lightBg ? '#111' : '#fff',
              backdropFilter: ctaStyleKind === 'glass' ? 'blur(8px)' : undefined,
              padding: `${10 * ctaScale}px ${18 * ctaScale}px`,
              fontSize: `${17 * ctaScale}px`,
              fontWeight: 700,
              lineHeight: 1,
              boxShadow: ctaStyleKind === 'solid' ? '0 6px 18px rgba(0,0,0,0.22)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {ctaTextPrimary}
          </button>
          {ctaShowSecondary ? (
            <button
              type="button"
              style={{
                borderRadius: `${12 * ctaScale}px`,
                border: lightBg ? '1px solid rgba(0,0,0,0.22)' : '1px solid rgba(255,255,255,0.36)',
                background: ctaStyleKind === 'glass' ? (lightBg ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)') : 'transparent',
                color: lightBg ? '#111' : '#fff',
                backdropFilter: ctaStyleKind === 'glass' ? 'blur(8px)' : undefined,
                padding: `${10 * ctaScale}px ${16 * ctaScale}px`,
                fontSize: `${16 * ctaScale}px`,
                fontWeight: 600,
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              {ctaTextSecondary}
            </button>
          ) : null}
        </div>
      ) : null}

      {slide.mostrarLogo && slide.logoPng ? (
        <img
          src={slide.logoPng}
          alt=""
          className={onActivateConfig ? 'cursor-pointer' : undefined}
          style={{
            position: 'absolute',
            left: `${Math.min(100, Math.max(0, Number(slide.logoPosX) || 90))}%`,
            top: `${Math.min(100, Math.max(0, Number(slide.logoPosY) || 10))}%`,
            transform: 'translate(-50%, -50%)',
            width: `${160 * ((Number(slide.logoTamanhoGlobal) || 100) / 100) * ((Number(slide.logoTamanhoSlide) || 100) / 100)}px`,
            height: `${160 * ((Number(slide.logoTamanhoGlobal) || 100) / 100) * ((Number(slide.logoTamanhoSlide) || 100) / 100)}px`,
            objectFit: 'contain',
            borderRadius: `${Math.max(0, Number(slide.logoArredondamento) || 0)}px`,
            zIndex: 7,
          }}
          onClick={onActivateConfig ? () => onActivateConfig('badge') : undefined}
        />
      ) : null}
      {slide.mostrarBadge && !twitterStackedPost ? (
        <div
          className={onActivateConfig ? 'cursor-pointer' : undefined}
          style={{
            position: 'absolute',
            left: `${Math.min(100, Math.max(0, Number(slide.badgePosX) || 28))}%`,
            top: `${Math.min(100, Math.max(0, Number(slide.badgePosY) || 16))}%`,
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            gap: `${12 * ((Number(slide.badgeTamanhoGlobal) || 100) / 100) * ((Number(slide.badgeTamanhoSlide) || 100) / 100)}px`,
            padding:
              slide.badgeEstilo === 'minimal'
                ? '0px'
                : `${8 * ((Number(slide.badgeTamanhoGlobal) || 100) / 100)}px ${12 * ((Number(slide.badgeTamanhoGlobal) || 100) / 100)}px`,
            borderRadius: 999,
            background:
              slide.badgeEstilo === 'solid'
                ? lightBg
                  ? 'rgba(0,0,0,0.06)'
                  : 'rgba(255,255,255,0.14)'
                : slide.badgeEstilo === 'glass'
                  ? lightBg
                    ? 'rgba(0,0,0,0.05)'
                    : 'rgba(255,255,255,0.10)'
                  : 'transparent',
            backdropFilter: slide.badgeEstilo === 'glass' ? 'blur(9px)' : undefined,
            border:
              slide.badgeEstilo === 'minimal'
                ? 'none'
                : lightBg
                  ? '1px solid rgba(0,0,0,0.12)'
                  : '1px solid rgba(255,255,255,0.15)',
            color: lightBg ? '#111' : '#fff',
            zIndex: 7,
          }}
          onClick={onActivateConfig ? () => onActivateConfig('badge') : undefined}
        >
          <div
            style={{
              width: `${42 * ((Number(slide.badgeTamanhoGlobal) || 100) / 100) * ((Number(slide.badgeTamanhoSlide) || 100) / 100)}px`,
              height: `${42 * ((Number(slide.badgeTamanhoGlobal) || 100) / 100) * ((Number(slide.badgeTamanhoSlide) || 100) / 100)}px`,
              borderRadius: `${Math.max(0, Math.min(100, Number(slide.badgeFotoRound) || 100))}%`,
              overflow: 'hidden',
              background: lightBg ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: `${14 * ((Number(slide.badgeTamanhoGlobal) || 100) / 100)}px`,
              opacity: 0.92,
            }}
          >
            {slide.badgeFotoUrl ? (
              <img
                src={slide.badgeFotoUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              '?'
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
                fontSize: `${26 * ((Number(slide.badgeTamanhoGlobal) || 100) / 100) * ((Number(slide.badgeTamanhoSlide) || 100) / 100)}px`,
                lineHeight: 1.05,
              }}
            >
              <span>{slide.badgeTitulo || 'Título verificado'}</span>
              {slide.badgeVerificado ? (
                <span
                  style={{
                    display: 'inline-flex',
                    width: `${16 * ((Number(slide.badgeTamanhoGlobal) || 100) / 100)}px`,
                    height: `${16 * ((Number(slide.badgeTamanhoGlobal) || 100) / 100)}px`,
                    borderRadius: '999px',
                    background: '#1d9bf0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: `${11 * ((Number(slide.badgeTamanhoGlobal) || 100) / 100)}px`,
                    fontWeight: 800,
                  }}
                >
                  ✓
                </span>
              ) : null}
            </div>
            <div
              style={{
                fontSize: `${17 * ((Number(slide.badgeTamanhoGlobal) || 100) / 100) * ((Number(slide.badgeTamanhoSlide) || 100) / 100)}px`,
                color: lightBg ? 'rgba(0,0,0,0.58)' : 'rgba(255,255,255,0.66)',
                marginTop: 2,
              }}
            >
              {slide.badgeHandle || '@handle'}
            </div>
            {slide.badgeDescricao ? (
              <div
                style={{
                  marginTop: 3,
                  maxWidth: `${520 * ((Number(slide.badgeTamanhoGlobal) || 100) / 100)}px`,
                  fontSize: `${16 * ((Number(slide.badgeTamanhoGlobal) || 100) / 100) * ((Number(slide.badgeTamanhoSlide) || 100) / 100)}px`,
                  color: lightBg ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.82)',
                  lineHeight: 1.2,
                }}
              >
                {slide.badgeDescricao}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
});

export default CarrosselSlideCanvas;
