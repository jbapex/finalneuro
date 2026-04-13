import React, { useState, useEffect, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import ReactMarkdown from 'react-markdown';
    import { Bot, User, Loader2, Volume2, Download, Copy, RefreshCw, Play, Heart, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, ImageIcon, FileText, Lightbulb } from 'lucide-react';
import AiChatLiveReasoningPanel from '@/components/ai-chat/AiChatLiveReasoningPanel';
    import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
    import { Button } from '@/components/ui/button';
    import { cn } from '@/lib/utils';

    function splitNeuroDesignBrief(raw) {
      const s = String(raw ?? '');
      const re = /<<<NEURODESIGN_PROMPT>>>\s*([\s\S]*?)\s*<<<END_NEURODESIGN_PROMPT>>>/i;
      const m = s.match(re);
      if (m?.[1]) {
        const neuroPrompt = m[1].trim();
        const display = s.replace(re, '').trim();
        return { markdownSource: display || neuroPrompt, neuroPrompt };
      }
      const fence = s.match(/```neurodesign\s*([\s\S]*?)```/i);
      if (fence?.[1]) {
        const neuroPrompt = fence[1].trim();
        const display = s.replace(/```neurodesign\s*[\s\S]*?```/i, '').trim();
        return { markdownSource: display || neuroPrompt, neuroPrompt };
      }
      return { markdownSource: s, neuroPrompt: null };
    }

    function formatFileSize(bytes) {
      const n = Number(bytes) || 0;
      if (n < 1024) return `${n} B`;
      if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
      return `${(n / (1024 * 1024)).toFixed(2)} MB`;
    }

    const chatMarkdownComponents = {
      p: ({ node, ...props }) => <p className="my-1 first:mt-0 last:mb-0 leading-snug" {...props} />,
      ul: ({ node, ...props }) => <ul className="my-1.5 pl-4" {...props} />,
      ol: ({ node, ...props }) => <ol className="my-1.5 pl-4" {...props} />,
      li: ({ node, ...props }) => <li className="my-0.5 leading-snug" {...props} />,
    };

    const StreamingMessage = ({ content, onFinished }) => {
      const [displayedContent, setDisplayedContent] = useState('');
    
      useEffect(() => {
        setDisplayedContent('');
        if (!content) {
          if (onFinished) onFinished();
          return;
        }
    
        const totalLength = content.length;
        // Define quantos caracteres mostrar por "tick" com base no tamanho da resposta.
        // Objetivo: manter a animação rápida mesmo para respostas longas.
        let step = 2;
        if (totalLength > 1600) {
          step = 16;
        } else if (totalLength > 1200) {
          step = 12;
        } else if (totalLength > 800) {
          step = 8;
        } else if (totalLength > 400) {
          step = 4;
        }
    
        let i = 0;
        const interval = setInterval(() => {
          if (i < totalLength) {
            setDisplayedContent(prev => prev + content.slice(i, i + step));
            i += step;
          } else {
            clearInterval(interval);
            if (onFinished) onFinished();
          }
        }, 16); // ~60 FPS, mas com vários caracteres por tick
    
        return () => clearInterval(interval);
      }, [content, onFinished]);
    
      return <ReactMarkdown components={chatMarkdownComponents}>{displayedContent}</ReactMarkdown>;
    };
    
    const AiChatMessage = ({
      message,
      className,
      isStreaming,
      onStreamingFinished,
      aiName = 'ONE',
      connectionLogoUrl = null,
      suggestedPrompts,
      suggestedPromptsLoading,
      onSuggestedPromptClick,
      onApplyNeuroDesign,
    }) => {
      const { role, content } = message;
      const isUser = role === 'user';
      const [copied, setCopied] = useState(false);
      const [logoError, setLogoError] = useState(false);

      useEffect(() => {
        setLogoError(false);
      }, [connectionLogoUrl]);

      let renderableContent;
      let reasoningContent;
      let userImageUrls = [];
      /** @type {{ name: string, size: number, kind: string }[] | null} */
      let userV2Files = null;
      let userV2Text = '';

      if (isUser) {
        if (typeof content === 'string') {
          renderableContent = content;
        } else if (content && typeof content === 'object' && content.v === 2) {
          userV2Files = Array.isArray(content.files) ? content.files : [];
          userV2Text = (content.text || '').trim();
          if (Array.isArray(content.apiParts)) {
            for (const p of content.apiParts) {
              if (p?.type === 'image_url' && p.image_url?.url) {
                userImageUrls.push(String(p.image_url.url));
              }
            }
          }
          const nameLine = userV2Files.map((f) => f.name).filter(Boolean).join(', ');
          renderableContent = [userV2Text, nameLine ? `Anexos: ${nameLine}` : ''].filter(Boolean).join('\n\n');
        } else if (content && typeof content === 'object' && content.type === 'chat_user_v2') {
          let t = (content.text || '').trim();
          if (content.hadImages && content.imageCount > 0) {
            t += `\n\n📎 ${content.imageCount} imagem(ns) anexada(s) (miniatura não guardada no histórico)`;
          }
          if (content.hadPdfs && content.pdfCount > 0) {
            t += `\n\n📄 ${content.pdfCount} PDF (conteúdo não guardado no histórico)`;
          }
          renderableContent = t;
        } else if (Array.isArray(content)) {
          const texts = [];
          for (const p of content) {
            if (p?.type === 'text' && p.text) texts.push(p.text);
            if (p?.type === 'image_url' && p.image_url?.url) userImageUrls.push(String(p.image_url.url));
          }
          renderableContent = texts.join('\n\n');
        } else if (content && typeof content === 'object' && content.text != null) {
          renderableContent = String(content.text);
        } else {
          renderableContent = String(content ?? '');
        }
      } else if (typeof content === 'string') {
        renderableContent = content;
      } else if (content && typeof content === 'object') {
        if (content.sseStreaming === true) {
          renderableContent = String(content.text ?? '');
          reasoningContent =
            typeof content.reasoning === 'string' ? content.reasoning : String(content.reasoning ?? '');
        } else if (content.text != null && content.reasoning != null) {
          renderableContent = content.text;
          reasoningContent = typeof content.reasoning === 'string' ? content.reasoning : String(content.reasoning);
        } else if (content.type === 'chat' && typeof content.content === 'string') {
          renderableContent = content.content;
        } else if (content.type === 'suggestion' && typeof content.explanation === 'string') {
          renderableContent = content.explanation;
          if (content.updates) {
            renderableContent += `\n\n**Sugestão de Alterações:**\n\`\`\`json\n${JSON.stringify(content.updates, null, 2)}\n\`\`\``;
          }
        } else {
          renderableContent = `\`\`\`json\n${JSON.stringify(content, null, 2)}\n\`\`\``;
        }
      } else {
        renderableContent = String(content);
      }

      const { markdownSource, neuroPrompt } = useMemo(() => {
        if (isUser) {
          return { markdownSource: renderableContent, neuroPrompt: null };
        }
        return splitNeuroDesignBrief(renderableContent);
      }, [isUser, renderableContent]);

      const handleCopy = () => {
        let toCopy = isUser
          ? markdownSource
          : neuroPrompt && markdownSource
            ? [markdownSource, neuroPrompt].filter(Boolean).join('\n\n---\nBrief NeuroDesign:\n')
            : renderableContent;
        if (!isUser && reasoningContent && String(reasoningContent).trim()) {
          const r = String(reasoningContent).trim();
          toCopy =
            typeof toCopy === 'string' && toCopy.trim()
              ? `Pensamento:\n${r}\n\n---\n\n${toCopy}`
              : `Pensamento:\n${r}`;
        }
        if (typeof toCopy !== 'string' || !toCopy) return;
        navigator.clipboard.writeText(toCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      };

      const isPdfOnlyV2 =
        isUser &&
        userV2Files &&
        userV2Files.length > 0 &&
        !userV2Text &&
        userImageUrls.length === 0;

      const sseLive =
        !isUser &&
        message?.content &&
        typeof message.content === 'object' &&
        message.content.sseStreaming === true &&
        isStreaming;
      const showLiveReasoningPanel =
        !isUser &&
        (sseLive || (reasoningContent != null && String(reasoningContent).trim().length > 0));
      const useSseTextStream = sseLive;

      return (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            'flex items-start gap-3',
            isUser ? 'justify-end' : '',
            className
          )}
        >
          {!isUser && (
            <Avatar className="w-9 h-9 border-2 border-primary/50 flex-shrink-0">
              {connectionLogoUrl && !logoError ? (
                <AvatarImage
                  src={connectionLogoUrl}
                  alt=""
                  className="object-contain bg-background p-1"
                  onError={() => setLogoError(true)}
                />
              ) : null}
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Bot size={20} />
              </AvatarFallback>
            </Avatar>
          )}
          <div
            className={cn(
              'flex flex-col gap-0.5 min-w-0',
              isUser ? 'items-end max-w-[min(100%,28rem)]' : 'flex-1 max-w-full'
            )}
          >
            {!isUser && (
              <span className="text-xs font-medium text-muted-foreground">{aiName}</span>
            )}
            {isUser && userV2Files && userV2Files.length > 0 && (
              <div className="mb-2 flex w-full max-w-[min(100%,20rem)] flex-col gap-2 items-end">
                {userV2Files.map((f, i) => {
                  const isImg = f.kind === 'image';
                  const isPdf = f.kind === 'pdf';
                  return (
                    <div
                      key={`${f.name}-${i}`}
                      className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm"
                    >
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                          isPdf ? 'bg-red-600/15 text-red-500' : isImg ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {isImg ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{f.name || 'Ficheiro'}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {showLiveReasoningPanel && (
              <AiChatLiveReasoningPanel
                reasoningText={reasoningContent ?? ''}
                isLive={sseLive}
                answerStarted={sseLive && String(renderableContent ?? '').length > 0}
              />
            )}
            {!isPdfOnlyV2 && (
            <div 
              className={cn(
                'px-3 py-2.5 rounded-xl shadow-sm prose dark:prose-invert prose-sm max-w-none break-words select-text leading-snug',
                'prose-p:my-1 prose-headings:mt-2 prose-headings:mb-1 prose-headings:first:mt-0',
                'prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-hr:my-3',
                isUser ? 'bg-primary text-white rounded-br-none prose-invert' : 'bg-muted/50 text-foreground rounded-bl-none border'
              )}
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {isUser && userImageUrls.length > 0 && (
                <div className="mb-2 flex flex-wrap justify-end gap-2 not-prose">
                  {userImageUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      className="max-h-40 max-w-[min(100%,14rem)] rounded-lg border border-white/30 object-contain"
                    />
                  ))}
                </div>
              )}
              {isUser ? (
                userV2Text ? (
                  <div className="whitespace-pre-wrap break-words text-sm leading-snug not-prose">{userV2Text}</div>
                ) : (
                  <div className="whitespace-pre-wrap break-words text-sm leading-snug not-prose">{markdownSource}</div>
                )
              ) : isStreaming && !useSseTextStream ? (
                <StreamingMessage content={renderableContent} onFinished={onStreamingFinished} />
              ) : (
                <ReactMarkdown components={chatMarkdownComponents}>
                  {markdownSource}
                </ReactMarkdown>
              )}
            </div>
            )}
            {!isUser && neuroPrompt && !isStreaming && typeof onApplyNeuroDesign === 'function' && (
              <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 space-y-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full sm:w-auto gap-2 font-medium"
                  onClick={() => onApplyNeuroDesign(neuroPrompt)}
                >
                  <ImageIcon className="h-4 w-4 shrink-0" />
                  Aplicar ao NeuroDesign
                </Button>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Copia o brief profissional, abre o NeuroDesign e preenche <strong className="text-foreground">Preencher com IA</strong>. Depois use <strong className="text-foreground">Preencher campos</strong>.
                </p>
              </div>
            )}
            {!isUser && (
              <div className="flex items-center gap-1 flex-wrap mt-0.5">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Áudio"><Volume2 className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Download"><Download className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Copiar" onClick={handleCopy}>
                  {copied ? <span className="text-[10px]">Copiado</span> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Regenerar"><RefreshCw className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Continuar"><Play className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground" title="Tornar minha IA favorita">
                  <Heart className="h-4 w-4" />
                  <span className="text-xs">Tornar minha IA favorita</span>
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Útil"><ThumbsUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Não útil"><ThumbsDown className="h-4 w-4" /></Button>
              </div>
            )}
            {!isUser && suggestedPromptsLoading && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">Gerando próximos passos com a IA…</span>
              </div>
            )}
            {!isUser && !suggestedPromptsLoading && Array.isArray(suggestedPrompts) && suggestedPrompts.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Continuar com a IA</span>
                <div className="flex flex-wrap gap-2">
                  {suggestedPrompts.map((item, i) => {
                    const label = typeof item === 'string' ? item : (item.label || item.prompt || '');
                    const prompt = typeof item === 'string' ? item : (item.prompt || item.label || '');
                    return (
                      <Button
                        key={i}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-auto min-h-8 py-1.5 max-w-full text-left justify-start"
                        title={prompt}
                        onClick={() => onSuggestedPromptClick?.(prompt)}
                      >
                        <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                        <span className="line-clamp-2 sm:max-w-[20rem]">{label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {isUser && (
            <Avatar className="w-9 h-9 flex-shrink-0">
              <AvatarFallback><User size={20} /></AvatarFallback>
            </Avatar>
          )}
        </motion.div>
      );
    };
    
    AiChatMessage.Loading = ({ connectionLogoUrl = null }) => {
      const [logoError, setLogoError] = useState(false);
      useEffect(() => {
        setLogoError(false);
      }, [connectionLogoUrl]);
      return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start gap-3"
      >
        <Avatar className="w-9 h-9 border-2 border-primary/50">
          {connectionLogoUrl && !logoError ? (
            <AvatarImage
              src={connectionLogoUrl}
              alt=""
              className="object-contain bg-background p-1"
              onError={() => setLogoError(true)}
            />
          ) : null}
          <AvatarFallback className="bg-primary text-primary-foreground"><Bot size={20} /></AvatarFallback>
        </Avatar>
        <div className="px-3 py-2.5 rounded-xl bg-input border flex items-center space-x-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Pensando...</span>
        </div>
      </motion.div>
      );
    };
    
    export default AiChatMessage;