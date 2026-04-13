import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { getDefaultAiConnection } from '@/lib/userAiDefaults';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { ImagePlus, Loader2, MessageSquare, Sparkles, X } from 'lucide-react';
import { NEURO_MOTION_AI_SYSTEM_PROMPT } from '@/lib/neuroMotion/aiSystemPrompt';
import { NEURO_MOTION_FORMAT_PRESETS } from '@/lib/neuroMotion/constants';
import { parseJsonFromAssistant, sanitizeNeuroMotionProjectJson } from '@/lib/neuroMotion/aiApplyJson';
import { compressImageToJpegDataUrl } from '@/lib/neuroMotion/referenceImage';

const MAX_PROJECT_JSON_CHARS = 12000;
const MAX_USER_INSTRUCTION_CHARS = 7000;

/** Estado completo ou compactado para não estourar contexto quando há muitas layers. */
function projectSnapshotForAi(format, transitionFrames, scenes) {
  const full = {
    format,
    transitionFrames,
    scenes: scenes.map(({ id: _id, ...rest }) => rest),
  };
  const str = JSON.stringify(full);
  if (str.length <= MAX_PROJECT_JSON_CHARS) {
    return { payload: full, wasCompact: false };
  }
  return {
    payload: {
      format,
      transitionFrames,
      _compact: true,
      note: 'Estado compactado. Devolve JSON completo com scenes[] e layers detalhadas (text com copy visível).',
      scenes: scenes.map(({ id: _id, title, subtitle, durationSec, transition, hideClassicText, layers, accentColor, backgroundColor, imageUrl }, i) => ({
        index: i,
        title,
        subtitle: String(subtitle || '').slice(0, 220),
        durationSec,
        transition,
        hideClassicText,
        accentColor,
        backgroundColor,
        imageUrl: imageUrl ? '[url]' : '',
        layersPreview: Array.isArray(layers)
          ? layers.slice(0, 10).map((l) => ({
              type: l.type,
              text: typeof l.text === 'string' ? l.text.slice(0, 100) : undefined,
              x: l.x,
              y: l.y,
              w: l.w,
              h: l.h,
            }))
          : [],
        layersTotal: Array.isArray(layers) ? layers.length : 0,
      })),
    },
    wasCompact: true,
  };
}

const DEFAULT_IMAGE_PROMPT =
  'Recria o layout da imagem com fidelidade máxima: todos os textos visíveis literais em camadas type:text (sem parafrasear). Mockup UI com rects + textos; card destacado com glow roxo; cursor branco se existir. hideClassicText: true.';

/** Instruções extra quando há imagem anexada (fidelidade a screenshot). */
function referenceFidelityInstructions(preset) {
  return `
## Modo fidelidade ao screenshot (OBRIGATÓRIO com imagem)
- **OCR completo:** copia **literalmente** cada frase visível (sidebar, título da página, subtítulo, título e descrição de **cada** card, botões). Proibido resumir, traduzir ou inventar copy.
- **Layout:** replica proporções gerais — coluna esquerda (marca + nav) vs área principal; grelha de cards em fila se for o caso. Usa **type: rect** para fundos dos cards e **type: text** com **textAlign: "left"** para títulos/descrições dentro dos cards (lineHeight 1.25–1.45 para parágrafos).
- **Tipografia:** calibra ao quadro **${preset.width}×${preset.height}px** — título de secção ~36–52px, título de card ~20–30px, corpo ~13–19px; **fontWeight** 600–800 em títulos, 500–600 em descrições; cores **#ffffff** / **#a1a1aa** ou equivalentes ao print.
- **Card em destaque:** **stroke** roxo visível + **boxShadow** tipo glow (ex.: 0 0 28px accent); restantes cards mais discretos.
- **Cursor / ponto branco:** **type: cursor** (círculo branco) centrado sobre o card alvo, zIndex alto.
- **hideClassicText: true** se todo o texto estiver em layers (recomendado).
- Até **24 layers** por cena para UI densa; não simplifiques para “só quadrados” — cada texto legível no print = pelo menos um **text** com **text** preenchido.
- **Não** uses **imageUrl** com a foto anexada; reconstrói só com layers.
`.trim();
}

/**
 * Chat lateral que gera/atualiza o JSON do projecto NeuroMotion via generic-ai-chat.
 * Suporta imagem de referência (visão): comprime e envia data URL ao modelo para recriar o visual.
 */
const NeuroMotionAiChat = ({ user, format, transitionFrames, scenes, onApplyProject, disabled, className = '' }) => {
  const { toast } = useToast();
  const [llmConnections, setLlmConnections] = useState([]);
  const [selectedLlmId, setSelectedLlmId] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastReply, setLastReply] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

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
      setSelectedLlmId((prev) =>
        list.length > 0 && (!prev || !list.some((c) => String(c.id) === String(prev))) ? list[0].id : prev
      );
    } catch {
      setLlmConnections([]);
    }
  }, [user]);

  useEffect(() => {
    void fetchLlmConnections();
  }, [fetchLlmConnections]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onPickImage = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagem demasiado grande', description: 'Máximo 5 MB.', variant: 'destructive' });
      return;
    }
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowed.includes(f.type)) {
      toast({ title: 'Formato inválido', description: 'Use PNG, JPEG, WebP ou GIF.', variant: 'destructive' });
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed && !imageFile) {
      toast({ title: 'Pedido ou imagem', description: 'Escreva o que deseja ou anexe uma imagem.', variant: 'destructive' });
      return;
    }
    const connId = selectedLlmId || llmConnections[0]?.id;
    if (!connId) {
      toast({
        title: 'Sem modelo de linguagem',
        description: 'Configure uma conexão LLM em Minha IA / Definições.',
        variant: 'destructive',
      });
      return;
    }
    const { payload: snapshot, wasCompact } = projectSnapshotForAi(format, transitionFrames, scenes);
    setLoading(true);
    let dataUrlForVision = '';

    try {
      if (imageFile) {
        const { dataUrl } = await compressImageToJpegDataUrl(imageFile, { highFidelity: true });
        dataUrlForVision = dataUrl;
      }

      const preset = NEURO_MOTION_FORMAT_PRESETS[format] || NEURO_MOTION_FORMAT_PRESETS.youtube;
      let userInstruction = trimmed || (imageFile ? DEFAULT_IMAGE_PROMPT : '');
      if (userInstruction.length > MAX_USER_INSTRUCTION_CHARS) {
        userInstruction = `${userInstruction.slice(0, MAX_USER_INSTRUCTION_CHARS)}\n\n[Pedido truncado por tamanho. Resume no JSON só o essencial: cenas, textos visíveis e layers.]`;
      }
      const userText = [
        wasCompact
          ? `Estado do projecto (JSON compactado — devolve o projecto completo com todas as layers e textos):\n${JSON.stringify(snapshot, null, 2)}`
          : `Estado actual do projecto (JSON):\n${JSON.stringify(snapshot, null, 2)}`,
        `\n\nQuadro de referência: ${preset.label} — ${preset.width}×${preset.height}px. Calibra fontSize e tamanhos (w/h) das layers para este tamanho; respeita zona segura em ${preset.height > preset.width ? '9:16 vertical' : preset.width === preset.height ? '1:1' : '16:9'}.`,
        imageFile
          ? `\n\nIMPORTANTE: NÃO usar a imagem original no vídeo final. Não preencher imageUrl com a foto enviada; manter imageUrl vazio e recriar o visual com layers animadas.\n\n${referenceFidelityInstructions(preset)}`
          : '',
        `\n\n---\nPedido do utilizador:\n${userInstruction}`,
        `\n\nDevolve o JSON completo do projecto actualizado.`,
      ].join('');

      const userMessage = dataUrlForVision
        ? {
            role: 'user',
            content: [
              { type: 'text', text: userText },
              { type: 'image_url', image_url: { url: dataUrlForVision } },
            ],
          }
        : { role: 'user', content: userText };

      const { data, error } = await supabase.functions.invoke('generic-ai-chat', {
        body: JSON.stringify({
          session_id: null,
          messages: [{ role: 'system', content: NEURO_MOTION_AI_SYSTEM_PROMPT }, userMessage],
          llm_integration_id: connId,
          is_user_connection: true,
          context: 'neuromotion_project',
        }),
      });
      if (error) throw new Error(error.message || String(error));
      if (data?.error) throw new Error(data.error);

      const raw = data?.response ?? data?.content ?? '';
      setLastReply(typeof raw === 'string' ? raw.slice(0, 24000) : '');
      const parsed = parseJsonFromAssistant(raw);
      if (!parsed) {
        throw new Error(
          'A IA não devolveu JSON válido. Abre «Última resposta (raw)» abaixo: se vier texto em prosa, pede só «Devolve só o JSON do projecto». Se o JSON estiver cortado, reduz cenas/layers ou encurta o pedido.'
        );
      }
      let sanitized = sanitizeNeuroMotionProjectJson(parsed);
      if (!sanitized) {
        throw new Error('JSON inválido ou sem cenas. Peça pelo menos uma cena com título, camadas ou imagem.');
      }
      if (imageFile) {
        sanitized = {
          ...sanitized,
          scenesData: sanitized.scenesData.map((scene) => ({ ...scene, imageUrl: '' })),
        };
      }
      onApplyProject(sanitized);
      setInput('');
      clearImage();
      toast({
        title: 'Projecto actualizado',
        description: imageFile
          ? 'Referência em alta definição: copy literal, textAlign left nos cards e até 24 layers. Ajusta posições no painel se precisares de píxel-perfect.'
          : 'O preview reflecte o novo motion design.',
      });
    } catch (e) {
      toast({
        title: 'Falha ao gerar',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden border-[#3c3c3c] bg-[#252526] ${className}`.trim()}
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-3 pb-2">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#3793f0]" />
        <h2 className="text-[13px] font-semibold text-[#e0e0e0]">IA Motion</h2>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-[#858585]">
        Descreva o video ou <strong className="text-[#cccccc]">anexe um print (PNG/JPEG)</strong>: enviamos a referência em <strong className="text-[#cccccc]">alta definição</strong> para copiar textos à letra e layout (dashboard/cards). A foto não entra no vídeo — só geometria + <code className="text-[#b4b4b4]">type:text</code>. Modelo com{' '}
        <strong className="text-[#cccccc]">visão</strong> (GPT-4o, Gemini).
      </p>

      {llmConnections.length > 0 ? (
        <label className="mb-2 block text-[11px] font-medium text-[#858585]">
          Modelo
          <select
            className="mt-1 w-full rounded-sm border border-[#3c3c3c] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[#cccccc] outline-none focus:border-[#3793f0] focus:ring-1 focus:ring-[#3793f0]"
            value={selectedLlmId || ''}
            onChange={(e) => setSelectedLlmId(e.target.value || null)}
          >
            {llmConnections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.provider} {c.default_model ? `· ${c.default_model}` : ''}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="mb-2 rounded-sm border border-amber-600/50 bg-amber-900/20 px-2 py-1.5 text-[11px] text-amber-200/90">
          Nenhuma conexão LLM activa. Adicione em Minha IA.
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onPickImage}
      />

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-[#3c3c3c] bg-transparent text-xs text-[#cccccc] hover:bg-[#2a2d2e] hover:text-white"
          disabled={disabled || loading || !user}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="mr-1 h-3.5 w-3.5" />
          Imagem de referência
        </Button>
        {imagePreview ? (
          <div className="relative inline-block">
            <img src={imagePreview} alt="" className="h-14 w-14 rounded-md border object-cover" />
            <button
              type="button"
              className="absolute -right-1 -top-1 rounded-full border bg-background p-0.5 shadow"
              onClick={clearImage}
              aria-label="Remover imagem"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}
      </div>

      <Textarea
        className="min-h-[120px] resize-y border-[#3c3c3c] bg-[#3c3c3c] text-sm text-[#cccccc] placeholder:text-[#6e7681] focus-visible:ring-[#3793f0]"
        placeholder={
          imageFile
            ? 'Opcional: como animar (ex.: parallax, brilho, formas orbitando, texto). A imagem será usada só como referência visual.'
            : 'Ex.: 3 cenas com círculos e quadrados em tons roxo/rosa, texto "Lançamento" com animação spring, sem título clássico.'
        }
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={disabled || loading}
      />

      {lastReply ? (
        <details className="rounded-sm border border-[#3c3c3c] bg-[#1e1e1e] p-2 text-[10px] text-[#858585]">
          <summary className="cursor-pointer font-medium text-[#cccccc]">Última resposta (raw)</summary>
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all text-[#a0a0a0]">{lastReply}</pre>
        </details>
      ) : null}
      </div>

      <div className="shrink-0 border-t border-[#3c3c3c] bg-[#252526] p-3 pt-2">
        <Button
          type="button"
          className="w-full bg-[#3793f0] text-white hover:bg-[#4a9ef7]"
          disabled={disabled || loading || !llmConnections.length}
          onClick={() => void handleSend()}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              A gerar…
            </>
          ) : (
            <>
              <MessageSquare className="mr-2 h-4 w-4" />
              Aplicar ao projecto
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default NeuroMotionAiChat;
