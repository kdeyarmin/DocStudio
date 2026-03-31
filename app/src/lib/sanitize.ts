import DOMPurify from 'dompurify';

const SANITIZE_HOOKS_FLAG = '__cm_sanitize_hooks_installed__';
const sanitizeHookState = globalThis as typeof globalThis & {
  [SANITIZE_HOOKS_FLAG]?: boolean;
};

export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeFilterValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

export const escapeOrFilterValue = escapeFilterValue;

function isSafeUrl(url: string): boolean {
  return /^(https?:|mailto:|tel:|\/|#)/i.test(url);
}

function formatInlineMarkdown(value: string): string {
  const escapedValue = escapeHtml(value);

  return escapedValue
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_match, label: string, rawTarget: string) => {
        const href = rawTarget.trim();
        if (!isSafeUrl(href)) {
          return `<span>${label}</span>`;
        }
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      },
    )
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

// Enforce rel="noopener noreferrer" on every <a target="_blank"> to prevent
// tab-napping (the opened page accessing window.opener to redirect the parent).
if (!sanitizeHookState[SANITIZE_HOOKS_FLAG]) {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
    if (node.tagName === 'A') {
      const href = node.getAttribute('href')?.trim();
      if (href && !/^(https?:|mailto:|tel:|\/|#)/i.test(href)) {
        node.removeAttribute('href');
      }
    }
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src')?.trim();
      if (src && !/^(https?:|\/)/i.test(src)) {
        node.removeAttribute('src');
      }
    }
  });

  sanitizeHookState[SANITIZE_HOOKS_FLAG] = true;
}

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'strong', 'b', 'em', 'i', 'u',
      'a', 'span', 'div',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'blockquote', 'code', 'pre',
      'img'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'id',
      'src', 'alt', 'width', 'height'
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    ALLOW_DATA_ATTR: false,
  });
}

export function convertMarkdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const htmlParts: string[] = [];
  let listBuffer: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let inParagraph = false;

  const flushList = () => {
    if (!listType || listBuffer.length === 0) {
      listBuffer = [];
      listType = null;
      return;
    }

    htmlParts.push(`<${listType}>${listBuffer.join('')}</${listType}>`);
    listBuffer = [];
    listType = null;
  };

  const closeParagraph = () => {
    if (inParagraph) {
      htmlParts.push('</p>');
      inParagraph = false;
    }
  };

  const openParagraph = () => {
    if (!inParagraph) {
      htmlParts.push('<p>');
      inParagraph = true;
    }
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      flushList();
      closeParagraph();
      continue;
    }

    const taskUncheckedMatch = /^- \[ \] (.*)$/.exec(trimmedLine);
    const taskCheckedMatch = /^- \[[xX]\] (.*)$/.exec(trimmedLine);
    const unorderedMatch = /^- (.*)$/.exec(trimmedLine);
    const orderedMatch = /^\d+\. (.*)$/.exec(trimmedLine);

    if (trimmedLine === '---') {
      flushList();
      closeParagraph();
      htmlParts.push('<hr>');
      continue;
    }

    if (trimmedLine.startsWith('### ')) {
      flushList();
      closeParagraph();
      htmlParts.push(`<h3>${formatInlineMarkdown(trimmedLine.slice(4))}</h3>`);
      continue;
    }

    if (trimmedLine.startsWith('## ')) {
      flushList();
      closeParagraph();
      htmlParts.push(`<h2>${formatInlineMarkdown(trimmedLine.slice(3))}</h2>`);
      continue;
    }

    if (trimmedLine.startsWith('# ')) {
      flushList();
      closeParagraph();
      htmlParts.push(`<h1>${formatInlineMarkdown(trimmedLine.slice(2))}</h1>`);
      continue;
    }

    if (taskUncheckedMatch) {
      closeParagraph();
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listBuffer.push(`<li><span class="inline-block w-4 h-4 border border-slate-300 rounded mr-2 align-middle"></span> ${formatInlineMarkdown(taskUncheckedMatch[1])}</li>`);
      continue;
    }

    if (taskCheckedMatch) {
      closeParagraph();
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listBuffer.push(`<li><span class="inline-block w-4 h-4 bg-blue-500 border border-blue-500 rounded mr-2 align-middle"></span> ${formatInlineMarkdown(taskCheckedMatch[1])}</li>`);
      continue;
    }

    if (unorderedMatch) {
      closeParagraph();
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listBuffer.push(`<li>${formatInlineMarkdown(unorderedMatch[1])}</li>`);
      continue;
    }

    if (orderedMatch) {
      closeParagraph();
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listBuffer.push(`<li>${formatInlineMarkdown(orderedMatch[1])}</li>`);
      continue;
    }

    flushList();
    if (inParagraph) {
      htmlParts.push('<br>');
    } else {
      openParagraph();
    }
    htmlParts.push(formatInlineMarkdown(trimmedLine));
  }

  flushList();
  closeParagraph();

  return sanitizeHtml(htmlParts.join(''));
}
