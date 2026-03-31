import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient, requireSuperAdmin } from "../_shared/auth.ts";
import { callAI, resolveAIConfigForTask } from "../_shared/ai-provider.ts";
import { jsonResponse, corsPreflightResponse } from "../_shared/http.ts";

type WorkflowStage =
  | "draft" | "automated_checks" | "awaiting_review" | "review_in_progress"
  | "changes_requested" | "ready_for_approval" | "approved"
  | "ready_for_render" | "rendered" | "archived";

type ReviewAction =
  | "get_workflow" | "assign_reviewer" | "start_review" | "approve"
  | "request_changes" | "advance_stage"
  | "list_tasks" | "update_task"
  | "list_comments" | "add_comment" | "resolve_comment" | "dismiss_comment"
  | "list_change_requests" | "create_change_request" | "update_change_request"
  | "get_checklist" | "upsert_checklist_result"
  | "list_history" | "get_dashboard";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const supabase = createServiceClient();
    const auth = await requireSuperAdmin(req, supabase);
    if (auth.error) return auth.error;

    const body = await req.json();
    const action = body.action as ReviewAction;

    // ── get_workflow ──────────────────────────────────────────────────────────
    if (action === "get_workflow") {
      const { draft_id } = body;
      const { data, error } = await supabase
        .from("doc_studio_review_workflows")
        .select("*")
        .eq("draft_id", draft_id)
        .maybeSingle();
      if (error) throw error;
      return jsonResponse({ workflow: data });
    }

    // ── assign_reviewer ───────────────────────────────────────────────────────
    if (action === "assign_reviewer") {
      const { draft_id, reviewer_id, task_types } = body;

      const { data: draft } = await supabase
        .from("doc_studio_drafts")
        .select("id, organization_id")
        .eq("id", draft_id)
        .single();
      if (!draft) return jsonResponse({ error: "Draft not found" }, 404);

      const orgId = draft.organization_id;

      const workflowPayload = {
        draft_id,
        organization_id: orgId,
        workflow_stage: "awaiting_review" as WorkflowStage,
        review_status: "pending",
        assigned_reviewer_id: reviewer_id,
        assigned_by_id: null,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase
        .from("doc_studio_review_workflows")
        .upsert(workflowPayload, { onConflict: "draft_id" });
      if (upsertErr) {
        console.error("[doc-studio-review] Failed to assign reviewer:", upsertErr.message);
        return jsonResponse({ success: false, error: "Failed to assign reviewer" }, 500);
      }

      const { error: draftUpdateErr } = await supabase.from("doc_studio_drafts")
        .update({ review_stage: "awaiting_review" }).eq("id", draft_id);
      if (draftUpdateErr) console.error("[doc-studio-review] Failed to update draft review_stage:", draftUpdateErr.message);

      if (Array.isArray(task_types) && task_types.length > 0) {
        const tasks = task_types.map((tt: string) => ({
          draft_id,
          organization_id: orgId,
          reviewer_id,
          task_type: tt,
          status: "pending",
          priority: body.priority ?? "normal",
          due_date: body.due_date ?? null,
        }));
        const { error: tasksErr } = await supabase.from("doc_studio_review_tasks").insert(tasks);
        if (tasksErr) console.error("[doc-studio-review] Failed to insert review tasks:", tasksErr.message);
      }

      const { error: historyErr } = await supabase.from("doc_studio_review_history").insert({
        draft_id,
        organization_id: orgId,
        actor_id: null,
        action: "reviewer_assigned",
        notes: `Reviewer assigned, ${(task_types ?? []).length} tasks created`,
      });
      if (historyErr) console.error("[doc-studio-review] Failed to insert review history:", historyErr.message);

      return jsonResponse({ success: true });
    }

    // ── start_review ──────────────────────────────────────────────────────────
    if (action === "start_review") {
      const { draft_id } = body;
      const { data: wf } = await supabase
        .from("doc_studio_review_workflows")
        .select("organization_id")
        .eq("draft_id", draft_id)
        .single();
      if (!wf) return jsonResponse({ error: "Workflow not found" }, 404);

      const { error: wfErr } = await supabase.from("doc_studio_review_workflows")
        .update({ workflow_stage: "review_in_progress", review_status: "in_review", updated_at: new Date().toISOString() })
        .eq("draft_id", draft_id);
      if (wfErr) console.error("[doc-studio-review] Failed to update workflow stage:", wfErr.message);

      const { error: draftErr } = await supabase.from("doc_studio_drafts")
        .update({ review_stage: "review_in_progress" }).eq("id", draft_id);
      if (draftErr) console.error("[doc-studio-review] Failed to update draft review_stage:", draftErr.message);

      const { error: histErr } = await supabase.from("doc_studio_review_history").insert({
        draft_id,
        organization_id: wf.organization_id,
        actor_id: null,
        action: "review_started",
        notes: "Review started",
      });
      if (histErr) console.error("[doc-studio-review] Failed to insert review history:", histErr.message);

      return jsonResponse({ success: true });
    }

    // ── approve ───────────────────────────────────────────────────────────────
    if (action === "approve") {
      const { draft_id, approval_notes } = body;

      const { data: wf } = await supabase
        .from("doc_studio_review_workflows")
        .select("organization_id")
        .eq("draft_id", draft_id)
        .single();
      if (!wf) return jsonResponse({ error: "Workflow not found" }, 404);

      const { count: openComments } = await supabase
        .from("doc_studio_review_comments")
        .select("id", { count: "exact", head: true })
        .eq("draft_id", draft_id)
        .eq("status", "open");

      if ((openComments ?? 0) > 0) {
        return jsonResponse(
          { error: `Cannot approve:  unresolved comment(s) remain`, blockers: ["open_comments"] },
          422,
        );
      }

      const now = new Date().toISOString();
      const { error: approveWfErr } = await supabase.from("doc_studio_review_workflows").update({
        workflow_stage: "approved",
        review_status: "approved",
        approved_by_id: null,
        approved_at: now,
        approval_notes: approval_notes ?? null,
        updated_at: now,
      }).eq("draft_id", draft_id);
      if (approveWfErr) console.error("[doc-studio-review] Failed to update workflow for approval:", approveWfErr.message);

      const { error: approveDraftErr } = await supabase.from("doc_studio_drafts")
        .update({ review_stage: "approved" }).eq("id", draft_id);
      if (approveDraftErr) console.error("[doc-studio-review] Failed to update draft review_stage:", approveDraftErr.message);

      const { error: approveHistErr } = await supabase.from("doc_studio_review_history").insert({
        draft_id,
        organization_id: wf.organization_id,
        actor_id: null,
        action: "tutorial_approved",
        notes: approval_notes ?? "Final approval granted",
      });
      if (approveHistErr) console.error("[doc-studio-review] Failed to insert review history:", approveHistErr.message);

      return jsonResponse({ success: true });
    }

    // ── request_changes ───────────────────────────────────────────────────────
    if (action === "request_changes") {
      const { draft_id, changes } = body;

      const { data: wf } = await supabase
        .from("doc_studio_review_workflows")
        .select("organization_id")
        .eq("draft_id", draft_id)
        .single();
      const orgId = wf?.organization_id;
      if (!orgId) return jsonResponse({ error: "Workflow not found" }, 404);

      const { error: reqChgWfErr } = await supabase.from("doc_studio_review_workflows")
        .update({ workflow_stage: "changes_requested", review_status: "in_review", updated_at: new Date().toISOString() })
        .eq("draft_id", draft_id);
      if (reqChgWfErr) console.error("[doc-studio-review] Failed to update workflow for changes_requested:", reqChgWfErr.message);

      const { error: reqChgDraftErr } = await supabase.from("doc_studio_drafts")
        .update({ review_stage: "changes_requested" }).eq("id", draft_id);
      if (reqChgDraftErr) console.error("[doc-studio-review] Failed to update draft review_stage:", reqChgDraftErr.message);

      if (Array.isArray(changes) && changes.length > 0) {
        const rows = changes.map((c: Record<string, unknown>) => ({
          draft_id,
          organization_id: orgId,
          change_type: c.change_type,
          requested_by_id: null,
          assigned_to_id: c.assigned_to_id ?? null,
          description: c.description,
          status: "open",
        }));
        const { error: chgReqInsertErr } = await supabase.from("doc_studio_change_requests").insert(rows);
        if (chgReqInsertErr) console.error("[doc-studio-review] Failed to insert change requests:", chgReqInsertErr.message);
      }

      const { error: reqChgHistErr } = await supabase.from("doc_studio_review_history").insert({
        draft_id,
        organization_id: orgId,
        actor_id: null,
        action: "change_requested",
        notes: `${(changes ?? []).length} change request(s) created`,
      });
      if (reqChgHistErr) console.error("[doc-studio-review] Failed to insert review history:", reqChgHistErr.message);

      return jsonResponse({ success: true });
    }

    // ── advance_stage ─────────────────────────────────────────────────────────
    if (action === "advance_stage") {
      const { draft_id, stage } = body;
      const validStages: WorkflowStage[] = [
        "draft", "automated_checks", "awaiting_review", "review_in_progress",
        "changes_requested", "ready_for_approval", "approved",
        "ready_for_render", "rendered", "archived",
      ];
      if (!validStages.includes(stage)) {
        return jsonResponse({ error: `Invalid stage: ${stage}` }, 400);
      }
      const { error: advWfErr } = await supabase.from("doc_studio_review_workflows")
        .update({ workflow_stage: stage, updated_at: new Date().toISOString() })
        .eq("draft_id", draft_id);
      if (advWfErr) console.error("[doc-studio-review] Failed to advance workflow stage:", advWfErr.message);

      const { error: advDraftErr } = await supabase.from("doc_studio_drafts")
        .update({ review_stage: stage }).eq("id", draft_id);
      if (advDraftErr) console.error("[doc-studio-review] Failed to update draft review_stage:", advDraftErr.message);

      return jsonResponse({ success: true });
    }

    // ── list_tasks ────────────────────────────────────────────────────────────
    if (action === "list_tasks") {
      const { draft_id } = body;
      const { data, error } = await supabase
        .from("doc_studio_review_tasks")
        .select("*")
        .eq("draft_id", draft_id)
        .order("created_at");
      if (error) throw error;
      return jsonResponse({ tasks: data ?? [] });
    }

    // ── update_task ───────────────────────────────────────────────────────────
    if (action === "update_task") {
      const { task_id, updates } = body;
      const allowedFields = ["status", "priority", "notes", "due_date", "completed_at"];
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates && typeof updates === "object") {
        for (const f of allowedFields) {
          if ((updates as Record<string, unknown>)[f] !== undefined) {
            payload[f] = (updates as Record<string, unknown>)[f];
          }
        }
      }
      if (payload.status === "completed" && !payload.completed_at) {
        payload.completed_at = new Date().toISOString();
      }
      const { error: taskUpdateErr } = await supabase.from("doc_studio_review_tasks").update(payload).eq("id", task_id);
      if (taskUpdateErr) console.error("[doc-studio-review] Failed to update task:", taskUpdateErr.message);
      return jsonResponse({ success: true });
    }

    // ── list_comments ─────────────────────────────────────────────────────────
    if (action === "list_comments") {
      const { draft_id } = body;
      const { data, error } = await supabase
        .from("doc_studio_review_comments")
        .select("*")
        .eq("draft_id", draft_id)
        .order("created_at");
      if (error) throw error;
      return jsonResponse({ comments: data ?? [] });
    }

    // ── add_comment ───────────────────────────────────────────────────────────
    if (action === "add_comment") {
      const { draft_id, comment_type, message, scene_id, shot_id, parent_comment_id } = body;

      const { data: wf } = await supabase
        .from("doc_studio_review_workflows")
        .select("organization_id")
        .eq("draft_id", draft_id)
        .maybeSingle();
      const orgId = wf?.organization_id;

      const { data, error } = await supabase.from("doc_studio_review_comments").insert({
        draft_id,
        organization_id: orgId,
        author_id: null,
        comment_type: comment_type ?? "general",
        message,
        scene_id: scene_id ?? null,
        shot_id: shot_id ?? null,
        parent_comment_id: parent_comment_id ?? null,
        status: "open",
      }).select().single();
      if (error) throw error;

      if (orgId) {
        const { error: commentHistErr } = await supabase.from("doc_studio_review_history").insert({
          draft_id,
          organization_id: orgId,
          actor_id: null,
          action: "comment_added",
          notes: parent_comment_id ? "Reply added" : "Comment added",
        });
        if (commentHistErr) console.error("[doc-studio-review] Failed to insert review history:", commentHistErr.message);
      }

      return jsonResponse({ comment: data });
    }

    // ── resolve_comment / dismiss_comment ─────────────────────────────────────
    if (action === "resolve_comment" || action === "dismiss_comment") {
      const { comment_id } = body;
      const status = action === "resolve_comment" ? "resolved" : "dismissed";
      const { error: commentUpdateErr } = await supabase.from("doc_studio_review_comments").update({
        status,
        resolved_by_id: null,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", comment_id);
      if (commentUpdateErr) console.error("[doc-studio-review] Failed to update comment status:", commentUpdateErr.message);
      return jsonResponse({ success: true });
    }

    // ── list_change_requests ──────────────────────────────────────────────────
    if (action === "list_change_requests") {
      const { draft_id } = body;
      const { data, error } = await supabase
        .from("doc_studio_change_requests")
        .select("*")
        .eq("draft_id", draft_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return jsonResponse({ change_requests: data ?? [] });
    }

    // ── create_change_request ─────────────────────────────────────────────────
    if (action === "create_change_request") {
      const { draft_id, change_type, description, assigned_to_id } = body;

      const { data: wf } = await supabase
        .from("doc_studio_review_workflows")
        .select("organization_id")
        .eq("draft_id", draft_id)
        .maybeSingle();
      const orgId = wf?.organization_id;

      const { data, error } = await supabase.from("doc_studio_change_requests").insert({
        draft_id,
        organization_id: orgId,
        change_type,
        requested_by_id: null,
        assigned_to_id: assigned_to_id ?? null,
        description,
        status: "open",
      }).select().single();
      if (error) throw error;

      if (orgId) {
        const { error: crCreateHistErr } = await supabase.from("doc_studio_review_history").insert({
          draft_id,
          organization_id: orgId,
          actor_id: null,
          action: "change_requested",
          notes: `Change request created: ${change_type}`,
        });
        if (crCreateHistErr) console.error("[doc-studio-review] Failed to insert review history:", crCreateHistErr.message);
      }

      return jsonResponse({ change_request: data });
    }

    // ── update_change_request ─────────────────────────────────────────────────
    if (action === "update_change_request") {
      const { change_request_id, status, resolution_notes } = body;
      const payload: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (status === "resolved") {
        payload.resolved_at = new Date().toISOString();
        payload.resolution_notes = resolution_notes ?? null;
      }
      const { error: crUpdateErr } = await supabase.from("doc_studio_change_requests").update(payload).eq("id", change_request_id);
      if (crUpdateErr) console.error("[doc-studio-review] Failed to update change request:", crUpdateErr.message);

      const { data: cr } = await supabase
        .from("doc_studio_change_requests")
        .select("draft_id, organization_id")
        .eq("id", change_request_id)
        .single();

      if (cr && status === "resolved") {
        const { error: crHistErr } = await supabase.from("doc_studio_review_history").insert({
          draft_id: cr.draft_id,
          organization_id: cr.organization_id,
          actor_id: null,
          action: "change_resolved",
          notes: resolution_notes ?? "Change request resolved",
        });
        if (crHistErr) console.error("[doc-studio-review] Failed to insert review history:", crHistErr.message);
      }

      return jsonResponse({ success: true });
    }

    // ── get_checklist ─────────────────────────────────────────────────────────
    if (action === "get_checklist") {
      const { draft_id } = body;
      const [{ data: templates }, { data: results }] = await Promise.all([
        supabase.from("doc_studio_review_checklist_templates")
          .select("*").eq("is_active", true).order("category").order("sort_order"),
        supabase.from("doc_studio_review_checklist_results")
          .select("*").eq("draft_id", draft_id),
      ]);
      return jsonResponse({ templates: templates ?? [], results: results ?? [] });
    }

    // ── upsert_checklist_result ───────────────────────────────────────────────
    if (action === "upsert_checklist_result") {
      const { draft_id, checklist_item_id, passed, notes } = body;

      const { data: wf } = await supabase
        .from("doc_studio_review_workflows")
        .select("organization_id")
        .eq("draft_id", draft_id)
        .maybeSingle();
      const orgId = wf?.organization_id;

      const { error: checklistUpsertErr } = await supabase.from("doc_studio_review_checklist_results").upsert({
        draft_id,
        organization_id: orgId,
        checklist_item_id,
        reviewer_id: null,
        passed,
        notes: notes ?? null,
        checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "draft_id,checklist_item_id,reviewer_id" });
      if (checklistUpsertErr) console.error("[doc-studio-review] Failed to upsert checklist result:", checklistUpsertErr.message);

      if (orgId) {
        const { error: checklistHistErr } = await supabase.from("doc_studio_review_history").insert({
          draft_id,
          organization_id: orgId,
          actor_id: null,
          action: "checklist_updated",
          notes: `Checklist item ${passed ? "passed" : "failed"}`,
        });
        if (checklistHistErr) console.error("[doc-studio-review] Failed to insert review history:", checklistHistErr.message);
      }

      return jsonResponse({ success: true });
    }

    // ── list_history ──────────────────────────────────────────────────────────
    if (action === "list_history") {
      const { draft_id, limit: lim = 50 } = body;
      const { data, error } = await supabase
        .from("doc_studio_review_history")
        .select("*")
        .eq("draft_id", draft_id)
        .order("created_at", { ascending: false })
        .limit(lim);
      if (error) throw error;
      return jsonResponse({ history: data ?? [] });
    }

    // ── get_dashboard ─────────────────────────────────────────────────────────
    if (action === "get_dashboard") {
      const orgId = body.organization_id;
      const { data: workflows, error } = await supabase
        .from("doc_studio_review_workflows")
        .select(`
          *,
          draft:doc_studio_drafts(id, title, integrity_score, integrity_status, updated_at, review_stage)
        `)
        .eq("organization_id", orgId)
        .not("workflow_stage", "eq", "archived")
        .order("updated_at", { ascending: false });
      if (error) throw error;

      const { data: taskCounts } = await supabase.from("doc_studio_review_tasks")
        .select("reviewer_id, status")
        .eq("organization_id", orgId)
        .neq("status", "completed");

      const reviewerWorkload: Record<string, number> = {};
      for (const t of (taskCounts ?? [])) {
        const rid = (t as Record<string, string>).reviewer_id;
        if (rid) reviewerWorkload[rid] = (reviewerWorkload[rid] ?? 0) + 1;
      }

      return jsonResponse({
        workflows: workflows ?? [],
        reviewer_workload: reviewerWorkload,
      });
    }

    if (action === "list_checklist_templates") {
      const { data, error } = await supabase
        .from("doc_studio_review_checklist_templates")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return jsonResponse({ success: true, data });
    }

    if (action === "upsert_checklist_template") {
      const { id, category, label, description, sort_order, is_required, is_active, item_key } = body;
      if (id) {
        const { data, error } = await supabase
          .from("doc_studio_review_checklist_templates")
          .update({ category, label, description, sort_order, is_required, is_active })
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return jsonResponse({ success: true, data });
      } else {
        const key = item_key ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
        const { data, error } = await supabase
          .from("doc_studio_review_checklist_templates")
          .insert({ category, label, description, sort_order: sort_order ?? 0, is_required: is_required ?? true, is_active: is_active ?? true, item_key: key })
          .select()
          .single();
        if (error) throw error;
        return jsonResponse({ success: true, data });
      }
    }

    if (action === "delete_checklist_template") {
      const { id } = body;
      if (!id) return jsonResponse({ error: "id is required" }, 400);
      const { error } = await supabase
        .from("doc_studio_review_checklist_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    // ── ai_review_insights ────────────────────────────────────────────────────
    if (action === "ai_review_insights") {
      const { draft_id } = body;
      if (!draft_id) return jsonResponse({ error: "draft_id required" }, 400);

      const aiConfig = await resolveAIConfigForTask(supabase, "review_insights");
      if (!aiConfig) return jsonResponse({ error: "No AI provider configured" }, 422);

      const [draftRes, scenesRes, changeReqRes, checklistRes, historyRes] = await Promise.all([
        supabase.from("doc_studio_drafts").select("title, description, generated_content, completeness_score, drift_status, status, target_role, output_type").eq("id", draft_id).maybeSingle(),
        supabase.from("doc_studio_scenes").select("title, summary, narration_text, quality_status").eq("draft_id", draft_id).order("scene_order", { ascending: true }),
        supabase.from("doc_studio_change_requests").select("title, description, severity, status").eq("draft_id", draft_id).neq("status", "resolved"),
        supabase.from("doc_studio_review_checklist_results").select("passed, notes, checklist_item_id").eq("draft_id", draft_id),
        supabase.from("doc_studio_review_history").select("action, notes, created_at").eq("draft_id", draft_id).order("created_at", { ascending: false }).limit(10),
      ]);

      const draft = draftRes.data;
      if (!draft) return jsonResponse({ error: "Draft not found" }, 404);

      const scenes = scenesRes.data ?? [];
      const changeRequests = changeReqRes.data ?? [];
      const checklistResults = checklistRes.data ?? [];
      const history = historyRes.data ?? [];

      const failedChecks = checklistResults.filter((r: Record<string, unknown>) => r.passed === false);
      const incompleteScenes = scenes.filter((s: Record<string, unknown>) => s.quality_status === "incomplete");

      const context = `TUTORIAL TITLE: ${draft.title}
DESCRIPTION: ${draft.description ?? "none"}
STATUS: ${draft.status} | DRIFT: ${draft.drift_status ?? "unknown"} | COMPLETENESS: ${draft.completeness_score ?? 0}%
TARGET ROLE: ${draft.target_role ?? "provider"} | OUTPUT TYPE: ${draft.output_type ?? "unknown"}

SCENES (${scenes.length} total, ${incompleteScenes.length} incomplete):
${scenes.map((s: Record<string, unknown>, i: number) => `  ${i + 1}. "${s.title}" [${s.quality_status ?? "ok"}] — ${String(s.narration_text ?? "").slice(0, 120)}`).join("\n")}

OPEN CHANGE REQUESTS (${changeRequests.length}):
${changeRequests.length === 0 ? "  None" : changeRequests.map((c: Record<string, unknown>) => `  - [${c.severity}] ${c.title}: ${c.description}`).join("\n")}

FAILED CHECKLIST ITEMS (${failedChecks.length}):
${failedChecks.length === 0 ? "  None" : failedChecks.map((c: Record<string, unknown>) => `  - ${c.checklist_item_id}: ${c.notes ?? "no notes"}`).join("\n")}

RECENT REVIEW HISTORY:
${history.map((h: Record<string, unknown>) => `  - ${h.action}: ${h.notes ?? ""}`).join("\n")}`;

      const systemPrompt = `You are an expert content reviewer for CareMetric AI, a healthcare EMR platform.
Analyze tutorial documentation and provide actionable review insights for the super admin reviewer.
Be specific, concise, and prioritize the most impactful improvements.`;

      const userMessage = `Review this tutorial documentation and provide insights:\n\n${context}\n\nRespond with a JSON object:\n{\n  "overall_assessment": "brief 1-2 sentence summary",\n  "readiness_score": <0-100>,\n  "priority_issues": [{"issue": "...", "impact": "high|medium|low", "suggestion": "..."}],\n  "strengths": ["..."],\n  "recommended_next_action": "single most important action to take",\n  "estimated_effort": "quick_fix|half_day|full_day|multi_day"\n}`;

      const response = await callAI(
        aiConfig,
        { systemPrompt, messages: [{ role: "user", content: userMessage }], temperature: 0.3, maxTokens: 2048 },
        45000,
      );

      const text = response.text.trim();
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start === -1 || end === -1) {
        return jsonResponse({ error: "AI returned unparseable content" }, 500);
      }

      let insights: unknown;
      try {
        insights = JSON.parse(text.slice(start, end + 1));
      } catch {
        return jsonResponse({ error: "AI returned malformed JSON" }, 500);
      }

      return jsonResponse({
        insights,
        provider: aiConfig.provider,
        model: aiConfig.model,
        generated_at: new Date().toISOString(),
      });
    }

    return jsonResponse({ error: "Unknown action" }, 400);

  } catch (err) {
    console.error('[doc-studio-review] Unhandled error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
