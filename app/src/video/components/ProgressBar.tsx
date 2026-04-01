import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { colors } from '../utils/theme';
import { FPS, TOTAL_FRAMES } from '../utils/constants';

export const VideoProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = frame / TOTAL_FRAMES;

  const timeElapsed = Math.floor(frame / FPS);
  const minutes = Math.floor(timeElapsed / 60);
  const seconds = timeElapsed % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const opacity = interpolate(frame, [0, 15, TOTAL_FRAMES - 15, TOTAL_FRAMES], [0, 0.7, 0.7, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 4,
        backgroundColor: `${colors.steel[900]}30`,
        opacity,
        zIndex: 9998,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress * 100}%`,
          background: `linear-gradient(90deg, ${colors.brand[500]}, ${colors.brand[600]})`,
          borderRadius: '0 2px 2px 0',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 12,
          top: -20,
          fontSize: 11,
          fontFamily: 'Inter, system-ui, sans-serif',
          color: colors.steel[400],
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {timeStr} / 2:00
      </div>
    </div>
  );
};
