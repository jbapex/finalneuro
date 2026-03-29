import React, { useState, useEffect, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import ReactMarkdown from 'react-markdown';
    import { Bot, User, Loader2, Volume2, Download, Copy, RefreshCw, Play, Heart, ThumbsUp, ThumbsDown, Lightbulb, ChevronDown, ChevronUp, ImageIcon } from 'lucide-react';
    import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
    
    const AiChatMessage = ({ message, className, isStreaming, onStreamingFinished, aiName = 'ONE', suggestedPrompts, suggestedPromptsLoading, onSuggestedPromptClick, onApplyNeuroDesign }) => {
      const { role, content } = message;
      const isUser = role === 'user';
      const [copied, setCopied] = useState(false);
      const [reasoningOpen, setReasoningOpen] = useState(true);

      let renderableContent;
      let reasoningContent;
      if (typeof content === 'string') {
          renderableContent = content;
      } else if (content && typeof content === 'object') {
          if (content.text != null && content.reasoning != null) {
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

      const { markdownSource, neuroPrompt } = useMemo(
        () => splitNeuroDesignBrief(renderableContent),
        [renderableContent]
      );
    
      const handleCopy = () => {
        if (typeof renderableContent !== 'string') return;
        const toCopy =
          neuroPrompt && markdownSource
            ? [markdownSource, neuroPrompt].filter(Boolean).join('\n\n---\nBrief NeuroDesign:\n')
            : renderableContent;
        navigator.clipboard.writeText(toCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      };

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
              <AvatarFallback className="bg-primary text-primary-foreground"><Bot size={20} /></AvatarFallback>
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
            {!isUser && reasoningContent && (
              <div className="rounded-xl border bg-muted/40 overflow-hidden mb-2">
                <button
                  type="button"
                  onClick={() => setReasoningOpen((o) => !o)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium text-foreground">Raciocínio concluído</span>
                  </div>
                  {reasoningOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>
                {reasoningOpen && (
                  <div className="px-4 pb-3 pt-0 text-sm text-muted-foreground border-t border-border/50">
                    <ul className="space-y-2 list-none pl-0">
                      {reasoningContent
                        .split(/\n+/)
                        .filter((line) => line.trim())
                        .map((line, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-primary/70 shrink-0">•</span>
                            <span className="flex-1" style={{ whiteSpace: 'pre-wrap' }}>{line.trim()}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div 
              className={cn(
                'px-3 py-2.5 rounded-xl shadow-sm prose dark:prose-invert prose-sm max-w-none break-words select-text leading-snug',
                'prose-p:my-1 prose-headings:mt-2 prose-headings:mb-1 prose-headings:first:mt-0',
                'prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-hr:my-3',
                isUser ? 'bg-primary text-white rounded-br-none prose-invert' : 'bg-muted/50 text-foreground rounded-bl-none border'
              )}
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {isStreaming ? (
                <StreamingMessage content={renderableContent} onFinished={onStreamingFinished} />
              ) : (
                <ReactMarkdown components={chatMarkdownComponents}>
                  {markdownSource}
                </ReactMarkdown>
              )}
            </div>
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
    
    AiChatMessage.Loading = () => (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start gap-3"
      >
        <Avatar className="w-9 h-9 border-2 border-primary/50">
          <AvatarFallback className="bg-primary text-primary-foreground"><Bot size={20} /></AvatarFallback>
        </Avatar>
        <div className="px-3 py-2.5 rounded-xl bg-input border flex items-center space-x-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Pensando...</span>
        </div>
      </motion.div>
    );
    
    export default AiChatMessage;