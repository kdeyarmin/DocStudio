import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createServiceClient,
  requireSuperAdmin,
  requireDocStudioAuthContext,
  requireInternalOrDraftAccess,
  requireInternalOrSceneAccess,
} from "../_shared/auth.ts";
import { jsonResponse, corsPreflightResponse } from "../_shared/http.ts";


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

    const requireDraftContext = async (draftId?: string | null) => {
      const auth = await requireDocStudioAuthContext(req, supabase, { draftId });
      if ("error" in auth) return auth;
      return auth;
    };

    if (action === "list") {
      const { draft_id } = body;
      if (!draft_id) return errorResponse("draft_id required", 400);
      const authz = await requireInternalOrDraftAccess(req, supabase, draft_id);
      if (!authz.ok) return authz.error;

      const { data, error } = await supabase
        .from("doc_studio_scenes")
        .select("*, documentation_scene_steps(*), documentation_narration_segments(*)")
        .eq("draft_id", draft_id)
        .order("scene_order", { ascending: true });

      if (error) throw error;
      return successResponse({ scenes: data });
    }

    if (action === "get") {
      const { scene_id } = body;
      if (!scene_id) return errorResponse("scene_id required", 400);
      const authz = await requireInternalOrSceneAccess(req, supabase, scene_id);
      if (!authz.ok) return authz.error;

      const { data: sceneLookup, error: sceneLookupErr } = await supabase
        .from("doc_studio_scenes")
        .select("draft_id")
        .eq("id", scene_id)
        .maybeSingle();
      if (sceneLookupErr) throw sceneLookupErr;
      if (!sceneLookup?.draft_id) return errorResponse("Scene not found", 404);

      const auth = await requireDraftContext(sceneLookup.draft_id);
      if ("error" in auth) return auth.error;

      const { data, error } = await supabase
        .from("doc_studio_scenes")
        .select("*, documentation_scene_steps(*), documentation_narration_segments(*)")
        .eq("id", scene_id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return errorResponse("Scene not found", 404);
      return successResponse({ scene: data });
    }

    if (action === "create") {
      const { draft_id, job_id, workflow_id, scene_order, title, summary,
              start_time_seconds, end_time_seconds, quality_status,
              notes, visual_emphasis_json, metadata_json } = body;

      if (!draft_id || title === undefined) return errorResponse("draft_id and title required", 400);
      const authz = await requireInternalOrDraftAccess(req, supabase, draft_id);
      if (!authz.ok) return authz.error;

      const { data, error } = await supabase
        .from("doc_studio_scenes")
        .insert({
          draft_id,
          job_id: job_id ?? null,
          workflow_id: workflow_id ?? null,
          scene_order: scene_order ?? 0,
          title: title ?? "",
          summary: summary ?? null,
          start_time_seconds: start_time_seconds ?? 0,
          end_time_seconds: end_time_seconds ?? 0,
          quality_status: quality_status ?? "pending",
          notes: notes ?? null,
          visual_emphasis_json: visual_emphasis_json ?? {},
          metadata_json: metadata_json ?? {},
        })
        .select()
        .single();

      if (error) throw error;
      return successResponse({ scene: data });
    }

    if (action === "update") {
      const { scene_id, ...updates } = body;
      if (!scene_id) return errorResponse("scene_id required", 400);
      const authz = await requireInternalOrSceneAccess(req, supabase, scene_id);
      if (!authz.ok) return authz.error;

      const { data: sceneLookup, error: sceneLookupErr } = await supabase
        .from("doc_studio_scenes")
        .select("draft_id")
        .eq("id", scene_id)
        .maybeSingle();
      if (sceneLookupErr) throw sceneLookupErr;
      if (!sceneLookup?.draft_id) return errorResponse("Scene not found", 404);

      const auth = await requireDraftContext(sceneLookup.draft_id);
      if ("error" in auth) return auth.error;

      const allowed = [
        "scene_order", "title", "summary", "start_time_seconds",
        "end_time_seconds", "quality_status", "notes",
        "visual_emphasis_json", "metadata_json",
      ];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) {
        if (updates[k] !== undefined) patch[k] = updates[k];
      }

      const { data, error } = await supabase
        .from("doc_studio_scenes")
        .update(patch)
        .eq("id", scene_id)
        .select()
        .single();

      if (error) throw error;
      return successResponse({ scene: data });
    }

    if (action === "delete") {
      const { scene_id } = body;
      if (!scene_id) return errorResponse("scene_id required", 400);
      const authz = await requireInternalOrSceneAccess(req, supabase, scene_id);
      if (!authz.ok) return authz.error;

      const { data: sceneLookup, error: sceneLookupErr } = await supabase
        .from("doc_studio_scenes")
        .select("draft_id")
        .eq("id", scene_id)
        .maybeSingle();
      if (sceneLookupErr) throw sceneLookupErr;
      if (!sceneLookup?.draft_id) return errorResponse("Scene not found", 404);

      const auth = await requireDraftContext(sceneLookup.draft_id);
      if ("error" in auth) return auth.error;

      const { error } = await supabase
        .from("doc_studio_scenes")
        .delete()
        .eq("id", scene_id);

      if (error) throw error;
      return successResponse({ deleted: true });
    }

    if (action === "bulk_create") {
      const { scenes, draft_id } = body;
      if (!Array.isArray(scenes) || !scenes.length) return errorResponse("scenes array required", 400);
      const draftId = typeof scenes[0]?.draft_id === "string" ? scenes[0].draft_id : null;
      if (!draftId) return errorResponse("draft_id required for bulk_create", 400);
      const authz = await requireInternalOrDraftAccess(req, supabase, draftId);
      if (!authz.ok) return authz.error;

      const allowedFields = [
        "draft_id", "job_id", "workflow_id", "scene_order", "title", "summary",
        "start_time_seconds", "end_time_seconds", "quality_status", "notes",
        "visual_emphasis_json", "metadata_json",
      ];
      const sanitized = scenes.map((s: Record<string, unknown>) => {
        const row: Record<string, unknown> = { draft_id };
        for (const f of allowedFields) {
          if (s[f] !== undefined) row[f] = s[f];
        }
        row.draft_id = draft_id;
        return row;
      });

      const { data, error } = await supabase
        .from("doc_studio_scenes")
        .insert(sanitized)
        .select();

      if (error) throw error;
      return successResponse({ scenes: data, count: data?.length ?? 0 });
    }

    if (action === "reorder") {
      const { scene_orders, draft_id } = body;
      if (!Array.isArray(scene_orders)) return errorResponse("scene_orders array required", 400);
      if (!draft_id) return errorResponse("draft_id required", 400);
      const authz = await requireInternalOrDraftAccess(req, supabase, draft_id);
      if (!authz.ok) return authz.error;

      const updates = scene_orders.map(({ id, scene_order }: { id: string; scene_order: number }) =>
        supabase.from("doc_studio_scenes").update({ scene_order }).eq("id", id).eq("draft_id", draft_id)
      );
      await Promise.all(updates);
      return successResponse({ reordered: scene_orders.length });
    }

    if (action === "link_step") {
      const { scene_id, workflow_step_id, step_order, step_result_json, draft_id } = body;
      if (!scene_id) return errorResponse("scene_id required", 400);
      const authz = await requireInternalOrSceneAccess(req, supabase, scene_id);
      if (!authz.ok) return authz.error;

      const resolvedDraftId = draft_id
        ?? (await supabase.from("doc_studio_scenes").select("draft_id").eq("id", scene_id).maybeSingle()).data?.draft_id;
      if (!resolvedDraftId) return errorResponse("Scene not found", 404);

      const auth = await requireDraftContext(resolvedDraftId);
      if ("error" in auth) return auth.error;

      const { data, error } = await supabase
        .from("documentation_scene_steps")
        .upsert({
          scene_id,
          workflow_step_id: workflow_step_id ?? null,
          step_order: step_order ?? 0,
          step_result_json: step_result_json ?? {},
        }, { onConflict: "scene_id,step_order" })
        .select()
        .single();

      if (error) throw error;
      return successResponse({ scene_step: data });
    }

    return errorResponse(`Unknown action: ${action}`, 400);
  } catch (err: unknown) {
    console.error('[doc-studio-scenes] Unhandled error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  }
});

function successResponse(data: Record<string, unknown>) {
  return jsonResponse({ success: true, ...data });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}
