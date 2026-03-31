import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient, requireAuth, requireDocStudioDraftAccessForRequest, verifyOrgMembership } from "../_shared/auth.ts";
import { jsonResponse, corsPreflightResponse } from "../_shared/http.ts";

function computeCompleteness(draft: Record<string, unknown>, assets: Array<{ asset_type: string }> = []) {
  const checklist: Array<{ key: string; label: string; passed: boolean }> = [];

  const add = (key: string, label: string, passed: boolean) => checklist.push({ key, label, passed });

  add("title", "Title is set", typeof draft.title === "string" && (draft.title as string).trim().length > 3);
  add("description", "Description is set", typeof draft.description === "string" && (draft.description as string).trim().length > 10);
  add("steps", "At least 3 steps defined", Array.isArray(draft.steps) && (draft.steps as unknown[]).length >= 3);

  const gen = (draft.generated_content ?? {}) as Record<string, unknown>;
  const ed = (draft.edited_content ?? {}) as Record<string, unknown>;
  const guideText = (ed.guide_md ?? gen.guide_md ?? "") as string;
  add("guide_content", "Guide content is at least 200 characters", guideText.trim().length >= 200);

  const transcript = (ed.transcript ?? gen.transcript ?? "") as string;
  add("transcript", "Transcript is present", transcript.trim().length > 0);

  const outputType = draft.output_type as string;
  if (outputType === "video_tutorial" || outputType === "narrated_video") {
    add("video_asset", "Video asset uploaded", assets.some((a) => a.asset_type === "video"));
  }
  if (outputType === "narrated_video") {
    add("audio_asset", "Audio narration uploaded", assets.some((a) => a.asset_type === "audio"));
  }

  const passed = checklist.filter((c) => c.passed).length;
  const score = Math.round((passed / checklist.length) * 100);
  return { checklist, score };
}

function bodyOrganizationId(body: Record<string, unknown>): string | null {
  const snake = body.organization_id;
  if (typeof snake === "string" && snake.trim().length > 0) return snake.trim();
  const camel = body.organizationId;
  if (typeof camel === "string" && camel.trim().length > 0) return camel.trim();
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  try {
    const supabase = createServiceClient();

    // Require an authenticated user for all draft operations.
    const authResult = await requireAuth(req, supabase);
    if (authResult.error) return authResult.error;
    const userId = authResult.user.id;

    const body = await req.json();
    const { action, draftId } = body;
    const organizationId = body.organizationId && typeof body.organizationId === "string" && body.organizationId.trim() !== ""
      ? body.organizationId.trim()
      : undefined;

    if (!action) return jsonResponse({ success: false, error: "action is required" }, 400);
    if (!organizationId) return jsonResponse({ success: false, error: "organization_id required" }, 400);

    const membership = await verifyOrgMembership(supabase, userId, organizationId, req);
    if (membership.error) return membership.error;

    // Helper: check if the authenticated user has access to a given org (or is super admin).
    const checkOrgAccess = async (orgId: string) => {
      const result = await verifyOrgMembership(supabase, userId, orgId, req);
      return !result.error;
    };

    // Helper: check if authenticated user can access a specific draft (by org).
    const checkDraftAccess = async (id: string) => {
      const { data } = await supabase
        .from("doc_studio_drafts")
        .select("organization_id")
        .eq("id", id)
        .maybeSingle();
      if (!data) return false;
      return checkOrgAccess(data.organization_id);
    };

    if (action === "list") {
      if (!organizationId) return jsonResponse({ success: false, error: "organizationId required" }, 400);
      const access = await requireDocStudioDraftAccessForRequest(req, supabase, { organizationId });
      if (!access.ok) return access.error;

      const { status, search, page = 1, limit = 20 } = body;
      let query = supabase
        .from("doc_studio_drafts")
        .select("id, title, description, output_type, status, version_label, target_role, completeness_score, assembly_status, integrity_status, integrity_score, revalidation_required, package_version, last_assembled_at, review_stage, created_by, created_at, updated_at, steps")
        .order("updated_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (organizationId) {
        // Verify the user belongs to the requested org before filtering by it.
        if (!(await checkOrgAccess(organizationId))) {
          return jsonResponse({ success: false, error: "Not authorized for this organization" }, 403);
        }
        query = query.eq("organization_id", organizationId);
      } else {
        // Scope to the user's orgs.
        const memberResult = await verifyOrgMembership(supabase, userId, "", req);
        const { data: memberships } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", userId)
          .eq("is_active", true);
        const orgIds = (memberships ?? []).map((m: { organization_id: string }) => m.organization_id);
        if (orgIds.length === 0) return jsonResponse({ success: true, data: [] });
        query = query.in("organization_id", orgIds);
        void memberResult;
      }

      if (status && status !== "all") query = query.eq("status", status);
      if (search) {
        const escaped = search.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
        query = query.ilike("title", `%${escaped}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped = (data ?? []).map((d: Record<string, unknown>) => ({
        ...d,
        review_workflow_stage: d.review_stage ?? null,
      }));
      return jsonResponse({ success: true, data: mapped });
    }

    if (action === "get") {
      if (!draftId) return jsonResponse({ success: false, error: "draftId is required" }, 400);
      const access = await requireDocStudioDraftAccessForRequest(req, supabase, { draftId });
      if (!access.ok) return access.error;

      const { data: draft, error: draftErr } = await supabase
        .from("doc_studio_drafts")
        .select("*")
        .eq("id", draftId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (draftErr) throw draftErr;
      if (!draft) return jsonResponse({ success: false, error: "Draft not found" }, 404);

      if (!(await checkOrgAccess(draft.organization_id))) {
        return jsonResponse({ success: false, error: "Access denied" }, 403);
      }

      const { data: assets } = await supabase
        .from("doc_studio_assets")
        .select("*")
        .eq("draft_id", draftId)
        .eq("organization_id", organizationId)
        .order("sort_order", { ascending: true });

      const { data: reviews } = await supabase
        .from("doc_studio_reviews")
        .select("*")
        .eq("draft_id", draftId)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      return jsonResponse({ success: true, data: { ...draft, assets: assets ?? [], reviews: reviews ?? [] } });
    }

    if (action === "create") {
      const { title, description, targetUrl, outputType, providerMode, targetRole, docWorkflowId } = body;
      if (!organizationId) return jsonResponse({ success: false, error: "organizationId required" }, 400);
      const access = await requireDocStudioDraftAccessForRequest(req, supabase, { organizationId });
      if (!access.ok) return access.error;

      if (!(await checkOrgAccess(organizationId))) {
        return jsonResponse({ success: false, error: "Not authorized for this organization" }, 403);
      }

      const { data, error } = await supabase
        .from("doc_studio_drafts")
        .insert({
          organization_id: organizationId,
          created_by: access.user.id,
          title: title ?? "Untitled Draft",
          description: description ?? "",
          target_url: targetUrl ?? "",
          output_type: outputType ?? "screenshot_guide",
          provider_mode: providerMode ?? "mock",
          target_role: targetRole ?? "staff",
          status: "draft",
          steps: [],
          generated_content: {},
          edited_content: {},
          doc_workflow_id: docWorkflowId ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return jsonResponse({ success: true, data });
    }

    if (action === "update") {
      if (!draftId) return jsonResponse({ success: false, error: "draftId is required" }, 400);
      const access = await requireDocStudioDraftAccessForRequest(req, supabase, { draftId });
      if (!access.ok) return access.error;

      const { data: existing } = await supabase
        .from("doc_studio_drafts")
        .select("organization_id, status")
        .eq("id", draftId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!existing) return jsonResponse({ success: false, error: "Draft not found" }, 404);

      if (!(await checkOrgAccess(existing.organization_id))) {
        return jsonResponse({ success: false, error: "Access denied" }, 403);
      }

      const allowedFields: Record<string, unknown> = {};
      const fieldMap: Record<string, string> = {
        title: "title",
        description: "description",
        targetUrl: "target_url",
        versionLabel: "version_label",
        targetRole: "target_role",
        steps: "steps",
        generatedContent: "generated_content",
        editedContent: "edited_content",
        publishNotes: "publish_notes",
        status: "status",
        completenessScore: "completeness_score",
        docWorkflowId: "doc_workflow_id",
        latestDocJobId: "latest_doc_job_id",
      };
      for (const [bodyKey, dbKey] of Object.entries(fieldMap)) {
        if (body[bodyKey] !== undefined) allowedFields[dbKey] = body[bodyKey];
      }

      const { data, error } = await supabase
        .from("doc_studio_drafts")
        .update(allowedFields)
        .eq("id", draftId)
        .eq("organization_id", organizationId)
        .select()
        .single();
      if (error) throw error;
      return jsonResponse({ success: true, data });
    }

    if (action === "delete") {
      if (!draftId) return jsonResponse({ success: false, error: "draftId is required" }, 400);
      const access = await requireDocStudioDraftAccessForRequest(req, supabase, { draftId });
      if (!access.ok) return access.error;

      const { data: existing } = await supabase
        .from("doc_studio_drafts")
        .select("organization_id, created_by")
        .eq("id", draftId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!existing) return jsonResponse({ success: false, error: "Draft not found" }, 404);

      if (!(await checkOrgAccess(existing.organization_id))) {
        return jsonResponse({ success: false, error: "Access denied" }, 403);
      }

      const { error } = await supabase.from("doc_studio_drafts").delete().eq("id", draftId);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    if (action === "submit_review") {
      if (!draftId) return jsonResponse({ success: false, error: "draftId is required" }, 400);
      const access = await requireDocStudioDraftAccessForRequest(req, supabase, { draftId });
      if (!access.ok) return access.error;
      const { decision, notes } = body;

      const { data: draft } = await supabase
        .from("doc_studio_drafts")
        .select("*")
        .eq("id", draftId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!draft) return jsonResponse({ success: false, error: "Draft not found" }, 404);

      const { data: reviewAssets } = await supabase
        .from("doc_studio_assets")
        .select("asset_type")
        .eq("draft_id", draftId)
        .eq("organization_id", organizationId);

      const { checklist, score } = computeCompleteness(draft, reviewAssets ?? []);

      const { data: review, error: reviewErr } = await supabase
        .from("doc_studio_reviews")
        .insert({
          draft_id: draftId,
          organization_id: organizationId,
          reviewer_id: userId,
          decision: decision ?? "changes_requested",
          notes: notes ?? "",
          completeness_score: score,
          checklist_json: checklist,
        })
        .select()
        .single();
      if (reviewErr) throw reviewErr;

      const newStatus = decision === "approved" ? "review" : draft.status;
      await supabase.from("doc_studio_drafts").update({
        status: newStatus,
        completeness_score: score,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      }).eq("id", draftId).eq("organization_id", organizationId);

      return jsonResponse({ success: true, data: { review, completenessScore: score, checklist } });
    }

    if (action === "publish") {
      if (!draftId) return jsonResponse({ success: false, error: "draftId is required" }, 400);
      const access = await requireDocStudioDraftAccessForRequest(req, supabase, { draftId });
      if (!access.ok) return access.error;
      const { publishNotes } = body;

      const { data: draft } = await supabase
        .from("doc_studio_drafts")
        .select("*")
        .eq("id", draftId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!draft) return jsonResponse({ success: false, error: "Draft not found" }, 404);

      const [publishAssetsRes, thresholdSettingRes] = await Promise.all([
        supabase.from("doc_studio_assets").select("asset_type").eq("draft_id", draftId).eq("organization_id", organizationId),
        supabase.from("documentation_settings").select("value_json").eq("organization_id", organizationId).eq("key", "publish_threshold").maybeSingle(),
      ]);

      const publishThreshold = (thresholdSettingRes.data?.value_json as Record<string, unknown> | null)?.min_score as number ?? 40;
      const { score } = computeCompleteness(draft, publishAssetsRes.data ?? []);
      if (score < publishThreshold) {
        return jsonResponse({ success: false, error: `Completeness score too low to publish (${score}/100). Minimum is ${publishThreshold}.` }, 400);
      }

      const { data, error } = await supabase
        .from("doc_studio_drafts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          completeness_score: score,
          publish_notes: publishNotes ?? "",
        })
        .eq("id", draftId)
        .eq("organization_id", organizationId)
        .select()
        .single();
      if (error) throw error;
      return jsonResponse({ success: true, data });
    }

    if (action === "archive") {
      if (!draftId) return jsonResponse({ success: false, error: "draftId is required" }, 400);
      const access = await requireDocStudioDraftAccessForRequest(req, supabase, { draftId });
      if (!access.ok) return access.error;

      const { data: existing } = await supabase
        .from("doc_studio_drafts")
        .select("organization_id")
        .eq("id", draftId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!existing) return jsonResponse({ success: false, error: "Draft not found" }, 404);

      const { data, error } = await supabase
        .from("doc_studio_drafts")
        .update({ status: "archived" })
        .eq("id", draftId)
        .eq("organization_id", organizationId)
        .select()
        .single();
      if (error) throw error;
      return jsonResponse({ success: true, data });
    }

    if (action === "create_asset") {
      const { storagePath, publicUrl, fileName, fileSize, mimeType, assetType, stepIndex, sortOrder, metadata } = body;
      if (!draftId || !organizationId) return jsonResponse({ success: false, error: "draftId and organizationId required" }, 400);
      const access = await requireDocStudioDraftAccessForRequest(req, supabase, { draftId, organizationId });
      if (!access.ok) return access.error;

      const { data, error } = await supabase
        .from("doc_studio_assets")
        .insert({
          draft_id: draftId,
          organization_id: access.organizationId,
          asset_type: assetType ?? "screenshot",
          step_index: stepIndex ?? null,
          storage_path: storagePath ?? "",
          public_url: publicUrl ?? "",
          file_name: fileName ?? "",
          file_size_bytes: fileSize ?? 0,
          mime_type: mimeType ?? "",
          sort_order: sortOrder ?? 0,
          metadata: metadata ?? {},
        })
        .select()
        .single();
      if (error) throw error;
      return jsonResponse({ success: true, data });
    }

    if (action === "delete_asset") {
      const { assetId } = body;
      if (!assetId) return jsonResponse({ success: false, error: "assetId required" }, 400);

      const { data: asset } = await supabase
        .from("doc_studio_assets")
        .select("organization_id, storage_path, draft_id")
        .eq("id", assetId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!asset) return jsonResponse({ success: false, error: "Asset not found" }, 404);
      const access = await requireDocStudioDraftAccessForRequest(req, supabase, {
        draftId: asset.draft_id as string,
        organizationId: asset.organization_id as string,
      });
      if (!access.ok) return access.error;

      if (asset.storage_path) {
        await supabase.storage.from("doc-studio-assets").remove([asset.storage_path]);
      }

      const { error } = await supabase
        .from("doc_studio_assets")
        .delete()
        .eq("id", assetId)
        .eq("organization_id", organizationId);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    if (action === "reorder_assets") {
      const { assetOrders } = body;
      if (!Array.isArray(assetOrders)) return jsonResponse({ success: false, error: "assetOrders array required" }, 400);
      if (!organizationId) return jsonResponse({ success: false, error: "organizationId required" }, 400);
      const access = await requireDocStudioDraftAccessForRequest(req, supabase, { organizationId, draftId });
      if (!access.ok) return access.error;

      for (const { id, sortOrder } of assetOrders) {
        await supabase.from("doc_studio_assets").update({ sort_order: sortOrder }).eq("id", id).eq("organization_id", access.organizationId);
      }
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error('[doc-studio-draft] Unhandled error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  }
});
