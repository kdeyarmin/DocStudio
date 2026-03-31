import { type ElementType, useState } from 'react';
import {
  ArrowLeft,
  FileText,
  Video,
  Mic,
  Download,
  Settings,
  Sparkles,
  BookOpen,
  FileSliders as Sliders,
  CircleCheck as CheckCircle2,
  Clock,
  Users,
  Globe,
  Copy,
  Check,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useUpdateDraft } from '../../hooks/useDocStudio';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { supabase } from '../../lib/supabase';
import { isSafeExternalUrl } from '../../lib/browser';
import type { DocStudioDraft, OutputType } from '../../types/doc-studio';
import type { SceneRow, NarrationAsset, RenderManifest } from './result-types';
import { NarrationPanel } from './NarrationPanel';
import { VideoPreviewCard } from './VideoPreviewCard';
import { ResultMarkdownRenderer } from './ResultMarkdownRenderer';
import { SceneListExpandable, SceneListCompact } from './SceneListPanel';

const OUTPUT_TYPE_ICONS: Record<OutputType, ElementType> = {
  screenshot_guide: FileText,
  video_tutorial: Video,
  narrated_video: Mic,
};

const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  screenshot_guide: 'Written Guide',
  video_tutorial: 'Video Tutorial',
  narrated_video: 'Narrated Video',
};

function useDraftWithScenes(draftId: string, organizationId: string | undefined) {
  return useQuery({
    queryKey: ['simple-result-draft', draftId],
    queryFn: async () => {
      const [{ data: draft, error }, { data: scenes }, { data: audioAssets }, { data: renderProjects }] =
        await Promise.all([
          supabase.from('doc_studio_drafts').select('*').eq('id', draftId).eq('organization_id', organizationId).maybeSingle(),
          supabase
            .from('doc_studio_scenes')
            .select('id, scene_order, title, summary, narration_text, start_time_seconds, end_time_seconds')
            .eq('draft_id', draftId)
            .order('scene_order', { ascending: true }),
          supabase
            .from('doc_studio_assets')
            .select('id, public_url, duration_seconds, file_size_bytes, metadata')
            .eq('draft_id', draftId)
            .eq('asset_type', 'audio')
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('doc_studio_render_projects')
            .select('render_manifest_json')
            .eq('draft_id', draftId)
            .order('created_at', { ascending: false })
            .limit(1),
        ]);
      if (error) throw new Error(error.message);
      if (!draft) throw new Error('Draft not found');
      return {
        draft: draft as DocStudioDraft,
        scenes: (scenes ?? []) as SceneRow[],
        narrationAsset: (audioAssets?.[0] as NarrationAsset) ?? null,
        renderManifest: (renderProjects?.[0]?.render_manifest_json as RenderManifest) ?? null,
      };
    },
    enabled: !!draftId,
    staleTime: 30 * 1000,
  });
}

interface Props {
  draftId: string;
  onBack: () => void;
  onAdvancedEdit: (id: string) => void;
}

export function SimpleDocStudioResult({ draftId, onBack, onAdvancedEdit }: Props) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const { data, isLoading, isError, refetch } = useDraftWithScenes(draftId, profile?.organization_id);
  const updateDraft = useUpdateDraft();
  const [activeTab, setActiveTab] = useState<'preview' | 'edit' | 'settings'>('preview');
  const [editContent, setEditContent] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scenesExpanded, setScenesExpanded] = useState<Record<string, boolean>>({});

  const draft = data?.draft;
  const scenes = data?.scenes ?? [];
  const narrationAsset = data?.narrationAsset;
  const renderManifest = data?.renderManifest;

  const rawContent = draft?.generated_content;
  const markdownString =
    editContent ??
    (typeof rawContent === 'string'
      ? rawContent
      : (rawContent as Record<string, unknown>)?.guide_md as string ?? '');
  const title = editTitle ?? draft?.title ?? '';
  const description = editDescription ?? draft?.description ?? '';

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      await updateDraft.mutateAsync({
        draftId: draft.id,
        title,
        description,
        editedContent: { guide_md: markdownString } as DocStudioDraft['edited_content'],
      });
      showToast('Saved successfully', 'success');
    } catch {
      showToast('Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdownString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('Copied to clipboard', 'success');
    } catch {
      showToast('Copy failed', 'error');
    }
  }

  async function handleDownloadMarkdown() {
    const blob = new Blob([markdownString], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'tutorial'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadRenderManifest() {
    if (!renderManifest) {
      showToast('No render manifest found', 'error');
      return;
    }
    const blob = new Blob([JSON.stringify(renderManifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'tutorial'}-manifest.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleScene(id: string) {
    setScenesExpanded((p) => ({ ...p, [id]: !p[id] }));
  }

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-500">Loading your tutorial...</p>
        </div>
      </div>
    );
  }

  if (isError || !draft) {
    return (
      <div className="min-h-full flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-slate-500 mb-4">Tutorial not found</p>
          <button onClick={onBack} className="text-sm text-blue-600 underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  const OutputIcon = OUTPUT_TYPE_ICONS[draft.output_type as OutputType] ?? FileText;
  const totalDuration = scenes.reduce((acc, s) => {
    const end = typeof s.end_time_seconds === 'number' ? s.end_time_seconds : 0;
    return Math.max(acc, end);
  }, 0);

  return (
    <div className="min-h-full bg-white">
      <div className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">All Tutorials</span>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-slate-900 truncate">{draft.title}</h1>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <OutputIcon className="w-3 h-3" />
              <span>{OUTPUT_TYPE_LABELS[draft.output_type as OutputType]}</span>
              {scenes.length > 0 && (
                <>
                  <span>·</span>
                  <span>{scenes.length} scenes</span>
                </>
              )}
              {totalDuration > 0 && (
                <>
                  <span>·</span>
                  <Clock className="w-3 h-3" />
                  <span>
                    ~{Math.round(totalDuration / 60)}m {totalDuration % 60}s
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onAdvancedEdit(draftId)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Advanced</span>
            </button>
            {activeTab === 'edit' && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                Save
              </button>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 flex gap-1 border-t border-slate-100">
          {(['preview', 'edit', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'preview' && <BookOpen className="w-3.5 h-3.5 inline mr-1.5" />}
              {tab === 'edit' && <FileText className="w-3.5 h-3.5 inline mr-1.5" />}
              {tab === 'settings' && <Settings className="w-3.5 h-3.5 inline mr-1.5" />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === 'preview' && (
          <PreviewTab
            draftId={draftId}
            markdownContent={markdownString}
            scenes={scenes}
            scenesExpanded={scenesExpanded}
            onToggleScene={toggleScene}
            onCopy={handleCopyMarkdown}
            onDownloadMarkdown={handleDownloadMarkdown}
            onDownloadManifest={handleDownloadRenderManifest}
            copied={copied}
            outputType={draft.output_type}
            narrationAsset={narrationAsset ?? null}
            renderManifest={renderManifest ?? null}
            organizationId={draft.organization_id}
            onRefetch={refetch}
          />
        )}
        {activeTab === 'edit' && (
          <EditTab
            title={title}
            description={description}
            content={markdownString}
            scenes={scenes}
            onTitleChange={(v) => setEditTitle(v)}
            onDescriptionChange={(v) => setEditDescription(v)}
            onContentChange={(v) => setEditContent(v)}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab draft={draft} onAdvancedEdit={() => onAdvancedEdit(draftId)} />
        )}
      </div>
    </div>
  );
}

function PreviewTab({
  draftId,
  markdownContent,
  scenes,
  scenesExpanded,
  onToggleScene,
  onCopy,
  onDownloadMarkdown,
  onDownloadManifest,
  copied,
  outputType,
  narrationAsset,
  renderManifest,
  organizationId,
  onRefetch,
}: {
  draftId: string;
  markdownContent: string;
  scenes: SceneRow[];
  scenesExpanded: Record<string, boolean>;
  onToggleScene: (id: string) => void;
  onCopy: () => void;
  onDownloadMarkdown: () => void;
  onDownloadManifest: () => void;
  copied: boolean;
  outputType: OutputType;
  narrationAsset: NarrationAsset | null;
  renderManifest: RenderManifest | null;
  organizationId: string;
  onRefetch: () => void;
}) {
  const safeNarrationUrl =
    narrationAsset && isSafeExternalUrl(narrationAsset.public_url)
      ? narrationAsset.public_url
      : null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        {(outputType === 'narrated_video' || outputType === 'video_tutorial') && renderManifest && (
          <VideoPreviewCard renderManifest={renderManifest} narrationAsset={narrationAsset} />
        )}

        {markdownContent ? (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">Written Guide</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onCopy}
                  aria-label="Confirm" className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-white transition-colors"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={onDownloadMarkdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .md
                </button>
              </div>
            </div>
            <div className="p-5">
              <ResultMarkdownRenderer content={markdownContent} />
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No written guide content was generated.</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {(outputType === 'narrated_video' || outputType === 'video_tutorial') && (
          <NarrationPanel
            draftId={draftId}
            organizationId={organizationId}
            narrationAsset={narrationAsset}
            onRefetch={onRefetch}
          />
        )}

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Download className="w-4 h-4 text-slate-400" />
              Downloads
            </span>
          </div>
          <div className="p-4 space-y-2">
            <button
              onClick={onDownloadMarkdown}
              className="w-full flex items-center gap-2 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <FileText className="w-4 h-4 text-slate-400" />
              Written guide (.md)
            </button>
            {renderManifest && (
              <button
                onClick={onDownloadManifest}
                className="w-full flex items-center gap-2 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Video className="w-4 h-4 text-slate-400" />
                Render manifest (.json)
              </button>
            )}
            {safeNarrationUrl && (
              <a
                href={safeNarrationUrl}
                download
                className="w-full flex items-center gap-2 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Mic className="w-4 h-4 text-slate-400" />
                Narration audio (.mp3)
              </a>
            )}
          </div>
        </div>

        <SceneListExpandable
          scenes={scenes}
          scenesExpanded={scenesExpanded}
          onToggleScene={onToggleScene}
        />
      </div>
    </div>
  );
}

function EditTab({
  title,
  description,
  content,
  scenes,
  onTitleChange,
  onDescriptionChange,
  onContentChange,
}: {
  title: string;
  description: string;
  content: string;
  scenes: SceneRow[];
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onContentChange: (v: string) => void;
}) {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <span className="font-semibold">Quick editing:</span> Make changes below then click Save. For
          full scene-by-scene editing, narration scripts, timing, and rendering — use the{' '}
          <span className="font-semibold">Advanced</span> button above.
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
          Title
        </label>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={2}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Written Guide Content
          </label>
          <span className="text-xs text-slate-400">Markdown supported</span>
        </div>
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          rows={24}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      <SceneListCompact scenes={scenes} />
    </div>
  );
}

function SettingsTab({
  draft,
  onAdvancedEdit,
}: {
  draft: DocStudioDraft;
  onAdvancedEdit: () => void;
}) {
  const OutputIcon = OUTPUT_TYPE_ICONS[draft.output_type as OutputType] ?? FileText;
  const safeTargetUrl = draft.target_url && isSafeExternalUrl(draft.target_url) ? draft.target_url : null;
  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Tutorial Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-400 mb-1">Output type</p>
            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
              <OutputIcon className="w-4 h-4 text-slate-400" />
              {OUTPUT_TYPE_LABELS[draft.output_type as OutputType]}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Target audience</p>
            <div className="flex items-center gap-1.5 text-slate-700 font-medium capitalize">
              <Users className="w-4 h-4 text-slate-400" />
              {draft.target_role ?? 'Provider'}
            </div>
          </div>
          {draft.target_url && (
            <div className="col-span-2">
              <p className="text-xs text-slate-400 mb-1">Target URL</p>
              {safeTargetUrl ? (
                <a
                  href={safeTargetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-slate-700 font-medium hover:text-blue-600 transition-colors"
                >
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span className="truncate text-sm">{safeTargetUrl}</span>
                </a>
              ) : (
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span className="truncate text-sm">URL unavailable</span>
                </div>
              )}
            </div>
          )}
          <div>
            <p className="text-xs text-slate-400 mb-1">Status</p>
            <span className="text-slate-700 font-medium capitalize">{draft.status}</span>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Completeness</p>
            <span className="text-slate-700 font-medium">{draft.completeness_score}%</span>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Created</p>
            <span className="text-slate-600 text-xs">
              {new Date(draft.created_at).toLocaleDateString()}
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Last updated</p>
            <span className="text-slate-600 text-xs">
              {new Date(draft.updated_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-2">Advanced Controls</h3>
        <p className="text-xs text-slate-500 mb-4">
          Access narration scripts, scene timing, quality scoring, render settings, review workflow, and
          all advanced editing tools.
        </p>
        <button
          onClick={onAdvancedEdit}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors"
        >
          <Sliders className="w-4 h-4" />
          Open Advanced Editor
        </button>
      </div>
    </div>
  );
}
