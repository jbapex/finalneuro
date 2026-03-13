import React, { useState, useEffect, useMemo } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Play, Loader2, ChevronsUpDown, Settings, FileText } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getFriendlyErrorMessage } from '@/lib/utils';

const LlmIntegrationSelector = ({ integrations, selectedId, onSelect, disabled }) => {
    const [open, setOpen] = useState(false);
    const selectedIntegration = integrations.find(i => i.id === selectedId);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="flex-1 justify-between text-xs h-8" disabled={disabled}>
                    <span className="truncate">
                        {selectedIntegration ? selectedIntegration.name : "Selecione a IA"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Procurar conexão..." />
                    <CommandList>
                        <CommandEmpty>Nenhuma conexão encontrada.</CommandEmpty>
                        <CommandGroup>
                            {integrations.map((integration) => (
                                <CommandItem
                                    key={integration.id}
                                    value={integration.name}
                                    onSelect={() => {
                                        onSelect(integration.id);
                                        setOpen(false);
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${integration.is_user_connection ? 'bg-green-500' : 'bg-blue-500'}`} />
                                        <span>{integration.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            ({integration.is_user_connection ? 'Pessoal' : 'Global'})
                                        </span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

const ALL_CONTEXTS_ID = '__all__';
const NONE_CONTEXT_ID = '__none__';

const AgentNode = ({ id, data, isConnectable, selected }) => {
    const { onUpdateNodeData, onAddAgentOutputNode, modules, campaigns = [], inputData, selectedModuleId, optionalText, selectedContextId, selectedCampaignId } = data;
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [llmIntegrations, setLlmIntegrations] = useState([]);
    const [selectedLlmId, setSelectedLlmId] = useState(data.llm_integration_id || null);

    const handleModuleChange = (moduleId) => {
        const selectedModule = modules.find(m => m.id.toString() === moduleId);
        onUpdateNodeData(id, { 
            selectedModuleId: moduleId, 
            label: selectedModule ? `Agente: ${selectedModule.name}` : 'Agente de IA'
        });
    };

    const selectedModule = useMemo(
        () => (modules || []).find(m => m.id.toString() === selectedModuleId),
        [modules, selectedModuleId]
    );
    const moduleConfig = selectedModule?.config || { use_client: false, use_campaign: true, use_complementary_text: true };

    const clientFromUpstream = inputData?.client?.data;
    const campaignFromUpstream = inputData?.campaign?.data;
    const clientContexts = clientFromUpstream?.client_contexts || [];
    const filteredCampaigns = useMemo(() => {
        if (!campaigns?.length) return [];
        const clientId = clientFromUpstream?.id;
        if (clientId) return campaigns.filter(c => c.client_id?.toString() === clientId.toString());
        return campaigns;
    }, [campaigns, clientFromUpstream?.id]);

    const handleOptionalTextChange = (e) => {
        onUpdateNodeData(id, { optionalText: e.target.value });
    };
    const handleContextChange = (value) => {
        onUpdateNodeData(id, { selectedContextId: value || NONE_CONTEXT_ID });
    };
    const handleCampaignChange = (campaignId) => {
        onUpdateNodeData(id, { selectedCampaignId: campaignId || null });
    };

    // Fetch AI integrations
    useEffect(() => {
        const fetchIntegrations = async () => {
            if (!user || !profile) return;
            
            try {
                // PRIORIDADE 1: Buscar conexões pessoais do usuário primeiro
                let userConnections = [];
                const { data: userData, error: userError } = await supabase
                    .from('user_ai_connections')
                    .select('id, name, provider, default_model, capabilities, is_active')
                    .eq('user_id', user.id)
                    .eq('is_active', true);

                if (!userError && userData) {
                    // Filtrar apenas conexões com capacidade de geração de texto
                    userConnections = userData
                        .filter(conn => conn.capabilities?.text_generation === true)
                        .map(conn => ({
                            ...conn,
                            is_user_connection: true,
                            source: 'personal'
                        }));
                }

                // PRIORIDADE 2: Buscar integrações globais apenas se não houver pessoais
                let globalIntegrations = [];
                if (userConnections.length === 0) {
                    const { data: globalData, error: globalError } = await supabase
                        .from('llm_integrations')
                        .select('id, name, provider, default_model');

                    if (!globalError && globalData) {
                        globalIntegrations = globalData
                            .filter(i => i.is_active !== false)
                            .map(i => ({
                                ...i,
                                is_user_connection: false,
                                source: 'global'
                            }));
                    }
                }

                // Combinar integrações (pessoais primeiro, globais depois)
                const allIntegrations = [
                    ...userConnections,
                    ...globalIntegrations
                ];

                setLlmIntegrations(allIntegrations);

                // IA ativa por padrão: preferir a do módulo, senão primeira disponível
                const currentLlmId = data.llm_integration_id ?? selectedLlmId;
                if (!currentLlmId && allIntegrations.length > 0) {
                    const mod = (modules || []).find(m => m.id.toString() === selectedModuleId);
                    const defaultId = (mod?.llm_integration_id && allIntegrations.some(i => i.id === mod.llm_integration_id))
                        ? mod.llm_integration_id
                        : allIntegrations[0].id;
                    setSelectedLlmId(defaultId);
                    onUpdateNodeData(id, { llm_integration_id: defaultId });
                }
            } catch (error) {
                console.error('Erro ao buscar integrações de IA:', error);
                toast({
                    title: 'Erro ao carregar IAs',
                    description: 'Não foi possível carregar as conexões de IA disponíveis.',
                    variant: 'destructive',
                });
            }
        };

        fetchIntegrations();
    }, [user, profile, data.llm_integration_id, selectedLlmId, selectedModuleId, modules, onUpdateNodeData, id, toast]);

    const handleSelectLlm = (llmId) => {
        setSelectedLlmId(llmId);
        onUpdateNodeData(id, { llm_integration_id: llmId });
        toast({
            title: "Conexão de IA alterada!",
            description: "O agente agora usará a nova conexão selecionada."
        });
    };

    const handleGenerateContent = async (refinePrompt = null) => {
        if (!selectedModuleId) {
            toast({
                title: 'Nenhum módulo selecionado',
                description: 'Por favor, selecione um agente de IA para gerar o conteúdo.',
                variant: 'destructive',
            });
            return;
        }

        if (!selectedLlmId) {
            toast({
                title: 'Nenhuma IA selecionada',
                description: 'Por favor, selecione uma conexão de IA antes de gerar o conteúdo.',
                variant: 'destructive',
            });
            return;
        }

        setIsLoading(true);
        if (!refinePrompt) {
            onUpdateNodeData(id, { generatedText: null });
        }

        try {
            // Find the selected AI integration
            const selectedIntegration = llmIntegrations.find(i => i.id === selectedLlmId);
            if (!selectedIntegration) {
                throw new Error('Conexão de IA selecionada não encontrada');
            }

            // Combine o texto opcional com as entradas existentes
            let userTextForFunction = data.optionalText || '';
            if (inputData?.video_transcriber?.data?.transcript_text) {
                userTextForFunction += `\n\nContexto da Transcrição:\n${inputData.video_transcriber.data.transcript_text}`;
            }

            const modulePrompt = selectedModule?.base_prompt || selectedModule?.prompt || '';

            // Documentos de contexto: nó Contexto tem prioridade; senão do nó Cliente (filtrar por selectedContextId)
            const contextContexts = inputData?.context?.data?.contexts;
            let clientContextsRaw = inputData?.client?.data?.client_contexts || [];
            let contextsToUse;
            if (Array.isArray(contextContexts) && contextContexts.length) {
                contextsToUse = contextContexts;
            } else {
                const ctxId = data.selectedContextId;
                if (ctxId === NONE_CONTEXT_ID || !ctxId) {
                    contextsToUse = [];
                } else if (ctxId === ALL_CONTEXTS_ID) {
                    contextsToUse = clientContextsRaw;
                } else {
                    const one = clientContextsRaw.find(c => c.id?.toString() === ctxId);
                    contextsToUse = one ? [one] : [];
                }
            }
            const contextBlock = contextsToUse.length
              ? contextsToUse.map((c) => (c.name ? `[${c.name}]\n${c.content || ''}` : (c.content || ''))).join('\n\n---\n\n')
              : '';

            // Construct detailed prompt with module context
            const detailedPrompt = `Módulo: ${selectedModule?.name || 'Agente de IA'}
Prompt do Módulo: ${modulePrompt}

Contexto do Cliente: ${inputData?.client?.data ? JSON.stringify({ ...inputData.client.data, client_contexts: undefined }, null, 2) : 'N/A'}
${contextBlock ? `Documentos de Contexto do Cliente:\n${contextBlock}\n\n` : ''}Contexto da Campanha: ${(function () {
                const campaignData = inputData?.campaign?.data;
                if (campaignData) return JSON.stringify(campaignData, null, 2);
                const sid = data.selectedCampaignId;
                if (sid && campaigns?.length) {
                    const c = campaigns.find(x => x.id?.toString() === sid);
                    return c ? JSON.stringify(c, null, 2) : 'N/A';
                }
                return 'N/A';
            })()}
Fonte de Conhecimento: ${inputData?.knowledge?.data ? JSON.stringify(inputData.knowledge.data, null, 2) : 'N/A'}

Instruções Adicionais: ${refinePrompt ? `Refine o seguinte texto:\n\n${data.generatedText}\n\nInstrução: ${refinePrompt}` : userTextForFunction}`;

            // Try generic-ai-chat first (preferred method)
            try {
                const { data: functionData, error } = await supabase.functions.invoke('generic-ai-chat', {
                    body: JSON.stringify({
                        messages: [
                            {
                                role: 'user',
                                content: detailedPrompt
                            }
                        ],
                        llm_integration_id: selectedLlmId,
                        is_user_connection: selectedIntegration.is_user_connection,
                    }),
                });

                if (error) throw new Error(error.message);

                const generatedText = functionData.response || functionData.content || 'Conteúdo gerado com sucesso!';
                
                onUpdateNodeData(id, { 
                    generatedText: generatedText,
                    output: { 
                        id: `generated_${Date.now()}`,
                        data: generatedText,
                        moduleName: selectedModule?.name || 'Agente de IA',
                    }
                });
                if (typeof onAddAgentOutputNode === 'function') {
                    onAddAgentOutputNode(id, generatedText, { moduleName: selectedModule?.name || 'Agente de IA' });
                }
                toast({
                    title: refinePrompt ? 'Conteúdo Refinado!' : 'Conteúdo Gerado!',
                    description: `O agente "${selectedModule?.name || 'Agente de IA'}" concluiu a tarefa usando ${selectedIntegration.name}.`,
                });

            } catch (genericError) {
                console.warn('generic-ai-chat failed, trying generate-content:', genericError);
                
                // Fallback to generate-content
                const campaignId = inputData?.campaign?.id ?? (data.selectedCampaignId && campaigns?.length ? campaigns.find(x => x.id?.toString() === data.selectedCampaignId)?.id : null);
                const payload = {
                    module_id: selectedModuleId,
                    campaign_id: campaignId,
                    client_id: inputData?.client?.id,
                    knowledge_source_id: inputData?.knowledge?.id,
                    user_text: refinePrompt ? `Refine o seguinte texto:\n\n${data.generatedText}\n\nInstrução: ${refinePrompt}` : userTextForFunction,
                };

                const { data: functionData, error } = await supabase.functions.invoke('generate-content', {
                    body: JSON.stringify(payload),
                });

                if (error) throw new Error(error.message);

                onUpdateNodeData(id, { 
                    generatedText: functionData.generatedText,
                    output: { 
                        id: functionData.outputId,
                        data: functionData.generatedText,
                        moduleName: functionData.moduleName,
                    }
                });
                if (typeof onAddAgentOutputNode === 'function') {
                    onAddAgentOutputNode(id, functionData.generatedText, { moduleName: functionData.moduleName });
                }
                toast({
                    title: refinePrompt ? 'Conteúdo Refinado!' : 'Conteúdo Gerado!',
                    description: `O agente "${functionData.moduleName}" concluiu a tarefa.`,
                });
            }

        } catch (err) {
            const friendlyMsg = getFriendlyErrorMessage(err);
            toast({
                title: 'Aviso',
                description: friendlyMsg,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const isGenerationDisabled = !selectedModuleId || !selectedLlmId || isLoading;

    return (
        <>
            <div className="react-flow__node-default h-full w-full rounded-lg border-2 border-teal-500/50 shadow-lg bg-card text-card-foreground flex flex-col">
                <NodeResizer 
                    minWidth={320} 
                    minHeight={280}
                    maxWidth={800}
                    maxHeight={600}
                    isVisible={selected} 
                    lineClassName="border-teal-500"
                    handleClassName="bg-teal-500"
                />
                <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-3 h-3 !bg-teal-500" />
                <CardHeader className="flex-row items-center justify-between space-x-2 p-3 bg-teal-500/10">
                    <div className="flex items-center space-x-2">
                        <Bot className="w-5 h-5 text-teal-500" />
                        <CardTitle className="text-base">{data.label || 'Agente de IA'}</CardTitle>
                    </div>
                    <Button onClick={() => handleGenerateContent()} disabled={isGenerationDisabled} size="sm">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        <span className="ml-2">Gerar</span>
                    </Button>
                </CardHeader>
                <CardContent className="p-3 flex-grow flex flex-col min-h-0 space-y-2">
                    <Select onValueChange={handleModuleChange} value={selectedModuleId} disabled={isLoading}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione um agente..." />
                        </SelectTrigger>
                        <SelectContent>
                            {(modules || []).map((module) => (
                                <SelectItem key={module.id} value={module.id.toString()}>
                                    {module.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Conexão de IA - sempre visível quando há integrações */}
                    {selectedModuleId && llmIntegrations.length > 0 && (
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md border">
                            <Settings className="w-4 h-4 text-muted-foreground" />
                            <Label className="text-sm font-medium text-muted-foreground shrink-0">Conexão de IA</Label>
                            <LlmIntegrationSelector
                                integrations={llmIntegrations}
                                selectedId={selectedLlmId}
                                onSelect={handleSelectLlm}
                                disabled={isLoading}
                            />
                        </div>
                    )}

                    {/* Cliente: só leitura a partir do nó anterior */}
                    {selectedModuleId && moduleConfig.use_client && (
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Cliente</Label>
                            {clientFromUpstream ? (
                                <p className="text-sm font-medium truncate" title={clientFromUpstream.name}>Cliente: {clientFromUpstream.name}</p>
                            ) : (
                                <p className="text-xs text-muted-foreground">Conecte um nó Cliente</p>
                            )}
                        </div>
                    )}

                    {/* Campanha: leitura do nó anterior ou selector */}
                    {selectedModuleId && moduleConfig.use_campaign && (
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Campanha</Label>
                            {campaignFromUpstream ? (
                                <p className="text-sm font-medium truncate" title={campaignFromUpstream.name}>Campanha: {campaignFromUpstream.name}</p>
                            ) : (
                                <Select onValueChange={handleCampaignChange} value={selectedCampaignId || ''} disabled={isLoading || !filteredCampaigns.length}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder={filteredCampaigns.length ? "Selecione uma campanha..." : "Conecte um cliente ou escolha..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredCampaigns.map((c) => (
                                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    )}

                    {/* Contexto (opcional) - quando o cliente tem documentos */}
                    {selectedModuleId && clientContexts.length > 0 && (
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                <FileText className="w-3 h-3" /> Contexto (opcional)
                            </Label>
                            <Select
                                value={selectedContextId || NONE_CONTEXT_ID}
                                onValueChange={handleContextChange}
                                disabled={isLoading}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Selecione qual contexto usar..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE_CONTEXT_ID}>Nenhum</SelectItem>
                                    {clientContexts.length > 1 && <SelectItem value={ALL_CONTEXTS_ID}>Todos ({clientContexts.length})</SelectItem>}
                                    {clientContexts.map((c) => (
                                        <SelectItem key={c.id} value={String(c.id)}>{c.name || 'Sem título'}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Texto complementar - só se o módulo usar */}
                    {selectedModuleId && moduleConfig.use_complementary_text && (
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Informações para a IA</Label>
                            <Textarea
                                placeholder="Adicione qualquer informação extra para a IA..."
                                value={optionalText || ''}
                                onChange={handleOptionalTextChange}
                                className="nodrag h-20 text-sm resize-y"
                                disabled={isLoading}
                            />
                        </div>
                    )}
                    <div className="min-h-[48px] flex items-center justify-center rounded-md border bg-muted/30 p-2">
                        {isLoading ? (
                            <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                        ) : data.generatedText ? (
                            <p className="text-xs text-muted-foreground">Conteúdo enviado para o nó conectado à direita.</p>
                        ) : (
                            <p className="text-xs text-muted-foreground">Clique em Gerar para criar um nó com o resultado.</p>
                        )}
                    </div>
                </CardContent>
                <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="w-3 h-3 !bg-teal-500" />
            </div>
        </>
    );
};

export default AgentNode;