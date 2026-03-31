import type { PdfSection } from '../types';
import { TIERS, ADD_ONS, TIER_INCLUDED_ADDONS, ANNUAL_DISCOUNT_PERCENT, TRIAL_DAYS } from '../../pricing';
import type { AddOnKey } from '../../pricing';

export interface SubscriptionFeaturesData {
  showPricing?: boolean;
}

const CORE_FEATURES: { category: string; items: string[] }[] = [
  {
    category: 'Patient Management',
    items: [
      'Patient registration and demographics',
      'Problem list with ICD-10 codes',
      'Medication management and reconciliation',
      'Allergy tracking with severity levels',
      'Vital signs recording and trending',
      'Patient search and autocomplete',
      'Duplicate patient detection',
      'Patient Staging Board',
    ],
  },
  {
    category: 'Clinical Documentation',
    items: [
      'AI-Assisted SOAP Note Generation',
      'Guided, Traditional, and Ambient note modes',
      '100+ clinical templates (all specialties)',
      '500+ Smart Phrases and Snippets',
      'Documentation Quality Scoring',
      'Note co-signing and attestation',
      'MDM complexity scoring',
      'Chart print and PDF export',
    ],
  },
  {
    category: 'Scheduling',
    items: [
      'Multi-provider calendar views',
      'Drag-and-drop appointment management',
      'Provider availability templates',
      'Recurring appointments',
      'Appointment request and approval',
    ],
  },
  {
    category: 'Prescriptions & Medications',
    items: [
      'Medication search and ordering',
      'Pharmacy selection and directory',
      'Drug interaction checking',
      'Allergy cross-reference alerts',
      'Prescription history',
    ],
  },
  {
    category: 'Clinical Modules',
    items: [
      'Lab ordering (500+ tests) and results trending',
      'Immunization tracking and forecasting',
      'CCM billing module (99490/99439)',
      'Prior authorization with AI letters',
      '50+ standardized assessments (PHQ-9, GAD-7, etc.)',
      'SDOH screening and referrals',
      'Preventive health tracking',
      'Disease registry management',
      'Patient education library (300+ materials)',
    ],
  },
  {
    category: 'Security & Compliance',
    items: [
      'HIPAA-compliant infrastructure',
      'Role-based access control (5 roles)',
      'Comprehensive audit logging',
      'Two-factor authentication',
      'Electronic signatures (ESIGN Act)',
      'Multi-tenancy data isolation',
    ],
  },
];

const ADD_ON_DETAILS: { key: AddOnKey; features: string[] }[] = [
  {
    key: 'automated_claims_billing',
    features: [
      'CMS-1500 and X12 837P claims',
      'Batch claim submission',
      'Claim.MD and Office Ally integration',
      'AI Claim Scrubber (NCCI, bundling)',
      'ERA/835 auto-posting',
      'Secondary claims automation',
      'Fee schedule management',
      'Denial management and appeals',
    ],
  },
  {
    key: 'care_management',
    features: [
      'Care plan creation and tracking',
      'Referral management',
      'Care gap identification',
      'Clinical pathways',
      'Patient engagement scoring',
    ],
  },
  {
    key: 'workflow_automation',
    features: [
      'Smart Task Router',
      'Clinical workflow rules engine',
      'Batch operations center',
      'Event-driven automation',
    ],
  },
  {
    key: 'ai_clinical_copilot',
    features: [
      'AI Intelligence sidebar',
      'Ghost Note Engine',
      'Smart Chart Pre-Brief',
      'Differential Diagnosis support',
      'HCC Risk Coding Assistant',
      'Visit Quality Scoring',
      'Second Brain patient memory',
    ],
  },
  {
    key: 'advanced_analytics',
    features: [
      'Executive dashboards with KPIs',
      'Revenue analytics and forecasting',
      'Provider performance metrics',
      'Custom report builder',
    ],
  },
  {
    key: 'interoperability_suite',
    features: [
      'HL7/FHIR R4 API access',
      'CCD/CCDA generation and import',
      'HIE connectivity',
      'ADT notifications',
      'SMART on FHIR app launcher',
    ],
  },
  {
    key: 'population_health_quality',
    features: [
      'Population health dashboards',
      'Risk stratification',
      'MIPS/MACRA and HEDIS reporting',
      'Cohort management',
      'Care gap outreach engine',
    ],
  },
  {
    key: 'credentialing',
    features: [
      'License and certification tracking',
      'Expiration monitoring with alerts',
      'Payer enrollment management',
      'Primary source verification',
      'Multi-state license tracking',
    ],
  },
  {
    key: 'telehealth_hd',
    features: [
      'HD video visits via Twilio',
      'Virtual waiting room with tech check',
      'Group therapy sessions',
      'Async telehealth',
      'Remote Patient Monitoring',
    ],
  },
  {
    key: 'sms_fax_communications',
    features: [
      '2,000 additional SMS credits/month',
      'Two-way SMS messaging',
      'Broadcast and campaign tools',
    ],
  },
  {
    key: 'fax_integration',
    features: [
      'Cloud fax send/receive',
      'AI-powered fax categorization',
      'Auto-match to patient records',
    ],
  },
  {
    key: 'patient_portal',
    features: [
      'Patient self-scheduling',
      'Lab results and visit summaries',
      'Secure messaging',
      'Online bill pay (Stripe)',
      'Digital intake forms',
      'Medication refill requests',
      'Family accounts and caregiver access',
    ],
  },
];

function tierLabel(key: AddOnKey): string {
  if (TIER_INCLUDED_ADDONS.professional.includes(key) && TIER_INCLUDED_ADDONS.enterprise.includes(key)) {
    return 'Included in Professional & Enterprise';
  }
  if (TIER_INCLUDED_ADDONS.enterprise.includes(key)) {
    return 'Included in Enterprise';
  }
  return 'Available as Add-On';
}

export function buildSubscriptionFeaturesSections(data: SubscriptionFeaturesData): PdfSection[] {
  const sections: PdfSection[] = [];
  const showPricing = data.showPricing !== false;

  if (showPricing) {
    sections.push({ type: 'heading', level: 2, text: 'Subscription Tiers' });
    sections.push({
      type: 'table',
      headers: ['', 'Starter', 'Professional', 'Enterprise'],
      rows: [
        ['Monthly Price', `$${TIERS.starter.monthlyPrice}/mo`, `$${TIERS.professional.monthlyPrice}/mo`, `$${TIERS.enterprise.monthlyPrice}/mo`],
        ['Annual Price', `$${TIERS.starter.annualMonthlyPrice}/mo`, `$${TIERS.professional.annualMonthlyPrice}/mo`, `$${TIERS.enterprise.annualMonthlyPrice}/mo`],
        ['Add\'l Provider (Monthly)', `$${TIERS.starter.perProviderMonthly}/mo`, `$${TIERS.professional.perProviderMonthly}/mo`, `$${TIERS.enterprise.perProviderMonthly}/mo`],
        ['Max Providers', `${TIERS.starter.maxProviders}`, `${TIERS.professional.maxProviders}`, 'Unlimited'],
        ['Free Trial', `${TRIAL_DAYS} days`, `${TRIAL_DAYS} days`, `${TRIAL_DAYS} days`],
      ],
    });
    sections.push({ type: 'paragraph', text: `Annual billing saves ${ANNUAL_DISCOUNT_PERCENT}%. All tiers include the first provider.`, highlight: 'success' });
    sections.push({ type: 'spacer' });
  }

  sections.push({ type: 'heading', level: 2, text: 'Core Features (All Tiers)' });
  for (const group of CORE_FEATURES) {
    sections.push({ type: 'heading', level: 3, text: group.category });
    sections.push({ type: 'list', items: group.items });
  }

  sections.push({ type: 'divider' });
  sections.push({ type: 'heading', level: 2, text: 'Professional Tier Inclusions' });
  sections.push({ type: 'paragraph', text: 'The Professional tier includes 3 add-ons at no extra cost:' });

  const proAddons = TIER_INCLUDED_ADDONS.professional;
  for (const key of proAddons) {
    const addon = ADD_ONS[key];
    const detail = ADD_ON_DETAILS.find(d => d.key === key);
    sections.push({ type: 'heading', level: 3, text: `${addon.displayName} (normally $${addon.monthlyPrice}${addon.unit})` });
    if (detail) {
      sections.push({ type: 'list', items: detail.features });
    }
  }

  sections.push({ type: 'divider' });
  sections.push({ type: 'heading', level: 2, text: 'Enterprise Tier Inclusions' });
  sections.push({ type: 'paragraph', text: 'The Enterprise tier includes 8 add-ons at no extra cost (all Professional inclusions plus):' });

  const entOnlyAddons = TIER_INCLUDED_ADDONS.enterprise.filter(k => !proAddons.includes(k));
  for (const key of entOnlyAddons) {
    const addon = ADD_ONS[key];
    const detail = ADD_ON_DETAILS.find(d => d.key === key);
    sections.push({ type: 'heading', level: 3, text: `${addon.displayName} (normally $${addon.monthlyPrice}${addon.unit})` });
    if (detail) {
      sections.push({ type: 'list', items: detail.features });
    }
  }

  sections.push({ type: 'divider' });
  sections.push({ type: 'heading', level: 2, text: 'Available Add-Ons' });

  if (showPricing) {
    const addOnRows: string[][] = [];
    for (const detail of ADD_ON_DETAILS) {
      const addon = ADD_ONS[detail.key];
      addOnRows.push([
        addon.displayName,
        `$${addon.monthlyPrice}${addon.unit}`,
        tierLabel(detail.key),
      ]);
    }
    sections.push({
      type: 'table',
      headers: ['Add-On', 'Price', 'Tier Availability'],
      rows: addOnRows,
    });
  }

  for (const detail of ADD_ON_DETAILS) {
    const addon = ADD_ONS[detail.key];
    const label = tierLabel(detail.key);
    const priceStr = showPricing ? ` - $${addon.monthlyPrice}${addon.unit}` : '';
    sections.push({ type: 'heading', level: 3, text: `${addon.displayName}${priceStr}` });
    sections.push({ type: 'paragraph', text: label, highlight: label.includes('Included') ? 'success' : 'normal' });
    sections.push({ type: 'list', items: detail.features });
  }

  sections.push({ type: 'divider' });
  sections.push({
    type: 'heading', level: 2, text: 'Quick Comparison',
  });
  sections.push({
    type: 'table',
    headers: ['Feature', 'Starter', 'Professional', 'Enterprise'],
    rows: [
      ['Core EMR & Documentation', 'Yes', 'Yes', 'Yes'],
      ['AI SOAP Note Generation', 'Yes', 'Yes', 'Yes'],
      ['Scheduling', 'Yes', 'Yes', 'Yes'],
      ['Prescriptions (Basic)', 'Yes', 'Yes', 'Yes'],
      ['100+ Clinical Templates', 'Yes', 'Yes', 'Yes'],
      ['50+ Assessments', 'Yes', 'Yes', 'Yes'],
      ['CCM Module', 'Yes', 'Yes', 'Yes'],
      ['Prior Auth Module', 'Yes', 'Yes', 'Yes'],
      ['Automated Claims Billing', 'Add-On', 'Included', 'Included'],
      ['Care Management Suite', 'Add-On', 'Included', 'Included'],
      ['Workflow Automation', 'Add-On', 'Included', 'Included'],
      ['AI Clinical Copilot', 'Add-On', 'Add-On', 'Included'],
      ['Advanced Analytics', 'Add-On', 'Add-On', 'Included'],
      ['Interoperability (HL7/FHIR)', 'Add-On', 'Add-On', 'Included'],
      ['Population Health & Quality', 'Add-On', 'Add-On', 'Included'],
      ['Provider Credentialing', 'Add-On', 'Add-On', 'Included'],
    ],
  });

  sections.push({ type: 'spacer' });
  sections.push({
    type: 'paragraph',
    text: 'All prices are in USD. Annual billing provides 15% savings. 30-day free trial includes all features. Contact sales@caremetric.ai for custom enterprise pricing.',
  });

  return sections;
}
