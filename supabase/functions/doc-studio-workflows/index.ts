import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient, requireAuth, verifyOrgMembership, isSuperAdminUser, getAuthorizedOrganizationIds } from "../_shared/auth.ts";
import { jsonResponse as json, corsPreflightResponse, errorResponse, escapeIlike } from "../_shared/http.ts";

interface CallerContext {
  userId: string;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  organizationIds: string[];
}

function requireAdmin(context: CallerContext, req: Request): Response | null {
  if (context.isAdmin) return null;
  return json({ error: "Admin access required" }, 403, req);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);

  try {
    const supabase = createServiceClient();

    const authResult = await requireAuth(req, supabase);
    if (authResult.error) return authResult.error;

    const userId = authResult.user.id;
    const isSuperAdmin = await isSuperAdminUser(supabase, userId);

    if (!isSuperAdmin) {
      return json({ error: "Forbidden: super-admin access required" }, 403, req);
    }

    const body = await req.json();
    const { action } = body;
    const orgIdRaw = body.organization_id;
    const organizationId = typeof orgIdRaw === "string" ? orgIdRaw.trim() : "";
    if (!organizationId) return json({ error: "organization_id is required" }, 400, req);
    const membership = await verifyOrgMembership(supabase, userId, organizationId, req);
    if (membership.error) return membership.error;

    const caller: CallerContext = {
      userId,
      isSuperAdmin,
      isAdmin: isSuperAdmin || membership.membership.role === "admin",
      organizationIds: await getAuthorizedOrganizationIds(supabase, userId),
    };

    const resolveAccessibleWorkflowIds = async (): Promise<string[] | null> => {
      if (caller.isSuperAdmin) return null;

      const { data: drafts, error } = await supabase
        .from("doc_studio_drafts")
        .select("doc_workflow_id, organization_id")
        .in("organization_id", caller.organizationIds)
        .not("doc_workflow_id", "is", null);

      if (error) throw error;

      const workflowIds = new Set<string>();
      for (const draft of drafts ?? []) {
        const workflowId = (draft as { doc_workflow_id?: string | null }).doc_workflow_id;
        if (workflowId) workflowIds.add(workflowId);
      }

      return [...workflowIds];
    };

    const ensureWorkflowAccess = async (workflowId: string): Promise<boolean> => {
      if (caller.isSuperAdmin) return true;

      const { data: linkedDraft } = await supabase
        .from("doc_studio_drafts")
        .select("organization_id")
        .eq("doc_workflow_id", workflowId)
        .limit(1)
        .maybeSingle();

      if (linkedDraft?.organization_id) {
        return caller.organizationIds.includes(linkedDraft.organization_id);
      }

      return caller.isAdmin;
    };

    // ── Workflows ─────────────────────────────────────────────────────────────

    if (action === "list") {
      let q = supabase
        .from("documentation_workflows")
        .select("*, steps:documentation_workflow_steps(count)")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true });

      const workflowIds = await resolveAccessibleWorkflowIds();
      if (workflowIds && workflowIds.length === 0) {
        return json({ workflows: [] });
      }
      if (workflowIds) q = q.in("id", workflowIds);

      if (body.is_active !== undefined) q = q.eq("is_active", body.is_active);
      if (typeof body.search === "string" && body.search.trim()) {
        const escaped = escapeIlike(body.search.trim());
        q = q.ilike("name", `%${escaped}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return json({ workflows: data ?? [] });
    }

    if (action === "get") {
      if (!(await ensureWorkflowAccess(body.workflow_id))) {
        return json({ error: "Access denied" }, 403, req);
      }
      const { data, error } = await supabase
        .from("documentation_workflows")
        .select("*, steps:documentation_workflow_steps(*)")
        .eq("organization_id", organizationId)
        .eq("id", body.workflow_id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return errorResponse("Workflow not found", 404, req);
      return json({ workflow: data });
    }

    if (action === "create") {
      const adminError = requireAdmin(caller, req);
      if (adminError) return adminError;

      const { data, error } = await supabase
        .from("documentation_workflows")
        .insert({
          organization_id: organizationId,
          name: body.name,
          slug: body.slug,
          description: body.description ?? null,
          start_url: body.start_url.trim(),
          tutorial_group: body.tutorial_group ?? null,
          target_role: body.target_role ?? null,
          automation_mode: body.automation_mode ?? "mock",
          estimated_duration_seconds: body.estimated_duration_seconds ?? 60,
          default_output_type: body.default_output_type ?? "full_package",
          is_active: true,
          is_playwright_ready: false,
          settings: {},
          version: 1,
        })
        .select("*")
        .single();
      if (error) {
        if (error.code === "23505") {
          return errorResponse("Workflow slug already exists", 409, req);
        }
        throw error;
      }
      return json({ workflow: data });
    }

    if (action === "update") {
      const adminError = requireAdmin(caller, req);
      if (adminError) return adminError;
      if (!(await ensureWorkflowAccess(body.workflow_id))) {
        return json({ error: "Access denied" }, 403, req);
      }

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const fields = [
        "name", "description", "start_url", "is_active", "is_playwright_ready",
        "automation_mode", "settings", "notes", "tutorial_group", "target_role",
        "estimated_duration_seconds", "default_output_type",
      ];
      for (const f of fields) {
        if (body[f] !== undefined) updates[f] = body[f];
      }

      const { data, error } = await supabase
        .from("documentation_workflows")
        .update(updates)
        .eq("organization_id", organizationId)
        .eq("id", body.workflow_id)
        .select("*")
        .maybeSingle();
      if (error) {
        if (error.code === "23505") {
          return errorResponse("Workflow slug already exists", 409, req);
        }
        throw error;
      }
      if (!data) return errorResponse("Workflow not found", 404, req);
      return json({ workflow: data });
    }

    if (action === "delete") {
      const adminError = requireAdmin(caller, req);
      if (adminError) return adminError;
      if (!(await ensureWorkflowAccess(body.workflow_id))) {
        return json({ error: "Access denied" }, 403, req);
      }

      const { error } = await supabase
        .from("documentation_workflows")
        .delete()
        .eq("organization_id", organizationId)
        .eq("id", body.workflow_id);
      if (error) throw error;
      return json({ success: true });
    }

    // ── Steps ─────────────────────────────────────────────────────────────────

    if (action === "steps_list") {
      if (!(await ensureWorkflowAccess(body.workflow_id))) {
        return json({ error: "Access denied" }, 403, req);
      }
      const { data, error } = await supabase
        .from("documentation_workflow_steps")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("workflow_id", body.workflow_id)
        .order("step_order", { ascending: true });
      if (error) throw error;
      return json({ steps: data ?? [] });
    }

    if (action === "step_create") {
      const adminError = requireAdmin(caller, req);
      if (adminError) return adminError;
      if (!(await ensureWorkflowAccess(body.workflow_id))) {
        return json({ error: "Access denied" }, 403, req);
      }

      const { data, error } = await supabase
        .from("documentation_workflow_steps")
        .insert({
          organization_id: organizationId,
          workflow_id: body.workflow_id,
          step_order: body.step_order,
          title: body.title.trim(),
          description: body.description ?? null,
          action_type: body.action_type,
          target_selector: body.target_selector ?? "",
          action_value: body.action_value ?? null,
          expected_result: body.expected_result ?? null,
          wait_strategy: body.wait_strategy ?? "none",
          screenshot_checkpoint: body.screenshot_checkpoint ?? false,
          screenshot_caption_template: body.screenshot_caption_template ?? "",
          fallback_instruction: body.fallback_instruction ?? null,
          timeout_seconds: body.timeout_seconds ?? 30,
          ai_observation_prompt: body.ai_observation_prompt ?? null,
          is_optional: body.is_optional ?? false,
          error_handling_strategy: body.error_handling_strategy ?? "fail",
          retry_count: body.retry_count ?? 0,
          selector_strategy: body.selector_strategy ?? "css",
          step_metadata_json: body.step_metadata_json ?? {},
        })
        .select("*")
        .single();
      if (error) throw error;
      return json({ step: data });
    }

    if (action === "step_update") {
      const adminError = requireAdmin(caller, req);
      if (adminError) return adminError;

      const { data: stepRow, error: stepError } = await supabase
        .from("documentation_workflow_steps")
        .select("workflow_id")
        .eq("id", body.id)
        .maybeSingle();
      if (stepError) throw stepError;
      if (!stepRow?.workflow_id || !(await ensureWorkflowAccess(stepRow.workflow_id))) {
        return json({ error: "Access denied" }, 403, req);
      }

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const fields = [
        "step_order", "title", "description", "action_type", "target_selector",
        "action_value", "expected_result", "wait_strategy", "screenshot_checkpoint",
        "screenshot_caption_template", "fallback_instruction", "timeout_seconds",
        "ai_observation_prompt", "is_optional", "error_handling_strategy",
        "retry_count", "selector_strategy", "step_metadata_json",
      ];
      for (const f of fields) {
        if (body[f] !== undefined) updates[f] = body[f];
      }

      const { data, error } = await supabase
        .from("documentation_workflow_steps")
        .update(updates)
        .eq("organization_id", organizationId)
        .eq("id", body.id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) return errorResponse("Step not found", 404, req);
      return json({ step: data });
    }

    if (action === "step_delete") {
      const adminError = requireAdmin(caller, req);
      if (adminError) return adminError;

      const { data: stepRow, error: stepError } = await supabase
        .from("documentation_workflow_steps")
        .select("workflow_id")
        .eq("id", body.step_id)
        .maybeSingle();
      if (stepError) throw stepError;
      if (!stepRow?.workflow_id || !(await ensureWorkflowAccess(stepRow.workflow_id))) {
        return json({ error: "Access denied" }, 403, req);
      }

      const { error } = await supabase
        .from("documentation_workflow_steps")
        .delete()
        .eq("organization_id", organizationId)
        .eq("id", body.step_id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "steps_reorder") {
      const adminError = requireAdmin(caller, req);
      if (adminError) return adminError;
      if (!(await ensureWorkflowAccess(body.workflow_id))) {
        return json({ error: "Access denied" }, 403, req);
      }

      const { step_orders } = body as { step_orders: { id: string; step_order: number }[] };
      if (!Array.isArray(step_orders) || step_orders.length === 0) {
        return errorResponse("step_orders must be a non-empty array", 400, req);
      }

      const updates = step_orders.map(({ id, step_order }) =>
        supabase
          .from("documentation_workflow_steps")
          .update({ step_order })
          .eq("organization_id", organizationId)
          .eq("id", id)
      );
      const results = await Promise.all(updates);
      const firstError = results.find((result) => result.error);
      if (firstError?.error) throw firstError.error;
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400, req);
  } catch (err) {
    console.error('[doc-studio-workflows] Unhandled error:', err instanceof Error ? err.message : String(err));
    return json({ error: 'Internal server error' }, 500, req);
  }
});
