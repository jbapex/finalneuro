import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Helmet } from 'react-helmet';
import { Loader2, ArrowLeft } from 'lucide-react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';

import ChatPanel from '@/components/site-builder/ChatPanel';
import PreviewPanel from '@/components/site-builder/PreviewPanel';
import ImageBankModal from '@/components/site-builder/ImageBankModal';

const SiteBuilder = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [selectedElement, setSelectedElement] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isImageBankOpen, setIsImageBankOpen] = useState(false);
  const selectedElementRef = useRef(null);

  const fetchProject = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('site_projects')
      .select('id, name, html_content, chat_history')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      toast({
        title: 'Erro ao carregar projeto',
        description: error?.message || 'Projeto não encontrado ou você não tem permissão.',
        variant: 'destructive',
      });
      navigate('/ferramentas/criador-de-site');
    } else {
      setProject(data);
      setHtmlContent(data.html_content || `
<section class="bg-gray-900 text-white">
  <div class="mx-auto max-w-screen-xl px-4 py-32 lg:flex lg:h-screen lg:items-center">
    <div class="mx-auto max-w-3xl text-center">
      <h1 class="bg-gradient-to-r from-green-300 via-blue-500 to-purple-600 bg-clip-text text-3xl font-extrabold text-transparent sm:text-5xl" data-id="b3f2c1a0" data-type="heading">
        Sua Jornada Digital Começa Aqui.
        <span class="sm:block" data-id="b3f2c1a1" data-type="text"> Construa o Futuro. </span>
      </h1>
      <p class="mx-auto mt-4 max-w-xl sm:text-xl/relaxed" data-id="b3f2c1a2" data-type="text">
        Crie, inove e inspire. Nossas ferramentas de IA estão prontas para transformar suas ideias em realidade.
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-4">
        <a class="block w-full rounded border border-blue-600 bg-blue-600 px-12 py-3 text-sm font-medium text-white sm:w-auto" href="#" data-id="b3f2c1a3" data-type="button">Começar</a>
        <a class="block w-full rounded border border-blue-600 px-12 py-3 text-sm font-medium text-white sm:w-auto" href="#" data-id="b3f2c1a4" data-type="button">Saber Mais</a>
      </div>
    </div>
  </div>
</section>
      `);
    }
    setIsLoading(false);
  }, [projectId, user, navigate, toast]);

  useEffect(() => {
    if (user) fetchProject();
  }, [user, fetchProject]);

  useEffect(() => {
    selectedElementRef.current = selectedElement;
  }, [selectedElement]);

  const onImageSelect = (image) => {
    const currentSelectedElement = selectedElementRef.current;
    if (!currentSelectedElement || currentSelectedElement.type !== 'image') {
      toast({
        title: 'Nenhuma imagem selecionada no editor',
        description: 'Por favor, clique em uma imagem na página para substituí-la.',
        variant: 'destructive',
      });
      return;
    }
    const { signedUrl } = image;
    setHtmlContent(prevContent => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = prevContent;
      const imgToUpdate = tempDiv.querySelector(`img[data-id="${currentSelectedElement.dataId}"]`);
      if (imgToUpdate) {
        imgToUpdate.src = signedUrl;
        imgToUpdate.alt = image.alt_text || '';
        toast({ title: 'Imagem atualizada com sucesso!' });
        return tempDiv.innerHTML;
      }
      toast({ title: 'Erro ao atualizar imagem', variant: 'destructive' });
      return prevContent;
    });
    setIsImageBankOpen(false);
    setSelectedElement(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-16 h-16 text-primary animate-spin" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <>
      <Helmet>
        <title>{`Editor: ${project?.name || 'Criador de Sites'}`}</title>
        <meta name="description" content="Crie e edite landing pages usando uma interface de chat com preview em tempo real." />
      </Helmet>
      <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="p-2 border-b flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ferramentas/criador-de-site')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{project.name}</h1>
        </header>
        <ResizablePanelGroup direction="horizontal" className="flex-grow">
          <ResizablePanel defaultSize={40} minSize={30}>
            <ChatPanel
              htmlContent={htmlContent}
              setHtmlContent={setHtmlContent}
              setIsBuilding={setIsBuilding}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={60} minSize={30}>
            <PreviewPanel
              htmlContent={htmlContent}
              setHtmlContent={setHtmlContent}
              selectedElement={selectedElement}
              setSelectedElement={setSelectedElement}
              onOpenImageBank={() => setIsImageBankOpen(true)}
              isBuilding={isBuilding}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <ImageBankModal
        isOpen={isImageBankOpen}
        onClose={() => {
          setIsImageBankOpen(false);
          setSelectedElement(null);
        }}
        projectId={projectId}
        onImageSelect={onImageSelect}
      />
    </>
  );
};

export default SiteBuilder;
