import { useState, useRef, useEffect } from 'react';
import { Copy, CheckCheck, Download, CircleArrowRight as ArrowRightCircle } from 'lucide-react';
import { MarkdownPreview } from './MarkdownPreview';
import type { GeneratedContent, EditedContent } from '../../types/doc-studio';

interface Props {
  generatedContent: GeneratedContent;
  editedContent: EditedContent;
  onCopyToEditor: (md: string) => void;
}

export function GeneratedTab({ generatedContent, editedContent, onCopyToEditor }: Props) {
  const [copied, setCopied] = useState(false);
  const guide = generatedContent.guide_md ?? '';
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current); };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(guide);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleDownload = () => {
    const blob = new Blob([guide], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated-guide.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasEdits = !!(editedContent.guide_md && editedContent.guide_md !== guide);

  if (!guide.trim()) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <ArrowRightCircle className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-sm font-medium text-slate-600">No generated content yet</p>
        <p className="text-xs text-slate-400 mt-1">Run the generation process to produce AI-written content</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-50 flex-shrink-0">
        <p className="text-xs text-slate-500">
          Read-only view of the AI-generated content.
          {hasEdits && <span className="ml-1.5 text-amber-600 font-medium">You have unsaved edits on the Editor tab.</span>}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
          >
            {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download .md
          </button>
          <button
            onClick={() => onCopyToEditor(guide)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <ArrowRightCircle className="w-3.5 h-3.5" />
            Copy All to Editor
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <MarkdownPreview content={guide} className="prose prose-sm max-w-3xl" />
      </div>
    </div>
  );
}
