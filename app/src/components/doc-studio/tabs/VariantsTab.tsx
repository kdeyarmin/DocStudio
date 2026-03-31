import { useState } from 'react';
import { Loader as Loader2, Users, ChevronDown, ChevronRight, Download, Copy, LayoutList, Table2, Check } from 'lucide-react';
import { useBuildExportPackage } from '../../../hooks/useDocStudioScenes';
import { useToast } from '../../../lib/toast';
import type { RoleVariantContent, TutorialRoleVariant } from '../../../types/documentation';

const ROLE_LABELS: Record<TutorialRoleVariant, string> = {
  provider: 'Provider',
  billing: 'Biller',
  intake_staff: 'Intake Staff',
  scheduler: 'Scheduler',
  admin: 'Admin',
  executive: 'Executive',
  clinical_manager: 'Clinical Manager',
};

const ROLE_COLORS: Record<TutorialRoleVariant, { badge: string; avatar: string }> = {
  provider: { badge: 'bg-blue-100 text-blue-700', avatar: 'bg-blue-500' },
  billing: { badge: 'bg-blue-100 text-blue-700', avatar: 'bg-blue-500' },
  intake_staff: { badge: 'bg-violet-100 text-violet-700', avatar: 'bg-violet-500' },
  scheduler: { badge: 'bg-emerald-100 text-emerald-700', avatar: 'bg-emerald-500' },
  admin: { badge: 'bg-slate-100 text-slate-700', avatar: 'bg-slate-500' },
  executive: { badge: 'bg-amber-100 text-amber-700', avatar: 'bg-amber-500' },
  clinical_manager: { badge: 'bg-rose-100 text-rose-700', avatar: 'bg-rose-500' },
};

function getRoleColors(role: TutorialRoleVariant) {
  return ROLE_COLORS[role] ?? { badge: 'bg-slate-100 text-slate-700', avatar: 'bg-slate-400' };
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-700 transition-colors"
    >
      {copied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

function VariantAccordionCard({ variant }: { variant: RoleVariantContent }) {
  const [open, setOpen] = useState(false);
  const label = ROLE_LABELS[variant.role] ?? variant.role;
  const colors = getRoleColors(variant.role);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-full ${colors.avatar} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>
            {label[0]}
          </div>
          <div className="text-left">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colors.badge}`}>
              {label}
            </span>
            {variant.key_tips.length > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">{variant.key_tips.length} key tips</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <span className="text-xs">{new Date(variant.generated_at).toLocaleDateString()}</span>
          {variant.narration_script && (
            <CopyButton text={variant.narration_script} label="Script" />
          )}
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {variant.key_tips.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Key Tips</p>
              <ul className="space-y-1">
                {variant.key_tips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-600">
                    <span className={`flex-shrink-0 font-semibold ${colors.badge.split(' ')[1]}`}>{i + 1}.</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {variant.emphasis_notes && (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Emphasis Notes</p>
                <CopyButton text={variant.emphasis_notes} />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{variant.emphasis_notes}</p>
            </div>
          )}
          {variant.narration_script && (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Narration Script</p>
                <CopyButton text={variant.narration_script} />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed line-clamp-4 bg-slate-50 rounded p-2 font-mono">
                {variant.narration_script}
              </p>
            </div>
          )}
          {variant.guide_md && (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Guide (Markdown)</p>
                <CopyButton text={variant.guide_md} />
              </div>
              <p className="text-xs text-slate-500 font-mono leading-relaxed line-clamp-4 bg-slate-50 rounded p-2">
                {variant.guide_md}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type TableRow = 'tips' | 'emphasis' | 'script' | 'guide';

const TABLE_ROW_LABELS: Record<TableRow, string> = {
  tips: 'Key Tips',
  emphasis: 'Emphasis Notes',
  script: 'Narration Script',
  guide: 'Guide (MD)',
};

function VariantComparisonTable({ variants }: { variants: RoleVariantContent[] }) {
  const rows: TableRow[] = ['tips', 'emphasis', 'script', 'guide'];

  const getCellContent = (variant: RoleVariantContent, row: TableRow): string => {
    if (row === 'tips') return variant.key_tips.map((t, i) => `${i + 1}. ${t}`).join('\n');
    if (row === 'emphasis') return variant.emphasis_notes ?? '';
    if (row === 'script') return variant.narration_script ?? '';
    if (row === 'guide') return variant.guide_md ?? '';
    return '';
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-max text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide w-28 sticky left-0 bg-slate-50 z-10">
              Field
            </th>
            {variants.map((v) => {
              const label = ROLE_LABELS[v.role] ?? v.role;
              const colors = getRoleColors(v.role);
              return (
                <th key={v.role} className="px-3 py-2.5 text-left min-w-48">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colors.badge}`}>
                    {label}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row} className="border-b border-slate-100 last:border-0 align-top">
              <td className="px-3 py-2.5 font-semibold text-slate-500 sticky left-0 bg-white z-10 whitespace-nowrap">
                {TABLE_ROW_LABELS[row]}
              </td>
              {variants.map((v) => {
                const content = getCellContent(v, row);
                return (
                  <td key={v.role} className="px-3 py-2.5 text-slate-600 leading-relaxed">
                    {content ? (
                      <div className="group relative">
                        <p className="line-clamp-4 whitespace-pre-line">{content}</p>
                        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <CopyButton text={content} />
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-300 italic">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ViewMode = 'accordion' | 'table';

interface Props {
  draftId: string;
}

export function VariantsTab({ draftId }: Props) {
  const { showToast } = useToast();
  const buildPackage = useBuildExportPackage();
  const [variants, setVariants] = useState<RoleVariantContent[] | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('accordion');

  const handleLoad = async () => {
    try {
      const pkg = await buildPackage.mutateAsync(draftId);
      setVariants(pkg.role_variants ?? []);
    } catch {
      showToast('Failed to load role variants', 'error');
    }
  };

  const handleDownloadAll = () => {
    if (!variants || variants.length === 0) return;
    const json = JSON.stringify(variants, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `role-variants-${draftId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Role Variants</span>
          {variants !== null && (
            <span className="text-xs text-slate-400">{variants.length} variant{variants.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {variants && variants.length > 0 && (
            <>
              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('accordion')}
                  className={`p-1.5 transition-colors ${viewMode === 'accordion' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                  title="Accordion view"
                >
                  <LayoutList size={13} />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 transition-colors ${viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                  title="Comparison table"
                >
                  <Table2 size={13} />
                </button>
              </div>
              <button
                onClick={handleDownloadAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Download size={13} />
                Download JSON
              </button>
            </>
          )}
          <button
            onClick={handleLoad}
            disabled={buildPackage.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {buildPackage.isPending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {variants === null ? 'Load Variants' : 'Refresh'}
          </button>
        </div>
      </div>

      {variants === null ? (
        <div className="text-center py-12 text-slate-400 text-sm bg-white border border-dashed border-slate-200 rounded-xl">
          Role variants are generated from the export package. Click "Load Variants" to fetch them.
        </div>
      ) : variants.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm bg-white border border-dashed border-slate-200 rounded-xl">
          No role variants in this export package. Ensure narration segments have been generated.
        </div>
      ) : viewMode === 'table' ? (
        <VariantComparisonTable variants={variants} />
      ) : (
        <div className="space-y-2">
          {variants.map((v) => (
            <VariantAccordionCard key={v.role} variant={v} />
          ))}
        </div>
      )}
    </div>
  );
}
