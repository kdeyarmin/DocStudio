/**
 * Pricing constants extracted from the main application.
 * Kept as a lightweight stub for PDF template compatibility.
 */

export const TIERS = {
  starter: {
    name: 'starter',
    displayName: 'Starter',
    description: 'Everything a startup or solo provider needs to run their practice',
    monthlyPrice: 149,
    annualMonthlyPrice: 127,
    annualPrice: 1524,
    perProviderMonthly: 74.50,
    perProviderAnnualMonthly: 63.50,
    maxProviders: 10,
    sortOrder: 1,
  },
  professional: {
    name: 'professional',
    displayName: 'Professional',
    description: 'Full-featured AI platform for growing clinics',
    monthlyPrice: 199,
    annualMonthlyPrice: 169,
    annualPrice: 2028,
    perProviderMonthly: 99.50,
    perProviderAnnualMonthly: 84.50,
    maxProviders: 50,
    sortOrder: 2,
  },
  enterprise: {
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'For agencies & multi-location organizations',
    monthlyPrice: 249,
    annualMonthlyPrice: 212,
    annualPrice: 2544,
    perProviderMonthly: 124.50,
    perProviderAnnualMonthly: 106,
    maxProviders: 999999,
    sortOrder: 3,
  },
} as const;

export type TierKey = keyof typeof TIERS;

export const ADD_ONS = {
  ai_clinical_copilot: { displayName: 'AI Clinical Copilot', monthlyPrice: 49, annualPrice: 500, unit: '/provider/mo', billingModel: 'per_provider' as const, description: 'Full AI intelligence suite' },
  epcs_certification: { displayName: 'Controlled Substance Prescribing', monthlyPrice: 29, annualPrice: 250, unit: '/provider/mo', billingModel: 'per_provider' as const, description: 'Controlled substance prescribing' },
  telehealth_hd: { displayName: 'Advanced Telehealth Suite', monthlyPrice: 29, annualPrice: 300, unit: '/provider/mo', billingModel: 'per_provider' as const, description: 'HD video, screen sharing, virtual waiting room' },
  care_management: { displayName: 'Care Management Suite', monthlyPrice: 29, annualPrice: 300, unit: '/provider/mo', billingModel: 'per_provider' as const, description: 'Advanced care plans, referral tracking' },
  sms_fax_communications: { displayName: 'SMS & Communications Plus', monthlyPrice: 29, annualPrice: 300, unit: '/mo', billingModel: 'flat' as const, description: 'Additional SMS credits and messaging' },
  fax_integration: { displayName: 'Fax Integration', monthlyPrice: 39, annualPrice: 400, unit: '/mo', billingModel: 'flat' as const, description: 'Cloud fax with AI-powered document analysis' },
  patient_portal: { displayName: 'Patient Portal', monthlyPrice: 49, annualPrice: 500, unit: '/mo', billingModel: 'flat' as const, description: 'Branded patient portal with online payments' },
  advanced_analytics: { displayName: 'Advanced Analytics', monthlyPrice: 49, annualPrice: 500, unit: '/mo', billingModel: 'flat' as const, description: 'Executive dashboards and custom reports' },
  workflow_automation: { displayName: 'Workflow Automation', monthlyPrice: 49, annualPrice: 500, unit: '/mo', billingModel: 'flat' as const, description: 'Smart task routing and automated reminders' },
  interoperability_suite: { displayName: 'Interoperability Suite', monthlyPrice: 59, annualPrice: 599, unit: '/mo', billingModel: 'flat' as const, description: 'HL7/FHIR API access and data exchange' },
  population_health_quality: { displayName: 'Population Health & Quality', monthlyPrice: 79, annualPrice: 800, unit: '/mo', billingModel: 'flat' as const, description: 'Care gaps tracking and quality measures' },
  automated_claims_billing: { displayName: 'Automated Claims Billing', monthlyPrice: 99, annualPrice: 1000, unit: '/mo', billingModel: 'flat' as const, description: 'Batch claim submission and ERA processing' },
  credentialing: { displayName: 'Provider Credentialing', monthlyPrice: 99, annualPrice: 1000, unit: '/mo', billingModel: 'flat' as const, description: 'Automated credentialing workflows' },
} as const;

export type AddOnKey = keyof typeof ADD_ONS;

export const TIER_INCLUDED_ADDONS: Record<TierKey, AddOnKey[]> = {
  starter: [],
  professional: [
    'automated_claims_billing',
    'care_management',
    'workflow_automation',
  ],
  enterprise: [
    'ai_clinical_copilot',
    'automated_claims_billing',
    'advanced_analytics',
    'interoperability_suite',
    'care_management',
    'population_health_quality',
    'credentialing',
    'workflow_automation',
  ],
};

export const TRIAL_DAYS = 30;
export const ANNUAL_DISCOUNT_PERCENT = 15;
