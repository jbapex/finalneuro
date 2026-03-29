import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Loader2, Edit, Trash2, ArrowLeft, User, Tag, Star, Mic, ShoppingBag, Users, BarChart2, Eye, Sparkles, MessageCircle, CalendarDays, FileText } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useNavigate } from 'react-router-dom';

const DetailItem = ({ icon: Icon, label, value }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-card-foreground">{label}</p>
        <p className="text-muted-foreground break-words">{value}</p>
      </div>
    </div>
  );
};

const ClientDetails = ({ client, onEdit, onDelete, onGoBack, onContextSaved }) => {
  const [contexts, setContexts] = useState([]);
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [editingContext, setEditingContext] = useState(null);
  const [contextDraftName, setContextDraftName] = useState('');
  const [contextDraftContent, setContextDraftContent] = useState('');
  const [isSavingContext, setIsSavingContext] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchContexts = useCallback(async () => {
    if (!client?.id) return;
    const { data, error } = await supabase
      .from('client_contexts')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Erro ao buscar contextos', description: error.message, variant: 'destructive' });
      return;
    }
    setContexts(data || []);
  }, [client?.id, toast]);

  useEffect(() => {
    fetchContexts();
  }, [fetchContexts]);

  const openContextEditor = (ctx = null) => {
    setEditingContext(ctx);
    setContextDraftName(ctx?.name || '');
    setContextDraftContent(ctx?.content || '');
    setContextModalOpen(true);
  };

  const saveContext = async () => {
    setIsSavingContext(true);
    if (editingContext?.id) {
      const { data, error } = await supabase
        .from('client_contexts')
        .update({ name: contextDraftName || null, content: contextDraftContent || '', updated_at: new Date().toISOString() })
        .eq('id', editingContext.id)
        .select()
        .single();
      setIsSavingContext(false);
      if (error) {
        toast({ title: 'Erro ao salvar contexto', description: error.message, variant: 'destructive' });
        return;
      }
      setContexts((prev) => prev.map((c) => (c.id === data.id ? data : c)));
    } else {
      const { data, error } = await supabase
        .from('client_contexts')
        .insert({ client_id: client.id, name: contextDraftName || null, content: contextDraftContent || '' })
        .select()
        .single();
      setIsSavingContext(false);
      if (error) {
        toast({ title: 'Erro ao salvar contexto', description: error.message, variant: 'destructive' });
        return;
      }
      setContexts((prev) => [data, ...prev]);
    }
    toast({ title: 'Contexto salvo', description: editingContext ? 'Contexto atualizado.' : 'Novo contexto adicionado.' });
    setContextModalOpen(false);
    onContextSaved?.(client);
  };

  const deleteContext = async (ctx) => {
    const { error } = await supabase.from('client_contexts').delete().eq('id', ctx.id);
    if (error) {
      toast({ title: 'Erro ao excluir contexto', description: error.message, variant: 'destructive' });
      return;
    }
    setContexts((prev) => prev.filter((c) => c.id !== ctx.id));
    toast({ title: 'Contexto excluído' });
  };

  const handleGoToCalendar = () => {
    onGoBack(); // Close drawer
    navigate(`/ferramentas/calendario-de-publicacao/${client.id}`);
  };

  return (
    <>
      <DrawerHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onGoBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <DrawerTitle className="truncate" title={client.name}>{client.name}</DrawerTitle>
           </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" /> Editar
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Isso excluirá permanentemente o cliente e todas as suas campanhas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} variant="destructive">
                    Sim, excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DrawerHeader>

      <ScrollArea className="flex-grow p-4">
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Informações Essenciais</CardTitle>
              <Button variant="secondary" size="sm" onClick={handleGoToCalendar}>
                <CalendarDays className="w-4 h-4 mr-2" /> Calendário
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <DetailItem icon={User} label="Nome do Criador" value={client.creator_name} />
            <DetailItem icon={Tag} label="Nicho" value={client.niche} />
            <DetailItem icon={Sparkles} label="Estilo em 3 Palavras" value={client.style_in_3_words} />
            <DetailItem icon={ShoppingBag} label="Produto/Serviço a Promover" value={client.product_to_promote} />
            <DetailItem icon={Users} label="Público-alvo Principal" value={client.target_audience} />
            <DetailItem icon={Star} label="Casos de Sucesso" value={client.success_cases} />
            <DetailItem icon={Eye} label="Total de Visualizações do Perfil" value={client.profile_views} />
            <DetailItem icon={BarChart2} label="Total de Seguidores" value={client.followers} />
            <DetailItem icon={Mic} label="Formato de Aparição" value={client.appearance_format} />
            <DetailItem icon={MessageCircle} label="Bordões ou Frases-chave" value={client.catchphrases} />
          </CardContent>
        </Card>

        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" /> Contextos
        </h3>
        <Card className="mb-6">
          <CardContent className="p-4">
            {contexts.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-3">Nenhum contexto definido para este cliente.</p>
                <Button variant="outline" size="sm" onClick={() => openContextEditor(null)}>
                  <FileText className="w-4 h-4 mr-2" /> Adicionar contexto
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {contexts.map((ctx) => (
                  <div key={ctx.id} className="rounded-md border border-border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm text-foreground">{ctx.name || 'Sem título'}</p>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => openContextEditor(ctx)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir este contexto?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction variant="destructive" onClick={() => deleteContext(ctx)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words line-clamp-3">{ctx.content}</p>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => openContextEditor(null)}>
                  <FileText className="w-4 h-4 mr-2" /> Adicionar outro contexto
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

      </ScrollArea>

      <Dialog open={contextModalOpen} onOpenChange={setContextModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingContext ? 'Editar' : 'Novo'} contexto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 flex flex-col min-h-0 flex-1">
            <div>
              <label className="text-sm font-medium mb-1 block">Nome (opcional)</label>
              <Input
                value={contextDraftName}
                onChange={(e) => setContextDraftName(e.target.value)}
                placeholder="Ex: Briefing 2025, Tom de voz"
              />
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <label className="text-sm font-medium mb-1 block">Conteúdo</label>
              <Textarea
                value={contextDraftContent}
                onChange={(e) => setContextDraftContent(e.target.value)}
                placeholder="Descreva o contexto: objetivos, tom de voz, referências..."
                className="flex-1 min-h-[240px] resize-y font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button onClick={saveContext} disabled={isSavingContext}>
              {isSavingContext && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClientDetails;