import type { RenderMode, RenderConfig } from '../../../types/documentation';
import { DEFAULT_RENDER_SETTINGS } from '../../../types/documentation';

export function buildRenderConfigForMode(mode: RenderMode): RenderConfig {
  const base = DEFAULT_RENDER_SETTINGS;

  switch (mode) {
    case 'quick_preview':
      return {
        video: { width: 1280, height: 720, fps: 24, codec: 'h264' },
        captions: { enabled: false, format: 'srt', font_size: 20, position: 'bottom' },
        callouts: { enabled: false, style: 'rounded', animation: 'none' },
        transitions: { type: 'cut', duration_ms: 0 },
      };

    case 'detailed_walkthrough':
      return {
        video: { width: 1920, height: 1080, fps: 30, codec: 'h264' },
        captions: { enabled: true, format: 'vtt', font_size: 22, position: 'bottom' },
        callouts: { enabled: true, style: 'pill', animation: 'slide', default_duration_ms: 4000 },
        transitions: { type: 'crossfade', duration_ms: 600 },
      };

    case 'standard_training':
    default:
      return {
        video: { ...base.default_video_config },
        captions: { ...base.default_caption_config },
        callouts: { ...base.default_callout_config },
        transitions: { ...base.default_transition_config },
      };
  }
}

export function estimateDurationMs(sceneCount: number, mode: RenderMode): number {
  const perSceneSeconds: Record<RenderMode, number> = {
    quick_preview: 8,
    standard_training: 15,
    detailed_walkthrough: 25,
  };
  return sceneCount * perSceneSeconds[mode] * 1000;
}

export function getModeScenePacingMs(mode: RenderMode): number {
  const pacing: Record<RenderMode, number> = {
    quick_preview: 5000,
    standard_training: 12000,
    detailed_walkthrough: 20000,
  };
  return pacing[mode];
}
