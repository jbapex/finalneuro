import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

import GenericFileUpload from '@/components/analyzer/FileUpload';
import AnalysisResults from '@/components/analyzer/AnalysisResults';
import ColumnMapper from '@/components/analyzer/ColumnMapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSearch, Sparkles, Loader2, Target as TargetIcon, CheckCircle, User, Edit3, History, Download, Eye } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const schema = z.object({
  client_name: z.string().optional(),
  analysis_name: z.string().nonempty({ message: "O nome da análise é obrigatório." }),
  objective: z.string().nonempty({ message: "O objetivo é obrigatório." }),
});

import { getFriendlyErrorMessage } from '@/lib/utils';

const CampaignAnalyzer = () => {
  const [view, setView] = useState('form'); // form, results, history
  const [filePayload, setFilePayload] = useState(null);
  const [originalCsvData, setOriginalCsvData] = useState(null);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [analysisHistory, setAnalysisHistory] = useState([]);
  
  const { handleSubmit, formState: { errors }, control, reset } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { client_name: null },
  });

  const fetchClients = async () => {
    const { data, error } = await supabase.from('clients').select('id, name').eq('user_id', user.id);
    if (error) toast({ title: 'Erro ao buscar clientes', description: error.message, variant: 'destructive' });
    else setClients(data);
  };
  
  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('campaign_analyses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) toast({ title: 'Erro ao buscar histórico', description: error.message, variant: 'destructive' });
    else setAnalysisHistory(data);
  };

  useEffect(() => {
    if (user) {
      fetchClients();
      fetchHistory();
    }
  }, [user, toast]);

  const handleFileParsed = (payload) => {
    setOriginalCsvData(payload);
    setError(null);
    setIsMappingModalOpen(true);
  };

  const handleMappingConfirmed = (processedPayload) => {
    setFilePayload(processedPayload);
    setIsMappingModalOpen(false);
    toast({ title: "Mapeamento Concluído!", description: "Colunas mapeadas com sucesso. Prossiga com a análise." });
    handleSubmit(onSubmit)();
  };

  const handleMappingCancel = () => {
    setIsMappingModalOpen(false);
    setOriginalCsvData(null);
    setFilePayload(null);
  };

  const handleParsingError = (err) => {
    setError(err);
    setFilePayload(null);
    setOriginalCsvData(null);
  };

  const onSubmit = async (formData) => {
    if (!filePayload) {
      setError("Os dados da planilha não foram carregados ou mapeados.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setView('analyzing');
    
    try {
        const { data, error: functionError } = await supabase.functions.invoke('campaign-analyzer', {
            body: {
              csvData: filePayload.data,
              campaignInfo: {
                objective: formData.objective,
                client_name: formData.client_name,
                analysis_name: formData.analysis_name,
              },
            },
        });

        if (functionError) {
          const errorContext = functionError.context?.json ? await functionError.context.json() : { error: functionError.message };
          throw new Error(errorContext.error || 'Erro na função de análise.');
        }

        if (data.error) throw new Error(data.error);
        
        setAnalysisResult(data.analysis);
        setView('results');
        fetchHistory(); // Refresh history
        toast({ title: "Análise Concluída!", description: "Relatório gerado com sucesso.", variant: "success" });

    } catch (err) {
       const friendlyMsg = getFriendlyErrorMessage(err);
       setError(friendlyMsg);
       toast({ title: 'Aviso', description: friendlyMsg, variant: 'destructive' });
       setView('form');
    } finally {
        setIsLoading(false);
    }
  };

  const handleNewAnalysis = () => {
    setAnalysisResult(null);
    setError(null);
    setFilePayload(null);
    setOriginalCsvData(null);
    reset();
    setView('form');
  };

  const handleViewHistoryItem = (item) => {
    setAnalysisResult(item.analysis_data);
    setView('results');
  };
  
  const renderContent = () => {
    switch(view) {
      case 'form':
        return (
          <motion.form key="configure" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div>
                <h3 className="text-lg font-semibold flex items-center mb-4"><Sparkles className="w-5 h-5 mr-2" /> 1. Detalhes da Análise</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="analysis_name" className="flex items-center"><Edit3 className="w-4 h-4 mr-2" />Nome da Análise</Label>
                        <Controller name="analysis_name" control={control} render={({ field }) => <Input {...field} placeholder="Ex: Análise Vendas - Maio" />} />
                        {errors.analysis_name && <p className="text-sm text-destructive">{errors.analysis_name.message}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="client_name" className="flex items-center"><User className="w-4 h-4 mr-2" />Cliente (Opcional)</Label>
                        <Controller
                            name="client_name" control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={null}>Nenhum cliente</SelectItem>
                                        {clients.map(client => <SelectItem key={client.id} value={client.name}>{client.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="objective" className="flex items-center"><TargetIcon className="w-4 h-4 mr-2" />Objetivo Principal</Label>
                        <Controller
                            name="objective" control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger><SelectValue placeholder="Selecione o objetivo principal da campanha" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Maximizar Vendas (ROAS)">Maximizar Vendas (ROAS)</SelectItem>
                                        <SelectItem value="Gerar Leads Qualificados (CPL)">Gerar Leads Qualificados (CPL)</SelectItem>
                                        <SelectItem value="Aumentar Engajamento">Aumentar Engajamento</SelectItem>
                                        <SelectItem value="Reconhecimento de Marca (Alcance)">Reconhecimento de Marca (Alcance)</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {errors.objective && <p className="text-sm text-destructive">{errors.objective.message}</p>}
                    </div>
                </div>
            </div>
            
            <div>
                 <GenericFileUpload onFileParsed={handleFileParsed} onParsingError={handleParsingError} disabled={false} />
            </div>

            {filePayload && (
                <div className="p-4 border rounded-lg bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <div>
                        <h4 className="font-semibold text-green-800 dark:text-green-300">Arquivo Carregado e Mapeado: {filePayload?.fileName}</h4>
                        <p className="text-sm text-green-700 dark:text-green-400">Clique em "Analisar Agora" para iniciar.</p>
                    </div>
                </div>
            )}
             <Button type="submit" disabled={!filePayload || isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
                Analisar Agora
            </Button>
          </motion.form>
        );
      case 'analyzing':
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <h3 className="text-2xl font-semibold">Analisando dados...</h3>
                <p className="text-muted-foreground max-w-md">Nosso Gestor de Tráfego Inteligente está processando seus dados para encontrar os melhores insights.</p>
            </div>
        );
      case 'results':
        return (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {analysisResult && ( <AnalysisResults data={analysisResult} onNewAnalysis={handleNewAnalysis} /> )}
            </motion.div>
        );
      default: return null;
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center md:items-start">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary mb-2">
            Gestor de Tráfego Inteligente
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            Faça upload do seu CSV do Meta Ads e deixe nossa IA gerar um diagnóstico profissional e um plano de otimização completo.
            </p>
        </div>
        <Button onClick={() => setView('form')} variant="outline" disabled={view === 'form'} className="mt-4 md:mt-0">
            <Sparkles className="mr-2 h-4 w-4" /> Nova Análise
        </Button>
      </motion.div>
      
      <Card className="mb-8">
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>
          {error && (
            <motion.div className="mt-4 text-center text-destructive bg-destructive/10 p-4 rounded-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p><strong>Erro:</strong> {error}</p>
            </motion.div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5"/> Histórico de Análises</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome da Análise</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysisHistory.length > 0 ? (
                analysisHistory.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.analysis_name}</TableCell>
                    <TableCell>{item.client_name || 'N/A'}</TableCell>
                    <TableCell>{new Date(item.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleViewHistoryItem(item)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan="4" className="text-center">Nenhuma análise encontrada no histórico.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {originalCsvData && (
        <ColumnMapper
          isOpen={isMappingModalOpen}
          onClose={handleMappingCancel}
          csvData={originalCsvData}
          onConfirm={handleMappingConfirmed}
        />
      )}
    </div>
  );
};

export default CampaignAnalyzer;