export type {
  RemotionCalloutAnimation,
  RemotionCalloutProps,
  RemotionCalloutStyle,
  RemotionCaptionCue,
  RemotionCaptionPlan,
  RemotionCaptionStyle,
  RemotionCompositionPlan,
  RemotionCompositionProps,
  RemotionExecutorCancelResponse,
  RemotionExecutorFinalizeResponse,
  RemotionExecutorProgressResponse,
  RemotionExecutorStartPayload,
  RemotionFinalizePlan,
  RemotionHighlightProps,
  RemotionNarrationSyncPoint,
  RemotionNarrationTrack,
  RemotionOverlayProps,
  RemotionProgressFrame,
  RemotionSceneProps,
  RemotionSlideDirection,
  RemotionSpringConfig,
  RemotionStitchStage,
  RemotionSubtitleFile,
  RemotionTransitionProps,
  RemotionTransitionType,
  RemotionVideoSegmentProps,
  RemotionZoomProps,
} from './types';

export {
  buildCompositionId,
  buildRemotionCompositionProps,
  buildRemotionSceneProps,
  collectSourceVideoUrls,
  framesToMs,
  msToFrames,
} from './compositionPropBuilder';

export {
  buildNarrationSyncPlan,
  buildWordLevelSequences,
  countTotalSyncPoints,
} from './narrationSyncPlanner';

export type { NarrationPlanResult } from './narrationSyncPlanner';

export {
  buildCaptionSequences,
  buildCaptionStyle,
  buildSrtContent,
  buildVttContent,
  computeCaptionCoveragePercent,
} from './captionSequencePlanner';

export {
  buildAllOverlayPlans,
  buildCalloutProps,
  buildHighlightSequenceProps,
  buildOverlaySequences,
  buildZoomSequenceProps,
} from './overlayCompositionPlanner';

export type { OverlayPlanResult } from './overlayCompositionPlanner';

export {
  buildTransitionSequences,
  describeTransition,
  getTransitionFrameWindow,
} from './transitionSequencePlanner';

export {
  assembleRemotionCompositionPlan,
  buildCompositionFingerprint,
  buildRemotionFinalizePlan,
  buildRemotionInputProps,
} from './compositionAssembler';

export {
  estimateCurrentStep,
  estimateRenderEtaSeconds,
  getLatestProgressFrame,
  mapRemotionProgressToFrame,
} from './progressParser';
