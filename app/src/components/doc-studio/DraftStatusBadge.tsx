import { Loader as Loader2 } from 'lucide-react';
import type { DraftStatus } from '../../types/doc-studio';

const CONFIG: Record<DraftStatus, { label: string; className: string; spin?: boolean }> = {
  draft:      { label: 'Draft',      className: 'bg-slate-100 text-slate-600 border-slate-200' },
  generating: { label: 'Generating', className: 'bg-amber-100 text-amber-700 border-amber-200', spin: true },
  review:     { label: 'In Review',  className: 'bg-blue-100 text-blue-700 border-blue-200' },
  approved:   { label: 'Approved',   className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  published:  { label: 'Published',  className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  archived:   { label: 'Archived',   className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

interface Props {
  status: DraftStatus;
  size?: 'sm' | 'md';
}

export function DraftStatusBadge({ status, size = 'md' }: Props) {
  const { label, className, spin } = CONFIG[status] ?? CONFIG.draft;
  const textSize = size === 'sm' ? 'text-xs' : 'text-xs';
  const px = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1 font-medium rounded-full border ${textSize} ${px} ${className}`}>
      {spin && <Loader2 className="w-3 h-3 animate-spin" />}
      {label}
    </span>
  );
}
