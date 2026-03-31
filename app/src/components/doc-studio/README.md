# Documentation Studio

Documentation Studio is an internal tool for creating, automating, and managing documentation for CareMetric AI. It supports both AI-generated written content (drafts) and browser automation workflows that capture screenshots and produce step-by-step guides.

## Feature Areas

### 1. Drafts (`doc-studio`)
AI-assisted documentation drafts. A draft is a structured document with sections that can be edited manually or generated from a workflow job's captured screenshots.

**Components:**
- `DocStudioIndex.tsx` — draft list with integrity stats strip, filters, and launch point
- `DocStudioDraftDetail.tsx` — draft shell with tab navigation (17 tabs + Shot Plans / Integrity / Revalidation)
- `EditorTab.tsx` — rich text / markdown editor per section
- `GeneratedTab.tsx` — AI-generated content preview
- `TranscriptTab.tsx` — raw workflow transcript
- `AssetsPanel.tsx` — screenshot gallery attached to the draft
- `AssetLightbox.tsx` — full-size asset viewer
- `DiffViewer.tsx` — diff between versions
- `MarkdownPreview.tsx` — rendered markdown
- `DraftStatusBadge.tsx` — status chip
- `CompletenessIndicator.tsx` — progress ring showing section fill %
- `PublishConfirmModal.tsx` — publish confirmation dialog
- `ReviewSubmitModal.tsx` — submit for review dialog

### 2. Workflows (`doc-studio-workflows`)
Reusable automation workflows that define a sequence of browser steps to execute against the app. Each workflow maps to a specific feature or tutorial flow.

**Components:**
- `WorkflowsIndex.tsx` — workflow list with run controls
- `WorkflowEditor.tsx` — full workflow CRUD: metadata, step builder, test runner

**Key concepts:**
- A workflow has a `start_url`, optional auth requirement, and an ordered list of steps
- Each step has an `action_type` (click, type, screenshot, etc.), a `target_selector`, and error/retry config
- `automation_mode` controls which provider runs it: `mock` (instant fake run) or `playwright` (real browser)

### 3. Jobs (`doc-studio-jobs`)
Every time a workflow is triggered, a `documentation_jobs` row is created and tracked through its lifecycle.

**Components:**
- `JobsIndex.tsx` — paginated job list with status filter tabs
- `JobDetail.tsx` — live job detail: event timeline, step results, assets

**Job lifecycle:**
```
queued → preparing → running → capturing → generating_content → ready_for_review → completed
                                                                                  ↘ failed
                                                                                  ↘ cancelled
```

### 4. Render Pipeline (`doc-studio-render`)
Converts assembled render projects into video files. Orchestrates FFmpeg/Remotion render jobs, tracks per-scene progress via a live event log, and stores output artifacts for download.

**Components:**
- `RenderDashboard.tsx` — top-level render view: project list + active job monitor
- `tabs/RenderTab.tsx` — per-draft render tab: render project list, active job card (live event log, scene progress pills, cancel), command plan panel (filter_complex preview, stream labels, fingerprint)
- `RenderTimelinePreview.tsx` — horizontal scene timeline with duration bars
- `RenderOutputComparisonPanel.tsx` — side-by-side artifact comparison

**Key concepts:**
- A **render project** (`doc_studio_render_projects`) is assembled from a draft's timeline manifest. It holds `render_manifest_json`, scene count, and total duration.
- A **render job** (`doc_studio_render_jobs`) is a single execution attempt. One project may have many jobs (retries). Jobs move through: `queued → initializing → building_command → rendering → post_processing → uploading → completed` (or `failed / cancelled`).
- A **command plan** (`doc_studio_render_command_plans`) is computed at the start of each job. It stores the full FFmpeg `filter_complex` graph, input file list, output stream labels, and a fingerprint hash for deduplication.
- **Render artifacts** (`doc_studio_render_artifacts`) are output files produced by a completed job (video, thumbnail, subtitle track, etc.).
- The `engine_provider` field on jobs / projects selects the render backend: `mock` (instant fake), `ffmpeg` (real FFmpeg via edge function), or `remotion` (Remotion Lambda).

**Render status values (render projects):**
```
not_started → assembling_assets → building_timeline → ready_to_render
  → rendering → rendered
                ↘ render_failed
```

**Render job status values:**
```
queued → initializing → building_command → rendering → post_processing → uploading → completed
                                                                                    ↘ failed
                                                                                    ↘ cancelled
```

### 5. Shot Planning
Shot plans define the precise visual framing for each step in a tutorial — what UI element to focus on, what camera behavior to apply, and any overlay text or annotation to add. Shot plans feed directly into the render manifest, enriching scene assembly with per-step visual intent.

**Components:**
- `tabs/ShotPlansTab.tsx` — per-draft shot plans grid: auto-generate all, regenerate one, edit inline
- `settings/ShotPlanningTab.tsx` — global shot planning config: default shot type, annotation style, auto-generate triggers

**Shot types:**
`full_page`, `element_focus`, `element_highlight`, `form_fill`, `modal_dialog`, `navigation`, `confirmation`, `error_state`, `success_state`, `comparison`

**Camera behaviors:**
`none`, `pan`, `zoom_in`, `zoom_out`, `scroll_follow`, `cursor_follow`

**Key concepts:**
- One `doc_studio_shot_plans` row per step in a draft; linked by `draft_id` + `step_index`
- Auto-generation heuristics infer shot type and framing from step metadata (action type, target selector, element type)
- `buildShotAwareRenderManifest(baseManifest)` enriches an existing render manifest by fetching shot plans from DB and applying them per-scene
- `applyShotPlansToManifestSync(baseManifest, shotPlans)` is the sync version (no DB fetch) used in tests and offline

**Data flow:**
```
ShotPlansTab → useGenerateShotPlan / useGenerateAllShotPlans
  → doc-studio-shot-plans edge function (action: generate / generate_all)
    → DB: insert/update doc_studio_shot_plans
      → RenderTab "Start Render"
        → buildShotAwareRenderManifest(manifest)
          → fetches shot plans from DB
          → merges into manifest scenes
```

### 6. Tutorial Integrity (`doc-studio-integrity-queue`)
A validation and scoring system that continuously checks drafts for quality, staleness, and consistency issues. Every draft gets an `integrity_status` and a 0–100 `integrity_score`. The Integrity Queue surfaces all drafts that need attention.

**Components:**
- `IntegrityQueueIndex.tsx` — org-wide queue of drafts with non-healthy integrity status; sortable by severity, filterable by category
- `tabs/IntegrityTab.tsx` — per-draft integrity: category breakdown, warnings list, failures list, run check button
- `tabs/RevalidationTab.tsx` — per-draft revalidation history: event timeline, mark-as-validated, request recapture

**Integrity statuses (8 values):**
| Status | Meaning |
|---|---|
| `unknown` | Never checked |
| `healthy` | All checks pass, score ≥ 90 |
| `warning` | Non-blocking issues found |
| `needs_review` | Manual review recommended |
| `needs_recapture` | Screenshots/capture outdated |
| `outdated` | Content drift detected |
| `incomplete` | Required sections missing |
| `failed_validation` | Blocking failures present |

**Integrity categories (9):**
`capture`, `content`, `narration`, `screenshot`, `scene`, `shot_plan`, `caption`, `render`, `drift`

**Key concepts:**
- `doc_studio_integrity_reports` — one row per check run per draft; stores `overall_status`, `overall_score`, `warnings_json`, `failures_json`, `category_scores_json`, `check_duration_ms`
- `doc_studio_revalidation_events` — event log: records every revalidation action with actor, outcome, and notes
- `doc_studio_validation_history` — time-series of score snapshots for trend charts
- Running a check writes a new `doc_studio_integrity_reports` row and patches `integrity_status` + `integrity_score` on the `doc_studio_drafts` row
- `DraftListItem` exposes `integrity_status`, `integrity_score`, `revalidation_required` for badging in the library

**Data flow:**
```
IntegrityTab "Run Check" → useRunIntegrityCheck
  → doc-studio-integrity edge function (action: run_check)
    → tutorialIntegrityEngine.runCheck(draft, orgId)
      → checks 9 categories in parallel
      → writes doc_studio_integrity_reports row
      → patches doc_studio_drafts.integrity_status + integrity_score
        → UI: React Query cache invalidated
          → IntegrityTab refreshes with new report
          → DocStudioIndex stats strip updates
```

### 7. Review Workflow (`doc-studio-review-queue`)
A human-in-the-loop approval system for documentation drafts. Admins assign reviewers, track approval stages, leave comments, manage checklists, and record change requests before a draft can be published.

**Components:**
- `ReviewDashboardPage.tsx` — org-wide review queue: counts by stage, filterable draft list, click to open draft review
- `review/ReviewTab.tsx` — per-draft review tab inside `DocStudioDraftDetail`
- `review/ReviewOverviewPanel.tsx` — current stage, assigned reviewers, start/advance/reject/approve workflow actions
- `review/ReviewPipelineBar.tsx` — horizontal pipeline showing all stages with current position highlighted
- `review/ReviewStageBadge.tsx` — colored chip for workflow stage
- `review/ReviewChecklistPanel.tsx` — category-grouped checklist items with pass/fail/skip toggles
- `review/ReviewCommentsPanel.tsx` — threaded comment feed per draft review
- `review/ReviewCommentThread.tsx` — single comment thread with reply support
- `review/ReviewChangeRequestList.tsx` — open and resolved change requests
- `review/ReviewHistoryTimeline.tsx` — full audit trail of all review events
- `review/AssignReviewerModal.tsx` — modal to assign a reviewer to the active workflow
- `review/ApprovalModal.tsx` — modal to approve the draft (with optional notes)
- `review/RequestChangesModal.tsx` — modal to request changes (with required description)
- `settings/ReviewWorkflowTab.tsx` — admin settings to manage global checklist templates (add, edit, activate/deactivate, delete)

**Review stages (6):**
| Stage | Meaning |
|---|---|
| `draft_review` | Initial content review |
| `technical_review` | Technical accuracy check |
| `qa_review` | QA pass against checklists |
| `final_approval` | Final sign-off before publish |
| `approved` | Approved for publishing |
| `rejected` | Rejected; requires rework |

**Key concepts:**
- `draft_review_workflows` — one active workflow per draft; tracks `workflow_stage`, `assigned_reviewer_id`, `started_at`, `completed_at`
- `draft_review_checklist_items` — per-review instances of checklist items with `status` (`pending`, `pass`, `fail`, `skip`)
- `draft_review_comments` — threaded comments; top-level items have `parent_comment_id = null`
- `draft_review_change_requests` — open/resolved change requests per workflow
- `draft_review_events` — append-only audit log of all stage transitions and actions
- `doc_studio_review_checklist_templates` — global template library; admins manage via Settings > Review Workflow
- `DraftListItem` exposes `review_workflow_stage` (fetched via PostgREST join) for status badging in the draft library

**Data flow:**
```
DocStudioIndex → DraftCard/DraftTable
  shows ReviewStageBadge alongside DraftStatusBadge when draft.status === 'review'

ReviewDashboardPage → useReviewDashboard
  → doc-studio-review (action: get_dashboard)
    → returns count breakdown + draft list filtered by stage

ReviewTab → useReviewWorkflow / useReviewActions
  → doc-studio-review (action: get_workflow / start_workflow / advance_stage / approve / reject)

ReviewChecklistPanel → useReviewChecklist / useUpdateChecklistItem
  → doc-studio-review (action: get_checklist / update_checklist_item)

ReviewCommentsPanel → useReviewComments / useAddReviewComment
  → doc-studio-review (action: list_comments / add_comment)
```

### 8. Settings (`doc-studio-settings`)
Configuration for the automation infrastructure, FFmpeg environment, demo accounts, shot planning defaults, and integrity check rules.

**Components:**
- `DocStudioSettings.tsx` — tabbed settings shell (12 tabs)
- `settings/PlaywrightConfigTab.tsx` — runner URL, auth token, viewport
- `settings/RenderSettingsTab.tsx` — engine provider selector, FFmpeg binary path, Remotion Lambda config, health check button
- `settings/AIContentTab.tsx` — AI model, scene generation temperature
- `settings/NarrationAdvancedTab.tsx` — ElevenLabs voice, speed, pitch
- `settings/AudioAssemblyTab.tsx` — mixing levels, fade durations
- `settings/QualityDriftTab.tsx` — drift thresholds
- `settings/DemoAccountsTab.tsx` — demo account credentials
- `settings/PronunciationTab.tsx` — custom pronunciation dictionary
- `settings/SceneGenerationTab.tsx` — scene generation prompts
- `settings/ShotPlanningTab.tsx` — default shot type, annotation style, auto-generate on job complete
- `settings/IntegrityRulesTab.tsx` — check thresholds, enabled categories, auto-check schedule
- `settings/ReviewWorkflowTab.tsx` — global checklist template management (CRUD, activate/deactivate)

### 9. Navigation
- `DocStudioSubNav.tsx` — sticky sub-nav bar visible on all doc-studio views (Drafts / Workflows / Jobs / Integrity / Review Queue / Settings tabs). Wrapped by `ViewRenderer` around every doc-studio case.

---

## Data Flow

```
User triggers workflow
  → useTriggerJob (useDocStudioJobs.ts)
    → getAutomationProvider(settings, mode) (AutomationProviderFactory.ts)
      → MockAutomationProvider  — instant fake job, no external call
      → PlaywrightAutomationProvider
          → doc-studio-playwright edge function
            → creates documentation_jobs row (status: queued)
            → dispatches to Playwright Runner service (POST /run)
            → returns job_id to client
              → Runner executes steps
              → Runner POSTs runner_callback to doc-studio-jobs edge function
                → job status + step_results + events written to DB
                  → Frontend realtime subscription (useDocStudioJobEvents)
                    → JobDetail updates live
```

## Data Flow — Render Pipeline

```
User clicks "Start Render" on RenderTab
  → useStartRenderJob (useDocStudioRenderJobs.ts)
    → enqueueAndStartRenderJob (renderJobService.ts)
      → creates doc_studio_render_jobs row (status: queued)
      → calls doc-studio-render edge function
          → selects engine_provider (mock / ffmpeg / remotion)
          → mock: immediately writes fake progress events, marks completed
          → ffmpeg:
              → buildFfmpegSceneCommands(manifest, assetUrlMap)  [sceneCommandBuilder.ts]
              → buildCommandAssembly(...)                         [commandAssembler.ts]
              → writes doc_studio_render_command_plans row
              → calls ffmpeg-render-executor edge function
                  → executes FFmpeg binary
                  → streams progress events to doc_studio_render_job_events
                  → uploads output to Supabase Storage
                  → writes doc_studio_render_artifacts rows
                  → marks job completed
          → remotion:
              → buildRemotionCompositionPlan(manifest)            [compositionAssembler.ts]
              → calls remotion-render-executor edge function
                  → invokes Remotion Lambda render
                  → polls for completion, writes progress events
```

---

## Edge Functions

| Function | Purpose |
|---|---|
| `doc-studio-draft` | CRUD for drafts and their sections |
| `doc-studio-workflows` | CRUD for workflows and their steps |
| `doc-studio-jobs` | Job list/get/cancel/complete + `runner_callback` handler |
| `doc-studio-settings` | Get/set documentation_settings rows |
| `doc-studio-playwright` | Creates job record, dispatches to external Playwright runner |
| `doc-studio-render` | Orchestrates render jobs: queues, routes to engine, writes command plan |
| `ffmpeg-render-executor` | Executes FFmpeg binary, streams progress, uploads artifacts; supports `health_check` action |
| `remotion-render-executor` | Invokes Remotion Lambda render, polls completion, uploads artifacts |
| `doc-studio-assembly` | Assembles a render project from a draft's timeline + scenes |
| `doc-studio-scenes` | CRUD for doc_studio_scenes and scene assets |
| `doc-studio-narration` | Generates narration audio via ElevenLabs (or mock) |
| `doc-studio-quality` | Scores draft quality; writes to doc_studio_quality_scores |
| `doc-studio-package` | Bundles completed artifacts into a downloadable ZIP |
| `doc-studio-shot-plans` | CRUD + auto-generation for shot plans; actions: `list`, `get`, `upsert`, `delete`, `generate`, `generate_all` |
| `doc-studio-integrity` | Runs integrity checks, fetches reports/history/queue; actions: `run_check`, `get_report`, `get_history`, `get_revalidation_events`, `get_queue`, `mark_validated`, `mark_revalidation_required`, `request_recapture`, `resolve_drift` |
| `doc-studio-review` | Human-in-the-loop review workflow; actions: `get_workflow`, `start_workflow`, `advance_stage`, `approve`, `reject`, `assign_reviewer`, `get_checklist`, `update_checklist_item`, `list_comments`, `add_comment`, `add_change_request`, `resolve_change_request`, `get_review_events`, `get_dashboard`, `list_checklist_templates`, `upsert_checklist_template`, `delete_checklist_template` |

---

## Hooks

### Workflow / Job Hooks (`useDocStudioWorkflows`, `useDocStudioJobs`)
| Hook | Purpose |
|---|---|
| `useDocStudioWorkflows` | List/get/create/update/delete workflows + steps |
| `useDocStudioJobs` | List/get jobs; realtime polling for active jobs |
| `useDocStudioJobEvents` | Realtime Supabase subscription for job events |
| `useTriggerJob` | Creates a run via the provider abstraction |
| `useCancelJob` | Cancels an active job |
| `useCompleteJob` | Moves a ready_for_review job to completed |
| `useJobAssets` | Lists assets attached to a job |
| `usePlaywrightSettings` | Reads Playwright config from documentation_settings |
| `useDocStudioSettings` | CRUD for all documentation_settings rows |
| `useShotPlanningConfig` | Reads shot planning defaults from settings |
| `useSaveShotPlanningConfig` | Saves shot planning defaults |
| `useIntegrityRulesConfig` | Reads integrity check rules from settings |
| `useSaveIntegrityRulesConfig` | Saves integrity check rules |

### Render Pipeline Hooks (`useDocStudioRenderJobs`)
| Hook | Purpose |
|---|---|
| `useRenderJobsForDraft` | All render jobs for a draft (staleTime 15s) |
| `useLatestRenderJob` | Most recent render job for a draft |
| `useRenderJob` | Single render job by ID |
| `usePolledRenderJob` | Render job with 2s polling while active; exposes `isActive`, `isTerminal` |
| `usePolledRenderEvents` | Render job events with 2s polling while job is active |
| `useRenderJobArtifacts` | Output artifacts for a completed job |
| `useRenderArtifactsForDraft` | All artifacts across all jobs for a draft |
| `useRenderQueueStats` | Queue depth + active/failed counts (refetchInterval 30s) |
| `useRenderCommandPlan` | FFmpeg command plan for a job (filter_complex lines, input files, stream labels) |
| `useStartRenderJob` | Mutation: enqueue + start a new render job |
| `useCancelRenderJob` | Mutation: cancel an active render job |
| `useRetryRenderJob` | Mutation: re-queue a failed render job |

### Shot Plan Hooks (`useDocStudioShotPlans`)
| Hook | Purpose |
|---|---|
| `useDocStudioShotPlans` | List all shot plans for a draft |
| `useDocStudioShotPlan` | Single shot plan by draft + step index |
| `useUpsertShotPlan` | Create or update a shot plan |
| `useDeleteShotPlan` | Delete a shot plan |
| `useGenerateShotPlan` | Auto-generate a shot plan for one step |
| `useGenerateAllShotPlans` | Auto-generate shot plans for all steps in a draft |

### Integrity Hooks (`useDocStudioIntegrity`)
| Hook | Purpose |
|---|---|
| `useDocStudioIntegrityReport` | Latest integrity report for a draft |
| `useDocStudioIntegrityHistory` | Historical integrity scores for trend chart |
| `useDocStudioRevalidationEvents` | Revalidation event log for a draft |
| `useDocStudioIntegrityQueue` | Org-wide queue of drafts needing integrity action |
| `useRunIntegrityCheck` | Mutation: run full integrity check on a draft |
| `useMarkRevalidationRequired` | Mutation: flag a draft as needing revalidation |
| `useMarkDraftValidated` | Mutation: mark a draft as manually validated |
| `useRequestRecapture` | Mutation: flag a draft as needing recapture |
| `useResolveDrift` | Mutation: mark drift as resolved |

### Review Workflow Hooks (`useDocStudioReview`)
| Hook | Purpose |
|---|---|
| `useReviewWorkflow` | Active review workflow for a draft (or null if none started) |
| `useReviewDashboard` | Org-wide dashboard: stage counts + filterable draft list |
| `useReviewActions` | Mutations: `startWorkflow`, `advanceStage`, `approve`, `reject`, `assignReviewer` |
| `useReviewChecklist` | Checklist items for an active workflow, grouped by category |
| `useUpdateChecklistItem` | Mutation: set checklist item status (`pending` / `pass` / `fail` / `skip`) |
| `useReviewComments` | Threaded comments for an active workflow |
| `useAddReviewComment` | Mutation: post a new comment or reply |
| `useReviewChangeRequests` | Open and resolved change requests for a workflow |
| `useAddChangeRequest` | Mutation: file a new change request |
| `useResolveChangeRequest` | Mutation: mark a change request resolved |
| `useReviewEvents` | Full audit trail of all events for a workflow |
| `useChecklistTemplates` | Global checklist template library (admin settings) |
| `useUpsertChecklistTemplate` | Mutation: create or update a checklist template |
| `useDeleteChecklistTemplate` | Mutation: delete a checklist template |

---

## Types

**Workflow / Job types** — `src/types/documentation.ts`:
- `DocumentationWorkflow`, `DocumentationWorkflowStep`
- `DocumentationJob`, `DocumentationJobEvent`, `DocumentationAsset`
- `PlaywrightSettings`, `DocumentationDemoAccount`
- `StepExecutionResult`, `AutomationRunResult`, `TriggerJobPayload`
- Constants: `JOB_STATUS_LABELS`, `ACTIVE_JOB_STATUSES`, `TERMINAL_JOB_STATUSES`, `JOB_EVENT_TYPES`

**Render pipeline types** — `src/types/documentation.ts` (continued) + `src/types/doc-studio.ts`:
- `RenderManifest`, `RenderTimelineScene`, `RenderVideoSegment` — manifest structure passed to the render engine
- `RenderEngineProvider` — union: `'mock' | 'ffmpeg' | 'remotion'`
- `RenderMode` — union: `'standard_training' | 'short_clip' | 'highlight_reel'`
- `RenderSettings` — per-org settings including `ffmpegBinaryPath`, `ffmpegTempDir`, `ffmpegWorkerUrl`, `remotionLambdaFunctionName`, `remotionRegion`, `engineProvider`
- Constants: `ACTIVE_RENDER_STATUSES`, `TERMINAL_RENDER_STATUSES`

**FFmpeg pipeline types** — `src/lib/ffmpeg/types.ts`:
- `FfmpegSceneCommand`, `FfmpegSegmentClip` — per-scene command structures
- `FfmpegCommandAssembly` — full assembled FFmpeg invocation (args, filter_complex, input files)
- `FfmpegProgressEvent` — parsed FFmpeg stderr progress line

**Shot plan types** — `src/types/documentation.ts`:
- `ShotType` — 10-value union (`full_page`, `element_focus`, `element_highlight`, `form_fill`, `modal_dialog`, `navigation`, `confirmation`, `error_state`, `success_state`, `comparison`)
- `CameraBehavior` — 6-value union (`none`, `pan`, `zoom_in`, `zoom_out`, `scroll_follow`, `cursor_follow`)
- `AnnotationStyle` — 5-value union (`none`, `arrow`, `highlight`, `blur_surround`, `spotlight`)
- `ShotPlan` — full shot plan row with all 35 fields
- `ShotPlanGenerationContext` — context object passed to the heuristic generator
- Constants: `SHOT_TYPE_LABELS`, `CAMERA_BEHAVIOR_LABELS`, `ANNOTATION_STYLE_LABELS`

**Integrity types** — `src/types/documentation.ts`:
- `IntegrityStatus` — 8-value union
- `IntegrityCategory` — 9-value union
- `ValidationCheckStatus` — `'pass' | 'warning' | 'fail' | 'skipped'`
- `RevalidationEventType` — 12-value union
- `IntegrityWarning`, `IntegrityFailure` — warning/failure records with category + code
- `IntegrityReport` — full report row with category scores breakdown
- `RevalidationEvent` — event log row
- `IntegrityQueueItem` — minimal draft row for the integrity queue
- Constants: `INTEGRITY_STATUS_LABELS`, `INTEGRITY_STATUS_COLORS`, `INTEGRITY_STATUS_BADGE_COLORS`

---

## Playwright Runner

The external runner service lives in `playwright-runner/`. It is a standalone Node.js/Express app that:
1. Receives `POST /run` from the `doc-studio-playwright` edge function
2. Opens Chromium via Playwright
3. Authenticates using demo account credentials from env vars
4. Executes each workflow step via `StepExecutor` + `ActionHandlers`
5. Uploads screenshots to Supabase Storage via `AssetUploader`
6. Posts step results + events back via `POST /callback_url` (`runner_callback` action)

See `playwright-runner/README.md` for deployment instructions.

---

## Database Tables

### Workflow / Job Tables
- `documentation_workflows` — workflow definitions
- `documentation_workflow_steps` — ordered steps per workflow
- `documentation_jobs` — job runs with status + results
- `documentation_job_events` — event log per job (timeline)
- `documentation_assets` — screenshots/videos/traces per job or draft
- `doc_studio_drafts` — documentation drafts (includes `integrity_status`, `integrity_score`, `revalidation_required`)
- `documentation_draft_sections` — sections within a draft
- `documentation_settings` — key/value config store
- `documentation_demo_accounts` — demo account credentials (passwords in env vars)

### Render Pipeline Tables
- `doc_studio_render_projects` — assembled render projects per draft; holds `render_manifest_json`, `scene_count`, `engine_provider`, status
- `doc_studio_render_jobs` — individual render executions; tracks status, progress %, error message, started/completed timestamps
- `doc_studio_render_job_events` — per-event log rows for a job; fields include `event_type`, `title`, `severity` (info/warning/error/success), `scene_index`, `progress_percent`
- `doc_studio_render_artifacts` — output files from completed jobs (video, thumbnail, subtitle, etc.); stores storage path + public URL
- `doc_studio_render_command_plans` — FFmpeg command plan per job; stores `command_plan_json` with `filterComplexLines`, `allInputFiles`, `finalVideoLabel`, `finalAudioLabel`, `estimatedDurationSeconds`, plus `scene_count`, `overlay_count`, `audio_track_count`, `fingerprint_hash`

### Shot Planning Tables
- `doc_studio_shot_plans` — one row per (draft_id, step_index); 35 fields covering shot type, framing box, camera behavior, annotation, overlay text, timing, generation metadata

### Integrity Tables
- `doc_studio_integrity_reports` — one row per check run per draft; stores `overall_status`, `overall_score`, `warnings_json`, `failures_json`, `category_scores_json`, `check_duration_ms`, `checked_by`
- `doc_studio_revalidation_events` — event log for all revalidation actions; fields: `event_type`, `actor_id`, `outcome`, `notes`, `metadata_json`
- `doc_studio_validation_history` — time-series snapshot of `integrity_score` per draft (for trend charts); indexed by `(draft_id, recorded_at)`

### Review Workflow Tables
- `draft_review_workflows` — one active workflow per draft; tracks `workflow_stage`, `assigned_reviewer_id`, `started_by`, `started_at`, `completed_at`, `notes`
- `draft_review_checklist_items` — per-review instances of checklist items; `status` is `pending | pass | fail | skip`; linked to a `doc_studio_review_checklist_templates` row
- `draft_review_comments` — threaded comments; top-level rows have `parent_comment_id = null`; supports `is_edited`, `edited_at`
- `draft_review_change_requests` — change requests per workflow; tracks `priority`, `status` (`open | resolved`), `resolved_by`, `resolved_at`
- `draft_review_events` — append-only audit log; every stage transition, comment, assignment, and approval writes a row with `event_type`, `actor_id`, `notes`, `metadata_json`
- `doc_studio_review_checklist_templates` — global template library; each row is `category | item_key | label | description | sort_order | is_required | is_active`

All tables have RLS enabled; access is scoped to organization members or super admins.

---

## View Routes

| View | Component | Notes |
|---|---|---|
| `doc-studio` | `DocStudioIndex` | Drafts list with integrity stats strip; shows ReviewStageBadge on in-review drafts |
| `doc-studio-draft` | `DocStudioDraftDetail` | Draft editor — 21 tabs incl. Shot Plans, Integrity, Revalidation, Review |
| `doc-studio-workflows` | `WorkflowsIndex` | Workflow list |
| `doc-studio-workflow-editor` | `WorkflowEditor` | Workflow editor (needs `activeWorkflowId`) |
| `doc-studio-jobs` | `JobsIndex` | Job list |
| `doc-studio-job-detail` | `JobDetail` | Job detail (needs `activeJobId`) |
| `doc-studio-render` | `RenderDashboard` | Render project list + queue stats |
| `doc-studio-integrity-queue` | `IntegrityQueueIndex` | Org-wide integrity queue; click row to open draft |
| `doc-studio-review-queue` | `ReviewDashboardPage` | Org-wide review queue with stage filter + stage counts |
| `doc-studio-settings` | `DocStudioSettings` | Settings — 12 tabs incl. Shot Planning, Integrity Rules, Review Workflow |

Navigation state (`activeDraftId`, `activeWorkflowId`, `activeJobId`) is managed in `ViewRenderer.tsx`.
