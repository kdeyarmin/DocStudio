import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { colors, fonts } from '../utils/theme';
import { fadeIn, scaleIn, slideUp } from '../utils/animations';
import { FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from '../utils/constants';

export const BrandIntro: React.FC = () => {
  const frame = useCurrentFrame();

  const glowScale = scaleIn(frame, FPS, 0, { damping: 15, mass: 0.8 });
  const glowOpacity = interpolate(frame, [0, 20, 180, 240], [0, 0.6, 0.6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const logoOpacity = fadeIn(frame, 10, 20);
  const logoScale = scaleIn(frame, FPS, 8, { damping: 14, mass: 0.6 });

  const taglineOpacity = fadeIn(frame, 55, 18);
  const taglineY = slideUp(frame, 55, 25, 22);

  const subtitleOpacity = fadeIn(frame, 90, 18);
  const subtitleY = slideUp(frame, 90, 20, 22);

  const exitScale = interpolate(frame, [200, 240], [1, 1.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
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
        backgroundColor: colors.steel[50],
        fontFamily: fonts.sans,
        position: 'relative',
        overflow: 'hidden',
        transform: `scale(${exitScale})`,
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.brand[400]}40, transparent 70%)`,
          opacity: glowOpacity,
          transform: `scale(${glowScale})`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '10%',
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.brand[200]}30, transparent 70%)`,
          opacity: fadeIn(frame, 30, 30),
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '20%',
          right: '15%',
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.brand[300]}25, transparent 70%)`,
          opacity: fadeIn(frame, 45, 30),
        }}
      />

      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: `linear-gradient(135deg, ${colors.brand[600]}, ${colors.brand[400]})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 8px 32px ${colors.brand[600]}40`,
          }}
        >
          <span style={{ fontSize: 42, fontWeight: 800, color: colors.white }}>C</span>
        </div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: colors.steel[900],
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}
        >
          CareMetric
          <span style={{ color: colors.brand[600] }}> AI</span>
        </div>
      </div>

      <div
        style={{
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          marginTop: 28,
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 500,
            color: colors.steel[600],
            letterSpacing: '-0.01em',
          }}
        >
          AI-Powered Clinical Documentation
        </div>
      </div>

      <div
        style={{
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleY}px)`,
          marginTop: 16,
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 400,
            color: colors.steel[400],
          }}
        >
          See how fast a note gets done.
        </div>
      </div>
    </div>
  );
};
