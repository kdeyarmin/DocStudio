import { useState, useRef } from 'react';
import { Loader as Loader2, Mic, Play, Pause, RefreshCw, Trash2, ChevronDown, ChevronRight, Zap, BookOpen, Hash } from 'lucide-react';
import {
  useNarrationSegments,
  useUpdateNarrationSegment,
  useDeleteNarrationSegment,
  useGenerateSegmentNarration,
  useGenerateBatchNarration,
} from '../../../hooks/useDocStudioNarration';
import { useApplyPronunciationToText } from '../../../hooks/usePronunciationDictionary';
import { useToast } from '../../../lib/toast';
import type { DocumentationNarrationSegment, NarrationStyle } from '../../../types/documentation';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500',
  ready: 'bg-blue-100 text-blue-700',
  generated: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

const NARRATION_STYLES: NarrationStyle[] = ['instructional', 'conversational', 'formal', 'concise'];

const STYLE_LABELS: Record<NarrationStyle, string> = {
  instructional: 'Instructional',
  conversational: 'Conversational',
  formal: 'Formal',
  concise: 'Concise',
};

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

interface PronunciationDiffProps {
  original: string;
  processed: string;
  count: number;
  onClose: () => void;
}

function PronunciationDiff({ original, processed, count, onClose }: PronunciationDiffProps) {
  return (
    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-700">{count} pronunciation rule{count !== 1 ? 's' : ''} applied</span>
        <button onClick={onClose} className="text-xs text-blue-500 hover:text-blue-700">Dismiss</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Original</p>
          <p className="text-xs text-slate-600 font-mono leading-relaxed bg-white border border-slate-100 rounded p-2 line-clamp-4">{original}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">Processed</p>
          <p className="text-xs text-blue-800 font-mono leading-relaxed bg-white border border-blue-100 rounded p-2 line-clamp-4">{processed}</p>
        </div>
      </div>
    </div>
  );
}

interface AudioPlayerProps {
  audioUrl: string;
}

function AudioPlayer({ audioUrl }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    if (!ref.current) return;
    if (playing) { ref.current.pause(); }
    else { ref.current.play(); }
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
      >
        {playing ? <Pause size={11} /> : <Play size={11} />}
        {playing ? 'Pause' : 'Play'} Audio
      </button>
      <audio
        ref={ref}
        src={audioUrl}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </div>
  );
}

function SegmentRow({ seg, draftId }: { seg: DocumentationNarrationSegment; draftId: string }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(seg.narration_text);
  const [pronDiff, setPronDiff] = useState<{ original: string; processed: string; count: number } | null>(null);
  const update = useUpdateNarrationSegment();
  const remove = useDeleteNarrationSegment();
  const generate = useGenerateSegmentNarration();
  const applyPronunciation = useApplyPronunciationToText();
  const { showToast } = useToast();

  const handleSaveText = async () => {
    setEditing(false);
    if (text === seg.narration_text) return;
    try {
      await update.mutateAsync({ segment_id: seg.id, draft_id: draftId, narration_text: text });
    } catch {
      showToast('Failed to update narration text', 'error');
    }
  };

  const handleStyleChange = async (style: NarrationStyle) => {
    try {
      await update.mutateAsync({ segment_id: seg.id, draft_id: draftId, style });
    } catch {
      showToast('Failed to update style', 'error');
    }
  };

  const handleGenerate = async () => {
    try {
      await generate.mutateAsync({ segment_id: seg.id, draft_id: draftId, narration_text: seg.narration_text });
      showToast('Audio generated', 'success');
    } catch {
      showToast('Generation failed', 'error');
    }
  };

  const handleApplyPronunciation = async () => {
    try {
      const result = await applyPronunciation.mutateAsync({ text: seg.narration_text });
      if (result.entries_applied === 0) {
        showToast('No pronunciation rules matched', 'info');
      } else {
        setPronDiff({ original: result.original_text, processed: result.processed_text, count: result.entries_applied });
      }
    } catch {
      showToast('Failed to apply pronunciation rules', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await remove.mutateAsync({ segment_id: seg.id, draft_id: draftId });
    } catch {
      showToast('Failed to delete segment', 'error');
    }
  };

  const words = wordCount(seg.narration_text);
  const audioUrl = (seg as unknown as Record<string, unknown>).audio_url as string | undefined;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 font-semibold text-xs flex-shrink-0 mt-0.5">
          {seg.segment_order ?? 1}
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div>
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={handleSaveText}
                rows={3}
                className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-0.5 text-right">{wordCount(text)} words</p>
            </div>
          ) : (
            <button
              onClick={() => { setEditing(true); setText(seg.narration_text); }}
              className="text-sm text-slate-700 text-left leading-relaxed line-clamp-2 hover:text-blue-700 w-full"
            >
              {seg.narration_text}
            </button>
          )}

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <select
              value={seg.style ?? 'instructional'}
              onChange={(e) => handleStyleChange(e.target.value as NarrationStyle)}
              className="text-xs text-slate-500 bg-transparent border border-slate-200 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {NARRATION_STYLES.map((s) => (
                <option key={s} value={s}>{STYLE_LABELS[s]}</option>
              ))}
            </select>

            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Hash size={10} />{words}w
            </span>

            {seg.target_duration_seconds != null && (
              <span className="text-xs text-slate-400">~{seg.target_duration_seconds}s</span>
            )}

            {seg.scene_id && (
              <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md">scene</span>
            )}

            {seg.audio_asset_id && !audioUrl && (
              <span className="flex items-center gap-1 text-xs text-green-600"><Play size={10} />Audio ready</span>
            )}
          </div>

          {audioUrl && <AudioPlayer audioUrl={audioUrl} />}
          {pronDiff && (
            <PronunciationDiff
              original={pronDiff.original}
              processed={pronDiff.processed}
              count={pronDiff.count}
              onClose={() => setPronDiff(null)}
            />
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {seg.status && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[seg.status] ?? STATUS_STYLES.draft}`}>
              {seg.status}
            </span>
          )}
          <button
            onClick={handleApplyPronunciation}
            disabled={applyPronunciation.isPending}
            title="Apply pronunciation rules"
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40"
          >
            {applyPronunciation.isPending ? <Loader2 size={13} className="animate-spin" /> : <BookOpen size={13} />}
          </button>
          <button
            onClick={handleGenerate}
            disabled={generate.isPending}
            title="Generate audio"
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40"
          >
            {generate.isPending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
          </button>
          <button onClick={handleDelete} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={13} />
          </button>
          <button onClick={() => setOpen((v) => !v)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors">
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 space-y-2">
          {seg.caption_text && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Caption</p>
              <p className="text-xs text-slate-600 font-mono bg-white border border-slate-200 rounded px-2 py-1.5 leading-relaxed">{seg.caption_text}</p>
            </div>
          )}
          {seg.short_narration_text && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Short variant</p>
              <p className="text-xs text-slate-500 italic">{seg.short_narration_text}</p>
            </div>
          )}
          {seg.transcript_text && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Transcript</p>
              <p className="text-xs text-slate-600 leading-relaxed">{seg.transcript_text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  draftId: string;
}

export function NarrationTab({ draftId }: Props) {
  const { showToast } = useToast();
  const { data: segments = [], isLoading, refetch } = useNarrationSegments(draftId);
  const generateBatch = useGenerateBatchNarration();

  const handleGenerateAll = async () => {
    const pending = segments.filter((s) => !s.audio_asset_id);
    if (pending.length === 0) {
      showToast('All segments already have audio', 'info');
      return;
    }
    try {
      await generateBatch.mutateAsync({
        draft_id: draftId,
        segments: pending.map((s) => ({ segment_id: s.id, narration_text: s.narration_text })),
      });
      showToast(`Generated ${pending.length} audio segment${pending.length !== 1 ? 's' : ''}`, 'success');
    } catch {
      showToast('Batch generation failed', 'error');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-blue-500" /></div>;
  }

  const audioCount = segments.filter((s) => s.audio_asset_id).length;
  const totalWords = segments.reduce((sum, s) => sum + wordCount(s.narration_text), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <div className="flex items-center gap-1.5">
            <Mic size={15} />
            <span>{segments.length} segment{segments.length !== 1 ? 's' : ''}</span>
          </div>
          {totalWords > 0 && (
            <span className="text-xs text-slate-400 flex items-center gap-1"><Hash size={10} />{totalWords.toLocaleString()} words</span>
          )}
          {audioCount > 0 && (
            <span className="text-xs text-green-600">• {audioCount} with audio</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <RefreshCw size={13} />
          </button>
          {segments.length > 0 && (
            <button
              onClick={handleGenerateAll}
              disabled={generateBatch.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {generateBatch.isPending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              Generate All Audio
            </button>
          )}
        </div>
      </div>

      {segments.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm bg-white border border-dashed border-slate-200 rounded-xl">
          No narration segments yet. Run content generation to auto-create segments.
        </div>
      ) : (
        <div className="space-y-2">
          {segments.map((seg) => (
            <SegmentRow key={seg.id} seg={seg} draftId={draftId} />
          ))}
        </div>
      )}
    </div>
  );
}
