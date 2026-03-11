import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Upload, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useLandingAssets } from '@/lib/landingAssets';

const BUCKET = 'system_branding';
const FOLDER = 'landing';

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

      // Remove arquivos antigos com o mesmo prefixo (ex: se tinha hero_print.jpg e agora é hero_print.png)
      const { data: existingFiles } = await supabase.storage.from(BUCKET).list(FOLDER);
      if (existingFiles) {
        const toRemove = existingFiles
          .filter(f => f.name.startsWith(`${key}.`))
          .map(f => `${FOLDER}/${f.name}`);
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
          .filter(f => f.name.startsWith(`${key}.`))
          .map(f => `${FOLDER}/${f.name}`);
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
      <div className="space-y-4 p-4 border border-border rounded-xl bg-card/50">
        <div>
          <Label className="text-base font-semibold">{label}</Label>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-full sm:w-64 aspect-video rounded-lg border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden relative group">
            {currentUrl ? (
              <>
                <img src={currentUrl} alt={label} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeAsset(key)}
                    disabled={isSaving}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Remover
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center p-4">
                <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <span className="text-xs text-muted-foreground">Nenhuma imagem</span>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4 w-full">
            <div className="space-y-2">
              <Label>Subir nova imagem</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  ref={el => fileInputs.current[key] = el}
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      uploadAsset(key, e.target.files[0]);
                    }
                  }}
                  disabled={isSaving}
                  className="cursor-pointer"
                />
                {isSaving && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            Imagens da Landing Page (Login)
          </CardTitle>
          <CardDescription>
            Gerencie as imagens que aparecem na página de entrada do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Seção Principal (Hero)</h3>
            {renderUploadField(
              'hero_print',
              'Print do NeuroDesigner',
              'Imagem que aparece no topo da página, ao lado dos benefícios. Recomendado: formato paisagem (16:9) ou 4:3.'
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Funcionalidades Detalhadas</h3>
            <p className="text-sm text-muted-foreground">
              Imagens de fundo para os cards de funcionalidades. Recomendado: formato paisagem ou quadrado escuro.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderUploadField('feature_1', 'Fundo: NeuroDesigner', '')}
              {renderUploadField('feature_2', 'Fundo: Agentes Especialistas', '')}
              {renderUploadField('feature_3', 'Fundo: Performance e Tráfego', '')}
              {renderUploadField('feature_4', 'Fundo: Gestão de Clientes', '')}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Galeria de Artes Geradas</h3>
            <p className="text-sm text-muted-foreground">
              Adicione até 8 imagens para mostrar exemplos de artes criadas com o sistema. Recomendado: formato quadrado (1:1).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => 
                renderUploadField(`gallery_${i}`, `Imagem da Galeria ${i}`, '')
              )}
            </div>
          </div>

        </CardContent>
      </Card>
    </motion.div>
  );
}
