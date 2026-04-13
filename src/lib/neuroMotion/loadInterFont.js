import { loadFont } from '@remotion/google-fonts/Inter';

/**
 * Inter via woff2 embutido no render Remotion.
 * Sem isto, Chromium headless não tem Inter instalada → título/subtítulo e layers `type:text` aparecem como quadrados.
 */
export const neuromotionInter = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800', '900'],
  subsets: ['latin', 'latin-ext'],
});

export const neuromotionFontFamily = `${neuromotionInter.fontFamily}, system-ui, "Segoe UI", "Liberation Sans", sans-serif`;
