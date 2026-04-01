import React from 'react';
import { useCurrentFrame } from 'remotion';
import { colors, fonts } from '../utils/theme';
import { fadeIn, slideUp, scaleIn } from '../utils/animations';
import { FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from '../utils/constants';
import { StatCounter } from '../components/StatCounter';

export const ClosingCTA: React.FC = () => {
  const frame = useCurrentFrame();

  const logoOpacity = fadeIn(frame, 10, 15);
  const logoScale = scaleIn(frame, FPS, 8, { damping: 14, mass: 0.6 });

  const statsStart = 40;
  const taglineStart = 180;
  const ctaStart = 230;
  const urlStart = 270;

  const blob1X = Math.sin(frame * 0.02) * 30;
  const blob1Y = Math.cos(frame * 0.015) * 20;
  const blob2X = Math.cos(frame * 0.025) * 25;
  const blob2Y = Math.sin(frame * 0.02) * 30;

  return (
    <div
      style={{
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.white,
        fontFamily: fonts.sans,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '5%',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.brand[100]}40, transparent 70%)`,
          transform: `translate(${blob1X}px, ${blob1Y}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '10%',
          width: 250,
          height: 250,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.brand[200]}30, transparent 70%)`,
          transform: `translate(${blob2X}px, ${blob2Y}px)`,
        }}
      />

      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 48,
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${colors.brand[600]}, ${colors.brand[400]})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.white,
            fontSize: 28,
            fontWeight: 800,
            boxShadow: `0 6px 24px ${colors.brand[600]}30`,
          }}
        >
          C
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, color: colors.steel[900], letterSpacing: '-0.02em' }}>
          CareMetric<span style={{ color: colors.brand[600] }}> AI</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 80,
          marginBottom: 56,
          zIndex: 1,
        }}
      >
        <StatCounter
          value={15}
          suffix="s"
          label="Average note generation"
          icon="⚡"
          startFrame={statsStart}
          color={colors.brand[600]}
        />
        <StatCounter
          value={0}
          suffix=""
          prefix=""
          label="After-hours charting"
          icon="🌙"
          startFrame={statsStart + 20}
          color={colors.success}
        />
        <StatCounter
          value={99}
          suffix="%"
          label="Clinical accuracy"
          icon="🛡️"
          startFrame={statsStart + 40}
          color="#0ea5e9"
        />
      </div>

      <div
        style={{
          opacity: fadeIn(frame, taglineStart, 18),
          transform: `translateY(${slideUp(frame, taglineStart, 25, 20)}px)`,
          textAlign: 'center',
          marginBottom: 36,
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: 40,
            fontWeight: 800,
            color: colors.steel[900],
            letterSpacing: '-0.03em',
            lineHeight: 1.3,
          }}
        >
          Documentation done.
          <br />
          <span style={{ color: colors.brand[600] }}>Before the patient leaves.</span>
        </div>
      </div>

      <div
        style={{
          opacity: fadeIn(frame, ctaStart, 15),
          transform: `translateY(${slideUp(frame, ctaStart, 20, 18)}px) scale(${scaleIn(frame, FPS, ctaStart, { damping: 12, mass: 0.5 })})`,
          zIndex: 1,
        }}
      >
        <div
          style={{
            padding: '16px 48px',
            borderRadius: 12,
            background: `linear-gradient(135deg, ${colors.brand[600]}, ${colors.brand[500]})`,
            color: colors.white,
            fontSize: 20,
            fontWeight: 700,
            boxShadow: `0 8px 32px ${colors.brand[600]}30`,
            letterSpacing: '-0.01em',
          }}
        >
          Start Your Free Trial
        </div>
      </div>

      <div
        style={{
          opacity: fadeIn(frame, urlStart, 15),
          marginTop: 20,
          fontSize: 18,
          color: colors.steel[400],
          fontWeight: 500,
          zIndex: 1,
        }}
      >
        caremetric.ai
      </div>
    </div>
  );
};
