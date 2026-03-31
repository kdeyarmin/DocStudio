import type { PdfSection } from '../types';

function safeFormatDate(value: string | null | undefined, fallback = ''): string {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d.toLocaleDateString();
}

export interface PatientSummaryData {
  demographics: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    phone?: string;
    email?: string;
    address?: string;
    mrn?: string;
  };
  insurance?: {
    provider: string;
    memberId: string;
    status: string;
  };
  allergies?: string[];
  medications?: {
    name: string;
    dosage: string;
    frequency: string;
    status: string;
  }[];
  problems?: {
    description: string;
    icdCode?: string;
    status?: string;
    onsetDate?: string;
  }[];
  vitals?: { label: string; value: string }[];
  recentVisits?: {
    date: string;
    type: string;
    provider: string;
    status: string;
  }[];
  recentLabs?: {
    testName: string;
    value: string;
    date: string;
    flag?: string;
  }[];
  immunizations?: { name: string; date: string }[];
  upcomingAppointments?: {
    date: string;
    time: string;
    type: string;
    provider: string;
  }[];
  careGaps?: string[];
  providerName?: string;
}

export function buildPatientSummarySections(data: PatientSummaryData): PdfSection[] {
  const sections: PdfSection[] = [];

  sections.push({ type: 'heading', level: 2, text: 'Demographics' });
  const demoPairs: { label: string; value: string }[] = [
    { label: 'Name', value: `${data.demographics.firstName} ${data.demographics.lastName}` },
    { label: 'Date of Birth', value: safeFormatDate(data.demographics.dateOfBirth) },
    { label: 'Gender', value: data.demographics.gender },
  ];
  if (data.demographics.mrn) demoPairs.push({ label: 'MRN', value: data.demographics.mrn });
  if (data.demographics.phone) demoPairs.push({ label: 'Phone', value: data.demographics.phone });
  if (data.demographics.email) demoPairs.push({ label: 'Email', value: data.demographics.email });
  if (data.demographics.address) demoPairs.push({ label: 'Address', value: data.demographics.address });
  sections.push({ type: 'keyValue', pairs: demoPairs });

  if (data.insurance) {
    sections.push({ type: 'heading', level: 2, text: 'Insurance' });
    sections.push({
      type: 'keyValue',
      pairs: [
        { label: 'Provider', value: data.insurance.provider },
        { label: 'Member ID', value: data.insurance.memberId },
        { label: 'Status', value: data.insurance.status },
      ],
    });
  }

  if (data.allergies && data.allergies.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Allergies' });
    sections.push({ type: 'paragraph', text: data.allergies.join(', '), highlight: 'warning' });
  }

  if (data.problems && data.problems.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Problem List' });
    sections.push({
      type: 'table',
      headers: ['Problem', 'ICD-10', 'Status', 'Onset'],
      rows: data.problems.map(p => [
        p.description,
        p.icdCode || '',
        p.status || '',
        safeFormatDate(p.onsetDate),
      ]),
    });
  }

  if (data.medications && data.medications.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Current Medications' });
    sections.push({
      type: 'table',
      headers: ['Medication', 'Dosage', 'Frequency', 'Status'],
      rows: data.medications.map(m => [m.name, m.dosage, m.frequency, m.status]),
    });
  }

  if (data.vitals && data.vitals.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Recent Vitals' });
    sections.push({ type: 'keyValue', pairs: data.vitals });
  }

  if (data.recentVisits && data.recentVisits.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Recent Visits' });
    sections.push({
      type: 'table',
      headers: ['Date', 'Type', 'Provider', 'Status'],
      rows: data.recentVisits.map(v => [
        safeFormatDate(v.date),
        v.type,
        v.provider,
        v.status,
      ]),
    });
  }

  if (data.recentLabs && data.recentLabs.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Recent Lab Results' });
    sections.push({
      type: 'table',
      headers: ['Test', 'Result', 'Date', 'Flag'],
      rows: data.recentLabs.map(l => [l.testName, l.value, safeFormatDate(l.date), l.flag || 'Normal']),
    });
  }

  if (data.immunizations && data.immunizations.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Immunizations' });
    sections.push({
      type: 'table',
      headers: ['Vaccine', 'Date Administered'],
      rows: data.immunizations.map(i => [i.name, safeFormatDate(i.date)]),
    });
  }

  if (data.upcomingAppointments && data.upcomingAppointments.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Upcoming Appointments' });
    sections.push({
      type: 'table',
      headers: ['Date', 'Time', 'Type', 'Provider'],
      rows: data.upcomingAppointments.map(a => [
        safeFormatDate(a.date),
        a.time,
        a.type,
        a.provider,
      ]),
    });
  }

  if (data.careGaps && data.careGaps.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Care Gaps' });
    sections.push({ type: 'list', items: data.careGaps });
  }

  sections.push({ type: 'divider' });
  sections.push({
    type: 'paragraph',
    text: `Report generated on ${new Date().toLocaleDateString()}${data.providerName ? ` by ${data.providerName}` : ''}`,
  });

  return sections;
}
