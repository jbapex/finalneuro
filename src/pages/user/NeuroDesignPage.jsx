import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { FolderOpen, PanelLeft, Upload } from 'lucide-react';
import NeuroDesignSidebar from '@/components/neurodesign/NeuroDesignSidebar';
import BuilderPanel from '@/components/neurodesign/BuilderPanel';
import PreviewPanel from '@/components/neurodesign/PreviewPanel';
import MasonryGallery from '@/components/neurodesign/MasonryGallery';
import NeuroDesignErrorBoundary from '@/components/neurodesign/NeuroDesignErrorBoundary';
import { getDefaultAiConnection } from '@/lib/userAiDefaults';
import { uploadNeuroDesignFile } from '@/lib/neurodesignStorage';
import { useNeurodesignExpiredCleanup } from '@/hooks/useNeurodesignExpiredCleanup';

import { getFriendlyErrorMessage } from '@/lib/utils';
import { NEURODESIGN_CHAT_FILL_STORAGE_KEY } from '@/lib/neurodesign/chatBridge';

const NeuroDesignPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [builderFillSeed, setBuilderFillSeed] = useState(undefined);
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
  const [userGalleryPage, setUserGalleryPage] = useState(0);
  const [userGalleryHasMore, setUserGalleryHasMore] = useState(true);
  const [isLoadingUserGallery, setIsLoadingUserGallery] = useState(false);
  const [isGalleryPreviewOpen, setIsGalleryPreviewOpen] = useState(false);
  const [isUploadingRefineSource, setIsUploadingRefineSource] = useState(false);
  const refineUploadInputRef = useRef(null);
  const isLg = useMediaQuery('(min-width: 1024px)');
  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);
  const [builderDrawerOpen, setBuilderDrawerOpen] = useState(false);
  /** undefined = seguir `currentConfig.user_ai_connection_id`; null = mock explícito; string = conexão escolhida no refinamento */
  const [refineConnectionOverride, setRefineConnectionOverride] = useState(undefined);

  useEffect(() => {
    const st = location.state;
    const fromState = st && typeof st.neuroChatFillPrompt === 'string' ? st.neuroChatFillPrompt.trim() : '';
    if (fromState) {
      setBuilderFillSeed(fromState);
      setView('create');
      if (!isLg) setBuilderDrawerOpen(true);
      navigate(`${location.pathname}${location.search || ''}`, {
        replace: true,
        state: st && typeof st === 'object' ? { ...st, neuroChatFillPrompt: undefined } : {},
      });
      toast({
        title: 'Brief do Chat IA',
        description: 'Revise o texto em Preencher com IA e clique em Preencher campos quando quiser.',
      });
      return;
    }
    try {
      const v = sessionStorage.getItem(NEURODESIGN_CHAT_FILL_STORAGE_KEY);
      if (v != null && v !== '') {
        sessionStorage.removeItem(NEURODESIGN_CHAT_FILL_STORAGE_KEY);
        setBuilderFillSeed(v);
        setView('create');
        if (!isLg) setBuilderDrawerOpen(true);
        toast({
          title: 'Brief do Chat IA',
          description: 'Texto colocado em Preencher com IA.',
        });
      }
    } catch {
      /* ignore */
    }
  }, [location.key, location.pathname, location.search, navigate, toast, isLg]);

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
      const list = (data || []).filter((c) => c.capabilities?.image_generation);
      const preferred = getDefaultAiConnection(user.id, 'image');
      if (preferred) {
        list.sort((a, b) => (String(a.id) === String(preferred) ? -1 : String(b.id) === String(preferred) ? 1 : 0));
      }
      setImageConnections(list);
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
      const preferred = getDefaultAiConnection(user.id, 'llm');
      if (preferred) {
        list.sort((a, b) => (String(a.id) === String(preferred) ? -1 : String(b.id) === String(preferred) ? 1 : 0));
      }
      setLlmConnections(list);
      setSelectedLlmId((prev) => (list.length > 0 && (!prev || !list.some((c) => String(c.id) === String(prev))) ? list[0].id : prev));
    } catch (_e) {
      setLlmConnections([]);
    }
  }, [user]);

  useEffect(() => {
    if (!selectedProject) return;
    if (!imageConnections.length) return;
    const preferred = getDefaultAiConnection(user?.id, 'image');
    setCurrentConfig((prev) => {
      const current = prev?.user_ai_connection_id;
      if (current && current !== 'none' && imageConnections.some((c) => String(c.id) === String(current))) {
        return prev;
      }
      const fallback = imageConnections.find((c) => String(c.id) === String(preferred)) || imageConnections[0];
      if (!fallback?.id) return prev;
      return { ...(prev || {}), user_ai_connection_id: fallback.id };
    });
  }, [selectedProject, imageConnections, user?.id]);

  const fetchRuns = useCallback(async (projectId) => {
    if (!projectId) return;
    const { data, error } = await supabase
      .from('neurodesign_generation_runs')
      .select('id, project_id, config_id, type, status, provider, error_message, created_at, updated_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) return;
    setRuns(data || []);
  }, []);

  const fetchImages = useCallback(async (projectId) => {
    if (!projectId) return;
    const { data, error } = await supabase
      .from('neurodesign_generated_images')
      .select('id, run_id, project_id, url, thumbnail_url, width, height, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Erro ao carregar galeria', description: error.message, variant: 'destructive' });
      return;
    }
    setImages(data || []);
  }, [toast]);

  const USER_GALLERY_PAGE_SIZE = 60;

  const loadUserGalleryImages = useCallback(async (page = 0, { reset = false } = {}) => {
    if (!user) return;
    const projectIds = projects.map((p) => p.id).filter(Boolean);
    if (projectIds.length === 0) {
      if (reset) {
        setImages([]);
        setUserGalleryPage(0);
        setUserGalleryHasMore(false);
      }
      return;
    }
    setIsLoadingUserGallery(true);
    try {
      const from = page * USER_GALLERY_PAGE_SIZE;
      const to = from + USER_GALLERY_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('neurodesign_generated_images')
        .select('id, run_id, project_id, url, thumbnail_url, width, height, created_at')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) {
        toast({
          title: 'Erro ao carregar Minha Galeria',
          description: error.message,
          variant: 'destructive',
        });
        if (reset) {
          setImages([]);
          setUserGalleryPage(0);
          setUserGalleryHasMore(false);
        }
        return;
      }
      const batch = data || [];
      if (reset) {
        setImages(batch);
      } else {
        setImages((prev) => {
          const existingIds = new Set(prev.map((img) => img.id));
          const merged = [...prev];
          batch.forEach((img) => {
            if (!existingIds.has(img.id)) merged.push(img);
          });
          return merged;
        });
      }
      setUserGalleryPage(page + 1);
      setUserGalleryHasMore(batch.length === USER_GALLERY_PAGE_SIZE);
    } finally {
      setIsLoadingUserGallery(false);
    }
  }, [user, projects, toast]);

  useEffect(() => {
    ensureOneGallery();
    fetchImageConnections();
    fetchLlmConnections();
  }, [ensureOneGallery, fetchImageConnections, fetchLlmConnections]);

  useEffect(() => {
    if (selectedProject) {
      setCurrentConfig(null);
      setSelectedImage(null);
      setRefineConnectionOverride(undefined);
      fetchRuns(selectedProject.id);
      fetchImages(selectedProject.id);
    } else {
      setRuns([]);
      setImages([]);
      setCurrentConfig(null);
      setSelectedImage(null);
    }
  }, [selectedProject, fetchRuns, fetchImages]);

  useEffect(() => {
    if (view === 'gallery') {
      setUserGalleryPage(0);
      setUserGalleryHasMore(true);
      loadUserGalleryImages(0, { reset: true });
    } else if (view === 'create' && selectedProject?.id) {
      fetchImages(selectedProject.id);
    }
  }, [view, loadUserGalleryImages, fetchImages, selectedProject?.id]);

  useNeurodesignExpiredCleanup({
    enabled: Boolean(user?.id),
    images,
    setImages,
    setSelectedImage,
  });

  const effectiveRefineUserAiConnectionId = useMemo(() => {
    if (refineConnectionOverride !== undefined) return refineConnectionOverride;
    return currentConfig?.user_ai_connection_id ?? null;
  }, [refineConnectionOverride, currentConfig?.user_ai_connection_id]);

  const refineConnectionSelectValue = useMemo(() => {
    if (refineConnectionOverride === undefined) return '__inherit__';
    if (refineConnectionOverride === null) return 'none';
    return String(refineConnectionOverride);
  }, [refineConnectionOverride]);

  const builderConnForInherit = useMemo(() => {
    const id = currentConfig?.user_ai_connection_id;
    if (!id) return null;
    return imageConnections.find((c) => String(c.id) === String(id)) || null;
  }, [currentConfig?.user_ai_connection_id, imageConnections]);

  const builderInheritHint = useMemo(() => {
    if (!currentConfig?.user_ai_connection_id) return 'mock / demonstração';
    if (builderConnForInherit) {
      return `${builderConnForInherit.name}${builderConnForInherit.provider ? ` (${builderConnForInherit.provider})` : ''}`;
    }
    return 'conexão salva no projeto';
  }, [currentConfig?.user_ai_connection_id, builderConnForInherit]);

  const hasRefineImageConnection = !!(
    effectiveRefineUserAiConnectionId &&
    effectiveRefineUserAiConnectionId !== 'none'
  );

  const handleRefineConnectionSelect = useCallback((v) => {
    if (v === '__inherit__') setRefineConnectionOverride(undefined);
    else if (v === 'none') setRefineConnectionOverride(null);
    else setRefineConnectionOverride(v);
  }, []);

  const handleGenerate = async (config) => {
    if (generatingRef.current) return;
    if (!selectedProject) {
      toast({
        title: 'Não foi possível carregar seu projeto interno.',
        description: 'Recarregue a página e tente novamente.',
        variant: 'destructive',
      });
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
      const friendlyMsg = getFriendlyErrorMessage(e);
      toast({
        title: 'Aviso',
        description: is429
          ? 'Limite de uso da API Google (429) atingido. Aguarde alguns minutos ou verifique seu plano e uso em https://ai.google.dev/gemini-api/docs/rate-limits'
          : friendlyMsg,
        variant: 'destructive',
      });
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  };

  const handleDeleteImage = async (image) => {
    if (!image?.id) return;
    const confirmDelete = window.confirm('Excluir esta arte da sua galeria? Esta ação não pode ser desfeita.');
    if (!confirmDelete) return;
    try {
      const { error } = await supabase
        .from('neurodesign_generated_images')
        .delete()
        .eq('id', image.id);
      if (error) throw error;
      setImages((prev) => prev.filter((img) => img.id !== image.id));
      if (selectedImage?.id === image.id) {
        setSelectedImage(null);
        setIsGalleryPreviewOpen(false);
      }
      toast({ title: 'Arte excluída com sucesso.' });
    } catch (e) {
      toast({
        title: 'Erro ao excluir arte',
        description: e?.message || 'Não foi possível excluir esta arte. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleUploadRefineSource = async (files) => {
    const file = files?.[0];
    if (!file) return;
    if (!selectedProject?.id || !user?.id) {
      toast({ title: 'Selecione uma galeria antes de enviar a imagem', variant: 'destructive' });
      return;
    }
    setIsUploadingRefineSource(true);
    try {
      const sourceUrl = await uploadNeuroDesignFile(user.id, selectedProject.id, 'refine_source', file);
      const { data: runData, error: runError } = await supabase
        .from('neurodesign_generation_runs')
        .insert({
          project_id: selectedProject.id,
          type: 'generate',
          status: 'success',
          provider: 'manual_upload',
        })
        .select('id')
        .single();
      if (runError || !runData?.id) throw runError || new Error('Falha ao criar execução da imagem enviada.');

      const { data: imageData, error: imageError } = await supabase
        .from('neurodesign_generated_images')
        .insert({
          run_id: runData.id,
          project_id: selectedProject.id,
          url: sourceUrl,
          thumbnail_url: sourceUrl,
        })
        .select('id, run_id, project_id, url, thumbnail_url, width, height, created_at')
        .single();
      if (imageError || !imageData?.id) throw imageError || new Error('Falha ao registrar imagem enviada.');

      setSelectedImage(imageData);
      setImages((prev) => [imageData, ...prev.filter((img) => img.id !== imageData.id)]);
      toast({ title: 'Imagem carregada', description: 'Agora você pode usar o painel de refinamento.' });
      fetchRuns(selectedProject.id).catch(() => {});
    } catch (e) {
      toast({
        title: 'Erro ao enviar imagem',
        description: e?.message || 'Não foi possível preparar a imagem para refinamento.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingRefineSource(false);
      if (refineUploadInputRef.current) refineUploadInputRef.current.value = '';
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
        userAiConnectionId: effectiveRefineUserAiConnectionId || null,
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

      const refineConn = imageConnections.find((c) => String(c.id) === String(effectiveRefineUserAiConnectionId));
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
      const friendlyMsg = getFriendlyErrorMessage(e);
      toast({
        title: 'Aviso',
        description: is429
          ? 'Limite de uso da API Google (429) atingido. Aguarde alguns minutos ou verifique seu plano em https://ai.google.dev/gemini-api/docs/rate-limits'
          : isNetwork
            ? 'Falha de conexão. Verifique sua internet e se as funções do Supabase estão publicadas e ativas.'
            : friendlyMsg,
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
    'subject_enabled', 'subject_mode', 'subject_gender', 'subject_description', 'quantity', 'niche_project', 'environment',
    'shot_type', 'layout_position', 'dimensions', 'image_size', 'use_scenario_photos',
    'text_enabled', 'text_mode', 'custom_text', 'custom_text_font_description', 'use_reference_image_text', 'headline_h1', 'subheadline_h2', 'cta_button_text', 'text_position', 'text_gradient',
    'headline_zone', 'subheadline_zone', 'cta_zone',
    'headline_position', 'subheadline_position', 'cta_position',
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
    subject_mode: ['person', 'product'],
    subject_gender: ['masculino', 'feminino'],
    shot_type: ['close-up', 'medio busto', 'americano'],
    layout_position: ['esquerda', 'centro', 'direita'],
    dimensions: ['1:1', '4:5', '9:16', '16:9'],
    text_position: ['esquerda', 'centro', 'direita'],
    headline_position: ['esquerda', 'centro', 'direita'],
    subheadline_position: ['esquerda', 'centro', 'direita'],
    cta_position: ['esquerda', 'centro', 'direita'],
    text_mode: ['structured', 'free'],
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
ESTÉTICA PROFISSIONAL (brief de social/ads, agência, posicionamento, "não parecer IA"):
- Defina ultra_realistic: true e sobriety entre 75 e 95 (mais profissional, menos "arte genérica").
- Se o brief mencionar retrato com fundo desfocado, evento ou palco: blur_enabled: true.
- Em additional_prompt coloque APENAS complementos técnicos (luz, textura, composição, o que evitar). O sistema irá anexar automaticamente o texto integral colado pelo usuário antes da geração — não precisa copiar o brief inteiro nesse campo.
Chaves e valores (use exatamente assim no JSON quando preencher):
- subject_enabled: true ou false (há figura humana na arte?)
- subject_mode: "person" (pessoa/retrato) ou "product" (produto/objeto sem pessoa)
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
- text_enabled: true ou false. Se true: headline_h1, subheadline_h2, cta_button_text (strings). Para texto corrido/parágrafo use text_mode "free" e custom_text.
- text_mode: "structured" ou "free". Use "free" quando o brief pedir texto corrido, parágrafo ou bloco na imagem (ex.: card, post); use "structured" para título, subtítulo e botão (headline, subheadline, CTA).
- custom_text: string; quando text_mode for "free", o texto completo a aparecer na imagem.
- custom_text_font_description: string opcional; descrição da fonte (ex.: "sans serifa, negrito", "moderna").
- use_reference_image_text: boolean; true se o brief indicar que o texto deve ser copiado/extraído da imagem de referência.
- text_position: "esquerda" ou "centro" ou "direita"
- headline_zone, subheadline_zone, cta_zone: posição do texto no quadro. Valores: "top-left", "top-center", "top-right", "center-left", "center", "center-right", "bottom-left", "bottom-center", "bottom-right"
- headline_position, subheadline_position, cta_position: fallback legado "esquerda", "centro" ou "direita" (use se não houver zona ou o brief pedir alinhamento simples)
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
      const BOOL_KEYS = new Set(['text_enabled', 'text_gradient', 'floating_elements_enabled', 'subject_enabled', 'use_scenario_photos', 'use_reference_image_text', 'headline_shape_enabled', 'subheadline_shape_enabled', 'cta_shape_enabled', 'text_shape_enabled']);
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
        const briefOriginal = trimmed.trim();
        const llmExtra = sanitized.additional_prompt != null ? String(sanitized.additional_prompt).trim() : '';
        const combinedAp = [
          'BRIEF ORIGINAL (texto integral de Preencher com IA):',
          briefOriginal,
          llmExtra ? `--- NOTAS TÉCNICAS EXTRAÍDAS (luz, composição, estilo) ---\n${llmExtra}` : '',
        ].filter(Boolean).join('\n\n');
        merged.additional_prompt = combinedAp.slice(0, 80000);
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
      <div className="flex h-[calc(100vh-4rem)] min-h-[400px] bg-background text-foreground overflow-hidden min-w-0">
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
                  variant="secondary"
                  size="sm"
                  className="shrink-0 font-semibold border border-primary/30 bg-primary/10 text-foreground hover:bg-primary/15 shadow-sm"
                  onClick={() => setBuilderDrawerOpen(true)}
                >
                  <PanelLeft className="h-4 w-4 mr-1.5 shrink-0" />
                  <span className="whitespace-nowrap">Configurações</span>
                </Button>
              )}
              {view === 'refine' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border hover:bg-muted"
                  onClick={() => refineUploadInputRef.current?.click()}
                  disabled={isUploadingRefineSource}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {isUploadingRefineSource ? 'Enviando...' : 'Enviar imagem'}
                </Button>
              )}
            </div>
          )}
          {view === 'create' && (
            <div className="flex flex-1 min-w-0 min-h-0">
              {isLg && (
                <div className="w-[420px] xl:w-[480px] shrink-0 overflow-y-auto border-r border-border bg-background min-h-0">
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
                    selectedLlmId={selectedLlmId}
                    seedFillPrompt={builderFillSeed}
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
                  hasImageConnection={hasRefineImageConnection}
                  imageConnections={imageConnections}
                  refineConnectionSelectValue={refineConnectionSelectValue}
                  onRefineConnectionChange={handleRefineConnectionSelect}
                  builderInheritHint={builderInheritHint}
                />
              </div>
            </div>
          )}
          {view === 'gallery' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
              <p className="text-sm text-muted-foreground mb-4">
                Todas as artes que você já gerou no NeuroDesign.
              </p>
              <MasonryGallery
                images={images}
                projectId={selectedProject?.id}
                userGalleryMode={true}
                selectedIds={selectedImage ? [selectedImage.id] : []}
                onSelectImage={(img) => {
                  setSelectedImage(img);
                  setIsGalleryPreviewOpen(true);
                }}
                onDownload={downloadHandler}
                onDeleteImage={handleDeleteImage}
              />
              {userGalleryHasMore && (
                <div className="mt-6 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadUserGalleryImages(userGalleryPage, { reset: false })}
                    disabled={isLoadingUserGallery}
                  >
                    {isLoadingUserGallery ? 'Carregando...' : 'Carregar mais'}
                  </Button>
                </div>
              )}
            </div>
          )}
          {view === 'refine' && (
            <div className="flex flex-1 min-w-0 min-h-0">
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="px-4 pt-4 sm:px-6">
                  <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      Envie uma imagem base para refinar, ou selecione uma arte já existente abaixo.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => refineUploadInputRef.current?.click()}
                      disabled={isUploadingRefineSource}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      {isUploadingRefineSource ? 'Enviando...' : 'Upload para refinamento'}
                    </Button>
                  </div>
                </div>
                <PreviewPanel
                  project={selectedProject}
                  user={user}
                  selectedImage={selectedImage}
                  images={images}
                  isGenerating={false}
                  isRefining={isRefining}
                  onRefine={handleRefine}
                  onDownload={downloadHandler}
                  onSelectImage={setSelectedImage}
                  hasImageConnection={hasRefineImageConnection}
                  imageConnections={imageConnections}
                  refineConnectionSelectValue={refineConnectionSelectValue}
                  onRefineConnectionChange={handleRefineConnectionSelect}
                  builderInheritHint={builderInheritHint}
                  emptyStateTitle="Aguardando imagem para refinamento"
                  emptyStateDescription="Faça upload de uma imagem ou selecione uma arte nas miniaturas. Escolha a conexão de imagem acima do preview se o builder não tiver uma selecionada."
                />
              </div>
            </div>
          )}
        </main>
      </div>
      <input
        ref={refineUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleUploadRefineSource(e.target.files)}
      />

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
          <div className="p-4 border-b border-border shrink-0 space-y-1">
            <h3 className="font-semibold text-foreground">Configurações de geração</h3>
            <p className="text-xs text-muted-foreground">
              Texto, sujeito, referências e geração. Ative <strong className="text-foreground">Texto na imagem</strong> para ver gradiente e CTA.
            </p>
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
              selectedLlmId={selectedLlmId}
              seedFillPrompt={builderFillSeed}
            />
          </div>
        </DialogContent>
      </Dialog>
      {/* Preview de imagem da Minha Galeria */}
      <Dialog open={isGalleryPreviewOpen && !!selectedImage} onOpenChange={setIsGalleryPreviewOpen}>
        <DialogContent className="max-w-3xl w-full">
          {selectedImage && (
            <div className="space-y-4">
              <div className="w-full rounded-lg overflow-hidden bg-black/80">
                <img
                  src={selectedImage.url || selectedImage.thumbnail_url}
                  alt=""
                  className="w-full h-auto max-h-[70vh] object-contain"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => downloadHandler(selectedImage.url || selectedImage.thumbnail_url)}
                >
                  Baixar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteImage(selectedImage)}
                >
                  Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </NeuroDesignErrorBoundary>
    </>
  );
};

export default NeuroDesignPage;
