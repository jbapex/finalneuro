/**
 * Meta (Facebook) Pixel — inicialização e eventos.
 * ID efetivo vem de system_branding (Super Admin) ou VITE_META_PIXEL_ID.
 */

/** Extrai só dígitos; exige comprimento típico de pixel Meta. */
export function normalizeMetaPixelId(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 20) return '';
  return digits;
}

let initializedPixelId = null;

function injectFbqStub() {
  if (typeof window === 'undefined') return;
  const f = window;
  if (f.fbq) return;
  const n = function fbqStub() {
    // eslint-disable-next-line prefer-rest-params
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  if (!f._fbq) f._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];
  f.fbq = n;
}

function loadFbeventsScript() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('script[data-meta-pixel="fbevents"]')) return;
  const t = document.createElement('script');
  t.async = true;
  t.src = 'https://connect.facebook.net/en_US/fbevents.js';
  t.dataset.metaPixel = 'fbevents';
  const s = document.getElementsByTagName('script')[0];
  s.parentNode.insertBefore(t, s);
}

/**
 * Inicializa o pixel uma vez por ID (PageView é disparado pelo route tracker).
 * @returns {boolean} true se ficou ativo para este ID
 */
export function initMetaPixel(pixelId) {
  const id = normalizeMetaPixelId(pixelId);
  if (!id || typeof window === 'undefined') return false;
  if (initializedPixelId === id) return true;
  if (initializedPixelId) return false;

  injectFbqStub();
  loadFbeventsScript();
  window.fbq('init', id);
  initializedPixelId = id;
  return true;
}

export function getInitializedMetaPixelId() {
  return initializedPixelId;
}

export function trackMetaPageView() {
  if (typeof window === 'undefined' || !window.fbq || !initializedPixelId) return;
  window.fbq('track', 'PageView');
}

/** Eventos padrão Meta: Lead, CompleteRegistration, Purchase, etc. */
export function trackMetaStandardEvent(eventName, params) {
  if (typeof window === 'undefined' || !window.fbq || !initializedPixelId) return;
  if (!eventName || typeof eventName !== 'string') return;
  window.fbq('track', eventName, params && typeof params === 'object' ? params : {});
}
