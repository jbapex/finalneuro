/**
 * Utilitários para inspecionar e editar HTML do Criador de Site por data-section-id.
 */

/** Botões rápidos "Adicionar seção" no ChatPanel (id, rótulo, dica para o prompt). */
export const SITE_BUILDER_SECTIONS = [
  { id: 'hero', label: 'Hero', promptHint: 'impacto, título forte, CTA' },
  { id: 'features', label: 'Recursos', promptHint: 'grid de benefícios com ícones ou números' },
  { id: 'pricing', label: 'Preços', promptHint: 'planos ou tabela de valores' },
  { id: 'testimonials', label: 'Depoimentos', promptHint: 'citações de clientes, avatares' },
  { id: 'faq', label: 'FAQ', promptHint: 'perguntas frequentes em acordeão' },
  { id: 'cta', label: 'CTA', promptHint: 'chamada final para ação' },
  { id: 'footer', label: 'Rodapé', promptHint: 'links, contato, redes' },
  { id: 'video', label: 'Vídeo', promptHint: 'vídeo em destaque (YouTube/Vimeo ou <video> MP4), responsivo' },
];

/** Detecta iframes de YouTube/Vimeo (incl. watch, shorts, youtu.be). */
export function isVideoEmbedIframeSrc(src) {
  if (!src || typeof src !== 'string') return false;
  const s = src.toLowerCase().trim();
  return (
    /youtube\.com\//.test(s) ||
    /youtube-nocookie\.com\//.test(s) ||
    /youtu\.be\//.test(s) ||
    /player\.vimeo\.com/.test(s) ||
    /vimeo\.com\/(video\/)?\d+/.test(s)
  );
}

/**
 * Converte URLs de partilha YouTube/Vimeo para formato embed (iframe).
 * Assim o utilizador pode colar o link do browser e o preview funciona.
 */
export function normalizeMediaEmbedUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  let u;
  try {
    u = new URL(raw);
  } catch {
    try {
      u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      return raw;
    }
  }
  try {
    const host = (u.hostname || '').replace(/^www\./i, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      if (id && /^[a-zA-Z0-9_-]{4,}$/.test(id)) {
        return `https://www.youtube.com/embed/${id}`;
      }
    }

    if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'm.youtube.com') {
      const base = host.includes('nocookie') ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
      const path = u.pathname || '';
      const v = u.searchParams.get('v');
      if ((path === '/watch' || path.startsWith('/watch')) && v) {
        return `${base}/embed/${v}`;
      }
      if (path.startsWith('/shorts/')) {
        const id = path.replace(/^\/shorts\//, '').split(/[/?#]/)[0];
        if (id) return `${base}/embed/${id}`;
      }
      if (path.startsWith('/embed/')) {
        return raw.split('&')[0];
      }
    }

    if (host === 'vimeo.com' || host === 'www.vimeo.com') {
      const m = /\/(\d{6,})/.exec(u.pathname);
      if (m) return `https://player.vimeo.com/video/${m[1]}`;
    }
  } catch (_e) {
    /* ignore */
  }
  return raw;
}

export function parseSectionIds(html) {
  if (!html || typeof html !== 'string') return [];
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return Array.from(div.children).map((el, i) => el.getAttribute('data-section-id') || `section_${i}`);
}

/** Retorna o outerHTML do elemento raiz da seção ou null. */
export function getSectionOuterHtml(html, sectionId) {
  if (!html || typeof html !== 'string' || !sectionId) return null;
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  const children = Array.from(div.children);
  const section = children.find(
    (el, i) => (el.getAttribute('data-section-id') || `section_${i}`) === sectionId
  );
  return section ? section.outerHTML : null;
}

export function collectSectionTexts(html, sectionId) {
  if (!html || typeof html !== 'string') return [];
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  const children = Array.from(div.children);
  const section = children.find(
    (el, i) => (el.getAttribute('data-section-id') || `section_${i}`) === sectionId
  );
  if (!section) return [];
  const out = [];
  section.querySelectorAll('[data-id]').forEach((el) => {
    const dataId = el.getAttribute('data-id');
    if (!dataId) return;
    const type = (el.getAttribute('data-type') || '').toLowerCase();
    if (['heading', 'text', 'button'].includes(type) || el.tagName === 'A' || el.tagName === 'BUTTON') {
      out.push({
        dataId,
        type: type || 'text',
        text: el.textContent.trim(),
      });
    }
  });
  return out;
}

/** Extrai URL do primeiro background (image ou shorthand) em style inline. */
function extractInlineBackgroundUrl(style) {
  if (!style || typeof style !== 'string') return '';
  let m = style.match(/background-image:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
  if (m) return m[1].trim();
  m = style.match(/\bbackground\s*:\s*[^;]*url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
  return m ? m[1].trim() : '';
}

function hasInlineBackgroundImage(el) {
  const style = el.getAttribute('style') || '';
  if (!/url\s*\(/i.test(style)) return false;
  return /background-image\s*:/i.test(style) || /\bbackground\s*:/i.test(style);
}

/** Mesma ordem usada em collectSectionImages e applySectionImageSrc (__bg:N). */
function listBackgroundElementsInSection(section) {
  const out = [];
  if (hasInlineBackgroundImage(section)) out.push(section);
  section.querySelectorAll('*').forEach((el) => {
    if (hasInlineBackgroundImage(el)) out.push(el);
  });
  return out;
}

/**
 * Todas as imagens visíveis na seção: &lt;img&gt; (com ou sem data-id) e fundos via style inline.
 * dataId sintéticos: __img:N (N = índice entre as &lt;img&gt; da seção), __bg:N (N = índice entre elementos com background-image).
 */
export function collectSectionImages(html, sectionId) {
  if (!html || typeof html !== 'string') return [];
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  const children = Array.from(div.children);
  const section = children.find(
    (el, i) => (el.getAttribute('data-section-id') || `section_${i}`) === sectionId
  );
  if (!section) return [];
  const out = [];

  const imgs = section.querySelectorAll('img');
  imgs.forEach((img, i) => {
    const idAttr = img.getAttribute('data-id');
    const dataId = idAttr && idAttr.trim() !== '' ? idAttr.trim() : `__img:${i}`;
    const label = idAttr
      ? `Imagem (${idAttr})`
      : `Imagem ${i + 1}`;
    out.push({
      dataId,
      src: img.getAttribute('src') || '',
      isBackground: false,
      label,
    });
  });

  const bgEls = listBackgroundElementsInSection(section);
  bgEls.forEach((el, i) => {
    const src = extractInlineBackgroundUrl(el.getAttribute('style') || '');
    if (!src) return;
    const idAttr = el.getAttribute('data-id');
    const dataId = idAttr && idAttr.trim() !== '' ? idAttr.trim() : `__bg:${i}`;
    const tag = el.tagName.toLowerCase();
    const label = idAttr
      ? `Fundo (${idAttr} · ${tag})`
      : `Fundo ${i + 1} (${tag})`;
    if (!out.some((o) => o.dataId === dataId && o.isBackground)) {
      out.push({ dataId, src, isBackground: true, label });
    }
  });

  return out;
}

/** Vídeos nativos &lt;video&gt; e iframes YouTube/Vimeo na seção. */
export function collectSectionVideos(html, sectionId) {
  if (!html || typeof html !== 'string') return [];
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  const children = Array.from(div.children);
  const section = children.find(
    (el, i) => (el.getAttribute('data-section-id') || `section_${i}`) === sectionId
  );
  if (!section) return [];
  const out = [];

  section.querySelectorAll('video').forEach((video, i) => {
    let idAttr = video.getAttribute('data-id');
    const wrapper = video.closest('[data-type="video"][data-id]');
    if ((!idAttr || !idAttr.trim()) && wrapper) {
      idAttr = wrapper.getAttribute('data-id');
    }
    const dataId = idAttr && idAttr.trim() !== '' ? idAttr.trim() : `__video:${i}`;
    const src =
      video.getAttribute('src') ||
      (video.querySelector('source') && video.querySelector('source').getAttribute('src')) ||
      '';
    const poster = video.getAttribute('poster') || '';
    const label = idAttr ? `Vídeo (${idAttr})` : `Vídeo ${i + 1} (ficheiro)`;
    out.push({ dataId, kind: 'video', src: src || '', poster, label });
  });

  const embedIframes = Array.from(section.querySelectorAll('iframe')).filter((iframe) =>
    isVideoEmbedIframeSrc(iframe.getAttribute('src') || '')
  );
  embedIframes.forEach((iframe, i) => {
    let idAttr = iframe.getAttribute('data-id');
    const wrap = iframe.closest('[data-type="video"][data-id]');
    if ((!idAttr || !idAttr.trim()) && wrap) {
      idAttr = wrap.getAttribute('data-id');
    }
    const dataId = idAttr && idAttr.trim() !== '' ? idAttr.trim() : `__embed:${i}`;
    const src = iframe.getAttribute('src') || '';
    const label = idAttr ? `Embed (${idAttr})` : `YouTube/Vimeo ${i + 1}`;
    out.push({ dataId, kind: 'iframe', src, poster: '', label });
  });

  return out;
}

function findVideoInSection(section, dataId) {
  if (/^__video:\d+$/.test(String(dataId))) {
    const n = parseInt(String(dataId).replace(/^__video:/, ''), 10);
    const list = section.querySelectorAll('video');
    return list[n] || null;
  }
  if (/^__embed:\d+$/.test(String(dataId))) {
    const n = parseInt(String(dataId).replace(/^__embed:/, ''), 10);
    const list = Array.from(section.querySelectorAll('iframe')).filter((iframe) =>
      isVideoEmbedIframeSrc(iframe.getAttribute('src') || '')
    );
    return list[n] || null;
  }
  for (const node of section.querySelectorAll('[data-id]')) {
    if (node.getAttribute('data-id') !== String(dataId)) continue;
    if (node.tagName === 'VIDEO' || node.tagName === 'IFRAME') return node;
    if ((node.getAttribute('data-type') || '').toLowerCase() === 'video') {
      const inner = node.querySelector('video, iframe');
      if (inner) return inner;
    }
  }
  return null;
}

/**
 * Atualiza URLs de vídeo na seção. updates: { dataId, src, poster? }[]
 * poster aplica-se só a &lt;video&gt;; embeds iframe só recebem src.
 */
export function applySectionVideoUpdates(html, sectionId, updates) {
  if (!html || !Array.isArray(updates)) return html;
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  const children = Array.from(div.children);
  const section = children.find(
    (el, i) => (el.getAttribute('data-section-id') || `section_${i}`) === sectionId
  );
  if (!section) return html;

  updates.forEach(({ dataId, src, poster }) => {
    const el = findVideoInSection(section, dataId);
    if (!el) return;
    const url = src != null ? String(src).trim() : '';
    if (el.tagName === 'VIDEO') {
      el.removeAttribute('src');
      let source = el.querySelector('source');
      if (url) {
        if (!source) {
          source = document.createElement('source');
          el.appendChild(source);
        }
        source.setAttribute('src', url);
        const ext = url.split('?')[0].split('.').pop().toLowerCase();
        const type =
          ext === 'webm' ? 'video/webm' : ext === 'ogg' || ext === 'ogv' ? 'video/ogg' : 'video/mp4';
        source.setAttribute('type', type);
      } else if (source) {
        source.removeAttribute('src');
      }
      if (poster != null && String(poster).trim()) {
        el.setAttribute('poster', String(poster).trim());
      } else if (poster === '') {
        el.removeAttribute('poster');
      }
    } else if (el.tagName === 'IFRAME' && url) {
      el.setAttribute('src', normalizeMediaEmbedUrl(url));
    }
  });

  return children.map((c) => c.outerHTML).join('\n');
}

/** Localiza em qual seção está um data-id (ex.: clique no preview sem sectionId). */
export function findSectionIdForDataId(html, dataId) {
  if (!html || dataId == null || String(dataId).trim() === '') return null;
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  const children = Array.from(div.children);
  const idStr = String(dataId);
  for (let i = 0; i < children.length; i++) {
    const section = children[i];
    const sid = section.getAttribute('data-section-id') || `section_${i}`;
    const nodes = section.querySelectorAll('[data-id]');
    for (const node of nodes) {
      if (node.getAttribute('data-id') === idStr) return sid;
    }
  }
  return null;
}

export function applySectionTextUpdates(html, sectionId, updates) {
  if (!html || !Array.isArray(updates)) return html;
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  const children = Array.from(div.children);
  const section = children.find(
    (el, i) => (el.getAttribute('data-section-id') || `section_${i}`) === sectionId
  );
  if (!section) return html;
  updates.forEach(({ dataId, text }) => {
    const el = section.querySelector(`[data-id="${dataId}"]`);
    if (el) el.textContent = text != null ? String(text) : '';
  });
  return children.map((el) => el.outerHTML).join('\n');
}

export function applySectionImageSrc(html, sectionId, dataId, newSrc, isBackground) {
  if (!html || dataId == null || dataId === '' || newSrc == null) return html;
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  const children = Array.from(div.children);
  const section = children.find(
    (el, i) => (el.getAttribute('data-section-id') || `section_${i}`) === sectionId
  );
  if (!section) return html;
  const url = String(newSrc).trim();

  let el = null;

  if (!isBackground && /^__img:\d+$/.test(String(dataId))) {
    const n = parseInt(String(dataId).replace(/^__img:/, ''), 10);
    const imgs = section.querySelectorAll('img');
    el = imgs[n] || null;
  } else if (isBackground && /^__bg:\d+$/.test(String(dataId))) {
    const n = parseInt(String(dataId).replace(/^__bg:/, ''), 10);
    const bgEls = listBackgroundElementsInSection(section);
    el = bgEls[n] || null;
  } else {
    for (const node of section.querySelectorAll('[data-id]')) {
      if (node.getAttribute('data-id') === String(dataId)) {
        el = node;
        break;
      }
    }
  }

  if (!el) return html;

  if (isBackground) {
    let style = el.getAttribute('style') || '';
    style = style.replace(/background-image:\s*url\([^)]*\)\s*;?/gi, '').trim();
    style = style.replace(/\bbackground\s*:\s*[^;]*url\([^)]*\)[^;]*/gi, '').trim();
    style = `${style}${style && !style.endsWith(';') ? ';' : ''} background-image: url('${url.replace(/'/g, "\\'")}');`.trim();
    el.setAttribute('style', style);
  } else if (el.tagName === 'IMG') {
    el.setAttribute('src', url);
  }
  return children.map((c) => c.outerHTML).join('\n');
}

/**
 * Links &lt;a href&gt; na seção (ordem do documento).
 * linkId: data-id ou __a:N (N = índice entre &lt;a&gt; da seção).
 */
export function collectSectionLinks(html, sectionId) {
  if (!html || typeof html !== 'string') return [];
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  const children = Array.from(div.children);
  const section = children.find(
    (el, i) => (el.getAttribute('data-section-id') || `section_${i}`) === sectionId
  );
  if (!section) return [];
  const anchors = section.querySelectorAll('a');
  const out = [];
  anchors.forEach((a, i) => {
    const idAttr = a.getAttribute('data-id');
    const linkId = idAttr && idAttr.trim() !== '' ? idAttr.trim() : `__a:${i}`;
    const href = a.getAttribute('href') || '';
    const textPreview = (a.textContent || '').trim().slice(0, 80) || '(sem texto)';
    const label = idAttr ? `Link (${idAttr})` : `Link ${i + 1}`;
    out.push({ linkId, href, textPreview, label });
  });
  return out;
}

function findAnchorInSection(section, linkId) {
  if (/^__a:\d+$/.test(String(linkId))) {
    const n = parseInt(String(linkId).replace(/^__a:/, ''), 10);
    const anchors = section.querySelectorAll('a');
    return anchors[n] || null;
  }
  for (const node of section.querySelectorAll('a')) {
    if (node.getAttribute('data-id') === String(linkId)) return node;
  }
  return null;
}

/** Garante id no &lt;section&gt; alvo para âncoras #section_N funcionarem no scroll. */
function ensureSectionIdsForAnchors(children, hrefs) {
  const need = new Set();
  (hrefs || []).forEach((h) => {
    const m = /^#(section_\d+)$/i.exec(String(h || '').trim());
    if (m) need.add(m[1]);
  });
  if (need.size === 0) return;
  children.forEach((el, i) => {
    const sid = el.getAttribute('data-section-id') || `section_${i}`;
    if (need.has(sid) && !el.getAttribute('id')) {
      el.setAttribute('id', sid);
    }
  });
}

/**
 * Atualiza href dos links na seção. updates: { linkId, href }[]
 */
export function applySectionLinkUpdates(html, sectionId, updates) {
  if (!html || !Array.isArray(updates)) return html;
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  const children = Array.from(div.children);
  const section = children.find(
    (el, i) => (el.getAttribute('data-section-id') || `section_${i}`) === sectionId
  );
  if (!section) return html;
  updates.forEach(({ linkId, href }) => {
    const a = findAnchorInSection(section, linkId);
    if (!a) return;
    const h = href != null ? String(href).trim() : '';
    a.setAttribute('href', h || '#');
  });
  ensureSectionIdsForAnchors(
    children,
    updates.map((u) => u.href)
  );
  return children.map((el) => el.outerHTML).join('\n');
}
