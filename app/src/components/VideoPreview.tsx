import React from 'react';
import { Player } from '@remotion/player';
import { CareMetricDemoVideo } from '../video/Video';
import { VIDEO_WIDTH, VIDEO_HEIGHT, FPS, TOTAL_FRAMES } from '../video/utils/constants';
export const VideoPreview: React.FC = () => {

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
          CareMetric AI Product Demo
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>
          2-minute product tour -- 1920x1080 @ 30fps
        </p>
      </div>

      <div
        style={{
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.1)',
          maxWidth: 1280,
          width: '100%',
        }}
      >
        <Player
          component={CareMetricDemoVideo}
          durationInFrames={TOTAL_FRAMES}
          fps={FPS}
          compositionWidth={VIDEO_WIDTH}
          compositionHeight={VIDEO_HEIGHT}
          style={{
            width: '100%',
          }}
          controls
          autoPlay={false}
          loop={false}
          clickToPlay
        />
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 16, alignItems: 'center' }}>
        <div
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            backgroundColor: 'rgba(255,255,255,0.1)',
            color: '#94a3b8',
            fontSize: 12,
          }}
        >
          Tip: Use the player controls to scrub through scenes
        </div>
      </div>

      <div style={{ marginTop: 32, color: '#475569', fontSize: 12, textAlign: 'center', maxWidth: 600 }}>
        <p>
          To render as MP4, run:{' '}
          <code
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 11,
              color: '#94a3b8',
            }}
          >
            npx remotion render src/video/index.ts CareMetricDemo out/demo.mp4
          </code>
        </p>
      </div>
    </div>
  );
};
