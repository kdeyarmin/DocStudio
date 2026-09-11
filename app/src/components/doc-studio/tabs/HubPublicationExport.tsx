import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { useDocStudioDraft } from '../../../hooks/useDocStudio';
import { REGISTERED_SUPPORT_HUB_PRODUCTS } from '../../../../../contracts/support-hub-publication.mjs';
import { prepareSupportHubExport, publicationReviewSnapshot, type ExportMetadata, type PublicationExport } from '../../../../../contracts/support-hub-export.mjs';

const HUB_IMPORT = 'https://support-hub-web-production.up.railway.app/imports/docstudio';
const productNames: Record<string, string> = { breathe: 'Breathe', carebase: 'CareBase', 'caremetric-emr': 'CareMetric EMR', 'caremetric-go': 'CareMetric Go', 'caremetric-intel': 'CareMetric Intel', pennsync: 'PennSync' };
const fieldClass = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function HubPublicationExport({ draftId }: { draftId: string }) {
  const query = useDocStudioDraft(draftId);
  if (!query.data) return <p role={query.isError ? 'alert' : 'status'} className="text-sm text-slate-600">{query.isError ? 'Unable to load the draft for Hub export.' : 'Loading Hub export…'}</p>;
  // Native integrity updates do not always advance updated_at. Bind review to
  // every authority field and the effective saved bytes, without a lossy hash.
  return <HubPublicationForm key={publicationReviewSnapshot(query.data)} query={query} />;
}

function HubPublicationForm({ query }: { query: ReturnType<typeof useDocStudioDraft> }) {
  const [contentKey, setContentKey] = useState('');
  const [version, setVersion] = useState('1');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [locale, setLocale] = useState('en');
  const [access, setAccess] = useState<ExportMetadata['content']['access_level']>('customer');
  const [placements, setPlacements] = useState<ExportMetadata['placements']>([]);
  const [primary, setPrimary] = useState<File>();
  const [captions, setCaptions] = useState<File>();
  const [transcript, setTranscript] = useState<File>();
  const [duration, setDuration] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PublicationExport | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const draft = query.data;
  const kind = draft?.output_type === 'screenshot_guide' ? 'article' : 'video';
  const approved = draft && ['approved', 'published'].includes(draft.status) && draft.reviewed_at && draft.reviewed_by && !draft.revalidation_required;
  const invalidate = () => { generation.current++; setResult(null); setReviewed(false); setError(''); };

  async function prepare() {
    const currentGeneration = ++generation.current;
    setBusy(true); setError(''); setResult(null);
    try {
      const fresh = await query.refetch();
      if (fresh.error || !fresh.data) throw new Error('Unable to confirm the current draft. Reload and try again.');
      if (!draft || publicationReviewSnapshot(fresh.data) !== publicationReviewSnapshot(draft)) {
        throw new Error('The saved draft changed. Review the current material and prepare it again.');
      }
      const prepared = await prepareSupportHubExport({
        draft: fresh.data,
        metadata: { source: { content_key: contentKey, version: `docstudio-v${version}` }, content: { title, summary, locale, access_level: access }, placements },
        primary, captions, transcript, ...(kind === 'video' ? { durationMs: Math.round(Number(duration) * 1000) } : {}),
        phiReviewed: reviewed,
      });
      if (generation.current === currentGeneration) setResult(prepared);
    } catch (caught) {
      if (generation.current === currentGeneration) setError(caught instanceof Error ? caught.message : 'Could not prepare export.');
    } finally { setBusy(false); }
  }

  return <section className="rounded-xl border border-blue-200 bg-white p-4 space-y-4" aria-labelledby="hub-export-heading">
    <div><h2 id="hub-export-heading" className="font-semibold text-slate-900">Publish to CareMetric Hub</h2>
      <p className="mt-1 text-sm text-slate-600">Prepare reviewed material for the shared library. Download each file, then open the Hub to upload and approve its app placements.</p></div>
    {query.isError && <p role="alert" className="text-sm text-red-700">The draft could not be loaded. Reload this screen.</p>}
    {!approved && <p role="status" className="text-sm text-amber-800">Complete the draft review and any required revalidation before preparing an export.</p>}
    <fieldset disabled={busy || !approved} className="space-y-4 disabled:opacity-60" onChange={invalidate}>
      <legend className="sr-only">Hub publication settings</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Stable content key<input className={fieldClass} value={contentKey} onChange={event => setContentKey(event.target.value)} placeholder="carebase.getting-started" maxLength={120} /></label>
        <label className="text-sm">Publication version<input className={fieldClass} value={version} onChange={event => setVersion(event.target.value)} inputMode="numeric" maxLength={15} aria-describedby="hub-version-help" /></label>
        <label className="text-sm">Library title<input className={fieldClass} value={title} onChange={event => setTitle(event.target.value)} maxLength={180} /></label>
        <label className="text-sm">Language<input className={fieldClass} value={locale} onChange={event => setLocale(event.target.value)} maxLength={16} /></label>
      </div>
      <p id="hub-version-help" className="text-xs text-slate-500">Keep the same content key for updates. Use a higher whole-number version for changed material.</p>
      <label className="block text-sm">Library summary<textarea className={fieldClass} value={summary} onChange={event => setSummary(event.target.value)} maxLength={500} rows={2} /></label>
      <label className="block text-sm">Access<select className={fieldClass} value={access} onChange={event => {
        const next = event.target.value as typeof access; setAccess(next);
        if (next === 'public') setPlacements(values => values.map(value => ({ ...value, audience: ['all'] })));
      }}><option value="customer">Customers</option><option value="staff">CareMetric staff</option><option value="public">Public</option></select></label>
      <fieldset className="space-y-2"><legend className="text-sm font-medium mb-2">App placements</legend>
        {REGISTERED_SUPPORT_HUB_PRODUCTS.map(product => {
          const selected = placements.find(value => value.product_slug === product);
          const update = (changes: Partial<ExportMetadata['placements'][number]>) => setPlacements(values => values.map(value => value.product_slug === product ? { ...value, ...changes } : value));
          return <div key={product} className="rounded-lg bg-slate-50 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(selected)} onChange={event => setPlacements(values => event.target.checked ? [...values, { product_slug: product, audience: ['all'], route_pattern: null }] : values.filter(value => value.product_slug !== product))} />{productNames[product]}</label>
            {selected && <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs">Audience<select className={fieldClass} value={selected.audience[0]} disabled={access === 'public'} onChange={event => update({ audience: [event.target.value] })}><option value="all">All eligible readers</option><option value="customer">Customer</option><option value="customer-admin">Customer administrator</option><option value="manager">Manager</option></select></label>
              <label className="text-xs">App path (optional)<input className={fieldClass} value={selected.route_pattern ?? ''} onChange={event => update({ route_pattern: event.target.value || null })} placeholder="/courses/**" maxLength={160} /></label>
            </div>}
          </div>;
        })}
      </fieldset>
      {kind === 'article' ? <div className="space-y-2"><p className="text-sm">The saved edited guide is exported as exact UTF-8 Markdown (up to 2 MiB).</p><details className="text-sm"><summary className="cursor-pointer">Review the saved guide</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3">{draft?.edited_content?.guide_md ?? draft?.generated_content?.guide_md ?? 'No saved guide available.'}</pre></details></div> : <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Reviewed MP4 (up to 50 MiB)<input className={fieldClass} type="file" accept="video/mp4,.mp4" onChange={event => setPrimary(event.target.files?.[0])} /></label>
        <label className="text-sm">Video duration in seconds<input className={fieldClass} value={duration} onChange={event => setDuration(event.target.value)} inputMode="decimal" /></label>
        <label className="text-sm">Captions (optional WebVTT)<input className={fieldClass} type="file" accept="text/vtt,.vtt" onChange={event => setCaptions(event.target.files?.[0])} /></label>
        <label className="text-sm">Transcript (optional plain text)<input className={fieldClass} type="file" accept="text/plain,.txt" onChange={event => setTranscript(event.target.files?.[0])} /></label>
      </div>}
      <p className="text-xs text-slate-500">The Hub checks its current upload limit before accepting files. Media, titles and summaries must contain no patient or personal information. A manifest does not grant publishing access.</p>
    </fieldset>
    <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" disabled={busy || !approved} checked={reviewed} onChange={event => { generation.current++; setResult(null); setReviewed(event.target.checked); }} />I reviewed these exact files, their content and the selected placements, and confirm the material contains no patient or personal information.</label>
    <button type="button" disabled={busy || !approved || !reviewed} onClick={prepare} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Checking material…' : 'Prepare Hub export'}</button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {result && <div role="status" className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-3">
      <p className="text-sm font-medium">Export ready. Download every file below and keep them together.</p>
      <div className="flex flex-wrap gap-2">{result.files.map(file => <button key={file.part} type="button" onClick={() => download(file.blob, file.name)} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm"><Download size={14} />{file.part} ({file.blob.size.toLocaleString()} bytes)</button>)}</div>
      <p className="break-all font-mono text-xs">SHA-256: {result.manifest.artifact.sha256}</p>
      <a href={HUB_IMPORT} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-blue-800">Open Hub publishing <ExternalLink size={14} /></a>
    </div>}
  </section>;
}
