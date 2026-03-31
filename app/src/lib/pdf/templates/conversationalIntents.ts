import type { PdfSection } from '../types';

export interface ConversationalIntentsData {
  generatedAt?: string;
}

export interface ConversationalIntent {
  intentName: string;
  examplePhrases: string[];
  primaryResponse: string;
  followUpQuestions: string[];
  escalationFlags: string[];
}

export interface ConversationalIntentCategory {
  category: string;
  description: string;
  intents: ConversationalIntent[];
}

export const CONVERSATIONAL_INTENT_CATEGORIES: ConversationalIntentCategory[] = [
  {
    category: 'Onboarding & First Steps',
    description: 'New user orientation, practice setup, and initial configuration support.',
    intents: [
      {
        intentName: 'onboarding_get_started',
        examplePhrases: [
          'How do I get started?',
          'What should I do first?',
          'I just signed up, what now?',
          'Walk me through setup',
          'New practice setup steps',
        ],
        primaryResponse: 'Welcome to CareMetric AI! Start by going to Practice Admin, then Organization Setup. Fill in your practice name, address, NPI, and tax ID. Next, invite your team under Staff, configure provider availability under Scheduling, add your insurance payers, and enable features like Telehealth and Patient Portal. The entire setup takes about 30 minutes.',
        followUpQuestions: [
          'What is your role at the practice? (Admin, Provider, Biller, Front Desk)',
          'Have you already completed the Organization Setup section?',
          'How many providers will be using the system?',
        ],
        escalationFlags: [
          'User reports they cannot access Practice Admin after sign-up',
          'User mentions they received no welcome email',
          'User is unable to save organization details after multiple attempts',
        ],
      },
      {
        intentName: 'onboarding_add_first_patient',
        examplePhrases: [
          'How do I add my first patient?',
          'Where do I register a patient?',
          'Create a new patient record',
          'How do I enter patient demographics?',
        ],
        primaryResponse: 'Go to Patients in the left sidebar, then click the "Add Patient" button at the top right. Enter the patient\'s name, date of birth, sex, and contact information. Add their insurance under the Insurance tab by searching for the payer and entering the member ID. Click Save, then optionally click Invite to Portal to give them online access.',
        followUpQuestions: [
          'Do you have the patient\'s insurance information ready?',
          'Would you also like to set up the Patient Portal invitation?',
          'Are you importing patients from another system?',
        ],
        escalationFlags: [
          'User mentions they are trying to import a patient list from another EMR',
          'User reports duplicate patient detection is blocking legitimate new entries',
          'User cannot find the Add Patient button (possible permissions issue)',
        ],
      },
      {
        intentName: 'onboarding_invite_team',
        examplePhrases: [
          'How do I add a team member?',
          'Invite a provider to the system',
          'How do I give someone access?',
          'Add new employee or staff',
          'How do I set up a biller account?',
        ],
        primaryResponse: 'Go to Practice Admin, then Staff, then click Invite Team Member. Enter their email address, select their role (Provider, Nurse, Medical Assistant, Front Desk, Biller, or Admin), and click Send Invitation. They will receive a secure email with a link to create their account and set a password.',
        followUpQuestions: [
          'What role should this person have?',
          'Will this person need prescribing access?',
          'Is this a provider who needs to be credentialed with payers?',
        ],
        escalationFlags: [
          'Invitation email was not received after 15 minutes',
          'User reports the invited person\'s link is expired',
          'Role assignment dropdown is missing expected roles',
        ],
      },
    ],
  },
  {
    category: 'Scheduling & Appointments',
    description: 'Appointment booking, rescheduling, reminders, waitlist, and telehealth scheduling.',
    intents: [
      {
        intentName: 'scheduling_book_appointment',
        examplePhrases: [
          'How do I schedule an appointment?',
          'Book a visit for a patient',
          'Create a new appointment',
          'How do I add something to the calendar?',
        ],
        primaryResponse: 'Go to Schedule in the left sidebar. Click an open time slot on the provider\'s calendar, search for and select the patient, choose a visit type and duration, toggle reminders if desired, and click Save. The patient receives a confirmation automatically via their preferred communication method.',
        followUpQuestions: [
          'Is this an in-person visit or a telehealth appointment?',
          'Which provider should the appointment be with?',
          'Would you like to send an automatic reminder to the patient?',
        ],
        escalationFlags: [
          'Calendar is showing no available slots despite availability being configured',
          'User reports appointments are disappearing after being saved',
          'Patient confirmation messages are not being delivered',
        ],
      },
      {
        intentName: 'scheduling_reschedule_cancel',
        examplePhrases: [
          'How do I reschedule an appointment?',
          'Move an appointment to a different time',
          'Cancel a patient visit',
          'Change appointment date',
        ],
        primaryResponse: 'Click the appointment on the calendar, then click Edit to change the date or time and Save. To cancel, click the appointment, then Cancel Appointment, and select a cancellation reason. If there is a waitlist, the system can automatically notify the next patient in line to fill the open slot.',
        followUpQuestions: [
          'Would you like to offer the patient an alternative time?',
          'Should we notify the waitlist to fill this cancelled slot?',
          'Is there a specific reason for the cancellation to document?',
        ],
        escalationFlags: [
          'User cannot edit a past appointment and needs correction',
          'Cancellation reason options do not include the appropriate reason',
          'Waitlist auto-match is not triggering notifications',
        ],
      },
      {
        intentName: 'scheduling_telehealth_setup',
        examplePhrases: [
          'How do I set up a telehealth visit?',
          'Schedule a video appointment',
          'Virtual visit setup',
          'Telemedicine appointment creation',
        ],
        primaryResponse: 'When creating or editing an appointment, toggle "Telehealth Visit" to ON. A Twilio video room link is automatically created. The patient receives their video link via SMS and email. At visit time, click Start Telehealth Visit from the appointment to launch the video session directly from the chart.',
        followUpQuestions: [
          'Has your practice enabled Telehealth in Practice Admin features?',
          'Does the patient have a valid email and phone number on file for the video link?',
          'Will the provider need to share their screen during the visit?',
        ],
        escalationFlags: [
          'Video link is not being generated when telehealth toggle is enabled',
          'Patient reports they cannot join the video room',
          'Audio or video quality issues during active sessions',
        ],
      },
      {
        intentName: 'scheduling_reminders_not_working',
        examplePhrases: [
          'Patients are not getting appointment reminders',
          'How do I configure reminders?',
          'SMS reminder not sending',
          'Why did the patient not get a notification?',
        ],
        primaryResponse: 'Appointment reminder rules are configured under Practice Admin, then Scheduling, then Reminder Rules. Ensure the patient has SMS consent on file and that your Twilio phone number is properly configured in Integrations. Individual reminders can also be toggled on for each appointment at booking time.',
        followUpQuestions: [
          'Does the patient have SMS consent enabled in their profile?',
          'Is your Twilio SMS phone number verified and active?',
          'What reminder time window are you expecting (24 hours, 2 hours, etc.)?',
        ],
        escalationFlags: [
          'Twilio SMS phone number is not verified or active',
          'SMS consent is on but messages are still failing',
          'Bulk reminder failures affecting multiple patients',
        ],
      },
    ],
  },
  {
    category: 'Clinical Documentation & Notes',
    description: 'Visit note creation, ambient scribe, AI note generation, co-signatures, and quality checks.',
    intents: [
      {
        intentName: 'documentation_start_note',
        examplePhrases: [
          'How do I start a visit note?',
          'Write a SOAP note',
          'Create a clinical note for a patient',
          'How do I document a visit?',
          'Begin charting for an encounter',
        ],
        primaryResponse: 'From the Schedule, click the appointment then Start Visit. Alternatively, go to the Patient Chart, then Visits, then New Visit. Select a note template (SOAP, DAP, H&P, psychiatric, or specialty-specific), enter the chief complaint, fill in the note sections, review AI-suggested codes, and click Close & Sign when complete.',
        followUpQuestions: [
          'What type of visit is this? (Follow-up, new patient, procedure, telehealth)',
          'Do you have a preferred note template?',
          'Would you like to use the Ambient AI Scribe to auto-generate the note?',
        ],
        escalationFlags: [
          'Note template list is empty or missing expected templates',
          'Start Visit button is greyed out or non-functional',
          'User reports losing note content after saving',
        ],
      },
      {
        intentName: 'documentation_ambient_scribe',
        examplePhrases: [
          'How does the ambient scribe work?',
          'AI is not writing my notes',
          'How do I turn on ambient listening?',
          'Voice transcription setup',
          'Microphone not recording',
        ],
        primaryResponse: 'In the note editor, click the Ambient Scribe icon (microphone button). Allow microphone access when your browser prompts. Click Start Recording before the patient encounter begins. The AI listens to the conversation and drafts the note automatically. Click Stop Recording when the encounter is complete, review the AI draft, make any corrections, and sign.',
        followUpQuestions: [
          'Has your browser granted microphone permission to CareMetric AI?',
          'Are you using this during an in-person visit or a telehealth session?',
          'What specialty template should the AI use for note formatting?',
        ],
        escalationFlags: [
          'Microphone permission is granted but no audio is being captured',
          'AI-generated note is blank or severely incomplete after a full recording',
          'Transcription quality is consistently poor (more than 20% correction needed)',
          'User reports the ambient scribe is not available in their note editor',
        ],
      },
      {
        intentName: 'documentation_cosignature',
        examplePhrases: [
          'How does co-signing work?',
          'My supervising provider needs to sign my note',
          'Request a co-signature',
          'Where do co-sign requests appear?',
        ],
        primaryResponse: 'Co-signers are configured per provider under Practice Admin, then Providers, then select the provider and set the Co-Signer. When a note is submitted for co-signature, the supervising provider receives a notification in their Smart Inbox. They review the note and sign from Inbox, then Pending Co-Signatures.',
        followUpQuestions: [
          'Has a co-signer been assigned to the authoring provider?',
          'Is this for a supervised trainee, NP, or PA?',
          'Did the co-signer receive the notification in their inbox?',
        ],
        escalationFlags: [
          'Co-signer dropdown is empty when configuring the provider',
          'Co-signature notification is not appearing in the supervising provider\'s inbox',
          'Note was signed without required co-signature',
        ],
      },
      {
        intentName: 'documentation_quality_check',
        examplePhrases: [
          'What is Documentation Quality Check?',
          'My note has quality warnings',
          'How do I check if my note is compliant?',
          'Fix note compliance errors',
        ],
        primaryResponse: 'Documentation Quality Check analyzes your note for missing required elements, coding accuracy, and compliance issues before you sign. Click the Quality Check button in the note toolbar. Each flag shows a description and a suggested fix. Resolving all critical flags before signing maximizes clean claim submission rates and reduces audit risk.',
        followUpQuestions: [
          'What specific quality warning are you seeing?',
          'Is the flag related to documentation completeness or coding?',
          'Would you like me to explain what a specific warning means?',
        ],
        escalationFlags: [
          'Quality check is flagging items that appear correct in the note',
          'Quality check is not running or returns no results on incomplete notes',
          'Provider is unable to sign note due to unresolvable quality flags',
        ],
      },
    ],
  },
  {
    category: 'Billing & Revenue Cycle',
    description: 'Claim submission, denial management, ERA posting, payment processing, and billing troubleshooting.',
    intents: [
      {
        intentName: 'billing_submit_claim',
        examplePhrases: [
          'How do I submit a claim?',
          'Bill for a patient visit',
          'Send a claim to insurance',
          'Claim submission process',
          'How do I file a claim?',
        ],
        primaryResponse: 'Claims auto-populate in Billing, then Billing Pipeline after a note is signed. Click the claim, review the CPT and ICD-10 codes, click Scrub Claim to check for errors and NCCI edits, resolve any alerts, then click Submit Claim to send through the ClaimMD clearinghouse. Monitor status in the ERA Queue for payment posting.',
        followUpQuestions: [
          'Has the visit note been signed by the provider?',
          'Are you seeing any scrubbing errors on the claim?',
          'Is this a primary or secondary claim?',
        ],
        escalationFlags: [
          'Claim scrubbing returns errors that the user cannot resolve',
          'Signed notes are not generating claims in the billing pipeline',
          'ClaimMD connection is failing or returning authentication errors',
          'Bulk claim submission failure affecting multiple claims',
        ],
      },
      {
        intentName: 'billing_denial_management',
        examplePhrases: [
          'My claim was denied',
          'How do I appeal a denial?',
          'Claim rejected, what do I do?',
          'Where do I find denied claims?',
          'Denial management workflow',
        ],
        primaryResponse: 'Go to Billing, then Denial Management. Click the denied claim to see the denial reason code and payer explanation. Click Draft Appeal to have AI generate a customized appeal letter with relevant chart documentation attached. Complete any missing documentation, review the letter, and submit the appeal electronically or by mail based on the payer\'s requirements.',
        followUpQuestions: [
          'What is the denial reason code (CARC/RARC)?',
          'Is this a first-time denial or a re-denial after appeal?',
          'Was this a documentation issue, eligibility issue, or authorization issue?',
        ],
        escalationFlags: [
          'Denial is within 5 days of timely filing deadline',
          'Same denial code is appearing on multiple claims (systemic issue)',
          'AI appeal letter generation is failing',
          'User reports repeated denials after successful appeals (payer pattern)',
        ],
      },
      {
        intentName: 'billing_era_posting',
        examplePhrases: [
          'How do I set up ERA auto-posting?',
          'Electronic remittance not posting',
          'Payments are not matching to claims',
          'ERA 835 file processing',
        ],
        primaryResponse: 'ERA auto-posting is configured under Practice Admin, then Integrations, then ClaimMD. Enable ERA/835 receipt and auto-posting. You also need to be enrolled for ERA with each payer through ClaimMD. Once configured, electronic payments post automatically when ClaimMD receives the 835 file from the payer.',
        followUpQuestions: [
          'Have you enrolled for ERA receipt with this specific payer through ClaimMD?',
          'Is the ClaimMD integration showing a connected status?',
          'Are some payments posting correctly while others are not?',
        ],
        escalationFlags: [
          'ERA enrollment is confirmed but 835 files are not arriving',
          'Payment amounts on 835 do not match expected reimbursement',
          'Auto-posting is matching payments to incorrect claims',
          'ClaimMD integration shows disconnected status',
        ],
      },
      {
        intentName: 'billing_coding_assistance',
        examplePhrases: [
          'How does AI suggest CPT codes?',
          'What E&M level is my note?',
          'MDM calculation help',
          'Code suggestions not appearing',
          'How do I maximize compliant coding?',
        ],
        primaryResponse: 'AI CPT code suggestions are derived from the note\'s content, MDM level, chief complaint, and documented procedures. The MDM Widget in the note editor calculates your E&M level in real time based on three elements: number and complexity of problems, amount and complexity of data reviewed, and risk of complications. Always review and confirm all AI suggestions before signing.',
        followUpQuestions: [
          'Are you seeing the MDM Widget in your note editor?',
          'What type of visit is this (new patient, established, telehealth)?',
          'Are you looking for CPT, ICD-10, or both?',
        ],
        escalationFlags: [
          'MDM Widget is not appearing in the note editor',
          'AI code suggestions are consistently inaccurate or missing',
          'E&M level calculation seems incorrect for the documented complexity',
        ],
      },
    ],
  },
  {
    category: 'Patient Portal & Communication',
    description: 'Portal invitations, patient messaging, lab result sharing, and patient-facing features.',
    intents: [
      {
        intentName: 'portal_invite_patient',
        examplePhrases: [
          'How do I invite a patient to the portal?',
          'Activate patient portal access',
          'Send a portal invitation',
          'Patient wants online access',
        ],
        primaryResponse: 'Open the patient chart, then click the portal icon or go to the Portal tab. Click Invite to Portal, verify the patient\'s email address is correct, and click Send Invitation. The patient receives a secure link valid for 7 days to create their portal account. They can then view results, message the care team, request appointments, and pay bills online.',
        followUpQuestions: [
          'Does the patient have a valid email address on file?',
          'Has the patient been invited before and the link expired?',
          'Does your practice have the Patient Portal feature enabled?',
        ],
        escalationFlags: [
          'Patient did not receive the invitation email (check spam folder first)',
          'Portal invitation link returns an error when the patient clicks it',
          'Patient Portal feature is not enabled for the practice',
        ],
      },
      {
        intentName: 'portal_patient_messaging',
        examplePhrases: [
          'How do I respond to patient messages?',
          'Where are patient portal messages?',
          'A patient sent me a secure message',
          'How do I message a patient?',
        ],
        primaryResponse: 'Patient portal messages appear in your Smart Inbox under Patient Messages. Click a message to read it and type your reply. Messages are triaged by AI urgency: critical messages are flagged red and routed to the provider immediately. Aim to respond within 1 business day per your practice policy.',
        followUpQuestions: [
          'Is the message clinical in nature or administrative?',
          'Does this need to be escalated to the provider or can support staff handle it?',
          'Would you like to include any attachments or educational materials?',
        ],
        escalationFlags: [
          'Patient message describes acute symptoms (chest pain, difficulty breathing, suicidal ideation)',
          'Smart Inbox is not showing new messages that patients confirm they sent',
          'Message delivery confirmation is failing',
        ],
      },
      {
        intentName: 'portal_release_lab_results',
        examplePhrases: [
          'How do I release lab results to a patient?',
          'Patient cannot see their labs',
          'Share results through the portal',
          'Lab result release process',
        ],
        primaryResponse: 'Open the patient chart, go to the Lab Results tab, click the specific result, and toggle "Release to Portal" to ON. Add an explanatory message for the patient if the results need context. The result appears in the patient\'s portal immediately after release. For critical or abnormal results, consider calling the patient directly first.',
        followUpQuestions: [
          'Are the results normal, abnormal, or critical?',
          'Has the provider reviewed and acknowledged the results?',
          'Would you like to include a plain-language explanation with the release?',
        ],
        escalationFlags: [
          'Critical lab value is being released without documented provider review',
          'Release toggle is not available (possible permissions or configuration issue)',
          'Patient reports seeing results that have not been reviewed by the provider',
        ],
      },
    ],
  },
  {
    category: 'Prescriptions & Medications',
    description: 'Prescription sending, controlled substance prescribing, refill management, and pharmacy integration.',
    intents: [
      {
        intentName: 'prescribing_send_rx',
        examplePhrases: [
          'How do I send a prescription?',
          'Prescribe a medication',
          'Prescribing steps',
          'Send an electronic prescription',
        ],
        primaryResponse: 'From a visit note or the patient chart, click Prescribe or go to Medications, then New Prescription. Search for the medication by name, review interaction alerts and allergy warnings, set dosage, frequency, quantity, and instructions, select the patient\'s pharmacy, and click Send. For controlled substances, complete the two-factor authentication step.',
        followUpQuestions: [
          'Is this a controlled substance (Schedule II-V)?',
          'Does the patient have a preferred pharmacy on file?',
          'Are there any known allergies or current medications to check?',
        ],
        escalationFlags: [
          'Drug interaction alert is blocking a medically necessary prescription',
          'Two-factor authentication is failing for the provider',
          'Pharmacy is not receiving the electronic prescription',
        ],
      },
      {
        intentName: 'prescribing_controlled_substances',
        examplePhrases: [
          'How do I prescribe a controlled substance?',
          'Controlled substance prescribing',
          'Schedule II prescription process',
          'DEA number for prescribing',
        ],
        primaryResponse: 'When prescribing a DEA Schedule II-V medication, a two-factor authentication prompt appears. Complete the authentication step to confirm your identity. Before prescribing opioids, check the PDMP (Prescription Drug Monitoring Program) -- this is required in most states.',
        followUpQuestions: [
          'Has the provider completed identity proofing?',
          'Does the provider have an active DEA registration?',
          'Has the PDMP been checked for this patient?',
        ],
        escalationFlags: [
          'Identity proofing process is failing or stalled',
          'Two-factor authentication token is being rejected',
          'Provider DEA registration has expired',
          'PDMP check is returning errors or timeouts',
        ],
      },
      {
        intentName: 'prescribing_refill_request',
        examplePhrases: [
          'How do I process a refill?',
          'Patient needs a medication refill',
          'Refill request in inbox',
          'Renew a prescription',
        ],
        primaryResponse: 'Refill requests from patients appear in Smart Inbox under Refill Requests. Click a request to review the patient\'s medication history and the last prescription details. Click Approve to send the refill electronically, or Deny with a documented reason. You can modify the quantity, days supply, or instructions before approving.',
        followUpQuestions: [
          'When was the patient\'s last office visit?',
          'Is this medication due for a prior authorization renewal?',
          'Does the patient need any lab work before the refill is approved?',
        ],
        escalationFlags: [
          'Refill request is for a controlled substance that requires an office visit first',
          'Pharmacy is reporting the refill was not received',
          'Refill Requests section is not appearing in the Smart Inbox',
        ],
      },
    ],
  },
  {
    category: 'Premium Add-On Features',
    description: 'Sales-oriented intents for explaining, comparing, and upselling premium add-on modules.',
    intents: [
      {
        intentName: 'addon_ai_copilot_inquiry',
        examplePhrases: [
          'What is the AI Clinical Copilot?',
          'Tell me about the AI assistant',
          'What does the clinical copilot do?',
          'How does AI help with coding?',
        ],
        primaryResponse: 'The AI Clinical Copilot is an always-on intelligent assistant embedded in your patient chart and note workflow. It reads the full patient context and provides real-time ICD-10, CPT, and HCC code suggestions, automatic MDM level calculation, preventive care gap alerts, medication safety checks, and AI-generated plan suggestions. Providers report saving 45-75 minutes per day with an average of $80-$120 additional revenue per encounter from HCC coding alone.',
        followUpQuestions: [
          'Would you like to see how the copilot works during a typical visit?',
          'Are you interested in the coding assistance or the clinical decision support?',
          'How many providers would be using this add-on?',
        ],
        escalationFlags: [
          'User is asking about pricing (route to account manager)',
          'User wants a live demo (schedule demo appointment)',
          'User is comparing to a competitor product',
        ],
      },
      {
        intentName: 'addon_ambient_scribe_inquiry',
        examplePhrases: [
          'Tell me about ambient transcription',
          'How does voice documentation work?',
          'What is the ambient AI scribe add-on?',
          'Can AI write my notes for me?',
        ],
        primaryResponse: 'Advanced Voice Transcription brings ambient, hands-free documentation to every visit. The system listens to your patient conversation and automatically structures a complete clinical note in your preferred template. It supports 40+ specialty templates, speaker differentiation, live transcript editing, and batch processing. Practices report saving 90+ minutes of documentation time per provider per day. Audio is never stored -- only the transcript is retained.',
        followUpQuestions: [
          'What specialty templates would your practice need?',
          'Do you currently use any dictation or transcription service?',
          'Would you use this for in-person visits, telehealth, or both?',
        ],
        escalationFlags: [
          'User is asking about HIPAA compliance for audio (route to compliance info)',
          'User wants to compare with Dragon or Nuance products',
          'User needs pricing for multiple providers',
        ],
      },
      {
        intentName: 'addon_rcm_automation_inquiry',
        examplePhrases: [
          'What is revenue cycle automation?',
          'How does automated billing work?',
          'Tell me about the RCM add-on',
          'Can CareMetric automate my billing?',
        ],
        primaryResponse: 'Full Revenue Cycle Automation transforms billing into a streamlined pipeline. From automated charge capture from signed notes, to pre-submission claim scrubbing with 500+ rules, batch submission, ERA auto-posting, secondary claim generation, and automated patient collections -- every step is handled. Practices report 8-15% revenue improvement within 90 days, with first-pass acceptance rates averaging 94%+.',
        followUpQuestions: [
          'What billing challenges are you currently facing?',
          'Are you using a clearinghouse today? Which one?',
          'How many claims does your practice submit per month?',
        ],
        escalationFlags: [
          'User mentions they are losing significant revenue to denials',
          'User wants to transition from an external billing service',
          'User needs a custom implementation plan',
        ],
      },
      {
        intentName: 'addon_ccm_rpm_inquiry',
        examplePhrases: [
          'What is Chronic Care Management?',
          'Tell me about Remote Patient Monitoring',
          'CCM and RPM revenue opportunity',
          'How do I bill for care coordination?',
        ],
        primaryResponse: 'The CCM module is a complete, Medicare-compliant Chronic Care Management program. It identifies eligible patients (2+ chronic conditions), provides care plan templates, tracks care management time automatically, and generates billing claims when thresholds are met. RPM enables remote vital sign monitoring with automated billing. Together, a panel of 200 CCM patients and 100 RPM patients can generate $24,000-$46,000 per month in additional revenue.',
        followUpQuestions: [
          'How many Medicare patients does your practice currently have?',
          'Are you already doing any care coordination that is not being billed?',
          'Do you have care managers or nurses who could manage the CCM program?',
        ],
        escalationFlags: [
          'User mentions they have a large Medicare Advantage population (high-value lead)',
          'User is asking about device procurement for RPM',
          'User wants a revenue projection based on their patient panel',
        ],
      },
      {
        intentName: 'addon_denial_management_inquiry',
        examplePhrases: [
          'Tell me about denial management',
          'How does AI help with appeals?',
          'What is the denial management add-on?',
          'Help me recover denied claims',
        ],
        primaryResponse: 'The Denial Management module automatically categorizes every denial by reason code and root cause, then drafts customized AI appeal letters using clinical documentation from the chart. It includes denial trend analytics to fix systemic issues, timely filing deadline tracking, and 200+ payer-specific appeal templates. Practices recover 30-40% more denied claims and report $40,000-$150,000 in additional annual collections.',
        followUpQuestions: [
          'What is your current denial rate?',
          'Are most denials related to documentation, eligibility, or authorization?',
          'How many staff hours per week are spent on denial management?',
        ],
        escalationFlags: [
          'User reports denial rate above 10% (urgent revenue leakage)',
          'User mentions they have a backlog of unworked denials',
          'User wants a cost analysis of current denial losses',
        ],
      },
      {
        intentName: 'addon_compliance_inquiry',
        examplePhrases: [
          'What does compliance tracking include?',
          'HIPAA compliance monitoring',
          'MIPS and MACRA tracking',
          'How do I prepare for an audit?',
        ],
        primaryResponse: 'The Compliance & Regulatory Tracking module provides a unified command center for HIPAA, OSHA, MIPS/MACRA, OIG exclusion screening, information blocking rules, and state-specific requirements. It automates monitoring, generates audit-ready reports, and maintains documentation trails. Strong MIPS performance earns positive payment adjustments up to +9% on Medicare claims. Proactive compliance prevents fines of $100-$50,000 per HIPAA violation.',
        followUpQuestions: [
          'Are you participating in MIPS or any value-based care programs?',
          'Have you had a HIPAA audit or compliance inquiry recently?',
          'How is your practice currently tracking compliance obligations?',
        ],
        escalationFlags: [
          'User mentions an active audit or investigation (route to compliance specialist)',
          'User reports a potential data breach (immediate escalation)',
          'User needs a HIPAA Security Risk Assessment (specialized service)',
        ],
      },
      {
        intentName: 'addon_credentialing_inquiry',
        examplePhrases: [
          'Tell me about credentialing management',
          'How do I track provider credentials?',
          'License expiration tracking',
          'Payer enrollment management',
        ],
        primaryResponse: 'The Credentialing Management module tracks every license, certification, DEA number, malpractice policy, and payer credentialing status with automated expiration alerts at 90, 60, and 30 days. It includes re-credentialing workflow automation, CAQH profile sync, multi-state license tracking, and primary source verification. A single prevented credentialing lapse can save $30,000-$100,000 in lost revenue.',
        followUpQuestions: [
          'How many providers need credentialing tracked?',
          'Do your providers practice across multiple states?',
          'Are you currently managing credentialing with spreadsheets?',
        ],
        escalationFlags: [
          'User reports an active credentialing lapse (urgent)',
          'User has a new provider starting who needs expedited credentialing',
          'User mentions upcoming payer audit requiring credentialing documentation',
        ],
      },
    ],
  },
  {
    category: 'System Configuration & Administration',
    description: 'Practice settings, integrations, feature management, and role configuration.',
    intents: [
      {
        intentName: 'admin_configure_integrations',
        examplePhrases: [
          'How do I set up integrations?',
          'Connect ClaimMD to our practice',
          'Integration settings',
          'Configure Twilio phone number',
        ],
        primaryResponse: 'Go to Practice Admin, then Integrations. Each integration (ClaimMD, Twilio) has its own configuration tile. Click the integration name, enter the required credentials and API keys, and click Test Connection to verify. Save once the connection test passes. Contact support if an integration fails to connect after entering valid credentials.',
        followUpQuestions: [
          'Which integration are you trying to configure?',
          'Do you have the API credentials ready?',
          'Has this integration worked before, or is this the initial setup?',
        ],
        escalationFlags: [
          'Connection test fails with valid credentials',
          'Integration was working but suddenly disconnected',
          'User needs API credentials they do not have (route to vendor support)',
        ],
      },
      {
        intentName: 'admin_manage_roles',
        examplePhrases: [
          'How do I change someone\'s role?',
          'Update user permissions',
          'Remove a team member\'s access',
          'Deactivate a staff account',
        ],
        primaryResponse: 'Go to Practice Admin, then Staff. Click the staff member\'s name, then Edit. Change the Role dropdown to the new role, then Save. To remove access entirely, click Deactivate Account. Deactivated accounts retain all data but the person can no longer log in. Role permissions are configured under Practice Admin, then Staff Roles.',
        followUpQuestions: [
          'What role should this person be changed to?',
          'Should their existing data and notes be preserved?',
          'Is this a permanent deactivation or a temporary access change?',
        ],
        escalationFlags: [
          'Admin is trying to deactivate the only remaining admin account',
          'Role change is not taking effect after saving',
          'User needs a custom role that does not exist in the current configuration',
        ],
      },
      {
        intentName: 'admin_enable_features',
        examplePhrases: [
          'How do I turn on a feature?',
          'Enable telehealth for our practice',
          'Feature is not showing up',
          'Where are feature toggles?',
        ],
        primaryResponse: 'Go to Practice Admin, then Features. Each feature (Telehealth, Patient Portal, Prescriptions, CDS, CCM, RPM, etc.) has a toggle. Enable the features included in your subscription tier. If a feature toggle is greyed out, it may require a premium add-on subscription. Contact your CareMetric AI account manager to add premium modules.',
        followUpQuestions: [
          'Which specific feature are you trying to enable?',
          'What subscription tier is your practice on?',
          'Is the feature toggle greyed out or just not visible?',
        ],
        escalationFlags: [
          'Feature toggle is greyed out and user believes it should be available on their tier',
          'Feature was enabled but is not appearing in the sidebar navigation',
          'User needs to upgrade their subscription to access a premium feature',
        ],
      },
    ],
  },
  {
    category: 'Troubleshooting & Technical Support',
    description: 'Login issues, page errors, performance problems, and general technical support.',
    intents: [
      {
        intentName: 'troubleshoot_login_issue',
        examplePhrases: [
          'I cannot log in',
          'Password is not working',
          'My account is locked',
          'Login error message',
          'Two-factor code not working',
        ],
        primaryResponse: 'Click "Forgot Password" on the login screen to reset your password. If your account is locked (after 5 failed attempts), wait 15 minutes for automatic unlock, or ask your practice admin to unlock it. For two-factor issues, ensure your authenticator app time is synced. If the issue persists, contact support@caremetric.ai with your email address.',
        followUpQuestions: [
          'Are you seeing a specific error message? What does it say?',
          'Have you tried the Forgot Password flow?',
          'Were you able to log in previously, or is this your first login?',
        ],
        escalationFlags: [
          'User has been locked out for more than 24 hours',
          'Forgot Password email is not arriving',
          'Multiple users at the same practice are experiencing login failures (system issue)',
          'Two-factor authentication is failing after app reinstallation',
        ],
      },
      {
        intentName: 'troubleshoot_page_error',
        examplePhrases: [
          'Page is blank or not loading',
          'Something is broken',
          'I see an error on the screen',
          'App is not working',
          'Dashboard shows nothing',
        ],
        primaryResponse: 'Try these steps in order: 1) Hard refresh with Ctrl+Shift+R (or Cmd+Shift+R on Mac). 2) Clear your browser cache and cookies for CareMetric AI. 3) Log out completely and log back in. 4) Try a different browser (Chrome is recommended). If the issue continues, contact support@caremetric.ai with a screenshot of the error.',
        followUpQuestions: [
          'What page or section were you trying to access?',
          'Did this start happening recently or has it always been an issue?',
          'Are other team members experiencing the same problem?',
        ],
        escalationFlags: [
          'Error is affecting multiple users simultaneously (possible system outage)',
          'Error occurs on a critical clinical workflow (prescribing, signing notes)',
          'User has tried all troubleshooting steps without resolution',
          'Error includes a reference number or stack trace',
        ],
      },
      {
        intentName: 'troubleshoot_contact_support',
        examplePhrases: [
          'How do I contact support?',
          'I need help from a person',
          'Submit a support ticket',
          'This is urgent',
          'Escalate my issue',
        ],
        primaryResponse: 'Contact support at support@caremetric.ai or submit a ticket through Settings, then Support, then Submit Ticket. For critical issues affecting patient care or billing, mark your email as URGENT. Our team responds within 1 business day for standard requests and within 4 hours for critical issues during business hours.',
        followUpQuestions: [
          'Can you describe the issue you are experiencing?',
          'Is this affecting patient care or billing operations?',
          'What is the urgency level: low, medium, high, or critical?',
        ],
        escalationFlags: [
          'User explicitly states this is urgent or critical',
          'Issue is blocking patient care delivery',
          'Issue involves potential data loss or security concern',
          'User has submitted multiple tickets for the same unresolved issue',
        ],
      },
    ],
  },
];

export function buildConversationalIntentsSections(_data: ConversationalIntentsData): PdfSection[] {
  const sections: PdfSection[] = [];

  const totalIntents = CONVERSATIONAL_INTENT_CATEGORIES.reduce((s, c) => s + c.intents.length, 0);
  const totalPhrases = CONVERSATIONAL_INTENT_CATEGORIES.reduce((s, c) => s + c.intents.reduce((s2, i) => s2 + i.examplePhrases.length, 0), 0);
  const totalEscalationFlags = CONVERSATIONAL_INTENT_CATEGORIES.reduce((s, c) => s + c.intents.reduce((s2, i) => s2 + i.escalationFlags.length, 0), 0);

  sections.push({ type: 'heading', level: 1, text: 'CareMetric AI — Conversational AI Intent Library' });
  sections.push({
    type: 'paragraph',
    text: 'Structured intent-response pairs designed for real-time conversational support systems. Each entry includes the intent name, example user phrases for training, a primary response, follow-up clarifying questions for multi-turn dialog, and escalation trigger flags for routing to human agents.',
  });
  sections.push({ type: 'spacer' });
  sections.push({
    type: 'keyValue',
    pairs: [
      { label: 'Total Categories', value: String(CONVERSATIONAL_INTENT_CATEGORIES.length) },
      { label: 'Total Intents', value: String(totalIntents) },
      { label: 'Total Example Phrases', value: String(totalPhrases) },
      { label: 'Total Escalation Flags', value: String(totalEscalationFlags) },
    ],
  });
  sections.push({ type: 'divider' });

  for (const category of CONVERSATIONAL_INTENT_CATEGORIES) {
    sections.push({ type: 'heading', level: 2, text: `Category: ${category.category}` });
    sections.push({ type: 'paragraph', text: category.description });
    sections.push({ type: 'spacer' });

    for (const intent of category.intents) {
      sections.push({ type: 'heading', level: 3, text: `Intent: ${intent.intentName}` });

      sections.push({ type: 'paragraph', text: 'Example User Phrases:' });
      sections.push({ type: 'list', items: intent.examplePhrases });

      sections.push({ type: 'paragraph', text: 'Primary Response:' });
      sections.push({ type: 'paragraph', text: intent.primaryResponse, highlight: 'success' });

      sections.push({ type: 'paragraph', text: 'Follow-Up Clarifying Questions:' });
      sections.push({ type: 'list', ordered: true, items: intent.followUpQuestions });

      sections.push({ type: 'paragraph', text: 'Escalation Trigger Flags:' });
      sections.push({ type: 'list', items: intent.escalationFlags.map(f => `[ESCALATE] ${f}`) });

      sections.push({ type: 'spacer' });
    }

    sections.push({ type: 'divider' });
  }

  sections.push({ type: 'heading', level: 2, text: 'Implementation Guidelines' });
  sections.push({
    type: 'list',
    items: [
      'Train on all example phrases plus semantic variations to maximize intent recognition accuracy.',
      'Follow-up questions should be presented when confidence score is below 0.85 or when the intent requires disambiguation.',
      'Escalation flags should immediately route the conversation to a human agent with full context preserved.',
      'Maintain conversation context across turns — if a user asks about billing then says "that is not working," the context should carry forward.',
      'Fallback intent for unrecognized queries should offer to connect the user with support@caremetric.ai.',
      'Track intent match rates and user satisfaction scores to continuously improve response quality.',
      'Update intents whenever new features are released or existing workflows change.',
      'For add-on feature inquiries, track conversion rates from inquiry to demo request to purchase.',
    ],
  });

  sections.push({ type: 'heading', level: 2, text: 'Escalation Matrix' });
  sections.push({
    type: 'table',
    headers: ['Escalation Level', 'Trigger Condition', 'Response Time', 'Routing'],
    rows: [
      ['P1 - Critical', 'Patient care blocked, data loss, security breach', 'Immediate', 'On-call engineering + support lead'],
      ['P2 - High', 'Billing blocked, multiple users affected, integration down', '< 4 hours', 'Senior support agent'],
      ['P3 - Medium', 'Feature not working for single user, workflow disruption', '< 1 business day', 'Support queue'],
      ['P4 - Low', 'General question, feature request, minor UI issue', '< 2 business days', 'Standard support queue'],
    ],
  });

  return sections;
}
