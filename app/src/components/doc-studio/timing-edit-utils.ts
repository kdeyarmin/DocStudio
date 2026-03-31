import type { RenderManifest } from '../../types/documentation';
import type { BlockSelection } from './RenderTimelinePreview';

function secToMs(sec: number): number {
  return Math.round(sec * 1000);
}

export function applyTimingEdit(
  manifest: RenderManifest,
  selection: BlockSelection,
  rawValues: Record<string, number>,
): RenderManifest {
  const updated: RenderManifest = JSON.parse(JSON.stringify(manifest));
  const scene = updated.scenes[selection.sceneIndex];

  switch (selection.type) {
    case 'scene': {
      const newDuration = secToMs(rawValues.duration_sec);
      const delta = newDuration - scene.duration_ms;
      scene.duration_ms = newDuration;
      scene.end_ms = scene.start_ms + newDuration;
      for (let i = selection.sceneIndex + 1; i < updated.scenes.length; i++) {
        updated.scenes[i].start_ms += delta;
        updated.scenes[i].end_ms += delta;
      }
      updated.total_duration_ms += delta;
      break;
    }
    case 'caption': {
      const cap = scene.captions[selection.itemIndex!];
      cap.start_ms = secToMs(rawValues.start_sec);
      cap.end_ms = secToMs(rawValues.end_sec);
      break;
    }
    case 'screenshot': {
      const ov = scene.screenshot_overlays[selection.itemIndex!];
      ov.display_start_ms = secToMs(rawValues.start_sec);
      ov.display_end_ms = secToMs(rawValues.end_sec);
      break;
    }
    case 'callout': {
      scene.callout!.start_ms = secToMs(rawValues.start_sec);
      scene.callout!.duration_ms = secToMs(rawValues.duration_sec);
      break;
    }
    case 'narration': {
      scene.narration!.start_ms = secToMs(rawValues.start_sec);
      scene.narration!.duration_ms = secToMs(rawValues.duration_sec);
      break;
    }
    case 'transition': {
      scene.transition_in!.duration_ms = secToMs(rawValues.duration_sec);
      break;
    }
    case 'zoom': {
      scene.zoom_effect!.start_ms = secToMs(rawValues.start_sec);
      scene.zoom_effect!.duration_ms = secToMs(rawValues.duration_sec);
      break;
    }
    case 'highlight': {
      scene.highlight_effect!.start_ms = secToMs(rawValues.start_sec);
      scene.highlight_effect!.duration_ms = secToMs(rawValues.duration_sec);
      break;
    }
  }

  return updated;
}
