import type { RenderConfig, RenderManifest } from '../../types/documentation';
import type { FfmpegTransitionEntry } from './types';

const XFADE_MAP: Record<string, string> = {
  crossfade: 'fade',
  fade: 'fade',
  slide: 'slideleft',
  cut: 'cut',
};

function resolveXfadeVariant(type: string): string {
  return XFADE_MAP[type] ?? 'fade';
}

export function buildFfmpegTransitions(
  manifest: RenderManifest,
  config: RenderConfig,
  sceneVideoLabels: string[],
  _sceneAudioLabels: string[],
): FfmpegTransitionEntry[] {
  const transitions: FfmpegTransitionEntry[] = [];

  if (manifest.scenes.length < 2) return transitions;

  for (let i = 0; i < manifest.scenes.length - 1; i++) {
    const current = manifest.scenes[i];
    const next = manifest.scenes[i + 1];

    const outType = current.transition_out?.type ?? config.transitions.type;
    const outDurationMs = current.transition_out?.duration_ms ?? config.transitions.duration_ms;
    const inType = next.transition_in?.type ?? config.transitions.type;

    const effectiveType = outType !== 'cut' ? outType : inType;
    const durationSeconds = outDurationMs / 1000;

    if (effectiveType === 'cut') {
      transitions.push({
        fromSceneId: current.scene_id,
        toSceneId: next.scene_id,
        kind: 'cut',
        xfadeTransition: null,
        durationSeconds: 0,
        offsetSeconds: current.end_ms / 1000,
        inputALabel: sceneVideoLabels[i] ?? `v_scene${i}`,
        inputBLabel: sceneVideoLabels[i + 1] ?? `v_scene${i + 1}`,
        outputLabel: `v_xf_${i}`,
      });
      continue;
    }

    const xfadeVariant = resolveXfadeVariant(effectiveType);
    const offsetSeconds = current.end_ms / 1000 - durationSeconds;

    transitions.push({
      fromSceneId: current.scene_id,
      toSceneId: next.scene_id,
      kind: 'xfade',
      xfadeTransition: xfadeVariant,
      durationSeconds,
      offsetSeconds: Math.max(0, offsetSeconds),
      inputALabel: sceneVideoLabels[i] ?? `v_scene${i}`,
      inputBLabel: sceneVideoLabels[i + 1] ?? `v_scene${i + 1}`,
      outputLabel: `v_xf_${i}`,
    });
  }

  return transitions;
}

export function buildTransitionFilterLines(
  transitions: FfmpegTransitionEntry[],
  sceneVideoLabels: string[],
): string[] {
  const lines: string[] = [];
  let currentLabel = sceneVideoLabels[0] ?? 'v_scene0';

  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i];
    const nextSceneLabel = sceneVideoLabels[i + 1] ?? `v_scene${i + 1}`;

    if (t.kind === 'cut') {
      const concatLabel = `v_xf_${i}`;
      lines.push(`[${currentLabel}][${nextSceneLabel}]concat=n=2:v=1:a=0[${concatLabel}]`);
      currentLabel = concatLabel;
      continue;
    }

    const xfadeLabel = `v_xf_${i}`;
    lines.push(
      `[${currentLabel}][${nextSceneLabel}]xfade=transition=${t.xfadeTransition}:duration=${t.durationSeconds.toFixed(3)}:offset=${t.offsetSeconds.toFixed(3)}[${xfadeLabel}]`,
    );
    currentLabel = xfadeLabel;
  }

  return lines;
}

export function getFinalTransitionLabel(
  transitions: FfmpegTransitionEntry[],
  sceneVideoLabels: string[],
): string {
  if (transitions.length === 0) {
    return sceneVideoLabels[0] ?? 'v_scene0';
  }
  return `v_xf_${transitions.length - 1}`;
}
