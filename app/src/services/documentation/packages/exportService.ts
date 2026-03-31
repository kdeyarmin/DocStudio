import type {
  TutorialTimingManifest,
  CaptionManifest,
  TutorialPackageManifest,
  CaptionExportFormat,
} from '../../../types/documentation';
import { exportCaptionManifest } from '../captions/captionPipelineService';

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportTimingManifest(
  manifest: TutorialTimingManifest,
  filename?: string,
): void {
  const json = JSON.stringify(manifest, null, 2);
  downloadBlob(
    json,
    filename ?? `timing-manifest-${manifest.draft_id}.json`,
    'application/json',
  );
}

export function exportCaptionManifestToFile(
  manifest: CaptionManifest,
  format: CaptionExportFormat = 'srt',
  filename?: string,
): void {
  const content = exportCaptionManifest(manifest, format);
  const ext = format === 'vtt' ? 'vtt' : format === 'srt' ? 'srt' : format === 'json' ? 'json' : 'txt';
  const mimeType =
    format === 'json' ? 'application/json'
    : format === 'vtt' ? 'text/vtt'
    : 'text/plain';

  downloadBlob(content, filename ?? `captions-${manifest.draft_id}.${ext}`, mimeType);
}

export function exportAssetManifest(
  manifest: TutorialPackageManifest,
  filename?: string,
): void {
  const json = JSON.stringify(manifest.assets, null, 2);
  downloadBlob(
    json,
    filename ?? `asset-manifest-${manifest.draft_id}.json`,
    'application/json',
  );
}

export function exportTutorialPackageJson(
  manifest: TutorialPackageManifest,
  filename?: string,
): void {
  const json = JSON.stringify(manifest, null, 2);
  downloadBlob(
    json,
    filename ?? `tutorial-package-${manifest.draft_id}-v${manifest.package_version}.json`,
    'application/json',
  );
}

export function exportPackageBundle(
  packageManifest: TutorialPackageManifest,
  captionManifest?: CaptionManifest,
  captionFormat: CaptionExportFormat = 'srt',
): void {
  exportTutorialPackageJson(packageManifest);

  if (packageManifest.timing_manifest) {
    exportTimingManifest(packageManifest.timing_manifest);
  }

  if (captionManifest) {
    exportCaptionManifestToFile(captionManifest, captionFormat);
    exportAssetManifest(packageManifest);
  }
}

export function buildPackageReadinessChecklist(
  manifest: TutorialPackageManifest,
): Array<{ label: string; passed: boolean; detail: string }> {
  const totalScenes = manifest.total_scenes ?? 0;
  const timingMs = manifest.timing_manifest?.total_duration_ms ?? 0;
  const driftOutdated = manifest.drift_summary?.outdated_count ?? 0;
  const driftWarning = manifest.drift_summary?.warning_count ?? 0;
  const assemblyCompleteness = manifest.quality_summary?.package_assembly_completeness ?? 0;

  return [
    {
      label: 'All scenes present',
      passed: totalScenes > 0,
      detail: `${totalScenes} scene(s) in package`,
    },
    {
      label: 'Audio coverage',
      passed: manifest.audio_coverage_pct >= 80,
      detail: `${manifest.audio_coverage_pct}% of scenes have audio`,
    },
    {
      label: 'Caption coverage',
      passed: manifest.caption_coverage_pct >= 60,
      detail: `${manifest.caption_coverage_pct}% of scenes have captions`,
    },
    {
      label: 'Timing manifest',
      passed: timingMs > 0,
      detail: timingMs > 0
        ? `${Math.round(timingMs / 1000)}s total duration`
        : 'Not yet generated',
    },
    {
      label: 'Assembly complete',
      passed: assemblyCompleteness >= 100,
      detail: assemblyCompleteness >= 100
        ? 'All pipeline steps complete'
        : `${assemblyCompleteness}% of pipeline steps complete`,
    },
    {
      label: 'Quality score',
      passed: (manifest.quality_summary?.overall_score ?? 0) >= 60,
      detail: `Score: ${manifest.quality_summary?.overall_score ?? 0}/100`,
    },
    {
      label: 'No outdated content',
      passed: driftOutdated === 0,
      detail: driftOutdated > 0
        ? `${driftOutdated} scene(s) have outdated screenshots`
        : driftWarning > 0
        ? `${driftWarning} scene(s) have drift warnings`
        : 'All content is current',
    },
  ];
}
