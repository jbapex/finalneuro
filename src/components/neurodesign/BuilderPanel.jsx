import React, { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { uploadNeuroDesignFile } from '@/lib/neurodesignStorage';
import { ZoneGrid } from '@/components/neurodesign/ZoneGrid';
import { Sparkles, Copy, Upload, X } from 'lucide-react';

const DIMENSIONS = [
  { value: '1:1', label: '1:1 Feed' },
  { value: '4:5', label: '4:5 Feed' },
  { value: '9:16', label: '9:16 Stories' },
  { value: '16:9', label: '16:9 Horizontal' },
];
const LAYOUT_POSITIONS = [
  { value: 'esquerda', label: 'Esquerda' },
  { value: 'centro', label: 'Centro' },
  { value: 'direita', label: 'Direita' },
];
const SHOT_TYPES = [
  { value: 'close-up', label: 'Close-up' },
  { value: 'medio busto', label: 'Médio busto' },
  { value: 'americano', label: 'Americano' },
];
const STYLE_TAGS = ['clássico', 'formal', 'elegante', 'institucional', 'tecnológico', 'minimalista', 'criativo'];

const VALUE_SAME_AS_BLOCK = '__block__';
const VALUE_FONT_SYSTEM = '__default__';

const TEXT_FONTS = [
  { value: VALUE_FONT_SYSTEM, label: 'Sistema decide' },
  { value: 'sans', label: 'Sans serifa' },
  { value: 'serif', label: 'Serifa' },
  { value: 'bold', label: 'Negrito' },
  { value: 'modern', label: 'Moderno' },
];

const TEXT_SHAPE_STYLES = [
  { value: 'rounded_rectangle', label: 'Retângulo arredondado' },
  { value: 'banner', label: 'Faixa/banner' },
  { value: 'pill', label: 'Pill/cápsula' },
];

function hexToColorInput(hex) {
  if (!hex || typeof hex !== 'string') return '#808080';
  const s = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(s)) return '#' + s.toLowerCase();
  if (/^[0-9a-fA-F]{3}$/.test(s)) return '#' + s.toLowerCase().split('').map((c) => c + c).join('');
  return '#808080';
}

function normalizeHexInput(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  const s = raw.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(s)) return '#' + s.toLowerCase();
  if (/^[0-9a-fA-F]{3}$/.test(s)) return '#' + s.toLowerCase().split('').map((c) => c + c).join('');
  return raw;
}

import { neuroDesignDefaultConfig } from '@/lib/neurodesign/defaultConfig';

const defaultConfig = neuroDesignDefaultConfig;

const BuilderPanel = ({ project, config, setConfig, imageConnections, onGenerate, isGenerating, onFillFromPrompt, hasLlmConnection, isFillingFromPrompt }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [localConfig, setLocalConfig] = useState(config || defaultConfig());
  const [fillPromptInput, setFillPromptInput] = useState('');
  const [isUploadingStyleRefs, setIsUploadingStyleRefs] = useState(false);
  const styleRefsInputRef = useRef(null);

  React.useEffect(() => {
    const next = config || defaultConfig();
    const refUrls = next.style_reference_urls || [];
    const refInstr = next.style_reference_instructions || [];
    if (refUrls.length > 0 && refInstr.length === 0 && next.style_reference_instruction) {
      next.style_reference_instructions = [next.style_reference_instruction];
      next.style_reference_instruction = '';
    }
    setLocalConfig(next);
  }, [config]);

  const update = (key, value) => {
    const next = { ...localConfig, [key]: value };
    setLocalConfig(next);
    setConfig?.(next);
  };

  const handleUpload = useCallback(
    async (type, fileList) => {
      if (!project?.id || !user) {
        toast({
          title: 'Não foi possível enviar a imagem',
          description: 'Selecione um projeto primeiro e faça login.',
          variant: 'destructive',
        });
        return;
      }
      const files = Array.from(fileList || []);
      if (files.length === 0) return;
      if (type === 'logo') {
        const file = files[0];
        try {
          const url = await uploadNeuroDesignFile(user.id, project.id, 'logo', file);
          update('logo_url', url);
        } catch (e) {
          toast({ title: 'Erro no upload', description: e.message, variant: 'destructive' });
        }
        return;
      }
      const key = type === 'subject' ? 'subject_image_urls' : type === 'scenario' ? 'scenario_photo_urls' : 'style_reference_urls';
      const urls = [...(localConfig[key] || [])];
      const prevLen = urls.length;
      if (type === 'style_refs') setIsUploadingStyleRefs(true);
      try {
        for (const file of files) {
          try {
            const url = await uploadNeuroDesignFile(user.id, project.id, type === 'subject' ? 'subject' : type === 'scenario' ? 'scenario' : 'style_refs', file);
            urls.push(url);
          } catch (e) {
            toast({ title: 'Erro no upload', description: e.message, variant: 'destructive' });
          }
        }
        if (type === 'style_refs') {
          const instructions = [...(localConfig.style_reference_instructions || [])];
          for (let n = 0; n < urls.length - prevLen; n++) instructions.push('');
          const nextConfig = { ...localConfig, style_reference_urls: urls, style_reference_instructions: instructions };
          setLocalConfig(nextConfig);
          setConfig?.(nextConfig);
          if (urls.length > prevLen) {
            toast({ title: 'Referência de estilo adicionada', description: `${urls.length - prevLen} imagem(ns) enviada(s).` });
          }
        } else {
          update(key, urls);
        }
      } finally {
        if (type === 'style_refs') {
          setIsUploadingStyleRefs(false);
          if (styleRefsInputRef.current) styleRefsInputRef.current.value = '';
        }
      }
    },
    [project, user, localConfig, toast]
  );

  const removeImage = (key, index) => {
    const arr = [...(localConfig[key] || [])];
    arr.splice(index, 1);
    if (key === 'style_reference_urls') {
      const instructions = [...(localConfig.style_reference_instructions || [])];
      instructions.splice(index, 1);
      const nextConfig = { ...localConfig, style_reference_urls: arr, style_reference_instructions: instructions };
      setLocalConfig(nextConfig);
      setConfig?.(nextConfig);
    } else {
      update(key, arr);
    }
  };

  const toggleStyleTag = (tag) => {
    const tags = localConfig.visual_attributes?.style_tags || [];
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    update('visual_attributes', { ...localConfig.visual_attributes, style_tags: next });
  };

  if (!project) {
    return (
      <div className="p-6 text-muted-foreground text-sm">
        Selecione ou crie uma galeria na barra lateral para configurar o builder.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {typeof onFillFromPrompt === 'function' && (
        <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-2">
          <Label className="text-sm font-medium">Preencher com IA</Label>
          <p className="text-xs text-muted-foreground">Cole um prompt ou brief de outra IA e preencha os campos abaixo automaticamente.</p>
          <Textarea
            placeholder="Cole aqui o prompt ou descrição da arte que deseja criar..."
            value={fillPromptInput}
            onChange={(e) => setFillPromptInput(e.target.value)}
            className="min-h-[80px] bg-muted border-border text-foreground placeholder:text-muted-foreground text-sm resize-none"
            disabled={isFillingFromPrompt}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={!hasLlmConnection || isFillingFromPrompt}
            onClick={async () => {
              await onFillFromPrompt(fillPromptInput);
              setFillPromptInput('');
            }}
          >
            {isFillingFromPrompt ? 'Preenchendo…' : 'Preencher campos'}
          </Button>
          {!hasLlmConnection && (
            <p className="text-xs text-amber-500">Configure uma conexão de modelo de linguagem em Minha IA para usar esta função.</p>
          )}
        </div>
      )}
      <div>
        <Label className="text-muted-foreground">Conexão de imagem</Label>
        <Select
          value={localConfig.user_ai_connection_id || 'none'}
          onValueChange={(v) => update('user_ai_connection_id', v === 'none' ? null : v)}
        >
          <SelectTrigger className="mt-1 bg-muted border-border text-foreground placeholder:text-muted-foreground">
            <SelectValue placeholder="Selecione uma conexão" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border">
            <SelectItem value="none">Usar mock (sem conexão)</SelectItem>
            {imageConnections.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name} ({c.provider})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(localConfig.user_ai_connection_id === null || localConfig.user_ai_connection_id === undefined || localConfig.user_ai_connection_id === 'none') && (
          <p className="text-xs text-muted-foreground mt-1">
            Modo demonstração: a geração usará uma imagem de exemplo. Selecione uma conexão para gerar imagens reais com IA.
          </p>
        )}
        {imageConnections.length === 0 && (
          <p className="text-xs text-amber-500 mt-1">
            Nenhuma conexão de imagem. <Link to="/settings/ai" className="underline">Configurações → Minha IA</Link>
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label>Sujeito principal</Label>
          <Switch checked={localConfig.subject_enabled !== false && localConfig.subject_enabled !== 'false'} onCheckedChange={(v) => update('subject_enabled', v)} />
        </div>
        {localConfig.subject_enabled !== false && localConfig.subject_enabled !== 'false' ? (
          <>
            <div className="mt-1 flex gap-2 flex-wrap">
              {(localConfig.subject_image_urls || []).map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded overflow-hidden bg-muted">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeImage('subject_image_urls', i); }}
                    className="absolute top-0 right-0 z-10 flex items-center justify-center min-w-[36px] min-h-[36px] bg-foreground/80 hover:bg-foreground text-background rounded-bl cursor-pointer touch-manipulation"
                    aria-label="Remover imagem do sujeito"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <label className="w-16 h-16 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <input type="file" accept="image/*" className="hidden" multiple onChange={(e) => handleUpload('subject', e.target.files)} />
              </label>
            </div>
            <Select value={localConfig.subject_gender || 'feminino'} onValueChange={(v) => update('subject_gender', v)}>
              <SelectTrigger className="mt-2 bg-muted border-border text-foreground placeholder:text-muted-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground">
                <SelectItem value="feminino">Feminino</SelectItem>
                <SelectItem value="masculino">Masculino</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Descrição pose/roupa" value={localConfig.subject_description || ''} onChange={(e) => update('subject_description', e.target.value)} className="mt-2 bg-muted border-border text-foreground placeholder:text-muted-foreground min-h-[60px]" />
          </>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">Imagem sem pessoas.</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label>Quantidade de sujeitos (1-5)</Label>
          <p className="text-xs text-muted-foreground mt-0.5">Nº de pessoas na imagem.</p>
          <Select value={String(localConfig.quantity || 1)} onValueChange={(v) => update('quantity', parseInt(v, 10))}>
            <SelectTrigger className="mt-1 bg-muted border-border text-foreground placeholder:text-muted-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground">
              {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Posição</Label>
          <Select value={localConfig.layout_position || 'centro'} onValueChange={(v) => update('layout_position', v)}>
            <SelectTrigger className="mt-1 bg-muted border-border text-foreground placeholder:text-muted-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground">
              {LAYOUT_POSITIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Dimensões</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {DIMENSIONS.map((d) => (
            <Button key={d.value} type="button" variant={localConfig.dimensions === d.value ? 'default' : 'outline'} size="sm" onClick={() => update('dimensions', d.value)} className={localConfig.dimensions === d.value ? 'bg-primary' : 'border-border'}>
              {d.label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label>Qualidade da imagem</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {[
            { value: '1K', label: '1K (padrão)' },
            { value: '2K', label: '2K' },
            { value: '4K', label: '4K' },
          ].map((q) => (
            <Button key={q.value} type="button" variant={localConfig.image_size === q.value ? 'default' : 'outline'} size="sm" onClick={() => update('image_size', q.value)} className={localConfig.image_size === q.value ? 'bg-primary' : 'border-border'}>
              {q.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">2K e 4K geram imagem em maior resolução; podem consumir mais cota da API. 4K pode não estar disponível em todos os modelos/planos.</p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label>Texto na imagem</Label>
          <Switch checked={!!localConfig.text_enabled} onCheckedChange={(v) => update('text_enabled', v)} />
        </div>
        {localConfig.text_enabled && (
          <div className="mt-2 space-y-4">
            {/* Título */}
            <div className="space-y-2 rounded-md border border-border p-2">
              <Label className="text-xs font-medium">Título</Label>
              <Input placeholder="Título H1" value={localConfig.headline_h1 || ''} onChange={(e) => update('headline_h1', e.target.value)} className="bg-muted border-border text-foreground placeholder:text-muted-foreground" />
              <div>
                <Label className="text-xs">Onde fica o título?</Label>
                <div className="mt-1">
                  <ZoneGrid value={localConfig.headline_zone || ''} onChange={(v) => update('headline_zone', v)} aria-label="Zona do título" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Fonte (opcional)</Label>
                <Select value={(localConfig.headline_font === '' || localConfig.headline_font == null) ? VALUE_FONT_SYSTEM : localConfig.headline_font} onValueChange={(v) => update('headline_font', v === VALUE_FONT_SYSTEM ? '' : v)}>
                  <SelectTrigger className="mt-1 h-8 min-h-10 sm:min-h-0 bg-muted border-border text-foreground text-base sm:text-xs">
                    <SelectValue placeholder="Sistema decide" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground">
                    {TEXT_FONTS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Cor (opcional)</Label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                  <input type="color" value={hexToColorInput(localConfig.headline_color || '#ffffff')} onChange={(e) => update('headline_color', e.target.value)} className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border bg-muted" title="Cor do título" />
                  <Input type="text" placeholder="#hex" value={localConfig.headline_color || ''} onChange={(e) => update('headline_color', normalizeHexInput(e.target.value) || e.target.value)} className="bg-muted border-border text-foreground h-8 flex-1 min-w-0 text-base sm:text-sm" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Shape atrás (opcional)</Label>
                  <Switch checked={!!localConfig.headline_shape_enabled} onCheckedChange={(v) => update('headline_shape_enabled', v)} />
                </div>
                {localConfig.headline_shape_enabled && (
                  <div className="mt-2 space-y-2">
                    <Select value={localConfig.headline_shape_style || 'rounded_rectangle'} onValueChange={(v) => update('headline_shape_style', v)}>
                      <SelectTrigger className="h-8 min-h-10 sm:min-h-0 bg-muted border-border text-foreground text-base sm:text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover text-popover-foreground">
                        {TEXT_SHAPE_STYLES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input type="color" value={hexToColorInput(localConfig.headline_shape_color || '#dc2626')} onChange={(e) => update('headline_shape_color', e.target.value)} className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border bg-muted" title="Cor da shape" />
                      <Input type="text" placeholder="#hex" value={localConfig.headline_shape_color || ''} onChange={(e) => update('headline_shape_color', normalizeHexInput(e.target.value) || e.target.value)} className="bg-muted border-border text-foreground h-8 flex-1 min-w-0 text-base sm:text-sm" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Subtítulo */}
            <div className="space-y-2 rounded-md border border-border p-2">
              <Label className="text-xs font-medium">Subtítulo</Label>
              <Input placeholder="Subtítulo H2" value={localConfig.subheadline_h2 || ''} onChange={(e) => update('subheadline_h2', e.target.value)} className="bg-muted border-border text-foreground placeholder:text-muted-foreground" />
              <div>
                <Label className="text-xs">Onde fica o subtítulo?</Label>
                <div className="mt-1">
                  <ZoneGrid value={localConfig.subheadline_zone || ''} onChange={(v) => update('subheadline_zone', v)} aria-label="Zona do subtítulo" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Fonte (opcional)</Label>
                <Select value={(localConfig.subheadline_font === '' || localConfig.subheadline_font == null) ? VALUE_FONT_SYSTEM : localConfig.subheadline_font} onValueChange={(v) => update('subheadline_font', v === VALUE_FONT_SYSTEM ? '' : v)}>
                  <SelectTrigger className="mt-1 h-8 min-h-10 sm:min-h-0 bg-muted border-border text-foreground text-base sm:text-xs">
                    <SelectValue placeholder="Sistema decide" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground">
                    {TEXT_FONTS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Cor (opcional)</Label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                  <input type="color" value={hexToColorInput(localConfig.subheadline_color || '#ffffff')} onChange={(e) => update('subheadline_color', e.target.value)} className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border bg-muted" title="Cor do subtítulo" />
                  <Input type="text" placeholder="#hex" value={localConfig.subheadline_color || ''} onChange={(e) => update('subheadline_color', normalizeHexInput(e.target.value) || e.target.value)} className="bg-muted border-border text-foreground h-8 flex-1 min-w-0 text-base sm:text-sm" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Shape atrás (opcional)</Label>
                  <Switch checked={!!localConfig.subheadline_shape_enabled} onCheckedChange={(v) => update('subheadline_shape_enabled', v)} />
                </div>
                {localConfig.subheadline_shape_enabled && (
                  <div className="mt-2 space-y-2">
                    <Select value={localConfig.subheadline_shape_style || 'rounded_rectangle'} onValueChange={(v) => update('subheadline_shape_style', v)}>
                      <SelectTrigger className="h-8 min-h-10 sm:min-h-0 bg-muted border-border text-foreground text-base sm:text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover text-popover-foreground">
                        {TEXT_SHAPE_STYLES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input type="color" value={hexToColorInput(localConfig.subheadline_shape_color || '#dc2626')} onChange={(e) => update('subheadline_shape_color', e.target.value)} className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border bg-muted" title="Cor da shape" />
                      <Input type="text" placeholder="#hex" value={localConfig.subheadline_shape_color || ''} onChange={(e) => update('subheadline_shape_color', normalizeHexInput(e.target.value) || e.target.value)} className="bg-muted border-border text-foreground h-8 flex-1 min-w-0 text-base sm:text-sm" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="space-y-2 rounded-md border border-border p-2">
              <Label className="text-xs font-medium">CTA (botão)</Label>
              <Input placeholder="Texto do botão CTA" value={localConfig.cta_button_text || ''} onChange={(e) => update('cta_button_text', e.target.value)} className="bg-muted border-border text-foreground placeholder:text-muted-foreground" />
              <div>
                <Label className="text-xs">Onde fica o CTA?</Label>
                <div className="mt-1">
                  <ZoneGrid value={localConfig.cta_zone || ''} onChange={(v) => update('cta_zone', v)} aria-label="Zona do CTA" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Fonte (opcional)</Label>
                <Select value={(localConfig.cta_font === '' || localConfig.cta_font == null) ? VALUE_FONT_SYSTEM : localConfig.cta_font} onValueChange={(v) => update('cta_font', v === VALUE_FONT_SYSTEM ? '' : v)}>
                  <SelectTrigger className="mt-1 h-8 min-h-10 sm:min-h-0 bg-muted border-border text-foreground text-base sm:text-xs">
                    <SelectValue placeholder="Sistema decide" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground">
                    {TEXT_FONTS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Cor (opcional)</Label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                  <input type="color" value={hexToColorInput(localConfig.cta_color || '#ffffff')} onChange={(e) => update('cta_color', e.target.value)} className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border bg-muted" title="Cor do CTA" />
                  <Input type="text" placeholder="#hex" value={localConfig.cta_color || ''} onChange={(e) => update('cta_color', normalizeHexInput(e.target.value) || e.target.value)} className="bg-muted border-border text-foreground h-8 flex-1 min-w-0 text-base sm:text-sm" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Shape atrás (opcional)</Label>
                  <Switch checked={!!localConfig.cta_shape_enabled} onCheckedChange={(v) => update('cta_shape_enabled', v)} />
                </div>
                {localConfig.cta_shape_enabled && (
                  <div className="mt-2 space-y-2">
                    <Select value={localConfig.cta_shape_style || 'rounded_rectangle'} onValueChange={(v) => update('cta_shape_style', v)}>
                      <SelectTrigger className="h-8 min-h-10 sm:min-h-0 bg-muted border-border text-foreground text-base sm:text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover text-popover-foreground">
                        {TEXT_SHAPE_STYLES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input type="color" value={hexToColorInput(localConfig.cta_shape_color || '#dc2626')} onChange={(e) => update('cta_shape_color', e.target.value)} className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border bg-muted" title="Cor da shape" />
                      <Input type="text" placeholder="#hex" value={localConfig.cta_shape_color || ''} onChange={(e) => update('cta_shape_color', normalizeHexInput(e.target.value) || e.target.value)} className="bg-muted border-border text-foreground h-8 flex-1 min-w-0 text-base sm:text-sm" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={!!localConfig.text_gradient} onCheckedChange={(v) => update('text_gradient', v)} />
              <Label className="text-xs">Gradiente no texto</Label>
            </div>
          </div>
        )}
      </div>

      <div>
        <Label>Logo na arte</Label>
        <p className="text-xs text-muted-foreground mt-1">A logo anexa será incluída na imagem gerada em posição adequada.</p>
        <div className="flex gap-2 flex-wrap items-center mt-2">
          {localConfig.logo_url ? (
            <div className="relative w-14 h-14 rounded overflow-hidden bg-muted shrink-0">
              <img src={localConfig.logo_url} alt="Logo" className="w-full h-full object-contain" />
              <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); update('logo_url', ''); }}
            className="absolute top-0 right-0 z-10 flex items-center justify-center min-w-[36px] min-h-[36px] bg-foreground/80 hover:bg-foreground text-background rounded-bl cursor-pointer touch-manipulation"
            aria-label="Remover logo"
          >
            <X className="h-4 w-4" />
          </button>
            </div>
          ) : null}
          <label className="w-14 h-14 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted shrink-0">
            <Upload className="h-4 w-4" />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload('logo', e.target.files)} />
          </label>
        </div>
      </div>

      <div>
        <Label>Projeto e cenário</Label>
        <Input placeholder="Nicho/projeto (ex: nutricionista high ticket)" value={localConfig.niche_project || ''} onChange={(e) => update('niche_project', e.target.value)} className="mt-1 bg-muted border-border text-foreground placeholder:text-muted-foreground" />
        <Textarea placeholder="Ambiente (ex: cozinha iluminada...)" value={localConfig.environment || ''} onChange={(e) => update('environment', e.target.value)} className="mt-2 bg-muted border-border text-foreground placeholder:text-muted-foreground min-h-[60px]" />
        <div className="flex items-center gap-2 mt-2"><Switch checked={!!localConfig.use_scenario_photos} onCheckedChange={(v) => update('use_scenario_photos', v)} /><Label className="text-xs">Usar fotos de cenário</Label></div>
        {localConfig.use_scenario_photos && (
          <div className="flex gap-2 flex-wrap mt-2">
            {(localConfig.scenario_photo_urls || []).map((url, i) => (
              <div key={i} className="relative w-14 h-14 rounded overflow-hidden bg-muted">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeImage('scenario_photo_urls', i); }}
                className="absolute top-0 right-0 z-10 flex items-center justify-center min-w-[36px] min-h-[36px] bg-foreground/80 hover:bg-foreground text-background rounded-bl cursor-pointer touch-manipulation"
                aria-label="Remover foto de cenário"
              >
                <X className="h-4 w-4" />
              </button>
              </div>
            ))}
            <label className="w-14 h-14 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted">
              <Upload className="h-4 w-4" />
              <input type="file" accept="image/*" className="hidden" multiple onChange={(e) => handleUpload('scenario', e.target.files)} />
            </label>
          </div>
        )}
      </div>

      <div>
        <Label>Cores e iluminação</Label>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs">Ambiente</Label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
              <input
                type="color"
                value={hexToColorInput(localConfig.ambient_color)}
                onChange={(e) => update('ambient_color', e.target.value)}
                className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border bg-muted"
                title="Escolher cor"
              />
              <Input
                type="text"
                placeholder="#hex"
                value={localConfig.ambient_color || ''}
                onChange={(e) => update('ambient_color', normalizeHexInput(e.target.value) || e.target.value)}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-8 flex-1 min-w-0"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Recorte</Label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
              <input
                type="color"
                value={hexToColorInput(localConfig.rim_light_color)}
                onChange={(e) => update('rim_light_color', e.target.value)}
                className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border bg-muted"
                title="Escolher cor"
              />
              <Input
                type="text"
                placeholder="#hex"
                value={localConfig.rim_light_color || ''}
                onChange={(e) => update('rim_light_color', normalizeHexInput(e.target.value) || e.target.value)}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-8 flex-1 min-w-0"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Preenchimento</Label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
              <input
                type="color"
                value={hexToColorInput(localConfig.fill_light_color)}
                onChange={(e) => update('fill_light_color', e.target.value)}
                className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border bg-muted"
                title="Escolher cor"
              />
              <Input
                type="text"
                placeholder="#hex"
                value={localConfig.fill_light_color || ''}
                onChange={(e) => update('fill_light_color', normalizeHexInput(e.target.value) || e.target.value)}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-8 flex-1 min-w-0"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <Label>Composição (tipo de plano)</Label>
        <Select value={localConfig.shot_type || 'medio busto'} onValueChange={(v) => update('shot_type', v)}>
          <SelectTrigger className="mt-1 bg-muted border-border text-foreground placeholder:text-muted-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground">
            {SHOT_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label>Elementos flutuantes</Label>
          <Switch checked={!!localConfig.floating_elements_enabled} onCheckedChange={(v) => update('floating_elements_enabled', v)} />
        </div>
        {localConfig.floating_elements_enabled && (
          <Input placeholder="Ex: shot saudável, frutas e verduras" value={localConfig.floating_elements_text || ''} onChange={(e) => update('floating_elements_text', e.target.value)} className="mt-2 bg-muted border-border text-foreground placeholder:text-muted-foreground" />
        )}
      </div>

      <div>
        <Label>Referências de estilo</Label>
        <p className="text-xs text-muted-foreground mt-1">Envie imagens para a IA usar como referência visual (JPEG, PNG, WebP ou GIF, até 10MB).</p>
        <div className="flex gap-2 flex-wrap mt-2">
          {(localConfig.style_reference_urls || []).map((url, i) => (
            <div key={i} className="relative w-14 h-14 rounded overflow-hidden bg-muted shrink-0">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeImage('style_reference_urls', i); }}
                className="absolute top-0 right-0 z-10 flex items-center justify-center min-w-[36px] min-h-[36px] bg-foreground/80 hover:bg-foreground text-background rounded-bl cursor-pointer touch-manipulation"
                aria-label="Remover referência de estilo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <label className="relative w-14 h-14 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted shrink-0 overflow-hidden">
            <input
              ref={styleRefsInputRef}
              id="neurodesign-style-refs-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              disabled={isUploadingStyleRefs}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => {
                const files = e.target.files;
                if (files?.length) handleUpload('style_refs', files);
              }}
            />
            {isUploadingStyleRefs ? (
              <span className="text-xs">...</span>
            ) : (
              <Upload className="h-4 w-4 pointer-events-none" />
            )}
          </label>
        </div>
        {(localConfig.style_reference_urls || []).map((url, i) => (
          <div key={i} className="mt-3 p-2 rounded bg-muted/50 border border-border">
            <Label className="text-xs text-muted-foreground">Referência {i + 1} – O que copiar desta?</Label>
            <Input
              placeholder="Ex: iluminação e paleta de cores, composição, estética vintage..."
              value={(localConfig.style_reference_instructions || [])[i] ?? ''}
              onChange={(e) => {
                const arr = [...(localConfig.style_reference_instructions || [])];
                while (arr.length <= i) arr.push('');
                arr[i] = e.target.value;
                update('style_reference_instructions', arr);
              }}
              className="mt-1 bg-muted border-border text-foreground placeholder:text-muted-foreground text-base sm:text-sm"
            />
          </div>
        ))}
      </div>

      <div>
        <Label>Sobriedade (criativo ↔ profissional)</Label>
        <Slider value={[localConfig.visual_attributes?.sobriety ?? 50]} onValueChange={([v]) => update('visual_attributes', { ...localConfig.visual_attributes, sobriety: v })} min={0} max={100} className="mt-2" />
        <Label className="text-xs mt-2 block">Tags de estilo</Label>
        <div className="flex flex-wrap gap-1 mt-1">
          {STYLE_TAGS.map((tag) => (
            <Button key={tag} type="button" variant={(localConfig.visual_attributes?.style_tags || []).includes(tag) ? 'default' : 'outline'} size="sm" onClick={() => toggleStyleTag(tag)} className="text-xs h-7 border-border">
              {tag}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 mt-2">
          <div className="flex items-center gap-2"><Switch checked={!!localConfig.visual_attributes?.ultra_realistic} onCheckedChange={(v) => update('visual_attributes', { ...localConfig.visual_attributes, ultra_realistic: v })} /><Label className="text-xs">Ultra realista</Label></div>
          <div className="flex items-center gap-2"><Switch checked={!!localConfig.visual_attributes?.blur_enabled} onCheckedChange={(v) => update('visual_attributes', { ...localConfig.visual_attributes, blur_enabled: v })} /><Label className="text-xs">Blur</Label></div>
          <div className="flex items-center gap-2"><Switch checked={!!localConfig.visual_attributes?.lateral_gradient_enabled} onCheckedChange={(v) => update('visual_attributes', { ...localConfig.visual_attributes, lateral_gradient_enabled: v })} /><Label className="text-xs">Degradê lateral</Label></div>
        </div>
      </div>

      <div>
        <Label>Prompt adicional</Label>
        <Textarea placeholder="Instruções extras para a IA" value={localConfig.additional_prompt || ''} onChange={(e) => update('additional_prompt', e.target.value)} className="mt-1 bg-muted border-border text-foreground placeholder:text-muted-foreground min-h-[80px]" />
      </div>

      <div className="flex gap-2">
        {(() => {
          const hasConnection = localConfig.user_ai_connection_id && localConfig.user_ai_connection_id !== 'none';
          const hasTextFilled = !localConfig.text_enabled || Boolean(
            (localConfig.headline_h1 || '').trim() ||
            (localConfig.subheadline_h2 || '').trim() ||
            (localConfig.cta_button_text || '').trim()
          );
          const disabled = isGenerating || !hasConnection || !hasTextFilled;
          const title = !hasConnection
            ? 'Selecione uma conexão de imagem para gerar'
            : !hasTextFilled
              ? "Com 'Texto na imagem' ativado, preencha pelo menos um campo: Título H1, Subtítulo H2 ou Texto do botão CTA"
              : undefined;
          return (
        <Button
          className="flex-1 bg-primary hover:bg-primary/90"
          onClick={() => onGenerate?.(localConfig)}
          disabled={disabled}
          title={title}
        >
          {isGenerating ? <span className="animate-pulse">Gerando...</span> : <><Sparkles className="h-4 w-4 mr-2" /> Gerar Imagem</>}
        </Button>
          );
        })()}
        <Button variant="outline" size="icon" onClick={() => setConfig?.({ ...localConfig, id: undefined })} title="Duplicar configuração">
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default BuilderPanel;
