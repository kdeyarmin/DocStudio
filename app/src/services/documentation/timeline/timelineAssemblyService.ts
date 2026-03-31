import { supabase } from '../../../lib/supabase';
import type { RenderManifest, RenderTimelineEvent, TimelineEventType } from '../../../types/documentation';

export function buildTimelineEventsFromManifest(manifest: RenderManifest): Omit<RenderTimelineEvent, 'id' | 'created_at'>[] {
  const events: Omit<RenderTimelineEvent, 'id' | 'created_at'>[] = [];
  let order = 0;

  const base = {
    render_project_id: manifest.render_project_id,
    draft_id: manifest.draft_id,
  };

  for (const scene of manifest.scenes) {
    for (const seg of (scene.video_segments ?? [])) {
      events.push({
        ...base,
        scene_id: scene.scene_id,
        sort_order: order++,
        event_type: 'video_segment' as TimelineEventType,
        start_ms: scene.start_ms + seg.output_start_ms,
        end_ms: scene.start_ms + seg.output_end_ms,
        duration_ms: seg.output_end_ms - seg.output_start_ms,
        payload_json: {
          source_asset_id: seg.source_asset_id,
          source_start_ms: seg.source_start_ms,
          source_end_ms: seg.source_end_ms,
          playback_speed: seg.playback_speed,
          has_zoom: seg.has_zoom,
          zoom_region: seg.zoom_region,
          has_highlight: seg.has_highlight,
          highlight_region: seg.highlight_region,
        },
        label: `Scene ${scene.scene_order} – Video`,
      });
    }

    for (const overlay of (scene.screenshot_overlays ?? [])) {
      events.push({
        ...base,
        scene_id: scene.scene_id,
        sort_order: order++,
        event_type: 'screenshot_overlay' as TimelineEventType,
        start_ms: scene.start_ms + overlay.display_start_ms,
        end_ms: scene.start_ms + overlay.display_end_ms,
        duration_ms: overlay.display_end_ms - overlay.display_start_ms,
        payload_json: {
          asset_id: overlay.asset_id,
          file_url: overlay.file_url,
          screenshot_role: overlay.screenshot_role,
          zoom_region: overlay.zoom_region,
          highlight_region: overlay.highlight_region,
        },
        label: `Scene ${scene.scene_order} – Screenshot (${overlay.screenshot_role})`,
      });
    }

    if (scene.narration) {
      events.push({
        ...base,
        scene_id: scene.scene_id,
        sort_order: order++,
        event_type: 'narration_audio' as TimelineEventType,
        start_ms: scene.start_ms + scene.narration.start_ms,
        end_ms: scene.start_ms + scene.narration.start_ms + scene.narration.duration_ms,
        duration_ms: scene.narration.duration_ms,
        payload_json: {
          audio_asset_id: scene.narration.audio_asset_id,
          audio_url: scene.narration.audio_url,
          word_timings: scene.narration.word_timings,
        },
        label: `Scene ${scene.scene_order} – Narration`,
      });
    }

    for (const cap of (scene.captions ?? [])) {
      events.push({
        ...base,
        scene_id: scene.scene_id,
        sort_order: order++,
        event_type: 'caption_display' as TimelineEventType,
        start_ms: scene.start_ms + cap.start_ms,
        end_ms: scene.start_ms + cap.end_ms,
        duration_ms: cap.end_ms - cap.start_ms,
        payload_json: { text: cap.text },
        label: null,
      });
    }

    if (scene.callout) {
      events.push({
        ...base,
        scene_id: scene.scene_id,
        sort_order: order++,
        event_type: 'callout_display' as TimelineEventType,
        start_ms: scene.start_ms + scene.callout.start_ms,
        end_ms: scene.start_ms + scene.callout.start_ms + scene.callout.duration_ms,
        duration_ms: scene.callout.duration_ms,
        payload_json: {
          title: scene.callout.title,
          description: scene.callout.description,
        },
        label: `Scene ${scene.scene_order} – Callout`,
      });
    }

    if (scene.zoom_effect) {
      events.push({
        ...base,
        scene_id: scene.scene_id,
        sort_order: order++,
        event_type: 'zoom_effect' as TimelineEventType,
        start_ms: scene.start_ms + scene.zoom_effect.start_ms,
        end_ms: scene.start_ms + scene.zoom_effect.start_ms + scene.zoom_effect.duration_ms,
        duration_ms: scene.zoom_effect.duration_ms,
        payload_json: { region: scene.zoom_effect.region },
        label: `Scene ${scene.scene_order} – Zoom`,
      });
    }

    if (scene.transition_out) {
      events.push({
        ...base,
        scene_id: scene.scene_id,
        sort_order: order++,
        event_type: 'transition' as TimelineEventType,
        start_ms: scene.end_ms - scene.transition_out.duration_ms,
        end_ms: scene.end_ms,
        duration_ms: scene.transition_out.duration_ms,
        payload_json: { type: scene.transition_out.type, direction: 'out' },
        label: null,
      });
    }
  }

  return events;
}

export async function persistTimelineEvents(
  renderProjectId: string,
  events: Omit<RenderTimelineEvent, 'id' | 'created_at'>[]
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('doc_studio_render_timeline_events')
    .delete()
    .eq('render_project_id', renderProjectId);
  if (deleteError) throw deleteError;

  if (events.length === 0) return;

  const { error } = await supabase
    .from('doc_studio_render_timeline_events')
    .insert(events);
  if (error) throw error;
}

export async function fetchTimelineEvents(renderProjectId: string): Promise<RenderTimelineEvent[]> {
  const { data, error } = await supabase
    .from('doc_studio_render_timeline_events')
    .select('*')
    .eq('render_project_id', renderProjectId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RenderTimelineEvent[];
}

export function formatMsLabel(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const millis = ms % 1000;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}
