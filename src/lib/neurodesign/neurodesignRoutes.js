/** Rotas da página NeuroDesign (abas com URL própria). */

export const NEURODESIGN_BASE = '/ferramentas/neurodesign';

/** Slug padrão ao abrir só `/ferramentas/neurodesign`. */
export const NEURODESIGN_DEFAULT_SLUG = 'criar';

export const NEURODESIGN_ENTRY_PATH = `${NEURODESIGN_BASE}/${NEURODESIGN_DEFAULT_SLUG}`;

/** `view` interno → segmento da URL (PT). */
export const NEURODESIGN_VIEW_TO_SLUG = {
  gallery: 'galeria',
  create: 'criar',
  refine: 'refinar',
  carousel: 'carrossel',
  experts: 'experts',
};

/** Slug da URL → `view` do estado. */
export const NEURODESIGN_SLUG_TO_VIEW = Object.fromEntries(
  Object.entries(NEURODESIGN_VIEW_TO_SLUG).map(([view, slug]) => [slug, view])
);

export function neurodesignPathForView(view) {
  const slug = NEURODESIGN_VIEW_TO_SLUG[view] || NEURODESIGN_DEFAULT_SLUG;
  return `${NEURODESIGN_BASE}/${slug}`;
}

export function neurodesignViewFromSlug(slug) {
  if (!slug || typeof slug !== 'string') return null;
  return NEURODESIGN_SLUG_TO_VIEW[slug] || null;
}

/** Query na galeria para destacar a secção de carrosséis guardados. */
export const NEURODESIGN_GALLERY_CARROSSEIS_PARAM = 'carrosseis';

export function neurodesignGalleryCarrosseisUrl() {
  return `${neurodesignPathForView('gallery')}?${NEURODESIGN_GALLERY_CARROSSEIS_PARAM}=1`;
}
