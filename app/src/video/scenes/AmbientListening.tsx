import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { colors, fonts } from '../utils/theme';
import { fadeIn, slideUp, slideIn } from '../utils/animations';
import { VIDEO_WIDTH, VIDEO_HEIGHT, FPS } from '../utils/constants';
import { AnimatedCursor } from '../components/AnimatedCursor';
import { TRANSCRIPT_LINES, AMBIENT_GENERATED_NOTE, AMBIENT_CODES } from './ambientData';

const CLICK_RECORD = 35;
const RECORDING_START = 50;
const CLICK_STOP = 600;
const PROCESSING_START = 615;
const NOTE_REVEAL = 700;
const APPROVE_CLICK = 920;
const TOAST_SHOW = 940;

export const AmbientListening: React.FC = () => {
  const frame = useCurrentFrame();

  const isRecording = frame >= RECORDING_START && frame < CLICK_STOP;
  const isProcessing = frame >= PROCESSING_START && frame < NOTE_REVEAL;
  const showNote = frame >= NOTE_REVEAL;
  const showToast = frame >= TOAST_SHOW;

  const exitOpacity = interpolate(frame, [990, 1020], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cursorKeyframes = [
    { frame: 15, x: 960, y: 440 },
    { frame: CLICK_RECORD, x: 960, y: 440, click: true },
    { frame: CLICK_STOP - 20, x: 960, y: 440 },
    { frame: CLICK_STOP, x: 960, y: 500, click: true },
    { frame: NOTE_REVEAL + 100, x: 1200, y: 400 },
    { frame: APPROVE_CLICK - 10, x: 960, y: 820 },
    { frame: APPROVE_CLICK, x: 960, y: 820, click: true },
  ];

  return (
    <div
      style={{
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        background: isRecording
          ? `linear-gradient(135deg, ${colors.steel[900]}, ${colors.steel[800]})`
          : colors.steel[50],
        fontFamily: fonts.sans,
        position: 'relative',
        overflow: 'hidden',
        opacity: exitOpacity,
      }}
    >
      <TopBar frame={frame} isRecording={isRecording} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 60px', overflow: 'hidden' }}>
        {!showNote && !isProcessing && (
          <RecordingInterface
            frame={frame}
            isRecording={isRecording}
          />
        )}

        {isProcessing && <ProcessingOverlay frame={frame} />}

        {showNote && (
          <GeneratedNoteModal
            frame={frame}
            baseFrame={NOTE_REVEAL}
            approveFrame={APPROVE_CLICK}
            showToast={showToast}
          />
        )}
      </div>

      <AnimatedCursor keyframes={cursorKeyframes} showAfter={5} />
    </div>
  );
};

const TopBar: React.FC<{ frame: number; isRecording: boolean }> = ({ frame: _frame, isRecording }) => (
  <div
    style={{
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      borderBottom: `1px solid ${isRecording ? colors.steel[700] : colors.steel[200]}`,
      backgroundColor: isRecording ? `${colors.steel[800]}80` : colors.white,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
      <span style={{ fontSize: 16, fontWeight: 700, color: isRecording ? colors.white : colors.steel[900] }}>
        Ambient Clinical Assistant
      </span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, color: isRecording ? colors.steel[400] : colors.steel[500] }}>
        Visit: Sarah Mitchell -- Follow-up
      </span>
    </div>
  </div>
);

const RecordingInterface: React.FC<{ frame: number; isRecording: boolean }> = ({ frame, isRecording }) => {
  const recordingSeconds = isRecording ? Math.floor((frame - RECORDING_START) / FPS) : 0;
  const minutes = Math.floor(recordingSeconds / 60);
  const secs = recordingSeconds % 60;

  return (
    <div style={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, marginTop: 32 }}>
      {!isRecording && (
        <div style={{ textAlign: 'center', opacity: fadeIn(frame, 5, 15) }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: colors.steel[900], marginBottom: 8 }}>
            Start Recording Your Visit
          </div>
          <div style={{ fontSize: 15, color: colors.steel[500] }}>
            CareMetric AI will listen and generate a complete clinical note
          </div>
        </div>
      )}

      {isRecording && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: colors.danger,
                opacity: frame % 30 < 20 ? 1 : 0.3,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.danger }}>RECORDING</span>
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              color: colors.white,
              fontVariantNumeric: 'tabular-nums',
              fontFamily: fonts.mono,
            }}
          >
            {minutes}:{secs.toString().padStart(2, '0')}
          </div>
        </div>
      )}

      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: isRecording
            ? `linear-gradient(135deg, ${colors.danger}, #dc2626)`
            : `linear-gradient(135deg, ${colors.brand[600]}, ${colors.brand[400]})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isRecording
            ? `0 0 30px ${colors.danger}40`
            : `0 4px 20px ${colors.brand[600]}30`,
          opacity: fadeIn(frame, 5, 10),
        }}
      >
        {isRecording ? (
          <div style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: colors.white }} />
        ) : (
          <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: colors.white }} />
        )}
      </div>

      {isRecording && (
        <>
          <AudioVisualization frame={frame} />
          <TranscriptFeed frame={frame} />
        </>
      )}
    </div>
  );
};

const AudioVisualization: React.FC<{ frame: number }> = ({ frame }) => {
  const bars = 32;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        height: 60,
        width: '100%',
        maxWidth: 500,
        opacity: fadeIn(frame, RECORDING_START, 15),
      }}
    >
      {Array.from({ length: bars }).map((_, i) => {
        const seed = Math.sin(i * 1.7 + frame * 0.15) * 0.5 + 0.5;
        const secondWave = Math.cos(i * 0.9 + frame * 0.08) * 0.3 + 0.5;
        const height = 8 + (seed * secondWave) * 50;
        return (
          <div
            key={i}
            style={{
              width: 6,
              height,
              borderRadius: 3,
              background: `linear-gradient(180deg, ${colors.brand[400]}, ${colors.brand[600]})`,
              opacity: 0.6 + seed * 0.4,
            }}
          />
        );
      })}
    </div>
  );
};

const TranscriptFeed: React.FC<{ frame: number }> = ({ frame }) => {
  const relativeFrame = frame - RECORDING_START;
  const visibleLines = TRANSCRIPT_LINES.filter((line) => relativeFrame >= line.revealFrame);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 800,
        backgroundColor: `${colors.steel[800]}60`,
        borderRadius: 12,
        padding: 16,
        maxHeight: 280,
        overflow: 'hidden',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: colors.steel[400], marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Live Transcription
      </div>
      {visibleLines.map((line, i) => {
        const lineFrame = RECORDING_START + line.revealFrame;
        const lineOpacity = fadeIn(frame, lineFrame, 10);
        const lineSlide = slideUp(frame, lineFrame, 15, 12);
        const isProvider = line.speaker === 'provider';
        return (
          <div
            key={i}
            style={{
              opacity: lineOpacity,
              transform: `translateY(${lineSlide}px)`,
              display: 'flex',
              gap: 10,
              marginBottom: 10,
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: isProvider ? colors.brand[400] : colors.success,
                minWidth: 60,
                textTransform: 'uppercase',
                paddingTop: 2,
              }}
            >
              {isProvider ? 'Provider' : 'Patient'}
            </div>
            <div style={{ fontSize: 13, color: colors.steel[200], lineHeight: 1.5 }}>
              {line.text}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ProcessingOverlay: React.FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      opacity: fadeIn(frame, PROCESSING_START, 12),
    }}
  >
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        border: `3px solid ${colors.steel[200]}`,
        borderTopColor: colors.brand[600],
        transform: `rotate(${(frame * 12) % 360}deg)`,
      }}
    />
    <div style={{ marginTop: 24, fontSize: 20, fontWeight: 700, color: colors.steel[900] }}>
      Processing Recording
    </div>
    <div style={{ marginTop: 6, fontSize: 14, color: colors.steel[400] }}>
      Generating clinical documentation from conversation...
    </div>
  </div>
);

const GeneratedNoteModal: React.FC<{
  frame: number;
  baseFrame: number;
  approveFrame: number;
  showToast: boolean;
}> = ({ frame, baseFrame, approveFrame, showToast }) => {
  const modalOpacity = fadeIn(frame, baseFrame, 15);
  const modalScale = interpolate(frame, [baseFrame, baseFrame + 15], [0.95, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const noteSections = [
    { title: 'Chief Complaint', content: AMBIENT_GENERATED_NOTE.chiefComplaint, color: colors.steel[600], delay: 15 },
    { title: 'Subjective', content: AMBIENT_GENERATED_NOTE.subjective, color: colors.brand[600], delay: 35 },
    { title: 'Objective', content: AMBIENT_GENERATED_NOTE.objective, color: colors.success, delay: 55 },
    { title: 'Assessment', content: AMBIENT_GENERATED_NOTE.assessment, color: colors.warning, delay: 75 },
    { title: 'Plan', content: AMBIENT_GENERATED_NOTE.plan, color: '#0ea5e9', delay: 95 },
  ];

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 1000,
        opacity: modalOpacity,
        transform: `scale(${modalScale})`,
        marginTop: 12,
      }}
    >
      <div
        style={{
          backgroundColor: colors.white,
          borderRadius: 16,
          border: `1px solid ${colors.steel[200]}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${colors.steel[100]}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>✨</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: colors.steel[900] }}>AI-Generated Note</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {AMBIENT_CODES.map((code, i) => (
              <span
                key={code.code}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 4,
                  backgroundColor: colors.brand[50],
                  color: colors.brand[700],
                  fontFamily: fonts.mono,
                  opacity: fadeIn(frame, baseFrame + 40 + i * 10, 10),
                }}
              >
                {code.code}
              </span>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px 24px', display: 'flex', gap: 16, maxHeight: 550, overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {noteSections.map((section) => {
              const sectionOpacity = fadeIn(frame, baseFrame + section.delay, 12);
              const sectionSlide = slideIn(frame, baseFrame + section.delay, 20, 15);
              return (
                <div
                  key={section.title}
                  style={{
                    opacity: sectionOpacity,
                    transform: `translateX(${sectionSlide}px)`,
                    borderLeft: `3px solid ${section.color}`,
                    padding: '6px 12px',
                    backgroundColor: `${section.color}06`,
                    borderRadius: '0 6px 6px 0',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: section.color, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {section.title}
                  </div>
                  <div style={{ fontSize: 11, color: colors.steel[600], lineHeight: 1.5 }}>
                    {section.content}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            padding: '12px 24px',
            borderTop: `1px solid ${colors.steel[100]}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: colors.steel[400] }}>
            Generated from 18 seconds of audio -- 8 transcript segments
          </span>
          <div
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              background: frame >= approveFrame
                ? colors.success
                : `linear-gradient(135deg, ${colors.success}, #059669)`,
              color: colors.white,
              fontSize: 13,
              fontWeight: 700,
              opacity: fadeIn(frame, baseFrame + 120, 12),
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {frame >= approveFrame ? '✓ Saved' : 'Approve & Save to Visit'}
          </div>
        </div>
      </div>

      {frame >= baseFrame + 140 && (
        <div
          style={{
            textAlign: 'center',
            marginTop: 20,
            opacity: fadeIn(frame, baseFrame + 140, 15),
          }}
        >
          <div
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              borderRadius: 8,
              background: `linear-gradient(135deg, ${colors.brand[600]}, ${colors.brand[500]})`,
              color: colors.white,
              fontSize: 16,
              fontWeight: 700,
              boxShadow: `0 4px 16px ${colors.brand[600]}30`,
            }}
          >
            From conversation to compliant note. Zero typing.
          </div>
        </div>
      )}

      {showToast && (
        <div
          style={{
            position: 'absolute',
            top: 80,
            right: 32,
            padding: '12px 20px',
            borderRadius: 8,
            backgroundColor: colors.success,
            color: colors.white,
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: fadeIn(frame, TOAST_SHOW, 10),
            transform: `translateY(${slideUp(frame, TOAST_SHOW, 20, 10)}px)`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <span>✓</span> Note saved to visit successfully
        </div>
      )}
    </div>
  );
};
