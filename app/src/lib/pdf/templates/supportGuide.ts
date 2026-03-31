import type { PdfSection } from '../types';

export interface SupportGuideData {
  content: string;
  category?: string;
  version?: string;
  lastUpdated?: string;
}

function cleanInlineMarkdown(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
}

function parseTableBlock(lines: string[]): PdfSection | null {
  const parsed: string[][] = [];
  for (const row of lines) {
    const cells = row.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length === 0) continue;
    if (/^(?:[-:]|\t| )+$/.test(cells.join(''))) continue;
    parsed.push(cells.map(cleanInlineMarkdown));
  }
  if (parsed.length < 2) return null;
  return { type: 'table', headers: parsed[0], rows: parsed.slice(1) };
}

function parseMarkdownToSections(markdown: string): PdfSection[] {
  const sections: PdfSection[] = [];
  const lines = markdown.split('\n');
  let currentListItems: string[] = [];
  let currentListOrdered = false;
  let tableBuffer: string[] = [];
  let blockquoteBuffer: string[] = [];

  function flushList() {
    if (currentListItems.length > 0) {
      sections.push({
        type: 'list',
        items: currentListItems,
        ordered: currentListOrdered,
      });
      currentListItems = [];
    }
  }

  function flushTable() {
    if (tableBuffer.length > 0) {
      const table = parseTableBlock(tableBuffer);
      if (table) sections.push(table);
      tableBuffer = [];
    }
  }

  function flushBlockquote() {
    if (blockquoteBuffer.length > 0) {
      const text = blockquoteBuffer.join(' ');
      const highlight = /^(tip|note|info)/i.test(text) ? 'success' as const
        : /^(warning|caution|important)/i.test(text) ? 'warning' as const
        : 'success' as const;
      sections.push({ type: 'paragraph', text: cleanInlineMarkdown(text), highlight });
      blockquoteBuffer = [];
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      flushBlockquote();
      tableBuffer.push(trimmed);
      continue;
    }
    flushTable();

    if (trimmed.startsWith('> ')) {
      flushList();
      blockquoteBuffer.push(trimmed.slice(2));
      continue;
    }
    flushBlockquote();

    if (trimmed.startsWith('### ')) {
      flushList();
      sections.push({ type: 'heading', level: 3, text: trimmed.slice(4) });
    } else if (trimmed.startsWith('## ')) {
      flushList();
      sections.push({ type: 'heading', level: 2, text: trimmed.slice(3) });
    } else if (trimmed.startsWith('# ')) {
      flushList();
      sections.push({ type: 'heading', level: 1, text: trimmed.slice(2) });
    } else if (trimmed === '---' || trimmed === '***') {
      flushList();
      sections.push({ type: 'divider' });
    } else if (/^[-*]\s/.test(trimmed)) {
      if (currentListItems.length > 0 && currentListOrdered) {
        flushList();
      }
      currentListOrdered = false;
      currentListItems.push(trimmed.slice(2));
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (currentListItems.length > 0 && !currentListOrdered) {
        flushList();
      }
      currentListOrdered = true;
      currentListItems.push(trimmed.replace(/^\d+\.\s/, ''));
    } else if (/^!\[.*?\]\(.*?\)/.test(trimmed)) {
      flushList();
      const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)/);
      if (imgMatch) {
        sections.push({
          type: 'image',
          imageUrl: imgMatch[2],
          imageCaption: imgMatch[1] || undefined,
        });
      }
    } else if (trimmed.length > 0) {
      flushList();
      sections.push({ type: 'paragraph', text: cleanInlineMarkdown(trimmed) });
    }
  }

  flushList();
  flushTable();
  flushBlockquote();
  return sections;
}

export function buildSupportGuideSections(data: SupportGuideData): PdfSection[] {
  const sections: PdfSection[] = [];

  if (data.category || data.version || data.lastUpdated) {
    const pairs: { label: string; value: string }[] = [];
    if (data.category) pairs.push({ label: 'Category', value: data.category });
    if (data.version) pairs.push({ label: 'Version', value: data.version });
    if (data.lastUpdated) pairs.push({ label: 'Last Updated', value: data.lastUpdated });
    sections.push({ type: 'keyValue', pairs });
    sections.push({ type: 'spacer' });
  }

  sections.push(...parseMarkdownToSections(data.content));

  sections.push({ type: 'divider' });
  sections.push({
    type: 'paragraph',
    text: 'For additional support, contact our team at support@caremetric.ai or visit our Help Center.',
  });

  return sections;
}
