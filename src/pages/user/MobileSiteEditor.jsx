import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { Loader2, ArrowLeft, MessageSquare, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';

import ChatPanel from '@/components/site-builder/ChatPanel';
import PreviewPanel from '@/components/site-builder/PreviewPanel';
import ImageBankModal from '@/components/site-builder/ImageBankModal';
import { cn } from '@/lib/utils';

const MobileSiteEditor = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const [project, setProject] = useState(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [selectedElement, setSelectedElement] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isImageBankOpen, setIsImageBankOpen] = useState(false);
  const selectedElementRef = useRef(null);
  const [activeView, setActiveView] = useState('preview'); // 'chat', 'preview'

  const fetchProject = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    let query = supabase.from('site_projects').select('*').eq('id', projectId);
    if (profile?.user_type !== 'super_admin') {
      query = query.eq('user_id', user.id);
    }
    const { data, error } = await query.single();
    if (error || !data) {
      toast({ title: 'Erro ao carregar projeto', description: error?.message || 'Projeto não encontrado.', variant: 'destructive' });
      navigate(profile?.user_type === 'super_admin' ? '/superadmin/criar-site' : '/ferramentas/criador-de-site');
    } else {
      setProject(data);
      setHtmlContent(data.html_content || `
<section class="bg-gray-900 text-white">
  <div class="mx-auto max-w-screen-xl px-4 py-32 lg:flex lg:h-screen lg:items-center">
    <div class="mx-auto max-w-3xl text-center">
      <h1
        class="bg-gradient-to-r from-green-300 via-blue-500 to-purple-600 bg-clip-text text-3xl font-extrabold text-transparent sm:text-5xl"
        data-id="b3f2c1a0" data-type="heading"
      >
        Sua Jornada Digital Começa Aqui.

        <span class="sm:block" data-id="b3f2c1a1" data-type="text"> Construa o Futuro. </span>
      </h1>

      <p class="mx-auto mt-4 max-w-xl sm:text-xl/relaxed" data-id="b3f2c1a2" data-type="text">
        Crie, inove e inspire. Nossas ferramentas de IA estão prontas para transformar suas ideias em realidade.
      </p>

      <div class="mt-8 flex flex-wrap justify-center gap-4">
        <a
          class="block w-full rounded border border-blue-600 bg-blue-600 px-12 py-3 text-sm font-medium text-white hover:bg-transparent hover:text-white focus:outline-none focus:ring active:text-opacity-75 sm:w-auto"
          href="#"
          data-id="b3f2c1a3" data-type="button"
        >
          Começar
        </a>

        <a
          class="block w-full rounded border border-blue-600 px-12 py-3 text-sm font-medium text-white hover:bg-blue-600 focus:outline-none focus:ring active:bg-blue-500 sm:w-auto"
          href="#"
          data-id="b3f2c1a4" data-type="button"
        >
          Saber Mais
        </a>
      </div>
    </div>
  </div>
</section>
      `);
    }
    setIsLoading(false);
  }, [projectId, navigate, toast, user, profile]);

  useEffect(() => {
    if (user) fetchProject();
  }, [user, fetchProject]);

  useEffect(() => {
    selectedElementRef.current = selectedElement;
  }, [selectedElement]);

  const onImageSelect = (image) => {
    const currentSelectedElement = selectedElementRef.current;
    if (!currentSelectedElement || currentSelectedElement.type !== 'image') {
      toast({ title: 'Nenhuma imagem selecionada no editor', variant: 'destructive' });
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
            toast({ title: 'Imagem atualizada!' });
            return tempDiv.innerHTML;
        } else {
            toast({ title: 'Erro ao atualizar imagem', variant: 'destructive' });
            return prevContent;
        }
    });

    setIsImageBankOpen(false);
    setSelectedElement(null);
  };

  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-16 h-16 text-primary animate-spin" />
      </div>
    );
  }
  
  const backDestination = profile?.user_type === 'super_admin' ? '/superadmin/criar-site' : '/ferramentas/criador-de-site';

  return (
    <>
      <Helmet>
        <title>{`Editor Mobile: ${project?.name || 'Criador de Sites'}`}</title>
      </Helmet>
      <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="p-2 border-b flex items-center gap-2 sticky top-0 bg-background z-10">
          <Button variant="ghost" size="icon" onClick={() => navigate(backDestination)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold truncate">{project.name}</h1>
        </header>

        <main className="flex-grow overflow-y-auto pb-20 relative">
          {/* Ambos montados para o iframe do preview não recarregar ao trocar de aba */}
          <div className={activeView === 'chat' ? 'h-full' : 'hidden'}>
            <ChatPanel
              htmlContent={htmlContent}
              setHtmlContent={setHtmlContent}
              selectedElement={selectedElement}
              setSelectedElement={setSelectedElement}
              onOpenImageBank={() => setIsImageBankOpen(true)}
              isBuilding={isBuilding}
              setIsBuilding={setIsBuilding}
            />
          </div>
          <div className={activeView === 'preview' ? 'h-full' : 'hidden'}>
            <PreviewPanel
              htmlContent={htmlContent}
              setHtmlContent={setHtmlContent}
              selectedElement={selectedElement}
              setSelectedElement={setSelectedElement}
              onOpenImageBank={() => setIsImageBankOpen(true)}
              isBuilding={isBuilding}
              setIsBuilding={setIsBuilding}
            />
          </div>
        </main>

        <footer className="fixed bottom-0 left-0 right-0 h-20 bg-background/80 backdrop-blur-lg border-t border-border z-50">
          <div className="grid h-full max-w-lg grid-cols-2 mx-auto">
            {[
              { view: 'chat', icon: MessageSquare, label: 'Chat IA' },
              { view: 'preview', icon: Eye, label: 'Preview' },
            ].map(({ view, icon: Icon, label }) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={cn(
                  "inline-flex flex-col items-center justify-center px-5 hover:bg-muted group",
                  activeView === view ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="w-6 h-6 mb-1" />
                <span className="text-xs">{label}</span>
              </button>
            ))}
          </div>
        </footer>
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

export default MobileSiteEditor;