export const GENERATED_NOTE = {
  subjective: `Patient is a 54-year-old female presenting with intermittent chest pain for the past 3 days. Pain is substernal, radiating to the left arm, described as pressure-like, rated 6/10 at worst. Exacerbated by physical exertion and emotional stress. Relieved partially by rest. Denies shortness of breath at rest, palpitations, diaphoresis, or syncope. Reports mild dyspnea on exertion climbing stairs. No recent illness, trauma, or dietary changes. Currently taking Lisinopril 20mg daily, Metformin 1000mg BID, Atorvastatin 40mg daily.`,
  objective: `Vitals: BP 145/92 mmHg, HR 88 bpm, Temp 98.6°F, SpO2 97% on RA, BMI 31.2
General: Alert, oriented, mild distress during discussion of symptoms
CV: Regular rate and rhythm, no murmurs/gallops/rubs, S1/S2 normal
Lungs: Clear to auscultation bilaterally, no wheezing or rales
Abdomen: Soft, non-tender, non-distended`,
  assessment: `1. Chest pain, unspecified (R07.9) - concerning for unstable angina given risk factors
2. Essential hypertension, uncontrolled (I10) - BP above target
3. Type 2 diabetes mellitus (E11.9) - stable on current regimen
4. Hyperlipidemia (E78.5) - on statin therapy`,
  plan: `1. STAT EKG and troponin levels to rule out acute coronary syndrome
2. Chest X-ray PA and lateral
3. Increase Lisinopril to 40mg daily for better BP control
4. Refer to Cardiology for stress test evaluation
5. Continue current diabetes and lipid management
6. Patient education on cardiac warning signs, when to call 911
7. Follow-up in 1 week or sooner if symptoms worsen
8. Aspirin 81mg daily if no contraindications`,
};

export const CODING_SUGGESTIONS = [
  { code: 'I20.0', description: 'Unstable angina', confidence: 92 },
  { code: 'R07.9', description: 'Chest pain, unspecified', confidence: 88 },
  { code: 'I10', description: 'Essential hypertension', confidence: 95 },
  { code: 'E11.9', description: 'Type 2 DM without complications', confidence: 90 },
  { code: '99214', description: 'Office visit, moderate complexity', confidence: 87 },
];

export const COMPLETENESS_ITEMS = [
  'Chief complaint documented',
  'History of present illness',
  'Review of systems',
  'Physical examination',
  'Assessment with ICD-10 codes',
  'Plan with specific orders',
  'Medication reconciliation',
  'Patient education documented',
];
