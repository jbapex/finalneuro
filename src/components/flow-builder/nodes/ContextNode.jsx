import React, { memo, useEffect, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const ALL_CONTEXTS_ID = '__all__';

async function loadClientContexts(clientId) {
  const { data: list, error } = await supabase
    .from('client_contexts')
    .select('id, name, content')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return list || [];
}

const ContextNode = memo(({ data, id }) => {
  const { onUpdateNodeData, clients, inputData, selectedClientId, selectedContextId } = data;
  const { toast } = useToast();
  const [contexts, setContexts] = useState(data.contextsList || []);
  const [loadingContexts, setLoadingContexts] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [savingContext, setSavingContext] = useState(false);

  const clientFromUpstream = inputData?.client?.data;
  const hasClientNode = !!clientFromUpstream;

  const selectedClientData = hasClientNode
    ? { id: clientFromUpstream.id, name: clientFromUpstream.name }
    : clients?.find((c) => c.id.toString() === selectedClientId);

  const clientIdForFetch = selectedClientData?.id ?? null;

  useEffect(() => {
    if (!clientIdForFetch) {
      setContexts([]);
      onUpdateNodeData(id, { contextsList: [], selectedContextId: null, output: null });
      return;
    }
    let cancelled = false;
    setLoadingContexts(true);
    (async () => {
      let listSafe = [];
      try {
        listSafe = await loadClientContexts(clientIdForFetch);
      } catch (e) {
        if (!cancelled) {
          toast({ title: 'Erro ao carregar contextos', description: e?.message || String(e), variant: 'destructive' });
        }
      }
      if (cancelled) return;
      setContexts(listSafe);
      setLoadingContexts(false);

      const currentSelected = data.selectedContextId;
      const validSelection =
        currentSelected &&
        (currentSelected === ALL_CONTEXTS_ID || listSafe.some((c) => c.id.toString() === currentSelected));
      const defaultSelection =
        listSafe.length === 1 ? listSafe[0].id.toString() : listSafe.length > 1 ? ALL_CONTEXTS_ID : null;

      onUpdateNodeData(id, {
        contextsList: listSafe,
        selectedContextId: validSelection ? currentSelected : defaultSelection,
      });
    })();
    return () => {
      cancelled = true;
    };
    // Intencional: só recarregar quando o cliente efetivo muda; evita loop com onUpdateNodeData
    // eslint-disable-next-line react-hooks/exhaustive-deps -- data.selectedContextId lido após fetch
  }, [clientIdForFetch, id]);

  const handleClientChange = (clientId) => {
    if (!clientId) {
      onUpdateNodeData(id, { selectedClientId: null, selectedContextId: null, contextsList: [], output: null });
      return;
    }
    onUpdateNodeData(id, { selectedClientId: clientId, selectedContextId: null, output: null });
  };

  const handleContextChange = (contextId) => {
    onUpdateNodeData(id, { selectedContextId: contextId || null });
  };

  useEffect(() => {
    if (!selectedClientData || !onUpdateNodeData) return;
    const ctxId = data.selectedContextId;
    const list = contexts;
    let selectedContexts = [];
    if (ctxId === ALL_CONTEXTS_ID) {
      selectedContexts = list;
    } else if (ctxId && list.length) {
      const one = list.find((c) => c.id.toString() === ctxId);
      if (one) selectedContexts = [one];
    }
    onUpdateNodeData(id, {
      output: {
        id: 'context',
        data: {
          client_id: selectedClientData.id,
          client_name: selectedClientData.name,
          contexts: selectedContexts,
        },
      },
    });
  }, [selectedClientData, data.selectedContextId, contexts, id, onUpdateNodeData]);

  const showClientSelector = !hasClientNode;
  const contextDisabled = !selectedClientData || loadingContexts || contexts.length === 0;

  const openCreateDialog = () => {
    setDraftName('');
    setDraftContent('');
    setCreateOpen(true);
  };

  const saveNewContext = async () => {
    if (!selectedClientData?.id) return;
    const content = String(draftContent || '').trim();
    if (!content) {
      toast({ title: 'Conteúdo obrigatório', description: 'Escreva o texto do contexto.', variant: 'destructive' });
      return;
    }
    setSavingContext(true);
    try {
      const { data: row, error } = await supabase
        .from('client_contexts')
        .insert({
          client_id: selectedClientData.id,
          name: draftName?.trim() || null,
          content,
        })
        .select('id, name, content')
        .single();
      if (error) throw error;
      const next = await loadClientContexts(selectedClientData.id);
      setContexts(next);
      const newId = row.id.toString();
      onUpdateNodeData(id, {
        contextsList: next,
        selectedContextId: newId,
      });
      toast({ title: 'Contexto criado', description: 'Já está selecionado neste nó.' });
      setCreateOpen(false);
    } catch (e) {
      toast({
        title: 'Erro ao criar contexto',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    } finally {
      setSavingContext(false);
    }
  };

  return (
    <>
      <Card className="w-72 border-2 border-violet-500/50 shadow-lg">
        <Handle type="target" position={Position.Left} className="!bg-violet-500" />
        <CardHeader className="flex-row items-center space-x-2 p-3 bg-violet-500/10">
          <FileText className="w-5 h-5 text-violet-500" />
          <CardTitle className="text-base">Contexto</CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          {showClientSelector && (
            <Select onValueChange={handleClientChange} value={selectedClientId || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {hasClientNode && (
            <p className="text-xs text-muted-foreground">
              Cliente: <strong>{clientFromUpstream.name}</strong>
            </p>
          )}
          <div className="flex gap-1.5 items-start">
            <div className="flex-1 min-w-0">
              <Select
                onValueChange={handleContextChange}
                value={data.selectedContextId || ''}
                disabled={contextDisabled}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue
                    placeholder={
                      loadingContexts ? 'Carregando...' : contexts.length === 0 ? 'Nenhum contexto' : 'Qual contexto?'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {contexts.length > 1 && <SelectItem value={ALL_CONTEXTS_ID}>Todos os contextos</SelectItem>}
                  {contexts.map((ctx) => (
                    <SelectItem key={ctx.id} value={ctx.id.toString()}>
                      {ctx.name || `Contexto ${ctx.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              title="Novo contexto"
              disabled={!selectedClientData || loadingContexts}
              onClick={openCreateDialog}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
        <Handle type="source" position={Position.Right} className="!bg-violet-500" />
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Novo contexto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 flex-1 min-h-0 overflow-y-auto">
            <p className="text-xs text-muted-foreground">
              Cliente: <strong>{selectedClientData?.name || '—'}</strong>
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Nome (opcional)</Label>
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Ex.: Tom de voz, Brief 2025"
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Conteúdo</Label>
              <Textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                placeholder="Texto do contexto para a IA..."
                className="min-h-[160px] text-sm resize-y font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} disabled={savingContext}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveNewContext} disabled={savingContext}>
              {savingContext && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

export default ContextNode;
