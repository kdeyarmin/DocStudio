import type { PdfSection } from '../types';

function safeFormatDate(value: string | null | undefined, fallback = ''): string {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d.toLocaleDateString();
}

function safeFormatDateTime(value: string | null | undefined, fallback = ''): string {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d.toLocaleString();
}

export interface ChartPrintData {
  demographics?: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    phone?: string;
    email?: string;
    address?: string;
    mrn?: string;
    ssn?: string;
    preferredLanguage?: string;
    maritalStatus?: string;
    race?: string;
    ethnicity?: string;
    emergencyContacts?: { name: string; relationship: string; phone: string }[];
  };
  insurance?: {
    primary?: {
      payer: string;
      memberId: string;
      groupNumber?: string;
      planType?: string;
      copay?: string;
      status?: string;
    };
    secondary?: {
      payer: string;
      memberId: string;
      groupNumber?: string;
    };
  };
  allergies?: string[];
  problems?: {
    description: string;
    icdCode?: string;
    status?: string;
    onsetDate?: string;
    severity?: string;
  }[];
  medications?: {
    name: string;
    dosage: string;
    frequency: string;
    route?: string;
    status: string;
    prescribedDate?: string;
  }[];
  vitals?: {
    recordedAt: string;
    values: { label: string; value: string }[];
  }[];
  labResults?: {
    testName: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    flag?: string;
    resultDate: string;
  }[];
  visitHistory?: {
    date: string;
    type: string;
    provider: string;
    status: string;
    chiefComplaint?: string;
  }[];
  immunizations?: { name: string; date: string; site?: string; lot?: string }[];
  assessments?: {
    name: string;
    score: number;
    maxScore: number;
    interpretation: string;
    completedAt: string;
  }[];
  careGaps?: { measure: string; dueDate?: string; status: string }[];
  socialHistory?: {
    smokingStatus?: string;
    alcoholUse?: string;
    exerciseFrequency?: string;
    livingSituation?: string;
    occupation?: string;
  };
  providerName?: string;
}

export type ChartSection =
  | 'demographics'
  | 'insurance'
  | 'allergies'
  | 'problems'
  | 'medications'
  | 'vitals'
  | 'labResults'
  | 'visitHistory'
  | 'immunizations'
  | 'assessments'
  | 'careGaps'
  | 'socialHistory';

export const CHART_SECTION_LABELS: Record<ChartSection, string> = {
  demographics: 'Demographics',
  insurance: 'Insurance',
  allergies: 'Allergies',
  problems: 'Problem List',
  medications: 'Medications',
  vitals: 'Vital Signs',
  labResults: 'Lab Results',
  visitHistory: 'Visit History',
  immunizations: 'Immunizations',
  assessments: 'Assessments',
  careGaps: 'Care Gaps',
  socialHistory: 'Social History',
};

export const DEFAULT_CHART_SECTIONS: ChartSection[] = [
  'demographics',
  'insurance',
  'allergies',
  'problems',
  'medications',
  'vitals',
  'labResults',
  'visitHistory',
  'immunizations',
  'assessments',
  'careGaps',
  'socialHistory',
];

export function buildChartPrintSections(
  data: ChartPrintData,
  selectedSections: ChartSection[]
): PdfSection[] {
  const sections: PdfSection[] = [];

  if (selectedSections.includes('demographics') && data.demographics) {
    sections.push({ type: 'heading', level: 2, text: 'Demographics' });
    const pairs: { label: string; value: string }[] = [
      { label: 'Name', value: `${data.demographics.firstName} ${data.demographics.lastName}` },
      { label: 'Date of Birth', value: safeFormatDate(data.demographics.dateOfBirth) },
      { label: 'Gender', value: data.demographics.gender },
    ];
    if (data.demographics.mrn) pairs.push({ label: 'MRN', value: data.demographics.mrn });
    if (data.demographics.phone) pairs.push({ label: 'Phone', value: data.demographics.phone });
    if (data.demographics.email) pairs.push({ label: 'Email', value: data.demographics.email });
    if (data.demographics.address) pairs.push({ label: 'Address', value: data.demographics.address });
    if (data.demographics.preferredLanguage) pairs.push({ label: 'Language', value: data.demographics.preferredLanguage });
    if (data.demographics.maritalStatus) pairs.push({ label: 'Marital Status', value: data.demographics.maritalStatus });
    if (data.demographics.race) pairs.push({ label: 'Race', value: data.demographics.race });
    if (data.demographics.ethnicity) pairs.push({ label: 'Ethnicity', value: data.demographics.ethnicity });
    sections.push({ type: 'keyValue', pairs });

    if (data.demographics.emergencyContacts && data.demographics.emergencyContacts.length > 0) {
      sections.push({ type: 'heading', level: 3, text: 'Emergency Contacts' });
      sections.push({
        type: 'table',
        headers: ['Name', 'Relationship', 'Phone'],
        rows: data.demographics.emergencyContacts.map(c => [c.name, c.relationship, c.phone]),
      });
    }
    sections.push({ type: 'spacer' });
  }

  if (selectedSections.includes('insurance') && data.insurance) {
    sections.push({ type: 'heading', level: 2, text: 'Insurance' });
    if (data.insurance.primary) {
      sections.push({ type: 'heading', level: 3, text: 'Primary Insurance' });
      const pairs: { label: string; value: string }[] = [
        { label: 'Payer', value: data.insurance.primary.payer },
        { label: 'Member ID', value: data.insurance.primary.memberId },
      ];
      if (data.insurance.primary.groupNumber) pairs.push({ label: 'Group #', value: data.insurance.primary.groupNumber });
      if (data.insurance.primary.planType) pairs.push({ label: 'Plan Type', value: data.insurance.primary.planType });
      if (data.insurance.primary.copay) pairs.push({ label: 'Copay', value: data.insurance.primary.copay });
      if (data.insurance.primary.status) pairs.push({ label: 'Status', value: data.insurance.primary.status });
      sections.push({ type: 'keyValue', pairs });
    }
    if (data.insurance.secondary) {
      sections.push({ type: 'heading', level: 3, text: 'Secondary Insurance' });
      const pairs: { label: string; value: string }[] = [
        { label: 'Payer', value: data.insurance.secondary.payer },
        { label: 'Member ID', value: data.insurance.secondary.memberId },
      ];
      if (data.insurance.secondary.groupNumber) pairs.push({ label: 'Group #', value: data.insurance.secondary.groupNumber });
      sections.push({ type: 'keyValue', pairs });
    }
    sections.push({ type: 'spacer' });
  }

  if (selectedSections.includes('allergies')) {
    sections.push({ type: 'heading', level: 2, text: 'Allergies' });
    if (data.allergies && data.allergies.length > 0) {
      sections.push({ type: 'paragraph', text: data.allergies.join(', '), highlight: 'warning' });
    } else {
      sections.push({ type: 'paragraph', text: 'No Known Drug Allergies (NKDA)', highlight: 'success' });
    }
    sections.push({ type: 'spacer' });
  }

  if (selectedSections.includes('problems') && data.problems && data.problems.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Problem List' });
    sections.push({
      type: 'table',
      headers: ['Problem', 'ICD-10', 'Status', 'Severity', 'Onset'],
      rows: data.problems.map(p => [
        p.description,
        p.icdCode || '',
        p.status || '',
        p.severity || '',
        safeFormatDate(p.onsetDate),
      ]),
    });
    sections.push({ type: 'spacer' });
  }

  if (selectedSections.includes('medications') && data.medications && data.medications.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Current Medications' });
    sections.push({
      type: 'table',
      headers: ['Medication', 'Dosage', 'Frequency', 'Route', 'Status'],
      rows: data.medications.map(m => [
        m.name,
        m.dosage,
        m.frequency,
        m.route || '',
        m.status,
      ]),
    });
    sections.push({ type: 'spacer' });
  }

  if (selectedSections.includes('vitals') && data.vitals && data.vitals.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Vital Signs' });
    for (const vitalSet of data.vitals.slice(0, 5)) {
      sections.push({
        type: 'heading',
        level: 3,
        text: `Recorded: ${safeFormatDateTime(vitalSet.recordedAt, 'Unknown date')}`,
      });
      sections.push({ type: 'keyValue', pairs: vitalSet.values });
    }
    sections.push({ type: 'spacer' });
  }

  if (selectedSections.includes('labResults') && data.labResults && data.labResults.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Lab Results' });
    const criticalResults = data.labResults.filter(r => r.flag && (r.flag.includes('critical') || r.flag.includes('Critical')));
    if (criticalResults.length > 0) {
      sections.push({
        type: 'paragraph',
        text: `${criticalResults.length} critical result(s) flagged`,
        highlight: 'critical',
      });
    }
    sections.push({
      type: 'table',
      headers: ['Test', 'Value', 'Unit', 'Reference Range', 'Flag', 'Date'],
      rows: data.labResults.map(r => [
        r.testName,
        r.value,
        r.unit || '',
        r.referenceRange || '',
        r.flag || 'Normal',
        safeFormatDate(r.resultDate),
      ]),
    });
    sections.push({ type: 'spacer' });
  }

  if (selectedSections.includes('visitHistory') && data.visitHistory && data.visitHistory.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Visit History' });
    sections.push({
      type: 'table',
      headers: ['Date', 'Type', 'Provider', 'Chief Complaint', 'Status'],
      rows: data.visitHistory.map(v => [
        safeFormatDate(v.date),
        v.type,
        v.provider,
        v.chiefComplaint || '',
        v.status,
      ]),
    });
    sections.push({ type: 'spacer' });
  }

  if (selectedSections.includes('immunizations') && data.immunizations && data.immunizations.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Immunizations' });
    sections.push({
      type: 'table',
      headers: ['Vaccine', 'Date', 'Site', 'Lot #'],
      rows: data.immunizations.map(i => [
        i.name,
        safeFormatDate(i.date),
        i.site || '',
        i.lot || '',
      ]),
    });
    sections.push({ type: 'spacer' });
  }

  if (selectedSections.includes('assessments') && data.assessments && data.assessments.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Assessment Scores' });
    sections.push({
      type: 'table',
      headers: ['Assessment', 'Score', 'Interpretation', 'Date'],
      rows: data.assessments.map(a => [
        a.name,
        `${a.score}/${a.maxScore}`,
        a.interpretation,
        safeFormatDate(a.completedAt),
      ]),
    });
    sections.push({ type: 'spacer' });
  }

  if (selectedSections.includes('careGaps') && data.careGaps && data.careGaps.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Care Gaps' });
    sections.push({
      type: 'table',
      headers: ['Measure', 'Due Date', 'Status'],
      rows: data.careGaps.map(g => [
        g.measure,
        safeFormatDate(g.dueDate),
        g.status,
      ]),
    });
    sections.push({ type: 'spacer' });
  }

  if (selectedSections.includes('socialHistory') && data.socialHistory) {
    sections.push({ type: 'heading', level: 2, text: 'Social History' });
    const pairs: { label: string; value: string }[] = [];
    if (data.socialHistory.smokingStatus) pairs.push({ label: 'Smoking Status', value: data.socialHistory.smokingStatus });
    if (data.socialHistory.alcoholUse) pairs.push({ label: 'Alcohol Use', value: data.socialHistory.alcoholUse });
    if (data.socialHistory.exerciseFrequency) pairs.push({ label: 'Exercise', value: data.socialHistory.exerciseFrequency });
    if (data.socialHistory.livingSituation) pairs.push({ label: 'Living Situation', value: data.socialHistory.livingSituation });
    if (data.socialHistory.occupation) pairs.push({ label: 'Occupation', value: data.socialHistory.occupation });
    if (pairs.length > 0) {
      sections.push({ type: 'keyValue', pairs });
    }
    sections.push({ type: 'spacer' });
  }

  sections.push({ type: 'divider' });
  sections.push({
    type: 'paragraph',
    text: `Chart printed on ${new Date().toLocaleString()}${data.providerName ? ` by ${data.providerName}` : ''}. This document contains confidential patient health information.`,
  });

  return sections;
}
