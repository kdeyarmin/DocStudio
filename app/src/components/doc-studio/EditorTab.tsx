import { useCallback, useEffect, useRef, useState } from 'react';
import { Bold, Italic, Code, Link, List, ListOrdered, Heading1, Heading2, Heading3, Quote, Columns2 as Columns, Eye, CreditCard as Edit3, TextWrap as WrapText, Keyboard } from 'lucide-react';
import { MarkdownPreview } from './MarkdownPreview';
import type { EditedContent } from '../../types/doc-studio';

interface Props {
  editedContent: EditedContent;
  onChange: (content: EditedContent) => void;
  saveState: 'saved' | 'saving' | 'unsaved';
  readOnly?: boolean;
}

type PaneMode = 'editor' | 'split' | 'preview';

function insertAround(textarea: HTMLTextAreaElement, before: string, after: string, placeholder = '') {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end) || placeholder;
  const newValue = textarea.value.substring(0, start) + before + selected + after + textarea.value.substring(end);
  const newCursor = start + before.length + selected.length + after.length;
  return { newValue, newCursor };
}

function insertLine(textarea: HTMLTextAreaElement, prefix: string) {
  const start = textarea.selectionStart;
  const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = textarea.value.indexOf('\n', start);
  const end = lineEnd === -1 ? textarea.value.length : lineEnd;
  const line = textarea.value.substring(lineStart, end);
  const newLine = line.startsWith(prefix) ? line.slice(prefix.length) : prefix + line;
  const newValue = textarea.value.substring(0, lineStart) + newLine + textarea.value.substring(end);
  return { newValue, newCursor: lineStart + newLine.length };
}

const TOOLBAR_BUTTONS = [
  { icon: Bold, title: 'Bold (⌘B)', action: (t: HTMLTextAreaElement) => insertAround(t, '**', '**', 'bold text') },
  { icon: Italic, title: 'Italic (⌘I)', action: (t: HTMLTextAreaElement) => insertAround(t, '_', '_', 'italic text') },
  { icon: Code, title: 'Inline Code', action: (t: HTMLTextAreaElement) => insertAround(t, '`', '`', 'code') },
  null,
  { icon: Heading1, title: 'Heading 1', action: (t: HTMLTextAreaElement) => insertLine(t, '# ') },
  { icon: Heading2, title: 'Heading 2', action: (t: HTMLTextAreaElement) => insertLine(t, '## ') },
  { icon: Heading3, title: 'Heading 3', action: (t: HTMLTextAreaElement) => insertLine(t, '### ') },
  null,
  { icon: List, title: 'Bullet List', action: (t: HTMLTextAreaElement) => insertLine(t, '- ') },
  { icon: ListOrdered, title: 'Numbered List', action: (t: HTMLTextAreaElement) => insertLine(t, '1. ') },
  { icon: Quote, title: 'Blockquote', action: (t: HTMLTextAreaElement) => insertLine(t, '> ') },
  { icon: Link, title: 'Link', action: (t: HTMLTextAreaElement) => insertAround(t, '[', '](url)', 'link text') },
];

const BOLD_TOOLBAR_ACTION = TOOLBAR_BUTTONS[0]?.action;
const ITALIC_TOOLBAR_ACTION = TOOLBAR_BUTTONS[1]?.action;

export function EditorTab({ editedContent, onChange, saveState, readOnly = false }: Props) {
  const [paneMode, setPaneMode] = useState<PaneMode>('split');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const value = editedContent.guide_md ?? '';

  const updateValue = useCallback((newVal: string) => {
    onChange({ ...editedContent, guide_md: newVal });
  }, [editedContent, onChange]);

  const applyToolbarAction = useCallback((action: (t: HTMLTextAreaElement) => { newValue: string; newCursor: number }) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { newValue, newCursor } = action(textarea);
    updateValue(newValue);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    });
  }, [updateValue]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const textarea = textareaRef.current;
      if (!textarea || document.activeElement !== textarea) return;
      if (e.key === 'b' && BOLD_TOOLBAR_ACTION) {
        e.preventDefault();
        applyToolbarAction(BOLD_TOOLBAR_ACTION);
      } else if (e.key === 'i' && ITALIC_TOOLBAR_ACTION) {
        e.preventDefault();
        applyToolbarAction(ITALIC_TOOLBAR_ACTION);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [applyToolbarAction]);

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charCount = value.length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-0.5">
          {TOOLBAR_BUTTONS.map((btn, i) =>
            btn === null ? (
              <div key={`sep-${i}`} className="w-px h-5 bg-slate-200 mx-1" />
            ) : (
              <button
                key={i}
                title={btn.title}
                disabled={readOnly || paneMode === 'preview'}
                onClick={() => applyToolbarAction(btn.action)}
                className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <btn.icon className="w-3.5 h-3.5" />
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            title="Show keyboard shortcuts"
            onClick={() => setShowShortcuts(s => !s)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-5 bg-slate-200 mx-0.5" />
          {(['editor', 'split', 'preview'] as PaneMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setPaneMode(mode)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                paneMode === mode
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              {mode === 'editor' && <Edit3 className="w-3 h-3" />}
              {mode === 'split' && <Columns className="w-3 h-3" />}
              {mode === 'preview' && <Eye className="w-3 h-3" />}
              <span className="capitalize">{mode}</span>
            </button>
          ))}
        </div>
      </div>

      {showShortcuts && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex flex-wrap gap-x-6 gap-y-1">
          {[['⌘B', 'Bold'], ['⌘I', 'Italic'], ['⌘S', 'Save'], ['Tab', 'Indent']].map(([key, label]) => (
            <span key={key} className="text-xs text-amber-700">
              <kbd className="font-mono bg-white border border-amber-200 rounded px-1">{key}</kbd>
              <span className="ml-1.5 text-amber-600">{label}</span>
            </span>
          ))}
        </div>
      )}

      <div className={`flex-1 overflow-hidden flex ${paneMode === 'split' ? 'divide-x divide-slate-200' : ''}`}>
        {(paneMode === 'editor' || paneMode === 'split') && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {paneMode === 'split' && (
              <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide flex-shrink-0">
                Editor
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={e => updateValue(e.target.value)}
              readOnly={readOnly}
              spellCheck
              className="flex-1 p-4 font-mono text-sm text-slate-800 bg-white resize-none outline-none leading-relaxed placeholder-slate-300"
              placeholder="Start writing your guide content in Markdown…"
              onKeyDown={e => {
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const t = e.currentTarget;
                  const start = t.selectionStart;
                  const end = t.selectionEnd;
                  const newVal = t.value.substring(0, start) + '  ' + t.value.substring(end);
                  updateValue(newVal);
                  requestAnimationFrame(() => {
                    if (textareaRef.current) textareaRef.current.setSelectionRange(start + 2, start + 2);
                  });
                }
              }}
            />
          </div>
        )}

        {(paneMode === 'preview' || paneMode === 'split') && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {paneMode === 'split' && (
              <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide flex-shrink-0">
                Preview
              </div>
            )}
            <div className="flex-1 overflow-auto p-4">
              {value.trim() ? (
                <MarkdownPreview content={value} className="prose prose-sm max-w-none" />
              ) : (
                <p className="text-sm text-slate-400 italic">Nothing to preview yet.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-1.5 border-t border-slate-200 bg-slate-50 flex-shrink-0">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <WrapText className="w-3 h-3" />
          <span>{wordCount} words · {charCount} chars</span>
        </div>
        <span className={`text-xs ${
          saveState === 'saved' ? 'text-emerald-600' :
          saveState === 'saving' ? 'text-amber-600' :
          'text-slate-400'
        }`}>
          {saveState === 'saved' ? 'All changes saved' : saveState === 'saving' ? 'Saving…' : 'Unsaved changes'}
        </span>
      </div>
    </div>
  );
}
