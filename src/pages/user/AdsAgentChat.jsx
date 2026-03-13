import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, Sparkles, Copy, Check, ThumbsUp, ThumbsDown, ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import EditWithAiModal from '@/components/strategic-planner/EditWithAiModal';

import { getFriendlyErrorMessage } from '@/lib/utils';

const AdsAgentChat = () => {
  const { agentId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [agent, setAgent] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState({ agent: true, campaigns: true, generation: false });
  
  const resultsEndRef = useRef(null);

  const fetchAgentDetails = useCallback(async () => {
    if (!agentId) return;
    setLoading(prev => ({ ...prev, agent: true }));
    const { data, error } = await supabase.from('ads_agents').select('*').eq('id', agentId).single();
    if (error) {
      toast({ title: 'Erro ao carregar agente', description: error.message, variant: 'destructive' });
    } else {
      setAgent(data);
    }
    setLoading(prev => ({ ...prev, agent: false }));
  }, [agentId, toast]);

  const fetchCampaigns = useCallback(async () => {
    if (!user) return;
    setLoading(prev => ({ ...prev, campaigns: true }));
    const { data, error } = await supabase.from('campaigns').select('*, clients(name)').eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Erro ao carregar campanhas', description: error.message, variant: 'destructive' });
    } else {
      setCampaigns(data);
    }
    setLoading(prev => ({ ...prev, campaigns: false }));
  }, [user, toast]);

  useEffect(() => {
    fetchAgentDetails();
    fetchCampaigns();
  }, [fetchAgentDetails, fetchCampaigns]);

  useEffect(() => {
    resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [results]);

  const handleGenerate = async (refinementPrompt = '', existingContent = null) => {
    if (!selectedCampaign) {
        toast({ title: 'Selecione uma campanha', description: 'Você precisa escolher uma campanha para gerar o conteúdo.', variant: 'destructive' });
        return;
    }
    setLoading(prev => ({ ...prev, generation: true }));

    try {
        const campaignPayload = {
            ...selectedCampaign,
            client_name: selectedCampaign.clients?.name || 'N/A'
        };

        let userText = refinementPrompt;
        if(existingContent) {
            userText = `--- CONTEÚDO BASE PARA REFINAR ---\n${existingContent}\n\n--- INSTRUÇÕES DE REFINAMENTO ---\n${refinementPrompt}`;
        }

        const { data, error } = await supabase.functions.invoke('generate-ads-content', {
            body: JSON.stringify({
                ads_agent_id: agent.id,
                campaign_data: campaignPayload,
                user_text: userText, // Use o novo campo user_text
            }),
        });

        if (error) {
            const errorBody = await error.context.json();
            throw new Error(errorBody.error);
        }

        const newResult = { agentName: agent.name, text: data.generatedText, outputId: data.outputId, copied: false };
        
        if (existingContent) {
            // Replace the last result if we are refining it
            setResults(prev => [...prev.slice(0, prev.length - 1), newResult]);
        } else {
            setResults(prev => [...prev, newResult]);
        }
        
    } catch (error) {
        const friendlyMsg = getFriendlyErrorMessage(error);
        toast({ title: 'Aviso', description: friendlyMsg, variant: 'destructive' });
    } finally {
        setLoading(prev => ({ ...prev, generation: false }));
    }
};

  const handleCopy = (index) => {
    const result = results[index];
    navigator.clipboard.writeText(result.text);
    setResults(prev => prev.map((r, i) => i === index ? { ...r, copied: true } : r));
    setTimeout(() => {
      setResults(prev => prev.map((r, i) => i === index ? { ...r, copied: false } : r));
    }, 2000);
    toast({ title: 'Copiado!', description: 'O conteúdo foi copiado para a área de transferência.' });
  };

  const handleFeedback = (outputId, feedbackType) => {
    console.log(`Feedback: ${feedbackType} para o output ${outputId}`);
    toast({ title: 'Obrigado pelo feedback!', description: 'Isso nos ajuda a melhorar os resultados.' });
  };

  if (loading.agent || loading.campaigns) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-16 h-16 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background text-foreground">
      <header className="flex items-center p-4 border-b">
        <Button asChild variant="ghost" size="icon" className="mr-4">
          <Link to="/ferramentas/criador-de-anuncios"><ChevronLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">{agent?.name || 'Agente de ADS'}</h1>
          <p className="text-sm text-muted-foreground">{agent?.description || 'Gere conteúdo para suas campanhas.'}</p>
        </div>
      </header>

      <div className="flex-1 grid md:grid-cols-2 gap-8 p-8 overflow-y-auto">
        <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Configure a Geração</CardTitle>
              <CardDescription>Selecione a campanha para alimentar a IA.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-2 block">1. Selecione a Campanha</label>
                <Select onValueChange={(value) => setSelectedCampaign(campaigns.find(c => c.id.toString() === value))} disabled={loading.campaigns}>
                  <SelectTrigger>
                    <SelectValue placeholder={loading.campaigns ? "Carregando..." : "Escolha uma campanha"} />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name} ({c.clients?.name || 'Sem cliente'})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => handleGenerate()} className="w-full" disabled={loading.generation || !selectedCampaign}>
                {loading.generation ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Gerar Conteúdo
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5 }} className="flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {results.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center rounded-lg bg-muted p-8">
                <Sparkles className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold">Resultados Aparecerão Aqui</h3>
                <p className="text-muted-foreground">Selecione uma campanha e clique em "Gerar Conteúdo".</p>
              </div>
            )}
            {results.map((result, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold flex items-center"><Bot className="w-5 h-5 mr-2" /> {result.agentName}</h4>
                      <div className="flex items-center space-x-1">
                          <EditWithAiModal 
                              onGenerate={(prompt) => handleGenerate(prompt, result.text)}
                              isLoading={loading.generation}
                              title={`Refinar: ${result.agentName}`}
                              disabled={loading.generation}
                          />
                        <Button variant="ghost" size="icon" onClick={() => handleFeedback(result.outputId, 'positive')}><ThumbsUp className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleFeedback(result.outputId, 'negative')}><ThumbsDown className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleCopy(index)}>
                          {result.copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">{result.text}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            <div ref={resultsEndRef} />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdsAgentChat;