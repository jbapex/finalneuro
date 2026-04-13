/**
 * Categorias do Gerador de Conteúdo: configuradas pelo super admin em `config.generator_categories` (array de slugs).
 * Compatível com o campo legado `config.generator_category` (string).
 */
export const MODULE_GENERATOR_CATEGORIES = [
  { id: 'geral', label: 'Geral / vários', shortLabel: 'Geral' },
  { id: 'copy_texto', label: 'Textos, copy e legendas', shortLabel: 'Copy' },
  { id: 'imagem_criativo', label: 'Ideias para imagem e criativo', shortLabel: 'Imagem' },
  { id: 'video_roteiro', label: 'Vídeo, roteiro e áudio', shortLabel: 'Vídeo' },
  { id: 'campanhas', label: 'Campanhas e anúncios', shortLabel: 'Campanhas' },
  { id: 'estrategia', label: 'Estratégia e planejamento', shortLabel: 'Estratégia' },
  { id: 'email_whatsapp', label: 'E-mail, WhatsApp e mensagens', shortLabel: 'Mensagens' },
  { id: 'blog_seo', label: 'Blog, SEO e artigos', shortLabel: 'Blog / SEO' },
  /** Agentes listados na aba Experts do Neuro Designer (super admin marca no módulo). */
  { id: 'neuro_designer', label: 'Neuro Designer', shortLabel: 'Neuro Designer' },
];

/** Slug da categoria reservada à aba Experts dentro do Neuro Designer. */
export const NEURO_DESIGNER_GENERATOR_CATEGORY_ID = 'neuro_designer';

/** Categorias mostradas como filtros no Gerador de Conteúdo global (Experts fica só no Neuro Designer). */
export const MODULE_GENERATOR_CATEGORIES_MAIN_UI = MODULE_GENERATOR_CATEGORIES.filter(
  (c) => c.id !== NEURO_DESIGNER_GENERATOR_CATEGORY_ID,
);

const VALID_IDS = new Set(MODULE_GENERATOR_CATEGORIES.map((c) => c.id));

function dedupeValidIdsPreserveOrder(ids) {
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (typeof id !== 'string' || !VALID_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Lista de categorias do módulo (sempre pelo menos `geral`). */
export function getModuleGeneratorCategoryIds(config) {
  if (!config || typeof config !== 'object') return ['geral'];
  if (Array.isArray(config.generator_categories) && config.generator_categories.length > 0) {
    const valid = dedupeValidIdsPreserveOrder(config.generator_categories);
    if (valid.length > 0) return valid;
  }
  const legacy = config.generator_category;
  if (typeof legacy === 'string' && VALID_IDS.has(legacy)) return [legacy];
  return ['geral'];
}

/** Primeira categoria (útil para compatibilidade). */
export function getModuleGeneratorCategoryId(config) {
  return getModuleGeneratorCategoryIds(config)[0];
}

export function getModuleGeneratorCategoryMeta(config) {
  const id = getModuleGeneratorCategoryId(config);
  return MODULE_GENERATOR_CATEGORIES.find((c) => c.id === id) || MODULE_GENERATOR_CATEGORIES[0];
}

export function getModuleGeneratorCategoryMetas(config) {
  return getModuleGeneratorCategoryIds(config).map(
    (id) => MODULE_GENERATOR_CATEGORIES.find((c) => c.id === id) || MODULE_GENERATOR_CATEGORIES[0],
  );
}

/** Módulo aparece no filtro se tiver essa categoria na lista. */
export function moduleHasGeneratorCategory(config, categoryId) {
  return getModuleGeneratorCategoryIds(config).includes(categoryId);
}

/**
 * Para gravar no JSON: só `generator_categories`, remove legado `generator_category`.
 */
export function normalizeGeneratorCategoriesForSave(config) {
  if (!config || typeof config !== 'object') {
    return { generator_categories: ['geral'] };
  }
  const out = { ...config };
  delete out.generator_category;
  let ids = dedupeValidIdsPreserveOrder(Array.isArray(out.generator_categories) ? out.generator_categories : []);
  if (ids.length === 0) {
    ids = getModuleGeneratorCategoryIds(config);
  }
  out.generator_categories = ids.length > 0 ? ids : ['geral'];
  return out;
}

/**
 * Ao abrir o formulário: garante `generator_categories` preenchido e remove chave legada do objeto em memória.
 */
export function prepareModuleConfigForEditor(config) {
  const base = config && typeof config === 'object' ? { ...config } : {};
  const ids = getModuleGeneratorCategoryIds(base);
  delete base.generator_category;
  base.generator_categories = ids;
  return base;
}
