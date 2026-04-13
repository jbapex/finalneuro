import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, LayoutGrid, Lightbulb, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Painel estilo Gemini: plano de ação → Pensamento → lista com ✓ (durante stream ou concluído).
 */
export default function AiChatLiveReasoningPanel({
  reasoningText = '',
  isLive = false,
  answerStarted = false,
  className,
}) {
  const [planOpen, setPlanOpen] = useState(true);
  const [thoughtOpen, setThoughtOpen] = useState(true);

  const raw = String(reasoningText ?? '');
  const parts = raw.split('\n');
  const hasTrailingNl = raw.endsWith('\n');
  const partialTail = isLive && !hasTrailingNl && parts.length > 0;
  const completedLines = (partialTail ? parts.slice(0, -1) : parts).filter((l) => l.trim().length > 0);
  const currentLine = partialTail ? (parts[parts.length - 1] ?? '') : '';

  const showWaiting = isLive && !raw.trim() && !answerStarted;
  const showAnswerOnlyHint = isLive && !raw.trim() && answerStarted;

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-muted/30 dark:bg-[#2a2a2d] overflow-hidden mb-2 shadow-sm',
        className
      )}
    >
      <div className="h-0.5 w-full bg-border/50 relative overflow-hidden">
        {isLive ? (
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-teal-500/90 to-cyan-400/80"
            initial={{ width: '12%' }}
            animate={{ width: ['12%', '88%', '40%', '75%', '55%'], opacity: [0.75, 1, 0.9, 1, 0.95] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-teal-500/80 to-cyan-400/70" />
        )}
      </div>

      <button
        type="button"
        onClick={() => setPlanOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border/40"
      >
        <LayoutGrid className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground flex-1">A executar plano de ação</span>
        {isLive ? <Loader2 className="h-4 w-4 animate-spin text-teal-500/80 shrink-0" /> : null}
        {planOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {planOpen && (
        <div className="px-2 pb-2 pt-0">
          <button
            type="button"
            onClick={() => setThoughtOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-2 py-2 text-left hover:bg-muted/40 rounded-lg transition-colors"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/25">
              <Lightbulb className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-semibold text-foreground flex-1">Pensamento</span>
            {thoughtOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>

          {thoughtOpen && (
            <ul className="space-y-2 pl-1 pr-1 pb-1 mt-1">
              {showWaiting && (
                <li className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 shrink-0 mt-0.5 animate-spin text-teal-500" />
                  <span>A preparar o raciocínio…</span>
                </li>
              )}
              {showAnswerOnlyHint && (
                <li className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 shrink-0 mt-0.5 animate-spin text-teal-500/70" />
                  <span>O modelo ainda não enviou pensamento visível; a resposta está a ser gerada.</span>
                </li>
              )}
              {completedLines.map((line, i) => (
                <li key={`done-${i}`} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                  <span className="flex-1 line-through decoration-border/80 leading-snug">{line.trim()}</span>
                </li>
              ))}
              {(partialTail ? currentLine.trim() : '') && (
                <li className="flex items-start gap-2 text-xs text-foreground">
                  <Loader2 className="h-3.5 w-3.5 shrink-0 mt-0.5 animate-spin text-teal-500" />
                  <span className="flex-1 font-medium leading-snug whitespace-pre-wrap break-words">
                    {currentLine.trim()}
                  </span>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
