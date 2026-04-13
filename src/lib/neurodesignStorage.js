import { supabase } from '@/lib/customSupabaseClient';
import { v4 as uuidv4 } from 'uuid';

const BUCKET = 'neurodesign';
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

const REFINE_UPLOAD_TYPES = new Set([
  'refine_ref',
  'refine_replacement',
  'refine_crop',
  'refine_add',
  'refine_source',
]);

function stripImageBaseName(name) {
  const n = String(name || 'image').replace(/\.[^/.]+$/, '');
  return n || 'image';
}

/**
 * Comprime antes do upload. Refinos: até 4096px; tenta PNG (sem artefatos JPEG) até 8MB, senão JPEG 98%.
 */
async function compressImage(file, { highFidelity = false } = {}) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      const maxDim = highFidelity ? 4096 : 1024;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const base = stripImageBaseName(file.name);
      const maxPngBytes = 8 * 1024 * 1024;

      const asJpeg = (quality) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(
                new File([blob], `${base}.jpg`, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                })
              );
            } else resolve(file);
          },
          'image/jpeg',
          quality
        );
      };

      if (highFidelity) {
        canvas.toBlob((blob) => {
          if (blob && blob.size <= maxPngBytes) {
            resolve(
              new File([blob], `${base}.png`, {
                type: 'image/png',
                lastModified: Date.now(),
              })
            );
          } else {
            asJpeg(0.98);
          }
        }, 'image/png');
      } else {
        asJpeg(0.8);
      }
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

/**
 * Upload de arquivo para o bucket neurodesign.
 * @param {string} userId - auth user id
 * @param {string} projectId - neurodesign project id
 * @param {'subject'|'scenario'|'style_refs'|'logo'|'wizard_ref'|'refine_ref'|'refine_replacement'|'refine_crop'|'refine_add'} type - pasta do tipo
 * @param {File} file
 * @returns {Promise<string>} URL pública
 */
export async function uploadNeuroDesignFile(userId, projectId, type, file) {
  if (!file || !userId || !projectId) {
    throw new Error('userId, projectId e file são obrigatórios');
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('Arquivo muito grande. Máximo 10MB.');
  }
  
  const highFidelity = REFINE_UPLOAD_TYPES.has(type);
  const fileToUpload =
    file.type.startsWith('image/') && file.type !== 'image/gif'
      ? await compressImage(file, { highFidelity })
      : file;
    
  const ext = (fileToUpload.name.split('.').pop() || 'png').toLowerCase();
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  const hasAllowedType = ALLOWED_TYPES.includes(fileToUpload.type) || (fileToUpload.type === '' && allowedExtensions.includes(ext));
  if (!hasAllowedType) {
    throw new Error('Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF.');
  }
  const fileName = `${uuidv4()}.${ext}`;
  const filePath = `${userId}/projects/${projectId}/${type}/${fileName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(filePath, fileToUpload, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return publicUrl;
}
