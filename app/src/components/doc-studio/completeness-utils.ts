import type { CompletenessChecklistItem, DocStudioDraft } from '../../types/doc-studio';

export function computeChecklistFromDraft(draft: Partial<DocStudioDraft>): CompletenessChecklistItem[] {
  const add = (key: string, label: string, passed: boolean): CompletenessChecklistItem => ({ key, label, passed });
  const items: CompletenessChecklistItem[] = [
    add('title', 'Title is set', typeof draft.title === 'string' && draft.title.trim().length > 3),
    add('description', 'Description is set', typeof draft.description === 'string' && draft.description.trim().length > 10),
    add('steps', 'At least 3 steps defined', Array.isArray(draft.steps) && draft.steps.length >= 3),
  ];

  const ec = draft.edited_content as Record<string, unknown> | undefined;
  const gc = draft.generated_content as Record<string, unknown> | string | undefined;
  const gcObj = typeof gc === 'string' ? { guide_md: gc } : gc;
  const guideText = String(ec?.guide_md ?? ec?.rawMarkdown ?? gcObj?.guide_md ?? '');
  items.push(add('guide_content', 'Guide content ≥ 200 characters', guideText.trim().length >= 200));

  const transcript = String(ec?.transcript ?? ec?.narration_script ?? gcObj?.transcript ?? gcObj?.narration_script ?? '');
  items.push(add('transcript', 'Transcript is present', transcript.trim().length > 0));

  if (draft.output_type === 'video_tutorial' || draft.output_type === 'narrated_video') {
    const hasVideo = (draft.assets ?? []).some(a => a.asset_type === 'video');
    items.push(add('video_asset', 'Video asset uploaded', hasVideo));
  }
  if (draft.output_type === 'narrated_video') {
    const hasAudio = (draft.assets ?? []).some(a => a.asset_type === 'audio');
    items.push(add('audio_asset', 'Audio narration uploaded', hasAudio));
  }

  return items;
}

export function computeScore(checklist: CompletenessChecklistItem[]): number {
  if (!checklist.length) return 0;
  return Math.round((checklist.filter(c => c.passed).length / checklist.length) * 100);
}
