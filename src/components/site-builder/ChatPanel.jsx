import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, MessageSquare, Code, GripVertical, LayoutList, FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SITE_BUILDER_SECTIONS } from '@/lib/siteBuilderSections';

const CODE_BLOCK_COLLAPSE_LINES = 5;

const THINKING_MESSAGES = [
  'Analisando seu pedido...',
  'Preparando a geração do site...',
  'Gerando o layout e o conteúdo...',
  'Quase lá...',
];

/** Conteúdo de uma mensagem do chat: markdown + blocos de código estilizados e recolhíveis. */
function ChatMessageContent({ content, isUser }) {
  const contentStr = typeof content === 'string' ? content : String(content ?? '');
  const blockIdRef = useRef(0);
  const [expandedBlocks, setExpandedBlocks] = useState({});

  blockIdRef.current = 0;
  const getNextBlockId = () => ++blockIdRef.current;

  const markdownComponents = useMemo(() => {
    const base = {
      p: ({ node, ...props }) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
      ul: ({ node, ...props }) => <ul className="my-2 list-disc pl-4" {...props} />,
      ol: ({ node, ...props }) => <ol className="my-2 list-decimal pl-4" {...props} />,
      li: ({ node, ...props }) => <li className="my-0.5" {...props} />,
      code: ({ node, inline, className, children, ...props }) => {
        if (inline) {
          return (
            <code className="bg-muted/80 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
              {children}
            </code>
          );
        }
        return <code className="block" {...props}>{children}</code>;
      },
    };
    return base;
  }, []);

  const preComponent = useCallback(
    ({ node, children, ...props }) => {
      const codeChild = React.Children.toArray(children).find((c) => c?.type === 'code' || c?.props?.node?.tagName === 'code');
      const text = codeChild?.props?.children;
      const codeText = typeof text === 'string' ? text : Array.isArray(text) ? text.join('') : '';
      const lineCount = codeText ? codeText.split(/\r?\n/).length : 0;
      const isLong = lineCount > CODE_BLOCK_COLLAPSE_LINES;
      const id = getNextBlockId();
      const isExpanded = isLong ? expandedBlocks[id] === true : true;
      const setExpanded = (v) => setExpandedBlocks((prev) => ({ ...prev, [id]: v }));
      const label = codeText.trimStart().startsWith('<') ? 'HTML' : 'código';
      return (
        <div className="my-2 rounded-md border border-border overflow-hidden bg-muted/80">
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded(!isExpanded)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <span>Bloco {label} ({lineCount} linhas)</span>
              {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
            </button>
          )}
          <div
            className={cn(
              'font-mono text-xs overflow-x-auto text-foreground',
              isLong && !isExpanded && 'hidden',
              (isLong && isExpanded) || !isLong ? 'max-h-[200px] overflow-y-auto' : ''
            )}
          >
            <pre className="p-3 m-0 whitespace-pre-wrap break-words" {...props}>
              {children}
            </pre>
          </div>
        </div>
      );
    },
    [expandedBlocks]
  );

  const components = useMemo(
    () => ({ ...markdownComponents, pre: preComponent }),
    [markdownComponents, preComponent]
  );

  if (!contentStr.trim()) return null;

  if (isUser) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-p:leading-snug">
        <ReactMarkdown>{contentStr}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-p:leading-snug">
      <ReactMarkdown components={components}>{contentStr}</ReactMarkdown>
    </div>
  );
}

/** Extrai seções (nós de primeiro nível) do htmlContent para reordenação. */
function parseSections(html) {
  if (!html || typeof html !== 'string') return [];

  const trimmed = html.trim();
  if (!trimmed) return [];

  // Quando a IA devolve um documento HTML completo, extraímos apenas os filhos do <body>.
  const container = document.createElement('div');
  container.innerHTML = trimmed;

  let children = Array.from(container.children);

  const htmlEl = children.find((el) => el.tagName && el.tagName.toLowerCase() === 'html');
  if (htmlEl && htmlEl.querySelector('body')) {
    children = Array.from(htmlEl.querySelector('body').children);
  }

  return children.map((el, i) => {
    const sectionId = el.getAttribute('data-section-id') || el.id;
    const label =
      sectionId ||
      `${el.tagName.toLowerCase()}${
        el.className ? '.' + String(el.className).trim().split(/\s+/)[0] : ''
      }` ||
      `Seção ${i + 1}`;
    return { id: `section-${i}`, index: i, html: el.outerHTML, label: String(label).slice(0, 40) };
  });
}

function SortableSectionItem({ section, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-2 rounded-md border bg-card text-sm',
        isDragging && 'opacity-80 z-10 shadow'
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab touch-none p-1 text-muted-foreground">
        <GripVertical className="w-4 h-4" />
      </div>
      <span className="truncate flex-1">{section.label}</span>
    </div>
  );
}

/**
 * Painel do Criador de Site: módulos (pageStructure) ou edição HTML (htmlContent).
 * No modo htmlContent com chat: abas "Chat com IA" e "Editar HTML".
 */
const ChatPanel = ({
  pageStructure,
  setPageStructure,
  htmlContent,
  setHtmlContent,
  chatHistory,
  onSendMessage,
  isSendingChat,
  llmConnections = [],
  selectedLlmId,
  setSelectedLlmId,
  setIsBuilding,
  flowContext,
  selectedElement,
  setSelectedElement,
  onOpenImageBank,
  isBuilding,
  onSaveProject,
  isSaving,
  projectBrief = null,
  onSaveBrief,
  clients = [],
}) => {
  const isHtmlMode = htmlContent != null && setHtmlContent != null;
  const hasChat = isHtmlMode && Array.isArray(chatHistory) && typeof onSendMessage === 'function';
  const [activeTab, setActiveTab] = useState(hasChat ? 'chat' : 'html');
  const [chatInput, setChatInput] = useState('');
  const [thinkingStep, setThinkingStep] = useState(0);
  const messagesEndRef = useRef(null);
  const [briefForm, setBriefForm] = useState({
    site_name: '',
    niche: '',
    primary_color: '',
    secondary_color: '',
    tone: '',
    target_audience: '',
    estilo_visual: '',
    notes: '',
  });
  const [briefFromClientId, setBriefFromClientId] = useState('');

  useEffect(() => {
    if (projectBrief && typeof projectBrief === 'object') {
      setBriefForm({
        site_name: projectBrief.site_name ?? '',
        niche: projectBrief.niche ?? '',
        primary_color: projectBrief.primary_color ?? '',
        secondary_color: projectBrief.secondary_color ?? '',
        tone: projectBrief.tone ?? '',
        target_audience: projectBrief.target_audience ?? '',
        estilo_visual: projectBrief.estilo_visual ?? '',
        notes: projectBrief.notes ?? '',
      });
      setBriefFromClientId('');
    }
  }, [projectBrief]);

  const sections = useMemo(() => parseSections(htmlContent || ''), [htmlContent]);

  const handleSectionsDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !setHtmlContent) return;
      const oldIds = sections.map((s) => s.id);
      const oldIndex = oldIds.indexOf(active.id);
      const newIndex = oldIds.indexOf(over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(sections, oldIndex, newIndex);
      const newHtml = reordered.map((s) => s.html).join('\n');
      setHtmlContent(newHtml);
    },
    [sections, setHtmlContent]
  );

  useEffect(() => {
    if (hasChat) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, hasChat]);

  useEffect(() => {
    if (!isSendingChat) {
      setThinkingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setThinkingStep((prev) => (prev + 1) % THINKING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isSendingChat]);

  const handleSendChat = () => {
    const t = (chatInput || '').trim();
    if (!t || isSendingChat) return;
    onSendMessage(t);
    setChatInput('');
  };

  const handleAddSection = (section) => {
    const msg = `Adicione uma seção de ${section.label.toLowerCase()} (${section.promptHint}). Use o formato com <!-- APPEND --> para incluir no final da página.`;
    onSendMessage(msg);
  };

  const handleFillBriefFromClient = useCallback(
    (clientId) => {
      if (!clientId || !clients.length) return;
      const client = clients.find((c) => String(c.id) === String(clientId));
      if (!client) return;
      const notesParts = [];
      if (client.product_to_promote) notesParts.push(`Produto/serviço: ${client.product_to_promote}`);
      if (client.about) notesParts.push(client.about);
      setBriefForm({
        site_name: client.name ?? '',
        niche: client.niche ?? '',
        primary_color: '',
        secondary_color: '',
        tone: client.style_in_3_words ?? '',
        target_audience: client.target_audience ?? '',
        estilo_visual: '',
        notes: notesParts.join('\n\n').trim() || '',
      });
    },
    [clients]
  );

  if (!isHtmlMode) {
    return (
      <div className="flex flex-col h-full p-4 border rounded-lg bg-card min-h-0 overflow-hidden">
        <p className="text-sm text-muted-foreground">Chat com IA (painel de módulos / conteúdo)</p>
        {pageStructure != null && <p className="text-xs mt-2">{pageStructure?.length ?? 0} módulos</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 border rounded-lg bg-card min-h-0 overflow-hidden">
      {hasChat && (
        <div className="flex gap-1 shrink-0 mb-2 border-b border-border pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium',
              activeTab === 'chat' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
            )}
          >
            <MessageSquare className="w-4 h-4" />
            Chat com IA
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('html')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium',
              activeTab === 'html' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
            )}
          >
            <Code className="w-4 h-4" />
            Editar HTML
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sections')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium',
              activeTab === 'sections' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
            )}
          >
            <LayoutList className="w-4 h-4" />
            Seções
          </button>
          {typeof onSaveBrief === 'function' && (
            <button
              type="button"
              onClick={() => setActiveTab('brief')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium',
                activeTab === 'brief' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
              )}
            >
              <FileText className="w-4 h-4" />
              Brief
            </button>
          )}
        </div>
      )}

      {activeTab === 'brief' && typeof onSaveBrief === 'function' ? (
        <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
          <Label className="text-sm font-medium shrink-0">Brief do projeto (opcional)</Label>
          <p className="text-xs text-muted-foreground shrink-0">
            Preencha para dar contexto à IA sobre o site. A IA usará essas informações ao gerar ou alterar seções.
          </p>
          {Array.isArray(clients) && clients.length > 0 && (
            <div className="space-y-1.5 shrink-0">
              <Label className="text-xs text-muted-foreground">Preencher com dados de um cliente</Label>
              <Select
                value={briefFromClientId}
                onValueChange={(value) => {
                  if (value) {
                    handleFillBriefFromClient(value);
                    setBriefFromClientId(value);
                  } else {
                    setBriefFromClientId('');
                  }
                }}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecione um cliente…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name || `Cliente ${c.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Nome do site</Label>
              <Input
                value={briefForm.site_name}
                onChange={(e) => setBriefForm((p) => ({ ...p, site_name: e.target.value }))}
                placeholder="Ex: Minha Marca"
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Nicho</Label>
              <Input
                value={briefForm.niche}
                onChange={(e) => setBriefForm((p) => ({ ...p, niche: e.target.value }))}
                placeholder="Ex: tecnologia, saúde"
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Cor primária</Label>
              <Input
                value={briefForm.primary_color}
                onChange={(e) => setBriefForm((p) => ({ ...p, primary_color: e.target.value }))}
                placeholder="Ex: blue-600, #2563eb"
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Cor secundária</Label>
              <Input
                value={briefForm.secondary_color}
                onChange={(e) => setBriefForm((p) => ({ ...p, secondary_color: e.target.value }))}
                placeholder="Ex: gray-100"
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tom</Label>
              <Input
                value={briefForm.tone}
                onChange={(e) => setBriefForm((p) => ({ ...p, tone: e.target.value }))}
                placeholder="Ex: profissional, criativo"
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Público-alvo</Label>
              <Input
                value={briefForm.target_audience}
                onChange={(e) => setBriefForm((p) => ({ ...p, target_audience: e.target.value }))}
                placeholder="Ex: pequenos negócios"
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Estilo visual</Label>
              <Select
                value={briefForm.estilo_visual || '__none__'}
                onValueChange={(v) => setBriefForm((p) => ({ ...p, estilo_visual: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue placeholder="Selecione o estilo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum (IA decide)</SelectItem>
                  <SelectItem value="Minimalista">Minimalista</SelectItem>
                  <SelectItem value="Corporativo">Corporativo</SelectItem>
                  <SelectItem value="Criativo">Criativo</SelectItem>
                  <SelectItem value="Bold/Impacto">Bold / Impacto</SelectItem>
                  <SelectItem value="Elegante">Elegante</SelectItem>
                  <SelectItem value="Moderno">Moderno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea
                value={briefForm.notes}
                onChange={(e) => setBriefForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Outras preferências..."
                className="mt-1 text-sm min-h-[60px]"
              />
            </div>
          </div>
          <Button size="sm" onClick={() => onSaveBrief(briefForm)} className="shrink-0 w-fit">
            Salvar brief
          </Button>
        </div>
      ) : activeTab === 'sections' ? (
        <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-hidden">
          <Label className="text-sm font-medium shrink-0">Ordem das seções</Label>
          <p className="text-xs text-muted-foreground shrink-0">
            Arraste para reordenar os blocos da página. As alterações aparecem no preview.
          </p>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
            {sections.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhuma seção encontrada. Use Editar HTML ou o Chat para adicionar conteúdo.</p>
            ) : (
              <DndContext collisionDetection={closestCenter} onDragEnd={handleSectionsDragEnd}>
                <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  {sections.map((section) => (
                    <SortableSectionItem key={section.id} section={section} />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      ) : (!hasChat || activeTab === 'html') ? (
        <>
          <div className="flex items-center justify-between gap-2 shrink-0">
            <Label className="text-sm font-medium">Editar HTML da página</Label>
            {typeof onSaveProject === 'function' && (
              <Button size="sm" onClick={onSaveProject} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Salvando…' : 'Salvar'}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 shrink-0">
            Altere o HTML abaixo e use o painel à direita para ver o preview. Salve para guardar no projeto.
          </p>
          <Textarea
            value={htmlContent || ''}
            onChange={(e) => setHtmlContent(e.target.value)}
            className="flex-1 min-h-[200px] mt-2 font-mono text-xs resize-none bg-muted border-border text-foreground"
            placeholder="<section>...</section>"
          />
        </>
      ) : (
        <>
          {llmConnections.length > 1 && (
            <div className="shrink-0 mb-2">
              <Label className="text-xs text-muted-foreground">Modelo de linguagem</Label>
              <Select value={selectedLlmId || ''} onValueChange={(v) => setSelectedLlmId?.(v)}>
                <SelectTrigger className="mt-1 h-8 text-xs bg-muted border-border">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {llmConnections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.provider})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {llmConnections.length === 0 && (
            <p className="text-xs text-amber-600 shrink-0 mb-2">
              <Link to="/settings/ai" className="underline">Configure uma conexão de IA em Minha IA</Link> para usar o chat.
            </p>
          )}
          <p className="text-xs text-muted-foreground shrink-0 mb-1">
            A geração pode levar até 5 minutos; o processo para ao concluir ou ao atingir o limite de tempo.
          </p>
          <div className="shrink-0 mb-2 flex flex-wrap gap-1">
            <span className="text-xs text-muted-foreground mr-1 self-center">Adicionar seção:</span>
            {SITE_BUILDER_SECTIONS.map((s) => (
              <Button
                key={s.id}
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => handleAddSection(s)}
                disabled={isSendingChat || llmConnections.length === 0}
              >
                {s.label}
              </Button>
            ))}
          </div>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-2">
              {(chatHistory || []).map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'text-sm rounded-lg px-3 py-2 max-w-[95%]',
                    msg.role === 'user' ? 'bg-primary text-primary-foreground ml-auto' : 'bg-muted text-foreground'
                  )}
                >
                  <ChatMessageContent content={msg.content} isUser={msg.role === 'user'} />
                </div>
              ))}
              {isSendingChat && (
                <div className="text-sm rounded-lg px-3 py-2 max-w-[95%] bg-muted text-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  <span>{THINKING_MESSAGES[thinkingStep]}</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex gap-2 shrink-0">
              <Textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendChat())}
                placeholder="Ex: adicione uma seção de preços, mude só o hero, refaça o footer..."
                className="min-h-[60px] resize-none bg-muted border-border text-foreground text-sm"
                disabled={isSendingChat || llmConnections.length === 0}
              />
              <Button
                size="sm"
                onClick={handleSendChat}
                disabled={!chatInput?.trim() || isSendingChat || llmConnections.length === 0}
                className="shrink-0"
              >
                {isSendingChat ? '…' : 'Enviar'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatPanel;
