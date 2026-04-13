import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

/** Lixeira discreta no cabeçalho do nó (só quando o nó está selecionado). */
export function FlowNodeHeaderDelete({ nodeId, onRemoveNode, selected }) {
  if (!onRemoveNode || !selected) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="nodrag h-6 w-6 shrink-0 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemoveNode(nodeId);
      }}
      title="Excluir este nó (Delete ou Backspace)"
      aria-label="Excluir este nó"
    >
      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
    </Button>
  );
}
