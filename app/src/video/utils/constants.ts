export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;
export const FPS = 30;
export const DURATION_IN_SECONDS = 120;
export const TOTAL_FRAMES = FPS * DURATION_IN_SECONDS;

export const SCENES = {
  BRAND_INTRO: { start: 0, duration: 8 * FPS },
  PROBLEM: { start: 8 * FPS, duration: 8 * FPS },
  DASHBOARD: { start: 16 * FPS, duration: 12 * FPS },
  AI_GENERATION: { start: 28 * FPS, duration: 30 * FPS },
  AMBIENT: { start: 58 * FPS, duration: 34 * FPS },
  MONTAGE: { start: 92 * FPS, duration: 16 * FPS },
  CLOSING: { start: 108 * FPS, duration: 12 * FPS },
} as const;
