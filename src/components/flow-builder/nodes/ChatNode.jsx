import React, { useState, useEffect, useRef } from 'react';
    import { Link } from 'react-router-dom';
    import { Handle, Position } from 'reactflow';
    import { Bot, Send, CheckCircle, Sparkles, PlusCircle, ChevronsUpDown, Settings } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { Textarea } from '@/components/ui/textarea';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import AiChatMessage from '@/components/ai-chat/AiChatMessage';
    import { Card, CardContent } from '@/components/ui/card';
    import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
    import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { getFriendlyErrorMessage } from '@/lib/utils';

    /** Inclui conexão se não houver capabilities ou se texto não estiver explicitamente desativado. */
    const isTextConnection = (conn) =>
        conn.capabilities == null || conn.capabilities?.text_generation !== false;

    const FLOW_CHAT_SYSTEM_PROMPT =
        'Você está no Fluxo Criativo da plataforma. Use o contexto do fluxo (cliente, campanha, conhecimento ligados aos nós) para responder de forma objetiva e útil. Responda em português quando o utilizador escrever em português.';

    const fieldTranslations = {
        name: 'Nome',
        objective: 'Objetivo',
        about: 'Sobre',
        phone: 'Telefone',
        creator_name: 'Nome do Criador',
        niche: 'Nicho',
        style_in_3_words: 'Estilo em 3 palavras',
        product_to_promote: 'Produto a promover',
        target_audience: 'Público-alvo',
        success_cases: 'Casos de sucesso',
        profile_views: 'Visualizações de perfil',
        followers: 'Seguidores',
        appearance_format: 'Formato de aparência',
        catchphrases: 'Frases de efeito'
    };

    const LlmIntegrationSelector = ({ integrations, selectedId, onSelect, disabled }) => {
        const [open, setOpen] = useState(false);
        const selectedIntegration = integrations.find(i => i.id === selectedId);

        return (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between text-xs h-9 gap-1" disabled={disabled}>
                        <Settings className="w-3 h-3 shrink-0" />
                        <span className="truncate min-w-0 text-left flex-1">
                            {selectedIntegration ? selectedIntegration.name : "Selecione a conexão de IA"}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[260px] max-w-[90vw] p-0" align="end">
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
                                        {integration.name} ({integration.default_model})
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        );
    };


    const ChatNode = ({ id, data, isConnectable }) => {
      const { onUpdateNodeData, inputData, onRefreshData } = data;
      const { user, profile } = useAuth();
      const [messages, setMessages] = useState(data.messages || []);
      const [input, setInput] = useState('');
      const [isLoading, setIsLoading] = useState(false);
      const { toast } = useToast();
      const scrollAreaRef = useRef(null);

      const [llmIntegrations, setLlmIntegrations] = useState([]);
      const [selectedLlmId, setSelectedLlmId] = useState(data.llm_integration_id || null);

      useEffect(() => {
        let cancelled = false;
        const fetchIntegrations = async () => {
            if (!user?.id || !profile) return;
            try {
                let userConnections = [];
                const { data: userData, error: userError } = await supabase
                    .from('user_ai_connections')
                    .select('id, name, provider, default_model, capabilities, is_active')
                    .eq('user_id', user.id)
                    .eq('is_active', true);

                if (!userError && userData) {
                    userConnections = userData
                        .filter(isTextConnection)
                        .map((conn) => ({
                            ...conn,
                            is_user_connection: true,
                            source: 'personal',
                        }));
                }

                let integrations = userConnections;
                if (integrations.length === 0) {
                    const { data: globalData, error: globalError } = await supabase
                        .from('llm_integrations')
                        .select('id, name, provider, default_model, is_active');

                    if (!globalError && globalData) {
                        integrations = globalData
                            .filter((i) => i.is_active !== false)
                            .map((i) => ({
                                ...i,
                                is_user_connection: false,
                                source: 'global',
                            }));
                    }
                }

                if (cancelled) return;
                setLlmIntegrations(integrations || []);

                const stored = data.llm_integration_id;
                const stillValid = stored && integrations?.some((i) => String(i.id) === String(stored));
                if (stillValid) {
                    setSelectedLlmId(stored);
                    return;
                }
                if (integrations && integrations.length > 0) {
                    const defaultIntegration = integrations.find((i) => i.name === 'Chat') || integrations[0];
                    if (defaultIntegration) {
                        setSelectedLlmId(defaultIntegration.id);
                        onUpdateNodeData(id, { llm_integration_id: defaultIntegration.id });
                    }
                }
            } catch (e) {
                if (!cancelled) {
                    console.error('[ChatNode] conexões IA:', e);
                    toast({
                        title: 'Erro ao carregar conexões',
                        description: e?.message || 'Não foi possível listar as conexões de IA.',
                        variant: 'destructive',
                    });
                }
            }
        };
        fetchIntegrations();
        return () => {
            cancelled = true;
        };
        // onUpdateNodeData omitido (referência instável no canvas)
      }, [user?.id, profile, id, data.llm_integration_id, toast]);

      const handleSelectLlm = (llmId) => {
        setSelectedLlmId(llmId);
        onUpdateNodeData(id, { llm_integration_id: llmId });
        toast({
            title: "Conexão de IA alterada!",
            description: "As próximas mensagens usarão a nova conexão selecionada."
        });
      };

      useEffect(() => {
        if (scrollAreaRef.current) {
            const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if(viewport) viewport.scrollTop = viewport.scrollHeight;
        }
      }, [messages]);

      useEffect(() => {
        if (data.messages !== messages) {
          setMessages(data.messages || []);
        }
        if (data.llm_integration_id !== selectedLlmId) {
            setSelectedLlmId(data.llm_integration_id);
        }
      }, [data.messages, data.llm_integration_id]);

      const handleApplySuggestion = async (suggestion) => {
        try {
            const { node_id, node_type, updates } = suggestion;
            const tableName = node_type === 'client' ? 'clients' : 'campaigns';

            if (node_id === null && node_type === 'campaign') {
                const { data: userAuth } = await supabase.auth.getUser();
                if (!userAuth.user) throw new Error("Usuário não autenticado para criar campanha.");
                
                const newCampaignData = {
                    ...updates,
                    user_id: userAuth.user.id,
                };

                const { data: createdData, error } = await supabase
                    .from(tableName)
                    .insert(newCampaignData)
                    .select()
                    .single();

                if (error) throw error;

                toast({
                    title: "Campanha Criada!",
                    description: `A campanha "${createdData.name}" foi criada com sucesso.`
                });

                if (onRefreshData) {
                    onRefreshData();
                }

            } else {
                const targetNodeId = node_id;
                let primaryKey;
                if (node_type === 'client') {
                    primaryKey = inputData.client?.id;
                } else if (node_type === 'campaign') {
                    primaryKey = inputData.campaign?.id;
                }

                if (!primaryKey) {
                    throw new Error(`Não foi possível encontrar o ID do ${node_type} conectado.`);
                }

                const { error } = await supabase
                    .from(tableName)
                    .update(updates)
                    .eq('id', primaryKey);

                if (error) throw error;

                toast({
                    title: "Sugestão Aplicada!",
                    description: `O ${node_type} foi atualizado com sucesso.`
                });
                
                if(targetNodeId && onUpdateNodeData) {
                    onUpdateNodeData(targetNodeId, { refresh: Date.now() });
                }
            }

            const confirmationMessage = { role: 'assistant', content: { type: 'chat', content: `Ação no ${node_type} foi concluída com sucesso!` } };
            const updatedMessages = [...messages, confirmationMessage];
            setMessages(updatedMessages);
            onUpdateNodeData(id, { messages: updatedMessages, output: { data: updatedMessages } });

        } catch (err) {
            toast({
                title: 'Erro ao aplicar sugestão',
                description: err.message,
                variant: 'destructive',
            });
        }
      };
      
      const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        if (!selectedLlmId) {
            toast({
                title: "Selecione uma Conexão de IA",
                description: "Por favor, escolha uma conexão de IA no topo da janela de chat antes de enviar uma mensagem.",
                variant: "destructive",
            });
            return;
        }

        const userMessage = { role: 'user', content: input };
        const newMessages = [...messages, userMessage];
        
        setMessages(newMessages);
        onUpdateNodeData(id, { messages: newMessages });

        const originalInput = input;
        setInput('');
        setIsLoading(true);

        try {
          const messagesForApi = newMessages.map(msg => {
            if (msg.role === 'user') {
              return { role: 'user', content: msg.content };
            }
            if (msg.role === 'assistant') {
              if (typeof msg.content === 'object' && msg.content !== null) {
                  if (msg.content.type === 'chat') {
                      return { role: 'assistant', content: msg.content.content };
                  }
              } else if (typeof msg.content === 'string') {
                return { role: 'assistant', content: msg.content };
              }
            }
            return null;
          }).filter(Boolean);

          const flowContextJson = JSON.stringify(inputData || {}, null, 2);
          const apiMessages = [
            {
              role: 'system',
              content: `${FLOW_CHAT_SYSTEM_PROMPT}\n\nContexto do fluxo (dados dos nós ligados):\n${flowContextJson}`,
            },
            ...messagesForApi,
          ];

          const selectedConn = llmIntegrations.find((i) => String(i.id) === String(selectedLlmId));

          const { data: functionData, error } = await supabase.functions.invoke('generic-ai-chat', {
            body: JSON.stringify({
              messages: apiMessages,
              llm_integration_id: selectedLlmId,
              is_user_connection: selectedConn?.is_user_connection === true,
            }),
          });

          if (error) throw new Error(error.message);
          
          const assistantResponse = functionData.response;
          const finalMessages = [...newMessages, { role: 'assistant', content: assistantResponse }];

          setMessages(finalMessages);
          onUpdateNodeData(id, { messages: finalMessages, output: { data: finalMessages } });

        } catch (err) {
          const existingMessages = [...messages];
          setMessages(existingMessages);
          onUpdateNodeData(id, { messages: existingMessages });
          setInput(originalInput);
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

      const renderMessageContent = (msg, index) => {
        if (msg.role === 'assistant' && typeof msg.content === 'object' && msg.content !== null) {
          const contentData = msg.content;
          if (contentData.type === 'suggestion') {
            const isCreation = contentData.node_id === null;
            return (
              <Card key={index} className="bg-primary/10 border-primary/20 mt-2">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                    <div>
                        <p className="font-semibold text-sm mb-2">
                          {isCreation ? `Sugestão de Criação (${contentData.node_type})` : 'Sugestão de Alteração'}
                        </p>
                        <p className="text-muted-foreground text-sm italic">"{contentData.explanation}"</p>
                        <div className="my-2 p-2 border-l-2 border-primary/30 text-sm">
                          {Object.entries(contentData.updates).map(([key, value]) => {
                            if (key === 'client_id' && isCreation) return null;
                            return (
                                <p key={key}>
                                    <strong className="font-medium">{fieldTranslations[key] || key}:</strong> {String(value)}
                                </p>
                            )
                          })}
                        </div>
                        <Button size="sm" className="mt-3" onClick={() => handleApplySuggestion(contentData)}>
                            {isCreation ? <PlusCircle className="w-4 h-4 mr-2" /> : <CheckCircle className="w-4 h-4 mr-2"/>}
                            {isCreation ? `Criar ${contentData.node_type}` : 'Aplicar Alteração'}
                        </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }
        }
        return <AiChatMessage key={index} message={msg} />;
      };

      return (
        <div className="react-flow__node-default w-[700px] h-[700px] rounded-lg border-2 border-primary/50 shadow-lg bg-card text-card-foreground flex flex-col overflow-hidden">
          <Handle
            type="target"
            position={Position.Left}
            isConnectable={isConnectable}
            className="w-3 h-3 !bg-primary"
          />
          <div className="p-3 sm:p-4 bg-card-header rounded-t-lg border-b flex-shrink-0 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2 min-w-0">
                <Bot className="h-6 w-6 text-primary shrink-0" />
                <div className="font-bold text-base sm:text-lg truncate">{data.label}</div>
            </div>
            <div className="flex flex-col gap-1 w-full sm:w-[min(100%,320px)] sm:shrink-0">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Conexão de IA
              </span>
              {llmIntegrations.length > 0 ? (
                <LlmIntegrationSelector
                  integrations={llmIntegrations}
                  selectedId={selectedLlmId}
                  onSelect={handleSelectLlm}
                  disabled={isLoading}
                />
              ) : (
                <p className="text-xs text-muted-foreground leading-snug">
                  Nenhuma conexão ativa. Configure em{' '}
                  <Link to="/settings/ai" className="text-primary underline font-medium">
                    Minha IA
                  </Link>
                  .
                </p>
              )}
            </div>
          </div>
          <div className="flex-grow flex flex-col p-2 min-h-0">
            <div className="flex-grow flex flex-col border rounded-md min-h-0 overflow-hidden">
              <ScrollArea className="flex-1 p-2 nodrag" ref={scrollAreaRef}>
                {messages.length === 0 && (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    A conversa aparecerá aqui.
                  </div>
                )}
                <div className="space-y-4 text-left">
                  {messages.map((msg, index) => renderMessageContent(msg, index))}
                  {isLoading && <AiChatMessage.Loading />}
                </div>
              </ScrollArea>
              <div className="p-2 border-t nodrag flex-shrink-0">
                <form onSubmit={handleSendMessage} className="relative">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder="Sua mensagem..."
                    className="pr-10 text-sm resize-none"
                    rows={2}
                    disabled={isLoading}
                  />
                  <Button type="submit" size="icon" className="absolute right-1 bottom-1 h-7 w-7 rounded-full" disabled={!input.trim() || isLoading}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
           <Handle
            type="source"
            position={Position.Right}
            isConnectable={isConnectable}
            className="w-3 h-3 !bg-primary"
          />
        </div>
      );
    };

    export default ChatNode;