import { CircleCheck as CheckCircle, Circle, CircleDot } from 'lucide-react';
import type { ReviewWorkflowStage } from '../../../types/doc-studio-review';
import { PIPELINE_STAGES, WORKFLOW_STAGE_LABELS } from '../../../types/doc-studio-review';

interface Props {
  currentStage: ReviewWorkflowStage;
}

export function ReviewPipelineBar({ currentStage }: Props) {
  const currentIdx = PIPELINE_STAGES.indexOf(currentStage);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Pipeline</p>
      <div className="flex items-center gap-0 overflow-x-auto pb-1">
        {PIPELINE_STAGES.map((stage, idx) => {
          const isPast    = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isLast    = idx === PIPELINE_STAGES.length - 1;

          return (
            <div key={stage} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center gap-1 min-w-[72px]">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                  isPast    ? 'bg-blue-500 border-blue-500 text-white' :
                  isCurrent ? 'bg-white border-blue-600 text-blue-700' :
                              'bg-white border-slate-200 text-slate-300'
                }`}>
                  {isPast    ? <CheckCircle size={14} /> :
                   isCurrent ? <CircleDot size={14} /> :
                               <Circle size={14} />}
                </div>
                <span className={`text-[9px] font-medium text-center leading-tight max-w-[64px] ${
                  isCurrent ? 'text-blue-700' : isPast ? 'text-slate-500' : 'text-slate-300'
                }`}>
                  {WORKFLOW_STAGE_LABELS[stage]}
                </span>
              </div>
              {!isLast && (
                <div className={`h-0.5 w-6 flex-shrink-0 mb-4 ${isPast ? 'bg-blue-400' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
