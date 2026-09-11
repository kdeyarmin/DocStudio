import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir, open, stat, writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {makeCancelSignal, renderMedia, selectComposition} from '@remotion/renderer';
import {MAX_RENDER_BYTES, parseRenderManifest, renderSidecars} from '../../contracts/hub-render-job.mjs';

const execute = promisify(execFile);
const appRoot = fileURLToPath(new URL('../', import.meta.url));
const mediaTypes = {primary: 'video/mp4', captions: 'text/vtt', transcript: 'text/plain'};
const filenames = {primary: 'video.mp4', captions: 'captions.vtt', transcript: 'transcript.txt'};

export async function prepareRenderer(outputDirectory) {
  // The only bundled entry point is committed DocStudio code. No customer source
  // modules, JavaScript, environment variables or remote compositions are accepted.
  return bundle({entryPoint: join(appRoot, 'src/video/index.ts'), rootDir: appRoot,
    outDir: resolve(outputDirectory), publicDir: null, enableCaching: false});
}

function assertSourceBytes(asset, bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== asset.byteLength
      || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error('Source asset bytes do not match the reviewed manifest');
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const wav = bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WAVE';
  const mp3 = bytes.subarray(0, 3).toString('ascii') === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224);
  if (!({'image/png': png, 'image/jpeg': jpeg, 'audio/wav': wav, 'audio/mpeg': mp3}[asset.mediaType])) throw new Error('Source asset media type is invalid');
}

async function fileArtifact(directory, kind) {
  const path = join(directory, filenames[kind]);
  const info = await stat(path);
  if (!info.isFile() || info.size < 1 || info.size > MAX_RENDER_BYTES) throw new Error('Rendered artifact size is invalid');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return {kind, path, fileName: filenames[kind], mediaType: mediaTypes[kind], byteLength: info.size, sha256: hash.digest('hex')};
}

export async function probeVideo(path, {signal, ffprobe = 'ffprobe'} = {}) {
  const file = await open(path, 'r');
  try {
    const header = Buffer.alloc(12); const {bytesRead} = await file.read(header, 0, header.length, 0);
    if (bytesRead !== 12 || header.subarray(4, 8).toString('ascii') !== 'ftyp') throw new Error('Actual MP4 output is required');
  } finally { await file.close(); }
  const {stdout} = await execute(ffprobe, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,duration,nb_frames', '-of', 'json', path],
    {signal, timeout: 30000, maxBuffer: 65536, windowsHide: true});
  const result = JSON.parse(stdout), video = result.streams?.find(stream => stream.codec_type === 'video');
  // MP4 container duration includes audio encoder padding. The reviewed scene
  // timeline follows the encoded video track; verify its exact frame count and
  // duration independently while allowing at most 100ms of container padding.
  const durationMs = Math.round(Number(video?.duration) * 1000);
  const containerDurationMs = Math.round(Number(result.format?.duration) * 1000);
  const frameCount = Number(video?.nb_frames);
  if (!video || video.codec_name !== 'h264' || video.width !== 1920 || video.height !== 1080
      || video.r_frame_rate !== '30/1' || !Number.isSafeInteger(durationMs) || durationMs < 1
      || !Number.isSafeInteger(frameCount) || frameCount<1 || Math.abs(durationMs-frameCount*1000/30)>1
      || !Number.isSafeInteger(containerDurationMs) || Math.abs(containerDurationMs-durationMs)>100) throw new Error('Rendered video failed media validation');
  return {durationMs, width: video.width, height: video.height, fps: 30, hasAudio: result.streams.some(stream => stream.codec_type === 'audio')};
}

/** Produces actual encoded video and sidecars. A DB lease owner must verify and
 * upload these exact bytes before committing completion; this function never
 * updates a job or approves content. outputDirectory must be a new worker-owned
 * directory; an existing directory is deliberately rejected. */
export async function renderTutorial({manifest: input, assetBytes = new Map(), serveUrl, outputDirectory,
  signal, onProgress = () => {}, browserExecutable, ffprobe = 'ffprobe'}) {
  const manifest = parseRenderManifest(input), sidecars = renderSidecars(manifest);
  if (signal?.aborted) throw signal.reason ?? new Error('Render cancelled');
  if (assetBytes.size !== manifest.assets.length) throw new Error('Source asset set does not match the manifest');
  const media = new Map();
  for (const asset of manifest.assets) {
    const bytes = assetBytes.get(asset.id); assertSourceBytes(asset, bytes);
    media.set(asset.id, `data:${asset.mediaType};base64,${bytes.toString('base64')}`);
  }
  const props = {title: manifest.title, description: manifest.description, brandColor: '#2563eb',
    scenes: manifest.scenes.map(scene => ({order: scene.order, title: scene.title, type: scene.type,
      durationSeconds: scene.durationSeconds, narration: scene.narration, shortNarration: scene.narration,
      captionText: scene.captionText, visualHint: '',
      ...(scene.screenshotAssetId ? {screenshotUrl: media.get(scene.screenshotAssetId)} : {})})),
    ...(manifest.narrationAssetId ? {narrationAudioUrl: media.get(manifest.narrationAssetId)} : {})};
  // Asset URLs can only be worker-created data URLs. The fixed composition uses
  // React text nodes and receives no CSS, HTML, scripts, remote fonts or URLs.
  const composition = await selectComposition({serveUrl, id: 'TutorialVideo', inputProps: props,
    browserExecutable, envVariables: {}, logLevel: 'error', timeoutInMilliseconds: 60000});
  if (signal?.aborted) throw signal.reason ?? new Error('Render cancelled');
  if (composition.width !== 1920 || composition.height !== 1080 || composition.fps !== 30
      || composition.durationInFrames !== sidecars.durationMs * 30 / 1000) throw new Error('Composition differs from the reviewed duration');
  await mkdir(outputDirectory);
  const {cancelSignal, cancel} = makeCancelSignal();
  signal?.addEventListener('abort', cancel, {once: true});
  try {
    if (signal?.aborted) throw signal.reason ?? new Error('Render cancelled');
    await renderMedia({serveUrl, composition, inputProps: props, codec: 'h264', pixelFormat: 'yuv420p',
      outputLocation: join(outputDirectory, filenames.primary), overwrite: false, concurrency: 2,
      crf: 23, browserExecutable, envVariables: {}, logLevel: 'error', cancelSignal,
      timeoutInMilliseconds: 60000, onProgress: event => onProgress(Math.min(95, Math.floor(event.progress * 95)))});
    if (signal?.aborted) throw signal.reason ?? new Error('Render cancelled');
    const mediaInfo = await probeVideo(join(outputDirectory, filenames.primary), {signal, ffprobe});
    if (Math.abs(mediaInfo.durationMs - sidecars.durationMs) > 34) throw new Error('Encoded duration differs from the reviewed manifest');
    if (manifest.narrationAssetId && !mediaInfo.hasAudio) throw new Error('Reviewed narration is missing from rendered output');
    await writeFile(join(outputDirectory, filenames.captions), sidecars.captions, {flag: 'wx'});
    await writeFile(join(outputDirectory, filenames.transcript), sidecars.transcript, {flag: 'wx'});
    const artifacts = await Promise.all(Object.keys(filenames).map(kind => fileArtifact(outputDirectory, kind)));
    onProgress(98);
    return {jobId: manifest.jobId, projectId: manifest.projectId, revision: manifest.revision,
      engine: 'remotion', ...mediaInfo, artifacts};
  } finally { signal?.removeEventListener('abort', cancel); }
}
