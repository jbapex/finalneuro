import React, { useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import ReactMarkdown from 'react-markdown';
    import { Bot, User, Loader2, Volume2, Download, Copy, RefreshCw, Play, Heart, ThumbsUp, ThumbsDown, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
    import { Avatar, AvatarFallback } from '@/components/ui/avatar';
    import { Button } from '@/components/ui/button';
    import { cn } from '@/lib/utils';

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
    
      return <ReactMarkdown>{displayedContent}</ReactMarkdown>;
    };
    
    const AiChatMessage = ({ message, className, isStreaming, onStreamingFinished, aiName = 'ONE', suggestedPrompts, onSuggestedPromptClick }) => {
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
    
      const handleCopy = () => {
        if (typeof renderableContent !== 'string') return;
        navigator.clipboard.writeText(renderableContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      };

      return (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            'flex items-start gap-4', 
            isUser ? 'justify-end' : '',
            className
          )}
        >
          {!isUser && (
            <Avatar className="w-9 h-9 border-2 border-primary/50 flex-shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground"><Bot size={20} /></AvatarFallback>
            </Avatar>
          )}
          <div className={cn('flex flex-col gap-1 max-w-2xl', isUser ? 'items-end' : '')}>
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
                'p-4 rounded-2xl shadow-sm prose dark:prose-invert prose-sm max-w-none break-words select-text',
                isUser ? 'bg-primary text-white rounded-br-none' : 'bg-muted/50 text-foreground rounded-bl-none border'
              )}
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {isStreaming ? (
                <StreamingMessage content={renderableContent} onFinished={onStreamingFinished} />
              ) : (
                <ReactMarkdown
                  components={{
                    p: ({ node, ...props }) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
                    ul: ({ node, ...props }) => <ul className="my-2" {...props} />,
                    ol: ({ node, ...props }) => <ol className="my-2" {...props} />,
                    li: ({ node, ...props }) => <li className="my-1" {...props} />,
                  }}
                >
                  {renderableContent}
                </ReactMarkdown>
              )}
            </div>
            {!isUser && (
              <div className="flex items-center gap-1 flex-wrap mt-1">
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
            {!isUser && Array.isArray(suggestedPrompts) && suggestedPrompts.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {suggestedPrompts.map((text, i) => (
                  <Button
                    key={i}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => onSuggestedPromptClick?.(text)}
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                    {text}
                  </Button>
                ))}
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
        className="flex items-start gap-4"
      >
        <Avatar className="w-9 h-9 border-2 border-primary/50">
          <AvatarFallback className="bg-primary text-primary-foreground"><Bot size={20} /></AvatarFallback>
        </Avatar>
        <div className="p-4 rounded-2xl bg-input border flex items-center space-x-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Pensando...</span>
        </div>
      </motion.div>
    );
    
    export default AiChatMessage;