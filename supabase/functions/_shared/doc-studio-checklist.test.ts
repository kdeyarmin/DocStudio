/**
 * Regression tests for Documentation Studio checklist grouping.
 *
 * Run with:
 *   deno test --allow-read --allow-env supabase/functions/_shared/doc-studio-checklist.test.ts
 */
import {
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildChecklistGroups } from '../../../src/components/doc-studio/review/checklistGroups.ts';
import type {
  ChecklistResult,
  ChecklistTemplate,
} from '../../../src/types/doc-studio-review.ts';

function makeTemplate(overrides: Partial<ChecklistTemplate>): ChecklistTemplate {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    item_key: overrides.item_key ?? 'item_key',
    category: overrides.category ?? 'content',
    label: overrides.label ?? 'Checklist item',
    description: overrides.description ?? null,
    sort_order: overrides.sort_order ?? 0,
    is_required: overrides.is_required ?? true,
    is_active: overrides.is_active ?? true,
    created_at: overrides.created_at ?? new Date().toISOString(),
    updated_at: overrides.updated_at ?? new Date().toISOString(),
  };
}

function makeResult(overrides: Partial<ChecklistResult>): ChecklistResult {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    draft_id: overrides.draft_id ?? crypto.randomUUID(),
    organization_id: overrides.organization_id ?? crypto.randomUUID(),
    checklist_item_id: overrides.checklist_item_id ?? crypto.randomUUID(),
    reviewer_id: overrides.reviewer_id ?? null,
    passed: overrides.passed ?? false,
    notes: overrides.notes ?? null,
    checked_at: overrides.checked_at ?? new Date().toISOString(),
    created_at: overrides.created_at ?? new Date().toISOString(),
    updated_at: overrides.updated_at ?? new Date().toISOString(),
  };
}

Deno.test('buildChecklistGroups orders categories and computes required progress from results', () => {
  const visualOptional = makeTemplate({
    id: 'visual-optional',
    category: 'visual',
    label: 'Optional screenshot framing',
    sort_order: 2,
    is_required: false,
  });
  const contentSecond = makeTemplate({
    id: 'content-second',
    category: 'content',
    label: 'Content second',
    sort_order: 2,
    is_required: true,
  });
  const contentFirst = makeTemplate({
    id: 'content-first',
    category: 'content',
    label: 'Content first',
    sort_order: 1,
    is_required: true,
  });
  const narrationRequired = makeTemplate({
    id: 'narration-required',
    category: 'narration',
    label: 'Narration timing',
    sort_order: 1,
    is_required: true,
  });

  const groups = buildChecklistGroups(
    [visualOptional, contentSecond, narrationRequired, contentFirst],
    [
      makeResult({ checklist_item_id: 'content-first', passed: true }),
      makeResult({ checklist_item_id: 'content-second', passed: false }),
      makeResult({ checklist_item_id: 'visual-optional', passed: true }),
    ],
  );

  assertEquals(groups.map((group) => group.category), ['content', 'narration', 'visual']);
  assertEquals(groups[0].items.map((item) => item.template.id), ['content-first', 'content-second']);
  assertEquals(groups[0].passCount, 1);
  assertEquals(groups[0].totalRequired, 2);
  assertEquals(groups[1].passCount, 0);
  assertEquals(groups[1].totalRequired, 1);
  assertEquals(groups[2].passCount, 0);
  assertEquals(groups[2].totalRequired, 0);
});

Deno.test('buildChecklistGroups leaves unmatched results ignored and returns empty groups for no templates', () => {
  const emptyGroups = buildChecklistGroups([], [
    makeResult({ checklist_item_id: 'unknown-item', passed: true }),
  ]);
  assertEquals(emptyGroups, []);
});
