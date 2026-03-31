import { ClipboardList, FileText, GitBranch, GitPullRequestArrow, Play, Settings, ShieldCheck } from 'lucide-react';
import type { View } from '../../types/views';

const TABS: Array<{ view: View; label: string; Icon: React.ElementType }> = [
  { view: 'doc-studio', label: 'Drafts', Icon: FileText },
  { view: 'doc-studio-workflows', label: 'Workflows', Icon: GitBranch },
  { view: 'doc-studio-jobs', label: 'Jobs', Icon: Play },
  { view: 'doc-studio-integrity-queue', label: 'Integrity', Icon: ShieldCheck },
  { view: 'doc-studio-revalidation-queue', label: 'Revalidate', Icon: ClipboardList },
  { view: 'doc-studio-review-queue', label: 'Reviews', Icon: GitPullRequestArrow },
  { view: 'doc-studio-settings', label: 'Settings', Icon: Settings },
];

const DOC_STUDIO_VIEWS: View[] = [
  'doc-studio',
  'doc-studio-draft',
  'doc-studio-workflows',
  'doc-studio-workflow-editor',
  'doc-studio-jobs',
  'doc-studio-job-detail',
  'doc-studio-settings',
  'doc-studio-integrity-queue',
  'doc-studio-revalidation-queue',
  'doc-studio-review-queue',
];

function resolveActiveTab(currentView: View): View {
  if (currentView === 'doc-studio-draft') return 'doc-studio';
  if (currentView === 'doc-studio-workflow-editor') return 'doc-studio-workflows';
  if (currentView === 'doc-studio-job-detail') return 'doc-studio-jobs';
  return currentView;
}

interface Props {
  currentView: View;
  onNavigate: (view: View) => void;
  children: React.ReactNode;
}

export function DocStudioSubNav({ currentView, onNavigate, children }: Props) {
  if (!DOC_STUDIO_VIEWS.includes(currentView)) return <>{children}</>;

  const activeTab = resolveActiveTab(currentView);

  return (
    <div className="min-h-full flex flex-col">
      <div className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <nav className="flex items-center gap-1 -mb-px" aria-label="Doc Studio navigation">
            {TABS.map(({ view, label, Icon }) => {
              const isActive = activeTab === view;
              return (
                <button
                  key={view}
                  onClick={() => onNavigate(view)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
