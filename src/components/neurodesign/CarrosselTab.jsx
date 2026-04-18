import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import html2canvas from 'html2canvas';
import {
  AlertTriangle,
  BadgeCheck,
  Bot,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Highlighter,
  ImageIcon,
  ImagePlus,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  FolderOpen,
  MousePointerClick,
  Palette,
  PenLine,
  Plus,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
  Type,
  User,
  Upload,
  Undo2,
  Redo2,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ToastAction } from '@/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import {
  defaultSlide,
  CARROSSEL_IDENTIDADE_ABERTURA,
  CARROSSEL_TITULO_FONTES,
  LAYOUT_POS_MAP,
  CARROSSEL_CANVAS_FORMAT,
  resolveCarrosselCanvasFormat,
  normalizeCarrosselImagemGrade,
  createEmptyImagemGradeSlots,
  getCarrosselGradeSlotCount,
  getCarrosselGradeAspectoOptionsForLayout,
  applyCarrosselTwitterIaTextLimits,
  CARROSSEL_TWITTER_IA_MAX_TITULO_CHARS,
  CARROSSEL_TWITTER_IA_MAX_SUBTITULO_CHARS,
  CARROSSEL_TWITTER_IA_DEFAULT_TITULO_TAMANHO,
} from '@/lib/neurodesign/carrosselSlideModel';
import { NEURODESIGN_GOOGLE_FONTS } from '@/lib/neurodesign/googleFontsList';
import {
  carrosselLlmCompleteText,
  carrosselLlmCompleteTextWithImage,
  carrosselBuildImagePromptWithLlm,
  carrosselBuildPanoramaImagePromptWithLlm,
  carrosselBuildSingleSlideImagePromptWithLlm,
  carrosselGenerateBackgroundImage,
  isCarrosselPanoramaCapableImageConnection,
  isCarrosselSubjectFaceMultimodalOk,
  normalizeCarrosselGeminiImageSize,
  carrosselLlmGenerateSlidesJson,
  carrosselLlmGenerateSlidesJsonTwitter,
  carrosselLlmImproveSlidesJson,
  carrosselLlmImproveSlidesJsonTwitter,
  carrosselLlmRefineOneSlide,
} from '@/lib/neurodesign/carrosselLlmClient';
import CarrosselSlideCanvas from '@/components/neurodesign/carrossel/CarrosselSlideCanvas';
import {
  fetchClientContexts,
  fetchClientProfilesForChat,
  fetchClientsWithContextCounts,
  formatClientProfileForPrompt,
} from '@/lib/aiChatContexts';
import {
  MAX_CARROSSEL_GALLERY_SAVES,
  NEURODESIGN_CARROSSEL_OPEN_SESSION_KEY,
  notifyCarrosselGalleryUpdated,
} from '@/lib/neurodesign/carrosselGalleryStorage';
import {
  countCarrosselGallerySaves,
  fetchCarrosselGallerySaves,
  insertCarrosselGallerySave,
  updateCarrosselGallerySave,
} from '@/lib/neurodesign/carrosselGalleryRemote';
import {
  MAX_CARROSSEL_STYLE_TEMPLATES,
  buildCarrosselStyleTemplateSnapshot,
  readCarrosselStyleTemplates,
  writeCarrosselStyleTemplates,
} from '@/lib/neurodesign/carrosselTemplateStorage';
import { neurodesignGalleryCarrosseisUrl } from '@/lib/neurodesign/neurodesignRoutes';

const FONTS_LINK_ID = 'neurodesign-carrossel-fonts';
/** Chaves antigas (sem userId) — migradas uma vez para a conta ao abrir o editor. */
const LEGACY_CARROSSEL_DRAFT_KEY = 'neurodesign-carrossel-draft-v1';
const LEGACY_CARROSSEL_IA_MODE_KEY = 'neurodesign-carrossel-ia-mode';
const LEGACY_CARROSSEL_CLIENT_ID_KEY = 'neurodesign-carrossel-client-id';

function carrosselStorageKeys(userId) {
  const id = String(userId);
  return {
    draft: `${LEGACY_CARROSSEL_DRAFT_KEY}:${id}`,
    iaMode: `${LEGACY_CARROSSEL_IA_MODE_KEY}:${id}`,
    clientId: `${LEGACY_CARROSSEL_CLIENT_ID_KEY}:${id}`,
    geminiQuality: `neurodesign-carrossel-gemini-quality:${id}`,
    genTemplateId: `neurodesign-carrossel-gen-template-id:${id}`,
  };
}

/** Valor do select: só ficha, sem blocos de client_contexts */
const CAROUSEL_CONTEXT_FICHA_ONLY = 'ficha_only';

/** Estado inicial da secção «Gerar com IA» por modo (Minimalista / Twitter). */
function defaultTemplateIaBundle() {
  return {
    iaPrompt: '',
    carouselIaMode: 'free_text',
    carouselClientId: '',
    carouselSelectedContextId: CAROUSEL_CONTEXT_FICHA_ONLY,
    refImages: [],
    slideCount: 5,
    gerarImagensIa: false,
    imgGenPanoramaContinuidade: false,
    improvePrompt: '',
    refineIaPrompt: '',
    imageGenTemplateId: '',
    openIa: false,
    openIdentidade: false,
  };
}

const MAX_SUBJECT_FACE_FILE_BYTES = 4 * 1024 * 1024;

/** Histórico desfazer/refazer: slides + identidade + formato + slide ativo. */
const MAX_CARROSSEL_UNDO = 45;
const CARROSSEL_UNDO_DEBOUNCE_MS = 420;
const CARROSSEL_AUTOSAVE_INTERVAL_MS = 3 * 60 * 1000;

function snapshotCarrosselUndoState({ slides, activeSlideIndex, identidade, carrosselFormatId, template, darkMode }) {
  return {
    slides: JSON.parse(JSON.stringify(slides)),
    activeSlideIndex,
    identidade: { ...identidade },
    carrosselFormatId,
    template,
    darkMode,
  };
}

const LAYOUT_KEYS = Object.keys(LAYOUT_POS_MAP);

/** Rótulos longos para `title` / leitores de ecrã no seletor visual de layout. */
const LAYOUT_GRID_LABELS = {
  'sup-esq': 'Superior esquerdo',
  'sup-centro': 'Superior centro',
  'sup-dir': 'Superior direita',
  'meio-esq': 'Meio esquerda',
  meio: 'Ao centro',
  'meio-dir': 'Meio direita',
  'inf-esq': 'Inferior esquerdo',
  'inf-centro': 'Inferior centro',
  'inf-dir': 'Inferior direita',
};

/** Classes Tailwind do “bloco de texto” dentro da miniatura 4:5 de cada célula. */
const LAYOUT_GRID_PREVIEW_BLOCK = {
  'sup-esq': 'left-[8%] top-[8%] h-[28%] w-[46%]',
  'sup-centro': 'left-1/2 top-[8%] h-[28%] w-[46%] -translate-x-1/2',
  'sup-dir': 'right-[8%] top-[8%] h-[28%] w-[46%]',
  'meio-esq': 'left-[8%] top-1/2 h-[28%] w-[46%] -translate-y-1/2',
  meio: 'left-1/2 top-1/2 h-[28%] w-[46%] -translate-x-1/2 -translate-y-1/2',
  'meio-dir': 'right-[8%] top-1/2 h-[28%] w-[46%] -translate-y-1/2',
  'inf-esq': 'bottom-[10%] left-[8%] h-[28%] w-[46%]',
  'inf-centro': 'bottom-[10%] left-1/2 h-[28%] w-[46%] -translate-x-1/2',
  'inf-dir': 'bottom-[10%] right-[8%] h-[28%] w-[46%]',
};

/** Alinhar com `defaultSlide`: fundo gerado usa estes valores (evita zoom 100% ou padrão “grade”). */
const BG_IMAGE_APPLY_DEFAULTS = {
  imagemZoom: 175,
  imagemPosX: 50,
  imagemPosY: 50,
  padrao: 'nenhum',
  imagemPanoramaSlices: 1,
  imagemPanoramaIndex: 0,
  imagemPanoramaOriginSlideId: null,
  imagemPanoramaGroupId: null,
};

/** Quantidade de propostas de design geradas em paralelo conforme “temperatura criativa”. */
const AGENTE_TEMPERATURA_NUM_CANDIDATOS = { conservador: 3, equilibrado: 4, ousado: 5 };
/** Diferença máxima de score entre 1º e 2º para considerar empate e pedir escolha. */
const AGENTE_AMBIGUIDADE_DELTA = 8;

/** Perfis de direção de arte (sementes) — textos guiam o LLM; `toolBias` enriquece ferramentas do editor. */
const AGENTE_PERFIS_CRIATIVOS = [
  {
    id: 'editorial',
    label: 'Editorial',
    blocoPrompt: `PERFIL EDITORIAL: hierarquia tipográfica forte, alinhamentos alternados, cantos com borda minimalista elegante, pouco padrão decorativo. Use glass só em 1 slide intermediário. Narrativa sofisticada.`,
    toolBias: { badgeSlideIndex: 1, cantoGlass: true, cantoBordaMinimalista: true },
  },
  {
    id: 'agressivo',
    label: 'Agressivo',
    blocoPrompt: `PERFIL AGRESSIVO: contraste máximo, overlays pesados onde fizer sentido, títulos com escala alta, padrões “grade” ou “bolinhas” em slides centrais. Sensação de urgência e prova social.`,
    toolBias: { ctaEstilo: 'solid', badgeOnHook: true },
  },
  {
    id: 'clean_premium',
    label: 'Clean premium',
    blocoPrompt: `PERFIL CLEAN PREMIUM: muito espaço negativo, overlays suaves, padrão quase sempre “nenhum”, glass discreto. Tipografia impecável e palavras destacadas pontuais.`,
    toolBias: { minimalPadrao: true },
  },
  {
    id: 'experimental',
    label: 'Experimental',
    blocoPrompt: `PERFIL EXPERIMENTAL: alterne layouts de forma ousada (sem repetir consecutivo), combine padrões diferentes por slide, teste vinheta e lateral. Cada slide deve parecer uma “capa” diferente.`,
    toolBias: { variedLayout: true },
  },
  {
    id: 'neural',
    label: 'Neural',
    blocoPrompt: `PERFIL NEURAL: composição assimétrica, glass + padrão em momentos-chave, cantos com ícone marcante, badge no gancho se couber no nicho. Sensação tech / futurista sem perder legibilidade.`,
    toolBias: { badgeOnHook: true, glassMid: true },
  },
];

function agenteHexToRgb(hex) {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return { r: 10, g: 10, b: 10 };
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function agenteRelativeLuminance(rgb) {
  const lin = (v) => {
    const c = (Number(v) || 0) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = lin(rgb.r);
  const G = lin(rgb.g);
  const B = lin(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function agenteContrastRatio(hexA, hexB) {
  const L1 = agenteRelativeLuminance(agenteHexToRgb(hexA));
  const L2 = agenteRelativeLuminance(agenteHexToRgb(hexB));
  const light = Math.max(L1, L2);
  const dark = Math.min(L1, L2);
  return (light + 0.05) / (dark + 0.05);
}

/** Pontua heurística de um JSON de design (sem renderizar canvas). */
function agenteScoreCandidato({ design, agenteSlidesGerados, agentePaleta }) {
  const slides = Array.isArray(design?.slides) ? design.slides : [];
  const n = agenteSlidesGerados?.length || 0;
  const bg = agentePaleta?.corFundo || '#0a0a0a';
  const tit = agentePaleta?.corTitulo || '#ffffff';
  const breakdown = {
    contraste: 0,
    layoutVariacao: 0,
    hook: 0,
    cta: 0,
    legibilidade: 0,
    narrativa: 0,
    ferramentas: 0,
  };

  try {
    const cr = agenteContrastRatio(tit, bg);
    breakdown.contraste = Math.min(22, Math.max(0, (cr - 3) * 4));
  } catch {
    breakdown.contraste = 6;
  }

  const layouts = slides.map((s) => s.layoutPosicao).filter(Boolean);
  const uniqLayouts = new Set(layouts).size;
  breakdown.layoutVariacao = Math.min(20, uniqLayouts * 3 + (uniqLayouts >= Math.min(4, n) ? 4 : 0));

  const firstTit = String(agenteSlidesGerados[0]?.titulo || '');
  const wc = firstTit.split(/\s+/).filter(Boolean).length;
  breakdown.hook = firstTit.length <= 42 && wc <= 9 ? 16 : wc <= 14 ? 10 : 5;

  const lastSd = slides[Math.max(0, n - 1)] || {};
  const hasCtaUi =
    lastSd.mostrarBotoes === true ||
    (String(lastSd.ctaTextoPrimario || '').trim().length > 2 && lastSd.mostrarBotoes !== false);
  const ctaInTitle = /\b(saiba|gratis|grátis|link|dm|whatsapp|clique|agora|bora)\b/i.test(
    String(agenteSlidesGerados[n - 1]?.titulo || '')
  );
  breakdown.cta = hasCtaUi || ctaInTitle ? 16 : 4;

  const m = Math.max(1, slides.length);
  const avgOv = slides.reduce((a, s) => a + (Number.isFinite(Number(s.overlayOpacidade)) ? Number(s.overlayOpacidade) : 78), 0) / m;
  breakdown.legibilidade = avgOv >= 52 && avgOv <= 90 ? 14 : avgOv > 92 ? 5 : 9;

  const okCount = slides.filter((s) => s.overlayEstilo && String(s.overlayEstilo).length > 2).length;
  breakdown.narrativa = slides.length >= n ? 8 + Math.min(10, okCount) : 4;

  const highlights = slides.filter((s) => Array.isArray(s.palavrasDestacadas) && s.palavrasDestacadas.length > 0).length;
  const glassOn = slides.filter((s) => s.glass === true).length;
  const padroes = slides.filter((s) => s.padrao && s.padrao !== 'nenhum').length;
  breakdown.ferramentas = Math.min(18, highlights * 2 + glassOn * 2 + padroes * 1.5);

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const rationale = `contraste ${Math.round(breakdown.contraste)}, layouts únicos ${uniqLayouts}, destaques ${highlights}, glass ${glassOn}, padrões ${padroes}`;
  return { score: Math.round(total), breakdown, rationale };
}

/** QA automático sobre o estado final dos slides (após merge de design). */
function agenteQaCarrossel({ slides, agenteSlidesGerados }) {
  const issues = [];
  const n = slides.length;
  if (n < 3) issues.push('poucos_slides');

  let streak = 1;
  let prevL = null;
  for (let i = 0; i < n; i++) {
    const L = slides[i]?.layoutPosicao;
    if (L && L === prevL) streak += 1;
    else streak = 1;
    prevL = L;
    if (streak >= 3) issues.push('layout_repeticao_consecutiva');
  }

  const last = slides[n - 1];
  const lastGen = agenteSlidesGerados[n - 1];
  const hasCta =
    last?.mostrarBotoes === true ||
    /\b(saiba|gratis|grátis|link|dm|whatsapp|clique|bora|agora)\b/i.test(String(lastGen?.titulo || last?.titulo || ''));
  if (!hasCta) issues.push('cta_final_ausente');

  try {
    const cr = agenteContrastRatio(last?.corTitulo || '#fff', last?.corFundo || '#000');
    if (cr < 2.8) issues.push('contraste_fraco_ultimo_slide');
  } catch {
    issues.push('contraste_invalido');
  }

  const truncRisk = slides.some((s, i) => {
    const t = String(agenteSlidesGerados[i]?.titulo || s.titulo || '');
    const tam = Number(s.tituloTamanho) || 90;
    return t.length > 70 && tam < 62;
  });
  if (truncRisk) issues.push('titulo_grande_texto_longo');

  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}

/** Um ciclo de correção heurística pós-QA (sem novo render de canvas). */
function agenteAplicarQaHeuristico(slides, agenteSlidesGerados) {
  const qa = agenteQaCarrossel({ slides, agenteSlidesGerados });
  if (qa.ok) return slides;
  const keys = Object.keys(LAYOUT_POS_MAP);
  let fixed = slides.map((s) => ({ ...s }));
  const n = fixed.length;

  if (qa.issues.includes('cta_final_ausente') && n > 0) {
    fixed = fixed.map((s, i) =>
      i === n - 1
        ? {
            ...s,
            mostrarBotoes: true,
            ctaTextoPrimario: s.ctaTextoPrimario && s.ctaTextoPrimario !== 'Saiba mais' ? s.ctaTextoPrimario : 'Chamar no direct',
            ctaEstilo: s.ctaEstilo || 'solid',
            ctaPosY: s.ctaPosY || 90,
          }
        : s
    );
  }

  if (qa.issues.includes('layout_repeticao_consecutiva')) {
    let prevL = null;
    let streak = 1;
    fixed = fixed.map((s, i) => {
      let L = s.layoutPosicao;
      if (L && L === prevL) streak += 1;
      else {
        streak = 1;
        prevL = L;
      }
      if (streak >= 3 && i > 0 && i < n - 1) {
        L = keys[(i + (s.titulo?.length || 0)) % keys.length];
        prevL = L;
        streak = 1;
      }
      return { ...s, layoutPosicao: L };
    });
  }

  if (qa.issues.includes('titulo_grande_texto_longo')) {
    fixed = fixed.map((s, i) => {
      const t = String(agenteSlidesGerados[i]?.titulo || s.titulo || '');
      const tam = Number(s.tituloTamanho) || 90;
      return t.length > 65 && tam < 72 ? { ...s, tituloTamanho: Math.min(120, tam + 14) } : s;
    });
  }

  if (qa.issues.includes('contraste_fraco_ultimo_slide') && n > 0) {
    const last = fixed[n - 1];
    fixed[n - 1] = {
      ...last,
      overlayOpacidade: Math.max(48, Math.min(88, Number(last.overlayOpacidade) - 6)),
    };
  }

  return fixed;
}

/** Aplica JSON de design do agente sobre slides já com copy e identidade base. */
function applyAgentDesignJsonToSlides(prevSlides, design, { novaIdentidade, agenteFontEscolhida, agentePaleta }) {
  const designSlides = Array.isArray(design?.slides) ? design.slides : [];
  const designGlobal = design?.global || {};

  return prevSlides.map((s, i) => {
    const sd = designSlides[i] || designSlides[designSlides.length - 1] || {};
    const layoutOk = sd.layoutPosicao && LAYOUT_POS_MAP[sd.layoutPosicao] ? sd.layoutPosicao : s.layoutPosicao;
    const mh = Number(sd.margemHorizontal);
    const mv = Number(sd.margemVertical);
    const tt = Number(sd.tituloTamanho);

    return {
      ...s,
      layoutPosicao: layoutOk,
      margemHorizontal: Number.isFinite(mh) ? Math.min(220, Math.max(44, Math.round(mh))) : s.margemHorizontal,
      margemVertical: Number.isFinite(mv) ? Math.min(320, Math.max(44, Math.round(mv))) : s.margemVertical,
      tituloTamanho: Number.isFinite(tt) ? Math.min(200, Math.max(30, Math.round(tt))) : s.tituloTamanho,
      corDestaque: agentePaleta?.corDestaque || s.corDestaque || '#FFD700',
      overlayEstilo: sd.overlayEstilo || 'topo-intenso',
      overlayOpacidade: Number.isFinite(Number(sd.overlayOpacidade)) ? Number(sd.overlayOpacidade) : 85,
      overlayCor: sd.overlayCor || 'auto',
      padrao: sd.padrao || 'nenhum',
      padraoOpacidade: Number.isFinite(Number(sd.padraoOpacidade)) ? Number(sd.padraoOpacidade) : 10,
      padraoTamanho: Number.isFinite(Number(sd.padraoTamanho)) ? Number(sd.padraoTamanho) : 150,
      glass: Boolean(sd.glass),
      glassCor: sd.glassCor || novaIdentidade.corFundo,
      glassOpacidade: Number.isFinite(Number(sd.glassOpacidade)) ? Number(sd.glassOpacidade) : 25,
      glassBlur: Number.isFinite(Number(sd.glassBlur)) ? Number(sd.glassBlur) : 12,
      glassBorderRadius: Number.isFinite(Number(sd.glassBorderRadius)) ? Number(sd.glassBorderRadius) : 16,
      glassAlvo: sd.glassAlvo || 'ambos',
      glassPadding: Number.isFinite(Number(sd.glassPadding)) ? Number(sd.glassPadding) : 16,
      palavrasDestacadas: Array.isArray(sd.palavrasDestacadas) ? sd.palavrasDestacadas : [],
      tituloEscala: Number.isFinite(Number(sd.tituloEscala)) ? Number(sd.tituloEscala) : 70,
      subtituloTamanho: Number.isFinite(Number(sd.subtituloTamanho)) ? Number(sd.subtituloTamanho) : 25,
      subtituloEspacamento: Number.isFinite(Number(sd.subtituloEspacamento)) ? Number(sd.subtituloEspacamento) : 0,
      linhaEntreLinhas: Number.isFinite(Number(sd.linhaEntreLinhas)) ? Number(sd.linhaEntreLinhas) : 18,
      tituloEspacamento: Number.isFinite(Number(sd.tituloEspacamento)) ? Number(sd.tituloEspacamento) : -1,
      alinhamento: ['esq', 'centro', 'dir'].includes(sd.alinhamento) ? sd.alinhamento : s.alinhamento,
      cantoInfEsq: designGlobal.cantoInfEsq || sd.cantoInfEsq || s.cantoInfEsq,
      cantoSupEsq: designGlobal.cantoSupEsq || sd.cantoSupEsq || s.cantoSupEsq,
      cantoSupDir: designGlobal.cantoSupDir || sd.cantoSupDir || s.cantoSupDir,
      cantoInfDir: designGlobal.cantoInfDir || sd.cantoInfDir || s.cantoInfDir,
      cantoIcone: designGlobal.cantoIcone || sd.cantoIcone || s.cantoIcone || 'bookmark',
      cantoOpacidade: Number.isFinite(Number(designGlobal.cantoOpacidade))
        ? Number(designGlobal.cantoOpacidade)
        : Number.isFinite(Number(sd.cantoOpacidade))
          ? Number(sd.cantoOpacidade)
          : s.cantoOpacidade,
      cantoDist: Number.isFinite(Number(designGlobal.cantoDist))
        ? Number(designGlobal.cantoDist)
        : Number.isFinite(Number(sd.cantoDist))
          ? Number(sd.cantoDist)
          : s.cantoDist,
      cantoFonte: Number.isFinite(Number(designGlobal.cantoFonte))
        ? Number(designGlobal.cantoFonte)
        : Number.isFinite(Number(sd.cantoFonte))
          ? Number(sd.cantoFonte)
          : s.cantoFonte,
      cantoGlass:
        typeof designGlobal.cantoGlass === 'boolean'
          ? designGlobal.cantoGlass
          : typeof sd.cantoGlass === 'boolean'
            ? sd.cantoGlass
            : s.cantoGlass,
      cantoBordaMinimalista:
        typeof designGlobal.cantoBordaMinimalista === 'boolean'
          ? designGlobal.cantoBordaMinimalista
          : typeof sd.cantoBordaMinimalista === 'boolean'
            ? sd.cantoBordaMinimalista
            : s.cantoBordaMinimalista,
      cantoSupEsqAtivo:
        typeof sd.cantoSupEsqAtivo === 'boolean'
          ? sd.cantoSupEsqAtivo
          : typeof designGlobal.cantoSupEsqAtivo === 'boolean'
            ? designGlobal.cantoSupEsqAtivo
            : s.cantoSupEsqAtivo,
      cantoSupDirAtivo:
        typeof sd.cantoSupDirAtivo === 'boolean'
          ? sd.cantoSupDirAtivo
          : typeof designGlobal.cantoSupDirAtivo === 'boolean'
            ? designGlobal.cantoSupDirAtivo
            : s.cantoSupDirAtivo,
      cantoInfEsqAtivo:
        typeof sd.cantoInfEsqAtivo === 'boolean'
          ? sd.cantoInfEsqAtivo
          : typeof designGlobal.cantoInfEsqAtivo === 'boolean'
            ? designGlobal.cantoInfEsqAtivo
            : s.cantoInfEsqAtivo,
      cantoInfDirAtivo:
        typeof sd.cantoInfDirAtivo === 'boolean'
          ? sd.cantoInfDirAtivo
          : typeof designGlobal.cantoInfDirAtivo === 'boolean'
            ? designGlobal.cantoInfDirAtivo
            : s.cantoInfDirAtivo,
      mostrarBolinhas:
        typeof designGlobal.mostrarBolinhas === 'boolean' ? designGlobal.mostrarBolinhas : s.mostrarBolinhas,
      mostrarGrade: typeof sd.mostrarGrade === 'boolean' ? sd.mostrarGrade : s.mostrarGrade,
      mostrarBotoes: typeof sd.mostrarBotoes === 'boolean' ? sd.mostrarBotoes : s.mostrarBotoes,
      ctaTextoPrimario: sd.ctaTextoPrimario ?? s.ctaTextoPrimario,
      ctaTextoSecundario: sd.ctaTextoSecundario ?? s.ctaTextoSecundario,
      ctaMostrarSecundario:
        typeof sd.ctaMostrarSecundario === 'boolean' ? sd.ctaMostrarSecundario : s.ctaMostrarSecundario,
      ctaEstilo: ['solid', 'outline', 'ghost', 'glass'].includes(sd.ctaEstilo) ? sd.ctaEstilo : s.ctaEstilo,
      ctaAlinhamento: ['esq', 'centro', 'dir'].includes(sd.ctaAlinhamento) ? sd.ctaAlinhamento : s.ctaAlinhamento,
      ctaTamanho: Number.isFinite(Number(sd.ctaTamanho)) ? Math.min(140, Math.max(70, Number(sd.ctaTamanho))) : s.ctaTamanho,
      ctaPosX: Number.isFinite(Number(sd.ctaPosX)) ? Math.min(95, Math.max(5, Number(sd.ctaPosX))) : s.ctaPosX,
      ctaPosY: Number.isFinite(Number(sd.ctaPosY)) ? Math.min(96, Math.max(70, Number(sd.ctaPosY))) : s.ctaPosY,
      mostrarBadge: typeof sd.mostrarBadge === 'boolean' ? sd.mostrarBadge : s.mostrarBadge,
      badgeEstilo: ['glass', 'solid', 'outline'].includes(sd.badgeEstilo) ? sd.badgeEstilo : s.badgeEstilo,
      badgeTitulo: sd.badgeTitulo || s.badgeTitulo,
      badgeHandle: sd.badgeHandle || s.badgeHandle,
      badgeDescricao: sd.badgeDescricao ?? s.badgeDescricao,
      badgeVerificado: typeof sd.badgeVerificado === 'boolean' ? sd.badgeVerificado : s.badgeVerificado,
      badgeTamanhoSlide: Number.isFinite(Number(sd.badgeTamanhoSlide))
        ? Math.min(140, Math.max(70, Number(sd.badgeTamanhoSlide)))
        : s.badgeTamanhoSlide,
      badgePosX: Number.isFinite(Number(sd.badgePosX)) ? Math.min(95, Math.max(5, Number(sd.badgePosX))) : s.badgePosX,
      badgePosY: Number.isFinite(Number(sd.badgePosY)) ? Math.min(40, Math.max(4, Number(sd.badgePosY))) : s.badgePosY,
      tituloFonte: agenteFontEscolhida?.tituloFonte || s.tituloFonte,
      subtituloFonte: agenteFontEscolhida?.subtituloFonte || s.subtituloFonte,
      tituloPeso: agenteFontEscolhida?.tituloPeso ?? s.tituloPeso,
      subtituloPeso: agenteFontEscolhida?.subtituloPeso ?? s.subtituloPeso,
      subtituloItalic: typeof sd.subtituloItalic === 'boolean' ? sd.subtituloItalic : s.subtituloItalic,
      ...(typeof sd.imagemGradeAtiva === 'boolean'
        ? (() => {
            const ng = normalizeCarrosselImagemGrade({
              ...s,
              imagemGradeAtiva: sd.imagemGradeAtiva,
              imagemGradeLayout: sd.imagemGradeLayout,
              imagemGradeAspecto: sd.imagemGradeAspecto ?? s.imagemGradeAspecto,
              imagemGradeInicioFrac:
                sd.imagemGradeInicioFrac !== undefined ? sd.imagemGradeInicioFrac : s.imagemGradeInicioFrac,
              imagemGradeSlots: sd.imagemGradeSlots ?? s.imagemGradeSlots,
              imagemGradeAdaptarTexto: sd.imagemGradeAdaptarTexto,
              imagemGradeRaio: sd.imagemGradeRaio,
            });
            return {
              imagemGradeAtiva: ng.imagemGradeAtiva,
              imagemGradeLayout: ng.imagemGradeLayout,
              imagemGradeAspecto: ng.imagemGradeAspecto,
              imagemGradeInicioFrac: ng.imagemGradeInicioFrac,
              imagemGradeSlots: ng.imagemGradeSlots,
              imagemGradeAdaptarTexto: ng.imagemGradeAdaptarTexto,
              imagemGradeRaio: ng.imagemGradeRaio,
            };
          })()
        : {}),
    };
  });
}

/** Garante uso variado de badge / CTA / cantos conforme o perfil criativo. */
function agenteEnriquecerFerramentasEditor(slides, perfilCriativo, agenteSlidesGerados) {
  const bias = perfilCriativo?.toolBias || {};
  const n = slides.length;
  return slides.map((s, i) => {
    const next = { ...s };
    const last = i === n - 1;
    const niche = String(agenteSlidesGerados[0]?.cantoSupDir || next.cantoSupDir || 'Marca').slice(0, 28);

    if (last) {
      next.mostrarBotoes = true;
      next.ctaTextoPrimario = next.ctaTextoPrimario && next.ctaTextoPrimario !== 'Saiba mais' ? next.ctaTextoPrimario : 'Quero na prática';
      next.ctaTextoSecundario = next.ctaTextoSecundario || 'Ver detalhes';
      next.ctaEstilo = bias.ctaEstilo || next.ctaEstilo || 'solid';
      next.ctaPosX = next.ctaPosX || 50;
      next.ctaPosY = next.ctaPosY || 90;
      next.ctaTamanho = Math.max(next.ctaTamanho || 100, 105);
    }

    if (bias.badgeOnHook && i === 0) {
      next.mostrarBadge = true;
      next.badgeTitulo = next.badgeTitulo && next.badgeTitulo !== 'Título verificado' ? next.badgeTitulo : 'Conteúdo validado';
      next.badgeHandle = next.badgeHandle && next.badgeHandle !== 'Nome' ? next.badgeHandle : niche;
      next.badgeEstilo = next.badgeEstilo || 'glass';
      next.badgePosX = next.badgePosX || 72;
      next.badgePosY = next.badgePosY || 12;
    }

    if (Number.isFinite(bias.badgeSlideIndex) && i === bias.badgeSlideIndex) {
      next.mostrarBadge = true;
      next.badgeTitulo = next.badgeTitulo || 'Insight';
      next.badgeHandle = next.badgeHandle || niche;
    }

    if (bias.cantoGlass) {
      next.cantoGlass = true;
    }
    if (bias.cantoBordaMinimalista) {
      next.cantoBordaMinimalista = true;
    }
    if (bias.minimalPadrao && next.padrao && next.padrao !== 'nenhum' && i % 2 === 0) {
      next.padrao = 'nenhum';
    }
    if (bias.glassMid && i === Math.floor(n / 2)) {
      next.glass = true;
      if (next.glassAlvo !== 'titulo' && next.glassAlvo !== 'subtitulo') {
        next.glassAlvo = 'ambos';
      }
    }
    if (bias.variedLayout && i > 0 && i < n - 1) {
      const keys = Object.keys(LAYOUT_POS_MAP);
      const pick = keys[(i + (perfilCriativo.id?.length || 0)) % keys.length];
      if (!last && i !== 0) next.layoutPosicao = pick;
    }

    return next;
  });
}

/** Bloco de paleta para o LLM de imagem (agente com `agentePaleta` ou primeiro slide no editor). */
function buildCarrosselPaletteBlockForImage({ agentePaleta, slide, identidade }) {
  if (agentePaleta && typeof agentePaleta === 'object') {
    const d = String(agentePaleta.descricao || '').trim();
    return `--- PALETA_APROVADA ---
HEX: fundo ${agentePaleta.corFundo || ''}, título ${agentePaleta.corTitulo || ''}, subtítulo ${agentePaleta.corSubtitulo || ''}, destaque ${agentePaleta.corDestaque || ''}
Mood: ${agentePaleta.mood || '—'}, estilo: ${agentePaleta.estilo || '—'}${d ? `\nReferência visual (texto): ${d.slice(0, 420)}` : ''}
Use estes tons como guia cromático e atmosfera na cena.`;
  }
  if (slide && typeof slide === 'object') {
    const dest = slide.corDestaque || '';
    return `--- GUIA_CROMATICO_EDITOR ---
HEX: fundo do slide ${slide.corFundo || ''}, título ${slide.corTitulo || ''}, subtítulo ${slide.corSubtitulo || ''}${dest ? `, destaque ${dest}` : ''}.`;
  }
  if (identidade && typeof identidade === 'object') {
    return `--- GUIA_CROMATICO_EDITOR ---
HEX identidade: fundo ${identidade.corFundo || ''}, título ${identidade.corTitulo || ''}, subtítulo ${identidade.corSubtitulo || ''}.`;
  }
  return '';
}

/** Presets de margem (px) dentro dos limites dos sliders do painel. */
const CARROSSEL_MARGIN_PRESETS = [
  { id: 'feed', label: 'Feed apertado', mh: 52, mv: 72 },
  { id: 'balanced', label: 'Equilibrado', mh: 96, mv: 160 },
  { id: 'breath', label: 'Respiração', mh: 130, mv: 210 },
  { id: 'max', label: 'Máx. texto', mh: 200, mv: 280 },
];

function clearPanoramaMeta(sl) {
  return {
    ...sl,
    imagemPanoramaSlices: 1,
    imagemPanoramaIndex: 0,
    imagemPanoramaOriginSlideId: null,
    imagemPanoramaGroupId: null,
  };
}

/** Presets do painel Twitter: chave → campos da grade (normalização completa no `setSlides`). */
const TW_THUMB_PRESETS = {
  off: { imagemGradeAtiva: false },
  '1w': { imagemGradeAtiva: true, imagemGradeLayout: '1', imagemGradeAspecto: '16:9' },
  '1s': { imagemGradeAtiva: true, imagemGradeLayout: '1', imagemGradeAspecto: '1:1' },
  '2v': { imagemGradeAtiva: true, imagemGradeLayout: '2v', imagemGradeAspecto: '9:16' },
  '2h': { imagemGradeAtiva: true, imagemGradeLayout: '2h', imagemGradeAspecto: '16:9' },
  '4q': { imagemGradeAtiva: true, imagemGradeLayout: '4q', imagemGradeAspecto: '1:1' },
};

/** Qual botão de preset está activo (null = layout legacy `3` ou desconhecido). */
function twitterThumbnailPresetFromSlide(slide) {
  const n = normalizeCarrosselImagemGrade(slide);
  if (!n.imagemGradeAtiva) return 'off';
  if (n.imagemGradeLayout === '3') return null;
  if (n.imagemGradeLayout === '4q') return '4q';
  if (n.imagemGradeLayout === '2v') return '2v';
  if (n.imagemGradeLayout === '2h') return '2h';
  if (n.imagemGradeLayout === '1') {
    if (n.imagemGradeAspecto === '1:1') return '1s';
    if (n.imagemGradeAspecto === '16:9') return '1w';
    return '__1_custom';
  }
  return null;
}

function twitterGradeSlotPanelTitle(layout, aspect, slotIndex) {
  const L = String(layout || '1');
  const A = String(aspect || '16:9');
  if (L === '1') {
    if (A === '1:1') return 'Imagem (quadrada)';
    if (A === '16:9') return 'Imagem (16:9)';
    if (A === '9:16') return 'Imagem (vertical)';
    if (A === '4:5') return 'Imagem (4:5)';
    return 'Imagem';
  }
  if (L === '2h') {
    if (A === '4:5') return `Imagem ${slotIndex + 1} (4:5)`;
    if (A === '1:1') return `Imagem ${slotIndex + 1} (1:1)`;
    return `Imagem ${slotIndex + 1} (16:9)`;
  }
  if (L === '2v') {
    if (A === '4:5') return `Imagem ${slotIndex + 1} (4:5)`;
    return `Imagem ${slotIndex + 1} (9:16)`;
  }
  if (L === '4q') {
    if (A === '4:5') return `Imagem ${slotIndex + 1} (4:5)`;
    return `Imagem ${slotIndex + 1} (1:1)`;
  }
  return `Imagem ${slotIndex + 1}`;
}

/** Snapshot profundo para alternar Minimalista / Twitter sem perder o trabalho de cada modo. */
function snapshotCarrosselWorkspace(slides, identidade, darkMode, ia) {
  try {
    if (!Array.isArray(slides)) return null;
    let iaCopy;
    if (ia && typeof ia === 'object') {
      iaCopy = JSON.parse(JSON.stringify(ia));
    } else {
      iaCopy = defaultTemplateIaBundle();
    }
    return {
      slides: JSON.parse(JSON.stringify(slides)),
      identidade:
        identidade && typeof identidade === 'object'
          ? { ...identidade }
          : { ...CARROSSEL_IDENTIDADE_ABERTURA },
      darkMode: Boolean(darkMode),
      ia: iaCopy,
    };
  } catch {
    return null;
  }
}

/** Primeira entrada no modo Twitter — cartão X + grade, mantendo só os ids dos slides. */
function buildTwitterSlidesFromPrev(prevSlides) {
  const total = prevSlides.length;

  return prevSlides.map((s, i) => {
    const isFirst = i === 0;
    const isLast = i === total - 1;
    /** Texto do slide vem só do modo Twitter — não reaproveitar cópia do Minimalista ao mudar de painel. */
    const base = defaultSlide(i);

    const twitterShell = {
      corFundo: '#000000',
      corTitulo: '#e7e9ea',
      corSubtitulo: '#71767b',
      tituloFonte: 'Inter',
      subtituloFonte: 'Inter',
      tituloPeso: isFirst ? 700 : 400,
      subtituloPeso: 400,
      tituloTamanho: isFirst ? 28 : 15,
      tituloEscala: isFirst ? 100 : 92,
      subtituloTamanho: 13,
      tituloEspacamento: isFirst ? -0.5 : 0,
      /** No canvas X, linhaEntreLinhas/10 = line-height (ex.: 13 → 1,3). */
      linhaEntreLinhas: isFirst ? 13 : 14,
      overlayEstilo: 'nenhum',
      overlayOpacidade: 0,
      padrao: 'nenhum',
      /** Sempre «Centro» ao criar/gerar — alinha com pré-visualização estável; o utilizador pode mudar para Topo/Base. */
      twitterConteudoAnchorV: 'centro',
      twitterConteudoAnchorH: 'esq',
      layoutPosicao: 'sup-esq',
      alinhamento: 'esq',
      margemHorizontal: 0,
      /** Respiro em relação ao topo/fundo do slide (o canvas nunca usa menos que ~44px). */
      margemVertical: 72,
      glass: false,
      mostrarBadge: true,
      badgeEstilo: 'minimal',
      badgeVerificado: true,
      badgeFotoRound: 100,
      badgeTamanhoGlobal: 100,
      badgeTamanhoSlide: 100,
      badgePosX: 50,
      badgePosY: 8,
      badgeTitulo: s.badgeTitulo || 'Titulo verificado',
      badgeHandle: s.badgeHandle || 'Nome',
      badgeDescricao: '',
      badgeFotoUrl: s.badgeFotoUrl || null,
      /** Miniatura 16:9 em todos os slides (referência: vazio antes de gerar; corpo preenchido depois). */
      imagemGradeAtiva: true,
      imagemGradeLayout: '1',
      imagemGradeAspecto: '16:9',
      imagemGradeSlots: createEmptyImagemGradeSlots(4),
      imagemGradeAdaptarTexto: true,
      imagemGradeRaio: 16,
      cantoSupEsq: '',
      cantoSupDir: '',
      cantoInfEsq: '',
      cantoInfDir: '',
      cantoSupEsqAtivo: false,
      cantoSupDirAtivo: false,
      cantoInfEsqAtivo: false,
      cantoInfDirAtivo: false,
      mostrarBolinhas: false,
      mostrarLogo: false,
      logoPng: null,
      mostrarBotoes: false,
      palavrasDestacadas: [],
      formatacaoPalavras: {},
      imagemFundo: null,
    };

    const merged = {
      ...base,
      id: s.id,
      titulo: base.titulo,
      subtitulo: base.subtitulo,
      ...twitterShell,
      imagemGradeInicioFrac: !isFirst && !isLast ? 0.55 : null,
    };

    return clearPanoramaMeta(normalizeCarrosselImagemGrade(merged));
  });
}

/** Primeira entrada no modo Minimalista — defaults por índice, mantendo ids. */
function buildMinimalistaSlidesFromPrev(prevSlides) {
  return prevSlides.map((s, i) =>
    normalizeCarrosselImagemGrade({
      ...defaultSlide(i),
      id: s.id,
      imagemGradeAtiva: false,
    })
  );
}

/**
 * Casca visual de um slide do template para IA ou merge.
 * Mantém cor de destaque (corDestaque), layout, fontes, etc.; remove texto/cópia do carrossel original.
 */
function cloneSlideStylePrototypeForGeneration(slide) {
  if (!slide || typeof slide !== 'object') return null;
  try {
    const o = JSON.parse(JSON.stringify(slide));
    delete o.id;
    o.titulo = '';
    o.subtitulo = '';
    o.imagemFundo = null;
    o.imagemGradeAtiva = false;
    o.imagemGradeLayout = '1';
    o.imagemGradeAspecto = '16:9';
    o.imagemGradeInicioFrac = null;
    o.imagemGradeSlots = createEmptyImagemGradeSlots(3);
    o.imagemGradeAdaptarTexto = true;
    o.imagemGradeRaio = 20;
    o.twitterConteudoAnchorV = 'centro';
    o.twitterConteudoAnchorH = 'centro';
    if (typeof o.logoPng === 'string' && o.logoPng.startsWith('data:')) o.logoPng = null;
    o.palavrasDestacadas = [];
    o.formatacaoPalavras = {};
    o.cantoSupEsq = '@usuario';
    o.cantoSupDir = 'NICHO';
    o.cantoInfEsq = 'Impulsione seu negócio';
    o.cantoInfDir = '';
    return clearPanoramaMeta(o);
  } catch {
    return null;
  }
}

/**
 * Copia só configuração visual do slide do template (incl. corDestaque, layoutPosicao, margens, glass, overlay…).
 * Mantém título/subtítulo e textos dos cantos; sem palavras destacadas do template.
 * Se já existir imagem de fundo gerada/carregada, mantém-a e o meta de panorama/zoom/posição.
 */
function slideWithTemplateVisual(keepSlide, templateSlide) {
  const proto = cloneSlideStylePrototypeForGeneration(templateSlide);
  if (!proto) return keepSlide;
  let logo = proto.logoPng;
  if (typeof logo === 'string' && logo.startsWith('data:')) logo = null;
  const hasExistingBg =
    keepSlide.imagemFundo != null && String(keepSlide.imagemFundo).trim() !== '';
  const hasGradeImages =
    Array.isArray(keepSlide.imagemGradeSlots) &&
    keepSlide.imagemGradeSlots.some((cell) => cell?.imagem && String(cell.imagem).trim() !== '');
  const keepGradeOn = Boolean(keepSlide.imagemGradeAtiva);

  const base = {
    ...proto,
    id: keepSlide.id,
    titulo: keepSlide.titulo,
    subtitulo: keepSlide.subtitulo,
    palavrasDestacadas: [],
    formatacaoPalavras: {},
    cantoSupEsq: keepSlide.cantoSupEsq,
    cantoSupDir: keepSlide.cantoSupDir,
    cantoInfEsq: keepSlide.cantoInfEsq,
    cantoInfDir: keepSlide.cantoInfDir,
    logoPng: logo,
  };

  if (hasExistingBg) {
    return {
      ...base,
      imagemFundo: keepSlide.imagemFundo,
      imagemZoom: keepSlide.imagemZoom,
      imagemPosX: keepSlide.imagemPosX,
      imagemPosY: keepSlide.imagemPosY,
      imagemPanoramaSlices: keepSlide.imagemPanoramaSlices,
      imagemPanoramaIndex: keepSlide.imagemPanoramaIndex,
      imagemPanoramaOriginSlideId: keepSlide.imagemPanoramaOriginSlideId,
      imagemPanoramaGroupId: keepSlide.imagemPanoramaGroupId,
      imagemPanoramaVinheta: keepSlide.imagemPanoramaVinheta,
    };
  }

  if (keepGradeOn || hasGradeImages) {
    const g = normalizeCarrosselImagemGrade(keepSlide);
    return {
      ...base,
      imagemFundo: null,
      ...clearPanoramaMeta({}),
      imagemGradeAtiva: g.imagemGradeAtiva,
      imagemGradeLayout: g.imagemGradeLayout,
      imagemGradeAspecto: g.imagemGradeAspecto,
      imagemGradeInicioFrac: g.imagemGradeInicioFrac,
      imagemGradeSlots: g.imagemGradeSlots.map((cell) => ({ ...cell })),
      imagemGradeAdaptarTexto: g.imagemGradeAdaptarTexto,
      imagemGradeRaio: g.imagemGradeRaio,
      twitterConteudoAnchorV: ['sup', 'centro', 'inf'].includes(keepSlide.twitterConteudoAnchorV)
        ? keepSlide.twitterConteudoAnchorV
        : 'centro',
      twitterConteudoAnchorH: ['esq', 'centro', 'dir'].includes(keepSlide.twitterConteudoAnchorH)
        ? keepSlide.twitterConteudoAnchorH
        : 'centro',
    };
  }

  return {
    ...base,
    imagemFundo: null,
  };
}

/** Linha de estilo do prompt manual (fallback) conforme pessoas vs. só visual. */
function manualCarrosselImageStyleLine(pref) {
  if (pref === 'people') {
    return 'Estilo: fotografia dramática com iluminação profissional; incluir pessoa(s) com rosto ou figura expressiva em primeiro plano quando fizer sentido ao tema; fundo desfocado (bokeh); estética editorial cinematográfica.';
  }
  if (pref === 'visual') {
    return 'Estilo: fotografia dramática SEM QUALQUER PESSOA — proibido rostos, corpos, silhuetas humanas, mãos ou multidão; apenas ambiente vazio, objetos, natureza, tecnologia, arquitetura, luz e textura; estética editorial cinematográfica.';
  }
  return 'Estilo: fotografia dramática com iluminação profissional; com ou sem figura humana conforme o tema; cores contrastantes; fundo desfocado (bokeh); estética editorial cinematográfica.';
}

function manualCarrosselImagePromptForFormat({ formatId, titulo, subtitulo, humanPreference }) {
  const { promptLabel } = resolveCarrosselCanvasFormat(formatId);
  return `Fotografia cinematográfica de alta qualidade para ${promptLabel}.
Tema: ${titulo}. ${subtitulo}.
${manualCarrosselImageStyleLine(humanPreference)}
Sem texto escrito na imagem. Sem gráficos. Sem infográficos. Fotorrealista.`;
}

function manualPanoramaPromptForFormat({ formatId, sliceCount, humanPreference, paineisBlock = '' }) {
  const { slideW, slideH, promptLabel } = resolveCarrosselCanvasFormat(formatId);
  const blocoPaineis = String(paineisBlock || '').trim();
  const meio = blocoPaineis ? `${blocoPaineis}\n` : '';
  return `Fotografia cinematográfica WIDE horizontal 16:9, UMA cena contínua e fluida da esquerda à direita, sem grelha, sem molduras, sem linhas entre painéis — para depois dividir em ${sliceCount} fatias verticais iguais (cada fatia ${slideW}×${slideH}px, ${promptLabel}).
${meio}${manualCarrosselImageStyleLine(humanPreference)}
Sem texto na imagem. Sem gráficos. Fotorrealista.`;
}

function FormatShapeCarousel({ active }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-[2px]',
        active ? 'bg-neutral-800' : 'border-[1.5px] border-muted-foreground/65 bg-transparent'
      )}
      style={{ width: 9, height: 13 }}
      aria-hidden
    />
  );
}

function FormatShapeSquare({ active }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-[2px]',
        active ? 'border-[1.5px] border-neutral-800 bg-neutral-200' : 'border-[1.5px] border-muted-foreground/65 bg-transparent'
      )}
      style={{ width: 11, height: 11 }}
      aria-hidden
    />
  );
}

function FormatShapeStories({ active }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-[2px] bg-transparent',
        active ? 'border-[1.5px] border-neutral-800' : 'border-[1.5px] border-muted-foreground/65'
      )}
      style={{ width: 7, height: 15 }}
      aria-hidden
    />
  );
}

/** Monta o texto enviado à IA a partir da ficha do cliente, contextos e instruções livres. */
function buildCarouselComposerPrompt({ profile, contexts, userExtra }) {
  const blocks = [];
  if (profile) {
    const formatted = formatClientProfileForPrompt(profile);
    if (formatted?.trim()) blocks.push(formatted.trim());
  }
  if (contexts?.length) {
    const ctxText = contexts
      .map((c) => {
        const name = (c.name || 'Contexto').trim();
        const content = String(c.content || '').trim();
        if (!content) return null;
        return `### ${name}\n${content}`;
      })
      .filter(Boolean)
      .join('\n\n');
    if (ctxText) blocks.push(`--- Contextos cadastrados ---\n${ctxText}`);
  }
  const extra = userExtra.trim();
  if (extra) blocks.push(`--- Tema ou instruções ---\n${extra}`);
  else if (blocks.length)
    blocks.push(
      '--- Tema ou instruções ---\nGere um carrossel alinhado à identidade, à ficha e aos contextos do cliente acima.'
    );
  return blocks.join('\n\n');
}

/** Painel esquerdo — campos de texto (tema escuro nos controlos nativos). */
/** Inclui `sm:` para vencer `text-base sm:text-sm` do `<Textarea>` shadcn após `twMerge`. */
const C_FIELD =
  'w-full rounded-[7px] border border-border bg-muted px-[10px] py-[8px] text-[11px] leading-snug sm:text-[11px] font-normal text-foreground placeholder:text-muted-foreground placeholder:opacity-60 focus:outline-none focus:ring-1 focus:ring-primary';
const C_BTN_PRIMARY =
  'w-full rounded-[8px] bg-gradient-to-br from-purple-600 to-indigo-700 py-[10px] text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50';
const C_BTN_SECONDARY =
  'w-full rounded-[8px] border border-border bg-transparent py-[9px] text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50';
const C_BTN_SMALL =
  'flex-1 rounded-[7px] border border-border bg-transparent py-[8px] text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50';
const C_LBL_FIELD = 'text-[11px] font-medium text-muted-foreground';
const C_LBL_GROUP = 'text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground';
const C_INFO = 'text-[10px] font-normal text-muted-foreground';

/** Prefixo do `id` nas secções do painel — alinhado com `onActivateConfig` do canvas. */
const CARROSSEL_SECTION_DOM_ID = (key) => `neuro-carrossel-section-${key}`;

/** Fundo tipo “quadriculado” escuro atrás dos slides (radial-gradient em mosaico). */
const PREVIEW_CANVAS_BG =
  'bg-[#0a0a0c] [background-image:radial-gradient(rgba(255,255,255,0.085)_1px,transparent_1px)] [background-size:20px_20px]';
const PREVIEW_THUMB_STRIP_BG =
  'bg-[#0a0a0c] [background-image:radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:16px_16px]';

function CarrosselRangeRow({ label, value, min, max, step = 1, disabled, onChange }) {
  const display =
    typeof step === 'number' && step < 1 ? String(Math.round(Number(value) * 10) / 10) : String(value);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className={C_LBL_FIELD}>{label}</span>
        <span className="font-mono text-[12px] font-bold tabular-nums text-foreground">{display}</span>
      </div>
      <input
        type="range"
        disabled={disabled}
        className="w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function Section({ title, open, onToggle, children, icon: Icon, className, sectionId }) {
  return (
    <div id={sectionId ? CARROSSEL_SECTION_DOM_ID(sectionId) : undefined} className={cn('border-b-2 border-border', className)}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center justify-between gap-2 px-4 py-[11px] text-left transition-colors',
          open ? 'bg-muted' : 'bg-card hover:bg-muted'
        )}
      >
        <div className="flex items-center gap-2">
          {Icon ? (
            <Icon className="h-[14px] w-[14px] shrink-0 text-muted-foreground opacity-70" aria-hidden />
          ) : null}
          <span className="text-[12px] font-medium tracking-[0.01em] text-foreground/85">{title}</span>
        </div>
        <ChevronDown
          className={cn(
            'h-[9px] w-[9px] shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>
      {open ? (
        <div className="flex flex-col gap-3 bg-background px-4 pb-4 pt-[14px] [color-scheme:dark]">{children}</div>
      ) : null}
    </div>
  );
}

function AgenteModal({
  open,
  onOpenChange,
  etapa,
  logs,
  slidesGerados,
  gerarImagens,
  onToggleGerarImagens,
  onRodar,
  onAprovar,
  imagemAtual,
  llmConnections,
  selectedLlmId,
  onSelectLlmId,
  imageConnections,
  selectedImageConnId,
  onSelectImageConnId,
  carouselIaMode,
  carouselClientId,
  carouselClientProfile,
  carouselClientContexts,
  carouselSelectedContextId,
  clientsList,
  onSetCarouselIaMode,
  onSetCarouselClientId,
  onSetCarouselSelectedContextId,
  carouselClientDetailLoading,
  iaPrompt,
  onSetIaPrompt,
  agenteRefImg,
  onSetAgenteRefImg,
  agentePaleta,
  onSetAgentePaleta,
  agenteFontOptions,
  agenteFontEscolhida,
  onSetAgenteFontEscolhida,
  onGerarConteudo,
  onVoltarPaleta,
  onRegerarPaletaFontes,
  agenteTemperaturaCriativa,
  onSetAgenteTemperaturaCriativa,
  agenteCandidates,
  onEscolherCandidato,
}) {
  const running = ['extraindo_referencia', 'rodando_conteudo', 'rodando_design', 'rodando_imagens'].includes(etapa);
  const progressoImagens =
    slidesGerados.length > 0 ? Math.min(100, Math.round((Math.max(0, imagemAtual) / slidesGerados.length) * 100)) : 0;
  const neuralPanel =
    'rounded-xl border border-primary/20 bg-gradient-to-br from-slate-900/85 via-[#141326]/90 to-[#0b1020]/90 p-3 shadow-[0_0_0_1px_rgba(99,102,241,0.12),0_18px_40px_rgba(10,12,25,0.55)] backdrop-blur-xl';
  const neuralTitle = 'bg-gradient-to-r from-violet-300 via-indigo-200 to-cyan-200 bg-clip-text text-transparent';
  const normalizeLogText = (log) => String(log || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  const getLogVisual = (log) => {
    const raw = String(log || '');
    const text = normalizeLogText(raw);
    const low = text.toLowerCase();
    if (raw.startsWith('❌') || low.includes('erro')) {
      return { Icon: AlertTriangle, text, tone: 'text-destructive', iconTone: 'text-destructive' };
    }
    if (raw.startsWith('✅') || raw.startsWith('🎉') || low.includes('conclu')) {
      return { Icon: CheckCircle, text, tone: 'text-green-400', iconTone: 'text-green-400' };
    }
    if (low.includes('imagem')) {
      return { Icon: ImageIcon, text, tone: 'text-muted-foreground', iconTone: 'text-indigo-300' };
    }
    if (low.includes('design') || low.includes('paleta') || low.includes('identidade visual')) {
      return { Icon: Palette, text, tone: 'text-muted-foreground', iconTone: 'text-violet-300' };
    }
    if (low.includes('estrutura') || low.includes('slide')) {
      return { Icon: LayoutTemplate, text, tone: 'text-muted-foreground', iconTone: 'text-cyan-300' };
    }
    if (low.includes('regerando') || low.includes('atualizando')) {
      return { Icon: RefreshCw, text, tone: 'text-muted-foreground', iconTone: 'text-amber-300' };
    }
    if (low.includes('briefing') || low.includes('contexto')) {
      return { Icon: Bot, text, tone: 'text-muted-foreground', iconTone: 'text-primary' };
    }
    if (low.includes('candidato') || low.includes('score') || low.includes('telemetria')) {
      return { Icon: Layers, text, tone: 'text-muted-foreground', iconTone: 'text-fuchsia-300' };
    }
    return { Icon: Sparkles, text, tone: 'text-muted-foreground', iconTone: 'text-primary/80' };
  };
  const renderLogLine = (log, key) => {
    const visual = getLogVisual(log);
    const Icon = visual.Icon;
    return (
      <div key={key} className={cn('flex items-start gap-2 text-xs', visual.tone)}>
        <Icon className={cn('mt-[1px] h-3.5 w-3.5 shrink-0', visual.iconTone)} />
        <span>{visual.text}</span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-primary/25 bg-gradient-to-b from-[#070916] via-[#0a0f1f] to-[#060914] text-foreground shadow-[0_0_0_1px_rgba(129,140,248,0.2),0_24px_80px_rgba(3,6,18,0.75)] sm:max-w-md">
        {etapa === 'idle' ? (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-lg border border-primary/35 bg-primary/10 p-1.5">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <h2 className={cn('text-base font-semibold', neuralTitle)}>Agente Neural de Carrossel</h2>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              O agente gera conteúdo, escolhe design e cria as imagens de forma automática.
            </p>

            <div className={cn('space-y-3', neuralPanel)}>
              <div className="space-y-1.5">
                <Label className={C_LBL_FIELD}>Conexão de texto</Label>
                <select
                  className={C_FIELD}
                  value={selectedLlmId || llmConnections[0]?.id || ''}
                  onChange={(e) => onSelectLlmId?.(e.target.value)}
                >
                  {llmConnections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className={C_LBL_FIELD}>Conexão de imagem</Label>
                <select
                  className={C_FIELD}
                  value={selectedImageConnId || imageConnections[0]?.id || ''}
                  onChange={(e) => onSelectImageConnId(e.target.value || null)}
                >
                  <option value="">Sem imagem (só conteúdo + design)</option>
                  {imageConnections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className={C_LBL_FIELD}>Fonte de contexto</Label>
                <select
                  className={C_FIELD}
                  value={carouselIaMode}
                  onChange={(e) => onSetCarouselIaMode(e.target.value === 'with_client' ? 'with_client' : 'free_text')}
                >
                  <option value="free_text">Apenas texto (tema livre)</option>
                  <option value="with_client">Cliente — ficha + um contexto</option>
                </select>
              </div>

              {carouselIaMode === 'with_client' ? (
                <>
                  <div className="space-y-1.5">
                    <Label className={C_LBL_FIELD}>Cliente</Label>
                    <select
                      className={cn(C_FIELD, 'disabled:opacity-50')}
                      value={carouselClientId}
                      onChange={(e) => onSetCarouselClientId(e.target.value)}
                      disabled={clientsList.length === 0}
                    >
                      <option value="">Selecione um cliente…</option>
                      {clientsList.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className={C_LBL_FIELD}>Contexto</Label>
                    <select
                      className={cn(C_FIELD, 'disabled:opacity-50')}
                      value={carouselSelectedContextId}
                      onChange={(e) => onSetCarouselSelectedContextId(e.target.value)}
                      disabled={!carouselClientId || carouselClientDetailLoading}
                    >
                      <option value={CAROUSEL_CONTEXT_FICHA_ONLY}>Só ficha do cliente</option>
                      {carouselClientContexts.map((ctx) => (
                        <option key={ctx.id} value={String(ctx.id)}>
                          {ctx.name || `Contexto ${ctx.id}`}
                        </option>
                      ))}
                    </select>
                    <p className={C_INFO}>
                      {carouselClientDetailLoading
                        ? 'A carregar dados do cliente…'
                        : carouselClientProfile
                          ? 'Ficha carregada para o agente.'
                          : 'Sem ficha carregada ainda.'}
                    </p>
                  </div>
                </>
              ) : null}

              <div className="space-y-1.5">
                <Label className={C_LBL_FIELD}>Tema / instruções</Label>
                <Textarea
                  value={iaPrompt}
                  onChange={(e) => onSetIaPrompt(e.target.value)}
                  placeholder="Ex.: Carrossel sobre estratégia de tráfego para clínicas"
                  className={cn(C_FIELD, 'min-h-[88px]')}
                />
              </div>

              <div className="space-y-1.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Referência visual <span className="opacity-50">(opcional)</span>
                  </span>
                  {agenteRefImg ? (
                    <button
                      type="button"
                      onClick={() => onSetAgenteRefImg(null)}
                      className="text-[10px] text-destructive transition-opacity hover:opacity-80"
                    >
                      Remover
                    </button>
                  ) : null}
                </div>
                {agenteRefImg ? (
                  <div className="relative h-20 overflow-hidden rounded-lg border border-border">
                    <img src={agenteRefImg} alt="Referência" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="text-[10px] font-medium text-white">Imagem de referência carregada</span>
                    </div>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 py-4 transition-colors hover:bg-muted/30">
                    <ImageIcon className="h-5 w-5 text-muted-foreground opacity-50" />
                    <span className="text-center text-[11px] text-muted-foreground">
                      Envie uma arte para usar como referência de cores e estilo
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => onSetAgenteRefImg(ev.target?.result || null);
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>

              <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={gerarImagens}
                  onChange={(e) => onToggleGerarImagens(e.target.checked)}
                  className="accent-primary"
                />
                Gerar imagens cinematográficas para cada slide
              </label>

              <div className="space-y-1.5">
                <Label className={C_LBL_FIELD}>Exploração criativa (multi‑candidatos)</Label>
                <select
                  className={C_FIELD}
                  value={agenteTemperaturaCriativa || 'equilibrado'}
                  onChange={(e) => onSetAgenteTemperaturaCriativa?.(e.target.value)}
                >
                  <option value="conservador">Conservador — 3 propostas de design</option>
                  <option value="equilibrado">Equilibrado — 4 propostas</option>
                  <option value="ousado">Ousado — 5 propostas (máxima variação)</option>
                </select>
                <p className={C_INFO}>
                  O agente gera várias direções de arte, pontua e aplica a melhor — ou pede que você escolha se
                  estiverem empatadas.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void onRodar()}
                disabled={llmConnections.length === 0}
                className={cn(C_BTN_PRIMARY, 'mt-1 inline-flex items-center justify-center gap-2')}
              >
                <Bot className="h-4 w-4" />
                Rodar agente
              </button>
            </div>
          </div>
        ) : null}

        {etapa === 'extraindo_referencia' ? (
          <>
            <div className="mb-4 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <h2 className={cn('text-sm font-semibold', neuralTitle)}>Extraindo identidade visual…</h2>
            </div>
            <div className={cn('min-h-[120px] space-y-1.5', neuralPanel)}>
              {logs.map((log, i) => renderLogLine(log, `agente-log-ref-${i}`))}
            </div>
          </>
        ) : null}

        {etapa === 'aguardando_paleta' && agentePaleta ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <h2 className={cn('text-sm font-semibold', neuralTitle)}>Identidade visual</h2>
            </div>

            <div className={neuralPanel}>
              <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Paleta extraída</p>
              <div className="flex items-center gap-2">
                {[
                  { cor: agentePaleta.corFundo, label: 'Fundo' },
                  { cor: agentePaleta.corTitulo, label: 'Título' },
                  { cor: agentePaleta.corSubtitulo, label: 'Sub' },
                  { cor: agentePaleta.corDestaque, label: 'Destaque' },
                ].map(({ cor, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <div className="h-10 w-10 rounded-lg border border-border" style={{ background: cor }} />
                    <span className="text-[9px] text-muted-foreground">{label}</span>
                    <input
                      type="color"
                      value={/^#[0-9A-Fa-f]{6}$/.test(String(cor || '')) ? String(cor) : '#000000'}
                      onChange={(e) => {
                        const keyMap = {
                          Fundo: 'corFundo',
                          Título: 'corTitulo',
                          Sub: 'corSubtitulo',
                          Destaque: 'corDestaque',
                        };
                        const k = keyMap[label];
                        if (!k) return;
                        onSetAgentePaleta((prev) => ({ ...(prev || {}), [k]: e.target.value }));
                      }}
                      className="h-5 w-7 cursor-pointer rounded border border-border bg-transparent p-0"
                      title={`Ajustar cor de ${label}`}
                    />
                  </div>
                ))}
                <div
                  className="ml-2 flex h-14 flex-1 flex-col justify-end rounded-lg border border-border p-2"
                  style={{ background: agentePaleta.corFundo }}
                >
                  <div className="text-[9px] font-bold leading-tight" style={{ color: agentePaleta.corTitulo }}>
                    TITULO DO SLIDE
                  </div>
                  <div className="mt-0.5 text-[8px]" style={{ color: agentePaleta.corSubtitulo }}>
                    Subtitulo de exemplo
                  </div>
                </div>
              </div>
              {agentePaleta.descricao ? (
                <p className="mt-2 text-[10px] italic text-muted-foreground">{agentePaleta.descricao}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => void onRegerarPaletaFontes()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <RefreshCw className="h-3 w-3" />
              Regerar paleta e fontes
            </button>

            <div className={neuralPanel}>
              <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Escolha a combinação de fontes</p>
              <div className="flex flex-col gap-2">
                {agenteFontOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onSetAgenteFontEscolhida(opt)}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-all',
                      agenteFontEscolhida?.id === opt.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted/20 hover:bg-muted/40'
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className="text-base font-bold text-foreground"
                        style={{ fontFamily: opt.tituloFonte, fontWeight: opt.tituloPeso }}
                      >
                        {opt.label}
                      </span>
                      {agenteFontEscolhida?.id === opt.id ? <CheckCircle className="h-3.5 w-3.5 text-primary" /> : null}
                    </div>
                    <div className="text-[11px] text-muted-foreground" style={{ fontFamily: opt.subtituloFonte }}>
                      {opt.descricao}
                    </div>
                    <div className="mt-1 text-[9px] text-muted-foreground opacity-60">
                      {opt.tituloFonte} + {opt.subtituloFonte}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={onVoltarPaleta} className={C_BTN_SECONDARY}>
                Voltar
              </button>
              <button
                type="button"
                onClick={() => void onGerarConteudo({ refine: false })}
                disabled={!agenteFontEscolhida}
                className={cn(C_BTN_PRIMARY, 'disabled:opacity-40')}
              >
                Gerar conteúdo →
              </button>
            </div>
          </div>
        ) : null}

        {etapa === 'rodando_conteudo' ? (
          <>
            <div className="mb-4 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <h2 className={cn('text-sm font-semibold', neuralTitle)}>Gerando conteúdo…</h2>
            </div>
            <div className={cn('min-h-[120px] space-y-1.5', neuralPanel)}>
              {logs.map((log, i) => renderLogLine(log, `agente-log-conteudo-${i}`))}
            </div>
          </>
        ) : null}

        {etapa === 'aguardando_aprovacao' ? (
          <>
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <h2 className={cn('text-sm font-semibold', neuralTitle)}>Conteúdo gerado</h2>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Revise os {slidesGerados.length} slides. Ao aprovar, o agente aplica o design e gera as imagens.
            </p>
            <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
              {slidesGerados.map((s, i) => (
                <div
                  key={`agente-slide-preview-${i}`}
                  className="rounded-lg border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent p-3"
                >
                  <p className="mb-1 text-[10px] text-muted-foreground">Slide {i + 1}</p>
                  <p className="mb-1 text-xs font-semibold text-foreground">{s.titulo}</p>
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{s.subtitulo}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => void onGerarConteudo({ refine: true })} className={C_BTN_SECONDARY}>
                Refinar conteúdo
              </button>
              <button type="button" onClick={() => void onAprovar()} className={C_BTN_PRIMARY}>
                Aprovar e continuar
              </button>
            </div>
          </>
        ) : null}

        {etapa === 'aguardando_candidato' && agenteCandidates?.length ? (
          <>
            <div className="mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <h2 className={cn('text-sm font-semibold', neuralTitle)}>Empate entre propostas</h2>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Duas ou mais direções de arte ficaram com score próximo. Escolha a que prefere — o agente aplica e segue
              para imagens.
            </p>
            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {agenteCandidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void onEscolherCandidato?.(c.id)}
                  className="w-full rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 to-transparent p-3 text-left transition-colors hover:border-primary/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">{c.profile?.label || c.profile?.id}</span>
                    <span className="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 font-mono text-[10px] text-primary">
                      score {c.score}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{c.rationale || ''}</p>
                </button>
              ))}
            </div>
            <div className={cn('mt-3 max-h-[100px] space-y-1 overflow-y-auto', neuralPanel)}>
              {logs.slice(-6).map((log, i) => renderLogLine(log, `agente-log-cand-${i}`))}
            </div>
          </>
        ) : null}

        {(etapa === 'rodando_design' || etapa === 'rodando_imagens') ? (
          <>
            <div className="mb-4 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <h2 className={cn('text-sm font-semibold', neuralTitle)}>
                {etapa === 'rodando_design' ? 'Aplicando design…' : 'Gerando imagens…'}
              </h2>
            </div>
            {etapa === 'rodando_imagens' ? (
              <div className="mb-3 h-2 w-full rounded-full bg-primary/15">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 shadow-[0_0_20px_rgba(99,102,241,0.45)] transition-all"
                  style={{ width: `${progressoImagens}%` }}
                />
              </div>
            ) : null}
            <div className={cn('max-h-[220px] space-y-1.5 overflow-y-auto', neuralPanel)}>
              {logs.map((log, i) => renderLogLine(log, `agente-log-progresso-${i}`))}
            </div>
          </>
        ) : null}

        {etapa === 'concluido' ? (
          <>
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-green-500/25 bg-green-500/10 shadow-[0_0_18px_rgba(34,197,94,0.25)]">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <h2 className={cn('text-sm font-semibold', neuralTitle)}>Carrossel pronto!</h2>
              <p className="text-xs text-muted-foreground">
                {slidesGerados.length} slides gerados com conteúdo, design e imagens.
              </p>
            </div>
            <div className={cn('mb-4 max-h-[120px] space-y-1 overflow-y-auto', neuralPanel)}>
              {logs.map((log, i) => renderLogLine(log, `agente-log-final-${i}`))}
            </div>
            <button type="button" onClick={() => onOpenChange(false)} className={C_BTN_PRIMARY}>
              Ver carrossel
            </button>
          </>
        ) : null}

        {etapa === 'erro' ? (
          <>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm text-destructive">⚠️</span>
              <h2 className={cn('text-sm font-semibold', neuralTitle)}>Erro no agente</h2>
            </div>
            <div className={cn('max-h-[220px] space-y-1.5 overflow-y-auto', neuralPanel)}>
              {logs.map((log, i) => renderLogLine(log, `agente-log-erro-${i}`))}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => onOpenChange(false)} className={C_BTN_SECONDARY}>
                Fechar
              </button>
              <button type="button" onClick={() => void onRodar()} className={C_BTN_PRIMARY}>
                Tentar novamente
              </button>
            </div>
          </>
        ) : null}

        {running ? (
          <p className="mt-3 text-[10px] text-muted-foreground/90">
            Núcleo ativo: o modal fica bloqueado enquanto o agente executa.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function CarrosselTab({
  llmConnections = [],
  selectedLlmId,
  onSelectLlmId,
  imageConnections = [],
  user,
  /** Abre o drawer lateral do NeuroDesign (galerias / outras abas). */
  onOpenNavigation,
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { tab: neuroTabSlug } = useParams();
  const previewWrapRef = useRef(null);
  /** Painel esquerdo com scroll — alvo do “clique no canvas → ir à secção”. */
  const carrosselConfigScrollRef = useRef(null);
  /** Slide renderizado fora do preview com escala — usado só para html2canvas (evita crop/duplicação por transform no pai). */
  const exportSlideRef = useRef(null);
  const subjectFaceInputRef = useRef(null);
  /** Evita gravar modo/cliente no localStorage no mesmo ciclo em que hidratamos outro utilizador. */
  const skipCarrosselLocalPersistRef = useRef(false);
  const carrosselUndoPastRef = useRef([]);
  const carrosselUndoFutureRef = useRef([]);
  const carrosselUndoPrevSerializedRef = useRef(null);
  const carrosselUndoApplyingRef = useRef(false);
  /** Re-renderiza botões desfazer/refazer quando as pilhas mudam. */
  const [carrosselUndoRevision, setCarrosselUndoRevision] = useState(0);
  const [scale, setScale] = useState(0.32);
  /** `single` = um slide grande; `strip` = todos os slides em fila horizontal (scroll se necessário). */
  const [previewMode, setPreviewMode] = useState('strip');

  const [template, setTemplate] = useState('minimalista');
  const [darkMode, setDarkMode] = useState(true);
  const [slides, setSlides] = useState(() => [defaultSlide(0)]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  /** Dimensões do canvas de pré-visualização e exportação: carousel 4:5, square 1:1, stories 9:16. */
  const [carrosselFormatId, setCarrosselFormatId] = useState('carousel');
  const { slideW, slideH } = useMemo(() => resolveCarrosselCanvasFormat(carrosselFormatId), [carrosselFormatId]);

  const [identidade, setIdentidade] = useState({ ...CARROSSEL_IDENTIDADE_ABERTURA });
  /** Conteúdo guardado por modo ao alternar Minimalista ↔ Twitter (slides + identidade + escuro/claro). */
  const templateWorkspacesRef = useRef({ minimalista: null, twitter: null });

  const [iaPrompt, setIaPrompt] = useState('');
  const [carouselIaMode, setCarouselIaMode] = useState('free_text');
  const [carouselClientId, setCarouselClientId] = useState('');
  const [clientsList, setClientsList] = useState([]);
  const [carouselClientProfile, setCarouselClientProfile] = useState(null);
  const [carouselClientContexts, setCarouselClientContexts] = useState([]);
  const [carouselClientDetailLoading, setCarouselClientDetailLoading] = useState(false);
  /** Qual bloco de `client_contexts` entra no prompt (`ficha_only` = nenhum) */
  const [carouselSelectedContextId, setCarouselSelectedContextId] = useState(CAROUSEL_CONTEXT_FICHA_ONLY);
  const [refImages, setRefImages] = useState([]);
  const [slideCount, setSlideCount] = useState(5);
  const [gerarImagensIa, setGerarImagensIa] = useState(false);
  /** Um fundo 16:9 partido por todos os slides (só com Gemini ao gerar). */
  const [imgGenPanoramaContinuidade, setImgGenPanoramaContinuidade] = useState(false);
  const [isGeneratingSlides, setIsGeneratingSlides] = useState(false);
  const [improvePrompt, setImprovePrompt] = useState('');
  const [isImproving, setIsImproving] = useState(false);
  const [refineIaPrompt, setRefineIaPrompt] = useState('');
  const [isRefiningSlide, setIsRefiningSlide] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isGenPanorama, setIsGenPanorama] = useState(false);
  /** Durante exportação, força o canvas oculto a este slide (evita depender do preview escalado). */
  const [exportSlideSnapshot, setExportSlideSnapshot] = useState(null);

  const [saveGalleryDialogOpen, setSaveGalleryDialogOpen] = useState(false);
  const [saveGalleryName, setSaveGalleryName] = useState('');
  const [isSavingGallery, setIsSavingGallery] = useState(false);
  const [editArtDialogOpen, setEditArtDialogOpen] = useState(false);
  const [editArtInstruction, setEditArtInstruction] = useState('');
  const [isEditingArt, setIsEditingArt] = useState(false);
  /** Se definido, "Salvar" na galeria atualiza esta entrada em vez de criar outra. */
  const [editingGalleryEntryId, setEditingGalleryEntryId] = useState(null);
  const [limitReplaceDialogOpen, setLimitReplaceDialogOpen] = useState(false);
  const [limitReplaceCandidates, setLimitReplaceCandidates] = useState([]);
  const [limitReplaceTargetId, setLimitReplaceTargetId] = useState('');
  const [styleTemplatesList, setStyleTemplatesList] = useState([]);
  const [imageGenTemplateId, setImageGenTemplateId] = useState('');
  const [saveStyleTemplateDialogOpen, setSaveStyleTemplateDialogOpen] = useState(false);
  const [saveStyleTemplateName, setSaveStyleTemplateName] = useState('');

  const [selectedImageConnId, setSelectedImageConnId] = useState(null);
  /** 1K / 2K / 4K — só enviado à API Gemini na geração de imagem. */
  const [imgGenGeminiQuality, setImgGenGeminiQuality] = useState('2K');
  const [imgGenPromptExtra, setImgGenPromptExtra] = useState('');
  const [imgGenRef, setImgGenRef] = useState(null);
  const [isGenBg, setIsGenBg] = useState(false);
  /** null = geração para fundo único; 0–2 = slot da grade de imagens. */
  const [genBgTargetSlot, setGenBgTargetSlot] = useState(null);
  const [genBgStatusLabel, setGenBgStatusLabel] = useState('');
  /** Geração de fundo: auto | people | visual */
  const [imgGenHumanPreference, setImgGenHumanPreference] = useState('auto');
  /** Data URL do rosto para Gemini (modo não visual); ignorada em OpenAI/outros. */
  const [imgGenSubjectFaceDataUrl, setImgGenSubjectFaceDataUrl] = useState(null);
  /** Intervalo 1-based para continuidade / gerar panorama (do slide A ao B). */
  const [panoramaUiStart, setPanoramaUiStart] = useState(1);
  const [panoramaUiEnd, setPanoramaUiEnd] = useState(1);
  const [applyFontsToAllSlides, setApplyFontsToAllSlides] = useState(false);
  const [applyCantosToAllSlides, setApplyCantosToAllSlides] = useState(false);
  const [applyLayoutMarginsToAllSlides, setApplyLayoutMarginsToAllSlides] = useState(false);
  const [agenteOpen, setAgenteOpen] = useState(false);
  const [agenteEtapa, setAgenteEtapa] = useState('idle');
  const [agenteSlidesGerados, setAgenteSlidesGerados] = useState([]);
  const [agenteLog, setAgenteLog] = useState([]);
  const [agenteGerarImagens, setAgenteGerarImagens] = useState(true);
  const [agenteImagemAtual, setAgenteImagemAtual] = useState(0);
  const [agenteRefImg, setAgenteRefImg] = useState(null);
  const [agentePaleta, setAgentePaleta] = useState(null);
  const [agenteFontOptions, setAgenteFontOptions] = useState([]);
  const [agenteFontEscolhida, setAgenteFontEscolhida] = useState(null);
  /** Conservador = menos candidatos; ousado = mais exploração visual. */
  const [agenteTemperaturaCriativa, setAgenteTemperaturaCriativa] = useState('equilibrado');
  /** Finalistas quando o score empata (escolha em 1 clique). */
  const [agenteCandidates, setAgenteCandidates] = useState([]);
  /** Eventos estruturados para auditoria (últimos 200). */
  const [agenteTelemetria, setAgenteTelemetria] = useState([]);
  const lastSavedGallerySnapshotRef = useRef('');
  const lastSavedGalleryNameRef = useRef('');

  const [openSections, setOpenSections] = useState(() => ({
    ia: false,
    identidade: false,
    fundoImg: false,
    gradeImg: false,
    overlay: false,
    fundoSlide: false,
    titulo: false,
    destaque: false,
    badge: false,
    cantos: false,
    botoes: false,
    profileTwitter: true,
    twitterEstilo: false,
  }));

  const collectTemplateIaSnapshot = useCallback(
    () => ({
      iaPrompt,
      carouselIaMode,
      carouselClientId,
      carouselSelectedContextId,
      refImages: Array.isArray(refImages) ? [...refImages] : [],
      slideCount,
      gerarImagensIa,
      imgGenPanoramaContinuidade,
      improvePrompt,
      refineIaPrompt,
      imageGenTemplateId,
      openIa: Boolean(openSections.ia),
      openIdentidade: Boolean(openSections.identidade),
    }),
    [
      iaPrompt,
      carouselIaMode,
      carouselClientId,
      carouselSelectedContextId,
      refImages,
      slideCount,
      gerarImagensIa,
      imgGenPanoramaContinuidade,
      improvePrompt,
      refineIaPrompt,
      imageGenTemplateId,
      openSections.ia,
      openSections.identidade,
    ]
  );

  const applyTemplateIaSnapshot = useCallback((iaRaw) => {
    const ia = iaRaw && typeof iaRaw === 'object' ? iaRaw : defaultTemplateIaBundle();
    setIaPrompt(String(ia.iaPrompt ?? ''));
    setCarouselIaMode(ia.carouselIaMode === 'with_client' ? 'with_client' : 'free_text');
    setCarouselClientId(String(ia.carouselClientId ?? ''));
    setCarouselSelectedContextId(
      typeof ia.carouselSelectedContextId === 'string' && ia.carouselSelectedContextId
        ? ia.carouselSelectedContextId
        : CAROUSEL_CONTEXT_FICHA_ONLY
    );
    setRefImages(Array.isArray(ia.refImages) ? ia.refImages.map((x) => String(x)) : []);
    const sc = Number(ia.slideCount);
    setSlideCount(Number.isFinite(sc) ? Math.min(15, Math.max(1, Math.round(sc))) : 5);
    setGerarImagensIa(Boolean(ia.gerarImagensIa));
    setImgGenPanoramaContinuidade(Boolean(ia.imgGenPanoramaContinuidade));
    setImprovePrompt(String(ia.improvePrompt ?? ''));
    setRefineIaPrompt(String(ia.refineIaPrompt ?? ''));
    setImageGenTemplateId(
      ia.imageGenTemplateId != null && String(ia.imageGenTemplateId).trim() !== ''
        ? String(ia.imageGenTemplateId)
        : ''
    );
    setOpenSections((prev) => ({
      ...prev,
      ia: Boolean(ia.openIa),
      identidade: Boolean(ia.openIdentidade),
    }));
  }, []);

  const switchToTwitterWorkspace = useCallback(() => {
    if (template === 'twitter') return;
    const snap = snapshotCarrosselWorkspace(slides, identidade, darkMode, collectTemplateIaSnapshot());
    if (snap) templateWorkspacesRef.current[template] = snap;
    const saved = templateWorkspacesRef.current.twitter;
    setTemplate('twitter');
    if (saved?.slides?.length) {
      const nextSlides = JSON.parse(JSON.stringify(saved.slides));
      setSlides(nextSlides);
      setActiveSlideIndex((i) => Math.min(Math.max(0, i), Math.max(0, nextSlides.length - 1)));
      setIdentidade({ ...saved.identidade });
      setDarkMode(saved.darkMode);
      applyTemplateIaSnapshot(saved.ia);
      return;
    }
    const twitterIdentidade = {
      corFundo: '#000000',
      corTitulo: '#FFFFFF',
      corSubtitulo: '#71767B',
    };
    setIdentidade(twitterIdentidade);
    setDarkMode(true);
    setSlides(buildTwitterSlidesFromPrev(slides));
    applyTemplateIaSnapshot(defaultTemplateIaBundle());
  }, [template, slides, identidade, darkMode, collectTemplateIaSnapshot, applyTemplateIaSnapshot]);

  const switchToMinimalistaWorkspace = useCallback(() => {
    if (template === 'minimalista') return;
    const snap = snapshotCarrosselWorkspace(slides, identidade, darkMode, collectTemplateIaSnapshot());
    if (snap) templateWorkspacesRef.current[template] = snap;
    const saved = templateWorkspacesRef.current.minimalista;
    setTemplate('minimalista');
    if (saved?.slides?.length) {
      const nextSlides = JSON.parse(JSON.stringify(saved.slides));
      setSlides(nextSlides);
      setActiveSlideIndex((i) => Math.min(Math.max(0, i), Math.max(0, nextSlides.length - 1)));
      setIdentidade({ ...saved.identidade });
      setDarkMode(saved.darkMode);
      applyTemplateIaSnapshot(saved.ia);
      return;
    }
    const next = buildMinimalistaSlidesFromPrev(slides);
    setSlides(next);
    const f = next[0];
    if (f) {
      setIdentidade({
        corFundo: f.corFundo,
        corTitulo: f.corTitulo,
        corSubtitulo: f.corSubtitulo,
      });
    }
    applyTemplateIaSnapshot(defaultTemplateIaBundle());
  }, [template, slides, identidade, darkMode, collectTemplateIaSnapshot, applyTemplateIaSnapshot]);

  const toggle = (k) => setOpenSections((s) => ({ ...s, [k]: !s[k] }));

  const activateCarrosselConfigSection = useCallback((sectionKey) => {
    const k = String(sectionKey || '');
    if (
      ![
        'ia',
        'identidade',
        'fundoImg',
        'gradeImg',
        'overlay',
        'fundoSlide',
        'titulo',
        'destaque',
        'badge',
        'cantos',
        'botoes',
        'profileTwitter',
        'twitterEstilo',
      ].includes(k)
    ) {
      return;
    }
    setOpenSections((prev) => ({ ...prev, [k]: true }));
    const id = CARROSSEL_SECTION_DOM_ID(k);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (!el) return;
        const scroller = carrosselConfigScrollRef.current;
        if (scroller && scroller.contains(el)) {
          const sRect = scroller.getBoundingClientRect();
          const eRect = el.getBoundingClientRect();
          const nextTop = scroller.scrollTop + (eRect.top - sRect.top) - 6;
          scroller.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }, []);

  const activeSlide = slides[activeSlideIndex] || slides[0];
  const activeSlideGrade = useMemo(() => normalizeCarrosselImagemGrade(activeSlide), [activeSlide]);
  const CARROSSEL_FONT_OPTIONS = useMemo(
    () =>
      Array.from(
        new Set([
          ...CARROSSEL_TITULO_FONTES,
          ...NEURODESIGN_GOOGLE_FONTS.map((f) => String(f?.family || '').trim()).filter(Boolean),
        ])
      ).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    []
  );

  const ensureGoogleFontLoaded = useCallback((family) => {
    const raw = String(family || '').trim();
    if (!raw || typeof document === 'undefined') return;
    const token = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const id = `neurodesign-font-${token}`;
    if (document.getElementById(id)) return;
    const encoded = raw.split(/\s+/).join('+');
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encoded}&display=swap`;
    document.head.appendChild(link);
  }, []);

  const buildCurrentGalleryPayload = useCallback(() => {
    const slidesForStorage = Array.isArray(slides)
      ? slides.map((sl) => JSON.parse(JSON.stringify(sl)))
      : [];
    return {
      template,
      darkMode,
      slides: slidesForStorage,
      activeSlideIndex,
      identidade,
      carrosselFormat: carrosselFormatId,
      v: 1,
    };
  }, [template, darkMode, slides, activeSlideIndex, identidade, carrosselFormatId]);
  const currentGallerySnapshot = useMemo(
    () => JSON.stringify(buildCurrentGalleryPayload()),
    [buildCurrentGalleryPayload]
  );

  useEffect(() => {
    const len = slides.length;
    if (len < 1) return;
    setPanoramaUiEnd((e) => Math.min(Math.max(1, e), len));
    setPanoramaUiStart((s) => Math.min(Math.max(1, s), len));
  }, [slides.length]);

  useEffect(() => {
    if (panoramaUiStart > panoramaUiEnd) {
      setPanoramaUiEnd(panoramaUiStart);
    }
  }, [panoramaUiStart, panoramaUiEnd]);

  const panoramaOriginSlide = useMemo(() => {
    const n = Number(activeSlide.imagemPanoramaSlices) || 1;
    if (n <= 1) return activeSlide;
    const oid = activeSlide.imagemPanoramaOriginSlideId;
    if (oid) return slides.find((s) => s.id === oid) || activeSlide;
    const g = activeSlide.imagemPanoramaGroupId;
    if (g) {
      const o = slides.find(
        (s) => s.imagemPanoramaGroupId === g && (Number(s.imagemPanoramaIndex) || 0) === 0
      );
      if (o) return o;
    }
    return activeSlide;
  }, [activeSlide, slides]);

  const isPanoramaOrigin = useMemo(() => {
    const n = Number(activeSlide.imagemPanoramaSlices) || 1;
    if (n <= 1) return true;
    if (activeSlide.imagemPanoramaOriginSlideId)
      return activeSlide.id === activeSlide.imagemPanoramaOriginSlideId;
    return (Number(activeSlide.imagemPanoramaIndex) || 0) === 0;
  }, [activeSlide]);

  const exportLayerActiveIndex = useMemo(() => {
    if (!exportSlideSnapshot) return activeSlideIndex;
    const i = slides.findIndex((s) => s.id === exportSlideSnapshot.id);
    return i >= 0 ? i : activeSlideIndex;
  }, [exportSlideSnapshot, slides, activeSlideIndex]);

  const selectedImageConn = useMemo(
    () => imageConnections.find((c) => String(c.id) === String(selectedImageConnId)) || null,
    [imageConnections, selectedImageConnId]
  );
  const subjectFaceMultimodalOk = selectedImageConn
    ? isCarrosselSubjectFaceMultimodalOk(selectedImageConn.provider, selectedImageConn.api_url || '')
    : false;
  /** Panorama / imagem larga: Gemini nativo ou OpenRouter com modelo de saída imagem. */
  const subjectImagePanoramaOk = selectedImageConn
    ? isCarrosselPanoramaCapableImageConnection(selectedImageConn.provider, selectedImageConn.api_url || '')
    : false;

  /** Parâmetros efetivos para APIs de imagem quando um template de geração está selecionado. */
  const effectiveImageGenSettings = useMemo(() => {
    if (!imageGenTemplateId) {
      return {
        carrosselFormatId,
        imgGenGeminiQuality: normalizeCarrosselGeminiImageSize(imgGenGeminiQuality),
        imgGenHumanPreference,
        imgGenPromptExtra,
        imgGenPanoramaContinuidade,
      };
    }
    const t = styleTemplatesList.find((x) => String(x.id) === String(imageGenTemplateId));
    const s = t?.settings;
    if (!s) {
      return {
        carrosselFormatId,
        imgGenGeminiQuality: normalizeCarrosselGeminiImageSize(imgGenGeminiQuality),
        imgGenHumanPreference,
        imgGenPromptExtra,
        imgGenPanoramaContinuidade,
      };
    }
    return {
      carrosselFormatId:
        s.carrosselFormatId && CARROSSEL_CANVAS_FORMAT[s.carrosselFormatId]
          ? s.carrosselFormatId
          : carrosselFormatId,
      imgGenGeminiQuality: normalizeCarrosselGeminiImageSize(s.imgGenGeminiQuality || imgGenGeminiQuality),
      imgGenHumanPreference: s.imgGenHumanPreference || imgGenHumanPreference,
      imgGenPromptExtra: s.imgGenPromptExtra != null ? s.imgGenPromptExtra : imgGenPromptExtra,
      imgGenPanoramaContinuidade:
        typeof s.imgGenPanoramaContinuidade === 'boolean'
          ? s.imgGenPanoramaContinuidade
          : imgGenPanoramaContinuidade,
    };
  }, [
    imageGenTemplateId,
    styleTemplatesList,
    carrosselFormatId,
    imgGenGeminiQuality,
    imgGenHumanPreference,
    imgGenPromptExtra,
    imgGenPanoramaContinuidade,
  ]);

  /** Dados do template selecionado para aplicar estilo ao gerar slides (e às imagens, via effectiveImageGenSettings). */
  const effectiveContentGenFromTemplate = useMemo(() => {
    if (!imageGenTemplateId) return null;
    const t = styleTemplatesList.find((x) => String(x.id) === String(imageGenTemplateId));
    const s = t?.settings;
    if (!s?.slides?.length) return null;
    const ident =
      s.identidade && typeof s.identidade === 'object'
        ? {
            corFundo: s.identidade.corFundo ?? '#0a0a0a',
            corTitulo: s.identidade.corTitulo ?? '#ffffff',
            corSubtitulo: s.identidade.corSubtitulo ?? '#cccccc',
          }
        : null;
    return {
      templateName: t.name,
      protoSlide: s.slides[0],
      /** Todos os slides guardados no template (1.º = capa, etc.) para posição/estilo por índice. */
      templateSlides: s.slides,
      identidade: ident,
      carrosselFormatId:
        s.carrosselFormatId && CARROSSEL_CANVAS_FORMAT[s.carrosselFormatId] ? s.carrosselFormatId : null,
      template: typeof s.template === 'string' ? s.template : null,
      darkMode: typeof s.darkMode === 'boolean' ? s.darkMode : null,
    };
  }, [imageGenTemplateId, styleTemplatesList]);

  const resolveCarouselContextForLlmImage = useCallback(() => {
    if (carouselIaMode === 'free_text') {
      return iaPrompt.trim();
    }
    if (!carouselClientId || carouselClientDetailLoading || !carouselClientProfile) {
      return iaPrompt.trim();
    }
    const contextsForIa =
      carouselSelectedContextId === CAROUSEL_CONTEXT_FICHA_ONLY
        ? []
        : carouselClientContexts.filter((c) => String(c.id) === carouselSelectedContextId);
    return buildCarouselComposerPrompt({
      profile: carouselClientProfile,
      contexts: contextsForIa,
      userExtra: iaPrompt,
    }).trim();
  }, [
    carouselIaMode,
    iaPrompt,
    carouselClientId,
    carouselClientDetailLoading,
    carouselClientProfile,
    carouselSelectedContextId,
    carouselClientContexts,
  ]);

  useEffect(() => {
    if (!document.getElementById(FONTS_LINK_ID)) {
      const link = document.createElement('link');
      link.id = FONTS_LINK_ID;
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Caveat:wght@400;700&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Inter:wght@100..900&family=Manrope:wght@200..800&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Outfit:wght@100..900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=Raleway:ital,wght@0,100..900;1,100..900&family=Space+Grotesk:wght@300..700&family=Syne:wght@400..800&family=Urbanist:ital,wght@0,100..900;1,100..900&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    ensureGoogleFontLoaded(activeSlide?.tituloFonte || 'Inter');
    ensureGoogleFontLoaded(activeSlide?.subtituloFonte || 'DM Sans');
  }, [activeSlide?.tituloFonte, activeSlide?.subtituloFonte, ensureGoogleFontLoaded]);

  useEffect(() => {
    if (imageConnections.length && !selectedImageConnId) {
      setSelectedImageConnId(imageConnections[0].id);
    }
  }, [imageConnections, selectedImageConnId]);

  useEffect(() => {
    if (!user?.id || skipCarrosselLocalPersistRef.current) return;
    try {
      localStorage.setItem(carrosselStorageKeys(user.id).iaMode, carouselIaMode);
    } catch {
      /* ignore */
    }
  }, [carouselIaMode, user?.id]);

  useEffect(() => {
    if (!user?.id || skipCarrosselLocalPersistRef.current) return;
    try {
      const k = carrosselStorageKeys(user.id).clientId;
      if (carouselClientId) localStorage.setItem(k, carouselClientId);
      else localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }, [carouselClientId, user?.id]);

  useEffect(() => {
    if (!user?.id || skipCarrosselLocalPersistRef.current) return;
    try {
      localStorage.setItem(carrosselStorageKeys(user.id).geminiQuality, imgGenGeminiQuality);
    } catch {
      /* ignore */
    }
  }, [imgGenGeminiQuality, user?.id]);

  useEffect(() => {
    if (!user?.id || skipCarrosselLocalPersistRef.current) return;
    try {
      const k = carrosselStorageKeys(user.id).genTemplateId;
      if (imageGenTemplateId) localStorage.setItem(k, imageGenTemplateId);
      else localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }, [imageGenTemplateId, user?.id]);

  /** Rascunho e preferências por conta — evita partilhar localStorage entre utilizadores no mesmo browser. */
  useEffect(() => {
    if (!user?.id) {
      skipCarrosselLocalPersistRef.current = true;
      carrosselUndoPastRef.current = [];
      carrosselUndoFutureRef.current = [];
      carrosselUndoPrevSerializedRef.current = null;
      templateWorkspacesRef.current = { minimalista: null, twitter: null };
      setCarrosselUndoRevision((r) => r + 1);
      setSlides([defaultSlide(0)]);
      setActiveSlideIndex(0);
      setIdentidade({ ...CARROSSEL_IDENTIDADE_ABERTURA });
      setTemplate('minimalista');
      setDarkMode(true);
      setCarrosselFormatId('carousel');
      setIaPrompt('');
      setCarouselIaMode('free_text');
      setCarouselClientId('');
      setRefImages([]);
      setImgGenGeminiQuality('2K');
      setStyleTemplatesList([]);
      setImageGenTemplateId('');
      setEditingGalleryEntryId(null);
      lastSavedGallerySnapshotRef.current = '';
      lastSavedGalleryNameRef.current = '';
      queueMicrotask(() => {
        skipCarrosselLocalPersistRef.current = false;
      });
      return;
    }

    skipCarrosselLocalPersistRef.current = true;
    queueMicrotask(() => {
      skipCarrosselLocalPersistRef.current = false;
    });

    const keys = carrosselStorageKeys(user.id);
    carrosselUndoPastRef.current = [];
    carrosselUndoFutureRef.current = [];
    carrosselUndoPrevSerializedRef.current = null;
    templateWorkspacesRef.current = { minimalista: null, twitter: null };

    try {
      /* Não restaurar rascunho automaticamente: o carrossel abre limpo; use Minha galeria para abrir um guardado. */
      setEditingGalleryEntryId(null);
      setSlides([defaultSlide(0)]);
      setActiveSlideIndex(0);
      setIdentidade({ ...CARROSSEL_IDENTIDADE_ABERTURA });
      setTemplate('minimalista');
      setDarkMode(true);
      setCarrosselFormatId('carousel');

      let ia = localStorage.getItem(keys.iaMode);
      if (ia == null) {
        const leg = localStorage.getItem(LEGACY_CARROSSEL_IA_MODE_KEY);
        if (leg != null) {
          ia = leg;
          localStorage.setItem(keys.iaMode, leg);
          localStorage.removeItem(LEGACY_CARROSSEL_IA_MODE_KEY);
        }
      }
      setCarouselIaMode(ia === 'with_client' ? 'with_client' : 'free_text');

      let cid = localStorage.getItem(keys.clientId);
      if (cid == null) {
        const leg = localStorage.getItem(LEGACY_CARROSSEL_CLIENT_ID_KEY);
        if (leg != null) {
          cid = leg;
          localStorage.setItem(keys.clientId, leg);
          localStorage.removeItem(LEGACY_CARROSSEL_CLIENT_ID_KEY);
        }
      }
      setCarouselClientId(cid || '');

      const qRaw = localStorage.getItem(keys.geminiQuality);
      setImgGenGeminiQuality(normalizeCarrosselGeminiImageSize(qRaw || '2K'));

      const listT = readCarrosselStyleTemplates(user.id);
      setStyleTemplatesList(listT);
      try {
        const gtRaw = localStorage.getItem(keys.genTemplateId);
        if (gtRaw && listT.some((t) => String(t.id) === gtRaw)) setImageGenTemplateId(gtRaw);
        else setImageGenTemplateId('');
      } catch {
        setImageGenTemplateId('');
      }
    } catch {
      templateWorkspacesRef.current = { minimalista: null, twitter: null };
      setSlides([defaultSlide(0)]);
      setActiveSlideIndex(0);
      setCarouselIaMode('free_text');
      setCarouselClientId('');
      setImgGenGeminiQuality('2K');
      setStyleTemplatesList([]);
      setImageGenTemplateId('');
      setEditingGalleryEntryId(null);
      lastSavedGallerySnapshotRef.current = '';
      lastSavedGalleryNameRef.current = '';
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (!lastSavedGallerySnapshotRef.current) {
      lastSavedGallerySnapshotRef.current = currentGallerySnapshot;
    }
  }, [user?.id, currentGallerySnapshot]);

  useEffect(() => {
    if (!carouselClientId) {
      setCarouselSelectedContextId(CAROUSEL_CONTEXT_FICHA_ONLY);
    }
  }, [carouselClientId]);

  useEffect(() => {
    if (imgGenHumanPreference === 'visual') setImgGenSubjectFaceDataUrl(null);
  }, [imgGenHumanPreference]);

  useEffect(() => {
    if (!gerarImagensIa) setImgGenPanoramaContinuidade(false);
  }, [gerarImagensIa]);

  useEffect(() => {
    if (carouselSelectedContextId === CAROUSEL_CONTEXT_FICHA_ONLY) return;
    const ok = carouselClientContexts.some((c) => String(c.id) === carouselSelectedContextId);
    if (!ok) setCarouselSelectedContextId(CAROUSEL_CONTEXT_FICHA_ONLY);
  }, [carouselClientContexts, carouselSelectedContextId]);

  useEffect(() => {
    if (!user?.id) {
      setClientsList([]);
      return;
    }
    let cancelled = false;
    fetchClientsWithContextCounts(user.id)
      .then((list) => {
        if (!cancelled) setClientsList(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setClientsList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (carouselIaMode !== 'with_client' || !carouselClientId || !user?.id) {
      setCarouselClientProfile(null);
      setCarouselClientContexts([]);
      setCarouselClientDetailLoading(false);
      return;
    }
    const id = parseInt(carouselClientId, 10);
    if (Number.isNaN(id)) {
      setCarouselClientProfile(null);
      setCarouselClientContexts([]);
      setCarouselClientDetailLoading(false);
      return;
    }
    let cancelled = false;
    setCarouselClientDetailLoading(true);
    (async () => {
      try {
        const [profiles, contexts] = await Promise.all([
          fetchClientProfilesForChat([id]),
          fetchClientContexts(id),
        ]);
        if (cancelled) return;
        setCarouselClientProfile(profiles[0] || null);
        setCarouselClientContexts(Array.isArray(contexts) ? contexts : []);
      } catch {
        if (!cancelled) {
          setCarouselClientProfile(null);
          setCarouselClientContexts([]);
        }
      } finally {
        if (!cancelled) setCarouselClientDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [carouselIaMode, carouselClientId, user?.id]);

  useLayoutEffect(() => {
    const el = previewWrapRef.current;
    if (!el) return undefined;
    const pad = 24;
    const update = () => {
      const w = Math.max(1, el.clientWidth - pad);
      const h = Math.max(1, el.clientHeight - pad);
      if (previewMode === 'single') {
        // Teto mais baixo que 0.95 para o preview não dominar o painel.
        setScale(Math.min(w / slideW, h / slideH, 0.78));
      } else {
        // Fila horizontal: tamanho pela altura do painel; excesso de largura → scroll.
        const fitH = (h / slideH) * 0.86;
        const maxStrip = 0.46;
        const minStrip = 0.18;
        const s = Math.min(fitH, maxStrip);
        setScale(Math.max(minStrip, s));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [previewMode, slideW, slideH]);

  useEffect(() => {
    const serialized = JSON.stringify({
      slides,
      activeSlideIndex,
      identidade,
      carrosselFormatId,
      template,
      darkMode,
    });
    const id = window.setTimeout(() => {
      if (carrosselUndoApplyingRef.current) {
        carrosselUndoApplyingRef.current = false;
        carrosselUndoPrevSerializedRef.current = serialized;
        setCarrosselUndoRevision((r) => r + 1);
        return;
      }
      const prev = carrosselUndoPrevSerializedRef.current;
      if (prev === null) {
        carrosselUndoPrevSerializedRef.current = serialized;
        return;
      }
      if (prev === serialized) return;
      try {
        const oldSnap = JSON.parse(prev);
        carrosselUndoPastRef.current.push(oldSnap);
        if (carrosselUndoPastRef.current.length > MAX_CARROSSEL_UNDO) {
          carrosselUndoPastRef.current.shift();
        }
        carrosselUndoFutureRef.current = [];
      } catch {
        /* ignore */
      }
      carrosselUndoPrevSerializedRef.current = serialized;
      setCarrosselUndoRevision((r) => r + 1);
    }, CARROSSEL_UNDO_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [slides, activeSlideIndex, identidade, carrosselFormatId, template, darkMode]);

  const updateSlide = useCallback((index, field, value) => {
    setSlides((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }, []);

  const updateActive = useCallback(
    (field, value) => updateSlide(activeSlideIndex, field, value),
    [activeSlideIndex, updateSlide]
  );

  const updateFieldAllSlides = useCallback((field, value) => {
    setSlides((prev) => prev.map((s) => ({ ...s, [field]: value })));
  }, []);

  const updateActiveMaybeAll = useCallback(
    (field, value, applyAll = false) => {
      if (applyAll) {
        updateFieldAllSlides(field, value);
        return;
      }
      updateActive(field, value);
    },
    [updateActive, updateFieldAllSlides]
  );

  const applyBadgeFromActiveToAll = useCallback(() => {
    const src = slides[activeSlideIndex] || slides[0];
    if (!src) return;
    setSlides((prev) =>
      prev.map((s) => ({
        ...s,
        mostrarBadge: true,
        badgeEstilo: src.badgeEstilo,
        badgeHandle: src.badgeHandle,
        badgeTitulo: src.badgeTitulo,
        badgeVerificado: src.badgeVerificado,
        badgeDescricao: src.badgeDescricao,
        badgeFotoUrl: src.badgeFotoUrl,
        badgeFotoRound: src.badgeFotoRound,
        badgeTamanhoGlobal: src.badgeTamanhoGlobal,
        badgeTamanhoSlide: src.badgeTamanhoSlide,
        badgePosX: src.badgePosX,
        badgePosY: src.badgePosY,
      }))
    );
  }, [slides, activeSlideIndex]);

  const applyCantosFromActiveToAll = useCallback(() => {
    const src = slides[activeSlideIndex] || slides[0];
    if (!src) return;
    setSlides((prev) =>
      prev.map((s) => ({
        ...s,
        cantoSupEsq: src.cantoSupEsq,
        cantoSupDir: src.cantoSupDir,
        cantoInfEsq: src.cantoInfEsq,
        cantoInfDir: src.cantoInfDir,
        cantoSupEsqAtivo: src.cantoSupEsqAtivo,
        cantoSupDirAtivo: src.cantoSupDirAtivo,
        cantoInfEsqAtivo: src.cantoInfEsqAtivo,
        cantoInfDirAtivo: src.cantoInfDirAtivo,
        mostrarBolinhas: src.mostrarBolinhas,
        cantoFonte: src.cantoFonte,
        cantoDist: src.cantoDist,
        cantoOpacidade: src.cantoOpacidade,
        cantoGlass: src.cantoGlass,
        cantoBordaMinimalista: src.cantoBordaMinimalista,
        cantoIcone: src.cantoIcone,
      }))
    );
  }, [slides, activeSlideIndex]);

  const agenteRunning = useMemo(
    () => ['extraindo_referencia', 'rodando_conteudo', 'rodando_design', 'rodando_imagens'].includes(agenteEtapa),
    [agenteEtapa]
  );

  const parseJsonFromAgentText = useCallback((raw) => {
    const txt = String(raw || '').trim();
    if (!txt) throw new Error('Resposta vazia da IA.');
    const cleaned = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const sliced = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    return JSON.parse(sliced);
  }, []);

  const buildFallbackFontOptions = useCallback((fontStyle = 'moderno') => {
    const s = String(fontStyle || '').toLowerCase();
    if (s.includes('impacto') || s.includes('bold')) {
      return [
        {
          id: 'A',
          label: 'Bold Impact',
          tituloFonte: 'Bebas Neue',
          subtituloFonte: 'DM Sans',
          tituloPeso: 700,
          subtituloPeso: 400,
          descricao: 'Presença máxima para prender o olhar no feed.',
        },
        {
          id: 'B',
          label: 'Tech Energy',
          tituloFonte: 'Syne',
          subtituloFonte: 'Inter',
          tituloPeso: 700,
          subtituloPeso: 400,
          descricao: 'Tom moderno e energético com leitura limpa.',
        },
        {
          id: 'C',
          label: 'Strong Editorial',
          tituloFonte: 'Oswald',
          subtituloFonte: 'Manrope',
          tituloPeso: 700,
          subtituloPeso: 400,
          descricao: 'Condensada e objetiva para mensagens diretas.',
        },
      ];
    }
    if (s.includes('elegante') || s.includes('editorial')) {
      return [
        {
          id: 'A',
          label: 'Editorial Premium',
          tituloFonte: 'Playfair Display',
          subtituloFonte: 'Manrope',
          tituloPeso: 700,
          subtituloPeso: 400,
          descricao: 'Sofisticação visual para marca autoral.',
        },
        {
          id: 'B',
          label: 'Classic Contrast',
          tituloFonte: 'Cormorant Garamond',
          subtituloFonte: 'Inter',
          tituloPeso: 700,
          subtituloPeso: 400,
          descricao: 'Elegância com alta legibilidade.',
        },
        {
          id: 'C',
          label: 'Luxury Modern',
          tituloFonte: 'Red Hat Display',
          subtituloFonte: 'Plus Jakarta Sans',
          tituloPeso: 700,
          subtituloPeso: 400,
          descricao: 'Equilíbrio entre premium e contemporâneo.',
        },
      ];
    }
    return [
      {
        id: 'A',
        label: 'Modern Clean',
        tituloFonte: 'Space Grotesk',
        subtituloFonte: 'Inter',
        tituloPeso: 700,
        subtituloPeso: 400,
        descricao: 'Visual atual, técnico e muito legível.',
      },
      {
        id: 'B',
        label: 'Balanced Pro',
        tituloFonte: 'Montserrat',
        subtituloFonte: 'DM Sans',
        tituloPeso: 700,
        subtituloPeso: 400,
        descricao: 'Estável e profissional para vários nichos.',
      },
      {
        id: 'C',
        label: 'Soft Modern',
        tituloFonte: 'Outfit',
        subtituloFonte: 'Manrope',
        tituloPeso: 700,
        subtituloPeso: 400,
        descricao: 'Contemporâneo com leitura suave.',
      },
    ];
  }, []);

  const extractPaletteFromReference = useCallback(
    (dataUrl) =>
      new Promise((resolve, reject) => {
        if (!dataUrl) {
          reject(new Error('Imagem de referência vazia.'));
          return;
        }
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const w = 96;
            const h = 96;
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);
            const { data } = ctx.getImageData(0, 0, w, h);
            let sumR = 0;
            let sumG = 0;
            let sumB = 0;
            let count = 0;
            let accent = { r: 255, g: 214, b: 10, sat: 0 };
            for (let i = 0; i < data.length; i += 16) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];
              if (a < 32) continue;
              sumR += r;
              sumG += g;
              sumB += b;
              count += 1;
              const max = Math.max(r, g, b);
              const min = Math.min(r, g, b);
              const sat = max === 0 ? 0 : (max - min) / max;
              if (sat > accent.sat && max > 72) accent = { r, g, b, sat };
            }
            const avgR = Math.round(sumR / Math.max(1, count));
            const avgG = Math.round(sumG / Math.max(1, count));
            const avgB = Math.round(sumB / Math.max(1, count));
            const luminance = (0.2126 * avgR + 0.7152 * avgG + 0.0722 * avgB) / 255;
            const toHex = (n) => `#${Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')}`;
            const rgbHex = (r, g, b) => `${toHex(r)}${toHex(g)}${toHex(b)}`;
            const corFundo = rgbHex(avgR, avgG, avgB);
            const corTitulo = luminance < 0.48 ? '#ffffff' : '#111111';
            const corSubtitulo = luminance < 0.48 ? '#cbd5e1' : '#374151';
            const corDestaque = rgbHex(accent.r, accent.g, accent.b);
            const mood = luminance < 0.36 ? 'escuro' : accent.sat > 0.55 ? 'vibrante' : 'elegante';
            const estilo = accent.sat > 0.5 ? 'bold' : luminance > 0.62 ? 'clean' : 'editorial';
            const fontStyle = estilo === 'editorial' ? 'elegante' : estilo === 'bold' ? 'impacto' : 'moderno';
            resolve({
              corFundo,
              corTitulo,
              corSubtitulo,
              corDestaque,
              mood,
              estilo,
              fontStyle,
              descricao: 'Paleta inferida automaticamente da referência visual enviada.',
            });
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = () => reject(new Error('Não foi possível ler a imagem de referência.'));
        img.src = String(dataUrl);
      }),
    []
  );

  const buildAgentePromptBody = useCallback(() => {
    if (carouselIaMode === 'free_text') {
      const t = String(iaPrompt || '').trim();
      if (!t) throw new Error('Descreva o tema para o agente.');
      return t;
    }
    if (!carouselClientId) throw new Error('Selecione um cliente para o agente.');
    if (carouselClientDetailLoading) throw new Error('Aguarde o carregamento da ficha do cliente.');
    const contextsForIa =
      carouselSelectedContextId === CAROUSEL_CONTEXT_FICHA_ONLY
        ? []
        : carouselClientContexts.filter((c) => String(c.id) === carouselSelectedContextId);
    const body = buildCarouselComposerPrompt({
      profile: carouselClientProfile,
      contexts: contextsForIa,
      userExtra: iaPrompt,
    });
    if (!String(body || '').trim()) {
      throw new Error('Sem contexto suficiente para o agente gerar conteúdo.');
    }
    return body;
  }, [
    carouselIaMode,
    iaPrompt,
    carouselClientId,
    carouselClientDetailLoading,
    carouselSelectedContextId,
    carouselClientContexts,
    carouselClientProfile,
  ]);

  const rodarAgente = useCallback(async ({ keepExistingLog = false } = {}) => {
    const addLog = (msg) => setAgenteLog((prev) => [...prev, msg]);
    if (!keepExistingLog) setAgenteLog([]);
    setAgenteSlidesGerados([]);
    setAgenteImagemAtual(0);
    try {
      const connId = selectedLlmId || llmConnections[0]?.id;
      if (!connId) throw new Error('Configure uma conexão de texto em Minha IA.');
      const fullPromptBody = buildAgentePromptBody();
      setAgenteEtapa('extraindo_referencia');
      if (agenteRefImg) {
        addLog('🎨 Analisando imagem de referência...');
        const base64Data = agenteRefImg.split(',')[1];
        const mediaType = agenteRefImg.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
        const { text: palText, error: palErr } = await carrosselLlmCompleteTextWithImage({
          supabase,
          connectionId: connId,
          imageBase64: base64Data,
          imageMediaType: mediaType,
          userPrompt: `Analise esta arte/design e extraia a identidade visual.

Retorne APENAS JSON válido sem markdown:
{
  "corFundo": "#hex da cor de fundo dominante",
  "corTitulo": "#hex da cor principal dos títulos",
  "corSubtitulo": "#hex da cor dos textos secundários",
  "corDestaque": "#hex vibrante de acento ou destaque",
  "mood": "escuro|claro|vibrante|minimalista|elegante|industrial",
  "estilo": "bold|clean|editorial|futurista|orgânico",
  "fontStyle": "impacto|elegante|moderno|manuscrito",
  "descricao": "2 frases descrevendo o estilo visual da imagem"
}`,
        });
        if (palErr) throw new Error('Falha ao extrair paleta da imagem.');
        const rawRef = palText;
        const paleta = JSON.parse(palText.replace(/```json|```/g, '').trim());
        const paletaLocal = {
          corFundo: paleta?.corFundo || '#0a0a0a',
          corTitulo: paleta?.corTitulo || '#ffffff',
          corSubtitulo: paleta?.corSubtitulo || '#cbd5e1',
          corDestaque: paleta?.corDestaque || '#ffd700',
          mood: paleta?.mood || 'escuro',
          estilo: paleta?.estilo || 'bold',
          fontStyle: paleta?.fontStyle || 'moderno',
          descricao: paleta?.descricao || 'Identidade visual criada a partir da imagem de referência.',
        };
        console.log('[AGENTE PALETA] raw response:', rawRef);
        console.log('[AGENTE PALETA] parsed:', paleta);
        addLog('✅ Identidade visual extraída da referência!');
        addLog('🔤 Sugerindo combinações de fontes...');
        const fontsPrompt = `Baseado no estilo visual:
mood="${paletaLocal.mood}", estilo="${paletaLocal.estilo}", fontStyle="${paletaLocal.fontStyle}".
Contexto/nicho:
${String(fullPromptBody || '').slice(0, 700)}

Retorne APENAS JSON:
{"opcoes":[
{"id":"A","label":"...","tituloFonte":"...","subtituloFonte":"...","tituloPeso":700,"subtituloPeso":400,"descricao":"..."},
{"id":"B","label":"...","tituloFonte":"...","subtituloFonte":"...","tituloPeso":700,"subtituloPeso":400,"descricao":"..."},
{"id":"C","label":"...","tituloFonte":"...","subtituloFonte":"...","tituloPeso":700,"subtituloPeso":400,"descricao":"..."}
]}

Use apenas: Bebas Neue, Syne, Space Grotesk, Oswald, Montserrat, Anton, Staatliches, Fjalla One, Barlow, Playfair Display, Cormorant Garamond, Inter, DM Sans, Plus Jakarta Sans, Outfit, Manrope, Raleway, Orbitron, Righteous, Red Hat Display`;
        const { text: fontText, error: fontErr } = await carrosselLlmCompleteText({
          supabase,
          connectionId: connId,
          userPrompt: fontsPrompt,
        });
        const fontOptions = !fontErr
          ? (() => {
              try {
                const parsed = parseJsonFromAgentText(fontText);
                return Array.isArray(parsed?.opcoes) && parsed.opcoes.length ? parsed.opcoes : null;
              } catch {
                return null;
              }
            })()
          : null;
        const finalFontOptions = fontOptions || buildFallbackFontOptions(paletaLocal.fontStyle);
        setAgentePaleta(paletaLocal);
        setAgenteFontOptions(finalFontOptions);
        setAgenteFontEscolhida(finalFontOptions[0] || null);
        setAgenteEtapa('aguardando_paleta');
        return;
      }

      addLog('🎨 Criando identidade visual baseada no nicho...');
      const palettePrompt = `Crie identidade visual profissional para carrossel Instagram.
CONTEXTO:
${String(fullPromptBody || '').slice(0, 850)}

Retorne APENAS JSON:
{
"corFundo":"#hex",
"corTitulo":"#hex",
"corSubtitulo":"#hex",
"corDestaque":"#hex",
"mood":"escuro|claro|vibrante|minimalista|elegante|industrial",
"estilo":"bold|clean|editorial|futurista|orgânico",
"fontStyle":"impacto|elegante|moderno|manuscrito",
"descricao":"2 frases",
"opcoesFonte":[
{"id":"A","label":"...","tituloFonte":"...","subtituloFonte":"...","tituloPeso":700,"subtituloPeso":400,"descricao":"..."},
{"id":"B","label":"...","tituloFonte":"...","subtituloFonte":"...","tituloPeso":700,"subtituloPeso":400,"descricao":"..."},
{"id":"C","label":"...","tituloFonte":"...","subtituloFonte":"...","tituloPeso":700,"subtituloPeso":400,"descricao":"..."}
]
}`;
      const { text: palText, error: palErr } = await carrosselLlmCompleteText({
        supabase,
        connectionId: connId,
        userPrompt: palettePrompt,
      });
      if (palErr) throw palErr;
      const parsedPalette = parseJsonFromAgentText(palText);
      const paleta = {
        corFundo: parsedPalette?.corFundo || '#0a0a0a',
        corTitulo: parsedPalette?.corTitulo || '#ffffff',
        corSubtitulo: parsedPalette?.corSubtitulo || '#cbd5e1',
        corDestaque: parsedPalette?.corDestaque || '#ffd700',
        mood: parsedPalette?.mood || 'escuro',
        estilo: parsedPalette?.estilo || 'bold',
        fontStyle: parsedPalette?.fontStyle || 'moderno',
        descricao: parsedPalette?.descricao || 'Identidade visual criada automaticamente para o contexto.',
      };
      const optionsFromLlm = Array.isArray(parsedPalette?.opcoesFonte) && parsedPalette.opcoesFonte.length
        ? parsedPalette.opcoesFonte
        : null;
      const finalFontOptions = optionsFromLlm || buildFallbackFontOptions(paleta.fontStyle);
      setAgentePaleta(paleta);
      setAgenteFontOptions(finalFontOptions);
      setAgenteFontEscolhida(finalFontOptions[0] || null);
      setAgenteEtapa('aguardando_paleta');
      addLog('✅ Identidade visual criada!');
    } catch (e) {
      const msg = e?.message || String(e);
      setAgenteEtapa('erro');
      setAgenteLog((prev) => [...prev, `❌ Erro: ${msg}`]);
      toast({ title: 'Erro no agente', description: msg, variant: 'destructive' });
    }
  }, [
    selectedLlmId,
    llmConnections,
    buildAgentePromptBody,
    agenteRefImg,
    parseJsonFromAgentText,
    buildFallbackFontOptions,
    toast,
  ]);

  const gerarConteudo = useCallback(
    async ({ refine = false } = {}) => {
      const addLog = (msg) => setAgenteLog((prev) => [...prev, msg]);
      try {
        setAgenteEtapa('rodando_conteudo');
        setAgenteLog([]);
        addLog('🧠 Analisando briefing e contexto...');

        const connId = selectedLlmId || llmConnections[0]?.id;
        if (!connId) throw new Error('Configure uma conexão de texto em Minha IA.');
        const fullPromptBody = buildAgentePromptBody();
        const refineBlock = refine ? '\nRefine com mais impacto e gancho mais forte.' : '';
        const promptConteudo = `Você é um agente especialista em carrosséis virais para Instagram.
Analise o contexto e crie um carrossel completo.

CONTEXTO:
${fullPromptBody}

ESTILO VISUAL DEFINIDO: ${agentePaleta?.mood || 'escuro'}, ${agentePaleta?.estilo || 'bold'}.${refineBlock}

Retorne APENAS JSON válido sem markdown:
{"slideCount":6,"slides":[{"titulo":"...","subtitulo":"...","cantoSupDir":"NICHO","layoutPosicao":"inf-esq","tituloTamanho":110}, ...]}

Regras:
- slideCount: entre 5 e 8
- Slide 1: gancho fortíssimo, max 6 palavras, MAIÚSCULAS, layoutPosicao "inf-esq", tituloTamanho 110-130
- Slides 2 a N-1: um insight por slide; layout variado sem repetir consecutivo
- Último slide: CTA claro; layoutPosicao "meio" e alinhamento "centro"
- Português brasileiro, tom direto e impactante`;
        await new Promise((r) => setTimeout(r, 300));
        addLog('🧩 Decidindo estrutura ideal do carrossel...');
        const { text, error } = await carrosselLlmCompleteText({
          supabase,
          connectionId: connId,
          userPrompt: promptConteudo,
        });
        if (error) throw error;
        const parsed = parseJsonFromAgentText(text);
        const gen = Array.isArray(parsed?.slides) ? parsed.slides : [];
        if (!gen.length) throw new Error('Falha ao gerar conteúdo.');
        addLog(`📝 ${gen.length} slides estruturados.`);
        addLog(`✅ ${gen.length} slides gerados. Aguardando aprovação.`);
        setAgenteSlidesGerados(gen);
        setAgenteEtapa('aguardando_aprovacao');
      } catch (e) {
        const msg = e?.message || String(e);
        setAgenteEtapa('erro');
        setAgenteLog((prev) => [...prev, `❌ Erro: ${msg}`]);
      }
    },
    [selectedLlmId, llmConnections, buildAgentePromptBody, agentePaleta, parseJsonFromAgentText]
  );

  const pushAgenteTelemetry = useCallback((evt) => {
    setAgenteTelemetria((prev) => {
      const row = { ts: Date.now(), ...evt };
      if (typeof console !== 'undefined' && console.info) console.info('[AGENTE_TELEMETRY]', row);
      const base = Array.isArray(prev) ? prev : [];
      return [...base, row].slice(-200);
    });
  }, []);

  const runAgenteImagensPhase = useCallback(
    async (addLog, connId) => {
      if (agenteGerarImagens && selectedImageConnId) {
        setAgenteEtapa('rodando_imagens');
        setAgenteImagemAtual(0);
        addLog('🖼️ Definindo estratégia de imagens...');
        const fullPromptBody = buildAgentePromptBody();
        const subjectFaceForApi =
          imgGenHumanPreference !== 'visual' && imgGenSubjectFaceDataUrl && subjectFaceMultimodalOk
            ? imgGenSubjectFaceDataUrl
            : null;
        const strategyPrompt = `Decida estratégia de imagens para ${agenteSlidesGerados.length} slides.
SLIDES:
${agenteSlidesGerados.map((s, i) => `${i + 1}: "${s.titulo}"`).join('\n')}
Retorne APENAS JSON:
{"estrategia":[{"tipo":"individual","slideIndex":0},{"tipo":"panorama","slideInicio":1,"slideFim":3}]}
Regras:
- slideIndex e intervalos são 0-based
- cada slide deve aparecer exatamente uma vez
- individual obrigatório para slide 0 e último`;
        const { text: strategyText, error: strategyErr } = await carrosselLlmCompleteText({
          supabase,
          connectionId: connId,
          userPrompt: strategyPrompt,
        });
        const estrategia = !strategyErr
          ? (() => {
              try {
                const parsed = parseJsonFromAgentText(strategyText);
                return Array.isArray(parsed?.estrategia) && parsed.estrategia.length ? parsed.estrategia : null;
              } catch {
                return null;
              }
            })()
          : null;
        const fallbackEstrat = agenteSlidesGerados.map((_, idx) => ({ tipo: 'individual', slideIndex: idx }));
        const grupos = estrategia || fallbackEstrat;
        addLog(`📐 ${grupos.length} grupos de imagem definidos`);
        pushAgenteTelemetry({
          stage: 'imagens',
          action: 'strategy',
          payload: { grupos: grupos.length },
        });

        for (const grupo of grupos) {
          if (grupo.tipo === 'panorama') {
            const { slideInicio, slideFim } = grupo;
            const s0 = slideInicio;
            const e0 = slideFim;
            addLog(`🖼️ Gerando panorama — slides ${s0 + 1} a ${e0 + 1}...`);

            try {
              const slidesAtual = await new Promise((resolve) => {
                setSlides((prev) => {
                  resolve(prev);
                  return prev;
                });
              });

              const sliceSlides = slidesAtual.slice(s0, e0 + 1);
              const n = sliceSlides.length;

              if (n < 2) {
                addLog(`⚠️ Panorama ${s0 + 1}-${e0 + 1} precisa de pelo menos 2 slides, pulando...`);
                continue;
              }

              const connIdText = selectedLlmId || llmConnections[0]?.id;
              const fullPromptBodyPan = resolveCarouselContextForLlmImage();
              const eg = effectiveImageGenSettings;

              const paineis = sliceSlides
                .map((s, idx) => `Painel ${idx + 1}: ${s.titulo}. ${s.subtitulo}`)
                .join('\n');

              const manualPanoramaPrompt = `${manualPanoramaPromptForFormat({
                formatId: eg.carrosselFormatId,
                sliceCount: n,
                humanPreference: eg.imgGenHumanPreference,
                paineisBlock: paineis,
              })}${eg.imgGenPromptExtra?.trim() ? `\n\nExtra: ${eg.imgGenPromptExtra.trim()}` : ''}`;

              const { imagePrompt: llmPan } = await carrosselBuildPanoramaImagePromptWithLlm({
                supabase,
                connectionId: connIdText,
                fullPromptBody: fullPromptBodyPan,
                slides: sliceSlides,
                humanPreference: eg.imgGenHumanPreference,
              });

              const promptFinal =
                llmPan && String(llmPan).trim().length >= 32
                  ? `${String(llmPan).trim()}${eg.imgGenPromptExtra?.trim() ? `\n\n${eg.imgGenPromptExtra.trim()}` : ''}`
                  : manualPanoramaPrompt;

              const subjectFacePan =
                eg.imgGenHumanPreference !== 'visual' && imgGenSubjectFaceDataUrl && subjectFaceMultimodalOk
                  ? imgGenSubjectFaceDataUrl
                  : null;

              const { dataUrl, error: panErr } = await carrosselGenerateBackgroundImage({
                supabase,
                connectionId: selectedImageConnId,
                prompt: promptFinal,
                humanPreference: eg.imgGenHumanPreference,
                subjectFaceDataUrl: subjectFacePan,
                panoramaSlideCount: n,
                geminiImageSize: eg.imgGenGeminiQuality,
                canvasFormat: eg.carrosselFormatId,
              });

              if (panErr) throw panErr;

              const gid = crypto.randomUUID();
              const originId = slidesAtual[s0].id;

              setSlides((prev) =>
                prev.map((c, j) => {
                  if (j >= s0 && j <= e0) {
                    return {
                      ...c,
                      imagemFundo: dataUrl,
                      imagemPosX: 50,
                      imagemPosY: 50,
                      imagemZoom: 175,
                      imagemPanoramaGroupId: gid,
                      imagemPanoramaOriginSlideId: originId,
                      imagemPanoramaSlices: n,
                      imagemPanoramaIndex: j - s0,
                    };
                  }
                  return c;
                })
              );

              addLog(`✅ Panorama slides ${s0 + 1}-${e0 + 1} aplicado!`);
              await new Promise((r) => setTimeout(r, 400));
            } catch (err) {
              addLog(`⚠️ Panorama ${slideInicio + 1}-${slideFim + 1} falhou: ${err?.message || ''}, continuando...`);
            }
            continue;
          }

          const i = Math.max(0, Math.min(agenteSlidesGerados.length - 1, Number(grupo.slideIndex)));
          if (!Number.isFinite(i)) continue;
          const sl = agenteSlidesGerados[i] || {};
          setAgenteImagemAtual(i + 1);
          addLog(`🖼️ Gerando imagem — slide ${i + 1}...`);
          try {
            const isCoverSlide = i === 0;
            const paletteBlock = isCoverSlide
              ? buildCarrosselPaletteBlockForImage({ agentePaleta, slide: null, identidade: null })
              : '';
            const { imagePrompt: llmImagePrompt } = await carrosselBuildImagePromptWithLlm({
              supabase,
              connectionId: connId,
              fullPromptBody,
              slideIndex: i,
              totalSlides: agenteSlidesGerados.length,
              titulo: sl.titulo || '',
              subtitulo: sl.subtitulo || '',
              humanPreference: imgGenHumanPreference,
              paletteBlock,
              coverMode: isCoverSlide,
            });
            const p =
              llmImagePrompt && String(llmImagePrompt).trim().length >= 32
                ? String(llmImagePrompt).trim()
                : manualCarrosselImagePromptForFormat({
                    formatId: carrosselFormatId,
                    titulo: sl.titulo || '',
                    subtitulo: sl.subtitulo || '',
                    humanPreference: imgGenHumanPreference,
                  });
            const useStyleRef = isCoverSlide && agenteRefImg && subjectFaceMultimodalOk;
            const { dataUrl, error } = await carrosselGenerateBackgroundImage({
              supabase,
              connectionId: selectedImageConnId,
              prompt: p,
              humanPreference: imgGenHumanPreference,
              subjectFaceDataUrl: subjectFaceForApi,
              referenceImageDataUrl: useStyleRef ? agenteRefImg : null,
              referenceImageMode: useStyleRef ? 'style' : 'edit',
              geminiImageSize: imgGenGeminiQuality,
              canvasFormat: carrosselFormatId,
            });
            if (error) throw error;
            if (dataUrl) {
              setSlides((cur) =>
                cur.map((c, j) => (j === i ? { ...c, imagemFundo: dataUrl, ...BG_IMAGE_APPLY_DEFAULTS } : c))
              );
            }
          } catch {
            addLog(`⚠️ Slide ${i + 1} falhou, continuando...`);
          }
          await new Promise((r) => setTimeout(r, 300));
        }
        addLog('✅ Processo de imagens finalizado.');
        pushAgenteTelemetry({ stage: 'imagens', action: 'done', payload: {} });
      } else if (agenteGerarImagens && !selectedImageConnId) {
        addLog('⚠️ Geração de imagens ignorada (sem conexão de imagem selecionada).');
        pushAgenteTelemetry({ stage: 'imagens', action: 'skipped_no_connection', payload: {} });
      } else {
        addLog('ℹ️ Imagens desativadas para esta execução.');
        pushAgenteTelemetry({ stage: 'imagens', action: 'disabled', payload: {} });
      }
    },
    [
      agenteGerarImagens,
      selectedImageConnId,
      agenteSlidesGerados,
      buildAgentePromptBody,
      parseJsonFromAgentText,
      imgGenHumanPreference,
      imgGenSubjectFaceDataUrl,
      subjectFaceMultimodalOk,
      selectedLlmId,
      llmConnections,
      resolveCarouselContextForLlmImage,
      effectiveImageGenSettings,
      carrosselBuildPanoramaImagePromptWithLlm,
      carrosselGenerateBackgroundImage,
      manualPanoramaPromptForFormat,
      imgGenGeminiQuality,
      carrosselFormatId,
      pushAgenteTelemetry,
      manualCarrosselImagePromptForFormat,
      carrosselBuildImagePromptWithLlm,
      agentePaleta,
      agenteRefImg,
    ]
  );

  const resolverCandidatoAgente = useCallback(
    async (candidateId) => {
      const cand = agenteCandidates.find((c) => c.id === candidateId);
      if (!cand) return;
      const addLog = (msg) => setAgenteLog((prev) => [...prev, msg]);
      const connId = selectedLlmId || llmConnections[0]?.id;
      if (!connId) {
        toast({ title: 'Sem conexão', description: 'Configure uma conexão de texto em Minha IA.', variant: 'destructive' });
        return;
      }
      try {
        setAgenteEtapa('rodando_design');
        setAgenteCandidates([]);
        pushAgenteTelemetry({
          stage: 'design',
          action: 'user_picked_candidate',
          payload: { candidateId, profileId: cand.profile?.id, score: cand.score },
        });
        const novaIdentidade = {
          corFundo: agentePaleta?.corFundo || '#0a0a0a',
          corTitulo: agentePaleta?.corTitulo || '#ffffff',
          corSubtitulo: agentePaleta?.corSubtitulo || '#cccccc',
        };
        let qaIssuesResolved = null;
        await new Promise((resolve) => {
          setSlides((prev) => {
            let merged = applyAgentDesignJsonToSlides(prev, cand.design, {
              novaIdentidade,
              agenteFontEscolhida,
              agentePaleta,
            });
            merged = agenteEnriquecerFerramentasEditor(merged, cand.profile, agenteSlidesGerados);
            const qa0 = agenteQaCarrossel({ slides: merged, agenteSlidesGerados });
            pushAgenteTelemetry({ stage: 'qa', action: 'check', payload: qa0 });
            if (!qa0.ok) {
              qaIssuesResolved = qa0.issues;
              merged = agenteAplicarQaHeuristico(merged, agenteSlidesGerados);
              pushAgenteTelemetry({ stage: 'qa', action: 'heuristic_refine', payload: { issues: qa0.issues } });
            }
            resolve(null);
            return merged;
          });
        });
        if (qaIssuesResolved?.length) {
          addLog(`🔧 QA automático: ajustando (${qaIssuesResolved.join(', ')})…`);
        }
        addLog(`✅ Design aplicado — perfil escolhido: ${cand.profile?.label || cand.profile?.id} (score ${cand.score})`);
        await runAgenteImagensPhase(addLog, connId);
        pushAgenteTelemetry({ stage: 'pipeline', action: 'completed', payload: { path: 'user_pick' } });
        setAgenteEtapa('concluido');
        addLog('🎉 Carrossel pronto para revisão e exportação.');
      } catch (e) {
        const msg = e?.message || String(e);
        setAgenteEtapa('erro');
        setAgenteLog((prev) => [...prev, `❌ ${msg}`]);
        toast({ title: 'Erro no agente', description: msg, variant: 'destructive' });
        pushAgenteTelemetry({ stage: 'pipeline', action: 'error', payload: { message: msg } });
      }
    },
    [
      agenteCandidates,
      agenteSlidesGerados,
      agentePaleta,
      agenteFontEscolhida,
      selectedLlmId,
      llmConnections,
      runAgenteImagensPhase,
      toast,
      pushAgenteTelemetry,
    ]
  );

  const aprovarEContinuar = useCallback(async () => {
    if (!agenteSlidesGerados.length) {
      toast({ title: 'Nada para aprovar', description: 'Rode o agente para gerar o conteúdo.', variant: 'destructive' });
      return;
    }
    const addLog = (msg) => setAgenteLog((prev) => [...prev, msg]);
    try {
      pushAgenteTelemetry({
        stage: 'approve',
        action: 'start',
        payload: { slideCount: agenteSlidesGerados.length, temperatura: agenteTemperaturaCriativa },
      });
      setAgenteEtapa('rodando_design');
      const first = slides[0] || defaultSlide(0);
      const LAYOUT_OPTIONS = ['sup-esq', 'sup-dir', 'meio-esq', 'meio', 'inf-esq', 'inf-dir'];
      const novosSlides = agenteSlidesGerados.map((s, i) => {
        const layoutDaIa =
          s.layoutPosicao && LAYOUT_POS_MAP?.[s.layoutPosicao] ? s.layoutPosicao : LAYOUT_OPTIONS[i % LAYOUT_OPTIONS.length];
        const tamRaw = Number(s.tituloTamanho);
        const tituloTam = Number.isFinite(tamRaw) && tamRaw > 0 ? Math.min(200, Math.max(30, Math.round(tamRaw))) : 90;
        return {
          ...defaultSlide(i),
          id: crypto.randomUUID(),
          titulo: s.titulo || '',
          subtitulo: s.subtitulo || '',
          cantoSupDir: s.cantoSupDir || first.cantoSupDir || 'NICHO',
          cantoSupEsq: first.cantoSupEsq || '@usuario',
          cantoInfEsq: first.cantoInfEsq || 'Impulsione seu negócio',
          layoutPosicao: layoutDaIa,
          tituloTamanho: tituloTam,
          corFundo: agentePaleta?.corFundo || '#0a0a0a',
          corTitulo: agentePaleta?.corTitulo || '#ffffff',
          corSubtitulo: agentePaleta?.corSubtitulo || '#cccccc',
          corDestaque: agentePaleta?.corDestaque || '#FFD700',
          tituloFonte: agenteFontEscolhida?.tituloFonte || 'Inter',
          subtituloFonte: agenteFontEscolhida?.subtituloFonte || 'DM Sans',
          tituloPeso: agenteFontEscolhida?.tituloPeso || 700,
          subtituloPeso: agenteFontEscolhida?.subtituloPeso || 400,
        };
      });
      setSlides(novosSlides);
      setSlideCount(novosSlides.length);
      setActiveSlideIndex(0);

      const novaIdentidade = {
        corFundo: agentePaleta?.corFundo || '#0a0a0a',
        corTitulo: agentePaleta?.corTitulo || '#ffffff',
        corSubtitulo: agentePaleta?.corSubtitulo || '#cccccc',
      };
      setIdentidade(novaIdentidade);
      ensureGoogleFontLoaded(agenteFontEscolhida?.tituloFonte || 'Inter');
      ensureGoogleFontLoaded(agenteFontEscolhida?.subtituloFonte || 'DM Sans');
      addLog('🎨 Agente de arte escolhendo design detalhado por slide...');

      const connId = selectedLlmId || llmConnections[0]?.id;
      if (!connId) throw new Error('Configure uma conexão de texto em Minha IA.');
      const totalSlides = agenteSlidesGerados.length;
      // ── Adaptar perfis baseado na referência visual (se houver) ──
      const mood = agentePaleta?.mood || 'escuro';
      const estilo = agentePaleta?.estilo || 'bold';
      const fontStyle = agentePaleta?.fontStyle || 'impacto';
      const temReferencia = !!agenteRefImg && !!agentePaleta;

      // Modificadores por mood — ajustam os perfis base
      const moodConfig = {
        escuro: {
          overlayBase: 82,      // overlays mais pesados
          margemFator: 0.9,     // margens mais apertadas
          glassFator: false,    // menos glass
          padraoFavor: 'nenhum',
        },
        claro: {
          overlayBase: 55,      // overlays mais suaves
          margemFator: 1.2,     // mais respiração
          glassFator: true,
          padraoFavor: 'nenhum',
        },
        vibrante: {
          overlayBase: 70,
          margemFator: 0.95,
          glassFator: false,
          padraoFavor: 'bolinhas',
        },
        minimalista: {
          overlayBase: 50,      // overlay mínimo
          margemFator: 1.3,     // muito espaço em branco
          glassFator: false,
          padraoFavor: 'nenhum',
        },
        elegante: {
          overlayBase: 65,
          margemFator: 1.15,
          glassFator: true,     // glass combina com elegante
          padraoFavor: 'linhas-diagonais',
        },
        industrial: {
          overlayBase: 78,
          margemFator: 0.85,    // margens agressivas
          glassFator: false,
          padraoFavor: 'grade',
        },
      }[mood] || { overlayBase: 75, margemFator: 1.0, glassFator: false, padraoFavor: 'nenhum' };

      // Modificadores por estilo
      const estiloConfig = {
        bold: {
          tituloEscalaBonus: 10,   // títulos maiores
          overlayBonus: 8,
          alinhamentoFavor: 'esq',
        },
        clean: {
          tituloEscalaBonus: -5,
          overlayBonus: -10,
          alinhamentoFavor: 'esq',
        },
        editorial: {
          tituloEscalaBonus: 0,
          overlayBonus: -5,
          alinhamentoFavor: 'dir', // editorial usa muito alinhamento à direita
        },
        futurista: {
          tituloEscalaBonus: 5,
          overlayBonus: 5,
          alinhamentoFavor: 'esq',
        },
        orgânico: {
          tituloEscalaBonus: -8,
          overlayBonus: -15,
          alinhamentoFavor: 'centro',
        },
      }[estilo] || { tituloEscalaBonus: 0, overlayBonus: 0, alinhamentoFavor: 'esq' };

      // Perfis base de designer por posição
      const PERFIS_BASE = [
        {
          layoutPosicao: 'inf-esq',
          alinhamento: 'esq',
          margemHorizontal: 60,
          margemVertical: 80,
          tituloEscala: 85,
          overlayEstilo: 'topo-intenso',
          overlayOpacidade: 82,
          padrao: 'nenhum',
          glass: false,
          papel: 'gancho — título enorme dominando a tela',
        },
        {
          layoutPosicao: 'sup-esq',
          alinhamento: 'esq',
          margemHorizontal: 80,
          margemVertical: 60,
          tituloEscala: 65,
          overlayEstilo: 'base-intenso',
          overlayOpacidade: 70,
          padrao: 'nenhum',
          glass: false,
          papel: 'respiração — título no topo pequeno, imagem domina',
        },
        {
          layoutPosicao: 'meio-esq',
          alinhamento: 'esq',
          margemHorizontal: 70,
          margemVertical: 160,
          tituloEscala: 72,
          overlayEstilo: 'lateral',
          overlayOpacidade: 75,
          padrao: 'nenhum',
          glass: true,
          papel: 'destaque — glass box com texto, imagem na direita',
        },
        {
          layoutPosicao: 'sup-dir',
          alinhamento: 'dir',
          margemHorizontal: 65,
          margemVertical: 70,
          tituloEscala: 68,
          overlayEstilo: 'topo-suave',
          overlayOpacidade: 65,
          padrao: 'grade',
          glass: false,
          papel: 'dado — título à direita, padrão sutil de fundo',
        },
        {
          layoutPosicao: 'meio',
          alinhamento: 'centro',
          margemHorizontal: 100,
          margemVertical: 200,
          tituloEscala: 70,
          overlayEstilo: 'total',
          overlayOpacidade: 78,
          padrao: 'bolinhas',
          glass: false,
          papel: 'pausa — texto centralizado, slide de reflexão',
        },
        {
          layoutPosicao: 'inf-dir',
          alinhamento: 'dir',
          margemHorizontal: 60,
          margemVertical: 90,
          tituloEscala: 75,
          overlayEstilo: 'vinheta',
          overlayOpacidade: 80,
          padrao: 'nenhum',
          glass: false,
          papel: 'virada — título à direita embaixo, vinheta dramática',
        },
        {
          layoutPosicao: 'meio-dir',
          alinhamento: 'esq',
          margemHorizontal: 55,
          margemVertical: 180,
          tituloEscala: 68,
          overlayEstilo: 'topo-base',
          overlayOpacidade: 72,
          padrao: 'linhas-diagonais',
          glass: true,
          papel: 'prova — texto com glass, padrão diagonal sutil',
        },
        {
          layoutPosicao: 'meio',
          alinhamento: 'centro',
          margemHorizontal: 90,
          margemVertical: 210,
          tituloEscala: 78,
          overlayEstilo: 'topo-base',
          overlayOpacidade: 85,
          padrao: 'nenhum',
          glass: false,
          papel: 'cta — centralizado, chamada para ação',
        },
      ];

      // Aplicar modificadores do mood/estilo nos perfis base
      const PERFIS_DESIGNER = PERFIS_BASE.map((p, i) => {
        const isFirst = i === 0;
        const isCta = i === PERFIS_BASE.length - 1;

        // Não alterar slide de gancho e CTA
        if (isFirst || isCta) return p;

        // Calcular overlay ajustado pelo mood
        const overlayOpacidadeAjustada = Math.min(95, Math.max(40,
          p.overlayOpacidade + (moodConfig.overlayBase - 75) + estiloConfig.overlayBonus
        ));

        // Calcular margens ajustadas
        const margemH = Math.round(p.margemHorizontal * moodConfig.margemFator);
        const margemV = Math.round(p.margemVertical * moodConfig.margemFator);

        // Glass: usar sugestão do mood se o perfil já tinha glass
        const glassAjustado = p.glass && moodConfig.glassFator !== false
          ? true
          : moodConfig.glassFator === true && i % 3 === 1
            ? true
            : p.glass;

        // Padrão: preferência do mood substitui o padrão do perfil (exceto nenhum)
        const padraoAjustado = moodConfig.padraoFavor !== 'nenhum' && p.padrao !== 'nenhum'
          ? moodConfig.padraoFavor
          : p.padrao;

        // Alinhamento: estilo editorial favorece direita
        const alinhamentoAjustado = estiloConfig.alinhamentoFavor === 'dir' && i % 2 === 0
          ? 'dir'
          : estiloConfig.alinhamentoFavor === 'centro' && i === Math.floor(PERFIS_BASE.length / 2)
            ? 'centro'
            : p.alinhamento;

        // tituloEscala ajustado pelo estilo
        const escalaAjustada = Math.min(90, Math.max(55,
          p.tituloEscala + estiloConfig.tituloEscalaBonus
        ));

        return {
          ...p,
          margemHorizontal: margemH,
          margemVertical: margemV,
          overlayOpacidade: overlayOpacidadeAjustada,
          glass: glassAjustado,
          padrao: padraoAjustado,
          alinhamento: alinhamentoAjustado,
          tituloEscala: escalaAjustada,
        };
      });

      // Calcular tituloTamanho pelo comprimento real do título
      function calcTamanho(titulo, isFirst) {
        const len = (titulo || '').length;
        if (isFirst) return len <= 15 ? 145 : len <= 25 ? 125 : len <= 35 ? 108 : 92;
        return len <= 20 ? 98 : len <= 35 ? 82 : len <= 50 ? 70 : len <= 65 ? 60 : 50;
      }

      // Calcular margens baseadas no tamanho do título
      function calcMargens(titulo, perfilBase) {
        const len = (titulo || '').length;
        const fator = len > 50 ? 0.85 : len > 30 ? 1.0 : 1.15;
        return {
          margemHorizontal: Math.round(perfilBase.margemHorizontal * fator),
          margemVertical: Math.round(perfilBase.margemVertical * fator),
        };
      }

      const slideDirectives = agenteSlidesGerados.map((s, i) => {
        const isFirst = i === 0;
        const isLast = i === totalSlides - 1;
        const perfilIdx = isLast
          ? PERFIS_DESIGNER.length - 1
          : Math.min(i, PERFIS_DESIGNER.length - 2);
        const perfil = PERFIS_DESIGNER[perfilIdx];
        const tituloTamanho = calcTamanho(s.titulo, isFirst);
        const { margemHorizontal, margemVertical } = calcMargens(s.titulo, perfil);
        const deveDestacar = isFirst || isLast || i === Math.floor(totalSlides / 2);
        const subtituloTamanho = tituloTamanho > 100 ? 20 : tituloTamanho > 80 ? 23 : 26;
        const tituloEspacamento = tituloTamanho > 100 ? -3 : tituloTamanho > 80 ? -2 : -1;

        const glassOn = Boolean(!isFirst && !isLast && perfil.glass);
        const glassAlvoSuggest = glassOn ? (i % 3 === 0 ? 'ambos' : i % 3 === 1 ? 'titulo' : 'subtitulo') : 'ambos';
        const pBg = agentePaleta?.corFundo || '#0a0a0a';
        const pDest = agentePaleta?.corDestaque || '#FFD700';
        const glassCorSuggest = glassOn ? (i % 2 === 0 ? pBg : pDest) : pBg;
        const gOpac = glassOn ? 16 + (i % 5) * 3 : 22;
        const gBlur = glassOn ? 10 + (i % 4) * 2 : 14;
        const gRad = glassOn ? 10 + (i % 3) * 6 : 12;
        const gPad = glassOn ? 10 + (i % 4) * 4 : 14;
        const glassAlvoLine = glassOn
          ? `  glassAlvo: "${glassAlvoSuggest}" [OBRIGATÓRIO quando glass true]`
          : `  glassAlvo: "ambos"`;

        return `Slide ${i + 1} — PAPEL: ${perfil.papel}
  layoutPosicao: "${isLast ? 'meio' : perfil.layoutPosicao}" [OBRIGATÓRIO]
  alinhamento: "${isLast ? 'centro' : perfil.alinhamento}" [OBRIGATÓRIO]
  margemHorizontal: ${margemHorizontal} [OBRIGATÓRIO]
  margemVertical: ${margemVertical} [OBRIGATÓRIO]
  tituloTamanho: ${tituloTamanho} [OBRIGATÓRIO]
  tituloEscala: ${perfil.tituloEscala}
  tituloEspacamento: ${tituloEspacamento}
  subtituloTamanho: ${subtituloTamanho}
  linhaEntreLinhas: ${tituloTamanho > 100 ? 14 : 18}
  overlayEstilo: "${isFirst ? 'topo-intenso' : isLast ? 'topo-base' : perfil.overlayEstilo}" [OBRIGATÓRIO]
  overlayOpacidade: ${perfil.overlayOpacidade}
  padrao: "${isFirst || isLast ? 'nenhum' : perfil.padrao}"
  padraoOpacidade: ${7 + (i % 3) * 3}
  padraoTamanho: ${100 + (i % 4) * 30}
  glass: ${glassOn}
  glassCor: "${glassCorSuggest}"
  glassOpacidade: ${gOpac}
  glassBlur: ${gBlur}
  glassBorderRadius: ${gRad}
  glassPadding: ${gPad}
${glassAlvoLine}
  palavrasDestacadas: ${deveDestacar ? '[escolha 1-2 palavras impactantes do título abaixo]' : '[]'}
  Título real: "${s.titulo}"`;
      }).join('\n\n');

      // Bloco de contexto da referência (só aparece se tiver imagem)
      const referenciaContexto = temReferencia ? `
REFERÊNCIA VISUAL ENVIADA PELO CLIENTE:
- Mood detectado: ${mood}
- Estilo: ${estilo}
- Tipografia: ${fontStyle}
- Descrição: ${agentePaleta?.descricao || ''}
- Os perfis de cada slide já foram adaptados automaticamente para este mood/estilo.
- Mantenha coerência com esta identidade visual ao definir os detalhes opcionais.
` : `
SEM REFERÊNCIA VISUAL — usando perfis padrão de alto impacto.
`;

      const designPromptCore = `Você é um diretor de arte sênior especializado em carrosséis virais para Instagram.
Cada slide tem uma composição intencional e única — nível de agência premium.

IDENTIDADE VISUAL:
corFundo: ${agentePaleta?.corFundo || '#0a0a0a'}
corTitulo: ${agentePaleta?.corTitulo || '#ffffff'}
corSubtitulo: ${agentePaleta?.corSubtitulo || '#cccccc'}
corDestaque: ${agentePaleta?.corDestaque || '#FFD700'}
${referenciaContexto}
FONTE APROVADA:
Título: ${agenteFontEscolhida?.tituloFonte || 'Inter'} peso ${agenteFontEscolhida?.tituloPeso || 700}
Subtítulo: ${agenteFontEscolhida?.subtituloFonte || 'DM Sans'} peso ${agenteFontEscolhida?.subtituloPeso || 400}

NICHO: ${agenteSlidesGerados[0]?.cantoSupDir || 'Geral'}
TOTAL DE SLIDES: ${totalSlides}

DIRETIVAS POR SLIDE (valores [OBRIGATÓRIO] não podem ser alterados):
${slideDirectives}`;

      const designPromptSchemaAndRules = `

Retorne APENAS JSON válido sem markdown:
{
  "global": {
    "cantoInfEsq": "slogan curto e direto alinhado ao nicho (máx 4 palavras)",
    "cantoSupEsq": "@usuario ou handle real",
    "cantoSupDir": "rótulo curto do nicho (opcional)",
    "cantoInfDir": "opcional curto",
    "cantoIcone": "bookmark",
    "cantoOpacidade": 55,
    "cantoFonte": 18,
    "cantoDist": 75,
    "cantoGlass": false,
    "cantoBordaMinimalista": true,
    "mostrarBolinhas": true,
    "cantoSupEsqAtivo": true,
    "cantoSupDirAtivo": true,
    "cantoInfEsqAtivo": true,
    "cantoInfDirAtivo": false
  },
  "slides": [
    {
      "layoutPosicao": "copiar da diretiva OBRIGATÓRIO",
      "alinhamento": "copiar da diretiva OBRIGATÓRIO",
      "margemHorizontal": 0,
      "margemVertical": 0,
      "tituloTamanho": 0,
      "tituloEscala": 70,
      "tituloEspacamento": -1,
      "subtituloTamanho": 24,
      "subtituloEspacamento": 0,
      "linhaEntreLinhas": 18,
      "overlayEstilo": "copiar da diretiva OBRIGATÓRIO",
      "overlayOpacidade": 80,
      "overlayCor": "auto",
      "padrao": "nenhum",
      "padraoTamanho": 150,
      "padraoOpacidade": 8,
      "glass": false,
      "glassCor": "${agentePaleta?.corFundo || '#0a0a0a'}",
      "glassOpacidade": 22,
      "glassBlur": 14,
      "glassBorderRadius": 12,
      "glassAlvo": "ambos",
      "glassPadding": 14,
      "palavrasDestacadas": [],
      "mostrarBotoes": false,
      "ctaTextoPrimario": "",
      "ctaTextoSecundario": "",
      "ctaMostrarSecundario": false,
      "ctaEstilo": "solid",
      "ctaAlinhamento": "centro",
      "ctaTamanho": 100,
      "ctaPosX": 50,
      "ctaPosY": 90,
      "mostrarBadge": false,
      "badgeEstilo": "glass",
      "badgeTitulo": "",
      "badgeHandle": "",
      "badgeDescricao": "",
      "badgeVerificado": true,
      "badgeTamanhoSlide": 100,
      "badgePosX": 28,
      "badgePosY": 16,
      "mostrarGrade": false,
      "imagemGradeAtiva": false,
      "imagemGradeLayout": "1",
      "imagemGradeAdaptarTexto": true,
      "imagemGradeRaio": 20
    }
  ]
}

REGRAS INEGOCIÁVEIS:
1. Copie EXATAMENTE os valores [OBRIGATÓRIO] — não altere layoutPosicao, alinhamento, margens, tituloTamanho, overlayEstilo e padrao quando indicados como OBRIGATÓRIO na diretiva do slide.
2. palavrasDestacadas: palavras REAIS do título, nunca genéricas.
3. cantoInfEsq: slogan real baseado no nicho — não use placeholder.
4. O array slides deve ter EXATAMENTE ${totalSlides} objetos.
5. No ÚLTIMO slide: mostrarBotoes=true e ctaTextoPrimario com CTA curto e forte (verbos de ação).
6. Use as ferramentas do editor (badge, CTA, cantos, padrão, glass) quando elevarem impacto e legibilidade; evite ativar tudo em todos os slides.
7. Campos opcionais podem ser omitidos — omitir significa “desligado” para booleanos de UI quando fizer sentido.
8. Quando a diretiva do slide tiver glass: true, copie exatamente glassCor, glassAlvo, glassOpacidade, glassBlur, glassBorderRadius e glassPadding da diretiva (incluindo [OBRIGATÓRIO] em glassAlvo nesses slides).
9. Se o slide já tiver grade de imagens activa no editor (imagemGradeAtiva), não a desligue nem zere slots salvo a diretiva pedir reformulação radical do layout visual.`;

      const numCand =
        AGENTE_TEMPERATURA_NUM_CANDIDATOS[agenteTemperaturaCriativa] ||
        AGENTE_TEMPERATURA_NUM_CANDIDATOS.equilibrado;
      const perfisRodada = AGENTE_PERFIS_CRIATIVOS.slice(0, Math.min(numCand, AGENTE_PERFIS_CRIATIVOS.length));
      pushAgenteTelemetry({
        stage: 'design',
        action: 'multi_candidate_start',
        payload: { temperatura: agenteTemperaturaCriativa, perfis: perfisRodada.map((p) => p.id) },
      });
      addLog(`🧬 Gerando ${perfisRodada.length} candidatos de design em paralelo…`);

      const fetchDesignForProfile = async (profile) => {
        const designPrompt = `${designPromptCore}


PROPOSTA CRIATIVA — ${profile.label} (${profile.id}):
${profile.blocoPrompt}

Expresse este perfil nas escolhas estéticas (padrão, glass, hierarquia, badge/CTA), sem violar [OBRIGATÓRIO].

${designPromptSchemaAndRules}`;
        const { text: designText, error: designErr } = await carrosselLlmCompleteText({
          supabase,
          connectionId: connId,
          userPrompt: designPrompt,
        });
        if (designErr) throw designErr;
        return parseJsonFromAgentText(designText);
      };

      const settled = await Promise.allSettled(perfisRodada.map((p) => fetchDesignForProfile(p)));
      const parsedOk = [];
      for (let idx = 0; idx < settled.length; idx++) {
        const r = settled[idx];
        const profile = perfisRodada[idx];
        if (r.status === 'fulfilled') {
          const design = r.value;
          const designSlides = Array.isArray(design?.slides) ? design.slides : [];
          if (designSlides.length >= Math.min(3, totalSlides)) {
            const scored = agenteScoreCandidato({ design, agenteSlidesGerados, agentePaleta });
            parsedOk.push({
              id: `${profile.id}-${idx}-${crypto.randomUUID().slice(0, 8)}`,
              profile,
              design,
              score: scored.score,
              breakdown: scored.breakdown,
              rationale: scored.rationale,
            });
            pushAgenteTelemetry({
              stage: 'design',
              action: 'candidate_scored',
              payload: { profileId: profile.id, score: scored.score, breakdown: scored.breakdown },
            });
            addLog(`📊 Candidato ${profile.label}: score ${scored.score} — ${scored.rationale}`);
          }
        } else {
          const msg = r.reason?.message || String(r.reason);
          addLog(`⚠️ Candidato ${profile?.label || idx} falhou: ${msg}`);
          pushAgenteTelemetry({
            stage: 'design',
            action: 'candidate_error',
            payload: { profileId: profile?.id, message: msg },
          });
        }
      }

      if (!parsedOk.length) throw new Error('Nenhum candidato de design válido foi gerado.');

      parsedOk.sort((a, b) => b.score - a.score);
      const best = parsedOk[0];
      const second = parsedOk[1];
      const ambiguous = Boolean(second) && best.score - second.score <= AGENTE_AMBIGUIDADE_DELTA;
      pushAgenteTelemetry({
        stage: 'design',
        action: ambiguous ? 'ambiguous' : 'winner_auto',
        payload: ambiguous
          ? { top: parsedOk.slice(0, 3).map((c) => ({ id: c.id, score: c.score, profile: c.profile?.id })) }
          : { winnerProfile: best.profile?.id, score: best.score },
      });

      if (ambiguous) {
        setAgenteCandidates(parsedOk.slice(0, 3));
        setAgenteEtapa('aguardando_candidato');
        addLog('🎯 Empate entre as melhores propostas — escolha uma opção abaixo.');
        return;
      }

      let mergedSlides = applyAgentDesignJsonToSlides(novosSlides, best.design, {
        novaIdentidade,
        agenteFontEscolhida,
        agentePaleta,
      });
      mergedSlides = agenteEnriquecerFerramentasEditor(mergedSlides, best.profile, agenteSlidesGerados);
      const qa0 = agenteQaCarrossel({ slides: mergedSlides, agenteSlidesGerados });
      pushAgenteTelemetry({ stage: 'qa', action: 'check', payload: qa0 });
      if (!qa0.ok) {
        addLog(`🔧 QA automático: ajustando (${qa0.issues.join(', ')})…`);
        mergedSlides = agenteAplicarQaHeuristico(mergedSlides, agenteSlidesGerados);
        pushAgenteTelemetry({ stage: 'qa', action: 'heuristic_refine', payload: { issues: qa0.issues } });
      }
      setSlides(mergedSlides);
      try {
        const ds = Array.isArray(best.design?.slides) ? best.design.slides : [];
        console.log(
          '[DESIGN]',
          JSON.stringify(
            ds.map((s) => ({
              layoutPosicao: s.layoutPosicao,
              overlayEstilo: s.overlayEstilo,
              glass: s.glass,
              padrao: s.padrao,
              palavrasDestacadas: s.palavrasDestacadas,
            }))
          )
        );
      } catch {
        /* noop */
      }
      addLog(`✅ Design aplicado — perfil vencedor: ${best.profile.label} (score ${best.score})`);

      await runAgenteImagensPhase(addLog, connId);

      pushAgenteTelemetry({ stage: 'pipeline', action: 'completed', payload: { path: 'auto_winner' } });
      setAgenteEtapa('concluido');
      addLog('🎉 Carrossel pronto para revisão e exportação.');
    } catch (e) {
      const msg = e?.message || String(e);
      setAgenteEtapa('erro');
      setAgenteLog((prev) => [...prev, `❌ ${msg}`]);
      toast({ title: 'Erro no agente', description: msg, variant: 'destructive' });
      pushAgenteTelemetry({ stage: 'pipeline', action: 'error', payload: { message: msg } });
    }
  }, [
    agenteSlidesGerados,
    slides,
    agentePaleta,
    agenteRefImg,
    agenteFontEscolhida,
    ensureGoogleFontLoaded,
    agenteGerarImagens,
    agenteTemperaturaCriativa,
    selectedImageConnId,
    selectedLlmId,
    llmConnections,
    buildAgentePromptBody,
    parseJsonFromAgentText,
    runAgenteImagensPhase,
    pushAgenteTelemetry,
    toast,
  ]);

  const handleAgenteOpenChange = useCallback(
    (nextOpen) => {
      if (!nextOpen && agenteRunning) return;
      setAgenteOpen(Boolean(nextOpen));
      if (!nextOpen) {
        setAgenteEtapa('idle');
        setAgenteImagemAtual(0);
        setAgentePaleta(null);
        setAgenteFontOptions([]);
        setAgenteFontEscolhida(null);
        setAgenteCandidates([]);
        setAgenteTelemetria([]);
      }
    },
    [agenteRunning]
  );

  const handleRegerarPaletaFontes = useCallback(async () => {
    setAgenteEtapa('extraindo_referencia');
    setAgenteLog((prev) => [...prev, '🔄 Regerando paleta e fontes...']);
    await rodarAgente({ keepExistingLog: true });
  }, [rodarAgente]);

  const handleCarrosselUndo = useCallback(() => {
    const past = carrosselUndoPastRef.current;
    if (past.length === 0) return;
    const previous = past.pop();
    const currentSnap = snapshotCarrosselUndoState({
      slides,
      activeSlideIndex,
      identidade,
      carrosselFormatId,
      template,
      darkMode,
    });
    carrosselUndoFutureRef.current.unshift(currentSnap);
    if (carrosselUndoFutureRef.current.length > MAX_CARROSSEL_UNDO) {
      carrosselUndoFutureRef.current.pop();
    }
    carrosselUndoApplyingRef.current = true;
    setSlides(previous.slides);
    const maxI = Math.max(0, previous.slides.length - 1);
    setActiveSlideIndex(Math.min(Math.max(0, previous.activeSlideIndex), maxI));
    setIdentidade({ ...previous.identidade });
    setCarrosselFormatId(previous.carrosselFormatId);
    setTemplate(previous.template);
    setDarkMode(previous.darkMode);
    setCarrosselUndoRevision((r) => r + 1);
  }, [slides, activeSlideIndex, identidade, carrosselFormatId, template, darkMode]);

  const handleCarrosselRedo = useCallback(() => {
    const fut = carrosselUndoFutureRef.current;
    if (fut.length === 0) return;
    const next = fut.shift();
    const currentSnap = snapshotCarrosselUndoState({
      slides,
      activeSlideIndex,
      identidade,
      carrosselFormatId,
      template,
      darkMode,
    });
    carrosselUndoPastRef.current.push(currentSnap);
    if (carrosselUndoPastRef.current.length > MAX_CARROSSEL_UNDO) {
      carrosselUndoPastRef.current.shift();
    }
    carrosselUndoApplyingRef.current = true;
    setSlides(next.slides);
    const maxI = Math.max(0, next.slides.length - 1);
    setActiveSlideIndex(Math.min(Math.max(0, next.activeSlideIndex), maxI));
    setIdentidade({ ...next.identidade });
    setCarrosselFormatId(next.carrosselFormatId);
    setTemplate(next.template);
    setDarkMode(next.darkMode);
    setCarrosselUndoRevision((r) => r + 1);
  }, [slides, activeSlideIndex, identidade, carrosselFormatId, template, darkMode]);

  const carrosselUndoHandlerRef = useRef(handleCarrosselUndo);
  const carrosselRedoHandlerRef = useRef(handleCarrosselRedo);
  carrosselUndoHandlerRef.current = handleCarrosselUndo;
  carrosselRedoHandlerRef.current = handleCarrosselRedo;

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      )
        return;
      if (!e.ctrlKey && !e.metaKey) return;
      const k = e.key?.toLowerCase?.();
      if (k !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) carrosselRedoHandlerRef.current();
      else carrosselUndoHandlerRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  /** Zoom/posição do fundo: no panorama sincroniza todos os slides do mesmo grupo (valores vêm do slide de origem). */
  const updateActiveBgTransform = useCallback(
    (field, value) => {
      setSlides((prev) => {
        const idx = activeSlideIndex;
        const s = prev[idx];
        const g = s.imagemPanoramaGroupId;
        const n = Math.max(1, Math.floor(Number(s.imagemPanoramaSlices) || 1));
        if (
          n > 1 &&
          g &&
          (field === 'imagemZoom' ||
            field === 'imagemPosX' ||
            field === 'imagemPosY' ||
            field === 'imagemPanoramaVinheta')
        ) {
          return prev.map((sl) => (sl.imagemPanoramaGroupId === g ? { ...sl, [field]: value } : sl));
        }
        return prev.map((sl, i) => (i === idx ? { ...sl, [field]: value } : sl));
      });
    },
    [activeSlideIndex]
  );

  const updateActiveGradeSlot = useCallback(
    (slotIndex, patch) => {
      setSlides((prev) =>
        prev.map((s, i) => {
          if (i !== activeSlideIndex) return s;
          const norm = normalizeCarrosselImagemGrade(s);
          const slots = norm.imagemGradeSlots.map((cell, j) => (j === slotIndex ? { ...cell, ...patch } : cell));
          return { ...s, imagemGradeSlots: slots };
        })
      );
    },
    [activeSlideIndex]
  );

  const setImagemGradeAtivaSlide = useCallback(
    (ativar) => {
      setSlides((prev) =>
        prev.map((s, i) => {
          if (i !== activeSlideIndex) return s;
          if (!ativar) return { ...s, imagemGradeAtiva: false };
          return clearPanoramaMeta({
            ...normalizeCarrosselImagemGrade(s),
            imagemGradeAtiva: true,
          });
        })
      );
    },
    [activeSlideIndex]
  );

  const aplicarIntervaloContinuidade = useCallback(() => {
    const s0 = panoramaUiStart - 1;
    const e0 = panoramaUiEnd - 1;
    if (s0 < 0 || e0 >= slides.length || s0 > e0) {
      toast({ title: 'Intervalo inválido', variant: 'destructive' });
      return;
    }
    const first = slides[s0];
    if (!first?.imagemFundo) {
      toast({
        title: 'Sem imagem na origem',
        description: 'Use o primeiro slide do intervalo como origem: coloque ou gere a imagem aí antes.',
        variant: 'destructive',
      });
      return;
    }
    const n = e0 - s0 + 1;
    const gOld = first.imagemPanoramaGroupId;
    const gid = uuidv4();
    const originId = first.id;
    const url = first.imagemFundo;
    const z = first.imagemZoom ?? 175;
    const px = first.imagemPosX ?? 50;
    const py = first.imagemPosY ?? 50;

    setSlides((prev) =>
      prev.map((sl, idx) => {
        if (idx >= s0 && idx <= e0) {
          return {
            ...sl,
            imagemFundo: url,
            imagemPanoramaGroupId: gid,
            imagemPanoramaOriginSlideId: originId,
            imagemPanoramaSlices: n,
            imagemPanoramaIndex: idx - s0,
            imagemZoom: z,
            imagemPosX: px,
            imagemPosY: py,
            imagemPanoramaVinheta: Math.min(100, Math.max(0, Number(first.imagemPanoramaVinheta) || 100)),
          };
        }
        if (gOld && sl.imagemPanoramaGroupId === gOld) {
          return clearPanoramaMeta(sl);
        }
        return sl;
      })
    );
    toast({
      title: 'Continuidade aplicada',
      description: `A mesma arte percorre os slides ${s0 + 1} a ${e0 + 1}. Edite zoom e posição só no slide ${s0 + 1} (origem).`,
    });
  }, [panoramaUiStart, panoramaUiEnd, slides, toast]);

  const applyDarkLight = useCallback((dark) => {
    setDarkMode(dark);
    const next = dark ? { ...CARROSSEL_IDENTIDADE_ABERTURA } : { corFundo: '#f5f5f5', corTitulo: '#111111', corSubtitulo: '#444444' };
    setIdentidade(next);
    setSlides((prev) =>
      prev.map((s) => ({
        ...s,
        corFundo: next.corFundo,
        corTitulo: next.corTitulo,
        corSubtitulo: next.corSubtitulo,
      }))
    );
  }, []);

  const aplicarIdentidadeTodos = useCallback(() => {
    setSlides((prev) =>
      prev.map((s) => ({
        ...s,
        corFundo: identidade.corFundo,
        corTitulo: identidade.corTitulo,
        corSubtitulo: identidade.corSubtitulo,
      }))
    );
    toast({ title: 'Cores aplicadas a todos os slides' });
  }, [identidade, toast]);

  const addSlide = useCallback(() => {
    setSlides((prev) => {
      const base = prev[activeSlideIndex] || defaultSlide(0);
      const idxNext = prev.length;
      const nu = {
        ...defaultSlide(idxNext),
        corFundo: base.corFundo,
        corTitulo: base.corTitulo,
        corSubtitulo: base.corSubtitulo,
        tituloFonte: base.tituloFonte,
        subtituloFonte: base.subtituloFonte,
        overlayEstilo: base.overlayEstilo,
        padrao: base.padrao,
        margemHorizontal: base.margemHorizontal,
        margemVertical: base.margemVertical,
        layoutPosicao: base.layoutPosicao,
        alinhamento: base.alinhamento,
        titulo: 'Novo slide',
        subtitulo: '',
      };
      const next = [...prev, nu];
      queueMicrotask(() => setActiveSlideIndex(next.length - 1));
      return next;
    });
  }, [activeSlideIndex]);

  const removeSlide = useCallback(
    (index) => {
      setSlides((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((_, i) => i !== index);
        setActiveSlideIndex((ai) => {
          if (index === ai) return Math.max(0, Math.min(ai, next.length - 1));
          if (ai > index) return ai - 1;
          return ai;
        });
        return next;
      });
    },
    []
  );

  const handleGerarSlides = useCallback(async () => {
    const connId = selectedLlmId || llmConnections[0]?.id;
    if (!connId) {
      toast({ title: 'Configure uma conexão de texto em Minha IA', variant: 'destructive' });
      return;
    }
    let fullPromptBody = '';
    if (carouselIaMode === 'free_text') {
      if (!iaPrompt.trim()) {
        toast({ title: 'Descreva o tema do carrossel', variant: 'destructive' });
        return;
      }
      fullPromptBody = iaPrompt.trim();
    } else {
      if (!carouselClientId) {
        toast({ title: 'Selecione um cliente', variant: 'destructive' });
        return;
      }
      if (carouselClientDetailLoading) {
        toast({ title: 'Aguarde', description: 'A carregar a ficha do cliente…', variant: 'destructive' });
        return;
      }
      const contextsForIa =
        carouselSelectedContextId === CAROUSEL_CONTEXT_FICHA_ONLY
          ? []
          : carouselClientContexts.filter((c) => String(c.id) === carouselSelectedContextId);
      fullPromptBody = buildCarouselComposerPrompt({
        profile: carouselClientProfile,
        contexts: contextsForIa,
        userExtra: iaPrompt,
      });
      if (!fullPromptBody.trim()) {
        toast({
          title: 'Sem contexto para a IA',
          description: 'Complete a ficha em Clientes, adicione contextos ou escreva um tema no campo de texto.',
          variant: 'destructive',
        });
        return;
      }
    }
    setIsGeneratingSlides(true);
    try {
      let promptExtra = '';
      if (refImages.length) {
        promptExtra = `\n(O utilizador indicou ${refImages.length} imagem(ns) de referência anexadas no editor — considere o tema visual sugerido.)`;
      }
      const twitterMode = template === 'twitter';
      const { slides: gen, error } = twitterMode
        ? await carrosselLlmGenerateSlidesJsonTwitter({
            supabase,
            connectionId: connId,
            iaPrompt: fullPromptBody + promptExtra,
            slideCount,
          })
        : await carrosselLlmGenerateSlidesJson({
            supabase,
            connectionId: connId,
            iaPrompt: fullPromptBody + promptExtra,
            slideCount,
          });
      if (error) throw error;

      const tmplCtx = twitterMode ? null : effectiveContentGenFromTemplate;
      if (tmplCtx) {
        if (tmplCtx.carrosselFormatId) setCarrosselFormatId(tmplCtx.carrosselFormatId);
        if (tmplCtx.template) setTemplate(tmplCtx.template);
        if (tmplCtx.darkMode !== null && tmplCtx.darkMode !== undefined) setDarkMode(tmplCtx.darkMode);
        if (tmplCtx.identidade) setIdentidade({ ...tmplCtx.identidade });
      }

      const slidesTmpl = tmplCtx?.templateSlides;
      const first = slides[0] || defaultSlide();

      let novos;
      if (twitterMode) {
        const idRows = gen.map(() => ({ id: crypto.randomUUID() }));
        const bases = buildTwitterSlidesFromPrev(idRows);
        novos = bases.map((slide, i) => {
          const s = gen[i] || {};
          const lim = applyCarrosselTwitterIaTextLimits(s.titulo, s.subtitulo);
          const tituloTam = Number(s.tituloTamanho);
          const tituloTamanho =
            s.tituloTamanho != null &&
            s.tituloTamanho !== '' &&
            Number.isFinite(tituloTam) &&
            tituloTam > 0
              ? Math.min(52, Math.max(30, Math.round(tituloTam)))
              : CARROSSEL_TWITTER_IA_DEFAULT_TITULO_TAMANHO;
          return normalizeCarrosselImagemGrade({
            ...slide,
            titulo: lim.titulo.trim(),
            subtitulo: lim.subtitulo.trim(),
            tituloTamanho,
            subtituloTamanho: tituloTamanho,
          });
        });
      } else {
        novos = gen.map((s, i) => {
          const layoutDaIa = s.layoutPosicao && LAYOUT_POS_MAP[s.layoutPosicao] ? s.layoutPosicao : null;
          const tamRaw = Number(s.tituloTamanho);
          const tituloTamDaIa =
            s.tituloTamanho != null &&
            s.tituloTamanho !== '' &&
            Number.isFinite(tamRaw) &&
            tamRaw > 0
              ? Math.min(200, Math.max(20, Math.round(tamRaw)))
              : null;

          const tmplRef =
            slidesTmpl?.length > 0 ? slidesTmpl[Math.min(i, slidesTmpl.length - 1)] : null;
          const protoStyled = tmplRef ? cloneSlideStylePrototypeForGeneration(tmplRef) : null;

          if (protoStyled) {
            const base = { ...defaultSlide(i), ...protoStyled };
            return {
              ...base,
              id: crypto.randomUUID(),
              titulo: s.titulo || '',
              subtitulo: s.subtitulo || '',
              layoutPosicao: layoutDaIa || base.layoutPosicao || 'sup-esq',
              tituloTamanho: tituloTamDaIa ?? base.tituloTamanho ?? 90,
              cantoSupDir: s.cantoSupDir || base.cantoSupDir || 'NICHO',
              cantoSupEsq: base.cantoSupEsq || '@usuario',
              cantoInfEsq: base.cantoInfEsq || 'Impulsione seu negócio',
            };
          }

          return {
            ...defaultSlide(i),
            corFundo: identidade.corFundo,
            corTitulo: identidade.corTitulo,
            corSubtitulo: identidade.corSubtitulo,
            tituloFonte: first.tituloFonte || 'Inter',
            subtituloFonte: first.subtituloFonte || 'DM Sans',
            margemHorizontal: first.margemHorizontal ?? 130,
            margemVertical: first.margemVertical ?? 210,
            layoutPosicao: layoutDaIa || first.layoutPosicao || 'sup-esq',
            tituloTamanho: tituloTamDaIa ?? first.tituloTamanho ?? 90,
            id: crypto.randomUUID(),
            titulo: s.titulo || '',
            subtitulo: s.subtitulo || '',
            cantoSupDir: s.cantoSupDir || first.cantoSupDir || 'NICHO',
            cantoSupEsq: first.cantoSupEsq || '@usuario',
            cantoInfEsq: first.cantoInfEsq || 'Impulsione seu negócio',
          };
        });
      }
      setSlides(novos);
      setActiveSlideIndex(0);
      toast({
        title: `${novos.length} slides gerados`,
        description: twitterMode
          ? 'Formato X: só corpo e subtítulo gerados; cabeçalho do perfil mantém-se manual.'
          : tmplCtx?.templateName
            ? `Template: ${tmplCtx.templateName}`
            : undefined,
      });

      const eg = effectiveImageGenSettings;
      if (gerarImagensIa && selectedImageConnId && !twitterMode) {
        const imgConn = imageConnections.find((c) => String(c.id) === String(selectedImageConnId));
        const subjectFaceMultimodalBatch =
          imgConn && isCarrosselSubjectFaceMultimodalOk(imgConn.provider, imgConn.api_url || '');
        const panoramaConnOk =
          imgConn &&
          isCarrosselPanoramaCapableImageConnection(imgConn.provider, imgConn.api_url || '');
        const subjectFaceForBatch =
          eg.imgGenHumanPreference !== 'visual' && imgGenSubjectFaceDataUrl && subjectFaceMultimodalBatch
            ? imgGenSubjectFaceDataUrl
            : null;
        if (
          eg.imgGenHumanPreference !== 'visual' &&
          imgGenSubjectFaceDataUrl &&
          !subjectFaceMultimodalBatch
        ) {
          toast({
            title: 'Foto do sujeito ignorada',
            description:
              'Só Gemini (Google) ou OpenRouter com modelo de saída imagem na mesma conexão. A gerar sem referência facial.',
          });
        }
        const carouselContextForImage = fullPromptBody + (promptExtra || '');
        const usePanorama = eg.imgGenPanoramaContinuidade && novos.length >= 2 && panoramaConnOk;

        if (eg.imgGenPanoramaContinuidade && novos.length >= 2 && !panoramaConnOk) {
          toast({
            title: 'Panorama indisponível nesta conexão',
            description:
              'Use Google (Gemini) ou OpenRouter com modelo de saída imagem, ou desative “Imagem contínua”. A gerar um fundo por slide.',
          });
        }

        if (usePanorama) {
          const paineis = novos
            .map((s, idx) => `Painel ${idx + 1} (esq.→dir.): ${s.titulo}. ${s.subtitulo}`)
            .join('\n');
          const manualPanoramaPrompt = manualPanoramaPromptForFormat({
            formatId: eg.carrosselFormatId,
            sliceCount: novos.length,
            humanPreference: eg.imgGenHumanPreference,
            paineisBlock: paineis,
          });
          const { imagePrompt: llmPan } = await carrosselBuildPanoramaImagePromptWithLlm({
            supabase,
            connectionId: connId,
            fullPromptBody: carouselContextForImage,
            slides: novos,
            humanPreference: eg.imgGenHumanPreference,
          });
          const p =
            llmPan && String(llmPan).trim().length >= 32
              ? String(llmPan).trim()
              : manualPanoramaPrompt;
          const { dataUrl, error: panErr } = await carrosselGenerateBackgroundImage({
            supabase,
            connectionId: selectedImageConnId,
            prompt: p,
            humanPreference: eg.imgGenHumanPreference,
            subjectFaceDataUrl: subjectFaceForBatch,
            panoramaSlideCount: novos.length,
            geminiImageSize: eg.imgGenGeminiQuality,
            canvasFormat: eg.carrosselFormatId,
          });
          if (panErr) {
            toast({
              title: 'Panorama falhou',
              description: panErr.message,
              variant: 'destructive',
            });
          } else if (dataUrl) {
            const n = novos.length;
            const gid = uuidv4();
            const originId = novos[0].id;
            setSlides((cur) =>
              cur.map((c, j) => ({
                ...c,
                imagemFundo: dataUrl,
                ...BG_IMAGE_APPLY_DEFAULTS,
                imagemPanoramaGroupId: gid,
                imagemPanoramaOriginSlideId: originId,
                imagemPanoramaSlices: n,
                imagemPanoramaIndex: j,
              }))
            );
          }
        } else {
          for (let i = 0; i < novos.length; i++) {
            const sl = novos[i];
            const manualImagePrompt = manualCarrosselImagePromptForFormat({
              formatId: eg.carrosselFormatId,
              titulo: sl.titulo,
              subtitulo: sl.subtitulo,
              humanPreference: eg.imgGenHumanPreference,
            });
            const paletteBatch = i === 0 ? buildCarrosselPaletteBlockForImage({ agentePaleta: null, slide: sl, identidade }) : '';
            const { imagePrompt: llmImagePrompt } = await carrosselBuildImagePromptWithLlm({
              supabase,
              connectionId: connId,
              fullPromptBody: carouselContextForImage,
              slideIndex: i,
              totalSlides: novos.length,
              titulo: sl.titulo,
              subtitulo: sl.subtitulo,
              humanPreference: eg.imgGenHumanPreference,
              paletteBlock: paletteBatch,
              coverMode: i === 0,
            });
            const p =
              llmImagePrompt && String(llmImagePrompt).trim().length >= 32
                ? String(llmImagePrompt).trim()
                : manualImagePrompt;
            const { dataUrl, error: imgErr } = await carrosselGenerateBackgroundImage({
              supabase,
              connectionId: selectedImageConnId,
              prompt: p,
              humanPreference: eg.imgGenHumanPreference,
              subjectFaceDataUrl: subjectFaceForBatch,
              geminiImageSize: eg.imgGenGeminiQuality,
              canvasFormat: eg.carrosselFormatId,
            });
            if (!imgErr && dataUrl) {
              setSlides((cur) =>
                cur.map((c, j) =>
                  j === i ? { ...c, imagemFundo: dataUrl, ...BG_IMAGE_APPLY_DEFAULTS } : c
                )
              );
            }
          }
        }
      }
    } catch (e) {
      toast({
        title: 'Erro ao gerar slides',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingSlides(false);
    }
  }, [
    selectedLlmId,
    llmConnections,
    iaPrompt,
    carouselIaMode,
    carouselClientId,
    carouselClientProfile,
    carouselClientContexts,
    carouselSelectedContextId,
    carouselClientDetailLoading,
    slideCount,
    slides,
    identidade,
    toast,
    gerarImagensIa,
    selectedImageConnId,
    imageConnections,
    refImages.length,
    imgGenHumanPreference,
    imgGenSubjectFaceDataUrl,
    imgGenPanoramaContinuidade,
    imgGenGeminiQuality,
    carrosselFormatId,
    effectiveImageGenSettings,
    effectiveContentGenFromTemplate,
    template,
  ]);

  const handleMelhorar = useCallback(async () => {
    const connId = selectedLlmId || llmConnections[0]?.id;
    if (!connId || !improvePrompt.trim()) return;
    setIsImproving(true);
    try {
      const twitterMode = template === 'twitter';
      const { slides: gen, error } = twitterMode
        ? await carrosselLlmImproveSlidesJsonTwitter({
            supabase,
            connectionId: connId,
            improvePrompt,
            slides,
          })
        : await carrosselLlmImproveSlidesJson({
            supabase,
            connectionId: connId,
            improvePrompt,
            slides,
          });
      if (error) throw error;
      setSlides((prev) =>
        prev.map((s, i) => {
          const g = gen[i];
          if (!g) return s;
          if (twitterMode) {
            const lim = applyCarrosselTwitterIaTextLimits(g.titulo ?? s.titulo, g.subtitulo ?? s.subtitulo);
            const tituloTam = Number(g.tituloTamanho);
            const tituloTamanho =
              g.tituloTamanho != null &&
              g.tituloTamanho !== '' &&
              Number.isFinite(tituloTam) &&
              tituloTam > 0
                ? Math.min(52, Math.max(30, Math.round(tituloTam)))
                : s.tituloTamanho;
            return {
              ...s,
              titulo: lim.titulo,
              subtitulo: lim.subtitulo,
              tituloTamanho,
              subtituloTamanho: tituloTamanho,
            };
          }
          return {
            ...s,
            titulo: g.titulo ?? s.titulo,
            subtitulo: g.subtitulo ?? s.subtitulo,
          };
        })
      );
      toast({ title: 'Conteúdo melhorado' });
    } catch (e) {
      toast({ title: 'Erro ao melhorar', description: e?.message, variant: 'destructive' });
    } finally {
      setIsImproving(false);
    }
  }, [selectedLlmId, llmConnections, improvePrompt, slides, template, toast]);

  const handleRefinarSlide = useCallback(async () => {
    const connId = selectedLlmId || llmConnections[0]?.id;
    if (!connId || !refineIaPrompt.trim()) return;
    setIsRefiningSlide(true);
    try {
      const { titulo, subtitulo, error } = await carrosselLlmRefineOneSlide({
        supabase,
        connectionId: connId,
        instruction: refineIaPrompt,
        titulo: activeSlide.titulo,
        subtitulo: activeSlide.subtitulo,
      });
      if (error) throw error;
      if (template === 'twitter') {
        const lim = applyCarrosselTwitterIaTextLimits(titulo, subtitulo);
        updateActive('titulo', lim.titulo);
        updateActive('subtitulo', lim.subtitulo);
      } else {
        updateActive('titulo', titulo);
        updateActive('subtitulo', subtitulo);
      }
      toast({ title: 'Slide refinado' });
    } catch (e) {
      toast({ title: 'Erro ao refinar', description: e?.message, variant: 'destructive' });
    } finally {
      setIsRefiningSlide(false);
    }
  }, [selectedLlmId, llmConnections, refineIaPrompt, activeSlide, updateActive, toast, template]);

  const gerarTweetConteudoSlideIa = useCallback(async () => {
    const connId = selectedLlmId || llmConnections[0]?.id;
    if (!connId) {
      toast({ title: 'Configure uma conexão de texto', variant: 'destructive' });
      return;
    }
    setIsRefiningSlide(true);
    try {
      const { titulo, subtitulo, error } = await carrosselLlmRefineOneSlide({
        supabase,
        connectionId: connId,
        instruction:
          'Gere conteúdo para um post estilo X/Twitter em português brasileiro. O campo título é o corpo principal: a PRIMEIRA frase deve ser uma headline instigante com copywriting (gancho forte); seguem 2–4 frases que desenvolvem. O subtítulo é uma linha extra opcional no mesmo tom, sem hashtags e sem o carácter #.',
        titulo: activeSlide.titulo || '',
        subtitulo: activeSlide.subtitulo || '',
      });
      if (error) throw error;
      const lim = applyCarrosselTwitterIaTextLimits(titulo, subtitulo);
      updateActive('titulo', lim.titulo);
      updateActive('subtitulo', lim.subtitulo);
      toast({ title: 'Conteúdo sugerido para este slide' });
    } catch (e) {
      toast({ title: 'Erro ao gerar', description: e?.message, variant: 'destructive' });
    } finally {
      setIsRefiningSlide(false);
    }
  }, [selectedLlmId, llmConnections, activeSlide.titulo, activeSlide.subtitulo, updateActive, toast]);

  const applyTwitterThumbnailPreset = useCallback((presetKey) => {
    const patch = TW_THUMB_PRESETS[presetKey];
    if (!patch) return;
    setSlides((prev) =>
      prev.map((s, i) => {
        if (i !== activeSlideIndex) return s;
        if (presetKey === 'off') {
          return normalizeCarrosselImagemGrade({ ...s, ...patch });
        }
        return clearPanoramaMeta(normalizeCarrosselImagemGrade({ ...s, ...patch }));
      })
    );
  }, [activeSlideIndex]);

  const applyTwitterGradeAspecto = useCallback((aspecto) => {
    setSlides((prev) =>
      prev.map((s, i) =>
        i === activeSlideIndex
          ? normalizeCarrosselImagemGrade({
              ...s,
              imagemGradeAtiva: true,
              imagemGradeAspecto: aspecto,
            })
          : s
      )
    );
  }, [activeSlideIndex]);

  const applyTwitterImagePlacePreset = useCallback((layoutPosicao, imagemGradeAdaptarTexto) => {
    setSlides((prev) =>
      prev.map((s, i) =>
        i === activeSlideIndex
          ? normalizeCarrosselImagemGrade({
              ...s,
              layoutPosicao,
              imagemGradeAdaptarTexto,
              imagemGradeInicioFrac: null,
            })
          : s
      )
    );
  }, [activeSlideIndex]);

  const pasteBadgeFoto = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const url = await fileToDataUrl(blob);
            updateActive('badgeFotoUrl', url);
            return;
          }
        }
      }
      toast({ title: 'Nenhuma imagem na área de transferência' });
    } catch {
      toast({ title: 'Colar imagem falhou', variant: 'destructive' });
    }
  }, [updateActive, toast]);

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const trimTransparentPngDataUrl = useCallback((dataUrl) => {
    const src = String(dataUrl || '');
    if (!/^data:image\/png;base64,/i.test(src)) return Promise.resolve(src);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (!w || !h) {
            resolve(src);
            return;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(src);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const { data } = ctx.getImageData(0, 0, w, h);
          let minX = w;
          let minY = h;
          let maxX = -1;
          let maxY = -1;
          for (let y = 0; y < h; y += 1) {
            for (let x = 0; x < w; x += 1) {
              const alpha = data[(y * w + x) * 4 + 3];
              if (alpha > 8) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
              }
            }
          }
          if (maxX < minX || maxY < minY) {
            resolve(src);
            return;
          }
          const trimW = maxX - minX + 1;
          const trimH = maxY - minY + 1;
          if (trimW >= w && trimH >= h) {
            resolve(src);
            return;
          }
          const out = document.createElement('canvas');
          out.width = trimW;
          out.height = trimH;
          const outCtx = out.getContext('2d');
          if (!outCtx) {
            resolve(src);
            return;
          }
          outCtx.drawImage(canvas, minX, minY, trimW, trimH, 0, 0, trimW, trimH);
          resolve(out.toDataURL('image/png'));
        } catch {
          resolve(src);
        }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  }, []);

  const onUploadRefImages = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - refImages.length);
    const urls = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      urls.push(await fileToDataUrl(f));
    }
    setRefImages((prev) => [...prev, ...urls].slice(0, 5));
    e.target.value = '';
  };

  const pasteRefImage = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const url = await fileToDataUrl(blob);
            setRefImages((prev) => [...prev, url].slice(0, 5));
            return;
          }
        }
      }
      toast({ title: 'Nenhuma imagem na área de transferência' });
    } catch {
      toast({ title: 'Não foi possível colar', variant: 'destructive' });
    }
  };

  const onBgFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f?.type.startsWith('image/')) return;
    const url = await fileToDataUrl(f);
    setSlides((prev) => {
      const idx = activeSlideIndex;
      const g = prev[idx]?.imagemPanoramaGroupId;
      return prev.map((s, i) => {
        if (g && s.imagemPanoramaGroupId === g && i !== idx) {
          return clearPanoramaMeta(s);
        }
        if (i === idx) {
          return clearPanoramaMeta({ ...s, imagemFundo: url });
        }
        return s;
      });
    });
    e.target.value = '';
  };

  const pasteBgImage = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const url = await fileToDataUrl(blob);
            setSlides((prev) => {
              const idx = activeSlideIndex;
              const g = prev[idx]?.imagemPanoramaGroupId;
              return prev.map((s, i) => {
                if (g && s.imagemPanoramaGroupId === g && i !== idx) {
                  return clearPanoramaMeta(s);
                }
                if (i === idx) {
                  return clearPanoramaMeta({ ...s, imagemFundo: url });
                }
                return s;
              });
            });
            return;
          }
        }
      }
    } catch {
      toast({ title: 'Colar imagem falhou', variant: 'destructive' });
    }
  };

  const onGradeSlotFile = async (slotIndex, e) => {
    const f = e.target.files?.[0];
    if (!f?.type.startsWith('image/')) return;
    const url = await fileToDataUrl(f);
    setSlides((prev) =>
      prev.map((s, i) => {
        if (i !== activeSlideIndex) return s;
        const norm = normalizeCarrosselImagemGrade(s);
        const slots = norm.imagemGradeSlots.map((cell, j) =>
          j === slotIndex ? { ...cell, imagem: url } : cell
        );
        return clearPanoramaMeta({ ...s, imagemGradeSlots: slots });
      })
    );
    e.target.value = '';
  };

  const pasteGradeSlotImage = async (slotIndex) => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const url = await fileToDataUrl(blob);
            setSlides((prev) =>
              prev.map((s, i) => {
                if (i !== activeSlideIndex) return s;
                const norm = normalizeCarrosselImagemGrade(s);
                const slots = norm.imagemGradeSlots.map((cell, j) =>
                  j === slotIndex ? { ...cell, imagem: url } : cell
                );
                return clearPanoramaMeta({ ...s, imagemGradeSlots: slots });
              })
            );
            return;
          }
        }
      }
      toast({ title: 'Nenhuma imagem na área de transferência' });
    } catch {
      toast({ title: 'Colar imagem falhou', variant: 'destructive' });
    }
  };

  const onSubjectFaceFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f?.type.startsWith('image/')) return;
    if (f.size > MAX_SUBJECT_FACE_FILE_BYTES) {
      toast({ title: 'Imagem grande demais', description: 'Use uma foto até 4 MB.', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    const url = await fileToDataUrl(f);
    setImgGenSubjectFaceDataUrl(url);
    e.target.value = '';
  };

  const pasteSubjectFace = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            if (blob.size > MAX_SUBJECT_FACE_FILE_BYTES) {
              toast({ title: 'Imagem grande demais', description: 'Use uma foto até 4 MB.', variant: 'destructive' });
              return;
            }
            const url = await fileToDataUrl(blob);
            setImgGenSubjectFaceDataUrl(url);
            return;
          }
        }
      }
      toast({ title: 'Nenhuma imagem na área de transferência' });
    } catch {
      toast({ title: 'Não foi possível colar', variant: 'destructive' });
    }
  };

  const gerarImagemFundoIa = useCallback(async () => {
    const connIdText = selectedLlmId || llmConnections[0]?.id;
    if (!selectedImageConnId) {
      toast({ title: 'Escolha uma conexão de imagem', variant: 'destructive' });
      return;
    }
    if (!connIdText) {
      toast({ title: 'Configure uma conexão de texto em Minha IA', variant: 'destructive' });
      return;
    }
    const fullPromptBody = resolveCarouselContextForLlmImage();
    setGenBgTargetSlot(null);
    setIsGenBg(true);
    setGenBgStatusLabel('A estudar o prompt…');
    try {
      const eg = effectiveImageGenSettings;
      if (
        eg.imgGenHumanPreference !== 'visual' &&
        imgGenSubjectFaceDataUrl &&
        !subjectFaceMultimodalOk
      ) {
        toast({
          title: 'Foto do sujeito ignorada',
          description:
            'Só Gemini (Google) ou OpenRouter com modelo de saída imagem na mesma conexão. A gerar sem referência facial.',
        });
      }
      const coverManual = activeSlideIndex === 0;
      const paletteBlockManual = coverManual
        ? buildCarrosselPaletteBlockForImage({ agentePaleta: null, slide: activeSlide, identidade })
        : '';
      const { imagePrompt: llmImagePrompt } = await carrosselBuildSingleSlideImagePromptWithLlm({
        supabase,
        connectionId: connIdText,
        fullPromptBody,
        iaPrompt,
        slides,
        activeSlideIndex,
        titulo: activeSlide.titulo,
        subtitulo: activeSlide.subtitulo,
        imgGenPromptExtra: eg.imgGenPromptExtra,
        humanPreference: eg.imgGenHumanPreference,
        paletteBlock: paletteBlockManual,
        coverMode: coverManual,
      });
      const p =
        llmImagePrompt && String(llmImagePrompt).trim().length >= 32
          ? String(llmImagePrompt).trim()
          : manualCarrosselImagePromptForFormat({
              formatId: eg.carrosselFormatId,
              titulo: activeSlide.titulo,
              subtitulo: activeSlide.subtitulo,
              humanPreference: eg.imgGenHumanPreference,
            });
      setGenBgStatusLabel('A gerar a imagem…');
      const subjectFaceForApi =
        eg.imgGenHumanPreference !== 'visual' && imgGenSubjectFaceDataUrl && subjectFaceMultimodalOk
          ? imgGenSubjectFaceDataUrl
          : null;
      const { dataUrl, error } = await carrosselGenerateBackgroundImage({
        supabase,
        connectionId: selectedImageConnId,
        prompt: p,
        humanPreference: eg.imgGenHumanPreference,
        subjectFaceDataUrl: subjectFaceForApi,
        geminiImageSize: eg.imgGenGeminiQuality,
        canvasFormat: eg.carrosselFormatId,
      });
      if (error) throw error;
      setSlides((prev) => {
        const idx = activeSlideIndex;
        const g = prev[idx]?.imagemPanoramaGroupId;
        return prev.map((s, i) => {
          if (g && s.imagemPanoramaGroupId === g && i !== idx) {
            return clearPanoramaMeta(s);
          }
          if (i === idx) {
            return { ...s, imagemFundo: dataUrl, ...BG_IMAGE_APPLY_DEFAULTS };
          }
          return s;
        });
      });
      toast({ title: 'Imagem de fundo gerada' });
    } catch (e) {
      toast({ title: 'Erro na imagem', description: e?.message, variant: 'destructive' });
    } finally {
      setIsGenBg(false);
      setGenBgTargetSlot(null);
      setGenBgStatusLabel('');
    }
  }, [
    selectedImageConnId,
    selectedLlmId,
    llmConnections,
    resolveCarouselContextForLlmImage,
    iaPrompt,
    slides,
    activeSlideIndex,
    activeSlide,
    imgGenPromptExtra,
    imgGenHumanPreference,
    imgGenSubjectFaceDataUrl,
    subjectFaceMultimodalOk,
    imgGenGeminiQuality,
    carrosselFormatId,
    toast,
    effectiveImageGenSettings,
  ]);

  const gerarImagemGradeSlotIa = useCallback(
    async (slotIndex) => {
      const connIdText = selectedLlmId || llmConnections[0]?.id;
      if (!selectedImageConnId) {
        toast({ title: 'Escolha uma conexão de imagem', variant: 'destructive' });
        return;
      }
      if (!connIdText) {
        toast({ title: 'Configure uma conexão de texto em Minha IA', variant: 'destructive' });
        return;
      }
      const g = normalizeCarrosselImagemGrade(activeSlide);
      const layoutLab =
        g.imagemGradeLayout === '2h'
          ? 'dois painéis 16:9 lado a lado'
          : g.imagemGradeLayout === '2v'
            ? 'dois painéis verticais empilhados (proporção estreita)'
            : g.imagemGradeLayout === '4q'
              ? 'quatro miniaturas em grelha 2×2'
              : g.imagemGradeLayout === '3'
                ? 'três áreas (grande à esquerda, duas empilhadas à direita)'
                : g.imagemGradeLayout === '1' && g.imagemGradeAspecto === '1:1'
                  ? 'um painel quadrado central'
                  : 'um painel largo tipo miniatura 16:9';
      const fullPromptBody = resolveCarouselContextForLlmImage();
      setGenBgTargetSlot(slotIndex);
      setIsGenBg(true);
      setGenBgStatusLabel('A estudar o prompt…');
      try {
        const eg = effectiveImageGenSettings;
        if (
          eg.imgGenHumanPreference !== 'visual' &&
          imgGenSubjectFaceDataUrl &&
          !subjectFaceMultimodalOk
        ) {
          toast({
            title: 'Foto do sujeito ignorada',
            description:
              'Só Gemini (Google) ou OpenRouter com modelo de saída imagem na mesma conexão. A gerar sem referência facial.',
          });
        }
        const coverManual = activeSlideIndex === 0;
        const paletteBlockManual = coverManual
          ? buildCarrosselPaletteBlockForImage({ agentePaleta: null, slide: activeSlide, identidade })
          : '';
        const { imagePrompt: llmImagePrompt } = await carrosselBuildSingleSlideImagePromptWithLlm({
          supabase,
          connectionId: connIdText,
          fullPromptBody,
          iaPrompt,
          slides,
          activeSlideIndex,
          titulo: activeSlide.titulo,
          subtitulo: activeSlide.subtitulo,
          imgGenPromptExtra: eg.imgGenPromptExtra,
          humanPreference: eg.imgGenHumanPreference,
          paletteBlock: paletteBlockManual,
          coverMode: coverManual,
        });
        const basePrompt =
          llmImagePrompt && String(llmImagePrompt).trim().length >= 32
            ? String(llmImagePrompt).trim()
            : manualCarrosselImagePromptForFormat({
                formatId: eg.carrosselFormatId,
                titulo: activeSlide.titulo,
                subtitulo: activeSlide.subtitulo,
                humanPreference: eg.imgGenHumanPreference,
              });
        const p = `${basePrompt}\n\nRecorte visual para a célula ${slotIndex + 1} de uma grelha de imagens (${layoutLab}) no slide; resultado nítido, sem texto nem logotipos.`;
        setGenBgStatusLabel('A gerar a imagem…');
        const subjectFaceForApi =
          eg.imgGenHumanPreference !== 'visual' && imgGenSubjectFaceDataUrl && subjectFaceMultimodalOk
            ? imgGenSubjectFaceDataUrl
            : null;
        const { dataUrl, error } = await carrosselGenerateBackgroundImage({
          supabase,
          connectionId: selectedImageConnId,
          prompt: p,
          humanPreference: eg.imgGenHumanPreference,
          subjectFaceDataUrl: subjectFaceForApi,
          geminiImageSize: eg.imgGenGeminiQuality,
          canvasFormat: eg.carrosselFormatId,
        });
        if (error) throw error;
        setSlides((prev) =>
          prev.map((s, i) => {
            if (i !== activeSlideIndex) return s;
            const norm = normalizeCarrosselImagemGrade(s);
            const slots = norm.imagemGradeSlots.map((cell, j) =>
              j === slotIndex ? { ...cell, imagem: dataUrl } : cell
            );
            return clearPanoramaMeta({ ...s, imagemGradeSlots: slots });
          })
        );
        toast({ title: 'Imagem da grelha gerada' });
      } catch (e) {
        toast({ title: 'Erro na imagem', description: e?.message, variant: 'destructive' });
      } finally {
        setIsGenBg(false);
        setGenBgTargetSlot(null);
        setGenBgStatusLabel('');
      }
    },
    [
      selectedImageConnId,
      selectedLlmId,
      llmConnections,
      resolveCarouselContextForLlmImage,
      iaPrompt,
      slides,
      activeSlideIndex,
      activeSlide,
      imgGenSubjectFaceDataUrl,
      subjectFaceMultimodalOk,
      toast,
      effectiveImageGenSettings,
      identidade,
    ]
  );

  const handleEditCurrentArtWithIa = useCallback(async () => {
    const instruction = String(editArtInstruction || '').trim();
    if (!instruction) {
      toast({
        title: 'Descreva a alteração',
        description: 'Ex.: deixar mais dramático, trocar paleta para azul, fundo mais minimalista.',
        variant: 'destructive',
      });
      return;
    }
    if (!selectedImageConnId) {
      toast({ title: 'Escolha uma conexão de imagem', variant: 'destructive' });
      return;
    }
    if (!activeSlide?.imagemFundo) {
      toast({
        title: 'Sem arte para editar',
        description: 'Gere ou carregue uma imagem de fundo antes de usar “Editar arte”.',
        variant: 'destructive',
      });
      return;
    }
    if (!subjectFaceMultimodalOk) {
      toast({
        title: 'Editar arte requer conexão compatível',
        description: 'Use conexão Google (Gemini) ou OpenRouter com saída de imagem.',
        variant: 'destructive',
      });
      return;
    }

    setIsEditingArt(true);
    try {
      const eg = effectiveImageGenSettings;
      const prompt = `Você vai REEDITAR a arte já existente do slide, usando a imagem anexada como referência principal.

Alteração pedida pelo utilizador: "${instruction}".

Contexto do slide:
Título: "${activeSlide.titulo || ''}"
Texto: "${activeSlide.subtitulo || ''}"

Mantenha a base da composição, mas aplique a alteração pedida com resultado profissional, fotorealista e limpo.
Sem textos, sem logos, sem marcas d'água.`;

      const { dataUrl, error } = await carrosselGenerateBackgroundImage({
        supabase,
        connectionId: selectedImageConnId,
        prompt,
        humanPreference: eg.imgGenHumanPreference,
        referenceImageDataUrl: activeSlide.imagemFundo,
        geminiImageSize: eg.imgGenGeminiQuality,
        canvasFormat: eg.carrosselFormatId,
      });
      if (error) throw error;
      if (!dataUrl) throw new Error('A IA não devolveu imagem.');

      setSlides((prev) => {
        const idx = activeSlideIndex;
        const g = prev[idx]?.imagemPanoramaGroupId;
        return prev.map((s, i) => {
          if (g && s.imagemPanoramaGroupId === g && i !== idx) return clearPanoramaMeta(s);
          if (i === idx) return { ...s, imagemFundo: dataUrl, ...BG_IMAGE_APPLY_DEFAULTS };
          return s;
        });
      });
      setEditArtDialogOpen(false);
      setEditArtInstruction('');
      toast({ title: 'Arte reeditada', description: 'A imagem atual foi atualizada com a alteração pedida.' });
    } catch (e) {
      toast({ title: 'Erro ao reeditar arte', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setIsEditingArt(false);
    }
  }, [
    editArtInstruction,
    selectedImageConnId,
    activeSlide,
    subjectFaceMultimodalOk,
    effectiveImageGenSettings,
    activeSlideIndex,
    toast,
  ]);

  async function gerarPanoramaTodosSlides() {
    const connIdText = selectedLlmId || llmConnections[0]?.id;
    if (slides.length < 2) {
      toast({ title: 'Precisa de pelo menos 2 slides', variant: 'destructive' });
      return;
    }
    if (!selectedImageConnId) {
      toast({ title: 'Escolha uma conexão de imagem', variant: 'destructive' });
      return;
    }
    if (!connIdText) {
      toast({ title: 'Configure uma conexão de texto em Minha IA', variant: 'destructive' });
      return;
    }
    if (!subjectImagePanoramaOk) {
      toast({
        title: 'Panorama requer API compatível',
        description:
          'Selecione conexão Google (Gemini) ou OpenRouter com modelo de saída imagem na secção Imagem de fundo.',
        variant: 'destructive',
      });
      return;
    }
    const s0 = panoramaUiStart - 1;
    const e0 = panoramaUiEnd - 1;
    if (s0 < 0 || e0 >= slides.length || s0 > e0) {
      toast({ title: 'Intervalo de panorama inválido', variant: 'destructive' });
      return;
    }
    const sliceSlides = slides.slice(s0, e0 + 1);
    const n = sliceSlides.length;
    if (n < 2) {
      toast({
        title: 'Panorama precisa de 2+ slides',
        description: 'Ajuste “Do slide” e “Até o slide” para incluir pelo menos dois.',
        variant: 'destructive',
      });
      return;
    }
    const fullPromptBody = resolveCarouselContextForLlmImage();
    const eg = effectiveImageGenSettings;
    const paineis = sliceSlides
      .map((s, idx) => `Painel ${idx + 1} (esq.→dir.): ${s.titulo}. ${s.subtitulo}`)
      .join('\n');
    const manualPanoramaPrompt = `${manualPanoramaPromptForFormat({
      formatId: eg.carrosselFormatId,
      sliceCount: n,
      humanPreference: eg.imgGenHumanPreference,
      paineisBlock: paineis,
    })}${eg.imgGenPromptExtra.trim() ? `\n\nExtra: ${eg.imgGenPromptExtra.trim()}` : ''}`;

    setIsGenPanorama(true);
    setGenBgStatusLabel('Panorama: a estudar o prompt…');
    try {
      const { imagePrompt: llmPan } = await carrosselBuildPanoramaImagePromptWithLlm({
        supabase,
        connectionId: connIdText,
        fullPromptBody,
        slides: sliceSlides,
        humanPreference: eg.imgGenHumanPreference,
      });
      const p =
        llmPan && String(llmPan).trim().length >= 32
          ? `${String(llmPan).trim()}${eg.imgGenPromptExtra.trim() ? `\n\n${eg.imgGenPromptExtra.trim()}` : ''}`
          : manualPanoramaPrompt;
      setGenBgStatusLabel('Panorama: a gerar imagem…');
      const subjectFaceForApi =
        eg.imgGenHumanPreference !== 'visual' && imgGenSubjectFaceDataUrl && subjectFaceMultimodalOk
          ? imgGenSubjectFaceDataUrl
          : null;
      const { dataUrl, error } = await carrosselGenerateBackgroundImage({
        supabase,
        connectionId: selectedImageConnId,
        prompt: p,
        humanPreference: eg.imgGenHumanPreference,
        subjectFaceDataUrl: subjectFaceForApi,
        panoramaSlideCount: n,
        geminiImageSize: eg.imgGenGeminiQuality,
        canvasFormat: eg.carrosselFormatId,
      });
      if (error) throw error;
      const gOld = slides[s0]?.imagemPanoramaGroupId;
      const gid = uuidv4();
      const originId = slides[s0].id;
      setSlides((prev) =>
        prev.map((c, j) => {
          if (j >= s0 && j <= e0) {
            return {
              ...c,
              imagemFundo: dataUrl,
              ...BG_IMAGE_APPLY_DEFAULTS,
              imagemPanoramaGroupId: gid,
              imagemPanoramaOriginSlideId: originId,
              imagemPanoramaSlices: n,
              imagemPanoramaIndex: j - s0,
            };
          }
          if (gOld && c.imagemPanoramaGroupId === gOld) {
            return clearPanoramaMeta(c);
          }
          return c;
        })
      );
      toast({
        title: 'Panorama aplicado',
        description: `Continuidade nos slides ${s0 + 1}–${e0 + 1}. Ajuste zoom/posição no slide ${s0 + 1} (origem).`,
      });
    } catch (e) {
      toast({ title: 'Erro no panorama', description: e?.message, variant: 'destructive' });
    } finally {
      setIsGenPanorama(false);
      setGenBgStatusLabel('');
    }
  }

  const baixarSlide = async (index) => {
    const slide = slides[index];
    if (!slide) return;
    setIsExporting(true);
    try {
      flushSync(() => {
        setExportSlideSnapshot(slide);
      });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const el = exportSlideRef.current;
      if (!el) {
        toast({
          title: 'Export falhou',
          description: 'Canvas de exportação indisponível.',
          variant: 'destructive',
        });
        return;
      }
      const canvas = await html2canvas(el, {
        scale: 1,
        useCORS: true,
        logging: false,
        backgroundColor: null,
        scrollX: 0,
        scrollY: 0,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `carrossel-slide-${index + 1}.png`;
      a.click();
    } catch (e) {
      toast({ title: 'Export falhou', description: e?.message, variant: 'destructive' });
    } finally {
      setExportSlideSnapshot(null);
      setIsExporting(false);
    }
  };

  const baixarTodos = async () => {
    for (let i = 0; i < slides.length; i++) {
      setActiveSlideIndex(i);
      await new Promise((r) => setTimeout(r, 350));
      await baixarSlide(i);
      await new Promise((r) => setTimeout(r, 200));
    }
  };

  const openSaveGalleryDialog = useCallback(async () => {
    if (!user?.id) {
      toast({ title: 'Inicie sessão para guardar na galeria', variant: 'destructive' });
      return;
    }
    if (editingGalleryEntryId) {
      try {
        const list = await fetchCarrosselGallerySaves(supabase, user.id);
        const existing = list.find((e) => String(e.id) === String(editingGalleryEntryId));
        setSaveGalleryName(existing?.name ? String(existing.name) : '');
      } catch {
        setSaveGalleryName('');
      }
    } else {
      setSaveGalleryName('');
    }
    setSaveGalleryDialogOpen(true);
  }, [user?.id, editingGalleryEntryId, toast]);

  const commitReplaceGalleryAtLimit = useCallback(async () => {
    if (!user?.id || !limitReplaceTargetId) return;
    const payload = buildCurrentGalleryPayload();
    const selected = limitReplaceCandidates.find((e) => String(e.id) === String(limitReplaceTargetId));
    const name = String(saveGalleryName || '').trim() || String(selected?.name || '').trim() || 'Carrossel';
    setIsSavingGallery(true);
    try {
      await updateCarrosselGallerySave(supabase, user.id, limitReplaceTargetId, { name, payload });
      notifyCarrosselGalleryUpdated();
      setEditingGalleryEntryId(limitReplaceTargetId);
      setSaveGalleryDialogOpen(false);
      setLimitReplaceDialogOpen(false);
      setSaveGalleryName('');
      lastSavedGallerySnapshotRef.current = JSON.stringify(payload);
      lastSavedGalleryNameRef.current = name;
      toast({
        title: 'Carrossel substituído',
        description: `${name} foi guardado no lugar do item selecionado.`,
      });
    } catch (e) {
      toast({
        title: 'Não foi possível substituir',
        description: e?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingGallery(false);
    }
  }, [user?.id, limitReplaceTargetId, buildCurrentGalleryPayload, limitReplaceCandidates, saveGalleryName, toast]);

  const commitSaveToGallery = useCallback(async () => {
    if (!user?.id) return;
    const name = String(saveGalleryName || '').trim();
    if (!name) {
      toast({
        title: 'Indique um nome',
        description: 'Ex.: Campanha Black Friday',
        variant: 'destructive',
      });
      return;
    }
    const payload = buildCurrentGalleryPayload();

    setIsSavingGallery(true);
    try {
      if (editingGalleryEntryId) {
        const current = await fetchCarrosselGallerySaves(supabase, user.id);
        const exists = current.some((e) => String(e.id) === String(editingGalleryEntryId));
        if (exists) {
          await updateCarrosselGallerySave(supabase, user.id, editingGalleryEntryId, { name, payload });
          notifyCarrosselGalleryUpdated();
          setSaveGalleryDialogOpen(false);
          setSaveGalleryName('');
          toast({
            title: 'Galeria atualizada',
            description: `${name} — alterações guardadas no servidor.`,
          });
          lastSavedGallerySnapshotRef.current = JSON.stringify(payload);
          lastSavedGalleryNameRef.current = name;
          return;
        }
        setEditingGalleryEntryId(null);
      }

      const count = await countCarrosselGallerySaves(supabase, user.id);
      if (count >= MAX_CARROSSEL_GALLERY_SAVES) {
        const list = await fetchCarrosselGallerySaves(supabase, user.id);
        if (list.length > 0) {
          setLimitReplaceCandidates(list);
          setLimitReplaceTargetId(String(list[0].id));
          setLimitReplaceDialogOpen(true);
        } else {
          toast({
            title: 'Limite da galeria',
            description: `Guarde no máximo ${MAX_CARROSSEL_GALLERY_SAVES} carrosséis na conta. Apague um na galeria para adicionar outro.`,
            variant: 'destructive',
          });
        }
        return;
      }

      const inserted = await insertCarrosselGallerySave(supabase, user.id, { name, payload });
      notifyCarrosselGalleryUpdated();
      setEditingGalleryEntryId(inserted.id);
      setSaveGalleryDialogOpen(false);
      setSaveGalleryName('');
      toast({
        title: 'Guardado na galeria',
        description: `${name} — na sua conta (servidor).`,
      });
      lastSavedGallerySnapshotRef.current = JSON.stringify(payload);
      lastSavedGalleryNameRef.current = name;
    } catch (e) {
      const msg = e?.message || String(e);
      toast({
        title: 'Não foi possível guardar',
        description:
          msg.includes('neurodesign_carousel_saves') || msg.includes('relation')
            ? 'Tabela da galeria em falta no servidor. Execute a migração Supabase (neurodesign_carousel_saves) na VPS.'
            : msg,
        variant: 'destructive',
      });
    } finally {
      setIsSavingGallery(false);
    }
  }, [
    user?.id,
    saveGalleryName,
    editingGalleryEntryId,
    buildCurrentGalleryPayload,
    toast,
  ]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const id = window.setInterval(() => {
      if (isSavingGallery) return;
      if (currentGallerySnapshot === lastSavedGallerySnapshotRef.current) return;
      if (editingGalleryEntryId) {
        const fallbackName = lastSavedGalleryNameRef.current || 'Carrossel';
        const payload = buildCurrentGalleryPayload();
        void (async () => {
          try {
            await updateCarrosselGallerySave(supabase, user.id, editingGalleryEntryId, {
              name: fallbackName,
              payload,
            });
            notifyCarrosselGalleryUpdated();
            lastSavedGallerySnapshotRef.current = JSON.stringify(payload);
            toast({
              title: 'Auto-salvo',
              description: 'Alterações guardadas automaticamente.',
            });
          } catch (e) {
            toast({
              title: 'Auto-salvar falhou',
              description: e?.message || 'Tente salvar manualmente.',
              variant: 'destructive',
            });
          }
        })();
        return;
      }
      toast({
        title: 'Arte ainda não foi salva',
        description: 'Quer salvar agora?',
        action: (
          <ToastAction
            altText="Salvar arte"
            onClick={() => {
              setSaveGalleryName((prev) => prev || `Carrossel ${new Date().toLocaleString('pt-BR')}`);
              setSaveGalleryDialogOpen(true);
            }}
          >
            Salvar
          </ToastAction>
        ),
      });
    }, CARROSSEL_AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [
    user?.id,
    isSavingGallery,
    currentGallerySnapshot,
    editingGalleryEntryId,
    buildCurrentGalleryPayload,
    toast,
  ]);

  const openSaveStyleTemplateDialog = useCallback(() => {
    if (!user?.id) {
      toast({ title: 'Inicie sessão para guardar templates', variant: 'destructive' });
      return;
    }
    setSaveStyleTemplateName('');
    setSaveStyleTemplateDialogOpen(true);
  }, [user?.id, toast]);

  const commitSaveStyleTemplate = useCallback(() => {
    if (!user?.id) return;
    const name = String(saveStyleTemplateName || '').trim();
    if (!name) {
      toast({
        title: 'Indique um nome',
        description: 'Ex.: Feed escuro 4K',
        variant: 'destructive',
      });
      return;
    }
    const current = readCarrosselStyleTemplates(user.id);
    if (current.length >= MAX_CARROSSEL_STYLE_TEMPLATES) {
      toast({
        title: 'Limite de templates',
        description: `Guarde no máximo ${MAX_CARROSSEL_STYLE_TEMPLATES} templates. Apague um na lista (Imagem de fundo) para adicionar outro.`,
        variant: 'destructive',
      });
      return;
    }
    const settings = buildCarrosselStyleTemplateSnapshot({
      slideCount,
      carrosselFormatId,
      template,
      darkMode,
      identidade,
      slides,
      activeSlideIndex,
      openSections,
      gerarImagensIa,
      imgGenPanoramaContinuidade,
      imgGenGeminiQuality,
      imgGenPromptExtra,
      imgGenHumanPreference,
      previewMode,
      scale,
    });
    const entry = {
      id: uuidv4(),
      name,
      savedAt: new Date().toISOString(),
      settings,
    };
    const next = [entry, ...current].sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
    writeCarrosselStyleTemplates(user.id, next);
    setStyleTemplatesList(next);
    setSaveStyleTemplateDialogOpen(false);
    setSaveStyleTemplateName('');
    toast({
      title: 'Template guardado',
      description: `${name} — escolha-o na lista “Escolha o seu template”. Imagens base64 não são guardadas.`,
    });
  }, [
    user?.id,
    saveStyleTemplateName,
    slideCount,
    carrosselFormatId,
    template,
    darkMode,
    identidade,
    slides,
    activeSlideIndex,
    openSections,
    gerarImagensIa,
    imgGenPanoramaContinuidade,
    imgGenGeminiQuality,
    imgGenPromptExtra,
    imgGenHumanPreference,
    previewMode,
    scale,
    toast,
  ]);

  /** Ao escolher no select: aplica o slide N do template ao slide N atual (último template repete se tiver mais slides no editor). Só configuração; mantém títulos/cantos atuais; cor de destaque vem do template. */
  const applyTemplateVisualOnlyFromEntry = useCallback(
    (entry) => {
      const s = entry?.settings;
      if (!s || s.v !== 1 || !Array.isArray(s.slides) || !s.slides.length) {
        toast({ title: 'Template inválido', variant: 'destructive' });
        return;
      }
      const tmpl = s.slides;
      carrosselUndoApplyingRef.current = true;
      carrosselUndoPastRef.current = [];
      carrosselUndoFutureRef.current = [];
      carrosselUndoPrevSerializedRef.current = null;
      if (s.carrosselFormatId && CARROSSEL_CANVAS_FORMAT[s.carrosselFormatId]) {
        setCarrosselFormatId(s.carrosselFormatId);
      }
      setTemplate(s.template || 'minimalista');
      setDarkMode(Boolean(s.darkMode));
      setIdentidade({
        corFundo: s.identidade?.corFundo ?? CARROSSEL_IDENTIDADE_ABERTURA.corFundo,
        corTitulo: s.identidade?.corTitulo ?? CARROSSEL_IDENTIDADE_ABERTURA.corTitulo,
        corSubtitulo: s.identidade?.corSubtitulo ?? CARROSSEL_IDENTIDADE_ABERTURA.corSubtitulo,
      });
      setOpenSections((prev) => ({ ...prev, ...s.openSections }));
      setGerarImagensIa(Boolean(s.gerarImagensIa));
      setImgGenPanoramaContinuidade(Boolean(s.imgGenPanoramaContinuidade));
      setImgGenGeminiQuality(normalizeCarrosselGeminiImageSize(s.imgGenGeminiQuality || '2K'));
      setImgGenPromptExtra(s.imgGenPromptExtra != null ? String(s.imgGenPromptExtra) : '');
      setImgGenHumanPreference(
        ['auto', 'people', 'visual'].includes(s.imgGenHumanPreference) ? s.imgGenHumanPreference : 'auto'
      );
      setPreviewMode(s.previewMode === 'strip' ? 'strip' : 'single');
      if (typeof s.scale === 'number' && s.scale > 0) setScale(s.scale);
      setSlides((prev) =>
        prev.length
          ? prev.map((sl, i) => slideWithTemplateVisual(sl, tmpl[Math.min(i, tmpl.length - 1)]))
          : [slideWithTemplateVisual(defaultSlide(0), tmpl[0])]
      );
      setCarrosselUndoRevision((r) => r + 1);
    },
    [toast]
  );

  const removeStyleTemplate = useCallback(
    (id) => {
      if (!user?.id) return;
      const next = readCarrosselStyleTemplates(user.id).filter((x) => x.id !== id);
      writeCarrosselStyleTemplates(user.id, next);
      setStyleTemplatesList(next);
      if (String(imageGenTemplateId) === String(id)) setImageGenTemplateId('');
      toast({ title: 'Template removido' });
    },
    [user?.id, imageGenTemplateId, toast]
  );

  const applyCarrosselPayload = useCallback((p, descriptionForToast) => {
    if (!p || !Array.isArray(p.slides) || p.slides.length === 0) return false;
    carrosselUndoApplyingRef.current = true;
    carrosselUndoPastRef.current = [];
    carrosselUndoFutureRef.current = [];
    carrosselUndoPrevSerializedRef.current = null;
    templateWorkspacesRef.current = { minimalista: null, twitter: null };
    setSlides(JSON.parse(JSON.stringify(p.slides)));
    const maxI = Math.max(0, p.slides.length - 1);
    setActiveSlideIndex(Math.min(Math.max(0, Number(p.activeSlideIndex) || 0), maxI));
    if (p.identidade && typeof p.identidade === 'object') {
      setIdentidade({ ...p.identidade });
    }
    if (p.template) setTemplate(p.template);
    if (typeof p.darkMode === 'boolean') setDarkMode(p.darkMode);
    if (p.carrosselFormat && CARROSSEL_CANVAS_FORMAT[p.carrosselFormat]) {
      setCarrosselFormatId(p.carrosselFormat);
    }
    setCarrosselUndoRevision((r) => r + 1);
    if (descriptionForToast) {
      toast({ title: 'Carrossel aberto', description: descriptionForToast });
    }
    return true;
  }, [toast]);

  useEffect(() => {
    if (neuroTabSlug !== 'carrossel' || !user?.id) return;
    try {
      const raw = sessionStorage.getItem(NEURODESIGN_CARROSSEL_OPEN_SESSION_KEY);
      if (!raw) return;
      sessionStorage.removeItem(NEURODESIGN_CARROSSEL_OPEN_SESSION_KEY);
      const data = JSON.parse(raw);
      const p = data?.payload ?? data;
      const openName = typeof data?.name === 'string' && data.name ? data.name : undefined;
      const gid = data?.galleryEntryId;
      applyCarrosselPayload(p, openName);
      if (typeof gid === 'string' && gid.length > 0) {
        setEditingGalleryEntryId(gid);
      } else {
        setEditingGalleryEntryId(null);
      }
    } catch {
      /* ignore */
    }
  }, [neuroTabSlug, user?.id, applyCarrosselPayload]);

  const gerarLegenda = useCallback(() => {
    toast({ title: 'Legenda', description: 'Em breve.' });
  }, [toast]);

  const titleWords = useMemo(() => {
    return String(activeSlide.titulo || '')
      .split(/\s+/)
      .map((w) => w.replace(/[.,!?;:]+$/g, ''))
      .filter(Boolean);
  }, [activeSlide.titulo]);

  const toggleDestaque = (w) => {
    const low = w.toLowerCase();
    const cur = activeSlide.palavrasDestacadas || [];
    const has = cur.some((x) => String(x).toLowerCase() === low);
    updateActive(
      'palavrasDestacadas',
      has ? cur.filter((x) => String(x).toLowerCase() !== low) : [...cur, w]
    );
  };

  const canCarrosselUndo = carrosselUndoRevision >= 0 && carrosselUndoPastRef.current.length > 0;
  const canCarrosselRedo = carrosselUndoRevision >= 0 && carrosselUndoFutureRef.current.length > 0;

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex h-12 min-h-12 shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-background px-3">
        {typeof onOpenNavigation === 'function' ? (
          <>
            <button
              type="button"
              onClick={onOpenNavigation}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-foreground hover:bg-muted"
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Navegação
            </button>
            <div className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />
          </>
        ) : null}
        <button
          type="button"
          onClick={() => navigate(neurodesignGalleryCarrosseisUrl())}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-muted"
        >
          <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Minha galeria
        </button>
        <button
          type="button"
          onClick={() => setAgenteOpen(true)}
          title="Agente automático"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
        >
          <Bot className="h-3.5 w-3.5" />
          Agente
        </button>
        <div className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />
        <button
          type="button"
          disabled={activeSlideIndex === 0}
          className="rounded p-1 hover:bg-muted disabled:opacity-30"
          onClick={() => setActiveSlideIndex((i) => Math.max(0, i - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          Slide {activeSlideIndex + 1} de {slides.length}
        </span>
        <button
          type="button"
          disabled={activeSlideIndex >= slides.length - 1}
          className="rounded p-1 hover:bg-muted disabled:opacity-30"
          onClick={() => setActiveSlideIndex((i) => Math.min(slides.length - 1, i + 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" className="rounded p-1 hover:bg-muted" onClick={addSlide}>
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={slides.length <= 1}
          className="rounded p-1 text-destructive hover:bg-muted disabled:opacity-30"
          onClick={() => removeSlide(activeSlideIndex)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Histórico de alterações">
          <button
            type="button"
            title="Desfazer (Ctrl+Z)"
            disabled={!canCarrosselUndo}
            onClick={handleCarrosselUndo}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
          >
            <Undo2 className="h-4 w-4" aria-hidden />
            <span className="sr-only">Desfazer</span>
          </button>
          <button
            type="button"
            title="Refazer (Ctrl+Shift+Z)"
            disabled={!canCarrosselRedo}
            onClick={handleCarrosselRedo}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
          >
            <Redo2 className="h-4 w-4" aria-hidden />
            <span className="sr-only">Refazer</span>
          </button>
        </div>
        <div className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />
        <div className="flex min-w-0 shrink-0 items-center gap-1.5" role="group" aria-label="Formato do canvas">
          <span className="whitespace-nowrap text-[10px] font-medium text-muted-foreground">Formato</span>
          <div className="flex items-center gap-1">
            {[
              { id: 'carousel', label: 'Carrossel', Icon: FormatShapeCarousel },
              { id: 'square', label: 'Quadrado', Icon: FormatShapeSquare },
              { id: 'stories', label: 'Stories', Icon: FormatShapeStories },
            ].map(({ id, label, Icon }) => {
              const active = carrosselFormatId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCarrosselFormatId(id)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors',
                    active
                      ? 'border-primary/45 bg-white text-neutral-950 shadow-sm ring-2 ring-primary/30 dark:bg-white dark:text-neutral-950'
                      : 'border-border/90 bg-background/80 text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <Icon active={active} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {llmConnections.length > 0 ? (
          <select
            className="ml-auto max-w-[160px] shrink-0 rounded border border-border bg-background px-2 py-1 text-[10px]"
            value={selectedLlmId || llmConnections[0]?.id || ''}
            onChange={(e) => onSelectLlmId?.(e.target.value)}
          >
            {llmConnections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="ml-auto text-[10px] text-destructive">Sem conexão texto</span>
        )}
      </header>

      <ResizablePanelGroup direction="horizontal" className="flex min-h-0 flex-1 overflow-hidden">
        <ResizablePanel defaultSize={30} minSize={16} maxSize={56} className="min-h-0 min-w-0">
          <div className="flex h-full min-h-0 flex-col border-r border-border bg-background">
            <div className="flex shrink-0 flex-col gap-2 border-b-2 border-border px-4 py-[11px] [color-scheme:dark]">
              <p className={C_LBL_GROUP}>Fundo do slide (global)</p>
              <div className="flex gap-[5px]">
                <button
                  type="button"
                  onClick={switchToMinimalistaWorkspace}
                  className={cn(
                    'flex-1 rounded-[7px] border py-[7px] text-[11px] font-bold uppercase tracking-[0.05em] transition-all',
                    template === 'minimalista'
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-transparent text-muted-foreground hover:border-muted-foreground'
                  )}
                >
                  Minimalista
                </button>
                <button
                  type="button"
                  onClick={switchToTwitterWorkspace}
                  className={cn(
                    'flex-1 rounded-[7px] border py-[7px] text-[11px] font-bold uppercase tracking-[0.05em] transition-all',
                    template === 'twitter'
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-transparent text-muted-foreground hover:border-muted-foreground'
                  )}
                >
                  M. Twitter
                </button>
              </div>
              <p className={cn(C_INFO, 'text-[9px] leading-snug')}>
                Minimalista e M. Twitter são dois rascunhos separados: ao mudar de modo, o texto e o layout do outro
                ficam guardados e não se misturam. Ao entrar no Twitter pela primeira vez, o corpo dos slides volta ao
                texto padrão (não leva a cópia do Minimalista).
              </p>
              {template === 'twitter' ? (
                <p className={cn(C_INFO, 'text-[9px] leading-snug opacity-90')}>
                  Referência M. Twitter: antes de gerar vê o cartão (cabeçalho + corpo com texto padrão + miniatura
                  16:9 vazia); depois de «Gerar com IA» o corpo passa a ser a copy gerada mantendo o mesmo cartão e a
                  miniatura por baixo.
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-[5px]">
                {[true, false].map((dark) => (
                  <button
                    key={String(dark)}
                    type="button"
                    onClick={() => applyDarkLight(dark)}
                    className={cn(
                      'rounded-[7px] border py-[7px] text-[11px] font-medium transition-all',
                      darkMode === dark
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-transparent text-muted-foreground hover:border-muted-foreground'
                    )}
                  >
                    {dark ? '🌙 Escuro' : '☀️ Claro'}
                  </button>
                ))}
              </div>
            </div>

            <div ref={carrosselConfigScrollRef} className="min-h-0 flex-1 overflow-y-auto [color-scheme:dark]">
          <Section
            title="Gerar com IA"
            icon={Sparkles}
            sectionId="ia"
            open={openSections.ia}
            onToggle={() => toggle('ia')}
          >
            <div className="space-y-1.5">
              <Label className={C_LBL_FIELD}>Fonte de contexto</Label>
              <select
                className={cn(C_FIELD, 'disabled:opacity-50')}
                value={carouselIaMode}
                onChange={(e) => setCarouselIaMode(e.target.value === 'with_client' ? 'with_client' : 'free_text')}
              >
                <option value="free_text">Apenas texto (tema livre)</option>
                <option value="with_client">Cliente — ficha + um contexto à escolha</option>
              </select>
              <p className={cn(C_INFO, 'leading-snug')}>
                {carouselIaMode === 'free_text'
                  ? 'Descreva o tema; a IA não usa dados de clientes.'
                  : 'Usa a ficha do cliente e um contexto que você escolher. O campo de texto abaixo é opcional para refinar o ângulo.'}
              </p>
              {template === 'twitter' ? (
                <p className={cn(C_INFO, 'leading-snug')}>
                  Modo X: cada corpo começa com uma headline instigante (copywriting), depois o desenvolvimento. Limite
                  de {CARROSSEL_TWITTER_IA_MAX_TITULO_CHARS} caracteres no corpo e {CARROSSEL_TWITTER_IA_MAX_SUBTITULO_CHARS}{' '}
                  na linha extra. Tamanho de texto sugerido após gerar: ~{CARROSSEL_TWITTER_IA_DEFAULT_TITULO_TAMANHO}px
                  (corpo e linha extra iguais no slide).
                </p>
              ) : null}
            </div>
            {carouselIaMode === 'with_client' ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className={C_LBL_FIELD}>Cliente</Label>
                  <Link to="/clientes" className="text-[10px] text-primary underline hover:text-primary/90">
                    Gerir clientes
                  </Link>
                </div>
                <select
                  className={cn(C_FIELD, 'disabled:opacity-50')}
                  value={carouselClientId}
                  onChange={(e) => setCarouselClientId(e.target.value)}
                  disabled={!user?.id || clientsList.length === 0}
                >
                  <option value="">{user?.id ? 'Selecione um cliente…' : 'Inicie sessão'}</option>
                  {clientsList.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                      {typeof c.contextCount === 'number' && c.contextCount > 0
                        ? ` (${c.contextCount} contexto${c.contextCount === 1 ? '' : 's'})`
                        : ''}
                    </option>
                  ))}
                </select>
                {carouselClientId ? (
                  <p className={cn(C_INFO, 'leading-snug')}>
                    {carouselClientDetailLoading
                      ? 'A carregar ficha e contextos…'
                      : carouselClientProfile
                        ? `Ficha carregada${carouselClientContexts.length ? ` · ${carouselClientContexts.length} contexto(s) disponível(is)` : ''}.`
                        : 'Não foi possível carregar a ficha (verifique permissões ou tente outro cliente).'}
                  </p>
                ) : null}
                {carouselClientId && !carouselClientDetailLoading && carouselClientProfile ? (
                  <div className="space-y-1.5">
                    <Label className={C_LBL_FIELD}>Contexto para a IA</Label>
                    {carouselClientContexts.length === 0 ? (
                      <p className="rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[10px] text-muted-foreground">
                        Este cliente não tem contextos cadastrados — só a ficha será enviada à IA. Adicione contextos em{' '}
                        <Link to="/clientes" className="text-primary underline">
                          Clientes
                        </Link>
                        .
                      </p>
                    ) : (
                      <>
                        <select
                          className={C_FIELD}
                          value={carouselSelectedContextId}
                          onChange={(e) => setCarouselSelectedContextId(e.target.value)}
                        >
                          <option value={CAROUSEL_CONTEXT_FICHA_ONLY}>
                            Apenas ficha cadastral (nicho, público, etc.)
                          </option>
                          {carouselClientContexts.map((ctx) => (
                            <option key={ctx.id} value={String(ctx.id)}>
                              {(ctx.name || 'Contexto sem nome').trim() || `Contexto #${ctx.id}`}
                            </option>
                          ))}
                        </select>
                        <p className={cn(C_INFO, 'leading-snug')}>
                          Só o bloco escolhido entra no prompt, junto com a ficha (quando existir).
                        </p>
                      </>
                    )}
                  </div>
                ) : null}
                {!user?.id ? (
                  <p className="text-[10px] text-destructive">Inicie sessão para listar clientes.</p>
                ) : clientsList.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground">
                    Nenhum cliente. Crie um em <Link to="/clientes" className="text-primary underline">Clientes</Link>.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-1">
              <Label className={C_LBL_FIELD}>
                {carouselIaMode === 'free_text' ? 'Tema do carrossel' : 'Tema ou instruções (opcional)'}
              </Label>
              <Textarea
                value={iaPrompt}
                onChange={(e) => setIaPrompt(e.target.value)}
                placeholder={
                  carouselIaMode === 'free_text'
                    ? 'Ex.: gestor de tráfego para clínicas, 5 erros comuns em anúncios…'
                    : 'Ex.: foco em black friday, tom mais urgente, mencionar consultoria gratuita…'
                }
                className={cn(C_FIELD, 'min-h-[72px]')}
              />
            </div>
            <div>
              <Label className={C_LBL_FIELD}>Imagens de referência (opcional, máx. 5)</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                <button type="button" className={C_BTN_SMALL} onClick={pasteRefImage}>
                  Colar
                </button>
                <label className={cn(C_BTN_SMALL, 'inline-flex cursor-pointer items-center justify-center')}>
                  Upload
                  <input type="file" accept="image/*" multiple className="hidden" onChange={onUploadRefImages} />
                </label>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {refImages.map((u, i) => (
                  <img key={i} src={u} alt="" className="h-10 w-10 rounded border object-cover" />
                ))}
              </div>
            </div>

            {styleTemplatesList.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-muted/25 p-3 dark:bg-muted/40">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                  <Label htmlFor="carrossel-gen-template-ia" className="text-[11px] font-medium text-muted-foreground">
                    Escolha o seu template
                  </Label>
                </div>
                <select
                  id="carrossel-gen-template-ia"
                  className={C_FIELD}
                  value={imageGenTemplateId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setImageGenTemplateId(v);
                    if (!v) return;
                    const ent = styleTemplatesList.find((x) => String(x.id) === String(v));
                    if (ent) applyTemplateVisualOnlyFromEntry(ent);
                  }}
                >
                  <option value="">— Nenhum —</option>
                  {styleTemplatesList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!imageGenTemplateId}
                  onClick={() => imageGenTemplateId && removeStyleTemplate(imageGenTemplateId)}
                  className={cn(
                    C_BTN_SMALL,
                    'w-full text-destructive border-destructive/45 hover:bg-destructive/10'
                  )}
                >
                  Eliminar template
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">Guarde um template no rodapé.</p>
            )}

            <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-muted p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Slides</span>
                <span className="font-mono text-[24px] font-bold leading-none text-foreground">{slideCount}</span>
              </div>
              <input
                type="range"
                min={1}
                max={15}
                step={1}
                value={slideCount}
                onChange={(e) => setSlideCount(Number(e.target.value))}
                className="w-full cursor-pointer accent-primary"
              />
              <div className="mt-1 flex flex-wrap gap-[3px]">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-[9px] w-[9px] rounded-[2px] transition-colors',
                      i < slideCount ? 'bg-primary' : 'bg-border'
                    )}
                  />
                ))}
              </div>
              {template === 'twitter' ? (
                <p className={cn(C_INFO, 'text-[9px] leading-snug')}>
                  Roteiro sugerido pela IA: 1º gancho (copywriting); miolo prático; com 4+ slides o 3º pede curtir/salvar
                  com naturalidade; o último convida a comentar (pergunta ou A/B). Ajusta-se ao número de slides.
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="gimg"
                checked={gerarImagensIa}
                onCheckedChange={(c) => setGerarImagensIa(Boolean(c))}
              />
              <Label htmlFor="gimg" className="text-xs">
                Gerar fundos com IA
              </Label>
            </div>
            {gerarImagensIa ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="panorama-lote"
                    checked={imgGenPanoramaContinuidade}
                    disabled={!subjectImagePanoramaOk}
                    onCheckedChange={(c) => setImgGenPanoramaContinuidade(Boolean(c))}
                  />
                  <div className="min-w-0">
                    <Label htmlFor="panorama-lote" className="text-xs cursor-pointer">
                      Imagem contínua (panorama)
                    </Label>
                    <p className="text-[9px] leading-snug text-muted-foreground">
                      Gera uma imagem larga 16:9 e reparte pelo carrossel (conexão Google/Gemini ou OpenRouter com
                      modelo de saída imagem).
                    </p>
                    {!subjectImagePanoramaOk ? (
                      <p className="text-[9px] text-amber-600 dark:text-amber-500">
                        Escolha Gemini ou OpenRouter (imagem) na conexão em “Imagem de fundo” para panorama no lote.
                      </p>
                    ) : null}
                  </div>
                </div>
                <p className="text-[9px] leading-snug text-muted-foreground">
                  Na secção Imagem de fundo, defina IA decide / com pessoas / só visual — a mesma opção aplica-se ao lote de
                  fundos.
                </p>
              </div>
            ) : null}
            <button
              type="button"
              disabled={isGeneratingSlides}
              onClick={handleGerarSlides}
              className={C_BTN_PRIMARY}
            >
              {isGeneratingSlides ? 'A gerar…' : `Gerar ${slideCount} slides`}
            </button>
            <div className="my-1 h-px bg-border opacity-60" />
            <div className="flex flex-col gap-2">
              <span className={C_LBL_GROUP}>Melhorar conteúdo atual</span>
              <Textarea
                value={improvePrompt}
                onChange={(e) => setImprovePrompt(e.target.value)}
                placeholder="Ex: títulos mais diretos"
                className={cn(C_FIELD, 'min-h-[56px]')}
              />
              <button
                type="button"
                disabled={isImproving}
                onClick={handleMelhorar}
                className={C_BTN_SECONDARY}
              >
                {isImproving ? '…' : 'Melhorar com IA'}
              </button>
            </div>
          </Section>

          <Section
            title="Identidade visual"
            icon={Palette}
            sectionId="identidade"
            open={openSections.identidade}
            onToggle={() => toggle('identidade')}
          >
            <div className="space-y-2">
              {['corFundo', 'corTitulo', 'corSubtitulo'].map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Label className={cn(C_LBL_FIELD, 'w-20 shrink-0 capitalize')}>{key.replace('cor', '')}</Label>
                  <input
                    type="color"
                    value={identidade[key]}
                    onChange={(e) => setIdentidade((s) => ({ ...s, [key]: e.target.value }))}
                    className="h-8 w-10 cursor-pointer rounded border border-border p-0"
                  />
                  <input
                    className={cn(C_FIELD, 'flex-1 font-mono')}
                    value={identidade[key]}
                    onChange={(e) => setIdentidade((s) => ({ ...s, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div
              className="rounded border p-2"
              style={{ background: identidade.corFundo, color: identidade.corTitulo }}
            >
              <p className="text-sm font-bold">Título de exemplo</p>
              <p className="text-xs opacity-90" style={{ color: identidade.corSubtitulo }}>
                Subtítulo de exemplo
              </p>
            </div>
            <button type="button" className={C_BTN_SECONDARY} onClick={aplicarIdentidadeTodos}>
              Aplicar em todos os slides
            </button>
          </Section>

          <div className="flex items-center gap-2 border-b-2 border-t-2 border-border bg-background px-4 py-[9px]">
            <div className="h-px flex-1 bg-border" />
            <div className="whitespace-nowrap rounded-full border border-primary/50 bg-primary px-[10px] py-[3px] text-[9px] font-bold uppercase tracking-[0.08em] text-primary-foreground shadow-sm">
              Slide {activeSlideIndex + 1}
            </div>
            <div className="h-px flex-1 bg-border" />
          </div>

          {template === 'minimalista' ? (
          <>
          <Section
            title="Imagem de fundo"
            icon={ImageIcon}
            sectionId="fundoImg"
            open={openSections.fundoImg}
            onToggle={() => toggle('fundoImg')}
          >
            <div className="space-y-4">
              <div className="rounded-xl border-2 border-primary/35 bg-card/90 p-3.5 shadow-sm ring-offset-background dark:border-primary/55 dark:bg-card dark:ring-1 dark:ring-primary/25">
                <div className="mb-3 flex items-center gap-2 border-b border-border/80 pb-2.5">
                  <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="text-xs font-semibold tracking-tight text-foreground">Gerar com IA</span>
                </div>
                <p className="mb-3 text-[11px] leading-relaxed text-foreground/80 dark:text-foreground/90">
                  <span className="text-muted-foreground dark:text-foreground/75">Texto (LLM)</span> no topo do painel ·{' '}
                  <span className="font-medium text-foreground">imagem</span> só nestes campos.
                </p>
                {imageConnections.length > 0 ? (
                  <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_5.75rem] sm:items-end sm:gap-5">
                    <div className="min-w-0 space-y-1.5">
                      <Label
                        htmlFor="carrossel-bg-img-conn"
                        className="text-[11px] font-medium text-foreground"
                      >
                        Conexão de imagem
                      </Label>
                      <select id="carrossel-bg-img-conn" className={C_FIELD} value={selectedImageConnId || ''} onChange={(e) => setSelectedImageConnId(e.target.value)}>
                        {imageConnections.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5 sm:min-w-[5.75rem]">
                      <Label
                        htmlFor="carrossel-gemini-q"
                        className="text-[11px] font-medium text-foreground"
                      >
                        Qualidade
                      </Label>
                      <select
                        id="carrossel-gemini-q"
                        className={C_FIELD}
                        value={imgGenGeminiQuality}
                        onChange={(e) => setImgGenGeminiQuality(e.target.value)}
                        title="1K–4K: Gemini (nativo) e OpenRouter (image_config). OpenAI DALL·E usa tamanho fixo."
                      >
                        <option value="1K">1K</option>
                        <option value="2K">2K</option>
                        <option value="4K">4K</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-amber-500/50 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-snug text-amber-950 dark:text-amber-100">
                    Sem conexão de imagem. Em{' '}
                    <Link to="/settings/ai" className="font-semibold underline underline-offset-2">
                      Configurações → Minha IA
                    </Link>{' '}
                    adicione um modelo com geração de imagem.
                  </p>
                )}

              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <ImagePlus className="h-4 w-4 shrink-0 text-foreground/60 dark:text-foreground/70" aria-hidden />
                  Imagem do computador
                </div>
                <div className="flex gap-2">
                  <label className="flex h-10 min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/50 dark:border-muted-foreground/35 dark:bg-muted/45">
                    <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Carregar ficheiro
                    <input type="file" accept="image/*" className="hidden" onChange={onBgFile} />
                  </label>
                  <button type="button" className={cn(C_BTN_SMALL, 'inline-flex h-10 min-h-10 items-center justify-center gap-2')} onClick={pasteBgImage}>
                    <Clipboard className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Colar
                  </button>
                </div>
              </div>

              <div className="h-px w-full bg-border" aria-hidden />

              <div className="space-y-2">
                <Label htmlFor="carrossel-bg-slide-copy" className="text-[11px] font-medium">
                  Texto do slide (contexto para a IA)
                </Label>
                <Textarea
                  id="carrossel-bg-slide-copy"
                  readOnly
                  value={`${activeSlide.titulo}\n${activeSlide.subtitulo}`}
                  className={cn(C_FIELD, 'min-h-[52px] resize-none opacity-90')}
                />
                <Label htmlFor="carrossel-bg-extra" className={C_LBL_FIELD}>
                  Instruções extra{' '}
                  <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Textarea
                  id="carrossel-bg-extra"
                  value={imgGenPromptExtra}
                  onChange={(e) => setImgGenPromptExtra(e.target.value)}
                  placeholder="Ex.: luz dourada, escritório minimalista…"
                  className={cn(C_FIELD, 'min-h-[44px]')}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-medium">Estilo da cena</Label>
                <div className="flex gap-1 rounded-lg border border-border bg-muted/25 p-1 dark:border-border/90 dark:bg-muted/55">
                  {[
                    ['auto', 'IA decide'],
                    ['people', 'Com pessoas'],
                    ['visual', 'Só cenário'],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      disabled={isGenBg}
                      onClick={() => setImgGenHumanPreference(val)}
                      className={cn(
                        'flex-1 rounded-md py-2 text-[10px] font-semibold transition-all',
                        imgGenHumanPreference === val
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  {imgGenHumanPreference === 'people' && 'Prioridade a figuras humanas quando couber no tema.'}
                  {imgGenHumanPreference === 'visual' && 'Sem pessoas: só objetos, espaços e natureza.'}
                  {imgGenHumanPreference === 'auto' && 'A IA equilibra pessoas e elementos visuais.'}
                </p>
              </div>

              {imgGenHumanPreference !== 'visual' ? (
                <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                  <Label className="text-[11px] font-medium">Rosto de referência</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Opcional · Gemini (Google) ou OpenRouter com modelo de saída imagem
                  </p>
                  {imgGenSubjectFaceDataUrl && !subjectFaceMultimodalOk ? (
                    <p className="text-[10px] text-amber-600 dark:text-amber-500">
                      Escolha conexão Google (Gemini) ou OpenRouter (imagem) acima para enviar esta foto no pedido.
                    </p>
                  ) : null}
                  {imgGenSubjectFaceDataUrl ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={imgGenSubjectFaceDataUrl}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-md border object-cover"
                      />
                      <button type="button" className={cn(C_BTN_SMALL, 'h-8 max-w-[6rem] shrink-0')} onClick={() => setImgGenSubjectFaceDataUrl(null)}>
                        Remover
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-border bg-background px-3 text-[10px] font-medium hover:bg-muted/50">
                        Carregar
                        <input
                          ref={subjectFaceInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={onSubjectFaceFile}
                        />
                      </label>
                      <button type="button" className={cn(C_BTN_SMALL, 'inline-flex h-8 items-center gap-1.5')} onClick={pasteSubjectFace}>
                        <Clipboard className="h-3 w-3" aria-hidden />
                        Colar
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                <p className="text-xs font-semibold">Panorama entre slides</p>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Uma imagem contínua. Ajuste zoom e posição no <span className="font-medium text-foreground">primeiro</span>{' '}
                  slide do intervalo.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">De</span>
                  <select className={cn(C_FIELD, 'h-8 py-0')} value={panoramaUiStart} onChange={(e) => setPanoramaUiStart(Number(e.target.value))}>
                    {slides.map((_, i) => (
                      <option key={i} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-muted-foreground">a</span>
                  <select className={cn(C_FIELD, 'h-8 py-0')} value={panoramaUiEnd} onChange={(e) => setPanoramaUiEnd(Number(e.target.value))}>
                    {slides.map((_, i) => (
                      <option key={i} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                  <button type="button" className={cn(C_BTN_SECONDARY, 'h-8 py-0 text-[11px]')} onClick={aplicarIntervaloContinuidade}>
                    Aplicar intervalo
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={
                    isGenBg ||
                    isGenPanorama ||
                    !selectedImageConnId ||
                    Boolean(activeSlideGrade.imagemGradeAtiva)
                  }
                  onClick={gerarImagemFundoIa}
                  title={
                    !selectedImageConnId
                      ? 'Selecione uma conexão de imagem no bloco “Gerar com IA”.'
                      : activeSlideGrade.imagemGradeAtiva
                        ? 'Desative a “Grade de imagens” para gerar fundo em ecrã inteiro.'
                        : undefined
                  }
                  className={cn(C_BTN_PRIMARY, 'inline-flex items-center justify-center gap-2')}
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {isGenBg && genBgTargetSlot == null
                    ? genBgStatusLabel || 'A gerar…'
                    : 'Gerar fundo — slide atual'}
                </button>
                <button
                  type="button"
                  disabled={
                    isGenBg ||
                    isGenPanorama ||
                    slides.length < 2 ||
                    !subjectImagePanoramaOk ||
                    Boolean(activeSlideGrade.imagemGradeAtiva)
                  }
                  onClick={gerarPanoramaTodosSlides}
                  title={
                    activeSlideGrade.imagemGradeAtiva
                      ? 'Desative a grade de imagens neste slide para usar panorama.'
                      : slides.length < 2
                        ? 'Precisa de pelo menos 2 slides.'
                        : !subjectImagePanoramaOk
                          ? 'Panorama: conexão Google (Gemini) ou OpenRouter com modelo de saída imagem.'
                          : 'Usa o intervalo definido em “Panorama entre slides”.'
                  }
                  className={C_BTN_SECONDARY}
                >
                  {isGenPanorama ? genBgStatusLabel || 'A gerar panorama…' : 'Gerar panorama no intervalo'}
                </button>
              </div>

              {isGenBg || isGenPanorama ? (
                <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
                  <p className="text-xs font-medium text-foreground">{genBgStatusLabel}</p>
                  {isGenPanorama ? (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Imagem larga 16:9 repartida pelos slides do intervalo.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {(Number(activeSlide.imagemPanoramaSlices) || 1) > 1 && !isPanoramaOrigin ? (
                <p className="text-[10px] text-amber-600 dark:text-amber-500">
                  Zoom e posição: use o slide de <span className="font-medium">origem</span> do panorama (primeiro do
                  intervalo).
                </p>
              ) : null}
              {(Number(activeSlide.imagemPanoramaSlices) || 1) > 1 ? (
                <CarrosselRangeRow
                  label="Vinheta nas bordas (panorama)"
                  value={Math.round(
                    Math.min(100, Math.max(0, Number(panoramaOriginSlide.imagemPanoramaVinheta) || 100))
                  )}
                  min={0}
                  max={100}
                  step={1}
                  disabled={(Number(activeSlide.imagemPanoramaSlices) || 1) > 1 && !isPanoramaOrigin}
                  onChange={(n) => updateActiveBgTransform('imagemPanoramaVinheta', n)}
                />
              ) : null}

              <div className="space-y-3 border-t border-border pt-3">
                <p className={C_LBL_GROUP}>Enquadrar no slide</p>
                <CarrosselRangeRow
                  label="Horizontal %"
                  value={panoramaOriginSlide.imagemPosX ?? BG_IMAGE_APPLY_DEFAULTS.imagemPosX}
                  min={0}
                  max={100}
                  step={1}
                  disabled={(Number(activeSlide.imagemPanoramaSlices) || 1) > 1 && !isPanoramaOrigin}
                  onChange={(n) => updateActiveBgTransform('imagemPosX', n)}
                />
                <CarrosselRangeRow
                  label="Vertical %"
                  value={panoramaOriginSlide.imagemPosY ?? BG_IMAGE_APPLY_DEFAULTS.imagemPosY}
                  min={0}
                  max={100}
                  step={1}
                  disabled={(Number(activeSlide.imagemPanoramaSlices) || 1) > 1 && !isPanoramaOrigin}
                  onChange={(n) => updateActiveBgTransform('imagemPosY', n)}
                />
                <CarrosselRangeRow
                  label="Zoom %"
                  value={panoramaOriginSlide.imagemZoom ?? BG_IMAGE_APPLY_DEFAULTS.imagemZoom}
                  min={100}
                  max={300}
                  step={1}
                  disabled={(Number(activeSlide.imagemPanoramaSlices) || 1) > 1 && !isPanoramaOrigin}
                  onChange={(n) => updateActiveBgTransform('imagemZoom', n)}
                />
              </div>
            </div>
          </Section>

          <Section
            title="Grade de imagens"
            icon={LayoutGrid}
            sectionId="gradeImg"
            open={openSections.gradeImg}
            onToggle={() => toggle('gradeImg')}
          >
            <div className="space-y-3">
              <p className="text-[10px] leading-snug text-muted-foreground">
                Várias imagens em grelha abaixo do texto. Enquanto activa, o fundo em ecrã inteiro e o panorama ficam
                ocultos/indisponíveis neste slide.
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                <Checkbox
                  id="carrossel-grade-ativa"
                  checked={activeSlideGrade.imagemGradeAtiva}
                  onCheckedChange={(c) => setImagemGradeAtivaSlide(c === true)}
                />
                <Label htmlFor="carrossel-grade-ativa" className="cursor-pointer text-[11px] font-medium leading-snug">
                  Mostrar grade
                </Label>
              </div>
              {activeSlideGrade.imagemGradeAtiva ? (
                <>
                  <div>
                    <p className={`${C_LBL_GROUP} mb-1.5`}>Layout</p>
                    <div className="flex gap-1 rounded-lg border border-border bg-muted/25 p-1 dark:border-border/90 dark:bg-muted/55">
                      {[
                        ['1', '1'],
                        ['2h', '2h'],
                        ['3', '3'],
                      ].map(([val]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() =>
                            setSlides((prev) =>
                              prev.map((sl, idx) =>
                                idx === activeSlideIndex
                                  ? normalizeCarrosselImagemGrade({ ...sl, imagemGradeLayout: val })
                                  : sl
                              )
                            )
                          }
                          className={cn(
                            'flex-1 rounded-md py-2 text-[10px] font-semibold transition-all',
                            activeSlideGrade.imagemGradeLayout === val
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                  {Array.from({
                    length: getCarrosselGradeSlotCount(activeSlideGrade.imagemGradeLayout),
                  }).map((_, slotIndex) => {
                    const cell = activeSlideGrade.imagemGradeSlots[slotIndex] || {};
                    return (
                      <div key={slotIndex} className="space-y-2 rounded-lg border border-border bg-card/40 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {twitterGradeSlotPanelTitle(
                            activeSlideGrade.imagemGradeLayout,
                            activeSlideGrade.imagemGradeAspecto,
                            slotIndex
                          )}
                        </p>
                        <div className="flex gap-2">
                          <label
                            className={cn(
                              C_BTN_SMALL,
                              'inline-flex h-9 min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5'
                            )}
                          >
                            <Upload className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="text-[10px]">Carregar</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => void onGradeSlotFile(slotIndex, e)}
                            />
                          </label>
                          <button
                            type="button"
                            className={cn(
                              C_BTN_SMALL,
                              'inline-flex h-9 min-h-9 flex-1 items-center justify-center gap-1.5'
                            )}
                            onClick={() => void pasteGradeSlotImage(slotIndex)}
                          >
                            <Clipboard className="h-3 w-3 shrink-0" aria-hidden />
                            Colar
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={isGenBg || !selectedImageConnId}
                          onClick={() => void gerarImagemGradeSlotIa(slotIndex)}
                          title={
                            !selectedImageConnId
                              ? 'Selecione uma conexão de imagem na secção “Imagem de fundo”.'
                              : undefined
                          }
                          className={cn(C_BTN_SECONDARY, 'inline-flex w-full items-center justify-center gap-2')}
                        >
                          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {isGenBg && genBgTargetSlot === slotIndex
                            ? genBgStatusLabel || 'A gerar…'
                            : 'Gerar imagem com IA'}
                        </button>
                        <CarrosselRangeRow
                          label={`IMG ${slotIndex + 1} horizontal %`}
                          value={Math.round(Number(cell.posX) || 50)}
                          min={0}
                          max={100}
                          step={1}
                          disabled={isGenBg}
                          onChange={(n) => updateActiveGradeSlot(slotIndex, { posX: n })}
                        />
                        <CarrosselRangeRow
                          label={`IMG ${slotIndex + 1} vertical %`}
                          value={Math.round(Number(cell.posY) || 50)}
                          min={0}
                          max={100}
                          step={1}
                          disabled={isGenBg}
                          onChange={(n) => updateActiveGradeSlot(slotIndex, { posY: n })}
                        />
                        <CarrosselRangeRow
                          label={`IMG ${slotIndex + 1} zoom %`}
                          value={Math.round(Number(cell.zoom) || 100)}
                          min={50}
                          max={300}
                          step={1}
                          disabled={isGenBg}
                          onChange={(n) => updateActiveGradeSlot(slotIndex, { zoom: n })}
                        />
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/15 px-3 py-2">
                    <Checkbox
                      id="carrossel-grade-adaptar"
                      checked={activeSlideGrade.imagemGradeAdaptarTexto}
                      onCheckedChange={(c) => {
                        const v = c === true;
                        setSlides((prev) =>
                          prev.map((s, i) =>
                            i === activeSlideIndex
                              ? normalizeCarrosselImagemGrade({
                                  ...s,
                                  imagemGradeAdaptarTexto: v,
                                  imagemGradeInicioFrac: null,
                                })
                              : s
                          )
                        );
                      }}
                    />
                    <Label htmlFor="carrossel-grade-adaptar" className="cursor-pointer text-[10px] font-medium leading-snug">
                      Adaptar posição ao texto (reserva mais espaço ao título)
                    </Label>
                  </div>
                  <CarrosselRangeRow
                    label="Arredondamento (px)"
                    value={activeSlideGrade.imagemGradeRaio}
                    min={0}
                    max={48}
                    step={1}
                    onChange={(n) => updateActive('imagemGradeRaio', n)}
                  />
                </>
              ) : null}
            </div>
          </Section>

          <Section
            title="Sombra / overlay"
            icon={Layers}
            sectionId="overlay"
            open={openSections.overlay}
            onToggle={() => toggle('overlay')}
          >
            <select className={C_FIELD} value={activeSlide.overlayEstilo} onChange={(e) => updateActive('overlayEstilo', e.target.value)}>
              <option value="nenhum">Nenhum</option>
              <option value="topo-suave">Topo suave</option>
              <option value="topo-intenso">Topo intenso</option>
              <option value="base-suave">Base suave</option>
              <option value="base-intenso">Base intenso</option>
              <option value="topo-base">Topo + base</option>
              <option value="vinheta">Vinheta</option>
              <option value="total">Total</option>
              <option value="lateral">Lateral</option>
            </select>
            <CarrosselRangeRow
              label="Opacidade"
              value={activeSlide.overlayOpacidade}
              min={0}
              max={100}
              onChange={(n) => updateActive('overlayOpacidade', n)}
            />
            <div className="flex items-center gap-2">
              <Label className="text-[10px]">Cor da sombra</Label>
              <input
                type="color"
                value={String(activeSlide.overlayCor || 'auto') === 'auto' ? '#000000' : String(activeSlide.overlayCor)}
                onChange={(e) => updateActive('overlayCor', e.target.value)}
                className="h-7 w-9 rounded border"
                title="Escolha manual da cor do overlay"
              />
              <button
                type="button"
                className={cn(C_BTN_SMALL, 'h-7 px-2 text-[10px]')}
                onClick={() => updateActive('overlayCor', 'auto')}
              >
                Auto
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              A posição da sombra (topo/base) agora é fixa conforme a opção escolhida, independente da posição do texto.
            </p>
          </Section>

          <Section
            title="Fundo do slide"
            icon={Square}
            sectionId="fundoSlide"
            open={openSections.fundoSlide}
            onToggle={() => toggle('fundoSlide')}
          >
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={activeSlide.corFundo}
                onChange={(e) => updateActive('corFundo', e.target.value)}
                className="h-8 w-10 rounded border"
              />
              <input
                className="flex-1 rounded border px-2 py-1 font-mono text-[10px]"
                value={activeSlide.corFundo}
                onChange={(e) => updateActive('corFundo', e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => updateActive('corFundo', identidade.corFundo)}
              className={C_BTN_SECONDARY}
            >
              Resetar cor (identidade)
            </button>
            <Label className="text-[10px]">Padrão sobre o fundo</Label>
            <div className="flex flex-wrap gap-1">
              {[
                ['nenhum', 'Nenhum'],
                ['grade', 'Grade'],
                ['bolinhas', 'Bolinhas'],
                ['linhas-horizontais', 'Linhas H'],
                ['linhas-diagonais', 'Diag.'],
                ['xadrez', 'Xadrez'],
              ].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => updateActive('padrao', v)}
                  className={cn(
                    'rounded border px-2 py-0.5 text-[9px]',
                    activeSlide.padrao === v ? 'border-primary bg-primary/15' : 'border-border'
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            <CarrosselRangeRow
              label="Tamanho padrão"
              value={activeSlide.padraoTamanho}
              min={40}
              max={240}
              onChange={(n) => updateActive('padraoTamanho', n)}
            />
            <CarrosselRangeRow
              label="Opacidade padrão"
              value={activeSlide.padraoOpacidade}
              min={0}
              max={100}
              onChange={(n) => updateActive('padraoOpacidade', n)}
            />
          </Section>

          <Section
            title="Título & subtítulo"
            icon={Type}
            sectionId="titulo"
            open={openSections.titulo}
            onToggle={() => toggle('titulo')}
          >
            <div className="flex items-center gap-2">
              <Checkbox
                id="layout-margens-todos"
                checked={applyLayoutMarginsToAllSlides}
                onCheckedChange={(c) => setApplyLayoutMarginsToAllSlides(Boolean(c))}
              />
              <Label htmlFor="layout-margens-todos" className="text-[10px]">
                Aplicar margem, layout e alinhamento a todos os slides
              </Label>
            </div>
            <CarrosselRangeRow
              label="Margem horizontal"
              value={activeSlide.margemHorizontal}
              min={40}
              max={280}
              onChange={(n) => updateActiveMaybeAll('margemHorizontal', n, applyLayoutMarginsToAllSlides)}
            />
            <CarrosselRangeRow
              label="Margem vertical"
              value={activeSlide.margemVertical}
              min={40}
              max={400}
              onChange={(n) => updateActiveMaybeAll('margemVertical', n, applyLayoutMarginsToAllSlides)}
            />
            <p className="text-[9px] leading-snug text-muted-foreground">
              Horizontal: coluna esquerda puxa sobretudo pela direita; direita pela esquerda; centro pelos
              dois lados — sempre com um respiro mínimo ao bordo do slide. Vertical: simétrica, também com
              respiro mínimo.
            </p>
            <Label className="text-[10px]">Presets de margem</Label>
            <div className="flex flex-wrap gap-1">
              {CARROSSEL_MARGIN_PRESETS.map((pr) => (
                <button
                  key={pr.id}
                  type="button"
                  title={`${pr.mh}px × ${pr.mv}px`}
                  onClick={() => {
                    updateActiveMaybeAll('margemHorizontal', pr.mh, applyLayoutMarginsToAllSlides);
                    updateActiveMaybeAll('margemVertical', pr.mv, applyLayoutMarginsToAllSlides);
                  }}
                  className={cn(
                    'rounded border px-2 py-1 text-[9px] font-medium transition-colors',
                    activeSlide.margemHorizontal === pr.mh && activeSlide.margemVertical === pr.mv
                      ? 'border-primary bg-primary/20'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  {pr.label}
                </button>
              ))}
            </div>
            <Label className="text-[10px]">Layout</Label>
            <p className="text-[9px] leading-snug text-muted-foreground">
              Miniatura do slide: o retângulo mostra onde fica o bloco de título.
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {LAYOUT_KEYS.map((k) => {
                const selected = activeSlide.layoutPosicao === k;
                const label = LAYOUT_GRID_LABELS[k] || k;
                return (
                  <button
                    key={k}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={() => updateActiveMaybeAll('layoutPosicao', k, applyLayoutMarginsToAllSlides)}
                    className={cn(
                      'group relative flex w-full rounded-md border p-1 transition-colors',
                      'aspect-[4/5] max-h-[58px] min-h-[48px]',
                      selected
                        ? 'border-primary bg-primary/12 ring-1 ring-primary/30'
                        : 'border-border bg-card/40 hover:border-muted-foreground/35 hover:bg-muted/35'
                    )}
                  >
                    <span className="sr-only">{label}</span>
                    <div className="relative min-h-0 flex-1 overflow-hidden rounded-[4px] bg-gradient-to-b from-background/95 to-muted/80 ring-1 ring-inset ring-border/70">
                      <div
                        aria-hidden
                        className={cn(
                          'pointer-events-none absolute rounded-[3px] border-2 transition-colors',
                          LAYOUT_GRID_PREVIEW_BLOCK[k],
                          selected
                            ? 'border-primary bg-primary/50 shadow-sm shadow-primary/20'
                            : 'border-foreground/20 bg-foreground/12 group-hover:border-foreground/30 group-hover:bg-foreground/16'
                        )}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            <Label className="text-[10px]">Alinhamento</Label>
            <div className="flex gap-1">
              {[
                ['esq', 'Esq'],
                ['centro', 'Centro'],
                ['dir', 'Dir'],
              ].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => updateActiveMaybeAll('alinhamento', v, applyLayoutMarginsToAllSlides)}
                  className={cn(
                    'flex-1 rounded border py-1 text-[10px]',
                    activeSlide.alinhamento === v ? 'border-primary bg-primary/20' : 'border-border'
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="glass"
                  checked={activeSlide.glass}
                  onCheckedChange={(c) => updateActive('glass', Boolean(c))}
                />
                <Label htmlFor="glass" className="text-xs font-medium">
                  Glass no conteúdo
                </Label>
              </div>
              {activeSlide.glass ? (
                <div className="space-y-2 border-t border-border pt-2 pl-1">
                  <Label className="text-[10px]">Aplicar glass a</Label>
                  <div className="flex flex-wrap gap-1">
                    {[
                      ['ambos', 'Título e subtítulo'],
                      ['titulo', 'Só título'],
                      ['subtitulo', 'Só subtítulo'],
                    ].map(([v, label]) => {
                      const cur =
                        activeSlide.glassAlvo === 'titulo' || activeSlide.glassAlvo === 'subtitulo'
                          ? activeSlide.glassAlvo
                          : 'ambos';
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => updateActive('glassAlvo', v)}
                          className={cn(
                            'rounded border px-2 py-1 text-[9px] font-medium transition-colors',
                            cur === v ? 'border-primary bg-primary/20' : 'border-border hover:bg-muted/50'
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[9px] leading-snug text-muted-foreground">
                    O desfoque e o fundo semitransparente aplicam-se só ao bloco escolhido (título, subtítulo ou
                    ambos), mantendo o resto do slide legível para o hook no feed.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className={C_BTN_SMALL}
                      onClick={() => updateActive('glassCor', activeSlide.corFundo || '#0a0a0a')}
                    >
                      Glass = cor do fundo
                    </button>
                    <button
                      type="button"
                      className={C_BTN_SMALL}
                      onClick={() => updateActive('glassCor', activeSlide.corDestaque || '#FFD700')}
                    >
                      Glass = destaque
                    </button>
                  </div>
                  <CarrosselRangeRow
                    label="Arredondamento (px)"
                    value={Number(activeSlide.glassBorderRadius) || 16}
                    min={0}
                    max={64}
                    step={1}
                    onChange={(n) => updateActive('glassBorderRadius', n)}
                  />
                  <CarrosselRangeRow
                    label="Margem interna (px)"
                    value={Number(activeSlide.glassPadding) || 16}
                    min={0}
                    max={96}
                    step={1}
                    onChange={(n) => updateActive('glassPadding', n)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className={cn(C_LBL_FIELD, 'shrink-0')}>Cor</Label>
                    <input
                      type="color"
                      aria-label="Cor do glass"
                      value={/^#[0-9A-Fa-f]{6}$/.test(String(activeSlide.glassCor || '')) ? activeSlide.glassCor : '#0a0a0a'}
                      onChange={(e) => updateActive('glassCor', e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded border border-border p-0"
                    />
                    <input
                      className={cn(C_FIELD, 'min-w-[6rem] max-w-[8rem] flex-1 font-mono text-[10px]')}
                      value={activeSlide.glassCor || '#0a0a0a'}
                      onChange={(e) => updateActive('glassCor', e.target.value)}
                      maxLength={7}
                    />
                  </div>
                  <CarrosselRangeRow
                    label="Opacidade do fundo %"
                    value={Number(activeSlide.glassOpacidade) || 25}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(n) => updateActive('glassOpacidade', n)}
                  />
                  <CarrosselRangeRow
                    label="Desfoque (blur px)"
                    value={Number(activeSlide.glassBlur) || 12}
                    min={0}
                    max={40}
                    step={1}
                    onChange={(n) => updateActive('glassBlur', n)}
                  />
                </div>
              ) : null}
            </div>
            <Label className={C_LBL_FIELD}>Título</Label>
            <input
              className={C_FIELD}
              value={activeSlide.titulo}
              onChange={(e) => updateActive('titulo', e.target.value)}
            />
            <Label className={C_LBL_FIELD}>Subtítulo</Label>
            <Textarea
              value={activeSlide.subtitulo}
              onChange={(e) => updateActive('subtitulo', e.target.value)}
              className={cn(C_FIELD, 'min-h-[56px]')}
            />
            <Label className={C_LBL_FIELD}>Refinar este slide</Label>
            <Textarea
              value={refineIaPrompt}
              onChange={(e) => setRefineIaPrompt(e.target.value)}
              placeholder="Ex: mais agressivo, encurtar subtítulo"
              className={cn(C_FIELD, 'min-h-[48px]')}
            />
            <button
              type="button"
              disabled={isRefiningSlide}
              onClick={handleRefinarSlide}
              className={C_BTN_SECONDARY}
            >
              {isRefiningSlide ? '…' : 'Refinar com IA'}
            </button>

            <CarrosselRangeRow
              label="Escala título %"
              value={activeSlide.tituloEscala ?? 70}
              min={50}
              max={200}
              onChange={(n) => updateActive('tituloEscala', n)}
            />
            <CarrosselRangeRow
              label="Título (px)"
              value={activeSlide.tituloTamanho}
              min={32}
              max={140}
              onChange={(n) => updateActive('tituloTamanho', n)}
            />
            <Label className="text-[10px]">Fonte título</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="fontes-todos"
                checked={applyFontsToAllSlides}
                onCheckedChange={(c) => setApplyFontsToAllSlides(Boolean(c))}
              />
              <Label htmlFor="fontes-todos" className="text-[10px]">
                Aplicar fontes em todos os slides
              </Label>
            </div>
            <select
              className={C_FIELD}
              value={activeSlide.tituloFonte}
              onChange={(e) => {
                const f = e.target.value;
                ensureGoogleFontLoaded(f);
                updateActiveMaybeAll('tituloFonte', f, applyFontsToAllSlides);
              }}
            >
              {CARROSSEL_FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground">
              Seleção ampla via Google Fonts. Adobe Fonts precisa de kit/licença configurado no domínio.
            </p>
            <Label className="text-[10px]">Peso título</Label>
            <div className="flex flex-wrap gap-1">
              {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => updateActive('tituloPeso', w)}
                  className={cn(
                    'min-h-7 min-w-[34px] rounded border px-2 text-[10px] font-medium leading-none',
                    activeSlide.tituloPeso === w
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-foreground/90'
                  )}
                >
                  {w}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Cor título</span>
              <input
                type="color"
                value={activeSlide.corTitulo}
                onChange={(e) => updateActive('corTitulo', e.target.value)}
                className="h-6 w-8 rounded border"
              />
            </div>
            <CarrosselRangeRow
              label="Espaçamento título"
              value={activeSlide.tituloEspacamento}
              min={-5}
              max={10}
              step={0.5}
              onChange={(n) => updateActive('tituloEspacamento', n)}
            />

            <CarrosselRangeRow
              label="Subtítulo (px)"
              value={activeSlide.subtituloTamanho}
              min={14}
              max={48}
              onChange={(n) => updateActive('subtituloTamanho', n)}
            />
            <Label className="text-[10px]">Fonte subtítulo</Label>
            <select
              className={C_FIELD}
              value={activeSlide.subtituloFonte}
              onChange={(e) => {
                const f = e.target.value;
                ensureGoogleFontLoaded(f);
                updateActiveMaybeAll('subtituloFonte', f, applyFontsToAllSlides);
              }}
            >
              {CARROSSEL_FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <CarrosselRangeRow
              label="Entre linhas"
              value={activeSlide.linhaEntreLinhas}
              min={12}
              max={28}
              onChange={(n) => updateActive('linhaEntreLinhas', n)}
            />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Cor subtítulo</span>
              <input
                type="color"
                value={activeSlide.corSubtitulo}
                onChange={(e) => updateActive('corSubtitulo', e.target.value)}
                className="h-6 w-8 rounded border"
              />
            </div>
          </Section>

          <Section
            title="Destaque de palavras"
            icon={Highlighter}
            sectionId="destaque"
            open={openSections.destaque}
            onToggle={() => toggle('destaque')}
          >
            <div className="flex flex-wrap gap-1">
              {titleWords.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => toggleDestaque(w)}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px]',
                    (activeSlide.palavrasDestacadas || []).some((x) => String(x).toLowerCase() === w.toLowerCase())
                      ? 'border-primary bg-primary/20'
                      : 'border-border'
                  )}
                >
                  {w}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px]">Cor destaque</span>
              <input
                type="color"
                value={activeSlide.corDestaque}
                onChange={(e) => updateActive('corDestaque', e.target.value)}
                className="h-6 w-8 rounded border"
              />
            </div>
          </Section>

          <Section
            title="Badge / Logo"
            icon={BadgeCheck}
            sectionId="badge"
            open={openSections.badge}
            onToggle={() => toggle('badge')}
          >
            <p className={cn(C_INFO, 'leading-snug')}>
              Overlay com avatar e textos do perfil (X/Twitter) + logo PNG opcional.
            </p>

            <div className="flex items-center gap-2">
              <Checkbox
                id="badge"
                checked={activeSlide.mostrarBadge}
                onCheckedChange={(c) => updateActive('mostrarBadge', Boolean(c))}
              />
              <Label htmlFor="badge" className="text-xs">
                Exibir badge — slide {activeSlideIndex + 1}
              </Label>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={applyBadgeFromActiveToAll}
              >
                Todos
              </button>
            </div>

            <Label className={C_LBL_FIELD}>Estilo do badge</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['glass', 'Glass'],
                ['solid', 'Sólido'],
                ['minimal', 'Minimal'],
              ].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => updateActive('badgeEstilo', v)}
                  className={cn(
                    C_BTN_SMALL,
                    activeSlide.badgeEstilo === v ? 'border-primary bg-primary/15 text-foreground' : ''
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
              <Label className={C_LBL_FIELD}>@ do perfil</Label>
              <Input
                value={activeSlide.badgeHandle || ''}
                onChange={(e) => updateActive('badgeHandle', e.target.value)}
                placeholder="@handle"
                className={C_FIELD}
              />
              <Label className={C_LBL_FIELD}>Título (verificado)</Label>
              <Input
                value={activeSlide.badgeTitulo || ''}
                onChange={(e) => updateActive('badgeTitulo', e.target.value)}
                placeholder="Título verificado"
                className={C_FIELD}
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="badge-verified"
                  checked={Boolean(activeSlide.badgeVerificado)}
                  onCheckedChange={(c) => updateActive('badgeVerificado', Boolean(c))}
                />
                <Label htmlFor="badge-verified" className="text-xs">
                  Mostrar selo verificado
                </Label>
              </div>
              <Label className={C_LBL_FIELD}>Descrição / tweet (opcional)</Label>
              <Textarea
                value={activeSlide.badgeDescricao || ''}
                onChange={(e) => updateActive('badgeDescricao', e.target.value)}
                className={cn(C_FIELD, 'min-h-[58px]')}
                placeholder="Texto curto abaixo do nome…"
              />
              <Label className={C_LBL_FIELD}>Foto do badge</Label>
              <div className="flex gap-2">
                <label className={cn(C_BTN_SMALL, 'flex-1 cursor-pointer text-center')}>
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) updateActive('badgeFotoUrl', await fileToDataUrl(f));
                      e.target.value = '';
                    }}
                  />
                </label>
                <button type="button" className={C_BTN_SMALL} onClick={() => updateActive('badgeFotoUrl', null)}>
                  Remover
                </button>
              </div>
              <CarrosselRangeRow
                label="Arredondamento"
                value={Number(activeSlide.badgeFotoRound) || 100}
                min={0}
                max={100}
                onChange={(n) => updateActive('badgeFotoRound', n)}
              />
              <CarrosselRangeRow
                label="Tamanho global (todos)"
                value={Number(activeSlide.badgeTamanhoGlobal) || 100}
                min={50}
                max={160}
                onChange={(n) =>
                  setSlides((prev) =>
                    prev.map((s) => ({
                      ...s,
                      badgeTamanhoGlobal: n,
                    }))
                  )
                }
              />
              <CarrosselRangeRow
                label={`Individual — slide ${activeSlideIndex + 1}`}
                value={Number(activeSlide.badgeTamanhoSlide) || 100}
                min={50}
                max={160}
                onChange={(n) => updateActive('badgeTamanhoSlide', n)}
              />
              <CarrosselRangeRow
                label={`Badge X — slide ${activeSlideIndex + 1}`}
                value={Number(activeSlide.badgePosX) || 28}
                min={0}
                max={100}
                onChange={(n) => updateActive('badgePosX', n)}
              />
              <CarrosselRangeRow
                label={`Badge Y — slide ${activeSlideIndex + 1}`}
                value={Number(activeSlide.badgePosY) || 16}
                min={0}
                max={100}
                onChange={(n) => updateActive('badgePosY', n)}
              />
            </div>

            <div className="h-px w-full bg-border" aria-hidden />

            <div className="flex items-center gap-2">
              <Checkbox
                id="logo"
                checked={activeSlide.mostrarLogo}
                onCheckedChange={(c) => updateActive('mostrarLogo', Boolean(c))}
              />
              <Label htmlFor="logo" className="text-xs">
                Exibir logo — slide {activeSlideIndex + 1}
              </Label>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setSlides((prev) => prev.map((s) => ({ ...s, mostrarLogo: true })))}
              >
                Todos
              </button>
            </div>
            <label className={cn(C_BTN_SMALL, 'inline-flex w-full cursor-pointer items-center justify-center')}>
              Upload logo PNG
              <input
                type="file"
                accept="image/png"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const raw = await fileToDataUrl(f);
                    const trimmed = await trimTransparentPngDataUrl(raw);
                    updateActive('logoPng', trimmed);
                  }
                  e.target.value = '';
                }}
              />
            </label>
            <p className={C_INFO}>PNG com margens transparentes: o sistema recorta automaticamente para a logo ficar maior.</p>
            <CarrosselRangeRow
              label="Arredondamento logo (global)"
              value={Number(activeSlide.logoArredondamento) || 16}
              min={0}
              max={40}
              onChange={(n) =>
                setSlides((prev) =>
                  prev.map((s) => ({
                    ...s,
                    logoArredondamento: n,
                  }))
                )
              }
            />
            <CarrosselRangeRow
              label="Logo PNG — tamanho global"
              value={Number(activeSlide.logoTamanhoGlobal) || 100}
              min={40}
              max={600}
              onChange={(n) =>
                setSlides((prev) =>
                  prev.map((s) => ({
                    ...s,
                    logoTamanhoGlobal: n,
                  }))
                )
              }
            />
            <CarrosselRangeRow
              label={`Logo PNG — slide ${activeSlideIndex + 1}`}
              value={Number(activeSlide.logoTamanhoSlide) || 100}
              min={40}
              max={600}
              onChange={(n) => updateActive('logoTamanhoSlide', n)}
            />
            <CarrosselRangeRow
              label={`Logo X — slide ${activeSlideIndex + 1}`}
              value={Number(activeSlide.logoPosX) || 90}
              min={0}
              max={100}
              onChange={(n) => updateActive('logoPosX', n)}
            />
            <CarrosselRangeRow
              label={`Logo Y — slide ${activeSlideIndex + 1}`}
              value={Number(activeSlide.logoPosY) || 10}
              min={0}
              max={100}
              onChange={(n) => updateActive('logoPosY', n)}
            />
          </Section>

          <Section
            title="Cantos"
            icon={LayoutTemplate}
            sectionId="cantos"
            open={openSections.cantos}
            onToggle={() => toggle('cantos')}
          >
            <div className="flex items-center gap-2">
              <Checkbox
                id="cantos-todos-auto"
                checked={applyCantosToAllSlides}
                onCheckedChange={(c) => setApplyCantosToAllSlides(Boolean(c))}
              />
              <Label htmlFor="cantos-todos-auto" className="text-xs">
                Aplicar edições em todos
              </Label>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={applyCantosFromActiveToAll}
              >
                Todos
              </button>
            </div>
            {[
              ['cantoSupEsq', 'cantoSupEsqAtivo', 'Sup esq'],
              ['cantoSupDir', 'cantoSupDirAtivo', 'Sup dir'],
              ['cantoInfEsq', 'cantoInfEsqAtivo', 'Inf esq'],
              ['cantoInfDir', 'cantoInfDirAtivo', 'Inf dir'],
            ].map(([field, toggleField, label]) => (
              <div key={field} className="flex items-center gap-2">
                <Checkbox
                  checked={activeSlide[toggleField]}
                  onCheckedChange={(c) => updateActiveMaybeAll(toggleField, Boolean(c), applyCantosToAllSlides)}
                />
                <input
                  className="flex-1 rounded border px-2 py-1 text-[10px]"
                  value={activeSlide[field]}
                  onChange={(e) => updateActiveMaybeAll(field, e.target.value, applyCantosToAllSlides)}
                  placeholder={label}
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Checkbox
                id="bolinhas"
                checked={activeSlide.mostrarBolinhas}
                onCheckedChange={(c) => updateActiveMaybeAll('mostrarBolinhas', Boolean(c), applyCantosToAllSlides)}
              />
              <Label htmlFor="bolinhas" className="text-xs">
                Bolinhas de quantidade
              </Label>
            </div>
            <CarrosselRangeRow
              label="Fonte cantos"
              value={activeSlide.cantoFonte}
              min={12}
              max={36}
              onChange={(n) => updateActiveMaybeAll('cantoFonte', n, applyCantosToAllSlides)}
            />
            <CarrosselRangeRow
              label="Distância"
              value={activeSlide.cantoDist}
              min={24}
              max={160}
              onChange={(n) => updateActiveMaybeAll('cantoDist', n, applyCantosToAllSlides)}
            />
            <CarrosselRangeRow
              label="Opacidade cantos"
              value={activeSlide.cantoOpacidade}
              min={20}
              max={100}
              onChange={(n) => updateActiveMaybeAll('cantoOpacidade', n, applyCantosToAllSlides)}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="cglass"
                checked={activeSlide.cantoGlass}
                onCheckedChange={(c) => updateActiveMaybeAll('cantoGlass', Boolean(c), applyCantosToAllSlides)}
              />
              <Label htmlFor="cglass" className="text-xs">
                Glass cantos
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="cbor"
                checked={activeSlide.cantoBordaMinimalista}
                onCheckedChange={(c) =>
                  updateActiveMaybeAll('cantoBordaMinimalista', Boolean(c), applyCantosToAllSlides)
                }
              />
              <Label htmlFor="cbor" className="text-xs">
                Borda minimalista
              </Label>
            </div>
            <Label className="text-[10px]">Ícone inf. dir.</Label>
            <div className="flex flex-wrap gap-1">
              {[
                ['none', '—'],
                ['bookmark', 'Marc.'],
                ['arrow', '>'],
                ['heart', '♥'],
                ['share', 'Shr'],
                ['comment', 'Msg'],
                ['cursor', 'Ptr'],
              ].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => updateActiveMaybeAll('cantoIcone', v, applyCantosToAllSlides)}
                  className={cn(
                    'rounded border px-1 text-[9px]',
                    activeSlide.cantoIcone === v ? 'border-primary' : 'border-border'
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </Section>

          <Section
            title="Botões / CTAs"
            icon={MousePointerClick}
            sectionId="botoes"
            open={openSections.botoes}
            onToggle={() => toggle('botoes')}
          >
            <div className="flex items-center gap-2">
              <Checkbox
                id="botoes"
                checked={activeSlide.mostrarBotoes}
                onCheckedChange={(c) => updateActive('mostrarBotoes', Boolean(c))}
              />
              <Label htmlFor="botoes" className="text-xs">
                Mostrar CTAs neste slide
              </Label>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setSlides((prev) => prev.map((s) => ({ ...s, mostrarBotoes: true })))}
              >
                Todos
              </button>
            </div>
            <Label className={C_LBL_FIELD}>Texto principal</Label>
            <Input
              value={activeSlide.ctaTextoPrimario || ''}
              onChange={(e) => updateActive('ctaTextoPrimario', e.target.value)}
              className={C_FIELD}
              placeholder="Saiba mais"
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="cta-second"
                checked={Boolean(activeSlide.ctaMostrarSecundario)}
                onCheckedChange={(c) => updateActive('ctaMostrarSecundario', Boolean(c))}
              />
              <Label htmlFor="cta-second" className="text-xs">
                Mostrar segundo botão
              </Label>
            </div>
            {activeSlide.ctaMostrarSecundario ? (
              <>
                <Label className={C_LBL_FIELD}>Texto secundário</Label>
                <Input
                  value={activeSlide.ctaTextoSecundario || ''}
                  onChange={(e) => updateActive('ctaTextoSecundario', e.target.value)}
                  className={C_FIELD}
                  placeholder="Ver detalhes"
                />
              </>
            ) : null}

            <Label className={C_LBL_FIELD}>Estilo do botão</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['solid', 'Sólido'],
                ['outline', 'Outline'],
                ['glass', 'Glass'],
              ].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => updateActive('ctaEstilo', v)}
                  className={cn(
                    C_BTN_SMALL,
                    activeSlide.ctaEstilo === v ? 'border-primary bg-primary/15 text-foreground' : ''
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <Label className={C_LBL_FIELD}>Alinhamento</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['esq', 'Esquerda'],
                ['centro', 'Centro'],
                ['dir', 'Direita'],
              ].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => updateActive('ctaAlinhamento', v)}
                  className={cn(
                    C_BTN_SMALL,
                    activeSlide.ctaAlinhamento === v ? 'border-primary bg-primary/15 text-foreground' : ''
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <CarrosselRangeRow
              label="Tamanho"
              value={Number(activeSlide.ctaTamanho) || 100}
              min={70}
              max={160}
              onChange={(n) => updateActive('ctaTamanho', n)}
            />
            <CarrosselRangeRow
              label="Posição X"
              value={Number(activeSlide.ctaPosX) || 50}
              min={0}
              max={100}
              onChange={(n) => updateActive('ctaPosX', n)}
            />
            <CarrosselRangeRow
              label="Posição Y"
              value={Number(activeSlide.ctaPosY) || 92}
              min={0}
              max={100}
              onChange={(n) => updateActive('ctaPosY', n)}
            />
          </Section>
          </>
            ) : (
              <>
                <Section
                  title="Conteúdo do Profile"
                  icon={User}
                  sectionId="profileTwitter"
                  open={openSections.profileTwitter}
                  onToggle={() => toggle('profileTwitter')}
                >
                  <p className={cn(C_INFO, 'leading-snug')}>
                    Avatar e nome no cartão estilo X são só seus (não entram no «Gerar com IA»). A IA preenche só o
                    corpo do post e o subtítulo.
                  </p>
                  <div className="min-w-0 space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
                    <Label className={C_LBL_FIELD}>Corpo do post (texto completo visível no slide)</Label>
                    <Textarea
                      value={activeSlide.titulo}
                      onChange={(e) => updateActive('titulo', e.target.value)}
                      rows={14}
                      spellCheck
                      className={cn(
                        C_FIELD,
                        'min-h-[220px] w-full min-w-0 max-w-full resize-y text-[13px] leading-relaxed sm:min-h-[260px]'
                      )}
                      placeholder="Gancho, parágrafos e fecho — como no post de referência (várias frases no mesmo bloco)."
                    />
                    <Label className={C_LBL_FIELD}>Linha extra (subtítulo, sem hashtags)</Label>
                    <Textarea
                      value={activeSlide.subtitulo}
                      onChange={(e) => updateActive('subtitulo', e.target.value)}
                      rows={4}
                      spellCheck
                      className={cn(
                        C_FIELD,
                        'min-h-[88px] w-full min-w-0 max-w-full resize-y text-[13px] leading-relaxed'
                      )}
                      placeholder="Frase curta opcional por baixo do corpo…"
                    />
                  </div>
                  <Label className={C_LBL_FIELD}>Foto de perfil</Label>
                  <div className="space-y-2 rounded-lg border border-dashed border-border/80 bg-muted/15 p-3">
                    <div className="flex flex-wrap gap-2">
                      <label
                        className={cn(
                          C_BTN_SMALL,
                          'inline-flex h-9 min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5'
                        )}
                      >
                        <Upload className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="text-[10px]">Carregar</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (f) updateActive('badgeFotoUrl', await fileToDataUrl(f));
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className={cn(C_BTN_SMALL, 'inline-flex h-9 min-h-9 flex-1 items-center justify-center gap-1.5')}
                        onClick={() => void pasteBadgeFoto()}
                      >
                        <Clipboard className="h-3 w-3 shrink-0" aria-hidden />
                        Colar imagem
                      </button>
                      <button type="button" className={C_BTN_SMALL} onClick={() => updateActive('badgeFotoUrl', null)}>
                        Remover
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Foto partilhada: o mesmo avatar pode aplicar-se a todos os slides.
                    </p>
                    <button type="button" onClick={applyBadgeFromActiveToAll} className={C_BTN_SECONDARY}>
                      Aplicar foto e cabeçalho a todos os slides
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="tw-badge-on"
                      checked={Boolean(activeSlide.mostrarBadge)}
                      onCheckedChange={(c) => updateActive('mostrarBadge', Boolean(c))}
                    />
                    <Label htmlFor="tw-badge-on" className="text-xs">
                      Mostrar cabeçalho do perfil
                    </Label>
                  </div>
                  <Label className={C_LBL_FIELD}>Título (verificado)</Label>
                  <Input
                    value={activeSlide.badgeTitulo || ''}
                    onChange={(e) => updateActive('badgeTitulo', e.target.value)}
                    placeholder="Título verificado"
                    className={C_FIELD}
                  />
                  <Label className={C_LBL_FIELD}>Nome / @handle</Label>
                  <Input
                    value={activeSlide.badgeHandle || ''}
                    onChange={(e) => updateActive('badgeHandle', e.target.value)}
                    placeholder="Nome"
                    className={C_FIELD}
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="tw-verified"
                      checked={Boolean(activeSlide.badgeVerificado)}
                      onCheckedChange={(c) => updateActive('badgeVerificado', Boolean(c))}
                    />
                    <Label htmlFor="tw-verified" className="text-xs">
                      Selo verificado
                    </Label>
                  </div>
                  <Label className={C_LBL_FIELD}>Descrição curta (no cartão)</Label>
                  <Textarea
                    value={activeSlide.badgeDescricao || ''}
                    onChange={(e) => updateActive('badgeDescricao', e.target.value)}
                    className={cn(C_FIELD, 'min-h-[52px]')}
                    placeholder="Texto opcional junto ao nome…"
                  />
                  <CarrosselRangeRow
                    label="Tamanho do texto (corpo + linha extra, px)"
                    value={Number(activeSlide.tituloTamanho) || 72}
                    min={32}
                    max={120}
                    step={1}
                    onChange={(n) => {
                      updateActive('tituloTamanho', n);
                      updateActive('subtituloTamanho', n);
                    }}
                  />
                  <p className={cn(C_INFO, 'text-[10px] leading-snug')}>
                    No slide estilo X com miniatura, a linha extra usa o mesmo tamanho de fonte que o corpo no preview e na exportação.
                  </p>
                  <CarrosselRangeRow
                    label="Entrelinhas do corpo (÷10 = altura de linha, ex. 13 → 1,3)"
                    value={Number(activeSlide.linhaEntreLinhas) || 14}
                    min={11}
                    max={22}
                    step={1}
                    onChange={(n) => updateActive('linhaEntreLinhas', n)}
                  />
                  <p className={`${C_LBL_GROUP} mt-1`}>Posição do bloco (perfil + corpo + subtítulo)</p>
                  <p className={cn(C_INFO, 'mb-1.5 text-[10px] leading-snug')}>
                    Na pré-visualização estilo X, move o conjunto inteiro na faixa acima da miniatura.
                  </p>
                  <p className="mb-1 text-[10px] font-semibold text-muted-foreground">Vertical</p>
                  <div className="mb-2 grid grid-cols-3 gap-1.5">
                    {[
                      ['sup', 'Topo'],
                      ['centro', 'Centro'],
                      ['inf', 'Base'],
                    ].map(([id, label]) => {
                      const cur = ['sup', 'centro', 'inf'].includes(activeSlide.twitterConteudoAnchorV)
                        ? activeSlide.twitterConteudoAnchorV
                        : 'centro';
                      const on = cur === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => updateActive('twitterConteudoAnchorV', id)}
                          className={cn(
                            'rounded-md border py-2 text-[10px] font-semibold transition-colors',
                            on
                              ? 'border-foreground bg-foreground text-background'
                              : 'border-border text-muted-foreground hover:border-muted-foreground'
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className={cn(C_INFO, 'mb-2 text-[9px] leading-snug')}>
                    Novos slides e «Gerar com IA» começam na posição vertical Centro. Com muito texto e pouco espaço na
                    faixa, experimente Topo para encostar o bloco ao topo e facilitar a leitura com scroll.
                  </p>
                  <p className="mb-1 text-[10px] font-semibold text-muted-foreground">Horizontal</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      ['esq', 'Esquerda'],
                      ['centro', 'Centro'],
                      ['dir', 'Direita'],
                    ].map(([id, label]) => {
                      const cur = ['esq', 'centro', 'dir'].includes(activeSlide.twitterConteudoAnchorH)
                        ? activeSlide.twitterConteudoAnchorH
                        : 'centro';
                      const on = cur === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => updateActive('twitterConteudoAnchorH', id)}
                          className={cn(
                            'rounded-md border py-2 text-[10px] font-semibold transition-colors',
                            on
                              ? 'border-foreground bg-foreground text-background'
                              : 'border-border text-muted-foreground hover:border-muted-foreground'
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={isRefiningSlide || (!selectedLlmId && !llmConnections[0]?.id)}
                    onClick={() => void gerarTweetConteudoSlideIa()}
                    className={C_BTN_SECONDARY}
                  >
                    {isRefiningSlide ? '…' : 'Gerar conteúdo deste slide com IA'}
                  </button>
                  <div className="space-y-1 border-t border-border pt-3">
                    <Label className={C_LBL_FIELD}>Refinar slide com IA</Label>
                    <Textarea
                      value={refineIaPrompt}
                      onChange={(e) => setRefineIaPrompt(e.target.value)}
                      placeholder="Ex.: mais direto, menos formal"
                      className={cn(C_FIELD, 'min-h-[48px]')}
                    />
                    <button
                      type="button"
                      disabled={isRefiningSlide || !refineIaPrompt.trim()}
                      onClick={handleRefinarSlide}
                      className={C_BTN_SECONDARY}
                    >
                      {isRefiningSlide ? '…' : 'Refinar este slide'}
                    </button>
                  </div>
                </Section>

                <Section
                  title="Thumbnail e imagens"
                  icon={LayoutGrid}
                  sectionId="gradeImg"
                  open={openSections.gradeImg}
                  onToggle={() => toggle('gradeImg')}
                >
                  <p className={cn(C_INFO, 'leading-snug')}>
                    Layout e posição no estilo profile; recomendado 16:9 para uma miniatura.
                  </p>
                  <p className={`${C_LBL_GROUP} mb-1.5`}>Layout das imagens</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      ['off', 'Sem thumbnail'],
                      ['1w', '1 (16:9)'],
                      ['1s', '1 quadrada'],
                      ['2v', '2 verticais'],
                      ['2h', '2 (16:9)'],
                      ['4q', '4 quad. 2×2'],
                    ].map(([id, label]) => {
                      const activeKey = twitterThumbnailPresetFromSlide(activeSlide);
                      const activeLay = id === 'off' ? activeKey === 'off' : activeKey === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => applyTwitterThumbnailPreset(id)}
                          className={cn(
                            'rounded-md border py-2 text-[10px] font-semibold leading-tight transition-colors',
                            activeLay
                              ? 'border-foreground bg-foreground text-background'
                              : 'border-border text-muted-foreground hover:border-muted-foreground'
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {twitterThumbnailPresetFromSlide(activeSlide) == null && activeSlideGrade.imagemGradeAtiva ? (
                    <p className={cn(C_INFO, 'mt-1.5 text-[10px]')}>
                      Layout clássico «3» activo; escolha um preset acima para usar o editor de miniaturas X.
                    </p>
                  ) : null}
                  <p className={`${C_LBL_GROUP} mb-1.5 mt-3`}>Posição das imagens</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'a', label: 'Abaixo do texto', lp: 'sup-centro', adaptar: true },
                      { id: 'b', label: 'Abaixo do cabeçalho', lp: 'sup-centro', adaptar: false },
                      { id: 'c', label: 'Acima do cabeçalho', lp: 'inf-centro', adaptar: true },
                      { id: 'd', label: 'Após 1º parágrafo', lp: 'meio', adaptar: true },
                    ].map((row) => {
                      const adap = activeSlideGrade.imagemGradeAdaptarTexto !== false;
                      const activePos = activeSlide.layoutPosicao === row.lp && adap === row.adaptar;
                      return (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => applyTwitterImagePlacePreset(row.lp, row.adaptar)}
                          className={cn(
                            'rounded-md border py-2 text-[10px] font-semibold transition-colors',
                            activePos
                              ? 'border-foreground bg-foreground text-background'
                              : 'border-border text-muted-foreground hover:border-muted-foreground'
                          )}
                        >
                          {row.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <Checkbox
                      id="carrossel-grade-ativa-tw"
                      checked={activeSlideGrade.imagemGradeAtiva}
                      onCheckedChange={(c) => setImagemGradeAtivaSlide(c === true)}
                    />
                    <Label htmlFor="carrossel-grade-ativa-tw" className="cursor-pointer text-[11px] font-medium leading-snug">
                      Mostrar thumbnail / grelha
                    </Label>
                  </div>
                  {activeSlideGrade.imagemGradeAtiva ? (
                    <>
                      {getCarrosselGradeAspectoOptionsForLayout(activeSlideGrade.imagemGradeLayout).length > 0 ? (
                        <div className="mt-3 space-y-1.5">
                          <p className={`${C_LBL_GROUP}`}>Proporção das miniaturas</p>
                          <p className={cn(C_INFO, 'text-[10px] leading-snug')}>
                            Ajuste fino além dos presets; layouts «3» usam células sem moldura fixa.
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {getCarrosselGradeAspectoOptionsForLayout(activeSlideGrade.imagemGradeLayout).map(
                              (asp) => (
                                <button
                                  key={asp}
                                  type="button"
                                  onClick={() => applyTwitterGradeAspecto(asp)}
                                  className={cn(
                                    'rounded-md border px-2.5 py-1.5 text-[10px] font-semibold transition-colors',
                                    activeSlideGrade.imagemGradeAspecto === asp
                                      ? 'border-foreground bg-foreground text-background'
                                      : 'border-border text-muted-foreground hover:border-muted-foreground'
                                  )}
                                >
                                  {asp}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-3 space-y-2">
                        <CarrosselRangeRow
                          label="Início da zona de imagem (% da altura do slide)"
                          value={Math.round(
                            (() => {
                              const adapt = activeSlideGrade.imagemGradeAdaptarTexto !== false;
                              const twStack =
                                Boolean(activeSlide.mostrarBadge) &&
                                Boolean(activeSlideGrade.imagemGradeAtiva) &&
                                String(activeSlide.badgeEstilo || '') === 'minimal' &&
                                !activeSlide.glass;
                              const autoP = twStack
                                ? adapt
                                  ? 0.46
                                  : 0.36
                                : adapt
                                  ? 0.38
                                  : 0.3;
                              const raw = activeSlide.imagemGradeInicioFrac;
                              const manual =
                                raw != null && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null;
                              return (manual != null ? manual : autoP) * 100;
                            })()
                          )}
                          min={14}
                          max={58}
                          step={1}
                          onChange={(n) => updateActive('imagemGradeInicioFrac', n / 100)}
                        />
                        <p className={cn(C_INFO, 'text-[10px] leading-snug')}>
                          Com percentagem manual, o início da grelha deixa de seguir só o automático. «Repor altura
                          automática» alinha de novo ao modo actual (incluindo «Reservar mais espaço ao texto»).
                        </p>
                        <button
                          type="button"
                          className={C_BTN_SECONDARY}
                          onClick={() => updateActive('imagemGradeInicioFrac', null)}
                        >
                          Repor altura automática
                        </button>
                      </div>
                      {Array.from({
                        length: getCarrosselGradeSlotCount(activeSlideGrade.imagemGradeLayout),
                      }).map((_, slotIndex) => {
                        const cell = activeSlideGrade.imagemGradeSlots[slotIndex] || {};
                        return (
                          <div key={slotIndex} className="mt-3 space-y-2 rounded-lg border border-border bg-card/40 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              {twitterGradeSlotPanelTitle(
                                activeSlideGrade.imagemGradeLayout,
                                activeSlideGrade.imagemGradeAspecto,
                                slotIndex
                              )}
                            </p>
                            <div className="flex gap-2">
                              <label
                                className={cn(
                                  C_BTN_SMALL,
                                  'inline-flex h-9 min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5'
                                )}
                              >
                                <Upload className="h-3 w-3 shrink-0" aria-hidden />
                                <span className="text-[10px]">Carregar</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => void onGradeSlotFile(slotIndex, e)}
                                />
                              </label>
                              <button
                                type="button"
                                className={cn(
                                  C_BTN_SMALL,
                                  'inline-flex h-9 min-h-9 flex-1 items-center justify-center gap-1.5'
                                )}
                                onClick={() => void pasteGradeSlotImage(slotIndex)}
                              >
                                <Clipboard className="h-3 w-3 shrink-0" aria-hidden />
                                Colar
                              </button>
                            </div>
                            <button
                              type="button"
                              disabled={isGenBg || !selectedImageConnId}
                              onClick={() => void gerarImagemGradeSlotIa(slotIndex)}
                              className={cn(C_BTN_SECONDARY, 'inline-flex w-full items-center justify-center gap-2')}
                            >
                              <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              {isGenBg && genBgTargetSlot === slotIndex
                                ? genBgStatusLabel || 'A gerar…'
                                : 'Gerar imagem com IA'}
                            </button>
                            <CarrosselRangeRow
                              label={`IMG ${slotIndex + 1} horizontal %`}
                              value={Math.round(Number(cell.posX) || 50)}
                              min={0}
                              max={100}
                              step={1}
                              disabled={isGenBg}
                              onChange={(n) => updateActiveGradeSlot(slotIndex, { posX: n })}
                            />
                            <CarrosselRangeRow
                              label={`IMG ${slotIndex + 1} vertical %`}
                              value={Math.round(Number(cell.posY) || 50)}
                              min={0}
                              max={100}
                              step={1}
                              disabled={isGenBg}
                              onChange={(n) => updateActiveGradeSlot(slotIndex, { posY: n })}
                            />
                            <CarrosselRangeRow
                              label={`IMG ${slotIndex + 1} zoom %`}
                              value={Math.round(Number(cell.zoom) || 100)}
                              min={50}
                              max={300}
                              step={1}
                              disabled={isGenBg}
                              onChange={(n) => updateActiveGradeSlot(slotIndex, { zoom: n })}
                            />
                          </div>
                        );
                      })}
                      <div className="mt-3 space-y-1.5 rounded-lg border border-border bg-muted/15 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="carrossel-grade-adaptar-tw"
                            checked={activeSlideGrade.imagemGradeAdaptarTexto}
                            onCheckedChange={(c) => {
                              const v = c === true;
                              setSlides((prev) =>
                                prev.map((s, i) =>
                                  i === activeSlideIndex
                                    ? normalizeCarrosselImagemGrade({
                                        ...s,
                                        imagemGradeAdaptarTexto: v,
                                        imagemGradeInicioFrac: null,
                                      })
                                    : s
                                )
                              );
                            }}
                          />
                          <Label
                            htmlFor="carrossel-grade-adaptar-tw"
                            className="cursor-pointer text-[10px] font-medium leading-snug"
                          >
                            Reservar mais espaço ao texto
                          </Label>
                        </div>
                        <p className={cn(C_INFO, 'pl-6 text-[10px] leading-snug')}>
                          Ao alterar esta opção, a altura automática da grelha muda; o início manual é reposto para
                          corresponder ao novo automático.
                        </p>
                      </div>
                      <CarrosselRangeRow
                        label="Arredondamento (px)"
                        value={activeSlideGrade.imagemGradeRaio}
                        min={0}
                        max={48}
                        step={1}
                        onChange={(n) => updateActive('imagemGradeRaio', n)}
                      />
                    </>
                  ) : null}
                </Section>

                <Section
                  title="Fundo do cartão"
                  icon={Square}
                  sectionId="fundoSlide"
                  open={openSections.fundoSlide}
                  onToggle={() => toggle('fundoSlide')}
                >
                  <p className={cn(C_INFO, 'leading-snug')}>
                    Cor sólida por slide (o modo Profile não usa imagem de fundo em ecrã inteiro).
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activeSlide.corFundo}
                      onChange={(e) => updateActive('corFundo', e.target.value)}
                      className="h-8 w-10 rounded border"
                    />
                    <input
                      className="flex-1 rounded border px-2 py-1 font-mono text-[10px]"
                      value={activeSlide.corFundo}
                      onChange={(e) => updateActive('corFundo', e.target.value)}
                    />
                  </div>
                  <button type="button" onClick={() => updateActive('corFundo', identidade.corFundo)} className={C_BTN_SECONDARY}>
                    Usar cor da identidade
                  </button>
                </Section>

                <Section
                  title="Estilo global (Profile)"
                  icon={Palette}
                  sectionId="twitterEstilo"
                  open={openSections.twitterEstilo}
                  onToggle={() => toggle('twitterEstilo')}
                >
                  <p className={cn(C_INFO, 'mb-2 text-[10px] leading-snug')}>
                    Margens laterais e verticais aplicam-se ao texto, ao perfil e à miniatura (área útil do slide).
                  </p>
                  <CarrosselRangeRow
                    label="Margem lateral (px)"
                    value={Math.round(Number(activeSlide.margemHorizontal) || 72)}
                    min={32}
                    max={160}
                    step={2}
                    onChange={(n) => updateActive('margemHorizontal', n)}
                  />
                  <CarrosselRangeRow
                    label="Margem vertical (px)"
                    value={Math.round(Number(activeSlide.margemVertical) || 100)}
                    min={48}
                    max={220}
                    step={4}
                    onChange={(n) => updateActive('margemVertical', n)}
                  />
                  <CarrosselRangeRow
                    label="Título (px)"
                    value={activeSlide.tituloTamanho}
                    min={32}
                    max={120}
                    onChange={(n) => updateActive('tituloTamanho', n)}
                  />
                  <CarrosselRangeRow
                    label="Subtítulo (px)"
                    value={activeSlide.subtituloTamanho}
                    min={16}
                    max={40}
                    onChange={(n) => updateActive('subtituloTamanho', n)}
                  />
                  <CarrosselRangeRow
                    label="Badge horizontal %"
                    value={Number(activeSlide.badgePosX) || 50}
                    min={0}
                    max={100}
                    onChange={(n) => updateActive('badgePosX', n)}
                  />
                  <CarrosselRangeRow
                    label="Badge vertical %"
                    value={Number(activeSlide.badgePosY) || 12}
                    min={4}
                    max={40}
                    onChange={(n) => updateActive('badgePosY', n)}
                  />
                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    <button type="button" className={C_BTN_SECONDARY} onClick={openSaveStyleTemplateDialog}>
                      <span className="inline-flex items-center justify-center gap-2">
                        <LayoutTemplate className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Templates de estilo
                      </span>
                    </button>
                  </div>
                </Section>
              </>
            )}
            </div>

          <div className="sticky bottom-0 flex shrink-0 flex-col gap-[7px] border-t-2 border-border bg-card px-4 py-[11px] [color-scheme:dark]">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => baixarSlide(activeSlideIndex)}
              className={C_BTN_PRIMARY}
            >
              ↓ Baixar slide {activeSlideIndex + 1}
            </button>
            <div className="grid grid-cols-2 gap-[6px]">
              <button type="button" onClick={() => void openSaveGalleryDialog()} className={C_BTN_SMALL}>
                Salvar
              </button>
              <button type="button" disabled={isExporting} onClick={baixarTodos} className={C_BTN_SMALL}>
                ↓ Baixar todos
              </button>
            </div>
            <div className="grid grid-cols-2 gap-[6px]">
              <button
                type="button"
                onClick={openSaveStyleTemplateDialog}
                className="inline-flex items-center justify-center gap-1 border-none bg-transparent py-[5px] text-[10px] font-medium text-muted-foreground opacity-80 transition-opacity hover:opacity-100"
              >
                <LayoutTemplate className="h-3 w-3 shrink-0" aria-hidden />
                Guardar template
              </button>
              <button
                type="button"
                onClick={gerarLegenda}
                className="border-none bg-transparent py-[5px] text-[10px] text-muted-foreground opacity-70 transition-opacity hover:opacity-100"
              >
                Gerar legenda
              </button>
            </div>
          </div>
        </div>
        </ResizablePanel>
        <ResizableHandle withHandle className="w-1.5 shrink-0 bg-border hover:bg-primary/20 data-[resize-handle-state=drag]:bg-primary/35" />
        <ResizablePanel defaultSize={70} minSize={44} className="min-h-0 min-w-0 flex flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 min-w-0 flex-col">
          <div className="relative min-h-0 flex flex-1 flex-col">
            <div
              className="pointer-events-none absolute right-3 top-3 z-30 flex justify-end"
              role="group"
              aria-label="Modo de visualização do canvas"
            >
              <div className="pointer-events-auto flex rounded-lg border border-border/80 bg-background/95 p-0.5 shadow-lg backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setPreviewMode('single')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors',
                    previewMode === 'single'
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  )}
                >
                  Um slide
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('strip')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors',
                    previewMode === 'strip'
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  )}
                >
                  Lado a lado
                </button>
              </div>
            </div>
            <div
              ref={previewWrapRef}
              className={cn(
                'flex min-h-0 flex-1 min-w-0 p-3',
                PREVIEW_CANVAS_BG,
                previewMode === 'single'
                  ? 'items-center justify-center overflow-hidden'
                  : 'items-center justify-start overflow-x-auto overflow-y-hidden scroll-smooth'
              )}
            >
            {previewMode === 'single' ? (
              <div
                style={{
                  width: `${slideW * scale}px`,
                  height: `${slideH * scale}px`,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: `${slideW}px`,
                    height: `${slideH}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <CarrosselSlideCanvas
                    slide={activeSlide}
                    activeIndex={activeSlideIndex}
                    totalSlides={slides.length}
                    allSlides={slides}
                    canvasFormat={carrosselFormatId}
                    onActivateConfig={activateCarrosselConfigSection}
                  />
                </div>
                <div className="pointer-events-none absolute inset-x-1 bottom-1 z-20">
                  <div className="pointer-events-auto mx-auto flex w-fit items-center gap-2 rounded-md border border-border/80 bg-background/95 px-2 py-1 text-[10px] text-muted-foreground shadow-lg backdrop-blur-md">
                    <span className="font-medium">Slide {activeSlideIndex + 1}</span>
                    <button
                      type="button"
                      onClick={() => setEditArtDialogOpen(true)}
                      disabled={!activeSlide?.imagemFundo}
                      className={cn(
                        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
                        activeSlide?.imagemFundo
                          ? 'border-border text-foreground hover:bg-muted'
                          : 'cursor-not-allowed border-border/50 text-muted-foreground opacity-60'
                      )}
                      title={
                        activeSlide?.imagemFundo
                          ? `Reeditar imagem do slide ${activeSlideIndex + 1}`
                          : 'Gere/carregue uma imagem antes de editar'
                      }
                    >
                      <PenLine className="h-3.5 w-3.5" aria-hidden />
                      Editar imagem
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex w-max max-w-none flex-row items-start gap-4">
                {slides.map((s, i) => (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveSlideIndex(i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveSlideIndex(i);
                      }
                    }}
                    className={cn(
                      'shrink-0 cursor-pointer rounded-lg border-2 bg-background text-left shadow-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                      i === activeSlideIndex
                        ? 'border-primary ring-2 ring-primary/25'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div
                      className="overflow-hidden rounded-t-md"
                      style={{
                        width: `${slideW * scale}px`,
                        height: `${slideH * scale}px`,
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          width: `${slideW}px`,
                          height: `${slideH}px`,
                          transform: `scale(${scale})`,
                          transformOrigin: 'top left',
                        }}
                      >
                        <CarrosselSlideCanvas
                          slide={s}
                          activeIndex={i}
                          totalSlides={slides.length}
                          allSlides={slides}
                          canvasFormat={carrosselFormatId}
                          onActivateConfig={activateCarrosselConfigSection}
                        />
                      </div>
                    </div>
                    <div className="rounded-b-md border-t border-border bg-muted/40 px-1 py-1 text-[10px] font-medium text-muted-foreground">
                      <div className="flex items-center justify-between gap-2">
                        <span>Slide {i + 1}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSlideIndex(i);
                            setEditArtDialogOpen(true);
                          }}
                          disabled={!s?.imagemFundo}
                          className={cn(
                            'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
                            s?.imagemFundo
                              ? 'border-border bg-background text-foreground hover:bg-muted'
                              : 'cursor-not-allowed border-border/50 bg-background text-muted-foreground opacity-60'
                          )}
                          title={
                            s?.imagemFundo
                              ? `Reeditar imagem do slide ${i + 1}`
                              : 'Gere/carregue uma imagem neste slide antes de editar'
                          }
                        >
                          <PenLine className="h-3.5 w-3.5" aria-hidden />
                          Editar imagem
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
          <div className={cn('flex gap-2 overflow-x-auto border-t border-border/80 p-2', PREVIEW_THUMB_STRIP_BG)}>
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSlideIndex(i)}
                className={cn(
                  'w-16 shrink-0 overflow-hidden rounded border-2 transition-all',
                  i === activeSlideIndex ? 'scale-105 border-primary' : 'border-border hover:border-primary/50'
                )}
                style={{ aspectRatio: `${slideW} / ${slideH}` }}
              >
                <div
                  className="flex h-full w-full flex-col justify-end p-1"
                  style={{ background: s.corFundo }}
                >
                  <p
                    className="line-clamp-2 font-bold leading-tight"
                    style={{ color: s.corTitulo, fontSize: 6 }}
                  >
                    {s.titulo}
                  </p>
                </div>
              </button>
            ))}
            <button
              type="button"
              onClick={addSlide}
              className="flex w-16 shrink-0 items-center justify-center rounded border-2 border-dashed border-border hover:border-primary/60"
              style={{ aspectRatio: `${slideW} / ${slideH}` }}
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <AgenteModal
        open={agenteOpen}
        onOpenChange={handleAgenteOpenChange}
        etapa={agenteEtapa}
        logs={agenteLog}
        slidesGerados={agenteSlidesGerados}
        gerarImagens={agenteGerarImagens}
        onToggleGerarImagens={setAgenteGerarImagens}
        onRodar={rodarAgente}
        onAprovar={aprovarEContinuar}
        imagemAtual={agenteImagemAtual}
        llmConnections={llmConnections}
        selectedLlmId={selectedLlmId}
        onSelectLlmId={onSelectLlmId}
        imageConnections={imageConnections}
        selectedImageConnId={selectedImageConnId}
        onSelectImageConnId={setSelectedImageConnId}
        carouselIaMode={carouselIaMode}
        carouselClientId={carouselClientId}
        carouselClientProfile={carouselClientProfile}
        carouselClientContexts={carouselClientContexts}
        carouselSelectedContextId={carouselSelectedContextId}
        clientsList={clientsList}
        onSetCarouselIaMode={setCarouselIaMode}
        onSetCarouselClientId={setCarouselClientId}
        onSetCarouselSelectedContextId={setCarouselSelectedContextId}
        carouselClientDetailLoading={carouselClientDetailLoading}
        iaPrompt={iaPrompt}
        onSetIaPrompt={setIaPrompt}
        agenteRefImg={agenteRefImg}
        onSetAgenteRefImg={setAgenteRefImg}
        agentePaleta={agentePaleta}
        onSetAgentePaleta={setAgentePaleta}
        agenteFontOptions={agenteFontOptions}
        agenteFontEscolhida={agenteFontEscolhida}
        onSetAgenteFontEscolhida={setAgenteFontEscolhida}
        onGerarConteudo={gerarConteudo}
        onVoltarPaleta={() => setAgenteEtapa('idle')}
        onRegerarPaletaFontes={handleRegerarPaletaFontes}
        agenteTemperaturaCriativa={agenteTemperaturaCriativa}
        onSetAgenteTemperaturaCriativa={setAgenteTemperaturaCriativa}
        agenteCandidates={agenteCandidates}
        onEscolherCandidato={resolverCandidatoAgente}
      />

      <Dialog open={editArtDialogOpen} onOpenChange={setEditArtDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar imagem com IA</DialogTitle>
            <DialogDescription>
              Descreva o que quer alterar. A IA usa a imagem atual deste slide como referência.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="carrossel-edit-art">O que deseja alterar?</Label>
            <Textarea
              id="carrossel-edit-art"
              value={editArtInstruction}
              onChange={(e) => setEditArtInstruction(e.target.value)}
              placeholder="Ex.: deixar mais clean, trocar para tons azuis, aumentar contraste e remover elementos distrativos."
              className={cn(C_FIELD, 'min-h-[96px]')}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'enter') {
                  e.preventDefault();
                  void handleEditCurrentArtWithIa();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isEditingArt} onClick={() => setEditArtDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isEditingArt || !activeSlide?.imagemFundo} onClick={() => void handleEditCurrentArtWithIa()}>
              {isEditingArt ? 'A reeditar…' : 'Reeditar imagem'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveStyleTemplateDialogOpen} onOpenChange={setSaveStyleTemplateDialogOpen}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Guardar template</DialogTitle>
            <DialogDescription>
              Guarda o número de slides, formato, identidade, estilo do canvas, todos os slides (texto e opções visuais)
              e preferências de geração de imagem. Fundos e logos em base64 não são incluídos — volte a gerar ou carregar
              imagens depois. Máximo {MAX_CARROSSEL_STYLE_TEMPLATES} templates por conta neste browser.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="carrossel-template-name">Nome do template</Label>
            <Input
              id="carrossel-template-name"
              value={saveStyleTemplateName}
              onChange={(e) => setSaveStyleTemplateName(e.target.value)}
              placeholder="Ex.: Stories marca X — 4K cenário"
              maxLength={120}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitSaveStyleTemplate();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveStyleTemplateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={commitSaveStyleTemplate}>
              Guardar template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveGalleryDialogOpen} onOpenChange={setSaveGalleryDialogOpen}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {editingGalleryEntryId ? 'Atualizar na galeria' : 'Guardar na galeria'}
            </DialogTitle>
            <DialogDescription>
              {editingGalleryEntryId
                ? 'As alterações substituem esta entrada na galeria (servidor).'
                : `Escolha um nome (máximo ${MAX_CARROSSEL_GALLERY_SAVES} por conta). Os dados são guardados no servidor (Supabase), não só no browser.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="carrossel-gallery-name">Nome</Label>
            <Input
              id="carrossel-gallery-name"
              value={saveGalleryName}
              onChange={(e) => setSaveGalleryName(e.target.value)}
              placeholder="Ex.: Lançamento abril"
              maxLength={120}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void commitSaveToGallery();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSavingGallery}
              onClick={() => setSaveGalleryDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={isSavingGallery} onClick={() => void commitSaveToGallery()}>
              {isSavingGallery ? 'A guardar…' : editingGalleryEntryId ? 'Atualizar' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={limitReplaceDialogOpen} onOpenChange={setLimitReplaceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Você atingiu seu limite</DialogTitle>
            <DialogDescription>
              Escolha qual carrossel salvo deseja substituir por esta arte.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="replace-target">Qual carrossel substituir</Label>
            <select
              id="replace-target"
              className={C_FIELD}
              value={limitReplaceTargetId}
              onChange={(e) => setLimitReplaceTargetId(e.target.value)}
            >
              {limitReplaceCandidates.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name || `Sem nome (${entry.id})`}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLimitReplaceDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSavingGallery || !limitReplaceTargetId} onClick={() => void commitReplaceGalleryAtLimit()}>
              {isSavingGallery ? 'A substituir…' : 'Substituir e guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tamanho real do canvas (formato), sem transform — html2canvas usa getBoundingClientRect e falha com scale no preview. */}
      <div
        aria-hidden
        className="pointer-events-none fixed overflow-hidden"
        style={{
          left: '-12000px',
          top: 0,
          width: `${slideW}px`,
          height: `${slideH}px`,
          zIndex: -1,
        }}
      >
        <CarrosselSlideCanvas
          ref={exportSlideRef}
          slide={exportSlideSnapshot ?? activeSlide}
          activeIndex={exportLayerActiveIndex}
          totalSlides={slides.length}
          allSlides={slides}
          canvasFormat={carrosselFormatId}
        />
      </div>
    </div>
  );
}
