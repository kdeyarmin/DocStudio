import React from 'react';
import { useCurrentFrame } from 'remotion';
import { fadeIn } from '../utils/animations';
import { colors, fonts } from '../utils/theme';

interface MockHeaderProps {
  showAfter?: number;
  providerName?: string;
}

export const MockHeader: React.FC<MockHeaderProps> = ({
  showAfter = 0,
  providerName = 'Dr. Sarah Chen',
}) => {
  const frame = useCurrentFrame();
  const opacity = fadeIn(frame, showAfter, 10);

  return (
    <div
      style={{
        height: 56,
        backgroundColor: colors.white,
        borderBottom: `1px solid ${colors.steel[200]}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        fontFamily: fonts.sans,
        opacity,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.steel[50],
            border: `1px solid ${colors.steel[200]}`,
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            color: colors.steel[400],
            width: 280,
          }}
        >
          <span style={{ fontSize: 14 }}>🔍</span>
          <span>Search patients, codes, or commands...</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            position: 'relative',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            color: colors.steel[500],
            fontSize: 16,
          }}
        >
          🔔
          <div
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: colors.danger,
              border: `2px solid ${colors.white}`,
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${colors.brand[500]}, ${colors.brand[700]})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.white,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            SC
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.steel[800] }}>{providerName}</div>
            <div style={{ fontSize: 10, color: colors.steel[400] }}>Internal Medicine</div>
          </div>
        </div>
      </div>
    </div>
  );
};
