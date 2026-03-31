import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createServiceClient,
  requireSuperAdminOrTrustedToken,
  requireDocStudioAuthContext,
} from "../_shared/auth.ts";
import { resolveAIConfig, callAI } from "../_shared/ai-provider.ts";
import { corsPreflightResponse, jsonResponse } from "../_shared/http.ts";

function bodyOrganizationId(body: Record<string, unknown>): string | null {
  const snake = body.organization_id;
  if (typeof snake === "string" && snake.trim().length > 0) return snake.trim();
  const camel = body.organizationId;
  if (typeof camel === "string" && camel.trim().length > 0) return camel.trim();
  return null;
}

async function verifyDraftAccess(
  supabase: ReturnType<typeof createServiceClient>,
  draftId: string,
  organizationId: string,
): Promise<boolean> {
  const { data: draft } = await supabase
    .from("doc_studio_drafts")
    .select("id")
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return !!draft;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const supabase = createServiceClient();
    const auth = await requireSuperAdminOrTrustedToken(req, supabase);
    if (auth.error) return auth.error;

    const body = await req.json() as Record<string, unknown>;
    const { action } = body;
    const draftScopedActions = new Set([
      "list",
      "create",
      "bulk_create",
      "delete_all",
      "generate_for_job",
      "generate_batch",
    ]);
    const draft_id = typeof body.draft_id === "string" ? body.draft_id : null;

    const requireDraftContext = async (resolvedDraftId?: string | null) => {
      const auth = await requireDocStudioAuthContext(req, supabase, { draftId: resolvedDraftId });
      if ("error" in auth) return auth;
      return auth;
    };

    if (action === "list") {
      if (!draft_id) return errorResponse("draft_id required", 400);
      const auth = await requireDraftContext(draft_id);
      if ("error" in auth) return auth.error;

      const { data, error } = await supabase
        .from("documentation_narration_segments")
        .select("*")
        .eq("draft_id", draft_id)
        .order("segment_order", { ascending: true });

      if (error) throw error;
      return successResponse({ segments: data });
    }

    if (action === "get") {
      const { segment_id } = body;
      if (!segment_id) return errorResponse("segment_id required", 400);

      const { data: segmentLookup, error: segmentLookupErr } = await supabase
        .from("documentation_narration_segments")
        .select("draft_id")
        .eq("id", segment_id)
        .maybeSingle();
      if (segmentLookupErr) throw segmentLookupErr;
      if (!segmentLookup?.draft_id) return errorResponse("Segment not found", 404);

      const auth = await requireDraftContext(segmentLookup.draft_id);
      if ("error" in auth) return auth.error;

      const { data, error } = await supabase
        .from("documentation_narration_segments")
        .select("*")
        .eq("id", segment_id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return errorResponse("Segment not found", 404);
      if (!(await verifyDraftAccess(supabase, String(data.draft_id), organizationId))) return errorResponse("Access denied", 403);
      return successResponse({ segment: data });
    }

    if (action === "create") {
      const {
        draft_id, scene_id, segment_order, narration_text,
        short_narration_text, style, target_duration_seconds,
        transcript_text, caption_text, timing_json, status,
      } = body;

      if (!draft_id || !narration_text) return errorResponse("draft_id and narration_text required", 400);
      const auth = await requireDraftContext(draft_id);
      if ("error" in auth) return auth.error;

      const { data, error } = await supabase
        .from("documentation_narration_segments")
        .insert({
          draft_id,
          scene_id: scene_id ?? null,
          segment_order: segment_order ?? 0,
          narration_text,
          short_narration_text: short_narration_text ?? null,
          style: style ?? "instructional",
          target_duration_seconds: target_duration_seconds ?? null,
          transcript_text: transcript_text ?? null,
          caption_text: caption_text ?? null,
          timing_json: timing_json ?? {},
          audio_asset_id: null,
          status: status ?? "draft",
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) return errorResponse("Failed to create segment", 500);
      return successResponse({ segment: data });
    }

    if (action === "update") {
      const { segment_id, ...updates } = body;
      if (!segment_id) return errorResponse("segment_id required", 400);

      const { data: segmentLookup, error: segmentLookupErr } = await supabase
        .from("documentation_narration_segments")
        .select("draft_id")
        .eq("id", segment_id)
        .maybeSingle();
      if (segmentLookupErr) throw segmentLookupErr;
      if (!segmentLookup?.draft_id) return errorResponse("Segment not found", 404);

      const auth = await requireDraftContext(segmentLookup.draft_id);
      if ("error" in auth) return auth.error;

      const allowed = [
        "narration_text", "short_narration_text", "style",
        "target_duration_seconds", "transcript_text", "caption_text",
        "timing_json", "audio_asset_id", "status", "segment_order",
      ];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) {
        if (updates[k] !== undefined) patch[k] = updates[k];
      }

      const { data, error } = await supabase
        .from("documentation_narration_segments")
        .update(patch)
        .eq("id", segment_id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) return errorResponse("Segment not found", 404);
      return successResponse({ segment: data });
    }

    if (action === "delete") {
      const { segment_id } = body;
      if (!segment_id) return errorResponse("segment_id required", 400);

      const { data: segmentLookup, error: segmentLookupErr } = await supabase
        .from("documentation_narration_segments")
        .select("draft_id")
        .eq("id", segment_id)
        .maybeSingle();
      if (segmentLookupErr) throw segmentLookupErr;
      if (!segmentLookup?.draft_id) return errorResponse("Segment not found", 404);

      const auth = await requireDraftContext(segmentLookup.draft_id);
      if ("error" in auth) return auth.error;

      const { error } = await supabase
        .from("documentation_narration_segments")
        .delete()
        .eq("id", segment_id);

      if (error) throw error;
      return successResponse({ deleted: true });
    }

    if (action === "bulk_create") {
      const { segments } = body;
      if (!Array.isArray(segments) || !segments.length) return errorResponse("segments array required", 400);
      const firstDraftId = segments.find((s: unknown) => typeof (s as Record<string, unknown>)?.draft_id === "string") as Record<string, unknown> | undefined;
      if (!firstDraftId?.draft_id) return errorResponse("segments must include draft_id", 400);
      if (!(await verifyDraftAccess(supabase, String(firstDraftId.draft_id), organizationId))) return errorResponse("Draft not found", 404);

      if (!draft_id) return errorResponse("draft_id required", 400);
      const auth = await requireDraftContext(draft_id);
      if ("error" in auth) return auth.error;

      const allowedFields = [
        "draft_id", "scene_id", "segment_order", "narration_text",
        "short_narration_text", "style", "target_duration_seconds",
        "transcript_text", "caption_text", "timing_json", "status",
      ];
      const sanitized = segments.map((s: Record<string, unknown>) => {
        const row: Record<string, unknown> = { draft_id };
        for (const f of allowedFields) {
          if (s[f] !== undefined) row[f] = s[f];
        }
        row.draft_id = draft_id;
        return row;
      });

      const { data, error } = await supabase
        .from("documentation_narration_segments")
        .insert(sanitized)
        .select();

      if (error) throw error;
      return successResponse({ segments: data, count: data?.length ?? 0 });
    }

    if (action === "delete_all") {
      if (!draft_id) return errorResponse("draft_id required", 400);
      const auth = await requireDraftContext(draft_id);
      if ("error" in auth) return auth.error;

      const { error } = await supabase
        .from("documentation_narration_segments")
        .delete()
        .eq("draft_id", draft_id);

      if (error) throw error;
      return successResponse({ deleted: true });
    }

    if (action === "generate_segment") {
      const { segment_id, narration_text, draft_id, voice_id, voice_config } = body;
      if (!segment_id || !narration_text) return errorResponse("segment_id and narration_text required", 400);
      if (!draft_id) return errorResponse("draft_id required", 400);

      const auth = await requireDraftContext(draft_id);
      if ("error" in auth) return auth.error;

      const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
      if (!apiKey) {
        await supabase
          .from("documentation_narration_segments")
          .update({ status: "draft" })
          .eq("id", segment_id)
          .eq("draft_id", draft_id);
        return jsonResponse({
          success: false,
          error: "ElevenLabs API key not configured",
          code: "ELEVENLABS_NOT_CONFIGURED",
        }, 503);
      }

      await supabase
        .from("documentation_narration_segments")
        .update({ status: "generating" })
        .eq("id", segment_id)
        .eq("draft_id", draft_id);

      const vc = (voice_config ?? {}) as Record<string, unknown>;
      const usedVoiceId = (voice_id as string | undefined) ?? DEFAULT_VOICE_ID;
      const modelId = (vc.model_id as string | undefined) ?? DEFAULT_MODEL_ID;

      const { data: pronEntries } = await supabase
        .from("documentation_pronunciation_dictionary")
        .select("term, replacement_mode, substitute_text, phonetic_spelling, provider_compat")
        .eq("organization_id", organizationId)
        .eq("is_enabled", true);

      const { processedText, hasSsml } = applyPronunciationForTts(
        narration_text,
        pronEntries ?? [],
        modelId,
      );

      const requestText = hasSsml ? `<speak>${processedText}</speak>` : processedText;

      const ttsRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${usedVoiceId}/with-timestamps`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            text: requestText,
            model_id: modelId,
            voice_settings: {
              stability: (vc.stability as number | undefined) ?? 0.5,
              similarity_boost: (vc.similarity_boost as number | undefined) ?? 0.75,
              style: (vc.style as number | undefined) ?? 0.0,
              use_speaker_boost: (vc.use_speaker_boost as boolean | undefined) ?? true,
            },
          }),
        },
      );

      if (!ttsRes.ok) {
        const errBody = await ttsRes.text();
        await supabase
          .from("documentation_narration_segments")
          .update({ status: "error" })
          .eq("id", segment_id)
          .eq("draft_id", draft_id);
        return errorResponse(`ElevenLabs TTS error: ${ttsRes.status} ${errBody}`, 502);
      }

      const ttsData = (await ttsRes.json()) as {
        audio_base64: string;
        alignment: ElevenLabsAlignment | null;
        normalized_alignment: ElevenLabsAlignment | null;
      };

      const audioBuffer = base64ToUint8Array(ttsData.audio_base64);
      const storagePath = `${draft_id}/${segment_id}.mp3`;

      const { error: uploadError } = await supabase.storage
        .from("doc-studio-audio")
        .upload(storagePath, audioBuffer, { contentType: "audio/mpeg", upsert: true });

      if (uploadError) {
        await supabase
          .from("documentation_narration_segments")
          .update({ status: "error" })
          .eq("id", segment_id)
          .eq("draft_id", draft_id);
        return errorResponse(`Storage upload failed: ${uploadError.message}`, 500);
      }

      const audioAssetId = `storage:doc-studio-audio:${storagePath}`;
      const alignData = ttsData.normalized_alignment ?? ttsData.alignment;
      const timingMetadata = alignData
        ? computeWordTimings(
            alignData.characters,
            alignData.character_start_times_seconds,
            alignData.character_durations_seconds,
          )
        : buildEstimatedTiming(narration_text, 140);

      const totalDurationSec = timingMetadata.total_duration_ms
        ? timingMetadata.total_duration_ms / 1000
        : estimateDuration(narration_text, 140);

      const { data: updatedSeg, error: updateError } = await supabase
        .from("documentation_narration_segments")
        .update({
          audio_asset_id: audioAssetId,
          timing_json: timingMetadata,
          target_duration_seconds: totalDurationSec,
          status: "ready",
        })
        .eq("id", segment_id)
        .eq("draft_id", draft_id)
        .select()
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updatedSeg) return errorResponse("Segment not found", 404);

      return successResponse({
        segment: updatedSeg,
        audio_asset_id: audioAssetId,
        duration_seconds: totalDurationSec,
        timing_metadata: timingMetadata,
        voice_id: usedVoiceId,
        model: modelId,
        provider: "elevenlabs",
        status: "ready",
      });
    }

    if (action === "generate_for_job") {
      const { job_id } = body;
      if (!job_id || !draft_id) return errorResponse("job_id and draft_id required", 400);
      const auth = await requireDraftContext(draft_id);
      if ("error" in auth) return auth.error;

      const [scenesRes, settingsRes, pronunciationRes, aiConfigResult] = await Promise.all([
        supabase
          .from("doc_studio_scenes")
          .select("id, scene_order, title, summary, metadata_json")
          .eq("draft_id", draft_id)
          .eq("job_id", job_id)
          .order("scene_order", { ascending: true }),
        supabase
          .from("documentation_settings")
          .select("value_json")
          .eq("organization_id", organizationId)
          .eq("key", "narration_advanced_config")
          .maybeSingle(),
        supabase
          .from("documentation_pronunciation_dictionary")
          .select("term, replacement_mode, substitute_text, phonetic_spelling")
          .eq("organization_id", organizationId)
          .eq("replacement_mode", "substitute"),
        resolveAIConfig(supabase),
      ]);

      const scenes = scenesRes.data ?? [];
      if (scenes.length === 0) {
        return successResponse({ segments: [], count: 0, skipped_reason: "no_scenes" });
      }

      const narrationConfig = {
        narration_enabled: true,
        per_scene_narration: true,
        generate_concise_variant: true,
        target_speech_pace_wpm: 140,
        style_default: "instructional",
        max_segment_duration_seconds: 45,
        ...(settingsRes.data?.value_json ?? {}),
      };

      if (!narrationConfig.narration_enabled) {
        return successResponse({ segments: [], count: 0, skipped_reason: "narration_disabled" });
      }

      const pronunciationMap = new Map<string, string>();
      for (const entry of (pronunciationRes.data ?? [])) {
        if (entry.substitute_text) {
          pronunciationMap.set(entry.term.toLowerCase(), entry.substitute_text);
        }
      }

      await supabase
        .from("documentation_narration_segments")
        .delete()
        .eq("draft_id", draft_id);

      const sceneStepsRes = await supabase
        .from("documentation_scene_steps")
        .select("scene_id, step_order, step_result_json")
        .in("scene_id", scenes.map((s: { id: string }) => s.id))
        .order("step_order", { ascending: true });

      const stepsByScene = new Map<string, Array<{ title: string; description?: string }>>();
      for (const row of (sceneStepsRes.data ?? [])) {
        const sr = row.step_result_json as Record<string, unknown>;
        const entry = { title: String(sr?.title ?? ""), description: String(sr?.extracted_text ?? "") };
        const list = stepsByScene.get(row.scene_id) ?? [];
        list.push(entry);
        stepsByScene.set(row.scene_id, list);
      }

      const style = narrationConfig.style_default ?? "instructional";
      const wpm = Number(narrationConfig.target_speech_pace_wpm) || 140;
      const maxDuration = Number(narrationConfig.max_segment_duration_seconds) || 45;
      const maxWords = Math.floor(wpm * (maxDuration / 60));

      const insertRows: Array<Record<string, unknown>> = [];

      for (const scene of scenes) {
        const steps = stepsByScene.get(scene.id) ?? [];
        const stepContext = steps
          .map((s, i) => `Step ${i + 1}: ${s.title}${s.description ? ` — ${s.description}` : ""}`)
          .join("\n");

        let narrationText: string;
        let shortText: string | null = null;

        if (aiConfigResult) {
          try {
            const systemPrompt = buildNarrationSystemPrompt(style);
            const userMessage = buildNarrationUserMessage(
              scene.title,
              scene.summary ?? "",
              stepContext,
              style,
              maxWords,
            );

            const aiRes = await callAI(aiConfigResult, {
              systemPrompt,
              messages: [{ role: "user", content: userMessage }],
              temperature: 0.6,
              maxTokens: 512,
            }, 30000);

            const parsed = parseNarrationResponse(aiRes.text);
            narrationText = applyPronunciation(parsed.narration, pronunciationMap);
            shortText = narrationConfig.generate_concise_variant
              ? applyPronunciation(parsed.concise ?? shortenText(narrationText, Math.floor(maxWords * 0.5)), pronunciationMap)
              : null;
          } catch (aiErr) {
            console.warn("[narration] AI call failed for scene", scene.id, aiErr);
            narrationText = `In this section, ${scene.title.toLowerCase()}. ${scene.summary ?? ""}`.trim();
            shortText = narrationConfig.generate_concise_variant ? shortenText(narrationText, 30) : null;
          }
        } else {
          narrationText = `In this section, ${scene.title.toLowerCase()}. ${scene.summary ?? ""}`.trim();
          shortText = narrationConfig.generate_concise_variant ? shortenText(narrationText, 30) : null;
        }

        const targetDuration = estimateDuration(narrationText, wpm);

        insertRows.push({
          draft_id,
          scene_id: scene.id,
          segment_order: scene.scene_order,
          narration_text: narrationText,
          short_narration_text: shortText,
          style,
          target_duration_seconds: targetDuration,
          transcript_text: narrationText,
          caption_text: narrationText.slice(0, 200),
          timing_json: { wpm, estimated_duration_seconds: targetDuration },
          audio_asset_id: null,
          status: "draft",
        });
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("documentation_narration_segments")
        .insert(insertRows)
        .select("id, scene_id, segment_order, status");

      if (insertErr) throw insertErr;

      const now = new Date().toISOString();
      await supabase
        .from("doc_studio_drafts")
        .update({ narration_segment_count: inserted?.length ?? 0, updated_at: now })
        .eq("id", draft_id);

      return successResponse({
        segments: inserted ?? [],
        count: inserted?.length ?? 0,
        ai_used: !!aiConfigResult,
      });
    }

    if (action === "generate_batch") {
      const { segments, voice_id, voice_config } = body;
      if (!Array.isArray(segments)) return errorResponse("segments array required", 400);
      if (!draft_id) return errorResponse("draft_id required", 400);

      const auth = await requireDraftContext(draft_id);
      if ("error" in auth) return auth.error;

      const apiKey = Deno.env.get("ELEVENLABS_API_KEY");

      const ids = segments.map((s: { segment_id: string }) => s.segment_id).filter(Boolean);
      if (ids.length > 0) {
        await supabase
          .from("documentation_narration_segments")
          .update({ status: "generating" })
          .in("id", ids);
      }

      if (!apiKey) {
        return successResponse({
          results: segments.map((s: { segment_id: string; narration_text: string }) => ({
            segment_id: s.segment_id,
            audio_asset_id: null,
            duration_seconds: estimateDuration(s.narration_text ?? "", 140),
            timing_metadata: {},
            voice_id: "default",
            model: DEFAULT_MODEL_ID,
            provider: "elevenlabs",
            status: "queued",
          })),
          failed_segment_ids: [],
          total_duration_seconds: 0,
          provider: "elevenlabs",
          code: "ELEVENLABS_NOT_CONFIGURED",
          message: "Batch queued. Audio will be generated once ElevenLabs is configured.",
        });
      }

      const vc = (voice_config ?? {}) as Record<string, unknown>;
      const usedVoiceId = (voice_id as string | undefined) ?? DEFAULT_VOICE_ID;
      const modelId = (vc.model_id as string | undefined) ?? DEFAULT_MODEL_ID;

      const { data: pronEntries } = await supabase
        .from("documentation_pronunciation_dictionary")
        .select("term, replacement_mode, substitute_text, phonetic_spelling, provider_compat")
        .eq("organization_id", organizationId)
        .eq("is_enabled", true);

      type BatchSegment = { segment_id: string; narration_text: string };
      const results: Array<Record<string, unknown>> = [];
      const failedSegmentIds: string[] = [];
      let totalDuration = 0;

      for (const seg of segments as BatchSegment[]) {
        const { segment_id, narration_text } = seg;
        if (!segment_id || !narration_text) {
          failedSegmentIds.push(segment_id ?? "unknown");
          continue;
        }

        try {
          const { processedText, hasSsml } = applyPronunciationForTts(
            narration_text,
            pronEntries ?? [],
            modelId,
          );
          const requestText = hasSsml ? `<speak>${processedText}</speak>` : processedText;

          const ttsRes = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${usedVoiceId}/with-timestamps`,
            {
              method: "POST",
              headers: {
                "xi-api-key": apiKey,
                "Content-Type": "application/json",
                "Accept": "application/json",
              },
              body: JSON.stringify({
                text: requestText,
                model_id: modelId,
                voice_settings: {
                  stability: (vc.stability as number | undefined) ?? 0.5,
                  similarity_boost: (vc.similarity_boost as number | undefined) ?? 0.75,
                  style: (vc.style as number | undefined) ?? 0.0,
                  use_speaker_boost: (vc.use_speaker_boost as boolean | undefined) ?? true,
                },
              }),
            },
          );

          if (!ttsRes.ok) {
            await supabase
              .from("documentation_narration_segments")
              .update({ status: "error" })
              .eq("id", segment_id)
              .eq("draft_id", draft_id);
            failedSegmentIds.push(segment_id);
            continue;
          }

          const ttsData = (await ttsRes.json()) as {
            audio_base64: string;
            alignment: ElevenLabsAlignment | null;
            normalized_alignment: ElevenLabsAlignment | null;
          };

          const audioBuffer = base64ToUint8Array(ttsData.audio_base64);
          const storagePath = `${draft_id}/${segment_id}.mp3`;
          const { error: uploadError } = await supabase.storage
            .from("doc-studio-audio")
            .upload(storagePath, audioBuffer, { contentType: "audio/mpeg", upsert: true });

          if (uploadError) {
            await supabase
              .from("documentation_narration_segments")
              .update({ status: "error" })
              .eq("id", segment_id)
              .eq("draft_id", draft_id);
            failedSegmentIds.push(segment_id);
            continue;
          }

          const audioAssetId = `storage:doc-studio-audio:${storagePath}`;
          const alignData = ttsData.normalized_alignment ?? ttsData.alignment;
          const timingMetadata = alignData
            ? computeWordTimings(
                alignData.characters,
                alignData.character_start_times_seconds,
                alignData.character_durations_seconds,
              )
            : buildEstimatedTiming(narration_text, 140);

          const durationSec = timingMetadata.total_duration_ms
            ? timingMetadata.total_duration_ms / 1000
            : estimateDuration(narration_text, 140);

          await supabase
            .from("documentation_narration_segments")
            .update({
              audio_asset_id: audioAssetId,
              timing_json: timingMetadata,
              target_duration_seconds: durationSec,
              status: "ready",
            })
            .eq("id", segment_id)
            .eq("draft_id", draft_id);

          totalDuration += durationSec;
          results.push({
            segment_id,
            audio_asset_id: audioAssetId,
            duration_seconds: durationSec,
            timing_metadata: timingMetadata,
            voice_id: usedVoiceId,
            model: modelId,
            provider: "elevenlabs",
            status: "ready",
          });
        } catch (segErr) {
          console.warn("[generate_batch] segment failed", segment_id, segErr);
          await supabase
            .from("documentation_narration_segments")
            .update({ status: "error" })
            .eq("id", segment_id)
            .eq("draft_id", draft_id);
          failedSegmentIds.push(segment_id);
        }
      }

      return successResponse({
        results,
        failed_segment_ids: failedSegmentIds,
        total_duration_seconds: totalDuration,
        provider: "elevenlabs",
      });
    }

    return errorResponse(`Unknown action: ${action}`, 400);
  } catch (err: unknown) {
    console.error('[doc-studio-narration-segments] Unhandled error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  }
});

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL_ID = "eleven_v3";
const SSML_SUPPORTING_MODELS = new Set([
  "eleven_v3",
  "eleven_multilingual_v2",
  "eleven_turbo_v2_5",
  "eleven_flash_v2_5",
]);

interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_durations_seconds: number[];
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function computeWordTimings(
  characters: string[],
  startTimesSeconds: number[],
  durationsSeconds: number[],
): { total_duration_ms: number; words: Array<{ word: string; start_ms: number; end_ms: number }>; alignment_confidence: number; generated_by: string } {
  const words: Array<{ word: string; start_ms: number; end_ms: number }> = [];
  let currentWord = "";
  let wordStartSec = 0;

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i];
    const startSec = startTimesSeconds[i] ?? 0;
    const durSec = durationsSeconds[i] ?? 0;

    if (ch === " " || ch === "\n") {
      if (currentWord.length > 0) {
        const prevEndSec = startSec;
        words.push({
          word: currentWord,
          start_ms: Math.round(wordStartSec * 1000),
          end_ms: Math.round(prevEndSec * 1000),
        });
        currentWord = "";
      }
    } else {
      if (currentWord.length === 0) {
        wordStartSec = startSec;
      }
      currentWord += ch;
      if (i === characters.length - 1) {
        const endSec = startSec + durSec;
        words.push({
          word: currentWord,
          start_ms: Math.round(wordStartSec * 1000),
          end_ms: Math.round(endSec * 1000),
        });
      }
    }
  }

  const lastChar = characters.length - 1;
  const totalMs = lastChar >= 0
    ? Math.round(((startTimesSeconds[lastChar] ?? 0) + (durationsSeconds[lastChar] ?? 0)) * 1000)
    : words.length > 0 ? (words[words.length - 1]?.end_ms ?? 0) : 0;

  return {
    total_duration_ms: totalMs,
    words,
    alignment_confidence: 0.98,
    generated_by: "elevenlabs",
  };
}

function buildEstimatedTiming(text: string, wpm: number): { total_duration_ms: number; words: Array<{ word: string; start_ms: number; end_ms: number }>; alignment_confidence: number; generated_by: string } {
  const wordList = text.trim().split(/\s+/).filter(Boolean);
  const totalMs = Math.round((wordList.length / wpm) * 60 * 1000);
  const msPerWord = wordList.length > 0 ? totalMs / wordList.length : 500;
  const words = wordList.map((word, i) => ({
    word,
    start_ms: Math.round(i * msPerWord),
    end_ms: Math.round((i + 1) * msPerWord),
  }));
  return { total_duration_ms: totalMs, words, alignment_confidence: 0.0, generated_by: "estimated" };
}

type PronEntry = { term: string; replacement_mode: string; substitute_text: string | null; phonetic_spelling: string | null; provider_compat: string[] | null };

function applyPronunciationForTts(
  text: string,
  entries: PronEntry[],
  modelId: string,
): { processedText: string; hasSsml: boolean } {
  const ssmlSupported = SSML_SUPPORTING_MODELS.has(modelId);
  let result = text;
  let hasSsml = false;

  for (const entry of entries) {
    if (entry.replacement_mode === "none") continue;
    const compat = entry.provider_compat;
    if (Array.isArray(compat) && compat.length > 0 && !compat.includes("elevenlabs")) continue;

    const regex = new RegExp(`\\b${escapeRegexStr(entry.term)}\\b`, "gi");

    if (entry.replacement_mode === "substitute" && entry.substitute_text) {
      result = result.replace(regex, entry.substitute_text);
    } else if (entry.replacement_mode === "ssml" && ssmlSupported && entry.phonetic_spelling) {
      result = result.replace(
        regex,
        `<phoneme alphabet="ipa" ph="${entry.phonetic_spelling}">${entry.term}</phoneme>`,
      );
      hasSsml = true;
    }
  }

  return { processedText: result, hasSsml };
}

function escapeRegexStr(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function estimateDuration(text: string, wpm: number): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round((words / wpm) * 60 * 10) / 10);
}

function buildNarrationSystemPrompt(style: string): string {
  const styleGuides: Record<string, string> = {
    instructional: "Clear, step-by-step guidance. Active voice. Present tense. Direct and confident.",
    conversational: "Friendly and approachable. Use 'you' and 'your'. Casual but professional.",
    formal: "Professional and precise. Third person where appropriate. Complete sentences.",
    concise: "Minimal words. Each sentence essential. No filler.",
  };
  const guide = styleGuides[style] ?? styleGuides.instructional;
  return [
    "You are a tutorial narrator for a healthcare software product called CareMetric AI.",
    `Style: ${guide}`,
    "Output a JSON object with exactly two keys:",
    '  "narration": a full narration paragraph for the scene (max length as instructed)',
    '  "concise": a shorter version of the same content (roughly half the word count)',
    "Do not include any text outside the JSON object.",
  ].join("\n");
}

function buildNarrationUserMessage(
  sceneTitle: string,
  sceneSummary: string,
  stepContext: string,
  style: string,
  maxWords: number,
): string {
  return [
    `Scene: "${sceneTitle}"`,
    sceneSummary ? `Summary: ${sceneSummary}` : "",
    stepContext ? `Steps:\n${stepContext}` : "",
    `Write a ${style} narration paragraph for a tutorial video covering this scene.`,
    `Keep the full narration under ${maxWords} words.`,
    "Output only the JSON object.",
  ]
    .filter(Boolean)
    .join("\n");
}

function parseNarrationResponse(text: string): { narration: string; concise?: string } {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.narration === "string") {
        return { narration: parsed.narration.trim(), concise: parsed.concise?.trim() };
      }
    }
  } catch {
    // fall through to raw text
  }
  const cleaned = text.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
  return { narration: cleaned };
}

function applyPronunciation(text: string, dict: Map<string, string>): string {
  if (dict.size === 0) return text;
  let result = text;
  for (const [term, substitute] of dict) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\b${escaped}\\b`, "gi"), substitute);
  }
  return result;
}

function shortenText(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "…";
}

function successResponse(data: Record<string, unknown>) {
  return jsonResponse({ success: true, ...data });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}
