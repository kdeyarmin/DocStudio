import { useState } from 'react';
import { Clock, Download, ChevronDown, ChevronRight, RefreshCw, Layers, CircleAlert as AlertCircle, Info, Mic, Captions as CaptionsIcon, Image, Film } from 'lucide-react';
import { useAssemblyState } from '../../../hooks/useDocStudioAssembly';
import { useLatestPackage } from '../../../hooks/useDocStudioPackage';
import { exportTimingManifest } from '../../../services/documentation/packages/exportService';
import type { TutorialTimingManifest, SceneTimingBlock, RenderManifest } from '../../../types/documentation';
import RenderTimelineEditor from '../timeline/RenderTimelineEditor';

interface TimingTabProps {
  draftId: string;
}

function msToTimecode(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const msPart = ms % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(msPart).padStart(3, '0')}`;
}

function buildCSV(manifest: TutorialTimingManifest): string {
  const header = 'scene_order,title,start_ms,end_ms,duration_ms,word_count,caption_blocks,screenshots,transition';
  const rows = manifest.scenes.map(b => {
    const wc = b.narration_segment_timings?.reduce((s, t) => s + t.word_count, 0) ?? 0;
    const caps = b.caption_timing_blocks?.length ?? 0;
    const shots = b.screenshot_display_timings?.length ?? 0;
    const trans = b.transition_timing_placeholder?.type ?? '';
    return [b.scene_order, `"${(b.title ?? '').replace(/"/g, '""')}"`, b.start_ms, b.end_ms, b.duration_ms, wc, caps, shots, trans].join(',');
  });
  return [header, ...rows].join('\n');
}

function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function TimelineBar({ block, totalMs }: { block: SceneTimingBlock; totalMs: number }) {
  const left = totalMs > 0 ? (block.start_ms / totalMs) * 100 : 0;
  const width = totalMs > 0 ? (block.duration_ms / totalMs) * 100 : 0;
  return (
    <div className="relative h-4 bg-slate-100 rounded overflow-hidden" title={`${msToTimecode(block.start_ms)} → ${msToTimecode(block.end_ms)}`}>
      <div
        className="absolute h-full bg-blue-400 rounded opacity-80"
        style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
      />
    </div>
  );
}

function SceneTimingRow({ block, index, totalMs }: { block: SceneTimingBlock; index: number; totalMs: number }) {
  const [open, setOpen] = useState(false);
  const durationSec = (block.duration_ms / 1000).toFixed(1);
  const totalWords = block.narration_segment_timings?.reduce((s, t) => s + t.word_count, 0) ?? 0;
  const captionCount = block.caption_timing_blocks?.length ?? 0;
  const screenshotCount = block.screenshot_display_timings?.length ?? 0;
  const calloutCount = block.callout_timing_placeholders?.length ?? 0;
  const hasDetails = totalWords > 0 || captionCount > 0 || screenshotCount > 0 || calloutCount > 0 || block.transition_timing_placeholder;

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50 transition-colors"
        onClick={() => hasDetails && setOpen(o => !o)}
      >
        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-medium flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <span className="flex-1 text-left text-slate-700 font-medium truncate">{block.title}</span>
        <TimelineBar block={block} totalMs={totalMs} />
        <span className="text-xs text-slate-400 font-mono w-20 text-right shrink-0">{msToTimecode(block.start_ms)}</span>
        <span className="w-10 text-right text-xs text-slate-500 shrink-0">{durationSec}s</span>
        {hasDetails
          ? (open ? <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />)
          : <span className="w-3 h-3 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-3 text-xs text-slate-600">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-slate-400 mb-0.5">Start</div>
              <div className="font-mono">{msToTimecode(block.start_ms)}</div>
            </div>
            <div>
              <div className="text-slate-400 mb-0.5">End</div>
              <div className="font-mono">{msToTimecode(block.end_ms)}</div>
            </div>
            <div>
              <div className="text-slate-400 mb-0.5">Duration</div>
              <div>{durationSec}s · {block.duration_ms}ms</div>
            </div>
          </div>

          {block.narration_segment_timings && block.narration_segment_timings.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 text-slate-500 font-medium">
                <Mic className="w-3 h-3" /> Narration segments ({block.narration_segment_timings.length})
              </div>
              <div className="rounded border border-slate-200 bg-white overflow-hidden">
                {block.narration_segment_timings.map((seg, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-1.5 text-[11px] border-b last:border-0 border-slate-100">
                    <span className="w-4 text-slate-400">{seg.segment_order}</span>
                    <span className="font-mono text-slate-500">{msToTimecode(seg.start_ms)}</span>
                    <span className="text-slate-300">→</span>
                    <span className="font-mono text-slate-500">{msToTimecode(seg.end_ms)}</span>
                    <span className="ml-auto text-slate-400">{seg.word_count}w · {seg.char_count}ch</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {block.caption_timing_blocks && block.caption_timing_blocks.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 text-slate-500 font-medium">
                <CaptionsIcon className="w-3 h-3" /> Caption blocks ({captionCount})
              </div>
              <div className="rounded border border-slate-200 bg-white overflow-hidden max-h-40 overflow-y-auto">
                {block.caption_timing_blocks.map((cap, i) => (
                  <div key={i} className="flex items-start gap-3 px-3 py-1.5 text-[11px] border-b last:border-0 border-slate-100">
                    <span className="font-mono text-slate-400 shrink-0">{msToTimecode(cap.start_ms)}</span>
                    <span className="text-slate-600 flex-1">{cap.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {block.screenshot_display_timings && block.screenshot_display_timings.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 text-slate-500 font-medium">
                <Image className="w-3 h-3" /> Screenshots ({screenshotCount})
              </div>
              <div className="space-y-1">
                {block.screenshot_display_timings.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-mono">{msToTimecode(s.display_start_ms ?? 0)}</span>
                    <span className="text-slate-300">→</span>
                    <span className="font-mono">{msToTimecode(s.display_end_ms ?? 0)}</span>
                    <span className="text-slate-400 font-mono truncate">{s.asset_id.slice(-12)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {block.callout_timing_placeholders && block.callout_timing_placeholders.length > 0 && (
            <div className="text-slate-500">
              {calloutCount} callout{calloutCount !== 1 ? 's' : ''}: {block.callout_timing_placeholders.map(c => c.title).join(', ')}
            </div>
          )}

          {block.transition_timing_placeholder && (
            <div className="text-slate-500">
              Transition: <span className="font-medium">{block.transition_timing_placeholder.type}</span>
              {' '}({block.transition_timing_placeholder.duration_ms}ms)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TimingTab({ draftId }: TimingTabProps) {
  const { isLoading: assemblyLoading } = useAssemblyState(draftId);
  const { data: packageExport, isLoading: packageLoading } = useLatestPackage(draftId);

  type ManifestJson = { timing_manifest?: TutorialTimingManifest; render_manifest_json?: RenderManifest } | null;
  const manifestJson = packageExport?.manifest_json as ManifestJson;
  const timingManifest = manifestJson?.timing_manifest ?? null;
  const renderManifest = manifestJson?.render_manifest_json ?? null;

  const isLoading = assemblyLoading || packageLoading;

  function handleExportJSON() {
    if (!timingManifest) return;
    exportTimingManifest(timingManifest);
  }

  function handleExportCSV() {
    if (!timingManifest) return;
    downloadText(buildCSV(timingManifest), `timing-${draftId.slice(0, 8)}.csv`, 'text/csv');
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-slate-400 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading timing data…
      </div>
    );
  }

  if (!timingManifest) {
    if (renderManifest) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-800">Visual Timeline</h3>
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 440 }}>
            <RenderTimelineEditor manifest={renderManifest} readOnly />
          </div>
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            Detailed timing manifest not yet generated. Run full assembly to generate narration segment timings.
          </div>
        </div>
      );
    }
    return (
      <div className="text-center py-12 text-slate-400">
        <Clock className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium text-slate-500">No timing manifest yet</p>
        <p className="text-xs mt-1">Run the full assembly to generate timing data</p>
      </div>
    );
  }

  const totalSec = timingManifest.total_duration_ms / 1000;
  const totalMin = Math.floor(totalSec / 60);
  const remSec = Math.round(totalSec % 60);

  return (
    <div className="space-y-5">
      {timingManifest.estimated && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <div>
            <p className="text-xs font-semibold">Estimated timing</p>
            <p className="text-xs mt-0.5 text-amber-700">These durations are calculated estimates, not measured from actual audio output. Re-assemble with recorded audio for precise timing.</p>
          </div>
        </div>
      )}

      {timingManifest.quality_notes && timingManifest.quality_notes.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
            <Info className="w-3.5 h-3.5 text-blue-500" /> Quality Notes
          </div>
          {timingManifest.quality_notes.map((note, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
              <span className="text-slate-300 mt-0.5">•</span>
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Timing Manifest</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Assembled {new Date(timingManifest.assembled_at ?? '').toLocaleDateString()} · {timingManifest.assembly_status}
            {timingManifest.estimated ? ' · estimated' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> JSON
          </button>
        </div>
      </div>

      {renderManifest && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Film className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-800">Visual Timeline</h3>
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 440 }}>
            <RenderTimelineEditor manifest={renderManifest} readOnly />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-slate-500">Total Duration</span>
          </div>
          <div className="text-xl font-bold text-slate-800">{totalMin}m {remSec}s</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{timingManifest.total_duration_ms.toLocaleString()}ms</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500">Scenes</span>
          </div>
          <div className="text-xl font-bold text-slate-800">{timingManifest.scene_count ?? 0}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-slate-500">Avg Scene</span>
          </div>
          <div className="text-xl font-bold text-slate-800">
            {(timingManifest.scene_count ?? 0) > 0
              ? `${(totalSec / (timingManifest.scene_count ?? 1)).toFixed(1)}s`
              : '—'}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {timingManifest.scenes.map((block, i) => (
          <SceneTimingRow
            key={block.scene_id}
            block={block}
            index={i}
            totalMs={timingManifest.total_duration_ms}
          />
        ))}
      </div>
    </div>
  );
}
export { TimingTab };
