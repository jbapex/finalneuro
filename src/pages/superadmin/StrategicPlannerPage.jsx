import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, Loader2, FileText, Download, PlusCircle, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import StepCard from '@/components/strategic-planner/StepCard';
import { pdf } from '@react-pdf/renderer';
import PdfDocument from '@/components/strategic-planner/PdfDocument';

const planningStepsConfig = [
  { id: 'objective', title: '1. Objetivo', description: 'Defina a meta principal e os objetivos secundários.' },
  { id: 'what_to_do', title: '2. O que Vamos Fazer', description: 'Liste as frentes de ação e crie um slogan de impacto.' },
  { id: 'phases', title: '3. Fases da Campanha', description: 'Divida o mês em fases com objetivos e ações específicas.' },
  { id: 'paid_traffic', title: '4. Tráfego Pago', description: 'Detalhe as campanhas de anúncios, públicos e orçamentos.' },
  { id: 'schedule', title: '5. Cronograma de Postagens', description: 'Organize as entregas e publicações em um calendário.' },
  { id: 'video_ideas', title: '6. Ideias de Vídeo', description: 'Estruture roteiros de vídeos curtos para a campanha.' },
];

const StrategicPlannerPage = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [clientContexts, setClientContexts] = useState([]);

  const [selectedClientId, setSelectedClientId] = useState('');
  /** id do registo client_contexts ou '' (contexto geral / sem bloco textual) */
  const [selectedClientContextId, setSelectedClientContextId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [planningHistory, setPlanningHistory] = useState([]);
  const [currentPlanning, setCurrentPlanning] = useState(null);
  const [planningSteps, setPlanningSteps] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [view, setView] = useState('selector'); // 'selector' | 'history' | 'planner'

  const isSuperAdmin = profile?.user_type === 'super_admin';

  const fetchInitialData = useCallback(async () => {
    if (!user) return;
    let clientsQuery = supabase.from('clients').select('id, name');
    if (!isSuperAdmin) {
      clientsQuery = clientsQuery.eq('user_id', user.id);
    }
    const clientsRes = await clientsQuery;
    if (clientsRes.error) toast({ title: 'Erro ao carregar clientes', variant: 'destructive' });
    else setClients(clientsRes.data || []);
  }, [user, toast, isSuperAdmin]);

  const fetchContextsForClient = useCallback(
    async (clientId) => {
      if (!clientId) {
        setClientContexts([]);
        return;
      }
      const cid = parseInt(clientId, 10);
      const { data, error } = await supabase
        .from('client_contexts')
        .select('id, name, content')
        .eq('client_id', cid)
        .order('name', { ascending: true });
      if (error) {
        toast({ title: 'Erro ao carregar contextos do cliente', description: error.message, variant: 'destructive' });
        setClientContexts([]);
      } else {
        setClientContexts(data || []);
      }
    },
    [toast]
  );

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const resetState = () => {
    setCurrentPlanning(null);
    setPlanningSteps({});
    setPlanningHistory([]);
  };

  const handleClientChange = (clientId) => {
    setSelectedClientId(clientId);
    setSelectedClientContextId('');
    if (clientId) {
      void fetchContextsForClient(clientId);
    } else {
      setClientContexts([]);
    }
    resetState();
    setView('selector');
  };

  const handleClientContextChange = (contextId) => {
    setSelectedClientContextId(contextId);
    resetState();
    setView('selector');
  };

  const mustPickContext = clientContexts.length > 0;
  const contextSelectionOk = !mustPickContext || !!selectedClientContextId;

  const handleLoadHistory = async () => {
    if (!selectedClientId) {
      toast({ title: 'Seleção necessária', description: 'Escolha um cliente.', variant: 'destructive' });
      return;
    }
    if (mustPickContext && !selectedClientContextId) {
      toast({ title: 'Seleção necessária', description: 'Escolha um contexto do cliente.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    const ctxId = selectedClientContextId ? parseInt(selectedClientContextId, 10) : null;
    let query = supabase
      .from('plannings')
      .select('*')
      .eq('client_id', selectedClientId)
      .eq('month', selectedMonth)
      .eq('year', selectedYear)
      .order('version', { ascending: false });
    if (ctxId) {
      query = query.eq('client_context_id', ctxId);
    } else {
      query = query.is('client_context_id', null);
    }
    const { data, error } = await query;

    if (error) {
      toast({ title: 'Erro ao buscar histórico', description: error.message, variant: 'destructive' });
    } else {
      setPlanningHistory(data);
      setView('history');
    }
    setIsLoading(false);
  };
  
  const handleCreateNewPlanning = async () => {
    if (!selectedClientId) {
      toast({ title: 'Seleção necessária', description: 'Escolha um cliente.', variant: 'destructive' });
      return;
    }
    if (mustPickContext && !selectedClientContextId) {
      toast({ title: 'Seleção necessária', description: 'Escolha um contexto do cliente.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    const latestVersion = planningHistory.length > 0 ? Math.max(...planningHistory.map(p => p.version)) : 0;
    
    const ctxId = selectedClientContextId ? parseInt(selectedClientContextId, 10) : null;
    const { data: newPlanning, error } = await supabase
      .from('plannings')
      .insert({
        user_id: user.id,
        client_id: selectedClientId,
        campaign_id: null,
        client_context_id: ctxId,
        month: selectedMonth,
        year: selectedYear,
        version: latestVersion + 1,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao criar novo planejamento', description: error.message, variant: 'destructive' });
    } else {
      setCurrentPlanning(newPlanning);
      setPlanningSteps({});
      setView('planner');
      toast({ title: 'Novo Planejamento Iniciado!', description: 'Você já pode começar a gerar as etapas.' });
    }
    setIsLoading(false);
  };

  const handleContinuePlanning = async (planning) => {
    setCurrentPlanning(planning);
    if (planning.client_context_id != null) {
      setSelectedClientContextId(String(planning.client_context_id));
    } else {
      setSelectedClientContextId('');
    }
    await fetchPlanningSteps(planning.id);
    setView('planner');
  };

  const fetchPlanningSteps = async (planningId) => {
    setIsLoading(true);
    const { data, error } = await supabase.from('planning_steps').select('*').eq('planning_id', planningId);
    if (error) {
      toast({ title: 'Erro ao carregar etapas', description: error.message, variant: 'destructive' });
    } else {
      const stepsData = data.reduce((acc, step) => { acc[step.step] = step; return acc; }, {});
      setPlanningSteps(stepsData);
    }
    setIsLoading(false);
  };

  const handleStepUpdate = (stepData) => {
    setPlanningSteps(prev => ({ ...prev, [stepData.step]: stepData }));
  };
  
  const generatePdf = async (planningToExport, stepsToExport) => {
    setIsDownloading(true);
    let finalSteps = stepsToExport;

    // If steps aren't provided, fetch them for the given planning
    if (!stepsToExport) {
        const { data, error } = await supabase.from('planning_steps').select('*').eq('planning_id', planningToExport.id);
        if (error) {
            toast({ title: 'Erro ao buscar etapas para o PDF', description: error.message, variant: 'destructive' });
            setIsDownloading(false);
            return;
        }
        finalSteps = data.reduce((acc, step) => { acc[step.step] = step; return acc; }, {});
    }

    try {
        const clientName = clients.find(c => c.id === parseInt(selectedClientId))?.name || 'Cliente';
        const ctxRow = clientContexts.find((c) => String(c.id) === String(selectedClientContextId));
        const scopeLabel = ctxRow?.name?.trim() || 'Contexto geral';

        const blob = await pdf(
          <PdfDocument
            planningData={{
              planningSteps: finalSteps,
              clientName,
              scopeLabel,
              month: selectedMonth,
              year: selectedYear,
            }}
          />
        ).toBlob();

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const safeScope = scopeLabel.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
        link.download = `Planejamento_v${planningToExport.version}_${safeScope}_${selectedMonth}-${selectedYear}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch(e) {
        toast({ title: "Erro ao gerar PDF", description: e.message, variant: "destructive"});
    } finally {
        setIsDownloading(false);
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, name: new Date(0, i).toLocaleString('pt-BR', { month: 'long' }) }));
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center md:text-left">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary mb-2 flex items-center justify-center md:justify-start">
          <BrainCircuit className="w-6 h-6 mr-2 md:w-8 md:h-8 md:mr-3" />
          Planejamento Estratégico com IA
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Gere, versione e refine planos mensais com base no contexto do cliente (ficha e blocos de contexto).
        </p>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle className="text-center md:text-left">Configuração do Planejamento</CardTitle>
          <CardDescription className="text-center md:text-left">Selecione o cliente, o contexto (quando existir) e o período para começar.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium">Cliente</label>
            <Select onValueChange={handleClientChange} value={selectedClientId || ''}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Contexto do cliente</label>
            <Select
              onValueChange={handleClientContextChange}
              value={selectedClientContextId || ''}
              disabled={!selectedClientId || clientContexts.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={clientContexts.length === 0 ? 'Nenhum contexto cadastrado' : 'Selecione...'} />
              </SelectTrigger>
              <SelectContent>
                {clientContexts.map((ctx) => (
                  <SelectItem key={ctx.id} value={String(ctx.id)}>
                    {ctx.name?.trim() || `Contexto #${ctx.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClientId && clientContexts.length === 0 && (
              <p className="text-xs text-muted-foreground">Cadastre blocos de contexto na ficha do cliente para filtrar o planejamento.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><label className="text-sm font-medium">Mês</label><Select onValueChange={(v) => setSelectedMonth(parseInt(v))} value={String(selectedMonth)}><SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><label className="text-sm font-medium">Ano</label><Select onValueChange={(v) => setSelectedYear(parseInt(v))} value={String(selectedYear)}><SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <Button onClick={handleLoadHistory} disabled={!selectedClientId || !contextSelectionOk || isLoading} className="w-full lg:w-auto">
            {isLoading ? <Loader2 className="animate-spin mr-2" /> : <History className="mr-2 h-4 w-4" />}
            Carregar Histórico
          </Button>
        </CardContent>
      </Card>
      
      {view === 'history' && (
        <Card>
            <CardHeader>
                <CardTitle className="text-center md:text-left">Histórico de Planejamentos</CardTitle>
                <CardDescription className="text-center md:text-left">Escolha uma versão para continuar ou exportar, ou crie uma nova.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button onClick={handleCreateNewPlanning} className="w-full">
                    <PlusCircle className="mr-2 h-4 w-4" /> Criar Novo Planejamento (Versão {planningHistory.length > 0 ? Math.max(...planningHistory.map(p => p.version)) + 1 : 1})
                </Button>
                {planningHistory.length > 0 ? (
                    <div className="border rounded-md">
                        {planningHistory.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                                <div>
                                    <p className="font-semibold">Versão {p.version}</p>
                                    <p className="text-sm text-muted-foreground">Criado em: {new Date(p.created_at).toLocaleString()}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleContinuePlanning(p)}>Continuar</Button>
                                    <Button variant="secondary" size="sm" onClick={() => generatePdf(p, null)} disabled={isDownloading}>
                                        {isDownloading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-center text-muted-foreground">Nenhum planejamento anterior encontrado para este período.</p>}
            </CardContent>
        </Card>
      )}

      {view === 'planner' && currentPlanning && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={() => setView('history')}>&larr; Voltar ao Histórico</Button>
            <Button onClick={() => generatePdf(currentPlanning, planningSteps)} disabled={isDownloading}>
              {isDownloading ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2 h-4 w-4" />}
              Exportar PDF (v{currentPlanning.version})
            </Button>
          </div>
          {planningStepsConfig.map((config, index) => {
              const isEnabled = index === 0 || !!planningSteps[planningStepsConfig[index - 1].id]?.is_approved;
              const clientDataForStep = clients.find((c) => c.id === parseInt(selectedClientId, 10));
              const ctxRow = clientContexts.find((c) => String(c.id) === String(selectedClientContextId));

              return (
                <StepCard
                  key={config.id}
                  step={config.id}
                  title={config.title}
                  description={config.description}
                  planningId={currentPlanning.id}
                  initialData={planningSteps[config.id]}
                  onUpdate={handleStepUpdate}
                  isEnabled={isEnabled}
                  context={{
                    clientId: selectedClientId,
                    clientData: clientDataForStep,
                    campaignId: null,
                    campaignData: null,
                    clientContextId: selectedClientContextId || null,
                    clientContextData: ctxRow
                      ? { name: ctxRow.name, content: ctxRow.content }
                      : null,
                    month: selectedMonth,
                    year: selectedYear,
                    previousSteps: planningSteps,
                  }}
                />
              );
          })}
        </motion.div>
      )}
    </div>
  );
};

export default StrategicPlannerPage;