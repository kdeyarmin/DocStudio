import React from 'react';
import { Sequence, useCurrentFrame, interpolate, Audio, Img } from 'remotion';
import { VIDEO_WIDTH, VIDEO_HEIGHT, FPS } from './utils/constants';
import { colors, fonts, shadows } from './utils/theme';
import { fadeIn, fadeOut, slideUp, scaleIn } from './utils/animations';

export interface TutorialScene {
  order: number;
  title: string;
  type: 'intro' | 'step' | 'outro';
  durationSeconds: number;
  narration: string;
  shortNarration: string;
  captionText: string;
  visualHint: string;
  screenshotUrl?: string;
}

export interface TutorialVideoProps {
  title: string;
  description: string;
  scenes: TutorialScene[];
  narrationAudioUrl?: string;
  brandColor?: string;
}

function sceneDurationFrames(scene: TutorialScene): number {
  return Math.round(scene.durationSeconds * FPS);
}

function computeSceneFrames(scenes: TutorialScene[]): Array<{ start: number; duration: number }> {
  let cursor = 0;
  return scenes.map((scene) => {
    const duration = sceneDurationFrames(scene);
    const start = cursor;
    cursor += duration;
    return { start, duration };
  });
}

const IntroScene: React.FC<{ scene: TutorialScene; tutorialTitle: string; brandColor: string }> = ({
  scene,
  tutorialTitle,
  brandColor,
}) => {
  const frame = useCurrentFrame();
  const totalFrames = sceneDurationFrames(scene);

  const glowOpacity = interpolate(frame, [0, 20, totalFrames - 20, totalFrames], [0, 0.5, 0.5, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const iconScale = scaleIn(frame, FPS, 5, { damping: 14, mass: 0.6 });
  const iconOpacity = fadeIn(frame, 5, 15);

  const titleOpacity = fadeIn(frame, 20, 18);
  const titleY = slideUp(frame, 20, 30, 18);

  const descOpacity = fadeIn(frame, 45, 18);
  const descY = slideUp(frame, 45, 20, 18);

  const exitOpacity = fadeOut(frame, totalFrames - 15, 15);

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
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${brandColor}30, transparent 70%)`,
          opacity: glowOpacity,
        }}
      />

      <div
        style={{
          opacity: iconOpacity,
          transform: `scale(${iconScale})`,
          marginBottom: 32,
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 8px 32px ${brandColor}40`,
          }}
        >
          <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
      </div>

      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          zIndex: 1,
          textAlign: 'center',
          maxWidth: 900,
          padding: '0 60px',
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: colors.steel[900],
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
          }}
        >
          {tutorialTitle}
        </div>
      </div>

      <div
        style={{
          opacity: descOpacity,
          transform: `translateY(${descY}px)`,
          marginTop: 20,
          zIndex: 1,
          textAlign: 'center',
          maxWidth: 700,
          padding: '0 60px',
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 400,
            color: colors.steel[500],
            lineHeight: 1.5,
          }}
        >
          {scene.narration}
        </div>
      </div>
    </div>
  );
};

const StepScene: React.FC<{
  scene: TutorialScene;
  stepNumber: number;
  totalSteps: number;
  brandColor: string;
}> = ({ scene, stepNumber, totalSteps, brandColor }) => {
  const frame = useCurrentFrame();
  const totalFrames = sceneDurationFrames(scene);

  const badgeOpacity = fadeIn(frame, 5, 12);
  const badgeY = slideUp(frame, 5, 25, 15);

  const titleOpacity = fadeIn(frame, 15, 15);
  const titleY = slideUp(frame, 15, 30, 18);

  const contentOpacity = fadeIn(frame, 30, 18);
  const contentY = slideUp(frame, 30, 20, 18);

  const captionOpacity = fadeIn(frame, 45, 15);

  const progressWidth = interpolate(frame, [0, totalFrames], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const exitOpacity = fadeOut(frame, totalFrames - 10, 10);

  const hasScreenshot = !!scene.screenshotUrl;

  return (
    <div
      style={{
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: colors.white,
        fontFamily: fonts.sans,
        position: 'relative',
        overflow: 'hidden',
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          height: 4,
          backgroundColor: colors.steel[100],
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${(stepNumber / totalSteps) * 100}%`,
            backgroundColor: brandColor,
            transition: 'width 0.3s',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 60px',
          borderBottom: `1px solid ${colors.steel[100]}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 800, color: colors.white }}>C</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: colors.steel[400] }}>
            CareMetric AI Tutorial
          </span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: colors.steel[400] }}>
          Step {stepNumber} of {totalSteps}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: hasScreenshot ? 'row' : 'column',
          alignItems: hasScreenshot ? 'stretch' : 'center',
          justifyContent: hasScreenshot ? 'stretch' : 'center',
          padding: hasScreenshot ? 0 : '60px 80px',
          gap: 0,
        }}
      >
        {hasScreenshot ? (
          <>
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '40px 50px',
              }}
            >
              <div
                style={{
                  opacity: badgeOpacity,
                  transform: `translateY(${badgeY}px)`,
                  marginBottom: 16,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 14px',
                    borderRadius: 20,
                    backgroundColor: `${brandColor}15`,
                    color: brandColor,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  Step {stepNumber}
                </span>
              </div>

              <div
                style={{
                  opacity: titleOpacity,
                  transform: `translateY(${titleY}px)`,
                  fontSize: 36,
                  fontWeight: 800,
                  color: colors.steel[900],
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  marginBottom: 20,
                }}
              >
                {scene.title}
              </div>

              <div
                style={{
                  opacity: contentOpacity,
                  transform: `translateY(${contentY}px)`,
                  fontSize: 18,
                  fontWeight: 400,
                  color: colors.steel[500],
                  lineHeight: 1.6,
                }}
              >
                {scene.narration}
              </div>
            </div>

            <div
              style={{
                width: '55%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 30,
                backgroundColor: colors.steel[50],
              }}
            >
              <div
                style={{
                  opacity: contentOpacity,
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: shadows.modal,
                  maxWidth: '100%',
                  maxHeight: '100%',
                }}
              >
                <Img src={scene.screenshotUrl!} style={{ width: '100%', display: 'block' }} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                opacity: badgeOpacity,
                transform: `translateY(${badgeY}px)`,
                marginBottom: 24,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 20px',
                  borderRadius: 24,
                  backgroundColor: `${brandColor}15`,
                  color: brandColor,
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                Step {stepNumber}
              </span>
            </div>

            <div
              style={{
                opacity: titleOpacity,
                transform: `translateY(${titleY}px)`,
                fontSize: 44,
                fontWeight: 800,
                color: colors.steel[900],
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                textAlign: 'center',
                maxWidth: 900,
                marginBottom: 24,
              }}
            >
              {scene.title}
            </div>

            <div
              style={{
                opacity: contentOpacity,
                transform: `translateY(${contentY}px)`,
                fontSize: 22,
                fontWeight: 400,
                color: colors.steel[500],
                lineHeight: 1.6,
                textAlign: 'center',
                maxWidth: 700,
                marginBottom: 32,
              }}
            >
              {scene.narration}
            </div>

            {scene.visualHint && (
              <div
                style={{
                  opacity: contentOpacity,
                  padding: '16px 28px',
                  borderRadius: 12,
                  backgroundColor: colors.steel[50],
                  border: `1px solid ${colors.steel[200]}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.steel[400]} strokeWidth={2}>
                  <circle cx={12} cy={12} r={10} />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <span style={{ fontSize: 15, color: colors.steel[500], fontWeight: 500 }}>
                  {scene.visualHint}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <div
        style={{
          padding: '16px 60px 20px',
          borderTop: `1px solid ${colors.steel[100]}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: captionOpacity,
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: colors.steel[600],
            fontStyle: 'italic',
          }}
        >
          {scene.captionText || scene.shortNarration}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 120,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.steel[100],
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressWidth}%`,
                backgroundColor: brandColor,
                borderRadius: 2,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const OutroScene: React.FC<{ scene: TutorialScene; tutorialTitle: string; brandColor: string }> = ({
  scene,
  tutorialTitle: _tutorialTitle,
  brandColor,
}) => {
  const frame = useCurrentFrame();

  const checkScale = scaleIn(frame, FPS, 10, { damping: 12, mass: 0.6 });
  const checkOpacity = fadeIn(frame, 10, 15);

  const titleOpacity = fadeIn(frame, 30, 18);
  const titleY = slideUp(frame, 30, 30, 18);

  const summaryOpacity = fadeIn(frame, 55, 18);
  const summaryY = slideUp(frame, 55, 20, 18);

  const brandOpacity = fadeIn(frame, 80, 18);

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
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${brandColor}20, transparent 70%)`,
          opacity: 0.6,
        }}
      />

      <div
        style={{
          opacity: checkOpacity,
          transform: `scale(${checkScale})`,
          marginBottom: 32,
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: `linear-gradient(135deg, #10b981, #059669)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(16, 185, 129, 0.35)',
          }}
        >
          <svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          zIndex: 1,
          textAlign: 'center',
          maxWidth: 800,
        }}
      >
        <div
          style={{
            fontSize: 42,
            fontWeight: 800,
            color: colors.steel[900],
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          Tutorial Complete
        </div>
      </div>

      <div
        style={{
          opacity: summaryOpacity,
          transform: `translateY(${summaryY}px)`,
          marginTop: 20,
          zIndex: 1,
          textAlign: 'center',
          maxWidth: 650,
          padding: '0 40px',
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 400,
            color: colors.steel[500],
            lineHeight: 1.6,
          }}
        >
          {scene.narration}
        </div>
      </div>

      <div
        style={{
          opacity: brandOpacity,
          marginTop: 48,
          zIndex: 1,
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
            background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 800, color: colors.white }}>C</span>
        </div>
        <span style={{ fontSize: 18, fontWeight: 600, color: colors.steel[400] }}>
          CareMetric AI
        </span>
      </div>
    </div>
  );
};

export const TutorialVideo: React.FC<TutorialVideoProps> = ({
  title,
  description: _description,
  scenes,
  narrationAudioUrl,
  brandColor = colors.brand[600],
}) => {
  const sceneFrames = computeSceneFrames(scenes);
  const stepScenes = scenes.filter((s) => s.type === 'step');
  let stepCounter = 0;

  return (
    <div
      style={{
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: colors.steel[50],
      }}
    >
      {scenes.map((scene, i) => {
        const { start, duration } = sceneFrames[i];

        if (scene.type === 'intro') {
          return (
            <Sequence key={i} from={start} durationInFrames={duration} name={`Intro: ${scene.title}`}>
              <IntroScene scene={scene} tutorialTitle={title} brandColor={brandColor} />
            </Sequence>
          );
        }

        if (scene.type === 'outro') {
          return (
            <Sequence key={i} from={start} durationInFrames={duration} name={`Outro: ${scene.title}`}>
              <OutroScene scene={scene} tutorialTitle={title} brandColor={brandColor} />
            </Sequence>
          );
        }

        stepCounter++;
        return (
          <Sequence key={i} from={start} durationInFrames={duration} name={`Step ${stepCounter}: ${scene.title}`}>
            <StepScene
              scene={scene}
              stepNumber={stepCounter}
              totalSteps={stepScenes.length}
              brandColor={brandColor}
            />
          </Sequence>
        );
      })}

      {narrationAudioUrl && (
        <Audio src={narrationAudioUrl} />
      )}
    </div>
  );
};
