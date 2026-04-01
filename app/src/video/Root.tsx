import React from 'react';
import { Composition } from 'remotion';
import { CareMetricDemoVideo } from './Video';
import { TutorialVideo } from './TutorialVideo';
import type { TutorialVideoProps } from './TutorialVideo';
import { VIDEO_WIDTH, VIDEO_HEIGHT, FPS, TOTAL_FRAMES } from './utils/constants';
import { computeTotalFrames } from './video-utils';

const DEFAULT_TUTORIAL_PROPS: TutorialVideoProps = {
  title: 'Tutorial Preview',
  description: '',
  scenes: [
    {
      order: 1,
      title: 'Welcome',
      type: 'intro',
      durationSeconds: 8,
      narration: 'Welcome to this tutorial.',
      shortNarration: 'Welcome',
      captionText: 'Getting started',
      visualHint: '',
    },
    {
      order: 2,
      title: 'Complete',
      type: 'outro',
      durationSeconds: 6,
      narration: 'You have completed this tutorial.',
      shortNarration: 'Done',
      captionText: 'Tutorial complete',
      visualHint: '',
    },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CareMetricDemo"
        component={CareMetricDemoVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="TutorialVideo"
        component={TutorialVideo as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={computeTotalFrames(DEFAULT_TUTORIAL_PROPS.scenes)}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={DEFAULT_TUTORIAL_PROPS}
        calculateMetadata={({ props }) => ({
          durationInFrames: computeTotalFrames((props as unknown as TutorialVideoProps).scenes),
        })}
      />
    </>
  );
};
