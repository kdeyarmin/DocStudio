import React, { useState, useRef, useEffect } from 'react';
import { HubPublicationExport } from './HubPublicationExport';
import { Loader as Loader2, Package, Download, Copy, Check, Image, Captions, FileText, Code, ChevronDown, ChevronRight, Star, CircleCheck as CheckCircle2, Circle as XCircle, CircleAlert as AlertCircle, ArrowRight, Film, Video } from 'lucide-react';
import { useBuildExportPackage, useExportSRT, useExportGuideMarkdown } from '../../../hooks/useDocStudioScenes';
import { useLatestPackage } from '../../../hooks/useDocStudioPackage';
import { useRenderProjects, useDownloadRenderManifest } from '../../../hooks/useDocStudioRender';
import { useRenderArtifactsForDraft } from '../../../hooks/useDocStudioRenderJobs';
import { buildPackageReadinessChecklist } from '../../../services/documentation/packages/exportService';
import { useToast } from '../../../lib/toast';
import { isSafeExternalUrl } from '../../../lib/browser';
import type { TutorialExportPackage, TutorialPackageManifest, AssetType, RenderJobArtifact, RenderArtifactType } from '../../../types/documentation';
import { RENDER_MODE_LABELS, RENDER_PROJECT_STATUS_LABELS, RENDER_PROJECT_STATUS_COLORS, RENDER_ARTIFACT_LABELS } from '../../../types/documentation';

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  screenshot: 'Screenshot',
  video: 'Video',
  audio: 'Audio',
  trace: 'Trace',
  attachment: 'Attachment',
  failure_screenshot: 'Failure Shot',
};

const TIER_COLORS: Record<string, string> = {
  excellent: 'bg-green-100 text-green-700',
  good: 'bg-blue-100 text-blue-700',
  needs_review: 'bg-amber-100 text-amber-700',
  needs_recapture: 'bg-orange-100 text-orange-700',
  outdated: 'bg-red-100 text-red-700',
  incomplete: 'bg-slate-100 text-slate-600',
};

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* no-op */ }
  };
  return (
    <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-700 transition-colors">
      {copied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface StatsRowProps {
  pkg: TutorialExportPackage;
}

function StatsRow({ pkg }: StatsRowProps) {
  const tierColor = TIER_COLORS[pkg.quality_tier] ?? TIER_COLORS.incomplete;
  const tierLabel = pkg.quality_tier.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { label: 'Scenes', value: pkg.scene_count },
        { label: 'Segments', value: pkg.narration_segment_count },
        { label: 'Assets', value: pkg.asset_manifest.length },
        { label: 'Captions', value: pkg.caption_manifest.blocks?.length ?? 0 },
      ].map(({ label, value }) => (
        <div key={label} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-slate-800">{value}</p>
          <p className="text-xs text-slate-400 mt-0.5">{label}</p>
        </div>
      ))}
      <div className="sm:col-span-4 bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Star size={14} className="text-amber-500" />
          <span className="text-sm text-slate-600">
            Quality: <span className="font-semibold text-slate-800">{pkg.overall_quality_score}/100</span>
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tierColor}`}>{tierLabel}</span>
        </div>
        <div className="text-xs text-slate-400">
          v{pkg.version_label} &middot; {pkg.tutorial_group}
        </div>
      </div>
    </div>
  );
}

interface AssetTableProps {
  pkg: TutorialExportPackage;
}

function AssetTable({ pkg }: AssetTableProps) {
  const [open, setOpen] = useState(true);
  if (pkg.asset_manifest.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Image size={14} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Asset Manifest</span>
          <span className="text-xs text-slate-400">{pkg.asset_manifest.length} files</span>
        </div>
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-slate-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">File</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">Scene</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pkg.asset_manifest.map((a) => {
                const safeFileUrl = a.file_url && isSafeExternalUrl(a.file_url) ? a.file_url : null;
                return (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-slate-600 max-w-48 truncate" title={a.file_name}>
                    {a.file_name}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{ASSET_TYPE_LABELS[a.asset_type] ?? a.asset_type}</td>
                  <td className="px-3 py-2 text-slate-500 capitalize">{a.screenshot_role}</td>
                  <td className="px-3 py-2 text-slate-400 font-mono">{a.scene_id ? a.scene_id.slice(0, 8) : '—'}</td>
                  <td className="px-3 py-2">
                    {safeFileUrl && (
                      <a
                        href={safeFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                        title="Open"
                      >
                        <Download size={11} />
                      </a>
                    )}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface CaptionPreviewProps {
  pkg: TutorialExportPackage;
  srtContent: string | null;
}

function CaptionPreview({ pkg, srtContent }: CaptionPreviewProps) {
  const [open, setOpen] = useState(false);
  const blocks = pkg.caption_manifest.blocks ?? [];
  if (blocks.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Captions size={14} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Caption Manifest</span>
          <span className="text-xs text-slate-400">{blocks.length} blocks &middot; {pkg.caption_manifest.total_duration_seconds}s</span>
        </div>
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-slate-100">
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {blocks.map((b) => (
              <div key={b.id} className="flex items-start gap-3 px-4 py-2">
                <span className="text-xs text-slate-400 font-mono whitespace-nowrap mt-0.5 w-20 flex-shrink-0">
                  {(b.start_time_seconds ?? 0).toFixed(1)}s – {(b.end_time_seconds ?? 0).toFixed(1)}s
                </span>
                <p className="text-xs text-slate-600 leading-snug">{b.text}</p>
              </div>
            ))}
          </div>
          {srtContent && (
            <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs text-slate-400">SRT ready</span>
              <div className="flex items-center gap-3">
                <CopyButton text={srtContent} label="Copy SRT" />
                <button
                  onClick={() => downloadText(srtContent, `captions-${pkg.draft_id.slice(0, 8)}.srt`, 'text/plain')}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-700 transition-colors"
                >
                  <Download size={11} /> Download .srt
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface GuidePreviewProps {
  pkg: TutorialExportPackage;
}

function GuidePreview({ pkg }: GuidePreviewProps) {
  const [open, setOpen] = useState(false);
  if (!pkg.guide_markdown) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Guide Markdown</span>
        </div>
        <div className="flex items-center gap-3">
          {open && <CopyButton text={pkg.guide_markdown} />}
          {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100">
          <pre className="px-4 py-3 text-xs text-slate-600 font-mono leading-relaxed overflow-x-auto max-h-64 bg-slate-50 whitespace-pre-wrap">
            {pkg.guide_markdown}
          </pre>
        </div>
      )}
    </div>
  );
}

interface JSONPreviewProps {
  pkg: TutorialExportPackage;
}

function JSONPreview({ pkg }: JSONPreviewProps) {
  const [open, setOpen] = useState(false);
  const json = JSON.stringify(pkg, null, 2);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Code size={14} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Full Package JSON</span>
          <span className="text-xs text-slate-400">{(json.length / 1024).toFixed(1)} KB</span>
        </div>
        <div className="flex items-center gap-3">
          {open && <CopyButton text={json} label="Copy JSON" />}
          {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100">
          <pre className="px-4 py-3 text-xs text-slate-600 font-mono leading-relaxed overflow-x-auto max-h-72 bg-slate-50 whitespace-pre-wrap">
            {json}
          </pre>
        </div>
      )}
    </div>
  );
}

interface ReadinessChecklistProps {
  manifest: import('../../../types/documentation').TutorialPackageManifest;
}

function ReadinessChecklist({ manifest }: ReadinessChecklistProps) {
  const items = buildPackageReadinessChecklist(manifest);
  const passCount = items.filter((i) => i.passed).length;
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Readiness Checklist</span>
        <span className={`text-xs font-medium ${passCount === items.length ? 'text-green-600' : 'text-amber-600'}`}>
          {passCount}/{items.length} passed
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3 px-4 py-2.5">
            {item.passed
              ? <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
              : <XCircle size={13} className="text-red-400 flex-shrink-0" />}
            <span className="text-xs text-slate-700 flex-1 min-w-0">{item.label}</span>
            <span className="text-xs text-slate-400 flex-shrink-0">{item.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const ARTIFACT_TYPE_ICONS: Record<RenderArtifactType, React.ReactNode> = {
  rendered_video: <Video size={13} className="text-blue-600" />,
  render_preview: <Film size={13} className="text-blue-500" />,
  render_thumbnail: <Image size={13} className="text-slate-500" />,
  subtitle_srt: <Captions size={13} className="text-amber-500" />,
  subtitle_vtt: <Captions size={13} className="text-amber-400" />,
  render_log: <FileText size={13} className="text-slate-400" />,
  render_manifest_export: <Code size={13} className="text-slate-500" />,
  render_package: <Package size={13} className="text-green-600" />,
};

const ARTIFACT_TYPE_ORDER: RenderArtifactType[] = [
  'rendered_video',
  'render_preview',
  'render_thumbnail',
  'subtitle_srt',
  'subtitle_vtt',
  'render_manifest_export',
  'render_package',
  'render_log',
];

function RenderArtifactsSection({ draftId }: { draftId: string }) {
  const { data: artifacts = [], isLoading } = useRenderArtifactsForDraft(draftId);
  const [open, setOpen] = useState(true);

  if (isLoading) return null;
  if (artifacts.length === 0) return null;

  const sorted = [...artifacts].sort((a, b) => {
    const ai = ARTIFACT_TYPE_ORDER.indexOf(a.artifact_type);
    const bi = ARTIFACT_TYPE_ORDER.indexOf(b.artifact_type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const videoArtifacts = sorted.filter(a => a.artifact_type === 'rendered_video' || a.artifact_type === 'render_preview');
  const otherArtifacts = sorted.filter(a => a.artifact_type !== 'rendered_video' && a.artifact_type !== 'render_preview');

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Video size={14} className="text-blue-600" />
          <span className="text-sm font-medium text-slate-700">Render Artifacts</span>
          <span className="text-xs text-slate-400">{artifacts.length} file{artifacts.length !== 1 ? 's' : ''}</span>
          {artifacts.some(a => a.is_mock) && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">mock</span>
          )}
        </div>
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {videoArtifacts.length > 0 && (
            <div className="p-3 space-y-2 border-b border-slate-100">
              {videoArtifacts.map((artifact) => (
                <VideoArtifactCard key={artifact.id} artifact={artifact} />
              ))}
            </div>
          )}
          {otherArtifacts.length > 0 && (
            <div className="divide-y divide-slate-100">
              {otherArtifacts.map((artifact) => (
                <ArtifactRow key={artifact.id} artifact={artifact} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VideoArtifactCard({ artifact }: { artifact: RenderJobArtifact }) {
  const label = RENDER_ARTIFACT_LABELS[artifact.artifact_type] ?? artifact.artifact_type;
  const safeFileUrl = artifact.file_url && isSafeExternalUrl(artifact.file_url) ? artifact.file_url : null;
  return (
    <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5">
      <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
        {ARTIFACT_TYPE_ICONS[artifact.artifact_type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 truncate">{artifact.file_name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] text-slate-400">{label}</span>
          {artifact.file_size && (
            <span className="text-[10px] text-slate-400">{formatBytes(artifact.file_size)}</span>
          )}
          {artifact.duration_ms && (
            <span className="text-[10px] text-slate-400">{formatDuration(artifact.duration_ms)}</span>
          )}
          {artifact.width && artifact.height && (
            <span className="text-[10px] text-slate-400">{artifact.width}×{artifact.height}</span>
          )}
          {artifact.is_mock && (
            <span className="text-[10px] font-semibold px-1 py-0 rounded bg-amber-100 text-amber-600">mock</span>
          )}
        </div>
      </div>
      {safeFileUrl ? (
        <a
          href={safeFileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap transition-colors"
        >
          <Download size={12} /> Download
        </a>
      ) : (
        <span className="text-xs text-slate-300">No URL</span>
      )}
    </div>
  );
}

function ArtifactRow({ artifact }: { artifact: RenderJobArtifact }) {
  const label = RENDER_ARTIFACT_LABELS[artifact.artifact_type] ?? artifact.artifact_type;
  const safeFileUrl = artifact.file_url && isSafeExternalUrl(artifact.file_url) ? artifact.file_url : null;
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="flex-shrink-0">
        {ARTIFACT_TYPE_ICONS[artifact.artifact_type] ?? <FileText size={13} className="text-slate-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs text-slate-700 truncate block">{artifact.file_name}</span>
      </div>
      <span className="text-[10px] text-slate-400 whitespace-nowrap">{label}</span>
      {artifact.file_size && (
        <span className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">{formatBytes(artifact.file_size)}</span>
      )}
      {artifact.is_mock && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">mock</span>
      )}
      {safeFileUrl ? (
        <a
          href={safeFileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 hover:text-blue-600 transition-colors"
          title="Download"
        >
          <Download size={12} />
        </a>
      ) : (
        <span className="w-3" />
      )}
    </div>
  );
}

function RenderManifestSection({ draftId, onNavigateToTab }: { draftId: string; onNavigateToTab?: (tab: string) => void }) {
  const { data: projects = [], isLoading } = useRenderProjects(draftId);
  const downloadManifest = useDownloadRenderManifest();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);

  if (isLoading) return null;
  if (projects.length === 0) return null;

  const handleDownload = async (projectId: string) => {
    try {
      await downloadManifest.mutateAsync(projectId);
    } catch {
      showToast('No manifest built for this project yet', 'error');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Film size={14} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Render Manifests</span>
          <span className="text-xs text-slate-400">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-3">
          {onNavigateToTab && open && (
            <button
              onClick={(e) => { e.stopPropagation(); onNavigateToTab('render'); }}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Manage <ArrowRight size={11} />
            </button>
          )}
          {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {projects.map((project) => {
            const statusLabel = RENDER_PROJECT_STATUS_LABELS[project.render_status as keyof typeof RENDER_PROJECT_STATUS_LABELS] ?? project.render_status;
            const statusColor = RENDER_PROJECT_STATUS_COLORS[project.render_status as keyof typeof RENDER_PROJECT_STATUS_COLORS] ?? 'bg-slate-100 text-slate-600';
            const modeLabel = RENDER_MODE_LABELS[project.render_mode as keyof typeof RENDER_MODE_LABELS] ?? project.render_mode;
            const hasManifest = !!project.render_manifest_json;
            return (
              <div key={project.id} className="flex items-center gap-3 px-4 py-2.5">
                <Film size={13} className="text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700">{modeLabel}</p>
                  {project.total_duration_ms && (
                    <p className="text-[10px] text-slate-400 tabular-nums">
                      {(project.total_duration_ms / 1000).toFixed(1)}s · {project.scene_count ?? 0} scenes
                    </p>
                  )}
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
                  {statusLabel}
                </span>
                <button
                  onClick={() => handleDownload(project.id)}
                  disabled={!hasManifest || downloadManifest.isPending}
                  title={hasManifest ? 'Download render manifest JSON' : 'No manifest built yet'}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {downloadManifest.isPending ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  Manifest
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface Props {
  draftId: string;
  onNavigateToTab?: (tab: string) => void;
}

export function ExportTab({ draftId, onNavigateToTab }: Props) {
  const { showToast } = useToast();
  const buildPackage = useBuildExportPackage();
  const exportSRT = useExportSRT();
  const exportGuide = useExportGuideMarkdown();
  const { data: latestPkg } = useLatestPackage(draftId);

  const [pkg, setPkg] = useState<TutorialExportPackage | null>(null);
  const [srtContent, setSrtContent] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const handleBuild = async () => {
    try {
      const result = await buildPackage.mutateAsync(draftId);
      if (!mountedRef.current) return;
      setPkg(result);
      setSrtContent(null);
      showToast('Export package ready', 'success');
    } catch {
      showToast('Failed to build export package', 'error');
    }
  };

  const handleExportSRT = async () => {
    try {
      const result = await exportSRT.mutateAsync(draftId);
      setSrtContent(result.srt);
      downloadText(result.srt, `captions-${draftId.slice(0, 8)}.srt`, 'text/plain');
      showToast('SRT exported', 'success');
    } catch {
      showToast('Failed to export SRT', 'error');
    }
  };

  const handleExportGuide = async () => {
    try {
      const result = await exportGuide.mutateAsync(draftId);
      downloadText(result.markdown, result.filename, 'text/markdown');
      showToast('Guide exported', 'success');
    } catch {
      showToast('Failed to export guide', 'error');
    }
  };

  const handleDownloadJSON = () => {
    if (!pkg) return;
    downloadText(JSON.stringify(pkg, null, 2), `export-package-${draftId.slice(0, 8)}.json`, 'application/json');
  };

  return (
    <div className="space-y-4">
      <HubPublicationExport key={draftId} draftId={draftId} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Package size={15} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Export Package</span>
          {pkg && <span className="text-xs text-slate-400">Built {new Date(pkg.exported_at).toLocaleString()}</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pkg && (
            <>
              <button
                onClick={handleExportSRT}
                disabled={exportSRT.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {exportSRT.isPending ? <Loader2 size={13} className="animate-spin" /> : <Captions size={13} />}
                Export SRT
              </button>
              <button
                onClick={handleExportGuide}
                disabled={exportGuide.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {exportGuide.isPending ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                Export Guide
              </button>
              <button
                onClick={handleDownloadJSON}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Download size={13} />
                Download JSON
              </button>
            </>
          )}
          <button
            onClick={handleBuild}
            disabled={buildPackage.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {buildPackage.isPending ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
            {pkg ? 'Rebuild Package' : 'Build Package'}
          </button>
        </div>
      </div>

      {latestPkg && onNavigateToTab && !pkg && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <AlertCircle size={14} className="text-blue-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-blue-700">
              Full assembly package available — v{latestPkg.package_version}
              {latestPkg.exported_at && ` · assembled ${new Date(latestPkg.exported_at).toLocaleDateString()}`}
            </p>
          </div>
          <button
            onClick={() => onNavigateToTab('package_manifest')}
            className="flex items-center gap-1 text-xs text-blue-700 font-medium hover:text-blue-900 whitespace-nowrap"
          >
            View Package <ArrowRight size={11} />
          </button>
        </div>
      )}

      <RenderArtifactsSection draftId={draftId} />

      {!pkg ? (
        <div className="text-center py-12 text-slate-400 text-sm bg-white border border-dashed border-slate-200 rounded-xl">
          Build the export package to preview the full tutorial manifest, assets, captions, and guide.
        </div>
      ) : (
        <div className="space-y-3">
          <StatsRow pkg={pkg} />
          {latestPkg?.package_manifest && (
            <ReadinessChecklist manifest={latestPkg.package_manifest as TutorialPackageManifest} />
          )}
          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab('package_manifest')}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 transition-colors"
            >
              <ArrowRight size={11} />
              Full assembly package with audio, timing &amp; captions
            </button>
          )}
          <AssetTable pkg={pkg} />
          <CaptionPreview pkg={pkg} srtContent={srtContent} />
          <GuidePreview pkg={pkg} />
          <JSONPreview pkg={pkg} />
          <RenderManifestSection draftId={draftId} onNavigateToTab={onNavigateToTab} />
        </div>
      )}
    </div>
  );
}
