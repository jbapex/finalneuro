/**
 * Aplica cores de fundo e texto ao elemento raiz do HTML do módulo.
 * @param {string} html - HTML do módulo
 * @param {string} [backgroundColor] - Cor de fundo (hex)
 * @param {string} [textColor] - Cor do texto (hex)
 * @returns {string} HTML com style injetado no primeiro elemento
 */
export function applyModuleColors(html, backgroundColor, textColor) {
  if (!backgroundColor && !textColor) return html || '';
  if (typeof document === 'undefined') return html || '';
  const div = document.createElement('div');
  div.innerHTML = (html || '').trim();
  const first = div.firstElementChild;
  if (!first) return html || '';
  const existing = first.getAttribute('style') || '';
  const parts = [];
  if (backgroundColor) parts.push(`background-color: ${backgroundColor}`);
  if (textColor) parts.push(`color: ${textColor}`);
  const newStyle = existing ? `${existing}; ${parts.join('; ')}` : parts.join('; ');
  first.setAttribute('style', newStyle);
  return div.innerHTML;
}
