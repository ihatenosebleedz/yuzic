import React from 'react';
import { Text } from '@/components/Text';
import { withAlpha } from '@/features/theme/color';
import type { LyricWord } from '@/providers/contracts/ServerAdapter';
import { karaokeWordOpacity, karaokeWordStates } from './karaoke';
import { useKaraokeProgress } from './useKaraokeProgress';

/**
 * A line's words, each lighting up as its timed moment passes.
 *
 * Rendered as spans inside the owning line's own text element, so wrapping,
 * centring and truncation stay the line's business — this is only the colours.
 * It is mounted just on the current line and only when the line really is
 * word-timed, so the fifty-millisecond clock it subscribes to re-renders one
 * line, not the sheet.
 *
 * `fallback` is the plain text, used whenever word-level rendering is refused
 * (no timing to read, or a jukebox holding the clock). The callers that reach
 * here already know they have words; `fallback` keeps this a single component
 * rather than two at every call site.
 */
export function KaraokeLine({
  words,
  active,
  color,
  fallback,
}: {
  words: LyricWord[];
  active: boolean;
  color: string;
  fallback: string;
}) {
  const { positionSeconds, wordLevel } = useKaraokeProgress(active);

  if (!wordLevel) return <>{fallback}</>;

  const states = karaokeWordStates(words, positionSeconds * 1000);

  return (
    <>
      {states.map((word, index) => (
        <Text
          key={index}
          // A word's shade is its colour's own alpha, not an opacity style —
          // nested text honours a colour everywhere, and opacity on nested text
          // is not something every platform draws.
          style={{ color: withAlpha(color, karaokeWordOpacity(word.progress)) }}
        >
          {word.text}
        </Text>
      ))}
    </>
  );
}