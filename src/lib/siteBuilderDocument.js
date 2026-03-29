import { applyModuleColors } from '@/lib/applyModuleColors';

export const IFRAME_BODY_STYLE = [
  'html, body { margin: 0; font-family: sans-serif; background: #fff; overflow-x: auto; overflow-y: auto; min-height: 100%; }',
  '#root { min-width: min-content; }',
].join(' ');

export const GOOGLE_FONTS_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&family=DM+Serif+Display&family=Space+Grotesk:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,600;0,700&family=Manrope:wght@400;500;600;700&display=swap">';

/** Evita quebrar fechamento prematuro de script/body/html ao injetar HTML no iframe ou documento. */
export function escapeHtmlForIframe(html) {
  if (html == null || typeof html !== 'string') return '';
  return html
    .replace(/<\/script>/gi, '<\\/script>')
    .replace(/<\/body>/gi, '<\\/body>')
    .replace(/<\/html>/gi, '<\\/html>');
}

function escapeHtmlTitle(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** HTML interno (#root) a partir de módulos do criador (fluxo / modal). */
export function buildInnerHtmlFromPageStructure(pageStructure) {
  if (!pageStructure || !Array.isArray(pageStructure) || pageStructure.length === 0) return '';
  const parts = pageStructure.map((module) =>
    applyModuleColors(
      module.html || '',
      module.backgroundColor,
      module.textColor
    )
  );
  return escapeHtmlForIframe(parts.join('\n'));
}

/**
 * Documento completo (preview ou exportação).
 * @param {string} opts.rootInnerHtml — conteúdo de #root (já passado por escapeHtmlForIframe quando aplicável)
 * @param {string} [opts.title]
 * @param {string|null} [opts.editorScript] — script do editor (preview); omitir ou null para ficheiro final
 */
export function buildSiteHtmlDocument({ rootInnerHtml, title = 'Página', editorScript = null }) {
  const safe = typeof rootInnerHtml === 'string' ? rootInnerHtml : '';
  const titleEsc = escapeHtmlTitle(title);
  const parts = [
    '<!DOCTYPE html>',
    '<html lang="pt-BR">',
    '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<title>' + titleEsc + '</title>',
    GOOGLE_FONTS_LINK,
    '<script src="https://cdn.tailwindcss.com"></script>',
    '<style>' + IFRAME_BODY_STYLE + '</style>',
    '</head><body><div id="root">',
    safe,
    '</div>',
  ];
  if (editorScript) {
    parts.push('<script>' + editorScript + '<\\/script>');
  }
  parts.push('</body></html>');
  return parts.join('');
}

/**
 * HTML pronto para subir a public_html (Hostinger, Hostgator, etc.) — sem script de clique do editor.
 */
export function buildDeployableSiteHtml({ htmlContent, pageStructure, title }) {
  let inner = '';
  if (pageStructure && Array.isArray(pageStructure) && pageStructure.length > 0) {
    inner = buildInnerHtmlFromPageStructure(pageStructure);
  } else {
    inner = escapeHtmlForIframe(htmlContent || '');
  }
  if (!inner.trim()) return null;
  return buildSiteHtmlDocument({ rootInnerHtml: inner, title: title || 'Site', editorScript: null });
}

export function triggerDownloadTextFile(content, filename = 'index.html') {
  if (content == null || typeof content !== 'string') return false;
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
