import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { colors, fonts } from '../utils/theme';
import { fadeIn, slideUp, progressFill } from '../utils/animations';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '../utils/constants';

interface FeatureSlide {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  startFrame: number;
  content: React.ReactNode;
}

export const FeatureMontage: React.FC = () => {
  const frame = useCurrentFrame();

  const slides: FeatureSlide[] = [
    {
      title: 'Integrated Billing',
      subtitle: 'Claim scrubbing, denial management, and revenue optimization',
      icon: '💰',
      color: colors.success,
      startFrame: 0,
      content: <BillingSlide frame={frame} />,
    },
    {
      title: 'Built-in Telehealth',
      subtitle: 'HIPAA-compliant video visits with auto-documentation',
      icon: '📹',
      color: colors.brand[600],
      startFrame: 120,
      content: <TelehealthSlide frame={frame - 120} />,
    },
    {
      title: 'Smart Scheduling',
      subtitle: 'Multi-provider calendars with automated reminders',
      icon: '📅',
      color: '#0ea5e9',
      startFrame: 240,
      content: <SchedulingSlide frame={frame - 240} />,
    },
    {
      title: 'Real-time Analytics',
      subtitle: 'AI-powered insights across your entire practice',
      icon: '📊',
      color: colors.warning,
      startFrame: 360,
      content: <AnalyticsSlide frame={frame - 360} />,
    },
  ];

  const activeIndex = slides.findIndex((slide, i) => {
    const next = slides[i + 1];
    return frame >= slide.startFrame && (!next || frame < next.startFrame);
  });

  const activeSlide = slides[Math.max(0, activeIndex)];

  const slideTransitionOpacity = interpolate(
    frame,
    [activeSlide.startFrame, activeSlide.startFrame + 12],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div
      style={{
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        backgroundColor: colors.steel[50],
        fontFamily: fonts.sans,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: 56,
          backgroundColor: colors.white,
          borderBottom: `1px solid ${colors.steel[200]}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 32px',
          gap: 12,
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
        <span style={{ fontSize: 16, fontWeight: 700, color: colors.steel[900] }}>CareMetric AI</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {slides.map((slide, i) => (
            <div
              key={i}
              style={{
                width: i === activeIndex ? 32 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === activeIndex ? slide.color : colors.steel[200],
                transition: 'all 0.3s',
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', opacity: slideTransitionOpacity }}>
        <div
          style={{
            width: 400,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 48px',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: `${activeSlide.color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              marginBottom: 20,
              opacity: fadeIn(frame, activeSlide.startFrame + 5, 10),
            }}
          >
            {activeSlide.icon}
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: colors.steel[900],
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              marginBottom: 12,
              opacity: fadeIn(frame, activeSlide.startFrame + 10, 12),
              transform: `translateY(${slideUp(frame, activeSlide.startFrame + 10, 20, 15)}px)`,
            }}
          >
            {activeSlide.title}
          </div>
          <div
            style={{
              fontSize: 15,
              color: colors.steel[500],
              lineHeight: 1.5,
              opacity: fadeIn(frame, activeSlide.startFrame + 18, 12),
              transform: `translateY(${slideUp(frame, activeSlide.startFrame + 18, 15, 15)}px)`,
            }}
          >
            {activeSlide.subtitle}
          </div>
        </div>
        <div style={{ flex: 1, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {activeSlide.content}
        </div>
      </div>
    </div>
  );
};

const BillingSlide: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ width: '100%', maxWidth: 800 }}>
    <div
      style={{
        backgroundColor: colors.white,
        borderRadius: 12,
        border: `1px solid ${colors.steel[200]}`,
        overflow: 'hidden',
        opacity: fadeIn(frame, 15, 12),
      }}
    >
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.steel[100]}`, fontSize: 13, fontWeight: 700, color: colors.steel[900] }}>
        Claims Pipeline
      </div>
      {[
        { id: 'CLM-2481', patient: 'Sarah Mitchell', amount: '$245.00', status: 'Scrubbed', statusColor: colors.success },
        { id: 'CLM-2480', patient: 'James Rodriguez', amount: '$180.00', status: 'Submitted', statusColor: colors.brand[600] },
        { id: 'CLM-2479', patient: 'Emily Chen', amount: '$312.00', status: 'Paid', statusColor: colors.success },
        { id: 'CLM-2478', patient: 'Michael Thompson', amount: '$195.00', status: 'Scrubbing...', statusColor: colors.warning },
      ].map((claim, i) => (
        <div
          key={claim.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr 0.8fr 0.8fr',
            padding: '10px 16px',
            borderBottom: `1px solid ${colors.steel[50]}`,
            fontSize: 12,
            opacity: fadeIn(frame, 25 + i * 8, 8),
            alignItems: 'center',
          }}
        >
          <span style={{ fontFamily: fonts.mono, color: colors.steel[400], fontSize: 11 }}>{claim.id}</span>
          <span style={{ fontWeight: 600, color: colors.steel[800] }}>{claim.patient}</span>
          <span style={{ fontWeight: 600, color: colors.steel[700] }}>{claim.amount}</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 10,
              backgroundColor: `${claim.statusColor}15`,
              color: claim.statusColor,
              textAlign: 'center',
            }}
          >
            {claim.status}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const TelehealthSlide: React.FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      width: '100%',
      maxWidth: 800,
      display: 'flex',
      gap: 16,
      opacity: fadeIn(frame, 10, 12),
    }}
  >
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          flex: 1,
          backgroundColor: colors.steel[800],
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          minHeight: 280,
        }}
      >
        <div style={{ fontSize: 48 }}>👩‍⚕️</div>
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            padding: '4px 10px',
            borderRadius: 6,
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: colors.white,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Dr. Sarah Chen
        </div>
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 4,
            backgroundColor: `${colors.success}30`,
            color: colors.success,
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.success }} />
          LIVE
        </div>
      </div>
      <div
        style={{
          height: 100,
          backgroundColor: colors.steel[700],
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: 32 }}>👤</div>
        <div
          style={{
            position: 'absolute',
            fontSize: 11,
            color: colors.steel[300],
            marginTop: 60,
          }}
        >
          Patient
        </div>
      </div>
    </div>
  </div>
);

const SchedulingSlide: React.FC<{ frame: number }> = ({ frame }) => {
  const hours = ['9:00', '9:30', '10:00', '10:30', '11:00', '11:30', '12:00'];
  const appointments = [
    { time: '9:00', name: 'S. Mitchell', type: 'Follow-up', color: colors.brand[500], span: 1 },
    { time: '9:30', name: 'J. Rodriguez', type: 'New Patient', color: colors.success, span: 2 },
    { time: '10:30', name: 'E. Chen', type: 'Annual', color: '#0ea5e9', span: 1 },
    { time: '11:00', name: 'M. Thompson', type: 'Sick Visit', color: colors.warning, span: 1 },
    { time: '11:30', name: 'L. Patel', type: 'Telehealth', color: '#8b5cf6', span: 1 },
  ];

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 800,
        backgroundColor: colors.white,
        borderRadius: 12,
        border: `1px solid ${colors.steel[200]}`,
        overflow: 'hidden',
        opacity: fadeIn(frame, 10, 12),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${colors.steel[100]}` }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: colors.steel[900] }}>Mon, Feb 7</span>
        <span style={{ fontSize: 11, color: colors.steel[400] }}>Dr. Sarah Chen</span>
      </div>
      <div style={{ padding: '8px 0' }}>
        {hours.map((hour, i) => {
          const appt = appointments.find((a) => a.time === hour);
          return (
            <div
              key={hour}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                padding: '0 16px',
                minHeight: 40,
                borderBottom: `1px solid ${colors.steel[50]}`,
                opacity: fadeIn(frame, 20 + i * 6, 8),
              }}
            >
              <div style={{ width: 50, fontSize: 11, color: colors.steel[400], paddingTop: 10, flexShrink: 0 }}>
                {hour}
              </div>
              {appt && (
                <div
                  style={{
                    flex: 1,
                    backgroundColor: `${appt.color}15`,
                    borderLeft: `3px solid ${appt.color}`,
                    borderRadius: '0 6px 6px 0',
                    padding: '6px 10px',
                    margin: '2px 0',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: colors.steel[800] }}>{appt.name}</div>
                  <div style={{ fontSize: 10, color: appt.color }}>{appt.type}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AnalyticsSlide: React.FC<{ frame: number }> = ({ frame }) => {
  const metrics = [
    { label: 'Revenue MTD', value: '$124,850', change: '+12.4%', positive: true },
    { label: 'Clean Claim Rate', value: '97.2%', change: '+3.1%', positive: true },
    { label: 'Avg Days in AR', value: '18.5', change: '-4.2', positive: true },
    { label: 'Patient Satisfaction', value: '4.8/5', change: '+0.3', positive: true },
  ];

  return (
    <div style={{ width: '100%', maxWidth: 800, opacity: fadeIn(frame, 10, 12) }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {metrics.map((metric, i) => (
          <div
            key={metric.label}
            style={{
              padding: 20,
              backgroundColor: colors.white,
              borderRadius: 12,
              border: `1px solid ${colors.steel[200]}`,
              opacity: fadeIn(frame, 15 + i * 10, 10),
              transform: `translateY(${slideUp(frame, 15 + i * 10, 15, 12)}px)`,
            }}
          >
            <div style={{ fontSize: 11, color: colors.steel[400], marginBottom: 6 }}>{metric.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: colors.steel[900], letterSpacing: '-0.02em' }}>
              {metric.value}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: metric.positive ? colors.success : colors.danger,
                marginTop: 4,
              }}
            >
              {metric.change}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          backgroundColor: colors.white,
          borderRadius: 12,
          border: `1px solid ${colors.steel[200]}`,
          padding: 20,
          opacity: fadeIn(frame, 60, 12),
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: colors.steel[500], marginBottom: 12 }}>Revenue Trend</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
          {[65, 72, 58, 85, 78, 92, 88, 95, 90, 100, 96, 105].map((val, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${val * progressFill(frame, 70 + i * 3, 20)}%`,
                backgroundColor: i >= 10 ? colors.brand[600] : colors.brand[200],
                borderRadius: '3px 3px 0 0',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
