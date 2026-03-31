import type { RenderManifest } from '../../types/documentation';
import type { FfmpegAudioMixPlan, FfmpegAudioTrack, FfmpegBgmSlot } from './types';

function buildAdelayFilter(track: FfmpegAudioTrack): string {
  const delayMs = Math.max(0, track.adelayMs);
  return `[${track.outputLabel}]adelay=${delayMs}|${delayMs}[${track.outputLabel}d]`;
}

function buildVolumeFilter(label: string, volume: number, outputLabel: string): string {
  return `[${label}]volume=${volume.toFixed(4)}[${outputLabel}]`;
}

export function buildFfmpegAudioMixPlan(
  manifest: RenderManifest,
  baseAudioInputIndex: number,
): FfmpegAudioMixPlan {
  const tracks: FfmpegAudioTrack[] = [];
  let inputIdx = baseAudioInputIndex;

  for (let si = 0; si < manifest.scenes.length; si++) {
    const scene = manifest.scenes[si];
    if (!scene.narration || !scene.narration.audio_url) continue;

    const outputLabel = `a_narr_${si}`;

    tracks.push({
      inputIndex: inputIdx,
      audioFile: scene.narration.audio_url,
      adelayMs: scene.narration.start_ms,
      volume: 1.0,
      sceneId: scene.scene_id,
      outputLabel,
    });

    inputIdx++;
  }

  const bgm: FfmpegBgmSlot = {
    inputIndex: null,
    audioFile: null,
    volume: 0.15,
    duckingEnabled: false,
    duckingTargetDb: -18,
  };

  const filterLines: string[] = [];

  if (tracks.length === 0) {
    const finalAudioLabel = 'a_silence';
    const totalDurationS = (manifest.total_duration_ms / 1000).toFixed(3);
    filterLines.push(`aevalsrc=0:c=stereo:d=${totalDurationS}[${finalAudioLabel}]`);
    return {
      tracks,
      bgm,
      mixFilterString: filterLines.join(';'),
      normalizationFilter: '',
      finalAudioLabel,
    };
  }

  for (const track of tracks) {
    filterLines.push(buildAdelayFilter(track));
    filterLines.push(buildVolumeFilter(`${track.outputLabel}d`, track.volume, `${track.outputLabel}v`));
  }

  const mixInputs = tracks.map(t => `[${t.outputLabel}v]`).join('');
  const mixCount = tracks.length;
  const mixedLabel = 'a_mixed';

  if (mixCount === 1) {
    filterLines.push(`${mixInputs}anull[${mixedLabel}]`);
  } else {
    filterLines.push(`${mixInputs}amix=inputs=${mixCount}:duration=longest:dropout_transition=0[${mixedLabel}]`);
  }

  const normalizedLabel = 'a_norm';
  const normalizationFilter = `[${mixedLabel}]dynaudnorm=f=150:g=15:p=0.95[${normalizedLabel}]`;

  return {
    tracks,
    bgm,
    mixFilterString: filterLines.join(';'),
    normalizationFilter,
    finalAudioLabel: normalizedLabel,
  };
}

export function collectNarrationFiles(plan: FfmpegAudioMixPlan): string[] {
  return plan.tracks.map(t => t.audioFile);
}
