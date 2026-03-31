import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createServiceClient,
  requireSuperAdmin,
  requireDocStudioAuthContext,
} from "../_shared/auth.ts";
import { corsPreflightResponse, jsonResponse } from "../_shared/http.ts";

function bodyOrganizationId(body: Record<string, unknown>): string | null {
  const snake = body.organization_id;
  if (typeof snake === "string" && snake.trim().length > 0) return snake.trim();
  const camel = body.organizationId;
  if (typeof camel === "string" && camel.trim().length > 0) return camel.trim();
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const supabase = createServiceClient();
    const superAdmin = await requireSuperAdmin(req, supabase);
    if (!superAdmin.ok) return superAdmin.error;

    const body = await req.json() as Record<string, unknown>;
    const { action } = body;
    const draftScopedActions = new Set(["list", "run_check", "mark_all_validated", "get_summary"]);
    const draft_id = typeof body.draft_id === "string" ? body.draft_id : null;

    const requireDraftContext = async (resolvedDraftId?: string | null) => {
      return requireDocStudioAuthContext(req, supabase, { draftId: resolvedDraftId });
    };

    if (action === "list") {
      if (!draft_id) return errorResponse("draft_id required", 400);
      const ctx = await requireDraftContext(draft_id);
      if ("error" in ctx) return ctx.error;

      const { data: draft } = await supabase
        .from("doc_studio_drafts")
        .select("id")
        .eq("id", draft_id)
        .eq("organization_id", ctx.organizationId)
        .maybeSingle();
      if (!draft) return errorResponse("Draft not found", 404);

      const { data, error } = await supabase
        .from("doc_studio_drift_checks")
        .select("*")
        .eq("draft_id", draft_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return successResponse({ drift_checks: data });
    }

    if (action === "run_check") {
      if (!draft_id) return errorResponse("draft_id required", 400);
      const ctx = await requireDraftContext(draft_id);
      if ("error" in ctx) return ctx.error;

      const { data: draft } = await supabase
        .from("doc_studio_drafts")
        .select("id")
        .eq("id", draft_id)
        .eq("organization_id", ctx.organizationId)
        .maybeSingle();
      if (!draft) return errorResponse("Draft not found", 404);

      const { data: assets, error: assetsError } = await supabase
        .from("doc_studio_assets")
        .select("*")
        .eq("draft_id", draft_id)
        .eq("organization_id", ctx.organizationId)
        .eq("is_drift_eligible", true)
        .eq("excluded_from_guide", false)
        .neq("screenshot_role", "failure");

      if (assetsError) throw assetsError;

      const settingsRes = await supabase
        .from("documentation_settings")
        .select("value_json")
        .eq("organization_id", ctx.organizationId)
        .eq("key", "drift_settings_config")
        .maybeSingle();

      const settings = {
        revalidation_interval_days: 90,
        comparison_sensitivity: "medium",
        ...(settingsRes.data?.value_json ?? {}),
      };

      const checks = (assets ?? []).map((asset: Record<string, unknown>) => {
        const baseline = asset.metadata_json as Record<string, unknown> ?? {};
        const daysSince = computeDaysSince(String(asset.created_at ?? ""));
        let severity = "none";
        let driftStatus = "current";
        const reasons: string[] = [];

        if (daysSince > settings.revalidation_interval_days) {
          severity = "low";
          driftStatus = "warning";
          reasons.push(`Captured ${daysSince} days ago (interval: ${settings.revalidation_interval_days} days).`);
        }
        if (baseline.url_changed) {
          severity = "high";
          driftStatus = "warning";
          reasons.push("Page URL has changed since capture.");
        }

        return {
          draft_id,
          asset_id: asset.id,
          drift_status: driftStatus,
          severity,
          reason: reasons.join(" ") || null,
          baseline_metadata_json: {
            asset_id: asset.id,
            file_name: asset.file_name,
            file_size: asset.file_size,
            width: asset.width,
            height: asset.height,
            checksum: asset.checksum,
            captured_at: asset.created_at,
          },
          comparison_metadata_json: {},
          checked_at: new Date().toISOString(),
          validated_by: null,
          validated_at: null,
        };
      });

      if (checks.length > 0) {
        await supabase.from("doc_studio_drift_checks").delete().eq("draft_id", draft_id);
        const { data: inserted, error: insertError } = await supabase
          .from("doc_studio_drift_checks")
          .insert(checks)
          .select();
        if (insertError) throw insertError;

        const outdated = checks.filter((c) => c.drift_status === "outdated").length;
        const warnings = checks.filter((c) => c.drift_status === "warning").length;
        const overallStatus = outdated > 0 ? "outdated" : warnings > 0 ? "warning" : "current";

        await supabase
          .from("doc_studio_drafts")
          .update({ drift_status: overallStatus, last_validated_at: new Date().toISOString() })
          .eq("id", draft_id);

        return successResponse({ drift_checks: inserted, overall_status: overallStatus, checked_count: checks.length });
      }

      return successResponse({ drift_checks: [], overall_status: "unknown", checked_count: 0 });
    }

    if (action === "mark_validated") {
      const { check_id } = body;
      if (!check_id) return errorResponse("check_id required", 400);
      const { data: lookup, error: lookupErr } = await supabase
        .from("doc_studio_drift_checks")
        .select("draft_id")
        .eq("id", check_id)
        .maybeSingle();
      if (lookupErr) throw lookupErr;
      if (!lookup?.draft_id) return errorResponse("Drift check not found", 404);

      const ctx = await requireDraftContext(lookup.draft_id);
      if ("error" in ctx) return ctx.error;

      const { data: check } = await supabase
        .from("doc_studio_drift_checks")
        .select("id, draft_id")
        .eq("id", check_id)
        .maybeSingle();
      if (!check) return errorResponse("Drift check not found", 404);
      const { data: draft } = await supabase
        .from("doc_studio_drafts")
        .select("id")
        .eq("id", check.draft_id)
        .eq("organization_id", ctx.organizationId)
        .maybeSingle();
      if (!draft) return errorResponse("Access denied", 403);

      const { data, error } = await supabase
        .from("doc_studio_drift_checks")
        .update({
          drift_status: "current",
          severity: "none",
          validated_by: ctx.userId,
          validated_at: new Date().toISOString(),
        })
        .eq("id", check_id)
        .select()
        .single();

      if (error) throw error;
      return successResponse({ drift_check: data });
    }

    if (action === "mark_all_validated") {
      if (!draft_id) return errorResponse("draft_id required", 400);
      const ctx = await requireDraftContext(draft_id);
      if ("error" in ctx) return ctx.error;

      const { data: draft } = await supabase
        .from("doc_studio_drafts")
        .select("id")
        .eq("id", draft_id)
        .eq("organization_id", ctx.organizationId)
        .maybeSingle();
      if (!draft) return errorResponse("Access denied", 403);

      const { error } = await supabase
        .from("doc_studio_drift_checks")
        .update({
          drift_status: "current",
          severity: "none",
          validated_by: ctx.userId,
          validated_at: new Date().toISOString(),
        })
        .eq("draft_id", draft_id);

      if (error) throw error;

      await supabase
        .from("doc_studio_drafts")
        .update({ drift_status: "current", last_validated_at: new Date().toISOString() })
        .eq("id", draft_id);

      return successResponse({ validated: true });
    }

    if (action === "get_summary") {
      if (!draft_id) return errorResponse("draft_id required", 400);
      const ctx = await requireDraftContext(draft_id);
      if ("error" in ctx) return ctx.error;

      const { data: draft } = await supabase
        .from("doc_studio_drafts")
        .select("id")
        .eq("id", draft_id)
        .eq("organization_id", ctx.organizationId)
        .maybeSingle();
      if (!draft) return errorResponse("Draft not found", 404);

      const { data, error } = await supabase
        .from("doc_studio_drift_checks")
        .select("drift_status, severity")
        .eq("draft_id", draft_id);

      if (error) throw error;
      const checks = data ?? [];

      const outdated = checks.filter((c) => c.drift_status === "outdated").length;
      const warning = checks.filter((c) => c.drift_status === "warning").length;
      const current = checks.filter((c) => c.drift_status === "current").length;

      const overallStatus = outdated > 0 ? "outdated" : warning > 0 ? "warning" : checks.length > 0 ? "current" : "unknown";

      return successResponse({
        overall_status: overallStatus,
        total: checks.length,
        outdated_count: outdated,
        warning_count: warning,
        current_count: current,
      });
    }

    if (draftScopedActions.has(action)) {
      return errorResponse("draft_id required", 400);
    }

    return errorResponse(`Unknown action: ${action}`, 400);
  } catch (err: unknown) {
    console.error('[doc-studio-drift] Unhandled error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  }
});

function computeDaysSince(dateStr: string): number {
  if (!dateStr) return 0;
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function successResponse(data: Record<string, unknown>) {
  return jsonResponse({ success: true, ...data });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}
