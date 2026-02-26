/**
 * Dado inputData (objeto keyed por tipo de nó upstream, cada valor = { id, data }),
 * monta um objeto de config overrides para neurodesign-generate.
 * Usado pelo ImageGeneratorNode, CarouselNode e NeuroDesignFlowModal.
 *
 * @param {Object} inputData - inputData do nó (getUpstreamNodesData)
 * @returns {Object} - overrides para merge na config (apenas chaves definidas)
 */
export function mergeFlowInputDataIntoConfig(inputData) {
  if (!inputData || typeof inputData !== 'object') return {};

  const overrides = {};

  // reference_image, reference_image_2, ... → style_reference_urls, style_reference_instructions
  const styleRefUrls = [];
  const styleRefInstructions = [];
  for (const key of Object.keys(inputData)) {
    if (key === 'reference_image' || /^reference_image_\d+$/.test(key)) {
      const entry = inputData[key];
      const data = entry?.data;
      if (!data) continue;
      const urls = Array.isArray(data.style_reference_urls) ? data.style_reference_urls : (data.referenceImageUrl ? [data.referenceImageUrl] : []);
      const instr = Array.isArray(data.style_reference_instructions) ? data.style_reference_instructions : (data.style_reference_instruction != null ? [data.style_reference_instruction] : []);
      urls.forEach((u) => typeof u === 'string' && u.trim() && styleRefUrls.push(u.trim()));
      instr.forEach((i) => styleRefInstructions.push(typeof i === 'string' ? i : ''));
    }
  }
  if (styleRefUrls.length > 0) {
    overrides.style_reference_urls = styleRefUrls.slice(0, 5);
    overrides.style_reference_instructions = styleRefInstructions.length >= styleRefUrls.length
      ? styleRefInstructions.slice(0, styleRefUrls.length)
      : [...styleRefInstructions, ...Array(Math.max(0, styleRefUrls.length - styleRefInstructions.length)).fill('')];
  }

  // image_logo → logo_url (primeiro encontrado)
  for (const key of ['image_logo', 'image_logo_2', 'image_logo_3']) {
    const entry = inputData[key];
    const url = entry?.data?.logo_url;
    if (typeof url === 'string' && url.trim()) {
      overrides.logo_url = url.trim();
      break;
    }
  }

  // colors → ambient_color, rim_light_color, fill_light_color
  const colorsEntry = inputData.colors?.data;
  if (colorsEntry) {
    if (typeof colorsEntry.ambient_color === 'string' && colorsEntry.ambient_color.trim()) overrides.ambient_color = colorsEntry.ambient_color.trim();
    if (typeof colorsEntry.rim_light_color === 'string' && colorsEntry.rim_light_color.trim()) overrides.rim_light_color = colorsEntry.rim_light_color.trim();
    if (typeof colorsEntry.fill_light_color === 'string' && colorsEntry.fill_light_color.trim()) overrides.fill_light_color = colorsEntry.fill_light_color.trim();
  }

  // styles → visual_attributes (merge)
  const stylesEntry = inputData.styles?.data?.visual_attributes;
  if (stylesEntry && typeof stylesEntry === 'object') {
    const base = {
      sobriety: 50,
      style_tags: [],
      ultra_realistic: false,
      blur_enabled: false,
      lateral_gradient_enabled: false,
    };
    overrides.visual_attributes = {
      ...base,
      ...stylesEntry,
      style_tags: Array.isArray(stylesEntry.style_tags) ? stylesEntry.style_tags : base.style_tags,
    };
  }

  // subject → subject_gender, subject_description, subject_image_urls, quantity (1 por foto)
  const subjectEntry = inputData.subject?.data;
  if (subjectEntry) {
    if (subjectEntry.subject_gender === 'masculino' || subjectEntry.subject_gender === 'feminino') overrides.subject_gender = subjectEntry.subject_gender;
    if (typeof subjectEntry.subject_description === 'string' && subjectEntry.subject_description.trim()) overrides.subject_description = subjectEntry.subject_description.trim();
    const urls = subjectEntry.subject_image_urls;
    if (Array.isArray(urls) && urls.length > 0) {
      const subjectUrls = urls.filter((u) => typeof u === 'string' && u.trim()).slice(0, 2);
      overrides.subject_image_urls = subjectUrls;
      overrides.quantity = Math.min(5, Math.max(1, subjectUrls.length));
    }
  }

  return overrides;
}

/** Chaves de config que cada tipo de suporte adiciona (para filtrar quando desativado por lâmina). */
const SUPPORT_TYPE_KEYS = {
  reference_image: ['style_reference_urls', 'style_reference_instructions'],
  image_logo: ['logo_url'],
  colors: ['ambient_color', 'rim_light_color', 'fill_light_color'],
  styles: ['visual_attributes'],
  subject: ['subject_gender', 'subject_description', 'subject_image_urls', 'quantity'],
};

/**
 * Remove dos overrides as chaves dos tipos de suporte desativados para uma lâmina.
 * @param {Object} overrides - objeto retornado por mergeFlowInputDataIntoConfig
 * @param {string[]} disabledTypes - ex. ['subject', 'colors']
 * @returns {Object} - novo objeto sem as chaves correspondentes
 */
export function filterOverridesByDisabledSupportTypes(overrides, disabledTypes) {
  if (!overrides || typeof overrides !== 'object') return {};
  if (!Array.isArray(disabledTypes) || disabledTypes.length === 0) return { ...overrides };
  const keysToRemove = new Set();
  for (const type of disabledTypes) {
    const keys = SUPPORT_TYPE_KEYS[type];
    if (keys) keys.forEach((k) => keysToRemove.add(k));
  }
  const filtered = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (!keysToRemove.has(key)) filtered[key] = value;
  }
  return filtered;
}
