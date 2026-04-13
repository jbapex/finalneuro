import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { SearchCode, Clipboard, Check, Eye } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import ContentViewModal from '@/components/flow-builder/modals/ContentViewModal';
import { FlowNodeHeaderDelete } from '@/components/flow-builder/FlowNodeHeaderDelete';

const PageAnalyzerNode = memo(({ id, data, selected }) => {
  const { onUpdateNodeData, output, analysisId: initialAnalysisId } = data;
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const subscriptionRef = useRef(null);
  const progressIntervalRef = useRef(null);

  const analysisId = output?.id || initialAnalysisId;
  const analysisResult = output?.data || null;

  const cleanup = useCallback(() => {
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setIsProcessing(false);
    setProcessingStatus('');
    setProgress(0);
  }, []);

  const setupSubscription = useCallback((currentAnalysisId) => {
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
    }
    subscriptionRef.current = supabase
      .channel(`page-analysis-update:${id}:${currentAnalysisId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'page_analyses',
        filter: `id=eq.${currentAnalysisId}`
      }, (payload) => {
        const updatedAnalysis = payload.new;
        if (updatedAnalysis.status === 'completed' || updatedAnalysis.status === 'failed') {
          onUpdateNodeData(id, { output: { id: updatedAnalysis.id, data: updatedAnalysis.analysis_data } });
          if (updatedAnalysis.status === 'completed') {
            toast({ title: 'Análise Concluída!' });
          } else {
            toast({ title: 'Erro na Análise', description: updatedAnalysis.error_message || 'A análise falhou.', variant: 'destructive' });
          }
          cleanup();
        }
      })
      .subscribe();
  }, [id, onUpdateNodeData, toast, cleanup]);

  useEffect(() => {
    if (isProcessing) return;

    const checkExistingAnalysis = async () => {
      if (!analysisId) return;
      const { data: analysis, error } = await supabase.from('page_analyses').select('*').eq('id', analysisId).single();
      if (error) return;

      if (analysis.status === 'processing') {
        setIsProcessing(true);
        setProcessingStatus('Análise em andamento...');
        setProgress(50);
        setupSubscription(analysisId);
      } else if (analysis.status === 'completed' && analysis.analysis_data) {
        onUpdateNodeData(id, { output: { id: analysisId, data: analysis.analysis_data } });
      }
    };

    checkExistingAnalysis();
  }, [analysisId, isProcessing, id, onUpdateNodeData, setupSubscription]);

  const startProgressSimulation = () => {
    let currentProgress = 10;
    progressIntervalRef.current = setInterval(() => {
      currentProgress += Math.random() * 5;
      if (currentProgress >= 95) {
        clearInterval(progressIntervalRef.current);
      }
      setProgress(Math.min(95, currentProgress));
    }, 500);
  };

  const handleAnalyze = async () => {
    if (!url) return toast({ title: 'URL ausente', description: 'Por favor, insira a URL de um site.' });
    setIsProcessing(true);
    setProcessingStatus('Iniciando análise...');
    setProgress(5);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      const { data: newAnalysis, error: insertError } = await supabase
        .from('page_analyses')
        .insert({ user_id: user.id, url, status: 'pending' })
        .select()
        .single();
      if (insertError) throw insertError;

      onUpdateNodeData(id, { analysisId: newAnalysis.id });
      setupSubscription(newAnalysis.id);
      startProgressSimulation();

      const { error: functionError } = await supabase.functions.invoke('page-analyzer', {
        body: { analysis_id: newAnalysis.id },
      });
      if (functionError) throw new Error(functionError.message);

    } catch (error) {
      toast({ title: 'Erro ao iniciar análise', description: error.message, variant: 'destructive' });
      cleanup();
    }
  };

  const handleCopy = () => {
    if (analysisResult) {
      navigator.clipboard.writeText(JSON.stringify(analysisResult, null, 2));
      setCopied(true);
      toast({ title: 'Copiado!', description: 'Análise copiada.' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleView = () => setIsModalOpen(true);

  const handleRefineNotImplemented = () => {
    toast({
      title: "🚧 Funcionalidade em desenvolvimento!",
      description: "Esta funcionalidade ainda não está implementada—mas não se preocupe! Você pode solicitá-la no seu próximo prompt! 🚀",
    });
  };

  const formattedResult = analysisResult ? JSON.stringify(analysisResult, null, 2) : 'A análise da página aparecerá aqui...';

  return (
    <Card className="w-80 border-2 border-cyan-500/50 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-cyan-500" />
      <CardHeader className="flex flex-row items-center gap-2 p-3 bg-cyan-500/10 min-w-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SearchCode className="w-5 h-5 shrink-0 text-cyan-500" />
          <CardTitle className="text-base truncate">Analisador de Página</CardTitle>
        </div>
        <FlowNodeHeaderDelete nodeId={id} onRemoveNode={data.onRemoveNode} selected={selected} />
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {!isProcessing && !analysisResult && (
          <div className="flex items-center space-x-2">
            <Input type="url" placeholder="https://exemplo.com" value={url} onChange={(e) => setUrl(e.target.value)} disabled={isProcessing} className="nodrag" />
            <Button onClick={handleAnalyze} disabled={isProcessing || !url} size="sm">Analisar</Button>
          </div>
        )}
        {isProcessing && (
          <div className="space-y-2 text-center">
            <Progress value={progress} className="w-full h-2" />
            <p className="text-xs text-muted-foreground">{processingStatus}</p>
          </div>
        )}
        <div className="relative">
          <ScrollArea className="h-40 w-full rounded-md border p-2 bg-muted nodrag">
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
              {isProcessing && !analysisResult ? 'Aguardando análise...' : formattedResult}
            </pre>
          </ScrollArea>
          {analysisResult && (
            <div className="absolute top-1 right-1 flex space-x-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleView}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-cyan-500" />
      <ContentViewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Análise da Página"
        content={`\`\`\`json\n${formattedResult}\n\`\`\``}
        onRefineClick={handleRefineNotImplemented}
      />
    </Card>
  );
});

export default PageAnalyzerNode;