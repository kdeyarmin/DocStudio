import { supabase } from '../../../lib/supabase';
import { logger } from '../../../lib/logger';
import type {
  CaptionBlock,
  CaptionManifest,
  CaptionManifestRecord,
  EnhancedCaptionBlock,
  ScriptTranscriptDiff,
  DocumentationScene,
  DocumentationNarrationSegment,
  NarrationTimingMetadata,
  CaptionExportFormat,
} from '../../../types/documentation';
import { assembleSceneAudioSequence } from '../audio/audioSequenceService';

export interface CaptionBuildResult {
  manifest: CaptionManifest;
  record: Omit<CaptionManifestRecord, 'id' | 'created_at' | 'updated_at'>;
}

export function buildSceneCaptionBlocks(
  scene: DocumentationScene & { title?: string; position?: number },
  segment: DocumentationNarrationSegment | null,
  offsetSeconds: number,
): EnhancedCaptionBlock[] {
  if (!segment) return [];

  const timing = segment.timing_metadata as NarrationTimingMetadata | null;
  const narrationText = segment.narration_text ?? '';
  const words = narrationText.trim().split(/\s+/).filter(Boolean);

  const blocks: EnhancedCaptionBlock[] = [];
  const offsetMs = Math.round(offsetSeconds * 1000);

  if (timing?.words && timing.words.length > 0) {
    const chunkSize = 7;
    for (let i = 0; i < timing.words.length; i += chunkSize) {
      const chunk = timing.words.slice(i, i + chunkSize);
      const text = chunk.map(w => w.word).join(' ').trim();
      if (!text) continue;
      const startMs = offsetMs + (chunk[0]?.start_ms ?? 0);
      const endMs = offsetMs + (chunk[chunk.length - 1]?.end_ms ?? startMs + 2000);

      blocks.push({
        id: `${scene.id}_caption_${i}`,
        text,
        start_ms: startMs,
        end_ms: endMs,
        scene_id: scene.id,
        source: 'timing',
        confidence: timing.alignment_confidence ?? 0,
        words: chunk.map(w => ({
          word: w.word,
          start_ms: offsetMs + (w.start_ms ?? 0),
          end_ms: offsetMs + (w.end_ms ?? 0),
        })),
      });
    }
  } else {
    const totalMs = Math.round((segment.duration_seconds ?? 0) * 1000);
    const msPerWord = words.length > 0 ? totalMs / words.length : 0;
    const chunkSize = 7;

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize);
      const text = chunk.join(' ');
      const startMs = offsetMs + Math.round(i * msPerWord);
      const endMs = offsetMs + Math.round((i + chunkSize) * msPerWord);

      blocks.push({
        id: `${scene.id}_caption_${i}`,
        text,
        start_ms: startMs,
        end_ms: Math.min(endMs, offsetMs + totalMs),
        scene_id: scene.id,
        source: 'estimated',
        confidence: 0,
        words: [],
      });
    }
  }

  return blocks;
}

export function buildDraftCaptionManifest(
  scenes: DocumentationScene[],
  segments: DocumentationNarrationSegment[],
  draftId: string,
  draftTitle: string,
  organizationId?: string,
): CaptionBuildResult {
  const { entries } = assembleSceneAudioSequence(scenes, segments);
  const allBlocks: EnhancedCaptionBlock[] = [];

  for (const entry of entries) {
    const sceneBlocks = buildSceneCaptionBlocks(
      entry.scene as DocumentationScene & { title?: string; position?: number },
      entry.segment,
      entry.offsetSeconds,
    );
    allBlocks.push(...sceneBlocks);
  }

  const totalDurationMs = entries.reduce((acc, e) => acc + Math.round(e.durationSeconds * 1000), 0);
  const scenesWithCaptions = new Set(allBlocks.map(b => b.scene_id)).size;
  const coveragePct = scenes.length > 0 ? Math.round((scenesWithCaptions / scenes.length) * 100) : 0;

  const manifest: CaptionManifest = {
    draft_id: draftId,
    draft_title: draftTitle,
    schema_version: '1.0',
    total_duration_ms: totalDurationMs,
    scene_count: scenes.length,
    caption_blocks: allBlocks,
    generated_at: new Date().toISOString(),
    coverage_pct: coveragePct,
    source: 'pipeline',
  };

  const record: Omit<CaptionManifestRecord, 'id' | 'created_at' | 'updated_at'> = {
    draft_id: draftId,
    organization_id: organizationId ?? '',
    schema_version: '1.0',
    caption_blocks: allBlocks,
    total_caption_count: allBlocks.length,
    total_duration_ms: totalDurationMs,
    scene_coverage_pct: coveragePct,
    export_formats_available: ['raw', 'srt', 'vtt', 'json'],
    generated_at: new Date().toISOString(),
    source: 'pipeline',
  };

  return { manifest, record };
}

export function normalizeCaptionTiming(blocks: EnhancedCaptionBlock[]): EnhancedCaptionBlock[] {
  const sorted = [...blocks].sort((a, b) => (a.start_ms ?? 0) - (b.start_ms ?? 0));
  const result: EnhancedCaptionBlock[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const curr = { ...sorted[i] };
    const next = sorted[i + 1];
    const currStart = curr.start_ms ?? 0;
    const currEnd = curr.end_ms ?? currStart + 2000;
    const nextStart = next?.start_ms ?? currEnd;

    curr.start_ms = currStart;
    curr.end_ms = currEnd;

    if (next && currEnd > nextStart) {
      curr.end_ms = nextStart - 1;
    }
    if ((curr.end_ms ?? 0) <= currStart) {
      curr.end_ms = currStart + 500;
    }

    result.push(curr);
  }

  return result;
}

export function compareScriptToTranscriptForCaptions(
  scriptText: string,
  transcriptText: string,
): ScriptTranscriptDiff {
  const scriptWords = scriptText.trim().split(/\s+/).filter(Boolean);
  const transcriptWords = transcriptText.trim().split(/\s+/).filter(Boolean);

  const additions: string[] = [];
  const deletions: string[] = [];

  const scriptSet = new Set(scriptWords.map(w => w.toLowerCase()));
  const transcriptSet = new Set(transcriptWords.map(w => w.toLowerCase()));

  for (const word of transcriptWords) {
    if (!scriptSet.has(word.toLowerCase())) additions.push(word);
  }
  for (const word of scriptWords) {
    if (!transcriptSet.has(word.toLowerCase())) deletions.push(word);
  }

  const totalWords = Math.max(scriptWords.length, 1);
  const changedWords = additions.length + deletions.length;
  const similarity = Math.max(0, Math.round(((totalWords - changedWords) / totalWords) * 100));

  return {
    script_word_count: scriptWords.length,
    transcript_word_count: transcriptWords.length,
    added_words: additions,
    deleted_words: deletions,
    similarity_pct: similarity,
    has_significant_drift: similarity < 80,
  };
}

export function exportCaptionManifest(
  manifest: CaptionManifest,
  format: CaptionExportFormat,
): string {
  const captionBlocks = manifest.caption_blocks ?? [];

  switch (format) {
    case 'srt':
      return exportToSRT(captionBlocks);
    case 'vtt':
      return exportToVTT(captionBlocks);
    case 'json':
      return JSON.stringify(manifest, null, 2);
    case 'raw':
    default:
      return captionBlocks.map(b => b.text).join('\n');
  }
}

function msToSRTTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${padMs(milliseconds)}`;
}

function msToVTTTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${padMs(milliseconds)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function padMs(n: number): string {
  return n.toString().padStart(3, '0');
}

function exportToSRT(blocks: CaptionBlock[]): string {
  return blocks
    .map((block, i) => {
      const start = msToSRTTime(block.start_ms ?? 0);
      const end = msToSRTTime(block.end_ms ?? (block.start_ms ?? 0) + 2000);
      return `${i + 1}\n${start} --> ${end}\n${block.text}\n`;
    })
    .join('\n');
}

function exportToVTT(blocks: CaptionBlock[]): string {
  const cues = blocks
    .map(block => {
      const start = msToVTTTime(block.start_ms ?? 0);
      const end = msToVTTTime(block.end_ms ?? block.start_ms ?? 0);
      return `${start} --> ${end}\n${block.text}`;
    })
    .join('\n\n');

  return `WEBVTT\n\n${cues}`;
}

export async function persistCaptionManifest(
  record: Omit<CaptionManifestRecord, 'id' | 'created_at' | 'updated_at'>,
): Promise<CaptionManifestRecord> {
  const { data, error } = await supabase
    .from('documentation_caption_manifests')
    .insert(record)
    .select()
    .single();

  if (error) {
    logger.error('Caption manifest insert failed:', new Error(error.message));
    throw new Error('Caption manifest insert failed');
  }
  return data as CaptionManifestRecord;
}
