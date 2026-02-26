import React, { useMemo } from 'react';
import { applyModuleColors } from '@/lib/applyModuleColors';

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
  const combinedHtml = parts.join('\n');
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { margin: 0; font-family: sans-serif; }</style>
</head>
<body>
  <div id="root">${combinedHtml}</div>
</body>
</html>
  `.trim();
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
    if (htmlContent) {
      return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { margin: 0; font-family: sans-serif; }</style>
</head>
<body>
  <div id="root">${htmlContent}</div>
</body>
</html>
      `.trim();
    }
    return '<!DOCTYPE html><html><body><div id="root"></div></body></html>';
  }, [pageStructure, htmlContent]);

  return (
    <div className="relative h-full w-full bg-muted/30 rounded-lg overflow-hidden">
      {isBuilding && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <p className="text-sm text-muted-foreground">Construindo sua página...</p>
        </div>
      )}
      <iframe
        srcDoc={fullHtml}
        title="Preview do site"
        className="w-full h-full min-h-[400px] border-0 rounded-lg"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
};

export default PreviewPanel;
