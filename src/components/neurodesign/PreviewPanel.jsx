import React, { useState } from 'react';
import { Loader2, Download, Sparkles, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import RefineImageForm from '@/components/neurodesign/RefineImageForm';

const isDemoPlaceholder = (url) => url && typeof url === 'string' && url.includes('placehold.co');

const PreviewPanel = ({ project, user, selectedImage, images, isGenerating, isRefining, onRefine, onDownload, onSelectImage, hasImageConnection = true }) => {
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const imageUrl = selectedImage?.url || selectedImage?.thumbnail_url;
  const isLoading = isGenerating || isRefining;
  const showDemoNotice = !isLoading && imageUrl && isDemoPlaceholder(imageUrl);

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 min-h-0 max-w-[900px] xl:max-w-[1000px] mx-auto w-full">
      <div className="flex-1 min-h-0 max-h-[70vh] rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
        {isLoading && (
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p>{isRefining ? 'Refinando...' : 'Gerando...'}</p>
          </div>
        )}
        {!isLoading && !imageUrl && (
          <div className="flex flex-col items-center gap-4 text-muted-foreground text-center px-6">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="h-10 w-10 text-primary/60" />
            </div>
            <p className="font-medium">Aguardando criação</p>
            <p className="text-sm">Configure o builder à esquerda e clique em &quot;Gerar Imagem&quot;.</p>
          </div>
        )}
        {!isLoading && imageUrl && (
          <div className="w-full h-full flex flex-col p-4 overflow-y-auto min-h-0">
            <RefineImageForm
              imageUrl={imageUrl}
              projectId={project?.id}
              user={user}
              onRefine={onRefine}
              disabled={isRefining}
              hasImageConnection={hasImageConnection}
              renderPreviewActions={() => (
                <>
                  <Button size="sm" variant="secondary" onClick={() => setFullscreenOpen(true)}>
                    <Maximize2 className="h-4 w-4 mr-1" /> Tela cheia
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onDownload?.(imageUrl)}>
                    <Download className="h-4 w-4 mr-1" /> Download
                  </Button>
                </>
              )}
            />
            {showDemoNotice && (
              <div className="mt-3 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-700 dark:text-amber-200 text-sm text-center max-w-md">
                Modo demonstração: imagem de exemplo. Selecione uma conexão de imagem (ex.: OpenRouter) no builder para gerar imagens reais.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Criações desta galeria */}
      {images.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border min-w-0 flex-shrink-0">
          <p className="text-xs text-muted-foreground font-medium mb-2">Criações desta galeria</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.slice(0, 5).map((img) => {
              const url = img.url || img.thumbnail_url;
              const isSelected = selectedImage?.id === img.id;
              return (
                <div
                  key={img.id}
                  className={cn(
                    'w-20 h-20 shrink-0 rounded-lg overflow-hidden border-2 transition-all bg-muted/50',
                    isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
                  )}
                >
                  <button
                    type="button"
                    className="relative block w-full h-full focus:outline-none focus:ring-0"
                    onClick={() => onSelectImage?.(img)}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity bg-foreground/40 flex items-center justify-center">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); onDownload?.(url); }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal tela cheia para a arte gerada */}
      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent
          className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 gap-0 border-0 bg-background/95 dark:bg-black/95 overflow-hidden [&>button]:hidden"
          onPointerDownOutside={() => setFullscreenOpen(false)}
          onEscapeKeyDown={() => setFullscreenOpen(false)}
        >
          <button
            type="button"
            onClick={() => setFullscreenOpen(false)}
            className="absolute top-4 right-4 z-50 rounded-full bg-foreground/80 p-2 text-background hover:bg-foreground transition-colors"
            aria-label="Fechar tela cheia"
          >
            <X className="h-6 w-6" />
          </button>
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Arte em tela cheia"
              className="max-w-[95vw] max-h-[95vh] w-auto h-auto object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PreviewPanel;
