import React from 'react';
import { LayoutGrid, Image as ImageIcon, Wand2 } from 'lucide-react';
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
  subtitle = 'Design Builder',
}) => {
  const handleSetView = (v) => {
    setView(v);
    onCloseDrawer?.();
  };

  const asideClass = wrapperClassName ?? 'w-64 shrink-0 border-r border-border bg-background flex flex-col';
  return (
    <aside className={asideClass}>
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-lg text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </div>
      <nav className="p-2 flex flex-col flex-1 min-h-0">
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
      </nav>
    </aside>
  );
};

export default NeuroDesignSidebar;
