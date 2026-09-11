import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdtemp, realpath, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {isAbsolute, join, relative, resolve, sep} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {prepareRenderer, renderTutorial} from './render.mjs';
import {workerClient} from './client.mjs';
import {RENDER_PROTOCOL} from '../../contracts/hub-render-job.mjs';

const sourceRevision = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.DOCSTUDIO_SOURCE_REVISION;
const client = workerClient({origin: process.env.HUB_ORIGIN,
  credential: process.env.DOCSTUDIO_WORKER_TOKEN, workerId: randomUUID(), sourceRevision});
const stopping = new AbortController();
let ready = false;
const health = createServer((req, res) => {
  if (req.method !== 'GET' || req.url !== '/health') { res.writeHead(404); res.end(); return; }
  res.writeHead(ready ? 200 : 503, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify({ready, protocol: RENDER_PROTOCOL, sourceRevision}));
});
health.listen(Number(process.env.PORT || 8080), '0.0.0.0');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { ready = false; stopping.abort(); health.close(); });

const parent = await realpath(tmpdir());
const root = await mkdtemp(join(parent, 'caremetric-docstudio-worker-'));
async function removeOwned(path) {
  const actual = await realpath(path), child = relative(root, actual);
  if (actual !== resolve(path) || isAbsolute(child) || child === '..' || child.startsWith(`..${sep}`)) throw new Error('Unsafe worker cleanup path');
  await rm(actual, {recursive: true, force: false});
}

try {
  const serveUrl = await prepareRenderer(join(root, 'bundle'));
  while (!stopping.signal.aborted) {
    let job;
    try {
      await client.ping(stopping.signal); ready = true;
      job = await client.claim(stopping.signal);
    } catch { ready = false; }
    if (!job) {
      await delay(5000, undefined, {signal: stopping.signal}).catch(() => {});
      continue;
    }
    const run = new AbortController();
    const signal = AbortSignal.any([run.signal, stopping.signal, AbortSignal.timeout(2 * 60 * 60 * 1000)]);
    const directory = await mkdtemp(join(root, 'job-'));
    let progress = 0, renewing = false;
    const renewal = setInterval(async () => {
      if (renewing || signal.aborted) return;
      renewing = true;
      try { if (!await client.renew(job, progress, signal)) run.abort(); }
      catch { run.abort(); }
      finally { renewing = false; }
    }, 10000);
    try {
      const assets = new Map();
      for (const asset of job.manifest.assets) assets.set(asset.id, await client.source(job, asset, signal));
      const result = await renderTutorial({manifest: job.manifest, assetBytes: assets, serveUrl,
        outputDirectory: join(directory, 'output'), signal, onProgress: value => { progress = value; }});
      for (const artifact of result.artifacts) await client.upload(job, artifact, signal);
      if (!await client.renew(job, 98, signal)) throw new Error('Lease no longer active');
      await client.complete(job, result, signal);
      console.info('A leased DocStudio render completed with verified output.');
    } catch {
      // A lost lease or a cancelled job cannot be converted into a successful
      // completion. The DB checks the current lease on this bounded failure too.
      await client.fail(job, stopping.signal).catch(() => {});
      console.warn('A DocStudio render did not complete; the Hub retains its job state.');
    } finally { clearInterval(renewal); await removeOwned(directory); }
  }
} finally {
  ready = false; health.close();
  const actual = await realpath(root), child = relative(parent, actual);
  if (actual !== resolve(root) || isAbsolute(child) || child.startsWith(`..${sep}`) || !child.startsWith('caremetric-docstudio-worker-')) throw new Error('Unsafe worker root cleanup');
  await rm(actual, {recursive: true, force: false});
}
