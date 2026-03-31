import { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Image as ImageIcon } from 'lucide-react';
import type { DocStudioAsset } from '../../types/doc-studio';
import { ScreenshotRoleBadge } from './AssetsPanel';
import { isSafeExternalUrl } from '../../lib/browser';

interface Props {
  assets: DocStudioAsset[];
  initialIndex: number;
  currentIndex: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}

export function AssetLightbox({ assets, initialIndex: _, currentIndex, onIndexChange, onClose }: Props) {
  const asset = assets[currentIndex];
  const safeAssetUrl = asset && isSafeExternalUrl(asset.public_url) ? asset.public_url : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onIndexChange(Math.max(0, currentIndex - 1));
      else if (e.key === 'ArrowRight') onIndexChange(Math.min(assets.length - 1, currentIndex + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIndex, assets.length, onClose, onIndexChange]);

  if (!asset) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <button
        onClick={onClose}
        aria-label="Close" className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
      >
        <X className="w-5 h-5" />
      </button>

      {currentIndex > 0 && (
        <button
          onClick={() => onIndexChange(currentIndex - 1)}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {currentIndex < assets.length - 1 && (
        <button
          onClick={() => onIndexChange(currentIndex + 1)}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      <div className="max-w-5xl max-h-[85vh] flex flex-col items-center gap-3 px-16">
        {asset.asset_type === 'screenshot' ? (
          <div className="relative">
            {safeAssetUrl ? (
              <img
                src={safeAssetUrl}
                alt={asset.file_name}
                className="max-h-[75vh] object-contain rounded-lg shadow-2xl"
              />
            ) : (
              <div className="w-[24rem] max-w-full h-48 rounded-lg border border-slate-700 bg-slate-800 flex items-center justify-center px-4 text-center text-sm text-slate-300">
                Preview unavailable
              </div>
            )}
            {asset.screenshot_role && (
              <div className="absolute top-3 left-3">
                <ScreenshotRoleBadge role={asset.screenshot_role} />
              </div>
            )}
            {asset.step_index !== null && (
              <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-mono px-2 py-1 rounded">
                Step {(asset.step_index ?? 0) + 1}
              </div>
            )}
          </div>
        ) : asset.asset_type === 'video' ? (
          safeAssetUrl ? (
            <video
              src={safeAssetUrl}
              controls
              className="max-h-[75vh] rounded-lg shadow-2xl"
            />
          ) : (
            <div className="w-[24rem] max-w-full h-48 rounded-lg border border-slate-700 bg-slate-800 flex items-center justify-center px-4 text-center text-sm text-slate-300">
              Video unavailable
            </div>
          )
        ) : (
          <div className="w-96 bg-slate-800 rounded-lg p-8 flex flex-col items-center gap-4">
            <ImageIcon className="w-16 h-16 text-slate-500" />
            <p className="text-white font-medium">{asset.file_name}</p>
          </div>
        )}

        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-white/70 text-sm truncate">{asset.file_name}</p>
            {asset.screenshot_role && asset.asset_type === 'screenshot' && (
              <ScreenshotRoleBadge role={asset.screenshot_role} />
            )}
            {asset.step_index !== null && !asset.screenshot_role && (
              <span className="text-blue-400 text-xs flex-shrink-0">Step {(asset.step_index ?? 0) + 1}</span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-white/50 text-xs">
              {currentIndex + 1} / {assets.length}
            </span>
            {safeAssetUrl ? (
              <a
                href={safeAssetUrl}
                download={asset.file_name}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-white bg-white/10 hover:bg-white/20 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            ) : (
              <span className="text-xs text-white/50">Download unavailable</span>
            )}
          </div>
        </div>
      </div>

      {assets.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2 px-4">
          <div className="flex gap-1.5 bg-black/50 rounded-full px-3 py-2">
            {assets.map((a, i) => (
              <button
                key={i}
                onClick={() => onIndexChange(i)}
                title={a.screenshot_role ?? undefined}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === currentIndex ? 'bg-white w-4' : 'bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
