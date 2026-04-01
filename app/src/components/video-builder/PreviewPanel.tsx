import { useMemo } from 'react';
import { Player } from '@remotion/player';
import { Monitor } from 'lucide-react';
import { CareMetricDemoVideo } from '../../video/Video';
import { VIDEO_WIDTH, VIDEO_HEIGHT, FPS } from '../../video/utils/constants';
import { SceneConfig } from './types';

interface PreviewPanelProps {
  scenes: SceneConfig[];
  selectedSceneId: string | null;
}

export function PreviewPanel({ scenes, selectedSceneId }: PreviewPanelProps) {
  const totalSeconds = scenes.filter((s) => s.enabled).reduce((sum, s) => sum + s.durationSeconds, 0);
  const totalFrames = totalSeconds * FPS;

  const sceneStartFrame = useMemo(() => {
    if (!selectedSceneId) return 0;
    let cumulative = 0;
    for (const scene of scenes) {
      if (scene.id === selectedSceneId) return cumulative;
      if (scene.enabled) cumulative += scene.durationSeconds * FPS;
    }
    return 0;
  }, [scenes, selectedSceneId]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Preview</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            {VIDEO_WIDTH}x{VIDEO_HEIGHT} @ {FPS}fps
          </span>
        </div>
      </div>

      <div className="bg-slate-900 relative">
        <Player
          component={CareMetricDemoVideo}
          durationInFrames={totalFrames > 0 ? totalFrames : FPS * 120}
          fps={FPS}
          compositionWidth={VIDEO_WIDTH}
          compositionHeight={VIDEO_HEIGHT}
          style={{ width: '100%' }}
          controls
          autoPlay={false}
          loop={false}
          clickToPlay
          initialFrame={sceneStartFrame}
        />
      </div>

      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="text-[10px] text-slate-400">
          {scenes.filter((s) => s.enabled).length} scenes active
        </div>
        <div className="text-[10px] text-slate-400">
          Tip: Click a scene in the timeline to jump to it
        </div>
      </div>
    </div>
  );
}
