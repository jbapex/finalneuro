/** Galeria de carrosséis nomeados (localStorage por utilizador, máx. 5). */

export const MAX_CARROSSEL_GALLERY_SAVES = 5;

const GALLERY_KEY_PREFIX = 'neurodesign-carrossel-gallery-v1:';

export function carrosselGalleryStorageKey(userId) {
  return `${GALLERY_KEY_PREFIX}${String(userId)}`;
}

/** Payload colocado antes de `navigate` para a aba Carrossel; o editor consome e remove. */
export const NEURODESIGN_CARROSSEL_OPEN_SESSION_KEY = 'neurodesign-carrossel-open-payload-v1';

export function readCarrosselGallerySaves(userId) {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(carrosselGalleryStorageKey(userId));
    if (!raw) return [];
    const p = JSON.parse(raw);
    if (!Array.isArray(p)) return [];
    return p.filter(
      (x) =>
        x &&
        typeof x.id === 'string' &&
        typeof x.name === 'string' &&
        x.payload &&
        Array.isArray(x.payload.slides) &&
        x.payload.slides.length > 0
    );
  } catch {
    return [];
  }
}

/** @returns {boolean} `false` se falhar (ex.: quota do localStorage). */
export function writeCarrosselGallerySaves(userId, list) {
  if (!userId) return false;
  try {
    const trimmed = list.slice(0, MAX_CARROSSEL_GALLERY_SAVES);
    localStorage.setItem(carrosselGalleryStorageKey(userId), JSON.stringify(trimmed));
    return true;
  } catch {
    return false;
  }
}

/** Dispara após guardar/remover na galeria para atualizar listas noutros painéis. */
export const NEURODESIGN_CARROSSEL_GALLERY_UPDATED_EVENT = 'neurodesign-carrossel-gallery-updated';

export function notifyCarrosselGalleryUpdated() {
  try {
    window.dispatchEvent(new Event(NEURODESIGN_CARROSSEL_GALLERY_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

/** Abrir no editor: consome `CarrosselTab` ao entrar na rota `.../carrossel`. */
export function stashCarrosselEditorLoad({ payload, name, galleryEntryId }) {
  try {
    sessionStorage.setItem(
      NEURODESIGN_CARROSSEL_OPEN_SESSION_KEY,
      JSON.stringify({
        payload,
        name: name || '',
        ...(typeof galleryEntryId === 'string' && galleryEntryId ? { galleryEntryId } : {}),
      })
    );
  } catch {
    /* ignore */
  }
}
