/** Closed server-to-worker protocol. Media references identify verified Hub bytes,
 * never URLs, commands, native account IDs, or browser-selected output paths. */
export const RENDER_PROTOCOL = 'caremetric.docstudio.render.v1';
export const MAX_RENDER_BYTES = 256 * 1024 * 1024;
export const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest = /^[a-f0-9]{64}$/;
const sourceTypes = new Set(['image/png', 'image/jpeg', 'audio/mpeg', 'audio/wav']);

function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some(key => !keys.includes(key))) throw new Error(`Invalid ${label}`);
}
function text(value, max, label, empty = false) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())
      || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw new Error(`Invalid ${label}`);
  return value;
}
function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${label}`);
  return value;
}

export function parseRenderManifest(value) {
  object(value, ['protocol', 'jobId', 'projectId', 'revision', 'engine', 'title', 'description', 'scenes', 'assets', 'narrationAssetId'], 'render manifest');
  if (value.protocol !== RENDER_PROTOCOL || !uuid.test(value.jobId) || !uuid.test(value.projectId)) throw new Error('Invalid render identity');
  integer(value.revision, 1, Number.MAX_SAFE_INTEGER, 'revision');
  if (value.engine !== 'remotion') throw new Error('Unsupported render engine');
  text(value.title, 180, 'title'); text(value.description, 2000, 'description', true);
  if (!Array.isArray(value.assets) || value.assets.length > 40) throw new Error('Invalid source assets');
  let sourceBytes = 0;
  const assets = value.assets.map(asset => {
    object(asset, ['id', 'sha256', 'byteLength', 'mediaType'], 'source asset');
    if (!uuid.test(asset.id) || !digest.test(asset.sha256) || !sourceTypes.has(asset.mediaType)) throw new Error('Invalid source asset');
    sourceBytes += integer(asset.byteLength, 1, MAX_SOURCE_BYTES, 'asset length');
    return {id: asset.id, sha256: asset.sha256, byteLength: asset.byteLength, mediaType: asset.mediaType};
  });
  if (sourceBytes > MAX_SOURCE_BYTES || new Set(assets.map(asset => asset.id)).size !== assets.length) throw new Error('Invalid source asset set');
  const byId = new Map(assets.map(asset => [asset.id, asset]));
  const used = new Set();
  if (!Array.isArray(value.scenes) || value.scenes.length < 1 || value.scenes.length > 120) throw new Error('Invalid scenes');
  let frames = 0;
  const scenes = value.scenes.map((scene, index) => {
    object(scene, ['order', 'title', 'type', 'durationSeconds', 'narration', 'captionText', 'screenshotAssetId'], 'scene');
    if (scene.order !== index + 1 || !['intro', 'step', 'outro'].includes(scene.type)) throw new Error('Invalid scene sequence');
    integer(scene.durationSeconds, 3, 120, 'scene duration');
    frames += scene.durationSeconds * 30;
    text(scene.title, 180, 'scene title'); text(scene.narration, 4000, 'scene narration'); text(scene.captionText, 2000, 'scene captions');
    if (scene.screenshotAssetId !== undefined) {
      if (!byId.get(scene.screenshotAssetId)?.mediaType.startsWith('image/')) throw new Error('Invalid screenshot reference');
      used.add(scene.screenshotAssetId);
    }
    return {...scene};
  });
  if (frames > 30 * 3600) throw new Error('Render duration exceeds one hour');
  if (value.narrationAssetId !== undefined) {
    if (!byId.get(value.narrationAssetId)?.mediaType.startsWith('audio/')) throw new Error('Invalid narration reference');
    used.add(value.narrationAssetId);
  }
  if (used.size !== assets.length) throw new Error('Unreferenced source asset');
  return {protocol: RENDER_PROTOCOL, jobId: value.jobId, projectId: value.projectId, revision: value.revision,
    engine: 'remotion', title: value.title, description: value.description, scenes, assets,
    ...(value.narrationAssetId === undefined ? {} : {narrationAssetId: value.narrationAssetId})};
}

export function renderSidecars(value) {
  const manifest = parseRenderManifest(value);
  const timestamp = milliseconds => {
    const hours = Math.floor(milliseconds / 3600000), minutes = Math.floor(milliseconds / 60000) % 60;
    const seconds = Math.floor(milliseconds / 1000) % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds % 1000).padStart(3, '0')}`;
  };
  // WebVTT cues use plain text. Escape markup and collapse blank lines so source
  // text cannot insert a new cue, STYLE block, or parser control structure.
  const cueText = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replace(/\s+/gu, ' ').trim();
  let cursor = 0;
  const cues = manifest.scenes.map(scene => {
    const start = cursor; cursor += scene.durationSeconds * 1000;
    return `${scene.order}\n${timestamp(start)} --> ${timestamp(cursor)}\n${cueText(scene.captionText)}\n`;
  });
  return {captions: `WEBVTT\n\n${cues.join('\n')}`, transcript: `${manifest.scenes.map(scene => scene.narration.trim()).join('\n\n')}\n`, durationMs: cursor};
}
