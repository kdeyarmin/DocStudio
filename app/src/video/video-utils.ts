import type { TutorialScene } from './TutorialVideo';
import { FPS } from './utils/constants';

export function computeTotalFrames(scenes: TutorialScene[]): number {
  return scenes.reduce((acc, s) => acc + Math.round(s.durationSeconds * FPS), 0);
}
