import { buildSupportHubPublicationManifest } from './support-hub-publication.mjs';

// Browser-local exports are deliberately bounded. The Hub separately reports and
// enforces its deployed upload limit; these values do not promise Storage capacity.
export const EXPORT_LIMITS = Object.freeze({ article: 2 * 1024 ** 2, video: 50 * 1024 ** 2, sidecar: 10 * 1024 ** 2 });
const encoder = new TextEncoder();

export function publicationReviewSnapshot(draft) {
  return JSON.stringify([draft.id, draft.updated_at, draft.status, draft.reviewed_at, draft.reviewed_by,
    draft.revalidation_required, draft.output_type,
    draft.output_type === 'screenshot_guide' ? (draft.edited_content?.guide_md ?? draft.generated_content?.guide_md ?? '') : null]);
}

export function assertReviewedDraft(draft) {
  if (!draft || !['approved', 'published'].includes(draft.status) || !draft.reviewed_at || !draft.reviewed_by || draft.revalidation_required) {
    throw new Error('This draft needs a current completed review before Hub export.');
  }
}

async function inspectPart(blob, type, maximum) {
  if (!(blob instanceof Blob) || blob.size < 1 || blob.size > maximum) {
    throw new Error(`${type}: select a nonempty file of at most ${maximum / 1024 ** 2} MiB.`);
  }
  const bytes = await blob.arrayBuffer();
  if (type === 'video/mp4') {
    const header = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 32));
    if (header.length < 12 || String.fromCharCode(...header.slice(4, 8)) !== 'ftyp') throw new Error('The video must be an MP4 file.');
  } else {
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error(`${type}: UTF-8 text is required.`); }
    if (!text.trim() || /\u0000/.test(text)) throw new Error(`${type}: readable text is required.`);
    if (type === 'text/vtt' && !/^WEBVTT(?:[ \t].*)?(?:\r?\n|$)/.test(text)) throw new Error('Captions must be WebVTT, with a WEBVTT header.');
  }
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
  // Retain the immutable snapshot we hashed, even if an underlying local file changes.
  return { blob: new Blob([bytes], { type }), sha256 };
}

export async function prepareSupportHubExport({ draft, metadata, primary, captions, transcript, durationMs, phiReviewed }) {
  assertReviewedDraft(draft);
  if (phiReviewed !== true) throw new Error('Review the exact material and confirm it contains no patient or personal information.');
  const kind = draft.output_type === 'screenshot_guide' ? 'article' : 'video';
  if (kind === 'article' && (captions || transcript || durationMs !== undefined)) throw new Error('Article exports cannot include video attachments.');
  if (kind === 'video' && (!captions || !transcript)) throw new Error('Video exports require both WebVTT captions and a plain-text transcript.');
  const mediaType = kind === 'article' ? 'text/markdown' : 'video/mp4';
  const source = kind === 'article'
    ? new Blob([encoder.encode(draft.edited_content?.guide_md ?? draft.generated_content?.guide_md ?? '')], { type: mediaType })
    : primary;
  const main = await inspectPart(source, mediaType, EXPORT_LIMITS[kind]);
  const captionPart = captions ? await inspectPart(captions, 'text/vtt', EXPORT_LIMITS.sidecar) : null;
  const transcriptPart = transcript ? await inspectPart(transcript, 'text/plain', EXPORT_LIMITS.sidecar) : null;
  const manifest = buildSupportHubPublicationManifest({
    source: metadata.source,
    content: { ...metadata.content, kind },
    artifact: {
      sha256: main.sha256, media_type: mediaType, byte_length: main.blob.size,
      ...(kind === 'video' ? { duration_ms: durationMs } : {}),
      ...(captionPart ? { captions_sha256: captionPart.sha256 } : {}),
      ...(transcriptPart ? { transcript_sha256: transcriptPart.sha256 } : {}),
    },
    governance: { review_state: 'approved', phi_review: 'passed', approved_at: draft.reviewed_at, policy_version: 'docstudio-phi-free-v1' },
    placements: metadata.placements,
  });
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  if (encoder.encode(serialized).length > 64 * 1024) throw new Error('Publication manifest exceeds the Hub limit.');
  const basename = `${manifest.source.content_key}-${manifest.source.version}`;
  return {
    manifest,
    files: [
      { part: 'manifest', name: `${basename}.publication.json`, blob: new Blob([serialized], { type: 'application/json' }) },
      { part: 'primary', name: `${basename}.${kind === 'article' ? 'md' : 'mp4'}`, blob: main.blob },
      ...(captionPart ? [{ part: 'captions', name: `${basename}.vtt`, blob: captionPart.blob }] : []),
      ...(transcriptPart ? [{ part: 'transcript', name: `${basename}.txt`, blob: transcriptPart.blob }] : []),
    ],
  };
}
