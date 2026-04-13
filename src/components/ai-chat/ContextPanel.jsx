import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  Folder,
  Plus,
  FileText,
  Loader2,
  Trash2,
  Edit,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
  fetchClientsWithContextCounts,
  fetchClientContexts,
  createClientContext,
  updateClientContext,
  deleteClientContext,
} from '@/lib/aiChatContexts';

/**
 * Painel de Contextos usado pelo Chat IA.
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - user: objeto de usuário atual (precisamos de user.id)
 * - selectedContextIds: number[] ids de client_contexts selecionados para este chat
 * - onChangeSelected: (ids: number[]) => void
 * - selectedClientProfileIds: number[] ids de clients cuja ficha de cadastro entra no contexto
 * - onChangeSelectedClientProfiles: (ids: number[]) => void
 */
const ContextPanel = ({
  open,
  onClose,
  user,
  selectedContextIds = [],
  onChangeSelected,
  selectedClientProfileIds = [],
  onChangeSelectedClientProfiles,
}) => {
  const { toast } = useToast();

  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingContexts, setIsLoadingContexts] = useState(false);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);

  const [contexts, setContexts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editingContext, setEditingContext] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const resetEditor = () => {
    setIsEditing(false);
    setEditingContext(null);
    setDraftName('');
    setDraftContent('');
    setIsSaving(false);
  };

  const handleClose = () => {
    resetEditor();
    onClose?.();
  };

  const loadClients = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingClients(true);
    try {
      const data = await fetchClientsWithContextCounts(user.id);
      setClients(data);
      if (data.length > 0 && !selectedClientId) {
        setSelectedClientId(data[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes para Contextos', error);
      toast({
        title: 'Erro ao carregar clientes',
        description: error.message || 'Não foi possível carregar a lista de clientes.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingClients(false);
    }
  }, [user?.id, selectedClientId, toast]);

  const loadContexts = useCallback(
    async (clientId) => {
      if (!clientId) return;
      setIsLoadingContexts(true);
      try {
        const data = await fetchClientContexts(clientId);
        setContexts(data);
      } catch (error) {
        console.error('Erro ao carregar contextos', error);
        toast({
          title: 'Erro ao carregar contextos',
          description: error.message || 'Não foi possível carregar os contextos deste cliente.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingContexts(false);
      }
    },
    [toast]
  );

  // Carregar clientes ao abrir o painel
  useEffect(() => {
    if (open) {
      loadClients();
    }
  }, [open, loadClients]);

  // Carregar contextos ao mudar cliente selecionado
  useEffect(() => {
    if (open && selectedClientId) {
      loadContexts(selectedClientId);
    } else {
      setContexts([]);
    }
  }, [open, selectedClientId, loadContexts]);

  const handleSelectClient = (clientId) => {
    setSelectedClientId(clientId);
    resetEditor();
  };

  const handleToggleSelected = (contextId) => {
    if (!onChangeSelected) return;
    const exists = selectedContextIds.includes(contextId);
    const next = exists
      ? selectedContextIds.filter((id) => id !== contextId)
      : [...selectedContextIds, contextId];
    onChangeSelected(next);
  };

  const handleToggleClientProfile = (clientId) => {
    if (!onChangeSelectedClientProfiles) return;
    const exists = selectedClientProfileIds.includes(clientId);
    const next = exists
      ? selectedClientProfileIds.filter((id) => id !== clientId)
      : [...selectedClientProfileIds, clientId];
    onChangeSelectedClientProfiles(next);
  };

  const startCreateContext = () => {
    setEditingContext(null);
    setDraftName('');
    setDraftContent('');
    setIsEditing(true);
  };

  const startEditContext = (ctx) => {
    setEditingContext(ctx);
    setDraftName(ctx.name || '');
    setDraftContent(ctx.content || '');
    setIsEditing(true);
  };

  const handleSaveContext = async () => {
    if (!selectedClientId) {
      toast({ title: 'Selecione um cliente', description: 'Escolha um cliente para adicionar o contexto.' });
      return;
    }
    if (!draftContent.trim()) {
      toast({ title: 'Descreva o contexto', description: 'O campo de descrição do contexto não pode ficar vazio.' });
      return;
    }

    setIsSaving(true);
    try {
      let saved;
      if (editingContext?.id) {
        saved = await updateClientContext(editingContext.id, {
          name: draftName,
          content: draftContent,
        });
        setContexts((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
      } else {
        saved = await createClientContext({
          clientId: selectedClientId,
          name: draftName,
          content: draftContent,
        });
        setContexts((prev) => [saved, ...prev]);
      }

      toast({
        title: 'Contexto salvo',
        description: editingContext ? 'Contexto atualizado com sucesso.' : 'Novo contexto criado.',
      });

      // Atualizar contagem de contextos no cliente atual
      setClients((prev) =>
        prev.map((c) =>
          c.id === selectedClientId
            ? { ...c, contextCount: (c.contextCount || 0) + (editingContext ? 0 : 1) }
            : c
        )
      );

      resetEditor();
    } catch (error) {
      console.error('Erro ao salvar contexto', error);
      toast({
        title: 'Erro ao salvar contexto',
        description: error.message || 'Não foi possível salvar o contexto.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteContext = async (ctx) => {
    if (!ctx?.id) return;
    try {
      await deleteClientContext(ctx.id);
      setContexts((prev) => prev.filter((c) => c.id !== ctx.id));
      setClients((prev) =>
        prev.map((c) =>
          c.id === ctx.client_id ? { ...c, contextCount: Math.max((c.contextCount || 1) - 1, 0) } : c
        )
      );
      onChangeSelected?.(selectedContextIds.filter((id) => id !== ctx.id));
      toast({ title: 'Contexto excluído' });
    } catch (error) {
      console.error('Erro ao excluir contexto', error);
      toast({
        title: 'Erro ao excluir contexto',
        description: error.message || 'Não foi possível excluir o contexto.',
        variant: 'destructive',
      });
    }
  };

  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients;
    return clients.filter((c) =>
      (c.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clients, searchTerm]);

  const filteredContexts = useMemo(() => {
    if (!searchTerm) return contexts;
    return contexts.filter((ctx) =>
      `${ctx.name || ''} ${ctx.content || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [contexts, searchTerm]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-2 md:px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-6xl h-[85vh] md:h-[88vh] rounded-2xl bg-card shadow-xl border relative flex flex-col overflow-hidden"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between border-b px-4 py-3 gap-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Info className="h-4 w-4 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">Pessoais</span>
                  <span className="text-xs text-muted-foreground">
                    Ative contextos para personalizar as respostas da IA.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente ou contexto..."
                    className="pl-8 h-9 w-56"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={handleClose}
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x">
              {/* Coluna de pastas (clientes) */}
              <div className="w-full md:w-1/3 p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pastas
                  </span>
                </div>
                {isLoadingClients ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum cliente encontrado. Cadastre clientes para organizar seus contextos.
                  </p>
                ) : (
                  <ScrollArea className="h-[64vh] pr-2">
                    <div className="grid grid-cols-1 gap-2">
                      {filteredClients.map((client) => {
                        const isActive = client.id === selectedClientId;
                        return (
                          <div
                            key={client.id}
                            className={[
                              'flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-colors',
                              isActive
                                ? 'bg-primary/10 border-primary text-foreground'
                                : 'bg-muted/40 hover:bg-muted border-border',
                            ].join(' ')}
                          >
                            <button
                              type="button"
                              onClick={() => handleSelectClient(client.id)}
                              className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg py-1 pl-1 pr-0 text-left"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="truncate text-sm font-medium">{client.name}</span>
                              </div>
                              <span className="shrink-0 text-[11px] font-semibold rounded-full bg-background px-2 py-0.5 text-muted-foreground">
                                {client.contextCount ?? 0}
                              </span>
                            </button>
                            <div
                              className="flex shrink-0 flex-col items-center gap-0.5 border-l border-border/60 pl-2"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                              role="presentation"
                              title="Incluir dados da ficha de cadastro deste cliente no chat"
                            >
                              <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                                Ficha
                              </span>
                              <Switch
                                checked={selectedClientProfileIds.includes(client.id)}
                                onCheckedChange={() => handleToggleClientProfile(client.id)}
                                aria-label={`Incluir ficha de ${client.name || 'cliente'} no contexto`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Coluna de contextos */}
              <div className="flex-1 p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Contextos
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5 rounded-full"
                    onClick={startCreateContext}
                    disabled={!selectedClientId}
                  >
                    <Plus className="h-4 w-4" />
                    Contexto
                  </Button>
                </div>

                {selectedClientId == null ? (
                  <p className="text-sm text-muted-foreground">
                    Selecione um cliente na coluna ao lado para visualizar ou criar contextos.
                  </p>
                ) : isLoadingContexts ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredContexts.length === 0 && !isEditing ? (
                  <div className="flex flex-col items-center justify-center h-32 rounded-xl border border-dashed text-center px-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Nenhum contexto cadastrado para este cliente.
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={startCreateContext}>
                      <FileText className="h-4 w-4 mr-2" />
                      Criar primeiro contexto
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="h-[64vh] pr-2">
                    <div className="space-y-3">
                      {filteredContexts.map((ctx) => {
                        const isSelected = selectedContextIds.includes(ctx.id);
                        return (
                          <div
                            key={ctx.id}
                            className="rounded-xl border border-border/70 bg-background/40 p-3 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                                    Contexto
                                  </span>
                                  <Switch
                                    checked={isSelected}
                                    onCheckedChange={() => handleToggleSelected(ctx.id)}
                                  />
                                </div>
                                <p className="font-medium text-sm text-foreground">
                                  {ctx.name || 'Sem título'}
                                </p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => startEditContext(ctx)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteContext(ctx)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words line-clamp-3">
                              {ctx.content}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}

                {/* Editor de contexto (novo ou edição) */}
                {selectedClientId != null && isEditing && (
                  <div className="mt-3 rounded-xl border border-dashed bg-background/40 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {editingContext ? 'Editar contexto' : 'Novo contexto'}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={resetEditor}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Nome do contexto (opcional)"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Textarea
                      placeholder="Descreva o contexto que a IA deve considerar (objetivos, público, tom, produtos, etc.)"
                      value={draftContent}
                      onChange={(e) => setDraftContent(e.target.value)}
                      className="min-h-[80px] max-h-[180px] text-sm resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={resetEditor}>
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveContext}
                        disabled={isSaving}
                      >
                        {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Salvar contexto
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ContextPanel;

