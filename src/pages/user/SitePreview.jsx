import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2, Edit, AlertTriangle } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { applyModuleColors } from '@/lib/applyModuleColors';

const SitePreview = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProject = useCallback(async () => {
    setIsLoading(true);
    const { data, error: fetchError } = await supabase
      .from('site_projects')
      .select('id, name, page_structure, user_id')
      .eq('id', projectId)
      .single();

    if (fetchError || !data) {
      setError(fetchError?.message || 'Projeto não encontrado ou você não tem permissão para acessá-lo.');
      setProject(null);
    } else {
      setProject(data);
      setError(null);
    }
    setIsLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const combinedHtml = useMemo(() => {
    const structure = project?.page_structure;
    if (!structure?.length) return '';
    return structure
      .map((module) => applyModuleColors(module.html, module.backgroundColor, module.textColor))
      .join('');
  }, [project?.page_structure]);

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>body { margin: 0; font-family: sans-serif; }</style>
      <title>${project?.name || 'Preview'}</title>
    </head>
    <body>
      <div id="root">${combinedHtml || ''}</div>
    </body>
    </html>
  `;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-16 h-16 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-center p-4">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-4">Erro ao Carregar Preview</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild>
          <Link to="/ferramentas/criador-de-site">Voltar para Meus Sites</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Preview: {project?.name || 'Site'}</title>
      </Helmet>
      <iframe
        srcDoc={fullHtml}
        title={`Preview de ${project?.name}`}
        className="w-full h-screen border-0"
        sandbox="allow-scripts allow-same-origin"
      />
      {user && user.id === project?.user_id && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button asChild className="shadow-lg animate-pulse">
            <Link to={`/ferramentas/criador-de-site/${projectId}`}>
              <Edit className="mr-2 h-4 w-4" />
              Voltar ao Editor
            </Link>
          </Button>
        </div>
      )}
    </>
  );
};

export default SitePreview;