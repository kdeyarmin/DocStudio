import type { PdfSection } from '../types';

export interface PatientEducationData {
  title: string;
  content: string;
  category?: string;
  disclaimer?: string;
}

function parseMarkdownToSections(md: string): PdfSection[] {
  const sections: PdfSection[] = [];
  const lines = md.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('### ')) {
      sections.push({ type: 'heading', level: 3, text: line.slice(4).trim() });
      i++;
    } else if (line.startsWith('## ')) {
      sections.push({ type: 'heading', level: 2, text: line.slice(3).trim() });
      i++;
    } else if (line.startsWith('# ')) {
      sections.push({ type: 'heading', level: 1, text: line.slice(2).trim() });
      i++;
    } else if (line.startsWith('---') || line.startsWith('***')) {
      sections.push({ type: 'divider' });
      i++;
    } else if (/^\s*[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, '').trim());
        i++;
      }
      sections.push({ type: 'list', items });
    } else if (/^\s*\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, '').trim());
        i++;
      }
      sections.push({ type: 'list', items, ordered: true });
    } else if (line.trim().length > 0) {
      const textLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim().length > 0 &&
        !lines[i].startsWith('#') &&
        !lines[i].startsWith('---') &&
        !lines[i].startsWith('***') &&
        !/^\s*[-*]\s/.test(lines[i]) &&
        !/^\s*\d+\.\s/.test(lines[i])
      ) {
        textLines.push(lines[i].trim());
        i++;
      }
      sections.push({ type: 'paragraph', text: textLines.join(' ') });
    } else {
      i++;
    }
  }

  return sections;
}

export function buildPatientEducationSections(data: PatientEducationData): PdfSection[] {
  const sections: PdfSection[] = [];

  if (data.category) {
    sections.push({
      type: 'paragraph',
      text: `Category: ${data.category}`,
      highlight: 'normal',
    });
  }

  sections.push(...parseMarkdownToSections(data.content));

  sections.push({ type: 'divider' });
  sections.push({
    type: 'paragraph',
    text: data.disclaimer ||
      'This material is for informational purposes only and does not constitute medical advice. Always consult your healthcare provider for personalized guidance.',
    highlight: 'warning',
  });

  return sections;
}
