import { createClient } from '@supabase/supabase-js';
import { resilientFetch } from './safari-fetch';
import { logger } from './logger';
import type {
  ComplianceSuggestion,
  ScrubberError,
  AdjustmentCode,
  RemarkCode,
  AuditLogValues,
  DrugInteractionWarning,
  AIAnalysis,
  AIValidationNotes,
  TechnicalIssue,
  TransitionMedication,
  PendingTest,
  FollowUpAppointment,
  MedicationDiscrepancy,
  MedicationChange,
} from '../types/clinical';

let _isDemoModeRef: (() => boolean) | null = null;
export function registerIsDemoMode(fn: () => boolean) {
  _isDemoModeRef = fn;
}
function isDemoMode(): boolean {
  return _isDemoModeRef ? _isDemoModeRef() : false;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseConfigMissing = !supabaseUrl || !supabaseAnonKey;

if (supabaseConfigMissing) {
  console.error(
    '[DocStudio] Missing Supabase environment variables. ' +
    'Copy .env.example to .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'docstudio-auth',
  },
  db: {
    schema: 'public',
  },
  global: {
    fetch: resilientFetch,
    headers: {
      'x-client-info': 'docstudio-web',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 5,
    },
  },
});

let _passwordRecoveryDetected = false;
const _recoveryListeners = new Set<() => void>();

try {
  const h = window.location.hash;
  if (h && new URLSearchParams(h.substring(1)).get('type') === 'recovery') {
    _passwordRecoveryDetected = true;
  }
  if (!_passwordRecoveryDetected) {
    const s = window.location.search;
    if (s && new URLSearchParams(s).get('type') === 'recovery') {
      _passwordRecoveryDetected = true;
    }
  }
} catch { /* URL parsing for recovery detection is best-effort */ }

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY' && !_passwordRecoveryDetected) {
    _passwordRecoveryDetected = true;
    _recoveryListeners.forEach(fn => fn());
  }
});

export function isPasswordRecoveryDetected(): boolean {
  return _passwordRecoveryDetected;
}

export function clearPasswordRecoveryDetected(): void {
  _passwordRecoveryDetected = false;
}

export function onPasswordRecoveryDetected(fn: () => void): () => void {
  _recoveryListeners.add(fn);
  return () => { _recoveryListeners.delete(fn); };
}

export type Permissions = {
  view_patients: boolean;
  edit_patients: boolean;
  view_clinical: boolean;
  edit_clinical: boolean;
  view_billing: boolean;
  edit_billing: boolean;
  schedule_appointments: boolean;
  prescribe_medications: boolean;
  order_labs: boolean;
  view_reports: boolean;
  manage_staff: boolean;
  view_documents: boolean;
  edit_documents: boolean;
};

export type Profile = {
  id: string;
  role: 'provider' | 'patient' | 'admin' | 'super_admin' | 'org_admin' | 'staff' | 'billing';
  first_name: string;
  last_name: string;
  full_name?: string;
  email: string;
  phone?: string;
  npi_number?: string;
  specialty?: string;
  license_number?: string;
  signature_data?: string;
  is_super_admin?: boolean;
  organization_id?: string;
  staff_role?: string;
  provider_type?: string;
  permissions?: Permissions;
  password_change_required?: boolean;
  is_demo_account?: boolean;
  two_factor_phone?: string | null;
  two_factor_verified?: boolean;
  two_factor_exempt?: boolean;
  last_login_at?: string | null;
  is_also_provider?: boolean;
  state_licenses?: Array<{ state: string; license_number: string; expiration_date?: string }>;
  created_at: string;
  updated_at: string;
};

export type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
  alternate_phone?: string;
};

export type FamilyHistoryItem = {
  condition: string;
  relationship: string;
  age_of_onset?: string;
  notes?: string;
};

export type SurgicalHistoryItem = {
  procedure: string;
  date: string;
  surgeon?: string;
  hospital?: string;
  notes?: string;
};

export type SocialHistory = {
  smoking_status?: 'never' | 'former' | 'current' | 'unknown';
  smoking_packs_per_day?: number;
  smoking_years?: number;
  smoking_quit_date?: string;
  alcohol_use?: 'none' | 'occasional' | 'moderate' | 'heavy';
  alcohol_drinks_per_week?: number;
  drug_use?: string;
  exercise_frequency?: string;
  diet?: string;
  occupation_hazards?: string;
  sexual_activity?: 'active' | 'inactive' | 'declined';
  living_situation?: string;
};

export type CareTeamMember = {
  name: string;
  role: string;
  phone?: string;
  npi?: string;
  specialty?: string;
};

export type Patient = {
  id: string;
  organization_id?: string;
  mrn?: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  preferred_name?: string;
  suffix?: string;
  date_of_birth: string;
  gender?: string;
  sex?: string;
  sex_at_birth?: 'male' | 'female' | 'intersex' | 'unknown';
  pronouns?: 'he_him' | 'she_her' | 'they_them' | 'ze_zir' | 'other' | 'prefer_not_to_say';
  sexual_orientation?: 'heterosexual' | 'homosexual' | 'bisexual' | 'other' | 'prefer_not_to_say';
  race?: string;
  ethnicity?: string;
  preferred_language?: string;
  marital_status?: string;
  religion?: string;
  ssn?: string;
  email?: string;
  phone?: string;
  home_phone?: string;
  work_phone?: string;
  cell_phone?: string;
  preferred_contact_method?: string;
  emergency_contact?: string;
  emergency_contacts?: EmergencyContact[];
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  mailing_address?: string;
  mailing_city?: string;
  mailing_state?: string;
  mailing_zip?: string;
  employment_status?: string;
  occupation?: string;
  employer_name?: string;
  employer_phone?: string;
  insurance_provider?: string;
  insurance_id?: string;
  insurance_group?: string;
  insurance_subscriber_name?: string;
  insurance_subscriber_dob?: string;
  insurance_subscriber_relationship?: string;
  insurance_plan_type?: string;
  insurance_copay?: number;
  insurance_authorization_required?: boolean;
  insurance_phone?: string;
  primary_payer_id?: string;
  primary_subscriber_id?: string;
  primary_subscriber_name?: string;
  primary_subscriber_dob?: string;
  primary_subscriber_relationship?: string;
  secondary_insurance_provider?: string;
  secondary_insurance_id?: string;
  secondary_insurance_group?: string;
  secondary_insurance_phone?: string;
  secondary_payer_id?: string;
  secondary_subscriber_id?: string;
  secondary_subscriber_name?: string;
  secondary_subscriber_dob?: string;
  secondary_subscriber_relationship?: string;
  primary_care_provider_id?: string;
  referring_provider_name?: string;
  referring_provider_npi?: string;
  referral_source?: string;
  care_team?: CareTeamMember[];
  allergies?: string[];
  medical_history?: Record<string, unknown>;
  family_history?: Record<string, FamilyHistoryItem[]>;
  social_history?: SocialHistory;
  surgical_history?: SurgicalHistoryItem[];
  past_medical_history?: string[];
  previous_names?: Array<{ name: string; date_changed?: string }>;
  blood_type?: string;
  organ_donor?: boolean;
  preferred_pharmacy_name?: string;
  preferred_pharmacy_phone?: string;
  preferred_pharmacy_address?: string;
  preferred_pharmacy_fax?: string;
  preferred_pharmacy_ncpdp?: string;
  backup_pharmacy_name?: string;
  backup_pharmacy_phone?: string;
  backup_pharmacy_address?: string;
  backup_pharmacy_ncpdp?: string;
  demographics_verified_at?: string;
  demographics_verified_by?: string;
  portal_access_enabled?: boolean;
  portal_username?: string;
  allow_email_communication?: boolean;
  allow_sms_communication?: boolean;
  allow_phone_communication?: boolean;
  sms_consent?: boolean;
  sms_consent_date?: string;
  email_consent?: boolean;
  email_consent_date?: string;
  appointment_reminder_preference?: string;
  advance_directive_on_file?: boolean;
  advance_directive_type?: string;
  code_status?: 'full_code' | 'dnr' | 'dni' | 'dnr_dni' | 'comfort_care_only' | 'not_specified';
  code_status_verified_date?: string;
  code_status_verified_by?: string;
  power_of_attorney_name?: string;
  power_of_attorney_phone?: string;
  guardian_name?: string;
  guardian_phone?: string;
  hipaa_consent_signed?: string;
  treatment_consent_signed?: string;
  telehealth_consent_signed?: string;
  fall_risk?: boolean;
  pressure_injury_risk?: boolean;
  suicide_risk_level?: 'none' | 'low' | 'moderate' | 'high' | 'imminent';
  abuse_screening_positive?: boolean;
  isolation_precautions?: string;
  special_needs?: string;
  vip_status?: boolean;
  deceased?: boolean;
  deceased_date?: string;
  photo_url?: string;
  notes?: string;
  height?: number;
  weight?: number;
  bmi?: number;
  pregnancy_status?: string;
  estimated_due_date?: string;
  last_menstrual_period?: string;
  height_inches?: number;
  weight_lbs?: number;
  last_pcp_appointment_date?: string;
  last_pcp_name?: string;
  last_pcp_phone?: string;
  telehealth_vitals_heart_rate?: number;
  telehealth_vitals_bp_systolic?: number;
  telehealth_vitals_bp_diastolic?: number;
  telehealth_vitals_recorded_at?: string;
  drug_testing_policy_acknowledged?: boolean;
  drug_testing_policy_acknowledged_at?: string;
  controlled_substance_agreement_signed?: boolean;
  controlled_substance_agreement_signed_at?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Visit = {
  id: string;
  patient_id: string;
  provider_id: string;
  visit_date: string;
  visit_type: 'office' | 'telehealth' | 'hospital' | 'emergency';
  appointment_id?: string;
  chief_complaint?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  med_reconciliation_completed_at?: string;
  med_reconciliation_completed_by?: string;
  created_at: string;
  updated_at: string;
};

export type VisitNote = {
  id: string;
  visit_id: string;
  patient_id?: string;
  provider_id?: string;
  organization_id?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  status?: 'draft' | 'signed' | 'cosigned' | 'voided';
  ai_compliance_score: number;
  ai_compliance_suggestions?: ComplianceSuggestion[];
  ai_analysis?: AIAnalysis;
  compliance_score?: number | null;
  billing_codes?: unknown[];
  signed: boolean;
  signed_at?: string;
  signed_by?: string;
  signature_id?: string;
  pending_cosignature?: boolean;
  cosigned?: boolean;
  cosigned_by?: string;
  cosigned_at?: string;
  cosignature_id?: string;
  voided?: boolean;
  voided_at?: string;
  voided_by?: string;
  void_reason?: string;
  deleted_at?: string;
  deleted_by?: string;
  created_at: string;
  updated_at: string;
};

export type Medication = {
  id: string;
  patient_id: string;
  provider_id: string;
  visit_id?: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  route: string;
  start_date: string;
  end_date?: string;
  refills: number;
  pharmacy?: string;
  pharmacy_ncpdp_id?: string;
  pharmacy_phone?: string;
  notes?: string;
  status: 'active' | 'completed' | 'discontinued';
  drug_class?: string;
  drug_description?: string;
  prescribed_via?: 'manual' | 'refill';
  ai_interaction_warnings?: DrugInteractionWarning[];
  created_at: string;
  updated_at: string;
};

export type BillingCode = {
  id: string;
  code_type: 'ICD10' | 'CPT';
  code: string;
  description: string;
  category?: string;
  common_usage: number;
  ai_keywords?: string[];
  amount?: number;
  created_at?: string;
  units?: number;
};

export type Claim = {
  id: string;
  visit_id: string;
  patient_id: string;
  payer_id?: string;
  organization_payer_id?: string;
  org_secondary_payer_id?: string;
  provider_id?: string;
  organization_id?: string;
  batch_id?: string;
  claim_number?: string;
  total_amount: number;
  paid_amount: number;
  allowed_amount?: number;
  balance_due?: number;
  patient_responsibility?: number;
  adjustment_amount?: number;
  status: 'draft' | 'signed' | 'scrubbing' | 'scrub_failed' | 'ready_to_batch' | 'batched' | 'submitted' | 'pending_remittance' | 'partial_payment' | 'paid' | 'denied' | 'ready_for_secondary' | 'secondary_submitted' | 'closed';
  service_date?: string;
  submission_date?: string;
  payment_date?: string;
  denial_reason?: string;
  diagnosis_codes?: string[];
  place_of_service?: string;
  scrubber_passed?: boolean;
  scrubber_errors?: ScrubberError[];
  is_secondary?: boolean;
  primary_claim_id?: string;
  secondary_payer_id?: string;
  ai_validation_status?: string;
  ai_validation_notes?: AIValidationNotes;
  created_at: string;
  updated_at: string;
};

export type ClaimBatch = {
  id: string;
  organization_id: string;
  batch_number: string;
  claim_count: number;
  total_amount: number;
  clearinghouse: string;
  status: 'draft' | 'generated' | 'downloaded' | 'submitted' | 'acknowledged' | 'rejected' | 'processed';
  file_content_837p?: string;
  submitted_at?: string;
  external_batch_id?: string;
  submission_notes?: string;
  submitted_by?: string;
  created_at: string;
};

export type ClaimServiceLine = {
  id: string;
  claim_id: string;
  line_number: number;
  cpt_code: string;
  cpt_description?: string;
  modifier_1?: string;
  modifier_2?: string;
  modifier_3?: string;
  modifier_4?: string;
  diagnosis_pointers?: string[];
  units: number;
  charge_amount: number;
  allowed_amount?: number;
  paid_amount?: number;
  adjustment_amount?: number;
  patient_responsibility?: number;
  service_date?: string;
  place_of_service?: string;
  adjustment_reason_codes?: AdjustmentCode[];
  remark_codes?: RemarkCode[];
  status: 'pending' | 'paid' | 'denied' | 'adjusted';
  created_at: string;
  updated_at: string;
};

export type OrganizationPayer = {
  id: string;
  organization_id: string;
  payer_name: string;
  payer_id: string;
  transaction_type?: string;
  payer_type?: string;
  national_payer_id?: string;
  abbreviation?: string;
  is_active?: boolean;
  is_hidden?: boolean;
  notes?: string;
  website?: string;
  provider_portal_url?: string;
  timely_filing_days?: number;
  claim_submission_method?: string;
  accepts_electronic_claims?: boolean;
  era_enrollment_status?: string;
  claim_status_inquiry_method?: string;
  in_network?: boolean;
  contract_effective_date?: string;
  contract_termination_date?: string;
  fee_schedule_name?: string;
  claims_phone?: string;
  claims_fax?: string;
  claims_address?: string;
  claims_city?: string;
  claims_state?: string;
  claims_zip?: string;
  prior_auth_phone?: string;
  prior_auth_fax?: string;
  prior_auth_portal_url?: string;
  appeals_phone?: string;
  appeals_fax?: string;
  appeals_address?: string;
  appeals_city?: string;
  appeals_state?: string;
  appeals_zip?: string;
  eligibility_phone?: string;
  provider_enrollment_phone?: string;
  provider_enrollment_email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  contact_person?: string;
  created_at?: string;
  updated_at?: string;
};

export type Payer = OrganizationPayer;

export type DifferentialDiagnosis = {
  id: string;
  visit_id: string;
  diagnosis_code: string;
  diagnosis_name: string;
  probability: number;
  supporting_symptoms?: string[];
  ruled_out: boolean;
  ruled_out_reason?: string;
  ai_generated: boolean;
  created_at: string;
};

export type Appointment = {
  id: string;
  patient_id: string;
  provider_id: string;
  appointment_date: string;
  duration_minutes: number;
  type: 'office' | 'telehealth' | 'procedure' | 'follow_up';
  status: 'scheduled' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  chief_complaint?: string;
  notes?: string;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
};

export type LabOrder = {
  id: string;
  patient_id: string;
  provider_id: string;
  visit_id?: string;
  organization_id?: string;
  order_date: string;
  test_name: string;
  test_code?: string;
  priority: 'routine' | 'urgent' | 'stat' | 'timed';
  timed_specification?: string;
  diagnosis_codes: string[];
  clinical_indication?: string;
  reflex_testing_authorized?: boolean;
  fasting_status?: 'fasting' | 'non_fasting';
  status: 'ordered' | 'collected' | 'processing' | 'completed' | 'cancelled';
  lab_facility?: string;
  notes?: string;
  source_fax_id?: string;
  auto_created?: boolean;
  created_at: string;
  updated_at: string;
};

export type LabResult = {
  id: string;
  lab_order_id: string;
  result_date: string;
  test_name: string;
  value: string;
  unit?: string;
  reference_range?: string;
  abnormal_flag: 'normal' | 'high' | 'low' | 'critical_high' | 'critical_low';
  status: 'preliminary' | 'final' | 'corrected' | 'cancelled';
  notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  source_fax_id?: string;
  created_at: string;
};

export type VitalSign = {
  id: string;
  patient_id: string;
  visit_id?: string;
  recorded_by: string;
  recorded_at: string;
  temperature?: number;
  temperature_unit: 'F' | 'C';
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  weight?: number;
  weight_unit: 'lbs' | 'kg';
  height?: number;
  height_unit: 'in' | 'cm';
  bmi?: number;
  pain_score?: number;
  pain_location?: string;
  notes?: string;
  created_at: string;
};

export type Referral = {
  id: string;
  patient_id: string;
  referring_provider_id: string;
  specialist_provider_id?: string;
  visit_id?: string;
  specialty: string;
  reason: string;
  diagnosis_codes: string[];
  urgency: 'routine' | 'urgent' | 'emergent';
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
  referral_date: string;
  appointment_date?: string;
  notes?: string;
  specialist_notes?: string;
  created_at: string;
  updated_at: string;
};

export type Document = {
  id: string;
  patient_id?: string;
  visit_id?: string;
  uploaded_by: string;
  document_type: 'lab_report' | 'imaging' | 'consent' | 'insurance' | 'referral' | 'correspondence' | 'other';
  title: string;
  description?: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type QualityMeasure = {
  id: string;
  measure_code: string;
  measure_name: string;
  measure_type: 'MIPS' | 'HEDIS' | 'custom';
  description?: string;
  numerator_criteria: Record<string, unknown>;
  denominator_criteria: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Immunization = {
  id: string;
  patient_id: string;
  provider_id: string;
  visit_id?: string;
  vaccine_name: string;
  vaccine_code?: string;
  manufacturer?: string;
  lot_number?: string;
  expiration_date?: string;
  administration_date: string;
  administration_site?: string;
  administration_route?: string;
  dose_amount?: string;
  administered_by?: string;
  notes?: string;
  vis_given: boolean;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  assigned_to: string;
  created_by: string;
  patient_id?: string;
  title: string;
  description?: string;
  task_type: 'follow_up' | 'review_labs' | 'callback' | 'prior_auth' | 'refill' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
};

export type CarePlan = {
  id: string;
  patient_id: string;
  provider_id: string;
  title: string;
  diagnosis_codes: string[];
  goals: Array<{ id: string; description: string; target_date?: string; status: string }>;
  interventions: Array<{ id: string; description: string; frequency?: string }>;
  status: 'active' | 'completed' | 'discontinued';
  start_date: string;
  end_date?: string;
  review_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type PatientEducation = {
  id: string;
  patient_id: string;
  provider_id: string;
  visit_id?: string;
  title: string;
  category: 'disease_info' | 'medication_info' | 'lifestyle' | 'procedure_prep' | 'discharge_instructions';
  content?: string;
  url?: string;
  document_id?: string;
  provided_date: string;
  reviewed_by_patient: boolean;
  created_at: string;
  updated_at: string;
};

export type ProblemListItem = {
  id: string;
  patient_id: string;
  provider_id: string;
  diagnosis_code: string;
  diagnosis_name: string;
  icd10_code?: string;
  problem_name?: string;
  description?: string;
  onset_date?: string;
  status: 'active' | 'resolved' | 'chronic';
  severity?: 'mild' | 'moderate' | 'severe';
  notes?: string;
  resolved_date?: string;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  user_id?: string;
  action: 'create' | 'update' | 'delete' | 'view' | 'login' | 'logout' | 'export';
  entity_type: string;
  entity_id?: string;
  old_values?: AuditLogValues;
  new_values?: AuditLogValues;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
};

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  patient_id?: string;
  subject: string;
  body: string;
  is_read: boolean;
  read_at?: string;
  parent_message_id?: string;
  created_at: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  subdomain?: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  website?: string;
  tax_id?: string;
  npi_number?: string;
  settings?: Record<string, unknown>;
  is_active: boolean;
  owner_id?: string;
  subscription_status: 'pending' | 'trialing' | 'active' | 'cancelled' | 'expired';
  trial_start_date?: string;
  trial_end_date?: string;
  created_at: string;
  updated_at: string;
};

export type TelehealthSession = {
  id: string;
  organization_id?: string;
  appointment_id?: string;
  patient_id: string;
  provider_id: string;
  session_status: 'scheduled' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  room_code: string;
  scheduled_start: string;
  actual_start?: string;
  actual_end?: string;
  patient_joined_at?: string;
  provider_joined_at?: string;
  duration_minutes?: number;
  visit_notes?: string;
  technical_issues?: TechnicalIssue[];
  recording_consent: boolean;
  recording_url?: string;
  twilio_room_id?: string;
  twilio_room_name?: string;
  platform?: 'twilio' | 'webrtc' | 'other';
  created_at: string;
  updated_at: string;
};

export type TelehealthWaitingRoom = {
  id: string;
  session_id: string;
  patient_id: string;
  check_in_time: string;
  status: 'waiting' | 'called' | 'in_session' | 'left';
  estimated_wait_minutes: number;
  queue_position: number;
  created_at: string;
};

export type PaymentPlan = {
  id: string;
  organization_id?: string;
  patient_id: string;
  total_amount: number;
  remaining_balance: number;
  monthly_payment: number;
  number_of_payments: number;
  start_date: string;
  next_payment_date?: string;
  amount_paid: number;
  end_date: string;
  status: 'active' | 'completed' | 'defaulted' | 'cancelled';
  auto_pay_enabled: boolean;
  payment_method_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
};

export type PaymentTransaction = {
  id: string;
  organization_id?: string;
  patient_id: string;
  claim_id?: string;
  payment_plan_id?: string;
  amount: number;
  payment_type: 'copay' | 'coinsurance' | 'deductible' | 'payment_plan' | 'self_pay' | 'refund';
  payment_method: 'credit_card' | 'debit_card' | 'ach' | 'cash' | 'check' | 'other';
  transaction_id?: string;
  card_last_four?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  processed_at?: string;
  processed_by?: string;
  payment_date: string;
  notes?: string;
  created_at: string;
};

export type EligibilityCheck = {
  id: string;
  organization_id?: string;
  patient_id: string;
  payer_id?: string;
  check_date: string;
  status: 'active' | 'inactive' | 'unknown' | 'error';
  coverage_type?: string;
  plan_name?: string;
  member_id?: string;
  group_number?: string;
  effective_date?: string;
  termination_date?: string;
  copay_amount?: number;
  deductible_amount?: number;
  deductible_met?: number;
  out_of_pocket_max?: number;
  out_of_pocket_met?: number;
  coinsurance_percent?: number;
  prior_auth_required: boolean;
  network_status?: string;
  checked_by?: string;
  response_data?: Record<string, unknown>;
  created_at: string;
};

export type PatientStatement = {
  id: string;
  organization_id?: string;
  patient_id: string;
  statement_number?: string;
  statement_date: string;
  due_date: string;
  total_charges: number;
  total_payments: number;
  total_adjustments: number;
  balance_due: number;
  previous_balance: number;
  period_start: string;
  period_end: string;
  new_charges: number;
  payments: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'collections';
  delivery_method: 'mail' | 'email' | 'portal' | 'none';
  sent_at?: string;
  paid_at?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
};

export type PatientAllergy = {
  id: string;
  patient_id: string;
  organization_id: string;
  allergen_name: string;
  allergen_type: 'drug' | 'food' | 'environmental' | 'biological' | 'other';
  reaction_type?: 'rash' | 'hives' | 'anaphylaxis' | 'gi_distress' | 'respiratory' | 'swelling' | 'other';
  reaction_severity: 'mild' | 'moderate' | 'severe' | 'life_threatening' | 'unknown';
  onset_date?: string;
  verified: boolean;
  verified_by?: string;
  verified_date?: string;
  status: 'active' | 'inactive' | 'resolved' | 'entered_in_error';
  notes?: string;
  source: 'patient_reported' | 'provider_documented' | 'external_record' | 'pharmacy';
  created_at: string;
  updated_at: string;
};

export type CareTransition = {
  id: string;
  patient_id: string;
  organization_id: string;
  transition_type: 'hospital_to_home' | 'hospital_to_snf' | 'snf_to_home' | 'ed_to_home' | 'inpatient_to_outpatient' | 'provider_to_provider' | 'facility_to_facility';
  transition_date: string;
  sending_facility?: string;
  sending_provider_id?: string;
  sending_provider_name?: string;
  receiving_facility?: string;
  receiving_provider_id?: string;
  receiving_provider_name?: string;
  reason: string;
  diagnosis_codes: string[];
  medications_at_transition: TransitionMedication[];
  pending_tests: PendingTest[];
  follow_up_appointments: FollowUpAppointment[];
  patient_education_provided: boolean;
  discharge_instructions?: string;
  care_summary?: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'cancelled';
  completed_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type MedicationReconciliation = {
  id: string;
  patient_id: string;
  organization_id: string;
  provider_id: string;
  visit_id?: string;
  reconciliation_date: string;
  reconciliation_type: 'admission' | 'discharge' | 'transfer' | 'annual_review' | 'post_hospitalization';
  source: 'patient_interview' | 'pharmacy' | 'previous_records' | 'caregiver' | 'medication_list';
  medications_reviewed: Array<{
    medication_name: string;
    dose: string;
    frequency: string;
    status: 'continued' | 'discontinued' | 'modified' | 'new';
    reason?: string;
  }>;
  discrepancies_found: MedicationDiscrepancy[];
  changes_made: MedicationChange[];
  patient_educated: boolean;
  status: 'completed' | 'in_progress' | 'pending';
  notes?: string;
  created_at: string;
};

export async function callPublicEdgeFunction(
  functionName: string,
  payload: Record<string, unknown>
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/${functionName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );
    const data = await response.json();
    if (!response.ok) {
      const msg = data?.error || data?.message || `Edge function ${functionName} failed with status ${response.status}`;
      throw new Error(msg);
    }
    return data;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request to ${functionName} timed out`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

const DEMO_SAFE_FUNCTIONS = ['demo-login'];

function isDeadSessionError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === 'object' && error !== null) {
    const name = 'name' in error && typeof error.name === 'string' ? error.name : '';
    if (name === 'AuthSessionMissingError') return true;
    const msg = 'message' in error && typeof error.message === 'string' ? error.message : String(error);
    return msg.includes('session_not_found') || msg.includes('Session from session_id') || msg.includes('Auth session missing')
      || msg.includes('session has expired') || msg.includes('log out and log back in') || msg.includes('sign in again');
  }
  const str = String(error);
  return str.includes('session_not_found') || str.includes('Session from session_id') || str.includes('Auth session missing')
    || str.includes('session has expired') || str.includes('log out and log back in') || str.includes('sign in again');
}

async function clearDeadSession(): Promise<never> {
  logger.warn('Dead session detected, clearing local auth state');
  await supabase.auth.signOut({ scope: 'local' });
  throw new Error('Your session is no longer valid. Please sign in again.');
}

let _tokenRefreshPromise: Promise<string> | null = null;

async function getAccessToken(): Promise<string> {
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError && isDeadSessionError(sessionError)) {
    await clearDeadSession();
  }
  if (data.session?.access_token) {
    const exp = data.session.expires_at;
    if (exp && exp > Math.floor(Date.now() / 1000) + 60) {
      return data.session.access_token;
    }
  }

  if (_tokenRefreshPromise) {
    return _tokenRefreshPromise;
  }

  _tokenRefreshPromise = (async () => {
    try {
      const { data: refreshed, error } = await supabase.auth.refreshSession();
      if (error && isDeadSessionError(error)) {
        await clearDeadSession();
      }
      if (!error && refreshed.session?.access_token) {
        return refreshed.session.access_token;
      }
      throw new Error('Your session has expired. Please log out and log back in.');
    } finally {
      _tokenRefreshPromise = null;
    }
  })();

  return _tokenRefreshPromise;
}

async function forceRefreshToken(): Promise<string> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error && isDeadSessionError(error)) {
    await clearDeadSession();
  }
  if (!error && data.session?.access_token) {
    return data.session.access_token;
  }
  throw new Error('Your session has expired. Please log out and log back in.');
}

export async function callEdgeFunction<T = unknown>(
  functionName: string,
  payload: Record<string, unknown>
): Promise<T> {
  if (!DEMO_SAFE_FUNCTIONS.includes(functionName)) {
    if (isDemoMode()) {
      throw new Error('This action is disabled in demo mode');
    }
  }

  const token = await getAccessToken();

  const MAX_TRANSIENT_RETRIES = 2; // up to 3 total attempts
  const BACKOFF_DELAYS = [1000, 2000]; // 1s, 2s

  const isTransientStatusCode = (status: number): boolean =>
    status === 502 || status === 503 || status === 504;

  const REQUEST_TIMEOUT_MS = 30_000;
  let controller = new AbortController();
  let timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const makeRequest = async (accessToken: string) => {
    return fetch(
      `${supabaseUrl}/functions/v1/${functionName}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );
  };

  let response: Response | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    try {
      response = await makeRequest(token);

      // If we got a transient gateway error and have retries left, retry
      if (isTransientStatusCode(response.status) && attempt < MAX_TRANSIENT_RETRIES) {
        const delay = BACKOFF_DELAYS[attempt];
        logger.warn(`[callEdgeFunction] ${functionName}: received ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_TRANSIENT_RETRIES + 1})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        // Create a fresh AbortController for the next attempt
        clearTimeout(timeoutId);
        controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        continue;
      }

      // Non-transient response or final attempt — break out of the loop
      break;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        clearTimeout(timeoutId);
        throw new Error(`Request to ${functionName} timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds`);
      }

      // Network error — retry if we have attempts left
      if (attempt < MAX_TRANSIENT_RETRIES) {
        const delay = BACKOFF_DELAYS[attempt];
        logger.warn(`[callEdgeFunction] ${functionName}: network error (${err instanceof Error ? err.message : String(err)}), retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_TRANSIENT_RETRIES + 1})`);
        lastError = err;
        await new Promise((resolve) => setTimeout(resolve, delay));
        // Create a fresh AbortController for the next attempt
        clearTimeout(timeoutId);
        controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        continue;
      }

      // No retries left — throw
      clearTimeout(timeoutId);
      throw err;
    }
  }

  // If we exhausted all attempts via network errors without ever getting a response, throw the last error
  if (!response) {
    clearTimeout(timeoutId);
    throw lastError ?? new Error(`Request to ${functionName} failed after ${MAX_TRANSIENT_RETRIES + 1} attempts`);
  }

  let didRetry = false;

  type EdgeFunctionResponseBody = {
    error?: string;
    message?: string;
    msg?: string;
  } & Record<string, unknown>;

  const parseResponse = async (
    res: Response,
  ): Promise<{ status: number; ok: boolean; parsed?: EdgeFunctionResponseBody; hasBody: boolean }> => {
    const text = await res.text();
    const hasBody = text.trim().length > 0;
    let parsed: EdgeFunctionResponseBody | undefined;
    try {
      parsed = JSON.parse(text) as EdgeFunctionResponseBody;
    } catch {
      parsed = hasBody ? { error: text.trim() } : undefined;
    }
    return { status: res.status, ok: res.ok, parsed, hasBody };
  };

  const getErrorMessage = (
    result: { parsed?: EdgeFunctionResponseBody },
  ): string | undefined => {
    if (!result.parsed) return undefined;
    return result.parsed.error || result.parsed.message || result.parsed.msg;
  };

  const isGatewayError = (msg: string | undefined): boolean => {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return lower.includes('invalid jwt') || lower.includes('jwt expired')
      || lower.includes('token is expired') || lower.includes('token has expired')
      || lower.includes('missing authorization') || lower.includes('no authorization')
      || lower.includes('session_not_found') || lower.includes('session from session_id')
      || lower.includes('auth session missing') || lower.includes('jwt must be provided');
  };

  let result = await parseResponse(response);

  if (result.status === 401 || result.status === 403) {
    if (!didRetry) {
      didRetry = true;
      try {
        const freshToken = await forceRefreshToken();
        response = await makeRequest(freshToken);
        result = await parseResponse(response);
      } catch (refreshErr) {
        if (isDeadSessionError(refreshErr)) {
          const { data: sessionCheck } = await supabase.auth.getUser();
          if (!sessionCheck?.user) {
            logger.warn(`[callEdgeFunction] ${functionName}: dead session confirmed, signing out`);
            await supabase.auth.signOut({ scope: 'local' });
            throw new Error('Your session has expired. Please sign in again.');
          }
          logger.warn(`[callEdgeFunction] ${functionName}: token refresh conflict (refresh token already rotated) but session still valid`);
          const originalError = getErrorMessage(result);
          throw new Error(originalError || 'The service is temporarily unavailable. Please try again.');
        }
        logger.warn(`[callEdgeFunction] ${functionName}: token refresh failed`, { error: refreshErr instanceof Error ? refreshErr.message : String(refreshErr) });
        const originalError = getErrorMessage(result);
        throw new Error(originalError || 'The service is temporarily unavailable. Please try again.');
      }
    }
    if (result.status === 401 || result.status === 403) {
      const fnError = getErrorMessage(result);
      const fnErrorCode = result.parsed?.error;

      if (fnErrorCode === 'ERX_AUTH_EXPIRED' || fnErrorCode === 'ERX_SESSION_EXPIRED' || fnErrorCode === 'ERX_AUTH_INVALID') {
        const { data: userCheck } = await supabase.auth.getUser();
        if (!userCheck?.user) {
          logger.warn(`[callEdgeFunction] ${functionName}: confirmed dead session, signing out`);
          await supabase.auth.signOut({ scope: 'local' });
          throw new Error('Your session has expired. Please sign in again.');
        }
        logger.warn(`[callEdgeFunction] ${functionName}: ${fnErrorCode} but Supabase session is valid — forcing token refresh and retrying`);
        try {
          const freshToken = await forceRefreshToken();
          response = await makeRequest(freshToken);
          result = await parseResponse(response);
          if (result.ok) {
            clearTimeout(timeoutId);
            return result.parsed as T;
          }
        } catch {
          // fall through to error below
        }
        throw new Error('Your session token could not be verified. Please refresh the page and try again.');
      }

      if (!result.hasBody || isGatewayError(fnError)) {
        const isGatewayJwtRejection = fnError && isGatewayError(fnError) && fnErrorCode === undefined;
        if (isGatewayJwtRejection) {
          const { data: gatewayUserCheck } = await supabase.auth.getUser();
          if (!gatewayUserCheck?.user) {
            logger.warn(`[callEdgeFunction] ${functionName}: gateway JWT rejection — confirmed dead session, signing out`);
            await supabase.auth.signOut({ scope: 'local' });
            throw new Error('Your session has expired. Please sign in again.');
          }
          logger.warn(`[callEdgeFunction] ${functionName}: gateway JWT rejection but Supabase session is valid — transient error, not signing out`);
          throw new Error('The service encountered a temporary authentication issue. Please try again.');
        }
        const { data: userCheck } = await supabase.auth.getUser();
        if (!userCheck?.user) {
          logger.warn(`[callEdgeFunction] ${functionName}: confirmed dead session, signing out`);
          await supabase.auth.signOut({ scope: 'local' });
          throw new Error('Your session has expired. Please sign in again.');
        }
        logger.warn(`[callEdgeFunction] ${functionName}: ${result.status} after retry but session appears valid — transient error`);
        throw new Error(fnError || 'The service encountered a temporary issue. Please try again.');
      }

      logger.warn(`[callEdgeFunction] ${functionName}: function returned ${result.status}: ${fnError}`);
      throw new Error(fnError || `The service returned an error. Please try again.`);
    }
  }

  clearTimeout(timeoutId);

  if (!result.ok) {
    const errorMessage = getErrorMessage(result) || `Failed to call ${functionName}: ${result.status}`;
    throw new Error(errorMessage);
  }

  return result.parsed as T;
}
