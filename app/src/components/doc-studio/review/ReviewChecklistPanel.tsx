import { CircleCheck as CheckCircle, Circle as XCircle, Circle, ClipboardList } from 'lucide-react';
import type { ChecklistGroup } from '../../../types/doc-studio-review';
import { CHECKLIST_CATEGORY_LABELS } from '../../../types/doc-studio-review';
import { useReviewChecklist, useUpsertChecklistResult } from '../../../hooks/useDocStudioReview';
import { useToast } from '../../../lib/toast';
import { buildChecklistGroups } from './checklistGroups';

interface Props {
  draftId: string;
  organizationId: string;
}

export { buildChecklistGroups };

function ProgressBar({ pass, total }: { pass: number; total: number }) {
  const pct = total > 0 ? Math.round((pass / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 tabular-nums">{pass}/{total}</span>
    </div>
  );
}

function ChecklistGroupSection({ group, draftId, organizationId }: { group: ChecklistGroup; draftId: string; organizationId: string }) {
  const { showToast } = useToast();
  const upsert = useUpsertChecklistResult();

  const toggle = async (itemId: string, currentPassed: boolean | null) => {
    const nextPassed = currentPassed === true ? false : true;
    try {
      await upsert.mutateAsync({
        draft_id: draftId,
        organization_id: organizationId,
        checklist_item_id: itemId,
        passed: nextPassed,
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update checklist', 'error');
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold text-slate-700">
            {CHECKLIST_CATEGORY_LABELS[group.category]}
          </span>
          <span className="text-xs text-slate-500">
            {group.passCount} / {group.totalRequired} required
          </span>
        </div>
        <ProgressBar pass={group.passCount} total={group.totalRequired} />
      </div>
      <div className="divide-y divide-slate-100">
        {group.items.map(({ template, result }) => {
          const passed = result?.passed ?? null;
          return (
            <div key={template.id} className="px-4 py-3 flex items-start gap-3">
              <button
                onClick={() => toggle(template.id, passed)}
                disabled={upsert.isPending}
                className="mt-0.5 shrink-0 transition-colors"
              >
                {passed === true  && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                {passed === false && <XCircle    className="w-5 h-5 text-rose-400"    />}
                {passed === null  && <Circle     className="w-5 h-5 text-slate-300"   />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-800">{template.label}</p>
                  {template.is_required && (
                    <span className="text-xs text-rose-500 font-medium">Required</span>
                  )}
                </div>
                {template.description && (
                  <p className="text-xs text-slate-400 mt-0.5">{template.description}</p>
                )}
                {result?.notes && (
                  <p className="text-xs text-slate-500 mt-1 italic">{result.notes}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReviewChecklistPanel({ draftId, organizationId }: Props) {
  const { data: rawChecklistData, isLoading } = useReviewChecklist(draftId);
  const groups: ChecklistGroup[] = rawChecklistData
    ? buildChecklistGroups(rawChecklistData.templates ?? [], rawChecklistData.results ?? [])
    : [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="rounded-xl border border-slate-200 p-4 animate-pulse">
            <div className="h-3 bg-slate-200 rounded w-1/4 mb-3" />
            {[1, 2, 3].map(j => (
              <div key={j} className="flex gap-3 py-2">
                <div className="w-5 h-5 rounded-full bg-slate-200 shrink-0" />
                <div className="flex-1 h-3 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!groups.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-slate-200 rounded-xl">
        <ClipboardList className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">No checklist items configured</p>
      </div>
    );
  }

  const totalRequired = groups.reduce((s, g) => s + g.totalRequired, 0);
  const totalPassed   = groups.reduce((s, g) => s + g.passCount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Review Checklist</span>
        </div>
        <span className="text-xs text-slate-500">
          {totalPassed} / {totalRequired} required items passed
        </span>
      </div>

      {groups.map((group, idx) => (
        <ChecklistGroupSection
          key={`${group.category}-${idx}`}
          group={group}
          draftId={draftId}
          organizationId={organizationId}
        />
      ))}
    </div>
  );
}
