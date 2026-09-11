import { useState } from 'react';
import { X, Check, TriangleAlert as AlertTriangle } from 'lucide-react';
import {
  TimelineBlockData,
  TrackType,
  TRACK_LABELS,
  TRACK_COLORS,
  msToTimecode,
  msToSec,
  secToMs,
} from './timelineUtils';
import { RenderManifest } from '../../../types/documentation';

interface Props {
  block: TimelineBlockData | null;
  manifest: RenderManifest;
  onApply: (blockKey: string, newStartMs: number, newEndMs: number) => void;
  onClose: () => void;
}

type FieldValues = { startSec: string; durationSec: string };

function getInitialValues(block: TimelineBlockData): FieldValues {
  return {
    startSec:    msToSec(block.startMs).toFixed(3),
    durationSec: msToSec(block.endMs - block.startMs).toFixed(3),
  };
}

function validateValues(
  vals: FieldValues,
  block: TimelineBlockData,
  manifest: RenderManifest,
): string[] {
  const errors: string[] = [];
  const start = parseFloat(vals.startSec);
  const dur   = parseFloat(vals.durationSec);

  if (isNaN(start))  errors.push('Start time must be a number');
  if (isNaN(dur))    errors.push('Duration must be a number');
  if (!isNaN(dur) && dur <= 0)  errors.push('Duration must be greater than 0');
  if (!isNaN(start) && start < 0) errors.push('Start time cannot be negative');

  const totalSec = msToSec(manifest.total_duration_ms);
  if (!isNaN(start) && !isNaN(dur) && start + dur > totalSec) {
    errors.push(`Block extends beyond total duration (${totalSec.toFixed(1)}s)`);
  }

  if (block.trackType !== 'scene') {
    const scene = manifest.scenes[block.sceneIndex];
    if (scene) {
      const sceneDurSec = msToSec(scene.duration_ms);
      const relStart = start - msToSec(scene.start_ms);
      if (!isNaN(relStart) && relStart < 0) {
        errors.push('Block starts before its scene');
      }
      if (!isNaN(relStart) && !isNaN(dur) && relStart + dur > sceneDurSec) {
        errors.push(`Block extends beyond scene end (scene is ${sceneDurSec.toFixed(1)}s)`);
      }
    }
  }

  return errors;
}

export default function TimelinePropertiesPanel(props: Props) {
  return <TimelinePropertiesEditor key={`${props.manifest.render_project_id}:${props.block?.key ?? ''}`} {...props} />;
}

function TimelinePropertiesEditor({ block, manifest, onApply, onClose }: Props) {
  const [local, setVals] = useState<FieldValues | null>(null);
  const vals = local ?? (block ? getInitialValues(block) : { startSec: '0', durationSec: '1' });
  const isDirty = local !== null;
  // Revalidate against the current manifest even if only its scene limits changed.
  const errors = isDirty && block ? validateValues(vals, block, manifest) : [];

  function handleChange(field: keyof FieldValues, value: string) {
    const next = { ...vals, [field]: value };
    setVals(next);
  }

  function handleApply() {
    if (!block || errors.length > 0) return;
    const start = secToMs(parseFloat(vals.startSec));
    const dur   = secToMs(parseFloat(vals.durationSec));
    onApply(block.key, start, start + dur);
    setVals(null);
  }

  if (!block) {
    return (
      <div style={{
        width: 260,
        minWidth: 260,
        backgroundColor: '#0f172a',
        borderLeft: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        color: '#475569',
        fontSize: 13,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>⟵</div>
        <div style={{ fontWeight: 600, marginBottom: 4, color: '#64748b' }}>No Block Selected</div>
        <div>Click a block on the timeline to inspect and edit its timing.</div>
      </div>
    );
  }

  const colors = TRACK_COLORS[block.trackType];
  const scene  = manifest.scenes[block.sceneIndex];
  const startSec   = parseFloat(vals.startSec);
  const durSec     = parseFloat(vals.durationSec);
  const endTimecode = (!isNaN(startSec) && !isNaN(durSec))
    ? msToTimecode(secToMs(startSec + durSec))
    : '—';

  const sceneInfo = scene
    ? `Scene ${block.sceneIndex + 1}: ${msToTimecode(scene.start_ms)} – ${msToTimecode(scene.end_ms)}`
    : null;

  return (
    <div style={{
      width: 260,
      minWidth: 260,
      backgroundColor: '#0f172a',
      borderLeft: '1px solid #1e293b',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid #1e293b',
        backgroundColor: '#0a1628',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 10, height: 10, borderRadius: 2,
            backgroundColor: colors.border, flexShrink: 0,
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
            {TRACK_LABELS[block.trackType as TrackType]}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#64748b', padding: 2, display: 'flex', alignItems: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Block label */}
      <div style={{ padding: '10px 14px 0', borderBottom: '1px solid #1e293b', paddingBottom: 10 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: '#94a3b8',
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
        }}>
          Block
        </div>
        <div style={{
          fontSize: 12, color: '#e2e8f0',
          backgroundColor: '#1e293b', borderRadius: 4,
          padding: '5px 8px', wordBreak: 'break-word',
        }}>
          {block.label}
        </div>
      </div>

      {/* Scene context */}
      {sceneInfo && (
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace' }}>
            {sceneInfo}
          </div>
        </div>
      )}

      {/* Fields */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        <div>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 600,
            color: '#64748b', textTransform: 'uppercase',
            letterSpacing: '0.05em', marginBottom: 6,
          }}>
            Start Time (seconds)
          </label>
          <input
            type="number"
            value={vals.startSec}
            step="0.1"
            min="0"
            onChange={e => handleChange('startSec', e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              backgroundColor: '#1e293b', border: '1px solid #334155',
              borderRadius: 4, color: '#e2e8f0',
              padding: '6px 8px', fontSize: 13, fontFamily: 'monospace',
              outline: 'none',
            }}
          />
        </div>

        <div>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 600,
            color: '#64748b', textTransform: 'uppercase',
            letterSpacing: '0.05em', marginBottom: 6,
          }}>
            Duration (seconds)
          </label>
          <input
            type="number"
            value={vals.durationSec}
            step="0.1"
            min="0.1"
            onChange={e => handleChange('durationSec', e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              backgroundColor: '#1e293b', border: '1px solid #334155',
              borderRadius: 4, color: '#e2e8f0',
              padding: '6px 8px', fontSize: 13, fontFamily: 'monospace',
              outline: 'none',
            }}
          />
        </div>

        {/* End time preview */}
        <div style={{
          backgroundColor: '#1e293b', borderRadius: 4,
          padding: '8px 10px', display: 'flex', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>Ends at</span>
          <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>
            {endTimecode}
          </span>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div style={{
            backgroundColor: '#1e1010', border: '1px solid #7f1d1d',
            borderRadius: 4, padding: '8px 10px',
          }}>
            {errors.map((err, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 6,
                fontSize: 11, color: '#fca5a5', marginBottom: i < errors.length - 1 ? 4 : 0,
              }}>
                <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                {err}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid #1e293b',
        display: 'flex',
        gap: 8,
      }}>
        <button
          onClick={handleApply}
          disabled={!isDirty || errors.length > 0}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '7px 12px',
            borderRadius: 5,
            border: 'none',
            cursor: isDirty && errors.length === 0 ? 'pointer' : 'not-allowed',
            fontSize: 12,
            fontWeight: 600,
            backgroundColor: isDirty && errors.length === 0 ? '#1d4ed8' : '#1e293b',
            color: isDirty && errors.length === 0 ? '#fff' : '#475569',
            transition: 'background-color 0.15s',
          }}
        >
          <Check size={12} />
          Apply
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '7px 12px',
            borderRadius: 5,
            border: '1px solid #334155',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            backgroundColor: 'transparent',
            color: '#64748b',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
