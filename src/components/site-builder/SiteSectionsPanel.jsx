import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Type, Image as ImageIcon, Video, Wand2, Loader2, Link2 } from 'lucide-react';
import {
  collectSectionTexts,
  collectSectionImages,
  collectSectionVideos,
  collectSectionLinks,
  applySectionTextUpdates,
  applySectionImageSrc,
  applySectionVideoUpdates,
  applySectionLinkUpdates,
  parseSectionIds,
} from '@/lib/siteBuilderSections';

const sectionLabel = (id) => id.replace(/^section_/, 'Seção ');

/** Miniatura da URL (img ou fundo); falha silenciosa com ícone. */
function ImagePreviewThumb({ src, isBackground }) {
  const [failed, setFailed] = useState(false);
  if (!src?.trim() || failed) {
    return (
      <div
        className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-md border border-border bg-muted"
        title={isBackground ? 'Fundo' : 'Sem pré-visualização'}
      >
        <ImageIcon className="h-8 w-8 text-muted-foreground opacity-60" />
      </div>
    );
  }
  return (
    <img
      src={src.trim()}
      alt=""
      className="h-[72px] w-[72px] shrink-0 rounded-md border border-border object-cover bg-muted"
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

const SiteSectionsPanel = ({
  htmlContent,
  setHtmlContent,
  onRefineSection,
  isRefining,
  onPickImageFromBank,
}) => {
  const sectionIds = useMemo(() => parseSectionIds(htmlContent), [htmlContent]);

  const [textDialog, setTextDialog] = useState(null); // sectionId
  const [textDrafts, setTextDrafts] = useState([]);

  const [imageDialog, setImageDialog] = useState(null); // sectionId
  const [imageDrafts, setImageDrafts] = useState([]);

  const [videoDialog, setVideoDialog] = useState(null); // sectionId
  const [videoDrafts, setVideoDrafts] = useState([]);

  const [refineDialog, setRefineDialog] = useState(null); // sectionId
  const [refineInstruction, setRefineInstruction] = useState('');

  const [anchorDialog, setAnchorDialog] = useState(null); // sectionId
  const [anchorDrafts, setAnchorDrafts] = useState([]);

  useEffect(() => {
    if (!textDialog) {
      setTextDrafts([]);
      return;
    }
    setTextDrafts(collectSectionTexts(htmlContent, textDialog));
  }, [textDialog, htmlContent]);

  useEffect(() => {
    if (!imageDialog) {
      setImageDrafts([]);
      return;
    }
    setImageDrafts(collectSectionImages(htmlContent, imageDialog));
  }, [imageDialog, htmlContent]);

  useEffect(() => {
    if (!videoDialog) {
      setVideoDrafts([]);
      return;
    }
    setVideoDrafts(collectSectionVideos(htmlContent, videoDialog));
  }, [videoDialog, htmlContent]);

  useEffect(() => {
    if (!anchorDialog) {
      setAnchorDrafts([]);
      return;
    }
    setAnchorDrafts(collectSectionLinks(htmlContent, anchorDialog));
  }, [anchorDialog, htmlContent]);

  const saveTexts = useCallback(() => {
    if (!textDialog) return;
    setHtmlContent((prev) => applySectionTextUpdates(prev, textDialog, textDrafts));
    setTextDialog(null);
  }, [textDialog, textDrafts, setHtmlContent]);

  const saveImages = useCallback(() => {
    if (!imageDialog) return;
    let next = htmlContent;
    imageDrafts.forEach((row) => {
      next = applySectionImageSrc(next, imageDialog, row.dataId, row.src, row.isBackground);
    });
    setHtmlContent(next);
    setImageDialog(null);
  }, [imageDialog, imageDrafts, htmlContent, setHtmlContent]);

  const saveVideos = useCallback(() => {
    if (!videoDialog) return;
    setHtmlContent((prev) =>
      applySectionVideoUpdates(
        prev,
        videoDialog,
        videoDrafts.map((row) => ({
          dataId: row.dataId,
          src: row.src,
          poster: row.kind === 'video' ? row.poster : undefined,
        }))
      )
    );
    setVideoDialog(null);
  }, [videoDialog, videoDrafts, setHtmlContent]);

  const saveRefine = useCallback(async () => {
    if (!refineDialog || !refineInstruction.trim()) return;
    await onRefineSection(refineDialog, refineInstruction.trim());
    setRefineDialog(null);
    setRefineInstruction('');
  }, [refineDialog, refineInstruction, onRefineSection]);

  const saveAnchors = useCallback(() => {
    if (!anchorDialog) return;
    setHtmlContent((prev) =>
      applySectionLinkUpdates(
        prev,
        anchorDialog,
        anchorDrafts.map((row) => ({ linkId: row.linkId, href: row.href }))
      )
    );
    setAnchorDialog(null);
  }, [anchorDialog, anchorDrafts, setHtmlContent]);

  if (sectionIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] p-6 text-center text-muted-foreground text-sm">
        Nenhuma seção encontrada. Gere HTML com seções (<code className="text-xs text-foreground">data-section-id</code>) no chat.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <ScrollArea className="flex-1 h-full">
        <div className="p-3 space-y-3">
          {sectionIds.map((sid) => (
            <Card key={sid} className="border-border">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base">{sectionLabel(sid)}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 pb-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setTextDialog(sid)}
                >
                  <Type className="h-3.5 w-3.5" />
                  Textos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setImageDialog(sid)}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  Imagens
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setVideoDialog(sid)}
                >
                  <Video className="h-3.5 w-3.5" />
                  Vídeos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setAnchorDialog(sid)}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Âncoras
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1"
                  onClick={() => setRefineDialog(sid)}
                  disabled={isRefining}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Refinar seção
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={!!textDialog} onOpenChange={(o) => !o && setTextDialog(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Textos — {textDialog ? sectionLabel(textDialog) : ''}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Edite ou apague o texto de cada bloco. Campos vazios removem o texto do elemento.
          </p>
          <ScrollArea className="flex-1 max-h-[50vh] pr-3">
            <div className="space-y-4 py-2">
              {textDrafts.map((row, idx) => (
                <div key={row.dataId} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {row.type} <span className="opacity-60">({row.dataId})</span>
                  </Label>
                  <Textarea
                    value={row.text}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTextDrafts((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], text: v };
                        return next;
                      });
                    }}
                    rows={3}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTextDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={saveTexts}>Aplicar textos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!imageDialog} onOpenChange={(o) => !o && setImageDialog(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Imagens — {imageDialog ? sectionLabel(imageDialog) : ''}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Pré-visualização ao lado; cole a URL ou use o banco de imagens do projeto.
          </p>
          <ScrollArea className="flex-1 max-h-[50vh] pr-3">
            <div className="space-y-4 py-2">
              {imageDrafts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma imagem (tag img) nem fundo em style (background-image) nesta seção.
                </p>
              )}
              {imageDrafts.map((row, idx) => (
                <div
                  key={`${idx}-${row.dataId}-${row.isBackground ? 'bg' : 'img'}`}
                  className="flex gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
                >
                  <ImagePreviewThumb src={row.src} isBackground={row.isBackground} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label className="text-xs">
                      {row.label || (row.isBackground ? 'Fundo' : 'Imagem')}{' '}
                      <span className="text-muted-foreground font-mono text-[10px]">({row.dataId})</span>
                    </Label>
                    <Input
                      value={row.src}
                      onChange={(e) => {
                        const v = e.target.value;
                        setImageDrafts((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], src: v };
                          return next;
                        });
                      }}
                      placeholder="https://..."
                      className="font-mono text-xs"
                    />
                    {onPickImageFromBank && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          onPickImageFromBank({
                            sectionId: imageDialog,
                            dataId: row.dataId,
                            isBackground: row.isBackground,
                          })
                        }
                      >
                        Escolher do banco de imagens
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={saveImages}>Aplicar URLs</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!videoDialog} onOpenChange={(o) => !o && setVideoDialog(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Vídeos — {videoDialog ? sectionLabel(videoDialog) : ''}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Ficheiro:</span> URL direto MP4/WebM.{' '}
            <span className="font-medium text-foreground">YouTube/Vimeo:</span> pode colar o link do browser
            (youtube.com/watch?v=…, youtu.be/…, vimeo.com/…); ao guardar convertemos para o formato de embed.
          </p>
          <ScrollArea className="flex-1 max-h-[50vh] pr-3">
            <div className="space-y-4 py-2">
              {videoDrafts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum vídeo nesta seção. Peça no chat uma secção com vídeo ou cole HTML com &lt;video&gt; ou iframe
                  YouTube/Vimeo (com data-id e data-type=&quot;video&quot;).
                </p>
              )}
              {videoDrafts.map((row, idx) => (
                <div
                  key={`${idx}-${row.dataId}-${row.kind}`}
                  className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3"
                >
                  <Label className="text-xs">
                    {row.label}{' '}
                    <span className="text-muted-foreground font-mono text-[10px]">({row.dataId})</span>
                  </Label>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {row.kind === 'iframe' ? 'Embed' : 'Vídeo nativo'}
                  </p>
                  <Input
                    value={row.src}
                    onChange={(e) => {
                      const v = e.target.value;
                      setVideoDrafts((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], src: v };
                        return next;
                      });
                    }}
                    placeholder={row.kind === 'iframe' ? 'https://www.youtube.com/embed/...' : 'https://.../video.mp4'}
                    className="font-mono text-xs"
                  />
                  {row.kind === 'video' ? (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Poster (capa)</Label>
                      <Input
                        value={row.poster || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setVideoDrafts((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], poster: v };
                            return next;
                          });
                        }}
                        placeholder="https://.../capa.jpg"
                        className="font-mono text-xs"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVideoDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={saveVideos}>Aplicar URLs</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!anchorDialog} onOpenChange={(o) => !o && setAnchorDialog(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Âncoras e links — {anchorDialog ? sectionLabel(anchorDialog) : ''}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Defina o destino de cada link: URL completa (https://…) ou uma seção da página (#section_…). Ao
            escolher uma seção abaixo, o <code className="text-[10px]">id</code> da seção é criado para o
            scroll funcionar.
          </p>
          <ScrollArea className="flex-1 max-h-[50vh] pr-3">
            <div className="space-y-4 py-2">
              {anchorDrafts.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum link (elementos a) nesta seção.</p>
              )}
              {anchorDrafts.map((row, idx) => (
                <div key={`${idx}-${row.linkId}`} className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs font-medium text-foreground">{row.label}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2" title={row.textPreview}>
                    Texto: “{row.textPreview}”
                  </p>
                  <Label className="text-xs text-muted-foreground">Destino (href)</Label>
                  <Input
                    value={row.href}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAnchorDrafts((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], href: v };
                        return next;
                      });
                    }}
                    placeholder="https://... ou #section_0"
                    className="font-mono text-xs"
                  />
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Ir para seção da página</Label>
                    <Select
                      onValueChange={(sid) => {
                        if (!sid) return;
                        setAnchorDrafts((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], href: `#${sid}` };
                          return next;
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Escolher seção (href #section_…)" />
                      </SelectTrigger>
                      <SelectContent>
                        {sectionIds.map((sid) => (
                          <SelectItem key={sid} value={sid}>
                            #{sid} — {sectionLabel(sid)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnchorDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={saveAnchors}>Aplicar links</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!refineDialog} onOpenChange={(o) => !o && setRefineDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Refinar com IA — {refineDialog ? sectionLabel(refineDialog) : ''}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Descreva o que deseja melhorar nesta seção (tom, cores, textos, layout). A IA devolverá só esta
            seção atualizada.
          </p>
          <Textarea
            value={refineInstruction}
            onChange={(e) => setRefineInstruction(e.target.value)}
            placeholder="Ex.: Deixe os botões mais destacados e o título mais curto."
            rows={5}
            className="min-h-[120px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefineDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={saveRefine} disabled={isRefining || !refineInstruction.trim()}>
              {isRefining ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Refinando…
                </>
              ) : (
                'Refinar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SiteSectionsPanel;
