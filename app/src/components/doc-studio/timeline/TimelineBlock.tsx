import React, { useRef, useState } from 'react';
import { TimelineBlockData, HANDLE_W, msToTimecode } from './timelineUtils';

interface Props {
  block: TimelineBlockData;
  pxPerSec: number;
  selected: boolean;
  overrideStartMs?: number;
  overrideEndMs?: number;
  onSelect: (key: string) => void;
  onDragStart: (
    e: React.MouseEvent,
    block: TimelineBlockData,
    mode: 'move' | 'resize-left' | 'resize-right',
  ) => void;
  readOnly?: boolean;
}

export default function TimelineBlock({
  block,
  pxPerSec,
  selected,
  overrideStartMs,
  overrideEndMs,
  onSelect,
  onDragStart,
  readOnly,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const startMs = overrideStartMs ?? block.startMs;
  const endMs   = overrideEndMs   ?? block.endMs;
  const pxPerMs = pxPerSec / 1000;

  const left  = startMs * pxPerMs;
  const width = Math.max(2, (endMs - startMs) * pxPerMs);

  const MIN_LABEL_WIDTH = 32;
  const showLabel = width > MIN_LABEL_WIDTH;

  function handleMouseDown(e: React.MouseEvent, mode: 'move' | 'resize-left' | 'resize-right') {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(block.key);
    onDragStart(e, block, mode);
  }

  function handleMouseEnter() {
    setHovered(true);
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    }
  }

  const isSelected = selected;
  const borderColor = isSelected ? '#fff' : block.color;
  const shadow = isSelected ? '0 0 0 2px rgba(255,255,255,0.8)' : hovered ? '0 0 0 1px rgba(255,255,255,0.4)' : 'none';

  return (
    <>
      <div
        ref={ref}
        role="button"
        aria-selected={isSelected}
        aria-label={block.label}
        style={{
          position: 'absolute',
          left,
          width,
          top: 3,
          bottom: 3,
          backgroundColor: block.bgColor,
          border: `1px solid ${borderColor}`,
          borderRadius: 3,
          boxShadow: shadow,
          cursor: readOnly ? 'default' : 'grab',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          transition: 'box-shadow 0.1s',
          userSelect: 'none',
          zIndex: isSelected ? 2 : 1,
        }}
        onMouseDown={(event) => handleMouseDown(event, 'move')}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => { setHovered(false); setTooltip(null); }}
        onClick={() => onSelect(block.key)}
      >
        {/* Left resize handle */}
        {!readOnly && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: HANDLE_W,
              cursor: 'ew-resize',
              backgroundColor: hovered || isSelected ? 'rgba(255,255,255,0.25)' : 'transparent',
              borderRadius: '3px 0 0 3px',
              zIndex: 3,
            }}
            onMouseDown={e => handleMouseDown(e, 'resize-left')}
          />
        )}

        {/* Block label */}
        {showLabel && (
          <span
            style={{
              paddingLeft: HANDLE_W + 4,
              paddingRight: HANDLE_W + 4,
              fontSize: 10,
              fontWeight: 600,
              color: block.color,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              pointerEvents: 'none',
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            {block.label}
          </span>
        )}

        {/* Right resize handle */}
        {!readOnly && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: HANDLE_W,
              cursor: 'ew-resize',
              backgroundColor: hovered || isSelected ? 'rgba(255,255,255,0.25)' : 'transparent',
              borderRadius: '0 3px 3px 0',
              zIndex: 3,
            }}
            onMouseDown={e => handleMouseDown(e, 'resize-right')}
          />
        )}
      </div>

      {/* Floating tooltip */}
      {hovered && tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 11,
            color: '#e2e8f0',
            whiteSpace: 'pre',
            pointerEvents: 'none',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            lineHeight: 1.6,
          }}
        >
          {block.tooltip}
          <div style={{ color: '#64748b', marginTop: 2, fontSize: 10 }}>
            {msToTimecode(startMs)} → {msToTimecode(endMs)}
          </div>
        </div>
      )}
    </>
  );
}
