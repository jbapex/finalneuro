import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Image as ImageIcon, Loader2, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { BRANDING_ROW_ID } from '@/lib/landingPageCopy';
import { useLandingAssets } from '@/lib/landingAssets';
import {
  DEFAULT_FUNDADOR_COPY,
  FUNDADOR_COPY_UI_SECTIONS,
  fetchFundadorPageCopyRow,
  parseProvidersMarqueeItemLines,
} from '@/lib/fundadorPageCopy';

const BUCKET = 'system_branding';
const FOLDER = 'landing';
const CREATOR_PHOTO_KEY = 'fundador_creator';
/** Alinhado à ordem de «Nomes na faixa»; ficheiro landing/marquee_provider_N.* */
const MARQUEE_LOGO_SLOT_COUNT = 16;

function marqueeStorageBaseName(slot) {
  return `marquee_provider_${slot}`;
}

function marqueeSlotBusyKey(slot) {
  return `marquee_slot_${slot}`;
}

export default function FundadorLandingSettings() {
  const [values, setValues] = useState(() => ({ ...DEFAULT_FUNDADOR_COPY }));
  const [copyLoading, setCopyLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assetBusy, setAssetBusy] = useState(null);
  const fileInputs = useRef({});
  const { assets, loading: assetsLoading, reload: reloadAssets } = useLandingAssets();

  const load = useCallback(async () => {
    setCopyLoading(true);
    try {
      const merged = await fetchFundadorPageCopyRow();
      setValues(merged);
    } finally {
      setCopyLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key, v) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('system_branding')
        .update({
          fundador_page_copy: values,
          updated_at: new Date().toISOString(),
        })
        .eq('id', BRANDING_ROW_ID);

      if (error) throw error;
      toast({
        title: 'Landing Fundador salva',
        description: 'Textos e links atualizados em /fundador.',
      });
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description:
          err?.message || 'Verifique permissões e se a migração fundador_page_copy foi aplicada.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefaults = () => {
    if (!window.confirm('Restaurar todos os campos para o texto padrão do sistema?')) return;
    setValues({ ...DEFAULT_FUNDADOR_COPY });
  };

  const uploadCreatorPhoto = async (file) => {
    if (!file?.type?.startsWith('image/')) {
      toast({ title: 'Envie uma imagem (PNG, JPG, WebP ou GIF).', variant: 'destructive' });
      return;
    }
    setAssetBusy(CREATOR_PHOTO_KEY);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/jpeg/, 'jpg');
      const filename = `${CREATOR_PHOTO_KEY}.${ext}`;
      const path = `${FOLDER}/${filename}`;

      const { data: existingFiles } = await supabase.storage.from(BUCKET).list(FOLDER);
      if (existingFiles) {
        const toRemove = existingFiles
          .filter((f) => f.name.startsWith(`${CREATOR_PHOTO_KEY}.`))
          .map((f) => `${FOLDER}/${f.name}`);
        if (toRemove.length > 0) {
          await supabase.storage.from(BUCKET).remove(toRemove);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      toast({ title: 'Foto do criador atualizada.' });
      await reloadAssets();
    } catch (err) {
      toast({
        title: 'Erro ao enviar imagem',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setAssetBusy(null);
      if (fileInputs.current[CREATOR_PHOTO_KEY]) {
        fileInputs.current[CREATOR_PHOTO_KEY].value = '';
      }
    }
  };

  const removeCreatorPhoto = async () => {
    setAssetBusy(CREATOR_PHOTO_KEY);
    try {
      const { data: existingFiles } = await supabase.storage.from(BUCKET).list(FOLDER);
      if (existingFiles) {
        const toRemove = existingFiles
          .filter((f) => f.name.startsWith(`${CREATOR_PHOTO_KEY}.`))
          .map((f) => `${FOLDER}/${f.name}`);
        if (toRemove.length > 0) {
          const { error } = await supabase.storage.from(BUCKET).remove(toRemove);
          if (error) throw error;
        }
      }
      toast({ title: 'Foto do criador removida.' });
      await reloadAssets();
    } catch (err) {
      toast({
        title: 'Erro ao remover imagem',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setAssetBusy(null);
    }
  };

  const uploadMarqueeLogo = async (slot, file) => {
    if (!file?.type?.startsWith('image/')) {
      toast({ title: 'Envie uma imagem (PNG, JPG, WebP ou SVG).', variant: 'destructive' });
      return;
    }
    const base = marqueeStorageBaseName(slot);
    setAssetBusy(marqueeSlotBusyKey(slot));
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/jpeg/, 'jpg');
      const filename = `${base}.${ext}`;
      const path = `${FOLDER}/${filename}`;

      const { data: existingFiles } = await supabase.storage.from(BUCKET).list(FOLDER);
      if (existingFiles) {
        const toRemove = existingFiles
          .filter((f) => f.name.startsWith(`${base}.`))
          .map((f) => `${FOLDER}/${f.name}`);
        if (toRemove.length > 0) {
          await supabase.storage.from(BUCKET).remove(toRemove);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      toast({ title: `Logo posição ${slot} atualizada.` });
      await reloadAssets();
    } catch (err) {
      toast({
        title: 'Erro ao enviar logo',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setAssetBusy(null);
      const refKey = `marquee_${slot}`;
      if (fileInputs.current[refKey]) {
        fileInputs.current[refKey].value = '';
      }
    }
  };

  const removeMarqueeLogo = async (slot) => {
    const base = marqueeStorageBaseName(slot);
    setAssetBusy(marqueeSlotBusyKey(slot));
    try {
      const { data: existingFiles } = await supabase.storage.from(BUCKET).list(FOLDER);
      if (existingFiles) {
        const toRemove = existingFiles
          .filter((f) => f.name.startsWith(`${base}.`))
          .map((f) => `${FOLDER}/${f.name}`);
        if (toRemove.length > 0) {
          const { error } = await supabase.storage.from(BUCKET).remove(toRemove);
          if (error) throw error;
        }
      }
      toast({ title: `Logo posição ${slot} removida.` });
      await reloadAssets();
    } catch (err) {
      toast({
        title: 'Erro ao remover logo',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setAssetBusy(null);
    }
  };

  const loading = copyLoading || assetsLoading;
  const creatorPhotoUrl = assets[CREATOR_PHOTO_KEY];
  const busyCreator = assetBusy === CREATOR_PHOTO_KEY;
  const marqueeItemLabels = parseProvidersMarqueeItemLines(values.providers_marquee_items || '');

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Landing Fundador (/fundador)
          </CardTitle>
          <CardDescription>
            Personalize textos, menu, preços, VSL e links. Use «CTAs da landing — para onde vão os botões» para o hero,
            «Ver planos», criador e CTA final (URL ou path; vazio = rolar até Planos). Os botões Standard/Pro nas tabelas de
            preços usam «Checkout — links dos botões dos planos» (ou variáveis{' '}
            <code className="rounded bg-muted px-1">VITE_FUNDADOR_CHECKOUT_*</code> no .env). Na secção «Hero + VSL», «Script /
            iframe da VSL» aceita incorporação ou link (prioridade sobre ID YouTube).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 rounded-xl border border-border bg-card/50 p-4">
            <div>
              <Label className="text-base font-semibold">Foto do criador (secção “Quem criou”)</Label>
              <p className="text-sm text-muted-foreground">
                Imagem peito acima, fundo limpo. Fica em <code className="rounded bg-muted px-1">system_branding</code>{' '}
                / landing / <code className="rounded bg-muted px-1">fundador_creator.*</code> — tem prioridade sobre a
                URL no texto abaixo.
              </p>
            </div>
            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <div className="group relative flex aspect-[3/4] w-full max-w-[13rem] items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/30">
                {creatorPhotoUrl ? (
                  <>
                    <img src={creatorPhotoUrl} alt="Foto do criador" className="h-full w-full object-cover object-top" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button variant="destructive" size="sm" onClick={() => removeCreatorPhoto()} disabled={busyCreator}>
                        <Trash2 className="mr-2 h-4 w-4" /> Remover
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="p-4 text-center">
                    <ImageIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-50" />
                    <span className="text-xs text-muted-foreground">Nenhuma imagem</span>
                  </div>
                )}
              </div>
              <div className="w-full flex-1 space-y-4">
                <div className="space-y-2">
                  <Label>Enviar imagem</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      ref={(el) => {
                        fileInputs.current[CREATOR_PHOTO_KEY] = el;
                      }}
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          uploadCreatorPhoto(e.target.files[0]);
                        }
                      }}
                      disabled={busyCreator}
                      className="cursor-pointer"
                    />
                    {busyCreator ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card/50 p-4">
            <div>
              <Label className="text-base font-semibold">Logos da faixa «Modelos de IA» (marquee)</Label>
              <p className="text-sm text-muted-foreground">
                Cada posição corresponde à mesma linha em «Nomes na faixa» (1ª linha = posição 1). Na página pública o texto
                da linha continua sempre visível; a logo aparece à frente (à esquerda) quando existir. Ficheiros em{' '}
                <code className="rounded bg-muted px-1">landing/marquee_provider_1.*</code> …{' '}
                <code className="rounded bg-muted px-1">marquee_provider_{MARQUEE_LOGO_SLOT_COUNT}.*</code>. O upload tem
                prioridade sobre a URL no campo «URLs das logos». Prefira PNG/SVG em tons claros para fundo escuro.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: MARQUEE_LOGO_SLOT_COUNT }, (_, i) => {
                const slot = i + 1;
                const key = marqueeStorageBaseName(slot);
                const url = assets[key];
                const busy = assetBusy === marqueeSlotBusyKey(slot);
                const hint = marqueeItemLabels[i] || null;
                const refKey = `marquee_${slot}`;
                return (
                  <div
                    key={key}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-background/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Posição {slot}
                        {hint ? (
                          <span className="mt-0.5 block truncate font-normal text-foreground" title={hint}>
                            {hint}
                          </span>
                        ) : null}
                      </span>
                      {url ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 shrink-0 px-2 text-destructive"
                          onClick={() => removeMarqueeLogo(slot)}
                          disabled={busy}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                    <div className="flex h-14 items-center justify-center rounded-md border border-dashed border-border bg-muted/20">
                      {url ? (
                        <img src={url} alt="" className="max-h-12 max-w-full object-contain" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                      )}
                    </div>
                    <Input
                      type="file"
                      accept="image/*"
                      ref={(el) => {
                        fileInputs.current[refKey] = el;
                      }}
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          uploadMarqueeLogo(slot, e.target.files[0]);
                        }
                      }}
                      disabled={busy}
                      className="cursor-pointer text-xs"
                    />
                    {busy ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar alterações
            </Button>
            <Button type="button" variant="outline" onClick={handleRestoreDefaults} disabled={saving}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar padrões
            </Button>
            <Button type="button" variant="secondary" asChild>
              <a href="/fundador" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir /fundador
              </a>
            </Button>
          </div>

          <Accordion type="multiple" className="w-full rounded-lg border px-3">
            {FUNDADOR_COPY_UI_SECTIONS.map((section, idx) => (
              <AccordionItem value={`fd-${idx}`} key={section.title}>
                <AccordionTrigger className="text-left text-base">{section.title}</AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4 pt-1">
                  {section.fields.map(({ key, label, rows }) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={`fd-${key}`}>{label}</Label>
                      <Textarea
                        id={`fd-${key}`}
                        value={values[key] ?? ''}
                        onChange={(e) => setField(key, e.target.value)}
                        rows={rows || 2}
                        className="min-h-[2.5rem] resize-y font-normal"
                      />
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </motion.div>
  );
}
