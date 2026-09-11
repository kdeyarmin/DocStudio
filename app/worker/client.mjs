import {createReadStream} from 'node:fs';
import {MAX_RENDER_BYTES, MAX_SOURCE_BYTES, parseRenderManifest, RENDER_PROTOCOL} from '../../contracts/hub-render-job.mjs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const token = /^[A-Za-z0-9_-]{43}$/;
const kinds = new Set(['primary', 'captions', 'transcript']);

export class WorkerTransportError extends Error {
  constructor(status) { super('Hub worker request could not complete'); this.status = status; }
}
async function boundedBytes(response, limit) {
  const chunks = []; let length = 0;
  try {
    for await (const value of response.body ?? []) {
      length += value.length;
      if (length > limit) throw new Error('Worker response exceeds the allowed size');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } catch (error) { await response.body?.cancel().catch(() => {}); throw error; }
}

export function workerClient({origin, credential, workerId, sourceRevision, fetchImpl = fetch}) {
  if (origin !== 'https://support-hub-web-production.up.railway.app' || !token.test(credential)
      || !uuid.test(workerId) || !/^[a-f0-9]{40}$/.test(sourceRevision)) throw new Error('Invalid worker configuration');
  const endpoint = `${origin}/api/internal/docstudio/worker`;
  const authorization = `Bearer ${credential}`;
  function lease(job) {
    if (!uuid.test(job.manifest.jobId) || !token.test(job.leaseToken)) throw new Error('Invalid job lease');
    return {'X-CareMetric-Job-Lease': job.leaseToken};
  }
  async function request(operation, input = {}, signal) {
    const response = await fetchImpl(endpoint, {method: 'POST', redirect: 'error',
      headers: {Authorization: authorization, 'Content-Type': 'application/json'},
      body: JSON.stringify({operation, workerId, sourceRevision, ...input}),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000)});
    if (!response.ok) { await response.body?.cancel(); throw new WorkerTransportError(response.status); }
    return JSON.parse((await boundedBytes(response, 512 * 1024)).toString('utf8'));
  }
  return {
    async ping(signal) {
      const result = await request('heartbeat', {protocol: RENDER_PROTOCOL}, signal);
      if (result.ready !== true) throw new Error('Hub has not accepted this worker');
    },
    async claim(signal) {
      const result = await request('claim', {}, signal);
      if (result.job === null) return null;
      const job = result.job;
      if (!job || !token.test(job.leaseToken) || typeof job.leaseExpiresAt !== 'string'
          || !Number.isFinite(Date.parse(job.leaseExpiresAt)) || Date.parse(job.leaseExpiresAt) <= Date.now()) throw new Error('Invalid job lease response');
      return {manifest: parseRenderManifest(job.manifest), leaseToken: job.leaseToken, leaseExpiresAt: job.leaseExpiresAt};
    },
    async renew(job, progress, signal) {
      lease(job);
      if (!Number.isInteger(progress) || progress < 0 || progress > 98) throw new Error('Invalid render progress');
      const result = await request('renew', {jobId: job.manifest.jobId, leaseToken: job.leaseToken, progress}, signal);
      if (typeof result.active !== 'boolean') throw new Error('Invalid lease renewal');
      return result.active;
    },
    async source(job, asset, signal) {
      lease(job);
      if (!job.manifest.assets.some(item => item.id === asset.id) || !uuid.test(asset.id)) throw new Error('Source asset is not part of this job');
      const response = await fetchImpl(`${endpoint}/jobs/${job.manifest.jobId}/sources/${asset.id}`, {method: 'GET', redirect: 'error',
        headers: {Authorization: authorization, ...lease(job)},
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000)});
      if (!response.ok) { await response.body?.cancel(); throw new WorkerTransportError(response.status); }
      if (response.headers.get('content-type')?.split(';')[0] !== asset.mediaType
          || response.headers.get('content-length') !== String(asset.byteLength)) { await response.body?.cancel(); throw new Error('Source asset metadata differs'); }
      const bytes = await boundedBytes(response, Math.min(MAX_SOURCE_BYTES, asset.byteLength));
      if (bytes.length !== asset.byteLength) throw new Error('Source asset is incomplete');
      return bytes;
    },
    async upload(job, artifact, signal) {
      lease(job);
      if (!kinds.has(artifact.kind) || !/^[a-f0-9]{64}$/.test(artifact.sha256)
          || !Number.isSafeInteger(artifact.byteLength) || artifact.byteLength < 1 || artifact.byteLength > MAX_RENDER_BYTES) throw new Error('Invalid render output');
      const body = createReadStream(artifact.path);
      try {
        const response = await fetchImpl(`${endpoint}/jobs/${job.manifest.jobId}/outputs/${artifact.kind}`, {method: 'POST', redirect: 'error', duplex: 'half',
          headers: {Authorization: authorization, ...lease(job), 'Content-Type': artifact.mediaType,
            'Content-Length': String(artifact.byteLength), 'X-CareMetric-Asset-SHA256': artifact.sha256}, body,
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000)});
        if (!response.ok) { await response.body?.cancel(); throw new WorkerTransportError(response.status); }
        const result = JSON.parse((await boundedBytes(response, 1024)).toString('utf8'));
        if (result.verified !== true || result.sha256 !== artifact.sha256 || result.byteLength !== artifact.byteLength) throw new Error('Hub has not verified render output bytes');
      } finally { body.destroy(); }
    },
    async complete(job, result, signal) {
      lease(job);
      const response = await request('complete', {jobId: job.manifest.jobId, leaseToken: job.leaseToken,
        durationMs: result.durationMs, width: result.width, height: result.height, fps: result.fps, hasAudio: result.hasAudio,
        artifacts: result.artifacts.map(({kind, sha256, byteLength, mediaType}) => ({kind, sha256, byteLength, mediaType}))}, signal);
      if (response.completed !== true) throw new Error('Hub did not commit render completion');
    },
    async fail(job, signal) {
      lease(job);
      // Never persist raw browser/provider/process errors, paths, or source text.
      return request('fail', {jobId: job.manifest.jobId, leaseToken: job.leaseToken, reason: 'render_failed'}, signal);
    },
  };
}
