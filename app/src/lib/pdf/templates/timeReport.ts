import type { PdfSection } from '../types';

const safeNum = (n: number, decimals: number) =>
  (isNaN(n) || !isFinite(n) ? 0 : n).toFixed(decimals);

export interface TimeReportEntry {
  employeeName: string;
  daysWorked: number;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  totalHours: number;
  estimatedPay?: number;
}

export interface TimeReportData {
  dateRange: { start: string; end: string };
  entries: TimeReportEntry[];
  hourlyRate?: number;
  multipliers?: { overtime: number; doubleTime: number };
  totals?: {
    totalRegularHours: number;
    totalOvertimeHours: number;
    totalDoubleTimeHours: number;
    totalHours: number;
    totalPay?: number;
  };
}

export function buildTimeReportSections(data: TimeReportData): PdfSection[] {
  const sections: PdfSection[] = [];

  sections.push({
    type: 'keyValue',
    pairs: [
      { label: 'Period', value: `${data.dateRange.start} - ${data.dateRange.end}` },
      ...(data.hourlyRate ? [{ label: 'Base Rate', value: `$${(isNaN(data.hourlyRate) || !isFinite(data.hourlyRate) ? 0 : data.hourlyRate).toFixed(2)}/hr` }] : []),
      ...(data.multipliers ? [
        { label: 'OT Multiplier', value: `${data.multipliers.overtime}x` },
        { label: 'DT Multiplier', value: `${data.multipliers.doubleTime}x` },
      ] : []),
    ],
  });

  sections.push({ type: 'spacer' });
  sections.push({ type: 'heading', level: 2, text: 'Employee Hours' });

  if (data.entries.length > 0) {
    const showPay = data.entries.some(e => e.estimatedPay !== undefined);
    const headers = ['Employee', 'Days', 'Regular', 'Overtime', 'Double Time', 'Total'];
    if (showPay) headers.push('Est. Pay');

    sections.push({
      type: 'table',
      headers,
      rows: data.entries.map(e => {
        const row = [
          e.employeeName,
          String(e.daysWorked),
          safeNum(e.regularHours, 1),
          safeNum(e.overtimeHours, 1),
          safeNum(e.doubleTimeHours, 1),
          safeNum(e.totalHours, 1),
        ];
        if (showPay) row.push(e.estimatedPay !== undefined ? `$${safeNum(e.estimatedPay, 2)}` : '');
        return row;
      }),
    });
  }

  if (data.totals) {
    sections.push({ type: 'divider' });
    sections.push({ type: 'heading', level: 2, text: 'Totals' });
    const totalPairs: { label: string; value: string }[] = [
      { label: 'Regular Hours', value: safeNum(data.totals.totalRegularHours, 1) },
      { label: 'Overtime Hours', value: safeNum(data.totals.totalOvertimeHours, 1) },
      { label: 'Double Time Hours', value: safeNum(data.totals.totalDoubleTimeHours, 1) },
      { label: 'Total Hours', value: safeNum(data.totals.totalHours, 1) },
    ];
    if (data.totals.totalPay !== undefined) {
      totalPairs.push({ label: 'Total Estimated Pay', value: `$${safeNum(data.totals.totalPay, 2)}` });
    }
    sections.push({ type: 'keyValue', pairs: totalPairs });
  }

  return sections;
}
