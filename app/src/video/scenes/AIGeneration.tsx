import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { colors, fonts } from '../utils/theme';
import { fadeIn, slideUp, slideIn, progressFill } from '../utils/animations';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '../utils/constants';
import { MockSidebar } from '../components/MockSidebar';
import { MockHeader } from '../components/MockHeader';
import { AnimatedCursor } from '../components/AnimatedCursor';
import { TypewriterText } from '../components/TypewriterText';
import { GENERATED_NOTE, CODING_SUGGESTIONS, COMPLETENESS_ITEMS } from './noteData';

export const AIGeneration: React.FC = () => {
  const frame = useCurrentFrame();

  const chiefComplaintText = 'Chest pain, intermittent x 3 days';
  const hpiText = '54yo female presents with substernal chest pain radiating to left arm, worse with exertion...';

  const typeChiefStart = 40;
  const typeHpiStart = 100;
  const fillVitalsStart = 190;
  const clickGenerateFrame = 350;
  const generatingStart = 365;
  const noteRevealStart = 420;
  const codingRevealStart = 630;
  const completenessStart = 710;
  const calloutStart = 800;

  const isGenerating = frame >= generatingStart && frame < noteRevealStart;

  const exitOpacity = interpolate(frame, [870, 900], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cursorKeyframes = [
    { frame: 20, x: 450, y: 200 },
    { frame: 35, x: 450, y: 200, click: true },
    { frame: typeChiefStart + 35, x: 450, y: 290 },
    { frame: typeHpiStart - 5, x: 450, y: 290, click: true },
    { frame: typeHpiStart + 65, x: 370, y: 430 },
    { frame: fillVitalsStart, x: 370, y: 430, click: true },
    { frame: fillVitalsStart + 60, x: 370, y: 530 },
    { frame: clickGenerateFrame - 30, x: 450, y: 600 },
    { frame: clickGenerateFrame, x: 450, y: 600, click: true },
    { frame: clickGenerateFrame + 30, x: 900, y: 350 },
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
        <MockSidebar showAfter={0} activeItem="Encounters" />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 0.45, borderRight: `1px solid ${colors.steel[200]}`, overflow: 'hidden' }}>
            <InputPanel
              frame={frame}
              typeChiefStart={typeChiefStart}
              typeHpiStart={typeHpiStart}
              fillVitalsStart={fillVitalsStart}
              clickGenerateFrame={clickGenerateFrame}
              isGenerating={isGenerating}
              chiefComplaintText={chiefComplaintText}
              hpiText={hpiText}
            />
          </div>

          <div style={{ flex: 0.55, overflow: 'hidden' }}>
            <OutputPanel
              frame={frame}
              noteRevealStart={noteRevealStart}
              codingRevealStart={codingRevealStart}
              completenessStart={completenessStart}
              calloutStart={calloutStart}
              isGenerating={isGenerating}
            />
          </div>
        </div>
      </div>
      <AnimatedCursor keyframes={cursorKeyframes} showAfter={10} />
    </div>
  );
};

const InputPanel: React.FC<{
  frame: number;
  typeChiefStart: number;
  typeHpiStart: number;
  fillVitalsStart: number;
  clickGenerateFrame: number;
  isGenerating: boolean;
  chiefComplaintText: string;
  hpiText: string;
}> = ({ frame, typeChiefStart, typeHpiStart, fillVitalsStart, clickGenerateFrame, isGenerating, chiefComplaintText, hpiText }) => {
  return (
    <div style={{ padding: 20, overflowY: 'hidden', height: '100%' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: colors.steel[900], marginBottom: 4, opacity: fadeIn(frame, 5, 10) }}>
        New Encounter Note
      </div>
      <div style={{ fontSize: 12, color: colors.steel[400], marginBottom: 16, opacity: fadeIn(frame, 8, 10) }}>
        Sarah Mitchell -- Follow-up Visit
      </div>

      <div style={{ opacity: fadeIn(frame, 12, 10), marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: colors.steel[500], marginBottom: 4 }}>Note Type</div>
        <div
          style={{
            padding: '8px 12px',
            border: `1px solid ${colors.steel[200]}`,
            borderRadius: 6,
            fontSize: 13,
            color: colors.steel[800],
            backgroundColor: colors.white,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>SOAP Note</span>
          <span style={{ color: colors.steel[400], fontSize: 10 }}>▼</span>
        </div>
      </div>

      <div style={{ opacity: fadeIn(frame, 18, 10), marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: colors.steel[500], marginBottom: 4 }}>Chief Complaint</div>
        <div
          style={{
            padding: '8px 12px',
            border: `1px solid ${frame > typeChiefStart ? colors.brand[300] : colors.steel[200]}`,
            borderRadius: 6,
            fontSize: 13,
            color: colors.steel[800],
            backgroundColor: colors.white,
            minHeight: 36,
            boxShadow: frame > typeChiefStart && frame < typeHpiStart ? `0 0 0 3px ${colors.brand[100]}` : 'none',
          }}
        >
          <TypewriterText text={chiefComplaintText} startFrame={typeChiefStart} charsPerFrame={1.8} />
        </div>
      </div>

      <div style={{ opacity: fadeIn(frame, 25, 10), marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: colors.steel[500], marginBottom: 4 }}>
          History of Present Illness
        </div>
        <div
          style={{
            padding: '8px 12px',
            border: `1px solid ${frame > typeHpiStart ? colors.brand[300] : colors.steel[200]}`,
            borderRadius: 6,
            fontSize: 13,
            color: colors.steel[800],
            backgroundColor: colors.white,
            minHeight: 72,
            lineHeight: 1.5,
            boxShadow: frame > typeHpiStart && frame < fillVitalsStart ? `0 0 0 3px ${colors.brand[100]}` : 'none',
          }}
        >
          <TypewriterText text={hpiText} startFrame={typeHpiStart} charsPerFrame={1.5} />
        </div>
      </div>

      <div style={{ opacity: fadeIn(frame, 30, 10), marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: colors.steel[500], marginBottom: 6 }}>Vitals</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { label: 'BP', value: '145/92' },
            { label: 'HR', value: '88 bpm' },
            { label: 'Temp', value: '98.6°F' },
            { label: 'SpO2', value: '97%' },
          ].map((vital, i) => {
            const showValue = frame > fillVitalsStart + i * 12;
            return (
              <div
                key={vital.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  border: `1px solid ${colors.steel[200]}`,
                  borderRadius: 6,
                  backgroundColor: colors.white,
                }}
              >
                <span style={{ fontSize: 10, color: colors.steel[400], width: 32 }}>{vital.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: showValue ? colors.steel[800] : colors.steel[200] }}>
                  {showValue ? vital.value : '---'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ opacity: fadeIn(frame, 35, 10), marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: colors.steel[500], marginBottom: 4 }}>Assessment</div>
        <div
          style={{
            padding: '8px 12px',
            border: `1px solid ${colors.steel[200]}`,
            borderRadius: 6,
            fontSize: 13,
            color: colors.steel[800],
            backgroundColor: colors.white,
            minHeight: 36,
          }}
        >
          {frame > fillVitalsStart + 60 && (
            <TypewriterText
              text="I20.0 - Unstable angina"
              startFrame={fillVitalsStart + 60}
              charsPerFrame={2}
            />
          )}
        </div>
      </div>

      <div style={{ opacity: fadeIn(frame, clickGenerateFrame - 60, 15) }}>
        <button
          style={{
            width: '100%',
            padding: '12px 20px',
            borderRadius: 8,
            border: 'none',
            background: isGenerating
              ? colors.steel[300]
              : `linear-gradient(135deg, ${colors.brand[600]}, ${colors.brand[500]})`,
            color: colors.white,
            fontSize: 14,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: isGenerating ? 'none' : `0 4px 12px ${colors.brand[600]}30`,
            cursor: 'pointer',
            fontFamily: fonts.sans,
          }}
        >
          {isGenerating ? (
            <>
              <span style={{ display: 'inline-block', animation: 'none' }}>⟳</span>
              Generating Note...
            </>
          ) : (
            <>
              <span>✨</span>
              Generate AI Draft
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const OutputPanel: React.FC<{
  frame: number;
  noteRevealStart: number;
  codingRevealStart: number;
  completenessStart: number;
  calloutStart: number;
  isGenerating: boolean;
}> = ({ frame, noteRevealStart, codingRevealStart, completenessStart, calloutStart, isGenerating }) => {
  const sections = [
    { title: 'Subjective', content: GENERATED_NOTE.subjective, color: colors.brand[600], delay: 0 },
    { title: 'Objective', content: GENERATED_NOTE.objective, color: colors.success, delay: 45 },
    { title: 'Assessment', content: GENERATED_NOTE.assessment, color: colors.warning, delay: 90 },
    { title: 'Plan', content: GENERATED_NOTE.plan, color: '#0ea5e9', delay: 135 },
  ];

  return (
    <div style={{ padding: 20, overflowY: 'hidden', height: '100%', position: 'relative' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: colors.steel[900], marginBottom: 16, opacity: fadeIn(frame, 5, 10) }}>
        Generated Note
      </div>

      {frame < noteRevealStart && !isGenerating && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: 300,
            color: colors.steel[300],
            fontSize: 14,
          }}
        >
          <span style={{ fontSize: 40, marginBottom: 12 }}>📝</span>
          Fill in the details and click Generate
        </div>
      )}

      {isGenerating && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: 300,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: `3px solid ${colors.steel[200]}`,
              borderTopColor: colors.brand[600],
              transform: `rotate(${(frame * 12) % 360}deg)`,
            }}
          />
          <div style={{ marginTop: 16, color: colors.brand[600], fontWeight: 600, fontSize: 14 }}>
            Generating Note...
          </div>
          <div style={{ marginTop: 4, color: colors.steel[400], fontSize: 12 }}>
            Analyzing input and generating compliant documentation
          </div>
        </div>
      )}

      {frame >= noteRevealStart && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sections.map((section) => {
            const sectionStart = noteRevealStart + section.delay;
            const opacity = fadeIn(frame, sectionStart, 15);
            const translateX = slideIn(frame, sectionStart, 30, 18);
            const maxChars = Math.max(0, Math.floor((frame - sectionStart) * 4));
            const displayText = section.content.slice(0, Math.min(maxChars, 120)) + (section.content.length > 120 ? '...' : '');

            return (
              <div
                key={section.title}
                style={{
                  opacity,
                  transform: `translateX(${translateX}px)`,
                  borderLeft: `3px solid ${section.color}`,
                  padding: '8px 12px',
                  backgroundColor: `${section.color}08`,
                  borderRadius: '0 6px 6px 0',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: section.color, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {section.title}
                </div>
                <div style={{ fontSize: 11, color: colors.steel[600], lineHeight: 1.5 }}>
                  {displayText}
                </div>
              </div>
            );
          })}

          {frame >= codingRevealStart && (
            <div style={{ marginTop: 8, opacity: fadeIn(frame, codingRevealStart, 15) }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: colors.steel[500], marginBottom: 6 }}>
                Coding Suggestions
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {CODING_SUGGESTIONS.map((code, i) => {
                  const codeOpacity = fadeIn(frame, codingRevealStart + 8 + i * 8, 10);
                  return (
                    <div
                      key={code.code}
                      style={{
                        opacity: codeOpacity,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 4,
                        backgroundColor: colors.steel[50],
                        border: `1px solid ${colors.steel[200]}`,
                        fontSize: 10,
                      }}
                    >
                      <span style={{ fontWeight: 700, color: colors.brand[700], fontFamily: fonts.mono }}>{code.code}</span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          padding: '1px 4px',
                          borderRadius: 3,
                          backgroundColor: code.confidence >= 90 ? `${colors.success}20` : `${colors.warning}20`,
                          color: code.confidence >= 90 ? colors.success : colors.warning,
                        }}
                      >
                        {code.confidence}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {frame >= completenessStart && (
            <div style={{ marginTop: 8, opacity: fadeIn(frame, completenessStart, 15) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: colors.steel[500] }}>Completeness</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: colors.success }}>
                  {Math.min(96, Math.round(progressFill(frame, completenessStart, 40) * 96))}%
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, backgroundColor: colors.steel[100], overflow: 'hidden', marginBottom: 8 }}>
                <div
                  style={{
                    height: '100%',
                    width: `${progressFill(frame, completenessStart, 40) * 96}%`,
                    background: `linear-gradient(90deg, ${colors.success}, ${colors.brand[500]})`,
                    borderRadius: 3,
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                {COMPLETENESS_ITEMS.map((item, i) => {
                  const checked = frame > completenessStart + 10 + i * 5;
                  return (
                    <div
                      key={item}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10,
                        color: checked ? colors.success : colors.steel[300],
                        opacity: fadeIn(frame, completenessStart + 5 + i * 4, 6),
                      }}
                    >
                      <span>{checked ? '✓' : '○'}</span>
                      <span>{item}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {frame >= calloutStart && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            right: 20,
            padding: '12px 16px',
            borderRadius: 8,
            background: `linear-gradient(135deg, ${colors.brand[600]}, ${colors.brand[500]})`,
            color: colors.white,
            fontSize: 16,
            fontWeight: 700,
            textAlign: 'center',
            opacity: fadeIn(frame, calloutStart, 15),
            transform: `translateY(${slideUp(frame, calloutStart, 20, 15)}px)`,
            boxShadow: `0 4px 16px ${colors.brand[600]}40`,
          }}
        >
          Full SOAP note in 15 seconds
        </div>
      )}
    </div>
  );
};
