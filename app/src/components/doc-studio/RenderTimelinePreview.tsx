import { useState, useRef, useCallback } from 'react';
import {
  Film, Volume2, Captions, Image, Megaphone, MoveHorizontal,
  ZoomIn, ZoomOut, ChevronRight, Pencil, Eye,
} from 'lucide-react';
import type { RenderManifest, RenderTimelineScene } from '../../types/documentation';

// ─── BlockSelection (exported for consumers) ──────────────────────────────────

export interface BlockSelection {
  type: 'scene' | 'caption' | 'screenshot' | 'callout' | 'narration' | 'transition' | 'zoom' | 'highlight';
  sceneIndex: number;
  itemIndex?: number;
}

function selectionMatches(a: BlockSelection, b: BlockSelection): boolean {
  return a.type === b.type && a.sceneIndex === b.sceneIndex && a.itemIndex === b.itemIndex;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LABEL_W = 92;

const SCENE_PALETTE = [
  { bar: 'bg-blue-500',    text: 'text-white' },
  { bar: 'bg-cyan-500',    text: 'text-white' },
  { bar: 'bg-sky-500',     text: 'text-white' },
  { bar: 'bg-blue-500',    text: 'text-white' },
  { bar: 'bg-emerald-500', text: 'text-white' },
  { bar: 'bg-green-600',   text: 'text-white' },
  { bar: 'bg-amber-500',   text: 'text-white' },
  { bar: 'bg-orange-500',  text: 'text-white' },
];

const RULER_H  = 26;
const TRACK_H  = { scenes: 32, transitions: 20, narration: 28, captions: 22, screenshots: 28, callouts: 24, zoom: 22 };

// ─── Types ────────────────────────────────────────────────────────────────────

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  title: string;
  lines: string[];
}

interface Block {
  key: string;
  startMs: number;
  endMs: number;
  barClass: string;
  textClass: string;
  label?: string;
  tooltipTitle: string;
  tooltipLines: string[];
  selection?: BlockSelection;
}

interface TrackEntry {
  id: string;
  label: string;
  Icon: React.ElementType | null;
  height: number;
  blocks: Block[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(ms: number, total: number): number {
  return total > 0 ? (ms / total) * 100 : 0;
}

function blockWidthPct(startMs: number, endMs: number, total: number): number {
  return Math.max(pct(endMs - startMs, total), 0.25);
}

function fmtMs(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s % 1 === 0 ? s : s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem.toFixed(0)}`;
}

function getTickIntervalMs(totalMs: number, zoom: number): number {
  const visible = totalMs / zoom;
  if (visible <= 5_000)   return 500;
  if (visible <= 15_000)  return 1_000;
  if (visible <= 60_000)  return 5_000;
  if (visible <= 150_000) return 10_000;
  return 30_000;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tooltip({ state }: { state: TooltipState }) {
  if (!state.visible) return null;
  return (
    <div
      style={{
        position: 'fixed',
        left: state.x + 14,
        top: state.y - 10,
        transform: 'translateY(-100%)',
        zIndex: 9999,
        pointerEvents: 'none',
        maxWidth: 260,
      }}
      className="bg-slate-900 text-white rounded-lg shadow-2xl px-3 py-2"
    >
      <p className="text-xs font-semibold mb-0.5 leading-snug">{state.title}</p>
      {state.lines.map((line, i) => (
        <p key={i} className="text-[10px] text-slate-300 leading-relaxed">{line}</p>
      ))}
    </div>
  );
}

// ─── Ruler ───────────────────────────────────────────────────────────────────

function TimelineRuler({ totalMs, zoom }: { totalMs: number; zoom: number }) {
  const intervalMs = getTickIntervalMs(totalMs, zoom);
  const ticks: number[] = [];
  for (let ms = 0; ms <= totalMs; ms += intervalMs) ticks.push(ms);

  return (
    <div
      className="relative bg-slate-50 border-b border-slate-200 select-none"
      style={{ height: RULER_H }}
    >
      {ticks.map(ms => {
        const left = pct(ms, totalMs);
        const isFirst = ms === 0;
        return (
          <div
            key={ms}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${left}%` }}
          >
            <div className="w-px h-3 bg-slate-300" />
            <span
              className="text-[8px] text-slate-400 mt-0.5 whitespace-nowrap leading-none"
              style={{ transform: isFirst ? 'none' : 'translateX(-50%)' }}
            >
              {fmtMs(ms)}
            </span>
          </div>
        );
      })}
      <span
        className="absolute top-2 right-1 text-[8px] text-slate-400 select-none"
      >
        {fmtMs(totalMs)}
      </span>
    </div>
  );
}

// ─── Scene Boundary Lines ─────────────────────────────────────────────────────

function SceneBoundaries({
  scenes,
  totalMs,
  totalHeight,
}: {
  scenes: RenderTimelineScene[];
  totalMs: number;
  totalHeight: number;
}) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ height: totalHeight }}
    >
      {scenes.map((scene, i) => {
        if (i === 0) return null;
        const left = pct(scene.start_ms, totalMs);
        return (
          <div
            key={scene.scene_id}
            className="absolute top-0 bottom-0 border-l border-dashed border-slate-300/70"
            style={{ left: `${left}%` }}
          />
        );
      })}
    </div>
  );
}

// ─── Track Row ────────────────────────────────────────────────────────────────

function TrackRow({
  height,
  totalMs,
  blocks,
  editMode,
  selectedBlock,
  onHover,
  onLeave,
  onBlockClick,
}: {
  height: number;
  totalMs: number;
  blocks: Block[];
  editMode: boolean;
  selectedBlock: BlockSelection | null;
  onHover: (e: React.MouseEvent, title: string, lines: string[]) => void;
  onLeave: () => void;
  onBlockClick: (sel: BlockSelection) => void;
}) {
  const inset = height <= 22 ? 3 : 4;
  return (
    <div
      className="relative border-b border-slate-100 bg-white"
      style={{ height }}
    >
      {blocks.length === 0 && (
        <div className="absolute inset-0 flex items-center px-3">
          <span className="text-[9px] text-slate-300 italic select-none">no data</span>
        </div>
      )}
      {blocks.map(block => {
        const left  = pct(block.startMs, totalMs);
        const width = blockWidthPct(block.startMs, block.endMs, totalMs);
        const isSelected = editMode && selectedBlock && block.selection
          ? selectionMatches(block.selection, selectedBlock)
          : false;
        const isClickable = editMode && !!block.selection;

        return (
          <div
            key={block.key}
            className={[
              'absolute rounded flex items-center overflow-hidden transition-all',
              block.barClass,
              isClickable ? 'cursor-pointer' : 'cursor-default',
              isSelected
                ? 'ring-2 ring-white ring-offset-1 ring-offset-transparent brightness-110 shadow-md z-10'
                : isClickable
                  ? 'hover:ring-1 hover:ring-white/70 hover:brightness-105'
                  : '',
            ].filter(Boolean).join(' ')}
            style={{ left: `${left}%`, width: `${width}%`, top: inset, bottom: inset }}
            onMouseEnter={e => onHover(e, block.tooltipTitle, block.tooltipLines)}
            onMouseLeave={onLeave}
            onClick={() => {
              if (!isClickable || !block.selection) return;
              onBlockClick(block.selection);
            }}
          >
            {block.label && (
              <span className={`text-[9px] font-medium truncate px-1 leading-none select-none ${block.textClass}`}>
                {block.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Block Builders ───────────────────────────────────────────────────────────

function buildSceneBlocks(scenes: RenderTimelineScene[]): Block[] {
  return scenes.map((scene, sceneIndex) => {
    const pal = SCENE_PALETTE[sceneIndex % SCENE_PALETTE.length];
    return {
      key: `scene-${scene.scene_id}`,
      startMs: scene.start_ms,
      endMs: scene.end_ms,
      barClass: pal.bar,
      textClass: pal.text,
      label: `${scene.scene_order}. ${scene.title}`,
      tooltipTitle: `Scene ${scene.scene_order}: ${scene.title}`,
      tooltipLines: [
        `${fmtMs(scene.start_ms)} → ${fmtMs(scene.end_ms)}`,
        `Duration: ${(scene.duration_ms / 1000).toFixed(1)}s`,
        'Click in Edit mode to adjust duration',
      ],
      selection: { type: 'scene', sceneIndex } as BlockSelection,
    };
  });
}

function buildTransitionBlocks(scenes: RenderTimelineScene[]): Block[] {
  const blocks: Block[] = [];
  scenes.forEach((scene, sceneIndex) => {
    if (sceneIndex === 0) return;
    const trans = scene.transition_in;
    if (!trans || trans.duration_ms <= 0) return;
    const half = trans.duration_ms / 2;
    const startMs = Math.max(0, scene.start_ms - half);
    const endMs   = startMs + trans.duration_ms;
    blocks.push({
      key: `trans-${scene.scene_id}`,
      startMs,
      endMs,
      barClass: 'bg-slate-400',
      textClass: 'text-white',
      label: trans.type,
      tooltipTitle: `Transition → Scene ${scene.scene_order}`,
      tooltipLines: [
        `Type: ${trans.type}`,
        `Duration: ${trans.duration_ms}ms`,
        `At: ${fmtMs(scene.start_ms)}`,
      ],
      selection: { type: 'transition', sceneIndex } as BlockSelection,
    });
  });
  return blocks;
}

function buildNarrationBlocks(scenes: RenderTimelineScene[]): Block[] {
  return scenes
    .filter(s => s.narration)
    .map((scene, _i, arr) => {
      const sceneIndex = scenes.indexOf(scene);
      const n = scene.narration!;
      const endMs  = n.start_ms + n.duration_ms;
      const covPct = scene.duration_ms > 0
        ? Math.round((n.duration_ms / scene.duration_ms) * 100)
        : 0;
      void arr;
      return {
        key: `nar-${scene.scene_id}`,
        startMs: n.start_ms,
        endMs,
        barClass: 'bg-green-500',
        textClass: 'text-white',
        label: `${covPct}%`,
        tooltipTitle: `Narration — Scene ${scene.scene_order}`,
        tooltipLines: [
          `${fmtMs(n.start_ms)} → ${fmtMs(endMs)}`,
          `Duration: ${(n.duration_ms / 1000).toFixed(1)}s`,
          `Coverage: ${covPct}% of scene`,
          ...(n.word_timings?.length ? [`${n.word_timings.length} word timings`] : []),
        ],
        selection: { type: 'narration', sceneIndex } as BlockSelection,
      };
    });
}

function buildCaptionBlocks(scenes: RenderTimelineScene[]): Block[] {
  const blocks: Block[] = [];
  scenes.forEach((scene, sceneIndex) => {
    (scene.captions ?? []).forEach((cap, itemIndex) => {
      blocks.push({
        key: `cap-${scene.scene_id}-${itemIndex}`,
        startMs: cap.start_ms,
        endMs: cap.end_ms,
        barClass: 'bg-amber-400',
        textClass: 'text-white',
        label: cap.text.length > 14 ? cap.text.slice(0, 14) + '…' : cap.text,
        tooltipTitle: `Caption ${itemIndex + 1} — Scene ${scene.scene_order}`,
        tooltipLines: [
          `"${cap.text}"`,
          `${fmtMs(cap.start_ms)} → ${fmtMs(cap.end_ms)}`,
          `Duration: ${((cap.end_ms - cap.start_ms) / 1000).toFixed(1)}s`,
        ],
        selection: { type: 'caption', sceneIndex, itemIndex } as BlockSelection,
      });
    });
  });
  return blocks;
}

function buildScreenshotBlocks(scenes: RenderTimelineScene[]): Block[] {
  const blocks: Block[] = [];
  scenes.forEach((scene, sceneIndex) => {
    (scene.screenshot_overlays ?? []).forEach((ov, itemIndex) => {
      blocks.push({
        key: `ss-${scene.scene_id}-${itemIndex}`,
        startMs: ov.display_start_ms,
        endMs: ov.display_end_ms,
        barClass: 'bg-blue-400',
        textClass: 'text-white',
        label: ov.screenshot_role,
        tooltipTitle: `Screenshot — Scene ${scene.scene_order}`,
        tooltipLines: [
          `Role: ${ov.screenshot_role}`,
          `${fmtMs(ov.display_start_ms)} → ${fmtMs(ov.display_end_ms)}`,
          `Duration: ${((ov.display_end_ms - ov.display_start_ms) / 1000).toFixed(1)}s`,
        ],
        selection: { type: 'screenshot', sceneIndex, itemIndex } as BlockSelection,
      });
    });
  });
  return blocks;
}

function buildCalloutBlocks(scenes: RenderTimelineScene[]): Block[] {
  return scenes
    .filter(s => s.callout)
    .map(scene => {
      const sceneIndex = scenes.indexOf(scene);
      const c = scene.callout!;
      const endMs = c.start_ms + c.duration_ms;
      return {
        key: `call-${scene.scene_id}`,
        startMs: c.start_ms,
        endMs,
        barClass: 'bg-rose-400',
        textClass: 'text-white',
        label: c.title,
        tooltipTitle: `Callout — Scene ${scene.scene_order}`,
        tooltipLines: [
          c.title,
          ...(c.description ? [c.description] : []),
          `${fmtMs(c.start_ms)} → ${fmtMs(endMs)}`,
          `Duration: ${(c.duration_ms / 1000).toFixed(1)}s`,
        ],
        selection: { type: 'callout', sceneIndex } as BlockSelection,
      };
    });
}

function buildZoomBlocks(scenes: RenderTimelineScene[]): Block[] {
  const blocks: Block[] = [];
  scenes.forEach((scene, sceneIndex) => {
    if (scene.zoom_effect) {
      const z = scene.zoom_effect;
      const endMs = z.start_ms + z.duration_ms;
      blocks.push({
        key: `zoom-${scene.scene_id}`,
        startMs: z.start_ms,
        endMs,
        barClass: 'bg-orange-400',
        textClass: 'text-white',
        label: 'zoom',
        tooltipTitle: `Zoom Effect — Scene ${scene.scene_order}`,
        tooltipLines: [
          `${fmtMs(z.start_ms)} → ${fmtMs(endMs)}`,
          `Duration: ${(z.duration_ms / 1000).toFixed(1)}s`,
          `Region: x${z.region.x} y${z.region.y}  ${z.region.width}×${z.region.height}`,
        ],
        selection: { type: 'zoom', sceneIndex } as BlockSelection,
      });
    }
    if (scene.highlight_effect) {
      const h = scene.highlight_effect;
      const endMs = h.start_ms + h.duration_ms;
      blocks.push({
        key: `hl-${scene.scene_id}`,
        startMs: h.start_ms,
        endMs,
        barClass: 'bg-yellow-400',
        textClass: 'text-slate-800',
        label: 'highlight',
        tooltipTitle: `Highlight Effect — Scene ${scene.scene_order}`,
        tooltipLines: [
          `${fmtMs(h.start_ms)} → ${fmtMs(endMs)}`,
          `Duration: ${(h.duration_ms / 1000).toFixed(1)}s`,
          `Region: x${h.region.x} y${h.region.y}  ${h.region.width}×${h.region.height}`,
        ],
        selection: { type: 'highlight', sceneIndex } as BlockSelection,
      });
    }
  });
  return blocks;
}

// ─── Legend ───────────────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { label: 'Scene',       cls: 'bg-blue-500' },
  { label: 'Transition',  cls: 'bg-slate-400' },
  { label: 'Narration',   cls: 'bg-green-500' },
  { label: 'Caption',     cls: 'bg-amber-400' },
  { label: 'Screenshot',  cls: 'bg-blue-400' },
  { label: 'Callout',     cls: 'bg-rose-400' },
  { label: 'Zoom',        cls: 'bg-orange-400' },
  { label: 'Highlight',   cls: 'bg-yellow-400' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  manifest: RenderManifest;
  selectedBlock?: BlockSelection | null;
  onBlockSelect?: (sel: BlockSelection | null) => void;
}

const ZOOM_LEVELS = [1, 2, 4, 8] as const;

export function RenderTimelinePreview({ manifest, selectedBlock, onBlockSelect }: Props) {
  const scenes = manifest?.scenes ?? [];
  const totalMs = manifest?.total_duration_ms ?? 0;
  const [zoom, setZoom]            = useState(1);
  const [showLegend, setShowLegend] = useState(false);
  const [editMode, setEditMode]    = useState(false);
  const [tooltip, setTooltip]      = useState<TooltipState>({
    visible: false, x: 0, y: 0, title: '', lines: [],
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleHover = useCallback(
    (e: React.MouseEvent, title: string, lines: string[]) => {
      setTooltip({ visible: true, x: e.clientX, y: e.clientY, title, lines });
    },
    [],
  );

  const handleLeave = useCallback(() => {
    setTooltip(t => ({ ...t, visible: false }));
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltip(t => t.visible ? { ...t, x: e.clientX, y: e.clientY } : t);
  }, []);

  const handleBlockClick = useCallback((sel: BlockSelection) => {
    if (!onBlockSelect) return;
    if (selectedBlock && selectionMatches(sel, selectedBlock)) {
      onBlockSelect(null);
    } else {
      onBlockSelect(sel);
    }
  }, [onBlockSelect, selectedBlock]);

  const handleToggleEditMode = () => {
    const next = !editMode;
    setEditMode(next);
    if (!next && onBlockSelect) onBlockSelect(null);
  };

  const sceneBlocks  = buildSceneBlocks(scenes);
  const transBlocks  = buildTransitionBlocks(scenes);
  const narBlocks    = buildNarrationBlocks(scenes);
  const capBlocks    = buildCaptionBlocks(scenes);
  const ssBlocks     = buildScreenshotBlocks(scenes);
  const callBlocks   = buildCalloutBlocks(scenes);
  const zoomBlocks   = buildZoomBlocks(scenes);

  const allTracks: TrackEntry[] = [
    { id: 'scenes',      label: 'Scenes',      Icon: Film,          height: TRACK_H.scenes,      blocks: sceneBlocks  },
    { id: 'transitions', label: 'Transitions', Icon: ChevronRight,  height: TRACK_H.transitions, blocks: transBlocks  },
    { id: 'narration',   label: 'Narration',   Icon: Volume2,       height: TRACK_H.narration,   blocks: narBlocks    },
    { id: 'captions',    label: 'Captions',    Icon: Captions,      height: TRACK_H.captions,    blocks: capBlocks    },
    { id: 'screenshots', label: 'Screenshots', Icon: Image,         height: TRACK_H.screenshots, blocks: ssBlocks     },
    { id: 'callouts',    label: 'Callouts',    Icon: Megaphone,     height: TRACK_H.callouts,    blocks: callBlocks   },
    { id: 'zoom',        label: 'Zoom',        Icon: MoveHorizontal,height: TRACK_H.zoom,        blocks: zoomBlocks   },
  ].filter(t =>
    t.id === 'scenes' || t.blocks.length > 0,
  );

  const tracksHeight = allTracks.reduce((sum, t) => sum + t.height, 0);
  const canEdit = !!onBlockSelect;

  return (
    <div className="space-y-2" onMouseMove={handleMouseMove}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film size={14} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Timeline</span>
          <span className="text-xs text-slate-400 tabular-nums">
            {manifest?.scene_count ?? scenes.length} {(manifest?.scene_count ?? scenes.length) === 1 ? 'scene' : 'scenes'} · {(totalMs / 1000).toFixed(1)}s total
          </span>
          {editMode && (
            <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
              Edit mode — click a block to edit its timing
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLegend(v => !v)}
            className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded transition-colors"
          >
            {showLegend ? 'Hide legend' : 'Legend'}
          </button>

          {canEdit && (
            <button
              onClick={handleToggleEditMode}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                editMode
                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {editMode ? <Eye size={11} /> : <Pencil size={11} />}
              {editMode ? 'View' : 'Edit'}
            </button>
          )}

          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white divide-x divide-slate-200">
            <button
              onClick={() => setZoom(z => Math.max(1, z / 2) as typeof z)}
              disabled={zoom === 1}
              title="Zoom out"
              className="p-1.5 hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              <ZoomOut size={11} className="text-slate-600" />
            </button>
            {ZOOM_LEVELS.map(level => (
              <button
                key={level}
                onClick={() => { setZoom(level); scrollRef.current?.scrollTo({ left: 0 }); }}
                className={`text-[10px] font-medium px-2 py-1 transition-colors ${
                  zoom === level
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                {level === 1 ? 'Fit' : `${level}×`}
              </button>
            ))}
            <button
              onClick={() => setZoom(z => Math.min(8, z * 2) as typeof z)}
              disabled={zoom === 8}
              title="Zoom in"
              className="p-1.5 hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              <ZoomIn size={11} className="text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      {showLegend && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200">
          {LEGEND_ITEMS.map(item => (
            <span key={item.label} className="flex items-center gap-1.5 text-[10px] text-slate-600">
              <span className={`w-2.5 h-2.5 rounded ${item.cls} flex-shrink-0`} />
              {item.label}
            </span>
          ))}
        </div>
      )}

      {/* ── Timeline ── */}
      <div
        className={`border rounded-xl overflow-hidden bg-white transition-colors ${
          editMode ? 'border-blue-300' : 'border-slate-200'
        }`}
      >
        <div className="flex">
          {/* Left: frozen label column */}
          <div
            className="flex-shrink-0 bg-slate-50 border-r border-slate-200 z-10"
            style={{ width: LABEL_W }}
          >
            {/* Ruler spacer */}
            <div
              className="border-b border-slate-200"
              style={{ height: RULER_H }}
            />
            {/* Track labels */}
            {allTracks.map(track => {
              const TrackIcon = track.Icon;
              return (
                <div
                  key={track.id}
                  className="flex items-center gap-1.5 px-2.5 border-b border-slate-100 last:border-b-0"
                  style={{ height: track.height }}
                >
                  {TrackIcon
                    ? <TrackIcon size={10} className="text-slate-400 flex-shrink-0" />
                    : <span className="w-2.5 flex-shrink-0" />
                  }
                  <span className="text-[10px] text-slate-500 font-medium truncate leading-none">
                    {track.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Right: scrollable timeline area */}
          <div
            className="flex-1 overflow-x-auto"
            ref={scrollRef}
            style={{ scrollBehavior: 'smooth' }}
          >
            <div style={{ width: `${zoom * 100}%`, minWidth: '100%' }}>
              {/* Time ruler */}
              <TimelineRuler totalMs={totalMs} zoom={zoom} />

              {/* Tracks + scene boundary lines */}
              <div className="relative" style={{ height: tracksHeight }}>
                <SceneBoundaries
                  scenes={scenes}
                  totalMs={totalMs}
                  totalHeight={tracksHeight}
                />
                {allTracks.map(track => (
                  <TrackRow
                    key={track.id}
                    height={track.height}
                    totalMs={totalMs}
                    blocks={track.blocks}
                    editMode={editMode}
                    selectedBlock={selectedBlock ?? null}
                    onHover={handleHover}
                    onLeave={handleLeave}
                    onBlockClick={handleBlockClick}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating tooltip (fixed, outside scroll context) */}
      <Tooltip state={tooltip} />
    </div>
  );
}
