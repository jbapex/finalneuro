import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Player } from '@remotion/player';
import NeuroMotionComposition from '@/components/neuro-motion/NeuroMotionComposition';
import NeuroMotionAiChat from '@/components/neuro-motion/NeuroMotionAiChat';
import {
  NEURO_MOTION_COMPOSITION_ID,
  NEURO_MOTION_FPS,
  NEURO_MOTION_FORMAT_PRESETS,
  NEURO_MOTION_TRANSITIONS,
} from '@/lib/neuroMotion/constants';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { GripVertical, Loader2, Redo2, Undo2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const POLL_MS = 2500;
const TEMPLATES_STORAGE_KEY = 'neuromotion:templates';

/** Paleta / layout alinhados ao Remotion Studio (tema escuro tipo VS Code). */
const RM = {
  shell:
    "flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#1e1e1e] text-[#cccccc] antialiased [font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif]",
  topBar: 'flex h-11 shrink-0 items-center gap-3 border-b border-[#3c3c3c] bg-[#252526] px-3',
  panel: 'rounded-sm border border-[#3c3c3c] bg-[#252526]',
  input:
    'w-full rounded-sm border border-[#3c3c3c] bg-[#3c3c3c] px-2 text-sm text-[#cccccc] outline-none placeholder:text-[#6e7681] focus:border-[#3793f0] focus:ring-1 focus:ring-[#3793f0]',
  label: 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#858585]',
  asideScroll: 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden',
  canvasBg: 'flex flex-1 flex-col bg-[#141414]',
  timelineStrip: 'shrink-0 border-t border-[#252526] bg-[#1e1e1e] px-3 py-2',
  timelineBar: 'bg-[#38a0ff]',
  timelineRuler: 'border-[#3c3c3c] text-[#6e7681]',
  muted: 'text-[#858585]',
  accent: 'text-[#3793f0]',
  textarea:
    'min-h-[68px] w-full resize-y rounded-sm border border-[#3c3c3c] bg-[#3c3c3c] px-3 py-2 text-sm text-[#cccccc] outline-none placeholder:text-[#6e7681] focus:border-[#3793f0] focus:ring-1 focus:ring-[#3793f0]',
  btnOutline: 'border-[#3c3c3c] bg-transparent text-[#cccccc] hover:bg-[#2a2d2e] hover:text-white',
  btnPrimary: 'bg-[#3793f0] text-white hover:bg-[#4a9ef7]',
  code: 'rounded bg-[#2d2d30] px-1 py-0.5 font-mono text-[11px] text-[#d4d4d4]',
  fileInput:
    'max-w-full text-[11px] text-[#cccccc] file:mr-2 file:rounded-sm file:border file:border-[#3c3c3c] file:bg-[#3c3c3c] file:px-2 file:py-1 file:text-[#cccccc]',
  colorInput: 'h-9 w-full cursor-pointer rounded-sm border border-[#3c3c3c] bg-[#3c3c3c] p-1',
};
const makeScene = (idx = 1) => ({
  id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title: `Cena ${idx}`,
  subtitle: 'Descreva a mensagem dessa cena',
  accentColor: '#7c3aed',
  backgroundColor: '#0f172a',
  durationSec: 3,
  transition: 'fade',
  imageUrl: '',
  hideClassicText: false,
  layers: [],
});

function SortableSceneThumb({ scene, index, isTimelineActive, onSelectForTimeline }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
    zIndex: isDragging ? 2 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex min-w-[148px] items-stretch gap-1 rounded-sm border p-1.5 shadow-sm ${
        isTimelineActive ? 'border-[#38a0ff] bg-[#2d3d4d]' : 'border-[#474747] bg-[#323232]'
      }`}
    >
      <button
        type="button"
        className="flex shrink-0 cursor-grab touch-none items-center rounded px-0.5 text-[#a0a0a0] hover:bg-[#3c3c3c] active:cursor-grabbing"
        aria-label={`Arrastar cena ${index + 1}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectForTimeline(scene.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectForTimeline(scene.id);
          }
        }}
        className="min-w-0 flex-1 cursor-pointer rounded p-2 outline-none ring-offset-2 ring-offset-[#323232] focus-visible:ring-2 focus-visible:ring-[#38a0ff]"
        style={{
          background: `linear-gradient(135deg, ${scene.backgroundColor} 0%, ${scene.accentColor}66 100%)`,
        }}
      >
        {scene.imageUrl ? (
          <img src={scene.imageUrl} alt="" className="mb-1 h-8 w-full rounded object-cover opacity-90" />
        ) : null}
        <p className="truncate text-[11px] font-semibold text-[#e8e8e8]">
          #{index + 1} {scene.title || 'Sem titulo'}
        </p>
        <p className="mt-1 text-[10px] text-[#a0a0a0]">
          {scene.durationSec}s · {scene.transition}
        </p>
      </div>
    </div>
  );
}

function SortableSceneCard({ scene, index, children, isTimelineActive }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      id={`scene-card-${scene.id}`}
      style={style}
      className={`space-y-3 p-3 ${RM.panel} ${isTimelineActive ? 'ring-1 ring-[#38a0ff] ring-offset-2 ring-offset-[#1e1e1e]' : ''}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-[#e0e0e0]">Cena {index + 1}</p>
        <button
          type="button"
          className="flex cursor-grab items-center rounded px-1 text-[#858585] hover:bg-[#3c3c3c] active:cursor-grabbing"
          aria-label={`Arrastar cena ${index + 1}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

/** Faixa estilo Remotion Studio (barra azul + etiqueta à esquerda). */
function TimelineTrackRow({ label, leftPct, widthPct, selected, onSelect, trailing }) {
  return (
    <div
      className={`flex h-8 items-center gap-2 rounded-sm ${selected ? 'bg-[#2d2d30]' : 'bg-transparent'}`}
    >
      <div className="w-[7.25rem] shrink-0 truncate pl-0.5 text-left font-mono text-[10px] text-[#cccccc]" title={label}>
        {label}
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="relative mr-1 h-5 min-w-0 flex-1 overflow-hidden rounded border border-[#3c3c3c] bg-[#252526] text-left"
        title="Seleccionar para editar no painel"
      >
        <span
          className={`absolute top-0 h-full ${RM.timelineBar} opacity-95`}
          style={{
            left: `${Math.min(100, Math.max(0, leftPct))}%`,
            width: `${Math.min(100, Math.max(0, widthPct))}%`,
          }}
        />
      </button>
      {trailing ? <div className="flex shrink-0 items-center gap-1">{trailing}</div> : null}
    </div>
  );
}

const NeuroMotionPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [scenes, setScenes] = useState([makeScene(1), makeScene(2)]);
  const [format, setFormat] = useState('youtube');
  const [transitionFrames, setTransitionFrames] = useState(10);
  const [templateName, setTemplateName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [historyStack, setHistoryStack] = useState([]);
  const [futureStack, setFutureStack] = useState([]);

  const [projectId, setProjectId] = useState(null);
  const [projectTitle, setProjectTitle] = useState('Novo projeto');
  const [projectsList, setProjectsList] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [uploadingSceneId, setUploadingSceneId] = useState(null);
  const skipAutosaveAfterLoadRef = useRef(false);

  const [jobId, setJobId] = useState(null);
  const [jobRow, setJobRow] = useState(null);
  const [enqueueLoading, setEnqueueLoading] = useState(false);
  const terminalNotifiedRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const cloneScenes = useCallback(
    (arr) =>
      arr.map((s) => ({
        ...s,
        layers: Array.isArray(s.layers) ? s.layers.map((l) => ({ ...l })) : [],
      })),
    []
  );
  const setScenesWithHistory = useCallback(
    (updater) => {
      setScenes((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        const prevJson = JSON.stringify(prev);
        const nextJson = JSON.stringify(next);
        if (prevJson === nextJson) return prev;
        setHistoryStack((h) => [...h, cloneScenes(prev)].slice(-50));
        setFutureStack([]);
        return next;
      });
    },
    [cloneScenes]
  );

  const inputProps = useMemo(
    () => ({
      format,
      transitionFrames,
      scenes: scenes.map(({ id, ...scene }) => scene),
    }),
    [format, scenes, transitionFrames]
  );
  const selectedFormat = NEURO_MOTION_FORMAT_PRESETS[format] || NEURO_MOTION_FORMAT_PRESETS.youtube;
  const previewDurationInFrames = useMemo(
    () =>
      Math.max(
        15,
        Math.round(
          scenes.reduce((acc, scene) => acc + (Number(scene.durationSec) > 0 ? Number(scene.durationSec) : 3), 0) *
            NEURO_MOTION_FPS
        )
      ),
    [scenes]
  );

  const [timelineSceneId, setTimelineSceneId] = useState(null);
  const [selectedTrack, setSelectedTrack] = useState(null);

  useEffect(() => {
    if (!scenes.length) {
      setTimelineSceneId(null);
      return;
    }
    if (!timelineSceneId || !scenes.some((s) => s.id === timelineSceneId)) {
      setTimelineSceneId(scenes[0].id);
    }
  }, [scenes, timelineSceneId]);

  const activeTimelineScene = useMemo(
    () => scenes.find((s) => s.id === timelineSceneId) ?? scenes[0] ?? null,
    [scenes, timelineSceneId]
  );
  const activeSceneDurationFrames = useMemo(() => {
    if (!activeTimelineScene) return 15;
    const sec = Number(activeTimelineScene.durationSec) > 0 ? Number(activeTimelineScene.durationSec) : 3;
    return Math.max(15, Math.round(sec * NEURO_MOTION_FPS));
  }, [activeTimelineScene]);
  const activeSceneDurationSec = useMemo(() => {
    if (!activeTimelineScene) return 3;
    return Number(activeTimelineScene.durationSec) > 0 ? Number(activeTimelineScene.durationSec) : 3;
  }, [activeTimelineScene]);

  const updateScene = (id, key, value) => {
    setScenesWithHistory((prev) =>
      prev.map((scene) =>
        scene.id === id
          ? {
              ...scene,
              [key]:
                key === 'durationSec'
                  ? Math.min(12, Math.max(1, Number(value) || 1))
                  : key === 'imageUrl'
                    ? String(value || '').slice(0, 2048)
                    : value,
            }
          : scene
      )
    );
  };

  const updateLayerAt = useCallback((sceneId, layerIndex, partial) => {
    setScenesWithHistory((prev) =>
      prev.map((scene) => {
        if (scene.id !== sceneId) return scene;
        const layers = [...(scene.layers || [])];
        if (!layers[layerIndex]) return scene;
        layers[layerIndex] = { ...layers[layerIndex], ...partial };
        return { ...scene, layers };
      })
    );
  }, [setScenesWithHistory]);

  const fetchProjectsList = useCallback(async () => {
    if (!user) return;
    setProjectsLoading(true);
    try {
      const { data, error } = await supabase
        .from('neuro_motion_projects')
        .select('id, title, updated_at')
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setProjectsList(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setProjectsLoading(false);
    }
  }, [user]);

  const applyProjectData = useCallback((data) => {
    const d = data && typeof data === 'object' ? data : {};
    if (d.format) setFormat(String(d.format));
    if (d.transitionFrames !== undefined) {
      setTransitionFrames(Math.min(30, Math.max(0, Number(d.transitionFrames) || 0)));
    }
    const rawScenes = Array.isArray(d.scenes) ? d.scenes : [];
    if (rawScenes.length) {
      setScenes(
        rawScenes.map((s, idx) => ({
          ...makeScene(idx + 1),
          ...s,
          layers: Array.isArray(s.layers) ? s.layers.map((l) => ({ ...l })) : [],
        }))
      );
    } else {
      setScenes([makeScene(1), makeScene(2)]);
    }
  }, []);

  const loadProjectById = useCallback(
    async (id) => {
      if (!user || !id) return;
      skipAutosaveAfterLoadRef.current = true;
      const { data, error } = await supabase
        .from('neuro_motion_projects')
        .select('id, title, project_data')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error || !data) {
        toast({ variant: 'destructive', title: 'Projeto não encontrado' });
        skipAutosaveAfterLoadRef.current = false;
        return;
      }
      setProjectId(data.id);
      setProjectTitle(data.title || 'Sem titulo');
      applyProjectData(data.project_data);
      setHistoryStack([]);
      setFutureStack([]);
      setTimeout(() => {
        skipAutosaveAfterLoadRef.current = false;
      }, 2000);
    },
    [user, toast, applyProjectData]
  );

  const startNewLocalDraft = useCallback(() => {
    setProjectId(null);
    setProjectTitle('Novo projeto');
    setScenes([makeScene(1), makeScene(2)]);
    setFormat('youtube');
    setTransitionFrames(10);
    setHistoryStack([]);
    setFutureStack([]);
  }, []);

  const upsertProject = useCallback(async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Inicie sessão', description: 'É preciso estar autenticado para guardar na nuvem.' });
      return;
    }
    try {
      const payload = {
        title: projectTitle.trim() || 'Sem titulo',
        project_data: {
          format,
          transitionFrames,
          scenes: scenes.map(({ id: _sid, ...s }) => s),
        },
      };
      if (projectId) {
        const { error } = await supabase
          .from('neuro_motion_projects')
          .update(payload)
          .eq('id', projectId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('neuro_motion_projects')
          .insert({ user_id: user.id, ...payload })
          .select('id')
          .single();
        if (error) throw error;
        if (data?.id) setProjectId(data.id);
      }
      await fetchProjectsList();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erro ao guardar projeto',
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }, [user, projectId, projectTitle, format, transitionFrames, scenes, fetchProjectsList, toast]);

  const handleImageUpload = async (sceneId, file) => {
    if (!user || !file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Ficheiro demasiado grande', description: 'Máximo 5 MB.' });
      return;
    }
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      toast({ variant: 'destructive', title: 'Formato inválido', description: 'Use PNG, JPEG, WebP ou GIF.' });
      return;
    }
    const ext =
      file.type === 'image/png'
        ? 'png'
        : file.type === 'image/jpeg'
          ? 'jpg'
          : file.type === 'image/webp'
            ? 'webp'
            : 'gif';
    const path = `${user.id}/assets/${sceneId}-${uuidv4()}.${ext}`;
    setUploadingSceneId(sceneId);
    try {
      const { error } = await supabase.storage.from('neuromotion').upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('neuromotion').getPublicUrl(path);
      updateScene(sceneId, 'imageUrl', data.publicUrl);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Falha no upload',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setUploadingSceneId(null);
    }
  };
  const addScene = () => setScenesWithHistory((prev) => [...prev, makeScene(prev.length + 1)]);
  const duplicateScene = (id) =>
    setScenesWithHistory((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const base = prev[idx];
      const dup = {
        ...base,
        id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: `${base.title || 'Cena'} (copia)`,
        layers: Array.isArray(base.layers) ? base.layers.map((l) => ({ ...l })) : [],
      };
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
  const removeScene = (id) =>
    setScenesWithHistory((prev) => (prev.length <= 1 ? prev : prev.filter((scene) => scene.id !== id)));
  const moveScene = (id, direction) =>
    setScenesWithHistory((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });

  const handleSceneDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setScenesWithHistory((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const undoScenes = useCallback(() => {
    setHistoryStack((history) => {
      if (!history.length) return history;
      const previous = history[history.length - 1];
      setFutureStack((future) => [cloneScenes(scenes), ...future].slice(0, 50));
      setScenes(cloneScenes(previous));
      return history.slice(0, -1);
    });
  }, [cloneScenes, scenes]);

  const redoScenes = useCallback(() => {
    setFutureStack((future) => {
      if (!future.length) return future;
      const next = future[0];
      setHistoryStack((history) => [...history, cloneScenes(scenes)].slice(-50));
      setScenes(cloneScenes(next));
      return future.slice(1);
    });
  }, [cloneScenes, scenes]);

  useEffect(() => {
    const onKey = (e) => {
      const key = String(e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'z') {
        e.preventDefault();
        undoScenes();
      } else if ((e.ctrlKey || e.metaKey) && (key === 'y' || (e.shiftKey && key === 'z'))) {
        e.preventDefault();
        redoScenes();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [redoScenes, undoScenes]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setSavedTemplates(parsed);
    } catch (e) {
      console.error('Falha ao carregar templates', e);
    }
  }, []);

  const saveTemplate = () => {
    const name = templateName.trim();
    if (!name) {
      toast({ title: 'Nome obrigatório', description: 'Digite um nome para salvar o template.', variant: 'destructive' });
      return;
    }
    const next = [
      {
        id: `tpl-${Date.now()}`,
        name,
        data: { format, transitionFrames, scenes: scenes.map(({ id, ...s }) => s) },
        createdAt: new Date().toISOString(),
      },
      ...savedTemplates,
    ].slice(0, 20);
    setSavedTemplates(next);
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(next));
    setTemplateName('');
    toast({ title: 'Template salvo', description: 'Template salvo neste navegador.' });
  };

  const renameTemplate = (templateId) => {
    const current = savedTemplates.find((t) => t.id === templateId);
    if (!current) return;
    const newName = window.prompt('Novo nome do template:', current.name);
    if (!newName || !newName.trim()) return;
    const next = savedTemplates.map((t) => (t.id === templateId ? { ...t, name: newName.trim() } : t));
    setSavedTemplates(next);
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(next));
  };

  const deleteTemplate = (templateId) => {
    const next = savedTemplates.filter((t) => t.id !== templateId);
    setSavedTemplates(next);
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(next));
  };

  const loadTemplate = (tpl) => {
    const data = tpl?.data || {};
    const loadedScenes = Array.isArray(data.scenes) && data.scenes.length
      ? data.scenes.map((scene, idx) => ({
          ...makeScene(idx + 1),
          ...scene,
          layers: Array.isArray(scene.layers) ? scene.layers.map((l) => ({ ...l })) : [],
        }))
      : [makeScene(1)];
    setProjectId(null);
    setProjectTitle('Novo projeto');
    setScenes(loadedScenes);
    setFormat(String(data.format || 'youtube'));
    setTransitionFrames(Math.min(30, Math.max(0, Number(data.transitionFrames) || 10)));
    setHistoryStack([]);
    setFutureStack([]);
  };

  const deleteProject = async () => {
    if (!user || !projectId) return;
    if (!window.confirm('Apagar este projeto na nuvem?')) return;
    const { error } = await supabase.from('neuro_motion_projects').delete().eq('id', projectId).eq('user_id', user.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao apagar', description: error.message });
      return;
    }
    startNewLocalDraft();
    await fetchProjectsList();
    toast({ title: 'Projeto apagado' });
  };

  useEffect(() => {
    if (user) void fetchProjectsList();
  }, [user, fetchProjectsList]);

  useEffect(() => {
    if (!user || !projectId) return;
    if (skipAutosaveAfterLoadRef.current) return;
    const t = setTimeout(() => {
      void upsertProject();
    }, 1400);
    return () => clearTimeout(t);
  }, [user, projectId, format, transitionFrames, scenes, projectTitle, upsertProject]);

  const pollJob = useCallback(async () => {
    if (!jobId) return;
    const { data, error } = await supabase
      .from('neuro_motion_render_jobs')
      .select('id, status, output_url, error_message, created_at, completed_at')
      .eq('id', jobId)
      .maybeSingle();

    if (error) {
      console.error(error);
      return;
    }
    setJobRow(data);

    if (data?.status === 'completed' && data?.output_url && !terminalNotifiedRef.current) {
      terminalNotifiedRef.current = true;
      toast({
        title: 'Video pronto',
        description: 'O MP4 foi gerado e esta disponivel no link abaixo.',
      });
    }
    if (data?.status === 'failed' && data?.error_message && !terminalNotifiedRef.current) {
      terminalNotifiedRef.current = true;
      toast({
        title: 'Falha no render',
        description: data.error_message,
        variant: 'destructive',
      });
    }
  }, [jobId, toast]);

  useEffect(() => {
    if (!jobId) return;
    pollJob();
    const t = setInterval(pollJob, POLL_MS);
    return () => clearInterval(t);
  }, [jobId, pollJob]);

  const handleEnqueue = async () => {
    setEnqueueLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('neuro-motion-create-job', {
        body: { input_props: inputProps },
      });
      if (error) {
        throw new Error(error.message || 'Erro ao chamar função');
      }
      if (data?.error) {
        throw new Error(data.error);
      }
      if (!data?.job_id) {
        throw new Error('Resposta inválida da API');
      }
      setJobId(data.job_id);
      setJobRow(null);
      terminalNotifiedRef.current = false;
      toast({
        title: 'Render enfileirado',
        description:
          'O video sera gerado pelo worker (Node + Remotion + FFmpeg). Um job: npm run neuro-motion:worker · fila completa: npm run neuro-motion:worker:loop',
      });
    } catch (e) {
      toast({
        title: 'Não foi possível enfileirar',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setEnqueueLoading(false);
    }
  };

  const handleApplyFromAi = useCallback(
    (sanitized) => {
      setFormat(sanitized.format);
      setTransitionFrames(sanitized.transitionFrames);
      setScenesWithHistory(
        sanitized.scenesData.map((s, i) => ({
          ...makeScene(i + 1),
          ...s,
          layers: Array.isArray(s.layers) ? s.layers.map((l) => ({ ...l })) : [],
        }))
      );
    },
    [setScenesWithHistory]
  );

  return (
    <>
      <Helmet>
        <title>NeuroMotion - Neuro Apice</title>
        <meta
          name="description"
          content="NeuroMotion: prototipo inicial de video com Remotion no Neuro Apice."
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400..900;1,14..32,400..900&display=swap"
          rel="stylesheet"
        />
      </Helmet>

      <div className={RM.shell}>
        <header className={RM.topBar}>
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-white">NeuroMotion</span>
            <span className={`text-[11px] ${RM.muted}`}>Studio</span>
          </div>
          <div className="hidden h-5 w-px shrink-0 bg-[#3c3c3c] sm:block" aria-hidden />
          <input
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            placeholder="Nome do projeto"
            className={`h-9 max-w-[140px] flex-1 sm:max-w-xs md:max-w-md ${RM.input}`}
          />
          <code className={`hidden truncate font-mono text-[10px] lg:inline lg:max-w-[180px] ${RM.muted}`}>
            {NEURO_MOTION_COMPOSITION_ID}
          </code>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`h-8 px-2 ${RM.btnOutline}`}
              onClick={undoScenes}
              disabled={!historyStack.length}
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`h-8 px-2 ${RM.btnOutline}`}
              onClick={redoScenes}
              disabled={!futureStack.length}
              title="Refazer"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
          <aside className="flex max-h-[min(420px,45vh)] w-full shrink-0 flex-col overflow-hidden border-b border-[#3c3c3c] bg-[#1e1e1e] xl:h-full xl:max-h-none xl:max-w-[380px] xl:border-b-0 xl:border-r">
            <NeuroMotionAiChat
              user={user}
              format={format}
              transitionFrames={transitionFrames}
              scenes={scenes}
              onApplyProject={handleApplyFromAi}
              disabled={!user}
              className="min-h-0 flex-1 rounded-none border-0"
            />
          </aside>

          <main className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${RM.canvasBg}`}>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-3 py-4 sm:px-4 sm:py-5">
              <div className="w-full max-w-4xl">
                <div className={`mb-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] ${RM.muted}`}>
                  <span>
                    <span className={RM.accent}>{NEURO_MOTION_COMPOSITION_ID}</span> · {selectedFormat.width}×{selectedFormat.height} ·{' '}
                    {previewDurationInFrames} frames @ {NEURO_MOTION_FPS} fps
                  </span>
                  <a className={`${RM.accent} hover:underline`} href="https://www.remotion.dev/" target="_blank" rel="noopener noreferrer">
                    remotion.dev
                  </a>
                </div>
                <div className="overflow-hidden rounded-sm border border-[#3c3c3c] bg-black shadow-2xl">
                  <Player
                    component={NeuroMotionComposition}
                    durationInFrames={previewDurationInFrames}
                    compositionWidth={selectedFormat.width}
                    compositionHeight={selectedFormat.height}
                    fps={NEURO_MOTION_FPS}
                    controls
                    autoPlay={false}
                    loop
                    inputProps={inputProps}
                    style={{ width: '100%' }}
                  />
                </div>
                <p className={`mt-2 text-[10px] ${RM.muted}`}>
                  Timeline completa no Remotion: <code className={RM.code}>npm run neuro-motion:studio</code> →{' '}
                  <code className={RM.code}>localhost:3333</code>
                </p>
              </div>
            </div>

            <div className={`shrink-0 ${RM.timelineStrip}`}>
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${RM.muted}`}>Timeline</p>
                <p className="font-mono text-[10px] text-[#6e7681]">
                  {activeTimelineScene ? (
                    <>
                      Cena {scenes.findIndex((s) => s.id === activeTimelineScene.id) + 1} · {activeSceneDurationFrames}{' '}
                      frames · {activeSceneDurationSec.toFixed(2)}s
                    </>
                  ) : (
                    '—'
                  )}
                </p>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSceneDragEnd}>
                <SortableContext items={scenes.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {scenes.map((scene, idx) => (
                      <SortableSceneThumb
                        key={scene.id}
                        scene={scene}
                        index={idx}
                        isTimelineActive={scene.id === timelineSceneId}
                        onSelectForTimeline={setTimelineSceneId}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {activeTimelineScene ? (
                <div className="border-t border-[#252526] pt-2">
                  <p className={`mb-1.5 text-[10px] font-medium uppercase tracking-wide ${RM.muted}`}>
                    Faixas (como Remotion)
                  </p>
                  <div className={`mb-2 flex h-5 items-stretch pl-[7.25rem] text-[9px] ${RM.timelineRuler}`}>
                    {Array.from({ length: Math.min(13, Math.ceil(activeSceneDurationSec) + 1) }, (_, i) => (
                      <div
                        key={i}
                        className="flex-1 border-l border-[#3c3c3c] pl-0.5 first:border-l-0"
                        style={{ minWidth: 0 }}
                      >
                        {i}s
                      </div>
                    ))}
                  </div>
                  {!activeTimelineScene.hideClassicText ? (
                    <TimelineTrackRow
                      label="Título + subtítulo"
                      leftPct={0}
                      widthPct={100}
                      selected={
                        selectedTrack?.sceneId === activeTimelineScene.id && selectedTrack?.kind === 'classic'
                      }
                      onSelect={() => {
                        setSelectedTrack({ sceneId: activeTimelineScene.id, kind: 'classic' });
                        document
                          .getElementById(`scene-card-${activeTimelineScene.id}`)
                          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }}
                    />
                  ) : null}
                  {(activeTimelineScene.layers || []).map((layer, li) => {
                    const delay = Math.max(0, Math.min(activeSceneDurationFrames, Math.round(Number(layer.animDelay) || 0)));
                    const leftPct = (delay / activeSceneDurationFrames) * 100;
                    const widthPct = 100 - leftPct;
                    const short =
                      layer.type === 'text' && layer.text
                        ? String(layer.text).replace(/\s+/g, ' ').slice(0, 28)
                        : '';
                    const label = short ? `${layer.type}: ${short}${String(layer.text).length > 28 ? '…' : ''}` : `${layer.type} #${li + 1}`;
                    return (
                      <TimelineTrackRow
                        key={li}
                        label={label}
                        leftPct={leftPct}
                        widthPct={widthPct}
                        selected={
                          selectedTrack?.sceneId === activeTimelineScene.id &&
                          selectedTrack?.kind === 'layer' &&
                          selectedTrack?.layerIndex === li
                        }
                        onSelect={() => {
                          setSelectedTrack({
                            sceneId: activeTimelineScene.id,
                            kind: 'layer',
                            layerIndex: li,
                          });
                          document
                            .getElementById(`layer-row-${activeTimelineScene.id}-${li}`)
                            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }}
                        trailing={
                          <>
                            <span className={`text-[9px] ${RM.muted}`}>in</span>
                            <input
                              type="number"
                              min={0}
                              max={activeSceneDurationFrames}
                              value={delay}
                              onChange={(e) =>
                                updateLayerAt(
                                  activeTimelineScene.id,
                                  li,
                                  {
                                    animDelay: Math.min(
                                      activeSceneDurationFrames,
                                      Math.max(0, Math.round(Number(e.target.value) || 0))
                                    ),
                                  }
                                )
                              }
                              className="h-6 w-11 rounded border border-[#3c3c3c] bg-[#3c3c3c] px-1 text-center font-mono text-[10px] text-[#e0e0e0] outline-none focus:border-[#38a0ff]"
                              title="Frame em que a layer começa a animar (entrada)"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </>
                        }
                      />
                    );
                  })}
                  {!activeTimelineScene.hideClassicText || (activeTimelineScene.layers || []).length > 0 ? null : (
                    <p className={`py-2 text-center text-[10px] ${RM.muted}`}>
                      Sem faixas — ative texto clássico ou gere layers com a IA.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </main>

          <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-[#3c3c3c] bg-[#1e1e1e] xl:max-w-[400px] xl:border-l xl:border-t-0">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-3">
            <div className="mb-3 flex items-center gap-2 border-b border-[#3c3c3c] pb-2">
              <span className="text-[13px] font-semibold text-[#e0e0e0]">Props</span>
              <span className={`text-[11px] ${RM.muted}`}>·</span>
              <span className={`text-[11px] ${RM.muted}`}>Composição</span>
            </div>
            <div className="space-y-4">
              <div className={`space-y-2 p-3 ${RM.panel}`}>
                <p className="text-xs font-medium text-[#e0e0e0]">Projeto na nuvem</p>
                {!user && (
                  <p className="text-xs text-amber-400/90">Inicie sessão para guardar e carregar projetos.</p>
                )}
                <label className="block">
                  <span className={RM.label}>Carregar projeto</span>
                  <select
                    value={projectId || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) startNewLocalDraft();
                      else void loadProjectById(v);
                    }}
                    disabled={projectsLoading || !user}
                    className={`h-9 ${RM.input}`}
                  >
                    <option value="">(rascunho local — ainda não na nuvem)</option>
                    {projectsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </label>
                <p className={`text-[11px] ${RM.muted}`}>Nome do projeto: barra superior.</p>
                <div className="flex flex-wrap gap-1">
                  <Button type="button" variant="outline" size="sm" className={RM.btnOutline} onClick={startNewLocalDraft}>
                    Novo rascunho
                  </Button>
                  <Button type="button" size="sm" className={RM.btnPrimary} onClick={() => void upsertProject()} disabled={!user}>
                    Guardar na nuvem
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void deleteProject()}
                    disabled={!user || !projectId}
                  >
                    Apagar
                  </Button>
                </div>
                {projectId ? (
                  <p className={`text-[11px] ${RM.muted}`}>Autosave: alterações na nuvem após ~1,5 s.</p>
                ) : (
                  <p className={`text-[11px] ${RM.muted}`}>
                    «Guardar na nuvem» cria o projeto; depois o autosave fica activo.
                  </p>
                )}
              </div>

              <div className={`grid grid-cols-2 gap-2 p-3 ${RM.panel}`}>
                <label className="block">
                  <span className={RM.label}>Formato</span>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className={`h-9 ${RM.input}`}
                  >
                    {Object.values(NEURO_MOTION_FORMAT_PRESETS).map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={RM.label}>Frames transição</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={transitionFrames}
                    onChange={(e) => setTransitionFrames(Math.min(30, Math.max(0, Number(e.target.value) || 0)))}
                    className={`h-9 ${RM.input}`}
                  />
                </label>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSceneDragEnd}>
                <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {scenes.map((scene, index) => (
                      <SortableSceneCard
                        key={scene.id}
                        scene={scene}
                        index={index}
                        isTimelineActive={scene.id === timelineSceneId}
                      >
                        <div className="flex flex-wrap gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={RM.btnOutline}
                            onClick={() => moveScene(scene.id, 'up')}
                          >
                            ↑
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={RM.btnOutline}
                            onClick={() => moveScene(scene.id, 'down')}
                          >
                            ↓
                          </Button>
                          <Button type="button" variant="destructive" size="sm" onClick={() => removeScene(scene.id)}>
                            Remover
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={RM.btnOutline}
                            onClick={() => duplicateScene(scene.id)}
                          >
                            Duplicar
                          </Button>
                        </div>
                        <div
                          className={
                            selectedTrack?.sceneId === scene.id && selectedTrack?.kind === 'classic'
                              ? 'space-y-2 rounded-sm ring-1 ring-[#38a0ff] ring-offset-2 ring-offset-[#252526]'
                              : 'space-y-2'
                          }
                        >
                          <input
                            value={scene.title}
                            onChange={(e) => updateScene(scene.id, 'title', e.target.value)}
                            placeholder="Titulo da cena"
                            className={`h-9 ${RM.input}`}
                          />
                          <textarea
                            value={scene.subtitle}
                            onChange={(e) => updateScene(scene.id, 'subtitle', e.target.value)}
                            rows={2}
                            placeholder="Subtitulo / mensagem"
                            className={RM.textarea}
                          />
                        </div>
                        <div className="space-y-1">
                          <span className={RM.label}>Imagem (opcional)</span>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/gif"
                              disabled={!user || uploadingSceneId === scene.id}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = '';
                                if (f) void handleImageUpload(scene.id, f);
                              }}
                              className={RM.fileInput}
                            />
                            {uploadingSceneId === scene.id ? (
                              <Loader2 className={`h-4 w-4 animate-spin ${RM.muted}`} />
                            ) : null}
                            {scene.imageUrl ? (
                              <>
                                <img src={scene.imageUrl} alt="" className="h-12 max-w-[120px] rounded object-cover" />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className={`h-8 text-xs text-[#cccccc] hover:bg-[#3c3c3c] hover:text-white`}
                                  onClick={() => updateScene(scene.id, 'imageUrl', '')}
                                >
                                  Remover imagem
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <label className="block">
                            <span className={RM.label}>Destaque</span>
                            <input
                              type="color"
                              value={scene.accentColor}
                              onChange={(e) => updateScene(scene.id, 'accentColor', e.target.value)}
                              className={RM.colorInput}
                            />
                          </label>
                          <label className="block">
                            <span className={RM.label}>Fundo</span>
                            <input
                              type="color"
                              value={scene.backgroundColor}
                              onChange={(e) => updateScene(scene.id, 'backgroundColor', e.target.value)}
                              className={RM.colorInput}
                            />
                          </label>
                          <label className="block">
                            <span className={RM.label}>Duração (s)</span>
                            <input
                              type="number"
                              min={1}
                              max={12}
                              value={scene.durationSec}
                              onChange={(e) => updateScene(scene.id, 'durationSec', e.target.value)}
                              className={`h-9 ${RM.input}`}
                            />
                          </label>
                          <label className="block">
                            <span className={RM.label}>Transição</span>
                            <select
                              value={scene.transition}
                              onChange={(e) => updateScene(scene.id, 'transition', e.target.value)}
                              className={`h-9 ${RM.input}`}
                            >
                              {NEURO_MOTION_TRANSITIONS.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        {Array.isArray(scene.layers) && scene.layers.length > 0 ? (
                          <div className="space-y-2 border-t border-[#3c3c3c] pt-3">
                            <p className={RM.label}>Layers (clique na faixa na timeline)</p>
                            {scene.layers.map((layer, li) => {
                              const sceneFrames = Math.max(
                                15,
                                Math.round(
                                  (Number(scene.durationSec) > 0 ? Number(scene.durationSec) : 3) * NEURO_MOTION_FPS
                                )
                              );
                              const isSel =
                                timelineSceneId === scene.id &&
                                selectedTrack?.kind === 'layer' &&
                                selectedTrack?.layerIndex === li;
                              return (
                                <div
                                  key={li}
                                  id={`layer-row-${scene.id}-${li}`}
                                  className={`space-y-2 rounded-sm border border-[#3c3c3c] bg-[#1e1e1e] p-2 ${isSel ? 'ring-1 ring-[#38a0ff]' : ''}`}
                                >
                                  <p className="text-[10px] font-mono text-[#a0a0a0]">
                                    {layer.type} · z {layer.zIndex ?? 0}
                                  </p>
                                  {layer.type === 'text' ? (
                                    <textarea
                                      value={layer.text ?? ''}
                                      onChange={(e) => updateLayerAt(scene.id, li, { text: e.target.value })}
                                      rows={2}
                                      className={`min-h-[52px] ${RM.textarea}`}
                                      placeholder="Texto no vídeo"
                                    />
                                  ) : null}
                                  <div className="grid grid-cols-2 gap-2">
                                    <label className="block">
                                      <span className={RM.label}>Entrada (frame)</span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={sceneFrames}
                                        value={Math.round(Number(layer.animDelay) || 0)}
                                        onChange={(e) =>
                                          updateLayerAt(scene.id, li, {
                                            animDelay: Math.min(
                                              sceneFrames,
                                              Math.max(0, Math.round(Number(e.target.value) || 0))
                                            ),
                                          })
                                        }
                                        className={`h-8 ${RM.input}`}
                                      />
                                    </label>
                                    <label className="block">
                                      <span className={RM.label}>zIndex</span>
                                      <input
                                        type="number"
                                        min={-50}
                                        max={200}
                                        value={layer.zIndex ?? 0}
                                        onChange={(e) =>
                                          updateLayerAt(scene.id, li, {
                                            zIndex: Math.round(
                                              Math.min(200, Math.max(-50, Number(e.target.value) || 0))
                                            ),
                                          })
                                        }
                                        className={`h-8 ${RM.input}`}
                                      />
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </SortableSceneCard>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <Button type="button" variant="outline" className={`w-full ${RM.btnOutline}`} onClick={addScene}>
                + Adicionar cena
              </Button>

              <div className={`space-y-2 p-3 ${RM.panel}`}>
                <p className="text-xs font-medium text-[#e0e0e0]">Templates (local)</p>
                <div className="flex gap-2">
                  <input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Nome do template"
                    className={`h-9 flex-1 ${RM.input}`}
                  />
                  <Button type="button" variant="outline" className={RM.btnOutline} onClick={saveTemplate}>
                    Salvar
                  </Button>
                </div>
                {savedTemplates.length > 0 && (
                  <div className="max-h-28 space-y-1 overflow-auto">
                    {savedTemplates.slice(0, 6).map((tpl) => (
                      <div key={tpl.id} className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => loadTemplate(tpl)}
                          className="block w-full rounded-sm border border-[#3c3c3c] bg-[#2d2d30] px-2 py-1 text-left text-xs text-[#cccccc] hover:bg-[#3c3c3c]"
                        >
                          {tpl.name}
                        </button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={RM.btnOutline}
                          onClick={() => renameTemplate(tpl.id)}
                        >
                          Ren.
                        </Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => deleteTemplate(tpl.id)}>
                          Del
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={`p-3 text-xs ${RM.panel} ${RM.muted}`}>
                <p className="font-medium text-[#e0e0e0]">Export MP4</p>
                <p className="mt-1">
                  1) Enfileirar · 2) Servidor com FFmpeg + Chromium:{' '}
                  <code className={RM.code}>npm run neuro-motion:worker</code> ou{' '}
                  <code className={RM.code}>npm run neuro-motion:worker:loop</code>
                </p>
              </div>

              <Button
                type="button"
                className={`w-full ${RM.btnPrimary}`}
                disabled={enqueueLoading}
                onClick={handleEnqueue}
              >
                {enqueueLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enfileirando…
                  </>
                ) : (
                  'Enfileirar render MP4'
                )}
              </Button>

              {jobId && (
                <div className={`space-y-2 p-3 text-xs ${RM.panel}`}>
                  <p>
                    <span className={RM.muted}>Job:</span>{' '}
                    <code className={`break-all ${RM.code}`}>{jobId}</code>
                  </p>
                  {jobRow && (
                    <>
                      <p>
                        <span className={RM.muted}>Estado:</span>{' '}
                        <span className="font-medium text-[#e0e0e0]">{jobRow.status}</span>
                      </p>
                      {jobRow.output_url && (
                        <a
                          href={jobRow.output_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`block truncate underline ${RM.accent}`}
                        >
                          Abrir MP4
                        </a>
                      )}
                      {jobRow.status === 'failed' && jobRow.error_message && (
                        <p className="text-red-400">{jobRow.error_message}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
};

export default NeuroMotionPage;
