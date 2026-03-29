import { useEffect, useRef } from 'react';
import { getImageExpiryMeta } from '@/lib/neurodesign/imageExpiry';
import { deleteNeurodesignGeneratedImageClient } from '@/lib/neurodesign/deleteGeneratedImageClient';

const INTERVAL_MS = 20000;

/**
 * Remove do banco (e tenta remover do Storage) imagens cuja retenção de ~1h já passou.
 * Evita duplicar apagamentos com um Set de ids já tratados nesta sessão.
 */
export function useNeurodesignExpiredCleanup({ enabled, images, setImages, setSelectedImage }) {
  const imagesRef = useRef(images);
  const handledRef = useRef(new Set());

  imagesRef.current = images;

  useEffect(() => {
    if (!enabled) return undefined;

    const run = async () => {
      const now = Date.now();
      const list = imagesRef.current || [];
      for (const img of list) {
        if (!img?.id || String(img.id).startsWith('temp-')) continue;
        const createdAt = img.created_at;
        if (!createdAt) continue;
        if (handledRef.current.has(img.id)) continue;
        const meta = getImageExpiryMeta(createdAt, now);
        if (!meta?.isExpired) continue;

        handledRef.current.add(img.id);
        const result = await deleteNeurodesignGeneratedImageClient(img);
        if (!result.ok) {
          handledRef.current.delete(img.id);
          continue;
        }

        setImages((prev) => prev.filter((i) => i.id !== img.id));
        if (typeof setSelectedImage === 'function') {
          setSelectedImage((sel) => (sel?.id === img.id ? null : sel));
        }
      }
    };

    const id = window.setInterval(run, INTERVAL_MS);
    run();
    return () => window.clearInterval(id);
  }, [enabled, setImages, setSelectedImage]);
}
