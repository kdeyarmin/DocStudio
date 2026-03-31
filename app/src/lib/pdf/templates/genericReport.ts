import type { PdfSection } from '../types';

export interface ReportColumn {
  header: string;
  key: string;
}

export interface GenericReportData {
  summary?: { label: string; value: string }[];
  columns?: ReportColumn[];
  rows?: Record<string, string>[];
  notes?: string;
  totals?: { label: string; value: string }[];
}

export function buildGenericReportSections(data: GenericReportData): PdfSection[] {
  const sections: PdfSection[] = [];

  if (data.summary && data.summary.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Summary' });
    sections.push({ type: 'keyValue', pairs: data.summary });
    sections.push({ type: 'spacer' });
  }

  if (data.columns && data.rows && data.rows.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Details' });
    sections.push({
      type: 'table',
      headers: data.columns.map((c) => c.header),
      rows: data.rows.map((row) =>
        data.columns!.map((c) => row[c.key] || '')
      ),
    });
  }

  if (data.totals && data.totals.length > 0) {
    sections.push({ type: 'divider' });
    sections.push({ type: 'heading', level: 2, text: 'Totals' });
    sections.push({ type: 'keyValue', pairs: data.totals });
  }

  if (data.notes) {
    sections.push({ type: 'divider' });
    sections.push({ type: 'heading', level: 3, text: 'Notes' });
    sections.push({ type: 'paragraph', text: data.notes });
  }

  return sections;
}
