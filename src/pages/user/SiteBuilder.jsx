import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Helmet } from 'react-helmet';
import { Loader2, ArrowLeft, ImagePlus } from 'lucide-react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import ChatPanel from '@/components/site-builder/ChatPanel';
import PreviewPanel from '@/components/site-builder/PreviewPanel';
import SiteSectionsPanel from '@/components/site-builder/SiteSectionsPanel';
import ImageBankModal from '@/components/site-builder/ImageBankModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { applySectionImageSrc, getSectionOuterHtml } from '@/lib/siteBuilderSections';
import { getDefaultAiConnection } from '@/lib/userAiDefaults';
import {
  getPageContextFromHtml,
  buildSystemPrompt,
  extractHtmlFromChatResponse,
  applyExtractedHtml,
  coerceFullToAppendIfNeeded,
  chatResponseToString,
} from '@/lib/siteBuilderFlowGeneration';

const DEFAULT_HTML_TEMPLATE = `
<section class="bg-slate-900 text-white" data-section-id="section_0">
  <div class="mx-auto max-w-screen-xl px-4 py-24 lg:py-32 lg:flex lg:items-center">
    <div class="mx-auto max-w-3xl text-center">
      <h1 class="text-3xl font-bold tracking-tight sm:text-5xl" style="font-family: 'Outfit', sans-serif;" data-id="b3f2c1a0" data-type="heading">
        Sua Jornada Digital Começa Aqui.
        <span class="sm:block text-slate-300 mt-2" data-id="b3f2c1a1" data-type="text">Construa o Futuro.</span>
      </h1>
      <p class="mx-auto mt-6 max-w-xl text-slate-400 sm:text-lg leading-relaxed" style="font-family: 'Plus Jakarta Sans', sans-serif;" data-id="b3f2c1a2" data-type="text">
        Crie, inove e inspire. Use o chat ao lado para gerar um site único, com tipografia e cores personalizadas.
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-4">
        <a class="inline-flex rounded-lg bg-white px-8 py-3 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 transition-colors" href="#" data-id="b3f2c1a3" data-type="button">Começar</a>
        <a class="inline-flex rounded-lg border border-slate-500 px-8 py-3 text-sm font-medium text-white hover:bg-slate-800 transition-colors" href="#" data-id="b3f2c1a4" data-type="button">Saber Mais</a>
      </div>
    </div>
  </div>
</section>
`;

import { getFriendlyErrorMessage } from '@/lib/utils';

const SiteBuilder = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isImageBankOpen, setIsImageBankOpen] = useState(false);
  const [textEditElement, setTextEditElement] = useState(null); // { dataId, dataType, textContent } para popover de edição
  const [textEditValue, setTextEditValue] = useState('');
  const [textEditFont, setTextEditFont] = useState(''); // font-family para o elemento em edição ('' = herdar)
  const [insertImageSectionId, setInsertImageSectionId] = useState(null); // sectionId quando abrir ImageBank em modo "inserir"
  /** Quando o usuário escolhe imagem do banco a partir do painel Seções (substituir por data-id). */
  const [sectionImageTarget, setSectionImageTarget] = useState(null); // { sectionId, dataId, isBackground }
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [llmConnections, setLlmConnections] = useState([]);
  const [selectedLlmId, setSelectedLlmId] = useState(null);
  const [projectBrief, setProjectBrief] = useState(null);
  const [clients, setClients] = useState([]);
  const selectedElementRef = useRef(null);

  /** Opções de tipografia no dialog de edição de texto (valor = font-family CSS). */
  const TEXT_EDIT_FONT_OPTIONS = [
    { value: '', label: 'Padrão (herdar)' },
    { value: 'sans-serif', label: 'Sans serifa' },
    { value: 'serif', label: 'Serifa' },
    { value: 'monospace', label: 'Monoespaçada' },
    { value: 'Inter, sans-serif', label: 'Inter' },
    { value: '"Playfair Display", serif', label: 'Playfair Display' },
  ];

  const handleSaveProject = useCallback(async () => {
    if (!projectId || !user) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('site_projects')
      .update({ html_content: htmlContent, updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .eq('user_id', user.id);
    setIsSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Projeto salvo!' });
    }
  }, [projectId, user, htmlContent, toast]);

  const saveProjectBrief = useCallback(
    async (brief) => {
      if (!projectId || !user) return;
      const { error } = await supabase
        .from('site_projects')
        .update({
          project_brief: brief && Object.keys(brief).length ? brief : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .eq('user_id', user.id);
      if (error) {
        toast({ title: 'Erro ao salvar brief', description: error.message, variant: 'destructive' });
      } else {
        setProjectBrief(brief && Object.keys(brief).length ? brief : null);
        toast({ title: 'Brief salvo!' });
      }
    },
    [projectId, user, toast]
  );

  const fetchProject = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('site_projects')
      .select('id, name, html_content, chat_history, project_brief')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      toast({
        title: 'Erro ao carregar projeto',
        description: error?.message || 'Projeto não encontrado ou você não tem permissão.',
        variant: 'destructive',
      });
      navigate('/ferramentas/criador-de-site');
    } else {
      setProject(data);
      setChatHistory(Array.isArray(data.chat_history) ? data.chat_history : []);
      setProjectBrief(data.project_brief ?? null);
      const raw = data.html_content != null ? String(data.html_content) : '';
      setHtmlContent(raw.trim() !== '' ? raw : DEFAULT_HTML_TEMPLATE);
    }
    setIsLoading(false);
  }, [projectId, user, navigate, toast]);

  const fetchLlmConnections = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_ai_connections')
        .select('id, name, provider, capabilities')
        .eq('user_id', user.id);
      if (error) return;
      const list = (data || []).filter((c) => c.capabilities?.text_generation === true);
      const preferred = getDefaultAiConnection(user.id, 'llm');
      if (preferred) {
        list.sort((a, b) => (String(a.id) === String(preferred) ? -1 : String(b.id) === String(preferred) ? 1 : 0));
      }
      setLlmConnections(list);
      setSelectedLlmId((prev) => (list.length > 0 && (!prev || !list.some((c) => String(c.id) === String(prev))) ? list[0].id : prev));
    } catch (_e) {
      setLlmConnections([]);
    }
  }, [user]);

  const fetchClients = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, niche, target_audience, style_in_3_words, about, product_to_promote')
      .eq('user_id', user.id)
      .order('name');
    if (!error) setClients(data ?? []);
  }, [user]);

  useEffect(() => {
    if (user) fetchProject();
  }, [user, fetchProject]);

  useEffect(() => {
    if (user) fetchLlmConnections();
  }, [user, fetchLlmConnections]);

  useEffect(() => {
    if (user) fetchClients();
  }, [user, fetchClients]);

  useEffect(() => {
    selectedElementRef.current = selectedElement;
  }, [selectedElement]);

  // Ao abrir o dialog de edição de texto, preencher a fonte atual do elemento a partir do HTML.
  useEffect(() => {
    if (!textEditElement || !htmlContent) {
      if (!textEditElement) setTextEditFont('');
      return;
    }
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const el = tempDiv.querySelector(`[data-id="${textEditElement.dataId}"]`);
    if (!el) {
      setTextEditFont('');
      return;
    }
    const styleStr = el.getAttribute('style') || '';
    const fontMatch = styleStr.match(/font-family\s*:\s*([^;]+)/i);
    setTextEditFont(fontMatch ? fontMatch[1].trim() : '');
  }, [textEditElement?.dataId, htmlContent]);

  useEffect(() => {
    const handler = (event) => {
      const d = event.data;
      if (d?.type !== 'site-preview-click' || !d.dataId) return;
      const dataType = (d.dataType || 'text').toLowerCase();
      setSelectedElement({ 
        type: dataType, 
        dataId: d.dataId, 
        src: d.src,
        isBackground: d.isBackground 
      });
      if (dataType === 'image') {
        // Removido setIsImageBankOpen(true) para abrir o dialog de edição de imagem primeiro
      } else if (['heading', 'text', 'button'].includes(dataType)) {
        const initial = d.textContent != null ? String(d.textContent) : '';
        setTextEditElement({
          dataId: d.dataId,
          dataType,
          textContent: initial,
        });
        setTextEditValue(initial);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const CHAT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

  const onSendMessage = useCallback(async (userMessage) => {
    const trimmed = (userMessage || '').trim();
    if (!trimmed || !projectId || !user) return;
    const connId = selectedLlmId || llmConnections[0]?.id;
    if (!connId) {
      toast({ title: 'Configure uma conexão de IA', description: 'Vá em Minha IA e configure uma conexão de modelo de linguagem para usar o chat.', variant: 'destructive' });
      return;
    }
    setIsSendingChat(true);
    const newUserMsg = { role: 'user', content: trimmed };
    setChatHistory((prev) => [...prev, newUserMsg]);
    const timeoutSignal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(CHAT_TIMEOUT_MS) : null;
    const pageContext = getPageContextFromHtml(htmlContent);
    const systemPrompt = buildSystemPrompt(pageContext, projectBrief);
    const safeHistory = Array.isArray(chatHistory) ? chatHistory : [];
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...safeHistory,
        newUserMsg,
      ];
      const invokeOptions = {
        body: JSON.stringify({
          session_id: null,
          messages,
          llm_integration_id: connId,
          is_user_connection: true,
          context: 'site_builder_chat',
          current_page_context: pageContext,
        }),
      };
      if (timeoutSignal) invokeOptions.signal = timeoutSignal;
      const { data, error } = await supabase.functions.invoke('generic-ai-chat', invokeOptions);
      const errMsg = data?.error || error?.message || error;
      if (error || data?.error) throw new Error(errMsg);
      const raw = data?.response ?? data?.content ?? '';
      const rawStr = chatResponseToString(raw);
      const assistantMsg = { role: 'assistant', content: rawStr };
      setChatHistory((prev) => [...prev, assistantMsg]);
      let extracted = extractHtmlFromChatResponse(rawStr);
      extracted = coerceFullToAppendIfNeeded(htmlContent, trimmed, extracted);
      if (extracted) {
        const newContent = applyExtractedHtml(htmlContent, extracted);
        setHtmlContent(newContent);
        const updatedHistory = [...safeHistory, newUserMsg, assistantMsg];
        await supabase
          .from('site_projects')
          .update({
            html_content: newContent,
            chat_history: updatedHistory,
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId)
          .eq('user_id', user.id);
      } else {
        const updatedHistory = [...safeHistory, newUserMsg, assistantMsg];
        await supabase
          .from('site_projects')
          .update({
            chat_history: updatedHistory,
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId)
          .eq('user_id', user.id);
        toast({
          title: 'Preview não atualizado',
          description: 'A resposta foi recebida e salva no chat, mas não continha um bloco de código HTML para aplicar ao site. Reformule o pedido pedindo a alteração (ex.: "adicione uma seção de preços") ou use os botões "Adicionar seção" para garantir o formato.',
          variant: 'default',
        });
      }
    } catch (e) {
      setChatHistory((prev) => prev.slice(0, -1));
      const msg = e?.message || '';
      const isTimeout = e?.name === 'AbortError' || /timeout|abort|demorou muito/i.test(msg);
      if (isTimeout) {
        toast({
          title: 'Resposta demorou muito',
          description: msg || 'A IA demorou para responder. Tente um pedido mais curto ou tente novamente em instantes.',
          variant: 'destructive',
        });
      } else {
        const friendlyMsg = getFriendlyErrorMessage(e);
        toast({ title: 'Aviso', description: friendlyMsg, variant: 'destructive' });
      }
    } finally {
      setIsSendingChat(false);
    }
  }, [projectId, user, chatHistory, htmlContent, projectBrief, selectedLlmId, llmConnections, toast]);

  const onRefineSection = useCallback(
    async (sectionId, instruction) => {
      const sectionHtml = getSectionOuterHtml(htmlContent, sectionId);
      if (!sectionHtml) {
        toast({ title: 'Seção não encontrada', description: 'Não foi possível localizar o HTML desta seção.', variant: 'destructive' });
        return;
      }
      const msg = `[REFINAR APENAS A SEÇÃO ${sectionId}] Siga a instrução e devolva SOMENTE esta seção atualizada.

Regras obrigatórias:
- Responda com um único bloco \`\`\`html\`\`\`.
- A primeira linha dentro do bloco deve ser exatamente: <!-- REPLACE_SECTION: ${sectionId} -->
- Em seguida, o HTML completo de UMA tag <section>...</section> (mantenha data-section-id="${sectionId}").
- Não envie a página inteira nem outras seções.

Instrução do usuário:
${instruction}

HTML atual desta seção (referência):
${sectionHtml}`;
      await onSendMessage(msg);
    },
    [htmlContent, onSendMessage, toast]
  );

  const saveTextEdit = useCallback((newText) => {
    if (!textEditElement) return;
    const { dataId } = textEditElement;
    const valueToSave = newText != null ? String(newText) : textEditElement.textContent;
    const fontToApply = textEditFont != null ? String(textEditFont).trim() : '';
    setHtmlContent((prev) => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = prev;
      const el = tempDiv.querySelector(`[data-id="${dataId}"]`);
      if (el) {
        el.textContent = valueToSave;
        const currentStyle = el.getAttribute('style') || '';
        const parts = currentStyle.split(';').filter(Boolean).map((s) => s.trim());
        const styleObj = {};
        parts.forEach((part) => {
          const colon = part.indexOf(':');
          if (colon > 0) {
            const key = part.slice(0, colon).trim();
            const val = part.slice(colon + 1).trim();
            if (key.toLowerCase() !== 'font-family') styleObj[key] = val;
          }
        });
        if (fontToApply) styleObj['font-family'] = fontToApply;
        const newStyle = Object.entries(styleObj).map(([k, v]) => `${k}: ${v}`).join('; ');
        if (newStyle) el.setAttribute('style', newStyle);
        else el.removeAttribute('style');
        return tempDiv.innerHTML;
      }
      return prev;
    });
    setTextEditElement(null);
    setSelectedElement(null);
    setTextEditFont('');
    toast({ title: 'Texto atualizado!' });
  }, [textEditElement, textEditFont, toast]);

  const onImageSelect = (image) => {
    if (sectionImageTarget) {
      const { sectionId, dataId, isBackground } = sectionImageTarget;
      const url = image?.signedUrl;
      if (!url) {
        toast({ title: 'Imagem inválida', variant: 'destructive' });
        return;
      }
      setHtmlContent((prev) => applySectionImageSrc(prev, sectionId, dataId, url, isBackground));
      setSectionImageTarget(null);
      setIsImageBankOpen(false);
      toast({ title: 'Imagem atualizada!' });
      return;
    }

    const currentSelectedElement = selectedElementRef.current;
    if (!currentSelectedElement || currentSelectedElement.type !== 'image') {
      toast({
        title: 'Nenhuma imagem selecionada no editor',
        description: 'Por favor, clique em uma imagem na página para substituí-la.',
        variant: 'destructive',
      });
      return;
    }
    const { signedUrl } = image;
    setHtmlContent(prevContent => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = prevContent;
      
      let imgToUpdate;
      if (currentSelectedElement.isBackground) {
        imgToUpdate = tempDiv.querySelector(`div[data-id="${currentSelectedElement.dataId}"]`);
        if (imgToUpdate) {
          const currentStyle = imgToUpdate.getAttribute('style') || '';
          // Remove qualquer background-image existente e adiciona a nova
          const newStyle = currentStyle.replace(/background-image:\s*url\([^)]+\);?/, '') 
                         + ` background-image: url('${signedUrl}');`;
          imgToUpdate.setAttribute('style', newStyle.trim());
          toast({ title: 'Imagem de fundo atualizada com sucesso!' });
          return tempDiv.innerHTML;
        }
      } else {
        imgToUpdate = tempDiv.querySelector(`img[data-id="${currentSelectedElement.dataId}"]`);
        if (imgToUpdate) {
          imgToUpdate.src = signedUrl;
          // Só atualiza o alt se vier do banco de imagens (tem alt_text)
          if (image.alt_text !== undefined) {
            imgToUpdate.alt = image.alt_text || '';
          }
          toast({ title: 'Imagem atualizada com sucesso!' });
          return tempDiv.innerHTML;
        }
      }
      
      toast({ title: 'Erro ao atualizar imagem', variant: 'destructive' });
      return prevContent;
    });
    setIsImageBankOpen(false);
    setSelectedElement(null);
  };

  const onImageSelectInsert = useCallback(
    (image, sectionId) => {
      if (!image?.signedUrl || !sectionId) return;
      setHtmlContent((prev) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = prev;
        const section = tempDiv.querySelector(`[data-section-id="${sectionId}"]`);
        if (!section) {
          toast({ title: 'Seção não encontrada', variant: 'destructive' });
          return prev;
        }
        const img = document.createElement('img');
        img.setAttribute('data-id', `insert-img-${Date.now()}`);
        img.setAttribute('data-type', 'image');
        img.setAttribute('src', image.signedUrl);
        img.setAttribute('alt', image.alt_text || '');
        img.setAttribute('class', 'max-w-full h-auto rounded-lg');
        section.appendChild(img);
        toast({ title: 'Imagem inserida!' });
        return tempDiv.innerHTML;
      });
      setIsImageBankOpen(false);
      setInsertImageSectionId(null);
    },
    [toast]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-16 h-16 text-primary animate-spin" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <>
      <Helmet>
        <title>{`Editor: ${project?.name || 'Criador de Sites'}`}</title>
        <meta name="description" content="Crie e edite landing pages usando uma interface de chat com preview em tempo real." />
      </Helmet>
      <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="p-2 border-b flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ferramentas/criador-de-site')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{project.name}</h1>
        </header>
        <ResizablePanelGroup direction="horizontal" className="flex-grow min-h-0 overflow-hidden">
          <ResizablePanel defaultSize={40} minSize={20} className="min-h-0">
            <ChatPanel
              htmlContent={htmlContent}
              setHtmlContent={setHtmlContent}
              chatHistory={chatHistory}
              onSendMessage={onSendMessage}
              isSendingChat={isSendingChat}
              llmConnections={llmConnections}
              selectedLlmId={selectedLlmId}
              setSelectedLlmId={setSelectedLlmId}
              setIsBuilding={setIsBuilding}
              onSaveProject={handleSaveProject}
              isSaving={isSaving}
              projectBrief={projectBrief}
              onSaveBrief={saveProjectBrief}
              clients={clients}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={60} minSize={20} className="min-h-0 flex flex-col overflow-hidden">
            <div className="flex flex-col min-h-0 flex-1">
              <Tabs defaultValue="preview" className="flex flex-col flex-1 min-h-0 gap-0">
                <div className="flex items-center justify-between gap-2 px-2 pt-2 border-b shrink-0">
                  <TabsList className="h-9">
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                    <TabsTrigger value="sections">Seções</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="preview" className="flex flex-col flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
                  <div className="flex items-center gap-2 p-2 border-b shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <ImagePlus className="h-4 w-4 mr-2" />
                          Inserir imagem
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {(() => {
                          const sectionIds = getPageContextFromHtml(htmlContent).section_ids;
                          return sectionIds.length === 0 ? (
                            <DropdownMenuItem disabled>Adicione seções ao site primeiro</DropdownMenuItem>
                          ) : (
                            sectionIds.map((sid) => (
                              <DropdownMenuItem
                                key={sid}
                                onClick={() => {
                                  setInsertImageSectionId(sid);
                                  setIsImageBankOpen(true);
                                }}
                              >
                                Inserir em {sid.replace('section_', 'Seção ')}
                              </DropdownMenuItem>
                            ))
                          );
                        })()}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex-1 min-h-0 flex flex-col min-w-0 h-full min-h-[400px]">
                    <PreviewPanel
                      htmlContent={htmlContent}
                      setHtmlContent={setHtmlContent}
                      selectedElement={selectedElement}
                      setSelectedElement={setSelectedElement}
                      onOpenImageBank={() => setIsImageBankOpen(true)}
                      isBuilding={isSendingChat}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="sections" className="flex flex-col flex-1 min-h-0 mt-0 data-[state=inactive]:hidden overflow-hidden">
                  <SiteSectionsPanel
                    htmlContent={htmlContent}
                    setHtmlContent={setHtmlContent}
                    onRefineSection={onRefineSection}
                    isRefining={isSendingChat}
                    onPickImageFromBank={(target) => {
                      setSectionImageTarget(target);
                      setIsImageBankOpen(true);
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <ImageBankModal
        isOpen={isImageBankOpen}
        onClose={() => {
          setIsImageBankOpen(false);
          setSelectedElement(null);
          setInsertImageSectionId(null);
          setSectionImageTarget(null);
        }}
        projectId={projectId}
        onImageSelect={onImageSelect}
        insertMode={insertImageSectionId != null}
        sectionId={insertImageSectionId}
        onImageSelectInsert={onImageSelectInsert}
      />
      <Dialog open={!!textEditElement} onOpenChange={(open) => { if (!open) { setTextEditElement(null); setSelectedElement(null); setTextEditFont(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar texto</DialogTitle>
          </DialogHeader>
          <Textarea
            value={textEditValue}
            onChange={(e) => setTextEditValue(e.target.value)}
            placeholder="Texto do elemento"
            className="min-h-[120px]"
            autoFocus
          />
          <div className="space-y-2">
            <Label>Tipografia</Label>
            <Select value={TEXT_EDIT_FONT_OPTIONS.some((o) => o.value === textEditFont) ? textEditFont : '__inherit__'} onValueChange={(v) => setTextEditFont(v === '__inherit__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Fonte" />
              </SelectTrigger>
              <SelectContent>
                {TEXT_EDIT_FONT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value || '__inherit__'} value={opt.value === '' ? '__inherit__' : opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTextEditElement(null); setSelectedElement(null); setTextEditFont(''); }}>
              Cancelar
            </Button>
            <Button onClick={() => saveTextEdit(textEditValue)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedElement?.type === 'image' && !isImageBankOpen} onOpenChange={(open) => { if (!open) { setSelectedElement(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Imagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>URL da Imagem</Label>
              <Input
                value={selectedElement?.src || ''}
                onChange={(e) => setSelectedElement(prev => ({ ...prev, src: e.target.value }))}
                placeholder="https://exemplo.com/imagem.jpg"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 border-t"></div>
              <span className="text-xs text-muted-foreground uppercase">OU</span>
              <div className="flex-1 border-t"></div>
            </div>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => setIsImageBankOpen(true)}
            >
              <ImagePlus className="h-4 w-4 mr-2" />
              Escolher do Banco de Imagens
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedElement(null)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              if (selectedElement?.src) {
                onImageSelect({ signedUrl: selectedElement.src });
              }
            }}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SiteBuilder;
