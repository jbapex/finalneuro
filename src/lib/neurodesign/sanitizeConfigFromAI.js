/**
 * Sanitização de config do Neuro Designer vinda de resposta de IA.
 * Usado por NeuroDesignPage, NeuroDesignFlowModal e CarouselNode (Preencher com IA).
 */

const ZONE_VALUES = ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'];
const FONT_VALUES = ['', 'sans', 'serif', 'bold', 'modern'];
const SHAPE_STYLE_VALUES = ['rounded_rectangle', 'banner', 'pill'];

export const NEURODESIGN_FILL_ALLOWED_KEYS = new Set([
  'subject_enabled', 'subject_gender', 'subject_description', 'quantity', 'niche_project', 'environment',
  'shot_type', 'layout_position', 'dimensions', 'image_size', 'use_scenario_photos',
  'text_enabled', 'headline_h1', 'subheadline_h2', 'cta_button_text', 'text_position', 'text_gradient',
  'headline_zone', 'subheadline_zone', 'cta_zone',
  'headline_font', 'subheadline_font', 'cta_font',
  'headline_color', 'subheadline_color', 'cta_color',
  'headline_shape_enabled', 'subheadline_shape_enabled', 'cta_shape_enabled',
  'headline_shape_style', 'subheadline_shape_style', 'cta_shape_style',
  'headline_shape_color', 'subheadline_shape_color', 'cta_shape_color',
  'text_font', 'text_color', 'text_shape_enabled', 'text_shape_style', 'text_shape_color',
  'visual_attributes', 'ambient_color', 'rim_light_color', 'fill_light_color',
  'floating_elements_enabled', 'floating_elements_text', 'additional_prompt',
]);

export const NEURODESIGN_FILL_ENUMS = {
  subject_gender: ['masculino', 'feminino'],
  shot_type: ['close-up', 'medio busto', 'americano'],
  layout_position: ['esquerda', 'centro', 'direita'],
  dimensions: ['1:1', '4:5', '9:16', '16:9'],
  text_position: ['esquerda', 'centro', 'direita'],
  image_size: ['1K', '2K', '4K'],
  headline_zone: ZONE_VALUES,
  subheadline_zone: ZONE_VALUES,
  cta_zone: ZONE_VALUES,
  headline_font: FONT_VALUES,
  subheadline_font: FONT_VALUES,
  cta_font: FONT_VALUES,
  headline_shape_style: SHAPE_STYLE_VALUES,
  subheadline_shape_style: SHAPE_STYLE_VALUES,
  cta_shape_style: SHAPE_STYLE_VALUES,
  text_font: FONT_VALUES,
  text_shape_style: SHAPE_STYLE_VALUES,
};

export const NEURODESIGN_STYLE_TAGS = ['clássico', 'formal', 'elegante', 'institucional', 'tecnológico', 'minimalista', 'criativo'];

const COLOR_KEYS = new Set(['headline_color', 'subheadline_color', 'cta_color', 'headline_shape_color', 'subheadline_shape_color', 'cta_shape_color', 'text_color', 'text_shape_color', 'ambient_color', 'rim_light_color', 'fill_light_color']);
const BOOL_KEYS = new Set(['text_enabled', 'text_gradient', 'floating_elements_enabled', 'subject_enabled', 'use_scenario_photos', 'headline_shape_enabled', 'subheadline_shape_enabled', 'cta_shape_enabled', 'text_shape_enabled']);
const HEX_REGEX = /^#[0-9a-fA-F]{3,6}$/;

function isValidHex(s) {
  return typeof s === 'string' && HEX_REGEX.test(s.trim());
}

export function normalizeShotType(v) {
  if (!v || typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  if (s.includes('close') || s === 'closeup') return 'close-up';
  if (s.includes('americano') || s.includes('full') || s.includes('corpo')) return 'americano';
  if (s.includes('medio') || s.includes('busto') || s.includes('medium') || s.includes('meio')) return 'medio busto';
  return null;
}

export function normalizeImageSizeVal(v) {
  if (!v || typeof v !== 'string') return null;
  const s = v.trim().toUpperCase();
  if (s === '1K' || s === '1024') return '1K';
  if (s === '2K' || s === '2048') return '2K';
  if (s === '4K' || s === '4096') return '4K';
  return null;
}

/**
 * Sanitiza um objeto de config vindo da IA (um único slide ou um formulário completo).
 * Retorna apenas as chaves permitidas com valores válidos; omitidas ou inválidas são ignoradas.
 * @param {Object} parsed - objeto bruto da resposta (ex.: slide.config ou resposta inteira)
 * @param {Object} [options] - opções
 * @param {Object} [options.existingVisualAttributes] - base para merge de visual_attributes (NeuroDesignPage/Modal)
 * @returns {Object} - objeto sanitizado para merge na config
 */
export function sanitizeNeuroDesignConfigFromAI(parsed, options = {}) {
  if (!parsed || typeof parsed !== 'object') return {};
  const existingVisualAttributes = options.existingVisualAttributes || {};
  const sanitized = {};
  for (const key of Object.keys(parsed)) {
    if (!NEURODESIGN_FILL_ALLOWED_KEYS.has(key)) continue;
    let value = parsed[key];
    if (key === 'quantity') {
      const n = Number(value);
      if (!Number.isNaN(n)) sanitized[key] = Math.min(5, Math.max(1, Math.round(n)));
    } else if (key === 'shot_type' && typeof value === 'string') {
      const normalized = normalizeShotType(value) || (NEURODESIGN_FILL_ENUMS.shot_type.includes(value.trim()) ? value.trim() : null);
      if (normalized) sanitized[key] = normalized;
    } else if (key === 'image_size' && (typeof value === 'string' || typeof value === 'number')) {
      const normalized = normalizeImageSizeVal(String(value)) || (NEURODESIGN_FILL_ENUMS.image_size.includes(String(value).trim().toUpperCase()) ? String(value).trim().toUpperCase() : null);
      if (normalized) sanitized[key] = normalized;
    } else if (COLOR_KEYS.has(key) && typeof value === 'string') {
      if (isValidHex(value)) sanitized[key] = value.trim();
    } else if (BOOL_KEYS.has(key)) {
      sanitized[key] = Boolean(value);
    } else if (NEURODESIGN_FILL_ENUMS[key] && (typeof value === 'string' || value === null || value === '')) {
      const v = value == null ? '' : String(value).trim().toLowerCase();
      const enumList = NEURODESIGN_FILL_ENUMS[key];
      const match = enumList.find((e) => String(e).toLowerCase() === v || String(e).replace(/\s/g, '') === v.replace(/\s/g, ''));
      if (match !== undefined) sanitized[key] = match;
    } else if (key === 'visual_attributes' && value && typeof value === 'object') {
      const prev = existingVisualAttributes;
      const next = { ...prev };
      let tags = value.style_tags;
      if (typeof tags === 'string') tags = tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
      if (Array.isArray(tags)) {
        next.style_tags = tags.map((t) => String(t).toLowerCase()).filter((t) => NEURODESIGN_STYLE_TAGS.includes(t));
      }
      const sob = value.sobriety;
      if (typeof sob === 'number' && sob >= 0 && sob <= 100) next.sobriety = sob;
      else if (typeof sob === 'string' && /^\d+$/.test(sob.trim())) {
        const n = parseInt(sob.trim(), 10);
        if (n >= 0 && n <= 100) next.sobriety = n;
      }
      if (typeof value.ultra_realistic === 'boolean') next.ultra_realistic = value.ultra_realistic;
      if (typeof value.blur_enabled === 'boolean') next.blur_enabled = value.blur_enabled;
      if (typeof value.lateral_gradient_enabled === 'boolean') next.lateral_gradient_enabled = value.lateral_gradient_enabled;
      sanitized[key] = next;
    } else if (key === 'floating_elements_text' && (typeof value === 'string' || typeof value === 'number')) {
      sanitized[key] = String(value);
    } else if ((typeof value === 'string' || typeof value === 'number') && key !== 'visual_attributes') {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
