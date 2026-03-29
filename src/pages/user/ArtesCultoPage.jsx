import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FolderOpen, PanelLeft, Save, FileUp, Trash2 } from 'lucide-react';
import NeuroDesignSidebar from '@/components/neurodesign/NeuroDesignSidebar';
import ChurchArtBuilderPanel, { churchArtDefaultConfig } from '@/components/church-art/ChurchArtBuilderPanel';
import PreviewPanel from '@/components/neurodesign/PreviewPanel';
import MasonryGallery from '@/components/neurodesign/MasonryGallery';
import NeuroDesignErrorBoundary from '@/components/neurodesign/NeuroDesignErrorBoundary';
import { useNeurodesignExpiredCleanup } from '@/hooks/useNeurodesignExpiredCleanup';

const PROJECT_TYPE = 'church_art';

import { getFriendlyErrorMessage } from '@/lib/utils';

const ArtesCultoPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState('create');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const generatingRef = useRef(false);
  const refiningRef = useRef(false);
  const [imageConnections, setImageConnections] = useState([]);
  const [userGalleryPage, setUserGalleryPage] = useState(0);
  const [userGalleryHasMore, setUserGalleryHasMore] = useState(true);
  const [isLoadingUserGallery, setIsLoadingUserGallery] = useState(false);
  const [isGalleryPreviewOpen, setIsGalleryPreviewOpen] = useState(false);
  const isLg = useMediaQuery('(min-width: 1024px)');
  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);
  const [builderDrawerOpen, setBuilderDrawerOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [useTemplateOpen, setUseTemplateOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!user) return [];
    try {
      const { data, error } = await supabase
        .from('neurodesign_projects')
        .select('*')
        .eq('owner_user_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) {
        toast({ title: 'Erro ao carregar projetos', description: error.message, variant: 'destructive' });
        setProjects([]);
        return [];
      }
      const list = (data || []).filter((p) => (p.project_type || 'neurodesign') === PROJECT_TYPE);
      setProjects(list);
      return list;
    } catch (e) {
      toast({ title: 'Erro ao carregar projetos', description: e?.message, variant: 'destructive' });
      setProjects([]);
      return [];
    }
  }, [user, toast]);

  const ensureOneProject = useCallback(async () => {
    if (!user) return;
    const list = await fetchProjects();
    if (list.length > 0) {
      setSelectedProject((prev) => (prev && list.some((p) => p.id === prev.id) ? prev : list[0]));
      return;
    }
    try {
      let result = await supabase.from('neurodesign_projects').insert({ name: 'Artes de Culto', owner_user_id: user.id, project_type: PROJECT_TYPE }).select().single();
      if (result.error) {
        result = await supabase.from('neurodesign_projects').insert({ name: 'Artes de Culto', owner_user_id: user.id }).select().single();
        if (result.error) throw result.error;
      }
      if (result.data) {
        setProjects([result.data]);
        setSelectedProject(result.data);
        toast({ title: 'Projeto criado.' });
      }
    } catch (e) {
      toast({ title: 'Erro ao criar projeto', description: e?.message, variant: 'destructive' });
    }
  }, [user, fetchProjects, toast]);

  const fetchImageConnections = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('user_ai_connections').select('id, name, provider, default_model, capabilities').eq('user_id', user.id);
      if (error) return;
      setImageConnections((data || []).filter((c) => c.capabilities?.image_generation));
    } catch (_e) {
      setImageConnections([]);
    }
  }, [user]);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    setTemplatesLoading(true);
    try {
      const { data, error } = await supabase
        .from('church_art_templates')
        .select('id, name, config, created_at')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTemplates(data || []);
    } catch (e) {
      toast({ title: 'Erro ao carregar templates', description: e?.message, variant: 'destructive' });
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, [user, toast]);

  const handleSaveTemplate = useCallback(async () => {
    const name = (templateName || '').trim();
    if (!name) {
      toast({ title: 'Digite um nome para o template.', variant: 'destructive' });
      return;
    }
    if (!user) return;
    const configToSave = currentConfig || churchArtDefaultConfig();
    try {
      const { error } = await supabase.from('church_art_templates').insert({
        owner_user_id: user.id,
        name,
        config: configToSave,
      });
      if (error) throw error;
      setSaveTemplateDialogOpen(false);
      setTemplateName('');
      await fetchTemplates();
      toast({ title: 'Template salvo.' });
    } catch (e) {
      toast({ title: 'Erro ao salvar template', description: e?.message, variant: 'destructive' });
    }
  }, [user, currentConfig, templateName, fetchTemplates, toast]);

  const handleUseTemplate = useCallback((tpl) => {
    const defaultCfg = churchArtDefaultConfig();
    setCurrentConfig({ ...defaultCfg, ...(tpl.config || {}) });
    setUseTemplateOpen(false);
    toast({ title: 'Template aplicado.' });
  }, []);

  const handleDeleteTemplate = useCallback(async (id) => {
    if (!user || !window.confirm('Excluir este template?')) return;
    try {
      const { error } = await supabase.from('church_art_templates').delete().eq('id', id).eq('owner_user_id', user.id);
      if (error) throw error;
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast({ title: 'Template excluído.' });
    } catch (e) {
      toast({ title: 'Erro ao excluir template', description: e?.message, variant: 'destructive' });
    }
  }, [user, toast]);

  const fetchImages = useCallback((projectId) => {
    if (!projectId) return;
    supabase.from('neurodesign_generated_images').select('id, run_id, project_id, url, thumbnail_url, width, height, created_at').eq('project_id', projectId).order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) toast({ title: 'Erro ao carregar imagens', description: error.message, variant: 'destructive' });
      else setImages(data || []);
    });
  }, [toast]);

  const USER_GALLERY_PAGE_SIZE = 60;
  const loadUserGalleryImages = useCallback(async (page = 0, { reset = false } = {}) => {
    if (!user || !projects.length) { if (reset) setImages([]); return; }
    setIsLoadingUserGallery(true);
    const projectIds = projects.map((p) => p.id).filter(Boolean);
    const from = page * USER_GALLERY_PAGE_SIZE;
    const to = from + USER_GALLERY_PAGE_SIZE - 1;
    const { data, error } = await supabase.from('neurodesign_generated_images').select('id, run_id, project_id, url, thumbnail_url, width, height, created_at').in('project_id', projectIds).order('created_at', { ascending: false }).range(from, to);
    setIsLoadingUserGallery(false);
    if (error) { toast({ title: 'Erro ao carregar galeria', description: error.message, variant: 'destructive' }); if (reset) setImages([]); return; }
    const batch = data || [];
    if (reset) setImages(batch);
    else setImages((prev) => { const existingIds = new Set(prev.map((i) => i.id)); const merged = [...prev]; batch.forEach((img) => { if (!existingIds.has(img.id)) merged.push(img); }); return merged; });
    setUserGalleryPage(page + 1);
    setUserGalleryHasMore(batch.length === USER_GALLERY_PAGE_SIZE);
  }, [user, projects, toast]);

  useEffect(() => { ensureOneProject(); fetchImageConnections(); fetchTemplates(); }, [ensureOneProject, fetchImageConnections, fetchTemplates]);

  useEffect(() => {
    if (selectedProject) {
      setCurrentConfig(null);
      setSelectedImage(null);
      fetchImages(selectedProject.id);
    } else {
      setImages([]);
      setCurrentConfig(null);
      setSelectedImage(null);
    }
  }, [selectedProject, fetchImages]);

  useEffect(() => {
    if (view === 'gallery') { setUserGalleryPage(0); setUserGalleryHasMore(true); loadUserGalleryImages(0, { reset: true }); }
    else if (view === 'create' && selectedProject?.id) fetchImages(selectedProject.id);
  }, [view, loadUserGalleryImages, fetchImages, selectedProject?.id]);

  useNeurodesignExpiredCleanup({
    enabled: Boolean(user?.id),
    images,
    setImages,
    setSelectedImage,
  });

  const handleGenerate = async (config) => {
    if (generatingRef.current || !selectedProject) {
      if (!selectedProject) toast({ title: 'Selecione um projeto.', variant: 'destructive' });
      return;
    }
    generatingRef.current = true;
    setIsGenerating(true);
    try {
      const conn = imageConnections.find((c) => c.id === config?.user_ai_connection_id);
      const isGoogle = conn?.provider?.toLowerCase() === 'google';
      const fnName = isGoogle ? 'church-art-generate-google' : 'church-art-generate';
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { projectId: selectedProject.id, configId: null, config: { ...config }, userAiConnectionId: config?.user_ai_connection_id || null },
      });
      const errMsg = data?.error || error?.message;
      if (error) throw new Error(errMsg || 'Falha ao chamar o servidor de geração.');
      if (data?.error) throw new Error(data.error);
      const newImages = data?.images;
      if (newImages?.length) {
        const withIds = newImages.map((img, i) => ({ ...img, id: img.id || `temp-${i}`, run_id: img.run_id || data.runId, project_id: selectedProject.id }));
        setSelectedImage(withIds[0]);
        setImages((prev) => [...withIds, ...prev.filter((p) => !withIds.some((w) => w.id === p.id))].slice(0, 5));
        toast({ title: 'Arte de culto gerada com sucesso!' });
        setTimeout(() => fetchImages(selectedProject.id), 2500);
      } else toast({ title: 'Geração concluída', description: 'Nenhuma imagem retornada.', variant: 'destructive' });
    } catch (e) {
      const friendlyMsg = getFriendlyErrorMessage(e);
      toast({ title: 'Aviso', description: friendlyMsg, variant: 'destructive' });
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  };

  const handleRefine = async (payload) => {
    if (refiningRef.current || !selectedProject || !selectedImage?.id) {
      if (!selectedImage) toast({ title: 'Selecione uma imagem para refinar', variant: 'destructive' });
      return;
    }
    const runId = selectedImage.run_id;
    if (!runId) { toast({ title: 'Execução não encontrada', variant: 'destructive' }); return; }
    refiningRef.current = true;
    setIsRefining(true);
    try {
      const body = { projectId: selectedProject.id, runId, imageId: selectedImage.id, instruction: typeof payload === 'string' ? payload : payload?.instruction ?? '', configOverrides: typeof payload === 'object' && payload !== null ? payload.configOverrides : undefined, userAiConnectionId: currentConfig?.user_ai_connection_id || null };
      if (typeof payload === 'object' && payload !== null) {
        if (payload.referenceImageUrl) body.referenceImageUrl = payload.referenceImageUrl;
        if (payload.replacementImageUrl) body.replacementImageUrl = payload.replacementImageUrl;
        if (payload.addImageUrl) body.addImageUrl = payload.addImageUrl;
        if (payload.region) body.region = payload.region;
        if (payload.regionCropImageUrl) body.regionCropImageUrl = payload.regionCropImageUrl;
        if (payload.selectionAction) body.selectionAction = payload.selectionAction;
        if (payload.selectionText) body.selectionText = payload.selectionText;
        if (payload.selectionFont) body.selectionFont = payload.selectionFont;
        if (payload.selectionFontStyle) body.selectionFontStyle = payload.selectionFontStyle;
      }
      const refineConn = imageConnections.find((c) => c.id === currentConfig?.user_ai_connection_id);
      const isGoogleRefine = refineConn?.provider?.toLowerCase() === 'google';
      const refineFnName = isGoogleRefine ? 'neurodesign-refine-google' : 'neurodesign-refine';
      const { data, error } = await supabase.functions.invoke(refineFnName, { body });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      if (data?.images?.length) {
        const withIds = data.images.map((img, i) => ({ ...img, id: img.id || `temp-refine-${i}`, run_id: img.run_id ?? data.runId ?? runId, project_id: selectedProject.id }));
        setSelectedImage(withIds[0]);
        setImages((prev) => [...withIds, ...prev.filter((p) => !withIds.some((w) => w.id === p.id))].slice(0, 5));
        toast({ title: 'Imagem refinada com sucesso!' });
        setTimeout(() => fetchImages(selectedProject.id), 2500);
      }
    } catch (e) {
      const friendlyMsg = getFriendlyErrorMessage(e);
      toast({ title: 'Aviso', description: friendlyMsg, variant: 'destructive' });
    } finally {
      refiningRef.current = false;
      setIsRefining(false);
    }
  };

  const handleDeleteImage = async (image) => {
    if (!image?.id) return;
    if (!window.confirm('Excluir esta arte? Esta ação não pode ser desfeita.')) return;
    try {
      const { error } = await supabase.from('neurodesign_generated_images').delete().eq('id', image.id);
      if (error) throw error;
      setImages((prev) => prev.filter((img) => img.id !== image.id));
      if (selectedImage?.id === image.id) setSelectedImage(null);
      setIsGalleryPreviewOpen(false);
      toast({ title: 'Arte excluída.' });
    } catch (e) {
      toast({ title: 'Erro ao excluir', description: e?.message, variant: 'destructive' });
    }
  };

  const downloadHandler = (url) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `arte-culto-${Date.now()}.png`;
    a.click();
  };

  const handleCreateProject = async () => {
    if (!user) return;
    try {
      let result = await supabase.from('neurodesign_projects').insert({ name: 'Artes de Culto', owner_user_id: user.id, project_type: PROJECT_TYPE }).select().single();
      if (result.error) {
        result = await supabase.from('neurodesign_projects').insert({ name: 'Artes de Culto', owner_user_id: user.id }).select().single();
        if (result.error) throw result.error;
      }
      if (result.data) {
        setProjects((prev) => [result.data, ...prev]);
        setSelectedProject(result.data);
        setImages([]);
        setSelectedImage(null);
        setCurrentConfig(null);
        toast({ title: 'Projeto criado.' });
      }
    } catch (e) {
      toast({ title: 'Erro ao criar projeto', description: e?.message, variant: 'destructive' });
    }
  };

  const sidebarProps = { view, setView, projects, selectedProject, onSelectProject: setSelectedProject, onCreateProject: handleCreateProject, title: 'Artes de Culto', subtitle: 'Artes para igrejas' };

  return (
    <>
      <Helmet>
        <title>Artes de Culto - Neuro Ápice</title>
        <meta name="description" content="Crie artes para cultos: tema, pregador, cantores e rodapé fixo." />
      </Helmet>
      <NeuroDesignErrorBoundary>
        <div className="flex h-[calc(100vh-4rem)] min-h-[400px] bg-muted/40 text-foreground overflow-hidden min-w-0">
          {isLg && <NeuroDesignSidebar {...sidebarProps} onCloseDrawer={undefined} wrapperClassName={undefined} />}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden min-h-0">
            {!isLg && (
              <div className="flex items-center gap-2 p-2 border-b border-border shrink-0">
                <Button variant="outline" size="sm" className="border-border hover:bg-muted" onClick={() => setSidebarDrawerOpen(true)}><FolderOpen className="h-4 w-4 mr-1" /> Navegação</Button>
                {view === 'create' && <Button variant="outline" size="sm" className="border-border hover:bg-muted" onClick={() => setBuilderDrawerOpen(true)}><PanelLeft className="h-4 w-4 mr-1" /> Configurações</Button>}
              </div>
            )}
            {view === 'create' && (
              <div className="flex flex-1 min-w-0 min-h-0">
                {isLg && (
                  <div className="w-[420px] xl:w-[480px] shrink-0 flex flex-col border-r border-border bg-card min-h-0">
                    <div className="p-2 border-b border-border flex flex-wrap gap-2 shrink-0">
                      <Button type="button" variant="outline" size="sm" className="border-border" onClick={() => { setTemplateName(''); setSaveTemplateDialogOpen(true); }}>
                        <Save className="h-3.5 w-3.5 mr-1" /> Salvar como template
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="border-border" onClick={() => setUseTemplateOpen(true)} disabled={templatesLoading}>
                        <FileUp className="h-3.5 w-3.5 mr-1" /> Usar template
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0">
                      <ChurchArtBuilderPanel project={selectedProject} config={currentConfig} setConfig={setCurrentConfig} imageConnections={imageConnections} onGenerate={handleGenerate} isGenerating={isGenerating} />
                    </div>
                  </div>
                )}
                <div className="flex-1 min-w-0 flex flex-col">
                  <PreviewPanel project={selectedProject} user={user} selectedImage={selectedImage} images={images} isGenerating={isGenerating} isRefining={isRefining} onRefine={handleRefine} onDownload={downloadHandler} onSelectImage={setSelectedImage} hasImageConnection={!!(currentConfig?.user_ai_connection_id && currentConfig.user_ai_connection_id !== 'none')} />
                </div>
              </div>
            )}
            {view === 'gallery' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
                <p className="text-sm text-muted-foreground mb-4">Todas as artes de culto que você já gerou.</p>
                <MasonryGallery images={images} projectId={selectedProject?.id} userGalleryMode selectedIds={selectedImage ? [selectedImage.id] : []} onSelectImage={(img) => { setSelectedImage(img); setIsGalleryPreviewOpen(true); }} onDownload={downloadHandler} onDeleteImage={handleDeleteImage} />
                {userGalleryHasMore && (
                  <div className="mt-6 flex justify-center">
                    <Button variant="outline" size="sm" onClick={() => loadUserGalleryImages(userGalleryPage, { reset: false })} disabled={isLoadingUserGallery}>{isLoadingUserGallery ? 'Carregando...' : 'Carregar mais'}</Button>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
        <Dialog open={sidebarDrawerOpen} onOpenChange={setSidebarDrawerOpen}>
          <DialogContent className="fixed left-0 top-0 h-full w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-r border-border p-0 gap-0 flex flex-col bg-card data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left" onPointerDownOutside={(e) => e.preventDefault()}>
            <NeuroDesignSidebar {...sidebarProps} onCloseDrawer={() => setSidebarDrawerOpen(false)} wrapperClassName="w-full h-full border-0 bg-transparent flex flex-col" />
          </DialogContent>
        </Dialog>
        <Dialog open={builderDrawerOpen} onOpenChange={setBuilderDrawerOpen}>
          <DialogContent className="fixed left-0 top-0 h-full w-full max-w-md translate-x-0 translate-y-0 rounded-none border-r border-border p-0 gap-0 grid-rows-auto bg-card data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left overflow-hidden flex flex-col" onPointerDownOutside={(e) => e.preventDefault()}>
            <div className="p-4 border-b border-border shrink-0">
              <h3 className="font-semibold text-foreground mb-2">Configurações da arte de culto</h3>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="border-border" onClick={() => { setTemplateName(''); setSaveTemplateDialogOpen(true); }}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Salvar como template
                </Button>
                <Button type="button" variant="outline" size="sm" className="border-border" onClick={() => setUseTemplateOpen(true)} disabled={templatesLoading}>
                  <FileUp className="h-3.5 w-3.5 mr-1" /> Usar template
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0 pb-[env(safe-area-inset-bottom)]">
              <ChurchArtBuilderPanel project={selectedProject} config={currentConfig} setConfig={setCurrentConfig} imageConnections={imageConnections} onGenerate={(cfg) => { handleGenerate(cfg); setBuilderDrawerOpen(false); }} isGenerating={isGenerating} />
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Salvar como template</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="template-name">Nome do template</Label>
                <Input id="template-name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Ex.: Culto Jovens – Vila São Pedro" className="bg-muted border-border" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSaveTemplateDialogOpen(false)}>Cancelar</Button>
                <Button type="button" onClick={handleSaveTemplate}>Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={useTemplateOpen} onOpenChange={setUseTemplateOpen}>
          <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Usar template</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto min-h-0 py-2">
              {templatesLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum template salvo. Preencha o formulário e use &quot;Salvar como template&quot;.</p>
              ) : (
                <ul className="space-y-2">
                  {templates.map((tpl) => (
                    <li key={tpl.id} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-muted/30">
                      <span className="text-sm font-medium truncate flex-1">{tpl.name}</span>
                      <div className="flex shrink-0 gap-1">
                        <Button type="button" variant="default" size="sm" onClick={() => handleUseTemplate(tpl)}>Usar</Button>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteTemplate(tpl.id)} aria-label="Excluir template">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isGalleryPreviewOpen && !!selectedImage} onOpenChange={setIsGalleryPreviewOpen}>
          <DialogContent className="max-w-3xl w-full">
            {selectedImage && (
              <div className="space-y-4">
                <div className="w-full rounded-lg overflow-hidden bg-black/80">
                  <img src={selectedImage.url || selectedImage.thumbnail_url} alt="" className="w-full h-auto max-h-[70vh] object-contain" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => downloadHandler(selectedImage.url || selectedImage.thumbnail_url)}>Baixar</Button>
                  <Button variant="destructive" onClick={() => handleDeleteImage(selectedImage)}>Excluir</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </NeuroDesignErrorBoundary>
    </>
  );
};

export default ArtesCultoPage;
