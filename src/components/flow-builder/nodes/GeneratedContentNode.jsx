import React, { memo, useState, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { FileText, Copy, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ContentViewModal from '@/components/flow-builder/modals/ContentViewModal';
import RefineWithAiModal from '@/components/flow-builder/modals/RefineWithAiModal';
import { FlowNodeHeaderDelete } from '@/components/flow-builder/FlowNodeHeaderDelete';
import { supabase } from '@/lib/customSupabaseClient';
import { getFriendlyErrorMessage } from '@/lib/utils';

const GeneratedContentNode = memo(({ data, id, selected }) => {
  const content = data?.content ?? data?.generatedText ?? '';
  const label = data?.label || 'Conteúdo gerado';
  const { toast } = useToast();
  const onUpdateNodeData = data?.onUpdateNodeData;
  const llmIntegrationId = data?.llm_integration_id;
  const llmIsUserConnection = data?.llm_is_user_connection === true;
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isRefineOpen, setIsRefineOpen] = useState(false);
  const [isRefineLoading, setIsRefineLoading] = useState(false);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    toast({ title: 'Copiado!', description: 'O conteúdo foi copiado para a área de transferência.' });
  };

  const handleOpenRefine = useCallback(() => {
    setIsRefineOpen(true);
  }, []);

  const handleRefineSubmit = async (instruction) => {
    const trimmed = instruction?.trim();
    if (!trimmed || !content) return;
    if (!llmIntegrationId) {
      toast({
        title: 'Conexão de IA não encontrada',
        description:
          'Fluxos antigos ou este nó não guardam a IA usada na geração. Gere o conteúdo de novo a partir do agente (com uma conexão de IA selecionada) e abra o visualizador outra vez.',
        variant: 'destructive',
      });
      return;
    }
    if (typeof onUpdateNodeData !== 'function') {
      toast({
        title: 'Erro interno',
        description: 'Não foi possível atualizar o nó.',
        variant: 'destructive',
      });
      return;
    }

    setIsRefineLoading(true);
    try {
      const refinePrompt = `Você é um assistente de escrita. Ajuste o texto abaixo conforme a instrução. Preserve markdown quando fizer sentido. Responda somente com o texto refinado, sem prefácio.

--- TEXTO ORIGINAL ---
${content}

--- INSTRUÇÃO ---
${trimmed}`;

      const { data: functionData, error } = await supabase.functions.invoke('generic-ai-chat', {
        body: JSON.stringify({
          messages: [{ role: 'user', content: refinePrompt }],
          llm_integration_id: llmIntegrationId,
          is_user_connection: llmIsUserConnection,
        }),
      });
      if (error) throw new Error(error.message);
      const refined = (functionData?.response || functionData?.content || '').trim();
      if (!refined) throw new Error('Resposta vazia da IA');

      onUpdateNodeData(id, {
        content: refined,
        generatedText: refined,
        output: data.output ? { ...data.output, data: refined } : { id, data: refined },
      });
      toast({ title: 'Conteúdo refinado', description: 'O texto deste nó foi atualizado.' });
      setIsRefineOpen(false);
    } catch (err) {
      toast({
        title: 'Erro ao refinar',
        description: getFriendlyErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsRefineLoading(false);
    }
  };

  return (
    <>
      <Card className="w-80 max-h-[420px] border-2 border-teal-500/50 shadow-lg overflow-hidden flex flex-col">
        <Handle type="target" position={Position.Left} className="!bg-teal-500" id="target" />
        <CardHeader className="flex flex-row items-center gap-2 p-2 bg-teal-500/10 shrink-0 min-w-0">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <FileText className="w-4 h-4 shrink-0 text-teal-500" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
          </div>
          <FlowNodeHeaderDelete nodeId={id} onRemoveNode={data.onRemoveNode} selected={selected} />
        </CardHeader>
        <CardContent className="p-2 flex flex-col min-h-0 flex-1">
          <ScrollArea className="flex-1 min-h-[120px] max-h-[280px] rounded-md border bg-muted/30 p-2">
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-left text-sm">
              {content || <span className="text-muted-foreground">Nenhum conteúdo.</span>}
            </div>
          </ScrollArea>
          {content && (
            <div className="flex items-center gap-1 mt-2 shrink-0">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCopy}>
                <Copy className="w-3 h-3 mr-1" /> Copiar
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setIsViewOpen(true)}>
                <Eye className="w-3 h-3 mr-1" /> Visualizar
              </Button>
            </div>
          )}
        </CardContent>
        <Handle type="source" position={Position.Right} className="!bg-teal-500 w-3 h-3" id="source" />
      </Card>
      <ContentViewModal
        isOpen={isViewOpen}
        onClose={() => setIsViewOpen(false)}
        title={label}
        content={content}
        onRefineClick={handleOpenRefine}
      />
      <RefineWithAiModal
        isOpen={isRefineOpen}
        onClose={() => !isRefineLoading && setIsRefineOpen(false)}
        onRefine={handleRefineSubmit}
        isLoading={isRefineLoading}
      />
    </>
  );
});

GeneratedContentNode.displayName = 'GeneratedContentNode';

export default GeneratedContentNode;
