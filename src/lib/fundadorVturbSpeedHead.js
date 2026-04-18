/**
 * Snippet opcional “Otimizar velocidade” VTurb / Converte AI para injetar no <head>
 * (script _plt + link preload / dns-prefetch). Só hosts permitidos.
 */

const ALLOWED_LINK_REL = new Set(['preload', 'dns-prefetch', 'preconnect', 'prefetch']);

export function isAllowedVturbSpeedHeadHostname(hostname) {
  const h = String(hostname).toLowerCase();
  if (h === 'scripts.converteai.net') return true;
  if (h.endsWith('.converteai.net')) return true;
  if (h === 'api.vturb.com.br') return true;
  if (h.endsWith('.vturb.com.br')) return true;
  return false;
}

/**
 * @returns {HTMLElement[]}
 */
export function buildFundadorVturbSpeedHeadNodes(raw) {
  if (typeof document === 'undefined') return [];
  const html = String(raw).trim();
  if (!html) return [];

  const tpl = document.createElement('template');
  tpl.innerHTML = html;

  const out = [];
  for (const node of tpl.content.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) continue;
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = /** @type {HTMLElement} */ (node);
    const tag = el.tagName.toLowerCase();

    if (tag === 'script') {
      if (el.getAttribute('src')) continue;
      const text = el.textContent || '';
      if (!/\b_plt\b/.test(text)) continue;
      const s = document.createElement('script');
      s.textContent = text;
      out.push(s);
      continue;
    }

    if (tag !== 'link') continue;

    const rel = (el.getAttribute('rel') || '').toLowerCase().trim();
    if (!ALLOWED_LINK_REL.has(rel)) continue;

    const hrefRaw = el.getAttribute('href');
    if (!hrefRaw || !String(hrefRaw).trim()) continue;

    let u;
    try {
      u = new URL(String(hrefRaw).trim());
    } catch {
      continue;
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
    const httpsHref =
      u.protocol === 'http:' ? `https://${u.host}${u.pathname}${u.search}${u.hash}` : u.href;

    let host;
    try {
      host = new URL(httpsHref).hostname;
    } catch {
      continue;
    }
    if (!isAllowedVturbSpeedHeadHostname(host)) continue;

    const link = document.createElement('link');
    link.setAttribute('rel', el.getAttribute('rel') || rel);
    link.setAttribute('href', httpsHref);
    const asVal = el.getAttribute('as');
    if (asVal) link.setAttribute('as', asVal);
    if (el.hasAttribute('crossorigin')) {
      link.setAttribute('crossorigin', el.getAttribute('crossorigin') || '');
    }
    const type = el.getAttribute('type');
    if (type) link.setAttribute('type', type);
    const media = el.getAttribute('media');
    if (media) link.setAttribute('media', media);
    const fetchPriority = el.getAttribute('fetchpriority');
    if (fetchPriority) link.setAttribute('fetchpriority', fetchPriority);
    out.push(link);
  }

  return out;
}
