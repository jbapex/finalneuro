import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Upload, Loader2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { fetchSystemBranding } from '@/lib/systemBranding';
import LogoCropDialog from '@/components/superadmin/branding/LogoCropDialog';
import { Input } from '@/components/ui/input';
import { normalizeMetaPixelId } from '@/lib/metaPixel';
import { normalizeTikTokPixelId } from '@/lib/tiktokPixel';

const BUCKET = 'system_branding';
const BRANDING_ID = 'neuro_apice';

export default function BrandingSettings() {
  const [lightLogoUrl, setLightLogoUrl] = useState('');
  const [darkLogoUrl, setDarkLogoUrl] = useState('');
  const [iconLogoUrl, setIconLogoUrl] = useState('');
  const [iconLightLogoUrl, setIconLightLogoUrl] = useState('');
  const [iconDarkLogoUrl, setIconDarkLogoUrl] = useState('');
  const [metaPixelId, setMetaPixelId] = useState('');
  const [tiktokPixelId, setTiktokPixelId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [savingPixel, setSavingPixel] = useState(false);
  const [savingTikTokPixel, setSavingTikTokPixel] = useState(false);

  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [pendingVariant, setPendingVariant] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);

  const lightInputRef = useRef(null);
  const darkInputRef = useRef(null);
  const iconInputRef = useRef(null);
  const iconLightInputRef = useRef(null);
  const iconDarkInputRef = useRef(null);

  const fetchBranding = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchSystemBranding();
      setLightLogoUrl(result.lightLogoUrl || '');
      setDarkLogoUrl(result.darkLogoUrl || '');
      setIconLogoUrl(result.iconLogoUrl || '');
      setIconLightLogoUrl(result.iconLightLogoUrl || '');
      setIconDarkLogoUrl(result.iconDarkLogoUrl || '');
      setMetaPixelId(result.metaPixelId || '');
      setTiktokPixelId(result.tiktokPixelId || '');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const uploadLogo = async (variant, file) => {
    if (!file?.type?.startsWith('image/')) {
      toast({ title: 'Envie uma imagem (PNG, JPG, WebP ou GIF).', variant: 'destructive' });
      return;
    }
    setSaving(variant);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/jpeg/, 'jpg');
      const path = `${BRANDING_ID}_${variant}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(path);

      // Adiciona um parâmetro de versão para forçar o navegador a buscar a nova imagem
      const versionedUrl = `${publicUrl}?v=${Date.now()}`;

      let payload;
      if (variant === 'light') {
        payload = { id: BRANDING_ID, light_logo_url: versionedUrl, updated_at: new Date().toISOString() };
      } else if (variant === 'dark') {
        payload = { id: BRANDING_ID, dark_logo_url: versionedUrl, updated_at: new Date().toISOString() };
      } else if (variant === 'icon_light') {
        payload = { id: BRANDING_ID, icon_light_logo_url: versionedUrl, updated_at: new Date().toISOString() };
      } else if (variant === 'icon_dark') {
        payload = { id: BRANDING_ID, icon_dark_logo_url: versionedUrl, updated_at: new Date().toISOString() };
      } else {
        payload = { id: BRANDING_ID, icon_logo_url: versionedUrl, updated_at: new Date().toISOString() };
      }

      const { error: upsertError } = await supabase
        .from('system_branding')
        .upsert(payload, { onConflict: 'id' });

      if (upsertError) {
        // fallback: apenas atualiza estado local, caso a tabela ainda não esteja disponível
        console.warn('[BrandingSettings] erro ao salvar em system_branding, usando apenas storage:', upsertError);
      }

      if (variant === 'light') {
        setLightLogoUrl(versionedUrl);
      } else if (variant === 'dark') {
        setDarkLogoUrl(versionedUrl);
      } else if (variant === 'icon_light') {
        setIconLightLogoUrl(versionedUrl);
      } else if (variant === 'icon_dark') {
        setIconDarkLogoUrl(versionedUrl);
      } else {
        setIconLogoUrl(versionedUrl);
      }

      const label =
        variant === 'light'
          ? 'modo claro'
          : variant === 'dark'
          ? 'modo escuro'
          : variant === 'icon_light'
          ? 'ícone claro'
          : variant === 'icon_dark'
          ? 'ícone escuro'
          : 'ícone';

      toast({ title: `Logo ${label} atualizada.` });
    } catch (err) {
      toast({
        title: 'Erro ao salvar logo do sistema',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
      if (lightInputRef.current && variant === 'light') lightInputRef.current.value = '';
      if (darkInputRef.current && variant === 'dark') darkInputRef.current.value = '';
      if (iconInputRef.current && variant === 'icon') iconInputRef.current.value = '';
      if (iconLightInputRef.current && variant === 'icon_light') iconLightInputRef.current.value = '';
      if (iconDarkInputRef.current && variant === 'icon_dark') iconDarkInputRef.current.value = '';
    }
  };

  const removeLogo = async (variant) => {
    setSaving(variant);
    try {
      let payload;
      if (variant === 'light') {
        payload = { id: BRANDING_ID, light_logo_url: null, updated_at: new Date().toISOString() };
      } else if (variant === 'dark') {
        payload = { id: BRANDING_ID, dark_logo_url: null, updated_at: new Date().toISOString() };
      } else if (variant === 'icon_light') {
        payload = { id: BRANDING_ID, icon_light_logo_url: null, updated_at: new Date().toISOString() };
      } else if (variant === 'icon_dark') {
        payload = { id: BRANDING_ID, icon_dark_logo_url: null, updated_at: new Date().toISOString() };
      } else {
        payload = { id: BRANDING_ID, icon_logo_url: null, updated_at: new Date().toISOString() };
      }

      const { error } = await supabase
        .from('system_branding')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        throw error;
      }

      if (variant === 'light') {
        setLightLogoUrl('');
      } else if (variant === 'dark') {
        setDarkLogoUrl('');
      } else if (variant === 'icon_light') {
        setIconLightLogoUrl('');
      } else if (variant === 'icon_dark') {
        setIconDarkLogoUrl('');
      } else {
        setIconLogoUrl('');
      }

      const label =
        variant === 'light'
          ? 'modo claro'
          : variant === 'dark'
          ? 'modo escuro'
          : variant === 'icon_light'
          ? 'ícone claro'
          : variant === 'icon_dark'
          ? 'ícone escuro'
          : 'ícone';

      toast({
        title: `Logo ${label} removida.`,
      });
    } catch (err) {
      toast({
        title: 'Erro ao remover logo do sistema',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const saveMetaPixel = async () => {
    const normalized = normalizeMetaPixelId(metaPixelId);
    setSavingPixel(true);
    try {
      const { error } = await supabase
        .from('system_branding')
        .upsert(
          {
            id: BRANDING_ID,
            meta_pixel_id: normalized || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (error) throw error;
      setMetaPixelId(normalized);
      toast({
        title: 'Pixel Meta atualizado',
        description: normalized
          ? 'O ID foi guardado. Novas visitas já enviam eventos para a Meta.'
          : 'Pixel removido da base. Pode usar só VITE_META_PIXEL_ID no servidor, se configurado.',
      });
    } catch (err) {
      toast({
        title: 'Erro ao guardar Pixel',
        description: err?.message || 'Verifique permissões e se a migração meta_pixel foi aplicada.',
        variant: 'destructive',
      });
    } finally {
      setSavingPixel(false);
    }
  };

  const saveTikTokPixel = async () => {
    const normalized = normalizeTikTokPixelId(tiktokPixelId);
    setSavingTikTokPixel(true);
    try {
      const { error } = await supabase
        .from('system_branding')
        .upsert(
          {
            id: BRANDING_ID,
            tiktok_pixel_id: normalized || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (error) throw error;
      setTiktokPixelId(normalized);
      toast({
        title: 'Pixel TikTok atualizado',
        description: normalized
          ? 'O ID foi guardado. Novas visitas já enviam PageView ao TikTok.'
          : 'Pixel removido da base. Pode usar só VITE_TIKTOK_PIXEL_ID no build, se configurado.',
      });
    } catch (err) {
      toast({
        title: 'Erro ao guardar Pixel TikTok',
        description: err?.message || 'Verifique permissões e se a migração tiktok_pixel foi aplicada.',
        variant: 'destructive',
      });
    } finally {
      setSavingTikTokPixel(false);
    }
  };

  const handleOpenCrop = (variant, file) => {
    setPendingVariant(variant);
    setPendingFile(file);
    setCropDialogOpen(true);
  };

  const handleCropDialogClose = () => {
    if (saving) return;
    setCropDialogOpen(false);
    setPendingFile(null);
    setPendingVariant(null);
  };

  const handleCropped = async (croppedFile) => {
    if (!pendingVariant || !croppedFile) {
      handleCropDialogClose();
      return;
    }
    await uploadLogo(pendingVariant, croppedFile);
    handleCropDialogClose();
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
            Logo do sistema Neuro Ápice
          </CardTitle>
          <CardDescription>
            Defina a logo oficial do sistema para modo claro e escuro. Ao enviar a imagem, você poderá recortar em formato
            de faixa horizontal (como no topo do menu). Essa logo será usada no login e nos menus laterais (usuário e Super
            Admin), respeitando o tema atual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <span>Logo modo claro</span>
              </Label>
              <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
                <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {lightLogoUrl ? (
                    <img src={lightLogoUrl} alt="Logo modo claro" className="h-full w-full object-contain" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={lightInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target?.files?.[0];
                      if (f) handleOpenCrop('light', f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving === 'light'}
                    onClick={() => lightInputRef.current?.click()}
                  >
                    {saving === 'light' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-1" />
                        Enviar imagem
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Recomendações: fundo transparente, largura mínima 240px, formato PNG/WebP.
                  </p>
                  {lightLogoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start text-xs text-red-500 hover:text-red-600"
                      disabled={saving === 'light'}
                      onClick={() => removeLogo('light')}
                    >
                      Remover logo
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <span>Logo modo escuro</span>
              </Label>
              <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
                <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {darkLogoUrl ? (
                    <img src={darkLogoUrl} alt="Logo modo escuro" className="h-full w-full object-contain" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={darkInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target?.files?.[0];
                      if (f) handleOpenCrop('dark', f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving === 'dark'}
                    onClick={() => darkInputRef.current?.click()}
                  >
                    {saving === 'dark' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-1" />
                        Enviar imagem
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Use a versão pensada para fundo escuro (por exemplo, logo clara/branca).
                  </p>
                  {darkLogoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start text-xs text-red-500 hover:text-red-600"
                      disabled={saving === 'dark'}
                      onClick={() => removeLogo('dark')}
                    >
                      Remover logo
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 pt-4 border-t border-border/60 mt-2">
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <span>Logo ícone claro (sidebar recolhida)</span>
              </Label>
              <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {iconLightLogoUrl ? (
                    <img src={iconLightLogoUrl} alt="Logo ícone claro" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={iconLightInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target?.files?.[0];
                      if (f) uploadLogo('icon_light', f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving === 'icon_light'}
                    onClick={() => iconLightInputRef.current?.click()}
                  >
                    {saving === 'icon_light' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-1" />
                        Enviar ícone claro
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Formato quadrado (1:1), apenas o símbolo para tema claro.
                  </p>
                  {iconLightLogoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start text-xs text-red-500 hover:text-red-600"
                      disabled={saving === 'icon_light'}
                      onClick={() => removeLogo('icon_light')}
                    >
                      Remover ícone
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <span>Logo ícone escuro (sidebar recolhida)</span>
              </Label>
              <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {iconDarkLogoUrl ? (
                    <img src={iconDarkLogoUrl} alt="Logo ícone escuro" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={iconDarkInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target?.files?.[0];
                      if (f) uploadLogo('icon_dark', f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving === 'icon_dark'}
                    onClick={() => iconDarkInputRef.current?.click()}
                  >
                    {saving === 'icon_dark' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-1" />
                        Enviar ícone escuro
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Formato quadrado (1:1), apenas o símbolo para tema escuro.
                  </p>
                  {iconDarkLogoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start text-xs text-red-500 hover:text-red-600"
                      disabled={saving === 'icon_dark'}
                      onClick={() => removeLogo('icon_dark')}
                    >
                      Remover ícone
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Dica: você pode usar a mesma imagem para claro/escuro se a logo for neutra. O sistema sempre tentará usar a
            versão escura quando o tema estiver em modo escuro.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Meta Pixel (Facebook)
          </CardTitle>
          <CardDescription>
            ID numérico do pixel (Gerenciador de Eventos da Meta). Aplica-se a <strong>toda</strong> a aplicação: landing{' '}
            <code className="rounded bg-muted px-1">/fundador</code>, login e área logada. Cada mudança de página envia{' '}
            <code className="rounded bg-muted px-1">PageView</code>. Se deixar vazio aqui, pode definir fallback no ambiente com{' '}
            <code className="rounded bg-muted px-1">VITE_META_PIXEL_ID</code> no build.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meta-pixel-id">ID do Pixel</Label>
            <Input
              id="meta-pixel-id"
              placeholder="Ex.: 123456789012345"
              value={metaPixelId}
              onChange={(e) => setMetaPixelId(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Cole só os números do ID. Caracteres não numéricos são ignorados ao guardar.
            </p>
          </div>
          <Button type="button" onClick={saveMetaPixel} disabled={savingPixel}>
            {savingPixel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar Pixel Meta
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            TikTok Pixel
          </CardTitle>
          <CardDescription>
            ID do pixel no TikTok Ads (Gestor de Eventos). Mesmo alcance que o Meta: landing{' '}
            <code className="rounded bg-muted px-1">/fundador</code>, login e área logada —{' '}
            <code className="rounded bg-muted px-1">PageView</code> em cada rota (SPA). Vazio aqui: use{' '}
            <code className="rounded bg-muted px-1">VITE_TIKTOK_PIXEL_ID</code> no build.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tiktok-pixel-id">ID do Pixel TikTok</Label>
            <Input
              id="tiktok-pixel-id"
              placeholder="Cole o Pixel ID do TikTok Events Manager"
              value={tiktokPixelId}
              onChange={(e) => setTiktokPixelId(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Apenas letras, números, <code className="text-xs">_</code> e <code className="text-xs">-</code> (8–64
              caracteres). Valores inválidos são limpos ao guardar.
            </p>
          </div>
          <Button type="button" onClick={saveTikTokPixel} disabled={savingTikTokPixel}>
            {savingTikTokPixel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar Pixel TikTok
          </Button>
        </CardContent>
      </Card>

      <LogoCropDialog
        open={cropDialogOpen && !!pendingFile}
        onClose={handleCropDialogClose}
        file={pendingFile}
        variant={pendingVariant || 'light'}
        onCropped={handleCropped}
      />
    </motion.div>
  );
}
