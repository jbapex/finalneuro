import React from 'react';

/**
 * Painel de chat com IA do Criador de Site.
 * Aceita pageStructure (modal) ou htmlContent (superadmin/mobile).
 * Implementação mínima para compilação; expandir conforme necessário.
 */
const ChatPanel = ({
  pageStructure,
  setPageStructure,
  htmlContent,
  setHtmlContent,
  setIsBuilding,
  flowContext,
  selectedElement,
  setSelectedElement,
  onOpenImageBank,
  isBuilding,
}) => (
  <div className="flex flex-col h-full p-4 border rounded-lg bg-card">
    <p className="text-sm text-muted-foreground">Chat com IA (painel de módulos / conteúdo)</p>
    {pageStructure != null && <p className="text-xs mt-2">{pageStructure?.length ?? 0} módulos</p>}
    {htmlContent != null && <p className="text-xs mt-2">Modo html_content</p>}
  </div>
);

export default ChatPanel;
