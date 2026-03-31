import { useState } from 'react';
import { Plus, Pencil, Trash2, Save, X, Loader as Loader2, ClipboardList, CircleCheck as CheckCircle, Circle } from 'lucide-react';
import { useChecklistTemplates, useUpsertChecklistTemplate, useDeleteChecklistTemplate } from '../../../hooks/useDocStudioReview';
import { useToast } from '../../../lib/toast';
import { CHECKLIST_CATEGORY_LABELS } from '../../../types/doc-studio-review';
import type { ChecklistTemplate } from '../../../types/doc-studio-review';

type Category = ChecklistTemplate['category'];

const CATEGORIES: Category[] = ['content', 'narration', 'visual', 'output'];

interface EditForm {
  id?: string;
  category: Category;
  label: string;
  description: string;
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
}

const BLANK_FORM: EditForm = {
  category: 'content',
  label: '',
  description: '',
  sort_order: 0,
  is_required: true,
  is_active: true,
};

function TemplateFormModal({ initial, onClose }: { initial: EditForm; onClose: () => void }) {
  const { showToast } = useToast();
  const upsert = useUpsertChecklistTemplate();
  const [form, setForm] = useState<EditForm>(initial);

  const handleSave = async () => {
    if (!form.label.trim()) { showToast('Label is required', 'error'); return; }
    try {
      await upsert.mutateAsync({
        id: form.id,
        category: form.category,
        label: form.label.trim(),
        description: form.description.trim() || undefined,
        sort_order: form.sort_order,
        is_required: form.is_required,
        is_active: form.is_active,
      });
      showToast(form.id ? 'Item updated' : 'Item created', 'success');
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">{form.id ? 'Edit Checklist Item' : 'New Checklist Item'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Category</label>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value as Category })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{CHECKLIST_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Label *</label>
            <input
              value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. All screenshots are high-resolution"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Optional guidance for reviewers"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Sort Order</label>
              <input
                type="number"
                min={0}
                value={form.sort_order}
                onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2 pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_required}
                  onChange={e => setForm({ ...form, is_required: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span className="text-xs text-slate-700">Required</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span className="text-xs text-slate-700">Active</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={upsert.isPending || !form.label.trim()}
            className="flex-1 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateRow({ template, onEdit }: { template: ChecklistTemplate; onEdit: (t: ChecklistTemplate) => void }) {
  const { showToast } = useToast();
  const del = useDeleteChecklistTemplate();
  const upsert = useUpsertChecklistTemplate();

  const handleToggleActive = async () => {
    try {
      await upsert.mutateAsync({ id: template.id, category: template.category, label: template.label, is_active: !template.is_active, is_required: template.is_required });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update', 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${template.label}"? This cannot be undone.`)) return;
    try {
      await del.mutateAsync(template.id);
      showToast('Item deleted', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Delete failed', 'error');
    }
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${!template.is_active ? 'opacity-50' : ''}`}>
      <button onClick={handleToggleActive} className="shrink-0" title={template.is_active ? 'Deactivate' : 'Activate'}>
        {template.is_active
          ? <CheckCircle className="w-4 h-4 text-emerald-500" />
          : <Circle className="w-4 h-4 text-slate-300" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-slate-800 truncate">{template.label}</p>
          {template.is_required && (
            <span className="text-[10px] font-medium text-rose-500 shrink-0">Required</span>
          )}
        </div>
        {template.description && (
          <p className="text-xs text-slate-400 truncate mt-0.5">{template.description}</p>
        )}
      </div>
      <span className="text-xs text-slate-400 tabular-nums shrink-0">#{template.sort_order}</span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(template)}
          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleDelete}
          disabled={del.isPending}
          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ReviewWorkflowTab() {
  const { data: templates = [], isLoading } = useChecklistTemplates();
  const [editTarget, setEditTarget] = useState<EditForm | null>(null);
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');

  const byCategory = CATEGORIES.reduce<Record<Category, ChecklistTemplate[]>>((acc, cat) => {
    acc[cat] = templates.filter(t => t.category === cat);
    return acc;
  }, { content: [], narration: [], visual: [], output: [] });

  const filtered = filterCategory === 'all'
    ? templates
    : byCategory[filterCategory as Category];

  const handleEdit = (t: ChecklistTemplate) => {
    setEditTarget({ id: t.id, category: t.category, label: t.label, description: t.description ?? '', sort_order: t.sort_order, is_required: t.is_required, is_active: t.is_active });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Review Workflow Settings</h3>
        <p className="text-xs text-slate-500">
          Manage the checklist items reviewers must complete before approving a tutorial. Changes apply globally to all new review sessions.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Checklist Items</span>
            <span className="text-xs text-slate-400">({templates.filter(t => t.is_active).length} active)</span>
          </div>
          <button
            onClick={() => setEditTarget({ ...BLANK_FORM })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 flex-wrap">
          {(['all', ...CATEGORIES] as Array<'all' | Category>).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filterCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'all' ? 'All' : CHECKLIST_CATEGORY_LABELS[cat]}
              {cat !== 'all' && (
                <span className="ml-1 opacity-70">({byCategory[cat].length})</span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <ClipboardList className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No checklist items yet</p>
            <p className="text-xs text-slate-400 mt-1">Add items to guide reviewers through the approval process</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(t => (
              <TemplateRow key={t.id} template={t} onEdit={handleEdit} />
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
        <p className="text-xs font-medium text-slate-600 mb-1">About the Review Workflow</p>
        <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
          <li>Reviewers are assigned per-draft from the Review tab inside each draft</li>
          <li>Checklist items here apply to all drafts; items can be marked active/inactive globally</li>
          <li>Required items must all be passed before a draft can advance to "Ready for Approval"</li>
          <li>Approval is final and transitions the draft status to "review" → "published" upon render completion</li>
        </ul>
      </div>

      {editTarget && (
        <TemplateFormModal initial={editTarget} onClose={() => setEditTarget(null)} />
      )}
    </div>
  );
}
