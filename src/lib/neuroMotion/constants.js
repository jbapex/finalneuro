/** Alinhado com src/remotion/entry.jsx e com o worker de render. */
export const NEURO_MOTION_COMPOSITION_ID = 'NeuroMotionMain';
export const NEURO_MOTION_DURATION_FRAMES = 180;
export const NEURO_MOTION_FPS = 30;
export const NEURO_MOTION_WIDTH = 1280;
export const NEURO_MOTION_HEIGHT = 720;

export const NEURO_MOTION_FORMAT_PRESETS = {
  youtube: { id: 'youtube', label: 'YouTube 16:9', width: 1280, height: 720 },
  story: { id: 'story', label: 'Story 9:16', width: 1080, height: 1920 },
  reel: { id: 'reel', label: 'Reel 9:16', width: 1080, height: 1920 },
  square: { id: 'square', label: 'Quadrado 1:1', width: 1080, height: 1080 },
};

export const NEURO_MOTION_TRANSITIONS = ['none', 'fade', 'slide'];
