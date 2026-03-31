import type { PdfSection } from '../types';

export interface AddOnFeaturesData {
  generatedAt?: string;
}

export function buildAddOnFeaturesSections(_data: AddOnFeaturesData): PdfSection[] {
  const sections: PdfSection[] = [];

  sections.push({ type: 'heading', level: 1, text: 'CareMetric AI — Premium Add-On Features' });
  sections.push({
    type: 'paragraph',
    text: 'This document details the premium add-on modules available with CareMetric AI. Each add-on is designed to extend the power of your core EMR platform, delivering measurable time savings, improved patient outcomes, and a direct positive impact on your practice\'s bottom line.',
  });
  sections.push({
    type: 'paragraph',
    text: 'These add-ons are built for practices ready to operate at the highest level — automating complex workflows, closing revenue gaps, and delivering a quality of care that differentiates your practice in an increasingly competitive market.',
  });
  sections.push({ type: 'divider' });

  // ROI Summary
  sections.push({ type: 'heading', level: 2, text: 'The Business Case: What Premium Add-Ons Deliver' });
  sections.push({
    type: 'table',
    headers: ['Impact Area', 'Estimated Benefit', 'Source'],
    rows: [
      ['Documentation time saved', '90+ min/day per provider', 'AI Copilot + Voice Transcription'],
      ['Additional revenue per visit (HCC coding)', '$80–$120 per encounter', 'Differential Dx + Risk Analytics'],
      ['Reduction in claim denials', '30–40% fewer denials', 'RCM Automation + Denial Management'],
      ['Secondary claim recovery', '$15,000–$40,000/yr per provider', 'Secondary Claims Automation'],
      ['Credentialing time reduction', '70% faster re-credentialing', 'Credentialing Management'],
      ['Care gap closure rate improvement', '2–3x more gaps closed', 'Care Gap Outreach + CCM'],
      ['RPM revenue per enrolled patient/mo', '$120–$200/patient/month', 'Remote Patient Monitoring'],
      ['Compliance audit exposure reduction', 'Dramatically reduced risk', 'Compliance & Regulatory Tracking'],
    ],
  });
  sections.push({ type: 'divider' });

  // 1. AI Clinical Copilot
  sections.push({ type: 'heading', level: 2, text: '1. AI Clinical Copilot' });
  sections.push({ type: 'heading', level: 3, text: 'What It Does' });
  sections.push({
    type: 'paragraph',
    text: 'The AI Clinical Copilot is an always-on intelligent assistant embedded directly within the patient chart and note-writing workflow. It reads the full patient context — active problems, medications, prior visit history, lab trends, and current note content — and provides real-time clinical decision support, documentation suggestions, and coding guidance without requiring the provider to leave their workflow.',
  });
  sections.push({
    type: 'list',
    items: [
      'Real-time ICD-10, CPT, and HCC code suggestions derived from note content as you type.',
      'Automatic Medical Decision Making (MDM) level calculation with visual complexity breakdown.',
      'Preventive care gap alerts surfaced at the point of care — prompting flu vaccines, cancer screenings, and overdue labs.',
      'Medication safety checks: drug-drug interactions, allergy conflicts, and dose range warnings.',
      'AI-generated plan suggestions and order sets based on active diagnoses.',
      'Context-aware SOAP note completion prompts to ensure documentation completeness.',
      'Pre-encounter briefings — a smart summary of everything clinically relevant before the visit begins.',
    ],
  });
  sections.push({ type: 'heading', level: 3, text: 'Why It Matters' });
  sections.push({
    type: 'paragraph',
    text: 'Physicians lose an average of 2 hours per day to documentation and administrative tasks that pull them away from patients. The AI Clinical Copilot recovers that time by acting as a knowledgeable second set of eyes — surfacing what matters, suggesting what to do next, and ensuring nothing falls through the cracks. It is the difference between practicing reactively and practicing with genuine clinical intelligence at your fingertips.',
  });
  sections.push({
    type: 'list',
    items: [
      'TIME SAVINGS: Providers report saving 45–75 minutes per day on documentation and coding tasks.',
      'REVENUE IMPACT: HCC risk code suggestions alone add an average of $80–$120 per encounter in compliant reimbursement.',
      'PATIENT CARE: Preventive care gap prompts at the point of care increase screening compliance rates by 35–50%.',
      'COST REDUCTION: Fewer missed codes means fewer denials, fewer chart audits, and stronger payer relationships.',
    ],
  });
  sections.push({ type: 'divider' });

  // 2. Advanced Voice Transcription
  sections.push({ type: 'heading', level: 2, text: '2. Advanced Voice Transcription (Ambient AI Scribe)' });
  sections.push({ type: 'heading', level: 3, text: 'What It Does' });
  sections.push({
    type: 'paragraph',
    text: 'Advanced Voice Transcription brings ambient, hands-free clinical documentation to every visit. The system passively listens to the provider-patient conversation — in-office or via telehealth — and automatically structures a complete, ready-to-review clinical note in the provider\'s preferred template format. No dictation required. No pressing record. No post-visit keyboard sessions.',
  });
  sections.push({
    type: 'list',
    items: [
      'Full ambient listening mode — the microphone stays on throughout the visit and captures everything naturally.',
      'Specialty-specific note templates: SOAP, DAP, H&P, psychiatric intake, pediatric well-child, orthopedic, and 40+ more.',
      'Speaker differentiation — distinguishes provider voice from patient voice for accurate attribution.',
      'Live transcript with real-time editing so providers can correct on the fly.',
      'Batch processing mode for high-volume practices — process multiple sessions in sequence.',
      'Audio is never permanently stored; only the transcript is retained per HIPAA requirements.',
      'Works seamlessly with all Twilio telehealth video sessions.',
    ],
  });
  sections.push({ type: 'heading', level: 3, text: 'Why It Matters' });
  sections.push({
    type: 'paragraph',
    text: 'Physician burnout is at an all-time high, and documentation is the number one cited cause. The typical provider spends 37% of their clinical time on documentation. Advanced Voice Transcription eliminates virtually all of that burden — the note writes itself while the provider focuses entirely on the patient.',
  });
  sections.push({
    type: 'list',
    items: [
      'TIME SAVINGS: Practices report saving 90+ minutes of documentation time per provider per day — the equivalent of 3–4 additional patient visits.',
      'REVENUE IMPACT: More complete notes mean higher defensible E&M levels and fewer downcoded claims.',
      'PATIENT CARE: Providers can maintain genuine eye contact and engage fully — patients consistently rate encounters higher when providers are not typing.',
      'COST REDUCTION: Elimination of after-hours documentation reduces burnout, turnover, and the associated recruiting and training costs.',
    ],
  });
  sections.push({ type: 'divider' });

  // 3. Differential Diagnosis
  sections.push({ type: 'heading', level: 2, text: '3. Differential Diagnosis Engine' });
  sections.push({ type: 'heading', level: 3, text: 'What It Does' });
  sections.push({
    type: 'paragraph',
    text: 'The Differential Diagnosis Engine analyzes the patient\'s presenting symptoms, vital signs, current medications, lab results, and clinical history to generate a ranked list of probable diagnoses in real time. It surfaces conditions the provider may not have immediately considered, flags rare but high-acuity diagnoses that present similarly to common conditions, and provides evidence-based reasoning for each differential.',
  });
  sections.push({
    type: 'list',
    items: [
      'Ranked differentials with probability weighting based on patient demographics and clinical data.',
      'Red flag alerts for high-acuity conditions (PE, MI, sepsis, stroke) that mimic common presentations.',
      'Evidence-based diagnostic workup suggestions: recommended labs, imaging, and referrals per differential.',
      'ICD-10 code mapping for each differential — one click to add to the problem list.',
      'Integration with clinical decision support rules for guideline-concordant care.',
      'Tracks differential accuracy over time to improve institutional learning.',
    ],
  });
  sections.push({ type: 'heading', level: 3, text: 'Why It Matters' });
  sections.push({
    type: 'paragraph',
    text: 'Diagnostic error contributes to 40,000–80,000 deaths in the US annually and is the leading cause of malpractice claims. The Differential Diagnosis Engine serves as a cognitive safety net — not replacing clinical judgment, but systematically ensuring that the most dangerous conditions are always considered and documented as part of the clinical reasoning process.',
  });
  sections.push({
    type: 'list',
    items: [
      'TIME SAVINGS: Eliminates manual literature searching; differential with evidence appears in under 3 seconds.',
      'REVENUE IMPACT: More precise diagnostic coding translates directly to optimized reimbursement and reduced audit risk.',
      'PATIENT CARE: Reduces diagnostic errors and missed diagnoses — the single highest-impact patient safety intervention.',
      'COST REDUCTION: Fewer missed diagnoses means fewer return visits, fewer adverse outcomes, and reduced malpractice exposure.',
    ],
  });
  sections.push({ type: 'divider' });

  // 4. Predictive Risk Analytics
  sections.push({ type: 'heading', level: 2, text: '4. Predictive Risk Analytics' });
  sections.push({ type: 'heading', level: 3, text: 'What It Does' });
  sections.push({
    type: 'paragraph',
    text: 'Predictive Risk Analytics applies machine learning models to your patient population data to identify individuals at elevated risk for hospitalization, ED visits, disease progression, and preventable adverse events — before they occur. The system generates individual patient risk scores and population-level stratification, enabling proactive, targeted interventions.',
  });
  sections.push({
    type: 'list',
    items: [
      'HCC (Hierarchical Condition Category) risk score calculation per patient for Medicare Advantage risk adjustment.',
      'Readmission risk scoring — identifies patients likely to return to the hospital within 30 days.',
      'Disease progression modeling for chronic conditions: diabetes, CHF, COPD, CKD.',
      'No-show and appointment cancellation prediction to enable proactive schedule management.',
      'Population-level risk stratification dashboard: high, medium, and low risk panels.',
      'Automated outreach triggers based on risk thresholds — care managers are alerted automatically.',
      'Predictive pharmacy adherence monitoring identifies patients likely to discontinue critical medications.',
    ],
  });
  sections.push({ type: 'heading', level: 3, text: 'Why It Matters' });
  sections.push({
    type: 'paragraph',
    text: 'The shift to value-based care rewards practices that keep patients healthy rather than simply treating illness. Predictive Risk Analytics is the operational infrastructure that makes proactive, preventive care management economically viable at scale. For practices participating in ACOs, Medicare Advantage, or value-based contracts, accurate risk stratification directly determines revenue.',
  });
  sections.push({
    type: 'list',
    items: [
      'TIME SAVINGS: Care managers work from pre-built risk lists instead of manually reviewing hundreds of charts.',
      'REVENUE IMPACT: Accurate HCC coding and risk adjustment can add $200–$600 per Medicare Advantage patient annually.',
      'PATIENT CARE: Proactive outreach for high-risk patients reduces hospitalizations by 15–25% in published studies.',
      'COST REDUCTION: Every avoided hospitalization saves $10,000–$30,000 in downstream costs; shared savings contracts reward the practice directly.',
    ],
  });
  sections.push({ type: 'divider' });

  // 5. Full Revenue Cycle Automation
  sections.push({ type: 'heading', level: 2, text: '5. Full Revenue Cycle Automation' });
  sections.push({ type: 'heading', level: 3, text: 'What It Does' });
  sections.push({
    type: 'paragraph',
    text: 'Full Revenue Cycle Automation transforms billing from a manual, error-prone process into a streamlined automated pipeline. From charge capture at the point of care through claim submission, ERA posting, and patient collections, every step is automated, monitored, and optimized for maximum reimbursement with minimum staff intervention.',
  });
  sections.push({
    type: 'list',
    items: [
      'Automated charge capture: CPT and ICD-10 codes are pulled directly from signed notes — no separate charge entry.',
      'Pre-submission claim scrubbing with 500+ rules including NCCI edits, LCD/NCD compliance, and payer-specific rules.',
      'Batch claim submission with overnight scheduling — zero disruption to the clinical day.',
      'Real-time eligibility verification at scheduling and check-in — no more unpleasant surprise denials.',
      'ERA (835) auto-posting: electronic remittance advice is automatically matched and applied.',
      'Automated secondary claim generation from primary EOB — no manual rekeying.',
      'Patient statement generation and automated balance communication.',
      'Collections waterfall: automated balance reminders via SMS, email, and paper with configurable escalation rules.',
      'Real-time A/R dashboard with days-in-A/R, collection rate, and payer performance metrics.',
    ],
  });
  sections.push({ type: 'heading', level: 3, text: 'Why It Matters' });
  sections.push({
    type: 'paragraph',
    text: 'Revenue cycle inefficiency is the single largest controllable financial variable in a medical practice. The average practice loses 3–5% of gross revenue to billing errors and missed charges, and collects only 60–70 cents on every dollar billed. Full Revenue Cycle Automation systematically eliminates the leakage points — ensuring every service is billed, every claim is scrubbed, and every payment is posted and reconciled.',
  });
  sections.push({
    type: 'list',
    items: [
      'TIME SAVINGS: Billing staff spend time on exceptions and escalations — not manual data entry. Teams of 3 can manage the volume of 5.',
      'REVENUE IMPACT: Practices report 8–15% revenue improvement within 90 days of full automation — from $50,000 to over $200,000/year depending on volume.',
      'PATIENT CARE: Faster billing means faster resolution; patients appreciate clear, timely statements over surprise bills months later.',
      'COST REDUCTION: Reduced billing FTE requirements and elimination of clearinghouse middlemen save $30,000–$80,000/year for mid-size practices.',
    ],
  });
  sections.push({ type: 'divider' });

  // 6. Denial Management
  sections.push({ type: 'heading', level: 2, text: '6. Denial Management & Appeals Automation' });
  sections.push({ type: 'heading', level: 3, text: 'What It Does' });
  sections.push({
    type: 'paragraph',
    text: 'Denial Management takes the reactive, time-consuming process of working denied claims and turns it into a proactive, AI-driven workflow. The system automatically categorizes every denial by reason code, root cause, and payer, then drafts custom appeal letters using clinical documentation pulled directly from the chart — giving billers a complete, submission-ready appeal in minutes instead of hours.',
  });
  sections.push({
    type: 'list',
    items: [
      'Automatic denial receipt and categorization by CARC/RARC reason code.',
      'Root cause analysis: distinguishes front-end errors (eligibility, auth) from clinical documentation issues from payer policy disputes.',
      'AI-generated appeal letters customized per payer, per denial code, with relevant chart documentation attached.',
      'Denial trend analytics dashboard — identifies systemic issues by provider, code, payer, and time period.',
      'Timely filing tracker with automated escalation alerts before filing deadlines.',
      'Payer-specific appeal templates pre-loaded for the 200 most common denial scenarios.',
      'Appeal outcome tracking to measure win rates and refine strategies.',
      'Automated secondary claim generation from denial EOBs.',
    ],
  });
  sections.push({ type: 'heading', level: 3, text: 'Why It Matters' });
  sections.push({
    type: 'paragraph',
    text: 'Industry data shows that 65% of denied claims are never reworked — that is direct revenue abandonment. Of the claims that are appealed, practices win 50–90% depending on the denial type. Every denied claim that goes unworked is money left on the table. Denial Management ensures that nothing falls through the cracks and that appeal letters go out correctly the first time.',
  });
  sections.push({
    type: 'list',
    items: [
      'TIME SAVINGS: AI drafts appeal letters in under 60 seconds — what previously took 30–45 minutes per claim.',
      'REVENUE IMPACT: Recovering just 20% more denied claims can add $40,000–$150,000 in annual collections for a busy practice.',
      'PATIENT CARE: Faster claim resolution means patients are not billed for claims that should have been covered.',
      'COST REDUCTION: Systematic root cause analysis prevents recurrent denials — fixing the process, not just the individual claim.',
    ],
  });
  sections.push({ type: 'divider' });

  // 7. Secondary Claims
  sections.push({ type: 'heading', level: 2, text: '7. Secondary Claims Automation' });
  sections.push({ type: 'heading', level: 3, text: 'What It Does' });
  sections.push({
    type: 'paragraph',
    text: 'Secondary Claims Automation handles the entire secondary insurance billing process without manual intervention. When a primary payer EOB or ERA is received, the system automatically generates a correctly formatted secondary claim with the primary payment details pre-populated — including COB (Coordination of Benefits) data — and submits it to the secondary payer through the clearinghouse.',
  });
  sections.push({
    type: 'list',
    items: [
      'Automatic secondary claim generation triggered by primary ERA/EOB receipt.',
      'COB data accurately populated from primary payment details — no manual data transfer.',
      'Supports Medicare/Medicaid crossover claims, commercial-to-commercial, and Medicare Advantage coordination.',
      'Correct secondary billing for Medicare Supplement (Medigap) plans with automatic crossover.',
      'Secondary claim status tracking integrated with the primary claim timeline.',
      'Secondary denial management with separate workflow and appeal templates.',
      'Automatic patient responsibility calculation after both payers process.',
    ],
  });
  sections.push({ type: 'heading', level: 3, text: 'Why It Matters' });
  sections.push({
    type: 'paragraph',
    text: 'Secondary billing is one of the most neglected revenue streams in medical billing — because it is tedious, error-prone, and easy to deprioritize when primary billing demands attention. Yet for practices with a significant Medicare population, secondary claims recovery is not trivial. Medicare supplement plans often pay 20% of the allowed amount that Medicare left as patient responsibility. On a $100,000 monthly Medicare billing volume, that is $20,000 per month in uncollected secondary revenue.',
  });
  sections.push({
    type: 'list',
    items: [
      'TIME SAVINGS: Secondary claims generate and submit automatically — billers are not involved unless there is an exception.',
      'REVENUE IMPACT: Practices with significant Medicare or dual-coverage populations recover $15,000–$40,000+ per year in secondary payments.',
      'PATIENT CARE: Patients are not billed for amounts their secondary insurance should cover — reducing billing complaints and balance disputes.',
      'COST REDUCTION: Eliminates a full category of manual billing work, freeing biller time for higher-complexity revenue recovery.',
    ],
  });
  sections.push({ type: 'divider' });

  // 8. HL7 Integration
  sections.push({ type: 'heading', level: 2, text: '8. HL7 Integration Hub' });
  sections.push({ type: 'heading', level: 3, text: 'What It Does' });
  sections.push({
    type: 'paragraph',
    text: 'The HL7 Integration Hub enables bidirectional data exchange between CareMetric AI and external healthcare systems — hospital EHRs, laboratory systems, radiology PACS, pharmacies, and health information networks — using industry-standard HL7 v2 and FHIR R4 messaging protocols. It eliminates the fax and phone tag that currently defines most inter-system communication.',
  });
  sections.push({
    type: 'list',
    items: [
      'Inbound lab result integration: results from Quest, LabCorp, and local hospital labs post directly to the patient chart.',
      'Outbound lab orders: requisitions are transmitted electronically to connected labs — no paper forms.',
      'ADT (Admit/Discharge/Transfer) notifications: receive real-time alerts when your patients are admitted to or discharged from connected hospitals.',
      'Radiology result integration: structured reports from imaging centers appear in the chart alongside prior results.',
      'Medication history from Surescripts: pull 12+ months of pharmacy fill history into the medication list at intake.',
      'HL7 message monitoring dashboard with error alerts and retry logic.',
      'Configurable interface engine — support for custom mappings with local systems.',
    ],
  });
  sections.push({ type: 'heading', level: 3, text: 'Why It Matters' });
  sections.push({
    type: 'paragraph',
    text: 'The most dangerous moment in healthcare is care transitions — when a patient moves between care settings and critical information does not follow them. HL7 integration eliminates information silos, ensures your clinical team has complete information at the point of care, and removes the manual work of tracking down results, discharge summaries, and medication histories from external sources.',
  });
  sections.push({
    type: 'list',
    items: [
      'TIME SAVINGS: Eliminates 20–45 minutes per day of fax management, portal log-ins to external systems, and manual result entry.',
      'REVENUE IMPACT: Complete medication and problem list data improves HCC coding accuracy and reduces denied claims from missing clinical context.',
      'PATIENT CARE: Real-time hospital discharge alerts enable timely follow-up care — one of the most evidence-based interventions for reducing readmissions.',
      'COST REDUCTION: Eliminates fax lines, fax machine maintenance, and the staff time dedicated to managing paper-based inter-system communication.',
    ],
  });
  sections.push({ type: 'divider' });

  // 9. Health Information Exchange
  sections.push({ type: 'heading', level: 2, text: '9. Health Information Exchange (HIE) Access' });
  sections.push({ type: 'heading', level: 3, text: 'What It Does' });
  sections.push({
    type: 'paragraph',
    text: 'HIE Access connects your practice to your regional or state health information exchange network — a shared clinical data repository maintained by hospitals, health systems, labs, pharmacies, and practices across your geography. With a single query, providers can pull a patient\'s complete external clinical history: prior hospitalizations, ED visits, specialist notes, imaging studies, and lab results from any connected organization.',
  });
  sections.push({
    type: 'list',
    items: [
      'Patient query interface built directly into the chart — search the HIE without leaving the workflow.',
      'Consolidated clinical document retrieval: C-CDAs, discharge summaries, specialist notes, and lab results.',
      'Prior authorization support: retrieve supporting clinical documentation from the HIE to attach to PA requests.',
      'Care transitions support: when a patient is transferred to your practice, pull their complete history from the previous provider in minutes.',
      'Medication reconciliation using HIE pharmacy data — identify medications filled at other pharmacies.',
      'TEFCA-compliant query and response for nationwide data access.',
      'Consent management to ensure all HIE queries meet regulatory requirements.',
    ],
  });
  sections.push({ type: 'heading', level: 3, text: 'Why It Matters' });
  sections.push({
    type: 'paragraph',
    text: 'Without HIE access, your clinical team is flying blind for any new patient and for established patients who receive care elsewhere. Ordering duplicate tests because you cannot see prior results, missing critical diagnoses documented at the hospital, being unable to quickly access records for prior authorizations — all of these are costly, time-consuming, and risky. HIE access makes your practice a fully connected participant in the modern healthcare continuum.',
  });
  sections.push({
    type: 'list',
    items: [
      'TIME SAVINGS: Retrieving a complete patient history that used to take 3–5 days via records requests takes under 2 minutes through the HIE.',
      'REVENUE IMPACT: More complete clinical histories mean more accurate, defensible coding and fewer prior authorization denials due to missing documentation.',
      'PATIENT CARE: Reduces redundant testing, prevents dangerous medication conflicts, and enables informed clinical decision-making — even for patients you\'ve never seen before.',
      'COST REDUCTION: Elimination of duplicate testing alone can save $500–$2,000 per patient per year for complex patients.',
    ],
  });
  sections.push({ type: 'divider' });

  // 10. eConsult
  sections.push({ type: 'heading', level: 2, text: '10. eConsult (Electronic Specialist Consultation)' });
  sections.push({ type: 'heading', level: 3, text: 'What It Does' });
  sections.push({
    type: 'paragraph',
    text: 'eConsult enables primary care providers to request asynchronous specialist opinions without sending the patient to a face-to-face specialty appointment. The primary care provider submits a structured consultation request with relevant clinical data, and a specialist reviews it and provides a documented clinical response — typically within 24–48 hours. The entire exchange is documented in the patient chart.',
  });
  sections.push({
    type: 'list',
    items: [
      'Structured eConsult request form: clinical question, relevant history, current medications, supporting documents.',
      'Specialist network routing: connect to a curated network of available specialists by specialty.',
      'Documented specialist response with actionable recommendations — appended to the patient record.',
      'Billing support: eConsults are billable under CPT 99451/99452 and earn both the requesting and consulting provider.',
      'Closed-loop tracking: follow-up questions, clarifications, and final disposition all tracked in one thread.',
      'Can replace unnecessary referrals — specialists provide guidance that allows the PCP to manage the condition.',
      'Quality measure documentation: eConsult activity supports MIPS and quality reporting requirements.',
    ],
  });
  sections.push({ type: 'heading', level: 3, text: 'Why It Matters' });
  sections.push({
    type: 'paragraph',
    text: 'The average wait time to see a specialist in the US is 24 days — and for some specialties in some markets, it exceeds 3 months. For patients who need a specialist opinion but can be managed by their PCP with guidance, eConsult eliminates that wait entirely. For primary care practices, it is also a revenue opportunity: eConsult billing codes are reimbursable, and practices earn for the intellectual work of coordinating specialist input.',
  });
  sections.push({
    type: 'list',
    items: [
      'TIME SAVINGS: eConsult answers arrive in 24–48 hours versus 24+ days for a face-to-face referral. Providers can act immediately.',
      'REVENUE IMPACT: Billable under CPT 99451 ($50–$80 per consult) and CPT 99452 ($30–$50) — adding meaningful revenue for consult coordination work.',
      'PATIENT CARE: Dramatically reduces the time patients wait for specialist guidance, improving outcomes for time-sensitive conditions.',
      'COST REDUCTION: Each eConsult that replaces an unnecessary specialist visit saves the patient $200–$500 in copays and the system significant downstream costs.',
    ],
  });
  sections.push({ type: 'divider' });

  // 11. Chronic Condition Management
  sections.push({ type: 'heading', level: 2, text: '11. Chronic Condition Management (CCM)' });
  sections.push({ type: 'heading', level: 3, text: 'What It Does' });
  sections.push({
    type: 'paragraph',
    text: 'The Chronic Condition Management module is a complete, Medicare-compliant CCM program built directly into the EMR. It enables practices to enroll eligible patients (2+ chronic conditions), deliver structured monthly care management services, document all care management time automatically, and generate compliant CCM billing claims — creating a new, recurring revenue stream for services practices are already providing informally.',
  });
  sections.push({
    type: 'list',
    items: [
      'Automatic patient eligibility identification: patients with 2+ chronic conditions are surfaced as CCM candidates.',
      'Structured care plan creation with chronic disease-specific templates for diabetes, hypertension, CHF, COPD, and 40+ conditions.',
      'Built-in time tracker: care management minutes accumulate automatically as staff document care activities.',
      'Care manager workflows: structured monthly check-in scripts, medication reconciliation, and goal tracking.',
      'Automated billing: when 20 minutes of care management time is reached, the billing team is prompted to submit CPT 99490 or 99491.',
      'Patient engagement: automated outreach for monthly check-ins, medication adherence follow-ups, and care plan reviews.',
      'CCM billing readiness dashboard: see which patients are billable this month at a glance.',
      'Coordination of care: referral tracking, specialist communication, and hospital follow-up management.',
    ],
  });
  sections.push({ type: 'heading', level: 3, text: 'Why It Matters' });
  sections.push({
    type: 'paragraph',
    text: 'CCM is one of the most consistently underutilized revenue opportunities in primary care. Medicare pays $62–$130 per patient per month for CCM services, yet fewer than 3% of eligible Medicare beneficiaries are enrolled in a formal CCM program. For a practice with 200 eligible Medicare patients, a fully deployed CCM program generates $12,400–$26,000 in additional monthly revenue — for care coordination work the practice is largely already doing.',
  });
  sections.push({
    type: 'list',
    items: [
      'TIME SAVINGS: Automated time tracking and billing triggers eliminate the manual process of identifying billable CCM encounters.',
      'REVENUE IMPACT: 200 enrolled patients at CPT 99490 = $12,400/month in new revenue. 300 patients = $18,600/month.',
      'PATIENT CARE: Formal CCM programs are associated with 20–30% reductions in hospitalization and ED utilization for enrolled patients.',
      'COST REDUCTION: Fewer hospitalizations mean lower total cost of care — critical for practices in value-based or shared savings arrangements.',
    ],
  });
  sections.push({ type: 'divider' });

  // 12. Remote Patient Monitoring
  sections.push({ type: 'heading', level: 2, text: '12. Remote Patient Monitoring (RPM)' });
  sections.push({ type: 'heading', level: 3, text: 'What It Does' });
  sections.push({
    type: 'paragraph',
    text: 'The Remote Patient Monitoring module enables practices to monitor patients\' vital signs and health metrics between office visits using FDA-cleared connected devices. Blood pressure cuffs, glucose meters, weight scales, pulse oximeters, and continuous glucose monitors transmit readings directly to the patient chart. Intelligent alert thresholds notify the care team when readings fall outside safe ranges — enabling early intervention before a crisis develops.',
  });
  sections.push({
    type: 'list',
    items: [
      'Device management: provision, assign, and track all connected monitoring devices from the RPM dashboard.',
      'Real-time data feeds: device readings appear in the patient chart within minutes of measurement.',
      'Configurable alert thresholds: set blood pressure, glucose, weight, and SpO2 alert levels per patient.',
      'Automated alert routing: out-of-range readings generate tasks for nurses and care managers.',
      'Trend visualization: 30-day, 90-day, and 12-month vital sign trend charts with statistical overlays.',
      'RPM billing automation: the system tracks daily device data days and monitoring time to generate CPT 99453, 99454, 99457, and 99458 billing.',
      'Patient app integration: patients see their own data and can communicate with the care team.',
      'Supports all major device categories: blood pressure, glucose, weight, pulse oximetry, ECG, spirometry.',
    ],
  });
  sections.push({ type: 'heading', level: 3, text: 'Why It Matters' });
  sections.push({
    type: 'paragraph',
    text: 'Remote Patient Monitoring is one of the highest-growth segments in healthcare delivery, and for good reason: it converts passive patients into actively monitored participants in their own care. For practices managing hypertension, diabetes, CHF, and COPD populations, RPM is clinically transformative — and economically, it is one of the most lucrative Medicare billing programs currently available.',
  });
  sections.push({
    type: 'list',
    items: [
      'TIME SAVINGS: Nurses can review 50+ patients\' RPM data in the time it would take to make 5 phone calls.',
      'REVENUE IMPACT: A fully enrolled panel of 100 RPM patients generates $12,000–$20,000/month in additional Medicare reimbursement.',
      'PATIENT CARE: Published studies show 35–40% reductions in hospitalizations for CHF patients on RPM; 20–25% for hypertension.',
      'COST REDUCTION: Early intervention triggered by RPM alerts prevents costly hospitalizations — each avoided admission saves $10,000–$30,000.',
    ],
  });
  sections.push({ type: 'divider' });

  // 13. Care Gap Outreach
  sections.push({ type: 'heading', level: 2, text: '13. Care Gap Outreach Engine' });
  sections.push({ type: 'heading', level: 3, text: 'What It Does' });
  sections.push({
    type: 'paragraph',
    text: 'The Care Gap Outreach Engine continuously scans your patient population against evidence-based clinical guidelines and payer HEDIS quality measures, identifies patients with open care gaps, and automatically initiates multi-channel outreach to bring those patients in or get them to complete the necessary preventive or chronic care services. It turns a passive, reactive practice into a proactive health management organization.',
  });
  sections.push({
    type: 'list',
    items: [
      'Automated care gap identification across 50+ HEDIS and preventive care measures.',
      'Multi-channel outreach: automated SMS, email, patient portal messages, and mailed letters — configurable per patient preference.',
      'Smart scheduling integration: outreach messages include direct booking links for eligible visits.',
      'Priority queue for care managers: patients are ranked by gap severity, risk score, and value-based contract requirements.',
      'Outreach campaign tracking: see open rates, response rates, and appointment conversion per gap type.',
      'Payer gap reports: identify which gaps are most critical for your specific value-based contracts and quality bonuses.',
      'Closed-gap documentation: when a care gap is closed, the system automatically updates quality measure tracking.',
    ],
  });
  sections.push({ type: 'heading', level: 3, text: 'Why It Matters' });
  sections.push({
    type: 'paragraph',
    text: 'For practices in value-based care arrangements, quality measure performance directly determines compensation. A single HEDIS measure gap closed across 1,000 patients can mean $50,000–$200,000 in quality bonus payments from payers. Beyond the financial impact, care gap closure is the operationalization of preventive medicine — the activities most likely to keep patients healthy and out of the hospital.',
  });
  sections.push({
    type: 'list',
    items: [
      'TIME SAVINGS: Automated outreach replaces manual call lists — one care manager can manage outreach for 500+ patients instead of 50.',
      'REVENUE IMPACT: Quality bonus payments tied to HEDIS performance can add $50,000–$500,000 per year for qualifying practices.',
      'PATIENT CARE: Systematic preventive care and chronic disease management is the highest-leverage clinical activity for long-term population health.',
      'COST REDUCTION: Closing preventive care gaps reduces hospitalizations, ED visits, and the total cost of care for high-risk populations.',
    ],
  });
  sections.push({ type: 'divider' });

  // 14. Credentialing Management
  sections.push({ type: 'heading', level: 2, text: '14. Credentialing Management' });
  sections.push({ type: 'heading', level: 3, text: 'What It Does' });
  sections.push({
    type: 'paragraph',
    text: 'The Credentialing Management module is a comprehensive, automated system for managing provider credentialing and re-credentialing across all payers, hospital affiliations, and licensing bodies. It tracks every expiring license, certification, DEA number, malpractice policy, and payer credentialing status — and proactively alerts the practice administration before anything lapses.',
  });
  sections.push({
    type: 'list',
    items: [
      'Centralized credentialing document repository: store licenses, certifications, diplomas, and contracts in one secure location.',
      'Automated expiration tracking with configurable alert windows (90, 60, 30 days before expiration).',
      'Payer enrollment status tracking: see which payers each provider is credentialed with and current enrollment status.',
      'Re-credentialing workflow automation: generate application packets, track submission status, and follow up on pending applications.',
      'CAQH profile management: sync data with the CAQH Universal Provider Datasource.',
      'Multi-state license tracking for providers practicing across state lines or via telehealth.',
      'Primary source verification for new hires: verify medical school, residency, board certifications, and disciplinary history.',
      'Credentialing reports: payer enrollment coverage, expiration calendars, and application status dashboards.',
    ],
  });
  sections.push({ type: 'heading', level: 3, text: 'Why It Matters' });
  sections.push({
    type: 'paragraph',
    text: 'A lapsed license or expired payer credentialing can halt a provider\'s ability to see patients or bill for services overnight. The downstream financial impact of a single credentialing lapse can be catastrophic: a provider who cannot bill for 30–60 days while credentialing is resolved represents $30,000–$100,000 in lost revenue. Proactive credentialing management eliminates this risk entirely.',
  });
  sections.push({
    type: 'list',
    items: [
      'TIME SAVINGS: Automated expiration tracking and workflow management reduces credentialing administrative time by 70% compared to manual spreadsheet management.',
      'REVENUE IMPACT: Preventing a single credentialing lapse for one provider easily justifies the annual cost of the module — and eliminates a significant financial risk.',
      'PATIENT CARE: Ensures providers are always credentialed to deliver care — patients never encounter access disruptions due to administrative credentialing failures.',
      'COST REDUCTION: Eliminates the cost of credentialing services ($1,000–$3,000 per provider per application) by managing the process in-house.',
    ],
  });
  sections.push({ type: 'divider' });

  // 15. Compliance & Regulatory Tracking
  sections.push({ type: 'heading', level: 2, text: '15. Compliance & Regulatory Tracking' });
  sections.push({ type: 'heading', level: 3, text: 'What It Does' });
  sections.push({
    type: 'paragraph',
    text: 'The Compliance & Regulatory Tracking module provides a unified compliance command center for all regulatory obligations facing a modern medical practice — HIPAA, OSHA, MIPS/MACRA, OIG exclusion screening, information blocking rules, and state-specific requirements. It automates compliance monitoring, generates audit-ready reports, and maintains the documentation trail required for regulatory defense.',
  });
  sections.push({
    type: 'list',
    items: [
      'HIPAA compliance dashboard: tracks audit log completeness, access patterns, breach risk indicators, and BAA status.',
      'MIPS/MACRA quality measure tracking: real-time performance scores against all applicable quality, promoting interoperability, and improvement activity measures.',
      'OIG and SAM exclusion screening: automated monthly screening of all staff against federal exclusion databases.',
      'Information blocking compliance monitoring: ensures the practice meets ONC information blocking rules (21st Century Cures Act).',
      'Documentation quality thresholds: configurable compliance rules per provider with deviation alerts.',
      'OSHA compliance tracking: maintain safety training logs, incident reports, and required documentation.',
      'State-specific compliance alerts: tracks state medical board, pharmacy board, and licensing authority requirements.',
      'Audit readiness reports: generate HIPAA Security Rule, HIPAA Privacy Rule, and MIPS compliance reports on demand.',
      'Policy acknowledgment tracking: ensure all staff have reviewed and acknowledged current policies.',
    ],
  });
  sections.push({ type: 'heading', level: 3, text: 'Why It Matters' });
  sections.push({
    type: 'paragraph',
    text: 'Regulatory non-compliance is not just a financial risk — it is an existential one. HIPAA violations carry fines of $100–$50,000 per violation, per year. A single CMS audit finding can result in a five-year Corporate Integrity Agreement that costs millions to administer. MIPS performance below threshold triggers payment adjustments of -9% across all Medicare claims. The Compliance & Regulatory Tracking module is the infrastructure that ensures your practice stays on the right side of every regulatory obligation — not reactively, but systematically.',
  });
  sections.push({
    type: 'list',
    items: [
      'TIME SAVINGS: Automated monitoring and reporting eliminates the manual compliance calendar management that typically consumes 5–10 hours per week of administrative time.',
      'REVENUE IMPACT: Strong MIPS performance earns positive payment adjustments of up to +9% on Medicare claims — a significant sum for high-volume Medicare practices.',
      'PATIENT CARE: Robust compliance infrastructure ensures patients\' privacy is protected, their data is handled correctly, and their information is available when and where it is needed.',
      'COST REDUCTION: Proactive compliance is exponentially cheaper than reactive defense. Avoiding a single HIPAA investigation or CMS audit finding can save $100,000–$1,000,000+ in legal and remediation costs.',
    ],
  });
  sections.push({ type: 'divider' });

  // Closing CTA
  sections.push({ type: 'heading', level: 2, text: 'Your Investment. Your Return.' });
  sections.push({
    type: 'paragraph',
    text: 'Each of these add-on modules is priced as a transparent monthly fee that delivers a measurable, quantifiable return on investment. The practices that invest in premium add-ons consistently outperform peers on revenue metrics, quality scores, and staff satisfaction. More importantly, they deliver a level of care that patients recognize and recommend.',
  });
  sections.push({
    type: 'table',
    headers: ['Add-On Module', 'Primary ROI Driver', 'Est. Annual Value Range'],
    rows: [
      ['AI Clinical Copilot', 'HCC coding + time savings', '$30,000–$80,000'],
      ['Advanced Voice Transcription', 'Documentation time + burnout reduction', '$40,000–$120,000'],
      ['Differential Diagnosis', 'Diagnostic accuracy + coding precision', '$10,000–$40,000'],
      ['Predictive Risk Analytics', 'HCC coding + value-based bonuses', '$20,000–$100,000'],
      ['Full RCM Automation', 'Revenue recovery + staff efficiency', '$50,000–$200,000'],
      ['Denial Management', 'Claim recovery + process improvement', '$40,000–$150,000'],
      ['Secondary Claims', 'Secondary payer recovery', '$15,000–$40,000'],
      ['HL7 Integration', 'Staff time + duplicate test reduction', '$15,000–$50,000'],
      ['HIE Access', 'Duplicate testing + coding accuracy', '$10,000–$30,000'],
      ['eConsult', 'New billing revenue', '$10,000–$30,000'],
      ['Chronic Condition Management', 'CCM billing revenue', '$50,000–$200,000'],
      ['Remote Patient Monitoring', 'RPM billing revenue', '$120,000–$240,000'],
      ['Care Gap Outreach', 'Quality bonuses + preventive revenue', '$50,000–$500,000'],
      ['Credentialing Management', 'Risk mitigation + admin time', '$20,000–$60,000'],
      ['Compliance & Regulatory', 'Risk mitigation + MIPS adjustment', '$30,000–$200,000'],
    ],
  });
  sections.push({
    type: 'paragraph',
    text: 'To learn more about adding any of these modules to your CareMetric AI subscription, contact your account manager or visit caremetric.ai. Every add-on comes with full onboarding support, training materials, and dedicated customer success management.',
  });
  sections.push({
    type: 'paragraph',
    text: 'CareMetric AI — Built for practices that refuse to settle for ordinary.',
  });

  return sections;
}
