import type { PdfSection } from '../types';

export interface MarketingFeaturesData {
  generatedAt?: string;
}

export function buildMarketingFeaturesSections(_data: MarketingFeaturesData): PdfSection[] {
  const sections: PdfSection[] = [];

  sections.push({ type: 'heading', level: 1, text: 'CareMetric AI — Feature Descriptions for Marketing' });
  sections.push({
    type: 'paragraph',
    text: 'Audience-targeted feature descriptions, benefit statements, and competitive differentiators. Use these as copy foundations for website pages, sales decks, and campaign materials.',
  });
  sections.push({ type: 'divider' });

  // SECTION: For Providers
  sections.push({ type: 'heading', level: 2, text: 'For Providers — Work Smarter, Document Less' });
  sections.push({
    type: 'paragraph',
    text: 'CareMetric AI gives providers a clinical command center that thinks ahead. AI automation handles the repetitive work so you can focus entirely on the patient in front of you.',
  });

  sections.push({ type: 'heading', level: 3, text: 'Ambient AI Scribe' });
  sections.push({
    type: 'paragraph',
    text: 'Our ambient AI listens to your patient conversation and writes the clinical note — automatically. No dictation, no clicking, no post-visit keyboard work.',
  });
  sections.push({
    type: 'list',
    items: [
      'Supports all note types: SOAP, DAP, H&P, psychiatric, and specialty-specific templates.',
      'Works during telehealth video visits with no additional setup.',
      'Audio is never stored — only the transcription text is retained.',
      'Practices report saving 90+ minutes of documentation time daily.',
    ],
  });

  sections.push({ type: 'heading', level: 3, text: 'AI-Powered Diagnosis & Coding' });
  sections.push({
    type: 'paragraph',
    text: 'Real-time ICD-10 and CPT code suggestions drawn directly from note content. Catch missed HCC risk codes, surface preventive care gaps, and maximize compliant reimbursement automatically.',
  });
  sections.push({
    type: 'list',
    items: [
      'Automatic E&M level calculation from MDM elements.',
      'Pre-submission claim scrubbing with NCCI edits and LCD/NCD compliance.',
      'HCC risk code identification from notes — average $80-120 additional revenue per visit.',
      'Drug interaction alerts and allergy conflict warnings at prescribe time.',
    ],
  });

  sections.push({ type: 'heading', level: 3, text: 'Intelligent Dashboard' });
  sections.push({
    type: 'paragraph',
    text: 'Every morning, your dashboard shows exactly what needs your attention — overdue screenings, unsigned notes, medication refill requests, and care gaps. No hunting. No missing critical items.',
  });

  sections.push({ type: 'heading', level: 3, text: 'Prescription Management' });
  sections.push({
    type: 'paragraph',
    text: 'Manage prescriptions for any US pharmacy directly from the chart. Integrated PDMP and formulary checking keep your patients safe and your prescribing compliant.',
  });
  sections.push({ type: 'divider' });

  // SECTION: For Practice Administrators
  sections.push({ type: 'heading', level: 2, text: 'For Practice Administrators — Run a Tighter Practice' });
  sections.push({
    type: 'paragraph',
    text: 'CareMetric AI gives practice administrators real-time visibility into clinical operations, staff performance, and revenue cycle health — all from a single dashboard.',
  });

  sections.push({ type: 'heading', level: 3, text: 'Smart Scheduling & Calendar Management' });
  sections.push({
    type: 'paragraph',
    text: 'A fully integrated scheduling system with online self-booking, automated reminders, waitlist management, and AI-powered slot optimization to keep your calendar full and your no-show rate low.',
  });
  sections.push({
    type: 'list',
    items: [
      'Patients book their own appointments 24/7 via the patient portal.',
      'Automated SMS and email reminders reduce no-shows by up to 35%.',
      'Waitlist auto-match fills cancelled slots without staff intervention.',
      'Multi-provider, multi-location calendar in one unified view.',
    ],
  });

  sections.push({ type: 'heading', level: 3, text: 'Staff Management & Roles' });
  sections.push({
    type: 'paragraph',
    text: 'Granular role-based access control ensures every team member sees exactly what they need — and nothing they should not. Add, deactivate, and reassign staff in under 60 seconds.',
  });

  sections.push({ type: 'heading', level: 3, text: 'Compliance & Quality Monitoring' });
  sections.push({
    type: 'paragraph',
    text: 'Automated HIPAA audit logs, documentation compliance thresholds, and quality measure dashboards — so you are always ready for an audit.',
  });
  sections.push({
    type: 'list',
    items: [
      'All user actions are logged with timestamps and IP addresses.',
      'Two-factor authentication enforcement by role.',
      'MIPS/MACRA quality measure tracking.',
      'Configurable documentation quality thresholds per provider.',
    ],
  });

  sections.push({ type: 'heading', level: 3, text: 'Revenue Cycle Oversight' });
  sections.push({
    type: 'paragraph',
    text: 'Real-time revenue cycle dashboards surface denial rates, collection rates, days in A/R, and payer performance at a glance. Identify revenue leakage before it becomes a problem.',
  });
  sections.push({ type: 'divider' });

  // SECTION: For Billers
  sections.push({ type: 'heading', level: 2, text: 'For Billing Teams — Stop Chasing Claims' });
  sections.push({
    type: 'paragraph',
    text: 'CareMetric AI\'s revenue cycle module automates the entire billing workflow — from charge capture through collections — so billers spend time on exceptions, not routine processing.',
  });

  sections.push({ type: 'heading', level: 3, text: 'AI Claim Scrubbing & Auto-Submission' });
  sections.push({
    type: 'paragraph',
    text: 'Every claim is automatically scrubbed against NCCI edits, LCD/NCD coverage policies, and payer-specific rules before transmission. First-pass acceptance rates average 94%+ for CareMetric AI practices.',
  });
  sections.push({
    type: 'list',
    items: [
      'Pre-submission NCCI edit validation prevents bundling errors.',
      'LCD/NCD compliance checking for all procedures.',
      'Payer-specific rules engine with 500+ rules across major payers.',
      'Batch submission with scheduling — run overnight for zero downtime.',
    ],
  });

  sections.push({ type: 'heading', level: 3, text: 'AI-Powered Denial Management' });
  sections.push({
    type: 'paragraph',
    text: 'When denials happen, AI drafts your appeal letter. Denial analytics identify systemic patterns so you fix root causes, not just individual claims.',
  });
  sections.push({
    type: 'list',
    items: [
      'Automatic denial reason code categorization.',
      'AI-generated appeal letter drafts customized per payer.',
      'Denial trend analytics by payer, provider, and code.',
      'Practices report 30-40% reduction in claim rework.',
    ],
  });

  sections.push({ type: 'heading', level: 3, text: 'ERA Auto-Posting' });
  sections.push({
    type: 'paragraph',
    text: 'Electronic remittance advice (835 files) from ClaimMD are automatically matched and posted. Payments apply to the correct claims without manual intervention.',
  });

  sections.push({ type: 'heading', level: 3, text: 'Patient Collections & Payment Plans' });
  sections.push({
    type: 'paragraph',
    text: 'Patients pay online through the portal, and balances automatically reconcile in the billing module. Offer payment plans for larger balances to increase collection rates.',
  });
  sections.push({ type: 'divider' });

  // SECTION: For Patients
  sections.push({ type: 'heading', level: 2, text: 'For Patients — A Better Healthcare Experience' });
  sections.push({
    type: 'paragraph',
    text: 'CareMetric AI\'s patient-facing tools give patients genuine digital access to their health — on their schedule, on their device, in plain language they can understand.',
  });

  sections.push({ type: 'heading', level: 3, text: 'Patient Portal' });
  sections.push({
    type: 'paragraph',
    text: 'A full-featured, HIPAA-compliant patient portal accessible from any device. No app download required.',
  });
  sections.push({
    type: 'list',
    items: [
      'View lab results with AI-generated plain-language explanations.',
      'Request appointments and manage bookings online.',
      'Secure direct messaging with the care team.',
      'Pay bills and view statements online.',
      'Complete intake forms before arriving — no paper at the front desk.',
      'Family proxy access for caregivers managing dependents.',
    ],
  });

  sections.push({ type: 'heading', level: 3, text: 'Telehealth' });
  sections.push({
    type: 'paragraph',
    text: 'Browser-based HD video visits with zero app downloads. Works on any smartphone, tablet, or computer. Patients click a link and they are in the waiting room — that is it.',
  });

  sections.push({ type: 'heading', level: 3, text: 'After Visit Summaries' });
  sections.push({
    type: 'paragraph',
    text: 'After every visit, patients receive an AI-generated plain-language summary of what was discussed, their care plan, and next steps. No more "I forgot what the doctor said."',
  });
  sections.push({ type: 'divider' });

  // Competitive Differentiators
  sections.push({ type: 'heading', level: 2, text: 'Competitive Differentiators' });
  sections.push({
    type: 'table',
    headers: ['Feature', 'CareMetric AI', 'Typical EHR'],
    rows: [
      ['Ambient AI Scribe', 'Built-in, no add-on cost', 'Separate $400+/mo add-on or not available'],
      ['AI Coding & MDM', 'Real-time, auto-from-note', 'Manual coding or basic rule sets'],
      ['Claim Scrubbing', 'AI-powered, 500+ rules', 'Basic NCCI edits only'],
      ['Telehealth', 'Native, no third-party', 'Requires separate platform'],
      ['Patient Portal', 'Full-featured, no extra cost', 'Limited or add-on cost'],
      ['Setup Time', 'Practice running in 30 min', 'Weeks to months of implementation'],
      ['Pricing Model', 'Per-provider, transparent', 'Per-provider + hidden fees'],
      ['Support', 'Email + in-app AI chat', 'Phone queue + paid support tiers'],
    ],
  });
  sections.push({ type: 'divider' });

  // Headlines & Taglines
  sections.push({ type: 'heading', level: 2, text: 'Approved Headlines & Taglines' });
  sections.push({ type: 'heading', level: 3, text: 'Primary Brand Message' });
  sections.push({
    type: 'paragraph',
    text: '"The AI-powered EMR that actually helps you practice medicine." — CareMetric AI eliminates documentation burden, accelerates revenue, and gives patients a modern digital experience — all in one platform.',
  });

  sections.push({ type: 'heading', level: 3, text: 'Audience-Specific Messages' });
  sections.push({
    type: 'table',
    headers: ['Audience', 'Headline', 'Supporting Copy'],
    rows: [
      ['Providers', 'Document less. Care more.', 'AI writes your notes. You approve them. Spend your day on patients, not paperwork.'],
      ['Administrators', 'Run a tighter practice.', 'Real-time revenue cycle visibility, automated scheduling, and full compliance monitoring.'],
      ['Billers', 'Stop chasing claims.', '94%+ first-pass acceptance rate. AI-drafted appeals. ERA auto-posting. Zero manual matching.'],
      ['Patients', 'Your health, online, always.', 'Book, message, pay, and review results from your phone. No app. No waiting.'],
    ],
  });

  return sections;
}
