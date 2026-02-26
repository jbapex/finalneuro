import React from 'react';
import { LayoutGrid, Image as ImageIcon, FolderOpen, Plus } from 'lucide-react';
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
}) => {
  const handleSetView = (v) => {
    setView(v);
    onCloseDrawer?.();
  };

  const asideClass = wrapperClassName ?? 'w-64 shrink-0 border-r border-border bg-card flex flex-col';
  return (
    <aside className={asideClass}>
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-lg text-foreground">NeuroDesign</h2>
        <p className="text-xs text-muted-foreground mt-1">Design Builder</p>
      </div>
      {projects.length > 0 && (
        <div className="p-2 border-b border-border">
          <p className="text-xs font-medium text-muted-foreground px-2 mb-1">Galerias</p>
          <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelectProject?.(p);
                  onCloseDrawer?.();
                }}
                className={cn(
                  'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors',
                  selectedProject?.id === p.id
                    ? 'bg-primary/20 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <FolderOpen className="h-4 w-4 shrink-0" />
                <span className="truncate">{p.name || 'Sem nome'}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onCreateProject?.();
              onCloseDrawer?.();
            }}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted mt-1 transition-colors"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Nova galeria
          </button>
        </div>
      )}
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
      </nav>
    </aside>
  );
};

export default NeuroDesignSidebar;
