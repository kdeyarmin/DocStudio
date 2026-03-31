import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ZoomIn, ZoomOut, Magnet, Save, RotateCcw, Play, ChevronRight,
} from 'lucide-react';
import { RenderManifest } from '../../../types/documentation';
import TimelineBlock from './TimelineBlock';
import TimelinePropertiesPanel from './TimelinePropertiesPanel';
import {
  DragState,
  LEFT_PANEL_W, RULER_H, TRACK_H,
  TRACK_COLORS, TRACK_LABELS, TrackType,
  ZOOM_LEVELS, ZoomLevel,
  TimelineBlockData,
  applyBlockEdit, extractBlocks, visibleTracks,
  clamp, msToTimecode, msToSec, rulerInterval,
} from './timelineUtils';

interface Props {
  manifest: RenderManifest | null;
  onManifestChange?: (updated: RenderManifest) => void;
  readOnly?: boolean;
}

interface DragOverride { key: string; startMs: number; endMs: number }

// ─── Sub-components ───────────────────────────────────────────────────────────

function TimeRuler({ totalMs, pxPerSec }: { totalMs: number; pxPerSec: number }) {
  const intervalMs = rulerInterval(pxPerSec);
  const pxPerMs    = pxPerSec / 1000;
  const tickCount  = Math.ceil(totalMs / intervalMs) + 1;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: RULER_H,
      backgroundColor: '#0a1628',
      borderBottom: '1px solid #1e293b',
    }}>
      {Array.from({ length: tickCount }, (_, i) => {
        const tickMs = i * intervalMs;
        const x = tickMs * pxPerMs;
        const isMajor = i % 2 === 0;
        return (
          <React.Fragment key={i}>
            <div style={{
              position: 'absolute', left: x,
              top: isMajor ? 8 : 14,
              bottom: 0,
              width: 1,
              backgroundColor: isMajor ? '#334155' : '#1e293b',
            }} />
            {isMajor && (
              <span style={{
                position: 'absolute', left: x + 3,
                top: 5, fontSize: 9,
                color: '#475569', fontFamily: 'monospace',
                userSelect: 'none', pointerEvents: 'none',
              }}>
                {msToTimecode(tickMs).slice(0, 5)}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function SceneBoundaries({ scenes, pxPerSec }: {
  scenes: RenderManifest['scenes'];
  pxPerSec: number;
}) {
  return (
    <>
      {scenes.map((scene, i) => {
        const x = scene.start_ms * (pxPerSec / 1000);
        return (
          <div key={i} style={{
            position: 'absolute', left: x,
            top: RULER_H, bottom: 0,
            width: 1,
            backgroundColor: '#1e3a5f',
            pointerEvents: 'none',
            zIndex: 0,
          }} />
        );
      })}
    </>
  );
}

function SceneLabels({ scenes, pxPerSec }: {
  scenes: RenderManifest['scenes'];
  pxPerSec: number;
}) {
  return (
    <>
      {scenes.map((scene, i) => {
        const x = scene.start_ms * (pxPerSec / 1000);
        const w = scene.duration_ms * (pxPerSec / 1000);
        return (
          <div key={i} style={{
            position: 'absolute', left: x, width: w,
            top: RULER_H + 1,
            height: 16,
            display: 'flex', alignItems: 'center',
            paddingLeft: 4, paddingRight: 4,
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 0,
          }}>
            {w > 40 && (
              <span style={{
                fontSize: 9, color: '#1d4ed8',
                fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap', overflow: 'hidden',
              }}>
                S{i + 1}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export default function RenderTimelineEditor({ manifest, onManifestChange, readOnly }: Props) {
  const [localManifest, setLocalManifest] = useState<RenderManifest | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [pxPerSec, setPxPerSec] = useState<ZoomLevel>(40);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dragOverride, setDragOverride] = useState<DragOverride | null>(null);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);
  const isPlayheadDragRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync incoming manifest → local copy
  useEffect(() => {
    if (manifest) {
      setLocalManifest(manifest);
      setIsDirty(false);
    }
  }, [manifest]);

  const m = localManifest;
  const totalMs  = m?.total_duration_ms ?? 0;
  const totalPx  = Math.max(totalMs * (pxPerSec / 1000), 600);
  const tracks   = useMemo(() => m ? visibleTracks(m) : [], [m]);
  const allBlocks = useMemo(() => m ? extractBlocks(m) : [], [m]);

  const blocksByTrack = useMemo(() => {
    const map: Partial<Record<TrackType, TimelineBlockData[]>> = {};
    for (const b of allBlocks) {
      (map[b.trackType as TrackType] ??= []).push(b);
    }
    return map;
  }, [allBlocks]);

  const selectedBlock = allBlocks.find(b => b.key === selectedKey) ?? null;

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleBlockDragStart = useCallback((
    e: React.MouseEvent,
    block: TimelineBlockData,
    mode: 'move' | 'resize-left' | 'resize-right',
  ) => {
    if (readOnly) return;
    const scene = m?.scenes[block.sceneIndex];
    dragStateRef.current = {
      blockKey: block.key,
      sceneIndex: block.sceneIndex,
      itemIndex: block.itemIndex,
      trackType: block.trackType,
      mode,
      startClientX: e.clientX,
      origStartMs: block.startMs,
      origEndMs: block.endMs,
      sceneStartMs: scene?.start_ms ?? 0,
      sceneEndMs: scene?.end_ms ?? totalMs,
    };
  }, [readOnly, m, totalMs]);

  // Playhead drag: click on ruler to set position
  function handleRulerClick(e: React.MouseEvent) {
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
    const ms = clamp(x * (1000 / pxPerSec), 0, totalMs);
    setPlayheadMs(ms);
  }

  function handlePlayheadMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    isPlayheadDragRef.current = true;
  }

  // ── Window-level mouse events for drag ─────────────────────────────────────

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      // Block drag
      if (dragStateRef.current) {
        const ds = dragStateRef.current;
        const deltaX = e.clientX - ds.startClientX;
        const pxPerMs = pxPerSec / 1000;
        const deltaMs = deltaX / pxPerMs;
        const duration = ds.origEndMs - ds.origStartMs;

        const lo = ds.trackType === 'scene' ? 0 : ds.sceneStartMs;
        const hi = ds.trackType === 'scene' ? totalMs : ds.sceneEndMs;

        let newStart = ds.origStartMs;
        let newEnd   = ds.origEndMs;

        switch (ds.mode) {
          case 'move':
            newStart = clamp(ds.origStartMs + deltaMs, lo, hi - duration);
            newEnd   = newStart + duration;
            break;
          case 'resize-left':
            newStart = clamp(ds.origStartMs + deltaMs, lo, ds.origEndMs - 50);
            break;
          case 'resize-right':
            newEnd = clamp(ds.origEndMs + deltaMs, ds.origStartMs + 50, hi);
            break;
        }

        setDragOverride({ key: ds.blockKey, startMs: newStart, endMs: newEnd });
        return;
      }

      // Playhead drag
      if (isPlayheadDragRef.current && scrollRef.current) {
        const rect = scrollRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
        setPlayheadMs(clamp(x * (1000 / pxPerSec), 0, totalMs));
      }
    }

    function onMouseUp() {
      // Commit block drag
      if (dragStateRef.current && dragOverride) {
        const { blockKey: key } = dragStateRef.current;
        if (m && dragOverride.key === key) {
          const updated = applyBlockEdit(m, key, dragOverride.startMs, dragOverride.endMs);
          setLocalManifest(updated);
          setIsDirty(true);
        }
        setDragOverride(null);
        dragStateRef.current = null;
      } else {
        dragStateRef.current = null;
        setDragOverride(null);
      }
      isPlayheadDragRef.current = false;
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [pxPerSec, totalMs, m, dragOverride]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') setSelectedKey(null);
      if (e.key === 'ArrowRight') setPlayheadMs(p => clamp(p + 1000, 0, totalMs));
      if (e.key === 'ArrowLeft')  setPlayheadMs(p => clamp(p - 1000, 0, totalMs));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [totalMs]);

  // ── Properties panel handlers ───────────────────────────────────────────────

  function handleApplyEdit(blockKey: string, newStartMs: number, newEndMs: number) {
    if (!m) return;
    const updated = applyBlockEdit(m, blockKey, newStartMs, newEndMs);
    setLocalManifest(updated);
    setIsDirty(true);
    setSelectedKey(blockKey);
  }

  function handleSave() {
    if (!localManifest || !onManifestChange) return;
    onManifestChange(localManifest);
    setIsDirty(false);
  }

  function handleReset() {
    if (manifest) {
      setLocalManifest(manifest);
      setIsDirty(false);
      setSelectedKey(null);
    }
  }

  // ── Zoom ────────────────────────────────────────────────────────────────────

  function zoomIn() {
    const idx = ZOOM_LEVELS.indexOf(pxPerSec);
    if (idx < ZOOM_LEVELS.length - 1) setPxPerSec(ZOOM_LEVELS[idx + 1]);
  }
  function zoomOut() {
    const idx = ZOOM_LEVELS.indexOf(pxPerSec);
    if (idx > 0) setPxPerSec(ZOOM_LEVELS[idx - 1]);
  }

  // ── Playhead pixel position ──────────────────────────────────────────────────

  const playheadPx = playheadMs * (pxPerSec / 1000);

  if (!m) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 240, color: '#475569', fontSize: 13,
        backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
      }}>
        No render manifest loaded. Run the assembly pipeline to generate timeline data.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex', flexDirection: 'row',
        height: '100%', minHeight: 380,
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 8,
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ── Timeline Column ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 12px',
          borderBottom: '1px solid #1e293b',
          backgroundColor: '#0a1628',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          {/* Draft title */}
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginRight: 8 }}>
            {m.draft_title}
          </span>

          {/* Playhead time */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            backgroundColor: '#1e293b', borderRadius: 4,
            padding: '3px 8px', fontSize: 11,
            color: '#94a3b8', fontFamily: 'monospace',
          }}>
            <Play size={10} style={{ color: '#3b82f6' }} />
            {msToTimecode(playheadMs)}
            <span style={{ color: '#475569' }}>/</span>
            {msToTimecode(totalMs)}
          </div>

          <div style={{ flex: 1 }} />

          {/* Snap toggle */}
          <button
            onClick={() => setSnapEnabled(s => !s)}
            title="Snap to scene boundaries"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', borderRadius: 4,
              border: snapEnabled ? '1px solid #3b82f6' : '1px solid #334155',
              backgroundColor: snapEnabled ? '#1d3a6e' : 'transparent',
              color: snapEnabled ? '#93c5fd' : '#64748b',
              cursor: 'pointer', fontSize: 11, fontWeight: 600,
            }}
          >
            <Magnet size={12} />
            Snap
          </button>

          {/* Zoom controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <button
              onClick={zoomOut}
              disabled={pxPerSec === ZOOM_LEVELS[0]}
              title="Zoom out"
              style={{
                padding: '4px 8px', borderRadius: '4px 0 0 4px',
                border: '1px solid #334155',
                backgroundColor: 'transparent', color: pxPerSec === ZOOM_LEVELS[0] ? '#334155' : '#94a3b8',
                cursor: pxPerSec === ZOOM_LEVELS[0] ? 'default' : 'pointer',
              }}
            >
              <ZoomOut size={13} />
            </button>
            <div style={{
              padding: '4px 10px',
              borderTop: '1px solid #334155', borderBottom: '1px solid #334155',
              fontSize: 11, color: '#64748b', fontFamily: 'monospace',
              backgroundColor: '#0f172a',
            }}>
              {pxPerSec}px/s
            </div>
            <button
              onClick={zoomIn}
              disabled={pxPerSec === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
              title="Zoom in"
              style={{
                padding: '4px 8px', borderRadius: '0 4px 4px 0',
                border: '1px solid #334155',
                backgroundColor: 'transparent',
                color: pxPerSec === ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ? '#334155' : '#94a3b8',
                cursor: pxPerSec === ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ? 'default' : 'pointer',
              }}
            >
              <ZoomIn size={13} />
            </button>
          </div>

          {/* Save/Reset (only if editable) */}
          {!readOnly && onManifestChange && (
            <>
              {isDirty && (
                <button
                  onClick={handleReset}
                  title="Discard changes"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 8px', borderRadius: 4,
                    border: '1px solid #334155', backgroundColor: 'transparent',
                    color: '#64748b', cursor: 'pointer', fontSize: 11,
                  }}
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={!isDirty}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 4,
                  border: 'none',
                  backgroundColor: isDirty ? '#1d4ed8' : '#1e293b',
                  color: isDirty ? '#fff' : '#334155',
                  cursor: isDirty ? 'pointer' : 'default',
                  fontSize: 11, fontWeight: 600,
                }}
              >
                <Save size={12} />
                {isDirty ? 'Save Changes' : 'Saved'}
              </button>
            </>
          )}
        </div>

        {/* Timeline body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Frozen left labels */}
          <div style={{
            width: LEFT_PANEL_W,
            minWidth: LEFT_PANEL_W,
            flexShrink: 0,
            backgroundColor: '#0a1628',
            borderRight: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Ruler spacer */}
            <div style={{
              height: RULER_H,
              borderBottom: '1px solid #1e293b',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              paddingRight: 8,
            }}>
              <span style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace' }}>
                {m.scene_count} scenes
              </span>
            </div>

            {/* Track labels */}
            {tracks.map(track => (
              <div key={track} style={{
                height: TRACK_H,
                display: 'flex', alignItems: 'center',
                paddingLeft: 10, paddingRight: 8,
                borderBottom: '1px solid #1e293b',
                gap: 6,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                  backgroundColor: TRACK_COLORS[track as TrackType].border,
                }} />
                <span style={{
                  fontSize: 10, fontWeight: 600, color: '#64748b',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {TRACK_LABELS[track as TrackType]}
                </span>
              </div>
            ))}
          </div>

          {/* Scrollable track area */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowX: 'auto',
              overflowY: 'hidden',
              position: 'relative',
            }}
            onClick={() => setSelectedKey(null)}
          >
            <div style={{
              position: 'relative',
              width: totalPx,
              height: RULER_H + tracks.length * TRACK_H,
            }}>

              {/* Time ruler */}
              <div
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: RULER_H, cursor: 'pointer', zIndex: 10,
                }}
                onClick={handleRulerClick}
              >
                <TimeRuler totalMs={totalMs} pxPerSec={pxPerSec} />
              </div>

              {/* Scene boundary lines */}
              <SceneBoundaries
                scenes={m.scenes}
                pxPerSec={pxPerSec}
              />

              {/* Scene index labels (inline behind scene track) */}
              <SceneLabels scenes={m.scenes} pxPerSec={pxPerSec} />

              {/* Track rows */}
              {tracks.map((track, ti) => {
                const top = RULER_H + ti * TRACK_H;
                const blocks = blocksByTrack[track] ?? [];
                return (
                  <div key={track} style={{
                    position: 'absolute',
                    top,
                    left: 0,
                    right: 0,
                    height: TRACK_H,
                    borderBottom: '1px solid #1e293b',
                    backgroundColor: ti % 2 === 0 ? '#080f1e' : '#0b1629',
                  }}>
                    {blocks.map(block => (
                      <TimelineBlock
                        key={block.key}
                        block={block}
                        pxPerSec={pxPerSec}
                        selected={selectedKey === block.key}
                        overrideStartMs={dragOverride?.key === block.key ? dragOverride.startMs : undefined}
                        overrideEndMs={dragOverride?.key === block.key ? dragOverride.endMs : undefined}
                        onSelect={setSelectedKey}
                        onDragStart={handleBlockDragStart}
                        readOnly={readOnly}
                      />
                    ))}
                  </div>
                );
              })}

              {/* Playhead */}
              <div
                style={{
                  position: 'absolute',
                  left: playheadPx,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  backgroundColor: '#ef4444',
                  zIndex: 20,
                  pointerEvents: 'none',
                }}
              >
                {/* Playhead handle */}
                <div
                  onMouseDown={handlePlayheadMouseDown}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: -5,
                    width: 12,
                    height: RULER_H,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'ew-resize',
                    pointerEvents: 'auto',
                  }}
                >
                  <ChevronRight
                    size={10}
                    style={{ color: '#ef4444', transform: 'rotate(90deg)', marginTop: 2 }}
                  />
                  <div style={{ flex: 1, width: 2, backgroundColor: '#ef4444' }} />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Status bar */}
        <div style={{
          height: 24,
          display: 'flex', alignItems: 'center',
          padding: '0 12px',
          borderTop: '1px solid #1e293b',
          backgroundColor: '#0a1628',
          gap: 16,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace' }}>
            Total: {msToSec(totalMs).toFixed(1)}s
          </span>
          <span style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace' }}>
            Scenes: {m.scene_count}
          </span>
          <span style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace' }}>
            Zoom: {pxPerSec}px/s
          </span>
          {isDirty && (
            <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>
              ● Unsaved changes
            </span>
          )}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: '#1e293b' }}>
            ← → Arrow keys navigate · Click ruler to set playhead · Click block to inspect
          </span>
        </div>
      </div>

      {/* ── Properties Panel ── */}
      <TimelinePropertiesPanel
        block={selectedBlock}
        manifest={m}
        onApply={handleApplyEdit}
        onClose={() => setSelectedKey(null)}
      />
    </div>
  );
}
