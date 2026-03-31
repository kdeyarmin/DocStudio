import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireSuperAdminOrTrustedToken, verifyOrgMembership } from "../_shared/auth.ts";
import { jsonResponse, corsPreflightResponse } from "../_shared/http.ts";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // ElevenLabs "Rachel"
const DEFAULT_MODEL_ID = "eleven_v3";
const DEFAULT_STABILITY = 0.5;
const DEFAULT_SIMILARITY_BOOST = 0.75;
const DEFAULT_STYLE = 0.0;
const DEFAULT_USE_SPEAKER_BOOST = true;
const DEFAULT_WPM = 140;

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const ELEVENLABS_VOICES_URL = "https://api.elevenlabs.io/v1/voices";
const STORAGE_BUCKET = "doc-studio-audio";

// ─── Voice model config shape sent from the client ────────────────────────────

interface VoiceModelConfig {
  model_id?: string;
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
  language_code?: string;
  optimize_streaming_latency?: number;
}

// ─── Timing placeholder ───────────────────────────────────────────────────────

interface WordTiming {
  word: string;
  start_ms: number;
  end_ms: number;
}

interface TimingPlaceholder {
  total_duration_ms: number;
  words: WordTiming[];
  characters: unknown[];
  alignment_confidence: number;
  generated_by: string;
}

function buildTimingPlaceholder(script: string, wpm: number): TimingPlaceholder {
  const words = script.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const wps = wpm / 60;
  const totalDurationMs = wordCount > 0 ? Math.round((wordCount / wps) * 1000) : 0;
  const msPerWord = wordCount > 0 ? totalDurationMs / wordCount : 0;

  return {
    total_duration_ms: totalDurationMs,
    words: words.map((word, i) => ({
      word,
      start_ms: Math.round(i * msPerWord),
      end_ms: Math.round((i + 1) * msPerWord),
    })),
    characters: [],
    alignment_confidence: 0,
    generated_by: "placeholder",
  };
}

// ─── Resolve ElevenLabs key ────────────────────────────────────────────────────

async function resolveElevenLabsKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data } = await supabase
    .from("platform_global_api_keys")
    .select("api_key, is_active")
    .eq("service_name", "elevenlabs")
    .eq("is_active", true)
    .maybeSingle();

  const dbKey = data?.api_key;
  if (dbKey && !dbKey.startsWith("env:")) return dbKey;

  return Deno.env.get("ELEVENLABS_API_KEY") ?? null;
}

// ─── Resolve voice ID and voice model config from settings ────────────────────

async function resolveVoiceSettings(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  payloadVoiceId?: string,
  payloadModelConfig?: VoiceModelConfig,
): Promise<{
  voiceId: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
  languageCode?: string;
  optimizeStreamingLatency?: number;
}> {
  const { data } = await supabase
    .from("documentation_settings")
    .select("value_json")
    .eq("organization_id", organizationId)
    .eq("key", "narration_config")
    .maybeSingle();

  const cfg = (data?.value_json ?? {}) as Record<string, unknown>;

  return {
    voiceId:
      payloadVoiceId ??
      (cfg.elevenlabs_voice_id as string | undefined) ??
      DEFAULT_VOICE_ID,
    modelId:
      payloadModelConfig?.model_id ??
      (cfg.elevenlabs_model_id as string | undefined) ??
      DEFAULT_MODEL_ID,
    stability:
      payloadModelConfig?.stability ??
      (cfg.elevenlabs_stability as number | undefined) ??
      DEFAULT_STABILITY,
    similarityBoost:
      payloadModelConfig?.similarity_boost ??
      (cfg.elevenlabs_similarity_boost as number | undefined) ??
      DEFAULT_SIMILARITY_BOOST,
    style:
      payloadModelConfig?.style ??
      (cfg.elevenlabs_style as number | undefined) ??
      DEFAULT_STYLE,
    useSpeakerBoost:
      payloadModelConfig?.use_speaker_boost ??
      (cfg.elevenlabs_use_speaker_boost as boolean | undefined) ??
      DEFAULT_USE_SPEAKER_BOOST,
    languageCode:
      payloadModelConfig?.language_code ??
      (cfg.elevenlabs_language_code as string | undefined),
    optimizeStreamingLatency:
      payloadModelConfig?.optimize_streaming_latency ??
      (cfg.elevenlabs_optimize_streaming_latency as number | undefined),
  };
}

function bodyOrganizationId(body: Record<string, unknown>): string | null {
  const snake = body.organization_id;
  if (typeof snake === "string" && snake.trim().length > 0) return snake.trim();
  const camel = body.organizationId;
  if (typeof camel === "string" && camel.trim().length > 0) return camel.trim();
  return null;
}

// ─── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Service not configured" }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
    const supabase = createClient(supabaseUrl, serviceKey);
    const auth = await requireSuperAdminOrTrustedToken(req, supabase);
    if (auth.error) return auth.error;

    const body = await req.json() as {
      action?: string;
      draftId?: string;
      organizationId?: string;
      organization_id?: string;
      voiceId?: string;
      voice_model_config?: VoiceModelConfig;
    };

    const {
      action = "generate",
      draftId,
      voiceId: payloadVoiceId,
      voice_model_config: payloadModelConfig,
    } = body;
    const organizationId = bodyOrganizationId(body as Record<string, unknown>);

    if (!organizationId) {
      return jsonResponse({ success: false, error: "organization_id is required" }, 400);
    }

    const membership = await verifyOrgMembership(supabase, auth.user.id, organizationId, req);
    if (membership.error) return membership.error;

    // ── Test key action ───────────────────────────────────────────────────────
    if (action === "test_key") {
      const apiKey = await resolveElevenLabsKey(supabase);
      if (!apiKey) {
        return jsonResponse({ success: false, available: false, error: "No ElevenLabs API key configured" });
      }
      const testRes = await fetch(ELEVENLABS_VOICES_URL, {
        headers: { "xi-api-key": apiKey },
      });
      if (!testRes.ok) {
        return jsonResponse({ success: false, available: false, error: `ElevenLabs returned ${testRes.status}` });
      }
      const voicesData = await testRes.json() as { voices: Array<{ voice_id: string; name: string }> };
      return jsonResponse({ success: true, available: true, voice_count: voicesData.voices?.length ?? 0 });
    }

    // ── Check availability action ─────────────────────────────────────────────
    if (action === "check_available") {
      const apiKey = await resolveElevenLabsKey(supabase);
      return jsonResponse({ success: true, available: !!apiKey });
    }

    // ── Generate action ───────────────────────────────────────────────────────
    if (!draftId) {
      return jsonResponse({ success: false, error: "draftId is required" }, 400);
    }

    const { data: draft, error: draftErr } = await supabase
      .from("doc_studio_drafts")
      .select("id, organization_id, generated_content, edited_content, title")
      .eq("id", draftId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (draftErr || !draft) {
      return jsonResponse({ success: false, error: "Draft not found" }, 404);
    }

    const gc = (draft.generated_content ?? {}) as Record<string, unknown>;
    const ec = (draft.edited_content ?? {}) as Record<string, unknown>;
    const narrationScript =
      (ec.narration_script as string | undefined) ||
      (gc.narration_script as string | undefined);

    if (!narrationScript || narrationScript.trim().length === 0) {
      return jsonResponse({
          success: false,
          error: "No narration script found. Generate content first.",
        }, 422);
    }

    const apiKey = await resolveElevenLabsKey(supabase);
    if (!apiKey) {
      return jsonResponse({
          success: false,
          error: "ElevenLabs API key not configured. Add it in Doc Studio settings.",
        }, 422);
    }

    const voiceSettings = await resolveVoiceSettings(supabase, organizationId, payloadVoiceId, payloadModelConfig);
    const orgId = organizationId;

    const { data: latestJob } = await supabase
      .from("documentation_jobs")
      .select("id")
      .eq("draft_id", draftId)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestJob?.id) {
      await supabase.from("documentation_job_events").insert({
        job_id: latestJob.id,
        event_type: "narration_generation_started",
        title: "Narration generation started",
        description: `Voice: ${voiceSettings.voiceId} · Model: ${voiceSettings.modelId}`,
        severity: "info",
        payload_json: {
          voice_id: voiceSettings.voiceId,
          model_id: voiceSettings.modelId,
          stability: voiceSettings.stability,
          similarity_boost: voiceSettings.similarityBoost,
          style: voiceSettings.style,
          script_length: narrationScript.length,
        },
      });
    }

    // ── Build ElevenLabs voice_settings payload ───────────────────────────────
    const elevenLabsVoiceSettings: Record<string, unknown> = {
      stability: voiceSettings.stability,
      similarity_boost: voiceSettings.similarityBoost,
      style: voiceSettings.style,
      use_speaker_boost: voiceSettings.useSpeakerBoost,
    };

    const ttsBody: Record<string, unknown> = {
      text: narrationScript,
      model_id: voiceSettings.modelId,
      voice_settings: elevenLabsVoiceSettings,
    };

    if (voiceSettings.languageCode) {
      ttsBody.language_code = voiceSettings.languageCode;
    }

    let queryString = "";
    if (voiceSettings.optimizeStreamingLatency !== undefined) {
      queryString = `?optimize_streaming_latency=${voiceSettings.optimizeStreamingLatency}`;
    }

    const ttsRes = await fetch(`${ELEVENLABS_TTS_URL}/${voiceSettings.voiceId}${queryString}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify(ttsBody),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      throw new Error(`ElevenLabs TTS error ${ttsRes.status}: ${errText}`);
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);

    const timestamp = Date.now();
    const storagePath = `${orgId}/narration/${draftId}_${timestamp}.mp3`;

    const { error: uploadErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, audioBytes, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData?.publicUrl ?? "";

    // Duration via actual word count at the resolved WPM (140 default)
    const wordCount = narrationScript.split(/\s+/).filter(Boolean).length;
    const durationSeconds = Math.ceil((wordCount / DEFAULT_WPM) * 60);

    // Build timing placeholder for client to use while real timestamps are unavailable
    const timingPlaceholder = buildTimingPlaceholder(narrationScript, DEFAULT_WPM);

    const { data: assetRecord, error: assetErr } = await supabase
      .from("doc_studio_assets")
      .insert({
        draft_id: draftId,
        organization_id: orgId,
        asset_type: "audio",
        storage_path: storagePath,
        public_url: publicUrl,
        file_name: `narration_${timestamp}.mp3`,
        file_size_bytes: audioBytes.byteLength,
        mime_type: "audio/mpeg",
        duration_seconds: durationSeconds,
        sort_order: 9999,
        metadata: {
          voice_id: voiceSettings.voiceId,
          provider: "elevenlabs",
          model: voiceSettings.modelId,
          stability: voiceSettings.stability,
          similarity_boost: voiceSettings.similarityBoost,
          style: voiceSettings.style,
          use_speaker_boost: voiceSettings.useSpeakerBoost,
          language_code: voiceSettings.languageCode,
          generated_at: new Date().toISOString(),
          word_count: wordCount,
        },
      })
      .select()
      .single();

    if (assetErr) throw new Error(`Asset record insert failed: ${assetErr.message}`);

    if (latestJob?.id) {
      await supabase
        .from("documentation_jobs")
        .update({ narration_generated_at: new Date().toISOString() })
        .eq("id", latestJob.id);

      await supabase.from("documentation_job_events").insert({
        job_id: latestJob.id,
        event_type: "narration_generation_completed",
        title: "Narration audio generated",
        description: `${durationSeconds}s estimated · ${(audioBytes.byteLength / 1024).toFixed(1)} KB`,
        severity: "success",
        payload_json: {
          voice_id: voiceSettings.voiceId,
          model_id: voiceSettings.modelId,
          duration_seconds: durationSeconds,
          file_size_bytes: audioBytes.byteLength,
          asset_id: assetRecord.id,
          timing_word_count: timingPlaceholder.words.length,
        },
      });
    }

    return jsonResponse({
        success: true,
        asset: assetRecord,
        duration_seconds: durationSeconds,
        voice_id: voiceSettings.voiceId,
        model_id: voiceSettings.modelId,
        timing_placeholder: timingPlaceholder,
      });
  } catch (err) {
    console.error("[doc-studio-narration] error:", err instanceof Error ? err.message : String(err));
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  }
});
