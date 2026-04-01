import React from 'react';
import { useCurrentFrame } from 'remotion';
import { countUp, fadeIn, slideUp } from '../utils/animations';
import { colors, fonts } from '../utils/theme';

interface StatCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  icon: string;
  startFrame: number;
  color?: string;
}

export const StatCounter: React.FC<StatCounterProps> = ({
  value,
  suffix = '',
  prefix = '',
  label,
  icon,
  startFrame,
  color = colors.brand[600],
}) => {
  const frame = useCurrentFrame();
  const opacity = fadeIn(frame, startFrame, 12);
  const translateY = slideUp(frame, startFrame, 30, 18);
  const displayValue = countUp(frame, startFrame + 5, value, 35);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        fontFamily: fonts.sans,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: 48,
          fontWeight: 800,
          color,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        {prefix}{displayValue}{suffix}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: colors.steel[500],
          textAlign: 'center',
        }}
      >
        {label}
      </div>
    </div>
  );
};
