import React from 'react';
import { useCurrentFrame } from 'remotion';
import { typewriterProgress } from '../utils/animations';

interface TypewriterTextProps {
  text: string;
  startFrame: number;
  charsPerFrame?: number;
  style?: React.CSSProperties;
  showCursor?: boolean;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  startFrame,
  charsPerFrame = 1.5,
  style,
  showCursor = true,
}) => {
  const frame = useCurrentFrame();
  const charsTyped = typewriterProgress(frame, startFrame, text.length, charsPerFrame);
  const displayed = text.slice(0, charsTyped);
  const isTyping = charsTyped > 0 && charsTyped < text.length;
  const cursorVisible = showCursor && isTyping && frame % 16 < 10;

  return (
    <span style={style}>
      {displayed}
      {cursorVisible && (
        <span
          style={{
            display: 'inline-block',
            width: 2,
            height: '1em',
            backgroundColor: 'currentColor',
            marginLeft: 1,
            verticalAlign: 'text-bottom',
          }}
        />
      )}
    </span>
  );
};
