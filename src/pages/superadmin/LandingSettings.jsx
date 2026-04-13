import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Upload, Loader2, Trash2, Type, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useLandingAssets } from '@/lib/landingAssets';
import {
  BRANDING_ROW_ID,
  DEFAULT_LANDING_COPY,
  LANDING_COPY_UI_SECTIONS,
  fetchLandingPageCopyRow,
} from '@/lib/landingPageCopy';

const BUCKET = 'system_branding';
const FOLDER = 'landing';

function LandingCopyEditor() {
  const [values, setValues] = useState(() => ({ ...DEFAULT_LANDING_COPY }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const merged = await fetchLandingPageCopyRow();
      setValues(merged);
    } finally {
      setLoading(false);
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
          landing_page_copy: values,
          updated_at: new Date().toISOString(),
        })
        .eq('id', BRANDING_ROW_ID);

      if (error) throw error;
      toast({ title: 'Textos da landing salvos', description: 'Alterações visíveis na página de login.' });
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Verifique permissões e se a migração landing_page_copy foi aplicada.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefaults = () => {
    if (!window.confirm('Restaurar todos os campos para o texto padrão do sistema?')) return;
    setValues({ ...DEFAULT_LANDING_COPY });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Type className="h-5 w-5 text-primary" />
          Textos da landing (/auth)
        </CardTitle>
        <CardDescription>
          Personalize títulos, parágrafos, cards e CTAs. Campos vazios voltam ao padrão na página pública. Imagens
          continuam na aba &quot;Imagens&quot;.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar textos
          </Button>
          <Button type="button" variant="outline" onClick={handleRestoreDefaults} disabled={saving}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Restaurar padrões (formulário)
          </Button>
        </div>

        <Accordion type="multiple" className="w-full border rounded-lg px-3">
          {LANDING_COPY_UI_SECTIONS.map((section, idx) => (
            <AccordionItem value={`sec-${idx}`} key={section.title}>
              <AccordionTrigger className="text-left text-base">{section.title}</AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4 pt-1">
                {section.fields.map(({ key, label, rows }) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`lc-${key}`}>{label}</Label>
                    <Textarea
                      id={`lc-${key}`}
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
  );
}

export default function LandingSettings() {
  const { assets, loading, reload } = useLandingAssets();
  const [saving, setSaving] = useState(null);

  const fileInputs = useRef({});

  const uploadAsset = async (key, file) => {
    if (!file?.type?.startsWith('image/')) {
      toast({ title: 'Envie uma imagem (PNG, JPG, WebP ou GIF).', variant: 'destructive' });
      return;
    }
    setSaving(key);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/jpeg/, 'jpg');
      const filename = `${key}.${ext}`;
      const path = `${FOLDER}/${filename}`;

      const { data: existingFiles } = await supabase.storage.from(BUCKET).list(FOLDER);
      if (existingFiles) {
        const toRemove = existingFiles
          .filter((f) => f.name.startsWith(`${key}.`))
          .map((f) => `${FOLDER}/${f.name}`);
        if (toRemove.length > 0) {
          await supabase.storage.from(BUCKET).remove(toRemove);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      toast({ title: 'Imagem atualizada com sucesso.' });
      await reload();
    } catch (err) {
      toast({
        title: 'Erro ao salvar imagem',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
      if (fileInputs.current[key]) {
        fileInputs.current[key].value = '';
      }
    }
  };

  const removeAsset = async (key) => {
    setSaving(key);
    try {
      const { data: existingFiles } = await supabase.storage.from(BUCKET).list(FOLDER);
      if (existingFiles) {
        const toRemove = existingFiles
          .filter((f) => f.name.startsWith(`${key}.`))
          .map((f) => `${FOLDER}/${f.name}`);
        if (toRemove.length > 0) {
          const { error } = await supabase.storage.from(BUCKET).remove(toRemove);
          if (error) throw error;
        }
      }
      toast({ title: 'Imagem removida.' });
      await reload();
    } catch (err) {
      toast({
        title: 'Erro ao remover imagem',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const renderUploadField = (key, label, description) => {
    const isSaving = saving === key;
    const currentUrl = assets[key];

    return (
      <div className="space-y-4 rounded-xl border border-border bg-card/50 p-4">
        <div>
          <Label className="text-base font-semibold">{label}</Label>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/30 sm:w-64">
            {currentUrl ? (
              <>
                <img src={currentUrl} alt={label} className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="destructive" size="sm" onClick={() => removeAsset(key)} disabled={isSaving}>
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
              <Label>Subir nova imagem</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  ref={(el) => {
                    fileInputs.current[key] = el;
                  }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      uploadAsset(key, e.target.files[0]);
                    }
                  }}
                  disabled={isSaving}
                  className="cursor-pointer"
                />
                {isSaving && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Tabs defaultValue="images" className="w-full">
        <TabsList className="mb-2 grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="images" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            Imagens
          </TabsTrigger>
          <TabsTrigger value="copy" className="gap-2">
            <Type className="h-4 w-4" />
            Textos da página
          </TabsTrigger>
        </TabsList>

        <TabsContent value="images" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                Imagens da Landing Page (Login)
              </CardTitle>
              <CardDescription>Gerencie as imagens que aparecem na página de entrada do sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <h3 className="border-b pb-2 text-lg font-semibold">Seção Principal (Hero)</h3>
                {renderUploadField(
                  'hero_print',
                  'Print do NeuroDesigner',
                  'Imagem que aparece no topo da página, ao lado dos benefícios. Recomendado: formato paisagem (16:9) ou 4:3.'
                )}
              </div>

              <div className="space-y-4">
                <h3 className="border-b pb-2 text-lg font-semibold">Funcionalidades Detalhadas</h3>
                <p className="text-sm text-muted-foreground">
                  Imagens de fundo para os cards de funcionalidades. Recomendado: formato paisagem ou quadrado escuro.
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {renderUploadField('feature_1', 'Fundo: NeuroDesigner', '')}
                  {renderUploadField('feature_2', 'Fundo: Agentes Especialistas', '')}
                  {renderUploadField('feature_3', 'Fundo: Performance e Tráfego', '')}
                  {renderUploadField('feature_4', 'Fundo: Gestão de Clientes', '')}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="border-b pb-2 text-lg font-semibold">Galeria de Artes Geradas</h3>
                <p className="text-sm text-muted-foreground">
                  Adicione até 8 imagens para mostrar exemplos de artes criadas com o sistema. Recomendado: formato
                  quadrado (1:1).
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) =>
                    renderUploadField(`gallery_${i}`, `Imagem da Galeria ${i}`, '')
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="copy" className="mt-0">
          <LandingCopyEditor />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
