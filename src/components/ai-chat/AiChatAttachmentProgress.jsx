import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Check, ChevronDown, ChevronUp, LayoutGrid, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const PDF_STEPS = [
  'A receber o documento…',
  'A analisar o PDF…',
  'A ler o conteúdo…',
  'A gerar a resposta…',
];

const IMAGE_STEPS = [
  'A receber as imagens…',
  'A preparar o contexto visual…',
  'A interpretar o conteúdo…',
  'A gerar a resposta…',
];

/**
 * Painel de etapas (estilo “processamento em segundo plano”) enquanto a edge processa PDF/imagem.
 */
export default function AiChatAttachmentProgress({ kind, connectionLogoUrl = null, aiName = 'ONE' }) {
  const [logoError, setLogoError] = useState(false);
  const [open, setOpen] = useState(true);
  const [doneCount, setDoneCount] = useState(0);

  const steps = kind === 'image' ? IMAGE_STEPS : PDF_STEPS;
  const title = kind === 'image' ? 'A processar imagens…' : 'A analisar documento…';
  const subTitle = kind === 'image' ? 'Imagens em análise' : 'Documento analisado';

  useEffect(() => {
    setLogoError(false);
  }, [connectionLogoUrl]);

  useEffect(() => {
    setDoneCount(0);
    const tick = window.setInterval(() => {
      setDoneCount((n) => (n < steps.length - 1 ? n + 1 : n));
    }, 850);
    return () => window.clearInterval(tick);
  }, [steps.length, kind]);

  const progress = steps.length > 0 ? Math.min(100, ((doneCount + 1) / steps.length) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-start gap-3"
    >
      <Avatar className="w-9 h-9 border-2 border-primary/50 shrink-0">
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

      <div className="min-w-0 flex-1 max-w-lg">
        <span className="text-xs font-medium text-muted-foreground block mb-1.5">{aiName}</span>
        <div className="rounded-xl border border-border bg-muted/30 dark:bg-[#2a2a2d] overflow-hidden shadow-sm">
          <div className="h-0.5 w-full bg-border/60 relative">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-teal-500/90 to-cyan-400/90 shadow-[0_0_12px_rgba(34,211,238,0.45)]"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 22 }}
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
          >
            <LayoutGrid className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground flex-1 truncate">{title}</span>
            <Loader2 className="h-4 w-4 animate-spin text-teal-500/80 shrink-0" />
            {open ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>
          {open && (
            <div className="px-3 pb-3 pt-0 border-t border-border/40">
              <div className="flex items-center gap-2 py-2 opacity-90">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-teal-500/40 text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                  1
                </span>
                <span className="text-xs font-medium text-muted-foreground line-through decoration-teal-500/50">
                  {subTitle}
                </span>
              </div>
              <ul className="space-y-1.5 pl-1">
                {steps.map((label, i) => {
                  const done = i < doneCount;
                  const active = i === doneCount;
                  return (
                    <li
                      key={label}
                      className={cn(
                        'flex items-start gap-2 text-xs leading-snug',
                        done && 'text-muted-foreground',
                        active && 'text-foreground',
                        !done && !active && 'text-muted-foreground/60'
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                          done
                            ? 'border-teal-500/50 bg-teal-500/10 text-teal-600 dark:text-teal-400'
                            : active
                              ? 'border-primary/40 bg-primary/5'
                              : 'border-border'
                        )}
                      >
                        {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                      </span>
                      <span
                        className={cn(
                          'flex-1',
                          done && 'line-through decoration-border',
                          active && 'font-medium'
                        )}
                      >
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 pl-0.5">
          O ficheiro está a ser processado no servidor; em seguida aparece a resposta completa.
        </p>
      </div>
    </motion.div>
  );
}
