import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workerClient, WorkerTransportError} from './client.mjs';
import {renderFixture} from '../../contracts/hub-render-fixture.mjs';
const config = {origin: 'https://support-hub-web-production.up.railway.app', credential: 'w'.repeat(43),
  workerId: '352f9ee7-bbe8-488e-8b99-6c6fce828aa9', sourceRevision: 'a'.repeat(40)};
const job = {manifest: renderFixture, leaseToken: 'j'.repeat(43), leaseExpiresAt: new Date(Date.now() + 60000).toISOString()};
const json = body => new Response(JSON.stringify(body), {headers: {'content-type': 'application/json'}});

test('configuration and transport keep credentials off URLs and disallow redirects', async () => {
  for (const origin of ['http://localhost', 'https://example.com', `${config.origin}/`, `${config.origin}?token=x`]) assert.throws(() => workerClient({...config, origin}));
  assert.throws(() => workerClient({...config, credential: 'short'}));
  const calls = [];
  const client = workerClient({...config, fetchImpl: async (url, options) => { calls.push({url, options}); return json({job}); }});
  assert.deepEqual(await client.claim(), job);
  assert.equal(calls[0].url, `${config.origin}/api/internal/docstudio/worker`);
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${config.credential}`);
  assert.equal(calls[0].options.headers.Cookie, undefined);
  assert.equal(JSON.parse(calls[0].options.body).operation, 'claim');
  assert.ok(!calls[0].url.includes(config.credential));
});

test('expired leases, missing durable completion, and HTTP denial are rejected', async () => {
  await assert.rejects(workerClient({...config, fetchImpl: async () => json({job: {...job, leaseExpiresAt: '2000-01-01T00:00:00Z'}})}).claim(), /lease response/);
  await assert.rejects(workerClient({...config, fetchImpl: async () => json({completed: false})}).complete(job, {artifacts: []}), /did not commit/);
  await assert.rejects(workerClient({...config, fetchImpl: async () => new Response('private upstream detail', {status: 401})}).claim(), error =>
    error instanceof WorkerTransportError && error.status === 401 && !error.message.includes('private upstream'));
  assert.equal(await workerClient({...config, fetchImpl: async () => json({active: false})}).renew(job, 75), false);
  await assert.rejects(workerClient({...config}).renew(job, 100), /progress/);
});

test('job input fetch requires exact snapshotted source metadata', async () => {
  const asset = {id: 'a61700d1-c8e1-44f4-82e0-55d9728af903', byteLength: 3, sha256: 'a'.repeat(64), mediaType: 'image/png'};
  const current = {...job, manifest: {...renderFixture, assets: [asset]}};
  let called = false;
  const client = workerClient({...config, fetchImpl: async (url, options) => {
    called = true;
    assert.ok(url.endsWith(`/sources/${asset.id}`)); assert.equal(options.headers['X-CareMetric-Job-Lease'], job.leaseToken);
    return new Response(Buffer.from('bad'), {headers: {'content-type': 'text/html', 'content-length': '3'}});
  }});
  await assert.rejects(client.source(job, asset), /not part/); assert.equal(called, false);
  await assert.rejects(client.source(current, asset), /metadata differs/); assert.equal(called, true);
});
