import type { LyricWord } from '@/providers/contracts/ServerAdapter';

/**
 * Opacity of a word while it waits, and of the word being sung the instant it
 * begins. Sung words are fully opaque; between the two, the current word climbs
 * from here to full as it is sung — the "lighting up" a karaoke line is. One
 * value for both so nothing snaps twice: waiting and just-begun are the same
 * dim resting state, and only the ramp distinguishes them.
 */
const KARAOKE_WORD_WAITING_OPACITY = 0.45;

/** A word and how far through its own window it is. */
type KaraokeWord = { text: string; progress: number };

/**
 * Each word's progress through its own timed window: 0 while it waits, 1 once
 * it is fully sung, the fraction of the way through between. A line without
 * word timings yields no words, so a caller reaching here already knows it has
 * what it needs — the undefined case is just untyped callers' safety.
 */
export function karaokeWordStates(
  words: readonly LyricWord[] | undefined,
  positionMs: number
): KaraokeWord[] {
  if (!words) return [];
  return words.map((word) => {
    if (positionMs < word.startMs) {
      return { text: word.text, progress: 0 };
    }
    // A zero-length word (start === end) is sung the instant it begins. A
    // badly-signed end is clamped rather than echoed as a negative ramp.
    const span = word.endMs - word.startMs;
    const raw = span > 0 ? (positionMs - word.startMs) / span : 1;
    return { text: word.text, progress: Math.min(1, Math.max(0, raw)) };
  });
}

/** The opacity a word draws at `progress`: resting while waiting, full once
 *  sung, the ramp between for the word being sung. */
export function karaokeWordOpacity(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return KARAOKE_WORD_WAITING_OPACITY + (1 - KARAOKE_WORD_WAITING_OPACITY) * clamped;
}