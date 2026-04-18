import React from 'react';
import { Construction } from 'lucide-react';
import CarrosselTab from '@/components/neurodesign/CarrosselTab';

/**
 * Aba Carrossel: sem permissão = "em construção"; com permissão (super admin) = editor CarrosselTab.
 */
export default function NeuroDesignCarouselPanel({
  hasBetaAccess,
  llmConnections,
  selectedLlmId,
  onSelectLlmId,
  imageConnections,
  user,
  onOpenNavigation,
}) {
  if (hasBetaAccess) {
    return (
      <CarrosselTab
        llmConnections={llmConnections}
        selectedLlmId={selectedLlmId}
        onSelectLlmId={onSelectLlmId}
        imageConnections={imageConnections}
        user={user}
        onOpenNavigation={onOpenNavigation}
      />
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Construction className="h-8 w-8" />
      </div>
      <div className="max-w-md space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Em construção</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          A aba Carrossel estará disponível em breve. Peça ao administrador o acesso antecipado ou aguarde a
          disponibilidade geral no NeuroDesign.
        </p>
      </div>
    </div>
  );
}
