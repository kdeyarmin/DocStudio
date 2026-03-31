import type { ReviewWorkflowStage } from '../../../types/doc-studio-review';
import { WORKFLOW_STAGE_LABELS, WORKFLOW_STAGE_COLORS } from '../../../types/doc-studio-review';

interface Props {
  stage: ReviewWorkflowStage;
  size?: 'sm' | 'md';
}

export function ReviewStageBadge({ stage, size = 'md' }: Props) {
  const label = WORKFLOW_STAGE_LABELS[stage] ?? stage;
  const className = WORKFLOW_STAGE_COLORS[stage] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${px} ${className}`}>
      {label}
    </span>
  );
}
