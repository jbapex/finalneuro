import React, { memo, useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Globe, LayoutTemplate, Maximize2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  buildInnerHtmlFromPageStructure,
  buildSiteHtmlDocument,
  escapeHtmlForIframe,
} from '@/lib/siteBuilderDocument';
import NeuralNetworkCanvas from '@/components/ui/NeuralNetworkCanvas';
import { FlowNodeHeaderDelete } from '@/components/flow-builder/FlowNodeHeaderDelete';

const SELECT_FIELDS = 'page_structure, html_content, name, status';

const SitePreviewNode = memo(({ data, id, selected }) => {
  const projectId = data?.projectId;
  const projectName = data?.projectName || '';
  const label = data?.label || 'Preview do site';

  const { user } = useAuth();
  const [pageStructure, setPageStructure] = useState([]);
  const [htmlContent, setHtmlContent] = useState('');
  const [name, setName] = useState(projectName);
  const [projectStatus, setProjectStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasRow, setHasRow] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [expandedOpen, setExpandedOpen] = useState(false);

  const applyRow = useCallback((row) => {
    if (!row) return;
    setHasRow(true);
    setFetchError(null);
    setPageStructure(Array.isArray(row.page_structure) ? row.page_structure : []);
    setHtmlContent(row.html_content != null ? String(row.html_content) : '');
    setName(row.name || projectName || '');
    setProjectStatus(row.status != null ? String(row.status) : null);
  }, [projectName]);

  useEffect(() => {
    if (!projectId || !user?.id) {
      setLoading(false);
      setHasRow(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setFetchError(null);
      const { data: row, error } = await supabase
        .from('site_projects')
        .select(SELECT_FIELDS)
        .eq('id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setFetchError(error.message || 'Erro ao carregar');
        setHasRow(false);
      } else if (row) {
        applyRow(row);
      } else {
        setHasRow(false);
        setFetchError('Projeto não encontrado');
      }
      setLoading(false);
    };

    load();

    const refetch = async () => {
      const { data: row, error } = await supabase
        .from('site_projects')
        .select(SELECT_FIELDS)
        .eq('id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!error && row) applyRow(row);
    };

    const channel = supabase
      .channel(`site_preview_node:${projectId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'site_projects', filter: `id=eq.${projectId}` },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [projectId, user?.id, applyRow]);

  const srcDoc = useMemo(() => {
    const innerFromModules = buildInnerHtmlFromPageStructure(pageStructure);
    if (innerFromModules?.trim()) {
      return buildSiteHtmlDocument({
        rootInnerHtml: innerFromModules,
        title: name || 'Preview',
        editorScript: null,
      });
    }
    const hc = htmlContent?.trim();
    if (hc && hc.length > 40) {
      return buildSiteHtmlDocument({
        rootInnerHtml: escapeHtmlForIframe(hc),
        title: name || 'Preview',
        editorScript: null,
      });
    }
    return '';
  }, [pageStructure, htmlContent, name]);

  const st = String(projectStatus || '').toLowerCase();
  const isPendingLike =
    st === 'pending' || st === 'processing' || st === 'generating';
  const isFailed = st === 'failed' || st === 'error' || st === 'cancelled';

  /**
   * O Realtime (postgres_changes) nem sempre dispara no cliente; sem isto o estado fica em
   * "pending" + sem HTML até refrescar a página. Polling leve até haver iframe ou falha.
   */
  useEffect(() => {
    if (!projectId || !user?.id || loading || fetchError || !hasRow) return;
    if (isFailed) return;
    if (srcDoc) return;

    let attempts = 0;
    const MAX_POLLS = 150;
    let intervalId;

    const poll = async () => {
      attempts += 1;
      const { data: row, error } = await supabase
        .from('site_projects')
        .select(SELECT_FIELDS)
        .eq('id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!error && row) applyRow(row);
      if (attempts >= MAX_POLLS) clearInterval(intervalId);
    };

    poll();
    intervalId = setInterval(poll, 2000);
    return () => clearInterval(intervalId);
  }, [projectId, user?.id, loading, fetchError, hasRow, isFailed, applyRow, srcDoc]);

  const showNeural =
    !loading &&
    !fetchError &&
    hasRow &&
    !srcDoc &&
    !isFailed &&
    isPendingLike;

  const editorPath = projectId ? `/ferramentas/criador-de-site/${projectId}` : null;

  return (
    <>
    <Card className="w-[420px] max-w-[90vw] border-2 border-emerald-500/50 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-emerald-500" />
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-3 bg-emerald-500/10 min-w-0">
        <Globe className="w-5 h-5 shrink-0 text-emerald-500" />
        <CardTitle className="min-w-0 flex-1 truncate text-base leading-tight">{label}</CardTitle>
        <div className="flex shrink-0 items-center gap-0.5">
          <FlowNodeHeaderDelete nodeId={id} onRemoveNode={data.onRemoveNode} selected={selected} />
          {srcDoc ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="nodrag h-8 w-8 shrink-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
              title="Ampliar preview"
              aria-label="Ampliar preview do site"
              onClick={() => setExpandedOpen(true)}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {loading ? (
          <div className="relative h-[min(280px,45vh)] w-full rounded-md border bg-muted/30 overflow-hidden">
            <NeuralNetworkCanvas isActive={false} />
            <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              A carregar projeto…
            </p>
          </div>
        ) : fetchError ? (
          <p className="text-sm text-destructive text-center py-12">{fetchError}</p>
        ) : showNeural ? (
          <div className="relative h-[min(280px,45vh)] w-full rounded-md border bg-background overflow-hidden nodrag">
            <NeuralNetworkCanvas isActive />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2 px-4">
              <p className="text-sm font-medium text-foreground animate-pulse text-center">
                A IA está a construir o site…
              </p>
              <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                O mesmo pipeline do criador (Horizons + chat) está a gerar o HTML a partir do brief; o iframe
                aparece quando a resposta for guardada.
              </p>
            </div>
          </div>
        ) : isFailed ? (
          <p className="text-sm text-destructive text-center py-12">
            A geração falhou. Abra o criador de site para rever o projeto ou tente de novo.
          </p>
        ) : !srcDoc ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Ainda sem conteúdo visível. Abra o criador de site para continuar no chat.
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
          {srcDoc ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1 nodrag"
              onClick={() => setExpandedOpen(true)}
            >
              <Maximize2 className="mr-2 h-4 w-4" />
              Ampliar preview
            </Button>
          ) : null}
          {editorPath && (
            <Button type="button" variant="default" className="flex-1 nodrag" asChild>
              <Link to={editorPath}>
                <LayoutTemplate className="mr-2 h-4 w-4" />
                Abrir criador de site
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>

    <Dialog open={expandedOpen} onOpenChange={setExpandedOpen}>
      <DialogContent className="flex max-h-[min(92dvh,960px)] w-[min(96vw,1280px)] max-w-[min(96vw,1280px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1280px)]">
        <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-12 text-left">
          <DialogTitle className="text-base leading-tight">
            Preview ampliado — {name || projectName || label}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 bg-muted/30 p-2">
          {srcDoc ? (
            <iframe
              title="Preview ampliado do site"
              srcDoc={srcDoc}
              className="h-[min(78dvh,820px)] w-full rounded-md border bg-white"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
});

SitePreviewNode.displayName = 'SitePreviewNode';

export default SitePreviewNode;
