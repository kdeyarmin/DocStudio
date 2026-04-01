import { SceneConfig, SCENE_REGISTRY } from './types';
import { Settings, Type } from 'lucide-react';

interface SceneEditorProps {
  scene: SceneConfig;
  onChange: (updated: SceneConfig) => void;
}

export function SceneEditor({ scene, onChange }: SceneEditorProps) {
  const meta = SCENE_REGISTRY[scene.type];

  function updateProp(key: string, value: unknown) {
    onChange({
      ...scene,
      props: { ...scene.props, [key]: value },
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Settings className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-semibold text-slate-700">Scene Settings</span>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Scene Label</label>
          <input
            type="text"
            value={scene.label}
            onChange={(e) => onChange({ ...scene, label: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Duration (seconds)</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={2}
              max={60}
              value={scene.durationSeconds}
              onChange={(e) => onChange({ ...scene, durationSeconds: Number(e.target.value) })}
              className="flex-1"
            />
            <span className="text-sm font-mono text-slate-700 w-10 text-right">{scene.durationSeconds}s</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5" />
            Scene Type: {meta?.label}
          </div>
          <p className="text-xs text-slate-400 mb-3">{meta?.description}</p>
        </div>

        <SceneSpecificFields scene={scene} onUpdateProp={updateProp} />
      </div>
    </div>
  );
}

function SceneSpecificFields({
  scene,
  onUpdateProp,
}: {
  scene: SceneConfig;
  onUpdateProp: (key: string, value: unknown) => void;
}) {
  switch (scene.type) {
    case 'brand-intro':
      return (
        <div className="space-y-3">
          <FieldInput
            label="Headline Override"
            value={(scene.props.headline as string) || ''}
            placeholder="AI-Powered Clinical Documentation"
            onChange={(v) => onUpdateProp('headline', v)}
          />
          <FieldInput
            label="Sub-headline"
            value={(scene.props.subHeadline as string) || ''}
            placeholder="See how fast a note gets done."
            onChange={(v) => onUpdateProp('subHeadline', v)}
          />
        </div>
      );

    case 'problem-statement':
      return (
        <div className="space-y-3">
          <FieldInput
            label="Pain Point Text"
            value={(scene.props.painPoint as string) || ''}
            placeholder="Clinicians spend 2+ hours a day on documentation"
            onChange={(v) => onUpdateProp('painPoint', v)}
          />
          <FieldInput
            label="Solution Tease"
            value={(scene.props.solutionTease as string) || ''}
            placeholder="What if that dropped to under 2 minutes?"
            onChange={(v) => onUpdateProp('solutionTease', v)}
          />
        </div>
      );

    case 'dashboard-overview':
      return (
        <div className="space-y-3">
          <FieldInput
            label="Provider Name"
            value={(scene.props.providerName as string) || ''}
            placeholder="Dr. Sarah Chen"
            onChange={(v) => onUpdateProp('providerName', v)}
          />
          <FieldInput
            label="Specialty"
            value={(scene.props.specialty as string) || ''}
            placeholder="Internal Medicine"
            onChange={(v) => onUpdateProp('specialty', v)}
          />
        </div>
      );

    case 'ai-generation':
      return (
        <div className="space-y-3">
          <FieldInput
            label="Chief Complaint"
            value={(scene.props.chiefComplaint as string) || ''}
            placeholder="Chest pain, intermittent x 3 days"
            onChange={(v) => onUpdateProp('chiefComplaint', v)}
          />
          <FieldTextarea
            label="HPI Summary"
            value={(scene.props.hpiSummary as string) || ''}
            placeholder="54yo female presents with substernal chest pain..."
            onChange={(v) => onUpdateProp('hpiSummary', v)}
          />
        </div>
      );

    case 'ambient-listening':
      return (
        <div className="space-y-3">
          <FieldInput
            label="Patient Name"
            value={(scene.props.patientName as string) || ''}
            placeholder="Sarah Mitchell"
            onChange={(v) => onUpdateProp('patientName', v)}
          />
          <FieldInput
            label="Visit Type"
            value={(scene.props.visitType as string) || ''}
            placeholder="Follow-up"
            onChange={(v) => onUpdateProp('visitType', v)}
          />
        </div>
      );

    case 'feature-montage':
      return (
        <div className="space-y-3">
          <div className="text-xs text-slate-400">
            This scene auto-cycles through Billing, Telehealth, Scheduling, and Analytics highlights.
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(scene.props.showBilling as boolean) !== false}
              onChange={(e) => onUpdateProp('showBilling', e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">Show Billing</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(scene.props.showTelehealth as boolean) !== false}
              onChange={(e) => onUpdateProp('showTelehealth', e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">Show Telehealth</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(scene.props.showScheduling as boolean) !== false}
              onChange={(e) => onUpdateProp('showScheduling', e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">Show Scheduling</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(scene.props.showAnalytics as boolean) !== false}
              onChange={(e) => onUpdateProp('showAnalytics', e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">Show Analytics</span>
          </label>
        </div>
      );

    case 'closing-cta':
      return (
        <div className="space-y-3">
          <FieldInput
            label="CTA Button Text"
            value={(scene.props.ctaText as string) || ''}
            placeholder="Start Your Free Trial"
            onChange={(v) => onUpdateProp('ctaText', v)}
          />
          <FieldInput
            label="Website URL"
            value={(scene.props.ctaUrl as string) || ''}
            placeholder="caremetric.ai"
            onChange={(v) => onUpdateProp('ctaUrl', v)}
          />
          <FieldInput
            label="Headline"
            value={(scene.props.headline as string) || ''}
            placeholder="Documentation done. Before the patient leaves."
            onChange={(v) => onUpdateProp('headline', v)}
          />
        </div>
      );

    default:
      return <div className="text-xs text-slate-400">No custom settings for this scene type.</div>;
  }
}

function FieldInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-300"
      />
    </div>
  );
}

function FieldTextarea({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-300 resize-none"
      />
    </div>
  );
}
