import { useEffect } from 'react';

/**
 * Monta a URL de destino com a query string atual (UTMs, etc.), como no script clássico de PV.
 * @param {string} baseHref
 * @param {string} search ex.: location.search
 */
export function buildFundadorBackRedirectUrl(baseHref, search) {
  const base = String(baseHref || '').trim();
  if (!base) return '';
  let parsed;
  try {
    parsed = new URL(base);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';

  const q = String(search || '').replace(/^\?/, '');
  if (!q) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${q}`;
}

/**
 * Ao premir «voltar» no browser, redireciona para `targetBaseHref` com a query atual anexada.
 * Só corre na landing /fundador quando `targetBaseHref` é uma URL http(s) válida.
 */
export function useFundadorBackRedirect(targetBaseHref) {
  useEffect(() => {
    const base = String(targetBaseHref || '').trim();
    if (!base) return undefined;

    const urlBackRedirect = buildFundadorBackRedirectUrl(base, window.location.search);
    if (!urlBackRedirect) return undefined;

    const onPopState = () => {
      window.setTimeout(() => {
        window.location.href = urlBackRedirect;
      }, 1);
    };

    window.history.pushState({}, '', window.location.href);
    window.history.pushState({}, '', window.location.href);
    window.history.pushState({}, '', window.location.href);

    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [targetBaseHref]);
}
