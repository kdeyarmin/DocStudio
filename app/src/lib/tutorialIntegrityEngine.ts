import { supabase } from './supabase';
import { logger } from './logger';
import type {
  TutorialIntegrityReport,
  IntegrityStatus,
  IntegrityCategory,
  IntegrityWarning,
  IntegrityFailure,
  IntegrityRecommendation,
  ValidationCheckStatus,
  RevalidationEventType,
} from '../types/documentation';

// ─── Internal Result Types ────────────────────────────────────────────────────

interface CategoryResult {
  score: number;
  warnings: IntegrityWarning[];
  failures: IntegrityFailure[];
  recommendations: IntegrityRecommendation[];
  checks: CheckEntry[];
}

interface CheckEntry {
  check_name: string;
  status: ValidationCheckStatus;
  score: number | null;
  detail: string | null;
  metadata: Record<string, unknown>;
}

// ─── Score → Status Mapping ───────────────────────────────────────────────────

function scoreToStatus(score: number, hasBlockingFailure: boolean): IntegrityStatus {
  if (hasBlockingFailure) return 'failed_validation';
  if (score >= 90) return 'healthy';
  if (score >= 75) return 'warning';
  if (score >= 50) return 'needs_review';
  if (score >= 25) return 'needs_recapture';
  return 'incomplete';
}

function _overallStatus(
  categoryScores: (number | null)[],
  failures: IntegrityFailure[],
): IntegrityStatus {
  if (failures.some((f) => f.blocking)) return 'failed_validation';
  const validScores = categoryScores.filter((s): s is number => s !== null);
  if (validScores.length === 0) return 'unknown';
  const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
  return scoreToStatus(avg, false);
}

// ─── Category Checks ──────────────────────────────────────────────────────────

async function _checkCapture(draftId: string): Promise<CategoryResult> {
  const warnings: IntegrityWarning[] = [];
  const failures: IntegrityFailure[] = [];
  const recommendations: IntegrityRecommendation[] = [];
  const checks: CheckEntry[] = [];

  const { data: draft } = await supabase
    .from('doc_studio_drafts')
    .select('id, last_captured_at, drift_deepened_at, status, provider_mode')
    .eq('id', draftId)
    .maybeSingle();

  const hasCaptureTimestamp = !!draft?.last_captured_at;
  checks.push({
    check_name: 'capture_timestamp_present',
    status: hasCaptureTimestamp ? 'pass' : 'warning',
    score: hasCaptureTimestamp ? 100 : 0,
    detail: hasCaptureTimestamp
      ? `Last captured at ${draft?.last_captured_at}`
      : 'No capture timestamp recorded',
    metadata: { last_captured_at: draft?.last_captured_at ?? null },
  });

  if (!hasCaptureTimestamp) {
    warnings.push({
      code: 'CAPTURE_NO_TIMESTAMP',
      category: 'capture',
      message: 'Draft has no capture timestamp — Playwright may not have run',
    });
    recommendations.push({
      priority: 'high',
      category: 'capture',
      action: 'Run the Playwright capture pipeline for this draft',
    });
  }

  const hasDriftDeepened = !!draft?.drift_deepened_at;
  checks.push({
    check_name: 'drift_not_deepened',
    status: hasDriftDeepened ? 'warning' : 'pass',
    score: hasDriftDeepened ? 40 : 100,
    detail: hasDriftDeepened
      ? `Drift deepened at ${draft?.drift_deepened_at}`
      : 'No unresolved drift deepening',
    metadata: { drift_deepened_at: draft?.drift_deepened_at ?? null },
  });

  if (hasDriftDeepened) {
    warnings.push({
      code: 'CAPTURE_DRIFT_DEEPENED',
      category: 'capture',
      message: 'Draft drift has deepened since last capture — recapture recommended',
    });
  }

  const isMock = draft?.provider_mode === 'mock';
  checks.push({
    check_name: 'provider_mode_not_mock',
    status: isMock ? 'warning' : 'pass',
    score: isMock ? 60 : 100,
    detail: isMock
      ? 'Draft uses mock provider — screenshots are placeholders'
      : `Provider mode: ${draft?.provider_mode ?? 'unknown'}`,
    metadata: { provider_mode: draft?.provider_mode ?? null },
  });

  if (isMock) {
    warnings.push({
      code: 'CAPTURE_MOCK_PROVIDER',
      category: 'capture',
      message: 'Draft uses mock provider mode — real Playwright capture required for production',
    });
  }

  const scores = checks.map((c) => c.score ?? 0);
  const score = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  return { score, warnings, failures, recommendations, checks };
}

async function _checkContent(draftId: string): Promise<CategoryResult> {
  const warnings: IntegrityWarning[] = [];
  const failures: IntegrityFailure[] = [];
  const recommendations: IntegrityRecommendation[] = [];
  const checks: CheckEntry[] = [];

  const { data: draft } = await supabase
    .from('doc_studio_drafts')
    .select('generated_content, edited_content, completeness_score, title, description')
    .eq('id', draftId)
    .maybeSingle();

  const gc = (draft?.generated_content ?? {}) as Record<string, unknown>;
  const ec = (draft?.edited_content ?? {}) as Record<string, unknown>;

  const hasGuide = !!(gc.guide_md || ec.guide_md);
  checks.push({
    check_name: 'guide_markdown_present',
    status: hasGuide ? 'pass' : 'fail',
    score: hasGuide ? 100 : 0,
    detail: hasGuide ? 'Guide markdown content present' : 'No guide markdown generated',
    metadata: {},
  });

  if (!hasGuide) {
    failures.push({
      code: 'CONTENT_NO_GUIDE',
      category: 'content',
      message: 'Draft has no guide markdown — run content generation',
      blocking: false,
    });
  }

  const hasTranscript = !!(gc.transcript || ec.transcript);
  checks.push({
    check_name: 'transcript_present',
    status: hasTranscript ? 'pass' : 'warning',
    score: hasTranscript ? 100 : 40,
    detail: hasTranscript ? 'Transcript present' : 'No transcript found',
    metadata: {},
  });

  if (!hasTranscript) {
    warnings.push({ code: 'CONTENT_NO_TRANSCRIPT', category: 'content', message: 'No transcript found in generated or edited content' });
  }

  const completenessScore = draft?.completeness_score ?? 0;
  const completenessOk = completenessScore >= 60;
  checks.push({
    check_name: 'completeness_score_acceptable',
    status: completenessOk ? 'pass' : 'warning',
    score: completenessScore,
    detail: `Completeness score: ${completenessScore}`,
    metadata: { completeness_score: completenessScore },
  });

  if (!completenessOk) {
    warnings.push({
      code: 'CONTENT_LOW_COMPLETENESS',
      category: 'content',
      message: `Completeness score ${completenessScore} is below 60 — review content coverage`,
    });
    recommendations.push({
      priority: 'medium',
      category: 'content',
      action: 'Complete missing content sections to raise completeness score above 60',
    });
  }

  const hasTitle = !!(draft?.title?.trim());
  const hasDesc = !!(draft?.description?.trim());
  checks.push({
    check_name: 'title_and_description_set',
    status: hasTitle && hasDesc ? 'pass' : 'warning',
    score: hasTitle && hasDesc ? 100 : hasTitle ? 70 : 30,
    detail: hasTitle && hasDesc ? 'Title and description set' : 'Missing title or description',
    metadata: { has_title: hasTitle, has_description: hasDesc },
  });

  const scores = checks.map((c) => c.score ?? 0);
  const score = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  return { score, warnings, failures, recommendations, checks };
}

async function _checkNarration(draftId: string): Promise<CategoryResult> {
  const warnings: IntegrityWarning[] = [];
  const failures: IntegrityFailure[] = [];
  const recommendations: IntegrityRecommendation[] = [];
  const checks: CheckEntry[] = [];

  const [scenesRes, narrationRes] = await Promise.all([
    supabase
      .from('doc_studio_scenes')
      .select('id', { count: 'exact', head: false })
      .eq('draft_id', draftId),
    supabase
      .from('doc_studio_narration_segments')
      .select('id, status, scene_id', { count: 'exact', head: false })
      .eq('draft_id', draftId),
  ]);

  const sceneCount = scenesRes.data?.length ?? 0;
  const narrationSegments = (narrationRes.data ?? []) as Array<{ id: string; status: string; scene_id: string | null }>;
  const readySegments = narrationSegments.filter((n) => n.status === 'ready');
  const coverageRatio = sceneCount > 0 ? readySegments.length / sceneCount : 0;
  const coveragePct = Math.round(coverageRatio * 100);

  checks.push({
    check_name: 'narration_coverage',
    status: coveragePct >= 80 ? 'pass' : coveragePct >= 50 ? 'warning' : 'fail',
    score: coveragePct,
    detail: `${readySegments.length}/${sceneCount} scenes have ready narration (${coveragePct}%)`,
    metadata: { scene_count: sceneCount, ready_count: readySegments.length, coverage_pct: coveragePct },
  });

  if (coveragePct < 80) {
    const item: IntegrityWarning | IntegrityFailure = {
      code: 'NARRATION_INCOMPLETE_COVERAGE',
      category: 'narration',
      message: `Only ${coveragePct}% of scenes have ready narration audio`,
    };
    if (coveragePct < 50) {
      failures.push({ ...item, blocking: false } as IntegrityFailure);
    } else {
      warnings.push(item as IntegrityWarning);
    }
    recommendations.push({ priority: 'high', category: 'narration', action: 'Generate narration audio for all scenes before render' });
  }

  const pendingSegments = narrationSegments.filter((n) => n.status === 'pending' || n.status === 'generating');
  checks.push({
    check_name: 'no_pending_narration_jobs',
    status: pendingSegments.length === 0 ? 'pass' : 'warning',
    score: pendingSegments.length === 0 ? 100 : 60,
    detail: pendingSegments.length === 0
      ? 'No narration jobs pending'
      : `${pendingSegments.length} narration segments still pending/generating`,
    metadata: { pending_count: pendingSegments.length },
  });

  const scores = checks.map((c) => c.score ?? 0);
  const score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  return { score, warnings, failures, recommendations, checks };
}

async function _checkScreenshot(draftId: string): Promise<CategoryResult> {
  const warnings: IntegrityWarning[] = [];
  const failures: IntegrityFailure[] = [];
  const recommendations: IntegrityRecommendation[] = [];
  const checks: CheckEntry[] = [];

  const { data: assets } = await supabase
    .from('doc_studio_assets')
    .select('id, asset_type, asset_status, scene_id, screenshot_role, width, height')
    .eq('draft_id', draftId)
    .eq('asset_type', 'screenshot');

  const screenshotAssets = (assets ?? []) as Array<{
    id: string; asset_type: string; asset_status: string;
    scene_id: string | null; screenshot_role: string | null;
    width: number | null; height: number | null;
  }>;

  const totalScreenshots = screenshotAssets.length;
  const readyScreenshots = screenshotAssets.filter((a) => a.asset_status === 'ready');

  checks.push({
    check_name: 'screenshots_present',
    status: totalScreenshots > 0 ? 'pass' : 'fail',
    score: totalScreenshots > 0 ? 100 : 0,
    detail: `${totalScreenshots} screenshot asset(s) found`,
    metadata: { total: totalScreenshots },
  });

  if (totalScreenshots === 0) {
    failures.push({ code: 'SCREENSHOT_NONE_FOUND', category: 'screenshot', message: 'No screenshot assets found for this draft', blocking: false });
    recommendations.push({ priority: 'high', category: 'screenshot', action: 'Run Playwright capture to generate screenshots' });
  }

  const readyRatio = totalScreenshots > 0 ? (readyScreenshots.length / totalScreenshots) * 100 : 0;
  checks.push({
    check_name: 'screenshots_all_ready',
    status: readyRatio >= 90 ? 'pass' : readyRatio >= 60 ? 'warning' : 'fail',
    score: Math.round(readyRatio),
    detail: `${readyScreenshots.length}/${totalScreenshots} screenshots in ready state`,
    metadata: { ready: readyScreenshots.length, total: totalScreenshots },
  });

  const lowResScreenshots = readyScreenshots.filter(
    (a) => (a.width != null && a.width < 800) || (a.height != null && a.height < 450),
  );
  checks.push({
    check_name: 'screenshot_resolution_acceptable',
    status: lowResScreenshots.length === 0 ? 'pass' : 'warning',
    score: lowResScreenshots.length === 0 ? 100 : Math.max(0, 100 - lowResScreenshots.length * 20),
    detail: lowResScreenshots.length === 0
      ? 'All screenshots meet minimum resolution'
      : `${lowResScreenshots.length} screenshot(s) below 800×450`,
    metadata: { low_res_count: lowResScreenshots.length },
  });

  if (lowResScreenshots.length > 0) {
    warnings.push({
      code: 'SCREENSHOT_LOW_RESOLUTION',
      category: 'screenshot',
      message: `${lowResScreenshots.length} screenshot(s) are below minimum resolution (800×450)`,
    });
  }

  const scores = checks.map((c) => c.score ?? 0);
  const score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  return { score, warnings, failures, recommendations, checks };
}

async function _checkScenes(draftId: string): Promise<CategoryResult> {
  const warnings: IntegrityWarning[] = [];
  const failures: IntegrityFailure[] = [];
  const recommendations: IntegrityRecommendation[] = [];
  const checks: CheckEntry[] = [];

  const { data: scenes } = await supabase
    .from('doc_studio_scenes')
    .select('id, title, duration_seconds, start_time_seconds, end_time_seconds, scene_order')
    .eq('draft_id', draftId)
    .order('scene_order', { ascending: true });

  const sceneList = (scenes ?? []) as Array<{
    id: string; title: string; duration_seconds: number | null;
    start_time_seconds: number | null; end_time_seconds: number | null;
    scene_order: number;
  }>;

  checks.push({
    check_name: 'scenes_present',
    status: sceneList.length > 0 ? 'pass' : 'fail',
    score: sceneList.length > 0 ? 100 : 0,
    detail: `${sceneList.length} scene(s) found`,
    metadata: { count: sceneList.length },
  });

  if (sceneList.length === 0) {
    failures.push({ code: 'SCENE_NONE_FOUND', category: 'scene', message: 'No scenes found — draft has not been assembled', blocking: true });
    return { score: 0, warnings, failures, recommendations, checks };
  }

  const untitledScenes = sceneList.filter((s) => !s.title?.trim() || s.title === 'Untitled Scene');
  checks.push({
    check_name: 'all_scenes_titled',
    status: untitledScenes.length === 0 ? 'pass' : 'warning',
    score: untitledScenes.length === 0 ? 100 : Math.max(0, 100 - untitledScenes.length * 15),
    detail: untitledScenes.length === 0
      ? 'All scenes have titles'
      : `${untitledScenes.length} scene(s) missing titles`,
    metadata: { untitled_count: untitledScenes.length },
  });

  if (untitledScenes.length > 0) {
    warnings.push({ code: 'SCENE_MISSING_TITLES', category: 'scene', message: `${untitledScenes.length} scene(s) have no title set` });
  }

  const missingDuration = sceneList.filter(
    (s) => s.duration_seconds == null || s.duration_seconds <= 0,
  );
  checks.push({
    check_name: 'all_scenes_have_duration',
    status: missingDuration.length === 0 ? 'pass' : 'warning',
    score: missingDuration.length === 0 ? 100 : Math.max(0, 100 - (missingDuration.length / sceneList.length) * 100),
    detail: missingDuration.length === 0
      ? 'All scenes have duration set'
      : `${missingDuration.length} scene(s) missing duration`,
    metadata: { missing_duration_count: missingDuration.length },
  });

  if (missingDuration.length > 0) {
    warnings.push({
      code: 'SCENE_MISSING_DURATION',
      category: 'scene',
      message: `${missingDuration.length} scene(s) are missing duration values`,
    });
    recommendations.push({ priority: 'medium', category: 'scene', action: 'Run the timing manifest pipeline to assign scene durations' });
  }

  const scores = checks.map((c) => c.score ?? 0);
  const score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  return { score, warnings, failures, recommendations, checks };
}

async function _checkShotPlans(draftId: string): Promise<CategoryResult> {
  const warnings: IntegrityWarning[] = [];
  const failures: IntegrityFailure[] = [];
  const recommendations: IntegrityRecommendation[] = [];
  const checks: CheckEntry[] = [];

  const [scenesRes, shotPlansRes] = await Promise.all([
    supabase.from('doc_studio_scenes').select('id', { count: 'exact', head: false }).eq('draft_id', draftId),
    supabase.from('doc_studio_shot_plans').select('id, scene_id, is_key_shot, shot_type, emphasis_level').eq('draft_id', draftId),
  ]);

  const sceneCount = scenesRes.data?.length ?? 0;
  const shotPlans = (shotPlansRes.data ?? []) as Array<{
    id: string; scene_id: string | null; is_key_shot: boolean; shot_type: string; emphasis_level: string;
  }>;

  const totalPlans = shotPlans.length;
  checks.push({
    check_name: 'shot_plans_exist',
    status: totalPlans > 0 ? 'pass' : 'warning',
    score: totalPlans > 0 ? 100 : 0,
    detail: `${totalPlans} shot plan(s) found`,
    metadata: { total: totalPlans, scene_count: sceneCount },
  });

  if (totalPlans === 0) {
    warnings.push({ code: 'SHOT_PLAN_NONE', category: 'shot_plan', message: 'No shot plans defined — auto-generation recommended' });
    recommendations.push({ priority: 'medium', category: 'shot_plan', action: 'Generate shot plans from scene workflow steps' });
  }

  if (sceneCount > 0 && totalPlans > 0) {
    const scenesWithPlans = new Set(shotPlans.filter((p) => p.scene_id).map((p) => p.scene_id!));
    const coveragePct = Math.round((scenesWithPlans.size / sceneCount) * 100);
    checks.push({
      check_name: 'shot_plan_scene_coverage',
      status: coveragePct >= 80 ? 'pass' : coveragePct >= 50 ? 'warning' : 'fail',
      score: coveragePct,
      detail: `${scenesWithPlans.size}/${sceneCount} scenes have shot plans (${coveragePct}%)`,
      metadata: { scenes_with_plans: scenesWithPlans.size, total_scenes: sceneCount, coverage_pct: coveragePct },
    });

    if (coveragePct < 80) {
      warnings.push({
        code: 'SHOT_PLAN_LOW_COVERAGE',
        category: 'shot_plan',
        message: `Shot plans only cover ${coveragePct}% of scenes`,
      });
    }
  }

  const keyShots = shotPlans.filter((p) => p.is_key_shot);
  checks.push({
    check_name: 'key_shots_tagged',
    status: keyShots.length > 0 ? 'pass' : 'warning',
    score: keyShots.length > 0 ? 100 : 50,
    detail: `${keyShots.length} key shot(s) tagged`,
    metadata: { key_shot_count: keyShots.length },
  });

  if (keyShots.length === 0 && totalPlans > 0) {
    warnings.push({ code: 'SHOT_PLAN_NO_KEY_SHOTS', category: 'shot_plan', message: 'No key shots tagged — consider marking at least one shot per scene as key' });
  }

  const scores = checks.map((c) => c.score ?? 0);
  const score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  return { score, warnings, failures, recommendations, checks };
}

async function _checkCaptions(draftId: string): Promise<CategoryResult> {
  const warnings: IntegrityWarning[] = [];
  const failures: IntegrityFailure[] = [];
  const recommendations: IntegrityRecommendation[] = [];
  const checks: CheckEntry[] = [];

  const { data: captionManifest } = await supabase
    .from('doc_studio_caption_manifests')
    .select('id, status, caption_json, word_count')
    .eq('draft_id', draftId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const hasManifest = !!captionManifest;
  checks.push({
    check_name: 'caption_manifest_present',
    status: hasManifest ? 'pass' : 'warning',
    score: hasManifest ? 100 : 20,
    detail: hasManifest ? `Caption manifest found (status: ${captionManifest?.status})` : 'No caption manifest found',
    metadata: { has_manifest: hasManifest },
  });

  if (!hasManifest) {
    warnings.push({ code: 'CAPTION_NO_MANIFEST', category: 'caption', message: 'No caption manifest found — generate captions before render' });
    recommendations.push({ priority: 'medium', category: 'caption', action: 'Run caption pipeline to generate SRT/VTT files' });
    return { score: 20, warnings, failures, recommendations, checks };
  }

  const isReady = captionManifest?.status === 'ready';
  checks.push({
    check_name: 'caption_manifest_ready',
    status: isReady ? 'pass' : 'warning',
    score: isReady ? 100 : 50,
    detail: `Caption manifest status: ${captionManifest?.status}`,
    metadata: { status: captionManifest?.status },
  });

  const captionBlocks = (captionManifest?.caption_json ?? []) as unknown[];
  const hasContent = captionBlocks.length > 0;
  checks.push({
    check_name: 'caption_blocks_present',
    status: hasContent ? 'pass' : 'fail',
    score: hasContent ? 100 : 0,
    detail: `${captionBlocks.length} caption block(s)`,
    metadata: { block_count: captionBlocks.length },
  });

  if (!hasContent) {
    failures.push({ code: 'CAPTION_EMPTY_MANIFEST', category: 'caption', message: 'Caption manifest exists but contains no blocks', blocking: false });
  }

  const scores = checks.map((c) => c.score ?? 0);
  const score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  return { score, warnings, failures, recommendations, checks };
}

async function _checkRender(draftId: string): Promise<CategoryResult> {
  const warnings: IntegrityWarning[] = [];
  const failures: IntegrityFailure[] = [];
  const recommendations: IntegrityRecommendation[] = [];
  const checks: CheckEntry[] = [];

  const { data: renderProjects } = await supabase
    .from('doc_studio_render_projects')
    .select('id, status, render_mode, created_at')
    .eq('draft_id', draftId)
    .order('created_at', { ascending: false })
    .limit(1);

  const latestProject = renderProjects?.[0] as {
    id: string; status: string; render_mode: string; created_at: string;
  } | undefined;

  const hasRenderProject = !!latestProject;
  checks.push({
    check_name: 'render_project_exists',
    status: hasRenderProject ? 'pass' : 'warning',
    score: hasRenderProject ? 100 : 30,
    detail: hasRenderProject
      ? `Render project found (status: ${latestProject.status})`
      : 'No render project found for this draft',
    metadata: { has_project: hasRenderProject },
  });

  if (!hasRenderProject) {
    warnings.push({ code: 'RENDER_NO_PROJECT', category: 'render', message: 'No render project created yet for this draft' });
    recommendations.push({ priority: 'low', category: 'render', action: 'Create a render project to prepare for video output' });
    return { score: 30, warnings, failures, recommendations, checks };
  }

  const isCompleted = latestProject.status === 'completed';
  const isFailed = latestProject.status === 'failed';
  checks.push({
    check_name: 'render_project_status',
    status: isCompleted ? 'pass' : isFailed ? 'fail' : 'warning',
    score: isCompleted ? 100 : isFailed ? 0 : 60,
    detail: `Render project status: ${latestProject.status}`,
    metadata: { status: latestProject.status, render_mode: latestProject.render_mode },
  });

  if (isFailed) {
    failures.push({ code: 'RENDER_PROJECT_FAILED', category: 'render', message: 'Most recent render project failed', blocking: false });
    recommendations.push({ priority: 'high', category: 'render', action: 'Investigate render failure and resubmit render job' });
  }

  const scores = checks.map((c) => c.score ?? 0);
  const score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  return { score, warnings, failures, recommendations, checks };
}

async function _checkDrift(draftId: string): Promise<CategoryResult> {
  const warnings: IntegrityWarning[] = [];
  const failures: IntegrityFailure[] = [];
  const recommendations: IntegrityRecommendation[] = [];
  const checks: CheckEntry[] = [];

  const { data: draft } = await supabase
    .from('doc_studio_drafts')
    .select('id, integrity_status, revalidation_required, drift_deepened_at, last_captured_at, updated_at')
    .eq('id', draftId)
    .maybeSingle();

  const revalidationRequired = !!draft?.revalidation_required;
  checks.push({
    check_name: 'revalidation_not_required',
    status: revalidationRequired ? 'warning' : 'pass',
    score: revalidationRequired ? 40 : 100,
    detail: revalidationRequired
      ? 'Draft is flagged as requiring revalidation'
      : 'No pending revalidation flag',
    metadata: { revalidation_required: revalidationRequired },
  });

  if (revalidationRequired) {
    warnings.push({ code: 'DRIFT_REVALIDATION_REQUIRED', category: 'drift', message: 'Draft is flagged for revalidation — content may have drifted from screenshots' });
    recommendations.push({ priority: 'high', category: 'drift', action: 'Run a new integrity check and recapture if drift is confirmed' });
  }

  const hasDrift = !!draft?.drift_deepened_at;
  const capturedAt = draft?.last_captured_at ? new Date(draft.last_captured_at) : null;
  const updatedAt = draft?.updated_at ? new Date(draft.updated_at) : null;
  const daysSinceCapture = capturedAt && updatedAt
    ? Math.floor((updatedAt.getTime() - capturedAt.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  checks.push({
    check_name: 'capture_recency',
    status: daysSinceCapture == null ? 'skipped' : daysSinceCapture <= 7 ? 'pass' : daysSinceCapture <= 30 ? 'warning' : 'fail',
    score: daysSinceCapture == null ? null : daysSinceCapture <= 7 ? 100 : daysSinceCapture <= 30 ? 65 : 20,
    detail: daysSinceCapture == null
      ? 'Cannot determine capture recency'
      : `Last capture was ${daysSinceCapture} day(s) ago`,
    metadata: { days_since_capture: daysSinceCapture },
  });

  if (daysSinceCapture != null && daysSinceCapture > 30) {
    warnings.push({
      code: 'DRIFT_STALE_CAPTURE',
      category: 'drift',
      message: `Capture is ${daysSinceCapture} days old — UI may have changed since last capture`,
    });
  }

  checks.push({
    check_name: 'no_active_drift_deepening',
    status: hasDrift ? 'warning' : 'pass',
    score: hasDrift ? 50 : 100,
    detail: hasDrift ? `Drift deepened at ${draft?.drift_deepened_at}` : 'No active drift deepening',
    metadata: { has_drift: hasDrift },
  });

  const validScores = checks.map((c) => c.score).filter((s): s is number => s !== null);
  const score = validScores.length > 0
    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    : 100;

  return { score, warnings, failures, recommendations, checks };
}

// ─── Audit Helpers ────────────────────────────────────────────────────────────

async function _persistValidationHistory(
  draftId: string,
  reportId: string,
  category: IntegrityCategory,
  checks: CheckEntry[],
): Promise<void> {
  if (!checks.length) return;
  const rows = checks.map((c) => ({
    draft_id: draftId,
    report_id: reportId,
    category,
    check_name: c.check_name,
    status: c.status,
    score: c.score,
    detail: c.detail,
    metadata_json: c.metadata,
  }));
  const { error: histErr } = await supabase.from('doc_studio_validation_history').insert(rows);
  if (histErr) logger.error('Failed to persist validation history:', histErr);
}

async function logRevalidationEvent(
  draftId: string,
  eventType: RevalidationEventType,
  triggeredBy: string | null,
  detail: Record<string, unknown>,
): Promise<void> {
  const { error: eventErr } = await supabase.from('doc_studio_revalidation_events').insert({
    draft_id: draftId,
    event_type: eventType,
    triggered_by: triggeredBy,
    detail_json: detail,
    outcome: 'pending',
  });
  if (eventErr) logger.error('Failed to log revalidation event:', eventErr);
}

// ─── Main Engine Entry Point ──────────────────────────────────────────────────

export async function fetchLatestIntegrityReport(
  draftId: string,
): Promise<TutorialIntegrityReport | null> {
  const { data, error } = await supabase
    .from('doc_studio_integrity_reports')
    .select('*')
    .eq('draft_id', draftId)
    .order('last_checked_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as TutorialIntegrityReport | null) ?? null;
}

export async function fetchIntegrityReports(
  draftId: string,
  limit = 10,
): Promise<TutorialIntegrityReport[]> {
  const { data, error } = await supabase
    .from('doc_studio_integrity_reports')
    .select('*')
    .eq('draft_id', draftId)
    .order('last_checked_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TutorialIntegrityReport[];
}

export async function fetchRevalidationEvents(
  draftId: string,
  limit = 20,
) {
  const { data, error } = await supabase
    .from('doc_studio_revalidation_events')
    .select('*')
    .eq('draft_id', draftId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function markDraftRevalidationRequired(
  draftId: string,
  reason: string,
  triggeredBy: string | null = null,
): Promise<void> {
  await Promise.all([
    supabase
      .from('doc_studio_drafts')
      .update({ revalidation_required: true })
      .eq('id', draftId),
    logRevalidationEvent(draftId, 'revalidation_requested', triggeredBy, { reason }),
  ]);
}
