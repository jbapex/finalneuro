/**
 * Redimensiona e comprime imagem no browser para visão (data URL) + upload mais leve.
 * @param {File} file
 * @param {{ maxSide?: number, quality?: number, highFidelity?: boolean }} opts — `highFidelity` preserva mais detalhe de texto na referência (UI/dashboard).
 * @returns {Promise<{ dataUrl: string, blob: Blob }>}
 */
export async function compressImageToJpegDataUrl(file, opts = {}) {
  const maxSide = opts.maxSide ?? (opts.highFidelity ? 2048 : 1280);
  const quality = opts.quality ?? (opts.highFidelity ? 0.9 : 0.82);

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const u = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(u);
        try {
          resolve(drawToJpeg(img, img.naturalWidth, img.naturalHeight, maxSide, quality));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(u);
        reject(new Error('Imagem inválida'));
      };
      img.src = u;
    });
  }

  try {
    return drawToJpeg(bitmap, bitmap.width, bitmap.height, maxSide, quality);
  } finally {
    bitmap.close();
  }
}

function drawToJpeg(source, w, h, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(w, h, 1));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas não disponível');
  ctx.drawImage(source, 0, 0, tw, th);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Falha ao comprimir'));
          return;
        }
        const r = new FileReader();
        r.onload = () => resolve({ dataUrl: String(r.result), blob });
        r.onerror = () => reject(new Error('Leitura falhou'));
        r.readAsDataURL(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

/** Garante imageUrl https na primeira cena quando o utilizador enviou referência. */
export function mergeReferenceImageIntoSanitized(sanitized, httpsUrl) {
  if (!sanitized?.scenesData?.length || !httpsUrl || !/^https:\/\//i.test(httpsUrl)) return sanitized;
  const scenesData = sanitized.scenesData.map((scene, i) => {
    if (i !== 0) return scene;
    const has = String(scene.imageUrl || '').trim().startsWith('https://');
    if (has) return scene;
    return { ...scene, imageUrl: httpsUrl };
  });
  return { ...sanitized, scenesData };
}
