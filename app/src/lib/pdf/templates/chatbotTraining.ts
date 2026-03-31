import type { PdfSection } from '../types';

export interface ChatbotTrainingData {
  generatedAt?: string;
}

interface TrainingIntent {
  intent: string;
  examples: string[];
  response: string;
}

interface TrainingCategory {
  category: string;
  description: string;
  intents: TrainingIntent[];
}

export const CHATBOT_TRAINING_INTENTS: TrainingCategory[] = [
  {
    category: 'Getting Started',
    description: 'Onboarding, first login, and initial setup questions.',
    intents: [
      {
        intent: 'how_to_login',
        examples: [
          'How do I log in?',
          'Where do I sign in?',
          'I cannot find the login page.',
          'What is the URL to access CareMetric AI?',
        ],
        response: 'Log in at your practice\'s CareMetric AI URL (provided in your welcome email). Enter your email and password, then complete the two-factor authentication if enabled. If you forgot your password, click "Forgot Password" on the login screen.',
      },
      {
        intent: 'how_to_add_patient',
        examples: [
          'How do I add a new patient?',
          'How do I register a patient?',
          'Where do I create a patient record?',
          'Add new patient',
        ],
        response: 'Go to Patients in the left sidebar → click the blue "Add Patient" button (top right) → fill in name, date of birth, sex, and contact info → add insurance under the Insurance tab → click Save.',
      },
      {
        intent: 'how_to_invite_staff',
        examples: [
          'How do I add a team member?',
          'How do I invite a provider?',
          'How do I give someone access?',
          'Add new employee',
        ],
        response: 'Go to Practice Admin → Staff → Invite Team Member. Enter their email, select their role (Provider, Nurse, Front Desk, Biller, or Admin), and click Send Invitation. They will receive an email with a secure setup link.',
      },
      {
        intent: 'setup_practice',
        examples: [
          'How do I set up my practice?',
          'What do I do first when I get started?',
          'Initial setup steps',
          'Practice configuration',
        ],
        response: 'Start with Practice Admin → Organization Setup. Fill in your practice name, address, NPI, and tax ID. Then add your providers and staff, configure provider availability under Scheduling, add your insurance payers, and enable the features your practice needs. The Quick Start Guide covers all steps in detail.',
      },
    ],
  },
  {
    category: 'Scheduling',
    description: 'Appointment booking, reminders, and telehealth scheduling questions.',
    intents: [
      {
        intent: 'how_to_book_appointment',
        examples: [
          'How do I schedule an appointment?',
          'How do I book a visit?',
          'Create new appointment',
          'How do I add an appointment to the calendar?',
        ],
        response: 'Go to Schedule in the left sidebar. Click an open time slot on the provider\'s calendar, select the patient, choose a visit type and duration, toggle reminders if desired, and click Save. The patient receives a confirmation automatically.',
      },
      {
        intent: 'how_to_reschedule',
        examples: [
          'How do I reschedule an appointment?',
          'Move an appointment',
          'Change appointment time',
          'How do I cancel and rebook?',
        ],
        response: 'Click the appointment on the calendar → click Edit → change the date/time → Save. To cancel: click the appointment → Cancel Appointment → select a reason. If there is a waitlist, the system can auto-notify the next patient.',
      },
      {
        intent: 'setup_telehealth_visit',
        examples: [
          'How do I set up a telehealth appointment?',
          'How do I schedule a video visit?',
          'Create telemedicine appointment',
          'Virtual visit setup',
        ],
        response: 'When creating or editing an appointment, toggle "Telehealth Visit" to ON. A Twilio video room link is created automatically. The patient receives their video link via SMS and email. At visit time, click Start Telehealth Visit from the appointment to launch the video session.',
      },
      {
        intent: 'appointment_reminders',
        examples: [
          'How do I set up appointment reminders?',
          'Why are patients not getting reminders?',
          'Reminder SMS not sending',
          'Turn on appointment notifications',
        ],
        response: 'Reminder rules are configured under Practice Admin → Scheduling → Reminder Rules. Ensure the patient has SMS consent on file and your Twilio phone number is configured. Individual reminders can also be toggled on when booking each appointment.',
      },
    ],
  },
  {
    category: 'Clinical Documentation',
    description: 'Note writing, SOAP templates, AI generation, and co-signatures.',
    intents: [
      {
        intent: 'start_visit_note',
        examples: [
          'How do I start a visit note?',
          'How do I write a SOAP note?',
          'Create a clinical note',
          'How do I document a visit?',
        ],
        response: 'From the Schedule, click the appointment → Start Visit. Or from the Patient Chart → Visits → New Visit. Select a note template, enter the chief complaint, fill in the SOAP sections, review AI suggestions, and click Close & Sign when complete.',
      },
      {
        intent: 'ambient_scribe_setup',
        examples: [
          'How does ambient scribe work?',
          'How do I use the AI to write my notes?',
          'Ambient listening setup',
          'AI transcription not working',
          'How do I turn on ambient recording?',
        ],
        response: 'In the note editor, click the Ambient Scribe icon (microphone). Allow microphone access when prompted. Click Start Recording before the patient encounter. The AI listens and drafts your note automatically. Click Stop Recording when done, review the draft, make any corrections, and sign.',
      },
      {
        intent: 'co_signature_workflow',
        examples: [
          'How does co-signing work?',
          'How do I request a co-signature?',
          'Supervising provider signature',
          'Co-signer not receiving notification',
        ],
        response: 'Co-signers are configured per provider under Practice Admin → Providers → select provider → Co-Signer. When a note is submitted for co-signature, the supervising provider receives a notification in their Smart Inbox. They review and sign from Inbox → Pending Co-Signatures.',
      },
      {
        intent: 'documentation_quality_check',
        examples: [
          'What is Documentation Quality Check?',
          'How do I check my note quality?',
          'My note has quality warnings',
          'How do I fix note compliance errors?',
        ],
        response: 'Documentation Quality Check analyzes your note for missing required elements, coding accuracy, and compliance issues before you sign. Click the Quality Check button in the note toolbar. Each flag shows a description and a suggested fix. Resolving all critical flags before signing maximizes clean claim rates.',
      },
    ],
  },
  {
    category: 'Billing & Revenue Cycle',
    description: 'Claim submission, denials, ERA posting, and payment questions.',
    intents: [
      {
        intent: 'submit_claim',
        examples: [
          'How do I submit a claim?',
          'How do I bill for a visit?',
          'Claim submission process',
          'How do I send a claim to insurance?',
        ],
        response: 'Claims auto-populate in Billing → Billing Pipeline after a note is signed. Click the claim, review CPT codes, click Scrub Claim to check for errors, resolve any alerts, then click Submit Claim to send to ClaimMD clearinghouse. Monitor status in the ERA Queue.',
      },
      {
        intent: 'claim_denial_management',
        examples: [
          'My claim was denied. What do I do?',
          'How do I appeal a denial?',
          'Denial management process',
          'Claim rejected — how do I fix it?',
        ],
        response: 'Go to Billing → Denial Management. Click the denied claim to see the denial reason code and payer explanation. Click Draft Appeal to have AI generate a customized appeal letter. Complete any missing documentation, attach supporting records, and submit the appeal electronically or by mail based on the payer\'s requirements.',
      },
      {
        intent: 'era_setup',
        examples: [
          'How do I set up ERA posting?',
          'Electronic remittance advice',
          'ERA not auto-posting',
          'How do I post insurance payments automatically?',
        ],
        response: 'ERA auto-posting is configured under Practice Admin → Integrations → ClaimMD. Enable ERA/835 receipt and auto-posting. You also need to be enrolled for ERA with each payer through ClaimMD. Once configured, electronic payments post automatically when ClaimMD receives the 835 file.',
      },
      {
        intent: 'billing_cpt_codes',
        examples: [
          'How does AI suggest CPT codes?',
          'What E&M level is my note?',
          'How is MDM calculated?',
          'CPT code suggestion not showing',
        ],
        response: 'AI CPT code suggestions come from the note\'s MDM level, chief complaint, and documented procedures. The MDM Widget in the note editor calculates your E&M level in real time based on the three MDM elements: number and complexity of problems, amount and complexity of data, and risk of complications. Review and confirm all AI suggestions before signing.',
      },
    ],
  },
  {
    category: 'Patient Portal',
    description: 'Portal invitations, messaging, and patient access questions.',
    intents: [
      {
        intent: 'send_portal_invite',
        examples: [
          'How do I invite a patient to the portal?',
          'How do I activate patient portal access?',
          'Patient portal invitation',
          'How does patient sign up for portal?',
        ],
        response: 'Open the patient chart → click the portal icon or go to the Portal tab → click Invite to Portal. Verify their email address is correct and click Send Invitation. The patient receives a secure link valid for 7 days to create their account.',
      },
      {
        intent: 'portal_message_response',
        examples: [
          'How do I respond to patient messages?',
          'Where are patient portal messages?',
          'Patient sent me a message',
          'Inbox patient communication',
        ],
        response: 'Patient portal messages appear in your Smart Inbox → Patient Messages. Click a message to read it and type your reply. Messages are triaged by AI urgency — critical messages are flagged red and routed to the provider immediately. Aim to respond within 1 business day.',
      },
      {
        intent: 'release_lab_results_to_portal',
        examples: [
          'How do I release lab results to the patient?',
          'Patient cannot see their labs in the portal',
          'Share results with patient',
          'Lab results release',
        ],
        response: 'Open the patient chart → Lab Results tab → click the result → toggle "Release to Portal" to ON. Add an explanatory message for the patient if needed. The result appears in the patient\'s portal immediately after releasing.',
      },
    ],
  },
  {
    category: 'Prescriptions',
    description: 'Prescription sending, refills, controlled substances, and PDMP.',
    intents: [
      {
        intent: 'send_prescription',
        examples: [
          'How do I send a prescription?',
          'How do I prescribe a medication?',
          'Prescribing steps',
          'How do I electronically prescribe?',
        ],
        response: 'From a visit note or patient chart, click Prescribe or go to Medications → New Prescription. Search for the medication, review interaction alerts, set dosage and instructions, select the pharmacy, and click Send. For controlled substances, complete the two-factor authentication step.',
      },
      {
        intent: 'controlled_substance_prescribing',
        examples: [
          'How do I prescribe controlled substances?',
          'How do I prescribe opioids?',
          'Schedule II prescription process',
        ],
        response: 'When prescribing a DEA Schedule II-V medication, complete the required two-factor authentication step. Make sure to check the PDMP first — required in most states for controlled substances.',
      },
      {
        intent: 'process_refill_request',
        examples: [
          'How do I process a refill request?',
          'Patient requesting medication refill',
          'How do I renew a prescription?',
          'Refill workflow',
        ],
        response: 'Refill requests from patients appear in Smart Inbox → Refill Requests. Click a request to review the patient history and last prescription. Click Approve to send the refill electronically, or Deny with a reason. You can also modify the quantity or instructions before approving.',
      },
    ],
  },
  {
    category: 'System Settings & Configuration',
    description: 'Organization settings, roles, integrations, and feature configuration.',
    intents: [
      {
        intent: 'configure_integrations',
        examples: [
          'How do I set up integrations?',
          'How do I connect ClaimMD?',
          'Integration settings',
          'How do I configure Twilio?',
        ],
        response: 'Go to Practice Admin → Integrations. Each integration (ClaimMD, Twilio, etc.) has its own configuration tile. Click the integration to enter credentials and API keys. Test the connection using the Test button before saving. Contact support if an integration fails to connect.',
      },
      {
        intent: 'manage_staff_roles',
        examples: [
          'How do I change a staff member\'s role?',
          'How do I update permissions?',
          'User role management',
          'How do I remove a team member\'s access?',
        ],
        response: 'Go to Practice Admin → Staff. Click the staff member\'s name → Edit → change the Role dropdown → Save. To remove access, click Deactivate Account. Deactivated accounts retain data but cannot log in. Role permissions are configured under Practice Admin → Staff Roles.',
      },
      {
        intent: 'enable_features',
        examples: [
          'How do I turn on features?',
          'Feature is not showing up',
          'How do I enable telehealth?',
          'Where are feature settings?',
        ],
        response: 'Go to Practice Admin → Features. Each feature (Telehealth, Patient Portal, Prescriptions, CDS, etc.) has a toggle. Enable the features included in your subscription. If a feature is greyed out, it may require an add-on — contact your CareMetric AI account manager.',
      },
    ],
  },
  {
    category: 'Troubleshooting',
    description: 'Common errors and quick fixes.',
    intents: [
      {
        intent: 'general_login_issue',
        examples: [
          'I cannot log in',
          'Password not working',
          'Account locked',
          'Login error',
        ],
        response: 'Click "Forgot Password" on the login screen to reset. If your account is locked (5 failed attempts), wait 15 minutes or contact your admin. If the issue persists, contact support@caremetric.ai.',
      },
      {
        intent: 'page_not_loading',
        examples: [
          'Page is blank',
          'Dashboard not loading',
          'Screen shows error',
          'Something is broken',
          'App is not working',
        ],
        response: 'Try these steps: 1) Hard refresh with Ctrl+Shift+R (or Cmd+Shift+R on Mac). 2) Clear your browser cache. 3) Log out and back in. 4) Try a different browser. If the issue continues, contact support@caremetric.ai with a screenshot.',
      },
      {
        intent: 'contact_support',
        examples: [
          'How do I contact support?',
          'I need help',
          'Submit a support ticket',
          'How do I get assistance?',
          'Support email',
        ],
        response: 'Contact support at support@caremetric.ai or submit a ticket through Settings → Support → Submit Ticket. For critical issues, mark your email URGENT. Our team typically responds within 1 business day, and within 4 hours for critical issues.',
      },
    ],
  },
];

export function buildChatbotTrainingSections(_data: ChatbotTrainingData): PdfSection[] {
  const sections: PdfSection[] = [];

  sections.push({ type: 'heading', level: 1, text: 'CareMetric AI — Chatbot Training Intents & Responses' });
  sections.push({
    type: 'paragraph',
    text: 'This document provides structured intent and response data for training AI chatbot models. Each entry includes sample user utterances and the canonical response. Organized by functional category.',
  });
  sections.push({ type: 'spacer' });
  sections.push({
    type: 'keyValue',
    pairs: [
      { label: 'Total Categories', value: String(CHATBOT_TRAINING_INTENTS.length) },
      {
        label: 'Total Intents',
        value: String(CHATBOT_TRAINING_INTENTS.reduce((sum, c) => sum + c.intents.length, 0)),
      },
      {
        label: 'Total Sample Utterances',
        value: String(CHATBOT_TRAINING_INTENTS.reduce((sum, c) => sum + c.intents.reduce((s2, i) => s2 + i.examples.length, 0), 0)),
      },
    ],
  });
  sections.push({ type: 'divider' });

  for (const category of CHATBOT_TRAINING_INTENTS) {
    sections.push({ type: 'heading', level: 2, text: `Category: ${category.category}` });
    sections.push({ type: 'paragraph', text: category.description });
    sections.push({ type: 'spacer' });

    for (const intent of category.intents) {
      sections.push({ type: 'heading', level: 3, text: `Intent: ${intent.intent}` });
      sections.push({ type: 'paragraph', text: 'Sample Utterances:' });
      sections.push({ type: 'list', items: intent.examples });
      sections.push({ type: 'paragraph', text: 'Canonical Response:' });
      sections.push({ type: 'paragraph', text: intent.response, highlight: 'success' });
      sections.push({ type: 'spacer' });
    }

    sections.push({ type: 'divider' });
  }

  sections.push({ type: 'heading', level: 2, text: 'Implementation Notes' });
  sections.push({
    type: 'list',
    items: [
      'Train on all sample utterances plus variations of each to improve recall.',
      'Fallback intent should route to support@caremetric.ai for unrecognized queries.',
      'Update intents when new features are released — keep training data current.',
      'A/B test response wording with user satisfaction scores to optimize helpfulness.',
      'Context carryover: for multi-turn conversations, maintain the active module context.',
    ],
  });

  return sections;
}
