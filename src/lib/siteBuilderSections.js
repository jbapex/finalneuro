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
];

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
  section.querySelectorAll('img[data-id]').forEach((img) => {
    out.push({
      dataId: img.getAttribute('data-id'),
      src: img.getAttribute('src') || '',
      isBackground: false,
    });
  });
  section.querySelectorAll('[data-id]').forEach((el) => {
    if (el.tagName !== 'DIV') return;
    const style = el.getAttribute('style') || '';
    const m = style.match(/background-image:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
    if (m) {
      const id = el.getAttribute('data-id');
      if (id && !out.some((o) => o.dataId === id && o.isBackground)) {
        out.push({ dataId: id, src: m[1].trim(), isBackground: true });
      }
    }
  });
  return out;
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
  if (!html || !dataId || newSrc == null) return html;
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  const children = Array.from(div.children);
  const section = children.find(
    (el, i) => (el.getAttribute('data-section-id') || `section_${i}`) === sectionId
  );
  if (!section) return html;
  const el = section.querySelector(`[data-id="${dataId}"]`);
  if (!el) return html;
  const url = String(newSrc).trim();
  if (isBackground) {
    let style = el.getAttribute('style') || '';
    style = style.replace(/background-image:\s*url\([^)]*\)\s*;?/gi, '').trim();
    style = `${style}${style && !style.endsWith(';') ? ';' : ''} background-image: url('${url.replace(/'/g, "\\'")}');`.trim();
    el.setAttribute('style', style);
  } else if (el.tagName === 'IMG') {
    el.setAttribute('src', url);
  }
  return children.map((c) => c.outerHTML).join('\n');
}
