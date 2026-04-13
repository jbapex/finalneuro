import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Paintbrush, Play, Loader2, Eye, Sparkles, Settings2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import NeuroDesignFlowModal, { NEURO_DESIGN_FLOW_RENDER_MODE } from '@/components/flow-builder/modals/NeuroDesignFlowModal';
import { mergeFlowInputDataIntoConfig } from '@/lib/neurodesign/flowConfigMerge';
import { neuroDesignDefaultConfig } from '@/lib/neurodesign/defaultConfig';
import { getFriendlyErrorMessage } from '@/lib/utils';
import { sanitizeNeuroDesignConfigFromAI } from '@/lib/neurodesign/sanitizeConfigFromAI';
import { extractJsonFromAiResponse } from '@/lib/neurodesign/extractJsonFromAiResponse';
import { FlowNodeHeaderDelete } from '@/components/flow-builder/FlowNodeHeaderDelete';

const isTextLlmConnection = (conn) => conn.capabilities?.text_generation === true;

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

function buildPromptFromInputData(inputData) {
  if (!inputData || typeof inputData !== 'object') return '';
  const parts = [];
  const agentData = inputData.agent?.data;
  if (agentData && (agentData.generatedText || agentData.text)) {
    parts.push(String(agentData.generatedText || agentData.text).trim());
  }
  const agent2Data = inputData.agent_2?.data;
  if (agent2Data && (agent2Data.generatedText || agent2Data.text)) {
    parts.push(String(agent2Data.generatedText || agent2Data.text).trim());
  }
  const contentData = inputData.generated_content?.data;
  if (contentData && typeof contentData === 'string') {
    parts.push(contentData.trim());
  }
  if (inputData.knowledge?.data) {
    const k = inputData.knowledge.data;
    parts.push(typeof k === 'string' ? k : JSON.stringify(k, null, 2));
  }
  const contexts = inputData.context?.data?.contexts || inputData.context?.data?.client_contexts;
  if (Array.isArray(contexts) && contexts.length) {
    const block = contexts
      .map((c) => (c.name ? `[${c.name}]\n${c.content || ''}` : (c.content || '')))
      .join('\n\n---\n\n');
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

/** Retorna seções formatadas para exibir no popover "Contexto dos nós" */
function buildContextSections(inputData) {
  if (!inputData || typeof inputData !== 'object') return [];
  const sections = [];
  if (inputData.client?.data) {
    const { client_contexts, ...rest } = inputData.client.data;
    const lines = [];
    if (rest.name) lines.push(`Nome: ${rest.name}`);
    if (rest.about) lines.push(`Sobre: ${rest.about}`);
    if (Object.keys(rest).length > lines.length) {
      const other = Object.entries(rest).filter(([k]) => !['name', 'about'].includes(k));
      if (other.length) lines.push(other.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n'));
    }
    if (lines.length) sections.push({ title: 'Cliente', content: lines.join('\n') });
  }
  if (inputData.campaign?.data) {
    const c = inputData.campaign.data;
    const content = typeof c === 'string' ? c : Object.entries(c).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n');
    sections.push({ title: 'Campanha', content });
  }
  const agentData = inputData.agent?.data;
  if (agentData && (agentData.generatedText || agentData.text)) {
    sections.push({ title: 'Texto do agente', content: String(agentData.generatedText || agentData.text).trim() });
  }
  const agent2Data = inputData.agent_2?.data;
  if (agent2Data && (agent2Data.generatedText || agent2Data.text)) {
    sections.push({ title: 'Texto do agente (2)', content: String(agent2Data.generatedText || agent2Data.text).trim() });
  }
  const contentData = inputData.generated_content?.data;
  if (contentData && typeof contentData === 'string') {
    sections.push({ title: 'Conteúdo gerado', content: contentData.trim() });
  }
  const contexts = inputData.context?.data?.contexts || inputData.context?.data?.client_contexts;
  if (Array.isArray(contexts) && contexts.length) {
    const block = contexts.map((c) => (c.name ? `[${c.name}]\n${(c.content || '').slice(0, 500)}${(c.content || '').length > 500 ? '…' : ''}` : (c.content || '').slice(0, 500))).join('\n\n---\n\n');
    sections.push({ title: 'Contexto / Documentos', content: block });
  }
  if (inputData.knowledge?.data) {
    const k = inputData.knowledge.data;
    const str = typeof k === 'string' ? k : JSON.stringify(k);
    sections.push({ title: 'Conhecimento', content: str.length > 400 ? str.slice(0, 400) + '…' : str });
  }
  return sections;
}

function aiResponseToString(raw) {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw.content != null) return String(raw.content);
  return String(raw);
}

/** Prompt adicional no editor = só texto do utilizador; contexto do fluxo junta-se na geração. */
function stripLeadingContextFromPrompt(fullText, contextPrefix) {
  const t = String(fullText || '').trim();
  const c = String(contextPrefix || '').trim();
  if (!c || !t) return t;
  if (t.startsWith(c)) return t.slice(c.length).replace(/^\n\n?/, '').trim();
  return t;
}

const ImageGeneratorNode = memo(({ data, id, selected }) => {
  const { onUpdateNodeData, presets, inputData, expanded, onAddImageOutputNode, getFreshInputData } = data;
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [lastImageUrl, setLastImageUrl] = useState(data.lastImageUrl || null);
  const [prompt, setPrompt] = useState(typeof data.prompt === 'string' ? data.prompt : '');
  const [dimensions, setDimensions] = useState(data.dimensions ?? '1:1');
  const [imageSize, setImageSize] = useState(data.image_size ?? data.imageSize ?? '1K');
  const [imageConnections, setImageConnections] = useState([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [project, setProject] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [llmIntegrationsForFill, setLlmIntegrationsForFill] = useState([]);
  const [selectedLlmIdForFill, setSelectedLlmIdForFill] = useState(data.selectedLlmIdForImageConfigFill ?? null);
  const [isAiFillingConfig, setIsAiFillingConfig] = useState(false);

  const configured = Boolean(data.imageGeneratorConfigured);

  const contextForApi = useMemo(() => buildPromptFromInputData(inputData), [inputData]);
  const contextSections = useMemo(() => buildContextSections(inputData), [inputData]);
  const hasContext = contextSections.length > 0;

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
      setSelectedConnectionId((prev) => {
        const stored = data.user_ai_connection_id;
        if (stored && filtered.some((c) => c.id === stored)) return stored;
        if (filtered.length && (!prev || !filtered.some((c) => c.id === prev))) return filtered[0].id;
        return prev;
      });
    } catch (_e) {
      setImageConnections([]);
    }
  }, [user, data.user_ai_connection_id]);

  useEffect(() => {
    fetchImageConnections();
  }, [fetchImageConnections]);

  const fetchLlmIntegrationsForFill = useCallback(async () => {
    if (!user) return;
    try {
      let userConnections = [];
      const { data: userData, error: userError } = await supabase
        .from('user_ai_connections')
        .select('id, name, provider, default_model, capabilities, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (!userError && userData) {
        userConnections = userData.filter(isTextLlmConnection).map((conn) => ({
          ...conn,
          is_user_connection: true,
        }));
      }
      let globalIntegrations = [];
      if (userConnections.length === 0) {
        const { data: globalData, error: globalError } = await supabase
          .from('llm_integrations')
          .select('id, name, provider, default_model, is_active');
        if (!globalError && globalData) {
          globalIntegrations = globalData
            .filter((i) => i.is_active !== false)
            .map((i) => ({ ...i, is_user_connection: false }));
        }
      }
      const all = [...userConnections, ...globalIntegrations];
      setLlmIntegrationsForFill(all);
      setSelectedLlmIdForFill((prev) => {
        const stored = data.selectedLlmIdForImageConfigFill;
        if (stored && all.some((i) => String(i.id) === String(stored))) return stored;
        if (all.length && (!prev || !all.some((i) => String(i.id) === String(prev)))) return all[0].id;
        return prev;
      });
    } catch (_e) {
      setLlmIntegrationsForFill([]);
    }
  }, [user, data.selectedLlmIdForImageConfigFill]);

  useEffect(() => {
    fetchLlmIntegrationsForFill();
  }, [fetchLlmIntegrationsForFill]);

  useEffect(() => {
    if (typeof data.prompt === 'string') setPrompt(data.prompt);
  }, [data.prompt]);
  useEffect(() => {
    if (data.dimensions) setDimensions(data.dimensions);
  }, [data.dimensions]);
  useEffect(() => {
    const s = data.image_size ?? data.imageSize;
    if (s) setImageSize(s);
  }, [data.image_size, data.imageSize]);

  const fullPromptForApi = (contextForApi + '\n\n' + (prompt || '').trim()).trim();

  const handleAiFillConfig = useCallback(async () => {
    if (!selectedLlmIdForFill) {
      toast({ title: 'Selecione uma conexão de IA (texto)', variant: 'destructive' });
      return;
    }
    const content = (contextForApi + '\n\n' + (prompt || '').trim()).trim();
    if (!content) {
      toast({
        title: 'Sem conteúdo',
        description: 'Conecte nós com texto ou escreva o prompt da imagem para a IA analisar.',
        variant: 'destructive',
      });
      return;
    }
    const selectedIntegration = llmIntegrationsForFill.find((i) => String(i.id) === String(selectedLlmIdForFill));
    const instruction = `És um director de arte digital. Analisa o conteúdo abaixo (fluxo criativo: cliente, campanha, agentes, contextos).
Define configurações para UMA imagem gerada por IA (Neuro Designer).

Responde APENAS com JSON válido (sem markdown), formato:
{
  "prompt_suggestion": "string em português — descrição visual concisa da cena",
  "dimensions": "1:1" ou "4:5" ou "9:16" ou "16:9",
  "image_size": "1K" ou "2K" ou "4K",
  "neurodesign": {
    "text_enabled": true ou false,
    "headline_h1": "string opcional",
    "subheadline_h2": "string opcional",
    "cta_button_text": "string opcional",
    "text_position": "centro" ou "esquerda" ou "direita",
    "subject_enabled": true ou false,
    "subject_gender": "masculino" ou "feminino",
    "subject_description": "string",
    "niche_project": "string",
    "environment": "string",
    "shot_type": "close-up" ou "medio busto" ou "americano",
    "layout_position": "esquerda" ou "centro" ou "direita",
    "visual_attributes": { "style_tags": ["minimalista","elegante","institucional","tecnológico","criativo","clássico","formal"], "ultra_realistic": false },
    "ambient_color": "#hex opcional",
    "rim_light_color": "#hex opcional",
    "fill_light_color": "#hex opcional"
  }
}

Regras:
- Se for peça de anúncio/post com copy, text_enabled true e preenche headline/subheadline/cta a partir do conteúdo.
- Se for imagem pura sem texto na arte, text_enabled false.
- Usa apenas valores de enum exatos. Omite chaves que não consigas inferir.
- prompt_suggestion: descrição visual CURTA (até ~6 frases) só para esta imagem. NÃO cries nem repetas JSON de cliente/campanha, listas de lâminas de carrossel nem o texto integral do contexto — o sistema envia isso separadamente na geração.`;

    const truncated = content.length > 14000 ? `${content.slice(0, 14000)}\n[truncado]` : content;
    const userMessage = `${instruction}\n\n---\n\nCONTEÚDO:\n\n${truncated}`;

    setIsAiFillingConfig(true);
    try {
      const { data: fnData, error } = await supabase.functions.invoke('generic-ai-chat', {
        body: JSON.stringify({
          messages: [{ role: 'user', content: userMessage }],
          llm_integration_id: selectedLlmIdForFill,
          is_user_connection: selectedIntegration?.is_user_connection === true,
        }),
      });
      if (error) throw new Error(error.message);
      const raw = aiResponseToString(fnData?.response ?? fnData?.content);
      const parsed = extractJsonFromAiResponse(raw);
      if (!parsed || typeof parsed !== 'object') {
        toast({ title: 'Resposta inválida', description: 'A IA não devolveu JSON válido.', variant: 'destructive' });
        return;
      }
      const neuroRaw = parsed.neurodesign != null && typeof parsed.neurodesign === 'object' ? parsed.neurodesign : {};
      const existingVa = data.visual_attributes && typeof data.visual_attributes === 'object' ? data.visual_attributes : {};
      const sanitizedNeuro = sanitizeNeuroDesignConfigFromAI(neuroRaw, { existingVisualAttributes: existingVa });

      const promptSuggestion = typeof parsed.prompt_suggestion === 'string' ? parsed.prompt_suggestion.trim() : '';
      let nextDims = dimensions;
      if (['1:1', '4:5', '9:16', '16:9'].includes(parsed.dimensions)) {
        nextDims = parsed.dimensions;
        setDimensions(nextDims);
      }
      let nextSize = imageSize;
      const sz = String(parsed.image_size || '').toUpperCase();
      if (['1K', '2K', '4K'].includes(sz)) {
        nextSize = sz;
        setImageSize(nextSize);
      }
      const nextPrompt = promptSuggestion || prompt;
      setPrompt(nextPrompt);

      const hasNeuroInput = parsed.neurodesign != null && typeof parsed.neurodesign === 'object';
      const nextOverrides = hasNeuroInput ? sanitizedNeuro : data.neurodesign_ai_overrides || {};

      onUpdateNodeData(id, {
        prompt: nextPrompt,
        dimensions: nextDims,
        image_size: nextSize,
        selectedLlmIdForImageConfigFill: selectedLlmIdForFill,
        neurodesign_ai_overrides: nextOverrides,
      });

      toast({
        title: 'Sugestões da IA aplicadas',
        description: 'Revise o prompt e as opções. Use Configurar para o editor completo ou “Pronto para gerar”.',
      });
    } catch (e) {
      toast({ title: 'Erro', description: getFriendlyErrorMessage(e), variant: 'destructive' });
    } finally {
      setIsAiFillingConfig(false);
    }
  }, [
    selectedLlmIdForFill,
    contextForApi,
    prompt,
    llmIntegrationsForFill,
    id,
    onUpdateNodeData,
    toast,
    dimensions,
    imageSize,
    data.visual_attributes,
    data.neurodesign_ai_overrides,
  ]);

  const handleGenerateWithConnection = async () => {
    if (!configured) {
      toast({
        title: 'Configure antes de gerar',
        description: 'Use “Configurar”, “Preencher com IA” ou “Pronto para gerar”.',
        variant: 'destructive',
      });
      return;
    }
    if (!selectedConnectionId) {
      toast({ title: 'Atenção', description: 'Selecione uma conexão de imagem.', variant: 'destructive' });
      return;
    }
    if (!fullPromptForApi) {
      toast({ title: 'Atenção', description: 'Conecte nós à esquerda para enviar contexto ou digite o prompt da imagem.', variant: 'destructive' });
      return;
    }
    const proj = project || (await getOrCreateProject());
    if (!proj) return;
    setIsLoading(true);
    setLastImageUrl(null);
    setLastError(null);
    try {
      const freshInputData = typeof getFreshInputData === 'function' ? getFreshInputData(id) : (inputData || {});
      const conn = imageConnections.find((c) => c.id === selectedConnectionId);
      const isGoogle = conn?.provider?.toLowerCase() === 'google';
      const fnName = isGoogle ? 'neurodesign-generate-google' : 'neurodesign-generate';
      const flowOverrides = mergeFlowInputDataIntoConfig(freshInputData);
      const freshContext = buildPromptFromInputData(freshInputData);
      const nodeOverrides = {};
      if (Array.isArray(data.style_reference_urls) && data.style_reference_urls.length > 0) nodeOverrides.style_reference_urls = data.style_reference_urls;
      if (Array.isArray(data.style_reference_instructions)) nodeOverrides.style_reference_instructions = data.style_reference_instructions;
      if (typeof data.logo_url === 'string' && data.logo_url.trim()) nodeOverrides.logo_url = data.logo_url.trim();
      if (typeof data.ambient_color === 'string' && data.ambient_color.trim()) nodeOverrides.ambient_color = data.ambient_color.trim();
      if (typeof data.rim_light_color === 'string' && data.rim_light_color.trim()) nodeOverrides.rim_light_color = data.rim_light_color.trim();
      if (typeof data.fill_light_color === 'string' && data.fill_light_color.trim()) nodeOverrides.fill_light_color = data.fill_light_color.trim();
      if (data.visual_attributes && typeof data.visual_attributes === 'object') nodeOverrides.visual_attributes = data.visual_attributes;
      if (data.subject_gender === 'masculino' || data.subject_gender === 'feminino') nodeOverrides.subject_gender = data.subject_gender;
      if (typeof data.subject_description === 'string' && data.subject_description.trim()) nodeOverrides.subject_description = data.subject_description.trim();
      if (Array.isArray(data.subject_image_urls) && data.subject_image_urls.length > 0) nodeOverrides.subject_image_urls = data.subject_image_urls.filter((u) => typeof u === 'string' && u.trim()).slice(0, 2);

      const snap = data.neurodesign_flow_editor_config;
      const hasSnap = snap && typeof snap === 'object' && Object.keys(snap).length > 0;
      let config;
      if (hasSnap) {
        const userAp = String(snap.additional_prompt || '').trim();
        const additional_prompt = [freshContext, userAp].filter(Boolean).join('\n\n').trim();
        // flowOverrides por último: referências/cores/sujeito vindos das ligações ganham sobre o snapshot e sobre data.* do nó
        config = {
          ...neuroDesignDefaultConfig(),
          ...snap,
          ...nodeOverrides,
          ...flowOverrides,
          additional_prompt,
          dimensions,
          image_size: imageSize,
          quantity: Math.min(Math.max(Number(data.quantity) || 1, 1), 5),
          user_ai_connection_id: selectedConnectionId,
        };
      } else {
        const baseConfig = {
          ...neuroDesignDefaultConfig(),
          dimensions,
          image_size: imageSize,
          user_ai_connection_id: selectedConnectionId,
          additional_prompt: fullPromptForApi,
          quantity: Math.min(Math.max(Number(data.quantity) || 1, 1), 5),
        };
        const aiOverrides =
          data.neurodesign_ai_overrides && typeof data.neurodesign_ai_overrides === 'object' ? data.neurodesign_ai_overrides : {};
        config = { ...baseConfig, ...aiOverrides, ...nodeOverrides, ...flowOverrides };
      }
      // Alinhado à NeuroDesignPage / NeuroDesignFlowModal: sem style_reference_only (evita texto extra que enfraquece “copie…” da referência)
      const { data: result, error } = await supabase.functions.invoke(fnName, {
        body: {
          projectId: proj.id,
          configId: null,
          config,
          userAiConnectionId: selectedConnectionId,
        },
      });
      const errMsg = result?.error || error?.message;
      if (error) throw new Error(errMsg || 'Falha ao chamar o servidor de geração.');
      if (result?.error) throw new Error(result.error);
      const images = result?.images || [];
      if (images.length > 0) {
        const first = images[0];
        const imageUrl = first.url || first.thumbnail_url;
        setLastImageUrl(imageUrl);
        onUpdateNodeData(id, { lastImageUrl: imageUrl, output: { id: result.runId, data: images } });
        setLastError(null);
        toast({ title: 'Imagem gerada com sucesso!' });
        if (typeof onAddImageOutputNode === 'function') {
          onAddImageOutputNode(id, imageUrl, {
            runId: result.runId,
            images,
            projectId: proj.id,
            userAiConnectionId: selectedConnectionId,
            imageGeneratedAt: first.created_at || new Date().toISOString(),
          });
        }
      } else {
        const desc = 'Nenhuma imagem retornada.';
        setLastError(desc);
        toast({ title: 'Geração concluída', description: desc, variant: 'destructive' });
      }
    } catch (e) {
      const msg = e?.message || 'Erro ao gerar';
      const is429 = /429|quota|rate limit/i.test(msg);
      const isNoImages = /sem imagens|bloqueado|SAFETY|sem resultado|não retornou|filtro de conteúdo/i.test(msg);
      
      let friendlyDesc = msg;
      if (is429) {
        friendlyDesc = 'Limite de uso da API atingido. Aguarde alguns minutos.';
      } else if (isNoImages) {
        friendlyDesc =
          'A API não retornou imagem. Pode ser filtro de conteúdo ou limite. Tente outro prompt, outra conexão ou Configurar / Sugerir com IA para ajustar referências e texto na imagem.';
      } else {
        friendlyDesc = getFriendlyErrorMessage(e);
      }
      
      setLastError(friendlyDesc);
      toast({
        title: 'Aviso',
        description: friendlyDesc,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNeuroDesignResult = (result) => {
    if (!result) return;
    setLastImageUrl(result.lastImageUrl || null);
    onUpdateNodeData(id, { lastImageUrl: result.lastImageUrl, output: result.output });
  };

  const handleCollapse = () => {
    onUpdateNodeData(id, { expanded: false });
  };

  const handleEmbeddedSave = useCallback(
    (cfg) => {
      if (!cfg || typeof cfg !== 'object') return;
      const ap = String(cfg.additional_prompt || '').trim();
      const ctx = contextForApi.trim();
      let userOnly = ap;
      if (ctx && ap.startsWith(ctx)) {
        userOnly = ap.slice(ctx.length).replace(/^\n\n?/, '').trim();
      }
      const snapshot = { ...cfg, additional_prompt: userOnly };
      onUpdateNodeData(id, {
        neurodesign_flow_editor_config: snapshot,
        prompt: userOnly,
        dimensions: cfg.dimensions,
        image_size: cfg.image_size,
        quantity: Math.min(Math.max(Number(cfg.quantity) || 1, 1), 5),
        user_ai_connection_id: cfg.user_ai_connection_id,
        style_reference_urls: cfg.style_reference_urls,
        style_reference_instructions: cfg.style_reference_instructions,
        logo_url: cfg.logo_url,
        logo_position: cfg.logo_position,
        ambient_color: cfg.ambient_color,
        rim_light_color: cfg.rim_light_color,
        fill_light_color: cfg.fill_light_color,
        visual_attributes: cfg.visual_attributes,
        subject_gender: cfg.subject_gender,
        subject_description: cfg.subject_description,
        subject_image_urls: cfg.subject_image_urls,
        expanded: false,
        imageGeneratorConfigured: true,
      });
      toast({
        title: 'Configuração guardada',
        description: 'Feche o editor ou use Gerar no nó para criar a imagem.',
      });
    },
    [contextForApi, id, onUpdateNodeData, toast]
  );

  const neuroDesignInitialConfig = useMemo(() => {
    /** Dados dos nós de suporte ao Neuro (sujeito, referência, cores, estilo, logo) — aplicados por cima do snapshot para refletir ligações na hora. */
    const flowOverrides = mergeFlowInputDataIntoConfig(inputData || {});
    const snap = data.neurodesign_flow_editor_config;
    const hasSnap = snap && typeof snap === 'object' && Object.keys(snap).length > 0;
    if (hasSnap) {
      const userAp = stripLeadingContextFromPrompt(snap.additional_prompt, contextForApi);
      return {
        ...neuroDesignDefaultConfig(),
        ...snap,
        ...flowOverrides,
        additional_prompt: userAp,
        dimensions,
        image_size: imageSize,
        user_ai_connection_id: selectedConnectionId || snap.user_ai_connection_id,
        quantity: Math.min(Math.max(Number(data.quantity) || 1, 1), 5),
      };
    }
    const aiOv = data.neurodesign_ai_overrides && typeof data.neurodesign_ai_overrides === 'object' ? data.neurodesign_ai_overrides : {};
    const userBrief = (typeof data.prompt === 'string' ? data.prompt : '').trim();
    const base = {
      ...neuroDesignDefaultConfig(),
      ...aiOv,
      dimensions,
      image_size: imageSize,
      user_ai_connection_id: selectedConnectionId,
      additional_prompt: userBrief,
      quantity: Math.min(Math.max(Number(data.quantity) || 1, 1), 5),
    };
    if (Array.isArray(data.style_reference_urls) && data.style_reference_urls.length > 0) base.style_reference_urls = data.style_reference_urls;
    if (Array.isArray(data.style_reference_instructions)) base.style_reference_instructions = data.style_reference_instructions;
    if (typeof data.logo_url === 'string' && data.logo_url.trim()) base.logo_url = data.logo_url.trim();
    if (typeof data.logo_position === 'string') base.logo_position = data.logo_position;
    if (typeof data.ambient_color === 'string' && data.ambient_color.trim()) base.ambient_color = data.ambient_color.trim();
    if (typeof data.rim_light_color === 'string' && data.rim_light_color.trim()) base.rim_light_color = data.rim_light_color.trim();
    if (typeof data.fill_light_color === 'string' && data.fill_light_color.trim()) base.fill_light_color = data.fill_light_color.trim();
    if (data.visual_attributes && typeof data.visual_attributes === 'object') base.visual_attributes = data.visual_attributes;
    if (data.subject_gender === 'masculino' || data.subject_gender === 'feminino') base.subject_gender = data.subject_gender;
    if (typeof data.subject_description === 'string' && data.subject_description.trim()) base.subject_description = data.subject_description.trim();
    if (Array.isArray(data.subject_image_urls) && data.subject_image_urls.length > 0) base.subject_image_urls = data.subject_image_urls.filter((u) => typeof u === 'string' && u.trim()).slice(0, 2);
    return { ...base, ...flowOverrides };
  }, [
    contextForApi,
    dimensions,
    imageSize,
    selectedConnectionId,
    inputData,
    data.prompt,
    data.quantity,
    data.style_reference_urls,
    data.style_reference_instructions,
    data.logo_url,
    data.logo_position,
    data.ambient_color,
    data.rim_light_color,
    data.fill_light_color,
    data.visual_attributes,
    data.subject_gender,
    data.subject_description,
    data.subject_image_urls,
    data.neurodesign_ai_overrides,
    data.neurodesign_flow_editor_config,
  ]);

  if (expanded) {
    return (
      <Card
        className="w-[min(720px,calc(100vw-3rem))] max-w-3xl min-w-0 border-2 border-pink-500/50 shadow-lg flex flex-col overflow-hidden nodrag nowheel nopan"
        style={{ height: '720px' }}
      >
        <Handle type="target" position={Position.Left} className="!bg-pink-500" />
        <div className="flex shrink-0 items-center justify-end border-b border-pink-500/20 bg-pink-500/10 px-1 py-0.5">
          <FlowNodeHeaderDelete nodeId={id} onRemoveNode={data.onRemoveNode} selected={selected} />
        </div>
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden nodrag nowheel nopan" style={{ minHeight: 0 }}>
          <NeuroDesignFlowModal
            renderMode={NEURO_DESIGN_FLOW_RENDER_MODE.CONFIG_ONLY}
            onCollapse={handleCollapse}
            onEmbeddedSave={handleEmbeddedSave}
            inputData={inputData}
            initialConfig={neuroDesignInitialConfig}
            onResult={handleNeuroDesignResult}
          />
        </div>
        <Handle type="source" position={Position.Right} className="!bg-pink-500" />
      </Card>
    );
  }

  return (
    <Card className="w-64 max-w-[min(16rem,calc(100vw-2rem))] border-2 border-pink-500/50 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-pink-500" />
      <CardHeader className="flex flex-row items-center gap-2 p-3 bg-pink-500/10 min-w-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Paintbrush className="w-5 h-5 shrink-0 text-pink-500" />
          <CardTitle className="text-base truncate">Gerador de Imagem</CardTitle>
        </div>
        <FlowNodeHeaderDelete nodeId={id} onRemoveNode={data.onRemoveNode} selected={selected} />
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1">
            <Label className="text-xs">Prompt para a imagem</Label>
            {hasContext && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Ver contexto dos nós">
                    <Eye className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 max-h-[70vh] overflow-y-auto" align="end" side="bottom">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Contexto dos nós conectados</p>
                  <div className="space-y-3 text-sm">
                    {contextSections.map((sec, i) => (
                      <div key={i}>
                        <p className="font-medium text-foreground mb-1">{sec.title}</p>
                        <pre className="whitespace-pre-wrap break-words rounded bg-muted p-2 text-xs overflow-x-auto max-h-32 overflow-y-auto">
                          {sec.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <Textarea
            value={prompt}
            onChange={(e) => {
              const v = e.target.value;
              setPrompt(v);
              onUpdateNodeData(id, { prompt: v });
            }}
            placeholder={hasContext ? "Descreva a imagem que deseja gerar (o contexto dos nós já será enviado)..." : "Conecte nós à esquerda ou descreva a imagem..."}
            className="min-h-[56px] text-sm resize-y"
            disabled={isLoading}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Dimensões</Label>
            <Select
              value={dimensions}
              onValueChange={(v) => {
                setDimensions(v);
                onUpdateNodeData(id, { dimensions: v });
              }}
              disabled={isLoading}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIMENSION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Qualidade</Label>
            <Select
              value={imageSize}
              onValueChange={(v) => {
                setImageSize(v);
                onUpdateNodeData(id, { image_size: v });
              }}
              disabled={isLoading}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Conexão (Minha IA)</Label>
          <Select
            value={selectedConnectionId || ''}
            onValueChange={(v) => {
              setSelectedConnectionId(v);
              onUpdateNodeData(id, { user_ai_connection_id: v });
            }}
            disabled={isLoading}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Selecione uma conexão..." />
            </SelectTrigger>
            <SelectContent>
              {imageConnections.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name || c.provider || c.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Accordion type="single" collapsible className="w-full border rounded-md px-2">
          <AccordionItem value="advanced" className="border-0">
            <AccordionTrigger className="py-2 text-xs font-medium">Configurações avançadas</AccordionTrigger>
            <AccordionContent className="pt-0 pb-2 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Quantidade de imagens</Label>
                <Select
                  value={String(data.quantity ?? 1)}
                  onValueChange={(v) => onUpdateNodeData(id, { quantity: Math.min(Math.max(Number(v), 1), 5) })}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Referência de estilo (URL)</Label>
                <Input
                  placeholder="https://..."
                  value={Array.isArray(data.style_reference_urls) && data.style_reference_urls[0] ? data.style_reference_urls[0] : ''}
                  onChange={(e) => onUpdateNodeData(id, { style_reference_urls: e.target.value.trim() ? [e.target.value.trim()] : [] })}
                  className="h-8 text-xs"
                  disabled={isLoading}
                />
                <Input
                  placeholder="Instrução para a referência (opcional)"
                  value={Array.isArray(data.style_reference_instructions) && data.style_reference_instructions[0] != null ? data.style_reference_instructions[0] : ''}
                  onChange={(e) => onUpdateNodeData(id, { style_reference_instructions: [e.target.value.trim()] })}
                  className="h-8 text-xs"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL da logo</Label>
                <Input
                  placeholder="https://..."
                  value={typeof data.logo_url === 'string' ? data.logo_url : ''}
                  onChange={(e) => onUpdateNodeData(id, { logo_url: e.target.value.trim() || undefined })}
                  className="h-8 text-xs"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cores (ambiente, rim, preenchimento)</Label>
                <div className="grid grid-cols-3 gap-1">
                  <Input placeholder="Ambiente" value={data.ambient_color ?? ''} onChange={(e) => onUpdateNodeData(id, { ambient_color: e.target.value.trim() || undefined })} className="h-8 text-xs" disabled={isLoading} />
                  <Input placeholder="Rim" value={data.rim_light_color ?? ''} onChange={(e) => onUpdateNodeData(id, { rim_light_color: e.target.value.trim() || undefined })} className="h-8 text-xs" disabled={isLoading} />
                  <Input placeholder="Preench." value={data.fill_light_color ?? ''} onChange={(e) => onUpdateNodeData(id, { fill_light_color: e.target.value.trim() || undefined })} className="h-8 text-xs" disabled={isLoading} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estilo</Label>
                <Input
                  placeholder="Tags (ex.: minimalista, elegante)"
                  value={Array.isArray(data.visual_attributes?.style_tags) ? data.visual_attributes.style_tags.join(', ') : ''}
                  onChange={(e) => {
                    const tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
                    onUpdateNodeData(id, { visual_attributes: { ...(data.visual_attributes || {}), style_tags: tags } });
                  }}
                  className="h-8 text-xs"
                  disabled={isLoading}
                />
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={Boolean(data.visual_attributes?.ultra_realistic)}
                    onCheckedChange={(checked) => onUpdateNodeData(id, { visual_attributes: { ...(data.visual_attributes || {}), ultra_realistic: !!checked } })}
                    disabled={isLoading}
                  />
                  Ultra realista
                </label>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sujeito</Label>
                <Select
                  value={data.subject_gender === 'masculino' || data.subject_gender === 'feminino' ? data.subject_gender : ''}
                  onValueChange={(v) => onUpdateNodeData(id, { subject_gender: v === 'masculino' || v === 'feminino' ? v : undefined })}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Gênero (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="masculino">Masculino</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Descrição do sujeito"
                  value={typeof data.subject_description === 'string' ? data.subject_description : ''}
                  onChange={(e) => onUpdateNodeData(id, { subject_description: e.target.value.trim() || undefined })}
                  className="h-8 text-xs"
                  disabled={isLoading}
                />
                <Input
                  placeholder="URL da imagem do sujeito"
                  value={Array.isArray(data.subject_image_urls) && data.subject_image_urls[0] ? data.subject_image_urls[0] : ''}
                  onChange={(e) => onUpdateNodeData(id, { subject_image_urls: e.target.value.trim() ? [e.target.value.trim()] : [] })}
                  className="h-8 text-xs"
                  disabled={isLoading}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <div className="space-y-2 rounded-md border border-dashed border-pink-500/30 bg-pink-500/5 p-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Sparkles className="w-3.5 h-3.5 text-pink-600 shrink-0" />
            Preencher com IA (contexto + prompt)
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            A IA lê os nós anteriores e sugere prompt, formato, qualidade e opções de texto na imagem.
          </p>
          <Select
            value={selectedLlmIdForFill != null ? String(selectedLlmIdForFill) : ''}
            onValueChange={(v) => {
              setSelectedLlmIdForFill(v);
              onUpdateNodeData(id, { selectedLlmIdForImageConfigFill: v });
            }}
            disabled={isLoading || isAiFillingConfig || llmIntegrationsForFill.length === 0}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={llmIntegrationsForFill.length === 0 ? 'Nenhuma IA de texto' : 'Conexão de texto…'} />
            </SelectTrigger>
            <SelectContent>
              {llmIntegrationsForFill.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name || c.provider || c.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={handleAiFillConfig}
            disabled={isLoading || isAiFillingConfig || !selectedLlmIdForFill || llmIntegrationsForFill.length === 0}
          >
            {isAiFillingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
            Sugerir configuração
          </Button>
        </div>
        {!configured && (
          <p className="text-xs text-amber-800 dark:text-amber-200 rounded-md border border-amber-500/35 bg-amber-500/10 p-2 leading-snug">
            Antes de gerar, abra <strong className="font-medium">Configurar</strong> para o editor completo ou use <strong className="font-medium">Pronto para gerar</strong> se já estiver satisfeito com o prompt e as opções rápidas.
          </p>
        )}
        {configured && (
          <p className="text-xs text-emerald-800 dark:text-emerald-200 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5">
            Configuração confirmada — pode gerar. Use <strong className="font-medium">Reconfigurar</strong> para voltar ao modo de preparação.
          </p>
        )}
        <Button
          type="button"
          onClick={() => onUpdateNodeData(id, { expanded: true })}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Settings2 className="w-4 h-4 mr-2" />
          Configurar
        </Button>
        {!configured && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full text-xs"
            onClick={() => onUpdateNodeData(id, { imageGeneratorConfigured: true })}
            disabled={isLoading}
          >
            Pronto para gerar
          </Button>
        )}
        {configured && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground h-8"
            onClick={() => onUpdateNodeData(id, { imageGeneratorConfigured: false })}
            disabled={isLoading}
          >
            Reconfigurar
          </Button>
        )}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 rounded-md border border-pink-500/25 bg-muted/40 py-2.5 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-pink-500" />
            <span>A gerar imagem…</span>
          </div>
        )}
        {!isLoading && lastImageUrl && (
          <p className="text-center text-[10px] leading-snug text-muted-foreground px-1">
            A pré-visualização fica no nó <span className="font-medium text-foreground">Imagem gerada</span> ligado à direita.
          </p>
        )}
        {configured && (
          <Button
            type="button"
            onClick={handleGenerateWithConnection}
            disabled={isLoading || !selectedConnectionId || !fullPromptForApi}
            variant="default"
            className="w-full bg-pink-600 hover:bg-pink-700"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Gerar
          </Button>
        )}
        {lastError && (
          <p className="text-xs text-destructive mt-1 text-center">{lastError}</p>
        )}
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-pink-500" />
    </Card>
  );
});

export default ImageGeneratorNode;
