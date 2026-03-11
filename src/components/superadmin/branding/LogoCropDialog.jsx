import React, { useEffect, useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Utilitário para carregar imagem em um elemento HTMLImageElement
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

async function getCroppedImage(file, imageSrc, croppedAreaPixels) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const { width, height, x, y } = croppedAreaPixels;
  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(image, x, y, width, height, 0, 0, width, height);

  const mimeType = file?.type && file.type.startsWith('image/') ? file.type : 'image/png';

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Falha ao gerar recorte da imagem.'));
          return;
        }
        const croppedFile = new File([blob], file?.name || 'logo_cortada.png', { type: mimeType });
        resolve(croppedFile);
      },
      mimeType,
      0.95
    );
  });
}

/**
 * Modal de recorte da logo do sistema.
 * Permite recortar em formato de faixa horizontal antes de enviar ao Storage.
 */
export default function LogoCropDialog({ open, onClose, file, variant, onCropped }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.2);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setImageUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const onCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleCancel = () => {
    if (saving) return;
    onClose?.();
  };

  const handleConfirm = async () => {
    if (!file || !imageUrl || !croppedAreaPixels) {
      onClose?.();
      return;
    }
    try {
      setSaving(true);
      const croppedFile = await getCroppedImage(file, imageUrl, croppedAreaPixels);
      await onCropped?.(croppedFile);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Recortar logo do sistema</DialogTitle>
          <DialogDescription>
            Ajuste o enquadramento da logo no formato de faixa horizontal. Essa versão será usada no topo do menu e na tela de login.
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full h-[240px] bg-muted rounded-md overflow-hidden">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={4 / 1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid={false}
              restrictPosition
            />
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Zoom</span>
          <input
            type="range"
            min={0.8}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="ghost" onClick={handleCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Salvando recorte...' : 'Salvar recorte'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

