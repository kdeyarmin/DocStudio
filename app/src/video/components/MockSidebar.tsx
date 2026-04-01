import React from 'react';
import { useCurrentFrame } from 'remotion';
import { fadeIn } from '../utils/animations';
import { colors, fonts } from '../utils/theme';

interface NavItem {
  icon: string;
  label: string;
  active?: boolean;
  badge?: number;
}

const NAV_SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'OVERVIEW',
    items: [
      { icon: '▦', label: 'Dashboard' },
      { icon: '👤', label: 'Patients', active: true },
      { icon: '📅', label: 'Schedule' },
    ],
  },
  {
    title: 'CLINICAL',
    items: [
      { icon: '🩺', label: 'Encounters' },
      { icon: '💊', label: 'Prescriptions' },
      { icon: '🧪', label: 'Lab Results', badge: 3 },
      { icon: '📋', label: 'Orders', badge: 1 },
    ],
  },
  {
    title: 'ADMINISTRATIVE',
    items: [
      { icon: '💰', label: 'Billing' },
      { icon: '📊', label: 'Analytics' },
      { icon: '💬', label: 'Messages', badge: 5 },
      { icon: '⚙️', label: 'Settings' },
    ],
  },
];

interface MockSidebarProps {
  showAfter?: number;
  activeItem?: string;
}

export const MockSidebar: React.FC<MockSidebarProps> = ({ showAfter = 0, activeItem = 'Patients' }) => {
  const frame = useCurrentFrame();
  const opacity = fadeIn(frame, showAfter, 10);

  return (
    <div
      style={{
        width: 240,
        height: '100%',
        backgroundColor: colors.white,
        borderRight: `1px solid ${colors.steel[200]}`,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: fonts.sans,
        opacity,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '20px 16px',
          borderBottom: `1px solid ${colors.steel[100]}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `linear-gradient(135deg, ${colors.brand[600]}, ${colors.brand[400]})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.white,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          C
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.steel[900] }}>CareMetric</div>
          <div style={{ fontSize: 11, color: colors.steel[400] }}>AI-Powered EMR</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '12px 8px', overflowY: 'hidden' }}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: colors.steel[400],
                letterSpacing: '0.05em',
                padding: '0 8px',
                marginBottom: 6,
              }}
            >
              {section.title}
            </div>
            {section.items.map((item) => {
              const isActive = item.label === activeItem;
              return (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? colors.brand[700] : colors.steel[600],
                    backgroundColor: isActive ? colors.brand[50] : 'transparent',
                    marginBottom: 2,
                  }}
                >
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span
                      style={{
                        backgroundColor: colors.brand[600],
                        color: colors.white,
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 10,
                        minWidth: 18,
                        textAlign: 'center',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
