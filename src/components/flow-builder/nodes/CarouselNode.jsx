import React, { memo, useState, useEffect, useMemo, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LayoutGrid, Settings2, ImageIcon, ChevronDown, ChevronRight, Sparkles, Play, Loader2, Paintbrush, Expand, Download, SlidersHorizontal, Pencil } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { mergeFlowInputDataIntoConfig, filterOverridesByDisabledSupportTypes } from '@/lib/neurodesign/flowConfigMerge';
import { neuroDesignDefaultConfig } from '@/lib/neurodesign/defaultConfig';
import { sanitizeNeuroDesignConfigFromAI } from '@/lib/neurodesign/sanitizeConfigFromAI';
import NeuroDesignFlowModal from '@/components/flow-builder/modals/NeuroDesignFlowModal';
import RefineImageModal from '@/components/flow-builder/modals/RefineImageModal';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

const MIN_SLIDES = 3;
const MAX_SLIDES = 7;

const DIMENSION_OPTIONS = [
  { value: '1:1', label: '1:1' },
  { value: '4:5', label: '4:5' },
  { value: '9:16', label: '9:16' },
  { value: '16:9', label: '16:9' },
];

const QUALITY_OPTIONS = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
];

/** Monta prompt de contexto a partir do inputData (igual ao ImageGenerator) */
function buildContextPromptForImage(inputData) {
  if (!inputData || typeof inputData !== 'object') return '';
  const parts = [];
  const agentOut = inputData.agent?.data;
  const contentOut = inputData.generated_content?.data;
  const agentText = typeof agentOut === 'string' ? agentOut : (agentOut && (agentOut.generatedText || agentOut.text));
  const contentText = typeof contentOut === 'string' ? contentOut : null;
  if (agentText) parts.push(String(agentText).trim());
  if (contentText && contentText !== agentText) parts.push(String(contentText).trim());
  if (inputData.knowledge?.data) {
    const k = inputData.knowledge.data;
    parts.push(typeof k === 'string' ? k : JSON.stringify(k, null, 2));
  }
  const contexts = inputData.context?.data?.contexts || inputData.client?.data?.client_contexts;
  if (Array.isArray(contexts) && contexts.length) {
    const block = contexts.map((c) => (c.name ? `[${c.name}]\n${c.content || ''}` : (c.content || ''))).join('\n\n---\n\n');
    parts.push(block);
  }
  if (inputData.client?.data) {
    const { client_contexts, ...rest } = inputData.client.data;
    if (Object.keys(rest).length) parts.push('Cliente: ' + JSON.stringify(rest, null, 2));
  }
  if (inputData.campaign?.data) {
    parts.push('Campanha: ' + JSON.stringify(inputData.campaign.data, null, 2));
  }
  return parts.filter(Boolean).join('\n\n');
}

/** Texto completo dos nós conectados para preenchimento de lâminas (Preencher a partir do conteúdo e Preencher com IA). */
function getFullContentForSlides(inputData) {
  if (!inputData || typeof inputData !== 'object') return '';
  const parts = [];
  const contentText = getContentTextFromInputData(inputData);
  if (contentText) parts.push(contentText);
  if (inputData.knowledge?.data) {
    const k = inputData.knowledge.data;
    parts.push(typeof k === 'string' ? k : JSON.stringify(k, null, 2));
  }
  const contexts = inputData.context?.data?.contexts || inputData.client?.data?.client_contexts;
  if (Array.isArray(contexts) && contexts.length) {
    const block = contexts.map((c) => (c.name ? `[${c.name}]\n${c.content || ''}` : (c.content || ''))).join('\n\n---\n\n');
    parts.push(block);
  }
  if (inputData.client?.data) {
    const { client_contexts, ...rest } = inputData.client.data;
    if (Object.keys(rest).length) parts.push('Cliente: ' + JSON.stringify(rest, null, 2));
  }
  if (inputData.campaign?.data) {
    parts.push('Campanha: ' + JSON.stringify(inputData.campaign.data, null, 2));
  }
  return parts.filter(Boolean).join('\n\n');
}

/** Extrai texto de agent ou generated_content para parsing */
function getContentTextFromInputData(inputData) {
  if (!inputData || typeof inputData !== 'object') return '';
  const parts = [];
  const agentOut = inputData.agent?.data;
  const contentOut = inputData.generated_content?.data;
  const agentText = typeof agentOut === 'string' ? agentOut : (agentOut && (agentOut.generatedText || agentOut.text));
  const contentText = typeof contentOut === 'string' ? contentOut : null;
  if (agentText) parts.push(String(agentText).trim());
  if (contentText && contentText !== agentText) parts.push(String(contentText).trim());
  for (let i = 2; i <= 5; i++) {
    const key = `agent_${i}`;
    const extra = inputData[key]?.data;
    const t = typeof extra === 'string' ? extra : (extra && (extra.generatedText || extra.text));
    if (t) parts.push(String(t).trim());
  }
  return parts.filter(Boolean).join('\n\n');
}

/** Lista tipos de suporte ao Neuro Designer conectados (a partir de inputData). */
function getConnectedSupportTypes(inputData) {
  if (!inputData || typeof inputData !== 'object') return [];
  const supportLabels = {
    reference_image: 'Imagem de referência',
    image_logo: 'Logo',
    colors: 'Cores',
    styles: 'Estilos',
    subject: 'Sujeito principal',
  };
  const found = new Set();
  for (const key of Object.keys(inputData)) {
    if (key === 'reference_image' || /^reference_image_\d+$/.test(key)) {
      if (inputData[key]?.data) found.add('reference_image');
    } else if (key === 'image_logo' || /^image_logo(_\d+)?$/.test(key)) {
      if (inputData[key]?.data?.logo_url) found.add('image_logo');
    } else if (key === 'colors' && inputData.colors?.data) {
      found.add('colors');
    } else if (key === 'styles' && inputData.styles?.data) {
      found.add('styles');
    } else if (key === 'subject' && inputData.subject?.data) {
      found.add('subject');
    }
  }
  return Array.from(found).map((id) => ({ id, label: supportLabels[id] || id }));
}

/** Monta resumo legível de todos os nós upstream */
function buildUpstreamSummary(inputData) {
  if (!inputData || typeof inputData !== 'object') return { lines: [], contentText: '' };
  const lines = [];
  const client = inputData.client?.data;
  if (client && (client.name || client.about)) {
    lines.push({ label: 'Cliente', text: client.name || client.about || JSON.stringify(client) });
  }
  const campaign = inputData.campaign?.data;
  if (campaign) {
    const name = campaign.name || (typeof campaign === 'string' ? campaign : 'Campanha');
    lines.push({ label: 'Campanha', text: name });
  }
  const context = inputData.context?.data?.contexts || inputData.client?.data?.client_contexts;
  if (Array.isArray(context) && context.length) {
    const block = context.map((c) => (c.name ? `[${c.name}] ${(c.content || '').slice(0, 200)}` : (c.content || '').slice(0, 200))).join(' | ');
    lines.push({ label: 'Contexto', text: block });
  }
  const contentText = getContentTextFromInputData(inputData);
  if (contentText) {
    lines.push({ label: 'Conteúdo (agente/resultado)', text: contentText.slice(0, 500) + (contentText.length > 500 ? '…' : '') });
  }
  // Ferramentas avançadas (referência de estilo, cores, logo, estilos, sujeito)
  const refCount = Object.keys(inputData).filter((k) => k === 'reference_image' || /^reference_image_\d+$/.test(k)).filter((k) => inputData[k]?.data).length;
  if (refCount > 0) {
    lines.push({ label: 'Imagem de referência', text: refCount === 1 ? 'Referência de estilo conectada' : `${refCount} referências de estilo` });
  }
  const colorsData = inputData.colors?.data;
  if (colorsData && (colorsData.ambient_color || colorsData.rim_light_color || colorsData.fill_light_color)) {
    const parts = [colorsData.ambient_color, colorsData.rim_light_color, colorsData.fill_light_color].filter(Boolean).map((c) => (c && c.trim() ? c.trim() : null)).filter(Boolean);
    lines.push({ label: 'Cores', text: parts.length ? `Luz ambiente, recorte, preenchimento (${parts.join(', ')})` : 'Luz ambiente, recorte, preenchimento' });
  }
  if (inputData.image_logo?.data?.logo_url || inputData.image_logo_2?.data?.logo_url) {
    lines.push({ label: 'Logo', text: 'Logo conectada' });
  }
  if (inputData.styles?.data) {
    lines.push({ label: 'Estilos', text: 'Estilos visuais conectados' });
  }
  const subjectData = inputData.subject?.data;
  if (subjectData && (subjectData.subject_gender || subjectData.subject_description || (Array.isArray(subjectData.subject_image_urls) && subjectData.subject_image_urls.length))) {
    const parts = [];
    if (subjectData.subject_gender === 'masculino' || subjectData.subject_gender === 'feminino') parts.push(subjectData.subject_gender === 'masculino' ? 'Homem' : 'Mulher');
    if (subjectData.subject_description?.trim()) parts.push(subjectData.subject_description.trim().slice(0, 80) + (subjectData.subject_description.length > 80 ? '…' : ''));
    if (Array.isArray(subjectData.subject_image_urls) && subjectData.subject_image_urls.length) parts.push(`${subjectData.subject_image_urls.length} foto(s) de rosto`);
    lines.push({ label: 'Sujeito principal', text: parts.length ? parts.join(' · ') : 'Sujeito conectado' });
  }
  return { lines, contentText };
}

/** Parse do texto para extrair estrutura de slides (Slide 1:, Lâmina 1:, ## 1., etc.) */
function parseSlidesFromContent(text) {
  if (!text || typeof text !== 'string') return { numSlides: MIN_SLIDES, slidePrompts: [] };
  const trimmed = text.trim();
  if (!trimmed) return { numSlides: MIN_SLIDES, slidePrompts: [] };

  const patterns = [
    /^(?:slide|lamina|lâmina)\s*(\d+)\s*[:\-]\s*(.*)/gim,
    /^##\s*(?:slide|lamina|lâmina)?\s*(\d+)[.\s]*(.*)/gim,
    /^\*\*Slide\s*(\d+)\*\*[.\s]*(.*)/gim,
    /^(\d+)\.\s+(.*)/gm,
  ];

  let best = { numSlides: MIN_SLIDES, slidePrompts: [] };
  for (const regex of patterns) {
    const prompts = [];
    let lastIndex = 0;
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(trimmed)) !== null) {
      const num = parseInt(match[1], 10);
      const rest = (match[2] || '').trim();
      if (num >= 1 && num <= MAX_SLIDES) {
        while (prompts.length < num) prompts.push('');
        prompts[num - 1] = rest;
        lastIndex = regex.lastIndex;
      }
    }
    if (prompts.length > 0 && prompts.some(Boolean)) {
      const filled = prompts.filter(Boolean).length;
      if (filled > best.slidePrompts.filter(Boolean).length) {
        best = {
          numSlides: Math.max(MIN_SLIDES, Math.min(MAX_SLIDES, prompts.length)),
          slidePrompts: prompts.slice(0, MAX_SLIDES),
        };
      }
    }
  }

  if (best.slidePrompts.filter(Boolean).length === 0) {
    const paragraphs = trimmed.split(/\n\s*\n/).filter(Boolean);
    const n = Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, Math.min(paragraphs.length, MAX_SLIDES)));
    const perSlide = Math.ceil(paragraphs.length / n);
    const slidePrompts = Array.from({ length: n }, (_, i) => {
      const start = i * perSlide;
      const end = Math.min(start + perSlide, paragraphs.length);
      return paragraphs.slice(start, end).join('\n\n').trim();
    });
    return { numSlides: n, slidePrompts };
  }

  return best;
}

/** Extrai JSON da resposta da IA (pode vir em bloco markdown) */
function extractJsonFromResponse(str) {
  if (!str || typeof str !== 'string') return null;
  str = str.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
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

const CarouselNode = memo(({ data, id }) => {
  const { onUpdateNodeData, inputData, onAddCarouselSlideImageNode, getFreshInputData } = data;
  const { toast } = useToast();
  const { user } = useAuth();
  const numSlides = Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, data.numSlides ?? 5));
  const orientations = Array.isArray(data.orientations) ? data.orientations : [];
  const slides = Array.isArray(data.slides) ? data.slides : [];
  const lastConsumedOutputId = data.lastConsumedOutputId ?? null;
  const [configOpen, setConfigOpen] = useState(data.configOpen ?? false);
  const [dataCollapsed, setDataCollapsed] = useState(true);
  const [dimensions, setDimensions] = useState(data.dimensions ?? '1:1');
  const [imageSize, setImageSize] = useState(data.imageSize ?? '1K');
  const [imageConnections, setImageConnections] = useState([]);
  const [selectedImageConnectionId, setSelectedImageConnectionId] = useState(data.selectedImageConnectionId ?? null);
  const [project, setProject] = useState(null);
  const [generatingSlideIndex, setGeneratingSlideIndex] = useState(null);
  const [llmIntegrations, setLlmIntegrations] = useState([]);
  const [selectedLlmIdForFill, setSelectedLlmIdForFill] = useState(data.selectedLlmIdForFill ?? null);
  const [isFillingWithAI, setIsFillingWithAI] = useState(false);
  const [neuroDesignModalOpen, setNeuroDesignModalOpen] = useState(false);
  const [slideIndexForNeuroDesign, setSlideIndexForNeuroDesign] = useState(null);
  const [slidePreviewIndex, setSlidePreviewIndex] = useState(null);
  const [popoverSlideIndex, setPopoverSlideIndex] = useState(null);
  const [refineModalOpen, setRefineModalOpen] = useState(false);
  const [refineSlideIndex, setRefineSlideIndex] = useState(null);
  const [localOrientations, setLocalOrientations] = useState(() => {
    const base = orientations.length >= numSlides ? orientations : [...orientations];
    while (base.length < numSlides) base.push('');
    return base.slice(0, numSlides);
  });
  const [localPrompts, setLocalPrompts] = useState(() => {
    const base = slides.slice(0, numSlides).map((s) => s?.prompt ?? '');
    while (base.length < numSlides) base.push('');
    return base.slice(0, numSlides);
  });

  const upstreamSummary = useMemo(() => buildUpstreamSummary(inputData), [inputData]);
  const fullContentForSlides = useMemo(() => getFullContentForSlides(inputData), [inputData]);
  const hasUpstreamData = upstreamSummary.lines.length > 0 || upstreamSummary.contentText.length > 0;
  const contextPromptForImage = useMemo(() => buildContextPromptForImage(inputData), [inputData]);

  const neuroDesignInitialConfig = useMemo(() => {
    if (slideIndexForNeuroDesign == null) return undefined;
    const idx = slideIndexForNeuroDesign;
    const slidePrompt = (slides[idx]?.prompt ?? '').trim();
    const fullPrompt = (contextPromptForImage + '\n\n' + slidePrompt).trim();
    const flowOverrides = mergeFlowInputDataIntoConfig(inputData || {});
    const disabled = slides[idx]?.disabledSupportTypes ?? [];
    let flowFiltered = filterOverridesByDisabledSupportTypes(flowOverrides, disabled);
    // Regra fixa: logo e sujeito principal conectados são sempre usados
    if (flowOverrides.logo_url) flowFiltered = { ...flowFiltered, logo_url: flowOverrides.logo_url };
    if (flowOverrides.subject_gender !== undefined) flowFiltered = { ...flowFiltered, subject_gender: flowOverrides.subject_gender };
    if (flowOverrides.subject_description !== undefined) flowFiltered = { ...flowFiltered, subject_description: flowOverrides.subject_description };
    if (flowOverrides.subject_image_urls !== undefined) flowFiltered = { ...flowFiltered, subject_image_urls: flowOverrides.subject_image_urls };
    const slideOverrides = slides[idx]?.configOverrides && typeof slides[idx].configOverrides === 'object' ? slides[idx].configOverrides : {};
    return {
      ...neuroDesignDefaultConfig(),
      ...flowFiltered,
      dimensions,
      image_size: imageSize,
      user_ai_connection_id: selectedImageConnectionId,
      additional_prompt: fullPrompt,
      ...slideOverrides,
    };
  }, [slideIndexForNeuroDesign, slides, contextPromptForImage, inputData, dimensions, imageSize, selectedImageConnectionId]);

  const handleNeuroDesignResult = useCallback(
    (result) => {
      if (slideIndexForNeuroDesign != null && result?.lastImageUrl) {
        const idx = slideIndexForNeuroDesign;
        const newSlides = [...slides];
        newSlides[idx] = { ...(newSlides[idx] || {}), imageUrl: result.lastImageUrl, prompt: newSlides[idx]?.prompt ?? slides[idx]?.prompt ?? '' };
        onUpdateNodeData(id, { slides: newSlides });
        if (typeof onAddCarouselSlideImageNode === 'function') {
          onAddCarouselSlideImageNode(id, `slide-${idx}`, result.lastImageUrl, result.output || {});
        }
        toast({ title: 'Imagem do Neuro Designer aplicada à lâmina!' });
      }
      setNeuroDesignModalOpen(false);
      setSlideIndexForNeuroDesign(null);
    },
    [slideIndexForNeuroDesign, slides, id, onUpdateNodeData, onAddCarouselSlideImageNode, toast]
  );

  const generatorOutput = inputData?.image_generator;
  const generatorId = generatorOutput?.id;
  const generatorData = Array.isArray(generatorOutput?.data) ? generatorOutput.data : [];

  const getOrCreateProject = useCallback(async () => {
    if (!user) return null;
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
        return null;
      }
      if (existing) {
        setProject(existing);
        return existing;
      }
      const { data: created, error: insertError } = await supabase
        .from('neurodesign_projects')
        .insert({ name: 'Meu projeto', owner_user_id: user.id })
        .select()
        .single();
      if (insertError) {
        toast({ title: 'Erro ao criar projeto', description: insertError.message, variant: 'destructive' });
        return null;
      }
      setProject(created);
      return created;
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Tabela pode não existir.', variant: 'destructive' });
      return null;
    }
  }, [user, toast]);

  const fetchImageConnections = useCallback(async () => {
    if (!user) return;
    try {
      const { data: list, error } = await supabase
        .from('user_ai_connections')
        .select('id, name, provider, default_model, capabilities, is_active')
        .eq('user_id', user.id);
      if (error) return;
      const filtered = (list || []).filter((c) => c.capabilities?.image_generation && c.is_active !== false);
      setImageConnections(filtered);
      setSelectedImageConnectionId((prev) => {
        if (filtered.length && (!prev || !filtered.some((c) => c.id === prev))) return filtered[0].id;
        return prev;
      });
    } catch (_e) {
      setImageConnections([]);
    }
  }, [user]);

  useEffect(() => {
    fetchImageConnections();
  }, [fetchImageConnections]);

  const fetchLlmIntegrations = useCallback(async () => {
    if (!user) return;
    try {
      let userConnections = [];
      const { data: userData, error: userError } = await supabase
        .from('user_ai_connections')
        .select('id, name, provider, default_model, capabilities, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (!userError && userData) {
        userConnections = userData
          .filter((conn) => conn.capabilities?.text_generation === true)
          .map((conn) => ({ ...conn, is_user_connection: true, source: 'personal' }));
      }
      let globalIntegrations = [];
      if (userConnections.length === 0) {
        const { data: globalData, error: globalError } = await supabase
          .from('llm_integrations')
          .select('id, name, provider, default_model');
        if (!globalError && globalData) {
          globalIntegrations = globalData
            .filter((i) => i.is_active !== false)
            .map((i) => ({ ...i, is_user_connection: false, source: 'global' }));
        }
      }
      const all = [...userConnections, ...globalIntegrations];
      setLlmIntegrations(all);
      setSelectedLlmIdForFill((prev) => {
        if (data.selectedLlmIdForFill && all.some((i) => i.id === data.selectedLlmIdForFill)) return data.selectedLlmIdForFill;
        if (all.length && (!prev || !all.some((i) => i.id === prev))) return all[0].id;
        return prev;
      });
    } catch (_e) {
      setLlmIntegrations([]);
    }
  }, [user, data.selectedLlmIdForFill]);

  useEffect(() => {
    if (configOpen) fetchLlmIntegrations();
  }, [configOpen, fetchLlmIntegrations]);

  useEffect(() => {
    if (data.dimensions != null) setDimensions(data.dimensions);
  }, [data.dimensions]);
  useEffect(() => {
    if (data.imageSize != null) setImageSize(data.imageSize);
  }, [data.imageSize]);
  useEffect(() => {
    if (data.selectedImageConnectionId != null) setSelectedImageConnectionId(data.selectedImageConnectionId);
  }, [data.selectedImageConnectionId]);

  useEffect(() => {
    if (!generatorId || generatorId === lastConsumedOutputId) return;
    if (slides.length >= numSlides) return;
    const first = generatorData[0];
    const imageUrl = first?.url || first?.thumbnail_url;
    if (!imageUrl) return;
    const idx = slides.length;
    const existing = slides[idx] || {};
    const orientation = existing.orientation ?? orientations[idx] ?? '';
    const prompt = existing.prompt ?? '';
    const newSlides = [...slides, { ...existing, imageUrl, orientation, prompt }];
    onUpdateNodeData(id, { slides: newSlides, lastConsumedOutputId: generatorId });
  }, [generatorId, lastConsumedOutputId, slides, numSlides, generatorData, orientations, id, onUpdateNodeData]);

  useEffect(() => {
    setLocalOrientations((prev) => {
      const base = prev.length >= numSlides ? prev : [...prev];
      while (base.length < numSlides) base.push('');
      return base.slice(0, numSlides);
    });
  }, [numSlides]);

  useEffect(() => {
    const nextOutput = { id, data: { slides, numSlides, orientations } };
    const current = data.output;
    const changed =
      !current ||
      current.id !== id ||
      current.data?.numSlides !== numSlides ||
      (current.data?.slides?.length ?? 0) !== slides.length;
    if (changed) {
      onUpdateNodeData(id, { output: nextOutput });
    }
  }, [id, slides, numSlides, orientations, data.output, onUpdateNodeData]);

  useEffect(() => {
    if (numSlides !== localPrompts.length) {
      setLocalPrompts((prev) => {
        const next = prev.length >= numSlides ? prev.slice(0, numSlides) : [...prev];
        while (next.length < numSlides) next.push('');
        return next;
      });
    }
  }, [numSlides]);

  const handleSaveConfig = () => {
    const newOrientations = localOrientations.slice(0, numSlides);
    const newPrompts = localPrompts.slice(0, numSlides);
    const newSlides = Array.from({ length: numSlides }, (_, i) => {
      const existing = slides[i] || {};
      return {
        ...existing,
        orientation: newOrientations[i] ?? '',
        prompt: newPrompts[i] ?? '',
      };
    });
    onUpdateNodeData(id, {
      numSlides,
      orientations: newOrientations,
      slides: newSlides,
      configOpen: false,
    });
    setConfigOpen(false);
  };

  const handleOpenConfig = () => {
    setLocalOrientations(() => {
      const base = orientations.length >= numSlides ? orientations : [...orientations];
      while (base.length < numSlides) base.push('');
      return base.slice(0, numSlides);
    });
    setLocalPrompts(() => {
      const base = slides.slice(0, numSlides).map((s) => s?.prompt ?? '');
      while (base.length < numSlides) base.push('');
      return base.slice(0, numSlides);
    });
    setConfigOpen(true);
  };

  const handleFillFromContent = () => {
    const fullContent = getFullContentForSlides(inputData);
    if (!fullContent.trim()) return;
    const { numSlides: parsedNum, slidePrompts } = parseSlidesFromContent(fullContent);
    const newNumSlides = Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, parsedNum));
    const newOrientations = [...orientations];
    while (newOrientations.length < newNumSlides) newOrientations.push('');
    for (let i = 0; i < newNumSlides; i++) {
      if (!String(newOrientations[i] ?? slides[i]?.orientation ?? '').trim()) {
        newOrientations[i] = i === 0 ? 'Capa' : `Lâmina ${i + 1}`;
      }
    }
    const newPrompts = slidePrompts.slice(0, newNumSlides);
    while (newPrompts.length < newNumSlides) newPrompts.push('');
    const newSlides = Array.from({ length: newNumSlides }, (_, i) => {
      const existing = slides[i] || {};
      return {
        ...existing,
        orientation: newOrientations[i] ?? existing.orientation ?? '',
        prompt: newPrompts[i] ?? existing.prompt ?? '',
      };
    });
    onUpdateNodeData(id, {
      numSlides: newNumSlides,
      orientations: newOrientations.slice(0, newNumSlides),
      slides: newSlides,
    });
    setLocalOrientations(newOrientations.slice(0, newNumSlides));
    setLocalPrompts(newPrompts.slice(0, newNumSlides));
  };

  const handleFillWithAI = useCallback(async () => {
    if (!selectedLlmIdForFill) {
      toast({ title: 'Selecione uma conexão de IA', variant: 'destructive' });
      return;
    }
    const fullContent = fullContentForSlides.trim();
    if (!fullContent) {
      toast({ title: 'Conecte nós à esquerda com conteúdo (cliente, campanha, contexto, agente, etc.) para preencher com IA.', variant: 'destructive' });
      return;
    }
    const selectedIntegration = llmIntegrations.find((i) => i.id === selectedLlmIdForFill);
    const instruction = `Analise o conteúdo completo abaixo (dados do fluxo: cliente, campanha, contextos, conteúdo gerado por agentes). Com base nisso, defina quantas lâminas o carrossel deve ter (entre ${MIN_SLIDES} e ${MAX_SLIDES}) e, para cada lâmina, preencha:

Padrão obrigatório por lâmina:
- orientation: uma linha, rótulo da lâmina (ex.: "Capa: logo e título principal", "Problema: gargalo de vendas", "Solução: benefício X").
- prompt: brief completo para geração da imagem (cena, mood, texto a exibir, descrição visual; pode ser múltiplas linhas).

Além disso, para cada lâmina você pode preencher config (objeto opcional) com as chaves do Neuro Designer que fizerem sentido para aquela lâmina. Use apenas as chaves que conseguir inferir do conteúdo. Valores exatos:
- quantity: número 1 a 5 (quantidade de pessoas)
- subject_enabled: true ou false
- subject_gender: "masculino" ou "feminino"
- subject_description: string (pose, roupa, expressão)
- shot_type: "close-up" ou "medio busto" ou "americano"
- layout_position: "esquerda" ou "centro" ou "direita"
- niche_project: string (nicho do negócio)
- environment: string (cenário, ambiente)
- dimensions: "1:1" ou "4:5" ou "9:16" ou "16:9"
- text_enabled: true ou false. Se true: headline_h1, subheadline_h2, cta_button_text (strings)
- headline_h1, subheadline_h2, cta_button_text: texto a aparecer na imagem

Responda APENAS com um JSON válido, sem texto antes ou depois:
{"numSlides": N, "slides": [{"orientation": "...", "prompt": "...", "config": { ... }}, ...]}

Exemplo: {"numSlides": 3, "slides": [{"orientation": "Capa: título e subtítulo", "prompt": "Imagem de capa com logo central e título da campanha em destaque", "config": {"quantity": 1, "shot_type": "medio busto", "niche_project": "marketing digital"}}, {"orientation": "Problema", "prompt": "...", "config": {}}, ...]}`;

    const contentForModel = fullContent.length > 12000 ? fullContent.slice(0, 12000) + '\n\n[... conteúdo truncado para caber no contexto ...]' : fullContent;
    const userMessage = instruction + '\n\n---\n\nConteúdo completo do fluxo (cliente, campanha, contextos, agentes):\n\n' + contentForModel;

    setIsFillingWithAI(true);
    try {
      const { data: functionData, error } = await supabase.functions.invoke('generic-ai-chat', {
        body: JSON.stringify({
          messages: [{ role: 'user', content: userMessage }],
          llm_integration_id: selectedLlmIdForFill,
          is_user_connection: !!selectedIntegration?.is_user_connection,
        }),
      });
      if (error) throw new Error(error.message);
      const raw = functionData?.response ?? functionData?.content ?? '';
      const parsed = extractJsonFromResponse(raw);
      if (!parsed || !Array.isArray(parsed.slides)) {
        toast({ title: 'Resposta da IA inválida', description: 'A IA não retornou JSON no formato esperado.', variant: 'destructive' });
        return;
      }
      const n = Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, Math.floor(Number(parsed.numSlides)) || parsed.slides.length));
      const slideList = parsed.slides.slice(0, n);
      while (slideList.length < n) slideList.push({ orientation: '', prompt: '', config: {} });
      const newOrientations = slideList.map((s) => (s && typeof s.orientation === 'string' ? s.orientation : String(s?.orientation ?? '')));
      const newPrompts = slideList.map((s) => (s && typeof s.prompt === 'string' ? s.prompt : String(s?.prompt ?? '')));
      const newSlides = Array.from({ length: n }, (_, i) => {
        const s = slideList[i] || {};
        const rawConfig = s.config && typeof s.config === 'object' ? s.config : {};
        const configOverrides = Object.keys(rawConfig).length > 0 ? sanitizeNeuroDesignConfigFromAI(rawConfig) : undefined;
        return {
          ...(slides[i] || {}),
          orientation: newOrientations[i],
          prompt: newPrompts[i],
          ...(configOverrides && Object.keys(configOverrides).length > 0 ? { configOverrides } : {}),
        };
      });
      onUpdateNodeData(id, {
        numSlides: n,
        orientations: newOrientations,
        slides: newSlides,
        selectedLlmIdForFill: selectedLlmIdForFill,
      });
      setLocalOrientations(newOrientations);
      setLocalPrompts(newPrompts);
      toast({ title: 'Lâminas preenchidas com IA', description: `${n} lâmina(s) configurada(s) com orientação, brief e config do Neuro Designer. Ajuste se quiser e clique em Salvar.` });
    } catch (e) {
      toast({ title: 'Erro ao preencher com IA', description: e?.message || 'Tente outra conexão ou verifique os dados.', variant: 'destructive' });
    } finally {
      setIsFillingWithAI(false);
    }
  }, [selectedLlmIdForFill, fullContentForSlides, llmIntegrations, id, slides, onUpdateNodeData, toast]);

  const handleNumSlidesChange = (e) => {
    const v = parseInt(e.target.value, 10);
    if (!Number.isNaN(v) && v >= MIN_SLIDES && v <= MAX_SLIDES) {
      onUpdateNodeData(id, { numSlides: v });
      setLocalOrientations((prev) => {
        const next = [...prev];
        while (next.length < v) next.push('');
        return next.slice(0, v);
      });
    }
  };

  const handleDimensionsChange = (value) => {
    setDimensions(value);
    onUpdateNodeData(id, { dimensions: value });
  };

  const handleImageSizeChange = (value) => {
    setImageSize(value);
    onUpdateNodeData(id, { imageSize: value });
  };

  const handleSelectedConnectionChange = (value) => {
    setSelectedImageConnectionId(value);
    onUpdateNodeData(id, { selectedImageConnectionId: value });
  };

  const handleGenerateSlide = useCallback(
    async (slideIndex) => {
      if (!selectedImageConnectionId) {
        toast({ title: 'Atenção', description: 'Selecione uma conexão de imagem.', variant: 'destructive' });
        return;
      }
      const slidePrompt = (slides[slideIndex]?.prompt ?? '').trim();
      const fullPrompt = (contextPromptForImage + '\n\n' + slidePrompt).trim();
      if (!fullPrompt) {
        toast({ title: 'Atenção', description: 'Conecte nós à esquerda ou preencha o brief da lâmina na configuração.', variant: 'destructive' });
        return;
      }
      const proj = project || (await getOrCreateProject());
      if (!proj) return;
      setGeneratingSlideIndex(slideIndex);
      try {
        const freshInputData = typeof getFreshInputData === 'function' ? getFreshInputData(id) : (inputData || {});
        const conn = imageConnections.find((c) => c.id === selectedImageConnectionId);
        const isGoogle = conn?.provider?.toLowerCase() === 'google';
        const fnName = isGoogle ? 'neurodesign-generate-google' : 'neurodesign-generate';
        const baseConfig = {
          ...neuroDesignDefaultConfig(),
          dimensions,
          image_size: imageSize,
          user_ai_connection_id: selectedImageConnectionId,
          additional_prompt: fullPrompt,
        };
        const flowOverrides = mergeFlowInputDataIntoConfig(freshInputData);
        const disabled = slides[slideIndex]?.disabledSupportTypes ?? [];
        let flowFiltered = filterOverridesByDisabledSupportTypes(flowOverrides, disabled);
        // Regra fixa: logo e sujeito principal conectados são sempre usados na geração
        if (flowOverrides.logo_url) flowFiltered = { ...flowFiltered, logo_url: flowOverrides.logo_url };
        if (flowOverrides.subject_gender !== undefined) flowFiltered = { ...flowFiltered, subject_gender: flowOverrides.subject_gender };
        if (flowOverrides.subject_description !== undefined) flowFiltered = { ...flowFiltered, subject_description: flowOverrides.subject_description };
        if (flowOverrides.subject_image_urls !== undefined) flowFiltered = { ...flowFiltered, subject_image_urls: flowOverrides.subject_image_urls };
        const slideOverrides = slides[slideIndex]?.configOverrides && typeof slides[slideIndex].configOverrides === 'object' ? slides[slideIndex].configOverrides : {};
        const config = { ...baseConfig, ...flowFiltered, ...slideOverrides };
        const { data: result, error } = await supabase.functions.invoke(fnName, {
          body: {
            projectId: proj.id,
            configId: null,
            config,
            userAiConnectionId: selectedImageConnectionId,
            style_reference_only: true,
          },
        });
        const errMsg = result?.error || error?.message;
        if (error) throw new Error(errMsg || 'Falha ao chamar o servidor de geração.');
        if (result?.error) throw new Error(result.error);
        const images = result?.images || [];
        if (images.length > 0) {
          const first = images[0];
          const imageUrl = first.url || first.thumbnail_url;
          const runId = result.runId;
          const imageId = first.id;
          const projectId = proj.id;
          const newSlides = [...slides];
          const existing = newSlides[slideIndex] || {};
          newSlides[slideIndex] = { ...existing, imageUrl, prompt: existing.prompt ?? slidePrompt, runId, imageId, projectId };
          onUpdateNodeData(id, { slides: newSlides });
          if (typeof onAddCarouselSlideImageNode === 'function') {
            onAddCarouselSlideImageNode(id, `slide-${slideIndex}`, imageUrl, { runId, images, projectId, userAiConnectionId: selectedImageConnectionId });
          }
          toast({ title: 'Imagem gerada com sucesso!' });
        } else {
          toast({ title: 'Geração concluída', description: 'Nenhuma imagem retornada.', variant: 'destructive' });
        }
      } catch (e) {
        const msg = e?.message || 'Erro ao gerar';
        const is429 = /429|quota|rate limit/i.test(msg);
        toast({
          title: 'Erro ao gerar',
          description: is429 ? 'Limite de uso da API atingido. Aguarde alguns minutos.' : msg,
          variant: 'destructive',
        });
      } finally {
        setGeneratingSlideIndex(null);
      }
    },
    [
      selectedImageConnectionId,
      slides,
      contextPromptForImage,
      dimensions,
      imageSize,
      project,
      getOrCreateProject,
      imageConnections,
      inputData,
      getFreshInputData,
      id,
      onUpdateNodeData,
      onAddCarouselSlideImageNode,
      toast,
    ]
  );

  const filledCount = slides.length;
  const hasAtLeastOneSlide = numSlides > 0;

  return (
    <>
      <Card className="w-72 border-2 border-amber-500/50 shadow-lg overflow-hidden relative min-h-[120px]">
        <Handle type="target" position={Position.Left} className="!bg-amber-500" />
        <CardHeader className="flex-row items-center space-x-2 p-3 bg-amber-500/10">
          <LayoutGrid className="w-5 h-5 text-amber-500 shrink-0" />
          <CardTitle className="text-base">Carrossel</CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          {hasUpstreamData && (
            <div className="space-y-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-between h-8 text-xs"
                onClick={() => setDataCollapsed((c) => !c)}
              >
                <span className="flex items-center gap-1">
                  {dataCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Dados dos nós conectados
                </span>
              </Button>
              {!dataCollapsed && (
                <>
                  {getConnectedSupportTypes(inputData).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Configurações do Neuro Designer (prioridade na geração)</p>
                  )}
                  <ScrollArea className="max-h-32 rounded-md border bg-muted/30 p-2 text-xs mt-1">
                    {upstreamSummary.lines.map((line, i) => (
                      <div key={i} className="mb-1">
                        <span className="font-medium text-muted-foreground">{line.label}:</span>{' '}
                        <span className="whitespace-pre-wrap break-words">{line.text}</span>
                      </div>
                    ))}
                    {upstreamSummary.contentText.length > 500 && (
                      <p className="text-muted-foreground mt-1">… (conteúdo completo usado ao preencher)</p>
                    )}
                  </ScrollArea>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={handleFillFromContent}
                    disabled={!fullContentForSlides.trim()}
                  >
                    <Sparkles className="w-3 h-3 mr-2" />
                    Preencher a partir do conteúdo
                  </Button>
                </>
              )}
            </div>
          )}
          <Button
            onClick={handleOpenConfig}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Configurar lâminas
          </Button>
          <p className="text-xs text-muted-foreground">
            {filledCount} / {numSlides} lâminas
          </p>
          {hasAtLeastOneSlide && (
            <>
              <div className="space-y-2 rounded-md border bg-muted/20 p-2">
                <p className="text-xs font-medium text-muted-foreground">Gerar imagens</p>
                <div className="grid gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Dimensões</Label>
                    <Select value={dimensions} onValueChange={handleDimensionsChange}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIMENSION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Qualidade</Label>
                    <Select value={imageSize} onValueChange={handleImageSizeChange}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUALITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Conexão de imagem</Label>
                    <Select value={selectedImageConnectionId ?? ''} onValueChange={handleSelectedConnectionChange}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {imageConnections.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">
                            {c.name || c.provider || c.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                {Array.from({ length: numSlides }).map((_, i) => {
                  const slide = slides[i] || {};
                  const isGenerating = generatingSlideIndex === i;
                  const allConnectedSupports = getConnectedSupportTypes(inputData);
                  // Logo e sujeito principal são regra fixa: não aparecem como opção desativável
                  const FIXED_SUPPORT_TYPES = ['image_logo', 'subject'];
                  const connectedSupports = allConnectedSupports.filter(({ id }) => !FIXED_SUPPORT_TYPES.includes(id));
                  const hasFixedSupports = allConnectedSupports.some(({ id }) => FIXED_SUPPORT_TYPES.includes(id));
                  const disabledTypes = Array.isArray(slide.disabledSupportTypes) ? slide.disabledSupportTypes : [];
                  const toggleSupportForSlide = (supportId, useInSlide) => {
                    const newSlides = slides.map((s, idx) => {
                      if (idx !== i) return s;
                      const current = Array.isArray(s.disabledSupportTypes) ? s.disabledSupportTypes : [];
                      const next = useInSlide ? current.filter((t) => t !== supportId) : (current.includes(supportId) ? current : [...current, supportId]);
                      return { ...s, disabledSupportTypes: next };
                    });
                    onUpdateNodeData(id, { slides: newSlides });
                  };
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-md border p-1.5 bg-background relative"
                    >
                      <div
                        className="w-10 h-10 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center cursor-pointer relative group"
                        onClick={() => slide.imageUrl && setSlidePreviewIndex(i)}
                        role={slide.imageUrl ? 'button' : undefined}
                        title={slide.imageUrl ? 'Ver ou baixar imagem' : undefined}
                      >
                        {slide.imageUrl ? (
                          <>
                            <img src={slide.imageUrl} alt={`Lâmina ${i + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Expand className="w-4 h-4 text-white" />
                            </div>
                          </>
                        ) : (
                          <ImageIcon className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-1 truncate">Lâmina {i + 1}</span>
                      <Popover open={popoverSlideIndex === i} onOpenChange={(open) => setPopoverSlideIndex(open ? i : null)}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 shrink-0"
                            disabled={allConnectedSupports.length === 0}
                            title="Suporte ao Neuro Designer nesta lâmina"
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64" align="start">
                          <p className="font-medium text-sm mb-2">Usar nesta lâmina</p>
                          {allConnectedSupports.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Nenhum nó de suporte conectado.</p>
                          ) : (
                            <div className="space-y-2">
                              {hasFixedSupports && (
                                <p className="text-xs text-muted-foreground">Logo e Sujeito principal: sempre usados quando conectados.</p>
                              )}
                              {connectedSupports.length > 0 && connectedSupports.map(({ id: supportId, label }) => (
                                <label key={supportId} className="flex items-center gap-2 cursor-pointer text-sm">
                                  <Checkbox
                                    checked={!disabledTypes.includes(supportId)}
                                    onCheckedChange={(checked) => toggleSupportForSlide(supportId, !!checked)}
                                  />
                                  <span>Usar {label} nesta lâmina</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 shrink-0"
                        onClick={() => {
                          setSlideIndexForNeuroDesign(i);
                          setNeuroDesignModalOpen(true);
                        }}
                        title="Configurar e gerar com Neuro Designer"
                      >
                        <Paintbrush className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 shrink-0"
                        onClick={() => handleGenerateSlide(i)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      {slide.imageUrl && slide.runId && slide.imageId && slide.projectId && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 shrink-0"
                          onClick={() => {
                            setRefineSlideIndex(i);
                            setRefineModalOpen(true);
                          }}
                          title="Refinar imagem"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      <Handle
                        type="source"
                        id={`slide-${i}`}
                        position={Position.Right}
                        className="!bg-amber-500 !w-2.5 !h-2.5"
                        style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <NeuroDesignFlowModal
        open={neuroDesignModalOpen}
        onOpenChange={(v) => {
          if (!v) {
            setNeuroDesignModalOpen(false);
            setSlideIndexForNeuroDesign(null);
          }
        }}
        inputData={inputData}
        onResult={handleNeuroDesignResult}
        initialConfig={neuroDesignInitialConfig}
      />

      <RefineImageModal
        open={refineModalOpen}
        onOpenChange={(open) => {
          setRefineModalOpen(open);
          if (!open) setRefineSlideIndex(null);
        }}
        imageUrl={refineSlideIndex != null ? slides[refineSlideIndex]?.imageUrl : undefined}
        projectId={refineSlideIndex != null ? slides[refineSlideIndex]?.projectId : undefined}
        runId={refineSlideIndex != null ? slides[refineSlideIndex]?.runId : undefined}
        imageId={refineSlideIndex != null ? slides[refineSlideIndex]?.imageId : undefined}
        userAiConnectionId={selectedImageConnectionId}
        imageConnections={imageConnections}
        onSuccess={({ imageUrl, runId: newRunId, imageId: newImageId }) => {
          if (refineSlideIndex == null) return;
          const newSlides = slides.map((s, idx) =>
            idx !== refineSlideIndex ? s : { ...s, imageUrl, runId: newRunId, imageId: newImageId }
          );
          onUpdateNodeData(id, { slides: newSlides });
        }}
      />

      {slidePreviewIndex != null && slides[slidePreviewIndex]?.imageUrl && (
        <Dialog open={true} onOpenChange={(open) => !open && setSlidePreviewIndex(null)}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Lâmina {slidePreviewIndex + 1}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-auto flex justify-center">
              <img src={slides[slidePreviewIndex].imageUrl} alt={`Lâmina ${slidePreviewIndex + 1}`} className="max-w-full max-h-[70vh] object-contain" />
            </div>
            <Button
              type="button"
              onClick={() => {
                const a = document.createElement('a');
                a.href = slides[slidePreviewIndex].imageUrl;
                a.download = `lamina-${slidePreviewIndex + 1}-${Date.now()}.png`;
                a.click();
              }}
            >
              <Download className="w-4 h-4 mr-2" /> Baixar imagem
            </Button>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar lâminas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2 rounded-md border bg-muted/20 p-2">
              <Label className="text-xs font-medium">Preencher com IA</Label>
              <p className="text-xs text-muted-foreground">
                Use os dados dos nós conectados; a IA analisa e preenche orientação, brief e configurações do Neuro Designer de cada lâmina (quantidade de sujeitos, plano, nicho, texto na imagem, etc.).
              </p>
              <div className="flex gap-2">
                <Select
                  value={selectedLlmIdForFill ?? ''}
                  onValueChange={(value) => {
                    setSelectedLlmIdForFill(value);
                    onUpdateNodeData(id, { selectedLlmIdForFill: value });
                  }}
                >
                  <SelectTrigger className="flex-1 h-8 text-xs">
                    <SelectValue placeholder="Conexão de IA" />
                  </SelectTrigger>
                  <SelectContent>
                    {llmIntegrations.map((conn) => (
                      <SelectItem key={conn.id} value={conn.id} className="text-xs">
                        {conn.name || conn.provider || conn.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 shrink-0"
                  onClick={handleFillWithAI}
                  disabled={!selectedLlmIdForFill || !fullContentForSlides.trim() || isFillingWithAI}
                >
                  {isFillingWithAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isFillingWithAI ? 'Preenchendo…' : 'Preencher com IA'}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Quantidade de lâminas</Label>
              <Input
                type="number"
                min={MIN_SLIDES}
                max={MAX_SLIDES}
                value={numSlides}
                onChange={handleNumSlidesChange}
              />
            </div>
            <div className="space-y-2">
              <Label>Orientação e brief de cada lâmina</Label>
              <p className="text-xs text-muted-foreground">
                Use o brief para descrever a cena ou texto da lâmina; facilita a geração de imagens depois.
              </p>
              <div className="space-y-3">
                {localOrientations.map((val, i) => {
                  const overrides = slides[i]?.configOverrides && typeof slides[i].configOverrides === 'object' ? slides[i].configOverrides : {};
                  const hasOverrides = Object.keys(overrides).length > 0;
                  return (
                    <div key={i} className="space-y-1 rounded-md border p-2 bg-muted/20">
                      <Label className="text-xs font-medium">
                        Lâmina {i + 1}{i === 0 ? ' (capa)' : ''}
                      </Label>
                      <Input
                        value={val}
                        onChange={(e) => {
                          const next = [...localOrientations];
                          next[i] = e.target.value;
                          setLocalOrientations(next);
                        }}
                        placeholder={i === 0 ? 'Ex: Capa: logo e título principal' : `Ex: Tema da lâmina ${i + 1}`}
                        className="text-sm"
                      />
                      <Textarea
                        value={localPrompts[i] ?? ''}
                        onChange={(e) => {
                          const next = [...localPrompts];
                          next[i] = e.target.value;
                          setLocalPrompts(next);
                        }}
                        placeholder="Brief para criação da imagem (opcional)"
                        className="min-h-[60px] text-xs resize-y"
                      />
                      <details className="text-xs text-muted-foreground mt-1">
                        <summary className="cursor-pointer hover:text-foreground">
                          Configuração Neuro Designer desta lâmina
                        </summary>
                        <div className="mt-1 pl-2 border-l border-muted-foreground/30">
                          {hasOverrides ? (
                            <ul className="space-y-0.5 list-none">
                              {Object.entries(overrides).map(([k, v]) => (
                                <li key={k}>
                                  <span className="font-medium">{k}:</span>{' '}
                                  {typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>Usar padrão do fluxo (e nós conectados).</p>
                          )}
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            </div>
            <Button onClick={handleSaveConfig} className="w-full">
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

CarouselNode.displayName = 'CarouselNode';

export default CarouselNode;
