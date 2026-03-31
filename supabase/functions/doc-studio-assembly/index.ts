import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createServiceClient,
  requireSuperAdmin,
  requireDocStudioAuthContext,
  requireInternalOrDraftAccess,
} from "../_shared/auth.ts";
import { corsPreflightResponse, jsonResponse } from "../_shared/http.ts";

function estimateDuration(text: string, wpm = 140): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words / wpm) * 60 * 10) / 10);
}

interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_durations_seconds: number[];
}

function computeWordTimings(alignment: ElevenLabsAlignment) {
  const { characters, character_start_times_seconds, character_durations_seconds } = alignment;
  const words: Array<{ word: string; start_ms: number; end_ms: number }> = [];
  let currentWord = "";
  let wordStart = 0;

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i];
    const startSec = character_start_times_seconds[i] ?? 0;
    const durSec = character_durations_seconds[i] ?? 0;
    const endSec = startSec + durSec;

    if (ch === " " || ch === "\n") {
      if (currentWord.length > 0) {
        words.push({
          word: currentWord,
          start_ms: Math.round(wordStart * 1000),
          end_ms: Math.round(endSec * 1000),
        });
        currentWord = "";
      }
    } else {
      if (currentWord.length === 0) wordStart = startSec;
      currentWord += ch;
    }
  }

  if (currentWord.length > 0) {
    const lastIdx = characters.length - 1;
    const lastEnd = (character_start_times_seconds[lastIdx] ?? 0) + (character_durations_seconds[lastIdx] ?? 0);
    words.push({
      word: currentWord,
      start_ms: Math.round(wordStart * 1000),
      end_ms: Math.round(lastEnd * 1000),
    });
  }

  const totalMs = words.length > 0 ? words[words.length - 1].end_ms : 0;
  return {
    total_duration_ms: totalMs,
    words,
    characters: [],
    alignment_confidence: 0.98,
    generated_by: "elevenlabs",
  };
}

function buildMockTiming(text: string, durationSeconds: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const totalMs = Math.round(durationSeconds * 1000);
  const msPerWord = words.length > 0 ? totalMs / words.length : 500;
  return {
    total_duration_ms: totalMs,
    words: words.map((word, i) => ({
      word,
      start_ms: Math.round(i * msPerWord),
      end_ms: Math.round((i + 1) * msPerWord),
    })),
    characters: [],
    alignment_confidence: 0.95,
    generated_by: "mock",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const supabase = createServiceClient();
    const auth = await requireSuperAdmin(req, supabase);
    if (auth.error) return auth.error;

    const body = await req.json();
    const { action, draft_id } = body;

    if (!draft_id) {
      return jsonResponse({ success: false, error: "draft_id required" }, 400);
    }

    const auth = await requireDocStudioAuthContext(req, supabase, { draftId: draft_id });
    if ("error" in auth) return auth.error;

    const organization_id = auth.organizationId;
    if (!organization_id) {
      return jsonResponse({ success: false, error: "Organization context required" }, 400);
    }

    const access = await requireInternalOrDraftAccess(req, supabase, draft_id, organization_id);
    if (!access.ok) {
      return access.error;
    }
    const resolvedOrganizationId = access.organizationId;

    if (action === "health_check") {
      const { data: scenes } = await supabase
        .from("doc_studio_scenes")
        .select("id, title, position")
        .eq("draft_id", draft_id)
        .order("position");

      const { data: segments } = await supabase
        .from("documentation_narration_segments")
        .select("id, scene_id, audio_asset_id, duration_seconds, narration_text, timing_json")
        .eq("draft_id", draft_id);

      const segByScene = new Map((segments ?? []).map(s => [s.scene_id, s]));
      const total = (scenes ?? []).length;
      const withAudio = (segments ?? []).filter(s => s.audio_asset_id).length;
      const withTiming = (segments ?? []).filter(s => s.timing_json && Object.keys(s.timing_json).length > 0).length;

      return jsonResponse({
        success: true,
        health: {
          total_scenes: total,
          scenes_with_segments: segByScene.size,
          scenes_with_audio: withAudio,
          scenes_with_timing: withTiming,
          audio_coverage_pct: total > 0 ? Math.round((withAudio / total) * 100) : 0,
          is_ready: withAudio >= total,
        },
      });
    }

    if (action === "assemble_audio") {
      await supabase
        .from("doc_studio_drafts")
        .update({ assembly_status: "assembling_audio", updated_at: new Date().toISOString() })
        .eq("id", draft_id);

      const { data: scenes } = await supabase
        .from("doc_studio_scenes")
        .select("id, title, position")
        .eq("draft_id", draft_id)
        .order("position");

      const { data: segments } = await supabase
        .from("documentation_narration_segments")
        .select("id, scene_id, audio_asset_id, duration_seconds, narration_text, timing_json")
        .eq("draft_id", draft_id);

      const enrichedSegments = (segments ?? []).map(seg => {
        const text = seg.narration_text ?? "";
        const duration = seg.duration_seconds ?? estimateDuration(text);
        const timing = (seg.timing_json && Object.keys(seg.timing_json).length > 0)
          ? seg.timing_json
          : buildMockTiming(text, duration);

        return {
          ...seg,
          duration_seconds: duration,
          audio_asset_id: seg.audio_asset_id ?? null,
          timing_json: timing,
        };
      });

      const segByScene = new Map(enrichedSegments.map(s => [s.scene_id, s]));

      const sceneAudioMap = (scenes ?? []).map((scene, idx) => {
        const seg = segByScene.get(scene.id);
        return {
          draft_id,
          organization_id: resolvedOrganizationId,
          scene_id: scene.id,
          scene_position: scene.position ?? idx,
          narration_segment_id: seg?.id ?? null,
          audio_asset_id: seg?.audio_asset_id ?? null,
          duration_seconds: seg?.duration_seconds ?? 0,
          timing_json: seg?.timing_json ?? null,
          status: seg?.audio_asset_id ? "audio_ready" : "missing",
          is_complete: !!(seg?.audio_asset_id && seg?.timing_json),
        };
      });

      await supabase
        .from("documentation_scene_audio_map")
        .upsert(sceneAudioMap, { onConflict: "scene_id,draft_id" });

      const totalDuration = enrichedSegments.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);
      const audioCovPct = scenes?.length
        ? Math.round((enrichedSegments.filter(s => s.audio_asset_id).length / scenes.length) * 100)
        : 100;

      const { data: assembly, error: assemblyErr } = await supabase
        .from("documentation_audio_assemblies")
        .insert({
          draft_id,
          organization_id: resolvedOrganizationId,
          status: "assembled",
          scene_count: scenes?.length ?? 0,
          assembled_scene_count: enrichedSegments.filter(s => s.audio_asset_id).length,
          total_duration_seconds: totalDuration,
          audio_coverage_pct: audioCovPct,
          scene_audio_map: sceneAudioMap,
          assembly_config: body.config ?? {},
          assembled_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (assemblyErr) {
        await supabase
          .from("doc_studio_drafts")
          .update({ assembly_status: "error", updated_at: new Date().toISOString() })
          .eq("id", draft_id);
        throw assemblyErr;
      }

      await supabase
        .from("doc_studio_drafts")
        .update({
          assembly_status: "assembling_captions",
          total_estimated_duration_seconds: totalDuration,
          audio_coverage_pct: audioCovPct,
          last_assembled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", draft_id);

      return jsonResponse({ success: true, assembly });
    }

    if (action === "assemble_captions") {
      const { data: scenes } = await supabase
        .from("doc_studio_scenes")
        .select("id, title, position")
        .eq("draft_id", draft_id)
        .order("position");

      const { data: segments } = await supabase
        .from("documentation_narration_segments")
        .select("id, scene_id, duration_seconds, narration_text, timing_json")
        .eq("draft_id", draft_id);

      const segByScene = new Map((segments ?? []).map(s => [s.scene_id, s]));
      let offsetMs = 0;
      const allBlocks: unknown[] = [];

      for (const scene of scenes ?? []) {
        const seg = segByScene.get(scene.id);
        if (!seg) continue;

        const duration = seg.duration_seconds ?? estimateDuration(seg.narration_text ?? "");
        const timing = seg.timing_json as { words?: Array<{ word: string; start_ms?: number; end_ms?: number }> } | null;
        const words = timing?.words ?? [];
        const text = seg.narration_text ?? "";
        const wordList = text.trim().split(/\s+/).filter(Boolean);

        const chunkSize = 7;
        if (words.length > 0) {
          for (let i = 0; i < words.length; i += chunkSize) {
            const chunk = words.slice(i, i + chunkSize);
            allBlocks.push({
              id: `${scene.id}_c${i}`,
              text: chunk.map(w => w.word).join(" "),
              start_ms: offsetMs + (chunk[0]?.start_ms ?? 0),
              end_ms: offsetMs + (chunk[chunk.length - 1]?.end_ms ?? 0),
              scene_id: scene.id,
              source: "timing",
            });
          }
        } else {
          const totalMs = Math.round(duration * 1000);
          const msPerWord = wordList.length > 0 ? totalMs / wordList.length : 500;
          for (let i = 0; i < wordList.length; i += chunkSize) {
            const chunk = wordList.slice(i, i + chunkSize);
            allBlocks.push({
              id: `${scene.id}_c${i}`,
              text: chunk.join(" "),
              start_ms: offsetMs + Math.round(i * msPerWord),
              end_ms: offsetMs + Math.round((i + chunkSize) * msPerWord),
              scene_id: scene.id,
              source: "estimated",
            });
          }
        }

        offsetMs += Math.round(duration * 1000);
      }

      const totalMs = offsetMs;
      const scenesWithCaptions = new Set((allBlocks as Array<{ scene_id: string }>).map(b => b.scene_id)).size;
      const coveragePct = scenes?.length
        ? Math.round((scenesWithCaptions / scenes.length) * 100)
        : 0;

      const { data: captionManifest } = await supabase
        .from("documentation_caption_manifests")
        .insert({
          draft_id,
          organization_id: resolvedOrganizationId,
          schema_version: "1.0",
          caption_blocks: allBlocks,
          total_caption_count: allBlocks.length,
          total_duration_ms: totalMs,
          scene_coverage_pct: coveragePct,
          export_formats_available: ["raw", "srt", "vtt", "json"],
          generated_at: new Date().toISOString(),
          source: "pipeline",
        })
        .select()
        .single();

      await supabase
        .from("doc_studio_drafts")
        .update({
          caption_coverage_pct: coveragePct,
          updated_at: new Date().toISOString(),
        })
        .eq("id", draft_id);

      return jsonResponse({ success: true, caption_manifest: captionManifest });
    }

    if (action === "get_assembly") {
      const [{ data: assembly }, { data: captions }] = await Promise.all([
        supabase
          .from("documentation_audio_assemblies")
          .select("*")
          .eq("draft_id", draft_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("documentation_caption_manifests")
          .select("*")
          .eq("draft_id", draft_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const { data: sceneMap } = await supabase
        .from("documentation_scene_audio_map")
        .select("*")
        .eq("draft_id", draft_id)
        .order("scene_position");

      return jsonResponse({
        success: true,
        audio_assembly: assembly,
        caption_manifest: captions,
        scene_audio_map: sceneMap ?? [],
      });
    }

    if (action === "ingest_timing") {
      const { segment_id, alignment, offset_ms = 0 } = body;
      if (!segment_id || !alignment) {
        return jsonResponse({ success: false, error: "segment_id and alignment required" }, 400);
      }

      const timingData = computeWordTimings(alignment as ElevenLabsAlignment);
      const adjustedWords = offset_ms > 0
        ? timingData.words.map(w => ({ ...w, start_ms: w.start_ms + offset_ms, end_ms: w.end_ms + offset_ms }))
        : timingData.words;

      const timingMetadata = { ...timingData, words: adjustedWords };
      const durationSeconds = Math.round(timingData.total_duration_ms / 100) / 10;

      const { error: updateErr } = await supabase
        .from("documentation_narration_segments")
        .update({
          timing_json: timingMetadata,
          target_duration_seconds: durationSeconds,
          updated_at: new Date().toISOString(),
        })
        .eq("id", segment_id)
        .eq("draft_id", draft_id);

      if (updateErr) throw updateErr;

      return jsonResponse({
        success: true,
        result: {
          segment_id,
          timing_json: timingMetadata,
          duration_seconds: durationSeconds,
          word_count: timingData.words.length,
          persisted: true,
        },
      });
    }

    if (action === "replace_audio") {
      const {
        scene_id,
        segment_id,
        new_audio_asset_id,
        new_duration_seconds,
        new_timing_json,
        reason,
        replaced_by,
        alignment,
      } = body;

      if (!scene_id || !segment_id || !new_audio_asset_id) {
        return jsonResponse({ success: false, error: "scene_id, segment_id, and new_audio_asset_id required" }, 400);
      }

      const { data: oldSeg } = await supabase
        .from("documentation_narration_segments")
        .select("audio_asset_id, duration_seconds, timing_json")
        .eq("id", segment_id)
        .maybeSingle();

      let resolvedTiming = new_timing_json ?? null;
      let resolvedDuration = new_duration_seconds ?? null;

      if (!resolvedTiming && alignment) {
        const timingData = computeWordTimings(alignment as ElevenLabsAlignment);
        resolvedTiming = timingData;
        resolvedDuration = resolvedDuration ?? Math.round(timingData.total_duration_ms / 100) / 10;
      }

      const segUpdate: Record<string, unknown> = {
        audio_asset_id: new_audio_asset_id,
        status: "ready",
        updated_at: new Date().toISOString(),
      };
      if (resolvedDuration !== null) segUpdate.target_duration_seconds = resolvedDuration;
      if (resolvedTiming !== null) segUpdate.timing_json = resolvedTiming;

      await supabase
        .from("documentation_narration_segments")
        .update(segUpdate)
        .eq("id", segment_id)
        .eq("draft_id", draft_id);

      await supabase
        .from("documentation_scene_audio_map")
        .upsert({
          draft_id,
          organization_id,
          scene_id,
          narration_segment_id: segment_id,
          audio_asset_id: new_audio_asset_id,
          duration_seconds: resolvedDuration ?? 0,
          timing_json: resolvedTiming ?? null,
          status: "audio_ready",
          is_complete: !!(resolvedTiming),
        }, { onConflict: "scene_id,draft_id" });

      const { data: replacement, error: repErr } = await supabase
        .from("doc_studio_audio_replacements")
        .insert({
          draft_id,
          scene_id,
          old_audio_asset_id: oldSeg?.audio_asset_id ?? null,
          new_audio_asset_id,
          old_duration_seconds: oldSeg?.duration_seconds ?? null,
          new_duration_seconds: resolvedDuration,
          replaced_by: replaced_by ?? null,
          reason: reason ?? null,
          metadata_json: { segment_id, had_prior_timing: !!(oldSeg?.timing_json) },
        })
        .select()
        .single();

      if (repErr) throw repErr;

      return jsonResponse({ success: true, replacement });
    }

    return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error('[doc-studio-assembly] Unhandled error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  }
});
