import type {
  DocumentationScene,
  DocumentationNarrationSegment,
  PronunciationDictionaryEntry,
  NarrationAdvancedConfig,
  NarrationStyle,
  NarrationTimingMetadata,
  CaptionBlock,
  CaptionManifest,
} from '../../types/documentation';
import type { SceneNarrationPayload, VoiceConfigOptions, ScenePosition } from './NarrationProvider';

export interface NarrationPackage {
  segments: Omit<DocumentationNarrationSegment, 'id' | 'created_at' | 'updated_at' | 'audio_asset_id'>[];
  full_narration_script: string;
  caption_manifest: CaptionManifest;
  total_estimated_duration_seconds: number;
}

function estimateDuration(text: string, wpm: number): number {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const wps = wpm / 60;
  return Math.max(3, wordCount / wps);
}

function buildShortVariant(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  if (sentences.length <= 1) return text;
  const firstTwo = sentences.slice(0, 2).join(' ').trim();
  return firstTwo;
}

function stylizeText(text: string, style: NarrationStyle): string {
  if (style === 'formal') {
    return text.replace(/\byou'll\b/gi, 'you will').replace(/\bdon't\b/gi, 'do not');
  }
  if (style === 'concise') {
    return text.split('.').filter(Boolean).slice(0, 2).join('. ').trim() + '.';
  }
  if (style === 'conversational') {
    return text
      .replace(/\bNavigate to\b/g, "Head over to")
      .replace(/\bClick\b/g, "Go ahead and click")
      .replace(/\bEnter\b/g, "Type in");
  }
  return text;
}

export function applyPronunciationDictionary(
  text: string,
  dictionary: PronunciationDictionaryEntry[],
): string {
  let result = text;
  const enabled = dictionary.filter(e => e.is_enabled);

  for (const entry of enabled) {
    if (entry.replacement_mode === 'none') continue;
    if (!entry.substitute_text && !entry.phonetic_spelling) continue;

    const termRegex = new RegExp(`\\b${escapeRegex(entry.term)}\\b`, 'gi');

    if (entry.replacement_mode === 'substitute' && entry.substitute_text) {
      result = result.replace(termRegex, entry.substitute_text);
    } else if (entry.replacement_mode === 'ssml' && entry.phonetic_spelling) {
      result = result.replace(
        termRegex,
        `<phoneme alphabet="ipa" ph="${entry.phonetic_spelling}">${entry.term}</phoneme>`,
      );
    }
  }
  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function generateNarrationForScene(
  scene: DocumentationScene,
  sceneNarrative: string,
  config: NarrationAdvancedConfig,
  dictionary: PronunciationDictionaryEntry[],
  segmentOrder: number,
): Omit<DocumentationNarrationSegment, 'id' | 'created_at' | 'updated_at' | 'audio_asset_id'> {
  const style: NarrationStyle = config.style_default;
  let text = stylizeText(sceneNarrative, style);

  if (config.apply_pronunciation_dictionary && dictionary.length > 0) {
    text = applyPronunciationDictionary(text, dictionary);
  }

  const shortText = config.generate_concise_variant ? buildShortVariant(sceneNarrative) : null;
  const targetDuration = estimateDuration(text, config.target_speech_pace_wpm);
  const finalDuration = Math.min(targetDuration, config.max_segment_duration_seconds);

  const captionText = buildCaptionText(text);
  const transcriptText = text.replace(/<[^>]*>/g, '');

  return {
    draft_id: scene.draft_id,
    scene_id: scene.id,
    segment_order: segmentOrder,
    narration_text: text,
    short_narration_text: shortText,
    style,
    target_duration_seconds: parseFloat(finalDuration.toFixed(2)),
    transcript_text: transcriptText,
    caption_text: captionText,
    timing_json: {},
    status: 'draft',
  };
}

function buildCaptionText(narrationText: string): string {
  const clean = narrationText.replace(/<[^>]*>/g, '').trim();
  return clean;
}

export function generateNarrationSegments(
  scenes: DocumentationScene[],
  sceneNarratives: Map<string, string>,
  config: NarrationAdvancedConfig,
  dictionary: PronunciationDictionaryEntry[],
  draftId: string,
): NarrationPackage {
  const segments: Omit<DocumentationNarrationSegment, 'id' | 'created_at' | 'updated_at' | 'audio_asset_id'>[] = [];
  let runningTime = 0;
  const captionBlocks: CaptionBlock[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const narrative = sceneNarratives.get(scene.id) ?? scene.summary ?? scene.title;
    const segment = generateNarrationForScene(scene, narrative, config, dictionary, i);
    segments.push(segment);

    const duration = segment.target_duration_seconds ?? estimateDuration(segment.narration_text, config.target_speech_pace_wpm);
    const blockStart = runningTime;
    const blockEnd = runningTime + duration;

    captionBlocks.push(...buildCaptionBlocksForSegment(
      segment.caption_text ?? segment.narration_text,
      scene.id,
      blockStart,
      blockEnd,
      i,
    ));

    runningTime = blockEnd;
  }

  const fullScript = segments.map((s, i) => `[Scene ${i + 1}: ${scenes[i]?.title ?? ''}]\n${s.narration_text}`).join('\n\n');

  const captionManifest: CaptionManifest = {
    draft_id: draftId,
    draft_title: '',
    total_duration_seconds: parseFloat(runningTime.toFixed(3)),
    scene_count: scenes.length,
    blocks: captionBlocks,
    generated_at: new Date().toISOString(),
  };

  return {
    segments,
    full_narration_script: fullScript,
    caption_manifest: captionManifest,
    total_estimated_duration_seconds: parseFloat(runningTime.toFixed(3)),
  };
}

function buildCaptionBlocksForSegment(
  text: string,
  sceneId: string,
  startSeconds: number,
  endSeconds: number,
  segmentIndex: number,
): CaptionBlock[] {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const totalDuration = endSeconds - startSeconds;
  const timePerSentence = totalDuration / sentences.length;
  const blocks: CaptionBlock[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (!sentence) continue;
    blocks.push({
      id: `seg_${segmentIndex}_block_${i}`,
      scene_id: sceneId,
      segment_order: segmentIndex * 100 + i,
      start_time_seconds: parseFloat((startSeconds + i * timePerSentence).toFixed(3)),
      end_time_seconds: parseFloat((startSeconds + (i + 1) * timePerSentence).toFixed(3)),
      text: sentence,
    });
  }

  return blocks;
}

export function assembleNarrationPackage(
  scenes: DocumentationScene[],
  segments: DocumentationNarrationSegment[],
  draftId: string,
  draftTitle: string,
): NarrationPackage {
  const sceneMap = new Map(scenes.map(s => [s.id, s]));
  const ordered = segments.slice().sort((a, b) => a.segment_order - b.segment_order);

  let runningTime = 0;
  const captionBlocks: CaptionBlock[] = [];
  const segmentOutputs: Omit<DocumentationNarrationSegment, 'id' | 'created_at' | 'updated_at' | 'audio_asset_id'>[] = [];

  for (const seg of ordered) {
    const duration = seg.target_duration_seconds ?? estimateDuration(seg.narration_text, 140);
    const blocks = buildCaptionBlocksForSegment(
      seg.caption_text ?? seg.narration_text,
      seg.scene_id ?? '',
      runningTime,
      runningTime + duration,
      seg.segment_order,
    );
    captionBlocks.push(...blocks);
    runningTime += duration;
    segmentOutputs.push({
      draft_id: seg.draft_id,
      scene_id: seg.scene_id,
      segment_order: seg.segment_order,
      narration_text: seg.narration_text,
      short_narration_text: seg.short_narration_text,
      style: seg.style,
      target_duration_seconds: seg.target_duration_seconds,
      transcript_text: seg.transcript_text,
      caption_text: seg.caption_text,
      timing_json: seg.timing_json,
      status: seg.status,
    });
  }

  const fullScript = ordered
    .map((s, i) => {
      const scene = s.scene_id ? sceneMap.get(s.scene_id) : null;
      const sceneTitle = scene?.title ?? `Scene ${i + 1}`;
      return `[${sceneTitle}]\n${s.narration_text}`;
    })
    .join('\n\n');

  return {
    segments: segmentOutputs,
    full_narration_script: fullScript,
    caption_manifest: {
      draft_id: draftId,
      draft_title: draftTitle,
      total_duration_seconds: parseFloat(runningTime.toFixed(3)),
      scene_count: scenes.length,
      blocks: captionBlocks,
      generated_at: new Date().toISOString(),
    },
    total_estimated_duration_seconds: parseFloat(runningTime.toFixed(3)),
  };
}

export function buildNarrationReadyText(
  text: string,
  dictionary: PronunciationDictionaryEntry[],
  style: NarrationStyle,
): string {
  const styled = stylizeText(text, style);
  return applyPronunciationDictionary(styled, dictionary);
}

export function mergePronunciationTimings(
  segments: DocumentationNarrationSegment[],
  timingsBySegmentId: Map<string, NarrationTimingMetadata>,
): Map<string, NarrationTimingMetadata> {
  const result = new Map<string, NarrationTimingMetadata>();
  let offsetMs = 0;

  for (const seg of segments.sort((a, b) => a.segment_order - b.segment_order)) {
    const timing = timingsBySegmentId.get(seg.id);
    if (!timing) continue;

    const shifted: NarrationTimingMetadata = {
      ...timing,
      total_duration_ms: timing.total_duration_ms,
      words: timing.words?.map(w => ({
        ...w,
        start_ms: w.start_ms + offsetMs,
        end_ms: w.end_ms + offsetMs,
      })),
      characters: timing.characters?.map(c => ({
        ...c,
        start_ms: c.start_ms + offsetMs,
        end_ms: c.end_ms + offsetMs,
      })),
    };

    result.set(seg.id, shifted);
    offsetMs += timing.total_duration_ms ?? 0;
  }

  return result;
}

// ─── Timing Placeholder Utility ───────────────────────────────────────────────

export function buildTimingPlaceholderForText(
  text: string,
  wpm: number,
  offsetMs: number,
): NarrationTimingMetadata {
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const wps = wpm / 60;
  const totalDurationMs = wordCount > 0 ? Math.round((wordCount / wps) * 1000) : 0;
  const msPerWord = wordCount > 0 ? totalDurationMs / wordCount : 0;

  return {
    total_duration_ms: totalDurationMs,
    words: words.map((word, i) => ({
      word,
      start_ms: offsetMs + Math.round(i * msPerWord),
      end_ms: offsetMs + Math.round((i + 1) * msPerWord),
    })),
    characters: [],
    alignment_confidence: 0,
    generated_by: 'placeholder',
  };
}

// ─── Scene Narration Payload Builder ──────────────────────────────────────────

export function buildSceneNarrationPayloads(
  scenes: DocumentationScene[],
  segments: DocumentationNarrationSegment[],
  organizationId: string,
  draftId: string,
  voiceConfig: VoiceConfigOptions,
  dictionary: PronunciationDictionaryEntry[],
  applyPronunciation: boolean,
): SceneNarrationPayload[] {
  const segmentBySceneId = new Map(
    segments.filter(s => s.scene_id).map(s => [s.scene_id!, s]),
  );
  const sceneCount = scenes.length;

  return scenes
    .map((scene, index): SceneNarrationPayload | null => {
      const seg = segmentBySceneId.get(scene.id);
      if (!seg) return null;

      let narrationText = seg.narration_text;
      if (applyPronunciation && dictionary.length > 0) {
        narrationText = applyPronunciationDictionary(narrationText, dictionary);
      }

      const position: ScenePosition =
        sceneCount === 1 ? 'only'
        : index === 0 ? 'first'
        : index === sceneCount - 1 ? 'last'
        : 'middle';

      return {
        draftId,
        organizationId,
        segmentId: seg.id,
        sceneId: scene.id,
        narrationText,
        style: seg.style,
        voiceId: voiceConfig.voice_id,
        voiceConfig,
        targetDurationSeconds: seg.target_duration_seconds,
        applyPronunciationDictionary: false,
        scene,
        scenePosition: position,
        sceneIndex: index,
        totalSceneCount: sceneCount,
      };
    })
    .filter((p): p is SceneNarrationPayload => p !== null);
}
