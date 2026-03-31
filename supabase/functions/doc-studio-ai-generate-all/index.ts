import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createServiceClient, requireSuperAdminOrTrustedToken } from "../_shared/auth.ts";
import { corsPreflightResponse, jsonResponse } from "../_shared/http.ts";
import {
  callAI,
  resolveAIConfigForTask,
  type AIProviderConfig,
  type AIRequest,
} from "../_shared/ai-provider.ts";

console.log("[doc-studio-ai-generate-all] Edge function module loaded");

interface GenerateRequest {
  jobId: string;
  organizationId: string;
  prompt: string;
  targetUrl: string;
  targetAudience: string;
  outputTypes: string[];
}

interface ScenePlan {
  order: number;
  title: string;
  type: "intro" | "step" | "outro";
  summary: string;
  narration: string;
  shortNarration: string;
  captionText: string;
  estimatedDurationSeconds: number;
  visualHint: string;
}

interface AIPlan {
  title: string;
  description: string;
  scenes: ScenePlan[];
  markdownGuide: string;
}

function makeSupabaseClient() {
  return createServiceClient();
}

function bodyOrganizationId(body: Record<string, unknown>): string | null {
  const snake = body.organization_id;
  if (typeof snake === "string" && snake.trim().length > 0) return snake.trim();
  const camel = body.organizationId;
  if (typeof camel === "string" && camel.trim().length > 0) return camel.trim();
  return null;
}

async function updateJob(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  organizationId: string,
  fields: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("doc_studio_simple_jobs")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("organization_id", organizationId);
  if (error) {
    console.error("updateJob failed:", error.message, "fields:", JSON.stringify(fields));
    throw new Error('Database update failed');
  }
}

async function callAIWithRetry(
  aiConfig: AIProviderConfig,
  request: AIRequest,
  timeoutMs: number,
  maxRetries = 2,
) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callAI(aiConfig, request, timeoutMs);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

function safeParseJSON(raw: string): unknown {
  const stripped = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const jsonStart = stripped.indexOf("{");
  const jsonEnd = stripped.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("AI response did not contain valid JSON object");
  }

  let jsonStr = stripped.slice(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(jsonStr);
  } catch {
    jsonStr = jsonStr
      .replace(/,\s*([}\]])/g, "$1")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, (ch) => {
        if (ch === "\n" || ch === "\r" || ch === "\t") return ch;
        return "";
      });

    try {
      return JSON.parse(jsonStr);
    } catch (secondErr) {
      jsonStr = jsonStr.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
      try {
        return JSON.parse(jsonStr);
      } catch {
        const arrStart = stripped.indexOf("[");
        const arrEnd = stripped.lastIndexOf("]");
        if (arrStart !== -1 && arrEnd !== -1 && arrStart < jsonStart) {
          try {
            return JSON.parse(stripped.slice(arrStart, arrEnd + 1));
          } catch (_) {
            // fall through
          }
        }
        throw secondErr;
      }
    }
  }
}

async function buildPlan(
  aiConfig: AIProviderConfig,
  prompt: string,
  targetUrl: string,
  targetAudience: string,
): Promise<AIPlan> {
  const audienceDescriptions: Record<string, string> = {
    provider: "physicians, nurse practitioners, and physician assistants using the EMR system",
    admin: "front desk staff, office managers, and billing coordinators",
    staff: "medical assistants, nurses, and clinical staff",
    patient: "patients accessing their health portal and self-service features",
  };
  const audienceDesc = audienceDescriptions[targetAudience] || audienceDescriptions.provider;

  const structureSystemPrompt = `You are a healthcare EMR documentation expert. Create structured tutorial plans for CareMetric AI — a modern healthcare practice management and EMR platform.

Target audience: ${audienceDesc}

Scene guidelines:
- Write narration in a warm, clear, professional tone
- Each step scene should cover exactly ONE action
- Narration per scene: 30-60 words (15-25 seconds spoken at natural pace)
- shortNarration: 1 sentence under 15 words
- captionText: a subtitle line shown during the scene
- visualHint: describes what should be shown on screen
- Include an intro scene as order=1 and an outro scene as the final scene

CRITICAL: Respond ONLY with a single valid JSON object. No markdown fences, no prose, no trailing text. Every string value must have all double-quotes escaped as \\", all backslashes as \\\\, and all newlines as \\n.

JSON schema (strictly follow this):
{"title":"string","description":"string","scenes":[{"order":1,"title":"string","type":"intro","summary":"string","narration":"string","shortNarration":"string","captionText":"string","estimatedDurationSeconds":20,"visualHint":"string"}]}`;

  const structureUserMessage = `Create a tutorial structure for:
Topic: ${prompt}
${targetUrl ? `Target page: ${targetUrl}` : ""}
Audience: ${audienceDesc}

Generate 5-12 scenes. Scene 1 = intro (what the user will learn). Final scene = outro (recap). Middle scenes = individual steps. Return ONLY the JSON object, nothing else.`;

  const structureResponse = await callAIWithRetry(
    aiConfig,
    {
      systemPrompt: structureSystemPrompt,
      messages: [{ role: "user", content: structureUserMessage }],
      maxTokens: 6000,
      temperature: 0.2,
    },
    120000,
  );

  let structureData: { title: string; description: string; scenes: ScenePlan[] };
  try {
    structureData = safeParseJSON(structureResponse.text) as typeof structureData;
  } catch (e) {
    console.error("AI raw response that failed to parse:", structureResponse.text.slice(0, 500));
    throw new Error(`AI structure JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!structureData.title || !Array.isArray(structureData.scenes) || structureData.scenes.length === 0) {
    throw new Error("AI response missing required fields (title or scenes)");
  }

  structureData.scenes = structureData.scenes.map((s, i) => ({
    ...s,
    order: i + 1,
    type: s.type || (i === 0 ? "intro" : i === structureData.scenes.length - 1 ? "outro" : "step"),
    visualHint: s.visualHint || "",
    estimatedDurationSeconds: Math.max(10, Math.min(45, s.estimatedDurationSeconds || 20)),
  }));

  const markdownSystemPrompt = `You are a technical writer creating help documentation for CareMetric AI, a healthcare EMR platform. Write clear, professional markdown articles.

Guidelines:
- Use numbered steps with clear action verbs (Click, Select, Enter, Navigate)
- Use ## for section headings
- Include > blockquote tips and warnings where helpful
- Add a ## Prerequisites section if relevant
- Add a ## Troubleshooting section at the end
- Do NOT use HTML tags
- Do NOT wrap in code fences
- Return ONLY the markdown text, starting directly with the title (# heading)`;

  const markdownUserMessage = `Write a comprehensive help article for: ${structureData.title}

Description: ${structureData.description}

Steps covered:
${structureData.scenes.filter((s) => s.type === "step").map((s, i) => `${i + 1}. ${s.title}: ${s.summary}`).join("\n")}

Write a complete, well-organized markdown help article ready to publish. Target audience: ${audienceDesc}.`;

  const markdownResponse = await callAIWithRetry(
    aiConfig,
    {
      systemPrompt: markdownSystemPrompt,
      messages: [{ role: "user", content: markdownUserMessage }],
      maxTokens: 3000,
      temperature: 0.3,
    },
    60000,
  );

  const markdownGuide = markdownResponse.text.trim();

  return {
    title: structureData.title,
    description: structureData.description,
    scenes: structureData.scenes,
    markdownGuide,
  };
}

async function runGeneration(body: GenerateRequest, userId: string | null): Promise<void> {
  const supabase = makeSupabaseClient();
  const { jobId, organizationId } = body;

  const GENERATION_TIMEOUT_MS = 240_000;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error("Generation timed out after 4 minutes. Please try again."));
    }, GENERATION_TIMEOUT_MS);
  });

  try {
    await Promise.race([doGeneration(supabase, body, userId), timeoutPromise]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("runGeneration error:", message);
    try {
      const fallbackSupabase = makeSupabaseClient();
      await fallbackSupabase
        .from("doc_studio_simple_jobs")
        .update({
          status: "failed",
          error_message: `Unexpected error: ${message}`,
          progress_percent: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("organization_id", organizationId);
    } catch (_) {
      // best effort
    }
  } finally {
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
  }
}

async function doGeneration(
  supabase: ReturnType<typeof createClient>,
  body: GenerateRequest,
  userId: string | null,
): Promise<void> {
  const { jobId, organizationId, prompt, targetUrl, targetAudience, outputTypes } = body;

  await updateJob(supabase, jobId, organizationId, {
    status: "planning",
    current_step_label: "AI is analyzing your request and planning the tutorial structure...",
    progress_percent: 10,
  });

  const aiConfig = await resolveAIConfigForTask(supabase, "tutorial_generation");
  if (!aiConfig) {
    await updateJob(supabase, jobId, organizationId, {
      status: "failed",
      error_message: "No AI API key configured. Please add an AI API key in the platform settings.",
      progress_percent: 0,
    });
    return;
  }

  await updateJob(supabase, jobId, organizationId, {
    status: "planning",
    current_step_label: "AI is building scene structure and narration...",
    progress_percent: 20,
  });

  let plan: AIPlan;
  try {
    plan = await buildPlan(aiConfig, prompt, targetUrl ?? "", targetAudience ?? "provider");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateJob(supabase, jobId, organizationId, {
      status: "failed",
      error_message: `AI planning failed: ${msg}`,
      progress_percent: 0,
    });
    return;
  }

  await updateJob(supabase, jobId, organizationId, {
    status: "writing",
    current_step_label: "Writing content and building scenes...",
    progress_percent: 45,
    ai_plan: plan,
  });

  const primaryOutputType = outputTypes?.includes("narrated_video")
    ? "narrated_video"
    : outputTypes?.includes("video_tutorial")
    ? "video_tutorial"
    : "screenshot_guide";

  const { data: playwrightSettingsRow } = await supabase
    .from("documentation_settings")
    .select("value_json")
    .eq("organization_id", organizationId)
    .eq("key", "playwright_config")
    .maybeSingle();
  const playwrightSettings = (playwrightSettingsRow?.value_json ?? {}) as Record<string, unknown>;
  const playwrightRunnerUrl = (playwrightSettings.playwright_runner_url as string) ?? "";
  const resolvedProviderMode = playwrightRunnerUrl.trim().length > 0 ? "playwright" : "mock";

  const fullNarrationScript = plan.scenes.map((s) => s.narration).join("\n\n");

  const stepScenes = plan.scenes.filter((s) => s.type === "step");
  const hasTitle = plan.title.trim().length > 3;
  const hasDescription = (plan.description ?? "").trim().length > 10;
  const hasSteps = stepScenes.length >= 3;
  const hasGuide = plan.markdownGuide.trim().length >= 200;
  const hasTranscript = fullNarrationScript.trim().length > 0;
  let totalChecks = 5;
  const passedChecks = [hasTitle, hasDescription, hasSteps, hasGuide, hasTranscript].filter(Boolean).length;
  if (primaryOutputType === "video_tutorial" || primaryOutputType === "narrated_video") {
    totalChecks++;
  }
  if (primaryOutputType === "narrated_video") {
    totalChecks++;
  }
  const initialScore = Math.round((passedChecks / totalChecks) * 100);

  const { data: draft, error: draftErr } = await supabase
    .from("doc_studio_drafts")
    .insert({
      organization_id: organizationId,
      created_by: userId,
      title: plan.title,
      description: plan.description,
      target_url: targetUrl ?? "",
      output_type: primaryOutputType,
      provider_mode: resolvedProviderMode,
      status: "draft",
      target_role: targetAudience ?? "provider",
      generated_content: {
        guide_md: plan.markdownGuide,
        transcript: fullNarrationScript,
        narration_script: fullNarrationScript,
      },
      edited_content: {
        guide_md: plan.markdownGuide,
        transcript: fullNarrationScript,
        narration_script: fullNarrationScript,
      },
      completeness_score: initialScore,
      steps: plan.scenes
        .filter((s) => s.type === "step")
        .map((s, i) => ({
          index: i,
          title: s.title,
          description: s.summary,
          action: s.visualHint,
        })),
    })
    .select("id")
    .single();

  if (draftErr || !draft) {
    await updateJob(supabase, jobId, organizationId, {
      status: "failed",
      error_message: `Failed to create draft: ${draftErr?.message ?? "unknown error"}`,
      progress_percent: 0,
    });
    return;
  }

  const draftId = draft.id;

  await updateJob(supabase, jobId, organizationId, {
    draft_id: draftId,
    status: "narrating",
    current_step_label: "Creating scenes and narration segments...",
    progress_percent: 70,
  });

  let cumulativeTime = 0;
  const sceneInserts = plan.scenes.map((scene) => {
    const startTime = cumulativeTime;
    cumulativeTime += scene.estimatedDurationSeconds;
    return {
      draft_id: draftId,
      scene_order: scene.order,
      title: scene.title,
      summary: scene.summary,
      narration_text: scene.narration ?? "",
      start_time_seconds: startTime,
      end_time_seconds: cumulativeTime,
      quality_status: "good",
    };
  });

  const { data: insertedScenes, error: scenesErr } = await supabase
    .from("doc_studio_scenes")
    .insert(sceneInserts)
    .select("id, scene_order");

  if (scenesErr) {
    console.error("Scenes insert error:", scenesErr.message);
  }

  if (insertedScenes && insertedScenes.length > 0) {
    const narrationInserts = insertedScenes.map((scene) => {
      const planScene = plan.scenes.find((s) => s.order === scene.scene_order);
      return {
        draft_id: draftId,
        scene_id: scene.id,
        segment_order: scene.scene_order,
        narration_text: planScene?.narration ?? "",
        short_narration_text: planScene?.shortNarration ?? "",
        style: "instructional",
        target_duration_seconds: planScene?.estimatedDurationSeconds ?? 20,
        caption_text: planScene?.captionText ?? "",
        status: "draft",
      };
    });

    const { error: narrationErr } = await supabase.from("documentation_narration_segments").insert(narrationInserts);
    if (narrationErr) console.error("Failed to insert narration segments:", narrationErr.message);
  }

  await updateJob(supabase, jobId, organizationId, {
    status: "rendering",
    current_step_label: "Building render manifest and finalizing...",
    progress_percent: 88,
  });

  const totalDuration = plan.scenes.reduce(
    (acc, s) => acc + (s.estimatedDurationSeconds ?? 20),
    0,
  );

  const renderManifest = {
    version: 2,
    draftId,
    title: plan.title,
    description: plan.description,
    totalDurationSeconds: totalDuration,
    fps: 30,
    width: 1920,
    height: 1080,
    scenes: plan.scenes.map((s) => ({
      order: s.order,
      title: s.title,
      type: s.type,
      durationSeconds: s.estimatedDurationSeconds ?? 20,
      narration: s.narration,
      shortNarration: s.shortNarration,
      captionText: s.captionText,
      visualHint: s.visualHint,
    })),
    narrationScript: fullNarrationScript,
    generatedAt: new Date().toISOString(),
    outputTypes,
  };

  const { error: renderInsertErr } = await supabase.from("doc_studio_render_projects").insert({
    draft_id: draftId,
    organization_id: organizationId,
    render_mode: "standard_training",
    render_status: "pending",
    total_duration_ms: totalDuration * 1000,
    scene_count: plan.scenes.length,
    render_manifest_json: renderManifest,
  });
  if (renderInsertErr) console.error("Failed to insert render project:", renderInsertErr.message);

  await updateJob(supabase, jobId, organizationId, {
    status: "done",
    current_step_label: "Your tutorial is ready!",
    progress_percent: 100,
    draft_id: draftId,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  if (req.method === "GET") {
    return jsonResponse({ status: "ok", function: "doc-studio-ai-generate-all", ts: new Date().toISOString() });
  }

  try {
    const authClient = createServiceClient();
    const auth = await requireSuperAdminOrTrustedToken(req, authClient);
    if (auth.error) return auth.error;

    const body: GenerateRequest = await req.json();
    const { jobId, organizationId, prompt, targetUrl } = body;

    if (!jobId || !organizationId || !prompt) {
      return jsonResponse({ error: "Missing required fields: jobId, organizationId, prompt" }, 400);
    }

    const { data: existingJob } = await authClient
      .from("doc_studio_simple_jobs")
      .select("id")
      .eq("id", jobId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!existingJob) {
      return jsonResponse({ error: "Job not found for this organization" }, 404);
    }

    if (targetUrl && targetUrl.trim().length > 0) {
      try {
        const parsed = new URL(targetUrl);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          return jsonResponse({ error: "targetUrl must use http or https" }, 400);
        }
      } catch {
        return jsonResponse({ error: "targetUrl is not a valid URL" }, 400);
      }
    }

    const targetAudience = typeof body.targetAudience === "string" ? body.targetAudience : "provider";
    const outputTypes = Array.isArray(body.outputTypes)
      ? body.outputTypes.filter((v: unknown): v is string => typeof v === "string")
      : [];

    const generateRequest: GenerateRequest = {
      jobId,
      organizationId,
      prompt,
      targetUrl,
      targetAudience,
      outputTypes,
    };

    const generationPromise = runGeneration(generateRequest, auth.user.id).catch((err) => {
      console.error("Background generation failed:", err instanceof Error ? err.message : String(err));
    });

    EdgeRuntime.waitUntil(generationPromise);

    return jsonResponse({ success: true, jobId, status: "queued" });
  } catch (err) {
    console.error("doc-studio-ai-generate-all handler error:", err instanceof Error ? err.message : String(err));
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
