import { supabase } from '@/lib/customSupabaseClient';
import { v4 as uuidv4 } from 'uuid';

const BUCKET = 'neurodesign';
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Comprime a imagem no lado do cliente antes do upload.
 * Reduz a resolução máxima para 1024x1024 e a qualidade para 80%.
 */
async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      
      const maxDim = 1024;
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
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file); // Fallback to original
          }
        },
        'image/jpeg',
        0.8
      );
    };
    img.onerror = () => resolve(file); // Fallback to original on error
    img.src = url;
  });
}

/**
 * Upload de arquivo para o bucket neurodesign.
 * @param {string} userId - auth user id
 * @param {string} projectId - neurodesign project id
 * @param {'subject'|'scenario'|'style_refs'|'logo'|'refine_ref'|'refine_replacement'|'refine_crop'|'refine_add'} type - pasta do tipo
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
  
  // Comprimir a imagem antes de subir para evitar estourar a memória da Edge Function
  const fileToUpload = file.type.startsWith('image/') && file.type !== 'image/gif' 
    ? await compressImage(file) 
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
