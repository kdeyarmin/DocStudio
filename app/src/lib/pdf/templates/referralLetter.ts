import type { PdfSection } from '../types';

export interface ReferralLetterData {
  referringProvider: {
    name: string;
    credentials?: string;
    specialty?: string;
    phone?: string;
    fax?: string;
  };
  recipientProvider?: {
    name: string;
    specialty?: string;
    organization?: string;
    address?: string;
    fax?: string;
  };
  patient: {
    name: string;
    dateOfBirth: string;
    gender?: string;
    phone?: string;
    insuranceProvider?: string;
    memberId?: string;
  };
  urgency?: 'routine' | 'urgent' | 'emergent';
  reasonForReferral: string;
  clinicalHistory?: string;
  diagnoses?: { code: string; description: string }[];
  currentMedications?: string[];
  allergies?: string[];
  relevantLabResults?: string;
  authorizationNumber?: string;
  notes?: string;
}

export function buildReferralLetterSections(data: ReferralLetterData): PdfSection[] {
  const sections: PdfSection[] = [];

  sections.push({
    type: 'paragraph',
    text: `Date: ${new Date().toLocaleDateString()}`,
  });

  if (data.recipientProvider) {
    const recipient = [data.recipientProvider.name];
    if (data.recipientProvider.specialty) recipient.push(data.recipientProvider.specialty);
    if (data.recipientProvider.organization) recipient.push(data.recipientProvider.organization);
    if (data.recipientProvider.address) recipient.push(data.recipientProvider.address);
    sections.push({ type: 'paragraph', text: recipient.join('\n') });
  }

  sections.push({ type: 'spacer' });
  sections.push({
    type: 'paragraph',
    text: `Dear ${data.recipientProvider?.name || 'Colleague'},`,
  });

  sections.push({
    type: 'paragraph',
    text: `I am writing to refer ${data.patient.name} (DOB: ${data.patient.dateOfBirth}${data.patient.gender ? `, ${data.patient.gender}` : ''}) to your care for evaluation and management.`,
  });

  if (data.urgency && data.urgency !== 'routine') {
    const highlight = data.urgency === 'emergent' ? 'critical' : 'warning';
    sections.push({
      type: 'paragraph',
      text: `Priority: ${data.urgency.toUpperCase()}`,
      highlight,
    });
  }

  sections.push({ type: 'heading', level: 2, text: 'Reason for Referral' });
  sections.push({ type: 'paragraph', text: data.reasonForReferral });

  if (data.clinicalHistory) {
    sections.push({ type: 'heading', level: 2, text: 'Clinical History' });
    sections.push({ type: 'paragraph', text: data.clinicalHistory });
  }

  if (data.diagnoses && data.diagnoses.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Current Diagnoses' });
    sections.push({
      type: 'table',
      headers: ['ICD-10', 'Description'],
      rows: data.diagnoses.map(d => [d.code, d.description]),
    });
  }

  if (data.currentMedications && data.currentMedications.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Current Medications' });
    sections.push({ type: 'list', items: data.currentMedications });
  }

  if (data.allergies && data.allergies.length > 0) {
    sections.push({ type: 'heading', level: 2, text: 'Allergies' });
    sections.push({ type: 'paragraph', text: data.allergies.join(', '), highlight: 'warning' });
  }

  if (data.relevantLabResults) {
    sections.push({ type: 'heading', level: 2, text: 'Relevant Lab Results' });
    sections.push({ type: 'paragraph', text: data.relevantLabResults });
  }

  if (data.patient.insuranceProvider) {
    sections.push({ type: 'heading', level: 2, text: 'Insurance Information' });
    sections.push({
      type: 'keyValue',
      pairs: [
        { label: 'Insurance', value: data.patient.insuranceProvider },
        ...(data.patient.memberId ? [{ label: 'Member ID', value: data.patient.memberId }] : []),
        ...(data.authorizationNumber ? [{ label: 'Authorization #', value: data.authorizationNumber }] : []),
      ],
    });
  }

  if (data.notes) {
    sections.push({ type: 'heading', level: 2, text: 'Additional Notes' });
    sections.push({ type: 'paragraph', text: data.notes });
  }

  sections.push({ type: 'spacer' });
  sections.push({
    type: 'paragraph',
    text: 'Thank you for seeing this patient. Please do not hesitate to contact our office if you need any additional information.',
  });

  sections.push({
    type: 'signature',
    signerName: data.referringProvider.name,
    signerTitle: [data.referringProvider.credentials, data.referringProvider.specialty].filter(Boolean).join(', '),
  });

  if (data.referringProvider.phone || data.referringProvider.fax) {
    const contactPairs: { label: string; value: string }[] = [];
    if (data.referringProvider.phone) contactPairs.push({ label: 'Phone', value: data.referringProvider.phone });
    if (data.referringProvider.fax) contactPairs.push({ label: 'Fax', value: data.referringProvider.fax });
    sections.push({ type: 'keyValue', pairs: contactPairs });
  }

  return sections;
}
