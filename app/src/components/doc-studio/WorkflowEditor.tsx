import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Loader as Loader2, Camera, ChevronDown, ChevronUp } from 'lucide-react';
import {
  useDocStudioWorkflow,
  useCreateWorkflow,
  useUpdateWorkflow,
  useWorkflowSteps,
  useUpsertWorkflowStep,
  useDeleteWorkflowStep,
} from '../../hooks/useDocStudioWorkflows';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import type {
  DocumentationWorkflowStep,
  StepActionType,
  WaitStrategy,
  ErrorHandlingStrategy,
  SelectorStrategy,
} from '../../types/documentation';

const ACTION_TYPES: StepActionType[] = [
  'visit_url', 'click', 'type', 'select', 'wait', 'hover', 'keypress',
  'screenshot', 'assert_text', 'assert_url', 'extract_text', 'upload_file', 'conditional_branch',
];

const WAIT_STRATEGIES: WaitStrategy[] = [
  'none', 'network_idle', 'selector_visible', 'selector_hidden', 'fixed_delay', 'url_change',
];

const ERROR_STRATEGIES: ErrorHandlingStrategy[] = ['fail', 'retry', 'skip', 'fallback_to_manual_step'];
const SELECTOR_STRATEGIES: SelectorStrategy[] = ['css', 'xpath', 'text', 'role', 'testid'];

interface StepRowProps {
  step: Partial<DocumentationWorkflowStep> & { _tempId?: string };
  index: number;
  onUpdate: (patch: Partial<DocumentationWorkflowStep>) => void;
  onDelete: () => void;
  expanded: boolean;
  onToggle: () => void;
}

function StepRow({ step, index, onUpdate, onDelete, expanded, onToggle }: StepRowProps) {
  return (
    <div className="border border-slate-200 rounded-xl bg-white">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 rounded-xl"
        onClick={onToggle}
      >
        <GripVertical size={16} className="text-slate-300 flex-shrink-0" />
        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <span className="flex-1 text-sm font-medium text-slate-700 truncate">{step.title || 'Untitled step'}</span>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{step.action_type ?? 'click'}</span>
        {step.screenshot_checkpoint && (
          <Camera size={14} className="text-emerald-500 flex-shrink-0" />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
        >
          <Trash2 size={14} />
        </button>
        {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-3 border-t border-slate-100">
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Title *</label>
            <input
              value={step.title ?? ''}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Step title"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Action Type</label>
            <select
              value={step.action_type ?? 'click'}
              onChange={(e) => onUpdate({ action_type: e.target.value as StepActionType })}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Selector Strategy</label>
            <select
              value={step.selector_strategy ?? 'css'}
              onChange={(e) => onUpdate({ selector_strategy: e.target.value as SelectorStrategy })}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SELECTOR_STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Target Selector</label>
            <input
              value={step.target_selector ?? ''}
              onChange={(e) => onUpdate({ target_selector: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. button[data-testid='save']"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Action Value (type text, select option, etc.)</label>
            <input
              value={step.action_value ?? ''}
              onChange={(e) => onUpdate({ action_value: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Wait Strategy</label>
            <select
              value={step.wait_strategy ?? 'none'}
              onChange={(e) => onUpdate({ wait_strategy: e.target.value as WaitStrategy })}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {WAIT_STRATEGIES.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Error Handling</label>
            <select
              value={step.error_handling_strategy ?? 'fail'}
              onChange={(e) => onUpdate({ error_handling_strategy: e.target.value as ErrorHandlingStrategy })}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ERROR_STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Timeout (seconds)</label>
            <input
              type="number"
              min={1}
              max={120}
              value={step.timeout_seconds ?? 30}
              onChange={(e) => onUpdate({ timeout_seconds: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Retry Count</label>
            <input
              type="number"
              min={0}
              max={5}
              value={step.retry_count ?? 0}
              onChange={(e) => onUpdate({ retry_count: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Screenshot Caption Template</label>
            <input
              value={step.screenshot_caption_template ?? ''}
              onChange={(e) => onUpdate({ screenshot_caption_template: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. User clicks Save on the patient form"
            />
          </div>
          <div className="col-span-2 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={step.screenshot_checkpoint ?? false}
                onChange={(e) => onUpdate({ screenshot_checkpoint: e.target.checked })}
                className="rounded border-slate-300"
              />
              <Camera size={14} className="text-slate-400" /> Screenshot checkpoint
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={step.is_optional ?? false}
                onChange={(e) => onUpdate({ is_optional: e.target.checked })}
                className="rounded border-slate-300"
              />
              Optional step
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

type LocalStep = Partial<DocumentationWorkflowStep> & { _tempId: string; _dirty?: boolean };

interface Props {
  workflowId: string | null;
  onBack: () => void;
}

export function WorkflowEditor({ workflowId, onBack }: Props) {
  const isNew = !workflowId || workflowId === 'new';
  const { showToast } = useToast();
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  const { data: workflow, isLoading: wfLoading } = useDocStudioWorkflow(isNew ? null : workflowId, organizationId);
  const { data: remoteSteps = [], isLoading: stepsLoading } = useWorkflowSteps(isNew ? null : workflowId, organizationId);

  const createWorkflow = useCreateWorkflow();
  const updateWorkflow = useUpdateWorkflow();
  const upsertStep = useUpsertWorkflowStep();
  const deleteStep = useDeleteWorkflowStep();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [startUrl, setStartUrl] = useState('');
  const [tutorialGroup, setTutorialGroup] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [automationMode, setAutomationMode] = useState<'mock' | 'playwright'>('mock');
  const [isPlaywrightReady, setIsPlaywrightReady] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [steps, setSteps] = useState<LocalStep[]>([]);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
      setSlug(workflow.slug);
      setDescription(workflow.description ?? '');
      setStartUrl(workflow.start_url);
      setTutorialGroup(workflow.tutorial_group ?? '');
      setTargetRole(workflow.target_role ?? '');
      setAutomationMode(workflow.automation_mode as 'mock' | 'playwright');
      setIsPlaywrightReady(workflow.is_playwright_ready);
      setIsActive(workflow.is_active);
    }
  }, [workflow]);

  useEffect(() => {
    if (remoteSteps.length > 0) {
      setSteps(remoteSteps.map((s) => ({ ...s, _tempId: s.id })));
    }
  }, [remoteSteps]);

  const addStep = () => {
    const tempId = `temp-${Date.now()}`;
    setSteps((prev) => [
      ...prev,
      {
        _tempId: tempId,
        _dirty: true,
        step_order: prev.length + 1,
        title: '',
        action_type: 'click' as StepActionType,
        target_selector: '',
        wait_strategy: 'none' as WaitStrategy,
        screenshot_checkpoint: false,
        error_handling_strategy: 'fail' as ErrorHandlingStrategy,
        retry_count: 0,
        selector_strategy: 'css' as SelectorStrategy,
        timeout_seconds: 30,
        screenshot_caption_template: '',
        is_optional: false,
      },
    ]);
    setExpandedStep(tempId);
  };

  const updateStepLocal = (tempId: string, patch: Partial<DocumentationWorkflowStep>) => {
    setSteps((prev) => prev.map((s) => s._tempId === tempId ? { ...s, ...patch, _dirty: true } : s));
  };

  const removeStepLocal = async (s: LocalStep) => {
    if (s.id && workflowId && workflowId !== 'new') {
      await deleteStep.mutateAsync({ stepId: s.id, workflowId });
    }
    setSteps((prev) => prev.filter((x) => x._tempId !== s._tempId));
  };

  const handleSave = async () => {
    if (!name.trim()) { showToast('Workflow name is required', 'error'); return; }
    if (!startUrl.trim()) { showToast('Start URL is required', 'error'); return; }
    if (!organizationId) { showToast('Organization context is missing', 'error'); return; }
    setSaving(true);
    try {
      let wfId = isNew ? null : workflowId;

      if (isNew) {
        const created = await createWorkflow.mutateAsync({
          organization_id: organizationId,
          name, slug: slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          description, start_url: startUrl, tutorial_group: tutorialGroup || undefined,
          target_role: targetRole || undefined, automation_mode: automationMode,
        });
        wfId = created.id;
      } else {
        await updateWorkflow.mutateAsync({
          organization_id: organizationId,
          workflow_id: workflowId!,
          name, description, start_url: startUrl,
          tutorial_group: tutorialGroup || undefined, target_role: targetRole || undefined,
          automation_mode: automationMode, is_playwright_ready: isPlaywrightReady, is_active: isActive,
        });
      }

      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        if (!s._dirty && s.id) continue;
        if (!s.title?.trim()) continue;
        await upsertStep.mutateAsync({
          organization_id: organizationId,
          ...(s.id ? { id: s.id } : {}),
          workflow_id: wfId!,
          step_order: i + 1,
          title: s.title!,
          description: s.description ?? undefined,
          action_type: s.action_type ?? 'click',
          target_selector: s.target_selector ?? '',
          action_value: s.action_value ?? undefined,
          wait_strategy: s.wait_strategy ?? 'none',
          screenshot_checkpoint: s.screenshot_checkpoint ?? false,
          screenshot_caption_template: s.screenshot_caption_template ?? '',
          error_handling_strategy: s.error_handling_strategy ?? 'fail',
          retry_count: s.retry_count ?? 0,
          selector_strategy: s.selector_strategy ?? 'css',
          timeout_seconds: s.timeout_seconds ?? 30,
          is_optional: s.is_optional ?? false,
          ai_observation_prompt: s.ai_observation_prompt ?? undefined,
          fallback_instruction: s.fallback_instruction ?? undefined,
          expected_result: s.expected_result ?? undefined,
        });
      }

      showToast('Workflow saved', 'success');
      onBack();
    } catch {
      showToast('Failed to save workflow', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && (wfLoading || stepsLoading)) {
    return (
      <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{isNew ? 'New Workflow' : 'Edit Workflow'}</h2>
          <p className="text-sm text-slate-500">Configure workflow details and steps.</p>
        </div>
      </div>

      {/* Workflow fields */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-medium text-slate-700 text-sm">Workflow Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Create a New Patient" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Slug</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="auto-generated if blank" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Start URL *</label>
            <input value={startUrl} onChange={(e) => setStartUrl(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://app.caremetric.ai/..." />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="What does this workflow document?" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Tutorial Group</label>
            <input value={tutorialGroup} onChange={(e) => setTutorialGroup(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Patient Management" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Target Role</label>
            <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. front_desk, provider" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Automation Mode</label>
            <select value={automationMode} onChange={(e) => setAutomationMode(e.target.value as 'mock' | 'playwright')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="mock">Mock</option>
              <option value="playwright">Playwright</option>
            </select>
          </div>
          <div className="flex items-center gap-6 pt-5">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isPlaywrightReady} onChange={(e) => setIsPlaywrightReady(e.target.checked)} className="rounded border-slate-300" />
              Playwright Ready
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-slate-300" />
              Active
            </label>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-slate-700 text-sm">Steps ({steps.length})</h3>
          <button onClick={addStep} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors">
            <Plus size={14} /> Add Step
          </button>
        </div>
        {steps.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No steps yet. Add a step to define the automation sequence.
          </div>
        ) : (
          steps.map((s, i) => (
            <StepRow
              key={s._tempId}
              step={s}
              index={i}
              expanded={expandedStep === s._tempId}
              onToggle={() => setExpandedStep(expandedStep === s._tempId ? null : s._tempId)}
              onUpdate={(patch) => updateStepLocal(s._tempId, patch)}
              onDelete={() => removeStepLocal(s)}
            />
          ))
        )}
      </div>

      {/* Save */}
      <div className="flex justify-end gap-3 pb-4">
        <button onClick={onBack} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save Workflow
        </button>
      </div>
    </div>
  );
}
