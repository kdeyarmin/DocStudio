import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { colors, fonts } from '../utils/theme';
import { fadeIn, slideUp, scaleIn } from '../utils/animations';
import { FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from '../utils/constants';

export const ProblemStatement: React.FC = () => {
  const frame = useCurrentFrame();

  const bgOpacity = fadeIn(frame, 0, 12);

  const headlineOpacity = fadeIn(frame, 15, 15);
  const headlineY = slideUp(frame, 15, 30, 20);

  const clockScale = scaleIn(frame, FPS, 30, { damping: 10, mass: 0.4 });
  const clockRotation = interpolate(frame, [30, 150], [0, 720], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  const solutionOpacity = fadeIn(frame, 110, 18);
  const solutionY = slideUp(frame, 110, 25, 22);

  const lineWidth = interpolate(frame, [145, 190], [0, 600], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const exitOpacity = interpolate(frame, [210, 240], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.steel[900],
        fontFamily: fonts.sans,
        position: 'relative',
        overflow: 'hidden',
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 30%, ${colors.brand[950]}60, transparent 70%)`,
          opacity: bgOpacity,
        }}
      />

      <div
        style={{
          opacity: headlineOpacity,
          transform: `translateY(${headlineY}px)`,
          textAlign: 'center',
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: 54,
            fontWeight: 800,
            color: colors.white,
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            maxWidth: 900,
          }}
        >
          Clinicians spend{' '}
          <span style={{ color: colors.warning }}>2+ hours</span> a day
          <br />
          on documentation
        </div>
      </div>

      <div
        style={{
          marginTop: 40,
          opacity: clockScale > 0.1 ? 1 : 0,
          transform: `scale(${clockScale})`,
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: `3px solid ${colors.steel[500]}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: 3,
              height: 24,
              backgroundColor: colors.warning,
              position: 'absolute',
              bottom: '50%',
              transformOrigin: 'bottom center',
              transform: `rotate(${clockRotation}deg)`,
              borderRadius: 2,
            }}
          />
          <div
            style={{
              width: 3,
              height: 16,
              backgroundColor: colors.steel[400],
              position: 'absolute',
              bottom: '50%',
              transformOrigin: 'bottom center',
              transform: `rotate(${clockRotation * 0.08}deg)`,
              borderRadius: 2,
            }}
          />
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: colors.steel[400],
            }}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: 48,
          opacity: solutionOpacity,
          transform: `translateY(${solutionY}px)`,
          textAlign: 'center',
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 500,
            color: colors.steel[300],
            letterSpacing: '-0.01em',
          }}
        >
          What if that dropped to under{' '}
          <span
            style={{
              color: colors.brand[400],
              fontWeight: 700,
            }}
          >
            2 minutes
          </span>
          ?
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 80,
          width: lineWidth,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${colors.brand[500]}, transparent)`,
          borderRadius: 2,
          zIndex: 1,
        }}
      />
    </div>
  );
};
