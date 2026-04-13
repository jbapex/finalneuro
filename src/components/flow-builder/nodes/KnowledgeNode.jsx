import React, { memo, useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, PlusCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { FlowNodeHeaderDelete } from '@/components/flow-builder/FlowNodeHeaderDelete';

const KnowledgeNode = memo(({ data, id, selected }) => {
  const { onUpdateNodeData, knowledgeSources, selectedSourceId } = data;
  const { toast } = useToast();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceContent, setNewSourceContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSourceChange = (sourceId) => {
    const selectedSource = knowledgeSources.find(s => s.id.toString() === sourceId);
    onUpdateNodeData(id, {
      selectedSourceId: sourceId,
      output: {
        id: sourceId,
        data: selectedSource,
      },
    });
  };

  const handleCreateSource = async () => {
    if (!newSourceName.trim() || !newSourceContent.trim() || !user) {
      toast({ title: 'Dados incompletos', description: 'Nome e conteúdo são obrigatórios.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const { data: newSource, error } = await supabase
        .from('knowledge_sources')
        .insert({
          user_id: user.id,
          name: newSourceName,
          content: newSourceContent,
          type: 'text',
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Fonte de conhecimento criada!' });
      setIsModalOpen(false);
      setNewSourceName('');
      setNewSourceContent('');
      // This is a bit of a hack. Ideally, the parent component would refetch.
      // For now, we just update the node's internal data.
      const updatedSources = [...(knowledgeSources || []), newSource];
      onUpdateNodeData(id, {
        knowledgeSources: updatedSources,
        selectedSourceId: newSource.id.toString(),
        output: { id: newSource.id, data: newSource },
      });
    } catch (error) {
      toast({ title: 'Erro ao criar fonte', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card className="w-64 border-2 border-yellow-500/50 shadow-lg">
        <Handle type="target" position={Position.Left} className="!bg-yellow-500" />
        <CardHeader className="flex flex-row items-center gap-2 p-3 bg-yellow-500/10 min-w-0">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <BookOpen className="w-5 h-5 shrink-0 text-yellow-500" />
            <CardTitle className="text-base truncate">Fonte de Conhecimento</CardTitle>
          </div>
          <FlowNodeHeaderDelete nodeId={id} onRemoveNode={data.onRemoveNode} selected={selected} />
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          <Select onValueChange={handleSourceChange} value={selectedSourceId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma fonte..." />
            </SelectTrigger>
            <SelectContent>
              {knowledgeSources?.map((source) => (
                <SelectItem key={source.id} value={source.id.toString()}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="w-full" onClick={() => setIsModalOpen(true)}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Nova Fonte
          </Button>
        </CardContent>
        <Handle type="source" position={Position.Right} className="!bg-yellow-500" />
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Fonte de Conhecimento</DialogTitle>
            <DialogDescription>
              Adicione um texto que servirá de contexto para os agentes de IA. O upload de PDF será implementado em breve.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Nome da Fonte (ex: Detalhes do Produto X)"
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              disabled={isLoading}
            />
            <Textarea
              placeholder="Cole aqui o conteúdo de texto..."
              value={newSourceContent}
              onChange={(e) => setNewSourceContent(e.target.value)}
              rows={10}
              disabled={isLoading}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button onClick={handleCreateSource} disabled={isLoading || !newSourceName.trim() || !newSourceContent.trim()}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Fonte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

export default KnowledgeNode;