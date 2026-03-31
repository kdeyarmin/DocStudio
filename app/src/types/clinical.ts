export interface ComplianceSuggestion {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ScrubberError {
  code: string;
  message: string;
  field?: string;
  severity: 'error' | 'warning';
}

export interface AdjustmentCode {
  code: string;
  amount: number;
  description: string;
  group?: string;
}

export interface RemarkCode {
  code: string;
  description: string;
}

export interface AuditLogValues {
  [key: string]: unknown;
}

export interface DrugInteractionWarning {
  drug1: string;
  drug2: string;
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  description: string;
  recommendation?: string;
}

export interface AIAnalysis {
  summary: string;
  findings: string[];
  recommendations: string[];
  confidence?: number;
}

export interface AIValidationNotes {
  field: string;
  note: string;
  severity: 'info' | 'warning' | 'error';
}

export interface TechnicalIssue {
  code: string;
  description: string;
  resolution?: string;
}

export interface TransitionMedication {
  name: string;
  dose: string;
  route: string;
  frequency: string;
  status: 'continue' | 'discontinue' | 'new' | 'changed';
  prescriber?: string;
}

export interface PendingTest {
  testName: string;
  orderedDate: string;
  status: 'pending' | 'resulted' | 'cancelled';
  orderedBy?: string;
}

export interface FollowUpAppointment {
  reason: string;
  timeframe: string;
  provider?: string;
  specialty?: string;
}

export interface MedicationDiscrepancy {
  medicationName: string;
  source: string;
  discrepancyType: 'dose' | 'frequency' | 'missing' | 'extra';
  details: string;
}

export interface MedicationChange {
  medicationName: string;
  changeType: 'started' | 'stopped' | 'modified';
  previousDose?: string;
  newDose?: string;
  reason?: string;
  changedAt: string;
}
