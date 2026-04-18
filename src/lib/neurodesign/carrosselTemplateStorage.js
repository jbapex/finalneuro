/**
 * Presets de estilo / configuração do editor de carrossel (localStorage por utilizador).
 * Não inclui imagens base64 (fundos, logos) para caber no armazenamento do browser.
 */

import { CARROSSEL_CANVAS_FORMAT } from '@/lib/neurodesign/carrosselSlideModel';
import { normalizeCarrosselGeminiImageSize } from '@/lib/neurodesign/carrosselLlmClient';

export const MAX_CARROSSEL_STYLE_TEMPLATES = 15;

const TEMPLATES_KEY_PREFIX = 'neurodesign-carrossel-style-templates-v1:';

export function carrosselStyleTemplatesStorageKey(userId) {
  return `${TEMPLATES_KEY_PREFIX}${String(userId)}`;
}

/** Remove data URLs grandes antes de gravar em localStorage (templates, galeria). */
export function stripHeavyFromSlide(slide) {
  if (!slide || typeof slide !== 'object') return slide;
  const s = { ...slide };
  if (typeof s.imagemFundo === 'string' && s.imagemFundo.startsWith('data:')) {
    s.imagemFundo = null;
  }
  if (typeof s.logoPng === 'string' && s.logoPng.startsWith('data:')) {
    s.logoPng = null;
  }
  if (Array.isArray(s.imagemGradeSlots)) {
    s.imagemGradeSlots = s.imagemGradeSlots.map((cell) => {
      if (!cell || typeof cell !== 'object') return cell;
      const c = { ...cell };
      if (typeof c.imagem === 'string' && c.imagem.startsWith('data:')) {
        c.imagem = null;
      }
      return c;
    });
  }
  return s;
}

/**
 * Snapshot completo para reaplicar no editor ou para parâmetros de geração de imagem.
 */
export function buildCarrosselStyleTemplateSnapshot({
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
}) {
  const safeSlides = Array.isArray(slides)
    ? slides.map((sl) => JSON.parse(JSON.stringify(stripHeavyFromSlide(sl))))
    : [];
  return {
    v: 1,
    slideCount: Math.min(15, Math.max(1, Number(slideCount) || 5)),
    carrosselFormatId: CARROSSEL_CANVAS_FORMAT[carrosselFormatId] ? carrosselFormatId : 'carousel',
    template: typeof template === 'string' ? template : 'minimalista',
    darkMode: Boolean(darkMode),
    identidade: identidade && typeof identidade === 'object' ? { ...identidade } : {},
    slides: safeSlides,
    activeSlideIndex: Math.max(0, Math.min(safeSlides.length - 1, Number(activeSlideIndex) || 0)),
    openSections: openSections && typeof openSections === 'object' ? { ...openSections } : {},
    gerarImagensIa: Boolean(gerarImagensIa),
    imgGenPanoramaContinuidade: Boolean(imgGenPanoramaContinuidade),
    imgGenGeminiQuality: normalizeCarrosselGeminiImageSize(imgGenGeminiQuality || '2K'),
    imgGenPromptExtra: String(imgGenPromptExtra || ''),
    imgGenHumanPreference: ['auto', 'people', 'visual'].includes(imgGenHumanPreference)
      ? imgGenHumanPreference
      : 'auto',
    previewMode: previewMode === 'strip' ? 'strip' : 'single',
    scale: typeof scale === 'number' && scale > 0 ? scale : 0.32,
  };
}

export function readCarrosselStyleTemplates(userId) {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(carrosselStyleTemplatesStorageKey(userId));
    if (!raw) return [];
    const p = JSON.parse(raw);
    if (!Array.isArray(p)) return [];
    return p.filter(
      (x) =>
        x &&
        typeof x.id === 'string' &&
        typeof x.name === 'string' &&
        x.settings &&
        x.settings.v === 1 &&
        Array.isArray(x.settings.slides) &&
        x.settings.slides.length > 0
    );
  } catch {
    return [];
  }
}

export function writeCarrosselStyleTemplates(userId, list) {
  if (!userId) return;
  const trimmed = list.slice(0, MAX_CARROSSEL_STYLE_TEMPLATES);
  localStorage.setItem(carrosselStyleTemplatesStorageKey(userId), JSON.stringify(trimmed));
}
