import { v4 as uuidv4 } from 'uuid';

export const CHAT_ATTACH_MAX_FILES = 6;
export const CHAT_ATTACH_MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export const CHAT_ATTACH_MAX_TEXT_FILE_BYTES = 1.5 * 1024 * 1024;
export const CHAT_ATTACH_MAX_TEXT_CHARS_PER_FILE = 80_000;
/** PDF enviado como ficheiro para o modelo (base64); evitar corpos JSON gigantes */
export const CHAT_ATTACH_MAX_PDF_BYTES = 5 * 1024 * 1024;

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'csv',
  'json',
  'xml',
  'html',
  'htm',
  'css',
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'sql',
  'yaml',
  'yml',
  'log',
  'env',
  'sh',
  'bash',
]);

function extOf(name) {
  const i = String(name || '').lastIndexOf('.');
  return i >= 0 ? String(name).slice(i + 1).toLowerCase() : '';
}

/** @param {File} file */
export function classifyChatAttachment(file) {
  const mime = (file.type || '').toLowerCase();
  const ext = extOf(file.name);

  if (IMAGE_MIME.has(mime) || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return 'image';
  }
  if (mime === 'application/pdf' || mime === 'application/x-pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    mime === 'application/javascript' ||
    mime === 'text/csv' ||
    TEXT_EXTENSIONS.has(ext)
  ) {
    return 'text';
  }
  return 'unsupported';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error || new Error('Falha ao ler arquivo'));
    r.readAsDataURL(file);
  });
}

function readFileAsUtf8(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error || new Error('Falha ao ler arquivo'));
    r.readAsText(file, 'UTF-8');
  });
}

/**
 * Monta partes para a API: texto (ficheiros .txt etc.), PDF como input_file (modelo processa),
 * imagens como image_url.
 */
export async function buildAttachmentPartsForApi(files) {
  const errors = [];
  const textBlocks = [];
  const pdfParts = [];
  const imageParts = [];

  for (const file of files) {
    const kind = classifyChatAttachment(file);
    try {
      if (kind === 'unsupported') {
        errors.push(`${file.name}: formato não suportado (use texto, PDF, imagens ou código).`);
        continue;
      }
      if (kind === 'image') {
        if (file.size > CHAT_ATTACH_MAX_IMAGE_BYTES) {
          errors.push(`${file.name}: imagem muito grande (máx. ${Math.round(CHAT_ATTACH_MAX_IMAGE_BYTES / (1024 * 1024))} MB).`);
          continue;
        }
        const dataUrl = await readFileAsDataUrl(file);
        imageParts.push({
          type: 'image_url',
          image_url: { url: dataUrl },
        });
        continue;
      }
      if (kind === 'text') {
        if (file.size > CHAT_ATTACH_MAX_TEXT_FILE_BYTES) {
          errors.push(`${file.name}: arquivo de texto muito grande.`);
          continue;
        }
        let body = await readFileAsUtf8(file);
        if (body.length > CHAT_ATTACH_MAX_TEXT_CHARS_PER_FILE) {
          body = `${body.slice(0, CHAT_ATTACH_MAX_TEXT_CHARS_PER_FILE)}\n\n[… truncado]`;
        }
        textBlocks.push(`### ${file.name}\n${body}`);
        continue;
      }
      if (kind === 'pdf') {
        if (file.size > CHAT_ATTACH_MAX_PDF_BYTES) {
          errors.push(
            `${file.name}: PDF acima de ${Math.round(CHAT_ATTACH_MAX_PDF_BYTES / (1024 * 1024))} MB. Reduza ou divida o ficheiro.`
          );
          continue;
        }
        const file_data = await readFileAsDataUrl(file);
        pdfParts.push({
          type: 'input_file',
          filename: file.name || 'documento.pdf',
          file_data,
        });
        continue;
      }
    } catch (e) {
      errors.push(`${file.name}: ${e?.message || 'erro ao processar'}`);
    }
  }

  return { errors, textBlocks, pdfParts, imageParts };
}

/**
 * @param {File[]} files
 * @returns {Promise<{ content: object|string|null, errors: string[] }>}
 * Com ficheiros: content = { v: 2, text, files: [{name,size,kind}], apiParts } para UI + API.
 */
export async function buildUserContentForApi(trimmedText, files) {
  const userLines = (trimmedText || '').trim();
  const filesMeta = (files || []).map((f) => ({
    name: f.name,
    size: f.size,
    kind: classifyChatAttachment(f),
  }));

  if (!files?.length) {
    return { content: userLines || null, errors: [] };
  }

  const { errors, textBlocks, pdfParts, imageParts } = await buildAttachmentPartsForApi(files);

  if (errors.length && !textBlocks.length && !pdfParts.length && !imageParts.length) {
    return { content: null, errors };
  }

  const textFromFiles =
    textBlocks.length > 0
      ? 'Conteúdo de ficheiros de texto anexados:\n\n' + textBlocks.join('\n\n---\n\n')
      : '';

  let mainText = userLines;
  if (textFromFiles) {
    mainText = mainText ? `${mainText}\n\n${textFromFiles}` : textFromFiles;
  }
  if (!mainText) {
    if (pdfParts.length && !imageParts.length) {
      mainText = 'Analise o documento PDF anexado e responda de forma clara e útil.';
    } else if (imageParts.length && !pdfParts.length) {
      mainText = 'Analise as imagens anexadas e responda de forma clara e útil.';
    } else {
      mainText = 'Analise os anexos e responda de forma clara e útil.';
    }
  }

  const apiParts = [];
  apiParts.push({ type: 'text', text: mainText });
  apiParts.push(...pdfParts);
  apiParts.push(...imageParts);

  const display = {
    v: 2,
    text: userLines,
    files: filesMeta,
    apiParts,
  };

  return { content: display, errors };
}

/** Persistência: remove apiParts (base64) do JSON da sessão */
export function sanitizeMessagesForDb(messages) {
  if (!Array.isArray(messages)) return messages;
  return messages.map((m) => {
    if (m.role !== 'user') return m;
    const c = m.content;
    if (c && typeof c === 'object' && c.v === 2 && Array.isArray(c.apiParts)) {
      const { apiParts: _drop, ...rest } = c;
      return { ...m, content: rest };
    }
    if (!Array.isArray(c)) return m;
    const textParts = [];
    let imageCount = 0;
    let pdfCount = 0;
    for (const p of c) {
      if (p?.type === 'text' && typeof p.text === 'string') textParts.push(p.text);
      if (p?.type === 'image_url') imageCount += 1;
      if (p?.type === 'input_file') pdfCount += 1;
    }
    return {
      ...m,
      content: {
        type: 'chat_user_v2',
        text: textParts.join('\n\n').trim(),
        hadImages: imageCount > 0,
        imageCount,
        hadPdfs: pdfCount > 0,
        pdfCount,
      },
    };
  });
}

/** API: monta payload user para o histórico ou envio */
export function userContentToApiPayload(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object' && content.v === 2 && Array.isArray(content.apiParts)) {
    return content.apiParts;
  }
  if (typeof content === 'object' && content.v === 2) {
    let t = (content.text || '').trim();
    const files = content.files || [];
    const pdfN = files.filter((f) => f.kind === 'pdf').length;
    const imgN = files.filter((f) => f.kind === 'image').length;
    if (pdfN)
      t += `\n\n[Nota: nesta mensagem havia ${pdfN} PDF(s) anexado(s); o ficheiro não está no histórico guardado — peça ao utilizador que reenvie se precisar do documento.]`;
    if (imgN)
      t += `\n\n[Nota: ${imgN} imagem(ns) anexada(s) não estão no histórico salvo.]`;
    return t.trim();
  }
  if (typeof content === 'object' && content.type === 'chat_user_v2') {
    let t = (content.text || '').trim();
    if (content.hadImages && content.imageCount > 0) {
      t += `\n\n[Nota: nesta mensagem o usuário havia anexado ${content.imageCount} imagem(ns); o conteúdo visual não está mais no histórico salvo.]`;
    }
    if (content.hadPdfs && content.pdfCount > 0) {
      t += `\n\n[Nota: ${content.pdfCount} PDF(s) anexado(s) não estão no histórico salvo.]`;
    }
    return t.trim();
  }
  if (Array.isArray(content)) return content;
  if (typeof content === 'object' && content.text != null) return String(content.text);
  return String(content);
}

export function makePendingAttachment(file) {
  return { id: uuidv4(), file };
}
