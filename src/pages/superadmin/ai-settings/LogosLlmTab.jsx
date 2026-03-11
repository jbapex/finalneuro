import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const BUCKET = 'llm_logos';
const PROVIDERS = ['OpenAI', 'Gemini', 'Claude', 'Grok', 'Groq', 'Mistral', 'OpenRouter'];

export default function LogosLlmTab() {
  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [urlInputs, setUrlInputs] = useState({});
  const fileInputRefs = useRef({});

  const fetchLogos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('llm_logos').select('provider, logo_url');
    if (!error && data && data.length > 0) {
      setLogos(data);
      const next = {};
      data.forEach((l) => { next[l.provider] = l.logo_url || ''; });
      setUrlInputs((prev) => ({ ...prev, ...next }));
      setLoading(false);
      return;
    }
    // Fallback: tabela 404 ou inexistente — listar bucket storage
    const { data: listData, error: listError } = await supabase.storage.from(BUCKET).list('', { limit: 50 });
    if (!listError && listData?.length) {
      const items = listData
        .filter((f) => f.name && f.name !== '.emptyFolderPlaceholder')
        .map((f) => {
          const provider = f.name.replace(/\.[^.]+$/, '');
          const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(f.name);
          return { provider, logo_url: publicUrl };
        });
      setLogos(items);
      const next = {};
      items.forEach((l) => { next[l.provider] = l.logo_url || ''; });
      setUrlInputs((prev) => ({ ...prev, ...next }));
    } else {
      setLogos([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogos();
  }, [fetchLogos]);

  const getLogoUrl = (provider) => {
    const row = logos.find((l) => l.provider === provider);
    return row?.logo_url || null;
  };

  const handleFileChange = async (provider, file) => {
    if (!file?.type?.startsWith('image/')) {
      toast({ title: 'Use uma imagem (PNG, JPG, WebP ou GIF).', variant: 'destructive' });
      return;
    }
    setSaving(provider);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/jpeg/, 'jpg');
      const path = `${provider.replace(/\s+/g, '_')}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: upsertError } = await supabase.from('llm_logos').upsert(
        { provider, logo_url: publicUrl, updated_at: new Date().toISOString() },
        { onConflict: 'provider' }
      );
      if (!upsertError) {
        toast({ title: `Logo ${provider} atualizada.` });
        await fetchLogos();
      } else {
        // Tabela 404: atualizar estado local para exibir a logo enviada ao storage
        setLogos((prev) => [...prev.filter((l) => l.provider !== provider), { provider, logo_url: publicUrl }]);
        setUrlInputs((prev) => ({ ...prev, [provider]: publicUrl }));
        toast({ title: `Logo ${provider} enviada (armazenamento).` });
      }
    } catch (err) {
      toast({ title: 'Erro ao salvar logo', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(null);
      if (fileInputRefs.current[provider]) fileInputRefs.current[provider].value = '';
    }
  };

  const handleUrlSave = async (provider, url) => {
    const trimmed = (url || '').trim();
    if (!trimmed) {
      toast({ title: 'Informe uma URL válida.', variant: 'destructive' });
      return;
    }
    setSaving(provider);
    try {
      const { error } = await supabase.from('llm_logos').upsert(
        { provider, logo_url: trimmed, updated_at: new Date().toISOString() },
        { onConflict: 'provider' }
      );
      if (!error) {
        toast({ title: `Logo ${provider} atualizada.` });
        await fetchLogos();
      } else {
        setLogos((prev) => [...prev.filter((l) => l.provider !== provider), { provider, logo_url: trimmed }]);
        setUrlInputs((prev) => ({ ...prev, [provider]: trimmed }));
        toast({ title: `URL ${provider} salva localmente (tabela indisponível).` });
      }
    } catch (err) {
      toast({ title: 'Erro ao salvar logo', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
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
            <ImageIcon className="h-5 w-5" />
            Logos por provedor
          </CardTitle>
          <CardDescription>
            Defina uma logo para cada provedor de IA. Elas aparecem no seletor de modelo do Chat IA (ex.: GPT, Gemini, Grok, Claude).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {PROVIDERS.map((provider) => {
            const logoUrl = getLogoUrl(provider);
            const isSaving = saving === provider;
            return (
              <div
                key={provider}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt={provider} className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <span className="font-medium">{provider}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <input
                    ref={(el) => { fileInputRefs.current[provider] = el; }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target?.files?.[0];
                      if (f) handleFileChange(provider, f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => fileInputRefs.current[provider]?.click()}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                    Enviar imagem
                  </Button>
                  <span className="text-muted-foreground text-sm">ou</span>
                  <div className="flex gap-2 flex-1 min-w-[200px]">
                    <Input
                      placeholder="URL da logo"
                      value={urlInputs[provider] ?? logoUrl ?? ''}
                      onChange={(e) => setUrlInputs((p) => ({ ...p, [provider]: e.target.value }))}
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUrlSave(provider, e.target.value);
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSaving}
                      onClick={() => handleUrlSave(provider, urlInputs[provider] ?? logoUrl ?? '')}
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar URL'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}
