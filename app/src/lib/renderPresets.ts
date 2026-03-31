import type { RenderMode } from '../types/documentation';
import type { TutorialFactoryOptions } from './tutorialFactoryOrchestrator';
import type { RenderEngineProvider } from '../types/documentation';

// ─── Preset Definition ────────────────────────────────────────────────────────

export interface AdaptivePreset {
  mode: RenderMode;
  label: string;
  tagline: string;
  description: string;
  estimatedTime: string;
  outputSizeRange: string;
  accentColor: 'amber' | 'teal' | 'blue';
  features: string[];
  limitations: string[];
  outputResolution: '720p' | '1080p' | '4k';
  frameRate: 24 | 30 | 60;
  captionMode: 'auto' | 'none' | 'burn_in';
  includeOverlays: boolean;
  settingsSnapshot: Record<string, unknown>;
}

// ─── Preset Definitions ───────────────────────────────────────────────────────

export const ADAPTIVE_PRESETS: AdaptivePreset[] = [
  {
    mode: 'quick_preview',
    label: 'Quick Preview',
    tagline: 'Fast draft review',
    description: 'Low-resolution encode optimized for internal review. No captions or overlays — pure speed.',
    estimatedTime: '1–2 min',
    outputSizeRange: '20–60 MB',
    accentColor: 'amber',
    features: [
      '720p resolution',
      '15 fps (lightweight)',
      'Cut transitions (instant)',
      'No wait — fastest possible',
    ],
    limitations: [
      'No captions',
      'No screenshot callouts',
      'Not suitable for learner delivery',
    ],
    outputResolution: '720p',
    frameRate: 24,
    captionMode: 'none',
    includeOverlays: false,
    settingsSnapshot: {
      video: { width: 1280, height: 720, fps: 15, bitrate: 1500, codec: 'h264' },
      captions: { enabled: false, burn_in: false, external_srt: false },
      callouts: { enabled: false },
      transitions: { type: 'cut', duration_ms: 0 },
      overlays: { include_screenshot_overlays: false, include_narration_sync: false },
      quality: 'low',
    },
  },
  {
    mode: 'standard_training',
    label: 'Standard Training',
    tagline: 'Balanced quality & speed',
    description: 'Full HD with external SRT captions and callout overlays — ideal for LMS upload and staff training.',
    estimatedTime: '3–5 min',
    outputSizeRange: '80–200 MB',
    accentColor: 'teal',
    features: [
      '1080p Full HD',
      '30 fps (smooth)',
      'External SRT captions',
      'UI callout overlays',
      'Crossfade transitions',
      'Narration sync',
    ],
    limitations: [
      'Captions require separate SRT file',
    ],
    outputResolution: '1080p',
    frameRate: 30,
    captionMode: 'auto',
    includeOverlays: true,
    settingsSnapshot: {
      video: { width: 1920, height: 1080, fps: 30, bitrate: 4000, codec: 'h264' },
      captions: { enabled: true, burn_in: false, external_srt: true },
      callouts: { enabled: true, style: 'fade', duration_ms: 3000 },
      transitions: { type: 'crossfade', duration_ms: 400 },
      overlays: { include_screenshot_overlays: true, include_narration_sync: true },
      quality: 'high',
    },
  },
  {
    mode: 'detailed_walkthrough',
    label: 'Detailed Walkthrough',
    tagline: 'Full-fidelity delivery',
    description: 'Max quality with burned-in captions and rich overlays — ready for self-paced or patient-facing delivery.',
    estimatedTime: '8–12 min',
    outputSizeRange: '200–600 MB',
    accentColor: 'blue',
    features: [
      '1080p Full HD',
      '30 fps',
      'Burned-in captions',
      'Rich callout overlays',
      'Smooth fade transitions',
      'Full narration sync',
      'Accessibility-ready',
    ],
    limitations: [
      'Longest encode time',
      'Larger file size',
    ],
    outputResolution: '1080p',
    frameRate: 30,
    captionMode: 'burn_in',
    includeOverlays: true,
    settingsSnapshot: {
      video: { width: 1920, height: 1080, fps: 30, bitrate: 8000, codec: 'h264' },
      captions: { enabled: true, burn_in: true, external_srt: false },
      callouts: { enabled: true, style: 'pop', duration_ms: 4500 },
      transitions: { type: 'fade', duration_ms: 600 },
      overlays: { include_screenshot_overlays: true, include_narration_sync: true },
      quality: 'max',
    },
  },
];

// ─── Lookup Helpers ───────────────────────────────────────────────────────────

export function getPresetByMode(mode: RenderMode): AdaptivePreset {
  return ADAPTIVE_PRESETS.find(p => p.mode === mode) ?? ADAPTIVE_PRESETS[1];
}

export function buildPresetFactoryOptions(
  preset: AdaptivePreset,
  engine: RenderEngineProvider,
  draftId: string,
  organizationId: string,
  callbacks?: {
    onStageStart?: TutorialFactoryOptions['onStageStart'];
    onStageComplete?: TutorialFactoryOptions['onStageComplete'];
  },
): TutorialFactoryOptions {
  return {
    draftId,
    organizationId,
    engineProvider: engine,
    renderMode: preset.mode,
    captionMode: preset.captionMode,
    includeOverlays: preset.includeOverlays,
    includeBurnInCaptions: preset.captionMode === 'burn_in',
    includeExternalSubtitles: preset.captionMode === 'auto',
    outputResolution: preset.outputResolution,
    frameRate: preset.frameRate,
    onStageStart: callbacks?.onStageStart,
    onStageComplete: callbacks?.onStageComplete,
  };
}
