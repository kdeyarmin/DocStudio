import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { colors, fonts } from '../utils/theme';
import { fadeIn } from '../utils/animations';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '../utils/constants';
import { MockSidebar } from '../components/MockSidebar';
import { MockHeader } from '../components/MockHeader';
import { AnimatedCursor } from '../components/AnimatedCursor';
import { TypewriterText } from '../components/TypewriterText';

const PATIENTS = [
  { name: 'Sarah Mitchell', mrn: 'MRN-10042', age: 54, status: 'Checked In', time: '9:00 AM', type: 'Follow-up' },
  { name: 'James Rodriguez', mrn: 'MRN-10038', age: 32, status: 'In Room', time: '9:15 AM', type: 'New Patient' },
  { name: 'Emily Chen', mrn: 'MRN-10055', age: 67, status: 'Scheduled', time: '9:30 AM', type: 'Annual Exam' },
  { name: 'Michael Thompson', mrn: 'MRN-10021', age: 45, status: 'Scheduled', time: '9:45 AM', type: 'Follow-up' },
  { name: 'Lisa Patel', mrn: 'MRN-10063', age: 29, status: 'Scheduled', time: '10:00 AM', type: 'Sick Visit' },
  { name: 'Robert Kim', mrn: 'MRN-10017', age: 71, status: 'Scheduled', time: '10:15 AM', type: 'Follow-up' },
];

const statusColors: Record<string, string> = {
  'Checked In': colors.brand[600],
  'In Room': colors.success,
  'Scheduled': colors.steel[400],
};

export const DashboardOverview: React.FC = () => {
  const frame = useCurrentFrame();

  const searchText = 'Sarah';
  const searchStartFrame = 60;
  const searchTypingEnd = searchStartFrame + Math.ceil(searchText.length / 1.5);

  const isSearching = frame > searchTypingEnd + 5;
  const filteredPatients = isSearching
    ? PATIENTS.filter((p) => p.name.toLowerCase().includes('sarah'))
    : PATIENTS;

  const clickPatientFrame = 150;
  const showPatientDetail = frame > clickPatientFrame + 10;

  const detailSlide = interpolate(frame, [clickPatientFrame + 10, clickPatientFrame + 30], [400, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const detailOpacity = fadeIn(frame, clickPatientFrame + 10, 15);

  const exitOpacity = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cursorKeyframes = [
    { frame: 30, x: 620, y: 92 },
    { frame: 50, x: 520, y: 92, click: true },
    { frame: searchTypingEnd + 20, x: 520, y: 92 },
    { frame: clickPatientFrame - 10, x: 520, y: 195 },
    { frame: clickPatientFrame, x: 520, y: 195, click: true },
    { frame: clickPatientFrame + 40, x: 900, y: 300 },
  ];

  return (
    <div
      style={{
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: colors.steel[50],
        fontFamily: fonts.sans,
        position: 'relative',
        overflow: 'hidden',
        opacity: exitOpacity,
      }}
    >
      <MockHeader showAfter={0} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <MockSidebar showAfter={0} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '20px 28px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: colors.steel[900],
                    opacity: fadeIn(frame, 5, 12),
                  }}
                >
                  Today's Schedule
                </div>
                <div style={{ fontSize: 13, color: colors.steel[400], marginTop: 2, opacity: fadeIn(frame, 10, 12) }}>
                  Monday, February 7, 2026 -- 6 patients
                </div>
              </div>
              <div
                style={{
                  opacity: fadeIn(frame, 15, 12),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: colors.steel[50],
                  border: `1px solid ${colors.steel[200]}`,
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: 13,
                  color: frame > searchStartFrame ? colors.steel[900] : colors.steel[400],
                  width: 260,
                }}
              >
                <span>🔍</span>
                {frame > searchStartFrame ? (
                  <TypewriterText
                    text={searchText}
                    startFrame={searchStartFrame}
                    charsPerFrame={1.5}
                    style={{ color: colors.steel[900] }}
                  />
                ) : (
                  <span>Search patients...</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: showPatientDetail ? 0.55 : 1, padding: '0 28px 20px', overflow: 'hidden' }}>
              <div
                style={{
                  backgroundColor: colors.white,
                  borderRadius: 12,
                  border: `1px solid ${colors.steel[200]}`,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 1fr 0.6fr 0.8fr 0.8fr 0.8fr',
                    padding: '10px 16px',
                    borderBottom: `1px solid ${colors.steel[100]}`,
                    fontSize: 11,
                    fontWeight: 600,
                    color: colors.steel[400],
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <div>Patient</div>
                  <div>MRN</div>
                  <div>Age</div>
                  <div>Time</div>
                  <div>Type</div>
                  <div>Status</div>
                </div>

                {filteredPatients.map((patient, i) => {
                  const rowOpacity = fadeIn(frame, 8 + i * 4, 10);
                  const isSelected = showPatientDetail && patient.name === 'Sarah Mitchell';
                  return (
                    <div
                      key={patient.mrn}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.5fr 1fr 0.6fr 0.8fr 0.8fr 0.8fr',
                        padding: '12px 16px',
                        borderBottom: `1px solid ${colors.steel[50]}`,
                        fontSize: 13,
                        color: colors.steel[700],
                        opacity: rowOpacity,
                        backgroundColor: isSelected ? colors.brand[50] : 'transparent',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: isSelected ? colors.brand[700] : colors.steel[900] }}>
                        {patient.name}
                      </div>
                      <div style={{ color: colors.steel[400], fontFamily: fonts.mono, fontSize: 12 }}>
                        {patient.mrn}
                      </div>
                      <div>{patient.age}</div>
                      <div>{patient.time}</div>
                      <div>{patient.type}</div>
                      <div>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 12,
                            backgroundColor: `${statusColors[patient.status]}15`,
                            color: statusColors[patient.status],
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: statusColors[patient.status],
                            }}
                          />
                          {patient.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {showPatientDetail && (
              <div
                style={{
                  flex: 0.45,
                  paddingRight: 28,
                  opacity: detailOpacity,
                  transform: `translateX(${detailSlide}px)`,
                  overflow: 'hidden',
                }}
              >
                <PatientDetailPanel frame={frame} baseFrame={clickPatientFrame + 15} />
              </div>
            )}
          </div>
        </div>
      </div>
      <AnimatedCursor keyframes={cursorKeyframes} showAfter={20} />
    </div>
  );
};

const PatientDetailPanel: React.FC<{ frame: number; baseFrame: number }> = ({ frame, baseFrame }) => {
  return (
    <div
      style={{
        backgroundColor: colors.white,
        borderRadius: 12,
        border: `1px solid ${colors.steel[200]}`,
        overflow: 'hidden',
        height: '100%',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${colors.steel[100]}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${colors.brand[400]}, ${colors.brand[600]})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.white,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          SM
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.steel[900] }}>Sarah Mitchell</div>
          <div style={{ fontSize: 12, color: colors.steel[400] }}>54 y/o Female -- DOB: 03/15/1971</div>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        <DetailRow label="MRN" value="MRN-10042" frame={frame} baseFrame={baseFrame} index={0} />
        <DetailRow label="Phone" value="(555) 234-5678" frame={frame} baseFrame={baseFrame} index={1} />
        <DetailRow label="Insurance" value="Blue Cross PPO" frame={frame} baseFrame={baseFrame} index={2} />
        <DetailRow label="Primary Provider" value="Dr. Sarah Chen" frame={frame} baseFrame={baseFrame} index={3} />

        <div style={{ marginTop: 16, opacity: fadeIn(frame, baseFrame + 30, 12) }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: colors.steel[500], marginBottom: 8 }}>
            Active Problems
          </div>
          {['Essential Hypertension (I10)', 'Type 2 Diabetes (E11.9)', 'Hyperlipidemia (E78.5)'].map((problem, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                color: colors.steel[700],
                padding: '4px 0',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: fadeIn(frame, baseFrame + 35 + i * 5, 10),
              }}
            >
              <span style={{ color: colors.warning, fontSize: 8 }}>●</span>
              {problem}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, opacity: fadeIn(frame, baseFrame + 55, 12) }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: colors.steel[500], marginBottom: 8 }}>
            Recent Vitals
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'BP', value: '145/92', color: colors.danger },
              { label: 'HR', value: '88 bpm', color: colors.success },
              { label: 'Temp', value: '98.6°F', color: colors.success },
              { label: 'SpO2', value: '97%', color: colors.success },
            ].map((vital, i) => (
              <div
                key={vital.label}
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  backgroundColor: colors.steel[50],
                  opacity: fadeIn(frame, baseFrame + 60 + i * 4, 8),
                }}
              >
                <div style={{ fontSize: 10, color: colors.steel[400] }}>{vital.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: vital.color }}>{vital.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{
  label: string;
  value: string;
  frame: number;
  baseFrame: number;
  index: number;
}> = ({ label, value, frame, baseFrame, index }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '6px 0',
      borderBottom: `1px solid ${colors.steel[50]}`,
      opacity: fadeIn(frame, baseFrame + 5 + index * 5, 10),
    }}
  >
    <span style={{ fontSize: 12, color: colors.steel[400] }}>{label}</span>
    <span style={{ fontSize: 12, fontWeight: 600, color: colors.steel[800] }}>{value}</span>
  </div>
);
