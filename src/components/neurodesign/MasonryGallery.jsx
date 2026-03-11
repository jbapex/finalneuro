import React, { useState } from 'react';
import { Download, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MasonryGallery = ({
  images,
  projectId,
  userGalleryMode = false,
  selectedIds = [],
  onSelectImage,
  onDownload,
  onDeleteImage,
}) => {
  const [multiSelect, setMultiSelect] = useState(false);
  const [checked, setChecked] = useState(new Set(selectedIds));

  const toggleCheck = (id) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
  };

  const handleDownloadSelected = () => {
    if (checked.size === 0) return;
    images.filter((img) => checked.has(img.id)).forEach((img) => onDownload?.(img.url || img.thumbnail_url));
  };

  const canShowGrid = projectId || userGalleryMode;
  if (!canShowGrid) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Selecione uma galeria na barra lateral para ver as imagens.
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        {userGalleryMode
          ? 'Você ainda não gerou nenhuma arte no NeuroDesign. Use a aba "Criar" para gerar.'
          : 'Nenhuma imagem gerada ainda. Use a aba "Criar" para gerar.'}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">{userGalleryMode ? 'Minhas artes' : 'Galeria'}</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setMultiSelect(!multiSelect)}>
            {multiSelect ? 'Cancelar seleção' : 'Escolher vários'}
          </Button>
          {multiSelect && checked.size > 0 && (
            <Button size="sm" onClick={handleDownloadSelected}>
              <Download className="h-4 w-4 mr-1" /> Baixar {checked.size} selecionada(s)
            </Button>
          )}
        </div>
      </div>
      <div className="columns-2 sm:columns-3 md:columns-4 gap-4 space-y-4">
        {images.map((img) => {
          const url = img.url || img.thumbnail_url;
          const isSelected = selectedIds?.includes?.(img.id) || checked.has(img.id);
          return (
            <div
              key={img.id}
              className={cn(
                'break-inside-avoid rounded-lg overflow-hidden border-2 transition-all bg-muted/50',
                isSelected && !multiSelect ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
              )}
            >
              <button
                type="button"
                className="relative block w-full aspect-square"
                onClick={() => {
                  if (multiSelect) toggleCheck(img.id);
                  else onSelectImage?.(img);
                }}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
                {multiSelect && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-foreground/60 text-background flex items-center justify-center">
                    {checked.has(img.id) ? <Check className="h-4 w-4" /> : null}
                  </div>
                )}
                <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity bg-foreground/40 flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload?.(url);
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {onDeleteImage && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteImage(img);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MasonryGallery;
