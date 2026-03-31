import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient, requireSuperAdmin } from "../_shared/auth.ts";
import { jsonResponse, corsPreflightResponse } from "../_shared/http.ts";
import { callAI, resolveAIConfigForTask } from "../_shared/ai-provider.ts";

const DEFAULT_CONFIG = {
  default_pacing_mode: "narration_synced",
  default_transition_duration: 0.5,
  auto_generate_on_capture: false,
  min_shot_duration_seconds: 1.5,
  max_shots_per_scene: 8,
  key_shot_strategy: "first_checkpoint",
};

type ShotType = "full_screen" | "focused_crop" | "zoom_highlight" | "intro_cover" | "outro_summary" | "confirmation_focus" | "error_focus" | "split_screen" | "overlay_callout" | "pan_sequence";
type ShotPurpose = "explain_navigation" | "explain_data_entry" | "explain_result" | "explain_confirmation" | "explain_error_recovery" | "explain_warning" | "explain_best_practice" | "explain_context" | "transition_context";
type ShotEmphasisLevel = "low" | "normal" | "high" | "critical";
type ShotTransition = "cut" | "crossfade" | "fade_to_black" | "fade_from_black" | "slide_left" | "slide_right" | "wipe" | "zoom_in" | "zoom_out" | "none";
type ShotPacingMode = "fixed" | "narration_synced" | "action_synced" | "manual";

interface SceneRow {
  id: string;
  draft_id: string;
  scene_order: number;
  title: string;
  summary: string | null;
  start_time_seconds: number;
  end_time_seconds: number;
  quality_status: string | null;
  notes: string | null;
  workflow_id?: string | null;
}

interface StepRow {
  id: string;
  workflow_id: string;
  step_order: number;
  title: string;
  description: string | null;
  action_type: string | null;
  target_selector: string | null;
  screenshot_checkpoint: boolean;
  screenshot_caption_template: string | null;
  is_optional: boolean;
}

function classifyShotType(sceneIndex: number, totalScenes: number, step: StepRow | null): ShotType {
  if (sceneIndex === 0) return "intro_cover";
  if (sceneIndex === totalScenes - 1) return "outro_summary";
  if (!step) return "full_screen";

  const action = (step.action_type ?? "").toLowerCase();
  const title = (step.title ?? "").toLowerCase();
  const desc = (step.description ?? "").toLowerCase();

  if (action === "assert_text" || title.includes("verif") || title.includes("confirm")) return "confirmation_focus";
  if (action === "screenshot" || title.includes("screenshot") || title.includes("review")) return "zoom_highlight";
  if (title.includes("error") || desc.includes("error") || title.includes("fail")) return "error_focus";
  if (action === "scroll") return "full_screen";
  if (step.screenshot_checkpoint) return "focused_crop";
  return "full_screen";
}

function classifyPurpose(step: StepRow | null): ShotPurpose {
  if (!step) return "explain_navigation";
  const action = (step.action_type ?? "").toLowerCase();
  const title = (step.title ?? "").toLowerCase();
  if (action === "type" || action === "fill") return "explain_data_entry";
  if (action === "assert_text" || title.includes("verif") || title.includes("confirm")) return "explain_confirmation";
  if (title.includes("error") || title.includes("fail")) return "explain_error_recovery";
  if (action === "wait") return "explain_result";
  if (title.includes("warning") || title.includes("caution")) return "explain_warning";
  if (title.includes("best practice") || title.includes("tip")) return "explain_best_practice";
  return "explain_navigation";
}

function classifyEmphasis(step: StepRow | null, shotType: ShotType): ShotEmphasisLevel {
  if (shotType === "intro_cover" || shotType === "outro_summary") return "normal";
  if (shotType === "error_focus") return "critical";
  if (shotType === "confirmation_focus") return "high";
  const action = (step?.action_type ?? "").toLowerCase();
  if (action === "type" || action === "fill") return "high";
  if (step?.screenshot_checkpoint) return "normal";
  return "low";
}

function classifyTransitionIn(sceneIndex: number, shotType: ShotType): ShotTransition {
  if (sceneIndex === 0) return "fade_from_black";
  if (shotType === "zoom_highlight") return "crossfade";
  return "cut";
}

function classifyTransitionOut(sceneIndex: number, totalScenes: number, shotType: ShotType): ShotTransition {
  if (sceneIndex === totalScenes - 1) return "fade_to_black";
  if (shotType === "confirmation_focus") return "crossfade";
  return "cut";
}

function classifyPacing(shotType: ShotType): ShotPacingMode {
  if (shotType === "intro_cover" || shotType === "outro_summary") return "fixed";
  return "narration_synced";
}

function buildShotPayloads(
  scene: SceneRow,
  steps: StepRow[],
  sceneIndex: number,
  totalScenes: number,
  config: typeof DEFAULT_CONFIG,
): Record<string, unknown>[] {
  const plans: Record<string, unknown>[] = [];
  const sceneDuration = scene.end_time_seconds - scene.start_time_seconds;
  const stepsWithCheckpoint = steps.filter((s) => s.screenshot_checkpoint);

  if (stepsWithCheckpoint.length === 0) {
    const shotType = classifyShotType(sceneIndex, totalScenes, null);
    plans.push({
      draft_id: scene.draft_id,
      scene_id: scene.id,
      shot_order: 0,
      title: scene.title,
      shot_type: shotType,
      purpose: classifyPurpose(null),
      source_type: "screenshot",
      start_time_seconds: scene.start_time_seconds,
      end_time_seconds: scene.end_time_seconds,
      camera_mode: "static",
      crop_mode: shotType === "focused_crop" ? "auto_subject" : "none",
      emphasis_level: classifyEmphasis(null, shotType),
      pacing_mode: classifyPacing(shotType),
      transition_in: classifyTransitionIn(sceneIndex, shotType),
      transition_out: classifyTransitionOut(sceneIndex, totalScenes, shotType),
      transition_duration: config.default_transition_duration,
      is_key_shot: sceneIndex === 0 || sceneIndex === totalScenes - 1,
      notes: scene.notes ?? null,
      callout_style: "standard",
      pointer_style: "none",
      overlay_position: "bottom_right",
      metadata_json: {},
    });
    return plans;
  }

  const perShotDuration = sceneDuration / Math.max(stepsWithCheckpoint.length, 1);
  stepsWithCheckpoint.forEach((step, i) => {
    const shotStartTime = scene.start_time_seconds + i * perShotDuration;
    const shotEndTime = Math.min(shotStartTime + perShotDuration, scene.end_time_seconds);
    const shotType = classifyShotType(sceneIndex, totalScenes, step);

    plans.push({
      draft_id: scene.draft_id,
      scene_id: scene.id,
      shot_order: i,
      title: step.screenshot_caption_template || step.title,
      shot_type: shotType,
      purpose: classifyPurpose(step),
      source_type: "screenshot",
      start_time_seconds: shotStartTime,
      end_time_seconds: shotEndTime,
      camera_mode: "static",
      crop_mode: shotType === "focused_crop" ? "auto_subject" : "none",
      callout_title: step.screenshot_caption_template ?? null,
      callout_description: step.description ?? null,
      callout_style: shotType === "error_focus" ? "error" : "standard",
      emphasis_level: classifyEmphasis(step, shotType),
      pacing_mode: classifyPacing(shotType),
      transition_in: i === 0 ? classifyTransitionIn(sceneIndex, shotType) : "cut",
      transition_out: i === stepsWithCheckpoint.length - 1 ? classifyTransitionOut(sceneIndex, totalScenes, shotType) : "cut",
      transition_duration: config.default_transition_duration,
      is_key_shot: step.screenshot_checkpoint && i === 0,
      notes: null,
      pointer_style: "none",
      overlay_position: "bottom_right",
      metadata_json: {},
    });
  });

  return plans;
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
    const { action } = body;

    if (action === "generate" || action === "regenerate_draft") {
      const { draft_id, replace_existing = false, config: userConfig } = body;
      if (!draft_id) return errorResponse("draft_id required", 400);

      const config = { ...DEFAULT_CONFIG, ...(userConfig ?? {}) };
      const warnings: string[] = [];

      const { data: scenes, error: scenesError } = await supabase
        .from("doc_studio_scenes")
        .select("*")
        .eq("draft_id", draft_id)
        .order("scene_order", { ascending: true });

      if (scenesError) throw scenesError;
      if (!scenes || scenes.length === 0) {
        return successResponse({
          success: false,
          created: 0,
          skipped: 0,
          warnings: ["No scenes found — run Playwright capture first"],
        });
      }

      const workflowIds = [...new Set(
        scenes
          .map((s: SceneRow) => (s as SceneRow & { workflow_id?: string | null }).workflow_id)
          .filter(Boolean) as string[],
      )];

      const stepsMap = new Map<string, StepRow[]>();

      if (workflowIds.length > 0) {
        const { data: steps } = await supabase
          .from("documentation_workflow_steps")
          .select("*")
          .in("workflow_id", workflowIds)
          .order("step_order", { ascending: true });

        if (steps) {
          for (const step of steps as (StepRow & { workflow_id: string })[]) {
            if (!stepsMap.has(step.workflow_id)) stepsMap.set(step.workflow_id, []);
            stepsMap.get(step.workflow_id)!.push(step);
          }
        }
      }

      if (replace_existing) {
        const { error: delErr } = await supabase.from("doc_studio_shot_plans").delete().eq("draft_id", draft_id);
        if (delErr) console.error("[doc-studio-shot-plans] Failed to delete existing plans:", delErr.message);
      } else {
        const { count } = await supabase
          .from("doc_studio_shot_plans")
          .select("id", { count: "exact", head: true })
          .eq("draft_id", draft_id);
        if ((count ?? 0) > 0) {
          return successResponse({
            success: true,
            created: 0,
            skipped: scenes.length,
            warnings: [`Shot plans already exist (${count} plans). Pass replace_existing=true to regenerate.`],
          });
        }
      }

      const allPayloads: Record<string, unknown>[] = [];
      scenes.forEach((scene: SceneRow & { workflow_id?: string | null }, i: number) => {
        const steps = scene.workflow_id ? (stepsMap.get(scene.workflow_id) ?? []) : [];
        if (!steps.length) {
          warnings.push(`Scene "${scene.title}" has no workflow steps — generating single full-screen shot`);
        }
        const scenePlans = buildShotPayloads(scene as SceneRow, steps, i, scenes.length, config);
        allPayloads.push(...scenePlans);
      });

      if (!allPayloads.length) {
        return successResponse({ success: false, created: 0, skipped: scenes.length, warnings: ["No shot plans could be generated"] });
      }

      const { data: created, error: insertError } = await supabase
        .from("doc_studio_shot_plans")
        .insert(allPayloads)
        .select();
      if (insertError) throw insertError;

      return successResponse({ success: true, created: created?.length ?? 0, skipped: 0, warnings });
    }

    if (action === "regenerate_scene") {
      const { draft_id, scene_id, config: userConfig } = body;
      if (!draft_id || !scene_id) return errorResponse("draft_id and scene_id required", 400);

      const config = { ...DEFAULT_CONFIG, ...(userConfig ?? {}) };

      const { data: scene, error: sceneError } = await supabase
        .from("doc_studio_scenes")
        .select("*")
        .eq("id", scene_id)
        .maybeSingle();
      if (sceneError) throw sceneError;
      if (!scene) return errorResponse("Scene not found", 404);

      const { data: allScenes } = await supabase
        .from("doc_studio_scenes")
        .select("id, scene_order")
        .eq("draft_id", draft_id)
        .order("scene_order", { ascending: true });

      const totalScenes = allScenes?.length ?? 1;
      const sceneIndex = allScenes?.findIndex((s: { id: string }) => s.id === scene_id) ?? 0;

      let steps: StepRow[] = [];
      const sceneWithWf = scene as SceneRow & { workflow_id?: string | null };
      if (sceneWithWf.workflow_id) {
        const { data: wSteps } = await supabase
          .from("documentation_workflow_steps")
          .select("*")
          .eq("workflow_id", sceneWithWf.workflow_id)
          .order("step_order", { ascending: true });
        steps = (wSteps ?? []) as StepRow[];
      }

      const { error: sceneDelErr } = await supabase.from("doc_studio_shot_plans").delete().eq("draft_id", draft_id).eq("scene_id", scene_id);
      if (sceneDelErr) console.error("[doc-studio-shot-plans] Failed to delete scene plans:", sceneDelErr.message);

      const payloads = buildShotPayloads(scene as SceneRow, steps, sceneIndex, totalScenes, config);

      const { data: created, error: insertError } = await supabase
        .from("doc_studio_shot_plans")
        .insert(payloads)
        .select();
      if (insertError) throw insertError;

      return successResponse({ success: true, created: created?.length ?? 0, skipped: 0, warnings: [] });
    }

    if (action === "delete_all") {
      const { draft_id } = body;
      if (!draft_id) return errorResponse("draft_id required", 400);

      const { data: deleted, error } = await supabase
        .from("doc_studio_shot_plans")
        .delete()
        .eq("draft_id", draft_id)
        .select("id");
      if (error) throw error;

      return successResponse({ deleted: deleted?.length ?? 0 });
    }

    if (action === "create") {
      const { draft_id, scene_id, shot_order, title, shot_type, purpose, source_type,
              source_asset_id, start_time_seconds, end_time_seconds, camera_mode, crop_mode,
              zoom_region_json, highlight_region_json, callout_title, callout_description,
              callout_style, callout_start_time, callout_end_time, pointer_style,
              pointer_path_json, overlay_asset_id, overlay_position, overlay_start_time,
              overlay_end_time, emphasis_level, pacing_mode, transition_in, transition_out,
              transition_duration, is_key_shot, notes, metadata_json } = body;

      if (!draft_id || !title) return errorResponse("draft_id and title required", 400);

      const { data, error } = await supabase
        .from("doc_studio_shot_plans")
        .insert({
          draft_id,
          scene_id: scene_id ?? null,
          shot_order: shot_order ?? 0,
          title,
          shot_type: shot_type ?? "full_screen",
          purpose: purpose ?? "explain_navigation",
          source_type: source_type ?? "screenshot",
          source_asset_id: source_asset_id ?? null,
          start_time_seconds: start_time_seconds ?? 0,
          end_time_seconds: end_time_seconds ?? 5,
          camera_mode: camera_mode ?? "static",
          crop_mode: crop_mode ?? "none",
          zoom_region_json: zoom_region_json ?? null,
          highlight_region_json: highlight_region_json ?? null,
          callout_title: callout_title ?? null,
          callout_description: callout_description ?? null,
          callout_style: callout_style ?? "standard",
          callout_start_time: callout_start_time ?? null,
          callout_end_time: callout_end_time ?? null,
          pointer_style: pointer_style ?? "none",
          pointer_path_json: pointer_path_json ?? null,
          overlay_asset_id: overlay_asset_id ?? null,
          overlay_position: overlay_position ?? "bottom_right",
          overlay_start_time: overlay_start_time ?? null,
          overlay_end_time: overlay_end_time ?? null,
          emphasis_level: emphasis_level ?? "normal",
          pacing_mode: pacing_mode ?? "narration_synced",
          transition_in: transition_in ?? "cut",
          transition_out: transition_out ?? "cut",
          transition_duration: transition_duration ?? 0.5,
          is_key_shot: is_key_shot ?? false,
          notes: notes ?? null,
          metadata_json: metadata_json ?? {},
        })
        .select()
        .single();

      if (error) throw error;
      return successResponse({ shot_plan: data });
    }

    if (action === "list") {
      const { draft_id, scene_id } = body;
      if (!draft_id) return errorResponse("draft_id required", 400);

      let query = supabase
        .from("doc_studio_shot_plans")
        .select("*")
        .eq("draft_id", draft_id)
        .order("shot_order", { ascending: true });

      if (scene_id) query = query.eq("scene_id", scene_id);

      const { data, error } = await query;
      if (error) throw error;
      return successResponse({ shot_plans: data ?? [], count: data?.length ?? 0 });
    }

    if (action === "update") {
      const { shot_plan_id, ...updates } = body;
      if (!shot_plan_id) return errorResponse("shot_plan_id required", 400);

      const allowed = [
        "scene_id", "shot_order", "title", "shot_type", "purpose", "source_type",
        "source_asset_id", "start_time_seconds", "end_time_seconds", "camera_mode",
        "crop_mode", "zoom_region_json", "highlight_region_json", "callout_title",
        "callout_description", "callout_style", "callout_start_time", "callout_end_time",
        "pointer_style", "pointer_path_json", "overlay_asset_id", "overlay_position",
        "overlay_start_time", "overlay_end_time", "emphasis_level", "pacing_mode",
        "transition_in", "transition_out", "transition_duration", "is_key_shot", "notes",
        "metadata_json",
      ];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) {
        if (updates[k] !== undefined) patch[k] = updates[k];
      }

      const { data, error } = await supabase
        .from("doc_studio_shot_plans")
        .update(patch)
        .eq("id", shot_plan_id)
        .select()
        .single();
      if (error) throw error;
      return successResponse({ shot_plan: data });
    }

    if (action === "delete") {
      const { shot_plan_id } = body;
      if (!shot_plan_id) return errorResponse("shot_plan_id required", 400);

      const { error } = await supabase
        .from("doc_studio_shot_plans")
        .delete()
        .eq("id", shot_plan_id);
      if (error) throw error;
      return successResponse({ deleted: true });
    }

    if (action === "toggle_key_shot") {
      const { shot_plan_id, is_key_shot } = body;
      if (!shot_plan_id || is_key_shot === undefined) return errorResponse("shot_plan_id and is_key_shot required", 400);

      const { error } = await supabase
        .from("doc_studio_shot_plans")
        .update({ is_key_shot })
        .eq("id", shot_plan_id);
      if (error) throw error;
      return successResponse({ updated: true });
    }

    if (action === "reorder") {
      const { shot_orders } = body;
      if (!Array.isArray(shot_orders)) return errorResponse("shot_orders array required", 400);

      await Promise.all(
        shot_orders.map(({ id, shot_order }: { id: string; shot_order: number }) =>
          supabase.from("doc_studio_shot_plans").update({ shot_order }).eq("id", id)
        ),
      );
      return successResponse({ reordered: shot_orders.length });
    }

    if (action === "ai_enhance") {
      const { draft_id } = body;
      if (!draft_id) return errorResponse("draft_id required", 400);

      const aiConfig = await resolveAIConfigForTask(supabase, "shot_classification");
      if (!aiConfig) return errorResponse("No AI provider configured", 422);

      const { data: plans, error: plansErr } = await supabase
        .from("doc_studio_shot_plans")
        .select("id, title, shot_type, purpose, emphasis_level, notes, scene_id")
        .eq("draft_id", draft_id)
        .order("shot_order", { ascending: true });

      if (plansErr) throw plansErr;
      if (!plans || plans.length === 0) return errorResponse("No shot plans found — generate first", 404);

      const { data: scenes } = await supabase
        .from("doc_studio_scenes")
        .select("id, title, summary, narration_text")
        .eq("draft_id", draft_id);

      const sceneMap = new Map((scenes ?? []).map((s: Record<string, unknown>) => [s.id as string, s]));

      const planLines = plans.map((p: Record<string, unknown>, i: number) => {
        const scene = sceneMap.get(p.scene_id as string);
        return `Shot ${i + 1} (id=${p.id}): type=${p.shot_type}, purpose=${p.purpose}, emphasis=${p.emphasis_level}
  title: "${p.title}"
  scene: "${(scene as Record<string, unknown>)?.title ?? "unknown"}"
  narration: "${(scene as Record<string, unknown>)?.narration_text ?? ""}"`;
      }).join("\n\n");

      const prompt = `You are a video production assistant for a healthcare EMR training platform.
Review the following shot plans for a tutorial and suggest improvements to shot_type, purpose, and emphasis_level for each shot.

SHOT PLANS:
${planLines}

Respond ONLY with a JSON array where each element has:
{ "id": "<shot id>", "shot_type": "<type>", "purpose": "<purpose>", "emphasis_level": "<level>", "notes": "<brief reason>" }

Valid shot_type values: full_screen, focused_crop, zoom_highlight, intro_cover, outro_summary, confirmation_focus, error_focus, split_screen, overlay_callout, pan_sequence
Valid purpose values: explain_navigation, explain_data_entry, explain_result, explain_confirmation, explain_error_recovery, explain_warning, explain_best_practice, explain_context, transition_context
Valid emphasis_level values: low, normal, high, critical

Only include shots where you recommend a change. Return an empty array [] if no changes are needed.`;

      const response = await callAI(
        aiConfig,
        { messages: [{ role: "user", content: prompt }], temperature: 0.2, maxTokens: 2048 },
        30000,
      );

      const text = response.text.trim();
      const start = text.indexOf("[");
      const end = text.lastIndexOf("]");
      if (start === -1 || end === -1) return successResponse({ updated: 0, suggestions: [] });

      const suggestions: Array<{ id: string; shot_type: string; purpose: string; emphasis_level: string; notes: string }> =
        JSON.parse(text.slice(start, end + 1));

      let updated = 0;
      await Promise.all(
        suggestions.map(async (s) => {
          const { error } = await supabase
            .from("doc_studio_shot_plans")
            .update({ shot_type: s.shot_type, purpose: s.purpose, emphasis_level: s.emphasis_level, notes: s.notes })
            .eq("id", s.id);
          if (!error) updated++;
        }),
      );

      return successResponse({ updated, suggestions, provider: aiConfig.provider, model: aiConfig.model });
    }

    return errorResponse(`Unknown action: ${action}`, 400);
  } catch (err: unknown) {
    console.error('[doc-studio-shot-plans] Unhandled error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  }
});

function successResponse(data: Record<string, unknown>) {
  return jsonResponse({ success: true, ...data });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}
