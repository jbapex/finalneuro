import React, { useState, useEffect, useRef, useCallback } from 'react';
    import { useNavigate } from 'react-router-dom';
    import { motion } from 'framer-motion';
    import { Send, Menu, Loader2, Square, ChevronsUpDown, Brain, Settings2, Share2, Download, Plus, Briefcase, Sparkles, Mic, Paperclip, FileText, ListChecks, Layers, Blocks, X, ImageIcon } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { Textarea } from '@/components/ui/textarea';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/customSupabaseClient';
    import { consumeOpenAICompatibleSse } from '@/lib/aiChatStream';
    import { useMediaQuery } from '@/hooks/use-media-query';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import AiChatSidebar from '@/components/ai-chat/AiChatSidebar';
import AiChatMessage from '@/components/ai-chat/AiChatMessage';
import AiChatAttachmentProgress from '@/components/ai-chat/AiChatAttachmentProgress';
import ContextPanel from '@/components/ai-chat/ContextPanel';
import PromptPanel from '@/components/ai-chat/PromptPanel';
import ThemeToggle from '@/components/ThemeToggle';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { getFriendlyErrorMessage } from '@/lib/utils';
import { getLogoUrlForIntegration } from '@/lib/llmIntegrationLogo';
import { NEURODESIGN_CHAT_FILL_STORAGE_KEY } from '@/lib/neurodesign/chatBridge';
import { fetchClientProfilesForChat, formatClientProfileForPrompt } from '@/lib/aiChatContexts';
import {
  buildUserContentForApi,
  sanitizeMessagesForDb,
  userContentToApiPayload,
  makePendingAttachment,
  CHAT_ATTACH_MAX_FILES,
  classifyChatAttachment,
} from '@/lib/aiChatAttachments';

const DEEP_RESEARCH_SYSTEM_PROMPT =
  'Você está no modo Deep Research. Para cada pergunta, faça uma análise profunda, traga contexto, compare alternativas e apresente um resumo final com próximos passos práticos. Seja estruturado, organizado em tópicos e indique fontes ou hipóteses quando não tiver certeza.';

const NEURODESIGN_IMAGE_SYSTEM_PROMPT =
  'Você está no modo "Prompt para NeuroDesign". Atue como diretor de arte / designer sênior de marcas de alto padrão (agência premium, não estética amadora ou genérica de IA).\n\n' +
  'OBJETIVO DO BRIEF\n' +
  '- Produzir UM brief único, denso e executável para o gerador NeuroDesign, pensado para arte que POSICIONA: hierarquia clara, mensagem estratégica, credibilidade e desejo — nunca "arte genérica feita com IA".\n' +
  '- Evite clichês visuais de IA: cores saturadas demais sem critério, glow neon gratuito, composições simétricas vazias, estilo "stock futurista", rostos plastificados, texturas genéricas, excesso de elementos sem narrativa.\n' +
  '- Prefira linguagem de briefing profissional: referência de mood (fotografia editorial, design gráfico premiado, identidade de marca real), tratamento de luz, grain/film ou limpeza intencional, grid, respiro negativo, contraste tipográfico, tom emocional alinhado ao posicionamento.\n' +
  '- INSPIRAÇÃO DE ESTILO (adapte ao pedido; não invente marcas de terceiros): peças de social ads de agência — foto real de ambiente + layout com molduras geométricas e tipografia bold; capa de carrossel com retrato cinematográfico e colagem/textura (papel, jornal) com UM acento neon ou cor de destaque disciplinada; workshop/evento com paleta enxuta (ex. teal/preto), bokeh, grain leve, elementos tipo glass em pills; metáforas fotográficas (produto, xadrez, cenário escuro com ouro); dark mode com acento lima ou vermelho institucional; minimalismo editorial com muito espaço negativo; 3D apenas se for nível comercial/cinematográfico (texturas críveis, rim light), nunca cartoon genérico.\n\n' +
  'O BRIEF DEVE COBRIR (de forma integrada, em prosa objetiva)\n' +
  '- Proposta de valor / mensagem principal e público-alvo implícito.\n' +
  '- Posicionamento: premium, aspiracional, institucional, disruptivo etc. — e o que a peça deve fazer sentir (confiança, urgência, pertencimento, autoridade…).\n' +
  '- Direção visual: fotografia vs ilustração vs híbrido; realismo ou abstração; época/referência cultural se fizer sentido.\n' +
  '- Paleta com intenção (não só "cores bonitas"): tons, contraste, acento cromático único se aplicável.\n' +
  '- Composição: regra dos terços ou estrutura deliberada, foco visual, ritmo, uso do espaço negativo.\n' +
  '- Tipografia na arte (se houver): peso, estilo, hierarquia headline/sub/CTA; evitar combinações genéricas sem critério.\n' +
  '- Formato sugerido (feed 4:5, stories 9:16, quadrado) e uso (campanha, orgânico, anúncio).\n\n' +
  'Responda em português do Brasil. Pode incluir até 2 frases introdutórias opcionais antes do bloco técnico.\n\n' +
  'OBRIGATÓRIO: ao final, um único bloco entre estes marcadores (sem alterar os nomes):\n' +
  '<<<NEURODESIGN_PROMPT>>>\n' +
  '[Brief em prosa densa: inclua sempre intenção de ILUMINAÇÃO (ex.: rim light, low-key, luz de estúdio), TEXTURA (pele real, metal, papel, grain opcional), COMPOSIÇÃO (terços, camadas, espaço negativo) e HIERARQUIA TIPOGRÁFICA se houver texto. Deixe explícito o que NÃO fazer para evitar cara de IA genérica.]\n' +
  '<<<END_NEURODESIGN_PROMPT>>>\n\n' +
  'Nada após <<<END_NEURODESIGN_PROMPT>>>. Dentro dos marcadores: só o brief, sem meta-comentários ("segue o brief", "espero que goste").';

const chatAssistantPlainText = (content) => {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object' && content.text != null) return String(content.text);
  return '';
};

const chatUserPlainText = (content) => {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object' && content.v === 2) {
    const t = (content.text || '').trim();
    const names = (content.files || []).map((f) => f.name).filter(Boolean);
    const extra = names.length ? ` [Anexos: ${names.join(', ')}]` : '';
    return (t || (names.length ? 'Anexo(s)' : '')) + extra;
  }
  if (typeof content === 'object' && content.type === 'chat_user_v2') {
    let t = (content.text || '').trim();
    if (content.hadImages && content.imageCount > 0) {
      t += ` [${content.imageCount} imagem(ns) anexada(s)]`;
    }
    if (content.hadPdfs && content.pdfCount > 0) {
      t += ` [${content.pdfCount} PDF(s)]`;
    }
    return t;
  }
  if (Array.isArray(content)) {
    const texts = content.filter((p) => p?.type === 'text').map((p) => p.text || '').join('\n');
    const n = content.filter((p) => p?.type === 'image_url').length;
    const p = content.filter((q) => q?.type === 'input_file').length;
    return (texts || '') + (p ? ` [${p} PDF(s)]` : '') + (n ? ` [${n} imagem(ns)]` : '');
  }
  if (typeof content === 'object' && content.text != null) return String(content.text);
  if (typeof content === 'object' && typeof content.content === 'string') return content.content;
  return '';
};

/** Texto do utilizador para título na lista (sem sufixos longos de anexos no nome da conversa). */
const chatUserPlainTextForTitle = (content) => {
  const full = chatUserPlainText(content);
  if (!full) return '';
  return full
    .replace(/\s*\[Anexos?:[^\]]*\]/gi, '')
    .replace(/\s*\[\d+\s*PDF(?:\(s\))?\]/gi, '')
    .replace(/\s*\[\d+\s*imagem(?:\(ns\))?\s*anexada\(s\)\]/gi, '')
    .replace(/\s*\[[^\]]*PDF[^\]]*\]/gi, '')
    .trim();
};

/** Trecho do fio recente para ancorar sugestões no mesmo assunto (Edge Function generate-chat-follow-ups). */
const buildFollowUpConversationThread = (finalMessages) => {
  if (!Array.isArray(finalMessages) || finalMessages.length === 0) return '';
  const maxTotal = 12000;
  const maxUserChunk = 2200;
  const maxAsstChunk = 3500;
  const slice = finalMessages.slice(-12);
  const parts = [];
  let total = 0;
  for (const m of slice) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const roleLabel = m.role === 'user' ? 'Usuário' : 'Assistente';
    const raw = m.role === 'user' ? chatUserPlainText(m.content) : chatAssistantPlainText(m.content);
    const text = raw.trim();
    if (!text) continue;
    const capped =
      m.role === 'user'
        ? text.length > maxUserChunk
          ? `${text.slice(0, maxUserChunk)}…`
          : text
        : text.length > maxAsstChunk
          ? `${text.slice(0, maxAsstChunk)}…`
          : text;
    const line = `[${roleLabel}]\n${capped}\n\n`;
    if (total + line.length > maxTotal) break;
    parts.push(line);
    total += line.length;
  }
  return parts.join('').trim();
};

const LlmIntegrationCombobox = ({ integrations, selectedId, onSelect, logosByProvider }) => {
      const [open, setOpen] = useState(false);
      const [logoError, setLogoError] = useState(false);
      const selectedIntegration = (integrations || []).find((i) => i.id === selectedId);
      const label = selectedIntegration ? selectedIntegration.name : 'ONE';
      const logoUrl = getLogoUrlForIntegration(logosByProvider, selectedIntegration);
      const showLogo = logoUrl && !logoError;
      useEffect(() => { setLogoError(false); }, [selectedId, logoUrl]);

      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="gap-2 rounded-full bg-gradient-to-r from-primary/45 to-primary/30 border border-primary/60 hover:from-primary/55 hover:to-primary/40 hover:border-primary/70 text-foreground font-medium shadow-md shadow-primary/15 hover:shadow-lg hover:shadow-primary/25 transition-all duration-200"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/45 ring-1 ring-primary/50 overflow-hidden shrink-0 shadow-inner">
                {showLogo ? (
                  <img src={logoUrl} alt="" className="h-full w-full object-contain" onError={() => setLogoError(true)} />
                ) : (
                  <Brain className="h-4 w-4 text-primary" />
                )}
              </span>
              {label}
              <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-70" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="center">
            <Command>
              <CommandInput placeholder="Procurar conexão..." />
              <CommandList>
                <CommandEmpty>Nenhuma conexão encontrada.</CommandEmpty>
                <CommandGroup>
                  {(integrations || []).map((integration) => {
                    const itemLogo = getLogoUrlForIntegration(logosByProvider, integration);
                    return (
                      <CommandItem
                        key={integration.id}
                        value={integration.name}
                        onSelect={() => {
                          onSelect(integration.id);
                          setOpen(false);
                        }}
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 overflow-hidden shrink-0 mr-2">
                          {itemLogo ? (
                            <img src={itemLogo} alt="" className="h-full w-full object-contain" />
                          ) : (
                            <Brain className="h-3.5 w-3.5 text-primary" />
                          )}
                        </span>
                        {integration.name}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      );
    };

    const AiChat = ({ auth }) => {
      const { user, profile } = auth;
      const [sessions, setSessions] = useState([]);
      const [activeSessionId, setActiveSessionId] = useState(null);
      const [messages, setMessages] = useState([]);
      const [input, setInput] = useState('');
      const [isLoading, setIsLoading] = useState(false);
      const [isStreaming, setIsStreaming] = useState(false);
      /** 'pdf' | 'image' | null — mostra painel de etapas enquanto o servidor processa anexos */
      const [attachmentProcessingKind, setAttachmentProcessingKind] = useState(null);
      const [isSessionsLoading, setIsSessionsLoading] = useState(true);
      const [llmIntegrations, setLlmIntegrations] = useState([]);
      const [selectedLlmId, setSelectedLlmId] = useState(null);
      const [isSidebarOpen, setIsSidebarOpen] = useState(true);
      const [sessionToDelete, setSessionToDelete] = useState(null);
      const [selectedExpert, setSelectedExpert] = useState(null);
      const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
      const [activeContextIds, setActiveContextIds] = useState([]);
      const [activeContexts, setActiveContexts] = useState([]);
      const [activeClientProfileIds, setActiveClientProfileIds] = useState([]);
      const [activeClientProfiles, setActiveClientProfiles] = useState([]);
      const [isPromptPanelOpen, setIsPromptPanelOpen] = useState(false);
      const [activePrompt, setActivePrompt] = useState(null);
      const [activeFolderId, setActiveFolderId] = useState('all');
      const [activeToolMode, setActiveToolMode] = useState(null); // 'deep_research' | 'neurodesign_image' | null
      const [featureToolsOpen, setFeatureToolsOpen] = useState(false);
      const [logosByProvider, setLogosByProvider] = useState({});
      const [aiFollowUpSuggestions, setAiFollowUpSuggestions] = useState([]);
      const [followUpsLoading, setFollowUpsLoading] = useState(false);
      const suggestionTokenRef = useRef(0);

      const { toast } = useToast();
      const navigate = useNavigate();
      const messagesEndRef = useRef(null);
      const abortControllerRef = useRef(null);
      const isDesktop = useMediaQuery("(min-width: 768px)");
      const inputRef = useRef(null);
      const chatFileInputRef = useRef(null);
      const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
      const [pendingAttachments, setPendingAttachments] = useState([]);

      const CHAT_INPUT_MAX_HEIGHT_PX = 200; // ~7 linhas
      useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        if (!input.trim()) return;
        el.style.height = `${Math.min(el.scrollHeight, CHAT_INPUT_MAX_HEIGHT_PX)}px`;
      }, [input]);

      // Carregar detalhes (nome) dos contextos ativos para exibir no input
      useEffect(() => {
        const loadActiveContexts = async () => {
          if (!activeContextIds || activeContextIds.length === 0) {
            setActiveContexts([]);
            return;
          }

          try {
            const { data, error } = await supabase
              .from('client_contexts')
              .select('id, name')
              .in('id', activeContextIds);

            if (!error && Array.isArray(data)) {
              setActiveContexts(data);
            } else {
              setActiveContexts([]);
            }
          } catch (err) {
            console.error('Erro ao carregar contextos ativos para exibição', err);
            setActiveContexts([]);
          }
        };

        loadActiveContexts();
      }, [activeContextIds]);

      useEffect(() => {
        const loadClientLabels = async () => {
          if (!activeClientProfileIds || activeClientProfileIds.length === 0) {
            setActiveClientProfiles([]);
            return;
          }
          try {
            const { data, error } = await supabase
              .from('clients')
              .select('id, name')
              .in('id', activeClientProfileIds);
            if (!error && Array.isArray(data)) {
              setActiveClientProfiles(data);
            } else {
              setActiveClientProfiles([]);
            }
          } catch (err) {
            console.error('Erro ao carregar nomes das fichas ativas', err);
            setActiveClientProfiles([]);
          }
        };
        loadClientLabels();
      }, [activeClientProfileIds]);

      const fetchLogos = useCallback(async () => {
        try {
          const { data, error } = await supabase.from('llm_logos').select('provider, logo_url');
          if (!error && data && data.length > 0) {
            const map = {};
            data.forEach((row) => { map[row.provider] = row.logo_url; });
            setLogosByProvider(map);
            return;
          }
        } catch (_) {}
        // Fallback: tabela inexistente ou 404 — buscar logos no bucket storage
        try {
          if (!supabaseUrl) return;
          const { data: listData, error: listError } = await supabase.storage.from('llm_logos').list('', { limit: 50 });
          if (listError || !listData?.length) return;
          const map = {};
          listData.forEach((file) => {
            if (file.name && file.name !== '.emptyFolderPlaceholder') {
              const provider = file.name.replace(/\.[^.]+$/, '');
              if (!map[provider]) map[provider] = `${supabaseUrl}/storage/v1/object/public/llm_logos/${encodeURIComponent(file.name)}`;
            }
          });
          if (Object.keys(map).length > 0) setLogosByProvider(map);
        } catch (_) {}
      }, []);

      const fetchIntegrations = useCallback(async () => {
        if (!user) return;
        try {
          // 1) Conexões pessoais ativas com text_generation
          let personal = [];
          const { data: userData, error: userError } = await supabase
            .from('user_ai_connections')
            .select('id, name, provider, default_model, capabilities, is_active')
            .eq('user_id', user.id)
            .eq('is_active', true);

          if (!userError && userData) {
            personal = userData
              .filter(c => c.capabilities?.text_generation === true)
              .map(c => ({ ...c, is_user_connection: true, source: 'personal' }));
          }

          // 2) Integrações globais apenas se não houver pessoais
          let global = [];
          if (personal.length === 0) {
            const { data: globalData, error: globalError } = await supabase
              .from('llm_integrations')
              .select('id, name, provider, default_model, is_active');
            if (!globalError && globalData) {
              global = globalData
                .filter(i => i.is_active !== false)
                .map(i => ({ ...i, is_user_connection: false, source: 'global' }));
            }
          }

          const all = [...personal, ...global];
          setLlmIntegrations(all);
          if (all.length > 0 && !selectedLlmId) {
            setSelectedLlmId(all[0].id);
          }
        } catch (e) {
          // falha silenciosa com toast leve
          // useToast já está instanciado
          toast({ title: 'Erro ao carregar IAs', description: 'Não foi possível carregar as conexões de IA.', variant: 'destructive' });
        }
      }, [user, selectedLlmId, toast]);

      const fetchSessions = useCallback(async () => {
        setIsSessionsLoading(true);
        if (!user) return;
        
        // Buscar todas as sessões do usuário
        const { data, error } = await supabase
          .from('ai_chat_sessions')
          .select('id, title, llm_integration_id, user_ai_connection_id, updated_at, messages, folder_id, expert_id')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (error) {
          toast({ title: "Erro ao buscar conversas", description: error.message, variant: "destructive" });
          setSessions([]);
        } else {
          // Filtrar sessões que NÃO são do Chat IA
          // Identificar padrões de outras páginas que não devem aparecer aqui
          const chatIaSessions = (data || []).filter(session => {
            if (!session.messages || session.messages.length === 0) {
              // Sessões sem mensagens podem ser do Chat IA (novas)
              return true;
            }

            const title = session.title?.toLowerCase() || '';
            const messagesText = JSON.stringify(session.messages || []).toLowerCase();
            
            // Padrões que indicam que NÃO é do Chat IA:
            const isNotChatIa = 
              // Gerador de Conteúdo - padrão [CONTEXTO] com módulo/cliente/campanha
              messagesText.includes('[contexto]') ||
              messagesText.includes('módulo:') ||
              messagesText.includes('cliente:') && messagesText.includes('campanha:') ||
              title.includes('[contexto]') ||
              // Client Onboarding - padrões de análise de cadastro
              messagesText.includes('analise este cadastro') ||
              messagesText.includes('analisar cadastro') ||
              messagesText.includes('estrategista de marketing') && messagesText.includes('cadastros') ||
              title.includes('analise este cadastro') ||
              title.includes('analisar cadastro') ||
              // Site Builder - mensagem inicial típica
              messagesText.includes('construir sua página') ||
              messagesText.includes('como posso te ajudar a construir') ||
              // Geração de conteúdo para módulos (padrão system message com base_prompt)
              session.messages.some(msg => 
                msg.role === 'system' && 
                (msg.content?.includes('módulo') || msg.content?.includes('gerar conteúdo'))
              ) ||
              // Títulos muito longos ou específicos de geração
              (title.length > 100 && (
                title.includes('gerar') || 
                title.includes('conteúdo') || 
                title.includes('módulo')
              ));
            
            // Se não tiver nenhum desses padrões, assumir que é do Chat IA
            return !isNotChatIa;
          });

          setSessions(chatIaSessions);
        }
        setIsSessionsLoading(false);
      }, [user, toast]);

      useEffect(() => {
        fetchIntegrations();
        fetchSessions();
        fetchLogos();
      }, [fetchIntegrations, fetchSessions, fetchLogos]);

      const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      };

      useEffect(scrollToBottom, [messages, isLoading, isStreaming]);
      
      useEffect(() => {
        setIsSidebarOpen(isDesktop);
      }, [isDesktop]);

      const handleSelectSession = async (sessionId) => {
        setActiveSessionId(sessionId);
        setSelectedExpert(null);
        setActiveToolMode(null);
        setPendingAttachments([]);
        setIsLoading(true);
        setMessages([]);
        const { data, error } = await supabase
          .from('ai_chat_sessions')
          .select('messages, llm_integration_id, user_ai_connection_id')
          .eq('id', sessionId)
          .single();

        if (error) {
          toast({ title: 'Erro ao carregar conversa', description: error.message, variant: 'destructive' });
          setMessages([]);
        } else {
          setMessages(data.messages || []);
          setAiFollowUpSuggestions([]);
          setFollowUpsLoading(false);
          // sempre restaurar a IA usada na sessão, independente do tipo de acesso
          const restored = data.llm_integration_id || data.user_ai_connection_id;
          if (restored) setSelectedLlmId(restored);
        }
        setIsLoading(false);
        if (!isDesktop) setIsSidebarOpen(false);
      };

      const handleNewConversation = () => {
        setActiveSessionId(null);
        setMessages([]);
        setAiFollowUpSuggestions([]);
        setFollowUpsLoading(false);
        setSelectedExpert(null);
        setActiveToolMode(null);
        setPendingAttachments([]);
        if (!isDesktop) setIsSidebarOpen(false);
      };

      const handleDeleteRequest = (sessionId) => {
        setSessionToDelete(sessionId);
      };

      const handleConfirmDelete = async () => {
        if (!sessionToDelete) return;

        const { error } = await supabase
            .from('ai_chat_sessions')
            .delete()
            .eq('id', sessionToDelete);

        if (error) {
            toast({ title: 'Erro ao excluir conversa', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Conversa excluída com sucesso!' });
            setSessions(prev => prev.filter(s => s.id !== sessionToDelete));
            if (activeSessionId === sessionToDelete) {
                handleNewConversation();
            }
        }
        setSessionToDelete(null);
      };

      const handleSelectExpert = (expert) => {
        if (!expert) {
          setSelectedExpert(null);
          return;
        }
        setSelectedExpert(expert);
        const targetId = expert.default_user_ai_connection_id || expert.default_llm_integration_id;
        if (targetId) {
          setSelectedLlmId(targetId);
        }
        handleNewConversation();
        if (!isDesktop) setIsSidebarOpen(false);
      };

      const handleSendMessage = async (e, overrideText) => {
        e?.preventDefault?.();
        const textToSend = (overrideText !== undefined && overrideText !== null ? String(overrideText) : input).trim();
        const filesSnapshot = pendingAttachments.map((a) => a.file);
        if ((!textToSend && filesSnapshot.length === 0) || isLoading || isStreaming) return;

        if (!selectedLlmId) {
            toast({ title: "Nenhuma conexão de IA ativa", description: "Verifique se você tem uma conexão de IA ativa nas configurações ou selecione uma.", variant: "destructive" });
            return;
        }

        const cameFromChip = overrideText !== undefined && overrideText !== null;
        const originalInput = cameFromChip ? String(overrideText) : input;
        const originalPending = cameFromChip ? [] : [...pendingAttachments];

        const { content: userApiContent, errors: attachErrors } = await buildUserContentForApi(textToSend, cameFromChip ? [] : filesSnapshot);
        if (attachErrors?.length && !userApiContent) {
          toast({
            title: 'Não foi possível usar os anexos',
            description: attachErrors.join(' '),
            variant: 'destructive',
          });
          return;
        }
        if (attachErrors?.length && userApiContent) {
          toast({
            title: 'Parte dos anexos foi ignorada',
            description: attachErrors.join(' '),
          });
        }
        const isEmptyUserPayload =
          userApiContent == null ||
          userApiContent === '' ||
          (typeof userApiContent === 'object' &&
            userApiContent.v === 2 &&
            (!Array.isArray(userApiContent.apiParts) || userApiContent.apiParts.length === 0));
        if (isEmptyUserPayload) {
          toast({ title: 'Mensagem vazia', description: 'Escreva algo ou anexe arquivos.', variant: 'destructive' });
          return;
        }

        suggestionTokenRef.current += 1;
        const turnToken = suggestionTokenRef.current;
        setAiFollowUpSuggestions([]);
        setFollowUpsLoading(false);

        const userMessage = { role: 'user', content: userApiContent };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        if (!cameFromChip) {
          setPendingAttachments([]);
        }
        setInput('');
        setIsStreaming(false);

        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        const currentIntegration = llmIntegrations.find(i => i.id === selectedLlmId);
        if (!currentIntegration) {
            toast({ title: "Erro", description: "A conexão de IA selecionada não foi encontrada.", variant: "destructive" });
            setMessages(prev => prev.slice(0, -1));
            setInput(originalInput);
            if (!cameFromChip) setPendingAttachments(originalPending);
            return;
        }

        const apiPartsForProgress = userApiContent?.apiParts || [];
        const hasPdfAttach = apiPartsForProgress.some((p) => p?.type === 'input_file');
        const hasImgAttach = apiPartsForProgress.some((p) => p?.type === 'image_url');
        setAttachmentProcessingKind(hasPdfAttach ? 'pdf' : hasImgAttach ? 'image' : null);
        setIsLoading(true);

        // Montar mensagem de system: fichas de cadastro + contextos textuais (client_contexts)
        let contextSystemMessage = null;
        const contextSections = [];

        if (activeClientProfileIds && activeClientProfileIds.length > 0) {
          try {
            const profiles = await fetchClientProfilesForChat(activeClientProfileIds);
            for (const c of profiles) {
              const block = formatClientProfileForPrompt(c);
              if (block) contextSections.push(block);
            }
          } catch (profErr) {
            console.error('Erro ao carregar fichas de cliente para o chat IA', profErr);
          }
        }

        if (activeContextIds && activeContextIds.length > 0) {
          try {
            const { data: ctxData, error: ctxError } = await supabase
              .from('client_contexts')
              .select('id, name, content')
              .in('id', activeContextIds);

            if (!ctxError && Array.isArray(ctxData) && ctxData.length > 0) {
              ctxData.forEach((ctx, index) => {
                const title = ctx.name || `Contexto ${index + 1}`;
                contextSections.push(`${index + 1}) ${title}:\n${ctx.content || ''}`);
              });
            }
          } catch (ctxErr) {
            console.error('Erro ao carregar contextos ativos para o chat IA', ctxErr);
          }
        }

        if (contextSections.length > 0) {
          contextSystemMessage = {
            role: 'system',
            content:
              'Use as informações abaixo como contexto ao responder. Incluem fichas de cadastro de clientes e/ou contextos textuais (objetivos, público, tom, produtos):\n\n' +
              contextSections.join('\n\n---\n\n'),
          };
        }

        try {
          const expertPrompt = selectedExpert?.system_prompt?.trim();
          const promptSystemMessage = activePrompt?.content
            ? { role: 'system', content: activePrompt.content }
            : null;
          const mapMessageForApi = (m) => {
            if (m.role === 'user') {
              return { role: 'user', content: userContentToApiPayload(m.content) };
            }
            if (m.role === 'assistant' && m.content && typeof m.content === 'object' && m.content.text != null) {
              return { role: 'assistant', content: String(m.content.text) };
            }
            const c = m.content;
            return { role: m.role, content: typeof c === 'string' ? c : String(c ?? '') };
          };
          const baseMessages = newMessages.map(mapMessageForApi);

          const systemMessages = [];
          if (expertPrompt) {
            systemMessages.push({ role: 'system', content: expertPrompt });
          }
          if (activeToolMode === 'deep_research') {
            systemMessages.push({ role: 'system', content: DEEP_RESEARCH_SYSTEM_PROMPT });
          }
          if (activeToolMode === 'neurodesign_image') {
            systemMessages.push({ role: 'system', content: NEURODESIGN_IMAGE_SYSTEM_PROMPT });
          }
          if (promptSystemMessage) {
            systemMessages.push(promptSystemMessage);
          }
          if (contextSystemMessage) {
            systemMessages.push(contextSystemMessage);
          }

          const apiMessages =
            systemMessages.length > 0 ? [...systemMessages, ...baseMessages] : baseMessages;

          const genericChatBody = {
            session_id: activeSessionId,
            messages: apiMessages,
            llm_integration_id: selectedLlmId,
            is_user_connection: currentIntegration.is_user_connection,
            context: selectedExpert ? 'chat_ia_expert' : 'chat_ia',
          };

          let finalMessages;
          let assistantContent;
          const canUseSse = !hasPdfAttach && Boolean(supabaseUrl && supabaseAnonKey);
          let sseWorked = false;

          const assistantSseShell = {
            role: 'assistant',
            content: { text: '', reasoning: '', sseStreaming: true },
            source_llm_id: selectedLlmId,
            source_is_user_connection: !!currentIntegration.is_user_connection,
          };

          const removeSsePlaceholder = () => {
            setMessages((p) => (p[p.length - 1]?.content?.sseStreaming ? p.slice(0, -1) : p));
          };

          if (canUseSse) {
            // Mostrar já o painel “Pensamento” (vazio) em vez de “Pensando…” até chegar o stream
            setIsLoading(false);
            setIsStreaming(true);
            setMessages([...newMessages, assistantSseShell]);

            try {
              const { data: sessWrap } = await supabase.auth.getSession();
              const token = sessWrap?.session?.access_token ?? '';
              const streamRes = await fetch(`${supabaseUrl}/functions/v1/generic-ai-chat`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                  apikey: supabaseAnonKey,
                },
                body: JSON.stringify({ ...genericChatBody, stream: true }),
                signal,
              });

              if (!streamRes.ok) {
                removeSsePlaceholder();
                setIsStreaming(false);
                setIsLoading(true);
              } else {
                const ct = (streamRes.headers.get('content-type') || '').toLowerCase();
                if (ct.includes('text/event-stream') || ct.includes('event-stream')) {
                  let rafId = 0;
                  const scheduleSseUi = (reasoning, text) => {
                    if (rafId) cancelAnimationFrame(rafId);
                    rafId = requestAnimationFrame(() => {
                      rafId = 0;
                      setMessages((prev) => {
                        const copy = [...prev];
                        const last = copy[copy.length - 1];
                        if (last?.role === 'assistant' && last.content?.sseStreaming) {
                          copy[copy.length - 1] = {
                            ...last,
                            content: { text, reasoning, sseStreaming: true },
                          };
                        }
                        return copy;
                      });
                    });
                  };

                  try {
                    const { reasoning: reasoningAcc, text: textAcc } = await consumeOpenAICompatibleSse(
                      streamRes,
                      signal,
                      ({ reasoning, text }) => scheduleSseUi(reasoning, text),
                    );

                    assistantContent = reasoningAcc.trim()
                      ? { text: textAcc, reasoning: reasoningAcc.trim() }
                      : textAcc;
                    finalMessages = [
                      ...newMessages,
                      {
                        role: 'assistant',
                        content: assistantContent,
                        source_llm_id: selectedLlmId,
                        source_is_user_connection: !!currentIntegration.is_user_connection,
                      },
                    ];
                    setMessages(finalMessages);
                    setIsStreaming(false);
                    sseWorked = true;
                  } catch (streamConsumeErr) {
                    removeSsePlaceholder();
                    setIsStreaming(false);
                    if (streamConsumeErr?.name === 'AbortError') {
                      toast({
                        title: 'Geração cancelada',
                        description: 'Você interrompeu a resposta da IA.',
                      });
                      setIsLoading(false);
                      return;
                    }
                    setIsLoading(true);
                  }
                } else {
                  const j = await streamRes.json();
                  assistantContent = j.reasoning
                    ? { text: j.response, reasoning: j.reasoning }
                    : j.response;
                  finalMessages = [
                    ...newMessages,
                    {
                      role: 'assistant',
                      content: assistantContent,
                      source_llm_id: selectedLlmId,
                      source_is_user_connection: !!currentIntegration.is_user_connection,
                    },
                  ];
                  setMessages(finalMessages);
                  setIsStreaming(true);
                  sseWorked = true;
                }
              }
            } catch (sseErr) {
              removeSsePlaceholder();
              setIsStreaming(false);
              if (sseErr?.name === 'AbortError') {
                toast({ title: 'Geração cancelada', description: 'Você interrompeu a resposta da IA.' });
                setIsLoading(false);
                return;
              }
              setIsLoading(true);
            }
          }

          if (!sseWorked) {
            const { data, error: invokeError } = await supabase.functions.invoke('generic-ai-chat', {
              body: JSON.stringify(genericChatBody),
              signal,
            });

            if (invokeError) {
              if (invokeError.name === 'AbortError') {
                toast({ title: 'Geração cancelada', description: 'Você interrompeu a resposta da IA.' });
                setIsLoading(false);
                return;
              }
              let errorMsg = invokeError.message || 'Ocorreu um erro desconhecido.';
              const context = invokeError.context || {};
              if (context.error) {
                errorMsg = context.error;
              } else {
                try {
                  const errorJson = await new Response(context).json();
                  errorMsg = errorJson.error || errorMsg;
                } catch (e) {
                  /* ignore */
                }
              }
              throw new Error(errorMsg);
            }

            setIsLoading(false);
            setIsStreaming(true);
            assistantContent = data.reasoning
              ? { text: data.response, reasoning: data.reasoning }
              : data.response;
            finalMessages = [
              ...newMessages,
              {
                role: 'assistant',
                content: assistantContent,
                source_llm_id: selectedLlmId,
                source_is_user_connection: !!currentIntegration.is_user_connection,
              },
            ];
            setMessages(finalMessages);
          }

          // Persistir na lista de Chats: criar nova sessão ou atualizar a existente
          const rawTitle = chatUserPlainTextForTitle(newMessages.find((m) => m.role === 'user')?.content);
          const title = rawTitle ? rawTitle.slice(0, 80) : 'Nova conversa';

          const messagesForDb = sanitizeMessagesForDb(finalMessages);

          let persistedChatId = activeSessionId || null;

          if (activeSessionId) {
            const { error: updateErr } = await supabase
              .from('ai_chat_sessions')
              .update({ messages: messagesForDb, updated_at: new Date().toISOString() })
              .eq('id', activeSessionId);
            if (updateErr) {
              console.error('Erro ao atualizar sessão no Chat', updateErr);
            } else {
              await fetchSessions();
            }
          } else {
            const insertPayload = {
              user_id: user.id,
              title,
              messages: messagesForDb,
              folder_id: (activeFolderId && activeFolderId !== 'all') ? activeFolderId : null,
              expert_id: selectedExpert?.id ?? null,
              updated_at: new Date().toISOString(),
            };
            if (currentIntegration.is_user_connection) {
              insertPayload.user_ai_connection_id = selectedLlmId;
            } else {
              insertPayload.llm_integration_id = selectedLlmId;
            }
            const { data: inserted, error: insertErr } = await supabase
              .from('ai_chat_sessions')
              .insert(insertPayload)
              .select('id')
              .single();
            if (insertErr) {
              console.error('Erro ao salvar nova conversa', insertErr);
              toast({ title: 'Conversa não foi adicionada à lista', description: insertErr.message, variant: 'destructive' });
            } else if (inserted?.id) {
              setActiveSessionId(inserted.id);
              persistedChatId = inserted.id;
              await fetchSessions();
            }
          }

          const userMsgCount = finalMessages.filter((m) => m.role === 'user').length;
          const asstMsgCount = finalMessages.filter((m) => m.role === 'assistant').length;
          if (persistedChatId && userMsgCount === 1 && asstMsgCount === 1) {
            void (async () => {
              try {
                const firstUser = chatUserPlainText(finalMessages.find((m) => m.role === 'user')?.content).trim();
                const firstAsst = chatAssistantPlainText(finalMessages.find((m) => m.role === 'assistant')?.content).trim();
                if (!firstAsst) return;
                const { data: titleData, error: titleErr } = await supabase.functions.invoke('generate-chat-title', {
                  body: JSON.stringify({
                    first_user_message: firstUser,
                    first_assistant_message: firstAsst,
                    llm_integration_id: selectedLlmId,
                    is_user_connection: !!currentIntegration.is_user_connection,
                  }),
                });
                if (titleErr || !titleData?.title) return;
                const newTitle = String(titleData.title).trim().slice(0, 120);
                if (!newTitle) return;
                await supabase.from('ai_chat_sessions').update({ title: newTitle }).eq('id', persistedChatId);
                await fetchSessions();
              } catch (e) {
                console.warn('generate-chat-title', e);
              }
            })();
          }

          const assistantPlain = chatAssistantPlainText(assistantContent);
          if (assistantPlain.length >= 24 && suggestionTokenRef.current === turnToken) {
            setFollowUpsLoading(true);
            void (async () => {
              try {
                const conversationThread = buildFollowUpConversationThread(finalMessages);
                const { data: sugData, error: sugErr } = await supabase.functions.invoke('generate-chat-follow-ups', {
                  body: JSON.stringify({
                    last_user_message: chatUserPlainText(userMessage.content).trim() || textToSend,
                    last_assistant_message: assistantPlain,
                    conversation_thread: conversationThread,
                    llm_integration_id: selectedLlmId,
                    is_user_connection: currentIntegration.is_user_connection,
                  }),
                });
                if (suggestionTokenRef.current !== turnToken) return;
                if (sugErr) throw sugErr;
                const raw = sugData?.suggestions;
                const normalized = Array.isArray(raw)
                  ? raw
                      .map((x) => {
                        if (typeof x === 'string' && x.trim()) {
                          const p = x.trim();
                          return { label: p.length > 72 ? `${p.slice(0, 69)}…` : p, prompt: p };
                        }
                        if (x && typeof x === 'object' && typeof x.prompt === 'string' && x.prompt.trim()) {
                          const prompt = x.prompt.trim();
                          let label = typeof x.label === 'string' && x.label.trim() ? x.label.trim() : prompt;
                          if (label.length > 100) label = `${label.slice(0, 97)}…`;
                          return { label, prompt };
                        }
                        return null;
                      })
                      .filter(Boolean)
                      .slice(0, 4)
                  : [];
                setAiFollowUpSuggestions(normalized);
              } catch {
                if (suggestionTokenRef.current === turnToken) setAiFollowUpSuggestions([]);
              } finally {
                if (suggestionTokenRef.current === turnToken) setFollowUpsLoading(false);
              }
            })();
          }
          
        } catch (err) {
          if (err.name === 'AbortError') {
            toast({ title: 'Geração cancelada', description: 'Você interrompeu a resposta da IA.' });
          } else {
            setMessages(prev => prev.slice(0, -1));
            setInput(originalInput);
            if (!cameFromChip) setPendingAttachments(originalPending);
            toast({
              title: 'Aviso',
              description: getFriendlyErrorMessage(err),
              variant: 'destructive',
            });
          }
          setIsLoading(false);
          setIsStreaming(false);
        } finally {
          setAttachmentProcessingKind(null);
          abortControllerRef.current = null;
        }
      };

      const handleStopGeneration = () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };

      const handleQuickPrompt = (text) => {
        setInput(text);
        if (inputRef.current) {
          inputRef.current.focus();
        }
      };

      const openDeviceFilePicker = () => {
        setToolsMenuOpen(false);
        setTimeout(() => chatFileInputRef.current?.click(), 0);
      };

      const handleChatFilesSelected = (e) => {
        const inputEl = e.target;
        // Copiar antes de limpar: FileList é referência viva — value = '' esvazia a lista.
        const filesArray = inputEl?.files?.length ? Array.from(inputEl.files) : [];
        if (inputEl) inputEl.value = '';
        if (!filesArray.length) return;
        const next = [];
        const rejected = [];
        for (const file of filesArray) {
          if (classifyChatAttachment(file) === 'unsupported') {
            rejected.push(file.name);
            continue;
          }
          next.push(makePendingAttachment(file));
        }
        if (rejected.length) {
          toast({
            title: 'Alguns arquivos foram ignorados',
            description: `${rejected.join(', ')} — formato não suportado.`,
            variant: 'destructive',
          });
        }
        if (!next.length) return;
        setTimeout(() => inputRef.current?.focus(), 0);
        setPendingAttachments((prev) => {
          const room = CHAT_ATTACH_MAX_FILES - prev.length;
          if (room <= 0) {
            toast({
              title: 'Limite de anexos',
              description: `No máximo ${CHAT_ATTACH_MAX_FILES} arquivos por mensagem. Remova alguns ou envie em partes.`,
              variant: 'destructive',
            });
            return prev;
          }
          const toAdd = next.slice(0, room);
          if (next.length > room) {
            toast({
              title: 'Limite de anexos',
              description: `Apenas ${room} arquivo(s) foram adicionados (máx. ${CHAT_ATTACH_MAX_FILES} por mensagem).`,
            });
          }
          return [...prev, ...toAdd];
        });
      };

      const removePendingAttachment = (id) => {
        setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
      };

      const handleApplyNeuroDesign = useCallback(
        async (prompt) => {
          const text = String(prompt || '').trim();
          if (!text) return;
          try {
            await navigator.clipboard.writeText(text);
          } catch {
            /* clipboard pode falhar; o NeuroDesign ainda recebe o texto via rota/sessionStorage */
          }
          try {
            sessionStorage.setItem(NEURODESIGN_CHAT_FILL_STORAGE_KEY, text);
          } catch {
            /* ignore */
          }
          navigate('/ferramentas/neurodesign/criar', { state: { neuroChatFillPrompt: text } });
        },
        [navigate]
      );

      const handleRemoveActivePrompt = () => {
        setActivePrompt(null);
      };

      const handleRemoveActiveTool = () => {
        setActiveToolMode(null);
      };

      const handleRemoveActiveContext = (contextId) => {
        setActiveContextIds((prev) => prev.filter((id) => id !== contextId));
      };

      const handleRemoveActiveClientProfile = (clientId) => {
        setActiveClientProfileIds((prev) => prev.filter((id) => id !== clientId));
      };

      const renderActiveContextChips = () => {
        const hasContexts = activeContexts && activeContexts.length > 0;
        const hasProfiles = activeClientProfiles && activeClientProfiles.length > 0;
        if (!hasContexts && !hasProfiles) return null;

        return (
          <div className="flex flex-wrap gap-2">
            {hasProfiles &&
              activeClientProfiles.map((c) => (
                <div
                  key={`ficha-${c.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-500/45 bg-amber-500/10 px-3 py-1"
                >
                  <Briefcase className="h-3.5 w-3.5 shrink-0 text-amber-900/80 dark:text-amber-100/90" />
                  <span className="text-xs font-semibold text-amber-950/90 dark:text-amber-50/95">
                    Ficha: {c.name || 'Cliente'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveActiveClientProfile(c.id)}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-amber-950/90 hover:bg-amber-500/20 dark:text-amber-50/95"
                    aria-label="Remover ficha do cliente do contexto"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            {hasContexts &&
              activeContexts.map((ctx) => (
                <div
                  key={ctx.id}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1"
                >
                  <span className="text-xs font-semibold text-primary-foreground/90">
                    {ctx.name || 'Contexto ativo'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveActiveContext(ctx.id)}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-primary-foreground/90 hover:bg-primary/20"
                    aria-label="Remover contexto"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
          </div>
        );
      };

      const renderActivePromptChip = () => {
        if (!activePrompt) return null;

        return (
          <div className="flex flex-wrap gap-2 mb-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary/20 border border-secondary/50 px-3 py-1">
              <FileText className="h-3.5 w-3.5 text-secondary-foreground/90" />
              <span className="text-xs font-semibold text-secondary-foreground/90">
                {activePrompt.name || 'Prompt ativo'}
              </span>
              <button
                type="button"
                onClick={handleRemoveActivePrompt}
                className="inline-flex items-center justify-center h-5 w-5 rounded-full hover:bg-secondary/30 text-secondary-foreground/90"
                aria-label="Remover prompt"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        );
      };

      const renderActiveToolChip = () => {
        if (activeToolMode === 'deep_research') {
          return (
            <div className="flex flex-wrap gap-2 mb-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/40 px-3 py-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">Modo: Deep Research</span>
                <button
                  type="button"
                  onClick={handleRemoveActiveTool}
                  className="inline-flex items-center justify-center h-5 w-5 rounded-full hover:bg-primary/20 text-primary"
                  aria-label="Desativar modo Deep Research"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        }
        if (activeToolMode === 'neurodesign_image') {
          return (
            <div className="flex flex-wrap gap-2 mb-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/40 px-3 py-1">
                <ImageIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs font-semibold text-primary">Modo: Prompt para NeuroDesign</span>
                <button
                  type="button"
                  onClick={handleRemoveActiveTool}
                  className="inline-flex items-center justify-center h-5 w-5 rounded-full hover:bg-primary/20 text-primary"
                  aria-label="Desativar modo NeuroDesign"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        }
        return null;
      };

      /** Faixa de anexos dentro do cartão do input (mesmo “look” dos chips de contexto). */
      const renderPendingAttachmentsInComposer = () => {
        if (!pendingAttachments.length) return null;
        return (
          <div className="mb-2 pb-2 border-b border-border/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 px-0.5">
              Anexos
            </p>
            <div className="flex flex-wrap gap-2">
              {pendingAttachments.map(({ id, file }) => {
                const isImg = (file.type || '').startsWith('image/');
                const Icon = isImg ? ImageIcon : FileText;
                return (
                  <div
                    key={id}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate text-xs font-semibold text-primary-foreground/90">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(id)}
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-primary-foreground/90 hover:bg-primary/20"
                      aria-label={`Remover ${file.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      };

      const renderToolsMenu = () => (
        <Popover open={toolsMenuOpen} onOpenChange={setToolsMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start" side="top">
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={openDeviceFilePicker}
              >
                <Paperclip className="h-4 w-4" />
                <span>Adicionar arquivos do dispositivo</span>
              </Button>
              <div className="my-1 h-px bg-border" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setIsPromptPanelOpen(true)}
              >
                <ListChecks className="h-4 w-4" />
                <span>Prompts</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setIsContextPanelOpen(true)}
              >
                <Layers className="h-4 w-4" />
                <span>Contextos</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => toast({ title: 'Skills', description: 'Skills personalizadas serão adicionadas em breve.' })}
              >
                <Blocks className="h-4 w-4" />
                <span>Skills</span>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      );

      const renderFeatureToolsButton = () => {
        const isDeepResearchActive = activeToolMode === 'deep_research';
        const isNeuroDesignActive = activeToolMode === 'neurodesign_image';

        return (
        <Popover open={featureToolsOpen} onOpenChange={setFeatureToolsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 h-9 text-muted-foreground shrink-0"
            >
              <Briefcase className="h-4 w-4" />
              Ferramentas
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-4" align="start" side="top">
            <div className="space-y-4 text-left">
              <button
                type="button"
                className={`w-full text-left space-y-1 rounded-md px-2 py-2 transition-colors ${
                  isDeepResearchActive ? 'bg-primary/10 border border-primary/40' : 'hover:bg-muted/60'
                }`}
                onClick={() => {
                  setActiveToolMode((prev) => {
                    const next = prev === 'deep_research' ? null : 'deep_research';
                    if (next) {
                      toast({
                        title: 'Modo Deep Research ativado',
                        description: 'As próximas respostas serão mais analíticas e profundas.',
                      });
                    } else {
                      toast({
                        title: 'Modo Deep Research desativado',
                        description: 'O chat voltou ao comportamento padrão.',
                      });
                    }
                    return next;
                  });
                  setFeatureToolsOpen(false);
                }}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Deep Research</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Dica: use para pesquisas mais profundas, análises e comparações detalhadas.
                </p>
                <p className="text-xs text-muted-foreground">
                  Exemplo: analise concorrentes e traga um resumo com oportunidades de posicionamento.
                </p>
              </button>

              <div className="h-px bg-border/60" />

              <button
                type="button"
                className={`w-full text-left space-y-1 rounded-md px-2 py-2 transition-colors ${
                  isNeuroDesignActive ? 'bg-primary/10 border border-primary/40' : 'hover:bg-muted/60'
                }`}
                onClick={() => {
                  setActiveToolMode((prev) => {
                    const next = prev === 'neurodesign_image' ? null : 'neurodesign_image';
                    if (next) {
                      toast({
                        title: 'Modo NeuroDesign ativado',
                        description:
                          'Descreva a peça. A IA redige um brief de direção de arte premium (posicionamento, não estética genérica) e o botão leva ao NeuroDesign.',
                      });
                    } else {
                      toast({ title: 'Modo NeuroDesign desativado', description: 'O chat voltou ao comportamento padrão.' });
                    }
                    return next;
                  });
                  setFeatureToolsOpen(false);
                }}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                  <span>Prompt para NeuroDesign</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Brief no nível de diretor de arte: posicionamento, hierarquia e intenção visual — evitando clichês de “arte de IA”. O botão copia, abre o NeuroDesign e preenche Preencher com IA.
                </p>
                <p className="text-xs text-muted-foreground">
                  Exemplo: key visual de lançamento premium para público executivo, fotografia editorial, paleta sóbria com um acento cromático, headline forte e CTA discreto.
                </p>
              </button>
            </div>
          </PopoverContent>
        </Popover>
        );
      };

      return (
        <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] flex bg-background dark:bg-[#1A1A1D]">
          <input
            ref={chatFileInputRef}
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/*,.md,.csv,.json,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.sql,.yaml,.yml,.log,.env,.sh,.bash"
            multiple
            onChange={handleChatFilesSelected}
            aria-hidden
          />
          <ResizablePanelGroup
            direction="horizontal"
            className="w-full"
            style={
              isSidebarOpen && isDesktop
                ? { flexDirection: 'row-reverse' }
                : undefined
            }
          >
            <ResizablePanel
              defaultSize={isSidebarOpen && isDesktop ? 75 : 100}
              minSize={isSidebarOpen && isDesktop ? 45 : 100}
            >
                <main className="flex-1 flex flex-col bg-background dark:bg-[#1A1A1D] h-full relative">
                    <div className="p-4 border-b border-border/50 flex items-center justify-between bg-background dark:bg-[#1A1A1D] md:hidden sticky top-0 z-10">
                        <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)}>
                            <Menu className="h-5 w-5" />
                        </Button>
                        <h1 className="text-lg font-semibold">Neuro Ápice</h1>
                        <div className="w-8"></div>
                    </div>

                    <div className="h-14 lg:h-[60px] px-4 border-b border-border/50 bg-background dark:bg-[#1A1A1D] flex items-center justify-between gap-4 shrink-0">
                      <div className="flex-1 flex justify-start">
                        <LlmIntegrationCombobox
                                integrations={llmIntegrations}
                                selectedId={selectedLlmId}
                                onSelect={setSelectedLlmId}
                          logosByProvider={logosByProvider}
                        />
                      </div>
                      <div className="flex items-center gap-1 w-20 justify-end">
                        <ThemeToggle />
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" title="Configurações">
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" title="Compartilhar">
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {(!activeSessionId && messages.length === 0 && !isLoading && !isStreaming) ? (
                      /* Estado inicial: saudação + input no centro (estilo Adapta); depois de enviar o input desce */
                      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 min-h-0">
                        <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6">
                          <div className="text-center space-y-2">
                            <h2 className="text-2xl md:text-3xl font-bold">
                              Olá, {profile?.name || 'criador(a)'}!
                            </h2>
                            <p className="text-sm text-muted-foreground">
                              Estou aqui para pensar, escolher e executar da melhor forma, tudo de forma autônoma.
                            </p>
                          </div>
                          <div className="w-full space-y-3">
                              {renderActivePromptChip()}
                              {renderActiveToolChip()}
                              {renderActiveContextChips()}
                              <div className="rounded-2xl border border-border bg-card dark:bg-[#363738] px-3 py-2 min-h-[56px] focus-within:ring-2 focus-within:ring-primary/20 shadow-lg">
                              {renderPendingAttachmentsInComposer()}
                              <form onSubmit={handleSendMessage} className="flex items-center gap-1">
                                <Textarea
                                  ref={inputRef}
                                  value={input}
                                  onChange={(e) => setInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }
                                  }}
                                  placeholder="O que posso fazer por você?"
                                  className="flex-1 min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 placeholder:text-muted-foreground text-base py-3"
                                  disabled={isLoading || isStreaming}
                                  rows={1}
                                />
                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground/50 cursor-not-allowed" title="Em breve" disabled>
                                  <Sparkles className="h-4 w-4" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground">
                                  <Mic className="h-4 w-4" />
                                </Button>
                                <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={(!input.trim() && pendingAttachments.length === 0) || isLoading || isStreaming}>
                                  <Send className="h-4 w-4" />
                                </Button>
                              </form>
                                <div className="pt-2 flex items-center gap-2 border-t border-border/50">
                                  {renderToolsMenu()}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1.5 h-9 text-muted-foreground shrink-0"
                                    onClick={() => setIsContextPanelOpen(true)}
                                  >
                                    <Layers className="h-4 w-4" />
                                    Contextos
                                  </Button>
                                  {renderFeatureToolsButton()}
                                  <Button type="button" variant="ghost" size="sm" className="gap-1.5 h-9 text-muted-foreground shrink-0">
                                    <Brain className="h-4 w-4" />
                                    Experts
                                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-70" />
                                </Button>
                                </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground text-center mt-2">
                              Os modelos de IA podem cometer erros. Sempre avalie e confira as respostas dos modelos. Imagens
                              exigem modelo com visão; PDFs até 5 MB são processados no servidor (OpenAI ou Gemini com API nativa).
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Digite uma pergunta ou use um dos atalhos abaixo para começar mais rápido.
                          </p>
                          <div className="flex flex-wrap justify-center gap-2">
                            <Button variant="outline" size="sm" className="rounded-full bg-primary/25 border-primary/50 hover:bg-primary/40 text-gray-600 font-medium focus:ring-2 focus:ring-primary/30" onClick={() => handleQuickPrompt('Me ajude a ter ideias de conteúdos para meu Instagram de marketing digital.')}>
                              Ideias de conteúdos
                            </Button>
                            <Button variant="outline" size="sm" className="rounded-full bg-primary/25 border-primary/50 hover:bg-primary/40 text-gray-600 font-medium focus:ring-2 focus:ring-primary/30" onClick={() => handleQuickPrompt('Crie um roteiro de vídeo curto para Reels explicando um conceito importante do meu nicho.')}>
                              Roteiro de vídeo
                            </Button>
                            <Button variant="outline" size="sm" className="rounded-full bg-primary/25 border-primary/50 hover:bg-primary/40 text-gray-600 font-medium focus:ring-2 focus:ring-primary/30" onClick={() => handleQuickPrompt('Analise este anúncio e sugira melhorias para aumentar a taxa de cliques.')}>
                              Analisar anúncio
                            </Button>
                            <Button variant="outline" size="sm" className="rounded-full bg-primary/25 border-primary/50 hover:bg-primary/40 text-gray-600 font-medium focus:ring-2 focus:ring-primary/30" onClick={() => handleQuickPrompt('Monte um plano de campanha de lançamento para um novo produto digital.')}>
                              Plano de campanha
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                    <>
                    <ScrollArea className="flex-1 min-h-0">
                        <div className="px-4 py-3 space-y-3 max-w-5xl mx-auto pb-3 sm:px-5 sm:py-4 sm:space-y-4">
                        {messages.map((msg, index) => {
                            const isLastAssistant = !msg.role || msg.role === 'assistant';
                            const showSuggestions = index === messages.length - 1 && isLastAssistant;
                            const suggestedPrompts = showSuggestions ? aiFollowUpSuggestions : undefined;
                            const suggestedPromptsLoading = showSuggestions && followUpsLoading;
                            const isAssistant = msg.role === 'assistant' || msg.role == null;
                            const connectionId = isAssistant ? (msg.source_llm_id ?? selectedLlmId) : selectedLlmId;
                            const integrationForMsg = llmIntegrations.find((i) => i.id === connectionId);
                            const aiName = integrationForMsg?.name || (llmIntegrations.find((i) => i.id === selectedLlmId)?.name) || 'ONE';
                            const connectionLogoUrl = getLogoUrlForIntegration(logosByProvider, integrationForMsg);
                            return (
                            <AiChatMessage 
                              key={index} 
                              message={msg} 
                              isStreaming={index === messages.length - 1 && isStreaming}
                              onStreamingFinished={() => setIsStreaming(false)}
                                aiName={aiName}
                                connectionLogoUrl={connectionLogoUrl}
                                suggestedPrompts={suggestedPrompts}
                                suggestedPromptsLoading={suggestedPromptsLoading}
                                onSuggestedPromptClick={(prompt) => handleSendMessage(null, prompt)}
                                onApplyNeuroDesign={handleApplyNeuroDesign}
                            />
                            );
                        })}

                        {isLoading && !isStreaming && (
                          attachmentProcessingKind ? (
                            <AiChatAttachmentProgress
                              kind={attachmentProcessingKind}
                              connectionLogoUrl={getLogoUrlForIntegration(
                                logosByProvider,
                                llmIntegrations.find((i) => i.id === selectedLlmId)
                              )}
                              aiName={
                                llmIntegrations.find((i) => i.id === selectedLlmId)?.name || 'ONE'
                              }
                            />
                          ) : (
                            <AiChatMessage.Loading
                              connectionLogoUrl={getLogoUrlForIntegration(
                                logosByProvider,
                                llmIntegrations.find((i) => i.id === selectedLlmId)
                              )}
                            />
                          )
                        )}
                        <div ref={messagesEndRef} />
                        </div>
                    </ScrollArea>

                    <div className="shrink-0 p-4 bg-background/80 dark:bg-[#1A1A1D] backdrop-blur-sm border-t border-border/50">
                        <div className="max-w-5xl mx-auto space-y-2">
                          {renderActivePromptChip()}
                          {renderActiveToolChip()}
                          {renderActiveContextChips()}
                          {isLoading || isStreaming ? (
                            <div className="flex items-center justify-between w-full rounded-2xl border border-input bg-muted/20 px-4 py-3 min-h-[56px]">
                              <div className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Gerando...</span>
                              </div>
                              <Button variant="outline" size="sm" onClick={handleStopGeneration}>
                                <Square className="w-4 h-4 mr-2" />
                                Parar
                              </Button>
                            </div>
                          ) : (
                            <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
                              <div className="rounded-2xl border border-border bg-card dark:bg-[#363738] px-3 py-2 min-h-[56px] focus-within:ring-2 focus-within:ring-primary/20">
                                {renderPendingAttachmentsInComposer()}
                                <div className="flex items-center gap-1">
                                <Textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }
                                    }}
                                    placeholder="O que posso fazer por você?"
                                    className="flex-1 min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 placeholder:text-muted-foreground py-3"
                                    disabled={isLoading || isStreaming}
                                    rows={1}
                                  />
                                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground/50 cursor-not-allowed" title="Em breve" disabled>
                                    <Sparkles className="h-4 w-4" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground">
                                    <Mic className="h-4 w-4" />
                                  </Button>
                                  <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={(!input.trim() && pendingAttachments.length === 0) || isLoading || isStreaming}>
                                    <Send className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="pt-2 flex items-center gap-2 border-t border-border/50">
                                  {renderToolsMenu()}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1.5 h-9 text-muted-foreground shrink-0"
                                    onClick={() => setIsContextPanelOpen(true)}
                                  >
                                    <Layers className="h-4 w-4" />
                                    Contextos
                                  </Button>
                                  {renderFeatureToolsButton()}
                                  <Button type="button" variant="ghost" size="sm" className="gap-1.5 h-9 text-muted-foreground shrink-0">
                                    <Brain className="h-4 w-4" />
                                    Experts
                                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-70" />
                                </Button>
                                </div>
                              </div>
                            </form>
                          )}
                          <p className="text-[11px] text-muted-foreground text-center px-2">
                            Os modelos de IA podem cometer erros. Sempre avalie e confira as respostas dos modelos. Imagens
                            exigem modelo com visão; PDFs até 5 MB são processados no servidor (OpenAI ou Gemini com API nativa).
                          </p>
                        </div>
                    </div>
                    </>
                    )}
                </main>
            </ResizablePanel>

            {isSidebarOpen && isDesktop && <ResizableHandle withHandle />}
            {isSidebarOpen && isDesktop && (
              <ResizablePanel defaultSize={25} minSize={0} maxSize={50} collapsible>
                <AiChatSidebar
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  isSessionsLoading={isSessionsLoading}
                  onSelectSession={handleSelectSession}
                  onNewConversation={handleNewConversation}
                  onDeleteSession={handleDeleteRequest}
                  isDesktop={isDesktop}
                  onClose={() => setIsSidebarOpen(false)}
                  onSessionUpdate={fetchSessions}
                  onSelectExpert={handleSelectExpert}
                  activeFolderId={activeFolderId}
                  onActiveFolderChange={setActiveFolderId}
                />
              </ResizablePanel>
            )}
          </ResizablePanelGroup>
            
            {!isDesktop && isSidebarOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsSidebarOpen(false)}
                    className="fixed inset-0 bg-black/50 z-40"
                />
            )}
            {!isDesktop && isSidebarOpen && (
                <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '-100%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="fixed top-0 left-0 bottom-0 w-[85%] max-w-sm bg-background z-50"
                >
                    <AiChatSidebar 
                        sessions={sessions}
                        activeSessionId={activeSessionId}
                        isSessionsLoading={isSessionsLoading}
                        onSelectSession={handleSelectSession}
                        onNewConversation={handleNewConversation}
                        onDeleteSession={handleDeleteRequest}
                        isDesktop={isDesktop}
                        onClose={() => setIsSidebarOpen(false)}
                        onSessionUpdate={fetchSessions}
                        onSelectExpert={handleSelectExpert}
                        activeFolderId={activeFolderId}
                        onActiveFolderChange={setActiveFolderId}
                    />
                </motion.div>
            )}

          <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso excluirá permanentemente a conversa e
                        removerá os dados de nossos servidores.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setSessionToDelete(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Excluir
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <ContextPanel
            open={isContextPanelOpen}
            onClose={() => setIsContextPanelOpen(false)}
            user={user}
            selectedContextIds={activeContextIds}
            onChangeSelected={setActiveContextIds}
            selectedClientProfileIds={activeClientProfileIds}
            onChangeSelectedClientProfiles={setActiveClientProfileIds}
          />
          <PromptPanel
            open={isPromptPanelOpen}
            onClose={() => setIsPromptPanelOpen(false)}
            user={user}
            activePrompt={activePrompt}
            onSelectPrompt={setActivePrompt}
          />
        </div>
      );
    };

    export default AiChat;