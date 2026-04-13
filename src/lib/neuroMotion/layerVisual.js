/** Sanitização partilhada: fill (hex / rgba / gradientes CSS seguros). */
export function sanitizeLayerFill(raw) {
  const s = String(raw ?? '#ffffff').trim();
  if (!s) return '#ffffff';
  if (/url\s*\(|expression\s*\(|javascript:|[;{}]/i.test(s)) return '#ffffff';
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (s.length > 400) return '#ffffff';
  if (/^(linear-gradient|radial-gradient)\s*\(/i.test(s)) {
    if (/^[\w#%(),.\s+\-/deg]+$/i.test(s)) return s;
    return '#ffffff';
  }
  if (/^rgba?\s*\(/i.test(s) && s.length <= 140 && /^rgba?\([^)]*\)$/i.test(s)) {
    if (!/[;{}]/.test(s)) return s;
  }
  return '#ffffff';
}

export function sanitizeLayerBoxShadow(raw) {
  const s = String(raw ?? '').trim().slice(0, 280);
  if (!s) return '';
  if (/url\s*\(|expression|javascript:|[;{}]/i.test(s)) return '';
  if (!/^[\w#%(),.\s+\-pxdeg°0-9]+$/i.test(s)) return '';
  return s;
}

const BLEND_MODES = new Set([
  'normal',
  'multiply',
  'screen',
  'overlay',
  'soft-light',
  'hard-light',
  'plus-lighter',
  'color-dodge',
]);

export function sanitizeLayerBlendMode(raw) {
  const v = String(raw ?? 'normal')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  return BLEND_MODES.has(v) ? v : 'normal';
}

export function isGradientFill(fill) {
  return /^(linear-gradient|radial-gradient)\s*\(/i.test(String(fill || '').trim());
}

/** URL https para <Img> em layer type image. */
export function sanitizeLayerImageUrl(raw) {
  const s = String(raw ?? '').trim().slice(0, 2048);
  if (!s || !/^https:\/\//i.test(s)) return '';
  if (/javascript:/i.test(s)) return '';
  if (/\s/.test(s)) return '';
  return s;
}
