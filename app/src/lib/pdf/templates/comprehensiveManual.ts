import type { PdfSection } from '../types';

export interface ComprehensiveManualData {
  includeMarketing?: boolean;
}

export function buildComprehensiveManualSections(_data?: ComprehensiveManualData): PdfSection[] {
  const sections: PdfSection[] = [];

  const h1 = (text: string): PdfSection => ({ type: 'heading', level: 1, text });
  const h2 = (text: string): PdfSection => ({ type: 'heading', level: 2, text });
  const p = (text: string): PdfSection => ({ type: 'paragraph', text });
  const li = (items: string[]): PdfSection => ({ type: 'list', ordered: false, items });
  const oli = (items: string[]): PdfSection => ({ type: 'list', ordered: true, items });
  const div = (): PdfSection => ({ type: 'divider' });
  const sp = (): PdfSection => ({ type: 'spacer', height: 8 });
  const kv = (key: string, value: string): PdfSection => ({ type: 'keyValue', pairs: [{ label: key, value }] });

  sections.push(
    h1('CareMetric AI — Complete EMR User Guide'),
    kv('Version', '2.0'),
    kv('Audience', 'Providers, Clinical Staff, Billers, Administrators'),
    kv('Support', 'support@caremetric.ai'),
    sp(),
    p('This guide covers every module in CareMetric AI. Use the section headers to navigate to the feature you need. Each module includes plain-language instructions, AI behavior notes, best practices, and troubleshooting.'),
    div(),
  );

  // ─────────────────────────── DASHBOARD ───────────────────────────
  sections.push(
    h1('MODULE 1 — Dashboard'),
    h2('Overview'),
    p('The Dashboard is the command center you see immediately after logging in. It surfaces your most urgent tasks, today\'s schedule, unread messages, pending billing alerts, and AI-driven clinical nudges in a single glance. Every role sees a personalized view based on their permissions.'),
    p('Who uses it: All users. Physicians see pending note signatures and clinical alerts. Billers see denial counts and unbilled visits. Front desk staff see appointment confirmations needed. Admins see workforce and compliance metrics.'),
    h2('When To Use'),
    li([
      'At the start of every shift to triage your task list',
      'Between patients to quickly check new messages or lab results',
      'End of day to verify all notes are signed and claims are queued',
    ]),
    h2('Step-By-Step'),
    oli([
      'Log in — you land on the Dashboard automatically.',
      'Review the Today\'s Schedule card to see upcoming appointments and confirm patient check-in status.',
      'Check the Task Counter badge at the top — click it to open the full task list.',
      'Read AI Nudges in the Clinical Alerts panel; these are preventive care and chronic disease management reminders.',
      'Click any metric card to drill down into the underlying data.',
      'Use the Quick Actions bar to create a new patient, start a visit, or send a message without leaving the Dashboard.',
    ]),
    h2('AI Automation Behavior'),
    p('The AI scans your patient panel each morning and surfaces: overdue preventive screenings, patients with HbA1c not checked in 90+ days, medication refill requests, and unsigned notes older than 24 hours. These appear as color-coded nudge cards — red for critical, yellow for attention, blue for informational.'),
    h2('Best Practices'),
    li([
      'Clear your task queue daily — unresolved tasks accumulate and become compliance risks.',
      'Pin your most-used views using the star icon so they appear in your Quick Access bar.',
      'Use the Dashboard\'s built-in keyboard shortcut (press N) to start a new visit instantly.',
    ]),
    h2('Common Errors & Troubleshooting'),
    li([
      'Dashboard shows blank panels: Your organization ID may not be fully provisioned. Log out and log back in. If the issue persists, contact support.',
      'Task count shows 0 but you know tasks exist: Check that your role has task-viewing permissions under Practice Admin → Staff Roles.',
      'AI nudges are not appearing: Ensure CDS (Clinical Decision Support) is enabled under Practice Admin → Features.',
    ]),
    h2('FAQ'),
    li([
      'Q: Can I customize my Dashboard layout? A: Yes — use the gear icon at the top right of each panel to pin, minimize, or rearrange cards.',
      'Q: Why do I see other providers\' tasks? A: You are likely set as a team lead or supervisor. Adjust your view filter to "My Tasks Only."',
      'Q: Can I set the Dashboard as a secondary display for a front desk monitor? A: Yes — open it in a separate browser tab and it will refresh automatically.',
    ]),
    h2('Marketing Summary'),
    p('CareMetric AI\'s intelligent Dashboard replaces the morning paper stack with a real-time, AI-curated command center. Providers start every day knowing exactly what needs attention — no hunting through tabs, no missed tasks, no surprise denials.'),
    div(),
  );

  // ─────────────────────────── PATIENT CHART ───────────────────────────
  sections.push(
    h1('MODULE 2 — Patient Chart'),
    h2('Overview'),
    p('The Patient Chart is the longitudinal clinical record for every patient. It is organized into tabbed sections: Overview, Vitals, Medications, Problem List, Lab Results, Documents, Orders, Billing, and more. The AI continuously analyzes chart data to surface insights, flag drug interactions, and suggest coding improvements.'),
    h2('When To Use'),
    li([
      'Before every visit to review patient history',
      'During a visit to document findings in real time',
      'After a visit to finalize the note, submit orders, and queue claims',
      'During care management calls to review chronic conditions',
    ]),
    h2('Step-By-Step'),
    oli([
      'Navigate to Patients → search by name, DOB, or MRN.',
      'Click the patient row to open their chart.',
      'Use the tab bar at the top to jump between Chart sections.',
      'In the Overview tab, review the Summary Panel showing active problems, current medications, allergies, and recent vitals.',
      'Click the pencil icon on any section to enter inline edit mode.',
      'To add a new problem, go to the Problem List tab → click Add Problem → search by ICD-10 code or plain text.',
      'To reconcile medications, go to Medications → click Reconcile → confirm or update each medication.',
      'Press Ctrl+S (or Cmd+S on Mac) to save changes immediately.',
    ]),
    h2('AI Automation Behavior'),
    p('The AI runs continuously on chart load and flags: potential drug-drug interactions (highlighted in red), missing preventive screenings, HCC risk codes that appear in notes but are not on the Problem List, and SDOH risk factors mentioned in previous notes. These appear as inline banners or sidebar cards.'),
    h2('Best Practices'),
    li([
      'Always resolve AI alerts before signing a note — unresolved alerts are logged and can be audited.',
      'Use the Quick View panel (press Q with a patient selected) for a 30-second summary without opening the full chart.',
      'Scan the HCC Risk panel before every preventive visit — capturing these codes improves your risk adjustment revenue.',
    ]),
    h2('Common Errors & Troubleshooting'),
    li([
      'Chart won\'t load — patient may belong to a different organization. Verify the patient\'s organization_id.',
      'Medications not showing — ensure the patient has an active prescription or imported medication reconciliation.',
      'Labs tab is empty — lab results must be imported via HL7 interface or manually entered under Lab Results → Add Result.',
    ]),
    h2('FAQ'),
    li([
      'Q: Can multiple users edit the chart at the same time? A: Yes. The system uses optimistic locking — the last save wins but you will be warned if a conflict is detected.',
      'Q: How do I print the patient chart? A: Chart tab → Print Chart button → select sections → Generate PDF.',
      'Q: How do I merge duplicate patients? A: Practice Admin → Duplicate Patient Detection → select both records → Merge.',
    ]),
    h2('Marketing Summary'),
    p('The CareMetric AI Patient Chart puts an AI-powered clinical intelligence layer on top of your patient data — surfacing what matters most so providers spend less time searching and more time caring.'),
    div(),
  );

  // ─────────────────────────── AI NOTE GENERATION ───────────────────────────
  sections.push(
    h1('MODULE 3 — AI Note Generation & Ambient Scribe'),
    h2('Overview'),
    p('CareMetric AI offers three note creation modes: Traditional (manual SOAP entry), Guided (structured template with AI suggestions), and Ambient (AI listens to the conversation and drafts the note automatically). All modes support AI-assisted coding suggestions, MDM calculation, and documentation quality scoring.'),
    h2('When To Use'),
    li([
      'Traditional mode: Complex psychiatric or surgical notes requiring precise manual control',
      'Guided mode: Standard outpatient visits (primary care, follow-up, preventive)',
      'Ambient mode: High-volume practices where documentation speed is critical',
    ]),
    h2('Step-By-Step — Guided Note'),
    oli([
      'Open a visit from the Schedule or Patient Chart → click Start Visit.',
      'Select a note template from the template picker (e.g., Primary Care Follow-Up, Diabetes Management).',
      'The template pre-populates with the patient\'s relevant history.',
      'Enter the Chief Complaint — the AI immediately begins suggesting Objective findings based on the chief complaint + history.',
      'Review and edit the Subjective section.',
      'Use the Inline CDS panel on the right to see evidence-based recommendations related to your findings.',
      'In the Assessment section, type a diagnosis — the AI suggests the most specific ICD-10 code.',
      'Review the MDM Widget which calculates your complexity level (straightforward, low, moderate, or high) in real time.',
      'In the Plan section, use Smart Phrases (type a period ".") to insert pre-written text blocks.',
      'Click Close & Sign to finalize, route for co-signature if required, or save as a draft.',
    ]),
    h2('Step-By-Step — Ambient Scribe'),
    oli([
      'Open a visit → click the Ambient Scribe button (microphone icon).',
      'Grant browser microphone permission on first use.',
      'Begin your patient conversation — the AI listens and transcribes in real time.',
      'The transcription appears in the Transcript panel. You can correct it live.',
      'When the visit ends, click Generate Note.',
      'The AI produces a structured SOAP note from the transcript.',
      'Review every section carefully — edit any inaccuracies.',
      'Run the Documentation Quality Check to ensure the note meets billing requirements.',
      'Sign the note.',
    ]),
    h2('AI Automation Behavior'),
    p('The AI automatically: selects the most likely diagnosis codes from the transcript, calculates E&M level based on MDM, flags missing elements required for billing, suggests preventive orders when chronic conditions are discussed, and identifies HCC risk codes mentioned in conversation but not yet coded. IMPORTANT: The AI is an assistant, not a decision-maker. All AI-generated content must be reviewed and approved by the provider before signing.'),
    h2('Best Practices'),
    li([
      'Always run the Documentation Quality Check before signing — it catches coding errors that could cause claim denial.',
      'Use Smart Phrases for frequently used text (e.g., normal exam findings) to save 3-5 minutes per note.',
      'For ambient scribe, speak clearly and say the patient\'s name and diagnosis out loud — this helps the AI organize the note structure.',
      'Review the MDM Widget — billing at the correct level is both compliance-critical and revenue-critical.',
    ]),
    h2('Common Errors & Troubleshooting'),
    li([
      'Ambient scribe not recording: Check browser microphone permissions in browser settings → Site Permissions.',
      'AI suggestions not appearing: CDS must be enabled and the AI API key must be configured under Super Admin → Platform Settings.',
      'Note auto-saves but then disappears: This was a known bug (now fixed). The autosave no longer re-creates a note after deletion.',
      'MDM level shows "Unknown": All three MDM elements (problems, data, risk) must have at least one entry.',
    ]),
    h2('FAQ'),
    li([
      'Q: Can I use ambient scribe for telehealth? A: Yes — ambient scribe works during Twilio video sessions.',
      'Q: Does the AI store my audio? A: Audio is processed in real time and not stored. Only the transcription text is retained.',
      'Q: Can I use my own templates? A: Yes — go to Templates → Create Template or import from your previous system.',
      'Q: What if the AI codes incorrectly? A: Always review AI suggestions. You have full authority to change any code before signing.',
    ]),
    h2('Marketing Summary'),
    p('CareMetric AI\'s Ambient Scribe listens to your patient conversations and writes the note for you — so you can focus on the patient, not the keyboard. Providers using ambient documentation report saving 90+ minutes per day.'),
    div(),
  );

  // ─────────────────────────── SCHEDULING ───────────────────────────
  sections.push(
    h1('MODULE 4 — Scheduling & Calendar'),
    h2('Overview'),
    p('The Scheduling module provides a full-featured calendar for booking, rescheduling, and managing appointments. It supports multiple providers, multiple locations, online self-scheduling, automated reminders via SMS/email, waitlist management, and telehealth booking.'),
    h2('When To Use'),
    li([
      'Daily — to manage the appointment book for one or more providers',
      'For new patient onboarding — book the first appointment and send the intake form automatically',
      'For telehealth visits — schedule and generate the video link in one step',
      'For follow-up scheduling at checkout',
    ]),
    h2('Step-By-Step'),
    oli([
      'Go to the Schedule view from the left sidebar.',
      'Use the calendar navigation (day/week/month) to find the target date.',
      'Click an open time slot on the provider\'s calendar.',
      'In the New Appointment dialog: select patient (search by name or MRN), select visit type, enter duration, add notes.',
      'Toggle "Send Reminder" to automatically send an SMS and email reminder 24 hours before the appointment.',
      'For telehealth, toggle "Telehealth Visit" — a Twilio video room is created automatically.',
      'Click Save Appointment.',
      'The patient receives an automated confirmation message with visit details and intake form link.',
    ]),
    h2('AI Automation Behavior'),
    p('Scheduling Intelligence analyzes your calendar and suggests optimal appointment slots based on visit type duration, provider preferences, and historical no-show patterns. The AI also flags patients who have not been seen in 12+ months and prompts scheduling outreach.'),
    h2('Best Practices'),
    li([
      'Set up your provider availability templates once — this prevents double-booking and makes the calendar predictable.',
      'Use the Waitlist feature for popular appointment types — patients are auto-notified when a slot opens.',
      'Block time for documentation, lunch, and admin tasks to protect provider well-being.',
      'Always select the correct visit type — this determines billing code defaults and appointment duration.',
    ]),
    h2('Common Errors & Troubleshooting'),
    li([
      'Cannot book appointment — provider availability not configured. Go to Practice Admin → Scheduling → Provider Availability.',
      'Reminder SMS not sending — check that the patient has SMS consent on file and your Twilio SMS number is configured.',
      'Telehealth link missing — ensure the Twilio Video integration is enabled under Practice Admin → Integrations.',
    ]),
    h2('FAQ'),
    li([
      'Q: Can patients book their own appointments online? A: Yes — enable Patient Self-Scheduling under Practice Admin → Patient Portal.',
      'Q: Can I book a recurring appointment series? A: Yes — when creating an appointment, select "Repeat" and set the frequency and end date.',
      'Q: How do I handle last-minute cancellations? A: The Waitlist Auto-Match feature will automatically notify the next waitlisted patient.',
    ]),
    h2('Marketing Summary'),
    p('CareMetric AI\'s smart scheduling eliminates the phone tag and double-booking headaches of traditional systems. Patients book online 24/7, reminders go out automatically, and the AI keeps your calendar full with intelligent waitlist matching.'),
    div(),
  );

  // ─────────────────────────── BILLING ───────────────────────────
  sections.push(
    h1('MODULE 5 — Billing & Claims Submission'),
    h2('Overview'),
    p('The Billing module covers the full revenue cycle: charge capture, claim scrubbing, electronic submission via ClaimMD clearinghouse, ERA/EOB posting, denial management, and patient collections. The AI automates claim validation, flags probable denials before submission, and suggests corrective actions for rejected claims.'),
    h2('When To Use'),
    li([
      'After every signed visit note — charges are automatically captured',
      'Daily — review and submit pending claims',
      'Weekly — work the denial queue and post payments',
      'Monthly — run revenue cycle reports to identify collection trends',
    ]),
    h2('Step-By-Step — Submitting a Claim'),
    oli([
      'Go to Billing → Billing Pipeline.',
      'Claims auto-populate from signed visit notes. Review the queue.',
      'Click on a claim to open the Claim Detail view.',
      'Review the AI-suggested CPT codes and confirm they match the documented service.',
      'Run the Claim Scrubber by clicking "Scrub Claim" — the AI checks for NCCI edits, LCD/NCD compliance, and payer-specific rules.',
      'Review any scrubber alerts and correct errors.',
      'Click Submit Claim to send to ClaimMD clearinghouse.',
      'The claim status updates to "Submitted." Monitor for acceptance/rejection in the ERA Queue.',
    ]),
    h2('Step-By-Step — Working Denials'),
    oli([
      'Go to Billing → Denial Management.',
      'Filter by denial reason code.',
      'Click a denied claim to open the Denial Detail.',
      'Review the AI-generated appeal letter draft.',
      'Edit the letter to add patient-specific clinical justification.',
      'Attach supporting documentation (e.g., medical necessity letter, office notes).',
      'Click Submit Appeal.',
      'Track appeal status in the Appeals column.',
    ]),
    h2('AI Automation Behavior'),
    p('Billing AI: automatically assigns CPT codes based on note content and MDM level, runs claim scrubbing before submission, generates appeal letter drafts using payer-specific templates, identifies underpayments by comparing contracted rates to actual payments, and surfaces denial pattern analysis so you can fix systemic issues.'),
    h2('Best Practices'),
    li([
      'Never submit a claim with scrubber errors still open — fix them first to maximize first-pass acceptance rate.',
      'Use the Batch Billing processor to submit multiple claims at once on a set schedule.',
      'Set up ERA auto-posting so electronic remittance is applied to patient balances automatically.',
      'Run the Denial Analytics report weekly to identify your top denial reasons and address them proactively.',
    ]),
    h2('Common Errors & Troubleshooting'),
    li([
      'Claim rejected with "Missing NPI": Verify the rendering provider\'s NPI is entered in their profile under Practice Admin → Providers.',
      'ERA not auto-posting: Ensure your ClaimMD account is configured and the ERA file format is set to 835 in the integration settings.',
      'Claim stuck in "Pending" status: Check ClaimMD dashboard for transmission errors. Re-submit if needed.',
    ]),
    h2('FAQ'),
    li([
      'Q: What clearinghouses does CareMetric AI support? A: ClaimMD is the primary clearinghouse. Office Ally is also supported via SFTP.',
      'Q: How does the AI know which CPT code to suggest? A: It analyzes the note\'s MDM level, chief complaint, and documented procedures.',
      'Q: Can I bill multiple payers for a single visit? A: Yes — primary and secondary payer fields are available on every claim.',
      'Q: How long does ERA auto-posting take? A: ERA files are processed within minutes of receipt from the clearinghouse.',
    ]),
    h2('Marketing Summary'),
    p('CareMetric AI\'s intelligent billing engine scrubs every claim before submission, auto-posts ERAs, and writes your appeal letters — so your biller spends time on complex cases, not data entry. Practices report a 30-40% reduction in claim rework.'),
    div(),
  );

  // ─────────────────────────── PRESCRIPTIONS ───────────────────────────
  sections.push(
    h1('MODULE 6 — Prescriptions & Medications'),
    h2('Overview'),
    p('The prescriptions module allows providers to send prescriptions directly to the patient\'s preferred pharmacy, check PDMP data, review drug-drug and drug-allergy interactions, and manage medication refill requests from patients.'),
    h2('When To Use'),
    li([
      'At the end of a visit to prescribe new or updated medications',
      'For refill requests that come in from the patient portal or pharmacy',
      'For DEA Schedule II-V controlled substances (requires two-factor authentication)',
    ]),
    h2('Step-By-Step'),
    oli([
      'From a visit note or patient chart, click the Prescribe button (or navigate to Medications → New Prescription).',
      'Search for the medication by generic or brand name.',
      'Select the medication and review AI-generated interaction alerts.',
      'Check the PDMP report for controlled substances — this is required by most states.',
      'Set the dosage, instructions, quantity, and refills.',
      'Select the patient\'s preferred pharmacy or search for one.',
      'For controlled substances, complete the two-factor authentication step.',
      'Click Send Prescription.',
    ]),
    h2('AI Automation Behavior'),
    p('The prescribing AI: flags drug-drug interactions based on the patient\'s full medication list, warns of drug-allergy conflicts, suggests dosage adjustments for renal or hepatic impairment based on documented diagnoses, and checks formulary coverage for the patient\'s insurance plan.'),
    h2('Best Practices'),
    li([
      'Always check the PDMP before prescribing opioids, benzodiazepines, or stimulants.',
      'Review the formulary check — prescribing a non-covered drug leads to patient calls and delays.',
      'Use the "Prescribe at Next Visit" option for medications that need monitoring before refill authorization.',
    ]),
    h2('Common Errors & Troubleshooting'),
    li([
      'Prescription not transmitting: Verify the patient\'s preferred pharmacy is set and has a valid NCPDP number.',
      'PDMP check failing: PDMP integration credentials may have expired. Contact your state PDMP administrator.',
      'Two-factor not completing for controlled substances: Ensure your DEA credentials are current and your identity proofing is complete.',
    ]),
    h2('FAQ'),
    li([
      'Q: Can I prescribe to any pharmacy in the US? A: Yes — CareMetric AI connects to SureScripts network covering 99%+ of US pharmacies.',
      'Q: What if the patient doesn\'t have a preferred pharmacy set? A: Search and select a pharmacy during prescribing. It will be saved as their default.',
      'Q: Can nurses submit a prescription on behalf of a provider? A: Nurses can prepare a prescription for provider review but cannot sign and transmit it.',
    ]),
    h2('Marketing Summary'),
    p('Send prescriptions directly to the pharmacy in seconds, with automatic interaction checking and PDMP integration. CareMetric AI\'s prescription management keeps your practice compliant and your patients safe.'),
    div(),
  );

  // ─────────────────────────── TELEHEALTH ───────────────────────────
  sections.push(
    h1('MODULE 7 — Telehealth'),
    h2('Overview'),
    p('CareMetric AI\'s telehealth module is powered by Twilio Video. It provides browser-based HD video visits that integrate directly with scheduling, note documentation, and billing. No app download is required for patients. The ambient scribe works during telehealth visits to document the encounter in real time.'),
    h2('When To Use'),
    li([
      'For established patients requesting follow-up without in-person visit',
      'For behavioral health sessions',
      'For medication management visits',
      'For rural or mobility-limited patients',
      'For post-discharge follow-up calls',
    ]),
    h2('Step-By-Step'),
    oli([
      'When scheduling, toggle "Telehealth Visit" — a unique room link is generated automatically.',
      'The patient receives their video link via SMS and email with one-click join instructions.',
      'At visit time, go to Schedule → click the appointment → click Start Telehealth Visit.',
      'The Twilio video session opens in a new panel within the EMR.',
      'Optionally, launch the Ambient Scribe to document the visit in real time.',
      'Use the Chart Panel alongside the video to review and update clinical data during the call.',
      'When finished, click End Visit and proceed to sign the note and submit billing.',
    ]),
    h2('AI Automation Behavior'),
    p('During a telehealth visit, the AI can: run the ambient scribe to document in real time, surface the patient\'s recent labs and vitals in the Chart Panel, display CDS nudges based on the reason for visit, and after the visit, automatically suggest the appropriate telehealth-specific CPT/HCPCS code.'),
    h2('Best Practices'),
    li([
      'Always verify the patient\'s location at the start of the call — telehealth prescribing rules vary by state.',
      'Obtain and document verbal telehealth consent at the start of the session.',
      'Test your camera and microphone 5 minutes before the first visit of the day.',
      'Use the Chart Panel during the call rather than switching browser tabs — this keeps you in context.',
    ]),
    h2('Common Errors & Troubleshooting'),
    li([
      'Patient cannot join: Send them the video link again from the appointment detail. Confirm they are using Chrome, Edge, or Safari (not Firefox mobile).',
      'Poor video quality: Recommend the patient move closer to their WiFi router and close other applications.',
      'Billing code not auto-populating for telehealth: Ensure the visit type is marked as "Telehealth" in the appointment record.',
    ]),
    h2('FAQ'),
    li([
      'Q: Is the video HIPAA-compliant? A: Yes — Twilio Video uses end-to-end encryption and CareMetric AI has a BAA with Twilio.',
      'Q: What devices can patients use? A: Any device with a modern browser and a camera/microphone — smartphone, tablet, or computer.',
      'Q: Can I record a telehealth session? A: Recording requires explicit patient consent and is subject to your state\'s regulations.',
    ]),
    h2('Marketing Summary'),
    p('CareMetric AI\'s integrated telehealth eliminates the separate video platform — schedule, see, document, and bill telehealth visits all in one place with zero patient app downloads required.'),
    div(),
  );

  // ─────────────────────────── PATIENT PORTAL ───────────────────────────
  sections.push(
    h1('MODULE 8 — Patient Portal'),
    h2('Overview'),
    p('The Patient Portal gives patients secure online access to their health records, messaging, appointment requests, bill pay, lab results, and intake forms. It is fully integrated — data entered by patients in the portal flows directly into the chart. The portal supports family proxy access for caregivers.'),
    h2('When To Use'),
    li([
      'Send portal invitations after registering a new patient',
      'Use portal messaging to replace phone tag for non-urgent clinical questions',
      'Distribute pre-visit intake forms through the portal',
      'Share lab results and visit summaries',
      'Collect patient payments online',
    ]),
    h2('Step-By-Step — Inviting a Patient'),
    oli([
      'Open the patient chart → click Invite to Portal.',
      'Verify the patient\'s email address is correct.',
      'Click Send Invitation — the patient receives an email with a secure signup link.',
      'Once activated, the portal appears in the patient\'s My Health account.',
    ]),
    h2('AI Automation Behavior'),
    p('The portal AI: generates plain-language summaries of visit notes for patient-facing After Visit Summaries (AVS), translates medical jargon to lay language in the patient education library, and triages incoming patient messages by urgency, routing critical messages to the provider\'s inbox immediately.'),
    h2('Best Practices'),
    li([
      'Respond to portal messages within 1 business day — this is an emerging standard of care and impacts patient satisfaction scores.',
      'Use the portal for lab result delivery with an explanatory message rather than a phone call.',
      'Enable the pre-visit intake form — it saves 10-15 minutes of check-in time and populates directly into the chart.',
    ]),
    h2('Common Errors & Troubleshooting'),
    li([
      'Invitation email not received: Check the patient\'s spam folder. Resend from Patient Chart → Portal Invite.',
      'Patient says their link expired: Portal invitations expire after 7 days. Resend a new invitation.',
      'Patient cannot see their labs: Ensure the lab results are marked "Release to Portal" in the Lab Results tab.',
    ]),
    h2('FAQ'),
    li([
      'Q: Can a parent access their child\'s portal? A: Yes — enable proxy/caregiver access under the patient\'s chart → Portal Access → Add Proxy.',
      'Q: Is portal messaging billable? A: Certain portal messages meeting the time and complexity threshold may be billed under CPT 99421-99423.',
      'Q: Can patients upload documents through the portal? A: Yes — patients can upload insurance cards, referrals, and records from their portal.',
    ]),
    h2('Marketing Summary'),
    p('CareMetric AI\'s Patient Portal gives patients a genuine healthcare experience — lab results with explanations, online bill pay, and direct messaging with their care team. Practices see a dramatic reduction in phone volume and improved CAHPS scores.'),
    div(),
  );

  // ─────────────────────────── MESSAGING & TASKS ───────────────────────────
  sections.push(
    h1('MODULE 9 — Messaging & Tasks'),
    h2('Overview'),
    p('The Messaging & Tasks module includes internal staff messaging, patient portal inbox, SMS two-way messaging, care team group messaging, and a structured task management system. AI triage automatically prioritizes incoming messages by clinical urgency.'),
    h2('Step-By-Step — Creating a Task'),
    oli([
      'Click the Tasks icon in the left sidebar, or press T.',
      'Click New Task.',
      'Set the task type (clinical, administrative, billing, etc.), assign it to a staff member, set due date and priority.',
      'Link it to a patient if relevant.',
      'Click Save. The assigned staff member receives a notification.',
    ]),
    h2('Step-By-Step — Sending an SMS to a Patient'),
    oli([
      'Open the patient chart.',
      'Click Messages → New SMS.',
      'Select a template or type a custom message.',
      'Confirm the patient has SMS consent on file (required).',
      'Click Send.',
    ]),
    h2('AI Automation Behavior'),
    p('The Smart Inbox AI: categorizes incoming messages as clinical, administrative, billing, or urgent, drafts suggested responses to common questions, escalates messages containing clinical keywords (chest pain, suicidal ideation, severe pain) to the top of the provider\'s queue, and summarizes message threads so you can understand context in seconds.'),
    h2('Best Practices'),
    li([
      'Use the AI-drafted responses as a starting point and personalize them — they save 30+ seconds per message.',
      'Create task templates for common workflows (e.g., new referral received, prior auth request) to ensure consistency.',
      'Review your message inbox at least twice per shift day.',
    ]),
    h2('Common Errors & Troubleshooting'),
    li([
      'SMS not delivering: Patient may have opted out. Check consent status on the patient chart.',
      'Tasks not showing in my queue: Confirm the task is assigned to your user account and not a group.',
    ]),
    h2('FAQ'),
    li([
      'Q: Can I set up automated SMS appointment reminders? A: Yes — configure them under Practice Admin → Scheduling → Notification Rules.',
      'Q: Is there a character limit for SMS? A: Standard SMS is 160 characters per segment. Longer messages are delivered as multi-part SMS.',
    ]),
    h2('Marketing Summary'),
    p('CareMetric AI unifies staff messaging, patient SMS, and task management in one inbox — with AI triage that surfaces critical messages instantly so nothing falls through the cracks.'),
    div(),
  );

  // ─────────────────────────── REPORTING & ANALYTICS ───────────────────────────
  sections.push(
    h1('MODULE 10 — Reporting & Analytics'),
    h2('Overview'),
    p('The Reporting & Analytics module provides real-time and historical data across clinical quality, financial performance, staff productivity, patient outcomes, and population health. Dashboards are role-specific and configurable. AI-powered predictive analytics forecast revenue, no-show rates, and chronic disease deterioration.'),
    h2('When To Use'),
    li([
      'Monthly business review to assess revenue trends',
      'Quarterly quality reporting for value-based contracts',
      'Daily operations monitoring for front desk and admin',
      'Pre-audit review to ensure documentation completeness',
    ]),
    h2('Key Reports'),
    li([
      'Financial Aging Report: Outstanding balances by payer and age bucket',
      'Denial Analysis Report: Denial reasons, rates, and financial impact',
      'Provider Productivity Report: Visits, charges, collections, and wRVUs per provider',
      'Clinical Quality Measures (HEDIS/MIPS): Measure performance and gaps',
      'Population Health Dashboard: Chronic disease registry with care gap analysis',
      'Appointment Analytics: No-show rates, cancellation trends, fill rates',
    ]),
    h2('AI Automation Behavior'),
    p('The analytics AI generates narrative summaries of key metrics each week, highlights anomalies (e.g., sudden drop in collections, spike in no-shows), and provides root cause attribution where possible. Predictive models forecast revenue 90 days out based on scheduled appointments and historical collection rates.'),
    h2('Best Practices'),
    li([
      'Export key reports monthly to an external drive for longitudinal benchmarking.',
      'Share the Provider Productivity report in monthly team meetings to identify coaching opportunities.',
      'Set up automated report delivery via email under Reports → Schedule Report.',
    ]),
    h2('Common Errors & Troubleshooting'),
    li([
      'Report shows no data: Date range may be set incorrectly, or the relevant feature module may not be active.',
      'Financial report totals don\'t match: Ensure all ERAs have been posted for the period.',
    ]),
    h2('FAQ'),
    li([
      'Q: Can I build custom reports? A: Yes — use the Advanced Reporting builder to create custom queries.',
      'Q: Can I export data to Excel? A: Yes — every report has an Export to CSV button.',
      'Q: Who can access financial reports? A: Billing staff, practice managers, and super admins by default. Permissions can be adjusted.',
    ]),
    h2('Marketing Summary'),
    p('CareMetric AI turns your data into decisions — real-time financial dashboards, clinical quality tracking, and predictive revenue forecasting give practice leaders the intelligence to run a high-performing, data-driven practice.'),
    div(),
  );

  // ─────────────────────────── CCM ───────────────────────────
  sections.push(
    h1('MODULE 11 — Chronic Care Management (CCM)'),
    h2('Overview'),
    p('The CCM module supports Medicare\'s Chronic Care Management program, allowing practices to bill CPT 99490, 99491, 99487, and 99489 for monthly care management time spent on patients with two or more chronic conditions. The AI automates time tracking, care plan generation, and billing readiness calculation.'),
    h2('When To Use'),
    li([
      'Identify and enroll eligible Medicare patients (2+ chronic conditions, consent obtained)',
      'Monthly — track care management time and activities',
      'At month end — review billing readiness report and submit CCM claims',
    ]),
    h2('Step-By-Step — Enrolling a Patient'),
    oli([
      'Go to CCM → Patient Panel.',
      'Click Enroll New Patient.',
      'Search for the patient.',
      'Verify they have 2+ chronic conditions documented on the Problem List.',
      'Obtain and document verbal or written CCM consent.',
      'Generate the initial Care Plan — the AI pre-populates it from the patient\'s chart.',
      'Review and finalize the care plan with the patient.',
      'Click Activate Enrollment.',
    ]),
    h2('AI Automation Behavior'),
    p('CCM AI: identifies eligible patients who are not yet enrolled, pre-populates care plans from chart data, tracks time spent in the system (calls, portal messages, care plan reviews), alerts you when a patient is close to the 20-minute threshold needed for billing, and generates the monthly billing readiness report.'),
    h2('Best Practices'),
    li([
      'Log every minute of CCM time immediately — waiting until month-end leads to missed billing.',
      'Use the CCM Timer Widget when making care management calls so time is tracked automatically.',
      'Review the Billing Readiness Report at the 25th of each month and complete any patients close to threshold.',
    ]),
    h2('Common Errors & Troubleshooting'),
    li([
      'Patient not appearing in eligible list: Confirm they have 2+ active chronic conditions on the Problem List.',
      'CCM time not accumulating: Ensure you are using the CCM Timer (not manually entering time) so entries are linked to the correct billing period.',
    ]),
    h2('FAQ'),
    li([
      'Q: Does CareMetric AI handle RPM (Remote Patient Monitoring) billing? A: Yes — RPM billing is under the RPM Hub with separate CPT codes (99453-99458).',
      'Q: Can multiple staff members log CCM time for the same patient? A: Yes — all staff time is aggregated at the patient level for billing.',
    ]),
    h2('Marketing Summary'),
    p('CareMetric AI\'s CCM module turns your existing chronic disease patient panel into a recurring revenue stream — with automated enrollment identification, care plan generation, and billing readiness reports that make CCM billing simple and audit-proof.'),
    div(),
  );

  // ─────────────────────────── PRIOR AUTH ───────────────────────────
  sections.push(
    h1('MODULE 12 — Prior Authorization'),
    h2('Overview'),
    p('The Prior Authorization module streamlines the submission, tracking, and appeal of insurance prior authorizations. AI drafts the clinical justification letter, extracts relevant chart documentation, and monitors approval status. The FHIR PA Hub supports electronic submission to payers who have FHIR-based PA endpoints.'),
    h2('When To Use'),
    li([
      'Before ordering a high-cost medication, procedure, or specialist referral',
      'When a payer requires PA for a specific CPT code',
      'When appealing a PA denial',
    ]),
    h2('Step-By-Step'),
    oli([
      'Go to Prior Auth → New Request.',
      'Select the patient and the procedure or medication requiring authorization.',
      'Select the payer and verify PA is required (the system checks payer rules automatically).',
      'Click AI Draft — the AI extracts relevant clinical documentation and writes the justification letter.',
      'Review and edit the letter.',
      'Attach supporting documents.',
      'Submit electronically (FHIR-enabled payers) or print for fax submission.',
      'Track status in the PA Dashboard.',
    ]),
    h2('AI Automation Behavior'),
    p('PA AI: checks payer rules to confirm whether a PA is actually required, pulls relevant diagnoses, medications, and failed therapies from the chart to support the justification, generates specialty-specific PA letters (oncology, behavioral health, cardiology, etc.), and sends alerts when a PA is expiring.'),
    h2('Best Practices'),
    li([
      'Always submit PAs before scheduling procedures — retroactive authorization is rarely granted.',
      'Attach detailed clinical notes — vague justification letters are the top cause of PA denial.',
      'Use the specialty PA kits for complex cases (e.g., GLP-1 medications, biologics, infusions).',
    ]),
    h2('Common Errors & Troubleshooting'),
    li([
      'PA submission failing for FHIR payers: The payer\'s FHIR endpoint may be temporarily unavailable. Use fax/portal fallback.',
      'AI letter is missing clinical data: Ensure the relevant diagnosis and treatment history are documented on the Problem List.',
    ]),
    h2('FAQ'),
    li([
      'Q: How do I appeal a PA denial? A: Open the denied PA → click Appeal → the AI generates a peer-to-peer or written appeal letter.',
      'Q: Does CareMetric AI support Gold Carding? A: Yes — once a provider achieves Gold Card status with a payer, the system bypasses PA for eligible codes.',
    ]),
    h2('Marketing Summary'),
    p('CareMetric AI\'s AI-powered Prior Authorization module cuts average PA processing time from days to hours. The AI reads the chart, writes the letter, and tracks every request — so your clinical staff spends time on patients, not paperwork.'),
    div(),
  );

  // ─────────────────────────── CREDENTIALING ───────────────────────────
  sections.push(
    h1('MODULE 13 — Provider Credentialing'),
    h2('Overview'),
    p('The Credentialing module manages the full lifecycle of provider credentials: initial applications, reappointments, license expirations, DEA certificates, malpractice insurance, and payer network enrollment. AI monitors expiration dates and triggers renewal workflows 90, 60, and 30 days in advance.'),
    h2('Step-By-Step'),
    oli([
      'Go to Practice Admin → Provider Credentialing.',
      'Click Add Provider.',
      'Enter all required credentials: NPI, DEA, state license(s), board certifications, malpractice insurance.',
      'Upload scanned copies of each document.',
      'Set expiration date for each document.',
      'The system will automatically remind you before each document expires.',
      'Use the Credentialing Wizard to generate payer enrollment applications.',
    ]),
    h2('AI Automation Behavior'),
    p('Credentialing AI: monitors all expiration dates across the provider roster, sends staged reminders at 90/60/30/7 days before expiration, identifies credentialing gaps that could cause claim denial, and tracks primary source verification status for each credential.'),
    h2('Best Practices'),
    li([
      'Upload documents immediately when received — don\'t wait for the application deadline.',
      'Add all state licenses even if the provider is only practicing in one state — this prevents reprocessing if they expand.',
      'Use the CAQH Profile Manager integration to sync credential data and reduce dual data entry.',
    ]),
    h2('FAQ'),
    li([
      'Q: Does CareMetric AI integrate with CAQH? A: Yes — the CAQH Profile Manager syncs provider data bidirectionally.',
      'Q: What happens if a license expires? A: The provider is flagged and claims under that provider will not submit until the credential is renewed.',
    ]),
    h2('Marketing Summary'),
    p('Never miss a credential expiration again. CareMetric AI tracks every license, certification, and insurance document for every provider and sends staged reminders long before anything lapses — protecting your revenue and your patients.'),
    div(),
  );

  // ─────────────────────────── INTEGRATIONS ───────────────────────────
  sections.push(
    h1('MODULE 14 — Integrations (Labs, Devices, FHIR, Payers)'),
    h2('Overview'),
    p('CareMetric AI integrates with labs, devices, payers, clearinghouses, pharmacies, HIEs, and external EHRs via HL7 v2, FHIR R4, and proprietary APIs. The Integration Hub provides a central configuration point for all third-party connections.'),
    h2('Key Integrations'),
    li([
      'ClaimMD Clearinghouse: Electronic claim submission and ERA receipt',
      'Prescription module: medication management and pharmacy connectivity',
      'Twilio: SMS, fax, voice, telehealth video, and two-factor authentication',
      'FHIR R4 APIs: Payer PA endpoints, hospital ADT feeds, HIE data exchange',
      'Lab Interfaces: HL7 result imports from major reference labs',
      'Stripe Connect: Patient payment processing',
      'Chargebee: Subscription billing for the platform',
    ]),
    h2('Step-By-Step — Configuring FHIR Connection'),
    oli([
      'Go to Practice Admin → Integrations → FHIR Hub.',
      'Click Add Connection.',
      'Select the connection type (Payer, Hospital/EHR, Lab, HIE).',
      'Enter the provided credentials: Base URL, Client ID, Client Secret.',
      'Click Test Connection to verify.',
      'Click Save and Activate.',
      'The connection will now exchange data automatically on the configured schedule.',
    ]),
    h2('Best Practices'),
    li([
      'Test every integration in a staging environment before activating in production.',
      'Rotate API keys annually for security.',
      'Review the Integration Log weekly for failed connections that need attention.',
    ]),
    h2('Common Errors & Troubleshooting'),
    li([
      'FHIR connection failing: Verify the Client ID and Secret are correct. Tokens expire — check the token expiry in the connection log.',
      'Lab results not importing: Confirm the HL7 interface is active and the lab facility ID is correct.',
      'SMS not sending: Verify your Twilio phone number is active and the messaging profile is configured.',
    ]),
    h2('FAQ'),
    li([
      'Q: Does CareMetric AI support SMART on FHIR apps? A: Yes — use the SMART App Launcher under FHIR Hub.',
      'Q: Can I connect to Epic or Cerner? A: Yes — via their FHIR R4 patient access APIs.',
      'Q: Is there an API for custom integrations? A: Yes — contact support for API documentation and developer access.',
    ]),
    h2('Marketing Summary'),
    p('CareMetric AI connects to your entire healthcare ecosystem — labs, payers, pharmacies, hospitals, and devices — through industry-standard FHIR APIs and HL7 interfaces, eliminating the data silos that slow down care.'),
    div(),
  );

  // ─────────────────────────── COMPLIANCE & AUDIT ───────────────────────────
  sections.push(
    h1('MODULE 15 — Compliance & Audit Logs'),
    h2('Overview'),
    p('The Compliance module provides comprehensive audit logging of every user action, PHI access event, and system transaction. It supports HIPAA compliance reporting, OIG exclusion checks, documentation audits, and regulatory reporting. AI analyzes audit patterns to detect anomalous access.'),
    h2('When To Use'),
    li([
      'Before a payer audit — pull documentation completeness reports',
      'In response to a breach investigation — search access logs by user, patient, and time',
      'Annually — run HIPAA risk assessment reports',
      'For staff performance reviews — review documentation quality scores',
    ]),
    h2('Step-By-Step — Running an Audit Log Report'),
    oli([
      'Go to Practice Admin → Audit Logs.',
      'Set the date range and filter by user, patient, or action type.',
      'Click Generate Report.',
      'Download the report as PDF or CSV.',
    ]),
    h2('AI Automation Behavior'),
    p('Compliance AI: continuously monitors access patterns and flags anomalies (e.g., a user accessing an unusually high number of records, after-hours access from an unusual location), generates weekly compliance scorecards, and produces documentation quality scores for every signed note.'),
    h2('Best Practices'),
    li([
      'Review the Security Audit Console monthly — AI flags require human review.',
      'Ensure all staff complete annual HIPAA training and log completion in the system.',
      'Run the Documentation Quality report before submitting claims — it reduces audit risk.',
    ]),
    h2('FAQ'),
    li([
      'Q: How long are audit logs retained? A: Audit logs are retained for 7 years per HIPAA requirements.',
      'Q: Can I see who accessed a specific patient\'s chart? A: Yes — in Audit Logs, filter by patient name or MRN.',
      'Q: Does CareMetric AI support SOC 2 reporting? A: Yes — contact support for SOC 2 compliance documentation.',
    ]),
    h2('Marketing Summary'),
    p('CareMetric AI\'s comprehensive audit and compliance system keeps your practice protected — from HIPAA breach detection to documentation quality scoring, every action is logged, analyzed, and reportable in minutes.'),
    div(),
  );

  // ─────────────────────────── USER & ROLE MANAGEMENT ───────────────────────────
  sections.push(
    h1('MODULE 16 — User & Role Management'),
    h2('Overview'),
    p('User and Role Management controls who can access what in CareMetric AI. Role-based access control (RBAC) supports predefined roles (Provider, Nurse, Front Desk, Biller, Practice Admin, Super Admin) and custom permission sets. Multi-factor authentication (MFA) can be enforced organization-wide.'),
    h2('Step-By-Step — Adding a New Staff Member'),
    oli([
      'Go to Practice Admin → Staff Management.',
      'Click Invite Team Member.',
      'Enter their name, email, and role.',
      'Click Send Invitation — they receive an email with a secure account setup link.',
      'Once they activate their account, they can log in.',
      'Set a password change requirement on first login if desired.',
    ]),
    h2('Step-By-Step — Configuring MFA'),
    oli([
      'Go to Practice Admin → Security.',
      'Toggle Require MFA for All Users.',
      'Select MFA method: SMS (via Twilio) or Authenticator App.',
      'Users will be prompted to set up MFA on their next login.',
    ]),
    h2('Best Practices'),
    li([
      'Follow the principle of least privilege — only give users the access they need for their role.',
      'Remove departed staff immediately — do not leave accounts active after an employee leaves.',
      'Enable MFA for all users — this is a HIPAA best practice and reduces breach risk significantly.',
    ]),
    h2('FAQ'),
    li([
      'Q: Can I create a custom role? A: Yes — go to Practice Admin → Staff Roles → Create Custom Role and select specific permissions.',
      'Q: What happens when I deactivate a user? A: Their account is disabled. Their data remains and is not deleted.',
      'Q: Can a provider also be a practice admin? A: Yes — users can have multiple roles, though this should be used carefully.',
    ]),
    h2('Marketing Summary'),
    p('CareMetric AI\'s granular role-based access control ensures every team member sees exactly what they need — and nothing they don\'t. With one-click team invitations and mandatory MFA support, onboarding is fast and security is built in.'),
    div(),
  );

  // ─────────────────────────── AUTOMATION RULES ENGINE ───────────────────────────
  sections.push(
    h1('MODULE 17 — Automation Rules Engine'),
    h2('Overview'),
    p('The Rules Engine allows practice administrators to create automated workflows triggered by clinical or administrative events. Examples: automatically send a follow-up SMS after a visit, trigger a PA request when a specific medication is prescribed, or route a task to the biller when a note is signed.'),
    h2('Step-By-Step — Creating a Rule'),
    oli([
      'Go to Practice Admin → Rules Engine.',
      'Click New Rule.',
      'Set the Trigger (e.g., Visit Signed, Appointment Cancelled, Lab Result Received).',
      'Set the Condition (e.g., Diagnosis = Type 2 Diabetes, Provider = Dr. Smith).',
      'Set the Action (e.g., Send SMS to patient, Create task for nurse, Send fax to specialist).',
      'Test the rule with a sample event.',
      'Activate the rule.',
    ]),
    h2('Best Practices'),
    li([
      'Start with high-impact, low-risk rules (e.g., appointment reminders) before building complex clinical rules.',
      'Test every rule in a non-production environment before going live.',
      'Review rule execution logs monthly to catch unintended behavior.',
    ]),
    h2('Marketing Summary'),
    p('CareMetric AI\'s no-code Rules Engine lets your practice automate the repetitive workflows that consume staff time — from appointment reminders to care gap outreach — without writing a single line of code.'),
    div(),
  );

  sections.push(
    div(),
    h2('Contact & Support'),
    p('For technical support, contact us at support@caremetric.ai. For billing questions, contact billing@caremetric.ai. Emergency clinical support is available 24/7 via the in-app AI assistant.'),
    kv('Website', 'https://caremetric.ai'),
    kv('Support Portal', 'Support Center (in-app)'),
    kv('Documentation', '/docs'),
    sp(),
    p('CareMetric AI — Built for the modern, AI-native healthcare practice.'),
  );

  return sections;
}
