import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, realpath, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {isAbsolute, join, relative, resolve, sep} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareRenderer, renderTutorial} from './render.mjs';
import {renderFixture} from '../../contracts/hub-render-fixture.mjs';

test('invalid source bytes and pre-cancelled work cannot start the renderer', async () => {
  const controller = new AbortController(); controller.abort(new Error('cancelled fixture'));
  await assert.rejects(renderTutorial({manifest: renderFixture, signal: controller.signal}), /cancelled fixture/);
  const id = 'a61700d1-c8e1-44f4-82e0-55d9728af903';
  const manifest = {...renderFixture, assets: [{id, sha256: 'a'.repeat(64), byteLength: 3, mediaType: 'image/png'}],
    scenes: [{...renderFixture.scenes[0], screenshotAssetId: id}]};
  await assert.rejects(renderTutorial({manifest, assetBytes: new Map([[id, Buffer.from('bad')]])}), /bytes do not match/);
});

test('actual renderer produces validated MP4 plus exact caption and transcript bytes', {skip: process.env.RUN_REAL_RENDER !== '1', timeout: 300000}, async () => {
  const parent = await realpath(tmpdir());
  const directory = await mkdtemp(join(parent, 'caremetric-render-test-'));
  try {
    const serveUrl = await prepareRenderer(join(directory, 'bundle'));
    const result = await renderTutorial({manifest: renderFixture, serveUrl, outputDirectory: join(directory, 'output'),
      ffprobe: process.env.FFPROBE_PATH || 'ffprobe', browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE || undefined});
    assert.equal(result.durationMs, 3000); assert.equal(result.fps, 30);
    assert.equal(result.width, 1920); assert.equal(result.height, 1080);
    assert.equal(result.hasAudio, false);
    assert.deepEqual(result.artifacts.map(artifact => artifact.kind), ['primary', 'captions', 'transcript']);
    for (const artifact of result.artifacts) {
      const bytes = await readFile(artifact.path);
      assert.equal(bytes.length, artifact.byteLength);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), artifact.sha256);
    }
    const video = await readFile(result.artifacts[0].path);
    assert.equal(video.subarray(4, 8).toString(), 'ftyp');
    assert.ok(video.length > 10000, 'actual encoded frames must be present');
    assert.match(await readFile(result.artifacts[1].path, 'utf8'), /00:00:00\.000 --> 00:00:03\.000/);
    assert.equal(await readFile(result.artifacts[2].path, 'utf8'), `${renderFixture.scenes[0].narration}\n`);
    // Exercise real image decoding and audio muxing as well as text-only scenes.
    const imageId='3b7c1101-38c7-445d-8c02-06eec3601fa1',audioId='3b7c1101-38c7-445d-8c02-06eec3601fa2';
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLioAAAAASUVORK5CYII=','base64');
    const sampleRate=8000,samples=sampleRate*3,wav=Buffer.alloc(44+samples*2);
    wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
    wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sampleRate,24);wav.writeUInt32LE(sampleRate*2,28);
    wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);
    for(let i=0;i<samples;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/sampleRate)*1200),44+i*2);
    const assets=[[imageId,png,'image/png'],[audioId,wav,'audio/wav']].map(([id,bytes,mediaType])=>({id,sha256:createHash('sha256').update(bytes).digest('hex'),byteLength:bytes.length,mediaType}));
    const withMedia={...renderFixture,assets,narrationAssetId:audioId,scenes:[{...renderFixture.scenes[0],screenshotAssetId:imageId}]};
    const mediaResult=await renderTutorial({manifest:withMedia,assetBytes:new Map([[imageId,png],[audioId,wav]]),serveUrl,outputDirectory:join(directory,'with-media'),
      ffprobe:process.env.FFPROBE_PATH||'ffprobe',browserExecutable:process.env.REMOTION_BROWSER_EXECUTABLE||undefined});
    assert.equal(mediaResult.hasAudio,true,'reviewed recording must be present in actual encoded output');
    assert.equal(mediaResult.durationMs,3000);assert.ok(mediaResult.artifacts[0].byteLength>10000);
    for(const artifact of mediaResult.artifacts){const bytes=await readFile(artifact.path);assert.equal(bytes.length,artifact.byteLength);assert.equal(createHash('sha256').update(bytes).digest('hex'),artifact.sha256);}
  } finally {
    // Verify the absolute deletion target, including symlinks, stays in the
    // exact task-owned temporary directory created above on every platform.
    const actual = await realpath(directory), child = relative(parent, actual);
    assert.equal(actual, resolve(directory));
    assert.ok(!isAbsolute(child) && !child.startsWith(`..${sep}`) && child.startsWith('caremetric-render-test-'));
    await rm(actual, {recursive: true, force: false});
  }
});
