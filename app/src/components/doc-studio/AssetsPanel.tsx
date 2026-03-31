import { useRef, useState } from 'react';
import { Image, Video, Mic, Upload, Trash2, ChevronDown, ChevronRight, Plus, Loader as Loader2, ExternalLink } from 'lucide-react';
import { AssetLightbox } from './AssetLightbox';
import { useUploadAsset, useDeleteAsset } from '../../hooks/useDocStudio';
import { useToast } from '../../lib/toast';
import { isSafeExternalUrl } from '../../lib/browser';
import type { DocStudioAsset, DocStudioDraft } from '../../types/doc-studio';
import type { ScreenshotRole } from '../../types/documentation';
import { SCREENSHOT_ROLE_LABELS } from '../../types/documentation';

const ROLE_BADGE_CLASSES: Record<ScreenshotRole, string> = {
  hero: 'bg-blue-600 text-white',
  step: 'bg-blue-600 text-white',
  context: 'bg-slate-500 text-white',
  recovery: 'bg-amber-500 text-white',
  cover: 'bg-green-600 text-white',
  validation: 'bg-emerald-600 text-white',
  failure: 'bg-red-500 text-white',
};

export function ScreenshotRoleBadge({ role }: { role: ScreenshotRole }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold leading-none ${ROLE_BADGE_CLASSES[role]}`}>
      {SCREENSHOT_ROLE_LABELS[role]}
    </span>
  );
}

interface SectionProps {
  title: string;
  icon: React.ElementType;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function AccordionSection({ title, icon: Icon, count, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-200 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">{title}</span>
          {count > 0 && (
            <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">{count}</span>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

interface Props {
  draft: DocStudioDraft;
  organizationId: string;
}

export function AssetsPanel({ draft, organizationId }: Props) {
  const { showToast } = useToast();
  const { upload, isUploading, progress } = useUploadAsset(draft.id, organizationId);
  const deleteAsset = useDeleteAsset();

  const [lightboxAssets, setLightboxAssets] = useState<DocStudioAsset[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const assets = draft.assets ?? [];
  const screenshots = assets.filter(a => a.asset_type === 'screenshot');
  const videos = assets.filter(a => a.asset_type === 'video');
  const audios = assets.filter(a => a.asset_type === 'audio');

  const handleUpload = async (files: FileList | null, type: DocStudioAsset['asset_type']) => {
    if (!files || !files.length) return;
    const file = files[0];
    try {
      await upload(file, { assetType: type });
      showToast(`${file.name} uploaded`, 'success');
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : 'Upload failed'), 'error');
    }
  };

  const handleDelete = async (assetId: string) => {
    try {
      await deleteAsset.mutateAsync({ assetId, draftId: draft.id, organizationId });
      showToast('Asset removed', 'success');
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : 'Delete failed'), 'error');
    }
  };

  const openLightbox = (assetList: DocStudioAsset[], index: number) => {
    setLightboxAssets(assetList);
    setLightboxIndex(index);
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      <AccordionSection title="Screenshots" icon={Image} count={screenshots.length}>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {screenshots.map((asset, i) => {
            const safeAssetUrl = isSafeExternalUrl(asset.public_url) ? asset.public_url : null;
            return (
            <div key={asset.id} className="group relative aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
              {safeAssetUrl ? (
                <img
                  src={safeAssetUrl}
                  alt={asset.file_name}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => openLightbox(screenshots, i)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center px-3 text-center text-[11px] text-slate-500">
                  Preview unavailable
                </div>
              )}
              <div className="absolute top-1 left-1 flex items-center gap-1 flex-wrap">
                {asset.screenshot_role && (
                  <ScreenshotRoleBadge role={asset.screenshot_role} />
                )}
                {asset.step_index !== null && !asset.screenshot_role && (
                  <div className="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                    S{(asset.step_index ?? 0) + 1}
                  </div>
                )}
                {asset.step_index !== null && asset.screenshot_role && (
                  <div className="bg-black/50 text-white text-xs font-mono px-1.5 py-0.5 rounded">
                    #{(asset.step_index ?? 0) + 1}
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    if (safeAssetUrl) openLightbox(screenshots, i);
                  }}
                  disabled={!safeAssetUrl}
                  className="p-1.5 rounded-full bg-white/20 text-white hover:bg-white/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(asset.id)}
                  className="p-1.5 rounded-full bg-red-500/80 text-white hover:bg-red-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
          })}
        </div>
        <input
          ref={screenshotInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => handleUpload(e.target.files, 'screenshot')}
        />
        <button
          onClick={() => screenshotInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          {isUploading ? `Uploading… ${progress}%` : 'Add Screenshot'}
        </button>
      </AccordionSection>

      <AccordionSection title="Video" icon={Video} count={videos.length} defaultOpen={false}>
        {videos.length > 0 ? (
          <div className="space-y-2 mb-3">
            {videos.map(asset => {
              const safeAssetUrl = isSafeExternalUrl(asset.public_url) ? asset.public_url : null;
              return (
              <div key={asset.id} className="bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                {safeAssetUrl ? (
                  <video src={safeAssetUrl} controls className="w-full" />
                ) : (
                  <div className="px-3 py-4 text-xs text-slate-500">Video preview unavailable</div>
                )}
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-xs text-slate-500 truncate">{asset.file_name}</span>
                  <button onClick={() => handleDelete(asset.id)} className="text-red-400 hover:text-red-600 transition-colors ml-2">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 mb-3">No video uploaded yet.</p>
        )}
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={e => handleUpload(e.target.files, 'video')}
        />
        <button
          onClick={() => videoInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Upload Video
        </button>
      </AccordionSection>

      <AccordionSection title="Audio / Narration" icon={Mic} count={audios.length} defaultOpen={false}>
        {audios.length > 0 ? (
          <div className="space-y-2 mb-3">
            {audios.map(asset => {
              const safeAssetUrl = isSafeExternalUrl(asset.public_url) ? asset.public_url : null;
              return (
              <div key={asset.id} className="bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">
                {safeAssetUrl ? (
                  <audio src={safeAssetUrl} controls className="w-full h-8 mb-1" />
                ) : (
                  <div className="text-xs text-slate-500 mb-1">Audio preview unavailable</div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 truncate">{asset.file_name}</span>
                  <button onClick={() => handleDelete(asset.id)} className="text-red-400 hover:text-red-600 transition-colors ml-2">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 mb-3">No narration uploaded.</p>
        )}
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={e => handleUpload(e.target.files, 'audio')}
        />
        <button
          onClick={() => audioInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
          Upload Narration
        </button>
      </AccordionSection>

      {lightboxAssets.length > 0 && (
        <AssetLightbox
          assets={lightboxAssets}
          initialIndex={lightboxIndex}
          currentIndex={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxAssets([])}
        />
      )}
    </div>
  );
}
