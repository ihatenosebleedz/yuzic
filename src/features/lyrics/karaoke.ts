import type { LyricWord } from '@/providers/contracts/ServerAdapter';

/**
 * Opacity of a word while it waits, and the resting state the moment a word
 * begins. Each word climbs from here to full over `KARAOKE_WORD_REVEAL_MS`;
 * the ramp is what "lighting up" is. One value for both so nothing snaps
 * twice: waiting and just-begun are the same dim resting state, and only the
 * ramp distinguishes them.
 */
const KARAOKE_WORD_WAITING_OPACITY = 0.45;

/**
 * How long a word takes to reach full opacity once it begins, whatever the
 * word's own duration.
 *
 * A ramp measured on the *word's* clock redesigns the blink: a 150 ms word
 * given a 150 ms ramp flips on harder than the voice it follows, and the
 * stop-start strobes. A fixed window longer than the typical word spacing
 * crossfades each reveal into the next, so the light walks across the line
 * rather than stepping word to word — the sung word glows in as its
 * predecessors finish, as Apple Music's lyrics do.
 */
const KARAOKE_WORD_REVEAL_MS = 350;

/** A word and how far through its reveal window it is. */
type KaraokeWord = { text: string; progress: number };

/**
 * Each word's progress through its reveal: 0 while it waits, 1 once its
 * reveal window has passed, the fraction in between. A reveal is anchored to
 * the word's start, not its own duration, and a word's end plays no part —
 * only that a previously-sung word keeps its full shine and a word yet to
 * begin stays dark. A line without word timings yields no words, so a caller
 * reaching here already knows it has what it needs — the undefined case is
 * just untyped callers' safety.
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
    const raw = (positionMs - word.startMs) / KARAOKE_WORD_REVEAL_MS;
    return { text: word.text, progress: Math.min(1, Math.max(0, raw)) };
  });
}

/** The opacity a word draws at `progress`: resting while waiting, full once
 *  revealed, the eased ramp between. */
export function karaokeWordOpacity(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  // Smoothed so a reveal accelerates out of rest and settles into full, which
  // is how a glow reads; a linear ramp still flickers at the word boundaries.
  const eased = clamped * clamped * (3 - 2 * clamped);
  return KARAOKE_WORD_WAITING_OPACITY + (1 - KARAOKE_WORD_WAITING_OPACITY) * eased;
}