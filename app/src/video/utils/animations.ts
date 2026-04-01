import { interpolate, spring, Easing } from 'remotion';

export function fadeIn(frame: number, startFrame: number, duration = 15): number {
  return interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

export function fadeOut(frame: number, startFrame: number, duration = 15): number {
  return interpolate(frame, [startFrame, startFrame + duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

export function slideUp(frame: number, startFrame: number, distance = 40, duration = 20): number {
  return interpolate(frame, [startFrame, startFrame + duration], [distance, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
}

export function slideIn(frame: number, startFrame: number, distance = 60, duration = 20): number {
  return interpolate(frame, [startFrame, startFrame + duration], [distance, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
}

export function scaleIn(frame: number, fps: number, startFrame: number, config?: { damping?: number; mass?: number }): number {
  return spring({
    frame: frame - startFrame,
    fps,
    config: {
      damping: config?.damping ?? 12,
      mass: config?.mass ?? 0.5,
    },
  });
}

export function typewriterProgress(frame: number, startFrame: number, textLength: number, charsPerFrame = 1.5): number {
  const elapsed = Math.max(0, frame - startFrame);
  const charsTyped = Math.min(Math.floor(elapsed * charsPerFrame), textLength);
  return charsTyped;
}

export function cursorPosition(
  frame: number,
  keyframes: Array<{ frame: number; x: number; y: number }>,
): { x: number; y: number } {
  if (keyframes.length === 0) return { x: 0, y: 0 };
  if (frame <= keyframes[0].frame) return { x: keyframes[0].x, y: keyframes[0].y };

  for (let i = 0; i < keyframes.length - 1; i++) {
    const current = keyframes[i];
    const next = keyframes[i + 1];
    if (frame >= current.frame && frame <= next.frame) {
      const progress = interpolate(frame, [current.frame, next.frame], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.cubic),
      });
      return {
        x: current.x + (next.x - current.x) * progress,
        y: current.y + (next.y - current.y) * progress,
      };
    }
  }

  const last = keyframes[keyframes.length - 1];
  return { x: last.x, y: last.y };
}

export function progressFill(frame: number, startFrame: number, duration = 30): number {
  return interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
}

export function countUp(frame: number, startFrame: number, target: number, duration = 45): number {
  const progress = interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return Math.round(target * progress);
}

export function staggerDelay(index: number, baseDelay = 6): number {
  return index * baseDelay;
}
