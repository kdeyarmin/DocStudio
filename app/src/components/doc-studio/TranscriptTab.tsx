import { useState, useMemo } from 'react';
import { Search, CreditCard as Edit3, Eye, Mic, User, Clock, Save } from 'lucide-react';
import type { EditedContent, GeneratedContent } from '../../types/doc-studio';

interface TranscriptSegment {
  index: number;
  timestamp?: string;
  speaker?: string;
  text: string;
}

function parseSegments(raw: string): TranscriptSegment[] {
  if (!raw.trim()) return [];
  const lines = raw.split('\n');
  const segments: TranscriptSegment[] = [];
  let current: Partial<TranscriptSegment> | null = null;

  for (const line of lines) {
    const tsMatch = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\](?:\s*([A-Za-z][^:]+):)?\s*(.*)/);
    if (tsMatch) {
      if (current?.text) segments.push({ index: segments.length, ...current } as TranscriptSegment);
      current = { timestamp: tsMatch[1], speaker: tsMatch[2]?.trim(), text: tsMatch[3].trim() };
    } else if (current) {
      current.text = ((current.text ?? '') + ' ' + line.trim()).trim();
    } else if (line.trim()) {
      segments.push({ index: segments.length, text: line.trim() });
    }
  }
  if (current?.text) segments.push({ index: segments.length, ...current } as TranscriptSegment);
  return segments;
}

interface Props {
  generatedContent: GeneratedContent;
  editedContent: EditedContent;
  onChange: (content: EditedContent) => void;
  saveState: 'saved' | 'saving' | 'unsaved';
  readOnly?: boolean;
}

export function TranscriptTab({ generatedContent, editedContent, onChange, saveState, readOnly = false }: Props) {
  const [viewMode, setViewMode] = useState<'segments' | 'raw'>('segments');
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState('');

  const rawText = editedContent.transcript ?? generatedContent.transcript ?? '';
  const segments = useMemo(() => parseSegments(rawText), [rawText]);

  const filtered = useMemo(() => {
    if (!search.trim()) return segments;
    const q = search.toLowerCase();
    return segments.filter(s =>
      s.text.toLowerCase().includes(q) ||
      (s.speaker ?? '').toLowerCase().includes(q)
    );
  }, [segments, search]);

  const isEmpty = !rawText.trim();

  if (isEmpty && !editMode) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <Mic className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-sm font-medium text-slate-600">No transcript available</p>
        <p className="text-xs text-slate-400 mt-1 mb-4">Add a transcript manually or generate from audio</p>
        {!readOnly && (
          <button
            onClick={() => setEditMode(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Add Transcript
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search transcript…"
              className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded bg-white text-slate-700 placeholder-slate-400 outline-none focus:ring-1 focus:ring-blue-500 w-44"
            />
          </div>
          {segments.length > 0 && (
            <span className="text-xs text-slate-400">
              {filtered.length} of {segments.length} segments
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {!readOnly && (
            <button
              onClick={() => setEditMode(m => !m)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                editMode ? 'bg-blue-600 text-white' : 'text-slate-600 border border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              {editMode ? <Save className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
              {editMode ? 'Done' : 'Edit'}
            </button>
          )}
          {!editMode && (
            <div className="flex items-center gap-0.5 border border-slate-200 rounded bg-white p-0.5">
              {(['segments', 'raw'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    viewMode === mode ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {mode === 'segments' ? <Clock className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {mode === 'segments' ? 'Segments' : 'Raw'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {editMode ? (
          <div className="flex flex-col h-full p-4 gap-2">
            <p className="text-xs text-slate-500">
              Use <code className="bg-slate-100 px-1 rounded">[0:00] Speaker: text</code> format for timestamped segments.
            </p>
            <textarea
              value={rawText}
              onChange={e => onChange({ ...editedContent, transcript: e.target.value })}
              className="flex-1 min-h-64 p-3 font-mono text-sm text-slate-800 border border-slate-200 rounded-lg bg-white resize-y outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
              placeholder={"[0:00] Host: Welcome to this tutorial…\n[0:15] The first step is to navigate to…"}
            />
            <div className="text-right text-xs text-slate-400">
              {saveState === 'saved' ? 'All changes saved' : saveState === 'saving' ? 'Saving…' : 'Unsaved changes'}
            </div>
          </div>
        ) : viewMode === 'raw' ? (
          <pre className="p-4 font-mono text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
            {rawText || <span className="text-slate-400 italic">Empty</span>}
          </pre>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="w-8 h-8 text-slate-200 mb-2" />
            <p className="text-sm text-slate-500">No segments match your search</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(seg => (
              <div key={seg.index} className="flex gap-4 px-5 py-3 hover:bg-slate-50 transition-colors group">
                {seg.timestamp && (
                  <span className="flex-shrink-0 w-12 text-xs font-mono text-blue-600 font-semibold pt-0.5">
                    {seg.timestamp}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  {seg.speaker && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <User className="w-3 h-3 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-600">{seg.speaker}</span>
                    </div>
                  )}
                  <p className="text-sm text-slate-700 leading-relaxed">{seg.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
