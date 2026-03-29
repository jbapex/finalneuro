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
import { Paintbrush, Play, Loader2, Eye, Expand, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import NeuroDesignFlowModal from '@/components/flow-builder/modals/NeuroDesignFlowModal';
import { mergeFlowInputDataIntoConfig } from '@/lib/neurodesign/flowConfigMerge';
import { neuroDesignDefaultConfig } from '@/lib/neurodesign/defaultConfig';
import { getFriendlyErrorMessage } from '@/lib/utils';

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

const ImageGeneratorNode = memo(({ data, id }) => {
  const { onUpdateNodeData, presets, inputData, expanded, onAddImageOutputNode, getFreshInputData } = data;
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [lastImageUrl, setLastImageUrl] = useState(data.lastImageUrl || null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [dimensions, setDimensions] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [imageConnections, setImageConnections] = useState([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [project, setProject] = useState(null);
  const [lastError, setLastError] = useState(null);

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

  const fullPromptForApi = (contextForApi + '\n\n' + (prompt || '').trim()).trim();

  const handleGenerateWithConnection = async () => {
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
      const baseConfig = {
        ...neuroDesignDefaultConfig(),
        dimensions,
        image_size: imageSize,
        user_ai_connection_id: selectedConnectionId,
        additional_prompt: fullPromptForApi,
        quantity: Math.min(Math.max(Number(data.quantity) || 1, 1), 5),
      };
      const flowOverrides = mergeFlowInputDataIntoConfig(freshInputData);
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
      const config = { ...baseConfig, ...flowOverrides, ...nodeOverrides };
      const { data: result, error } = await supabase.functions.invoke(fnName, {
        body: {
          projectId: proj.id,
          configId: null,
          config,
          userAiConnectionId: selectedConnectionId,
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
        friendlyDesc = "A API não retornou imagem. Pode ser filtro de conteúdo ou limite. Tente outro prompt, outra conexão ou 'Configurar e gerar' para ajustar referências.";
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

  const neuroDesignInitialConfig = useMemo(() => {
    const base = {
      ...neuroDesignDefaultConfig(),
      dimensions,
      image_size: imageSize,
      user_ai_connection_id: selectedConnectionId,
      additional_prompt: fullPromptForApi,
      quantity: Math.min(Math.max(Number(data.quantity) || 1, 1), 5),
    };
    if (Array.isArray(data.style_reference_urls) && data.style_reference_urls.length > 0) base.style_reference_urls = data.style_reference_urls;
    if (Array.isArray(data.style_reference_instructions)) base.style_reference_instructions = data.style_reference_instructions;
    if (typeof data.logo_url === 'string' && data.logo_url.trim()) base.logo_url = data.logo_url.trim();
    if (typeof data.ambient_color === 'string' && data.ambient_color.trim()) base.ambient_color = data.ambient_color.trim();
    if (typeof data.rim_light_color === 'string' && data.rim_light_color.trim()) base.rim_light_color = data.rim_light_color.trim();
    if (typeof data.fill_light_color === 'string' && data.fill_light_color.trim()) base.fill_light_color = data.fill_light_color.trim();
    if (data.visual_attributes && typeof data.visual_attributes === 'object') base.visual_attributes = data.visual_attributes;
    if (data.subject_gender === 'masculino' || data.subject_gender === 'feminino') base.subject_gender = data.subject_gender;
    if (typeof data.subject_description === 'string' && data.subject_description.trim()) base.subject_description = data.subject_description.trim();
    if (Array.isArray(data.subject_image_urls) && data.subject_image_urls.length > 0) base.subject_image_urls = data.subject_image_urls.filter((u) => typeof u === 'string' && u.trim()).slice(0, 2);
    return base;
  }, [dimensions, imageSize, selectedConnectionId, fullPromptForApi, data.quantity, data.style_reference_urls, data.style_reference_instructions, data.logo_url, data.ambient_color, data.rim_light_color, data.fill_light_color, data.visual_attributes, data.subject_gender, data.subject_description, data.subject_image_urls]);

  if (expanded) {
    return (
      <Card className="min-w-[920px] w-[920px] border-2 border-pink-500/50 shadow-lg flex flex-col overflow-hidden" style={{ height: '720px' }}>
        <Handle type="target" position={Position.Left} className="!bg-pink-500" />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ minHeight: 0 }}>
          <NeuroDesignFlowModal
            embedded
            onCollapse={handleCollapse}
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
    <Card className="w-72 border-2 border-pink-500/50 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-pink-500" />
      <CardHeader className="flex-row items-center space-x-2 p-3 bg-pink-500/10">
        <Paintbrush className="w-5 h-5 text-pink-500 shrink-0" />
        <CardTitle className="text-base">Gerador de Imagem</CardTitle>
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
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={hasContext ? "Descreva a imagem que deseja gerar (o contexto dos nós já será enviado)..." : "Conecte nós à esquerda ou descreva a imagem..."}
            className="min-h-[56px] text-sm resize-y"
            disabled={isLoading}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Dimensões</Label>
            <Select value={dimensions} onValueChange={setDimensions} disabled={isLoading}>
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
            <Select value={imageSize} onValueChange={setImageSize} disabled={isLoading}>
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
          <Select value={selectedConnectionId || ''} onValueChange={setSelectedConnectionId} disabled={isLoading}>
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
        <Button
          onClick={() => onUpdateNodeData(id, { expanded: true })}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Paintbrush className="w-4 h-4 mr-2" />
          Configurar e gerar
        </Button>
        <div className="w-full aspect-square bg-muted rounded-md flex items-center justify-center overflow-hidden relative group">
          {isLoading ? (
            <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
          ) : lastImageUrl ? (
            <>
              <img src={lastImageUrl} alt="Imagem gerada" className="w-full h-full object-cover cursor-pointer" onClick={() => setPreviewOpen(true)} />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button type="button" size="sm" variant="secondary" className="h-8" onClick={() => setPreviewOpen(true)}>
                  <Expand className="w-4 h-4 mr-1" /> Ver
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = lastImageUrl;
                    a.download = `imagem-gerada-${Date.now()}.png`;
                    a.click();
                  }}
                >
                  <Download className="w-4 h-4 mr-1" /> Baixar
                </Button>
              </div>
            </>
          ) : (
            <Paintbrush className="w-8 h-8 text-muted-foreground" />
          )}
        </div>
        {lastImageUrl && (
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="max-w-[90vw] max-h-[90vh] flex flex-col">
              <DialogHeader><DialogTitle>Imagem gerada</DialogTitle></DialogHeader>
              <div className="flex-1 min-h-0 overflow-auto flex justify-center">
                <img src={lastImageUrl} alt="Imagem gerada" className="max-w-full max-h-[70vh] object-contain" />
              </div>
              <Button
                type="button"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = lastImageUrl;
                  a.download = `imagem-gerada-${Date.now()}.png`;
                  a.click();
                }}
              >
                <Download className="w-4 h-4 mr-2" /> Baixar imagem
              </Button>
            </DialogContent>
          </Dialog>
        )}
        <Button
          onClick={handleGenerateWithConnection}
          disabled={isLoading || !selectedConnectionId || !fullPromptForApi}
          variant="default"
          className="w-full bg-pink-600 hover:bg-pink-700"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
          Gerar
        </Button>
        {lastError && (
          <p className="text-xs text-destructive mt-1 text-center">{lastError}</p>
        )}
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-pink-500" />
    </Card>
  );
});

export default ImageGeneratorNode;
