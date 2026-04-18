/**
 * TikTok Pixel — inicialização e PageView (SPA).
 * ID efetivo: system_branding.tiktok_pixel_id (Super Admin) ou VITE_TIKTOK_PIXEL_ID.
 */

/** ID do pixel TikTok (Events Manager): alfanumérico, típico 10–64 caracteres. */
export function normalizeTikTokPixelId(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(s)) return '';
  return s;
}

let initializedPixelId = null;

/**
 * Bootstrap oficial da fila `ttq` (TikTok Events API) antes de `ttq.load`.
 */
function installTikTokQueueOnce() {
  if (typeof window === 'undefined') return;
  if (window.ttq) return;

  const w = window;
  const d = document;
  const t = 'ttq';
  w.TiktokAnalyticsObject = t;
  const ttq = (w[t] = w[t] || []);
  // Alinhado ao snippet oficial do TikTok Events Manager (bootstrap da fila antes de ttq.load).
  ttq.methods = [
    'page',
    'track',
    'identify',
    'instances',
    'debug',
    'on',
    'off',
    'once',
    'ready',
    'alias',
    'group',
    'enableCookie',
    'disableCookie',
    'holdConsent',
    'revokeConsent',
    'grantConsent',
  ];
  ttq.setAndDefer = function (target, method) {
    target[method] = function () {
      target.push([method].concat(Array.prototype.slice.call(arguments, 0)));
    };
  };
  for (let i = 0; i < ttq.methods.length; i++) {
    ttq.setAndDefer(ttq, ttq.methods[i]);
  }
  ttq.instance = function (id) {
    const inst = ttq._i[id] || [];
    for (let n = 0; n < ttq.methods.length; n++) {
      ttq.setAndDefer(inst, ttq.methods[n]);
    }
    return inst;
  };
  ttq.load = function (pixelId, opts) {
    const base = 'https://analytics.tiktok.com/i18n/pixel/events.js';
    ttq._i = ttq._i || {};
    ttq._i[pixelId] = [];
    ttq._i[pixelId]._u = base;
    ttq._t = ttq._t || {};
    ttq._t[pixelId] = +new Date();
    ttq._o = ttq._o || {};
    ttq._o[pixelId] = opts || {};
    const o = d.createElement('script');
    o.type = 'text/javascript';
    o.async = true;
    o.src = `${base}?sdkid=${encodeURIComponent(pixelId)}&lib=${t}`;
    o.dataset.tiktokPixel = 'events';
    const first = d.getElementsByTagName('script')[0];
    first.parentNode.insertBefore(o, first);
  };
}

/**
 * Inicializa o pixel uma vez por ID (PageView é disparado pelo route tracker).
 * @returns {boolean} true se ficou ativo para este ID
 */
export function initTikTokPixel(pixelId) {
  const id = normalizeTikTokPixelId(pixelId);
  if (!id || typeof window === 'undefined') return false;
  if (initializedPixelId === id) return true;
  if (initializedPixelId) return false;

  installTikTokQueueOnce();
  window.ttq.load(id);
  initializedPixelId = id;
  return true;
}

export function getInitializedTikTokPixelId() {
  return initializedPixelId;
}

export function trackTikTokPageView() {
  if (typeof window === 'undefined' || !initializedPixelId) return;
  const ttq = window.ttq;
  if (!ttq || typeof ttq.page !== 'function') return;
  try {
    ttq.page();
  } catch {
    /* ignore */
  }
}
