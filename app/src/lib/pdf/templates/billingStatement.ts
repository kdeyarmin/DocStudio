import type { PdfSection } from '../types';

function safeFormatDate(value: string | null | undefined, fallback = ''): string {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d.toLocaleDateString();
}

export interface BillingLineItem {
  date: string;
  description: string;
  cptCode?: string;
  quantity?: number;
  chargeAmount: number;
  adjustmentAmount?: number;
  paidAmount?: number;
  balanceAmount: number;
}

export interface BillingStatementData {
  statementDate?: string;
  statementNumber?: string;
  accountNumber?: string;
  patient: {
    name: string;
    address?: string;
    phone?: string;
  };
  insuranceProvider?: string;
  lineItems: BillingLineItem[];
  totalCharges: number;
  totalAdjustments?: number;
  totalInsurancePaid?: number;
  totalPatientPaid?: number;
  totalBalance: number;
  agingBuckets?: {
    current: number;
    thirtyDay: number;
    sixtyDay: number;
    ninetyDay: number;
    overNinetyDay: number;
  };
  paymentInstructions?: string;
  dueDate?: string;
}

export function buildBillingStatementSections(data: BillingStatementData): PdfSection[] {
  const sections: PdfSection[] = [];
  const fmt = (n: number) => `$${(isNaN(n) || !isFinite(n) ? 0 : n).toFixed(2)}`;

  const headerPairs: { label: string; value: string }[] = [
    { label: 'Statement Date', value: data.statementDate || new Date().toLocaleDateString() },
  ];
  if (data.statementNumber) headerPairs.push({ label: 'Statement #', value: data.statementNumber });
  if (data.accountNumber) headerPairs.push({ label: 'Account #', value: data.accountNumber });
  if (data.dueDate) headerPairs.push({ label: 'Due Date', value: safeFormatDate(data.dueDate) });
  headerPairs.push({ label: 'Patient', value: data.patient.name });
  if (data.patient.address) headerPairs.push({ label: 'Address', value: data.patient.address });
  if (data.insuranceProvider) headerPairs.push({ label: 'Insurance', value: data.insuranceProvider });
  sections.push({ type: 'keyValue', pairs: headerPairs });

  sections.push({ type: 'spacer' });
  sections.push({ type: 'heading', level: 2, text: 'Charges' });

  if (data.lineItems.length > 0) {
    sections.push({
      type: 'table',
      headers: ['Date', 'Description', 'CPT', 'Charges', 'Adjustments', 'Paid', 'Balance'],
      rows: data.lineItems.map(item => [
        item.date,
        item.description,
        item.cptCode || '',
        fmt(item.chargeAmount),
        item.adjustmentAmount ? fmt(item.adjustmentAmount) : '$0.00',
        item.paidAmount ? fmt(item.paidAmount) : '$0.00',
        fmt(item.balanceAmount),
      ]),
    });
  }

  sections.push({ type: 'divider' });
  sections.push({ type: 'heading', level: 2, text: 'Account Summary' });
  const summaryPairs: { label: string; value: string }[] = [
    { label: 'Total Charges', value: fmt(data.totalCharges) },
  ];
  if (data.totalAdjustments !== undefined) summaryPairs.push({ label: 'Adjustments', value: fmt(data.totalAdjustments) });
  if (data.totalInsurancePaid !== undefined) summaryPairs.push({ label: 'Insurance Payments', value: fmt(data.totalInsurancePaid) });
  if (data.totalPatientPaid !== undefined) summaryPairs.push({ label: 'Patient Payments', value: fmt(data.totalPatientPaid) });
  summaryPairs.push({ label: 'Amount Due', value: fmt(data.totalBalance) });
  sections.push({ type: 'keyValue', pairs: summaryPairs });

  if (data.agingBuckets) {
    sections.push({ type: 'spacer' });
    sections.push({ type: 'heading', level: 2, text: 'Aging Summary' });
    sections.push({
      type: 'table',
      headers: ['Current', '31-60 Days', '61-90 Days', '91+ Days', 'Over 120 Days'],
      rows: [[
        fmt(data.agingBuckets.current),
        fmt(data.agingBuckets.thirtyDay),
        fmt(data.agingBuckets.sixtyDay),
        fmt(data.agingBuckets.ninetyDay),
        fmt(data.agingBuckets.overNinetyDay),
      ]],
    });
  }

  if (data.paymentInstructions) {
    sections.push({ type: 'divider' });
    sections.push({ type: 'heading', level: 2, text: 'Payment Information' });
    sections.push({ type: 'paragraph', text: data.paymentInstructions });
  }

  return sections;
}
