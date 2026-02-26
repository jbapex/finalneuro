import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { FolderOpen, PanelLeft } from 'lucide-react';
import NeuroDesignSidebar from '@/components/neurodesign/NeuroDesignSidebar';
import BuilderPanel from '@/components/neurodesign/BuilderPanel';
import PreviewPanel from '@/components/neurodesign/PreviewPanel';
import MasonryGallery from '@/components/neurodesign/MasonryGallery';
import NeuroDesignErrorBoundary from '@/components/neurodesign/NeuroDesignErrorBoundary';

const NeuroDesignPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState('create');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [runs, setRuns] = useState([]);
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const generatingRef = useRef(false);
  const refiningRef = useRef(false);
  const [imageConnections, setImageConnections] = useState([]);
  const [llmConnections, setLlmConnections] = useState([]);
  const [selectedLlmId, setSelectedLlmId] = useState(null);
  const [isFillingFromPrompt, setIsFillingFromPrompt] = useState(false);
  const isLg = useMediaQuery('(min-width: 1024px)');
  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);
  const [builderDrawerOpen, setBuilderDrawerOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!user) return [];
    try {
      const { data, error } = await supabase
        .from('neurodesign_projects')
        .select('*')
        .eq('owner_user_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) {
        toast({ title: 'Erro ao carregar galerias', description: error.message, variant: 'destructive' });
        setProjects([]);
        return [];
      }
      const list = data || [];
      setProjects(list);
      return list;
    } catch (e) {
      toast({ title: 'Erro ao carregar galerias', description: e?.message || 'Tabela pode não existir. Execute o SQL do NeuroDesign no Supabase.', variant: 'destructive' });
      setProjects([]);
      return [];
    }
  }, [user, toast]);

  const ensureOneGallery = useCallback(async () => {
    if (!user) return;
    const list = await fetchProjects();
    if (list.length > 0) {
      setSelectedProject((prev) => (prev && list.some((p) => p.id === prev.id) ? prev : list[0]));
      return;
    }
    try {
      const { data: created, error } = await supabase
        .from('neurodesign_projects')
        .insert({ name: 'Minha Galeria', owner_user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      setProjects([created]);
      setSelectedProject(created);
    } catch (e) {
      toast({ title: 'Erro ao criar galeria', description: e?.message || 'Não foi possível criar a galeria.', variant: 'destructive' });
    }
  }, [user, fetchProjects, toast]);

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
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Erro ao carregar galeria', description: error.message, variant: 'destructive' });
      return;
    }
    setImages(data || []);
  }, [toast]);

  useEffect(() => {
    ensureOneGallery();
    fetchImageConnections();
    fetchLlmConnections();
  }, [ensureOneGallery, fetchImageConnections, fetchLlmConnections]);

  useEffect(() => {
    if (selectedProject) {
      setCurrentConfig(null);
      setSelectedImage(null);
      fetchRuns(selectedProject.id);
      fetchImages(selectedProject.id);
    } else {
      setRuns([]);
      setImages([]);
      setCurrentConfig(null);
      setSelectedImage(null);
    }
  }, [selectedProject, fetchRuns, fetchImages]);

  const handleGenerate = async (config) => {
    if (generatingRef.current) return;
    if (!selectedProject) {
      toast({ title: 'Selecione uma galeria', variant: 'destructive' });
      return;
    }
    if (config?.text_enabled && !((config.headline_h1 || '').trim() || (config.subheadline_h2 || '').trim() || (config.cta_button_text || '').trim())) {
      toast({ title: "Com 'Texto na imagem' ativado, preencha pelo menos um campo: Título H1, Subtítulo H2 ou Texto do botão CTA.", variant: 'destructive' });
      return;
    }
    generatingRef.current = true;
    setIsGenerating(true);
    try {
      const conn = imageConnections.find((c) => c.id === config?.user_ai_connection_id);
      const isGoogle = conn?.provider?.toLowerCase() === 'google';
      const fnName = isGoogle ? 'neurodesign-generate-google' : 'neurodesign-generate';
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: {
          projectId: selectedProject.id,
          configId: config?.id || null,
          config,
          userAiConnectionId: config?.user_ai_connection_id || null,
        },
      });
      const errMsg = data?.error || error?.message;
      if (error) throw new Error(errMsg || `Falha ao chamar o servidor de geração. Confira se a Edge Function ${fnName} está publicada no Supabase.`);
      if (data?.error) throw new Error(data.error);
      const newImages = data?.images;
      if (newImages?.length) {
        const withIds = newImages.map((img, i) => ({ ...img, id: img.id || `temp-${i}`, run_id: img.run_id || data.runId, project_id: selectedProject.id }));
        // Mostrar primeiro no preview (área principal) e depois na lista de criações — evita atraso visual
        setSelectedImage(withIds[0]);
        setImages((prev) => [...withIds, ...prev.filter((p) => !withIds.some((w) => w.id === p.id))].slice(0, 5));
        toast({ title: 'Imagens geradas com sucesso!' });
        fetchRuns(selectedProject.id).catch(() => {});
        // Atualizar lista do banco depois de um tempo, para não sobrescrever com dados antigos e causar atraso
        setTimeout(() => fetchImages(selectedProject.id).catch(() => {}), 2500);
      } else {
        toast({ title: 'Geração concluída', description: `Nenhuma imagem retornada. Verifique se a Edge Function ${fnName} está publicada no Supabase.`, variant: 'destructive' });
      }
    } catch (e) {
      const msg = e?.message || 'Erro desconhecido';
      const is429 = /429|quota|rate limit/i.test(msg);
      toast({
        title: 'Erro ao gerar',
        description: is429
          ? 'Limite de uso da API Google (429) atingido. Aguarde alguns minutos ou verifique seu plano e uso em https://ai.google.dev/gemini-api/docs/rate-limits'
          : msg,
        variant: 'destructive',
      });
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  };

  const handleRefine = async (payload) => {
    if (refiningRef.current) return;
    if (!selectedProject || !selectedImage?.id) {
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

    refiningRef.current = true;
    setIsRefining(true);
    try {
      const body = {
        projectId: selectedProject.id,
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

      const refineConn = imageConnections.find((c) => c.id === currentConfig?.user_ai_connection_id);
      const isGoogleRefine = refineConn?.provider?.toLowerCase() === 'google';
      const refineFnName = isGoogleRefine ? 'neurodesign-refine-google' : 'neurodesign-refine';
      const { data, error } = await supabase.functions.invoke(refineFnName, {
        body,
      });
      const serverMsg = typeof data?.error === 'string' ? data.error : null;
      const refineErrMsg = serverMsg || error?.message;
      if (error) throw new Error(refineErrMsg || 'Falha ao chamar o servidor de refino.');
      if (data?.error) throw new Error(serverMsg || 'Falha ao chamar o servidor de refino.');
      if (data?.images?.length) {
        // Atualizar primeiro a área principal (preview), depois a lista de criações — mesma ordem do handleGenerate
        const withIds = data.images.map((img, i) => ({
          ...img,
          id: img.id || `temp-refine-${i}`,
          run_id: img.run_id ?? data.runId ?? runId,
          project_id: selectedProject.id,
        }));
        setSelectedImage(withIds[0]);
        setImages((prev) => [...withIds, ...prev.filter((p) => !withIds.some((w) => w.id === p.id))].slice(0, 5));
        toast({ title: 'Imagem refinada com sucesso!' });
        fetchRuns(selectedProject.id).catch(() => {});
        setTimeout(() => fetchImages(selectedProject.id).catch(() => {}), 2500);
      }
    } catch (e) {
      const msg = e?.message || 'Erro desconhecido';
      const is429 = /429|quota|rate limit/i.test(msg);
      const isNetwork = /failed to fetch|network error|load failed/i.test(msg);
      toast({
        title: 'Erro ao refinar',
        description: is429
          ? 'Limite de uso da API Google (429) atingido. Aguarde alguns minutos ou verifique seu plano em https://ai.google.dev/gemini-api/docs/rate-limits'
          : isNetwork
            ? 'Falha de conexão. Verifique sua internet e se as funções do Supabase estão publicadas e ativas.'
            : msg,
        variant: 'destructive',
      });
    } finally {
      refiningRef.current = false;
      setIsRefining(false);
    }
  };

  const ZONE_VALUES = ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'];
  const FONT_VALUES = ['', 'sans', 'serif', 'bold', 'modern'];
  const SHAPE_STYLE_VALUES = ['rounded_rectangle', 'banner', 'pill'];

  const NEURODESIGN_FILL_ALLOWED_KEYS = new Set([
    'subject_enabled', 'subject_gender', 'subject_description', 'quantity', 'niche_project', 'environment',
    'shot_type', 'layout_position', 'dimensions', 'image_size', 'use_scenario_photos',
    'text_enabled', 'headline_h1', 'subheadline_h2', 'cta_button_text', 'text_position', 'text_gradient',
    'headline_zone', 'subheadline_zone', 'cta_zone',
    'headline_font', 'subheadline_font', 'cta_font',
    'headline_color', 'subheadline_color', 'cta_color',
    'headline_shape_enabled', 'subheadline_shape_enabled', 'cta_shape_enabled',
    'headline_shape_style', 'subheadline_shape_style', 'cta_shape_style',
    'headline_shape_color', 'subheadline_shape_color', 'cta_shape_color',
    'text_font', 'text_color', 'text_shape_enabled', 'text_shape_style', 'text_shape_color',
    'visual_attributes', 'ambient_color', 'rim_light_color', 'fill_light_color',
    'floating_elements_enabled', 'floating_elements_text', 'additional_prompt',
  ]);
  const NEURODESIGN_FILL_ENUMS = {
    subject_gender: ['masculino', 'feminino'],
    shot_type: ['close-up', 'medio busto', 'americano'],
    layout_position: ['esquerda', 'centro', 'direita'],
    dimensions: ['1:1', '4:5', '9:16', '16:9'],
    text_position: ['esquerda', 'centro', 'direita'],
    image_size: ['1K', '2K', '4K'],
    headline_zone: ZONE_VALUES,
    subheadline_zone: ZONE_VALUES,
    cta_zone: ZONE_VALUES,
    headline_font: FONT_VALUES,
    subheadline_font: FONT_VALUES,
    cta_font: FONT_VALUES,
    headline_shape_style: SHAPE_STYLE_VALUES,
    subheadline_shape_style: SHAPE_STYLE_VALUES,
    cta_shape_style: SHAPE_STYLE_VALUES,
    text_font: FONT_VALUES,
    text_shape_style: SHAPE_STYLE_VALUES,
  };
  const NEURODESIGN_STYLE_TAGS = ['clássico', 'formal', 'elegante', 'institucional', 'tecnológico', 'minimalista', 'criativo'];
  const HEX_REGEX = /^#[0-9a-fA-F]{3,6}$/;
  function isValidHex(s) { return typeof s === 'string' && HEX_REGEX.test(s.trim()); }

  const parseNeuroDesignFillResponse = (raw) => {
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
  };
  const normalizeShotType = (v) => {
    if (!v || typeof v !== 'string') return null;
    const s = v.trim().toLowerCase();
    if (s.includes('close') || s === 'closeup') return 'close-up';
    if (s.includes('americano') || s.includes('full') || s.includes('corpo')) return 'americano';
    if (s.includes('medio') || s.includes('busto') || s.includes('medium') || s.includes('meio')) return 'medio busto';
    return null;
  };
  const normalizeImageSizeVal = (v) => {
    if (!v || typeof v !== 'string') return null;
    const s = v.trim().toUpperCase();
    if (s === '1K' || s === '1024') return '1K';
    if (s === '2K' || s === '2048') return '2K';
    if (s === '4K' || s === '4096') return '4K';
    return null;
  };

  const handleFillFromPrompt = async (pastedText) => {
    const trimmed = (pastedText || '').trim();
    if (!trimmed) {
      toast({ title: 'Digite ou cole um prompt', variant: 'destructive' });
      return;
    }
    const connId = selectedLlmId || llmConnections[0]?.id;
    if (!connId) {
      toast({ title: 'Nenhuma conexão de IA ativa', description: 'Configure uma conexão de modelo de linguagem em Minha IA.', variant: 'destructive' });
      return;
    }
    const systemPrompt = `Você é um assistente que extrai dados estruturados de briefs/prompts criativos para preencher um formulário de geração de imagem (NeuroDesign).
Responda APENAS com um único objeto JSON válido. Sem markdown, sem \`\`\`json, sem texto antes ou depois do objeto.
Preencha todos os campos que conseguir inferir do brief; para o que não for mencionado, omita a chave.
Mapeamento de termos comuns:
- Formato: "feed" ou "quadrado" -> dimensions "1:1"; "stories" ou "vertical" -> "9:16"; "horizontal" ou "banner" -> "16:9"; "4:5" ou "retrato feed" -> "4:5"
- Plano: "close" ou "rosto" -> shot_type "close-up"; "médio" ou "busto" -> "medio busto"; "americano" ou "corpo inteiro" -> "americano"
- Qualidade: "alta" ou "2k" ou "alta resolução" -> image_size "2K"; "máxima" ou "4k" -> "4K"; caso contrário use "1K"
Chaves e valores (use exatamente assim no JSON quando preencher):
- subject_enabled: true ou false (se há pessoa na imagem)
- subject_gender: "masculino" ou "feminino"
- subject_description: string (pose, roupa, expressão)
- quantity: número de 1 a 5 (quantidade de pessoas na imagem)
- niche_project: string (nicho do negócio/projeto)
- environment: string (cenário, ambiente, local)
- use_scenario_photos: true ou false (usar fotos de cenário como referência)
- shot_type: "close-up" ou "medio busto" ou "americano"
- layout_position: "esquerda" ou "centro" ou "direita"
- dimensions: "1:1" ou "4:5" ou "9:16" ou "16:9"
- image_size: "1K" ou "2K" ou "4K"
- text_enabled: true ou false. Se true: headline_h1, subheadline_h2, cta_button_text (strings)
- text_position: "esquerda" ou "centro" ou "direita"
- headline_zone, subheadline_zone, cta_zone: posição do texto no quadro. Valores: "top-left", "top-center", "top-right", "center-left", "center", "center-right", "bottom-left", "bottom-center", "bottom-right"
- headline_font, subheadline_font, cta_font: "sans", "serif", "bold", "modern" ou "" (sistema decide)
- headline_color, subheadline_color, cta_color: cor do texto em hex, ex: "#ffffff"
- headline_shape_enabled, subheadline_shape_enabled, cta_shape_enabled: true ou false (faixa/banner atrás do texto)
- headline_shape_style, subheadline_shape_style, cta_shape_style: "rounded_rectangle", "banner" ou "pill"
- headline_shape_color, subheadline_shape_color, cta_shape_color: cor da faixa em hex, ex: "#dc2626"
- text_font, text_color, text_shape_enabled, text_shape_style, text_shape_color: mesmos valores acima (fallback global)
- text_gradient: true ou false
- visual_attributes: objeto com style_tags (array: clássico, formal, elegante, institucional, tecnológico, minimalista, criativo), sobriety (0-100), ultra_realistic, blur_enabled, lateral_gradient_enabled (boolean)
- additional_prompt: string (instruções extras)
- ambient_color, rim_light_color, fill_light_color: string hex #RRGGBB
- floating_elements_enabled: boolean, floating_elements_text: string
Responda somente com o JSON.`;

    setIsFillingFromPrompt(true);
    try {
      const { data, error } = await supabase.functions.invoke('generic-ai-chat', {
        body: JSON.stringify({
          session_id: null,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Preencha os campos do NeuroDesign com base no seguinte brief/prompt:\n\n${trimmed}` },
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
      const COLOR_KEYS = new Set(['headline_color', 'subheadline_color', 'cta_color', 'headline_shape_color', 'subheadline_shape_color', 'cta_shape_color', 'text_color', 'text_shape_color', 'ambient_color', 'rim_light_color', 'fill_light_color']);
      const BOOL_KEYS = new Set(['text_enabled', 'text_gradient', 'floating_elements_enabled', 'subject_enabled', 'use_scenario_photos', 'headline_shape_enabled', 'subheadline_shape_enabled', 'cta_shape_enabled', 'text_shape_enabled']);
      const sanitized = {};
      for (const key of Object.keys(parsed)) {
        if (!NEURODESIGN_FILL_ALLOWED_KEYS.has(key)) continue;
        let value = parsed[key];
        if (key === 'quantity') {
          const n = Number(value);
          if (!Number.isNaN(n)) sanitized[key] = Math.min(5, Math.max(1, Math.round(n)));
        } else if (key === 'shot_type' && typeof value === 'string') {
          const normalized = normalizeShotType(value) || (NEURODESIGN_FILL_ENUMS.shot_type.includes(value.trim()) ? value.trim() : null);
          if (normalized) sanitized[key] = normalized;
        } else if (key === 'image_size' && (typeof value === 'string' || typeof value === 'number')) {
          const normalized = normalizeImageSizeVal(String(value)) || (NEURODESIGN_FILL_ENUMS.image_size.includes(String(value).trim().toUpperCase()) ? String(value).trim().toUpperCase() : null);
          if (normalized) sanitized[key] = normalized;
        } else if (COLOR_KEYS.has(key) && typeof value === 'string') {
          if (isValidHex(value)) sanitized[key] = value.trim();
        } else if (BOOL_KEYS.has(key)) {
          sanitized[key] = Boolean(value);
        } else if (NEURODESIGN_FILL_ENUMS[key] && (typeof value === 'string' || value === null || value === '')) {
          const v = value == null ? '' : String(value).trim().toLowerCase();
          const enumList = NEURODESIGN_FILL_ENUMS[key];
          const match = enumList.find((e) => String(e).toLowerCase() === v || String(e).replace(/\s/g, '') === v.replace(/\s/g, ''));
          if (match !== undefined) sanitized[key] = match;
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
        } else if (typeof value === 'string' || typeof value === 'number') {
          sanitized[key] = value;
        }
      }
      setCurrentConfig((prev) => {
        const base = prev || {};
        const merged = { ...base };
        for (const key of Object.keys(sanitized)) {
          if (key === 'visual_attributes') merged.visual_attributes = { ...(base.visual_attributes || {}), ...sanitized.visual_attributes };
          else merged[key] = sanitized[key];
        }
        return merged;
      });
      toast({ title: 'Campos preenchidos com sucesso!' });
    } catch (e) {
      toast({ title: 'Erro ao preencher campos', description: e?.message || 'Não foi possível extrair os campos.', variant: 'destructive' });
    } finally {
      setIsFillingFromPrompt(false);
    }
  };

  const downloadHandler = (url) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `neurodesign-${Date.now()}.png`;
    a.click();
  };

  const handleRenameProject = async (projectIdToRename, newName) => {
    const trimmed = newName?.trim();
    if (!trimmed || !user) return;
    const { error } = await supabase
      .from('neurodesign_projects')
      .update({ name: trimmed })
      .eq('id', projectIdToRename)
      .eq('owner_user_id', user.id);
    if (error) {
      toast({ title: 'Erro ao renomear', description: error.message, variant: 'destructive' });
      return;
    }
    setProjects((prev) => prev.map((p) => (p.id === projectIdToRename ? { ...p, name: trimmed } : p)));
    if (selectedProject?.id === projectIdToRename) {
      setSelectedProject((p) => (p ? { ...p, name: trimmed } : null));
    }
    toast({ title: 'Nome atualizado' });
  };

  const handleDeleteProject = async (projectIdToDelete) => {
    if (!user) return;
    const { error } = await supabase
      .from('neurodesign_projects')
      .delete()
      .eq('id', projectIdToDelete)
      .eq('owner_user_id', user.id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    const remaining = projects.filter((p) => p.id !== projectIdToDelete);
    setProjects(remaining);
    if (selectedProject?.id === projectIdToDelete) {
      setSelectedProject(remaining[0] || null);
      setRuns([]);
      setImages([]);
      setSelectedImage(null);
      setCurrentConfig(null);
      if (remaining.length === 0) await ensureOneGallery();
    }
    toast({ title: 'Galeria excluída' });
  };

  const handleCreateProject = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('neurodesign_projects')
        .insert({ name: 'Nova Galeria', owner_user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      setProjects((prev) => [data, ...prev]);
      setSelectedProject(data);
      setRuns([]);
      setImages([]);
      setSelectedImage(null);
      setCurrentConfig(null);
      toast({ title: 'Galeria criada', description: 'Nova galeria pronta para usar.' });
    } catch (e) {
      toast({ title: 'Erro ao criar galeria', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <Helmet>
        <title>NeuroDesign - Neuro Ápice</title>
        <meta name="description" content="Design Builder premium: crie imagens com controle total de composição." />
      </Helmet>
      <NeuroDesignErrorBoundary>
      <div className="flex h-[calc(100vh-4rem)] min-h-[400px] bg-muted/40 text-foreground overflow-hidden min-w-0">
        {isLg && (
          <NeuroDesignSidebar
            view={view}
            setView={setView}
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
            onCreateProject={handleCreateProject}
            onRenameProject={handleRenameProject}
            onDeleteProject={handleDeleteProject}
            onCloseDrawer={undefined}
            wrapperClassName={undefined}
          />
        )}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden min-h-0">
          {!isLg && (
            <div className="flex items-center gap-2 p-2 border-b border-border shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="border-border hover:bg-muted"
                onClick={() => setSidebarDrawerOpen(true)}
              >
                <FolderOpen className="h-4 w-4 mr-1" />
                Navegação
              </Button>
              {view === 'create' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border hover:bg-muted"
                  onClick={() => setBuilderDrawerOpen(true)}
                >
                  <PanelLeft className="h-4 w-4 mr-1" />
                  Configurações
                </Button>
              )}
            </div>
          )}
          {view === 'create' && (
            <div className="flex flex-1 min-w-0 min-h-0">
              {isLg && (
                <div className="w-[420px] xl:w-[480px] shrink-0 overflow-y-auto border-r border-border bg-card min-h-0">
                  <BuilderPanel
                    project={selectedProject}
                    config={currentConfig}
                    setConfig={setCurrentConfig}
                    imageConnections={imageConnections}
                    onGenerate={handleGenerate}
                    isGenerating={isGenerating}
                    onFillFromPrompt={handleFillFromPrompt}
                    hasLlmConnection={llmConnections.length > 0}
                    isFillingFromPrompt={isFillingFromPrompt}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col">
                <PreviewPanel
                  project={selectedProject}
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
          )}
          {view === 'gallery' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
              <MasonryGallery
                images={images}
                projectId={selectedProject?.id}
                selectedIds={selectedImage ? [selectedImage.id] : []}
                onSelectImage={setSelectedImage}
                onDownload={downloadHandler}
              />
            </div>
          )}
        </main>
      </div>

      {/* Drawer Navegação (mobile/tablet) */}
      <Dialog open={sidebarDrawerOpen} onOpenChange={setSidebarDrawerOpen}>
        <DialogContent
          className="fixed left-0 top-0 h-full w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-r border-border p-0 gap-0 flex flex-col bg-card data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <NeuroDesignSidebar
            view={view}
            setView={setView}
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
            onCreateProject={handleCreateProject}
            onRenameProject={handleRenameProject}
            onDeleteProject={handleDeleteProject}
            onCloseDrawer={() => setSidebarDrawerOpen(false)}
            wrapperClassName="w-full h-full border-0 bg-transparent flex flex-col"
          />
        </DialogContent>
      </Dialog>

      {/* Drawer Configurações (mobile/tablet) */}
      <Dialog open={builderDrawerOpen} onOpenChange={setBuilderDrawerOpen}>
        <DialogContent
          className="fixed left-0 top-0 h-full w-full max-w-md translate-x-0 translate-y-0 rounded-none border-r border-border p-0 gap-0 grid-rows-auto bg-card data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left overflow-hidden flex flex-col"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="p-4 border-b border-border shrink-0">
            <h3 className="font-semibold text-foreground">Configurações de geração</h3>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0 pb-[env(safe-area-inset-bottom)]">
            <BuilderPanel
              project={selectedProject}
                    config={currentConfig}
                    setConfig={setCurrentConfig}
                    imageConnections={imageConnections}
                    onGenerate={(config) => {
                handleGenerate(config);
                setBuilderDrawerOpen(false);
              }}
              isGenerating={isGenerating}
              onFillFromPrompt={handleFillFromPrompt}
              hasLlmConnection={llmConnections.length > 0}
              isFillingFromPrompt={isFillingFromPrompt}
            />
          </div>
        </DialogContent>
      </Dialog>
      </NeuroDesignErrorBoundary>
    </>
  );
};

export default NeuroDesignPage;
