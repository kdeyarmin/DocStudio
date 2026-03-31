import { useState } from 'react';
import { X, Plus, Trash2, Loader as Loader2, CircleAlert as AlertCircle } from 'lucide-react';
import type { ChangeRequestType } from '../../../types/doc-studio-review';
import { CHANGE_TYPE_LABELS } from '../../../types/doc-studio-review';
import { useCreateChangeRequest } from '../../../hooks/useDocStudioReview';
import { useToast } from '../../../lib/toast';

interface Props {
  draftId: string;
  organizationId: string;
  onClose: () => void;
}

interface ChangeEntry {
  change_type: ChangeRequestType;
  description: string;
}

const ALL_CHANGE_TYPES: ChangeRequestType[] = [
  'regenerate_scene',
  'adjust_shot_plan',
  'update_narration',
  'fix_caption',
  'regenerate_render',
  'recapture_workflow',
];

const EMPTY_ENTRY: ChangeEntry = { change_type: 'regenerate_scene', description: '' };

export function RequestChangesModal({ draftId, organizationId, onClose }: Props) {
  const { showToast } = useToast();
  const createChange = useCreateChangeRequest();

  const [entries, setEntries] = useState<ChangeEntry[]>([{ ...EMPTY_ENTRY }]);

  const addEntry = () => setEntries(prev => [...prev, { ...EMPTY_ENTRY }]);

  const removeEntry = (i: number) => setEntries(prev => prev.filter((_, idx) => idx !== i));

  const updateEntry = (i: number, field: keyof ChangeEntry, value: string) =>
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));

  const valid = entries.every(e => e.description.trim());

  const handleSubmit = async () => {
    if (!valid) {
      showToast('All change descriptions are required', 'error');
      return;
    }
    try {
      await createChange.mutateAsync({
        draft_id: draftId,
        organization_id: organizationId,
        changes: entries.map(e => ({ change_type: e.change_type, description: e.description.trim() })),
      });
      showToast('Change requests submitted', 'success');
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to submit changes', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <h2 className="text-base font-semibold text-slate-800">Request Changes</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          {entries.map((entry, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <select
                  value={entry.change_type}
                  onChange={e => updateEntry(i, 'change_type', e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {ALL_CHANGE_TYPES.map(t => (
                    <option key={t} value={t}>{CHANGE_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                {entries.length > 1 && (
                  <button
                    onClick={() => removeEntry(i)}
                    className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <textarea
                value={entry.description}
                onChange={e => updateEntry(i, 'description', e.target.value)}
                placeholder="Describe what needs to change..."
                rows={2}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
              />
            </div>
          ))}

          <button
            onClick={addEntry}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add another change
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-200 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createChange.isPending || !valid}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            {createChange.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Submit Changes
          </button>
        </div>
      </div>
    </div>
  );
}
