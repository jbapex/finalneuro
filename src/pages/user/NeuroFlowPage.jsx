import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabaseUrl } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';

const STORAGE = {
  apiKey: 'custom_neuroflow_api_key',
  videoModel: 'custom_neuroflow_video_model',
};

const VEO_31_ID = 'veo-3.1-generate-preview';

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
  const [videoUrls, setVideoUrls] = useState([]);
  const [configOpen, setConfigOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      setApiKey(localStorage.getItem(STORAGE.apiKey) || '');
      setVideoModel(localStorage.getItem(STORAGE.videoModel) || VEO_31_ID);
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
        throw new Error(json?.error || json?.message || text || `HTTP ${res.status}`);
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
      return res.blob();
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
    setVideoUrls([]);
    setStatus('');
    try {
      const payload = {
        apiKey: k,
        videoModel: videoModel.trim(),
        prompt: pr,
        sampleCount: sampleCount || 1,
        resolution: '720p',
        aspectRatio: '16:9',
        durationSeconds: 4,
      };
      if (initialFrame?.mimeType && initialFrame?.data) {
        payload.initialFrame = { mimeType: initialFrame.mimeType, data: initialFrame.data };
      }
      if (finalFrame?.mimeType && finalFrame?.data) {
        payload.finalFrame = { mimeType: finalFrame.mimeType, data: finalFrame.data };
      }
      const out = await invokeEdge('neuroflow-generate-video-veo', payload);
      const uris = Array.isArray(out?.videoUris) ? out.videoUris : [];
      if (!uris.length) throw new Error('Nenhum vídeo retornou.');
      setStatus('Preparando players...');
      const urls = [];
      for (let i = 0; i < uris.length; i += 1) {
        const blob = await proxyDownloadVideo(k, uris[i]);
        urls.push(URL.createObjectURL(blob));
      }
      setVideoUrls(urls);
      setStatus('Pronto.');
    } catch (e) {
      setStatus(`Erro: ${e?.message || e}`);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(
    () => () => {
      videoUrls.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore
        }
      });
    },
    [videoUrls]
  );

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

      <div className="min-h-0 flex-1 overflow-auto px-6 py-6 pb-36">
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
        <div className="mt-3 flex items-center gap-2">
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

        {videoUrls.length > 0 && (
          <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {videoUrls.map((src, i) => (
              <div key={src} className="overflow-hidden rounded-xl bg-black/30">
                <video controls src={src} className="block w-full" />
                <div className="px-2 py-1 text-xs text-white/50">Vídeo {i + 1}</div>
              </div>
            ))}
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
