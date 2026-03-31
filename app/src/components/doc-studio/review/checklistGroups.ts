import type {
  ChecklistCategory,
  ChecklistGroup,
  ChecklistResult,
  ChecklistTemplate,
} from '../../../types/doc-studio-review.ts';

const CATEGORY_ORDER: readonly ChecklistCategory[] = ['content', 'narration', 'visual', 'output'];

export function buildChecklistGroups(
  templates: ChecklistTemplate[],
  results: ChecklistResult[],
): ChecklistGroup[] {
  const resultByItemId = new Map(results.map((r) => [r.checklist_item_id, r]));
  const byCategory = new Map<ChecklistCategory, ChecklistTemplate[]>();

  for (const template of templates) {
    const list = byCategory.get(template.category) ?? [];
    list.push(template);
    byCategory.set(template.category, list);
  }

  const groups: ChecklistGroup[] = [];
  for (const [category, catTemplates] of byCategory) {
    const sorted = [...catTemplates].sort((a, b) => a.sort_order - b.sort_order);
    const items = sorted.map((template) => ({
      template,
      result: resultByItemId.get(template.id) ?? null,
    }));
    const required = items.filter((item) => item.template.is_required);

    groups.push({
      category,
      items,
      passCount: required.filter((item) => item.result?.passed === true).length,
      totalRequired: required.length,
    });
  }

  return groups.sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  );
}
