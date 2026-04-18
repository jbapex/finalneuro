import React from 'react';
import { LayoutGrid, Image as ImageIcon, Wand2, GraduationCap, GalleryHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

const NeuroDesignSidebar = ({
  view,
  setView,
  onCloseDrawer,
  wrapperClassName,
  projects = [],
  selectedProject,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  title = 'NeuroDesign',
  subtitle,
  /** Bloco com título no topo da sidebar (ex.: Artes de Culto). NeuroDesign fica só com o menu. */
  showBrandHeader = false,
  /** Aba Experts (Gerador categoria Neuro Designer); desligar em variantes que partilham esta sidebar (ex.: Artes de Culto). */
  showExpertsTab = true,
  /** Aba Carrossel (NeuroDesign); desligar em Artes de Culto / variantes sem fluxo completo. */
  showCarouselTab = true,
}) => {
  const handleSetView = (v) => {
    setView(v);
    onCloseDrawer?.();
  };

  const asideClass = wrapperClassName ?? 'w-64 shrink-0 border-r border-border bg-background flex flex-col';
  return (
    <aside className={asideClass}>
      {showBrandHeader ? (
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      ) : null}
      <nav className="flex min-h-0 flex-1 flex-col p-2">
        <button
          type="button"
          onClick={() => handleSetView('gallery')}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            view === 'gallery' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <ImageIcon className="h-4 w-4" />
          Minha Galeria
        </button>
        <button
          type="button"
          onClick={() => handleSetView('create')}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors mt-2',
            view === 'create' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <LayoutGrid className="h-4 w-4" />
          Criar
        </button>
        <button
          type="button"
          onClick={() => handleSetView('refine')}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors mt-2',
            view === 'refine' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <Wand2 className="h-4 w-4" />
          Refinamento
        </button>
        {showCarouselTab && (
          <button
            type="button"
            onClick={() => handleSetView('carousel')}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors mt-2',
              view === 'carousel' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <GalleryHorizontal className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">Carrossel</span>
            <span className="ml-auto shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              Beta
            </span>
          </button>
        )}
        {showExpertsTab && (
          <button
            type="button"
            onClick={() => handleSetView('experts')}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors mt-2',
              view === 'experts' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <GraduationCap className="h-4 w-4" />
            Experts
          </button>
        )}
      </nav>
    </aside>
  );
};

export default NeuroDesignSidebar;
