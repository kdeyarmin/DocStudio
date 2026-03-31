import { sanitizeHtml } from '../../lib/sanitize';

function parseMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  html = html.replace(/^---+$/gm, '<hr class="my-4 border-slate-200" />');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-slate-800 mt-5 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-slate-900 mt-6 mb-3">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-slate-900 mt-6 mb-3">$1</h1>');
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-blue-400 pl-4 italic text-slate-600 my-3">$1</blockquote>');
  html = html.replace(/^```[\w]*\n([\s\S]*?)```/gm, '<pre class="bg-slate-100 rounded-lg p-3 overflow-x-auto text-xs font-mono text-slate-700 my-3"><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-blue-700 px-1 rounded text-sm font-mono">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match: string, label: string, url: string) => {
    const href = url.trim();
    if (!/^(https?:|mailto:|tel:|\/|#)/i.test(href)) {
      return `<span class="text-slate-600">${label}</span>`;
    }
    return `<a href="${href}" class="text-blue-600 underline hover:text-blue-800" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  const lines = html.split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  const closeLists = () => {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  };

  for (const line of lines) {
    const unordered = line.match(/^[-*] (.+)$/);
    const ordered = line.match(/^\d+\. (.+)$/);
    if (unordered) {
      if (inOl) {
        out.push('</ol>');
        inOl = false;
      }
      if (!inUl) { out.push('<ul class="list-disc pl-5 my-2 space-y-1 text-slate-700">'); inUl = true; }
      out.push(`<li class="text-sm">${unordered[1]}</li>`);
    } else if (ordered) {
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      if (!inOl) { out.push('<ol class="list-decimal pl-5 my-2 space-y-1 text-slate-700">'); inOl = true; }
      out.push(`<li class="text-sm">${ordered[1]}</li>`);
    } else {
      closeLists();
      if (line.trim() === '') {
        out.push('<div class="h-2"></div>');
      } else if (!line.startsWith('<')) {
        out.push(`<p class="text-sm text-slate-700 leading-relaxed">${line}</p>`);
      } else {
        out.push(line);
      }
    }
  }
  closeLists();

  return out.join('\n');
}

interface Props {
  content: string;
  className?: string;
  emptyMessage?: string;
}

export function MarkdownPreview({ content, className = '', emptyMessage = 'No content yet.' }: Props) {
  if (!content?.trim()) {
    return (
      <div className={`flex items-center justify-center text-slate-400 text-sm italic py-12 ${className}`}>
        {emptyMessage}
      </div>
    );
  }
  const html = sanitizeHtml(parseMarkdown(content));
  return (
    <div
      className={`leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
