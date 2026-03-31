import { RenderManifest, RenderTimelineScene } from '../../../types/documentation';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrackType =
  | 'scene'
  | 'transition'
  | 'narration'
  | 'caption'
  | 'screenshot'
  | 'callout'
  | 'zoom'
  | 'highlight';

export interface TimelineBlockData {
  key: string;
  sceneIndex: number;
  itemIndex?: number;
  trackType: TrackType;
  startMs: number;
  endMs: number;
  label: string;
  color: string;
  bgColor: string;
  tooltip: string;
}

export interface DragState {
  blockKey: string;
  sceneIndex: number;
  itemIndex?: number;
  trackType: TrackType;
  mode: 'move' | 'resize-left' | 'resize-right';
  startClientX: number;
  origStartMs: number;
  origEndMs: number;
  sceneStartMs: number;
  sceneEndMs: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const TRACK_COLORS: Record<TrackType, { bg: string; text: string; border: string }> = {
  scene:      { bg: '#1d4ed8', text: '#bfdbfe', border: '#3b82f6' },
  transition: { bg: '#c2410c', text: '#fed7aa', border: '#f97316' },
  narration:  { bg: '#15803d', text: '#bbf7d0', border: '#22c55e' },
  caption:    { bg: '#a16207', text: '#fef08a', border: '#eab308' },
  screenshot: { bg: '#0e7490', text: '#a5f3fc', border: '#06b6d4' },
  callout:    { bg: '#b91c1c', text: '#fecaca', border: '#ef4444' },
  zoom:       { bg: '#6d28d9', text: '#ddd6fe', border: '#8b5cf6' },
  highlight:  { bg: '#9d174d', text: '#fbcfe8', border: '#ec4899' },
};

export const TRACK_LABELS: Record<TrackType, string> = {
  scene:      'Scenes',
  transition: 'Transitions',
  narration:  'Narration',
  caption:    'Captions',
  screenshot: 'Screenshots',
  callout:    'Callouts',
  zoom:       'Zoom Effects',
  highlight:  'Highlights',
};

export const TRACK_ORDER: TrackType[] = [
  'scene', 'transition', 'narration', 'caption', 'screenshot', 'callout', 'zoom', 'highlight',
];

export const ZOOM_LEVELS = [20, 40, 80, 160] as const;
export type ZoomLevel = typeof ZOOM_LEVELS[number];

export const LEFT_PANEL_W = 120;
export const TRACK_H = 36;
export const RULER_H = 28;
export const HANDLE_W = 6;

// ─── Time Utilities ───────────────────────────────────────────────────────────

export function msToTimecode(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const frac = Math.floor((ms % 1000) / 10);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(frac).padStart(2, '0')}`;
}

export function msToSec(ms: number) { return ms / 1000; }
export function secToMs(s: number)  { return s * 1000; }
export function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

export function snapMs(ms: number, snapMs: number): number {
  return Math.round(ms / snapMs) * snapMs;
}

export function rulerInterval(pxPerSec: number): number {
  if (pxPerSec >= 160) return 1000;
  if (pxPerSec >= 80)  return 2000;
  if (pxPerSec >= 40)  return 5000;
  return 10000;
}

// ─── Block Extraction ─────────────────────────────────────────────────────────

function blockColor(t: TrackType) {
  return TRACK_COLORS[t].border;
}
function blockBg(t: TrackType) {
  return TRACK_COLORS[t].bg;
}

export function extractBlocks(manifest: RenderManifest): TimelineBlockData[] {
  const blocks: TimelineBlockData[] = [];

  manifest.scenes.forEach((scene, si) => {
    const abs = (relMs: number) => scene.start_ms + relMs;

    // ── Scene block ──────────────────────────────────────────────────────────
    blocks.push({
      key: `${si}-scene`,
      sceneIndex: si,
      trackType: 'scene',
      startMs: scene.start_ms,
      endMs: scene.end_ms,
      label: scene.title || `Scene ${si + 1}`,
      color: blockColor('scene'),
      bgColor: blockBg('scene'),
      tooltip: `${scene.title}\n${msToTimecode(scene.start_ms)} → ${msToTimecode(scene.end_ms)}\n${msToSec(scene.duration_ms).toFixed(1)}s`,
    });

    // ── Transition block (transition_out shown at scene end) ──────────────────
    if (scene.transition_out) {
      const tw = scene.transition_out.duration_ms;
      blocks.push({
        key: `${si}-transition`,
        sceneIndex: si,
        trackType: 'transition',
        startMs: scene.end_ms - tw,
        endMs: scene.end_ms,
        label: scene.transition_out.type,
        color: blockColor('transition'),
        bgColor: blockBg('transition'),
        tooltip: `${scene.transition_out.type} transition\n${msToSec(tw).toFixed(2)}s`,
      });
    }

    // ── Narration ─────────────────────────────────────────────────────────────
    if (scene.narration) {
      const nar = scene.narration;
      const startMs = abs(nar.start_ms);
      blocks.push({
        key: `${si}-narration`,
        sceneIndex: si,
        trackType: 'narration',
        startMs,
        endMs: startMs + nar.duration_ms,
        label: `Narration`,
        color: blockColor('narration'),
        bgColor: blockBg('narration'),
        tooltip: `Narration audio\n${msToTimecode(startMs)} → ${msToTimecode(startMs + nar.duration_ms)}\n${msToSec(nar.duration_ms).toFixed(1)}s`,
      });
    }

    // ── Captions ──────────────────────────────────────────────────────────────
    scene.captions.forEach((cap, ci) => {
      const startMs = abs(cap.start_ms);
      const endMs = abs(cap.end_ms);
      const preview = cap.text.length > 40 ? cap.text.slice(0, 40) + '…' : cap.text;
      blocks.push({
        key: `${si}-caption-${ci}`,
        sceneIndex: si,
        itemIndex: ci,
        trackType: 'caption',
        startMs,
        endMs,
        label: preview,
        color: blockColor('caption'),
        bgColor: blockBg('caption'),
        tooltip: `"${cap.text}"\n${msToTimecode(startMs)} → ${msToTimecode(endMs)}`,
      });
    });

    // ── Screenshots ───────────────────────────────────────────────────────────
    scene.screenshot_overlays.forEach((ov, oi) => {
      const startMs = abs(ov.display_start_ms);
      const endMs = abs(ov.display_end_ms);
      blocks.push({
        key: `${si}-screenshot-${oi}`,
        sceneIndex: si,
        itemIndex: oi,
        trackType: 'screenshot',
        startMs,
        endMs,
        label: ov.screenshot_role,
        color: blockColor('screenshot'),
        bgColor: blockBg('screenshot'),
        tooltip: `${ov.screenshot_role} screenshot\n${msToTimecode(startMs)} → ${msToTimecode(endMs)}`,
      });
    });

    // ── Callout ───────────────────────────────────────────────────────────────
    if (scene.callout) {
      const c = scene.callout;
      const startMs = abs(c.start_ms);
      blocks.push({
        key: `${si}-callout`,
        sceneIndex: si,
        trackType: 'callout',
        startMs,
        endMs: startMs + c.duration_ms,
        label: c.title,
        color: blockColor('callout'),
        bgColor: blockBg('callout'),
        tooltip: `Callout: ${c.title}\n${c.description ?? ''}\n${msToTimecode(startMs)} (+${msToSec(c.duration_ms).toFixed(1)}s)`,
      });
    }

    // ── Zoom effect ───────────────────────────────────────────────────────────
    if (scene.zoom_effect) {
      const z = scene.zoom_effect;
      const startMs = abs(z.start_ms);
      blocks.push({
        key: `${si}-zoom`,
        sceneIndex: si,
        trackType: 'zoom',
        startMs,
        endMs: startMs + z.duration_ms,
        label: 'Zoom',
        color: blockColor('zoom'),
        bgColor: blockBg('zoom'),
        tooltip: `Zoom effect\n${msToTimecode(startMs)} (+${msToSec(z.duration_ms).toFixed(1)}s)`,
      });
    }

    // ── Highlight effect ──────────────────────────────────────────────────────
    if (scene.highlight_effect) {
      const h = scene.highlight_effect;
      const startMs = abs(h.start_ms);
      blocks.push({
        key: `${si}-highlight`,
        sceneIndex: si,
        trackType: 'highlight',
        startMs,
        endMs: startMs + h.duration_ms,
        label: 'Highlight',
        color: blockColor('highlight'),
        bgColor: blockBg('highlight'),
        tooltip: `Highlight effect\n${msToTimecode(startMs)} (+${msToSec(h.duration_ms).toFixed(1)}s)`,
      });
    }
  });

  return blocks;
}

export function visibleTracks(manifest: RenderManifest): TrackType[] {
  const blocks = extractBlocks(manifest);
  const seen = new Set(blocks.map(b => b.trackType));
  return TRACK_ORDER.filter(t => seen.has(t));
}

// ─── Manifest Mutation Helpers ────────────────────────────────────────────────

export function applyBlockEdit(
  manifest: RenderManifest,
  blockKey: string,
  newStartMs: number,
  newEndMs: number,
): RenderManifest {
  const [siStr, trackType, itemStr] = blockKey.split('-');
  const si = parseInt(siStr, 10);
  if (isNaN(si)) return manifest;

  const updated: RenderManifest = {
    ...manifest,
    scenes: manifest.scenes.map((scene, i) => i !== si ? scene : applySceneBlockEdit(
      scene, trackType as TrackType, itemStr !== undefined ? parseInt(itemStr, 10) : undefined,
      newStartMs, newEndMs,
    )),
  };

  if (trackType === 'scene') {
    return recalcScenePositions(updated, si, newEndMs - newStartMs);
  }

  return updated;
}

function applySceneBlockEdit(
  scene: RenderTimelineScene,
  trackType: TrackType,
  itemIndex: number | undefined,
  newStartMs: number,
  newEndMs: number,
): RenderTimelineScene {
  const relStart = newStartMs - scene.start_ms;
  const duration = newEndMs - newStartMs;

  switch (trackType) {
    case 'scene':
      return { ...scene, end_ms: newEndMs, duration_ms: newEndMs - scene.start_ms };
    case 'narration':
      if (!scene.narration) return scene;
      return { ...scene, narration: { ...scene.narration, start_ms: relStart, duration_ms: duration } };
    case 'caption':
      if (itemIndex === undefined) return scene;
      return {
        ...scene,
        captions: scene.captions.map((c, ci) =>
          ci !== itemIndex ? c : { ...c, start_ms: relStart, end_ms: relStart + duration },
        ),
      };
    case 'screenshot':
      if (itemIndex === undefined) return scene;
      return {
        ...scene,
        screenshot_overlays: scene.screenshot_overlays.map((ov, oi) =>
          oi !== itemIndex ? ov : { ...ov, display_start_ms: relStart, display_end_ms: relStart + duration },
        ),
      };
    case 'callout':
      if (!scene.callout) return scene;
      return { ...scene, callout: { ...scene.callout, start_ms: relStart, duration_ms: duration } };
    case 'zoom':
      if (!scene.zoom_effect) return scene;
      return { ...scene, zoom_effect: { ...scene.zoom_effect, start_ms: relStart, duration_ms: duration } };
    case 'highlight':
      if (!scene.highlight_effect) return scene;
      return { ...scene, highlight_effect: { ...scene.highlight_effect, start_ms: relStart, duration_ms: duration } };
    default:
      return scene;
  }
}

function recalcScenePositions(manifest: RenderManifest, editedIdx: number, newDuration: number): RenderManifest {
  let cursor = manifest.scenes[editedIdx].start_ms;
  const scenes = manifest.scenes.map((scene, i) => {
    if (i < editedIdx) return scene;
    const dur = i === editedIdx ? newDuration : scene.duration_ms;
    const s = { ...scene, start_ms: cursor, end_ms: cursor + dur, duration_ms: dur };
    cursor += dur;
    return s;
  });
  return { ...manifest, scenes, total_duration_ms: cursor };
}
