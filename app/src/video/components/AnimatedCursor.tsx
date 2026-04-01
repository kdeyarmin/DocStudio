import React from 'react';
import { useCurrentFrame } from 'remotion';
import { cursorPosition, fadeIn } from '../utils/animations';
import { colors } from '../utils/theme';

interface CursorKeyframe {
  frame: number;
  x: number;
  y: number;
  click?: boolean;
}

interface AnimatedCursorProps {
  keyframes: CursorKeyframe[];
  showAfter?: number;
}

export const AnimatedCursor: React.FC<AnimatedCursorProps> = ({ keyframes, showAfter = 0 }) => {
  const frame = useCurrentFrame();
  const opacity = fadeIn(frame, showAfter, 8);
  const pos = cursorPosition(frame, keyframes);

  const isClicking = keyframes.some(
    (kf) => kf.click && Math.abs(frame - kf.frame) < 4,
  );

  const clickRippleOpacity = isClicking
    ? Math.max(0, 1 - (frame % 8) / 8)
    : 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        opacity,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {clickRippleOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            width: 30,
            height: 30,
            borderRadius: '50%',
            backgroundColor: colors.brand[600],
            opacity: clickRippleOpacity * 0.3,
            transform: `translate(-50%, -50%) scale(${1 + (1 - clickRippleOpacity) * 1.5})`,
            left: 0,
            top: 0,
          }}
        />
      )}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        style={{
          filter: 'drop-shadow(1px 2px 3px rgba(0,0,0,0.3))',
          transform: isClicking ? 'scale(0.85)' : 'scale(1)',
          transition: 'transform 0.05s',
        }}
      >
        <path
          d="M5 3L19 12L12 13L9 20L5 3Z"
          fill={colors.white}
          stroke={colors.steel[800]}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
