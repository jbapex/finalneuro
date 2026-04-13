import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { uploadNeuroDesignFile } from '@/lib/neurodesignStorage';
import { ZoneGrid } from '@/components/neurodesign/ZoneGrid';
import { Sparkles, Copy, Upload, X, Save, MapPin, Bot, Brain } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { neuroDesignDefaultConfig, mergeNeuroDesignDefaults } from '@/lib/neurodesign/defaultConfig';
import { getLogoUrlForIntegration } from '@/lib/llmIntegrationLogo';
import { NeuroDesignFontPicker } from '@/components/neurodesign/NeuroDesignFontPicker';

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

const LOGO_POSITION_LABELS = {
  '': 'Automático',
  'top-left': 'Superior esquerdo',
  'top-center': 'Superior centro',
  'top-right': 'Superior direito',
  'center-left': 'Meio esquerda',
  center: 'Centro',
  'center-right': 'Meio direita',
  'bottom-left': 'Inferior esquerdo',
  'bottom-center': 'Rodapé centro',
  'bottom-right': 'Inferior direito',
};

const VALUE_SAME_AS_BLOCK = '__block__';

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

/** Texto para o LLM do wizard: dados do cliente + documentos de contexto. */
function formatWizardClientContextForWizard(detail) {
  if (!detail) return '';
  const ctxs = detail.client_contexts;
  const { client_contexts: _omit, ...rest } = detail;
  const lines = [
    '--- Contexto do cliente (marca, tom, público; use nas perguntas e no prompt final) ---',
    JSON.stringify(rest, null, 2),
  ];
  if (Array.isArray(ctxs) && ctxs.length > 0) {
    lines.push('Documentos de contexto:');
    for (const c of ctxs) {
      const name = String(c?.name || 'Contexto').trim();
      const content = String(c?.content || '').trim();
      lines.push(`### ${name}\n${content}`);
    }
  }
  return lines.join('\n\n');
}

/** Conteúdo user message: string ou multimodal (visão) para generic-ai-chat. */
function buildWizardMessageContent(text, imagePublicUrl) {
  const t = String(text || '');
  const url = String(imagePublicUrl || '').trim();
  if (!url) return t;
  return [
    { type: 'text', text: t },
    { type: 'image_url', image_url: { url } },
  ];
}

const defaultConfig = neuroDesignDefaultConfig;

/** Mesmo visual que o seletor do Chat IA: círculo primary/10 + logo resolvida por modelo/provedor. */
function FillWithAiLlmMenuLogo({ connection, logosMap }) {
  const [broken, setBroken] = useState(false);
  const url = getLogoUrlForIntegration(logosMap, connection);
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
      {url && !broken ? (
        <img src={url} alt="" className="h-full w-full object-contain" onError={() => setBroken(true)} />
      ) : (
        <Brain className="h-3.5 w-3.5 text-primary" />
      )}
    </span>
  );
}

const BuilderPanel = ({
  project,
  config,
  setConfig,
  imageConnections,
  onGenerate,
  isGenerating,
  onFillFromPrompt,
  hasLlmConnection,
  isFillingFromPrompt,
  selectedLlmId,
  /** Conexões Minha IA com `text_generation` — para escolher qual LLM usar em Preencher com IA / wizard */
  llmConnections = [],
  onSelectLlmId,
  seedFillPrompt,
  embeddedSaveMode,
  onSaveAndBack,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [localConfig, setLocalConfig] = useState(() => mergeNeuroDesignDefaults(config));
  const [fillPromptInput, setFillPromptInput] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardGenerating, setWizardGenerating] = useState(false);
  const [wizardSeed, setWizardSeed] = useState('');
  const [wizardQuestions, setWizardQuestions] = useState([
    { question: '', options: [] },
    { question: '', options: [] },
    { question: '', options: [] },
    { question: '', options: [] },
  ]);
  const [wizardAnswers, setWizardAnswers] = useState(['', '', '', '']);
  const [wizardClientId, setWizardClientId] = useState('');
  const [wizardClients, setWizardClients] = useState([]);
  const [wizardClientsLoading, setWizardClientsLoading] = useState(false);
  const [wizardClientDetail, setWizardClientDetail] = useState(null);
  const [wizardClientLoading, setWizardClientLoading] = useState(false);
  const [wizardRefImageUrl, setWizardRefImageUrl] = useState('');
  const [wizardRefUploading, setWizardRefUploading] = useState(false);
  const wizardRefInputRef = useRef(null);
  const [isUploadingStyleRefs, setIsUploadingStyleRefs] = useState(false);
  const styleRefsInputRef = useRef(null);
  const [logosByProvider, setLogosByProvider] = useState({});

  React.useEffect(() => {
    const next = mergeNeuroDesignDefaults(config);
    const refUrls = next.style_reference_urls || [];
    const refInstr = next.style_reference_instructions || [];
    if (refUrls.length > 0 && refInstr.length === 0 && next.style_reference_instruction) {
      next.style_reference_instructions = [next.style_reference_instruction];
      next.style_reference_instruction = '';
    }
    setLocalConfig(next);
  }, [config]);

  React.useEffect(() => {
    if (seedFillPrompt !== undefined && seedFillPrompt !== null && String(seedFillPrompt).trim()) {
      setFillPromptInput(String(seedFillPrompt).trim());
    }
  }, [seedFillPrompt]);

  React.useEffect(() => {
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
        // falha silenciosa: apenas não exibe logos
      }
    };
    loadLogos();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!wizardOpen || !user?.id) return;
    let cancelled = false;
    setWizardClientsLoading(true);
    (async () => {
      const { data, error } = await supabase.from('clients').select('id, name').eq('user_id', user.id).order('name');
      if (!cancelled) {
        setWizardClientsLoading(false);
        if (!error && Array.isArray(data)) setWizardClients(data);
        else setWizardClients([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wizardOpen, user?.id]);

  React.useEffect(() => {
    if (!wizardClientId || !user?.id) {
      setWizardClientDetail(null);
      setWizardClientLoading(false);
      return;
    }
    const id = parseInt(wizardClientId, 10);
    if (Number.isNaN(id)) {
      setWizardClientDetail(null);
      setWizardClientLoading(false);
      return;
    }
    let cancelled = false;
    setWizardClientLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*, client_contexts(name, content)')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      if (cancelled) return;
      setWizardClientLoading(false);
      if (!error && data) setWizardClientDetail(data);
      else {
        setWizardClientDetail(null);
        if (error) {
          toast({ title: 'Cliente', description: error.message || 'Não foi possível carregar o contexto.', variant: 'destructive' });
          setWizardClientId('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wizardClientId, user?.id, toast]);

  const handleWizardOpenChange = useCallback((open) => {
    setWizardOpen(open);
    if (!open) {
      setWizardClientId('');
      setWizardClientDetail(null);
      setWizardClientLoading(false);
      setWizardRefImageUrl('');
      setWizardRefUploading(false);
      if (wizardRefInputRef.current) wizardRefInputRef.current.value = '';
    }
  }, []);

  const handleWizardRefImageChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!project?.id || !user) {
        toast({
          title: 'Não foi possível enviar',
          description: !project?.id ? 'Selecione uma galeria primeiro.' : 'Faça login.',
          variant: 'destructive',
        });
        return;
      }
      setWizardRefUploading(true);
      try {
        const url = await uploadNeuroDesignFile(user.id, project.id, 'wizard_ref', file);
        setWizardRefImageUrl(url);
        toast({
          title: 'Imagem de referência',
          description: 'Anexada ao wizard. Use um modelo com visão (ex.: GPT-4o, Gemini com imagem).',
        });
      } catch (err) {
        toast({ title: 'Erro no upload', description: err?.message || String(err), variant: 'destructive' });
      } finally {
        setWizardRefUploading(false);
        if (wizardRefInputRef.current) wizardRefInputRef.current.value = '';
      }
    },
    [project?.id, user, toast]
  );

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

  const parseWizardQuestions = (raw) => {
    if (!raw || typeof raw !== 'string') return [];
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      const parsed = JSON.parse(clean);
      const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.questions) ? parsed.questions : []);
      return list
        .map((q) => ({
          question: String(q?.question || '').trim(),
          options: Array.isArray(q?.options) ? q.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 6) : [],
        }))
        .filter((q) => q.question);
    } catch {
      return [];
    }
  };

  const buildFallbackWizardQuestions = (seed) => ([
    { question: `Qual o objetivo principal da arte para "${seed}"?`, options: ['Conversão', 'Autoridade', 'Engajamento'] },
    { question: 'Qual oferta/mensagem principal precisa ser destaque?', options: [] },
    { question: 'Qual público e tom visual deseja?', options: ['Premium', 'Moderno', 'Direto', 'Minimalista'] },
    { question: 'Qual CTA final e restrições obrigatórias?', options: ['Comprar agora', 'Saiba mais', 'Fale no WhatsApp'] },
  ]);

  const startWizardPlanner = async () => {
    const seed = wizardSeed.trim();
    if (!seed || !selectedLlmId) return;
    const clientBlock = formatWizardClientContextForWizard(wizardClientDetail);
    const seedWithCtx = clientBlock ? `${clientBlock}\n\n--- Pedido inicial ---\n${seed}` : seed;
    const visionHint = wizardRefImageUrl
      ? '\n\n(Uma imagem de referência foi anexada: use estilo, cores e composição ao formular as perguntas.)'
      : '';
    setWizardLoading(true);
    setWizardStep(0);
    setWizardAnswers(['', '', '', '']);
    try {
      const planner = await supabase.functions.invoke('generic-ai-chat', {
        body: JSON.stringify({
          session_id: null,
          messages: [
            {
              role: 'system',
              content:
                'Crie 4 perguntas para refinamento de brief de design. Retorne APENAS JSON válido: {"questions":[{"question":"...","options":["..."]}]}. Se houver imagem anexada, considere o visual nas perguntas.',
            },
            {
              role: 'user',
              content: buildWizardMessageContent(`Pedido inicial:\n${seedWithCtx}${visionHint}`, wizardRefImageUrl),
            },
          ],
          llm_integration_id: selectedLlmId,
          is_user_connection: true,
          context: 'neurodesign_prompt_creator_wizard',
        }),
      });
      const plannerOut = String(planner?.data?.response || planner?.data?.content || '');
      let questions = parseWizardQuestions(plannerOut);
      if (questions.length < 4) {
        const repaired = await supabase.functions.invoke('generic-ai-chat', {
          body: JSON.stringify({
            session_id: null,
            messages: [
              {
                role: 'system',
                content: 'Converta a saída para JSON válido no formato {"questions":[{"question":"...","options":["..."]}]} com EXATAMENTE 4 perguntas.',
              },
              {
                role: 'user',
                content: buildWizardMessageContent(`Pedido:\n${seedWithCtx}\n\nSaída anterior:\n${plannerOut}`, wizardRefImageUrl),
              },
            ],
            llm_integration_id: selectedLlmId,
            is_user_connection: true,
            context: 'neurodesign_prompt_creator_wizard_repair',
          }),
        });
        const repairedOut = String(repaired?.data?.response || repaired?.data?.content || '');
        const repairedQuestions = parseWizardQuestions(repairedOut);
        if (repairedQuestions.length >= 4) questions = repairedQuestions;
      }
      const finalQuestions = (questions.length >= 4 ? questions.slice(0, 4) : buildFallbackWizardQuestions(seed))
        .map((q) => ({ question: q.question, options: q.options || [] }));
      setWizardQuestions(finalQuestions);
    } catch {
      setWizardQuestions(buildFallbackWizardQuestions(seed));
    } finally {
      setWizardLoading(false);
    }
  };

  const generateWizardPrompt = async () => {
    const seed = wizardSeed.trim();
    if (!seed) return;
    if (wizardAnswers.some((a) => !String(a || '').trim())) return;
    const clientBlock = formatWizardClientContextForWizard(wizardClientDetail);
    const seedWithCtx = clientBlock ? `${clientBlock}\n\n--- Pedido inicial ---\n${seed}` : seed;
    const visionHint = wizardRefImageUrl
      ? '\n\n(Imagem de referência anexada: alinhe estilo, cores, composição e hierarquia visual no prompt textual.)'
      : '';
    setWizardGenerating(true);
    try {
      const qa = wizardQuestions
        .map((q, idx) => `Q${idx + 1}: ${q.question}\nA${idx + 1}: ${wizardAnswers[idx] || ''}`)
        .join('\n\n');
      const userContent = buildWizardMessageContent(
        `Pedido inicial:\n${seedWithCtx}\n\nRespostas do wizard:\n${qa}${visionHint}`,
        wizardRefImageUrl
      );
      const { data, error } = await supabase.functions.invoke('generic-ai-chat', {
        body: JSON.stringify({
          session_id: null,
          messages: [
            {
              role: 'system',
              content:
                'Você é um especialista em criação de prompts para geração de imagens. Gere um prompt final detalhado e objetivo para o NeuroDesign. Se houver imagem anexada, incorpore fielmente o que for visível (estilo, paleta, enquadramento) no texto do prompt.',
            },
            {
              role: 'user',
              content: userContent,
            },
          ],
          llm_integration_id: selectedLlmId,
          is_user_connection: true,
          context: 'neurodesign_prompt_creator',
        }),
      });
      if (error) throw new Error(error.message || String(error));
      if (data?.error) throw new Error(data.error);
      const finalPrompt = String(data?.response || data?.content || '').trim();
      if (!finalPrompt) throw new Error('A IA não retornou prompt final.');
      setFillPromptInput(finalPrompt);
      setWizardOpen(false);
      setWizardStep(0);
      setWizardSeed('');
      setWizardQuestions([
        { question: '', options: [] },
        { question: '', options: [] },
        { question: '', options: [] },
        { question: '', options: [] },
      ]);
      setWizardAnswers(['', '', '', '']);
      toast({ title: 'Prompt criado', description: 'Prompt inserido em "Preencher com IA".' });
    } catch (e) {
      toast({ title: 'Erro no criador de prompt', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setWizardGenerating(false);
    }
  };

  if (!project) {
    return (
      <div className="p-6 text-muted-foreground text-sm">
        Selecione ou crie uma galeria na barra lateral para configurar o builder.
      </div>
    );
  }

  const fillWithAiActiveLlm =
    hasLlmConnection && llmConnections.length > 0
      ? llmConnections.find((c) => String(c.id) === String(selectedLlmId)) || llmConnections[0]
      : null;
  const fillWithAiLlmButtonTitle = fillWithAiActiveLlm
    ? `Modelo de texto: ${fillWithAiActiveLlm.name}`
    : 'Escolher modelo de texto';

  return (
    <div className="p-4 space-y-6">
      {typeof onFillFromPrompt === 'function' && (
        <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm font-medium">Preencher com IA</Label>
            {hasLlmConnection && llmConnections.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="default"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full bg-primary p-0 text-primary-foreground shadow-md shadow-primary/35 transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/45 focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50"
                    title={fillWithAiLlmButtonTitle}
                    disabled={!onSelectLlmId}
                    aria-label="Escolher modelo de texto para Preencher com IA"
                  >
                    <Bot className="h-[1.05rem] w-[1.05rem]" strokeWidth={2} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[min(calc(100vw-2rem),18rem)]">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Modelo de texto</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {llmConnections.map((c) => {
                    const isActive = fillWithAiActiveLlm && String(c.id) === String(fillWithAiActiveLlm.id);
                    return (
                      <DropdownMenuItem
                        key={c.id}
                        className={`cursor-pointer items-center gap-2 py-2 text-xs focus:bg-accent ${isActive ? 'bg-accent/60' : ''}`}
                        onSelect={() => onSelectLlmId?.(Number(c.id))}
                      >
                        <FillWithAiLlmMenuLogo connection={c} logosMap={logosByProvider} />
                        <span className="min-w-0 flex-1 truncate font-medium leading-snug">{c.name}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={!hasLlmConnection || !selectedLlmId}
            onClick={() => setWizardOpen(true)}
          >
            Criador de Prompt (Wizard)
          </Button>
          {!hasLlmConnection && (
            <p className="text-xs text-amber-500">Configure uma conexão de modelo de linguagem em Minha IA para usar esta função.</p>
          )}
          {hasLlmConnection && !selectedLlmId && (
            <p className="text-xs text-amber-500">Defina uma conexão LLM padrão em Minha IA para usar o wizard.</p>
          )}
        </div>
      )}
      <div>
        <Label className="text-muted-foreground">Conexão de imagem</Label>
        <Select
          value={localConfig.user_ai_connection_id || 'none'}
          onValueChange={(v) => update('user_ai_connection_id', v === 'none' ? null : v)}
        >
          <SelectTrigger className="mt-1 h-10 rounded-full bg-gradient-to-r from-primary/45 to-primary/30 border border-primary/60 hover:from-primary/55 hover:to-primary/40 hover:border-primary/70 text-foreground font-medium shadow-md shadow-primary/15 hover:shadow-lg hover:shadow-primary/25 transition-all duration-200 placeholder:text-muted-foreground">
            <SelectValue placeholder="Selecione uma conexão" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border">
            <SelectItem value="none">Usar mock (sem conexão)</SelectItem>
            {imageConnections.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <div className="flex items-center gap-2">
                  {logosByProvider[c.provider] && (
                    <img
                      src={logosByProvider[c.provider]}
                      alt=""
                      className="h-4 w-4 rounded-sm object-contain"
                    />
                  )}
                  <span>{c.name}</span>
                  {c.provider && (
                    <span className="text-xs text-muted-foreground">({c.provider})</span>
                  )}
                </div>
              </SelectItem>
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
            <Select
              value={
                (localConfig.subject_mode || 'person') === 'product'
                  ? 'produto'
                  : (localConfig.subject_gender || 'feminino') === 'masculino'
                    ? 'masculino'
                    : 'feminino'
              }
              onValueChange={(v) => {
                if (v === 'produto') {
                  setLocalConfig((prev) => {
                    const next = { ...prev, subject_mode: 'product', subject_gender: '' };
                    setConfig?.(next);
                    return next;
                  });
                } else {
                  setLocalConfig((prev) => {
                    const next = { ...prev, subject_mode: 'person', subject_gender: v };
                    setConfig?.(next);
                    return next;
                  });
                }
              }}
            >
              <SelectTrigger className="mt-2 bg-muted border-border text-foreground placeholder:text-muted-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground">
                <SelectItem value="feminino">Feminino</SelectItem>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="produto">Produto / objeto</SelectItem>
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

      <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Label className="text-sm font-semibold text-foreground">Texto na imagem</Label>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              Ligue para configurar títulos, CTA, gradiente e formas de texto na arte.
            </p>
          </div>
          <Switch
            checked={!!localConfig.text_enabled}
            onCheckedChange={(v) => update('text_enabled', v)}
            className="shrink-0 data-[state=unchecked]:bg-muted-foreground/40"
            aria-label="Ativar texto na imagem"
          />
        </div>
        {!localConfig.text_enabled && (
          <p className="text-xs text-amber-600 dark:text-amber-500/90 rounded-md bg-amber-500/10 border border-amber-500/25 px-2.5 py-2">
            Com esta opção desligada, os campos de texto (incluindo <strong>Gradiente no texto</strong>) ficam ocultos.
            Ative o interruptor acima para ver todas as opções.
          </p>
        )}
        {localConfig.text_enabled && (
          <div className="mt-1 pt-2 border-t border-border space-y-4">
            <div>
              <Label className="text-xs mb-1 block">Modo</Label>
              <Select value={localConfig.text_mode || 'structured'} onValueChange={(v) => update('text_mode', v)}>
                <SelectTrigger className="h-8 min-h-10 sm:min-h-0 bg-muted border-border text-foreground text-base sm:text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground">
                  <SelectItem value="structured">Padrão (título, subtítulo, CTA)</SelectItem>
                  <SelectItem value="free">Texto livre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(localConfig.text_mode || 'structured') === 'free' ? (
              <div className="space-y-3 rounded-md border border-border p-2">
                <div>
                  <Label className="text-xs font-medium">Texto a exibir na imagem</Label>
                  <Textarea placeholder="Digite o texto (ex.: parágrafo para card)" value={localConfig.custom_text || ''} onChange={(e) => update('custom_text', e.target.value)} className="mt-1 bg-muted border-border text-foreground placeholder:text-muted-foreground min-h-[80px]" />
                </div>
                <div>
                  <Label className="text-xs">Descrição da fonte (opcional)</Label>
                  <Input placeholder="Ex.: sans serifa, negrito" value={localConfig.custom_text_font_description || ''} onChange={(e) => update('custom_text_font_description', e.target.value)} className="mt-1 bg-muted border-border text-foreground placeholder:text-muted-foreground" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Usar texto da imagem de referência</Label>
                  <Switch checked={!!localConfig.use_reference_image_text} onCheckedChange={(v) => update('use_reference_image_text', v)} />
                </div>
                <p className="text-xs text-muted-foreground">Ative para a IA reproduzir o texto visível na(s) imagem(ns) de referência na arte gerada.</p>
              </div>
            ) : (
              <>
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
                <NeuroDesignFontPicker
                  id="nd-headline-font"
                  value={localConfig.headline_font ?? ''}
                  onChange={(v) => update('headline_font', v)}
                />
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
                <NeuroDesignFontPicker
                  id="nd-subheadline-font"
                  value={localConfig.subheadline_font ?? ''}
                  onChange={(v) => update('subheadline_font', v)}
                />
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
                <NeuroDesignFontPicker
                  id="nd-cta-font"
                  value={localConfig.cta_font ?? ''}
                  onChange={(v) => update('cta_font', v)}
                />
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

            <div className="flex items-center gap-2 rounded-md border border-border/80 bg-background/50 px-2 py-1.5">
              <Switch
                checked={!!localConfig.text_gradient}
                onCheckedChange={(v) => update('text_gradient', v)}
                className="data-[state=unchecked]:bg-muted-foreground/40"
                aria-label="Gradiente no texto"
              />
              <Label className="text-xs font-medium cursor-pointer">Gradiente no texto</Label>
            </div>
              </>
            )}
          </div>
        )}
      </div>

      <div>
        <Label>Logo na arte</Label>
        <p className="text-xs text-muted-foreground mt-1">
          A logo anexa será incluída na imagem. Use <span className="font-medium text-foreground">Posição da logo</span> para escolher o canto ou a zona (ou deixe automático).
        </p>
        <div className="flex gap-2 flex-wrap items-center mt-2">
          {localConfig.logo_url ? (
            <div className="relative w-14 h-14 rounded overflow-hidden bg-muted shrink-0">
              <img src={localConfig.logo_url} alt="Logo" className="w-full h-full object-contain" />
              <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const next = { ...localConfig, logo_url: '', logo_position: '' };
              setLocalConfig(next);
              setConfig?.(next);
            }}
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
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-xs shrink-0"
                disabled={!localConfig.logo_url}
                title={!localConfig.logo_url ? 'Envie uma logo primeiro' : undefined}
              >
                <MapPin className="h-3.5 w-3.5 mr-1.5" />
                Posição da logo
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto max-w-[min(100vw-2rem,20rem)]" align="start">
              <p className="text-xs font-medium mb-2">Onde colocar na arte</p>
              <p className="text-xs text-muted-foreground mb-2">
                Atual: {LOGO_POSITION_LABELS[localConfig.logo_position] ?? LOGO_POSITION_LABELS['']}
              </p>
              <ZoneGrid
                value={localConfig.logo_position || ''}
                onChange={(z) => update('logo_position', z)}
                aria-label="Zona da logo na arte"
              />
            </PopoverContent>
          </Popover>
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
        {(localConfig.style_reference_urls || []).length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Ao preencher o campo acima, a geração prioriza a referência e essas instruções (fontes, layout, estética) em relação a zonas de texto, fontes e cores do formulário.
          </p>
        )}
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
        {embeddedSaveMode ? (
          <Button
            type="button"
            className="flex-1 bg-primary hover:bg-primary/90"
            onClick={() => onSaveAndBack?.(localConfig)}
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar e voltar
          </Button>
        ) : (
          (() => {
            const hasConnection = localConfig.user_ai_connection_id && localConfig.user_ai_connection_id !== 'none';
            const isFreeMode = (localConfig.text_mode || 'structured') === 'free';
            const hasTextFilled =
              !localConfig.text_enabled ||
              (isFreeMode
                ? Boolean((localConfig.custom_text || '').trim() || localConfig.use_reference_image_text)
                : Boolean(
                    (localConfig.headline_h1 || '').trim() ||
                      (localConfig.subheadline_h2 || '').trim() ||
                      (localConfig.cta_button_text || '').trim()
                  ));
            const disabled = isGenerating || !hasConnection || !hasTextFilled;
            const title = !hasConnection
              ? 'Selecione uma conexão de imagem para gerar'
              : !hasTextFilled
                ? isFreeMode
                  ? "Com 'Texto na imagem' em modo livre, preencha o texto ou ative 'Usar texto da imagem de referência'"
                  : "Com 'Texto na imagem' ativado, preencha pelo menos um campo: Título H1, Subtítulo H2 ou Texto do botão CTA"
                : undefined;
            return (
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={() => onGenerate?.(localConfig)}
                disabled={disabled}
                title={title}
              >
                {isGenerating ? (
                  <span className="animate-pulse">Gerando...</span>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" /> Gerar Imagem
                  </>
                )}
              </Button>
            );
          })()
        )}
        <Button variant="outline" size="icon" onClick={() => setConfig?.({ ...localConfig, id: undefined })} title="Duplicar configuração">
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <Dialog open={wizardOpen} onOpenChange={handleWizardOpenChange}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criador de Prompt (Wizard)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente (opcional)</Label>
              <Select
                value={wizardClientId ? String(wizardClientId) : '__none__'}
                onValueChange={(v) => setWizardClientId(v === '__none__' ? '' : v)}
                disabled={wizardLoading || wizardGenerating}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {wizardClients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {wizardClientLoading && (
                <p className="text-xs text-muted-foreground mt-1">Carregando contexto do cliente…</p>
              )}
              {wizardOpen && !wizardClientsLoading && wizardClients.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhum cliente cadastrado. Crie em{' '}
                  <Link to="/clientes" className="underline text-primary">
                    Clientes
                  </Link>{' '}
                  para usar contexto aqui.
                </p>
              )}
            </div>
            <div>
              <Label>Imagem de referência (opcional)</Label>
              <p className="text-xs text-muted-foreground mt-1">
                A IA enxerga a imagem nas chamadas do wizard. Use conexão com modelo de visão (ex.: GPT-4o, Gemini com imagem).
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  ref={wizardRefInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleWizardRefImageChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={wizardRefUploading || wizardLoading || wizardGenerating}
                  onClick={() => wizardRefInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {wizardRefUploading ? 'Enviando…' : 'Escolher imagem'}
                </Button>
                {wizardRefImageUrl ? (
                  <>
                    <img src={wizardRefImageUrl} alt="" className="h-12 w-12 rounded border object-cover" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setWizardRefImageUrl('')}
                      title="Remover referência"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
            <div>
              <Label>Pedido inicial</Label>
              <Textarea
                value={wizardSeed}
                onChange={(e) => setWizardSeed(e.target.value)}
                placeholder="Ex.: Criar arte para campanha de tráfego para clínica estética..."
                className="mt-1 min-h-[80px]"
              />
              <Button
                type="button"
                variant="outline"
                className="mt-2"
                onClick={startWizardPlanner}
                disabled={
                  !wizardSeed.trim() ||
                  !selectedLlmId ||
                  wizardLoading ||
                  wizardGenerating ||
                  wizardClientLoading
                }
              >
                {wizardLoading ? 'Gerando perguntas...' : 'Iniciar wizard'}
              </Button>
            </div>
            <div>
              <Label>Pergunta {wizardStep + 1} de 4</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {wizardQuestions[wizardStep]?.question || 'Clique em "Iniciar wizard" para montar perguntas personalizadas.'}
              </p>
              {(wizardQuestions[wizardStep]?.options || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {wizardQuestions[wizardStep].options.map((opt) => (
                    <Button
                      key={opt}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setWizardAnswers((prev) => {
                          const next = [...prev];
                          next[wizardStep] = opt;
                          return next;
                        })
                      }
                      className="h-7"
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
              )}
              <Textarea
                value={wizardAnswers[wizardStep] || ''}
                onChange={(e) =>
                  setWizardAnswers((prev) => {
                    const next = [...prev];
                    next[wizardStep] = e.target.value;
                    return next;
                  })
                }
                placeholder="Sua resposta..."
                className="mt-1 min-h-[84px]"
                disabled={wizardLoading || wizardGenerating || !wizardQuestions[wizardStep]?.question}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setWizardStep((s) => Math.max(0, s - 1))}
                disabled={wizardStep === 0 || wizardGenerating || wizardLoading || wizardClientLoading}
              >
                Voltar
              </Button>
              {wizardStep < 3 ? (
                <Button
                  type="button"
                  onClick={() => setWizardStep((s) => Math.min(3, s + 1))}
                  disabled={
                    !wizardSeed.trim() ||
                    !String(wizardAnswers[wizardStep] || '').trim() ||
                    wizardGenerating ||
                    wizardLoading ||
                    wizardClientLoading ||
                    !wizardQuestions[wizardStep]?.question
                  }
                >
                  Próxima
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={generateWizardPrompt}
                  disabled={
                    wizardGenerating ||
                    wizardLoading ||
                    wizardClientLoading ||
                    !wizardSeed.trim() ||
                    wizardAnswers.some((a) => !String(a || '').trim())
                  }
                >
                  {wizardGenerating ? 'Gerando...' : 'Gerar prompt final'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BuilderPanel;
