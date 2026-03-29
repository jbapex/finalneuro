import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageIcon, Expand, Download, Pencil } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import RefineImageModal from '@/components/flow-builder/modals/RefineImageModal';
import { getImageExpiryMeta } from '@/lib/neurodesign/imageExpiry';
import { deleteNeurodesignGeneratedImageClient } from '@/lib/neurodesign/deleteGeneratedImageClient';
import { cn } from '@/lib/utils';

const GeneratedImageNode = memo(({ id, data }) => {
  const imageUrl = data?.imageUrl || '';
  const label = data?.label || 'Imagem gerada';
  const { user } = useAuth();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [refineModalOpen, setRefineModalOpen] = useState(false);
  const [imageConnections, setImageConnections] = useState([]);

  const projectId = data?.projectId;
  const runId = data?.runId;
  const images = Array.isArray(data?.images) ? data.images : [];
  const imageId = images[0]?.id;
  const canRefine = Boolean(imageUrl && projectId && runId && imageId);
  const onUpdateNodeData = data?.onUpdateNodeData;
  const onRemoveNode = data?.onRemoveNode;
  const createdAtForExpiry = data?.imageGeneratedAt || images[0]?.created_at;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Fluxos salvos costumam ter só `images: [{ id }]` sem `created_at`; a galeria do Neuro Designer lê do DB — espelhamos aqui.
  const expiryFetchDoneForIdRef = useRef(null);
  useEffect(() => {
    if (!user?.id || !imageUrl) return;
    if (!imageId || String(imageId).startsWith('temp-')) return;
    if (!projectId) return;
    if (data?.imageGeneratedAt || images[0]?.created_at) return;
    if (typeof onUpdateNodeData !== 'function') return;
    if (expiryFetchDoneForIdRef.current === imageId) return;
    let cancelled = false;
    (async () => {
      const { data: row, error } = await supabase
        .from('neurodesign_generated_images')
        .select('created_at')
        .eq('id', imageId)
        .maybeSingle();
      if (cancelled || error || !row?.created_at) return;
      expiryFetchDoneForIdRef.current = imageId;
      onUpdateNodeData(id, { imageGeneratedAt: row.created_at });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, imageUrl, imageId, projectId, id, onUpdateNodeData, data?.imageGeneratedAt, images[0]?.created_at]);

  const expiryMeta = imageUrl ? getImageExpiryMeta(createdAtForExpiry, now) : null;

  const deleteExpiredHandledRef = useRef(null);
  useEffect(() => {
    if (!expiryMeta?.isExpired || !imageUrl) return;
    if (!imageId || String(imageId).startsWith('temp-')) return;
    if (!createdAtForExpiry) return;
    if (deleteExpiredHandledRef.current === imageId) return;
    deleteExpiredHandledRef.current = imageId;
    const record = {
      id: imageId,
      url: imageUrl,
      thumbnail_url: images[0]?.thumbnail_url || imageUrl,
      created_at: createdAtForExpiry,
    };
    (async () => {
      const r = await deleteNeurodesignGeneratedImageClient(record);
      if (!r.ok) {
        deleteExpiredHandledRef.current = null;
        return;
      }
      if (typeof onRemoveNode === 'function') {
        onRemoveNode(id);
        return;
      }
      if (typeof onUpdateNodeData === 'function') {
        onUpdateNodeData(id, {
          imageUrl: '',
          images: [],
          runId: undefined,
          imageGeneratedAt: undefined,
        });
      }
    })();
  }, [expiryMeta?.isExpired, imageUrl, imageId, createdAtForExpiry, id, onRemoveNode, onUpdateNodeData, images]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const { data: conns } = await supabase.from('user_ai_connections').select('id, name, provider').eq('user_id', user.id);
      if (mounted && Array.isArray(conns)) setImageConnections(conns);
    })();
    return () => { mounted = false; };
  }, [user]);

  const handleRefineSuccess = useCallback(
    ({ imageUrl: newUrl, runId: newRunId, imageId: newImageId }) => {
      if (typeof onUpdateNodeData !== 'function') return;
      const newImages = newImageId ? [{ id: newImageId, url: newUrl }] : [{ id: imageId, url: newUrl }];
      onUpdateNodeData(id, {
        imageUrl: newUrl,
        runId: newRunId,
        images: newImages,
        imageGeneratedAt: new Date().toISOString(),
      });
    },
    [onUpdateNodeData, id, imageId]
  );

  return (
    <Card className="w-56 border-2 border-emerald-500/50 shadow-lg overflow-hidden">
      <Handle type="target" position={Position.Left} className="!bg-emerald-500" />
      <CardHeader className="flex-row items-center space-x-2 p-2 bg-emerald-500/10">
        <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
        <span className="text-sm font-medium truncate">{label}</span>
      </CardHeader>
      <CardContent className="p-2">
        <div className="w-full aspect-square bg-muted rounded-md overflow-hidden flex items-center justify-center relative group">
          {imageUrl ? (
            <>
              <img src={imageUrl} alt={label} className="w-full h-full object-cover cursor-pointer" onClick={() => setPreviewOpen(true)} />
              {expiryMeta && (
                <div className="absolute bottom-1 left-1 right-1 pointer-events-none flex justify-center z-50">
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shadow-sm max-w-full truncate',
                      expiryMeta.isSoon
                        ? 'bg-red-500/15 text-red-700 border-red-500/35 dark:text-red-300'
                        : 'bg-background/85 text-foreground border-border/60 backdrop-blur-sm'
                    )}
                    title={expiryMeta.isExpired ? 'Expirado (~1h no servidor)' : `Expira em ~${expiryMeta.text}`}
                  >
                    {expiryMeta.isExpired ? 'Expirado' : `-${expiryMeta.text}`}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 z-20 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 pointer-events-none group-hover:pointer-events-auto">
                <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setPreviewOpen(true)}>
                  <Expand className="w-3 h-3 mr-1" /> Ver
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    const a = document.createElement('a');
                    a.href = imageUrl;
                    a.download = `imagem-gerada-${Date.now()}.png`;
                    a.click();
                  }}
                >
                  <Download className="w-3 h-3 mr-1" /> Baixar
                </Button>
                {canRefine && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRefineModalOpen(true);
                    }}
                  >
                    <Pencil className="w-3 h-3 mr-1" /> Refinar
                  </Button>
                )}
              </div>
            </>
          ) : (
            <ImageIcon className="w-10 h-10 text-muted-foreground" />
          )}
        </div>
        {imageUrl && (
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="max-w-[90vw] max-h-[90vh] flex flex-col">
              <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
              <div className="flex-1 min-h-0 overflow-auto flex justify-center">
                <img src={imageUrl} alt={label} className="max-w-full max-h-[70vh] object-contain" />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = imageUrl;
                    a.download = `imagem-gerada-${Date.now()}.png`;
                    a.click();
                  }}
                >
                  <Download className="w-4 h-4 mr-2" /> Baixar imagem
                </Button>
                {canRefine && (
                  <Button type="button" variant="outline" onClick={() => { setPreviewOpen(false); setRefineModalOpen(true); }}>
                    <Pencil className="w-4 h-4 mr-2" /> Refinar
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

      <RefineImageModal
        open={refineModalOpen}
        onOpenChange={setRefineModalOpen}
        imageUrl={imageUrl}
        projectId={projectId}
        runId={runId}
        imageId={imageId}
        userAiConnectionId={data?.userAiConnectionId}
        imageConnections={imageConnections}
        onSuccess={handleRefineSuccess}
      />
      </CardContent>
    </Card>
  );
});

GeneratedImageNode.displayName = 'GeneratedImageNode';

export default GeneratedImageNode;
