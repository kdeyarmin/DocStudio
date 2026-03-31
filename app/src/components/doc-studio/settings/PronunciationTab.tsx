import { useState } from 'react';
import { Plus, Trash2, CreditCard as Edit2, Search, Upload, BookOpen, CircleCheck as CheckCircle, Circle as XCircle, Loader as Loader2 } from 'lucide-react';
import {
  usePronunciationDictionary,
  useCreatePronunciationEntry,
  useUpdatePronunciationEntry,
  useDeletePronunciationEntry,
  useTogglePronunciationEntry,
} from '../../../hooks/usePronunciationDictionary';
import { useToast } from '../../../lib/toast';
import type { PronunciationDictionaryEntry, PronunciationCategory, PronunciationReplacementMode } from '../../../types/documentation';

const CATEGORIES: { value: PronunciationCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'medication', label: 'Medication' },
  { value: 'abbreviation', label: 'Abbreviation' },
  { value: 'specialty', label: 'Specialty' },
  { value: 'product', label: 'Product' },
];

const MODES: { value: PronunciationReplacementMode; label: string; desc: string }[] = [
  { value: 'phonetic', label: 'Phonetic only', desc: 'Guide TTS using IPA spelling (no text change)' },
  { value: 'substitute', label: 'Substitute text', desc: 'Replace term with simpler spoken form' },
  { value: 'ssml', label: 'SSML phoneme', desc: 'Inject SSML phoneme tag for supported providers' },
  { value: 'none', label: 'Skip', desc: 'Ignore this term during processing' },
];

type EntryForm = {
  term: string;
  phonetic_spelling: string;
  substitute_text: string;
  category: PronunciationCategory;
  replacement_mode: PronunciationReplacementMode;
  notes: string;
  is_enabled: boolean;
};

const EMPTY_FORM: EntryForm = {
  term: '',
  phonetic_spelling: '',
  substitute_text: '',
  category: 'general',
  replacement_mode: 'phonetic',
  notes: '',
  is_enabled: true,
};

function EntryFormPanel({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: EntryForm;
  onSave: (form: EntryForm) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<EntryForm>(initial);
  const update = (patch: Partial<EntryForm>) => setForm((prev) => ({ ...prev, ...patch }));

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-slate-500 mb-1 block">Term *</label>
          <input value={form.term} onChange={(e) => update({ term: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="e.g. HCC, HEDIS, Surescripts" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Category</label>
          <select value={form.category} onChange={(e) => update({ category: e.target.value as PronunciationCategory })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Replacement Mode</label>
          <select value={form.replacement_mode} onChange={(e) => update({ replacement_mode: e.target.value as PronunciationReplacementMode })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <p className="text-xs text-slate-400 mt-0.5">{MODES.find((m) => m.value === form.replacement_mode)?.desc}</p>
        </div>
        {(form.replacement_mode === 'phonetic' || form.replacement_mode === 'ssml') && (
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Phonetic Spelling (IPA)</label>
            <input value={form.phonetic_spelling} onChange={(e) => update({ phonetic_spelling: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              placeholder="e.g. ˈhɛdɪs" />
          </div>
        )}
        {form.replacement_mode === 'substitute' && (
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Substitute Text</label>
            <input value={form.substitute_text} onChange={(e) => update({ substitute_text: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              placeholder="Spoken version of the term" />
          </div>
        )}
        <div className="col-span-2">
          <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
          <input value={form.notes} onChange={(e) => update({ notes: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Optional notes about this entry" />
        </div>
        <div className="flex items-center">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_enabled} onChange={(e) => update({ is_enabled: e.target.checked })} className="rounded border-slate-300" />
            Active
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.term.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Save
        </button>
      </div>
    </div>
  );
}

function entryToForm(e: PronunciationDictionaryEntry): EntryForm {
  return {
    term: e.term,
    phonetic_spelling: e.phonetic_spelling ?? '',
    substitute_text: e.substitute_text ?? '',
    category: e.category ?? 'general',
    replacement_mode: e.replacement_mode ?? 'phonetic',
    notes: e.notes ?? '',
    is_enabled: e.is_enabled ?? true,
  };
}

export function PronunciationTab() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<PronunciationCategory | ''>('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: entries = [], isLoading } = usePronunciationDictionary({
    category: filterCategory || undefined,
  });
  const create = useCreatePronunciationEntry();
  const update = useUpdatePronunciationEntry();
  const remove = useDeletePronunciationEntry();
  const toggle = useTogglePronunciationEntry();

  const filtered = entries.filter((e) =>
    !search || e.term.toLowerCase().includes(search.toLowerCase()) || (e.notes ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (form: EntryForm) => {
    try {
      await create.mutateAsync({
        term: form.term,
        phonetic_spelling: form.phonetic_spelling || null,
        substitute_text: form.substitute_text || null,
        category: form.category,
        replacement_mode: form.replacement_mode,
        notes: form.notes || null,
        is_enabled: form.is_enabled,
      });
      showToast('Entry added', 'success');
      setAdding(false);
    } catch {
      showToast('Failed to add entry', 'error');
    }
  };

  const handleUpdate = async (id: string, form: EntryForm) => {
    try {
      await update.mutateAsync({
        entry_id: id,
        term: form.term,
        phonetic_spelling: form.phonetic_spelling || null,
        substitute_text: form.substitute_text || null,
        category: form.category,
        replacement_mode: form.replacement_mode,
        notes: form.notes || null,
        is_enabled: form.is_enabled,
      });
      showToast('Entry updated', 'success');
      setEditingId(null);
    } catch {
      showToast('Failed to update entry', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      showToast('Entry deleted', 'success');
      setConfirmDeleteId(null);
    } catch {
      showToast('Failed to delete entry', 'error');
    }
  };

  const handleToggle = async (entry: PronunciationDictionaryEntry) => {
    try {
      await toggle.mutateAsync({ entry_id: entry.id, is_enabled: !entry.is_enabled });
    } catch {
      showToast('Failed to toggle entry', 'error');
    }
  };

  const categoryLabel = (cat: PronunciationCategory) => CATEGORIES.find((c) => c.value === cat)?.label ?? cat;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 bg-amber-50 rounded-lg shrink-0"><BookOpen size={16} className="text-amber-600" /></div>
          <div>
            <h3 className="font-medium text-slate-700 text-sm">Pronunciation Dictionary</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Define how medical terms, abbreviations, and product names should be spoken or transformed during narration generation.
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
            <Upload size={13} /> Import CSV
          </button>
          <button onClick={() => { setAdding(true); setEditingId(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={13} /> Add Entry
          </button>
        </div>
      </div>

      {adding && (
        <EntryFormPanel
          initial={EMPTY_FORM}
          onSave={handleCreate}
          onCancel={() => setAdding(false)}
          saving={create.isPending}
        />
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search terms..." />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as PronunciationCategory | '')}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-blue-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
          {entries.length === 0 ? 'No entries yet. Add your first pronunciation rule.' : 'No entries match your search.'}
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Term</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Category</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Mode</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Replacement</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500">Active</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((entry) =>
                editingId === entry.id ? (
                  <tr key={entry.id}>
                    <td colSpan={6} className="px-4 py-3">
                      <EntryFormPanel
                        initial={entryToForm(entry)}
                        onSave={(form) => handleUpdate(entry.id, form)}
                        onCancel={() => setEditingId(null)}
                        saving={update.isPending}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-700">{entry.term}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{categoryLabel(entry.category ?? 'general')}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 capitalize">{entry.replacement_mode ?? 'phonetic'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono max-w-[160px] truncate">
                      {entry.substitute_text ?? entry.phonetic_spelling ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggle(entry)} className="text-slate-400 hover:text-slate-600 transition-colors">
                        {entry.is_enabled
                          ? <CheckCircle size={16} className="text-green-500" />
                          : <XCircle size={16} className="text-slate-300" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setEditingId(entry.id); setAdding(false); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => setConfirmDeleteId(entry.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}{entries.length !== filtered.length && ` of ${entries.length}`}
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-slate-800 mb-2">Delete Entry?</h3>
            <p className="text-sm text-slate-500 mb-4">This pronunciation rule will be removed permanently.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={() => handleDelete(confirmDeleteId)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
