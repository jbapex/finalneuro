import React, { useMemo, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { NEURODESIGN_GOOGLE_FONTS } from '@/lib/neurodesign/googleFontsList';
import { NEURODESIGN_QUICK_FONT_LABELS } from '@/lib/neurodesign/fontPrompt';

export const NEURODESIGN_FONT_SYSTEM_VALUE = '__default__';

const QUICK_OPTIONS = [
  { value: NEURODESIGN_FONT_SYSTEM_VALUE, label: 'Sistema decide' },
  { value: 'sans', label: 'Sans serifa' },
  { value: 'serif', label: 'Serifa' },
  { value: 'bold', label: 'Negrito' },
  { value: 'modern', label: 'Moderno' },
];

function isQuickFont(v) {
  return v && NEURODESIGN_QUICK_FONT_LABELS[v];
}

function isGfFont(v) {
  return typeof v === 'string' && v.toLowerCase().startsWith('gf:');
}

function customFontFromValue(v) {
  if (!v || v === NEURODESIGN_FONT_SYSTEM_VALUE) return '';
  if (isQuickFont(v) || isGfFont(v)) return '';
  return v;
}

function triggerLabel(value) {
  const v = value === NEURODESIGN_FONT_SYSTEM_VALUE || !value ? '' : value;
  if (!v) return 'Sistema decide';
  const q = QUICK_OPTIONS.find((o) => o.value === v);
  if (q) return q.label;
  if (isGfFont(v)) return `${v.slice(3)} (Google Font)`;
  return v.length > 36 ? `${v.slice(0, 34)}…` : v;
}

/**
 * Escolha de fonte para título / subtítulo / CTA no NeuroDesign.
 * Opções rápidas + ~70 Google Fonts pesquisáveis + campo livre.
 */
export function NeuroDesignFontPicker({ value, onChange, className, id }) {
  const [open, setOpen] = useState(false);

  const normalizedValue = value === '' || value == null ? NEURODESIGN_FONT_SYSTEM_VALUE : value;

  const customOnly = useMemo(() => customFontFromValue(normalizedValue === NEURODESIGN_FONT_SYSTEM_VALUE ? '' : normalizedValue), [normalizedValue]);

  const handlePickPreset = (next) => {
    onChange(next === NEURODESIGN_FONT_SYSTEM_VALUE ? '' : next);
    setOpen(false);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'mt-1 h-8 min-h-10 sm:min-h-0 w-full justify-between font-normal text-base sm:text-xs',
              'bg-muted border-border text-foreground'
            )}
          >
            <span className="truncate text-left">{triggerLabel(normalizedValue)}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,320px)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar fonte…" />
            <CommandList className="max-h-[min(50vh,280px)]">
              <CommandEmpty>Nenhuma fonte encontrada.</CommandEmpty>
              <CommandGroup heading="Rápido">
                {QUICK_OPTIONS.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={`${o.label} ${o.value} rápido`}
                    onSelect={() => handlePickPreset(o.value)}
                  >
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Google Fonts (curadoria)">
                {NEURODESIGN_GOOGLE_FONTS.map(({ family, tags }) => (
                  <CommandItem
                    key={family}
                    value={`${family} ${tags} google font`}
                    onSelect={() => handlePickPreset(`gf:${family}`)}
                  >
                    <span className="font-medium">{family}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{tags}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <div>
        <label htmlFor={id ? `${id}-custom` : undefined} className="sr-only">
          Nome personalizado da fonte
        </label>
        <Input
          id={id ? `${id}-custom` : undefined}
          placeholder="Ou digite outro nome (ex.: uma fonte do catálogo Google)"
          value={customOnly}
          onChange={(e) => {
            const t = e.target.value;
            onChange(t.trim() === '' ? '' : t);
          }}
          className="h-8 text-base sm:text-sm bg-muted border-border text-foreground placeholder:text-muted-foreground"
        />
        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
          Lista com fontes populares (licenças abertas). Para qualquer família do{' '}
          <a href="https://fonts.google.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
            Google Fonts
          </a>
          , use a busca acima ou escreva o nome exato no campo.
        </p>
      </div>
    </div>
  );
}
