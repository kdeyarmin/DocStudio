import { useState } from 'react';
import { Save, Loader as Loader2, Plus, Trash2, CreditCard as Edit2 } from 'lucide-react';
import {
  useDemoAccounts,
  useUpsertDemoAccount,
  useDeleteDemoAccount,
} from '../../../hooks/useDocStudioSettings';
import { useToast } from '../../../lib/toast';
import type { DocumentationDemoAccount } from '../../../types/documentation';

function DemoAccountForm({
  account,
  onSave,
  onCancel,
  saving,
}: {
  account: Partial<DocumentationDemoAccount>;
  onSave: (data: Partial<DocumentationDemoAccount>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<DocumentationDemoAccount>>({
    name: '',
    environment: 'demo',
    role: '',
    username_hint: '',
    description: '',
    is_active: true,
    base_url: '',
    login_path: '/login',
    login_selectors: { username: 'input[name="email"]', password: 'input[name="password"]', submit: 'button[type="submit"]', successUrlPattern: '/dashboard' },
    env_password_key: '',
    ...account,
  });

  const update = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));
  const updateSelector = (key: string, val: string) =>
    setForm((prev) => ({ ...prev, login_selectors: { ...(prev.login_selectors ?? {}), [key]: val } as DocumentationDemoAccount['login_selectors'] }));

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Name *</label>
          <input value={form.name ?? ''} onChange={(e) => update({ name: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Production Demo" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Environment</label>
          <select value={form.environment} onChange={(e) => update({ environment: e.target.value as 'demo' | 'staging' })}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="demo">Demo</option>
            <option value="staging">Staging</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Base URL *</label>
          <input value={form.base_url ?? ''} onChange={(e) => update({ base_url: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="https://app.caremetric.ai" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Login Path</label>
          <input value={form.login_path ?? '/login'} onChange={(e) => update({ login_path: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="/login" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Username Hint</label>
          <input value={form.username_hint ?? ''} onChange={(e) => update({ username_hint: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="demo@caremetric.ai" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Env Password Key</label>
          <input value={form.env_password_key ?? ''} onChange={(e) => update({ env_password_key: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="DEMO_PASSWORD" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Role</label>
          <input value={form.role ?? ''} onChange={(e) => update({ role: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="org_admin" />
        </div>
        <div className="flex items-center pt-5">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_active ?? true} onChange={(e) => update({ is_active: e.target.checked })} className="rounded border-slate-300" />
            Active
          </label>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 mb-2">Login Selectors</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'username', label: 'Username field' },
            { key: 'password', label: 'Password field' },
            { key: 'submit', label: 'Submit button' },
            { key: 'successUrlPattern', label: 'Success URL pattern' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs text-slate-400 mb-0.5 block">{label}</label>
              <input
                value={(form.login_selectors as Record<string, string>)?.[key] ?? ''}
                onChange={(e) => updateSelector(key, e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
        </button>
      </div>
    </div>
  );
}

export function DemoAccountsTab() {
  const { showToast } = useToast();
  const [editAccount, setEditAccount] = useState<Partial<DocumentationDemoAccount> | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useDemoAccounts();
  const upsertAccount = useUpsertDemoAccount();
  const deleteAccount = useDeleteDemoAccount();

  const handleSave = async (data: Partial<DocumentationDemoAccount>) => {
    try {
      await upsertAccount.mutateAsync(data as Parameters<typeof upsertAccount.mutateAsync>[0]);
      showToast('Account saved', 'success');
      setEditAccount(null);
    } catch {
      showToast('Failed to save account', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAccount.mutateAsync(id);
      showToast('Account deleted', 'success');
      setConfirmDeleteId(null);
    } catch {
      showToast('Failed to delete account', 'error');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setEditAccount({})}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={15} /> Add Account
        </button>
      </div>

      {editAccount && (
        <DemoAccountForm
          account={editAccount}
          onSave={handleSave}
          onCancel={() => setEditAccount(null)}
          saving={upsertAccount.isPending}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-blue-500" /></div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          No demo accounts configured. Add one to use with Playwright runs.
        </div>
      ) : (
        accounts.map((acc) => (
          <div key={acc.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700 text-sm">{acc.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${acc.environment === 'staging' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                  {acc.environment}
                </span>
                {!acc.is_active && <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">Inactive</span>}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                {acc.username_hint && <span>{acc.username_hint}</span>}
                {acc.base_url && <span className="font-mono">{acc.base_url}</span>}
                {acc.env_password_key && <span className="font-mono">pw: {acc.env_password_key}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditAccount(acc)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                <Edit2 size={14} />
              </button>
              <button onClick={() => setConfirmDeleteId(acc.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-slate-800 mb-2">Delete Demo Account?</h3>
            <p className="text-sm text-slate-500 mb-4">This cannot be undone.</p>
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
