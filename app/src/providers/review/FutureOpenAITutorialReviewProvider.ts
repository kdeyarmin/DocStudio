import { supabase } from '../../lib/supabase';
import type { TutorialReviewProvider } from './TutorialReviewProvider';
import type {
  SceneReviewPayload,
  SceneReviewResult,
  ShotPlanReviewPayload,
  ShotPlanReviewResult,
  NarrationReviewPayload,
  NarrationReviewResult,
  CaptionReviewPayload,
  CaptionReviewResult,
  ApprovalReadinessPayload,
  ApprovalReadinessResult,
  ReviewContext,
  ReviewIssue,
  ReviewSuggestion,
  SceneReviewDimension,
  ShotPlanReviewEntry,
  NarrationSegmentReview,
  CaptionBlockReview,
  ApprovalBlocker,
  ApprovalDimension,
  ReviewVerdict,
  ConfidenceLevel,
} from './TutorialReviewProvider';
import type { DocumentationScene, DocumentationNarrationSegment, DocumentationShotPlan, CaptionBlock } from '../../types/documentation';

const PROXY_FN = 'claude-api-proxy';
const DEFAULT_TEMPERATURE = 0.3;
const REVIEW_MAX_TOKENS = 4096;

// ─── AI Caller ────────────────────────────────────────────────────────────────

interface RawAIResponse {
  text: string;
  provider: string;
  model: string;
}

async function callAI(
  organizationId: string,
  prompt: string,
  systemInstruction: string,
  temperature = DEFAULT_TEMPERATURE,
): Promise<RawAIResponse> {
  const { data, error } = await supabase.functions.invoke<RawAIResponse>(PROXY_FN, {
    body: {
      prompt,
      systemInstruction,
      temperature,
      maxTokens: REVIEW_MAX_TOKENS,
      organizationId,
    },
  });

  if (error) throw new Error(error.message ?? 'AI review request failed');
  if (!data?.text) throw new Error('Empty response from AI review service');
  return data;
}

// ─── JSON Extraction ──────────────────────────────────────────────────────────

function extractJSON(text: string): unknown {
  const normalized = text
    .replace(/^\uFEFF/, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  const candidates = [
    normalized.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim(),
    (() => {
      const objectStart = normalized.indexOf('{');
      const objectEnd = normalized.lastIndexOf('}');
      if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
        return normalized.slice(objectStart, objectEnd + 1).trim();
      }
      return null;
    })(),
    (() => {
      const arrayStart = normalized.indexOf('[');
      const arrayEnd = normalized.lastIndexOf(']');
      if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
        return normalized.slice(arrayStart, arrayEnd + 1).trim();
      }
      return null;
    })(),
    normalized.trim(),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`Unable to extract valid JSON from AI review response. ${errors.join(' | ')}`);
}

function safeNum(val: unknown, fallback = 0): number {
  const n = Number(val);
  return isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
}

function safeStr(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val : fallback;
}

function safeArr<T>(val: unknown): T[] {
  return Array.isArray(val) ? (val as T[]) : [];
}

function safeVerdict(val: unknown): ReviewVerdict {
  const valid: ReviewVerdict[] = ['approved', 'needs_minor_changes', 'needs_major_changes', 'blocked'];
  return valid.includes(val as ReviewVerdict) ? (val as ReviewVerdict) : 'needs_minor_changes';
}

function safeConfidence(val: unknown): ConfidenceLevel {
  const valid: ConfidenceLevel[] = ['low', 'medium', 'high'];
  return valid.includes(val as ConfidenceLevel) ? (val as ConfidenceLevel) : 'medium';
}

function coerceIssues(arr: unknown[]): ReviewIssue[] {
  return arr.map((item) => {
    const i = item as Record<string, unknown>;
    const sev = ['info', 'warning', 'critical'].includes(i['severity'] as string)
      ? (i['severity'] as ReviewIssue['severity'])
      : 'warning';
    return {
      code: safeStr(i['code'], 'UNKNOWN'),
      severity: sev,
      field: i['field'] ? safeStr(i['field']) : undefined,
      message: safeStr(i['message'], 'No message provided'),
      suggestion: i['suggestion'] ? safeStr(i['suggestion']) : undefined,
    };
  });
}

function coerceSuggestions(arr: unknown[]): ReviewSuggestion[] {
  const validTypes: ReviewSuggestion['type'][] = ['rewrite', 'trim', 'expand', 'restructure', 'replace', 'annotate'];
  return arr.map((item) => {
    const s = item as Record<string, unknown>;
    const type = validTypes.includes(s['type'] as ReviewSuggestion['type'])
      ? (s['type'] as ReviewSuggestion['type'])
      : 'rewrite';
    return {
      type,
      target: safeStr(s['target'], 'unspecified'),
      recommendation: safeStr(s['recommendation'], ''),
      example: s['example'] ? safeStr(s['example']) : undefined,
    };
  });
}

// ─── Context Serializer ───────────────────────────────────────────────────────

function serializeContext(ctx: ReviewContext): string {
  return [
    `Draft ID: ${ctx.draftId}`,
    `Title: "${ctx.draftTitle}"`,
    `Target Role: ${ctx.targetRole || 'general user'}`,
    `Output Type: ${ctx.outputType}`,
    `Total Scenes: ${ctx.totalSceneCount}`,
  ].join('\n');
}

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(reviewType: string): string {
  return `You are an expert instructional-design reviewer and technical documentation evaluator for a healthcare EMR software platform. Your job is to perform a rigorous ${reviewType} review of tutorial content.

CRITICAL RULES:
1. Respond ONLY with a single valid JSON object. No prose before or after.
2. Follow the exact schema provided in the user prompt.
3. Scores must be integers from 0-100.
4. Issues must reference specific, actionable problems.
5. Be honest and critical — prioritize quality over positivity.
6. Use 'critical' severity sparingly (only for blockers), 'warning' for significant issues, 'info' for suggestions.`;
}

// ─── Scene Serializer ─────────────────────────────────────────────────────────

function serializeScene(scene: DocumentationScene, index: number): string {
  const lines: string[] = [
    `--- Scene ${index + 1} ---`,
    `ID: ${scene.id}`,
    `Title: "${scene.title}"`,
    `Summary: ${scene.summary ?? '(none)'}`,
    `Quality Status: ${scene.quality_status ?? 'unknown'}`,
  ];

  if (scene.steps && scene.steps.length > 0) {
    lines.push(`Steps (${scene.steps.length}):`);
    scene.steps.slice(0, 10).forEach((s, i) => {
      lines.push(`  Step ${i + 1}: [${s.action}] ${s.title}${s.description ? ` — ${s.description}` : ''}`);
    });
    if (scene.steps.length > 10) lines.push(`  ... and ${scene.steps.length - 10} more steps`);
  }

  if (scene.narration_segments && scene.narration_segments.length > 0) {
    const totalWords = scene.narration_segments.reduce((acc, seg) => {
      return acc + (seg.narration_text?.split(/\s+/).length ?? 0);
    }, 0);
    lines.push(`Narration Segments: ${scene.narration_segments.length} (approx. ${totalWords} words)`);
  }

  return lines.join('\n');
}

function serializeShot(shot: DocumentationShotPlan, index: number): string {
  const lines: string[] = [
    `Shot ${index + 1}: "${shot.shot_title ?? 'Untitled'}"`,
    `  ID: ${shot.id}`,
    `  Type: ${shot.shot_type ?? 'unknown'} | Purpose: ${shot.purpose ?? 'unknown'}`,
    `  Source: ${shot.source_type ?? 'unknown'} | Camera: ${shot.camera_mode ?? 'default'}`,
    `  Crop: ${shot.crop_mode ?? 'none'} | Emphasis: ${shot.emphasis_level ?? 'standard'}`,
    `  Pacing: ${shot.pacing_mode ?? 'normal'} | Transition In: ${shot.transition_in ?? 'cut'} | Out: ${shot.transition_out ?? 'cut'}`,
  ];
  if (shot.callout_title) lines.push(`  Callout: "${shot.callout_title}" — ${shot.callout_description ?? ''}`);
  if (shot.duration_seconds) lines.push(`  Duration: ${shot.duration_seconds}s`);
  return lines.join('\n');
}

function serializeSegment(seg: DocumentationNarrationSegment, index: number): string {
  const wordCount = seg.narration_text?.split(/\s+/).filter(Boolean).length ?? 0;
  const estDur = (wordCount / 150 * 60).toFixed(1);
  return [
    `Segment ${index + 1} (ID: ${seg.id})`,
    `  Scene ID: ${seg.scene_id ?? 'none'}`,
    `  Style: ${seg.style ?? 'standard'}`,
    `  Target Duration: ${seg.target_duration_seconds ?? 'none'}s`,
    `  Word Count: ${wordCount} (~${estDur}s at 150wpm)`,
    `  Status: ${seg.status ?? 'unknown'}`,
    `  Text: "${seg.narration_text?.slice(0, 300) ?? ''}${(seg.narration_text?.length ?? 0) > 300 ? '...' : ''}"`,
    seg.caption_text ? `  Caption: "${seg.caption_text.slice(0, 100)}"` : '',
  ].filter(Boolean).join('\n');
}

function serializeCaptionBlock(block: CaptionBlock, index: number): string {
  const start = block.start_time_seconds ?? 0;
  const end = block.end_time_seconds ?? start;
  const dur = (end - start).toFixed(2);
  const wordCount = block.text?.split(/\s+/).filter(Boolean).length ?? 0;
  return `Block ${index + 1}: [${start.toFixed(2)}s → ${end.toFixed(2)}s] (${dur}s, ${wordCount} words) "${block.text ?? ''}"`;
}

// ─── Schema Descriptors ───────────────────────────────────────────────────────

const SCENE_REVIEW_SCHEMA = `
{
  "scene_id": "string",
  "overall_score": 0-100,
  "verdict": "approved|needs_minor_changes|needs_major_changes|blocked",
  "dimensions": [
    { "name": "string", "score": 0-100, "rationale": "string" }
  ],
  "issues": [
    { "code": "string", "severity": "info|warning|critical", "field": "string|null", "message": "string", "suggestion": "string|null" }
  ],
  "suggestions": [
    { "type": "rewrite|trim|expand|restructure|replace|annotate", "target": "string", "recommendation": "string", "example": "string|null" }
  ],
  "title_assessment": "string",
  "summary_assessment": "string",
  "flow_assessment": "string",
  "confidence": "low|medium|high"
}`;

const SHOT_PLAN_REVIEW_SCHEMA = `
{
  "scene_id": "string|null",
  "overall_coverage_score": 0-100,
  "narration_sync_score": 0-100,
  "shot_sequence_verdict": "approved|needs_minor_changes|needs_major_changes|blocked",
  "shots": [
    {
      "shot_id": "string",
      "shot_title": "string",
      "framing_quality_score": 0-100,
      "timing_alignment_score": 0-100,
      "callout_effectiveness_score": 0-100,
      "purpose_clarity": "string",
      "issues": [{ "code": "string", "severity": "info|warning|critical", "field": "string|null", "message": "string", "suggestion": "string|null" }],
      "recommendations": ["string"]
    }
  ],
  "missing_coverage_areas": ["string"],
  "redundant_shots": ["string"],
  "sequence_flow_notes": "string",
  "issues": [{ "code": "string", "severity": "info|warning|critical", "field": "string|null", "message": "string", "suggestion": "string|null" }],
  "confidence": "low|medium|high"
}`;

const NARRATION_REVIEW_SCHEMA = `
{
  "overall_clarity_score": 0-100,
  "overall_pacing_score": 0-100,
  "overall_tone_consistency_score": 0-100,
  "total_estimated_duration_seconds": number,
  "target_duration_seconds": number|null,
  "duration_delta_seconds": number|null,
  "verdict": "approved|needs_minor_changes|needs_major_changes|blocked",
  "segments": [
    {
      "segment_id": "string",
      "scene_id": "string|null",
      "clarity_score": 0-100,
      "pacing_score": 0-100,
      "tone_consistency_score": 0-100,
      "word_count": number,
      "estimated_duration_seconds": number,
      "issues": [{ "code": "string", "severity": "info|warning|critical", "field": "string|null", "message": "string", "suggestion": "string|null" }],
      "corrections": [{ "original": "string", "corrected": "string", "reason": "string" }],
      "rewrite_suggestion": "string|null"
    }
  ],
  "global_issues": [{ "code": "string", "severity": "info|warning|critical", "field": "string|null", "message": "string", "suggestion": "string|null" }],
  "style_consistency_notes": "string",
  "pacing_notes": "string",
  "role_alignment_notes": "string",
  "confidence": "low|medium|high"
}`;

const CAPTION_REVIEW_SCHEMA = `
{
  "overall_quality_score": 0-100,
  "synchronization_score": 0-100,
  "readability_score": 0-100,
  "coverage_score": 0-100,
  "verdict": "approved|needs_minor_changes|needs_major_changes|blocked",
  "block_reviews": [
    {
      "block_index": number,
      "text_quality_score": 0-100,
      "timing_quality_score": 0-100,
      "issues": [{ "code": "string", "severity": "info|warning|critical", "field": "string|null", "message": "string", "suggestion": "string|null" }],
      "corrected_text": "string|null"
    }
  ],
  "global_issues": [{ "code": "string", "severity": "info|warning|critical", "field": "string|null", "message": "string", "suggestion": "string|null" }],
  "gap_count": number,
  "overlap_count": number,
  "average_block_duration_seconds": number,
  "line_length_assessment": "string",
  "synchronization_notes": "string",
  "confidence": "low|medium|high"
}`;

const APPROVAL_READINESS_SCHEMA = `
{
  "overall_readiness_score": 0-100,
  "verdict": "approved|conditionally_approved|needs_work|blocked",
  "confidence": "low|medium|high",
  "dimensions": [
    { "name": "string", "score": 0-100, "status": "pass|warn|fail", "notes": "string" }
  ],
  "hard_blockers": [
    { "code": "string", "category": "string", "description": "string", "severity": "hard", "resolution_hint": "string" }
  ],
  "soft_blockers": [
    { "code": "string", "category": "string", "description": "string", "severity": "soft", "resolution_hint": "string" }
  ],
  "approval_summary": "string",
  "reviewer_guidance": "string",
  "estimated_revision_effort": "none|minor|moderate|major|rebuild",
  "top_recommendations": ["string"]
}`;

// ─── Prompt Builders ──────────────────────────────────────────────────────────

function buildSceneReviewPrompt(payload: SceneReviewPayload): string {
  const { context, scene, sceneIndex, previousSceneSummary, nextSceneSummary } = payload;
  const dimensions = [
    'title_clarity (0-100): Is the title specific and descriptive?',
    'summary_quality (0-100): Does the summary accurately capture scene content?',
    'step_progression (0-100): Are steps logical, complete, and well-ordered?',
    'narration_alignment (0-100): Does narration match step actions?',
    'learning_objective_clarity (0-100): Is the learning goal obvious?',
  ];

  return `Review the following tutorial scene and provide structured feedback.

TUTORIAL CONTEXT:
${serializeContext(context)}

SCENE TO REVIEW (index ${sceneIndex}):
${serializeScene(scene, sceneIndex)}

${previousSceneSummary ? `PREVIOUS SCENE SUMMARY:\n${previousSceneSummary}\n` : ''}
${nextSceneSummary ? `NEXT SCENE SUMMARY:\n${nextSceneSummary}\n` : ''}

EVALUATION DIMENSIONS (score each 0-100):
${dimensions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

OUTPUT JSON SCHEMA:
${SCENE_REVIEW_SCHEMA}

Evaluate all dimensions. Identify all issues with specific codes (e.g., TITLE_TOO_VAGUE, MISSING_STEP_CONTEXT, NARRATION_MISMATCH). Provide actionable suggestions. Return ONLY the JSON object.`;
}

function buildShotPlanReviewPrompt(payload: ShotPlanReviewPayload): string {
  const { context, scene, shots, narrationSegments } = payload;
  const shotLines = shots.map((s, i) => serializeShot(s, i)).join('\n');
  const segmentLines = (narrationSegments ?? []).map((s, i) => serializeSegment(s, i)).join('\n');

  return `Review the shot plan for the following tutorial scene.

TUTORIAL CONTEXT:
${serializeContext(context)}

SCENE:
${serializeScene(scene, 0)}

SHOT PLAN (${shots.length} shots):
${shotLines || '(no shots defined)'}

${segmentLines ? `NARRATION SEGMENTS:\n${segmentLines}\n` : ''}

Evaluate:
- Coverage: Does the shot sequence fully cover scene steps?
- Narration sync: Do shot durations align with narration timing?
- Shot variety: Is there appropriate visual variety?
- Callout effectiveness: Are callouts clear and well-placed?
- Redundancy: Are any shots unnecessary duplicates?

OUTPUT JSON SCHEMA:
${SHOT_PLAN_REVIEW_SCHEMA}

For each shot provide framing_quality_score, timing_alignment_score, callout_effectiveness_score. Return ONLY the JSON object.`;
}

function buildNarrationReviewPrompt(payload: NarrationReviewPayload): string {
  const { context, segments, sceneContext, targetDurationSeconds } = payload;
  const segmentLines = segments.map((s, i) => serializeSegment(s, i)).join('\n\n');
  const sceneContextLines = (sceneContext ?? [])
    .map((sc) => `  Scene "${sc.scene_title}": ${sc.scene_summary ?? '(no summary)'}`)
    .join('\n');

  const totalWords = segments.reduce((acc, s) => acc + (s.narration_text?.split(/\s+/).filter(Boolean).length ?? 0), 0);
  const estimatedDuration = (totalWords / 150 * 60).toFixed(1);

  return `Review the narration script for a tutorial with ${segments.length} segments.

TUTORIAL CONTEXT:
${serializeContext(context)}

${sceneContextLines ? `SCENE CONTEXT:\n${sceneContextLines}\n` : ''}
${targetDurationSeconds ? `TARGET DURATION: ${targetDurationSeconds}s\n` : ''}
ESTIMATED ACTUAL DURATION: ${estimatedDuration}s (at 150 wpm)
TOTAL WORD COUNT: ${totalWords}

NARRATION SEGMENTS:
${segmentLines || '(no segments)'}

Evaluate each segment for:
- Clarity: Is the language clear and accessible to the target role?
- Pacing: Is the word count appropriate for the target duration?
- Tone consistency: Is the voice consistent across segments?
- Grammar/accuracy: Are there errors or awkward phrasings to correct?
- Role alignment: Does content match the target role's knowledge level?

For corrections, provide the original phrase and corrected version.

OUTPUT JSON SCHEMA:
${NARRATION_REVIEW_SCHEMA}

Return ONLY the JSON object.`;
}

function buildCaptionReviewPrompt(payload: CaptionReviewPayload): string {
  const { context, captionBlocks, narrationSegments, totalDurationSeconds } = payload;
  const blockLines = captionBlocks.map((b, i) => serializeCaptionBlock(b, i)).join('\n');

  let gapCount = 0;
  let overlapCount = 0;
  for (let i = 1; i < captionBlocks.length; i++) {
    const prev = captionBlocks[i - 1];
    const curr = captionBlocks[i];
    const gap = (curr.start_time_seconds ?? 0) - (prev.end_time_seconds ?? 0);
    if (gap > 1.5) gapCount++;
    if (gap < 0) overlapCount++;
  }

  const avgDur = captionBlocks.length > 0
    ? (captionBlocks.reduce((acc, b) => acc + ((b.end_time_seconds ?? (b.start_time_seconds ?? 0)) - (b.start_time_seconds ?? 0)), 0) / captionBlocks.length).toFixed(2)
    : '0';

  return `Review the caption blocks for a tutorial.

TUTORIAL CONTEXT:
${serializeContext(context)}

TOTAL DURATION: ${totalDurationSeconds ?? 'unknown'}s
CAPTION BLOCKS: ${captionBlocks.length} total
PRE-COMPUTED: gaps > 1.5s = ${gapCount}, overlaps = ${overlapCount}, avg block duration = ${avgDur}s

${(narrationSegments ?? []).length > 0 ? `NARRATION SEGMENTS (for sync reference):\n${narrationSegments!.slice(0, 5).map((s, i) => serializeSegment(s, i)).join('\n')}\n` : ''}

CAPTION BLOCKS:
${blockLines || '(no caption blocks)'}

Evaluate:
- Text quality: Is the caption text readable, properly punctuated, not truncated?
- Timing quality: Are start/end times appropriate for reading speed?
- Synchronization: Do captions align with narration?
- Coverage: Is narration adequately covered?
- Line length: Are lines too long (>42 chars) or too short (<10 chars)?

OUTPUT JSON SCHEMA:
${CAPTION_REVIEW_SCHEMA}

Return ONLY the JSON object.`;
}

function buildApprovalReadinessPrompt(payload: ApprovalReadinessPayload): string {
  const {
    context, draft, integrityReport, checklistGroups,
    openChangeRequestCount, openCommentCount,
    sceneReviews, narrationReview, captionReview,
  } = payload;

  const lines: string[] = [
    'Evaluate the overall approval readiness of this tutorial draft.',
    '',
    'TUTORIAL CONTEXT:',
    serializeContext(context),
    '',
    'DRAFT STATUS:',
    `  Integrity Status: ${draft.integrity_status ?? 'unknown'}`,
    `  Integrity Score: ${draft.integrity_score ?? 'N/A'}`,
    `  Open Change Requests: ${openChangeRequestCount}`,
    `  Open Comments: ${openCommentCount}`,
    `  Generated Content: ${draft.generated_content ? 'present' : 'missing'}`,
  ];

  if (integrityReport) {
    lines.push('', 'INTEGRITY REPORT SUMMARY:');
    const cats = [
      ['content_score', 'Content'],
      ['narration_score', 'Narration'],
      ['timing_score', 'Timing'],
      ['captions_score', 'Captions'],
      ['shot_plans_score', 'Shot Plans'],
      ['workflow_score', 'Workflow'],
      ['assets_score', 'Assets'],
      ['metadata_score', 'Metadata'],
      ['overall_score', 'Overall'],
    ] as const;
    cats.forEach(([key, label]) => {
      const val = (integrityReport as unknown as Record<string, unknown>)[key];
      if (val != null) lines.push(`  ${label}: ${val}`);
    });
    if (integrityReport.failures_json?.length) {
      lines.push(`  Failures: ${integrityReport.failures_json.length}`);
    }
    if (integrityReport.warnings_json?.length) {
      lines.push(`  Warnings: ${integrityReport.warnings_json.length}`);
    }
  }

  if (checklistGroups && checklistGroups.length > 0) {
    lines.push('', 'REVIEW CHECKLIST SUMMARY:');
    checklistGroups.forEach((g) => {
      lines.push(`  ${g.category}: ${g.passCount ?? 0}/${g.totalRequired ?? 0} passed`);
    });
  }

  if (sceneReviews && sceneReviews.length > 0) {
    const avgScore = Math.round(sceneReviews.reduce((acc, r) => acc + r.overall_score, 0) / sceneReviews.length);
    const blocked = sceneReviews.filter((r) => r.verdict === 'blocked').length;
    lines.push('', `SCENE REVIEWS: ${sceneReviews.length} reviewed, avg score ${avgScore}, ${blocked} blocked`);
  }

  if (narrationReview) {
    lines.push('', `NARRATION REVIEW: clarity=${narrationReview.overall_clarity_score}, pacing=${narrationReview.overall_pacing_score}, verdict=${narrationReview.verdict}`);
  }

  if (captionReview) {
    lines.push('', `CAPTION REVIEW: quality=${captionReview.overall_quality_score}, sync=${captionReview.synchronization_score}, verdict=${captionReview.verdict}`);
  }

  lines.push(
    '',
    'EVALUATION DIMENSIONS:',
    '  1. content_completeness: Are all scenes, steps, and content fully developed?',
    '  2. narration_quality: Is narration clear, well-paced, and role-appropriate?',
    '  3. visual_coverage: Do shots adequately cover all workflow steps?',
    '  4. technical_integrity: Are there integrity failures or broken references?',
    '  5. review_readiness: Are open comments/CRs resolved?',
    '  6. production_readiness: Is the draft ready for final rendering?',
    '',
    'Hard blockers = critical issues preventing approval.',
    'Soft blockers = issues that should be addressed but do not prevent conditional approval.',
    '',
    'OUTPUT JSON SCHEMA:',
    APPROVAL_READINESS_SCHEMA,
    '',
    'Return ONLY the JSON object.',
  );

  return lines.join('\n');
}

// ─── Output Parsers ───────────────────────────────────────────────────────────

function parseSceneReview(raw: RawAIResponse, sceneId: string): SceneReviewResult {
  try {
    const parsed = extractJSON(raw.text) as Record<string, unknown>;
    return {
      scene_id: safeStr(parsed['scene_id'], sceneId),
      overall_score: safeNum(parsed['overall_score'], 50),
      verdict: safeVerdict(parsed['verdict']),
      dimensions: safeArr<Record<string, unknown>>(parsed['dimensions']).map((d): SceneReviewDimension => ({
        name: safeStr(d['name'], 'unknown'),
        score: safeNum(d['score'], 50),
        rationale: safeStr(d['rationale'], ''),
      })),
      issues: coerceIssues(safeArr(parsed['issues'])),
      suggestions: coerceSuggestions(safeArr(parsed['suggestions'])),
      title_assessment: safeStr(parsed['title_assessment'], ''),
      summary_assessment: safeStr(parsed['summary_assessment'], ''),
      flow_assessment: safeStr(parsed['flow_assessment'], ''),
      confidence: safeConfidence(parsed['confidence']),
      model: raw.model,
    };
  } catch {
    return {
      scene_id: sceneId,
      overall_score: 0,
      verdict: 'needs_major_changes',
      dimensions: [],
      issues: [{ code: 'PARSE_ERROR', severity: 'critical', message: 'AI response could not be parsed' }],
      suggestions: [],
      title_assessment: 'Review failed',
      summary_assessment: 'Review failed',
      flow_assessment: 'Review failed',
      confidence: 'low',
      model: raw.model,
    };
  }
}

function parseShotPlanReview(raw: RawAIResponse, sceneId: string | null): ShotPlanReviewResult {
  try {
    const parsed = extractJSON(raw.text) as Record<string, unknown>;
    return {
      scene_id: parsed['scene_id'] != null ? safeStr(parsed['scene_id']) : sceneId,
      overall_coverage_score: safeNum(parsed['overall_coverage_score'], 50),
      narration_sync_score: safeNum(parsed['narration_sync_score'], 50),
      shot_sequence_verdict: safeVerdict(parsed['shot_sequence_verdict']),
      shots: safeArr<Record<string, unknown>>(parsed['shots']).map((s): ShotPlanReviewEntry => ({
        shot_id: safeStr(s['shot_id'], 'unknown'),
        shot_title: safeStr(s['shot_title'], 'Untitled'),
        framing_quality_score: safeNum(s['framing_quality_score'], 50),
        timing_alignment_score: safeNum(s['timing_alignment_score'], 50),
        callout_effectiveness_score: safeNum(s['callout_effectiveness_score'], 50),
        purpose_clarity: safeStr(s['purpose_clarity'], ''),
        issues: coerceIssues(safeArr(s['issues'])),
        recommendations: safeArr<string>(s['recommendations']).map((r) => safeStr(r)),
      })),
      missing_coverage_areas: safeArr<string>(parsed['missing_coverage_areas']).map((v) => safeStr(v)),
      redundant_shots: safeArr<string>(parsed['redundant_shots']).map((v) => safeStr(v)),
      sequence_flow_notes: safeStr(parsed['sequence_flow_notes'], ''),
      issues: coerceIssues(safeArr(parsed['issues'])),
      confidence: safeConfidence(parsed['confidence']),
      model: raw.model,
    };
  } catch {
    return {
      scene_id: sceneId,
      overall_coverage_score: 0,
      narration_sync_score: 0,
      shot_sequence_verdict: 'needs_major_changes',
      shots: [],
      missing_coverage_areas: [],
      redundant_shots: [],
      sequence_flow_notes: 'Review failed',
      issues: [{ code: 'PARSE_ERROR', severity: 'critical', message: 'AI response could not be parsed' }],
      confidence: 'low',
      model: raw.model,
    };
  }
}

function parseNarrationReview(raw: RawAIResponse): NarrationReviewResult {
  try {
    const parsed = extractJSON(raw.text) as Record<string, unknown>;
    return {
      overall_clarity_score: safeNum(parsed['overall_clarity_score'], 50),
      overall_pacing_score: safeNum(parsed['overall_pacing_score'], 50),
      overall_tone_consistency_score: safeNum(parsed['overall_tone_consistency_score'], 50),
      total_estimated_duration_seconds: safeNum(parsed['total_estimated_duration_seconds'], 0),
      target_duration_seconds: parsed['target_duration_seconds'] != null ? Number(parsed['target_duration_seconds']) : null,
      duration_delta_seconds: parsed['duration_delta_seconds'] != null ? Number(parsed['duration_delta_seconds']) : null,
      verdict: safeVerdict(parsed['verdict']),
      segments: safeArr<Record<string, unknown>>(parsed['segments']).map((s): NarrationSegmentReview => ({
        segment_id: safeStr(s['segment_id'], 'unknown'),
        scene_id: s['scene_id'] ? safeStr(s['scene_id']) : null,
        clarity_score: safeNum(s['clarity_score'], 50),
        pacing_score: safeNum(s['pacing_score'], 50),
        tone_consistency_score: safeNum(s['tone_consistency_score'], 50),
        word_count: safeNum(s['word_count'], 0),
        estimated_duration_seconds: safeNum(s['estimated_duration_seconds'], 0),
        issues: coerceIssues(safeArr(s['issues'])),
        corrections: safeArr<Record<string, unknown>>(s['corrections']).map((c) => ({
          original: safeStr(c['original'], ''),
          corrected: safeStr(c['corrected'], ''),
          reason: safeStr(c['reason'], ''),
        })),
        rewrite_suggestion: s['rewrite_suggestion'] ? safeStr(s['rewrite_suggestion']) : undefined,
      })),
      global_issues: coerceIssues(safeArr(parsed['global_issues'])),
      style_consistency_notes: safeStr(parsed['style_consistency_notes'], ''),
      pacing_notes: safeStr(parsed['pacing_notes'], ''),
      role_alignment_notes: safeStr(parsed['role_alignment_notes'], ''),
      confidence: safeConfidence(parsed['confidence']),
      model: raw.model,
    };
  } catch {
    return {
      overall_clarity_score: 0,
      overall_pacing_score: 0,
      overall_tone_consistency_score: 0,
      total_estimated_duration_seconds: 0,
      target_duration_seconds: null,
      duration_delta_seconds: null,
      verdict: 'needs_major_changes',
      segments: [],
      global_issues: [{ code: 'PARSE_ERROR', severity: 'critical', message: 'AI response could not be parsed' }],
      style_consistency_notes: 'Review failed',
      pacing_notes: 'Review failed',
      role_alignment_notes: 'Review failed',
      confidence: 'low',
      model: raw.model,
    };
  }
}

function parseCaptionReview(raw: RawAIResponse): CaptionReviewResult {
  try {
    const parsed = extractJSON(raw.text) as Record<string, unknown>;
    return {
      overall_quality_score: safeNum(parsed['overall_quality_score'], 50),
      synchronization_score: safeNum(parsed['synchronization_score'], 50),
      readability_score: safeNum(parsed['readability_score'], 50),
      coverage_score: safeNum(parsed['coverage_score'], 50),
      verdict: safeVerdict(parsed['verdict']),
      block_reviews: safeArr<Record<string, unknown>>(parsed['block_reviews']).map((b): CaptionBlockReview => ({
        block_index: safeNum(b['block_index'], 0),
        text_quality_score: safeNum(b['text_quality_score'], 50),
        timing_quality_score: safeNum(b['timing_quality_score'], 50),
        issues: coerceIssues(safeArr(b['issues'])),
        corrected_text: b['corrected_text'] ? safeStr(b['corrected_text']) : undefined,
      })),
      global_issues: coerceIssues(safeArr(parsed['global_issues'])),
      gap_count: safeNum(parsed['gap_count'], 0),
      overlap_count: safeNum(parsed['overlap_count'], 0),
      average_block_duration_seconds: Number((parsed['average_block_duration_seconds'] ?? 0)),
      line_length_assessment: safeStr(parsed['line_length_assessment'], ''),
      synchronization_notes: safeStr(parsed['synchronization_notes'], ''),
      confidence: safeConfidence(parsed['confidence']),
      model: raw.model,
    };
  } catch {
    return {
      overall_quality_score: 0,
      synchronization_score: 0,
      readability_score: 0,
      coverage_score: 0,
      verdict: 'needs_major_changes',
      block_reviews: [],
      global_issues: [{ code: 'PARSE_ERROR', severity: 'critical', message: 'AI response could not be parsed' }],
      gap_count: 0,
      overlap_count: 0,
      average_block_duration_seconds: 0,
      line_length_assessment: 'Review failed',
      synchronization_notes: 'Review failed',
      confidence: 'low',
      model: raw.model,
    };
  }
}

function parseApprovalReadiness(raw: RawAIResponse): ApprovalReadinessResult {
  try {
    const parsed = extractJSON(raw.text) as Record<string, unknown>;
    const verdictVal = parsed['verdict'];
    const validVerdicts = ['approved', 'conditionally_approved', 'needs_work', 'blocked'];
    const verdict = validVerdicts.includes(verdictVal as string)
      ? (verdictVal as ApprovalReadinessResult['verdict'])
      : 'needs_work';

    const effortVal = parsed['estimated_revision_effort'];
    const validEfforts = ['none', 'minor', 'moderate', 'major', 'rebuild'];
    const effort = validEfforts.includes(effortVal as string)
      ? (effortVal as ApprovalReadinessResult['estimated_revision_effort'])
      : 'moderate';

    return {
      overall_readiness_score: safeNum(parsed['overall_readiness_score'], 50),
      verdict,
      confidence: safeConfidence(parsed['confidence']),
      dimensions: safeArr<Record<string, unknown>>(parsed['dimensions']).map((d): ApprovalDimension => {
        const status = ['pass', 'warn', 'fail'].includes(d['status'] as string)
          ? (d['status'] as ApprovalDimension['status'])
          : 'warn';
        return {
          name: safeStr(d['name'], 'unknown'),
          score: safeNum(d['score'], 50),
          status,
          notes: safeStr(d['notes'], ''),
        };
      }),
      hard_blockers: safeArr<Record<string, unknown>>(parsed['hard_blockers']).map((b): ApprovalBlocker => ({
        code: safeStr(b['code'], 'UNKNOWN'),
        category: safeStr(b['category'], 'general'),
        description: safeStr(b['description'], ''),
        severity: 'hard',
        resolution_hint: safeStr(b['resolution_hint'], ''),
      })),
      soft_blockers: safeArr<Record<string, unknown>>(parsed['soft_blockers']).map((b): ApprovalBlocker => ({
        code: safeStr(b['code'], 'UNKNOWN'),
        category: safeStr(b['category'], 'general'),
        description: safeStr(b['description'], ''),
        severity: 'soft',
        resolution_hint: safeStr(b['resolution_hint'], ''),
      })),
      approval_summary: safeStr(parsed['approval_summary'], ''),
      reviewer_guidance: safeStr(parsed['reviewer_guidance'], ''),
      estimated_revision_effort: effort,
      top_recommendations: safeArr<string>(parsed['top_recommendations']).map((r) => safeStr(r)),
      model: raw.model,
    };
  } catch {
    return {
      overall_readiness_score: 0,
      verdict: 'needs_work',
      confidence: 'low',
      dimensions: [],
      hard_blockers: [],
      soft_blockers: [{ code: 'PARSE_ERROR', category: 'system', description: 'AI response could not be parsed', severity: 'soft', resolution_hint: 'Retry the review' }],
      approval_summary: 'Review failed — could not parse AI response.',
      reviewer_guidance: 'Please retry the review.',
      estimated_revision_effort: 'moderate',
      top_recommendations: [],
      model: raw.model,
    };
  }
}

// ─── Provider Implementation ──────────────────────────────────────────────────

export class FutureOpenAITutorialReviewProvider implements TutorialReviewProvider {
  readonly name = 'openai';

  async reviewScene(payload: SceneReviewPayload): Promise<SceneReviewResult> {
    const prompt = buildSceneReviewPrompt(payload);
    const system = buildSystemPrompt('scene-level');
    const raw = await callAI(payload.context.organizationId, prompt, system);
    return parseSceneReview(raw, payload.scene.id);
  }

  async reviewShotPlan(payload: ShotPlanReviewPayload): Promise<ShotPlanReviewResult> {
    const prompt = buildShotPlanReviewPrompt(payload);
    const system = buildSystemPrompt('shot-plan');
    const raw = await callAI(payload.context.organizationId, prompt, system);
    return parseShotPlanReview(raw, payload.scene.id);
  }

  async reviewNarration(payload: NarrationReviewPayload): Promise<NarrationReviewResult> {
    const prompt = buildNarrationReviewPrompt(payload);
    const system = buildSystemPrompt('narration-script');
    const raw = await callAI(payload.context.organizationId, prompt, system);
    return parseNarrationReview(raw);
  }

  async reviewCaptions(payload: CaptionReviewPayload): Promise<CaptionReviewResult> {
    const prompt = buildCaptionReviewPrompt(payload);
    const system = buildSystemPrompt('caption-quality');
    const raw = await callAI(payload.context.organizationId, prompt, system);
    return parseCaptionReview(raw);
  }

  async evaluateApprovalReadiness(payload: ApprovalReadinessPayload): Promise<ApprovalReadinessResult> {
    const prompt = buildApprovalReadinessPrompt(payload);
    const system = buildSystemPrompt('holistic approval-readiness');
    const raw = await callAI(payload.context.organizationId, prompt, system, 0.2);
    return parseApprovalReadiness(raw);
  }
}
