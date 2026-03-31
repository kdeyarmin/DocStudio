import type {
  RenderCalloutConfig,
  RenderManifest,
  RenderTimelineScene,
} from '../../types/documentation';
import type {
  RemotionCalloutAnimation,
  RemotionCalloutProps,
  RemotionCalloutStyle,
  RemotionHighlightProps,
  RemotionOverlayProps,
  RemotionSpringConfig,
  RemotionZoomProps,
} from './types';
import { msToFrames } from './compositionPropBuilder';

// ─── Spring Configs ───────────────────────────────────────────────────────────

const ZOOM_SPRING: RemotionSpringConfig = {
  damping: 200,
  mass: 0.5,
  stiffness: 100,
  overshootClamping: true,
};

// ─── Screenshot Overlays ──────────────────────────────────────────────────────

export function buildOverlaySequences(
  manifest: RenderManifest,
): RemotionOverlayProps[] {
  const fps = manifest.render_config.video.fps;
  const overlays: RemotionOverlayProps[] = [];

  for (const scene of manifest.scenes) {
    for (const ovl of scene.screenshot_overlays) {
      const absStartMs = scene.start_ms + ovl.display_start_ms;
      const absEndMs = scene.start_ms + ovl.display_end_ms;
      const startFrame = msToFrames(absStartMs, fps);
      const endFrame = msToFrames(absEndMs, fps);
      overlays.push({
        assetId: ovl.asset_id,
        fileUrl: ovl.file_url,
        screenshotRole: ovl.screenshot_role,
        startFrame,
        endFrame,
        durationFrames: endFrame - startFrame,
        sceneId: scene.scene_id,
        zoomRegion: ovl.zoom_region,
        highlightRegion: ovl.highlight_region,
        transitionType: null,
        opacity: 1.0,
      });
    }
  }

  return overlays;
}

// ─── Callout Props ────────────────────────────────────────────────────────────

export function buildCalloutProps(
  scene: RenderTimelineScene,
  fps: number,
  config: RenderCalloutConfig,
): RemotionCalloutProps | null {
  if (!scene.callout) return null;

  const absStartMs = scene.start_ms + scene.callout.start_ms;
  const startFrame = msToFrames(absStartMs, fps);
  const durationFrames = msToFrames(scene.callout.duration_ms, fps);
  const fadeFrames = Math.min(6, Math.floor(durationFrames * 0.1));

  const animMap: Record<string, RemotionCalloutAnimation> = {
    fade: 'fade',
    slide: 'slide',
    pop: 'pop',
    none: 'none',
  };

  const styleMap: Record<string, RemotionCalloutStyle> = {
    rounded: 'rounded',
    pill: 'pill',
    box: 'box',
  };

  return {
    sceneId: scene.scene_id,
    title: scene.callout.title,
    description: scene.callout.description,
    startFrame,
    durationFrames,
    animationStyle: animMap[config.animation] ?? 'fade',
    boxStyle: styleMap[config.style] ?? 'rounded',
    fadeInFrames: fadeFrames,
    fadeOutFrames: fadeFrames,
  };
}

// ─── Zoom Sequence Props ──────────────────────────────────────────────────────

export function buildZoomSequenceProps(
  scene: RenderTimelineScene,
  fps: number,
): RemotionZoomProps | null {
  if (!scene.zoom_effect) return null;

  const absStartMs = scene.start_ms + scene.zoom_effect.start_ms;
  const startFrame = msToFrames(absStartMs, fps);
  const durationFrames = msToFrames(scene.zoom_effect.duration_ms, fps);
  const rampFrames = Math.min(15, Math.floor(durationFrames * 0.2));

  return {
    sceneId: scene.scene_id,
    region: scene.zoom_effect.region,
    startFrame,
    durationFrames,
    zoomInFrames: rampFrames,
    holdFrames: Math.max(0, durationFrames - rampFrames * 2),
    zoomOutFrames: rampFrames,
    springConfig: ZOOM_SPRING,
  };
}

// ─── Highlight Sequence Props ─────────────────────────────────────────────────

export function buildHighlightSequenceProps(
  scene: RenderTimelineScene,
  fps: number,
): RemotionHighlightProps | null {
  if (!scene.highlight_effect) return null;

  const absStartMs = scene.start_ms + scene.highlight_effect.start_ms;
  const startFrame = msToFrames(absStartMs, fps);
  const durationFrames = msToFrames(scene.highlight_effect.duration_ms, fps);
  const fadeFrames = Math.min(8, Math.floor(durationFrames * 0.15));

  return {
    sceneId: scene.scene_id,
    region: scene.highlight_effect.region,
    startFrame,
    durationFrames,
    fadeInFrames: fadeFrames,
    fadeOutFrames: fadeFrames,
    color: '#FFEB3B',
    opacity: 0.35,
    borderWidth: 3,
  };
}

// ─── Aggregate Builder ────────────────────────────────────────────────────────

export interface OverlayPlanResult {
  overlays: RemotionOverlayProps[];
  callouts: RemotionCalloutProps[];
  zoomEffects: RemotionZoomProps[];
  highlights: RemotionHighlightProps[];
  overlayCount: number;
}

export function buildAllOverlayPlans(
  manifest: RenderManifest,
  config: RenderCalloutConfig,
): OverlayPlanResult {
  const fps = manifest.render_config.video.fps;
  const overlays = buildOverlaySequences(manifest);
  const callouts: RemotionCalloutProps[] = [];
  const zoomEffects: RemotionZoomProps[] = [];
  const highlights: RemotionHighlightProps[] = [];

  for (const scene of manifest.scenes) {
    const callout = buildCalloutProps(scene, fps, config);
    if (callout) callouts.push(callout);

    const zoom = buildZoomSequenceProps(scene, fps);
    if (zoom) zoomEffects.push(zoom);

    const highlight = buildHighlightSequenceProps(scene, fps);
    if (highlight) highlights.push(highlight);
  }

  return {
    overlays,
    callouts,
    zoomEffects,
    highlights,
    overlayCount: overlays.length + callouts.length + zoomEffects.length + highlights.length,
  };
}
