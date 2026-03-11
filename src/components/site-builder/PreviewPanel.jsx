import React, { useMemo } from 'react';
import { applyModuleColors } from '@/lib/applyModuleColors';

const IFRAME_BODY_STYLE = [
  'html, body { margin: 0; font-family: sans-serif; background: #fff; overflow-x: auto; overflow-y: auto; min-height: 100%; }',
  '#root { min-width: min-content; }',
].join(' ');

/** Google Fonts variadas para tipografia personalizada (evitar look genérico). */
const GOOGLE_FONTS_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&family=DM+Serif+Display&family=Space+Grotesk:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,600;0,700&family=Manrope:wght@400;500;600;700&display=swap">';

/** Escapa conteúdo para injeção no documento do iframe (evita quebrar </script>, </body>, </html>). */
function escapeHtmlForIframe(html) {
  if (html == null || typeof html !== 'string') return '';
  return html
    .replace(/<\/script>/gi, '<\\/script>')
    .replace(/<\/body>/gi, '<\\/body>')
    .replace(/<\/html>/gi, '<\\/html>');
}

/** Script injetado no iframe: envia postMessage ao pai em cliques em elementos com data-id. */
const PREVIEW_CLICK_SCRIPT = `
(function(){
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el !== document.body) {
      var id = el.getAttribute('data-id');
      if (id) {
        var type = el.getAttribute('data-type') || '';
        if (el.tagName === 'IMG') type = 'image';
        else if (!type) type = 'text';
        window.parent.postMessage({
          type: 'site-preview-click',
          dataId: id,
          dataType: type,
          tagName: el.tagName,
          textContent: el.textContent ? el.textContent.trim().slice(0, 2000) : '',
          src: el.src || ''
        }, '*');
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      el = el.parentElement;
    }
  });
})();
`;

/**
 * Monta o HTML completo para o iframe a partir de pageStructure (módulos),
 * aplicando backgroundColor e textColor de cada módulo no elemento raiz.
 */
function buildHtmlFromPageStructure(pageStructure) {
  if (!pageStructure || !Array.isArray(pageStructure) || pageStructure.length === 0) {
    return '';
  }
  const parts = pageStructure.map((module) =>
    applyModuleColors(
      module.html || '',
      module.backgroundColor,
      module.textColor
    )
  );
  const combinedHtml = escapeHtmlForIframe(parts.join('\n'));
  return [
    '<!DOCTYPE html>',
    '<html lang="pt-BR">',
    '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">',
    GOOGLE_FONTS_LINK,
    '<script src="https://cdn.tailwindcss.com"></script>',
    '<style>' + IFRAME_BODY_STYLE + '</style>',
    '</head><body><div id="root">',
    combinedHtml,
    '</div><script>' + PREVIEW_CLICK_SCRIPT + '<\\/script></body></html>',
  ].join('');
}

const PreviewPanel = ({
  pageStructure,
  setPageStructure,
  htmlContent,
  setHtmlContent,
  selectedElement,
  setSelectedElement,
  onOpenImageBank,
  isBuilding,
  setIsBuilding,
}) => {
  const fullHtml = useMemo(() => {
    if (pageStructure && pageStructure.length > 0) {
      return buildHtmlFromPageStructure(pageStructure);
    }
    const safeContent = escapeHtmlForIframe(htmlContent || '');
    const hasContent = safeContent.trim().length > 0;
    const rootContent = hasContent
      ? safeContent
      : '<p style="padding:1.5rem;color:#666;font-size:0.875rem;">Nenhum conteúdo ainda. Use o painel ao lado para criar sua página.</p>';
    return [
      '<!DOCTYPE html>',
      '<html lang="pt-BR">',
      '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">',
      GOOGLE_FONTS_LINK,
      '<script src="https://cdn.tailwindcss.com"></script>',
      '<style>' + IFRAME_BODY_STYLE + '</style>',
      '</head><body><div id="root">',
      rootContent,
      '</div><script>' + PREVIEW_CLICK_SCRIPT + '<\\/script></body></html>',
    ].join('');
  }, [pageStructure, htmlContent]);

  return (
    <div className="relative flex-1 min-h-0 w-full min-w-0 h-full min-h-[400px] overflow-hidden">
      {isBuilding && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <p className="text-sm text-muted-foreground">Construindo sua página...</p>
        </div>
      )}
      <iframe
        srcDoc={fullHtml}
        title="Preview do site"
        className="w-full h-full min-h-[400px] border-0"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
};

export default PreviewPanel;
