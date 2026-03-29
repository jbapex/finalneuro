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
import { Type, Image as ImageIcon, Wand2, Loader2 } from 'lucide-react';
import {
  collectSectionTexts,
  collectSectionImages,
  applySectionTextUpdates,
  applySectionImageSrc,
  parseSectionIds,
} from '@/lib/siteBuilderSections';

const sectionLabel = (id) => id.replace(/^section_/, 'Seção ');

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

  const [refineDialog, setRefineDialog] = useState(null); // sectionId
  const [refineInstruction, setRefineInstruction] = useState('');

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

  const saveRefine = useCallback(async () => {
    if (!refineDialog || !refineInstruction.trim()) return;
    await onRefineSection(refineDialog, refineInstruction.trim());
    setRefineDialog(null);
    setRefineInstruction('');
  }, [refineDialog, refineInstruction, onRefineSection]);

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
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Imagens — {imageDialog ? sectionLabel(imageDialog) : ''}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Cole a URL da imagem ou use o banco de imagens do projeto.
          </p>
          <ScrollArea className="flex-1 max-h-[50vh] pr-3">
            <div className="space-y-4 py-2">
              {imageDrafts.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma imagem com data-id nesta seção.</p>
              )}
              {imageDrafts.map((row, idx) => (
                <div key={`${row.dataId}-${row.isBackground ? 'bg' : 'img'}`} className="space-y-2">
                  <Label className="text-xs">
                    {row.isBackground ? 'Imagem de fundo' : 'Imagem'}{' '}
                    <span className="text-muted-foreground">({row.dataId})</span>
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
