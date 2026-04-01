import React from 'react';
import { Sequence } from 'remotion';
import { SCENES, VIDEO_WIDTH, VIDEO_HEIGHT } from './utils/constants';
import { BrandIntro } from './scenes/BrandIntro';
import { ProblemStatement } from './scenes/ProblemStatement';
import { DashboardOverview } from './scenes/DashboardOverview';
import { AIGeneration } from './scenes/AIGeneration';
import { AmbientListening } from './scenes/AmbientListening';
import { FeatureMontage } from './scenes/FeatureMontage';
import { ClosingCTA } from './scenes/ClosingCTA';
import { VideoProgressBar } from './components/ProgressBar';

export const CareMetricDemoVideo: React.FC = () => {
  return (
    <div
      style={{
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
      }}
    >
      <Sequence
        from={SCENES.BRAND_INTRO.start}
        durationInFrames={SCENES.BRAND_INTRO.duration}
        name="Brand Intro"
      >
        <BrandIntro />
      </Sequence>

      <Sequence
        from={SCENES.PROBLEM.start}
        durationInFrames={SCENES.PROBLEM.duration}
        name="Problem Statement"
      >
        <ProblemStatement />
      </Sequence>

      <Sequence
        from={SCENES.DASHBOARD.start}
        durationInFrames={SCENES.DASHBOARD.duration}
        name="Dashboard Overview"
      >
        <DashboardOverview />
      </Sequence>

      <Sequence
        from={SCENES.AI_GENERATION.start}
        durationInFrames={SCENES.AI_GENERATION.duration}
        name="AI Note Generation"
      >
        <AIGeneration />
      </Sequence>

      <Sequence
        from={SCENES.AMBIENT.start}
        durationInFrames={SCENES.AMBIENT.duration}
        name="Ambient Listening"
      >
        <AmbientListening />
      </Sequence>

      <Sequence
        from={SCENES.MONTAGE.start}
        durationInFrames={SCENES.MONTAGE.duration}
        name="Feature Montage"
      >
        <FeatureMontage />
      </Sequence>

      <Sequence
        from={SCENES.CLOSING.start}
        durationInFrames={SCENES.CLOSING.duration}
        name="Closing CTA"
      >
        <ClosingCTA />
      </Sequence>

      <VideoProgressBar />
    </div>
  );
};
