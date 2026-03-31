import type { PdfSection } from '../types';

function safeFormatDate(value: string | null | undefined, fallback = ''): string {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d.toLocaleDateString();
}

export interface VisitNoteData {
  visitDate: string;
  visitType: string;
  chiefComplaint?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  vitalSigns?: { label: string; value: string }[];
  allergies?: string[];
  diagnoses?: { code: string; description: string }[];
  cptCodes?: { code: string; description: string }[];
  medications?: string[];
  complianceScore?: number;
  providerName?: string;
  providerCredentials?: string;
  signedAt?: string;
  addendums?: { author: string; date: string; text: string }[];
}

export function buildVisitNoteSections(data: VisitNoteData): PdfSection[] {
  const sections: PdfSection[] = [];

  sections.push({
    type: 'keyValue',
    pairs: [
      { label: 'Visit Date', value: safeFormatDate(data.visitDate) },
      { label: 'Visit Type', value: data.visitType },
      ...(data.chiefComplaint ? [{ label: 'Chief Complaint', value: data.chiefComplaint }] : []),
    ],
  });

  if (data.vitalSigns && data.vitalSigns.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Vital Signs' });
    sections.push({ type: 'keyValue', pairs: data.vitalSigns });
  }

  if (data.allergies && data.allergies.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Allergies' });
    sections.push({
      type: 'paragraph',
      text: data.allergies.join(', '),
      highlight: 'warning',
    });
  }

  if (data.subjective) {
    sections.push({ type: 'heading', level: 2, text: 'Subjective' });
    sections.push({ type: 'paragraph', text: data.subjective });
  }

  if (data.objective) {
    sections.push({ type: 'heading', level: 2, text: 'Objective' });
    sections.push({ type: 'paragraph', text: data.objective });
  }

  if (data.assessment) {
    sections.push({ type: 'heading', level: 2, text: 'Assessment' });
    sections.push({ type: 'paragraph', text: data.assessment });
  }

  if (data.plan) {
    sections.push({ type: 'heading', level: 2, text: 'Plan' });
    sections.push({ type: 'paragraph', text: data.plan });
  }

  if (data.diagnoses && data.diagnoses.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Diagnoses' });
    sections.push({
      type: 'table',
      headers: ['Code', 'Description'],
      rows: data.diagnoses.map((d) => [d.code, d.description]),
    });
  }

  if (data.cptCodes && data.cptCodes.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Procedure Codes' });
    sections.push({
      type: 'table',
      headers: ['CPT Code', 'Description'],
      rows: data.cptCodes.map((c) => [c.code, c.description]),
    });
  }

  if (data.medications && data.medications.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Current Medications' });
    sections.push({ type: 'list', items: data.medications });
  }

  if (data.complianceScore !== undefined) {
    const highlight = data.complianceScore >= 80 ? 'success' : data.complianceScore >= 60 ? 'warning' : 'critical';
    sections.push({ type: 'divider' });
    sections.push({
      type: 'paragraph',
      text: `Documentation Compliance Score: ${data.complianceScore}%`,
      highlight,
    });
  }

  if (data.addendums && data.addendums.length > 0) {
    sections.push({ type: 'divider' });
    sections.push({ type: 'heading', level: 2, text: 'Addendums' });
    data.addendums.forEach((a) => {
      sections.push({ type: 'heading', level: 3, text: `${a.author} - ${safeFormatDate(a.date)}` });
      sections.push({ type: 'paragraph', text: a.text });
    });
  }

  sections.push({
    type: 'signature',
    signerName: data.providerName,
    signerTitle: data.providerCredentials,
    signedAt: data.signedAt,
  });

  return sections;
}
