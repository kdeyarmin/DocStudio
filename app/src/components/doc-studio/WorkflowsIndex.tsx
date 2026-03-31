import { useState } from 'react';
import { Plus, Search, CreditCard as Edit2, Trash2, Loader as Loader2, CircleAlert as AlertCircle, Zap, Clock } from 'lucide-react';
import { useDocStudioWorkflows, useDeleteWorkflow } from '../../hooks/useDocStudioWorkflows';
import { useToast } from '../../lib/toast';
import type { WorkflowAutomationMode } from '../../types/documentation';

interface Props {
  organizationId?: string;
  onEditWorkflow: (id: string) => void;
  onViewJob: (id: string) => void;
}

function AutomationBadge({ mode, ready }: { mode: WorkflowAutomationMode; ready: boolean }) {
  if (mode === 'playwright' && ready) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
        <Zap size={10} /> Playwright Ready
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
      <Clock size={10} /> Mock
    </span>
  );
}

export function WorkflowsIndex({ onEditWorkflow, onViewJob: _onViewJob, organizationId }: Props) {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: workflows = [], isLoading, isError, refetch } = useDocStudioWorkflows({ search, organizationId });
  const deleteWorkflow = useDeleteWorkflow();

  const handleDelete = async (id: string) => {
    try {
      await deleteWorkflow.mutateAsync(id);
      showToast('Workflow deleted', 'success');
      setConfirmDelete(null);
    } catch {
      showToast('Failed to delete workflow', 'error');
    }
  };


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Automation Workflows</h2>
          <p className="text-sm text-slate-500 mt-0.5">Define step-by-step workflows for automated documentation capture.</p>
        </div>
        <button
          onClick={() => onEditWorkflow('new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> New Workflow
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search workflows..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 py-12 text-slate-500">
          <AlertCircle size={24} className="text-red-400" />
          <p className="text-sm">Failed to load workflows.</p>
          <button onClick={() => refetch()} className="text-sm text-blue-600 hover:underline">Retry</button>
        </div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Zap size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No workflows yet</p>
          <p className="text-sm mt-1">Create your first workflow to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {workflows.map((wf) => {
            return (
              <div key={wf.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-800 truncate">{wf.name}</span>
                      <AutomationBadge mode={wf.automation_mode as WorkflowAutomationMode} ready={wf.is_playwright_ready} />
                      {!wf.is_active && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">Inactive</span>
                      )}
                    </div>
                    {wf.description && (
                      <p className="text-sm text-slate-500 mt-1 truncate">{wf.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      {wf.tutorial_group && <span>Group: {wf.tutorial_group}</span>}
                      {wf.target_role && <span>Role: {wf.target_role}</span>}
                      {wf.estimated_duration_seconds > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> ~{wf.estimated_duration_seconds}s
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => onEditWorkflow(wf.id)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(wf.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-slate-800 mb-2">Delete Workflow?</h3>
            <p className="text-sm text-slate-500 mb-4">This will permanently delete the workflow and all its steps. Jobs are kept.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
