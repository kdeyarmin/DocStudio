export interface TranscriptLine {
  speaker: 'provider' | 'patient';
  text: string;
  revealFrame: number;
}

export const TRANSCRIPT_LINES: TranscriptLine[] = [
  { speaker: 'provider', text: 'Good morning. What brings you in today?', revealFrame: 80 },
  { speaker: 'patient', text: 'I have been having headaches for about two weeks now. They come and go but they are getting more frequent.', revealFrame: 140 },
  { speaker: 'provider', text: 'Can you describe the pain? Is it throbbing, sharp, or more of a pressure feeling?', revealFrame: 220 },
  { speaker: 'patient', text: 'It is more of a pressure behind my eyes, usually worse in the afternoon. Sometimes I feel nauseous too.', revealFrame: 290 },
  { speaker: 'provider', text: 'How would you rate the pain on a scale of 1 to 10?', revealFrame: 370 },
  { speaker: 'patient', text: 'About a 7 when it is at its worst. I have been taking ibuprofen but it only helps a little.', revealFrame: 420 },
  { speaker: 'provider', text: 'Any visual changes? Sensitivity to light or sound?', revealFrame: 490 },
  { speaker: 'patient', text: 'Yes, bright lights definitely make it worse. I have been avoiding my computer screen.', revealFrame: 540 },
];

export const AMBIENT_GENERATED_NOTE = {
  chiefComplaint: 'Recurrent headaches x 2 weeks, worsening in frequency',
  subjective: `Patient reports 2-week history of recurrent headaches described as pressure-type pain behind the eyes, predominantly in the afternoon. Rates pain 7/10 at worst. Associated symptoms include nausea and photosensitivity. Reports difficulty with screen use. Taking OTC ibuprofen with partial relief.`,
  objective: `Vitals: BP 128/82 mmHg, HR 72 bpm, Temp 98.4°F
Neuro: Alert, oriented x4, PERRLA, no papilledema on fundoscopic exam
HEENT: No sinus tenderness, neck supple, no meningeal signs`,
  assessment: `1. Migraine without aura (G43.909) - new diagnosis
2. Tension-type headache (G44.209) - differential diagnosis`,
  plan: `1. Start Sumatriptan 50mg PRN for acute episodes
2. Headache diary for 4 weeks
3. MRI brain if no improvement in 4 weeks
4. Follow-up in 4 weeks to reassess`,
};

export const AMBIENT_CODES = [
  { code: 'G43.909', description: 'Migraine, unspecified', type: 'ICD-10' },
  { code: 'R51.9', description: 'Headache, unspecified', type: 'ICD-10' },
  { code: '99214', description: 'Office visit, moderate', type: 'CPT' },
];
