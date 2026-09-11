import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareSupportHubExport, publicationReviewSnapshot, EXPORT_LIMITS } from './support-hub-export.mjs';

const input = () => ({
  draft: { status: 'approved', reviewed_at: '2026-09-11T12:00:00Z', reviewed_by: 'reviewer', revalidation_required: false,
    output_type: 'screenshot_guide', edited_content: { guide_md: '# Getting started\r\nRésumé ✓\n' }, generated_content: { guide_md: 'old' } },
  metadata: { source: { content_key: 'carebase.getting-started', version: 'docstudio-v1' },
    content: { title: 'Getting started', summary: 'Learn the basic controls.', locale: 'en', access_level: 'customer' },
    placements: [{ product_slug: 'carebase', audience: ['all'], route_pattern: '/courses/**' }] },
  phiReviewed: true, approvedAt: '2026-09-11T13:00:00.000Z',
});
test('article exact bytes, Unicode, newlines and digest survive exported manifest and asset', async () => {
  const value = input(); const result = await prepareSupportHubExport(value);
  const bytes = Buffer.from(await result.files[1].blob.arrayBuffer());
  assert.equal(bytes.toString(), value.draft.edited_content.guide_md);
  const manifest = JSON.parse(await result.files[0].blob.text());
  assert.equal(manifest.artifact.byte_length, bytes.length);
  assert.equal(manifest.artifact.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(result.files.map(file => file.part), ['manifest', 'primary']);
  assert.equal(JSON.stringify(manifest).includes('reviewer'), false);
});
test('empty edited material cannot fall back to unreviewed generated text', async () => {
  const value = input(); value.draft.edited_content.guide_md = '';
  await assert.rejects(prepareSupportHubExport(value), /nonempty/);
});
test('re-exporting an unchanged review preserves the immutable manifest identity', async () => {
  const first = await prepareSupportHubExport(input());
  const second = await prepareSupportHubExport(input());
  assert.equal(await first.files[0].blob.text(), await second.files[0].blob.text());
  assert.equal(JSON.parse(await first.files[0].blob.text()).governance.approved_at, input().draft.reviewed_at);
});
test('review status, revocation, revalidation and exact-material attestation are required', async () => {
  for (const patch of [{ status: 'draft' }, { status: 'archived' }, { reviewed_by: null }, { reviewed_at: null }, { revalidation_required: true }]) {
    const value = input(); Object.assign(value.draft, patch);
    await assert.rejects(prepareSupportHubExport(value), /current completed review/);
  }
  await assert.rejects(prepareSupportHubExport({ ...input(), phiReviewed: false }), /Review the exact/);
});
test('manifest contract rejects unsafe metadata and nonmonotonic source syntax', async () => {
  const value = input(); value.metadata.content.title = 'Patient name: Example';
  await assert.rejects(prepareSupportHubExport(value), /identifier/);
  value.metadata.content.title = 'Getting started'; value.metadata.source.version = 'docstudio-v01';
  await assert.rejects(prepareSupportHubExport(value), /invalid format/);
});
function videoInput() {
  const value = input(); value.draft.output_type = 'video_tutorial';
  return { ...value, primary: new Blob([Uint8Array.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115, 111, 109, 109, 112, 52, 49])]),
    durationMs: 1000, captions: new Blob(['WEBVTT\n\n00:00.000 --> 00:01.000\nHello\n']), transcript: new Blob(['Hello']) };
}
test('video sidecars keep exact bytes and distinct digest associations', async () => {
  const value = videoInput(); const result = await prepareSupportHubExport(value);
  assert.deepEqual(result.files.map(file => file.part), ['manifest', 'primary', 'captions', 'transcript']);
  const manifest = JSON.parse(await result.files[0].blob.text());
  for (const [index, field] of [[1, 'sha256'], [2, 'captions_sha256'], [3, 'transcript_sha256']]) {
    assert.equal(manifest.artifact[field], createHash('sha256').update(Buffer.from(await result.files[index].blob.arrayBuffer())).digest('hex'));
  }
});
test('rejects wrong containers, mislabeled captions, binary text and invalid duration', async () => {
  for (const patch of [{ primary: new Blob(['not mp4']) }, { captions: new Blob(['1\n00:00,000 --> 00:01,000\nHello']) },
    { transcript: new Blob([new Uint8Array([255, 254])]) }, { durationMs: 0 }]) {
    await assert.rejects(prepareSupportHubExport({ ...videoInput(), ...patch }));
  }
});
test('size checks happen before material is read', async () => {
  const value = input(); value.draft.edited_content.guide_md = 'a'.repeat(EXPORT_LIMITS.article + 1);
  await assert.rejects(prepareSupportHubExport(value), /at most 2 MiB/);
  const over = new Blob(['x']); Object.defineProperty(over, 'size', { value: EXPORT_LIMITS.video + 1 });
  over.arrayBuffer = () => { throw new Error('Must not read oversized material'); };
  await assert.rejects(prepareSupportHubExport({ ...videoInput(), primary: over }), /at most 50 MiB/);
});
test('articles reject video sidecars instead of silently dropping selected material', async () => {
  await assert.rejects(prepareSupportHubExport({ ...input(), transcript: new Blob(['Hello']) }), /cannot include/);
});
test('review snapshot invalidates for revocation and changed fallback bytes without updated_at changing', () => {
  const draft = input().draft;
  const snapshot = publicationReviewSnapshot(draft);
  for (const patch of [{ status: 'draft' }, { reviewed_at: '2026-09-12T00:00:00Z' }, { reviewed_by: null },
    { revalidation_required: true }, { edited_content: { guide_md: 'changed' } }]) {
    assert.notEqual(publicationReviewSnapshot({ ...draft, ...patch }), snapshot);
  }
  const fallback = { ...draft, edited_content: {} };
  assert.notEqual(publicationReviewSnapshot(fallback), publicationReviewSnapshot({ ...fallback, generated_content: { guide_md: 'changed' } }));
});
