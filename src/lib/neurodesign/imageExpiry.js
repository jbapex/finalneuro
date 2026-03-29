/** Alinhado ao cleanup em neurodesign-generate* / church-art-generate* (~1h após created_at). */
export const NEURODESIGN_IMAGE_RETENTION_MS = 60 * 60 * 1000;

/**
 * @param {string | undefined} createdAt ISO do banco ou marca gravada no nó
 * @param {number} nowMs
 * @returns {{ text: string, isExpired: boolean, isSoon: boolean } | null}
 */
export function getImageExpiryMeta(createdAt, nowMs = Date.now()) {
  if (!createdAt) return null;
  const createdMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdMs)) return null;
  const expiresAtMs = createdMs + NEURODESIGN_IMAGE_RETENTION_MS;
  const remainingMs = expiresAtMs - nowMs;

  if (remainingMs <= 0) {
    return { text: 'Expirado', isExpired: true, isSoon: true };
  }

  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  const text = `${mm}:${String(ss).padStart(2, '0')}`;
  return {
    text,
    isExpired: false,
    isSoon: remainingMs <= 5 * 60 * 1000,
  };
}
