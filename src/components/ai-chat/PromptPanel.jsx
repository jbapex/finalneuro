import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, FileText, Plus, Loader2, Trash2, Edit, FolderPlus, ChevronDown, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import {
  fetchUserPrompts,
  createUserPrompt,
  updateUserPrompt,
  deleteUserPrompt,
} from '@/lib/aiChatPrompts';

const PromptPanel = ({ open, onClose, user, activePrompt, onSelectPrompt }) => {
  const { toast } = useToast();

  const [prompts, setPrompts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const resetEditor = () => {
    setIsEditing(false);
    setEditingPrompt(null);
    setDraftName('');
    setDraftDescription('');
    setDraftContent('');
    setIsSaving(false);
  };

  const handleClose = () => {
    resetEditor();
    onClose?.();
  };

  const loadPrompts = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const data = await fetchUserPrompts(user.id);
      setPrompts(data);
    } catch (error) {
      console.error('Erro ao carregar prompts', error);
      toast({
        title: 'Erro ao carregar prompts',
        description: error.message || 'Não foi possível carregar seus prompts salvos.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    if (open) {
      loadPrompts();
    }
  }, [open, loadPrompts]);

  const startCreatePrompt = () => {
    setEditingPrompt(null);
    setDraftName('');
    setDraftDescription('');
    setDraftContent('');
    setIsEditing(true);
  };

  const startEditPrompt = (prompt) => {
    setEditingPrompt(prompt);
    setDraftName(prompt.name || '');
    setDraftDescription(prompt.description || '');
    setDraftContent(prompt.content || '');
    setIsEditing(true);
  };

  const handleSavePrompt = async () => {
    if (!user?.id) {
      toast({ title: 'Usuário não encontrado', description: 'Faça login novamente para salvar prompts.' });
      return;
    }
    if (!draftContent.trim()) {
      toast({
        title: 'Descreva o prompt',
        description: 'O texto do prompt não pode ficar vazio.',
      });
      return;
    }

    setIsSaving(true);
    try {
      let saved;
      if (editingPrompt?.id) {
        saved = await updateUserPrompt(editingPrompt.id, {
          name: draftName,
          description: draftDescription,
          content: draftContent,
        });
        setPrompts((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      } else {
        saved = await createUserPrompt({
          userId: user.id,
          name: draftName,
          description: draftDescription,
          content: draftContent,
        });
        setPrompts((prev) => [saved, ...prev]);
      }

      toast({
        title: 'Prompt salvo',
        description: editingPrompt ? 'Prompt atualizado com sucesso.' : 'Novo prompt criado.',
      });

      resetEditor();
    } catch (error) {
      console.error('Erro ao salvar prompt', error);
      toast({
        title: 'Erro ao salvar prompt',
        description: error.message || 'Não foi possível salvar o prompt.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePrompt = async (prompt) => {
    if (!prompt?.id) return;
    try {
      await deleteUserPrompt(prompt.id);
      setPrompts((prev) => prev.filter((p) => p.id !== prompt.id));
      if (activePrompt?.id === prompt.id) {
        onSelectPrompt?.(null);
      }
      toast({ title: 'Prompt excluído' });
    } catch (error) {
      console.error('Erro ao excluir prompt', error);
      toast({
        title: 'Erro ao excluir prompt',
        description: error.message || 'Não foi possível excluir o prompt.',
        variant: 'destructive',
      });
    }
  };

  const handleSelectForChat = (prompt) => {
    onSelectPrompt?.(prompt);
    toast({
      title: 'Prompt aplicado ao chat',
      description: `"${prompt.name || 'Prompt'}" será usado como estilo da IA nesta conversa.`,
    });
  };

  const filteredPrompts = useMemo(() => {
    if (!searchTerm) return prompts;
    const term = searchTerm.toLowerCase();
    return (prompts || []).filter((p) =>
      `${p.name || ''} ${p.description || ''} ${p.content || ''}`.toLowerCase().includes(term),
    );
  }, [prompts, searchTerm]);

  const activePromptId = activePrompt?.id || null;

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
            className="w-full max-w-5xl max-h-[85vh] rounded-2xl bg-card shadow-xl border relative flex flex-col overflow-hidden"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {/* Cabeçalho: abas Pessoais / Adapta + busca + fechar */}
            <div className="flex items-center justify-between border-b px-4 py-2 gap-3 shrink-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="px-3 py-2 text-sm font-medium border-b-2 border-primary text-primary rounded-t"
                  aria-selected="true"
                >
                  Pessoais
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border-b-2 border-transparent rounded-t"
                  aria-selected="false"
                >
                  Adapta
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar prompt..."
                    className="pl-8 h-9 w-48"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleClose} aria-label="Fechar">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Conteúdo: duas colunas */}
            <div className="flex-1 flex min-h-0">
              {/* Coluna esquerda: Pastas + lista de prompts (cards compactos) */}
              <div className="w-[280px] shrink-0 flex flex-col border-r p-3 gap-4">
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pastas
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 rounded-lg"
                    onClick={() => toast({ title: 'Em breve', description: 'Criar pasta para organizar prompts.' })}
                  >
                    <FolderPlus className="h-4 w-4" />
                    Criar pasta
                  </Button>
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Prompts
                  </span>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredPrompts.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      Nenhum prompt. Use &quot;+ Prompt&quot; ao lado para criar.
                    </p>
                  ) : (
                    <ScrollArea className="flex-1 pr-1">
                      <div className="space-y-2">
                        {filteredPrompts.map((prompt) => {
                          const isActive = activePromptId === prompt.id;
                          return (
                            <div
                              key={prompt.id}
                              className={[
                                'rounded-lg border p-3 transition-colors',
                                isActive ? 'border-primary bg-primary/5' : 'border-border/70 bg-muted/30 hover:bg-muted/50',
                              ].join(' ')}
                            >
                              <p className="font-semibold text-sm text-foreground truncate">
                                {prompt.name || 'Sem título'}
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {prompt.description || prompt.content?.slice(0, 60) || ''}
                              </p>
                              <div className="mt-2 flex justify-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="secondary" size="sm" className="h-8 gap-1 text-xs rounded-md">
                                      Usar
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleSelectForChat(prompt)}>
                                      Usar neste chat
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => startEditPrompt(prompt)}>
                                      <Edit className="h-3.5 w-3.5 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => handleDeletePrompt(prompt)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                                      Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>

              {/* Coluna direita: toolbar (+ Pasta, menu, + Prompt) + área de edição ou vazia */}
              <div className="flex-1 flex flex-col min-w-0 p-4">
                <div className="flex items-center justify-end gap-2 mb-4 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => toast({ title: 'Em breve', description: 'Criar pasta.' })}
                  >
                    <FolderPlus className="h-4 w-4" />
                    + Pasta
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={startCreatePrompt}>Novo prompt</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={startCreatePrompt}
                  >
                    <Plus className="h-4 w-4" />
                    + Prompt
                  </Button>
                </div>

                {isEditing ? (
                  <div className="rounded-xl border border-dashed bg-muted/20 p-4 space-y-3 flex-1 overflow-auto">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-muted-foreground">
                        {editingPrompt ? 'Editar prompt' : 'Novo prompt'}
                      </span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={resetEditor}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Nome do prompt (ex: Tom educativo para redes sociais)"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <Input
                      placeholder="Descrição rápida (opcional)"
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <Textarea
                      placeholder="Texto completo do prompt que a IA deve seguir (estilo, objetivos, público, tom, restrições, etc.)"
                      value={draftContent}
                      onChange={(e) => setDraftContent(e.target.value)}
                      className="min-h-[120px] max-h-[280px] text-sm resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={resetEditor}>
                        Cancelar
                      </Button>
                      <Button type="button" size="sm" onClick={handleSavePrompt} disabled={isSaving}>
                        {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Salvar prompt
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed bg-muted/10 text-center p-8">
                    <div>
                      <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Selecione um prompt à esquerda ou crie um novo com &quot;+ Prompt&quot;.
                      </p>
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

export default PromptPanel;

