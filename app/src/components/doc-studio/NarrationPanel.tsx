import { Mic, RefreshCw } from 'lucide-react';
import type { NarrationAsset } from './result-types';
import { isSafeExternalUrl } from '../../lib/browser';

interface NarrationPanelProps {
  draftId: string;
  organizationId: string;
  narrationAsset: NarrationAsset | null;
  onRefetch: () => void;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return 'Not available';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function NarrationPanel({ draftId, organizationId, narrationAsset, onRefetch }: NarrationPanelProps) {
  const safeNarrationUrl = narrationAsset?.public_url && isSafeExternalUrl(narrationAsset.public_url)
    ? narrationAsset.public_url
    : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Mic className="h-4 w-4 text-slate-400" />
          Narration
        </span>
      </div>
      <div className="space-y-4 p-4 text-sm text-slate-600">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Draft</div>
          <div className="mt-1 break-all font-mono text-xs text-slate-600">{draftId}</div>
          <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Organization</div>
          <div className="mt-1 break-all font-mono text-xs text-slate-600">{organizationId}</div>
        </div>

        {narrationAsset ? (
          <>
            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="font-semibold text-emerald-800">Narration audio ready</div>
              <div>Duration: {formatDuration(narrationAsset.duration_seconds)}</div>
              <div>Size: {formatFileSize(narrationAsset.file_size_bytes)}</div>
            </div>
            {safeNarrationUrl ? (
              <>
                <audio controls className="w-full" src={safeNarrationUrl} preload="none">
                  Your browser does not support audio playback.
                </audio>
                <a
                  href={safeNarrationUrl}
                  download
                  className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white hover:bg-slate-800"
                >
                  Download narration audio
                </a>
              </>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                Narration link is unavailable.
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
            No narration asset has been generated for this draft yet.
          </div>
        )}

        <button
          type="button"
          onClick={onRefetch}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh assets
        </button>
      </div>
    </div>
  );
}
