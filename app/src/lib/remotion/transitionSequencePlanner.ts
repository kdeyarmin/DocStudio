import type { RenderManifest, RenderTransitionConfig } from '../../types/documentation';
import type {
  RemotionSlideDirection,
  RemotionSpringConfig,
  RemotionTransitionProps,
  RemotionTransitionType,
} from './types';
import { msToFrames } from './compositionPropBuilder';

// ─── Spring Configs per Transition Type ──────────────────────────────────────

const TRANSITION_SPRING_CONFIGS: Record<string, RemotionSpringConfig | null> = {
  crossfade: { damping: 200, mass: 0.5, stiffness: 80, overshootClamping: true },
  fade:      { damping: 200, mass: 0.5, stiffness: 80, overshootClamping: true },
  slide:     { damping: 100, mass: 1.0, stiffness: 120, overshootClamping: false },
  cut:       null,
};

function mapTransitionType(raw: string): RemotionTransitionType {
  if (raw === 'cut') return 'cut';
  if (raw === 'fade') return 'fade';
  if (raw === 'slide') return 'slide';
  return 'crossfade';
}

// ─── Transition Sequence Builder ──────────────────────────────────────────────

export function buildTransitionSequences(
  manifest: RenderManifest,
  config: RenderTransitionConfig,
): RemotionTransitionProps[] {
  const fps = manifest.render_config.video.fps;
  const scenes = manifest.scenes;
  const transitions: RemotionTransitionProps[] = [];

  for (let i = 0; i < scenes.length - 1; i++) {
    const fromScene = scenes[i];
    const toScene = scenes[i + 1];

    const outType = fromScene.transition_out?.type ?? config.type;
    const outDurationMs = fromScene.transition_out?.duration_ms ?? config.duration_ms;
    const inDurationMs = toScene.transition_in?.duration_ms ?? config.duration_ms;
    const durationMs = Math.max(outDurationMs, inDurationMs);

    const type = mapTransitionType(outType);
    const durationFrames = msToFrames(durationMs, fps);

    const overlapStartFrame = msToFrames(fromScene.end_ms, fps) - durationFrames;
    const overlapEndFrame = msToFrames(toScene.start_ms, fps) + durationFrames;

    const slideDirection: RemotionSlideDirection | null =
      type === 'slide' ? 'left' : null;

    transitions.push({
      fromSceneId: fromScene.scene_id,
      toSceneId: toScene.scene_id,
      type,
      durationFrames,
      overlapStartFrame: Math.max(0, overlapStartFrame),
      overlapEndFrame,
      springConfig: TRANSITION_SPRING_CONFIGS[type] ?? null,
      slideDirection,
    });
  }

  return transitions;
}

// ─── Per-Transition Frame Data ────────────────────────────────────────────────

export function getTransitionFrameWindow(
  transition: RemotionTransitionProps,
): { startFrame: number; endFrame: number; midFrame: number } {
  const midFrame = Math.floor(
    (transition.overlapStartFrame + transition.overlapEndFrame) / 2,
  );
  return {
    startFrame: transition.overlapStartFrame,
    endFrame: transition.overlapEndFrame,
    midFrame,
  };
}

// ─── Animation Type Description ───────────────────────────────────────────────

export function describeTransition(transition: RemotionTransitionProps): string {
  if (transition.type === 'cut') return 'Hard cut';
  const frames = transition.durationFrames;
  if (transition.type === 'slide') {
    return `Slide ${transition.slideDirection ?? 'left'} (${frames}f)`;
  }
  return `${transition.type.charAt(0).toUpperCase()}${transition.type.slice(1)} (${frames}f)`;
}
