import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X } from 'lucide-react';
import BuilderPanel from '@/components/neurodesign/BuilderPanel';
import PreviewPanel from '@/components/neurodesign/PreviewPanel';
import { mergeFlowInputDataIntoConfig } from '@/lib/neurodesign/flowConfigMerge';
import { mergeNeuroDesignDefaults } from '@/lib/neurodesign/defaultConfig';
import {
  NEURODESIGN_FILL_FROM_BRIEF_SYSTEM_PROMPT,
  clipAdditionalPromptFromFill,
} from '@/lib/neurodesign/fillFromBriefPrompt';
import { useNeurodesignExpiredCleanup } from '@/hooks/useNeurodesignExpiredCleanup';

function buildFlowContextText(inputData) {
  if (!inputData || typeof inputData !== 'object') return '';
  const parts = [];
  const clientData = inputData.client?.data;
  if (clientData) {
    const { client_contexts, ...rest } = clientData;
    parts.push('Cliente: ' + JSON.stringify(rest, null, 2));
    const contexts = inputData.context?.data?.contexts || client_contexts || [];
    if (contexts.length) {
      const contextBlock = contexts
        .map((c) => (c.name ? `[${c.name}]\n${c.content || ''}` : (c.content || '')))
        .join('\n\n---\n\n');
      parts.push('Documentos de contexto do cliente:\n' + contextBlock);
    }
  }
  if (inputData.campaign?.data) {
    parts.push('Campanha: ' + JSON.stringify(inputData.campaign.data, null, 2));
  }
  if (inputData.knowledge?.data) {
    parts.push('Fonte de conhecimento: ' + JSON.stringify(inputData.knowledge.data, null, 2));
  }
  const agentOutput = inputData.agent?.data;
  const contentOutput = inputData.generated_content?.data;
  const agentText = typeof agentOutput === 'string' ? agentOutput : (agentOutput && (agentOutput.generatedText || agentOutput.text));
  const contentText = typeof contentOutput === 'string' ? contentOutput : null;
  if (agentText) parts.push('Texto do agente: ' + agentText);
  if (contentText && !agentText) parts.push('Texto do agente: ' + contentText);
  return parts.join('\n\n');
}

const NEURODESIGN_FILL_ALLOWED_KEYS = new Set([
  'subject_enabled', 'subject_mode', 'subject_gender', 'subject_description', 'quantity', 'niche_project', 'environment',
  'shot_type', 'layout_position', 'dimensions', 'image_size', 'text_enabled', 'text_mode', 'custom_text', 'custom_text_font_description', 'use_reference_image_text', 'headline_h1',
  'subheadline_h2', 'cta_button_text', 'text_position', 'text_gradient',
  'visual_attributes', 'ambient_color', 'rim_light_color', 'fill_light_color',
  'floating_elements_enabled', 'floating_elements_text', 'additional_prompt',
]);
const NEURODESIGN_FILL_ENUMS = {
  subject_mode: ['person', 'product'],
  subject_gender: ['masculino', 'feminino'],
  shot_type: ['close-up', 'medio busto', 'americano'],
  layout_position: ['esquerda', 'centro', 'direita'],
  dimensions: ['1:1', '4:5', '9:16', '16:9'],
  text_position: ['esquerda', 'centro', 'direita'],
  text_mode: ['structured', 'free'],
  image_size: ['1K', '2K', '4K'],
};
const NEURODESIGN_STYLE_TAGS = ['clássico', 'formal', 'elegante', 'institucional', 'tecnológico', 'minimalista', 'criativo'];

function parseNeuroDesignFillResponse(raw) {
  let str = (raw || '').trim();
  const stripMarkdown = (s) => s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  str = stripMarkdown(str);
  const firstBrace = str.indexOf('{');
  if (firstBrace === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = firstBrace; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const jsonStr = end !== -1 ? str.slice(firstBrace, end + 1) : str.slice(firstBrace);
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function normalizeShotType(v) {
  if (!v || typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  if (s.includes('close') || s === 'closeup') return 'close-up';
  if (s.includes('americano') || s.includes('full') || s.includes('corpo')) return 'americano';
  if (s.includes('medio') || s.includes('busto') || s.includes('medium') || s.includes('meio')) return 'medio busto';
  return null;
}
function normalizeImageSizeVal(v) {
  if (!v || typeof v !== 'string') return null;
  const s = v.trim().toUpperCase();
  if (s === '1K' || s === '1024') return '1K';
  if (s === '2K' || s === '2048') return '2K';
  if (s === '4K' || s === '4096') return '4K';
  return null;
}

/** Modo só formulário no nó do fluxo (sem pré-visualização / geração aqui). */
export const NEURO_DESIGN_FLOW_RENDER_MODE = {
  CONFIG_ONLY: 'flow-config-only',
};

const NeuroDesignFlowModal = ({
  open,
  onOpenChange,
  inputData,
  onResult,
  /** @deprecated use renderMode={NEURO_DESIGN_FLOW_RENDER_MODE.CONFIG_ONLY} */
  embedded,
  /** 'flow-config-only' = só coluna de configuração + Salvar e voltar (nó Gerador de Imagem) */
  renderMode,
  onCollapse,
  onEmbeddedSave,
  initialConfig,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [project, setProject] = useState(null);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [runs, setRuns] = useState([]);
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [imageConnections, setImageConnections] = useState([]);
  const [llmConnections, setLlmConnections] = useState([]);
  const [selectedLlmId, setSelectedLlmId] = useState(null);
  const [isFillingFromPrompt, setIsFillingFromPrompt] = useState(false);
  const generatingRef = useRef(false);
  const refiningRef = useRef(false);

  const isFlowConfigOnly =
    renderMode === NEURO_DESIGN_FLOW_RENDER_MODE.CONFIG_ONLY || embedded === true;

  const isVisible = isFlowConfigOnly ? true : open;
  const inputDataSnapshot = useMemo(() => (isVisible && inputData ? { ...inputData } : null), [isVisible, inputData]);

  useNeurodesignExpiredCleanup({
    enabled: Boolean(user?.id && isVisible),
    images,
    setImages,
    setSelectedImage,
  });
  const flowContextText = useMemo(() => buildFlowContextText(inputDataSnapshot), [inputDataSnapshot]);

  const getOrCreateProject = useCallback(async () => {
    if (!user) return;
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('neurodesign_projects')
        .select('*')
        .eq('owner_user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fetchError) {
        toast({ title: 'Erro ao carregar projeto', description: fetchError.message, variant: 'destructive' });
        return;
      }
      if (existing) {
        setProject(existing);
        return;
      }
      const { data: created, error: insertError } = await supabase
        .from('neurodesign_projects')
        .insert({ name: 'Meu projeto', owner_user_id: user.id })
        .select()
        .single();
      if (insertError) {
        toast({ title: 'Erro ao criar projeto', description: insertError.message, variant: 'destructive' });
        return;
      }
      setProject(created);
    } catch (e) {
      toast({ title: 'Erro ao carregar projeto', description: e?.message || 'Tabela pode não existir.', variant: 'destructive' });
    }
  }, [user, toast]);

  const fetchImageConnections = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_ai_connections')
        .select('id, name, provider, default_model, capabilities')
        .eq('user_id', user.id);
      if (error) return;
      setImageConnections((data || []).filter((c) => c.capabilities?.image_generation));
    } catch (_e) {
      setImageConnections([]);
    }
  }, [user]);

  const fetchLlmConnections = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_ai_connections')
        .select('id, name, provider, default_model, capabilities, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (error) return;
      const list = (data || []).filter((c) => c.capabilities?.text_generation === true);
      setLlmConnections(list);
      setSelectedLlmId((prev) => (list.length > 0 && (!prev || !list.some((c) => c.id === prev)) ? list[0].id : prev));
    } catch (_e) {
      setLlmConnections([]);
    }
  }, [user]);

  const fetchRuns = useCallback(async (projectId) => {
    if (!projectId) return;
    const { data, error } = await supabase
      .from('neurodesign_generation_runs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) return;
    setRuns(data || []);
  }, []);

  const fetchImages = useCallback(async (projectId) => {
    if (!projectId) return;
    const { data, error } = await supabase
      .from('neurodesign_generated_images')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(0, 4);
    if (error) {
      toast({ title: 'Erro ao carregar galeria', description: error.message, variant: 'destructive' });
      return;
    }
    setImages(data || []);
  }, [toast]);

  useEffect(() => {
    if (isVisible) {
      getOrCreateProject();
      fetchImageConnections();
      fetchLlmConnections();
    }
  }, [isVisible, getOrCreateProject, fetchImageConnections, fetchLlmConnections]);

  useEffect(() => {
    if (isVisible && project) {
      setCurrentConfig(initialConfig ?? null);
      setSelectedImage(null);
      if (!isFlowConfigOnly) {
        fetchRuns(project.id);
        fetchImages(project.id);
      } else {
        setRuns([]);
        setImages([]);
      }
    } else if (!isVisible) {
      setRuns([]);
      setImages([]);
      setSelectedImage(null);
      setCurrentConfig(null);
    }
  }, [isVisible, project, initialConfig, fetchRuns, fetchImages, isFlowConfigOnly]);

  const handleGenerate = useCallback(async (config) => {
    if (generatingRef.current) return;
    if (!project) {
      toast({ title: 'Projeto ainda não carregou', variant: 'destructive' });
      return;
    }
    if (config?.text_enabled) {
      const isFreeMode = (config.text_mode || 'structured') === 'free';
      const valid = isFreeMode
        ? Boolean((config.custom_text || '').trim() || config.use_reference_image_text)
        : Boolean((config.headline_h1 || '').trim() || (config.subheadline_h2 || '').trim() || (config.cta_button_text || '').trim());
      if (!valid) {
        toast({ title: isFreeMode ? "Com 'Texto na imagem' em modo livre, preencha o texto ou ative 'Usar texto da imagem de referência'." : "Com 'Texto na imagem' ativado, preencha pelo menos um campo: Título H1, Subtítulo H2 ou Texto do botão CTA.", variant: 'destructive' });
        return;
      }
    }
    generatingRef.current = true;
    setIsGenerating(true);
    try {
      const flowOverrides = mergeFlowInputDataIntoConfig(inputDataSnapshot || {});
      const additionalPrompt = [flowContextText, config.additional_prompt].filter(Boolean).join('\n\n');
      const configWithContext = { ...config, ...flowOverrides, additional_prompt: additionalPrompt };
      const conn = imageConnections.find((c) => c.id === config?.user_ai_connection_id);
      const isGoogle = conn?.provider?.toLowerCase() === 'google';
      const fnName = isGoogle ? 'neurodesign-generate-google' : 'neurodesign-generate';
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: {
          projectId: project.id,
          configId: config?.id || null,
          config: configWithContext,
          userAiConnectionId: config?.user_ai_connection_id || null,
        },
      });
      const errMsg = data?.error || error?.message;
      if (error) throw new Error(errMsg || `Falha ao chamar o servidor de geração.`);
      if (data?.error) throw new Error(data.error);
      const newImages = data?.images;
      if (newImages?.length) {
        const withIds = newImages.map((img, i) => ({ ...img, id: img.id || `temp-${i}`, run_id: img.run_id || data.runId, project_id: project.id }));
        setSelectedImage(withIds[0]);
        setImages((prev) => [...withIds, ...prev.filter((p) => !withIds.some((w) => w.id === p.id))].slice(0, 5));
        toast({ title: 'Imagens geradas com sucesso!' });
        fetchRuns(project.id).catch(() => {});
        setTimeout(() => fetchImages(project.id).catch(() => {}), 2500);
      } else {
        toast({ title: 'Geração concluída', description: 'Nenhuma imagem retornada.', variant: 'destructive' });
      }
    } catch (e) {
      const msg = e?.message || 'Erro desconhecido';
      const is429 = /429|quota|rate limit/i.test(msg);
      toast({
        title: 'Erro ao gerar',
        description: is429 ? 'Limite de uso da API atingido. Aguarde alguns minutos.' : msg,
        variant: 'destructive',
      });
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  }, [project, imageConnections, flowContextText, inputDataSnapshot, fetchRuns, fetchImages, toast]);

  const handleRefine = useCallback(async (payload) => {
    if (refiningRef.current) return;
    if (!project || !selectedImage?.id) {
      toast({ title: 'Selecione uma imagem para refinar', variant: 'destructive' });
      return;
    }
    const runId = selectedImage.run_id || runs.find((r) => r.id && images.some((i) => i.run_id === r.id && i.id === selectedImage.id))?.id;
    if (!runId) {
      toast({ title: 'Execução não encontrada', variant: 'destructive' });
      return;
    }
    const instruction = typeof payload === 'string' ? payload : payload?.instruction ?? '';
    const configOverrides = typeof payload === 'object' && payload !== null ? payload.configOverrides : undefined;
    const referenceImageUrl = typeof payload === 'object' && payload !== null ? payload.referenceImageUrl : undefined;
    const replacementImageUrl = typeof payload === 'object' && payload !== null ? payload.replacementImageUrl : undefined;
    const addImageUrl = typeof payload === 'object' && payload !== null ? payload.addImageUrl : undefined;
    const region = typeof payload === 'object' && payload !== null ? payload.region : undefined;
    const regionCropImageUrl = typeof payload === 'object' && payload !== null ? payload.regionCropImageUrl : undefined;
    const selectionAction = typeof payload === 'object' && payload !== null ? payload.selectionAction : undefined;
    const selectionText = typeof payload === 'object' && payload !== null ? payload.selectionText : undefined;
    const selectionFont = typeof payload === 'object' && payload !== null ? payload.selectionFont : undefined;
    const selectionFontStyle = typeof payload === 'object' && payload !== null ? payload.selectionFontStyle : undefined;
    const improveQuality = typeof payload === 'object' && payload !== null && payload.improveQuality === true;

    refiningRef.current = true;
    setIsRefining(true);
    try {
      const body = {
        projectId: project.id,
        runId,
        imageId: selectedImage.id,
        instruction,
        configOverrides,
        userAiConnectionId: currentConfig?.user_ai_connection_id || null,
      };
      if (referenceImageUrl) body.referenceImageUrl = referenceImageUrl;
      if (replacementImageUrl) body.replacementImageUrl = replacementImageUrl;
      if (addImageUrl) body.addImageUrl = addImageUrl;
      if (region) body.region = region;
      if (regionCropImageUrl) body.regionCropImageUrl = regionCropImageUrl;
      if (selectionAction) body.selectionAction = selectionAction;
      if (selectionText) body.selectionText = selectionText;
      if (selectionFont) body.selectionFont = selectionFont;
      if (selectionFontStyle) body.selectionFontStyle = selectionFontStyle;
      if (improveQuality) body.improveQuality = true;

      const refineConn = imageConnections.find((c) => c.id === currentConfig?.user_ai_connection_id);
      const isGoogleRefine = refineConn?.provider?.toLowerCase() === 'google';
      const refineFnName = isGoogleRefine ? 'neurodesign-refine-google' : 'neurodesign-refine';
      const { data, error } = await supabase.functions.invoke(refineFnName, { body });
      const serverMsg = typeof data?.error === 'string' ? data.error : null;
      const refineErrMsg = serverMsg || error?.message;
      if (error) throw new Error(refineErrMsg || 'Falha ao chamar o servidor de refino.');
      if (data?.error) throw new Error(serverMsg || 'Falha ao chamar o servidor de refino.');
      if (data?.images?.length) {
        const withIds = data.images.map((img, i) => ({
          ...img,
          id: img.id || `temp-refine-${i}`,
          run_id: img.run_id ?? data.runId ?? runId,
          project_id: project.id,
        }));
        setSelectedImage(withIds[0]);
        setImages((prev) => [...withIds, ...prev.filter((p) => !withIds.some((w) => w.id === p.id))].slice(0, 5));
        toast({ title: 'Imagem refinada com sucesso!' });
        fetchRuns(project.id).catch(() => {});
        setTimeout(() => fetchImages(project.id).catch(() => {}), 2500);
      }
    } catch (e) {
      const msg = e?.message || 'Erro desconhecido';
      toast({ title: 'Erro ao refinar', description: msg, variant: 'destructive' });
    } finally {
      refiningRef.current = false;
      setIsRefining(false);
    }
  }, [project, selectedImage, runs, images, currentConfig, imageConnections, fetchRuns, fetchImages, toast]);

  const handleFillFromPrompt = useCallback(async (pastedText) => {
    const trimmed = (pastedText || '').trim();
    if (!trimmed) {
      toast({ title: 'Digite ou cole um prompt', variant: 'destructive' });
      return;
    }
    const connId = selectedLlmId || llmConnections[0]?.id;
    if (!connId) {
      toast({ title: 'Nenhuma conexão de IA ativa', description: 'Configure uma conexão em Minha IA.', variant: 'destructive' });
      return;
    }
    setIsFillingFromPrompt(true);
    try {
      const { data, error } = await supabase.functions.invoke('generic-ai-chat', {
        body: JSON.stringify({
          session_id: null,
          messages: [
            { role: 'system', content: NEURODESIGN_FILL_FROM_BRIEF_SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Preencha os campos do Neuro Designer com base no seguinte brief. Distribua tudo pelos campos do JSON; em "additional_prompt" só notas técnicas curtas ou omita. O contexto do fluxo (cliente/campanha) é enviado separadamente na geração — não o coloque em additional_prompt.\n\n--- BRIEF ---\n${trimmed}`,
            },
          ],
          llm_integration_id: connId,
          is_user_connection: true,
          context: 'neurodesign_fill',
        }),
      });
      if (error) throw new Error(error.message || error);
      if (data?.error) throw new Error(data.error);
      const raw = data?.response || data?.content || '';
      const parsed = parseNeuroDesignFillResponse(raw);
      if (!parsed || typeof parsed !== 'object') throw new Error('Resposta da IA não contém JSON válido.');
      const sanitized = {};
      for (const key of Object.keys(parsed)) {
        if (!NEURODESIGN_FILL_ALLOWED_KEYS.has(key)) continue;
        let value = parsed[key];
        if (key === 'quantity') {
          const n = Number(value);
          if (!Number.isNaN(n)) sanitized[key] = Math.min(5, Math.max(1, Math.round(n)));
        } else if (key === 'subject_mode' && typeof value === 'string') {
          const v = value.trim().toLowerCase();
          if (v === 'product' || v === 'produto' || v === 'objeto') sanitized[key] = 'product';
          else if (v === 'person' || v === 'pessoa' || v === 'people' || v === 'retrato') sanitized[key] = 'person';
        } else if (key === 'shot_type' && typeof value === 'string') {
          const normalized = normalizeShotType(value) || (NEURODESIGN_FILL_ENUMS.shot_type.includes(value.trim()) ? value.trim() : null);
          if (normalized) sanitized[key] = normalized;
        } else if (key === 'image_size' && (typeof value === 'string' || typeof value === 'number')) {
          const normalized = normalizeImageSizeVal(String(value)) || (NEURODESIGN_FILL_ENUMS.image_size.includes(String(value).trim().toUpperCase()) ? String(value).trim().toUpperCase() : null);
          if (normalized) sanitized[key] = normalized;
        } else if (NEURODESIGN_FILL_ENUMS[key] && typeof value === 'string') {
          const v = value.trim().toLowerCase();
          const enumList = NEURODESIGN_FILL_ENUMS[key];
          const match = enumList.find((e) => e.toLowerCase() === v || e.replace(/\s/g, '') === v.replace(/\s/g, ''));
          if (match) sanitized[key] = match;
        } else if (key === 'visual_attributes' && value && typeof value === 'object') {
          const prev = currentConfig?.visual_attributes || {};
          const next = { ...prev };
          let tags = value.style_tags;
          if (typeof tags === 'string') tags = tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
          if (Array.isArray(tags)) {
            next.style_tags = tags.map((t) => String(t).toLowerCase()).filter((t) => NEURODESIGN_STYLE_TAGS.includes(t));
          }
          const sob = value.sobriety;
          if (typeof sob === 'number' && sob >= 0 && sob <= 100) next.sobriety = sob;
          else if (typeof sob === 'string' && /^\d+$/.test(sob.trim())) { const n = parseInt(sob.trim(), 10); if (n >= 0 && n <= 100) next.sobriety = n; }
          if (typeof value.ultra_realistic === 'boolean') next.ultra_realistic = value.ultra_realistic;
          if (typeof value.blur_enabled === 'boolean') next.blur_enabled = value.blur_enabled;
          if (typeof value.lateral_gradient_enabled === 'boolean') next.lateral_gradient_enabled = value.lateral_gradient_enabled;
          sanitized[key] = next;
        } else if (key === 'additional_prompt' && (typeof value === 'string' || typeof value === 'number')) {
          sanitized[key] = clipAdditionalPromptFromFill(value);
        } else if (key === 'text_enabled' || key === 'text_gradient' || key === 'floating_elements_enabled' || key === 'use_reference_image_text' || key === 'subject_enabled') {
          sanitized[key] = Boolean(value);
        } else if (typeof value === 'string' || typeof value === 'number') {
          sanitized[key] = value;
        }
      }
      setCurrentConfig((prev) => {
        const base = mergeNeuroDesignDefaults(prev);
        const merged = { ...base };
        for (const key of Object.keys(sanitized)) {
          if (key === 'additional_prompt') continue;
          if (key === 'visual_attributes') merged.visual_attributes = { ...(base.visual_attributes || {}), ...sanitized.visual_attributes };
          else merged[key] = sanitized[key];
        }
        merged.additional_prompt = clipAdditionalPromptFromFill(sanitized.additional_prompt);
        return merged;
      });
      toast({
        title: 'Campos preenchidos',
        description: 'Os dados foram distribuídos pelos campos. O prompt adicional contém só notas técnicas opcionais.',
      });
    } catch (e) {
      toast({ title: 'Erro ao preencher campos', description: e?.message || 'Não foi possível extrair os campos.', variant: 'destructive' });
    } finally {
      setIsFillingFromPrompt(false);
    }
  }, [selectedLlmId, llmConnections, currentConfig, toast]);

  const downloadHandler = useCallback((url) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `neurodesign-${Date.now()}.png`;
    a.click();
  }, []);

  const handleClose = useCallback(() => {
    if (selectedImage) {
      const url = selectedImage.url_publica || selectedImage.url || selectedImage.thumbnail_url;
      if (url) {
        onResult?.({
          lastImageUrl: url,
          output: { id: selectedImage.id, data: [selectedImage] },
        });
      }
    }
    if (isFlowConfigOnly) onCollapse?.();
    else onOpenChange(false);
  }, [selectedImage, onResult, onOpenChange, isFlowConfigOnly, onCollapse]);

  const headerTitle = isFlowConfigOnly ? 'Configurar geração' : 'Gerador de Imagem – NeuroDesign';

  const flowContextBlock =
    flowContextText &&
    (isFlowConfigOnly ? (
      <div className="shrink-0 px-4 py-3 border-b border-border bg-muted/30">
        <Label className="text-xs text-muted-foreground">Contexto do fluxo (usado no prompt)</Label>
        <Textarea
          readOnly
          value={flowContextText}
          className="mt-1 min-h-[72px] text-xs resize-none bg-muted border-border"
        />
        <p className="text-xs text-muted-foreground mt-1">Conecte Cliente, Contexto ou Campanha para enriquecer o prompt.</p>
      </div>
    ) : (
      <div className="shrink-0 p-3 border-b border-border bg-muted/30">
        <Label className="text-xs text-muted-foreground">Contexto do fluxo (usado no prompt)</Label>
        <Textarea
          readOnly
          value={flowContextText}
          className="mt-1 min-h-[80px] text-xs resize-none bg-muted border-border"
        />
        <p className="text-xs text-muted-foreground mt-1">Conecte Cliente, Contexto ou Campanha para enriquecer o prompt.</p>
      </div>
    ));

  const builderPanelEl = (
    <BuilderPanel
      project={project}
      config={currentConfig}
      setConfig={setCurrentConfig}
      imageConnections={imageConnections}
      onGenerate={handleGenerate}
      isGenerating={isGenerating}
      onFillFromPrompt={handleFillFromPrompt}
      hasLlmConnection={llmConnections.length > 0}
      isFillingFromPrompt={isFillingFromPrompt}
      selectedLlmId={selectedLlmId}
      llmConnections={llmConnections}
      onSelectLlmId={setSelectedLlmId}
      embeddedSaveMode={isFlowConfigOnly}
      onSaveAndBack={isFlowConfigOnly ? (cfg) => onEmbeddedSave?.(cfg) : undefined}
    />
  );

  const innerContentDialog = (
    <>
      <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-border bg-card">
        <h2 className="text-lg font-semibold">{headerTitle}</h2>
        <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Fechar">
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[420px_1fr] min-h-0 overflow-hidden nodrag nowheel nopan">
        <div className="flex flex-col min-h-0 overflow-hidden border-r border-border nodrag nowheel nopan">
          {flowContextBlock}
          <div className="flex-1 overflow-y-auto min-h-0 nodrag nowheel">{builderPanelEl}</div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden nodrag nowheel nopan">
          <PreviewPanel
            project={project}
            user={user}
            selectedImage={selectedImage}
            images={images}
            isGenerating={isGenerating}
            isRefining={isRefining}
            onRefine={handleRefine}
            onDownload={downloadHandler}
            onSelectImage={setSelectedImage}
            hasImageConnection={!!(currentConfig?.user_ai_connection_id && currentConfig.user_ai_connection_id !== 'none')}
          />
        </div>
      </div>
    </>
  );

  const innerContentEmbedded = (
    <>
      <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-border bg-card">
        <h2 className="text-lg font-semibold">{headerTitle}</h2>
        <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Fechar sem guardar">
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden nodrag nowheel nopan">
        {flowContextBlock}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden nodrag nowheel px-3 pb-4">
          <div className="max-w-3xl mx-auto w-full">{builderPanelEl}</div>
        </div>
      </div>
    </>
  );

  if (isFlowConfigOnly) {
    return (
      <div className="flex flex-col w-full h-full overflow-hidden nodrag nowheel nopan" style={{ minHeight: 0 }}>
        {innerContentEmbedded}
      </div>
    );
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : handleClose())}>
      <DialogContent
        className="max-w-[95vw] w-full h-[95vh] max-h-[95vh] p-0 gap-0 flex flex-col overflow-hidden border-border"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={() => handleClose()}
      >
        {innerContentDialog}
      </DialogContent>
    </Dialog>
  );
};

export default NeuroDesignFlowModal;
