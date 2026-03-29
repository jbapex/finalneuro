import React, { memo, useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, Edit, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useParams } from 'react-router-dom';
import SiteBuilderModal from '@/components/flow-builder/modals/SiteBuilderModal';
import { buildInnerHtmlFromPageStructure, buildSiteHtmlDocument } from '@/lib/siteBuilderDocument';

const SitePreviewNode = memo(({ data }) => {
  const projectId = data?.projectId;
  const projectName = data?.projectName || '';
  const sourceSiteCreatorNodeId = data?.sourceSiteCreatorNodeId;
  const label = data?.label || 'Preview do site';

  const { user } = useAuth();
  const { flowId } = useParams();
  const [pageStructure, setPageStructure] = useState([]);
  const [name, setName] = useState(projectName);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!projectId || !user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const { data: row, error } = await supabase
        .from('site_projects')
        .select('page_structure, name')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;
      if (!error && row) {
        setPageStructure(Array.isArray(row.page_structure) ? row.page_structure : []);
        setName(row.name || projectName || '');
      }
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`site_preview_node:${projectId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'site_projects', filter: `id=eq.${projectId}` },
        (payload) => {
          const row = payload.new;
          if (row?.page_structure) setPageStructure(Array.isArray(row.page_structure) ? row.page_structure : []);
          if (row?.name) setName(row.name);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [projectId, user?.id, projectName]);

  const srcDoc = useMemo(() => {
    if (!pageStructure?.length) return '';
    const inner = buildInnerHtmlFromPageStructure(pageStructure);
    if (!inner?.trim()) return '';
    return buildSiteHtmlDocument({
      rootInnerHtml: inner,
      title: name || 'Preview',
      editorScript: null,
    });
  }, [pageStructure, name]);

  const editorPath = projectId ? `/ferramentas/criador-de-site/${projectId}` : null;

  return (
    <>
      <Card className="w-[420px] max-w-[90vw] border-2 border-emerald-500/50 shadow-lg">
        <Handle type="target" position={Position.Left} className="!bg-emerald-500" />
        <CardHeader className="flex-row items-center gap-2 space-y-0 p-3 bg-emerald-500/10">
          <Globe className="w-5 h-5 text-emerald-500 shrink-0" />
          <CardTitle className="text-base leading-tight truncate">{label}</CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin" />
              A carregar preview…
            </div>
          ) : !srcDoc ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Ainda sem secções no site. Abre o editor para gerar conteúdo ou aguarda a conclusão da IA.
            </p>
          ) : (
            <iframe
              title="Preview do site"
              srcDoc={srcDoc}
              className="w-full h-[min(360px,50vh)] rounded-md border bg-white nodrag"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="default"
              className="flex-1 nodrag"
              disabled={!projectId}
              onClick={() => setModalOpen(true)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Abrir editor
            </Button>
            {editorPath && (
              <Button type="button" variant="outline" className="flex-1 nodrag" asChild>
                <Link to={editorPath} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Página completa
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      {projectId && sourceSiteCreatorNodeId && (
        <SiteBuilderModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          projectId={projectId}
          flowId={flowId}
          nodeId={sourceSiteCreatorNodeId}
        />
      )}
    </>
  );
});

SitePreviewNode.displayName = 'SitePreviewNode';

export default SitePreviewNode;
