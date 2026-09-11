import { useState } from 'react';
import { Save, Loader as Loader2, Package, Captions, Layers } from 'lucide-react';
import {
  useAssemblyConfig,
  useSaveAssemblyConfig,
  useCaptionExportConfig,
  useSaveCaptionExportConfig,
  usePackageExportConfig,
  useSavePackageExportConfig,
} from '../../../hooks/useDocStudioSettings';
import { useToast } from '../../../lib/toast';
import type { AssemblyConfig, CaptionExportConfig, PackageExportConfig } from '../../../types/documentation';
import {
  DEFAULT_ASSEMBLY_CONFIG,
  DEFAULT_CAPTION_EXPORT_CONFIG,
  DEFAULT_PACKAGE_EXPORT_CONFIG,
} from '../../../types/documentation';

export function AudioAssemblyTab() {
  const { showToast } = useToast();

  const { data: assemblyData, isLoading: loadingAssembly } = useAssemblyConfig();
  const { data: captionData, isLoading: loadingCaption } = useCaptionExportConfig();
  const { data: packageData, isLoading: loadingPackage } = usePackageExportConfig();

  const saveAssembly = useSaveAssemblyConfig();
  const saveCaption = useSaveCaptionExportConfig();
  const savePackage = useSavePackageExportConfig();

  const [assemblyDraft, setAssemblyDraft] = useState<AssemblyConfig>(DEFAULT_ASSEMBLY_CONFIG);
  const [captionDraft, setCaptionDraft] = useState<CaptionExportConfig>(DEFAULT_CAPTION_EXPORT_CONFIG);
  const [pkgDraft, setPkgDraft] = useState<PackageExportConfig>(DEFAULT_PACKAGE_EXPORT_CONFIG);
  const [assemblyDirty, setAssemblyDirty] = useState(false);
  const [captionDirty, setCaptionDirty] = useState(false);
  const [pkgDirty, setPkgDirty] = useState(false);

  const assembly = assemblyDirty ? assemblyDraft : (assemblyData ?? DEFAULT_ASSEMBLY_CONFIG);
  const caption = captionDirty ? captionDraft : (captionData ?? DEFAULT_CAPTION_EXPORT_CONFIG);
  const pkg = pkgDirty ? pkgDraft : (packageData ?? DEFAULT_PACKAGE_EXPORT_CONFIG);

  const updateAssembly = (patch: Partial<AssemblyConfig>) => {
    setAssemblyDirty(true);
    setAssemblyDraft((prev) => ({
      ...(assemblyDirty ? prev : (assemblyData ?? DEFAULT_ASSEMBLY_CONFIG)),
      ...patch,
    }));
  };
  const updateCaption = (patch: Partial<CaptionExportConfig>) => {
    setCaptionDirty(true);
    setCaptionDraft((prev) => ({
      ...(captionDirty ? prev : (captionData ?? DEFAULT_CAPTION_EXPORT_CONFIG)),
      ...patch,
    }));
  };
  const updatePkg = (patch: Partial<PackageExportConfig>) => {
    setPkgDirty(true);
    setPkgDraft((prev) => ({
      ...(pkgDirty ? prev : (packageData ?? DEFAULT_PACKAGE_EXPORT_CONFIG)),
      ...patch,
    }));
  };

  const handleSaveAll = async () => {
    try {
      await Promise.all([
        saveAssembly.mutateAsync(assembly),
        saveCaption.mutateAsync(caption),
        savePackage.mutateAsync(pkg),
      ]);
      setAssemblyDraft(assembly);
      setCaptionDraft(caption);
      setPkgDraft(pkg);
      setAssemblyDirty(false);
      setCaptionDirty(false);
      setPkgDirty(false);
      showToast('Assembly settings saved', 'success');
    } catch {
      showToast('Failed to save assembly settings', 'error');
    }
  };

  const isSaving = saveAssembly.isPending || saveCaption.isPending || savePackage.isPending;
  const isLoading = loadingAssembly || loadingCaption || loadingPackage;

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-blue-500" /></div>;
  }

  const captionFormats: Array<{ value: 'json' | 'srt' | 'vtt'; label: string }> = [
    { value: 'json', label: 'JSON' },
    { value: 'srt', label: 'SRT' },
    { value: 'vtt', label: 'VTT' },
  ];

  const toggleCaptionFormat = (fmt: 'json' | 'srt' | 'vtt') => {
    const current = caption.enabled_export_formats;
    const next = current.includes(fmt) ? current.filter((f) => f !== fmt) : [...current, fmt];
    updateCaption({ enabled_export_formats: next });
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Layers size={16} className="text-blue-600" /></div>
          <div className="flex-1">
            <h3 className="font-medium text-slate-700 text-sm">Audio Assembly</h3>
            <p className="text-xs text-slate-400 mt-0.5">Controls how audio is assembled across scenes during the packaging pipeline.</p>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={assembly.enable_scene_audio_assembly}
              onChange={(e) => updateAssembly({ enable_scene_audio_assembly: e.target.checked })}
              className="rounded border-slate-300"
            />
            Enabled
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Duration Estimation Mode</label>
            <select
              value={assembly.duration_estimation_mode}
              onChange={(e) => updateAssembly({ duration_estimation_mode: e.target.value as AssemblyConfig['duration_estimation_mode'] })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="wpm_based">WPM-based (words per minute)</option>
              <option value="character_based">Character-based</option>
              <option value="fixed">Fixed duration per scene</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Target WPM</label>
            <input
              type="number"
              min={60}
              max={220}
              value={assembly.target_wpm}
              onChange={(e) => updateAssembly({ target_wpm: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-0.5">Used for duration estimation when mode is WPM-based</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Silence Gap Between Scenes (seconds)</label>
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={assembly.silence_gap_seconds}
              onChange={(e) => updateAssembly({ silence_gap_seconds: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Missing Audio Fallback</label>
            <select
              value={assembly.fallback_on_missing_audio}
              onChange={(e) => updateAssembly({ fallback_on_missing_audio: e.target.value as AssemblyConfig['fallback_on_missing_audio'] })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="use_placeholder">Use silence placeholder</option>
              <option value="skip_scene">Skip scene entirely</option>
              <option value="fail_assembly">Fail the assembly</option>
            </select>
          </div>
        </div>

        <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={assembly.allow_partial_assembly}
            onChange={(e) => updateAssembly({ allow_partial_assembly: e.target.checked })}
            className="rounded border-slate-300 mt-0.5"
          />
          <div>
            <div className="text-sm text-slate-700">Allow partial assembly</div>
            <div className="text-xs text-slate-400">Complete assembly even if some scenes lack audio, using the fallback strategy above</div>
          </div>
        </label>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-violet-50 rounded-lg"><Captions size={16} className="text-violet-600" /></div>
          <div>
            <h3 className="font-medium text-slate-700 text-sm">Caption Export</h3>
            <p className="text-xs text-slate-400 mt-0.5">Controls how captions are split and which formats are enabled for export.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Target Words per Caption Block</label>
            <input
              type="number"
              min={4}
              max={30}
              value={caption.caption_block_length_target_words}
              onChange={(e) => updateCaption({ caption_block_length_target_words: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Max Lines per Block</label>
            <input
              type="number"
              min={1}
              max={4}
              value={caption.multiline_max_lines}
              onChange={(e) => updateCaption({ multiline_max_lines: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={caption.split_long_narration}
            onChange={(e) => updateCaption({ split_long_narration: e.target.checked })}
            className="rounded border-slate-300 mt-0.5"
          />
          <div>
            <div className="text-sm text-slate-700">Split long narration segments</div>
            <div className="text-xs text-slate-400">Automatically split narration blocks that exceed the target word count</div>
          </div>
        </label>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-2 block">Enabled Export Formats</label>
          <div className="flex gap-2">
            {captionFormats.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => toggleCaptionFormat(value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  caption.enabled_export_formats.includes(value)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg"><Package size={16} className="text-emerald-600" /></div>
          <div>
            <h3 className="font-medium text-slate-700 text-sm">Package Export</h3>
            <p className="text-xs text-slate-400 mt-0.5">Choose which artifacts are bundled when exporting a tutorial package.</p>
          </div>
        </div>

        <div className="space-y-2">
          {([
            ['include_quality_summary', 'Include quality summary', 'Quality score and warnings in the exported package'],
            ['include_drift_summary', 'Include drift summary', 'Screenshot drift analysis results'],
            ['include_variants_in_export', 'Include content variants', 'Alternate script phrasings and role-specific variants'],
            ['include_transcript', 'Include transcript', 'Full narration transcript as plain text'],
            ['include_captions', 'Include captions', 'SRT/VTT caption files in the package'],
            ['include_raw_timing_manifest', 'Include timing manifest', 'Raw per-scene timing data (JSON)'],
          ] as const).map(([key, label, desc]) => (
            <label key={key} className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={pkg[key]}
                onChange={(e) => updatePkg({ [key]: e.target.checked })}
                className="rounded border-slate-300 mt-0.5"
              />
              <div>
                <div className="text-sm text-slate-700">{label}</div>
                <div className="text-xs text-slate-400">{desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save Assembly Settings
        </button>
      </div>
    </div>
  );
}
