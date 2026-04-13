import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabaseUrl } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

const STORAGE = {
  apiKey: 'custom_neuroflow_api_key',
  videoModel: 'custom_neuroflow_video_model',
  resolution: 'custom_neuroflow_resolution',
  aspectRatio: 'custom_neuroflow_aspect_ratio',
  durationSeconds: 'custom_neuroflow_duration_seconds',
};

const VEO_31_ID = 'veo-3.1-generate-preview';

/** Valores aceites pela Edge Function / API Veo (predictLongRunning). */
const RESOLUTION_OPTIONS = ['720p', '1080p'];
const ASPECT_RATIO_OPTIONS = ['16:9', '9:16'];
const DURATION_OPTIONS = [4, 6, 8];

/** API Veo: 1080p exige duração de 8 s (erro INVALID_ARGUMENT se for 4 ou 6). */
function getDurationOptionsForResolution(resolution) {
  if (resolution === '1080p') return [8];
  return DURATION_OPTIONS;
}

function formatDownloadFilename(index) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `neuroflow-${stamp}-take${index + 1}.mp4`;
}

function triggerBlobDownload(blobUrl, filename) {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Blob com tipo video/* — evita preview 0:00 quando o servidor manda octet-stream. */
function ensureVideoBlob(blob, headerContentType) {
  const fromHeader = typeof headerContentType === 'string' ? headerContentType.split(';')[0].trim() : '';
  if (blob.type && blob.type.startsWith('video/') && blob.type !== 'application/octet-stream') {
    return blob;
  }
  let mime = '';
  if (fromHeader.startsWith('video/')) mime = fromHeader;
  if (!mime || mime === 'application/octet-stream') mime = 'video/mp4';
  return new Blob([blob], { type: mime });
}

function NeuroFlowVideoCard({ src, mimeType, index, onDownload }) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const typeAttr = mimeType && mimeType.startsWith('video/') ? mimeType : 'video/mp4';

  useEffect(() => {
    setPreviewFailed(false);
  }, [src]);

  return (
    <div className="overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
      {!previewFailed ? (
        <video
          controls
          playsInline
          preload="auto"
          className="block max-h-[min(70vh,520px)] w-full bg-black object-contain"
          onError={() => setPreviewFailed(true)}
        >
          <source src={src} type={typeAttr} />
        </video>
      ) : (
        <div className="flex min-h-[140px] flex-col items-center justify-center gap-2 bg-black/80 px-3 py-6 text-center">
          <p className="text-xs text-amber-200/90">Este browser não reproduz o codec deste MP4 na página.</p>
          <p className="text-[11px] text-white/45">O ficheiro está correto — usa Descarregar ou outro leitor.</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-2">
        <span className="text-xs text-white/50">Vídeo {index + 1}</span>
        <Button type="button" variant="secondary" size="sm" className="h-8 text-xs" onClick={onDownload}>
          Descarregar MP4
        </Button>
      </div>
    </div>
  );
}

function getAnonKey() {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || '';
}

function fileToFrame(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const res = String(fr.result || '');
      const m = res.match(/^data:(.+);base64,(.+)$/);
      if (!m) return reject(new Error('Formato de imagem inválido'));
      resolve({ mimeType: m[1], data: m[2], previewDataUrl: res });
    };
    fr.onerror = () => reject(new Error('Erro ao ler arquivo'));
    fr.readAsDataURL(file);
  });
}

const NeuroFlowPage = () => {
  const { session } = useAuth();
  const token = session?.access_token || '';
  const [initialFrame, setInitialFrame] = useState(null);
  const [finalFrame, setFinalFrame] = useState(null);
  const [activeSlot, setActiveSlot] = useState('initial');
  const [prompt, setPrompt] = useState('');
  const [sampleCount, setSampleCount] = useState(2);
  const [apiKey, setApiKey] = useState('');
  const [videoModel, setVideoModel] = useState('');
  const [videoOptions, setVideoOptions] = useState([VEO_31_ID]);
  const [status, setStatus] = useState('');
  const [generating, setGenerating] = useState(false);
  /** { url, mimeType } — mime explícito ajuda o <video> a decodificar o MP4. */
  const [videoItems, setVideoItems] = useState([]);
  const [resolution, setResolution] = useState('720p');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [durationSeconds, setDurationSeconds] = useState(4);
  const [configOpen, setConfigOpen] = useState(false);
  /** Só prompt: não envia frames (útil se a API recusar imagens ou para testar Veo). */
  const [textOnlyNoFrames, setTextOnlyNoFrames] = useState(false);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    try {
      setApiKey(localStorage.getItem(STORAGE.apiKey) || '');
      setVideoModel(localStorage.getItem(STORAGE.videoModel) || VEO_31_ID);
      const r = localStorage.getItem(STORAGE.resolution);
      if (r && RESOLUTION_OPTIONS.includes(r)) setResolution(r);
      const ar = localStorage.getItem(STORAGE.aspectRatio);
      if (ar && ASPECT_RATIO_OPTIONS.includes(ar)) setAspectRatio(ar);
      const rEffective = r && RESOLUTION_OPTIONS.includes(r) ? r : '720p';
      const ds = Number(localStorage.getItem(STORAGE.durationSeconds));
      const allowed = getDurationOptionsForResolution(rEffective);
      if (Number.isFinite(ds) && allowed.includes(ds)) setDurationSeconds(ds);
      else if (rEffective === '1080p') setDurationSeconds(8);
    } catch {
      // ignore
    }
  }, []);

  const invokeEdge = useCallback(
    async (fnName, payload) => {
      const headers = {
        apikey: getAnonKey(),
        'Content-Type': 'application/json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload || {}),
      });
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
      if (!res.ok || json?.error) {
        const details = typeof json?.details === 'string' ? json.details.trim() : '';
        const errTitle = typeof json?.error === 'string' ? json.error.trim() : '';
        const combined = details || errTitle || json?.message || text || `HTTP ${res.status}`;
        throw new Error(combined);
      }
      return json;
    },
    [token]
  );

  const proxyDownloadVideo = useCallback(
    async (key, videoUri) => {
      const headers = {
        apikey: getAnonKey(),
        'Content-Type': 'application/json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${supabaseUrl}/functions/v1/neuroflow-video-download`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ apiKey: key, videoUri }),
      });
      if (!res.ok) throw new Error('Falha ao baixar vídeo');
      const ct = res.headers.get('content-type') || '';
      const raw = await res.blob();
      const blob = ensureVideoBlob(raw, ct);
      return { blob, mimeType: blob.type || 'video/mp4' };
    },
    [token]
  );

  const onFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      setStatus('Lendo arquivo...');
      const fr = await fileToFrame(files[0]);
      if (activeSlot === 'initial') setInitialFrame(fr);
      else setFinalFrame(fr);
      setStatus(`Frame ${activeSlot === 'initial' ? 'inicial' : 'final'} definido.`);
    } catch (err) {
      setStatus(`Erro ao anexar: ${err?.message || err}`);
    }
    e.target.value = '';
  };

  const listModels = async () => {
    if (!apiKey.trim()) {
      setStatus('Cole uma API key antes de buscar modelos.');
      return;
    }
    try {
      setStatus('Buscando modelos...');
      const out = await invokeEdge('neuroflow-list-models', { apiKey: apiKey.trim() });
      const vm = Array.isArray(out?.videoModels) ? out.videoModels : [];
      const vList = vm.includes(VEO_31_ID) ? vm : [VEO_31_ID, ...vm];
      setVideoOptions(vList.length ? vList : [VEO_31_ID]);
      setVideoModel((prev) => (vList.includes(prev) ? prev : VEO_31_ID));
      try {
        localStorage.setItem(STORAGE.apiKey, apiKey.trim());
        localStorage.setItem(STORAGE.videoModel, videoModel || VEO_31_ID);
      } catch {
        // ignore
      }
      setStatus('Modelos carregados.');
    } catch (e) {
      setStatus(`Erro: ${e?.message || e}`);
    }
  };

  const generate = async () => {
    const k = apiKey.trim();
    const pr = prompt.trim();
    if (!k) return setStatus('Cole sua API key no painel de configuração.');
    if (!videoModel.trim()) return setStatus('Selecione um modelo de vídeo.');
    if (!pr) return setStatus('Descreva o que você quer criar no prompt.');
    setGenerating(true);
    setVideoItems([]);
    setStatus('A gerar vídeo na Google (pode demorar vários minutos)...');
    try {
      const payload = {
        apiKey: k,
        videoModel: videoModel.trim(),
        prompt: pr,
        sampleCount: sampleCount || 1,
        resolution,
        aspectRatio,
        durationSeconds,
      };
      if (!textOnlyNoFrames) {
        if (initialFrame?.mimeType && initialFrame?.data) {
          payload.initialFrame = { mimeType: initialFrame.mimeType, data: initialFrame.data };
        }
        if (finalFrame?.mimeType && finalFrame?.data) {
          payload.finalFrame = { mimeType: finalFrame.mimeType, data: finalFrame.data };
        }
      }
      const out = await invokeEdge('neuroflow-generate-video-veo', payload);
      const uris = Array.isArray(out?.videoUris) ? out.videoUris : [];
      if (!uris.length) throw new Error('Nenhum vídeo retornou.');
      setStatus('Preparando players...');
      const items = [];
      for (let i = 0; i < uris.length; i += 1) {
        const { blob, mimeType } = await proxyDownloadVideo(k, uris[i]);
        items.push({ url: URL.createObjectURL(blob), mimeType });
      }
      setVideoItems(items);
      setStatus('Pronto.');
    } catch (e) {
      setStatus(`Erro: ${e?.message || e}`);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(
    () => () => {
      videoItems.forEach(({ url }) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
    },
    [videoItems]
  );

  /** Os vídeos ficam no fim da página; sem scroll o utilizador não os vê. */
  useEffect(() => {
    if (videoItems.length === 0) return;
    const t = window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [videoItems]);

  return (
    <div className="fixed inset-0 z-[100000] flex flex-col overflow-hidden bg-black text-white font-sans">
      <nav className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3">
        <Link to="/ferramentas" className="text-sm text-white/85 hover:text-white">
          ← Voltar
        </Link>
        <div className="mx-4 max-w-[480px] flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-center text-sm text-white/50">
          Neuro Flow
        </div>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg"
          onClick={() => setConfigOpen(true)}
        >
          ⚙
        </button>
      </nav>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-6 pb-24">
        <details className="mb-4 max-w-2xl rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/70 open:pb-3">
          <summary className="cursor-pointer select-none text-white/80 marker:text-white/50">
            Sobre o Neuro Flow (vídeo Veo, não imagem)
          </summary>
          <p className="mt-2 leading-relaxed">
            O Neuro Flow gera <strong className="text-white/90">vídeos MP4</strong> com o modelo Veo (Google), não imagens estáticas. Ter
            &quot;API 3.1&quot; ou Gemini no projeto não garante vídeo: a conta precisa de{' '}
            <strong className="text-white/90">vídeo Veo ativo</strong> (faturamento / região / documentação atual). Se der erro de
            &quot;use case&quot;, experimenta primeiro <strong className="text-white/90">só com texto</strong> (opção abaixo).
          </p>
        </details>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setActiveSlot('initial');
              inputRef.current?.click();
            }}
          >
            Frame inicial
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setActiveSlot('final');
              inputRef.current?.click();
            }}
          >
            Frame final
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-white/55"
            onClick={() => {
              setInitialFrame(null);
              setFinalFrame(null);
              setStatus('Frames removidos.');
            }}
          >
            Limpar frames
          </Button>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Checkbox
            id="nf-text-only"
            checked={textOnlyNoFrames}
            onCheckedChange={(v) => setTextOnlyNoFrames(v === true)}
            aria-label="Gerar só com texto, sem frames"
          />
          <label htmlFor="nf-text-only" className="cursor-pointer text-sm text-white/75">
            Gerar só com texto (não enviar imagens de frame)
          </label>
        </div>
        <div className="mb-4 flex flex-wrap gap-3">
          {initialFrame?.previewDataUrl && <img src={initialFrame.previewDataUrl} alt="" className="h-24 rounded-md" />}
          {finalFrame?.previewDataUrl && <img src={finalFrame.previewDataUrl} alt="" className="h-24 rounded-md" />}
        </div>

        <textarea
          className="min-h-[120px] w-full rounded-md border border-white/10 bg-white/5 p-3 text-sm outline-none placeholder:text-white/45"
          placeholder="Descreva o vídeo..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-white/45">Qualidade e formato</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-xs text-white/55">Resolução</label>
              <select
                className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm"
                value={resolution}
                onChange={(e) => {
                  const v = e.target.value;
                  setResolution(v);
                  try {
                    localStorage.setItem(STORAGE.resolution, v);
                  } catch {
                    // ignore
                  }
                  if (v === '1080p') {
                    setDurationSeconds(8);
                    try {
                      localStorage.setItem(STORAGE.durationSeconds, '8');
                    } catch {
                      // ignore
                    }
                  }
                }}
              >
                {RESOLUTION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-white/55">Proporção</label>
              <select
                className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm"
                value={aspectRatio}
                onChange={(e) => {
                  const v = e.target.value;
                  setAspectRatio(v);
                  try {
                    localStorage.setItem(STORAGE.aspectRatio, v);
                  } catch {
                    // ignore
                  }
                }}
              >
                {ASPECT_RATIO_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === '16:9' ? '16:9 (horizontal)' : '9:16 (vertical)'}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-white/55">Duração (s)</label>
              <select
                className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm"
                value={getDurationOptionsForResolution(resolution).includes(durationSeconds) ? durationSeconds : getDurationOptionsForResolution(resolution)[0]}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setDurationSeconds(n);
                  try {
                    localStorage.setItem(STORAGE.durationSeconds, String(n));
                  } catch {
                    // ignore
                  }
                }}
              >
                {getDurationOptionsForResolution(resolution).map((sec) => (
                  <option key={sec} value={sec}>
                    {sec} segundos
                    {resolution === '1080p' ? ' (obrigatório em 1080p)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-white/40">
            Em <strong className="text-white/55">1080p</strong>, a API Veo só aceita <strong className="text-white/55">8 segundos</strong> de duração. Em 720p podes usar 4, 6 ou 8 s. Outras combinações podem devolver erro.
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className="h-10 rounded-full border border-white/10 bg-white/5 px-3 text-sm"
            value={sampleCount}
            onChange={(e) => setSampleCount(Number(e.target.value))}
          >
            <option value={1}>Vídeo x1</option>
            <option value={2}>Vídeo x2</option>
            <option value={3}>Vídeo x3</option>
            <option value={4}>Vídeo x4</option>
          </select>
          <Button type="button" onClick={generate} disabled={generating}>
            {generating ? 'Gerando...' : 'Gerar'}
          </Button>
        </div>
        {status && <p className="mt-2 text-xs text-white/60">{status}</p>}

        {videoItems.length > 0 && (
          <div
            ref={resultsRef}
            id="nf-video-results"
            className="mt-6 scroll-mt-24 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3 sm:p-4"
          >
            <p className="mb-3 text-xs font-medium text-emerald-200/90">Vídeos gerados — reproduz abaixo ou descarrega o MP4</p>
            <p className="mb-3 text-[11px] leading-relaxed text-white/45">
              Se o preview ficar preto ou em 0:00 mas o MP4 abrir no telemóvel ou no VLC, o codec (ex. HEVC) pode não ser suportado neste browser — usa Descarregar ou outro navegador (ex. Safari no Mac).
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {videoItems.map(({ url: src, mimeType }, i) => (
              <NeuroFlowVideoCard
                key={src}
                src={src}
                mimeType={mimeType}
                index={i}
                onDownload={() => triggerBlobDownload(src, formatDownloadFilename(i))}
              />
            ))}
            </div>
          </div>
        )}
      </div>

      <aside
        className={`fixed right-0 top-0 z-[100002] h-full w-full max-w-[380px] border-l border-white/10 bg-[#111] p-5 transition-transform ${
          configOpen ? 'translate-x-0' : 'translate-x-full'
        } overflow-y-auto`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Configurar API</h3>
          <button type="button" className="text-xl leading-none text-white/70" onClick={() => setConfigOpen(false)}>
            ×
          </button>
        </div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">API Key</label>
        <input
          type="password"
          className="mb-4 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm"
          placeholder="Cole sua API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">Modelo de vídeo</label>
        <select
          className="mb-4 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm"
          value={videoModel}
          onChange={(e) => {
            setVideoModel(e.target.value);
            try {
              localStorage.setItem(STORAGE.videoModel, e.target.value);
            } catch {
              // ignore
            }
          }}
        >
          <option value="">Selecione...</option>
          {videoOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <Button type="button" className="w-full" variant="outline" onClick={listModels}>
          Buscar modelos
        </Button>
      </aside>
      {configOpen && <button type="button" className="fixed inset-0 z-[100001] bg-black/50 lg:hidden" onClick={() => setConfigOpen(false)} />}
    </div>
  );
};

export default NeuroFlowPage;
