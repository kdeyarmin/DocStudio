import type { PdfSection } from '../types';

export interface TroubleshootingKBData {
  generatedAt?: string;
}

interface TroubleshootingEntry {
  symptom: string;
  cause: string;
  resolution: string[];
  escalate?: string;
}

interface TroubleshootingModule {
  module: string;
  entries: TroubleshootingEntry[];
}

const MODULES: TroubleshootingModule[] = [
  {
    module: 'Login & Authentication',
    entries: [
      {
        symptom: 'Cannot log in — "Invalid credentials" error',
        cause: 'Wrong email/password or account locked after 5 failed attempts.',
        resolution: [
          'Click "Forgot Password" on the login screen.',
          'Check email for reset link (check spam if not received within 2 min).',
          'If account is locked, wait 15 minutes or contact your admin.',
          'Admin can reset via Practice Admin → Staff → select user → Reset Password.',
        ],
      },
      {
        symptom: '2FA code not received',
        cause: 'Phone number mismatch, SMS delivery delay, or 2FA not configured.',
        resolution: [
          'Wait up to 60 seconds — SMS delivery can be delayed.',
          'Check that the phone number shown matches yours (last 4 digits visible).',
          'Click "Resend Code."',
          'If still not received, contact your admin to reset 2FA under Staff → Reset 2FA.',
        ],
      },
      {
        symptom: 'Session expired mid-work',
        cause: 'Default session timeout is 30 minutes of inactivity.',
        resolution: [
          'Log back in — in-progress form data may be recoverable via auto-save.',
          'Admin can extend session timeout: Practice Admin → Security → Session Timeout.',
          'Use the Stay Signed In checkbox on login for longer sessions.',
        ],
      },
    ],
  },
  {
    module: 'Dashboard',
    entries: [
      {
        symptom: 'Dashboard panels are blank or not loading',
        cause: 'Organization provisioning issue or permission misconfiguration.',
        resolution: [
          'Log out and log back in to refresh your session token.',
          'Clear browser cache (Ctrl+Shift+Delete / Cmd+Shift+Delete).',
          'Verify your role has dashboard access: Practice Admin → Staff Roles.',
          'If the issue persists for all users, contact support — may be a provisioning issue.',
        ],
        escalate: 'Contact support@caremetric.ai if all users are affected.',
      },
      {
        symptom: 'AI nudges / CDS alerts not appearing',
        cause: 'CDS feature disabled or AI API key not configured.',
        resolution: [
          'Go to Practice Admin → Features → enable Clinical Decision Support.',
          'Super Admin: verify AI API key under Platform Settings → AI Configuration.',
          'Ensure patients have active problems and medications for CDS rules to fire.',
        ],
      },
      {
        symptom: 'Task count shows 0 but tasks exist',
        cause: 'Role permissions do not include task viewing.',
        resolution: [
          'Go to Practice Admin → Staff Roles → select your role → enable Task Management.',
          'Check task filters — you may be viewing "All Tasks" filtered to another user.',
        ],
      },
    ],
  },
  {
    module: 'Patient Chart',
    entries: [
      {
        symptom: 'Patient chart will not load',
        cause: 'Patient may belong to a different organization or data sync issue.',
        resolution: [
          'Verify the patient is assigned to your organization.',
          'Try searching by date of birth instead of name.',
          'Refresh the page and retry.',
          'Check for browser console errors and report to support if a database error is shown.',
        ],
      },
      {
        symptom: 'Medications tab is empty',
        cause: 'No active prescriptions or medication reconciliation not completed.',
        resolution: [
          'Ensure a medication reconciliation has been completed for this patient.',
          'Add medications manually: Medications → Add Medication.',
          'If imported from another EMR, check if the import completed under Data Migration.',
        ],
      },
      {
        symptom: 'Lab results not appearing in Labs tab',
        cause: 'HL7 interface not configured or results not yet imported.',
        resolution: [
          'Check if lab results were received via fax — they may need to be filed manually.',
          'For HL7 interfaces, verify the interface is active under Integrations.',
          'Add manually: Lab Results → Add Result.',
          'Check Fax Dashboard for incoming lab fax results awaiting filing.',
        ],
      },
      {
        symptom: 'Cannot edit patient demographics',
        cause: 'Insufficient role permissions.',
        resolution: [
          'Verify your role includes demographics editing: Practice Admin → Staff Roles → Demographics.',
          'If patient is in a different organization, you may have read-only access.',
        ],
      },
    ],
  },
  {
    module: 'Note Documentation',
    entries: [
      {
        symptom: 'Ambient scribe not recording / microphone not detected',
        cause: 'Browser microphone permission blocked.',
        resolution: [
          'Click the lock/info icon in the browser address bar.',
          'Set Microphone permission to "Allow."',
          'Refresh the page and try again.',
          'Test microphone in browser settings: chrome://settings/content/microphone.',
          'Ensure no other application is exclusively using the microphone.',
        ],
      },
      {
        symptom: 'AI note suggestions not generating',
        cause: 'AI API key not configured or network issue.',
        resolution: [
          'Super Admin: verify AI API key under Platform Settings → AI Configuration.',
          'Check network connectivity — AI features require a stable internet connection.',
          'Try refreshing the note editor.',
        ],
        escalate: 'If API key is valid and issue persists, contact support.',
      },
      {
        symptom: 'MDM level shows "Unknown"',
        cause: 'Incomplete MDM elements — all three components required.',
        resolution: [
          'Ensure Problems section has at least one entry.',
          'Ensure Data section has at least one reviewed item (labs, notes, or external records).',
          'Ensure Risk section has a management plan entry.',
          'Review the MDM Widget tooltip for specific missing elements.',
        ],
      },
      {
        symptom: 'Cannot sign note — "Missing required fields" error',
        cause: 'Documentation quality check failed on required elements.',
        resolution: [
          'Click the Documentation Quality Check button to see specific missing fields.',
          'Fill in all flagged required sections.',
          'Ensure at least one diagnosis code is added.',
          'Verify a rendering provider is selected on the note.',
        ],
      },
      {
        symptom: 'Co-signature not requested / co-signer not receiving notification',
        cause: 'Co-signer not configured for this provider or email not set.',
        resolution: [
          'Go to Practice Admin → Providers → select provider → set Co-Signer.',
          'Verify the co-signer has an email address on their profile.',
          'Check the co-signer\'s inbox and spam folder.',
        ],
      },
    ],
  },
  {
    module: 'Scheduling',
    entries: [
      {
        symptom: 'Cannot book an appointment — no available slots',
        cause: 'Provider availability not configured.',
        resolution: [
          'Go to Practice Admin → Scheduling → Provider Availability.',
          'Set the provider\'s working days and hours.',
          'Add at least one visit type with a default duration.',
          'Return to schedule and try booking again.',
        ],
      },
      {
        symptom: 'SMS appointment reminders not sending',
        cause: 'Patient SMS consent missing or Twilio not configured.',
        resolution: [
          'Verify patient has SMS consent: Patient Chart → Communications → SMS Consent = Yes.',
          'Check Twilio phone number configuration: Practice Admin → Integrations → Twilio.',
          'Verify the reminder rule is enabled: Practice Admin → Scheduling → Reminder Rules.',
        ],
      },
      {
        symptom: 'Telehealth link not in confirmation email',
        cause: 'Twilio Video integration not enabled or visit type not marked telehealth.',
        resolution: [
          'Ensure Twilio Video is configured: Practice Admin → Integrations → Twilio Video.',
          'Confirm the appointment is marked as "Telehealth" type.',
          'Resend the confirmation from the appointment detail page.',
        ],
      },
    ],
  },
  {
    module: 'Billing & Claims',
    entries: [
      {
        symptom: 'Claim rejected — "Missing NPI"',
        cause: 'Rendering provider NPI not set in their profile.',
        resolution: [
          'Go to Practice Admin → Providers → select provider → enter Individual NPI.',
          'Verify the billing NPI (group NPI) is set under Practice Admin → Organization.',
          'Re-scrub and resubmit the claim.',
        ],
      },
      {
        symptom: 'ERA (835) not auto-posting',
        cause: 'ClaimMD integration not configured for ERA or 835 format not enabled.',
        resolution: [
          'Go to Practice Admin → Integrations → ClaimMD.',
          'Enable ERA/835 auto-posting.',
          'Verify ERA delivery method is set to "835 Electronic" with your clearinghouse.',
          'Contact ClaimMD support to verify ERA enrollment for each payer.',
        ],
      },
      {
        symptom: 'Claim stuck in "Pending" status',
        cause: 'ClaimMD transmission error or payer connectivity issue.',
        resolution: [
          'Go to Billing → ClaimMD Dashboard to check transmission log.',
          'Look for error codes and their descriptions.',
          'Resubmit the claim if it shows a transmission error.',
          'If payer is unavailable, note the downtime and retry in 2-4 hours.',
        ],
        escalate: 'If stuck for more than 24 hours, contact ClaimMD support.',
      },
      {
        symptom: 'Claim scrubber shows "NCCI Bundling" error',
        cause: 'Two CPT codes cannot be billed together per CMS NCCI edits.',
        resolution: [
          'Review the flagged code pair in the NCCI edit reference.',
          'Add a modifier (e.g., 59, XU, XS) if the services are truly separate.',
          'Alternatively, remove the bundled code if it is included in the primary procedure.',
        ],
      },
    ],
  },
  {
    module: 'Prescriptions',
    entries: [
      {
        symptom: 'Prescription not transmitting to pharmacy',
        cause: 'Pharmacy NCPDP number invalid or connectivity issue.',
        resolution: [
          'Verify the pharmacy\'s NCPDP number is correct.',
          'Try searching for the pharmacy again and re-selecting.',
          'Print/fax the prescription as a fallback for urgent medications.',
        ],
      },
      {
        symptom: 'Two-factor not working for controlled substances',
        cause: 'Credential expired or identity proofing incomplete.',
        resolution: [
          'Ensure the provider\'s DEA number is current on their profile.',
          'Contact support to review identity proofing status.',
        ],
        escalate: 'Contact CareMetric AI support for credential renewal assistance.',
      },
      {
        symptom: 'PDMP check failing',
        cause: 'State PDMP credentials expired or integration not configured.',
        resolution: [
          'Contact your state PDMP administrator to renew credentials.',
          'Update PDMP credentials: Practice Admin → Integrations → PDMP.',
          'Document a manual PDMP review in the note if the integration is down.',
        ],
      },
    ],
  },
  {
    module: 'Telehealth',
    entries: [
      {
        symptom: 'Patient cannot join the telehealth session',
        cause: 'Link expired, wrong browser, or camera/microphone blocked.',
        resolution: [
          'Resend the video link from the appointment detail page.',
          'Instruct the patient to use Chrome, Edge, or Safari (not Firefox on older devices).',
          'Ask the patient to allow camera and microphone when prompted.',
          'Try joining from a different device if the issue persists.',
        ],
      },
      {
        symptom: 'Poor video quality / freezing',
        cause: 'Insufficient internet bandwidth on either end.',
        resolution: [
          'Recommend the patient move closer to their WiFi router.',
          'Close other browser tabs and applications using bandwidth.',
          'Switch from WiFi to a wired connection if available.',
          'If quality is still poor, offer to switch to phone/audio only.',
        ],
      },
      {
        symptom: 'Billing code for telehealth not auto-populating',
        cause: 'Appointment type not marked as telehealth.',
        resolution: [
          'Verify the appointment record shows "Telehealth" visit type.',
          'Edit the appointment to change the visit type if incorrect.',
          'Manually enter the appropriate CPT code (99213 with GT modifier or 99203-99215 for audio-only).',
        ],
      },
    ],
  },
  {
    module: 'Patient Portal',
    entries: [
      {
        symptom: 'Portal invitation email not received',
        cause: 'Wrong email address or email filtered as spam.',
        resolution: [
          'Verify the patient\'s email address on file is correct.',
          'Ask the patient to check their spam/junk folder.',
          'Resend the invitation: Patient Chart → Portal → Resend Invitation.',
          'Try an alternative email address if available.',
        ],
      },
      {
        symptom: 'Portal invitation link expired',
        cause: 'Invitation links expire after 7 days.',
        resolution: [
          'Resend a new invitation from Patient Chart → Portal → Send Invitation.',
          'The new link will be valid for another 7 days.',
        ],
      },
      {
        symptom: 'Patient cannot see their lab results in the portal',
        cause: 'Lab results not released to the portal.',
        resolution: [
          'Open the patient chart → Lab Results tab.',
          'Click the result → toggle "Release to Portal" to ON.',
          'The result will appear in the patient\'s portal within a few seconds.',
        ],
      },
    ],
  },
  {
    module: 'Fax',
    entries: [
      {
        symptom: 'Outbound fax not sending',
        cause: 'Twilio fax not configured or recipient number invalid.',
        resolution: [
          'Verify Twilio fax credentials: Practice Admin → Integrations → Fax.',
          'Confirm the recipient fax number is correct (10 digits, no spaces or dashes).',
          'Check the Fax Dashboard for error messages.',
        ],
      },
      {
        symptom: 'Incoming faxes not appearing in the Fax Dashboard',
        cause: 'Fax DID not set up or webhook not configured.',
        resolution: [
          'Verify the inbound fax number is configured in Twilio.',
          'Check that the fax webhook URL matches the deployed edge function.',
          'Contact support if faxes are confirmed sent to your number but not appearing.',
        ],
        escalate: 'Contact support@caremetric.ai for Twilio webhook verification.',
      },
    ],
  },
];

export function buildTroubleshootingKBSections(_data: TroubleshootingKBData): PdfSection[] {
  const sections: PdfSection[] = [];

  sections.push({ type: 'heading', level: 1, text: 'CareMetric AI — Technical Troubleshooting Knowledge Base' });
  sections.push({
    type: 'paragraph',
    text: 'This reference covers the most common issues and their step-by-step resolutions. Issues are organized by module. For issues not covered here, contact support@caremetric.ai.',
  });
  sections.push({ type: 'divider' });

  sections.push({ type: 'heading', level: 2, text: 'Quick Diagnostic Checklist' });
  sections.push({
    type: 'list',
    items: [
      'Confirm you are on a supported browser: Chrome, Edge, or Safari (latest version).',
      'Try a hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac).',
      'Clear browser cache and cookies if issues persist.',
      'Check your internet connection is stable.',
      'Verify your role has the required permissions for the action you are attempting.',
      'If all users are affected, check if a system maintenance is in progress.',
    ],
  });
  sections.push({ type: 'divider' });

  for (const mod of MODULES) {
    sections.push({ type: 'heading', level: 2, text: mod.module });

    for (const entry of mod.entries) {
      sections.push({ type: 'heading', level: 3, text: `Issue: ${entry.symptom}` });
      sections.push({
        type: 'keyValue',
        pairs: [{ label: 'Likely Cause', value: entry.cause }],
      });
      sections.push({ type: 'paragraph', text: 'Resolution steps:' });
      sections.push({ type: 'list', ordered: true, items: entry.resolution });
      if (entry.escalate) {
        sections.push({
          type: 'paragraph',
          text: `Escalation: ${entry.escalate}`,
          highlight: 'warning',
        });
      }
      sections.push({ type: 'spacer' });
    }

    sections.push({ type: 'divider' });
  }

  sections.push({ type: 'heading', level: 2, text: 'Escalation Contacts' });
  sections.push({
    type: 'table',
    headers: ['Issue Type', 'Contact', 'Response Time'],
    rows: [
      ['General support', 'support@caremetric.ai', 'Within 1 business day'],
      ['Critical system issue', 'support@caremetric.ai (mark URGENT)', 'Within 4 hours'],
      ['ClaimMD billing issues', 'ClaimMD support portal', 'Per ClaimMD SLA'],
      ['Twilio fax/SMS/video issues', 'Twilio support portal', 'Per Twilio SLA'],
    ],
  });

  return sections;
}
