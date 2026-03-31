import { useState } from 'react';
import { Loader as Loader2, Captions, Download, RefreshCw, Copy, CheckCheck, Zap, ChevronDown, ChevronRight, CircleAlert as AlertCircle } from 'lucide-react';
import { useNarrationSegments } from '../../../hooks/useDocStudioNarration';
import { useExportSRT } from '../../../hooks/useDocStudioScenes';
import { useAssembleCaptions, useAssemblyState } from '../../../hooks/useDocStudioAssembly';
import { useToast } from '../../../lib/toast';
import type { EnhancedCaptionBlock } from '../../../types/documentation';

type FilterMode = 'all' | 'low_confidence' | 'has_diff';

function msToSRT(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

function msToVTT(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

function fmtSRT(seconds: number | null | undefined): string {
  if (seconds == null) return '00:00:00,000';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
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

function buildVTT(blocks: EnhancedCaptionBlock[]): string {
  const cues = blocks
    .map(b => `${msToVTT(b.start_ms ?? 0)} --> ${msToVTT(b.end_ms ?? 0)}\n${b.text}`)
    .join('\n\n');
  return `WEBVTT\n\n${cues}`;
}

function buildSRTFromBlocks(blocks: EnhancedCaptionBlock[]): string {
  return blocks
    .map((b, i) => `${i + 1}\n${msToSRT(b.start_ms ?? 0)} --> ${msToSRT(b.end_ms ?? 0)}\n${b.text}`)
    .join('\n\n');
}

function DiffBadge({ score }: { score: number | undefined }) {
  if (score == null || score >= 0.85) return null;
  const label = score < 0.5 ? 'High diff' : 'Diff';
  const cls = score < 0.5
    ? 'bg-red-50 border border-red-200 text-red-600'
    : 'bg-amber-50 border border-amber-200 text-amber-600';
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`} title={`Diff score: ${Math.round(score * 100)}%`}>
      <AlertCircle className="w-2.5 h-2.5" />{label}
    </span>
  );
}

interface SceneGroupProps {
  sceneId: string;
  sceneTitle?: string;
  blocks: EnhancedCaptionBlock[];
  index: number;
}

function SceneGroup({ sceneId, sceneTitle, blocks, index }: SceneGroupProps) {
  const [open, setOpen] = useState(index === 0);
  const durationMs = blocks.length > 0 ? ((blocks[blocks.length - 1]?.end_ms ?? 0) - (blocks[0]?.start_ms ?? 0)) : 0;
  const durationSec = (durationMs / 1000).toFixed(1);
  const totalWords = blocks.reduce((s, b) => s + (b.word_count ?? 0), 0);
  const diffCount = blocks.filter(b => b.diff_score != null && b.diff_score < 0.85).length;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={13} className="text-slate-400" /> : <ChevronRight size={13} className="text-slate-400" />}
          <span className="text-xs font-semibold text-slate-700">
            {sceneTitle ?? `Scene ${index + 1}`}
          </span>
          {!sceneTitle && (
            <span className="text-xs text-slate-400 font-mono">{sceneId.slice(0, 8)}</span>
          )}
          {diffCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-600 text-[10px] font-medium">
              {diffCount} diff
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {totalWords > 0 && <span>{totalWords}w</span>}
          <span>{blocks.length} block{blocks.length !== 1 ? 's' : ''}</span>
          <span>{durationSec}s</span>
        </div>
      </button>
      {open && (
        <div className="divide-y divide-slate-100">
          {blocks.map((b, i) => (
            <div key={b.id ?? i} className="px-4 py-2.5 flex gap-3">
              <span className="text-xs text-slate-400 font-mono w-24 flex-shrink-0 pt-0.5">
                {msToVTT(b.start_ms ?? 0)}
              </span>
              <p className="text-xs text-slate-700 leading-relaxed flex-1 min-w-0">{b.text}</p>
              <div className="flex items-center gap-1.5 flex-shrink-0 self-start mt-0.5">
                {b.confidence != null && b.confidence > 0 && (
                  <span className={`text-xs ${b.confidence < 0.7 ? 'text-amber-500' : 'text-slate-400'}`}>
                    {Math.round(b.confidence * 100)}%
                  </span>
                )}
                <DiffBadge score={b.diff_score} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  draftId: string;
  organizationId: string;
}

export function CaptionsTab({ draftId, organizationId }: Props) {
  const { showToast } = useToast();
  const { data: segments = [], isLoading, refetch } = useNarrationSegments(draftId);
  const { data: assemblyState } = useAssemblyState(draftId);
  const exportSRT = useExportSRT();
  const assembleCaptions = useAssembleCaptions(draftId);
  const [copied, setCopied] = useState(false);
  const [srtPreview, setSRTPreview] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');

  const withCaptions = segments.filter((s) => s.caption_text);

  const captionBlocks: EnhancedCaptionBlock[] = assemblyState?.captionManifest?.caption_json ?? [];
  const hasPipelineBlocks = captionBlocks.length > 0;

  const filteredBlocks = captionBlocks.filter(b => {
    if (filter === 'low_confidence') return b.confidence != null && b.confidence < 0.7;
    if (filter === 'has_diff') return b.diff_score != null && b.diff_score < 0.85;
    return true;
  });

  const sceneGroups = hasPipelineBlocks
    ? Array.from(
        filteredBlocks.reduce((map, b) => {
          const sceneId = b.scene_id ?? 'unknown';
          const sceneBlocks = map.get(sceneId);
          if (sceneBlocks) {
            sceneBlocks.push(b);
          } else {
            map.set(sceneId, [b]);
          }
          return map;
        }, new Map<string, EnhancedCaptionBlock[]>()).entries(),
      )
    : [];

  const totalWords = captionBlocks.reduce((s, b) => s + (b.word_count ?? 0), 0);
  const diffCount = captionBlocks.filter(b => b.diff_score != null && b.diff_score < 0.85).length;
  const lowConfidenceCount = captionBlocks.filter(b => b.confidence != null && b.confidence < 0.7).length;
  const uniqueScenes = new Set(captionBlocks.map(b => b.scene_id)).size;

  const handleExportSRT = async () => {
    try {
      const result = await exportSRT.mutateAsync(draftId);
      setSRTPreview(result.srt);
      showToast('SRT exported', 'success');
    } catch {
      showToast('SRT export failed', 'error');
    }
  };

  const handleExportVTT = () => {
    if (!hasPipelineBlocks) {
      showToast('Run Assembly first to generate VTT captions', 'error');
      return;
    }
    const vtt = buildVTT(captionBlocks);
    downloadText(vtt, `captions-${draftId.slice(0, 8)}.vtt`, 'text/vtt');
    showToast('VTT downloaded', 'success');
  };

  const handleExportSRTFromBlocks = () => {
    if (!hasPipelineBlocks) return;
    const srt = buildSRTFromBlocks(captionBlocks);
    downloadText(srt, `captions-${draftId.slice(0, 8)}.srt`, 'text/plain');
    showToast('SRT downloaded', 'success');
  };

  const handleExportJSON = () => {
    if (!hasPipelineBlocks) return;
    downloadText(JSON.stringify(captionBlocks, null, 2), `captions-${draftId.slice(0, 8)}.json`, 'application/json');
    showToast('JSON downloaded', 'success');
  };

  const handleAssemble = async () => {
    try {
      await assembleCaptions.mutateAsync({ organizationId });
      showToast('Captions assembled', 'success');
    } catch {
      showToast('Caption assembly failed', 'error');
    }
  };

  const handleDownloadSRT = () => {
    if (!srtPreview) return;
    const blob = new Blob([srtPreview], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `captions-${draftId}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!srtPreview) return;
    await navigator.clipboard.writeText(srtPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Captions size={15} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Captions</span>
          <span className="text-xs text-slate-400">
            {hasPipelineBlocks
              ? `${captionBlocks.length} blocks · ${uniqueScenes} scene${uniqueScenes !== 1 ? 's' : ''}`
              : `${withCaptions.length} of ${segments.length} segments captioned`}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => refetch()}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw size={13} />
          </button>
          {hasPipelineBlocks && (
            <>
              <button onClick={handleExportJSON} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors">
                <Download size={13} /> JSON
              </button>
              <button onClick={handleExportVTT} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors">
                <Download size={13} /> VTT
              </button>
              <button onClick={handleExportSRTFromBlocks} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors">
                <Download size={13} /> SRT
              </button>
            </>
          )}
          {!hasPipelineBlocks && (
            <button
              onClick={handleExportSRT}
              disabled={exportSRT.isPending || segments.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {exportSRT.isPending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Export SRT
            </button>
          )}
          <button
            onClick={handleAssemble}
            disabled={assembleCaptions.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {assembleCaptions.isPending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            {hasPipelineBlocks ? 'Re-assemble' : 'Assemble Captions'}
          </button>
        </div>
      </div>

      {hasPipelineBlocks && (
        <>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Blocks', value: captionBlocks.length, color: 'text-slate-800' },
              { label: 'Total Words', value: totalWords > 0 ? totalWords.toLocaleString() : '—', color: 'text-slate-800' },
              { label: 'Diff Warnings', value: diffCount, color: diffCount > 0 ? 'text-amber-600' : 'text-slate-400' },
              { label: 'Low Confidence', value: lowConfidenceCount, color: lowConfidenceCount > 0 ? 'text-amber-600' : 'text-slate-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                <div className={`text-lg font-bold ${color}`}>{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {(['all', 'low_confidence', 'has_diff'] as FilterMode[]).map(f => {
              const labels: Record<FilterMode, string> = {
                all: `All (${captionBlocks.length})`,
                low_confidence: `Low confidence${lowConfidenceCount > 0 ? ` (${lowConfidenceCount})` : ''}`,
                has_diff: `Has diff${diffCount > 0 ? ` (${diffCount})` : ''}`,
              };
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-white border border-slate-200 text-slate-800 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>
        </>
      )}

      {hasPipelineBlocks ? (
        <div className="space-y-2">
          {sceneGroups.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">No captions match this filter</div>
          ) : (
            sceneGroups.map(([sceneId, blocks], idx) => {
              const sceneTitle = blocks[0]?.scene_title;
              return (
                <SceneGroup
                  key={sceneId}
                  sceneId={sceneId}
                  sceneTitle={sceneTitle}
                  blocks={blocks}
                  index={idx}
                />
              );
            })
          )}
        </div>
      ) : withCaptions.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm bg-white border border-dashed border-slate-200 rounded-xl">
          No captions yet. Click "Assemble Captions" to generate from narration, or generate narration segments first.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-100">
            {withCaptions.map((seg, i) => (
              <div key={seg.id} className="px-4 py-3 flex gap-3">
                <div className="text-xs text-slate-400 w-10 flex-shrink-0 font-mono pt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-600 leading-relaxed">{seg.caption_text}</p>
                  {seg.target_duration_seconds != null && (
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">
                      {fmtSRT(0)} → {fmtSRT(seg.target_duration_seconds)}
                    </p>
                  )}
                </div>
                {seg.audio_asset_id && (
                  <span className="text-xs text-green-600 flex-shrink-0 self-center">Audio</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {srtPreview && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">SRT Preview</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
              >
                {copied ? <CheckCheck size={11} className="text-green-500" /> : <Copy size={11} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={handleDownloadSRT}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                <Download size={11} /> Download
              </button>
            </div>
          </div>
          <pre className="p-4 text-xs text-slate-600 font-mono leading-relaxed overflow-auto max-h-64 whitespace-pre-wrap">
            {srtPreview}
          </pre>
        </div>
      )}
    </div>
  );
}
