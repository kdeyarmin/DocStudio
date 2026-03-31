import { useState, useEffect } from 'react';
import { X, Clock, CircleAlert as AlertCircle, ArrowRight, Info } from 'lucide-react';
import type { RenderManifest } from '../../types/documentation';
import type { BlockSelection } from './RenderTimelinePreview';
import { applyTimingEdit } from './timing-edit-utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msToSec(ms: number): number {
  return ms / 1000;
}

function fmtSec(ms: number): string {
  return (ms / 1000).toFixed(2);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(
  manifest: RenderManifest,
  selection: BlockSelection,
  rawValues: Record<string, number>,
): string[] {
  const errors: string[] = [];
  const scene = manifest.scenes[selection.sceneIndex];
  const sceneStartSec = scene.start_ms / 1000;
  const sceneEndSec = scene.end_ms / 1000;
  const { start_sec: start, end_sec: end, duration_sec: dur } = rawValues;

  switch (selection.type) {
    case 'scene':
      if (!dur || dur <= 0) errors.push('Duration must be greater than 0');
      if (dur > 600) errors.push('Duration exceeds 10 minutes — check value');
      break;
    case 'caption':
    case 'screenshot':
      if (start < 0) errors.push('Start must be ≥ 0');
      if (!end || end <= 0) errors.push('End must be > 0');
      if (start >= end) errors.push('Start must be less than end');
      if (start < sceneStartSec) errors.push(`Start (${start.toFixed(2)}s) is before scene start (${fmtSec(scene.start_ms)}s)`);
      if (end > sceneEndSec) errors.push(`End (${end.toFixed(2)}s) exceeds scene end (${fmtSec(scene.end_ms)}s)`);
      break;
    case 'callout':
    case 'narration':
    case 'zoom':
    case 'highlight':
      if (start < 0) errors.push('Start must be ≥ 0');
      if (!dur || dur <= 0) errors.push('Duration must be greater than 0');
      if (start < sceneStartSec) errors.push(`Start is before scene start (${fmtSec(scene.start_ms)}s)`);
      if (start + dur > sceneEndSec) errors.push(`Start + duration (${(start + dur).toFixed(2)}s) exceeds scene end (${fmtSec(scene.end_ms)}s)`);
      break;
    case 'transition':
      if (!dur || dur <= 0) errors.push('Duration must be greater than 0');
      if (dur > 5) errors.push('Transition duration over 5s — check value');
      break;
  }

  return errors;
}

// ─── Initial value extraction ─────────────────────────────────────────────────

function getInitialValues(manifest: RenderManifest, selection: BlockSelection): Record<string, number> {
  const scene = manifest.scenes[selection.sceneIndex];
  switch (selection.type) {
    case 'scene':
      return { duration_sec: msToSec(scene.duration_ms) };
    case 'caption': {
      const cap = scene.captions[selection.itemIndex!];
      return { start_sec: msToSec(cap.start_ms), end_sec: msToSec(cap.end_ms) };
    }
    case 'screenshot': {
      const ov = scene.screenshot_overlays[selection.itemIndex!];
      return { start_sec: msToSec(ov.display_start_ms), end_sec: msToSec(ov.display_end_ms) };
    }
    case 'callout':
      return { start_sec: msToSec(scene.callout!.start_ms), duration_sec: msToSec(scene.callout!.duration_ms) };
    case 'narration':
      return { start_sec: msToSec(scene.narration!.start_ms), duration_sec: msToSec(scene.narration!.duration_ms) };
    case 'transition':
      return { duration_sec: msToSec(scene.transition_in!.duration_ms) };
    case 'zoom':
      return { start_sec: msToSec(scene.zoom_effect!.start_ms), duration_sec: msToSec(scene.zoom_effect!.duration_ms) };
    case 'highlight':
      return { start_sec: msToSec(scene.highlight_effect!.start_ms), duration_sec: msToSec(scene.highlight_effect!.duration_ms) };
  }
}

// ─── Field config ─────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<BlockSelection['type'], string> = {
  scene:       'Scene Duration',
  caption:     'Caption Timing',
  screenshot:  'Screenshot Overlay',
  callout:     'Callout Timing',
  narration:   'Narration Offset',
  transition:  'Transition Duration',
  zoom:        'Zoom Effect',
  highlight:   'Highlight Effect',
};

interface FieldSpec {
  key: string;
  label: string;
  help: string;
}

function getFields(type: BlockSelection['type']): FieldSpec[] {
  switch (type) {
    case 'scene':
      return [{ key: 'duration_sec', label: 'Duration (s)', help: 'Extending or shortening will shift all subsequent scenes.' }];
    case 'caption':
    case 'screenshot':
      return [
        { key: 'start_sec', label: 'Start (s)', help: 'Must be within the parent scene bounds.' },
        { key: 'end_sec',   label: 'End (s)',   help: 'Must be within the parent scene bounds.' },
      ];
    case 'callout':
    case 'narration':
    case 'zoom':
    case 'highlight':
      return [
        { key: 'start_sec',    label: 'Start (s)',    help: 'Absolute timeline start offset.' },
        { key: 'duration_sec', label: 'Duration (s)', help: '' },
      ];
    case 'transition':
      return [{ key: 'duration_sec', label: 'Duration (s)', help: 'Overlap at the scene boundary.' }];
  }
}

// ─── Context info bar ─────────────────────────────────────────────────────────

function ContextBar({ manifest, selection }: { manifest: RenderManifest; selection: BlockSelection }) {
  const scene = manifest.scenes[selection.sceneIndex];
  const details: string[] = [];

  switch (selection.type) {
    case 'scene':
      details.push(`Scene ${scene.scene_order}: ${scene.title}`);
      details.push(`Current: ${fmtSec(scene.start_ms)}s → ${fmtSec(scene.end_ms)}s`);
      break;
    case 'caption': {
      const cap = scene.captions[selection.itemIndex!];
      details.push(`"${cap.text.length > 40 ? cap.text.slice(0, 40) + '…' : cap.text}"`);
      details.push(`Scene bounds: ${fmtSec(scene.start_ms)}s → ${fmtSec(scene.end_ms)}s`);
      break;
    }
    case 'screenshot': {
      const ov = scene.screenshot_overlays[selection.itemIndex!];
      details.push(`Role: ${ov.screenshot_role}`);
      details.push(`Scene bounds: ${fmtSec(scene.start_ms)}s → ${fmtSec(scene.end_ms)}s`);
      break;
    }
    case 'callout':
      details.push(`"${scene.callout!.title}"`);
      details.push(`Scene bounds: ${fmtSec(scene.start_ms)}s → ${fmtSec(scene.end_ms)}s`);
      break;
    case 'narration':
      details.push(`Scene ${scene.scene_order}: ${scene.title}`);
      details.push(`Scene bounds: ${fmtSec(scene.start_ms)}s → ${fmtSec(scene.end_ms)}s`);
      break;
    case 'transition':
      details.push(`Into Scene ${scene.scene_order}: ${scene.title}`);
      details.push(`Type: ${scene.transition_in!.type}`);
      break;
    case 'zoom':
    case 'highlight':
      details.push(`Scene ${scene.scene_order}: ${scene.title}`);
      details.push(`Scene bounds: ${fmtSec(scene.start_ms)}s → ${fmtSec(scene.end_ms)}s`);
      break;
  }

  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-[10px] text-slate-500">
      <Info size={11} className="flex-shrink-0 mt-0.5 text-slate-400" />
      <div className="space-y-0.5">
        {details.map((d, i) => <p key={i}>{d}</p>)}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TimingEditPanelProps {
  manifest: RenderManifest;
  selection: BlockSelection;
  onApply: (updatedManifest: RenderManifest) => void;
  onClose: () => void;
}

export function TimingEditPanel({
  manifest,
  selection,
  onApply,
  onClose,
}: TimingEditPanelProps) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    getInitialValues(manifest, selection),
  );

  useEffect(() => {
    setValues(getInitialValues(manifest, selection));
  }, [manifest, selection]);

  const errors = validate(manifest, selection, values);
  const fields = getFields(selection.type);
  const scene = manifest.scenes[selection.sceneIndex];
  const cascadeCount = selection.type === 'scene'
    ? manifest.scenes.length - selection.sceneIndex - 1
    : 0;

  function handleChange(key: string, raw: string) {
    const parsed = parseFloat(raw);
    setValues(v => ({ ...v, [key]: isNaN(parsed) ? 0 : parsed }));
  }

  function handleApply() {
    if (errors.length > 0) return;
    onApply(applyTimingEdit(manifest, selection, values));
  }

  return (
    <div className="bg-white border border-blue-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border-b border-blue-100">
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-blue-600" />
          <span className="text-xs font-semibold text-blue-800">
            {TYPE_LABELS[selection.type]}
            <span className="font-normal text-blue-600 ml-1">
              — Scene {scene.scene_order}: {scene.title}
            </span>
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-blue-100 rounded transition-colors"
          title="Close editor"
        >
          <X size={13} className="text-blue-600" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        <ContextBar manifest={manifest} selection={selection} />

        {/* Cascade warning */}
        {cascadeCount > 0 && (
          <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <ArrowRight size={11} className="flex-shrink-0 mt-0.5 text-amber-500" />
            <p className="text-[10px] text-amber-700">
              Changing this duration will shift{' '}
              <strong>{cascadeCount} subsequent {cascadeCount === 1 ? 'scene' : 'scenes'}</strong> to maintain continuity.
              Total duration will update accordingly.
            </p>
          </div>
        )}

        {/* Fields */}
        <div className="grid grid-cols-2 gap-3">
          {fields.map(field => (
            <div key={field.key}>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
                {field.label}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={values[field.key] ?? 0}
                onChange={e => handleChange(field.key, e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
              {field.help && (
                <p className="text-[9px] text-slate-400 mt-0.5 leading-relaxed">{field.help}</p>
              )}
            </div>
          ))}
        </div>

        {/* Preview of result for start+duration types */}
        {values.start_sec !== undefined && values.duration_sec !== undefined && (
          <p className="text-[10px] text-slate-400 tabular-nums">
            Result: {(values.start_sec ?? 0).toFixed(2)}s{' '}
            <ArrowRight size={9} className="inline" />{' '}
            {((values.start_sec ?? 0) + (values.duration_sec ?? 0)).toFixed(2)}s
            {' '}({(values.duration_sec ?? 0).toFixed(2)}s)
          </p>
        )}
        {values.start_sec !== undefined && values.end_sec !== undefined && (
          <p className="text-[10px] text-slate-400 tabular-nums">
            Result: {(values.start_sec ?? 0).toFixed(2)}s{' '}
            <ArrowRight size={9} className="inline" />{' '}
            {(values.end_sec ?? 0).toFixed(2)}s
            {' '}({((values.end_sec ?? 0) - (values.start_sec ?? 0)).toFixed(2)}s)
          </p>
        )}

        {/* Validation errors */}
        {errors.length > 0 && (
          <div className="space-y-1">
            {errors.map((err, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <AlertCircle size={10} className="flex-shrink-0 text-red-500" />
                <p className="text-[10px] text-red-600">{err}</p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={errors.length > 0}
            className="flex-1 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
