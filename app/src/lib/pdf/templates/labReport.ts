import type { PdfSection } from '../types';

function safeFormatDate(value: string | null | undefined, fallback = ''): string {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d.toLocaleDateString();
}

export interface LabResultItem {
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  flag?: 'normal' | 'high' | 'low' | 'critical_high' | 'critical_low';
}

export interface LabReportData {
  panelName?: string;
  orderDate: string;
  resultDate?: string;
  reportDate?: string;
  orderingProvider?: string;
  accessionNumber?: string;
  specimenType?: string;
  collectionDate?: string;
  labFacility?: string;
  priority?: string;
  status?: string;
  results: LabResultItem[];
  interpretation?: string;
  notes?: string;
}

function flagLabel(flag?: string): string {
  const map: Record<string, string> = {
    normal: 'Normal',
    high: 'H',
    low: 'L',
    critical_high: 'HH',
    critical_low: 'LL',
  };
  return flag ? map[flag] || flag : '';
}

export function buildLabReportSections(data: LabReportData): PdfSection[] {
  const sections: PdfSection[] = [];

  if (data.panelName) {
    sections.push({ type: 'heading', level: 2, text: data.panelName });
  }

  const info: { label: string; value: string }[] = [
    { label: 'Order Date', value: safeFormatDate(data.orderDate) },
  ];
  if (data.resultDate) info.push({ label: 'Result Date', value: safeFormatDate(data.resultDate) });
  if (data.reportDate) info.push({ label: 'Report Date', value: safeFormatDate(data.reportDate) });
  if (data.orderingProvider) info.push({ label: 'Ordering Provider', value: data.orderingProvider });
  if (data.accessionNumber) info.push({ label: 'Accession #', value: data.accessionNumber });
  if (data.specimenType) info.push({ label: 'Specimen Type', value: data.specimenType });
  if (data.collectionDate) info.push({ label: 'Collection Date', value: safeFormatDate(data.collectionDate) });
  if (data.labFacility) info.push({ label: 'Lab Facility', value: data.labFacility });
  if (data.priority) info.push({ label: 'Priority', value: data.priority });
  if (data.status) info.push({ label: 'Status', value: data.status });

  sections.push({ type: 'keyValue', pairs: info });

  const criticals = data.results.filter(
    (r) => r.flag === 'critical_high' || r.flag === 'critical_low'
  );
  if (criticals.length > 0) {
    sections.push({
      type: 'paragraph',
      text: `CRITICAL VALUES: ${criticals.map((c) => `${c.testName} = ${c.value} ${c.unit || ''} (${flagLabel(c.flag)})`).join('; ')}`,
      highlight: 'critical',
    });
  }

  sections.push({ type: 'heading', level: 2, text: 'Results' });
  sections.push({
    type: 'table',
    headers: ['Test', 'Value', 'Unit', 'Reference Range', 'Flag'],
    rows: data.results.map((r) => [
      r.testName,
      r.value,
      r.unit || '',
      r.referenceRange || '',
      flagLabel(r.flag),
    ]),
  });

  const abnormals = data.results.filter((r) => r.flag && r.flag !== 'normal');
  if (abnormals.length > 0) {
    sections.push({ type: 'heading', level: 3, text: 'Abnormal Results Summary' });
    sections.push({
      type: 'list',
      items: abnormals.map(
        (r) => `${r.testName}: ${r.value} ${r.unit || ''} (${flagLabel(r.flag)}) - Ref: ${r.referenceRange || 'N/A'}`
      ),
    });
  }

  if (data.interpretation) {
    sections.push({ type: 'divider' });
    sections.push({ type: 'heading', level: 2, text: 'Interpretation' });
    sections.push({ type: 'paragraph', text: data.interpretation });
  }

  if (data.notes) {
    sections.push({ type: 'divider' });
    sections.push({ type: 'heading', level: 3, text: 'Notes' });
    sections.push({ type: 'paragraph', text: data.notes });
  }

  return sections;
}
