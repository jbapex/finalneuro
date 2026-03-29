import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles, Upload, X, Crop, Type, Eraser, ImageMinus, ImageIcon, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { uploadNeuroDesignFile } from '@/lib/neurodesignStorage';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';

const ND_REFINE_ACTION_KEY = 'custom_nd_refine_action';
const ND_REFINE_META_KEY = 'custom_nd_refine_meta';

const REFINE_DIMENSIONS = [
  { value: '1:1', label: '1:1 Feed' },
  { value: '4:5', label: '4:5 Feed' },
  { value: '9:16', label: '9:16 Stories' },
  { value: '16:9', label: '16:9 Horizontal' },
];

const REFINE_IMAGE_SIZES = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
];

const SELECTION_ACTIONS = [
  { value: 'add_text', label: 'Adicionar texto aqui', icon: Type },
  { value: 'remove_text', label: 'Remover texto só nesta área', icon: Eraser },
  { value: 'remove_content', label: 'Remover conteúdo desta área', icon: ImageMinus },
  { value: 'replace', label: 'Substituir por imagem', icon: ImageIcon },
  { value: 'free', label: 'Instrução livre', icon: MessageSquare },
];

const SELECTION_FONT_STYLES = [
  { value: 'none', label: 'Deixar modelo escolher' },
  { value: 'elegante', label: 'Elegante' },
  { value: 'moderno', label: 'Moderno' },
  { value: 'negrito', label: 'Negrito' },
  { value: 'script', label: 'Script / Cursiva' },
  { value: 'minimalista', label: 'Minimalista' },
  { value: 'retro', label: 'Retrô' },
  { value: 'corporate', label: 'Corporativo' },
];

/**
 * Formulário de refino de imagem: preview com seleção de região, ações (add text, remove text, etc.),
 * uploads e opções avançadas. Faz uploads e chama onRefine(payload) com o payload completo para a API.
 * Props: imageUrl, projectId, user { id }, onRefine(payload), disabled?, compact?, hasImageConnection?,
 * imageConnections + refineConnectionSelectValue + onRefineConnectionChange + builderInheritHint = seletor de conexão no refinamento.
 * previewExpiryMeta = { text, isExpired, isSoon } para exibir contador de expiração sobre a imagem principal.
 */
export default function RefineImageForm({
  imageUrl,
  projectId,
  user,
  onRefine,
  disabled = false,
  compact = false,
  hasImageConnection = true,
  imageConnections = [],
  refineConnectionSelectValue,
  onRefineConnectionChange,
  builderInheritHint = '',
  previewExpiryMeta = null,
  renderPreviewActions,
}) {
  const { toast } = useToast();
  const [logosByProvider, setLogosByProvider] = useState({});
  const [refineInstruction, setRefineInstruction] = useState('');
  const [refineDimensions, setRefineDimensions] = useState('1:1');
  const [refineImageSize, setRefineImageSize] = useState('1K');
  const [referenceArtFile, setReferenceArtFile] = useState(null);
  const [referenceArtPreviewUrl, setReferenceArtPreviewUrl] = useState('');
  const [replacementFile, setReplacementFile] = useState(null);
  const [replacementPreviewUrl, setReplacementPreviewUrl] = useState('');
  const [selectionRegion, setSelectionRegion] = useState(null);
  const [selectionAction, setSelectionAction] = useState('free');
  const [selectionText, setSelectionText] = useState('');
  const [selectionFont, setSelectionFont] = useState('');
  const [selectionFontStyle, setSelectionFontStyle] = useState('');
  const [isUploadingRefine, setIsUploadingRefine] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [drawCurrent, setDrawCurrent] = useState(null);
  const previewContainerRef = useRef(null);
  const previewImgRef = useRef(null);
  const instructionInputRef = useRef(null);
  const selectionActionBlockRef = useRef(null);
  const referenceArtInputRef = useRef(null);
  const replacementInputRef = useRef(null);
  const addImageInputRef = useRef(null);
  const [addImageFile, setAddImageFile] = useState(null);
  const [addImagePreviewUrl, setAddImagePreviewUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadLogos = async () => {
      try {
        const { data, error } = await supabase.from('llm_logos').select('provider, logo_url');
        if (!error && data && !cancelled) {
          const map = {};
          data.forEach((row) => {
            if (row?.provider && row?.logo_url) map[row.provider] = row.logo_url;
          });
          setLogosByProvider(map);
        }
      } catch {
        // falha silenciosa
      }
    };
    loadLogos();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const savedAction = localStorage.getItem(ND_REFINE_ACTION_KEY);
      if (savedAction) setSelectionAction(savedAction);
      const savedMeta = localStorage.getItem(ND_REFINE_META_KEY);
      if (savedMeta) {
        const meta = JSON.parse(savedMeta);
        if (meta && typeof meta === 'object') {
          if (meta.text_new) setSelectionText(String(meta.text_new));
          if (meta.text_font) setSelectionFont(String(meta.text_font));
          if (meta.text_style) setSelectionFontStyle(String(meta.text_style));
        }
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(ND_REFINE_ACTION_KEY, String(selectionAction || ''));
    } catch {
      // ignore localStorage errors
    }
  }, [selectionAction]);

  useEffect(() => {
    try {
      const meta = {
        text_new: selectionText || '',
        text_font: selectionFont || '',
        text_style: selectionFontStyle || '',
      };
      localStorage.setItem(ND_REFINE_META_KEY, JSON.stringify(meta));
    } catch {
      // ignore localStorage errors
    }
  }, [selectionText, selectionFont, selectionFontStyle]);

  const clearReferenceArt = () => {
    setReferenceArtFile(null);
    if (referenceArtPreviewUrl) URL.revokeObjectURL(referenceArtPreviewUrl);
    setReferenceArtPreviewUrl('');
  };

  const clearReplacement = () => {
    setReplacementFile(null);
    if (replacementPreviewUrl) URL.revokeObjectURL(replacementPreviewUrl);
    setReplacementPreviewUrl('');
  };

  const clearAddImage = () => {
    setAddImageFile(null);
    if (addImagePreviewUrl) URL.revokeObjectURL(addImagePreviewUrl);
    setAddImagePreviewUrl('');
  };

  const handleAddImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)/i.test(file.type)) {
      toast({ title: 'Use uma imagem (JPEG, PNG, WebP ou GIF)', variant: 'destructive' });
      return;
    }
    clearAddImage();
    setAddImageFile(file);
    setAddImagePreviewUrl(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleReferenceArtChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)/i.test(file.type)) {
      toast({ title: 'Use uma imagem (JPEG, PNG, WebP ou GIF)', variant: 'destructive' });
      return;
    }
    clearReferenceArt();
    setReferenceArtFile(file);
    setReferenceArtPreviewUrl(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleReplacementChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)/i.test(file.type)) {
      toast({ title: 'Use uma imagem (JPEG, PNG, WebP ou GIF)', variant: 'destructive' });
      return;
    }
    clearReplacement();
    setReplacementFile(file);
    setReplacementPreviewUrl(URL.createObjectURL(file));
    e.target.value = '';
  };

  const getNormalizedRegion = useCallback(() => {
    const container = previewContainerRef.current;
    const img = previewImgRef.current;
    if (!container || !img || !drawStart || !drawCurrent) return null;
    const cRect = container.getBoundingClientRect();
    const iRect = img.getBoundingClientRect();
    const imgLeft = iRect.left - cRect.left;
    const imgTop = iRect.top - cRect.top;
    const px1 = Math.max(imgLeft, Math.min(drawStart.x, drawCurrent.x));
    const px2 = Math.min(imgLeft + iRect.width, Math.max(drawStart.x, drawCurrent.x));
    const py1 = Math.max(imgTop, Math.min(drawStart.y, drawCurrent.y));
    const py2 = Math.min(imgTop + iRect.height, Math.max(drawStart.y, drawCurrent.y));
    const w = px2 - px1;
    const h = py2 - py1;
    if (w < 5 || h < 5) return null;
    return {
      x: (px1 - imgLeft) / iRect.width,
      y: (py1 - imgTop) / iRect.height,
      width: w / iRect.width,
      height: h / iRect.height,
    };
  }, [drawStart, drawCurrent]);

  const generateCropBlob = useCallback(async () => {
    const img = previewImgRef.current;
    const region = selectionRegion;
    if (!img || !region || !imageUrl) return null;
    return new Promise((resolve) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => {
        const natW = im.naturalWidth;
        const natH = im.naturalHeight;
        const x = Math.floor(region.x * natW);
        const y = Math.floor(region.y * natH);
        const w = Math.max(1, Math.floor(region.width * natW));
        const h = Math.max(1, Math.floor(region.height * natH));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(im, x, y, w, h, 0, 0, w, h);
        canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
      };
      im.onerror = () => resolve(null);
      im.src = imageUrl;
    });
  }, [imageUrl, selectionRegion]);

  const handleMouseDown = (e) => {
    if (!imageUrl || !previewContainerRef.current || disabled) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDrawing(true);
    setDrawStart({ x, y });
    setDrawCurrent({ x, y });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    setDrawCurrent({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const region = getNormalizedRegion();
    setDrawStart(null);
    setDrawCurrent(null);
    if (region) {
      setSelectionRegion(region);
      requestAnimationFrame(() => {
        selectionActionBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  };

  const clearSelection = () => {
    setSelectionRegion(null);
    setSelectionAction('free');
    setSelectionText('');
    setSelectionFont('');
    setSelectionFontStyle('');
  };

  const hasSelectionActionValid = () => {
    if (!selectionRegion) return false;
    if (selectionAction === 'add_text') return selectionText.trim().length > 0;
    if (selectionAction === 'remove_text' || selectionAction === 'remove_content') return true;
    if (selectionAction === 'replace') return !!replacementFile;
    if (selectionAction === 'free') return refineInstruction.trim().length > 0 || referenceArtFile || replacementFile || addImageFile;
    return false;
  };

  const hasAnyRefineAction = !!(
    (refineDimensions && refineDimensions !== '1:1') ||
    (selectionRegion ? hasSelectionActionValid() : (refineInstruction.trim() || referenceArtFile || replacementFile || addImageFile))
  );

  const handleRefineClick = async () => {
    if (!projectId || !user?.id) {
      toast({ title: 'Projeto e usuário são necessários para refinar', variant: 'destructive' });
      return;
    }
    const instruction = refineInstruction.trim();
    setIsUploadingRefine(true);
    let referenceImageUrl = '';
    let replacementImageUrl = '';
    let addImageUrl = '';
    let regionCropImageUrl = '';
    const region = selectionRegion || undefined;

    try {
      if (referenceArtFile) {
        referenceImageUrl = await uploadNeuroDesignFile(user.id, projectId, 'refine_ref', referenceArtFile);
      }
      if (replacementFile) {
        replacementImageUrl = await uploadNeuroDesignFile(user.id, projectId, 'refine_replacement', replacementFile);
      }
      if (addImageFile) {
        addImageUrl = await uploadNeuroDesignFile(user.id, projectId, 'refine_add', addImageFile);
      }
      if (selectionRegion && imageUrl) {
        const cropBlob = await generateCropBlob();
        if (cropBlob) {
          const cropFile = new File([cropBlob], 'crop.png', { type: 'image/png' });
          regionCropImageUrl = await uploadNeuroDesignFile(user.id, projectId, 'refine_crop', cropFile);
        }
      }

      const payload = {
        instruction,
        configOverrides: { dimensions: refineDimensions, image_size: refineImageSize },
        ...(referenceImageUrl && { referenceImageUrl }),
        ...(replacementImageUrl && { replacementImageUrl }),
        ...(addImageUrl && { addImageUrl }),
        ...(region && { region }),
        ...(regionCropImageUrl && { regionCropImageUrl }),
        ...(region && { selectionAction }),
        ...(region && selectionAction === 'add_text' && selectionText.trim() && { selectionText: selectionText.trim() }),
        ...(region && selectionAction === 'add_text' && selectionFont.trim() && { selectionFont: selectionFont.trim() }),
        ...(region && selectionAction === 'add_text' && selectionFontStyle && selectionFontStyle !== 'none' && { selectionFontStyle }),
      };
      onRefine?.(payload);
      setRefineInstruction('');
      setSelectionText('');
      clearReferenceArt();
      clearReplacement();
      clearAddImage();
      clearSelection();
    } catch (e) {
      const msg = e?.message || String(e);
      const hint = /bucket|storage|policy|row-level|RLS|forbidden|403/i.test(msg)
        ? ' Verifique no Supabase: bucket "neurodesign" existe e as políticas de Storage estão aplicadas.'
        : '';
      toast({
        title: 'Erro ao enviar imagens',
        description: msg + hint,
        variant: 'destructive',
        duration: 8000,
      });
    } finally {
      setIsUploadingRefine(false);
    }
  };

  const drawBox = () => {
    if (!drawStart || !drawCurrent || !previewContainerRef.current) return null;
    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const w = Math.abs(drawCurrent.x - drawStart.x);
    const h = Math.abs(drawCurrent.y - drawStart.y);
    return (
      <div
        className="absolute border-2 border-dashed border-primary bg-primary/10 pointer-events-none"
        style={{ left: x, top: y, width: w, height: h }}
      />
    );
  };

  const selectionBox = () => {
    if (!selectionRegion || !previewContainerRef.current || !previewImgRef.current) return null;
    const cRect = previewContainerRef.current.getBoundingClientRect();
    const iRect = previewImgRef.current.getBoundingClientRect();
    const imgLeft = iRect.left - cRect.left;
    const imgTop = iRect.top - cRect.top;
    return (
      <div
        className="absolute border-2 border-dashed border-primary bg-primary/10 pointer-events-none"
        style={{
          left: imgLeft + selectionRegion.x * iRect.width,
          top: imgTop + selectionRegion.y * iRect.height,
          width: selectionRegion.width * iRect.width,
          height: selectionRegion.height * iRect.height,
        }}
      />
    );
  };

  const isBusy = disabled || isUploadingRefine;
  const previewHeight = compact ? 'max-h-[280px] min-h-[200px]' : 'min-h-[200px] max-h-[40vh]';
  const showConnectionSelector = typeof onRefineConnectionChange === 'function' && refineConnectionSelectValue != null;

  if (!imageUrl) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Nenhuma imagem para refinar.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {showConnectionSelector && (
        <div className="rounded-lg border border-border bg-muted/25 p-2 space-y-1">
          <div>
            <Label className="text-xs font-semibold text-foreground">Conexão (refinamento)</Label>
          </div>
          <Select value={refineConnectionSelectValue} onValueChange={onRefineConnectionChange}>
            <SelectTrigger
              className="h-9 w-full bg-muted border-border text-foreground text-sm"
              aria-label="Conexão de imagem para refinamento"
            >
              <SelectValue placeholder="Selecione uma conexão" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground border-border">
              <SelectItem value="__inherit__">
                <span className="font-medium">Seguir builder</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {builderInheritHint || '—'}
                </span>
              </SelectItem>
              <SelectItem value="none">Usar mock (sem conexão)</SelectItem>
              {imageConnections.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  <div className="flex items-center gap-2">
                    {logosByProvider[c.provider] && (
                      <img src={logosByProvider[c.provider]} alt="" className="h-4 w-4 rounded-sm object-contain" />
                    )}
                    <span>{c.name}</span>
                    {c.provider && <span className="text-xs text-muted-foreground">({c.provider})</span>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {imageConnections.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-500/90">
              Nenhuma conexão de imagem.{' '}
              <Link to="/settings/ai" className="underline font-medium">
                Configurações → Minha IA
              </Link>
            </p>
          )}
        </div>
      )}
      {/* Preview com seleção de região */}
      <div
        className={`relative rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden ${previewHeight}`}
      >
        <div
          ref={previewContainerRef}
          className="relative w-full h-full flex flex-col items-center justify-center p-4 cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={isDrawing ? handleMouseUp : undefined}
        >
          <img
            ref={previewImgRef}
            src={imageUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg select-none pointer-events-none"
            draggable={false}
            style={{ touchAction: 'none' }}
          />
          {isDrawing && drawBox()}
          {!isDrawing && selectionBox()}
          <div className="absolute top-2 right-2 flex gap-2 items-start">
            {renderPreviewActions?.()}
            {selectionRegion && (
              <Button size="sm" variant="outline" onClick={clearSelection} className="border-border">
                <Crop className="h-4 w-4 mr-1" /> Limpar seleção
              </Button>
            )}
          </div>
          {previewExpiryMeta && (
            <div className="absolute bottom-2 left-2 right-2 pointer-events-none flex justify-center z-10">
              <span
                className={cn(
                  'text-xs font-semibold px-2 py-1 rounded-md border shadow-sm max-w-full truncate',
                  previewExpiryMeta.isSoon
                    ? 'bg-red-500/15 text-red-700 border-red-500/35 dark:text-red-300'
                    : 'bg-background/85 text-foreground border-border/60 backdrop-blur-sm'
                )}
                title={previewExpiryMeta.isExpired ? 'Expirado' : `Expira em ~${previewExpiryMeta.text}`}
              >
                {previewExpiryMeta.isExpired ? 'Expirado' : `-${previewExpiryMeta.text}`}
              </span>
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Arraste na imagem para selecionar a região a refinar.</p>

      {/* Área rolável: ações e opções */}
      <div className="flex flex-col gap-4 overflow-y-auto min-h-0">
        {selectionRegion ? (
          <div ref={selectionActionBlockRef} className="space-y-3" role="region" aria-label="Ação na seleção">
            <p className="text-sm font-medium text-foreground">O que fazer nesta seleção?</p>
            <div className="flex flex-wrap gap-2">
              {SELECTION_ACTIONS.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  type="button"
                  variant={selectionAction === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectionAction(value)}
                  className="shrink-0"
                  aria-label={label}
                  aria-pressed={selectionAction === value}
                >
                  <Icon className="h-3.5 w-3.5 mr-1.5" />
                  {label}
                </Button>
              ))}
            </div>
            {selectionAction === 'add_text' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground block">Texto a aparecer na região</label>
                  <input
                    type="text"
                    placeholder="Ex.: PLANNING 2025, slogan…"
                    value={selectionText}
                    onChange={(e) => setSelectionText(e.target.value)}
                    className="w-full rounded-md border border-input bg-muted px-3 py-2 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Texto a inserir na região selecionada"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground block">Fonte (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex.: Montserrat, Inter, Arial"
                    value={selectionFont}
                    onChange={(e) => setSelectionFont(e.target.value)}
                    className="w-full rounded-md border border-input bg-muted px-3 py-2 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Nome da fonte (opcional)"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground block">Estilo da fonte (opcional)</label>
                  <Select value={selectionFontStyle || 'none'} onValueChange={(v) => setSelectionFontStyle(v === 'none' ? '' : v)}>
                    <SelectTrigger className="w-full max-w-[280px] h-9 min-h-10 sm:min-h-0 bg-muted border-border text-foreground text-base sm:text-sm">
                      <SelectValue placeholder="Deixar modelo escolher" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover text-popover-foreground">
                      {SELECTION_FONT_STYLES.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {selectionAction === 'remove_text' && (
              <p className="text-xs text-muted-foreground">O texto visível na área selecionada será removido.</p>
            )}
            {selectionAction === 'remove_content' && (
              <p className="text-xs text-muted-foreground">O conteúdo da área selecionada será removido e preenchido de forma natural.</p>
            )}
            {selectionAction === 'replace' && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Imagem para substituir esta área</label>
                <div className="flex items-center gap-2">
                  {replacementPreviewUrl ? (
                    <div className="relative">
                      <img src={replacementPreviewUrl} alt="Substituir" className="w-14 h-14 rounded object-cover border border-border" />
                      <button type="button" onClick={clearReplacement} className="absolute -top-1 -right-1 bg-foreground/80 text-background rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => replacementInputRef.current?.click()}
                        className="w-14 h-14 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted shrink-0"
                        aria-label="Enviar imagem para substituir"
                      >
                        <Upload className="h-4 w-4" />
                      </button>
                      <input
                        ref={replacementInputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        aria-hidden
                        onChange={handleReplacementChange}
                      />
                    </>
                  )}
                  <span className="text-xs text-muted-foreground">Substitua a área selecionada por esta imagem</span>
                </div>
              </div>
            )}
            {selectionAction === 'free' && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground block">Instrução para a região selecionada</label>
                <Textarea
                  ref={instructionInputRef}
                  placeholder="Descreva o ajuste na região (ex.: escureça, mude a cor…)"
                  value={refineInstruction}
                  onChange={(e) => setRefineInstruction(e.target.value)}
                  className="min-h-[60px] bg-muted border-border text-foreground placeholder:text-muted-foreground resize-none w-full"
                  aria-label="Instrução de refinamento na região selecionada"
                />
              </div>
            )}
            <Button
              onClick={handleRefineClick}
              disabled={!hasImageConnection || !hasAnyRefineAction || isBusy}
              className="shrink-0"
              title={!hasImageConnection ? 'Selecione uma conexão de imagem para refinar' : undefined}
            >
              {isUploadingRefine ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Refinar
            </Button>
          </div>
        ) : (
          <div className="space-y-3" role="region" aria-label="Refinamento">
            <p className="text-sm font-medium text-foreground">O que você quer fazer?</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Textarea
                ref={instructionInputRef}
                placeholder="Descreva o ajuste (ex.: deixe o fundo mais escuro) ou use uma imagem abaixo."
                value={refineInstruction}
                onChange={(e) => setRefineInstruction(e.target.value)}
                className="flex-1 min-h-[60px] bg-muted border-border text-foreground placeholder:text-muted-foreground resize-none min-w-0"
                aria-label="Instrução de refinamento"
              />
              <Button
                onClick={handleRefineClick}
                disabled={!hasImageConnection || !hasAnyRefineAction || isBusy}
                className="shrink-0"
                title={!hasImageConnection ? 'Selecione uma conexão de imagem para refinar' : undefined}
              >
                {isUploadingRefine ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Refinar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Ou envie uma imagem:</p>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Referência de arte</label>
                <div className="flex items-center gap-2">
                  {referenceArtPreviewUrl ? (
                    <div className="relative">
                      <img src={referenceArtPreviewUrl} alt="Ref arte" className="w-14 h-14 rounded object-cover border border-border" />
                      <button type="button" onClick={clearReferenceArt} className="absolute -top-1 -right-1 bg-foreground/80 text-background rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => referenceArtInputRef.current?.click()}
                        className="w-14 h-14 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted shrink-0"
                        aria-label="Enviar referência de arte"
                      >
                        <Upload className="h-4 w-4" />
                      </button>
                      <input
                        ref={referenceArtInputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        aria-hidden
                        onChange={handleReferenceArtChange}
                      />
                    </>
                  )}
                  <span className="text-xs text-muted-foreground">Crie semelhante a essa arte</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Imagem para substituir</label>
                <div className="flex items-center gap-2">
                  {replacementPreviewUrl ? (
                    <div className="relative">
                      <img src={replacementPreviewUrl} alt="Substituir" className="w-14 h-14 rounded object-cover border border-border" />
                      <button type="button" onClick={clearReplacement} className="absolute -top-1 -right-1 bg-foreground/80 text-background rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => replacementInputRef.current?.click()}
                        className="w-14 h-14 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted shrink-0"
                        aria-label="Enviar imagem para substituir"
                      >
                        <Upload className="h-4 w-4" />
                      </button>
                      <input
                        ref={replacementInputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        aria-hidden
                        onChange={handleReplacementChange}
                      />
                    </>
                  )}
                  <span className="text-xs text-muted-foreground">Substitua elemento</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Imagem para adicionar na cena</label>
                <div className="flex items-center gap-2">
                  {addImagePreviewUrl ? (
                    <div className="relative">
                      <img src={addImagePreviewUrl} alt="Adicionar" className="w-14 h-14 rounded object-cover border border-border" />
                      <button type="button" onClick={clearAddImage} className="absolute -top-1 -right-1 bg-foreground/80 text-background rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => addImageInputRef.current?.click()}
                        className="w-14 h-14 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted shrink-0"
                        aria-label="Enviar imagem para adicionar na cena"
                      >
                        <Upload className="h-4 w-4" />
                      </button>
                      <input
                        ref={addImageInputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        aria-hidden
                        onChange={handleAddImageChange}
                      />
                    </>
                  )}
                  <span className="text-xs text-muted-foreground">Inclua esta imagem na cena</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Opções avançadas */}
        <div className="pt-3 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Opções avançadas (opcional)</p>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1" title="Altera a proporção da arte; a imagem será recriada para preencher o novo formato.">Dimensões</label>
              <Select value={refineDimensions} onValueChange={setRefineDimensions}>
                <SelectTrigger className="w-full sm:w-[140px] h-8 min-h-10 sm:min-h-0 bg-muted border-border text-foreground text-base sm:text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground">
                  {REFINE_DIMENSIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Qualidade</label>
              <Select value={refineImageSize} onValueChange={setRefineImageSize}>
                <SelectTrigger className="w-full sm:w-[100px] h-8 min-h-10 sm:min-h-0 bg-muted border-border text-foreground text-base sm:text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground">
                  {REFINE_IMAGE_SIZES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
