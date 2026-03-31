import type { PdfSection } from '../types';

export interface QuickStartGuideData {
  generatedAt?: string;
}

export function buildQuickStartGuideSections(_data: QuickStartGuideData): PdfSection[] {
  const sections: PdfSection[] = [];

  sections.push({ type: 'heading', level: 1, text: 'CareMetric AI — Quick Start Guide' });
  sections.push({ type: 'paragraph', text: 'Get your practice up and running in 30 minutes. Follow the steps for your role below.' });
  sections.push({ type: 'divider' });

  // Admin Setup
  sections.push({ type: 'heading', level: 2, text: 'Step 1: Practice Admin Setup (15 min)' });
  sections.push({ type: 'paragraph', text: 'Complete these steps once before anyone else logs in.' });
  sections.push({
    type: 'list', ordered: true,
    items: [
      'Log in at your practice URL — you were granted the Admin role.',
      'Go to Practice Admin → Organization Setup → fill in practice name, address, NPI, and tax ID.',
      'Add providers: Practice Admin → Staff → Invite Team Member → select role "Provider".',
      'Add support staff (nurses, billers, front desk) the same way with appropriate roles.',
      'Configure Scheduling: Practice Admin → Scheduling → set provider availability and visit types.',
      'Set up insurance payers: Practice Admin → Payers → search and add each payer you bill.',
      'Enable features: Practice Admin → Features → toggle on Telehealth, Patient Portal, Prescriptions as needed.',
      'Optionally upload your logo and customize the portal branding.',
    ],
  });

  sections.push({ type: 'heading', level: 2, text: 'Step 2: Add Your First Patient (5 min)' });
  sections.push({
    type: 'list', ordered: true,
    items: [
      'Go to Patients → Add Patient.',
      'Enter name, date of birth, sex, and contact information.',
      'Add insurance: Insurance tab → Add Insurance → search for payer → enter member ID.',
      'Save the patient record.',
      'Optional: Click Invite to Portal to send a portal activation email.',
    ],
  });

  sections.push({ type: 'heading', level: 2, text: 'Step 3: Schedule the First Appointment (3 min)' });
  sections.push({
    type: 'list', ordered: true,
    items: [
      'Go to Schedule in the left sidebar.',
      'Click an open time slot on the provider calendar.',
      'Search for and select the patient.',
      'Choose a visit type and duration.',
      'Toggle "Send Reminder" for automatic SMS/email confirmation.',
      'Click Save.',
    ],
  });

  sections.push({ type: 'heading', level: 2, text: 'Step 4: Run Your First Visit (5 min)' });
  sections.push({
    type: 'list', ordered: true,
    items: [
      'From the Schedule, click the appointment → Start Visit.',
      'Select a note template (e.g., Office Visit SOAP).',
      'Enter the Chief Complaint.',
      'Review AI-suggested diagnoses and codes.',
      'Complete the note sections, check the MDM Widget for E&M level.',
      'Run Documentation Quality Check (top right of note editor).',
      'Click Close & Sign to finalize the note.',
    ],
  });

  sections.push({ type: 'heading', level: 2, text: 'Step 5: Submit Your First Claim (2 min)' });
  sections.push({
    type: 'list', ordered: true,
    items: [
      'Go to Billing → Billing Pipeline.',
      'The signed visit auto-populates as a pending claim.',
      'Click the claim → review CPT codes → click Scrub Claim.',
      'Resolve any alerts → click Submit Claim.',
      'Monitor status in the ERA Queue.',
    ],
  });

  sections.push({ type: 'divider' });
  sections.push({ type: 'heading', level: 2, text: 'Role Quick Reference' });

  sections.push({
    type: 'table',
    headers: ['Role', 'First Action', 'Daily Routine', 'Key Shortcut'],
    rows: [
      ['Provider', 'Complete profile + set availability', 'Dashboard → Notes → Sign', 'N = New Visit'],
      ['Front Desk', 'Learn Schedule view', 'Check-in patients, manage appointments', 'Ctrl+K = Command Palette'],
      ['Nurse / MA', 'Learn Patient Chart tabs', 'Enter vitals, prep notes, process refills', 'Q = Quick View'],
      ['Biller', 'Configure payer list', 'Submit claims, work denial queue', 'B = Billing Pipeline'],
      ['Admin', 'Complete org setup', 'Monitor dashboard metrics', 'S = Schedule'],
    ],
  });

  sections.push({ type: 'divider' });
  sections.push({ type: 'heading', level: 2, text: 'Top 10 Features to Learn First' });
  sections.push({
    type: 'list', ordered: true,
    items: [
      'Dashboard — your command center; check this first every morning.',
      'Patient Chart — all clinical data in one longitudinal record.',
      'AI Note Generation — SOAP notes from templates or ambient listening.',
      'Scheduling Calendar — drag-and-drop appointment management.',
      'Billing Pipeline — end-to-end claim submission in 3 clicks.',
      'Prescriptions — send to any pharmacy with interaction checking.',
      'Patient Portal — lab results, messaging, and online payments for patients.',
      'Smart Inbox — triage messages, labs, and tasks by priority.',
      'Telehealth — HD video visits embedded inside the EMR.',
      'Documentation Quality Check — catch coding errors before submission.',
    ],
  });

  sections.push({ type: 'divider' });
  sections.push({ type: 'heading', level: 2, text: 'Keyboard Shortcuts' });
  sections.push({
    type: 'table',
    headers: ['Shortcut', 'Action'],
    rows: [
      ['N', 'New Visit'],
      ['Q', 'Quick View (patient selected)'],
      ['Ctrl+K / Cmd+K', 'Command Palette — search anything'],
      ['S', 'Jump to Schedule'],
      ['B', 'Jump to Billing Pipeline'],
      ['.', 'Insert Smart Phrase (inside note editor)'],
      ['Ctrl+S / Cmd+S', 'Save current form'],
      ['Esc', 'Close modal or panel'],
    ],
  });

  sections.push({ type: 'divider' });
  sections.push({ type: 'heading', level: 2, text: 'Need Help?' });
  sections.push({
    type: 'list',
    items: [
      'In-app AI Chatbot: Click the chat bubble in the bottom right corner.',
      'Knowledge Base: Settings → Support → Documentation Library.',
      'Email: support@caremetric.ai',
      'Full User Manual: Settings → Support → EMR User Manual.',
    ],
  });

  return sections;
}
