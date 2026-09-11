import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRenderManifest, renderSidecars} from './hub-render-job.mjs';
import {renderFixture as fixture} from './hub-render-fixture.mjs';

test('closed manifest rejects commands, URLs, unsupported engines and malformed ordering', () => {
  assert.deepEqual(parseRenderManifest(fixture), fixture);
  for (const value of [{...fixture, command: 'ffmpeg'}, {...fixture, outputPath: '/tmp/out'}, {...fixture, engine: 'mock'},
    {...fixture, scenes: [{...fixture.scenes[0], screenshotUrl: 'https://example.com/patient.png'}]},
    {...fixture, scenes: [{...fixture.scenes[0], order: 2}]}, {...fixture, scenes: [{...fixture.scenes[0], durationSeconds: 0}]},
    {...fixture, assets: [{id: 'a', sha256: 'x', byteLength: 5, mediaType: 'image/png'}]}]) assert.throws(() => parseRenderManifest(value));
});

test('asset references are complete, unique, typed and bounded', () => {
  const asset = {id: 'a61700d1-c8e1-44f4-82e0-55d9728af903', sha256: 'a'.repeat(64), byteLength: 128, mediaType: 'image/png'};
  const value = {...fixture, assets: [asset], scenes: [{...fixture.scenes[0], screenshotAssetId: asset.id}]};
  assert.equal(parseRenderManifest(value).assets.length, 1);
  assert.throws(() => parseRenderManifest({...fixture, assets: [asset]}));
  assert.throws(() => parseRenderManifest({...value, assets: [asset, asset]}));
  assert.throws(() => parseRenderManifest({...value, assets: [{...asset, byteLength: 33 * 1024 * 1024}]}));
  assert.throws(() => parseRenderManifest({...value, narrationAssetId: asset.id}));
});

test('sidecars retain reviewed transcript and valid bounded cue timing', () => {
  const value = {...fixture, scenes: [{...fixture.scenes[0], captionText: '<v user>Text\n\nSTYLE --> <b>more</b>'}]};
  const result = renderSidecars(value);
  assert.equal(result.transcript, `${fixture.scenes[0].narration}\n`);
  assert.equal(result.durationMs, 3000);
  assert.match(result.captions, /^WEBVTT\n\n1\n00:00:00\.000 --> 00:00:03\.000\n/);
  assert.ok(result.captions.includes('&lt;v user&gt;Text STYLE --&gt; &lt;b&gt;more&lt;/b&gt;'));
  assert.equal(result.captions.match(/ --> /g).length, 1);
});
